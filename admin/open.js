/* Open checks list — load, render, create, close inline */
window.CHK = window.CHK || {};

(function () {
  const CHK = window.CHK;
  const api = CHK.api;
  const $ = CHK.$;
  const toast = (msg) => CHK.toast?.(msg);

  let openChecks = [];
  let guestSuggestTimer = null;

  /* ── guest name autocomplete ── */
  function showGuestSuggest(names) {
    const box = $("guestSuggestBox");
    if (!box) return;
    box.innerHTML = "";
    if (!names.length) { box.style.display = "none"; return; }
    names.forEach(name => {
      const row = document.createElement("div");
      row.style.cssText = "padding:10px 14px;cursor:pointer;font-size:14px;border-bottom:1px solid rgba(255,255,255,.06)";
      row.textContent = name;
      row.onmousedown = (e) => { e.preventDefault(); $("guestName").value = name; hideGuestSuggest(); };
      box.appendChild(row);
    });
    box.style.display = "block";
  }

  function hideGuestSuggest() {
    const box = $("guestSuggestBox");
    if (box) { box.style.display = "none"; box.innerHTML = ""; }
  }

  async function loadGuestSuggest(q) {
    try {
      const r = await api(`/api/guests?q=${encodeURIComponent(q)}&limit=6`, { method: "GET" });
      showGuestSuggest(Array.isArray(r.items) ? r.items : []);
    } catch (_) { hideGuestSuggest(); }
  }

  const guestNameEl = $("guestName");
  if (guestNameEl) {
    guestNameEl.addEventListener("input", () => {
      clearTimeout(guestSuggestTimer);
      guestSuggestTimer = setTimeout(() => loadGuestSuggest(guestNameEl.value.trim()), 150);
    });
    guestNameEl.addEventListener("focus", () => { if (guestNameEl.value.trim()) loadGuestSuggest(guestNameEl.value.trim()); });
    guestNameEl.addEventListener("blur", () => { setTimeout(hideGuestSuggest, 150); });
    guestNameEl.addEventListener("keydown", (e) => { if (e.key === "Escape") hideGuestSuggest(); });
  }

  /* ── load / render ── */
  async function loadOpen() {
    const r = await api("/api/checks/open", { method: "GET" });
    openChecks = Array.isArray(r) ? r : (r.checks || r.items || []);
    const s = $("openSearch");
    if (s) s.value = "";
    renderOpen();
  }

  function renderOpen() {
    const q = ($("openSearch").value || "").trim().toLowerCase();
    const list = $("openList");
    list.innerHTML = "";
    const filtered = openChecks.filter(c => {
      const num = (c.number ?? c.check_number ?? c.id ?? "").toString().toLowerCase();
      const g = (c.guest_name_snapshot ?? c.guest ?? c.guest_name ?? "").toString().toLowerCase();
      return !q || num.includes(q) || g.includes(q);
    });
    if (!filtered.length) {
      $("openHint").textContent = CHK.t("no_open_checks");
      return;
    }
    $("openHint").textContent = "";
    filtered.forEach(c => {
      const num = c.number ?? c.check_number ?? "";
      const guest = c.guest_name_snapshot ?? c.guest ?? c.guest_name ?? "—";
      const total = Number(c.total ?? c.check_total ?? c.total_amount ?? 0);
      const totalText = Number.isFinite(total) && total > 0 ? `${fmtMoney(total)} ₾` : "";
      const timeStr = c.opened_at
        ? new Date(c.opened_at).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })
        : "";
      const el = document.createElement("div");
      el.className = "item";
      el.style.cssText = "cursor:pointer; display:flex; align-items:center; gap:10px";
      el.innerHTML = `
        <div class="lineLeft" style="flex:1;min-width:0">
          <div class="lineTitle"><b>#${esc(num)} · ${esc(guest)}</b></div>
          <div class="lineMeta">
            <span>${esc(timeStr)}</span>
            ${totalText ? `<span style="font-weight:700;color:var(--text)">${esc(totalText)}</span>` : ""}
          </div>
        </div>
        <button class="btn compact danger" style="flex:none;white-space:nowrap">${CHK.t("close")}</button>
      `;
      el.querySelector("button").onclick = async (e) => { e.stopPropagation(); await closeCheckInline(c); };
      el.onclick = () => CHK.openCheck?.(c.id || c.check_id);
      list.appendChild(el);
    });
  }

  async function closeCheckInline(c) {
    const id = c.id || c.check_id;
    const num = c.number ?? c.check_number ?? "";
    const guest = c.guest_name_snapshot ?? c.guest ?? c.guest_name ?? "—";
    let total = Number(c.total ?? c.check_total ?? c.total_amount ?? 0);
    let items = [];
    try {
      const r = await api(`/api/checks/${id}`, { method: "GET" });
      const chk = r.check || r;
      total = Number(chk.total ?? total);
      items = chk.items || chk.lines || [];
    } catch (_) {}
    const method = await CHK.paymentConfirm?.({ number: num, guest, total, items });
    if (method === null) return;
    try {
      await api(`/api/checks/${id}/close`, { method: "POST", body: JSON.stringify({ payment_method: method }) });
      toast(CHK.t("check_closed"));
      await loadOpen().catch(() => {});
    } catch (e) { toast("Close error: " + e.message); }
  }

  /* ── nav bindings ── */
  $("btnNewCheck").onclick = () => { $("guestName").value = ""; hideGuestSuggest(); CHK.nav.go("screenNew"); $("guestName").focus(); };
  $("btnBackOpen").onclick = () => { hideGuestSuggest(); CHK.nav.back(); };
  $("openSearch").oninput = () => renderOpen();

  $("btnCreateCheck").onclick = async () => {
    try {
      const guest = $("guestName").value.trim();
      if (!guest) return toast(CHK.t("ph_guest_table"));
      const r = await api("/api/checks", { method: "POST", body: JSON.stringify({ guest }) });
      toast(CHK.t("check_opened"));
      await CHK.openCheck?.(r.id || r.check_id);
    } catch (e) { toast("Create error: " + e.message); }
  };

  /* ── helpers ── */
  function fmtMoney(x) {
    const n = Number(x || 0);
    return isFinite(n) ? n.toFixed(2).replace(/\.00$/, "") : "0";
  }

  function esc(s) {
    return (s || "").toString().replace(/[&<>"']/g, (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  CHK.open = { load: loadOpen };
})();
