/* Add item form — product suggest, qty, add item, voice input */
window.CHK = window.CHK || {};

(function () {
  const CHK = window.CHK;
  const api = CHK.api;
  const $ = CHK.$;
  const toast = (msg) => CHK.toast?.(msg);

  let qty = 1;
  let selectedProductId = null;
  let selectedProductName = null;
  let selectedProductPrice = null;
  let suggestTimer = null;
  let _quickItems = [];

  /* ── reset (called on openCheck) ── */
  function reset() {
    qty = 1;
    selectedProductId = selectedProductName = selectedProductPrice = null;
    $("qtyVal").textContent = "1";
    $("itemName").value = "";
    $("itemPrice").value = "";
    $("itemTotal").value = "";
    hideSuggest();
    renderQuickChips();
    recalcAddTotal();
    updateAddButtonState();
  }

  /* ── quick chips ── */
  async function loadQuickChips() {
    try {
      const r = await api("/api/products/quickpicks", { method: "GET" });
      _quickItems = Array.isArray(r.items) ? r.items : [];
    } catch (_) { _quickItems = []; }
    renderQuickChips();
  }

  function renderQuickChips() {
    const chips = $("quickChips");
    if (!chips) return;
    chips.innerHTML = "";
    _quickItems.forEach(p => {
      const c = document.createElement("div");
      c.className = "chip";
      c.textContent = p.name;
      c.onclick = () => { $("itemName").value = p.name; $("itemName").dispatchEvent(new Event("input")); };
      chips.appendChild(c);
    });
  }

  /* ── suggest ── */
  function showSuggest() { $("suggestBox").style.display = "block"; }
  function hideSuggest() { $("suggestBox").style.display = "none"; $("suggestBox").innerHTML = ""; }

  function updateAddButtonState() {
    const name = $("itemName").value.trim();
    const btn = $("btnAddItem");
    if (!name) { btn.disabled = true; return; }
    if (selectedProductId) {
      btn.disabled = !(selectedProductPrice != null || parseNum($("itemPrice").value.trim()) !== null);
      return;
    }
    btn.disabled = parseNum($("itemPrice").value.trim()) === null;
  }

  async function loadSuggest(q) {
    hideSuggest();
    if (!q) { updateAddButtonState(); return; }
    try {
      const r = await api(`/api/products?q=${encodeURIComponent(q)}&limit=20&active_only=true`, { method: "GET" });
      const items = r.items || [];
      if (!items.length) { updateAddButtonState(); return; }

      const exact = items.find(p => (p.name || "").trim().toLowerCase() === q.toLowerCase());
      if (exact) {
        selectedProductId = exact.id;
        selectedProductName = exact.name;
        selectedProductPrice = exact.last_price;
        $("itemPrice").value = exact.last_price != null ? fmtMoney(exact.last_price) : "";
        recalcAddTotal();
        updateAddButtonState();
        return;
      }

      showSuggest();
      const box = $("suggestBox");
      items.forEach(p => {
        const row = document.createElement("div");
        row.className = "suggestItem";
        const pr = p.last_price == null ? "—" : fmtMoney(p.last_price) + " ₾";
        row.innerHTML = `
          <div style="min-width:0"><b>${esc(p.name)}</b><div><small>${esc(p.category || "Other")}</small></div></div>
          <div class="kbd">${esc(pr)}</div>
        `;
        row.onclick = () => {
          selectedProductId = p.id;
          selectedProductName = p.name;
          selectedProductPrice = p.last_price;
          $("itemName").value = p.name;
          $("itemPrice").value = p.last_price != null ? fmtMoney(p.last_price) : "";
          hideSuggest();
          recalcAddTotal();
          updateAddButtonState();
        };
        box.appendChild(row);
      });
      updateAddButtonState();
    } catch (e) { hideSuggest(); updateAddButtonState(); toast("Search: " + e.message); }
  }

  /* ── bindings ── */
  $("btnQtyDec").onclick = () => { qty = Math.max(1, qty - 1); $("qtyVal").textContent = String(qty); recalcAddTotal(); updateAddButtonState(); };
  $("btnQtyInc").onclick = () => { qty = Math.min(99, qty + 1); $("qtyVal").textContent = String(qty); recalcAddTotal(); updateAddButtonState(); };

  $("itemName").addEventListener("input", () => {
    selectedProductId = selectedProductName = selectedProductPrice = null;
    $("itemPrice").value = "";
    hideSuggest();
    clearTimeout(suggestTimer);
    suggestTimer = setTimeout(() => loadSuggest($("itemName").value.trim()), 140);
    recalcAddTotal();
    updateAddButtonState();
  });
  $("itemName").addEventListener("keydown", (e) => { if (e.key === "Escape") hideSuggest(); });
  $("itemPrice").addEventListener("input", () => { recalcAddTotal(); updateAddButtonState(); });
  $("itemPrice").addEventListener("keydown", (e) => {
    if (e.key === "Enter") { e.preventDefault(); addItem(); }
    if (e.key === "Escape") hideSuggest();
  });

  $("btnAddItem").onclick = () => addItem();

  /* ── add item ── */
  async function addItem() {
    const id = CHK.check?.id;
    if (!id) return;
    const name = $("itemName").value.trim();
    const priceStr = $("itemPrice").value.trim();
    if (!name) return toast(CHK.t("enter_item"));
    if ($("btnAddItem").disabled) return toast(CHK.t("price_required"));

    try {
      if (!selectedProductId) {
        try {
          const rr = await api(`/api/products?q=${encodeURIComponent(name)}&limit=20`, { method: "GET" });
          const matches = (rr.items || []).filter(p => (p.name || "").trim().toLowerCase() === name.toLowerCase());
          if (matches.length) {
            matches.sort((a, b) => (Number(b.id) || 0) - (Number(a.id) || 0));
            const p0 = matches[0];
            selectedProductId = p0.id; selectedProductName = p0.name; selectedProductPrice = p0.last_price;
          }
        } catch (_) {}
      }

      if (selectedProductId) {
        const body = { product_id: selectedProductId, qty };
        const maybe = parseNum(priceStr);
        if (maybe !== null) body.price = maybe;
        const changedId = await addItemAndReturn(body, id);
        toast(CHK.t("added"));
        reset();
        await CHK.check?.reload();
        flashItemRow(changedId);
        return;
      }

      const price = parseNum(priceStr);
      if (price === null) return toast(CHK.t("price_required"));
      const changedId = await addItemAndReturn({ name, price, qty }, id);
      toast("Added & saved");
      reset();
      await CHK.check?.reload();
      flashItemRow(changedId);
    } catch (e) { toast("Add: " + e.message); }
  }

  async function addItemAndReturn(body, id) {
    const r = await api(`/api/checks/${id}/items/add`, { method: "POST", body: JSON.stringify(body) });
    return r.item_id || r.id || null;
  }

  /* ── utilities ── */
  function parseNum(s) {
    if (!s) return null;
    const t = s.replace(",", ".").replace(/[^\d.]/g, "");
    const n = Number(t);
    return t && isFinite(n) ? n : null;
  }

  function recalcAddTotal() {
    const p = parseNum($("itemPrice").value.trim());
    $("itemTotal").value = p !== null ? fmtMoney(p * qty) + " ₾" : "";
  }

  function fmtMoney(x) {
    const n = Number(x || 0);
    return isFinite(n) ? n.toFixed(2).replace(/\.00$/, "") : "0";
  }

  function esc(s) {
    return (s || "").toString().replace(/[&<>"']/g, (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  function flashItemRow(itemId) {
    if (!itemId) return;
    const el = document.querySelector(`[data-item-id="${itemId}"]`);
    if (!el) return;
    el.classList.remove("flashRow");
    void el.offsetWidth;
    el.classList.add("flashRow");
    setTimeout(() => { try { el.classList.remove("flashRow"); } catch (_) {} }, 950);
  }

  CHK.checkForm = { reset, loadQuickChips };
})();
