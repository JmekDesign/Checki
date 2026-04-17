/* Paper check scanning — admin/scan.js */
(function () {
  const CHK = (window.CHK = window.CHK || {});
  const $ = (id) => document.getElementById(id);

  // Item IDs from scan that need review (low confidence or price=0)
  const _lowIds = new Set();
  CHK.scan = { lowConfidenceIds: _lowIds };

  async function doScan(file) {
    const toast = CHK.toast || console.log;
    const btn = $("btnScanCheck");
    const origText = btn ? btn.textContent : "";
    if (btn) { btn.disabled = true; btn.textContent = "…"; }

    try {
      const token = CHK.getToken ? CHK.getToken() : "";
      const base = CHK.API_BASE || "https://api.checki.ge";

      const form = new FormData();
      form.append("image", file);

      const resp = await fetch(base + "/api/checks/scan", {
        method: "POST",
        headers: { Authorization: "Bearer " + token },
        body: form,
      });
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.detail || resp.statusText);
      }
      const parsed = await resp.json();
      const items = Array.isArray(parsed.items) ? parsed.items : [];
      if (!items.length) { toast("Nothing found in photo"); return; }

      // Open check with parsed guest name
      const cr = await CHK.api("/api/checks", {
        method: "POST",
        body: JSON.stringify({ guest: parsed.guest || "Scan" }),
      });
      const checkId = cr.id || cr.check_id;
      if (!checkId) throw new Error("Failed to open check");

      // Add items one by one, track low-confidence IDs
      _lowIds.clear();
      for (const item of items) {
        try {
          const body = item.product_id
            ? { product_id: item.product_id, qty: item.qty || 1, price: item.price }
            : { name: item.name, price: item.price ?? 0, qty: item.qty || 1 };

          const r = await CHK.api(`/api/checks/${checkId}/items/add`, {
            method: "POST",
            body: JSON.stringify(body),
          });

          if (item.confidence === "low") {
            const itemId = r.item_id || r.id;
            if (itemId) _lowIds.add(String(itemId));
          }
        } catch (_) { /* skip item that fails */ }
      }

      // Navigate to the check
      if (typeof CHK.openCheck === "function") await CHK.openCheck(checkId);

      const n = _lowIds.size;
      toast(n ? `Check opened · ${n} item${n > 1 ? "s" : ""} need review ⚠️` : "Check opened from scan");
    } catch (e) {
      toast("Scan: " + e.message);
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = origText; }
    }
  }

  function init() {
    const btn = $("btnScanCheck");
    const inp = $("scanFileInput");
    if (!btn || !inp) return;
    btn.onclick = () => inp.click();
    inp.addEventListener("change", () => {
      const f = inp.files[0];
      inp.value = "";
      if (f) doScan(f);
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
