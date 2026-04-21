/* Voice input — record audio, send to API, add items to current check */
window.CHK = window.CHK || {};

(function () {
  const CHK = window.CHK;
  const api = CHK.api;
  const $ = CHK.$;
  const toast = (msg) => CHK.toast?.(msg);

  const btn = $("btnVoiceInput");
  if (!btn) return;

  let mediaRecorder = null, audioChunks = [], isRecording = false;

  btn.onclick = async () => {
    if (btn.classList.contains("loading")) return;
    if (!isRecording) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        audioChunks = [];
        mediaRecorder = new MediaRecorder(stream);
        mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunks.push(e.data); };
        mediaRecorder.onstop = async () => {
          stream.getTracks().forEach(t => t.stop());
          btn.classList.remove("recording");
          btn.classList.add("loading");
          const mimeType = MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "audio/mp4";
          const blob = new Blob(audioChunks, { type: mimeType });
          const form = new FormData();
          form.append("audio", blob, mimeType === "audio/webm" ? "voice.webm" : "voice.mp4");
          try {
            const base = CHK.API_BASE || "https://api.checki.ge";
            const res = await fetch(`${base}/api/checks/${CHK.check?.id}/voice-add`, {
              method: "POST",
              headers: { "Authorization": `Bearer ${CHK.getToken?.() || ""}` },
              body: form,
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.detail || "Voice error");
            if (data.items_added?.length) {
              toast("Added: " + data.items_added.map(i => `${i.qty}× ${i.name}`).join(", "));
              await CHK.check?.reload();
            } else if (!data.needs_price?.length) {
              toast("Nothing recognized");
            }
            if (data.needs_price?.length) await addVoiceNeedsPrice(data.needs_price);
          } catch (e) { toast("Voice: " + (e.message || String(e))); }
          finally { btn.classList.remove("loading"); }
        };
        mediaRecorder.start();
        isRecording = true;
        btn.classList.add("recording");
      } catch (e) { toast("Mic: " + (e.message || "Permission denied")); }
    } else {
      isRecording = false;
      if (mediaRecorder?.state !== "inactive") mediaRecorder.stop();
    }
  };

  async function addVoiceNeedsPrice(items) {
    const id = CHK.check?.id;
    if (!id || !items?.length) return;
    const lowIds = CHK.scan?.lowConfidenceIds;
    for (const item of items) {
      try {
        const r = await api(`/api/checks/${id}/items/add`, {
          method: "POST",
          body: JSON.stringify({ name: item.name, price: item.price || 0, qty: item.qty || 1 }),
        });
        const itemId = r.item_id || r.id;
        if (itemId && lowIds) lowIds.add(String(itemId));
      } catch (_) {}
    }
    await CHK.check?.reload();
    toast(`${items.length} item${items.length > 1 ? "s" : ""} need price ⚠`);
  }
})();
