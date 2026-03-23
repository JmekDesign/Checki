(function () {
  const api = () => window.CHK && window.CHK.api ? window.CHK.api : null;
  const show = (id) => window.CHK && window.CHK.show ? window.CHK.show(id) : null;
  const toast = (msg) => window.CHK && window.CHK.toast ? window.CHK.toast(msg) : alert(msg);
  const $ = (id) => document.getElementById(id);

  let _tab = "active"; // "active" | "archive"

  // ── Navigation ──────────────────────────────────────────────────────────────
  function open() {
    show("screenProcurement");
    setTab("active");
    loadActive();
  }

  function setTab(tab) {
    _tab = tab;
    const isActive = tab === "active";
    $("tabProcActive").classList.toggle("primary", isActive);
    $("tabProcArchive").classList.toggle("primary", !isActive);
    $("procActiveList").style.display   = isActive ? "" : "none";
    $("procActiveHint").style.display   = "none";
    $("procArchiveList").style.display  = isActive ? "none" : "";
    $("procArchiveHint").style.display  = "none";
  }

  $("btnBackFromProcurement").onclick = () => {
    show("screenVenue");
    if (window.CHK && window.CHK.venue) window.CHK.venue.load().catch(() => {});
  };
  $("tabProcActive").onclick  = () => { setTab("active");  loadActive(); };
  $("tabProcArchive").onclick = () => { setTab("archive"); loadArchive(); };

  // ── New order ────────────────────────────────────────────────────────────────
  $("btnNewOrder").onclick = () => {
    const title = prompt("Order name (e.g. «Bar restock 24 Mar»):");
    if (!title || !title.trim()) return;
    const a = api(); if (!a) return;
    a("/api/procurement", { method: "POST", body: JSON.stringify({ title: title.trim() }) })
      .then(() => loadActive())
      .catch((e) => toast("Error: " + e.message));
  };

  // ── Load active ──────────────────────────────────────────────────────────────
  function loadActive() {
    const a = api(); if (!a) return;
    a("/api/procurement", { method: "GET" })
      .then((r) => renderActive(r.items || []))
      .catch((e) => toast("Load error: " + e.message));
  }

  function renderActive(orders) {
    const list = $("procActiveList");
    const hint = $("procActiveHint");
    if (!orders.length) {
      list.innerHTML = "";
      hint.style.display = "";
      return;
    }
    hint.style.display = "none";
    list.innerHTML = orders.map((o) => orderHtml(o, false)).join("");
    attachOrderEvents(orders, false);
  }

  // ── Load archive ─────────────────────────────────────────────────────────────
  function loadArchive() {
    const a = api(); if (!a) return;
    a("/api/procurement/archive", { method: "GET" })
      .then((r) => renderArchive(r.items || []))
      .catch((e) => toast("Load error: " + e.message));
  }

  function renderArchive(orders) {
    const list = $("procArchiveList");
    const hint = $("procArchiveHint");
    if (!orders.length) {
      list.innerHTML = "";
      hint.style.display = "";
      return;
    }
    hint.style.display = "none";
    list.innerHTML = orders.map((o) => orderHtml(o, true)).join("");
    attachOrderEvents(orders, true);
  }

  // ── HTML builders ────────────────────────────────────────────────────────────
  function esc(s) {
    return (s || "").toString().replace(/[&<>"']/g, (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
    );
  }

  function fmtDate(iso) {
    if (!iso) return "";
    return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "2-digit" });
  }

  function orderHtml(o, readonly) {
    const checkedCount = o.items.filter((i) => i.is_checked).length;
    const total = o.items.length;
    const progress = total ? ` <span style="font-size:11px;color:var(--muted)">${checkedCount}/${total}</span>` : "";
    const dateStr = readonly
      ? `<span style="font-size:11px;color:var(--muted)">${fmtDate(o.closed_at)}</span>`
      : `<span style="font-size:11px;color:var(--muted)">${fmtDate(o.created_at)}</span>`;

    const itemsHtml = o.items.map((item) => itemRowHtml(item, o.id, readonly)).join("");

    const addRow = readonly ? "" : `
      <div class="row" style="gap:6px;margin-top:8px" data-add-row="${esc(o.id)}">
        <input class="inp" placeholder="Item…" style="flex:1" data-item-text="${esc(o.id)}" />
        <input class="inp" placeholder="Qty" style="width:56px" data-item-qty="${esc(o.id)}" />
        <button class="btn compact primary" data-add-btn="${esc(o.id)}">Add</button>
      </div>`;

    const closeBtn = readonly ? "" : `
      <button class="btn compact danger" style="margin-top:10px;width:100%" data-close-btn="${esc(o.id)}" data-close-name="${esc(o.title)}">
        Close order
      </button>`;

    const deleteBtn = readonly ? "" : `
      <button class="btn compact" style="margin-top:6px;width:100%;color:var(--muted)" data-delete-btn="${esc(o.id)}" data-delete-name="${esc(o.title)}">
        Delete
      </button>`;

    return `
      <div class="item" style="flex-direction:column;align-items:stretch;margin-bottom:10px;gap:0" data-order-id="${esc(o.id)}">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
          <span style="font-weight:700">${esc(o.title)}${progress}</span>
          ${dateStr}
        </div>
        <div data-items-list="${esc(o.id)}">${itemsHtml}</div>
        ${addRow}
        ${closeBtn}
        ${deleteBtn}
      </div>`;
  }

  function itemRowHtml(item, orderId, readonly) {
    const chk = item.is_checked
      ? "color:var(--accent);text-decoration:line-through;color:var(--muted)"
      : "";
    const delBtn = readonly ? "" :
      `<button class="btn compact" style="padding:2px 7px;font-size:12px;color:var(--muted)" data-del-item="${esc(item.id)}" data-del-order="${esc(orderId)}">✕</button>`;
    return `
      <div style="display:flex;align-items:center;gap:8px;padding:5px 0;border-bottom:1px solid rgba(255,255,255,.05)" data-item-row="${esc(item.id)}">
        ${readonly ? `<span style="width:18px;text-align:center">${item.is_checked ? "✓" : "·"}</span>` :
          `<input type="checkbox" ${item.is_checked ? "checked" : ""} style="width:16px;height:16px;accent-color:var(--accent);cursor:pointer" data-chk-item="${esc(item.id)}" data-chk-order="${esc(orderId)}" />`}
        <span style="flex:1;${chk}">${esc(item.text)}</span>
        <span style="font-size:12px;color:var(--muted);min-width:30px;text-align:right">${esc(item.qty)}</span>
        ${delBtn}
      </div>`;
  }

  // ── Events ───────────────────────────────────────────────────────────────────
  function attachOrderEvents(orders, readonly) {
    if (readonly) return;
    const a = api(); if (!a) return;

    // Checkboxes
    document.querySelectorAll("[data-chk-item]").forEach((el) => {
      el.onchange = () => {
        const itemId  = el.dataset.chkItem;
        const orderId = el.dataset.chkOrder;
        a(`/api/procurement/${orderId}/items/${itemId}`, { method: "PATCH" })
          .then((r) => {
            const row = document.querySelector(`[data-item-row="${itemId}"] span:nth-child(2)`);
            if (row) {
              row.style.textDecoration = r.is_checked ? "line-through" : "";
              row.style.color = r.is_checked ? "var(--muted)" : "";
            }
            updateProgress(orderId);
          })
          .catch((e) => { toast("Error: " + e.message); el.checked = !el.checked; });
      };
    });

    // Delete item
    document.querySelectorAll("[data-del-item]").forEach((el) => {
      el.onclick = () => {
        const itemId  = el.dataset.delItem;
        const orderId = el.dataset.delOrder;
        a(`/api/procurement/${orderId}/items/${itemId}`, { method: "DELETE" })
          .then(() => {
            const row = document.querySelector(`[data-item-row="${itemId}"]`);
            if (row) row.remove();
            updateProgress(orderId);
          })
          .catch((e) => toast("Error: " + e.message));
      };
    });

    // Add item
    document.querySelectorAll("[data-add-btn]").forEach((el) => {
      el.onclick = () => {
        const orderId = el.dataset.addBtn;
        const textEl  = document.querySelector(`[data-item-text="${orderId}"]`);
        const qtyEl   = document.querySelector(`[data-item-qty="${orderId}"]`);
        const text = textEl ? textEl.value.trim() : "";
        const qty  = qtyEl  ? qtyEl.value.trim() || "1" : "1";
        if (!text) { if (textEl) textEl.focus(); return; }
        a(`/api/procurement/${orderId}/items`, {
          method: "POST",
          body: JSON.stringify({ text, qty }),
        }).then(() => loadActive())
          .catch((e) => toast("Error: " + e.message));
      };
    });

    // Enter key in item text input
    document.querySelectorAll("[data-item-text]").forEach((el) => {
      el.onkeydown = (e) => {
        if (e.key === "Enter") {
          const btn = document.querySelector(`[data-add-btn="${el.dataset.itemText}"]`);
          if (btn) btn.click();
        }
      };
    });

    // Close order
    document.querySelectorAll("[data-close-btn]").forEach((el) => {
      el.onclick = () => {
        const orderId = el.dataset.closeBtn;
        const name    = el.dataset.closeName;
        if (!confirm(`Close order "${name}"? It will move to archive.`)) return;
        a(`/api/procurement/${orderId}/close`, { method: "POST" })
          .then(() => loadActive())
          .catch((e) => toast("Error: " + e.message));
      };
    });

    // Delete order
    document.querySelectorAll("[data-delete-btn]").forEach((el) => {
      el.onclick = () => {
        const orderId = el.dataset.deleteBtn;
        const name    = el.dataset.deleteName;
        if (!confirm(`Delete order "${name}"?`)) return;
        a(`/api/procurement/${orderId}`, { method: "DELETE" })
          .then(() => loadActive())
          .catch((e) => toast("Error: " + e.message));
      };
    });
  }

  function updateProgress(orderId) {
    const orderEl = document.querySelector(`[data-order-id="${orderId}"]`);
    if (!orderEl) return;
    const checkboxes = orderEl.querySelectorAll("[data-chk-item]");
    const checked    = orderEl.querySelectorAll("[data-chk-item]:checked");
    const span = orderEl.querySelector("[data-order-id] > div span[style*='muted']");
    if (span) span.textContent = `${checked.length}/${checkboxes.length}`;
  }

  // ── Expose ───────────────────────────────────────────────────────────────────
  window.CHK = window.CHK || {};
  window.CHK.procurement = { open };

})();
