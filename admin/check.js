/* Check detail — open, render, close, delete, scan-edit, readonly patch */
window.CHK = window.CHK || {};

(function () {
  const CHK = window.CHK;
  const api = CHK.api;
  const $ = CHK.$;
  const toast = (msg) => CHK.toast?.(msg);

  let currentCheckId = null;
  let currentCheck = null;

  /* ── open / load / render ── */
  async function openCheck(id) {
    currentCheckId = id;
    CHK.setReadonly?.(false);
    await loadCheck();
    CHK.nav.go("screenCheck");
    CHK.checkForm?.reset?.();
    CHK.checkForm?.loadQuickChips?.().catch(() => {});
  }

  async function loadCheck() {
    const r = await api(`/api/checks/${currentCheckId}`, { method: "GET" });
    currentCheck = r.check || r;
    renderCheck();
  }

  function renderCheck() {
    const num = currentCheck.number ?? currentCheck.check_number ?? "";
    const guest = currentCheck.guest_name_snapshot ?? currentCheck.guest ?? currentCheck.guest_name ?? "—";
    $("checkTitle").textContent = `Check #${num}`;
    $("checkMeta").textContent = guest;
    $("checkTotal").textContent = `${fmtMoney(currentCheck.total ?? 0)} ₾`;

    const items = currentCheck.items || currentCheck.lines || [];
    const list = $("itemsList");
    list.innerHTML = "";
    $("itemsHint").textContent = items.length ? "" : CHK.t("empty_check");

    items.forEach(it => {
      const itemId = it.id;
      const name = it.name_snapshot ?? it.name ?? "—";
      const q = Number(it.qty ?? it.quantity ?? 1);
      const price = Number(it.price_snapshot ?? it.price ?? 0);
      const lt = Number(it.line_total ?? (price * q));
      const category = it.category || "";
      const isLowConf = CHK.scan?.lowConfidenceIds?.has(String(itemId));
      const el = document.createElement("div");
      el.className = "item";
      el.setAttribute("data-item-id", String(itemId));
      if (isLowConf) {
        el.style.cssText = "background:rgba(255,170,0,0.08);border-left:2px solid #f0a500;cursor:pointer";
        el.title = CHK.t("fix_item");
        el.addEventListener("click", (e) => {
          if (e.target.closest(".qtyCtl")) return;
          window._openScanEdit?.(itemId, name, price, q);
        });
      }
      el.innerHTML = `
        <div class="lineLeft">
          <div class="lineTitle"><b>${esc(name)}</b>${isLowConf ? ' <span style="color:#f0a500;font-size:11px">⚠ check</span>' : ""}</div>
          <div class="lineMeta">
            <span>${esc(String(q))}</span><span>×</span><span>${esc(fmtMoney(price))} ₾</span>
            ${category && category !== "Other" ? `<span class="muted" style="font-size:11px">${esc(category)}</span>` : ""}
          </div>
        </div>
        <div class="lineRight">
          <div class="lineTotal">${esc(fmtMoney(lt))} ₾</div>
          <div class="qtyCtl" title="${CHK.t('adj_qty')}">
            <button class="btn" data-act="dec">–</button>
            <strong style="min-width:16px;text-align:center;display:inline-block">${esc(String(q))}</strong>
            <button class="btn" data-act="inc">+</button>
          </div>
        </div>
      `;
      el.querySelector('[data-act="dec"]').onclick = async () => {
        try {
          if (q === 1) {
            if (!await CHK.confirm({ title: CHK.t("remove_item"), text: `Remove "${name}" from check?`, okText: CHK.t("remove"), cancelText: CHK.t("cancel"), danger: true })) return;
          }
          await api(`/api/checks/${currentCheckId}/items/${itemId}/qty?delta=-1`, { method: "POST" });
          await loadCheck();
          if (q === 1) toast(`Removed "${name}"`); else flashItemRow(itemId);
        } catch (e) { toast("Qty: " + e.message); }
      };
      el.querySelector('[data-act="inc"]').onclick = async () => {
        try {
          await api(`/api/checks/${currentCheckId}/items/${itemId}/qty?delta=1`, { method: "POST" });
          await loadCheck();
          flashItemRow(itemId);
        } catch (e) { toast("Qty: " + e.message); }
      };
      list.appendChild(el);
    });

    const spacer = document.createElement("div");
    spacer.style.height = "70px";
    list.appendChild(spacer);
  }

  /* ── back / close / delete ── */
  $("btnBackFromCheck").onclick = async () => {
    if (CHK._checkReadonly) {
      await CHK.gotoArchive?.();
    } else {
      currentCheckId = null; currentCheck = null;
      await CHK.open?.load().catch(() => {});
      CHK.nav.back();
    }
  };

  $("btnCloseCheck").onclick = async () => {
    if (!currentCheckId) return;
    const method = await CHK.paymentConfirm?.({
      checkId: currentCheckId,
      number: currentCheck?.number ?? "",
      guest: currentCheck?.guest_name_snapshot ?? "—",
      total: Number(currentCheck?.total ?? 0),
      items: currentCheck?.items || [],
    });
    if (method === null) return;
    try {
      await api(`/api/checks/${currentCheckId}/close`, { method: "POST", body: JSON.stringify({ payment_method: method }) });
      toast(CHK.t("check_closed"));
      currentCheckId = null; currentCheck = null;
      await CHK.open?.load().catch(() => {});
      CHK.nav.back();
    } catch (e) { toast("Close error: " + e.message); }
  };

  (function () {
    const btn = $("btnDeleteCheck");
    if (!btn) return;
    btn.onclick = async () => {
      const profile = CHK.getUserProfile?.() || {};
      if (!["manager", "superadmin"].includes(profile.role)) return;
      if (!currentCheckId) return;
      const ok = await CHK.confirm({
        title: CHK.t("delete_check"),
        text: `Check #${currentCheck?.number ?? ""} · ${currentCheck?.guest_name_snapshot ?? "—"} will be permanently deleted.`,
        okText: CHK.t("delete_"),
        danger: true,
      });
      if (!ok) return;
      try {
        const wasArchive = !!CHK._checkReadonly;
        await api(`/api/checks/${currentCheckId}`, { method: "DELETE" });
        toast(CHK.t("check_deleted"));
        currentCheckId = null; currentCheck = null;
        if (wasArchive) {
          await CHK.gotoArchive?.();
        } else {
          await CHK.open?.load().catch(() => {});
          CHK.nav.back();
        }
      } catch (e) { toast("Delete error: " + e.message); }
    };
  })();

  /* ── readonly patch ── */
  async function gotoArchive() {
    try { document.body.classList.remove("chk-readonly"); } catch (_) {}
    CHK._checkReadonly = false;
    CHK.nav.back();
    try {
      const fn = CHK.archive?.reload ?? CHK.archive?.load;
      if (typeof fn === "function") await fn();
    } catch (e) { toast("Archive: " + (e?.message || String(e))); }
  }

  function setReadonly(on) {
    CHK._checkReadonly = !!on;
    document.body?.classList.toggle("chk-readonly", !!on);
    $("btnCloseCheck")?.classList.toggle("hide", !!on);
    const btnBack = $("btnBackFromCheck");
    if (btnBack) { btnBack.classList.remove("hide"); btnBack.textContent = on ? "← Archive" : "← Checks"; }
    const btnDelete = $("btnDeleteCheck");
    if (btnDelete) {
      const profile = CHK.getUserProfile?.() || {};
      btnDelete.classList.toggle("hide", !["manager", "superadmin"].includes(profile.role));
    }
  }

  if (!CHK.__roClickBlocker) {
    document.addEventListener("click", (e) => {
      try {
        if (!document.body?.classList.contains("chk-readonly")) return;
        const t = e.target;
        if (t?.closest?.("#itemsList") && t.closest("button")) {
          e.preventDefault(); e.stopPropagation(); toast(CHK.t("read_only")); return;
        }
        if (t?.closest?.("#bottomBar")) {
          e.preventDefault(); e.stopPropagation(); toast(CHK.t("read_only"));
        }
      } catch (_) {}
    }, true);
    CHK.__roClickBlocker = true;
  }

  /* ── helpers ── */
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

  /* ── exports ── */
  CHK.openCheck = openCheck;
  CHK.setReadonly = setReadonly;
  CHK.gotoArchive = gotoArchive;
  CHK.flashItemRow = flashItemRow;
  CHK.check = {
    get id() { return currentCheckId; },
    get data() { return currentCheck; },
    reload: loadCheck,
  };

  // Wrap openCheck to support opts.readonly (used by archive)
  const _orig = CHK.openCheck;
  CHK.openCheck = async (id, opts) => {
    await _orig(id);
    setReadonly(!!(opts || {}).readonly);
  };
})();
