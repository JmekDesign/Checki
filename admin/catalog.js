/* Product catalog — manager screen */
window.CHK = window.CHK || {};

(function () {
  const CHK = window.CHK;
  const api = (...a) => CHK.api(...a);
  const $ = (id) => document.getElementById(id);
  const esc = (s) =>
    (s || "").toString().replace(/[&<>"']/g, (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
    );
  const money = (x) => {
    const n = Number(x || 0);
    return isFinite(n) ? n.toFixed(2).replace(/\.00$/, "") : "0";
  };

  let products = [];

  /* ── load all products (including inactive) ── */
  async function load() {
    const r = await api("/api/products?active_only=false&limit=500", { method: "GET" });
    products = Array.isArray(r.items) ? r.items : [];
    render();
    // silently kick off background normalization; reload after delay to show updated names
    api("/api/products/normalize-all", { method: "POST" })
      .then((r) => { if (r && r.queued > 0) setTimeout(() => load(), 9000); })
      .catch(() => {});
  }

  /* ── render grouped by category ── */
  function render() {
    const list = $("catalogList");
    const hint = $("catalogHint");
    if (!list) return;
    list.innerHTML = "";

    const q = ($("catalogSearch")?.value || "").trim().toLowerCase();
    const filtered = q
      ? products.filter((p) => (p.name || "").toLowerCase().includes(q))
      : products;

    if (!filtered.length) {
      if (hint) hint.textContent = q ? "Nothing found." : "No products yet.";
      return;
    }
    if (hint) hint.textContent = "";

    const groups = {};
    filtered.forEach((p) => {
      const cat = p.category || "Other";
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(p);
    });

    Object.keys(groups).sort().forEach((cat) => {
      const labelEl = document.createElement("div");
      labelEl.className = "archDayLabel";
      labelEl.textContent = cat;
      list.appendChild(labelEl);

      groups[cat].forEach((p) => {
        const el = document.createElement("div");
        el.className = "item";
        el.style.cssText = `cursor:pointer; opacity:${p.active ? "1" : "0.4"}`;
        el.innerHTML = `
          <div class="lineLeft" style="flex:1;min-width:0">
            <div class="lineTitle"><b>${esc(p.name)}</b></div>
          </div>
          <div style="display:flex;align-items:center;gap:12px">
            <span class="lineTotal" style="font-size:15px">${p.last_price != null ? money(p.last_price) + " ₾" : "—"}</span>
            <div class="vActiveDot ${p.active ? "vDotOn" : "vDotOff"}"></div>
            <span class="muted" style="font-size:18px">›</span>
          </div>
        `;
        el.onclick = () => openEditModal(p);
        list.appendChild(el);
      });
    });
  }

  /* ── modals ── */
  function openAddModal() {
    showModal({ title: "Add product", okText: "Add", p: null });
  }

  function openEditModal(p) {
    showModal({ title: "Edit product", okText: "Save", p });
  }

  function showModal({ title, okText, p }) {
    const back = $("catalogModalBack");
    if (!back) return;
    const isEdit = !!p;
    back.innerHTML = `
      <div class="modal" style="width:min(92vw,420px)">
        <div class="modalTitle">${esc(title)}</div>
        <div style="display:flex;flex-direction:column;gap:10px;margin-bottom:14px">
          <input class="inp" id="cmName" placeholder="Name" value="${esc(p ? p.name : "")}" />
          <input class="inp" id="cmCategory" placeholder="Category (optional: Beer, Cocktails…)" value="${esc(p ? (p.category === "Other" ? "" : p.category || "") : "")}" />
          <input class="inp" id="cmPrice" inputmode="decimal" placeholder="Price (₾)"
            value="${p && p.last_price != null ? money(p.last_price) : ""}" />
          ${isEdit ? `
            <label style="display:flex;align-items:center;gap:10px;font-size:14px;cursor:pointer;padding:4px 0">
              <input type="checkbox" id="cmActive" ${p.active ? "checked" : ""}
                style="width:18px;height:18px;accent-color:var(--accent)" />
              Active (appears in search)
            </label>
          ` : ""}
        </div>
        <div class="modalBtns">
          <button class="btn" id="cmCancel">Cancel</button>
          ${isEdit ? `<button class="btn danger" id="cmDelete">Delete</button>` : ""}
          <button class="btn primary" id="cmOk">${esc(okText)}</button>
        </div>
      </div>
    `;
    back.classList.remove("hide");
    $("cmCancel").onclick = () => back.classList.add("hide");
    back.onclick = (e) => { if (e.target === back) back.classList.add("hide"); };
    $("cmName").focus();

    if (isEdit) {
      $("cmDelete").onclick = () => {
        // replace modal content with inline confirm — no nested modals
        back.innerHTML = `
          <div class="modal" style="width:min(92vw,420px)">
            <div class="modalTitle" style="color:var(--danger)">Delete product?</div>
            <div style="margin-bottom:18px;font-size:15px">${esc(p.name)}</div>
            <div class="modalBtns">
              <button class="btn" id="cmDelCancel">Cancel</button>
              <button class="btn danger" id="cmDelConfirm">Yes, delete</button>
            </div>
          </div>
        `;
        $("cmDelCancel").onclick = () => openEditModal(p);
        $("cmDelConfirm").onclick = async () => {
          try {
            await api(`/api/products/${p.id}`, { method: "DELETE" });
            back.classList.add("hide");
            await load();
          } catch (e) {
            CHK.toast?.("Error: " + (e.message || String(e)));
            openEditModal(p);
          }
        };
      };
    }

    $("cmOk").onclick = async () => {
      const name = ($("cmName").value || "").trim();
      const cat  = ($("cmCategory").value || "").trim() || "Other";
      const priceStr = ($("cmPrice").value || "").replace(",", ".").trim();
      const price = priceStr !== "" && !isNaN(Number(priceStr)) ? Number(priceStr) : null;
      if (!name) return CHK.toast?.("Name required");
      try {
        if (!isEdit) {
          await api("/api/products/upsert", {
            method: "POST",
            body: JSON.stringify({ name, category: cat, price }),
          });
          CHK.toast?.("Added");
        } else {
          const body = { name, category: cat, active: $("cmActive")?.checked ?? true };
          if (price !== null) body.price = price;
          await api(`/api/products/${p.id}`, { method: "PATCH", body: JSON.stringify(body) });
          CHK.toast?.("Saved");
        }
        back.classList.add("hide");
        await load();
      } catch (e) {
        CHK.toast?.("Error: " + (e.message || String(e)));
      }
    };
  }

  /* ── back to venue ── */
  function goBack() {
    const tok = CHK.getToken?.() || "";
    if (typeof CHK.show === "function") CHK.show("screenVenue", tok);
    CHK.venue?.load?.().catch(() => {});
  }

  /* ── init ── */
  function init() {
    const btnAdd  = $("btnAddProduct");
    const btnBack = $("btnBackToCatalog");
    const search  = $("catalogSearch");
    if (btnAdd)  btnAdd.onclick  = () => openAddModal();
    if (btnBack) btnBack.onclick = () => goBack();
    if (search)  search.addEventListener("input", () => render());
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();

  CHK.catalog = {
    load: async () => {
      await load().catch((e) => CHK.toast?.("Catalog: " + (e.message || String(e))));
    },
  };
})();
