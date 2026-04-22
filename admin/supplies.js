(function () {
  const CHK   = window.CHK;
  const $     = (id) => document.getElementById(id);
  const api   = () => CHK.api;
  const toast = (msg) => CHK.toast?.(msg);

  let _currentOrderId     = null;
  let _currentOrderTitle  = "";
  let _currentOrderClosed = false;
  let _allOrders          = { active: [], archive: [] };

  // ── screenSupplies nav ──────────────────────────────────────────────────────
  $("btnBackFromSupplies").onclick = () => CHK.nav.back();

  $("btnNewSupply").onclick = () => {
    $("supplyTitle").value = "";
    CHK.nav.go("screenNewSupply");
    $("supplyTitle").focus();
  };

  $("suppliesSearch").addEventListener("input", () => {
    renderSuppliesList(_allOrders.active, _allOrders.archive);
  });

  // ── screenNewSupply ─────────────────────────────────────────────────────────
  $("btnBackFromNewSupply").onclick = () => {
    CHK.nav.back();
    loadSupplies();
  };

  $("btnCreateSupply").onclick = async () => {
    const title = $("supplyTitle").value.trim();
    if (!title) { $("supplyTitle").focus(); return; }
    $("btnCreateSupply").disabled = true;
    try {
      const r = await api()("/api/procurement", { method: "POST", body: JSON.stringify({ title }) });
      // Go directly into the new order
      openOrder(r.id, title, false);
    } catch (e) {
      toast("Error: " + e.message);
    } finally {
      $("btnCreateSupply").disabled = false;
    }
  };

  $("supplyTitle").addEventListener("keydown", (e) => {
    if (e.key === "Enter") $("btnCreateSupply").click();
  });

  // ── screenSupplies (list) ───────────────────────────────────────────────────
  async function loadSupplies() {
    try {
      const [activeR, archiveR] = await Promise.all([
        api()("/api/procurement", { method: "GET" }),
        api()("/api/procurement/archive", { method: "GET" }),
      ]);
      _allOrders = { active: activeR.items || [], archive: archiveR.items || [] };
      $("suppliesSearch").value = "";
      renderSuppliesList(_allOrders.active, _allOrders.archive);
    } catch (e) {
      toast("Load error: " + e.message);
    }
  }

  function renderSuppliesList(active, archive) {
    const list = $("suppliesList");
    const hint = $("suppliesHint");
    const q    = ($("suppliesSearch").value || "").trim().toLowerCase();

    const filterFn = (o) => !q || o.title.toLowerCase().includes(q);
    const filteredActive  = active.filter(filterFn);
    const filteredArchive = archive.filter(filterFn);

    if (!filteredActive.length && !filteredArchive.length) {
      list.innerHTML = "";
      hint.textContent = q ? CHK.t("nothing_found") : CHK.t("no_orders");
      return;
    }
    hint.textContent = "";

    let html = "";

    if (filteredActive.length) {
      html += sectionHeader("Active");
      filteredActive.forEach((o) => {
        const checked  = o.items.filter((i) => i.is_checked).length;
        const total    = o.items.length;
        const progress = total ? `${checked}/${total}` : "empty";
        html += orderRowHtml(o, false, progress);
      });
    }

    if (filteredArchive.length) {
      html += sectionHeader("Archive");
      filteredArchive.forEach((o) => {
        const done  = o.items.filter((i) => i.is_checked).length;
        const total = o.items.length;
        html += orderRowHtml(o, true, total ? `${done}/${total} done` : "");
      });
    }

    list.innerHTML = html;

    list.querySelectorAll("[data-open-order]").forEach((el) => {
      el.addEventListener("click", () => {
        openOrder(el.dataset.openOrder, el.dataset.orderTitle, el.dataset.orderClosed === "true");
      });
    });
  }

  function sectionHeader(label) {
    return `<div class="muted" style="font-size:12px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;padding:4px 0 8px">${label}</div>`;
  }

  function orderRowHtml(o, isClosed, progress) {
    const date    = o.closed_at || o.created_at;
    const dateStr = date ? fmtDate(date) : "";
    const meta    = isClosed
      ? `<span class="muted" style="font-size:12px">${dateStr}</span>`
      : `<span class="muted" style="font-size:12px">${progress}${dateStr ? " · " + dateStr : ""}</span>`;
    return `
      <div class="item" style="cursor:pointer${isClosed ? ";opacity:0.4" : ""}"
           data-open-order="${esc(o.id)}"
           data-order-title="${esc(o.title)}"
           data-order-closed="${isClosed}">
        <div class="lineLeft" style="flex:1;min-width:0">
          <div class="lineTitle"><b>${esc(o.title)}</b></div>
          <div class="lineMeta">${meta}</div>
        </div>
        <span class="muted">→</span>
      </div>`;
  }

  // ── screenSupplyDetail ──────────────────────────────────────────────────────
  function openOrder(id, title, isClosed) {
    _currentOrderId     = id;
    _currentOrderTitle  = title;
    _currentOrderClosed = isClosed;

    $("supplyDetailTitle").textContent    = title;
    $("btnCloseSupply").style.display     = isClosed ? "none" : "";
    $("supplyDetailAddRow").style.display = isClosed ? "none" : "";
    $("supplyItemText").value = "";
    $("supplyItemQty").value  = "";
    hideSuggest();

    CHK.nav.go("screenSupplyDetail");
    loadOrderDetail(id);
  }

  async function loadOrderDetail(id) {
    try {
      const endpoint = _currentOrderClosed ? "/api/procurement/archive" : "/api/procurement";
      const r = await api()(endpoint, { method: "GET" });
      const order = (r.items || []).find((o) => o.id === id);
      if (!order) { toast("Order not found"); return; }
      $("supplyDetailMeta").textContent = order.closed_at
        ? `Closed ${fmtDate(order.closed_at)}`
        : `Created ${fmtDate(order.created_at)}`;
      renderDetailItems(order.items || []);
    } catch (e) {
      toast("Load error: " + e.message);
    }
  }

  function renderDetailItems(items) {
    const list = $("supplyItemsList");
    const hint = $("supplyItemsHint");

    if (!items.length) {
      list.innerHTML = "";
      hint.style.display = "";
      return;
    }
    hint.style.display = "none";

    list.innerHTML = items.map((item) => {
      const crossed  = item.is_checked ? "text-decoration:line-through;color:var(--muted)" : "";
      const delBtn   = _currentOrderClosed ? "" :
        `<button class="btn compact" style="padding:2px 8px;font-size:12px;color:var(--muted)" data-del-item="${esc(item.id)}">✕</button>`;
      const checkbox = _currentOrderClosed
        ? `<span style="width:20px;text-align:center;color:var(--${item.is_checked ? "accent" : "muted"})">${item.is_checked ? "✓" : "·"}</span>`
        : `<input type="checkbox" ${item.is_checked ? "checked" : ""} style="width:18px;height:18px;accent-color:var(--accent);cursor:pointer;flex-shrink:0" data-chk="${esc(item.id)}" />`;
      return `
        <div class="item" style="gap:10px" data-item-row="${esc(item.id)}">
          ${checkbox}
          <span style="flex:1;${crossed}">${esc(item.text)}</span>
          <span class="muted" style="font-size:12px">${esc(item.qty)}</span>
          ${delBtn}
        </div>`;
    }).join("");

    list.querySelectorAll("[data-chk]").forEach((el) => {
      el.onchange = async () => {
        const itemId = el.dataset.chk;
        try {
          const r = await api()(`/api/procurement/${_currentOrderId}/items/${itemId}`, { method: "PATCH" });
          const textSpan = list.querySelector(`[data-item-row="${itemId}"] span:nth-child(2)`);
          if (textSpan) {
            textSpan.style.textDecoration = r.is_checked ? "line-through" : "";
            textSpan.style.color          = r.is_checked ? "var(--muted)" : "";
          }
        } catch (e) {
          toast("Error: " + e.message);
          el.checked = !el.checked;
        }
      };
    });

    list.querySelectorAll("[data-del-item]").forEach((el) => {
      el.onclick = async () => {
        const itemId = el.dataset.delItem;
        try {
          await api()(`/api/procurement/${_currentOrderId}/items/${itemId}`, { method: "DELETE" });
          list.querySelector(`[data-item-row="${itemId}"]`)?.remove();
          if (!list.children.length) hint.style.display = "";
        } catch (e) {
          toast("Error: " + e.message);
        }
      };
    });
  }

  $("btnBackFromSupplyDetail").onclick = () => {
    hideSuggest();
    CHK.nav.back();
    loadSupplies();
  };

  $("btnCloseSupply").onclick = async () => {
    if (!_currentOrderId) return;
    const unchecked = [...document.querySelectorAll("#supplyItemsList [data-chk]")].filter((el) => !el.checked);
    if (unchecked.length > 0) {
      toast(`${unchecked.length} item${unchecked.length > 1 ? "s" : ""} not checked yet`);
      return;
    }
    const ok = await CHK.confirm({
      title: CHK.t("close_order_q"),
      text: `"${_currentOrderTitle}" will move to archive.`,
      okText: "Close",
      danger: true,
    });
    if (!ok) return;
    try {
      await api()(`/api/procurement/${_currentOrderId}/close`, { method: "POST" });
      toast(CHK.t("order_closed"));
      CHK.nav.back();
      loadSupplies();
    } catch (e) {
      toast("Error: " + e.message);
    }
  };

  // ── Add item + catalog suggestions ─────────────────────────────────────────
  $("btnAddSupplyItem").onclick = addItem;
  $("supplyItemText").addEventListener("keydown", (e) => {
    if (e.key === "Enter")  { addItem(); }
    if (e.key === "Escape") { hideSuggest(); }
  });

  let _suggestTimer = null;
  $("supplyItemText").addEventListener("input", () => {
    clearTimeout(_suggestTimer);
    const q = $("supplyItemText").value.trim();
    if (!q) { hideSuggest(); return; }
    _suggestTimer = setTimeout(() => loadSuggest(q), 200);
  });

  async function loadSuggest(q) {
    try {
      const r = await api()(`/api/products?q=${encodeURIComponent(q)}&limit=8&active_only=true`, { method: "GET" });
      const items = (r.items || []);
      if (!items.length) { hideSuggest(); return; }

      // Exact match → just fill silently, no dropdown
      const exact = items.find((p) => (p.name || "").toLowerCase() === q.toLowerCase());
      if (exact) { hideSuggest(); return; }

      showSuggest(items);
    } catch (_) {
      hideSuggest();
    }
  }

  function showSuggest(items) {
    const box = $("supplySuggestBox");
    box.innerHTML = items.map((p) =>
      `<div class="suggestItem" data-suggest-name="${esc(p.name)}" style="cursor:pointer">
        <b>${esc(p.name)}</b>
        <span class="muted" style="font-size:12px">${esc(p.category || "")}</span>
      </div>`
    ).join("");
    box.style.display = "block";

    box.querySelectorAll("[data-suggest-name]").forEach((el) => {
      el.onmousedown = (e) => {
        e.preventDefault(); // don't blur the input
        $("supplyItemText").value = el.dataset.suggestName;
        hideSuggest();
        $("supplyItemQty").focus();
      };
    });
  }

  function hideSuggest() {
    const box = $("supplySuggestBox");
    box.style.display = "none";
    box.innerHTML = "";
  }

  $("supplyItemText").addEventListener("blur", () => {
    setTimeout(hideSuggest, 150);
  });

  async function addItem() {
    const text = $("supplyItemText").value.trim();
    const qty  = $("supplyItemQty").value.trim() || "1";
    if (!text) { $("supplyItemText").focus(); return; }
    hideSuggest();
    $("btnAddSupplyItem").disabled = true;
    try {
      await api()(`/api/procurement/${_currentOrderId}/items`, {
        method: "POST",
        body: JSON.stringify({ text, qty }),
      });
      $("supplyItemText").value = "";
      $("supplyItemQty").value  = "";
      $("supplyItemText").focus();
      await loadOrderDetail(_currentOrderId);
    } catch (e) {
      toast("Error: " + e.message);
    } finally {
      $("btnAddSupplyItem").disabled = false;
    }
  }

  // ── Helpers ─────────────────────────────────────────────────────────────────
  function esc(s) {
    return (s || "").toString().replace(/[&<>"']/g, (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
    );
  }

  function fmtDate(iso) {
    if (!iso) return "";
    return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "2-digit" });
  }

  CHK.supplies = { load: loadSupplies };
})();
