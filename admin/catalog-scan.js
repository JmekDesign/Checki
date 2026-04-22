/* Menu scanner — upload menu photos, preview extracted items, bulk-add to catalog */
window.CHK = window.CHK || {};

(function () {
  const CHK = window.CHK;
  const api = (...a) => CHK.api(...a);  // used for upsert calls
  const $ = (id) => document.getElementById(id);
  const esc = (s) =>
    (s || "").toString().replace(/[&<>"']/g, (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
    );

  /* ── open file picker ── */
  function openPicker() {
    const input = $("menuScanInput");
    if (!input) return;
    input.value = "";
    input.onchange = () => {
      const files = Array.from(input.files || []);
      if (files.length) startScan(files);
    };
    input.click();
  }

  /* ── scan: upload to backend ── */
  async function startScan(files) {
    const back = $("menuScanBack");
    if (!back) return;

    // loading state
    back.innerHTML = `
      <div class="modal" style="width:min(92vw,480px);text-align:center;padding:32px 20px">
        <div style="font-size:28px;margin-bottom:12px">📷</div>
        <div style="font-size:15px;font-weight:600;margin-bottom:6px">${CHK.t("scan_menu_scanning")}</div>
        <div class="muted" style="font-size:13px">${CHK.t("scan_menu_wait")}</div>
      </div>`;
    back.classList.remove("hide");

    const fd = new FormData();
    files.slice(0, 5).forEach((f) => fd.append("files", f));

    let data;
    try {
      const res = await CHK.apiFetch("/api/catalog/scan-menu", { method: "POST", body: fd });
      const text = await res.text();
      data = text ? JSON.parse(text) : {};
      if (!res.ok) {
        const msg = data?.detail || data?.error || (res.status + " " + res.statusText);
        throw new Error(msg);
      }
    } catch (err) {
      back.classList.add("hide");
      CHK.toast?.(CHK.t("scan_menu_failed") + ": " + (err.message || String(err)));
      return;
    }

    if (!data.ok || !Array.isArray(data.items) || !data.items.length) {
      back.classList.add("hide");
      CHK.toast?.(data.errors?.length ? data.errors[0] : CHK.t("scan_menu_nothing"));
      return;
    }

    showPreview(back, data);
  }

  /* ── preview modal ── */
  function showPreview(back, data) {
    const items = data.items;
    const errors = data.errors || [];

    const rowsHtml = items.map((it, i) => {
      const warn = it.confidence === "low"
        ? `<span title="${CHK.t('scan_menu_low_conf')}" style="color:#c77700;margin-left:4px">⚠</span>` : "";
      const dup = it.exists_in_catalog
        ? `<span class="muted" style="font-size:11px;margin-left:6px">${CHK.t("scan_menu_in_catalog")}</span>` : "";
      const catHint = it.category_hint
        ? `<span class="muted" style="font-size:11px">${esc(it.category_hint)}</span>` : "";
      const price = it.price != null
        ? `<span style="font-size:13px;white-space:nowrap">${Number(it.price).toFixed(2).replace(/\.00$/, "")} ₾</span>` : "";

      return `
        <label class="menuScanRow" style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--border,#eee);cursor:pointer">
          <input type="checkbox" data-i="${i}" ${it.exists_in_catalog ? "" : "checked"}
            style="width:18px;height:18px;flex-shrink:0;accent-color:var(--accent)" />
          <div style="flex:1;min-width:0">
            <div style="font-size:14px;font-weight:600">${esc(it.name)}${warn}${dup}</div>
            <div style="margin-top:2px">${catHint}</div>
          </div>
          ${price}
        </label>`;
    }).join("");

    const errorNote = errors.length
      ? `<div style="color:var(--danger,#c00);font-size:12px;margin-top:8px">${errors.map(esc).join(" · ")}</div>` : "";

    back.innerHTML = `
      <div class="modal" style="width:min(92vw,480px);max-height:85vh;display:flex;flex-direction:column">
        <div class="modalTitle" style="flex-shrink:0">
          ${CHK.t("scan_menu_title")} — ${items.length} ${CHK.t("scan_menu_items")}
          <span class="muted" style="font-size:12px;font-weight:400;margin-left:8px">${data.total_pages} ${CHK.t(data.total_pages > 1 ? "scan_menu_pages" : "scan_menu_page")}</span>
        </div>
        <div style="flex:1;overflow-y:auto;padding:0 2px">
          ${rowsHtml}
          ${errorNote}
        </div>
        <div class="modalBtns" style="flex-shrink:0;margin-top:12px">
          <button class="btn" id="msCancelBtn">${CHK.t("cancel")}</button>
          <button class="btn" id="msSelectAllBtn">${CHK.t("scan_menu_select_all")}</button>
          <button class="btn primary" id="msAddBtn">${CHK.t("scan_menu_add")}</button>
        </div>
      </div>`;
    back.classList.remove("hide");

    $("msCancelBtn").onclick = () => back.classList.add("hide");
    back.onclick = (e) => { if (e.target === back) back.classList.add("hide"); };

    $("msSelectAllBtn").onclick = () => {
      const boxes = back.querySelectorAll("input[type=checkbox]");
      const allChecked = Array.from(boxes).every((b) => b.checked);
      boxes.forEach((b) => { b.checked = !allChecked; });
      $("msSelectAllBtn").textContent = allChecked ? CHK.t("scan_menu_select_all") : CHK.t("scan_menu_deselect_all");
    };

    $("msAddBtn").onclick = () => addSelected(back, items);
  }

  /* ── bulk add selected items ── */
  async function addSelected(back, items) {
    const boxes = back.querySelectorAll("input[type=checkbox]");
    const selected = Array.from(boxes)
      .map((b, i) => b.checked ? items[i] : null)
      .filter(Boolean);

    if (!selected.length) {
      CHK.toast?.(CHK.t("nothing_found"));
      return;
    }

    const addBtn = $("msAddBtn");
    if (addBtn) { addBtn.disabled = true; addBtn.textContent = CHK.t("scan_menu_adding"); }

    let added = 0;
    let failed = 0;
    for (const it of selected) {
      try {
        await api("/api/products/upsert", {
          method: "POST",
          body: JSON.stringify({
            name: it.name,
            price: it.price ?? undefined,
            category: it.category_hint || undefined,
          }),
        });
        added++;
      } catch (_) {
        failed++;
      }
    }

    back.classList.add("hide");

    const msg = failed
      ? `Added ${added}, failed ${failed}`
      : `Added ${added} item${added !== 1 ? "s" : ""} to catalog`;
    CHK.toast?.(msg);

    // reload catalog + kick normalization
    CHK.catalog?.load?.().catch(() => {});
  }

  /* ── init ── */
  function init() {
    const btn = $("btnScanMenu");
    if (btn) btn.onclick = () => openPicker();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
