(function () {
  const CHK   = window.CHK;
  const $     = (id) => document.getElementById(id);
  const api   = () => CHK.api;
  const show  = (screen) => CHK.show(screen, CHK.getToken?.() || "");
  const toast = (msg) => CHK.toast?.(msg);

  let _currentOrderId   = null;
  let _currentOrderTitle = "";
  let _currentOrderClosed = false;

  // ── Tab bar wiring ──────────────────────────────────────────────────────────
  $("tabSupplies").onclick = () => {
    show("screenSupplies");
    loadSupplies();
  };

  $("btnNewSupply").onclick = () => {
    $("supplyTitle").value = "";
    show("screenNewSupply");
    $("supplyTitle").focus();
  };

  // ── screenNewSupply ─────────────────────────────────────────────────────────
  $("btnBackFromNewSupply").onclick = () => {
    show("screenSupplies");
    loadSupplies();
  };

  $("btnCreateSupply").onclick = async () => {
    const title = $("supplyTitle").value.trim();
    if (!title) { $("supplyTitle").focus(); return; }
    $("btnCreateSupply").disabled = true;
    try {
      await api()("/api/procurement", { method: "POST", body: JSON.stringify({ title }) });
      toast("Order created");
      show("screenSupplies");
      loadSupplies();
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
      renderSuppliesList(activeR.items || [], archiveR.items || []);
    } catch (e) {
      toast("Load error: " + e.message);
    }
  }

  function renderSuppliesList(active, archive) {
    const list = $("suppliesList");
    const hint = $("suppliesHint");

    if (!active.length && !archive.length) {
      list.innerHTML = "";
      hint.textContent = "No supply orders yet.";
      return;
    }
    hint.textContent = "";

    let html = "";

    if (active.length) {
      html += `<div class="muted" style="font-size:12px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;padding:4px 0 8px">Active</div>`;
      active.forEach((o) => {
        const checked = o.items.filter((i) => i.is_checked).length;
        const total   = o.items.length;
        const progress = total ? `${checked}/${total}` : "empty";
        html += orderRowHtml(o, false, progress);
      });
    }

    if (archive.length) {
      html += `<div class="muted" style="font-size:12px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;padding:12px 0 8px">Archive</div>`;
      archive.forEach((o) => {
        const done = o.items.filter((i) => i.is_checked).length;
        const total = o.items.length;
        const progress = total ? `${done}/${total} done` : "";
        html += orderRowHtml(o, true, progress);
      });
    }

    list.innerHTML = html;

    list.querySelectorAll("[data-open-order]").forEach((el) => {
      el.addEventListener("click", () => {
        const id     = el.dataset.openOrder;
        const title  = el.dataset.orderTitle;
        const closed = el.dataset.orderClosed === "true";
        openOrder(id, title, closed);
      });
    });
  }

  function orderRowHtml(o, isClosed, progress) {
    const date = o.closed_at || o.created_at;
    const dateStr = date
      ? new Date(date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "2-digit" })
      : "";
    const badge = isClosed
      ? `<span class="muted" style="font-size:12px">${dateStr}</span>`
      : `<span style="font-size:12px;color:var(--muted)">${progress}</span>`;
    return `
      <div class="item" style="cursor:pointer"
           data-open-order="${esc(o.id)}"
           data-order-title="${esc(o.title)}"
           data-order-closed="${isClosed}">
        <div class="lineLeft" style="flex:1;min-width:0">
          <div class="lineTitle"><b>${esc(o.title)}</b></div>
          <div class="lineMeta">${badge}</div>
        </div>
        <span class="muted">→</span>
      </div>`;
  }

  // ── screenSupplyDetail ──────────────────────────────────────────────────────
  function openOrder(id, title, isClosed) {
    _currentOrderId     = id;
    _currentOrderTitle  = title;
    _currentOrderClosed = isClosed;

    $("supplyDetailTitle").textContent = title;
    $("btnCloseSupply").style.display  = isClosed ? "none" : "";
    // Add-item row: hide for closed orders
    const addRow = $("supplyDetailAddRow");
    if (addRow) addRow.style.display = isClosed ? "none" : "";

    show("screenSupplyDetail");
    loadOrderDetail(id);
  }

  async function loadOrderDetail(id) {
    try {
      // Fetch the right list depending on status
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
      const crossed = item.is_checked
        ? "text-decoration:line-through;color:var(--muted)"
        : "";
      const delBtn = _currentOrderClosed ? "" :
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

    // Checkbox toggles
    list.querySelectorAll("[data-chk]").forEach((el) => {
      el.onchange = async () => {
        const itemId = el.dataset.chk;
        try {
          const r = await api()(`/api/procurement/${_currentOrderId}/items/${itemId}`, { method: "PATCH" });
          const row = list.querySelector(`[data-item-row="${itemId}"] span:nth-child(2)`);
          if (row) {
            row.style.textDecoration = r.is_checked ? "line-through" : "";
            row.style.color = r.is_checked ? "var(--muted)" : "";
          }
        } catch (e) {
          toast("Error: " + e.message);
          el.checked = !el.checked;
        }
      };
    });

    // Delete item buttons
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

  // Back button
  $("btnBackFromSupplyDetail").onclick = () => {
    show("screenSupplies");
    loadSupplies();
  };

  // Close order
  $("btnCloseSupply").onclick = async () => {
    if (!_currentOrderId) return;
    if (!confirm(`Close order "${_currentOrderTitle}"? It will move to archive.`)) return;
    try {
      await api()(`/api/procurement/${_currentOrderId}/close`, { method: "POST" });
      toast("Order closed");
      show("screenSupplies");
      loadSupplies();
    } catch (e) {
      toast("Error: " + e.message);
    }
  };

  // Add item
  $("btnAddSupplyItem").onclick = addItem;
  $("supplyItemText").addEventListener("keydown", (e) => {
    if (e.key === "Enter") addItem();
  });

  async function addItem() {
    const text = $("supplyItemText").value.trim();
    const qty  = $("supplyItemQty").value.trim() || "1";
    if (!text) { $("supplyItemText").focus(); return; }
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

  // ── venue.js hook ───────────────────────────────────────────────────────────
  document.addEventListener("DOMContentLoaded", () => {
    const btnGoSupplies = $("btnGoSupplies");
    if (btnGoSupplies) {
      btnGoSupplies.onclick = () => {
        show("screenSupplies");
        loadSupplies();
      };
    }
  });

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
