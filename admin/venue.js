/* Venue / manager screen */
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

  let staff = [];

  /* ── load ── */
  async function load() {
    const [venueRes, staffRes] = await Promise.all([
      api("/api/venue",  { method: "GET" }),
      api("/api/staff",  { method: "GET" }),
    ]);
    staff = Array.isArray(staffRes.items) ? staffRes.items : [];
    renderVenue(venueRes);
    renderStaff();
  }

  /* ── venue header + today stats ── */
  function renderVenue(r) {
    const el = $("venueHeader");
    if (!el || !r.venue) return;
    const s = r.stats || {};
    el.innerHTML = `
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px">
        <div class="archStatCard" style="text-align:center">
          <div class="archStatVal">${s.open_now ?? 0}</div>
          <div class="archStatLabel">Open now</div>
        </div>
        <div class="archStatCard" style="text-align:center">
          <div class="archStatVal">${s.closed_today ?? 0}</div>
          <div class="archStatLabel">Closed today</div>
        </div>
        <div class="archStatCard" style="text-align:center">
          <div class="archStatVal">${money(s.revenue_today)} ₾</div>
          <div class="archStatLabel">Revenue today</div>
        </div>
      </div>
    `;
  }

  /* ── staff list ── */
  function renderStaff() {
    const el = $("venueStaff");
    if (!el) return;
    const profile = CHK.getUserProfile?.() || {};
    if (!staff.length) {
      el.innerHTML = `<div class="muted" style="font-size:13px;padding:8px 0">No staff yet.</div>`;
      return;
    }
    el.innerHTML = staff.map((s) => `
      <div class="item vStaffRow" data-id="${esc(s.id)}" style="cursor:pointer${s.is_active ? "" : ";opacity:0.4"}">
        <div class="lineLeft">
          <div class="lineTitle">
            <b>${esc(s.name)}</b>
            <span class="vRoleBadge ${s.role === "manager" ? "vRoleManager" : "vRoleStaff"}">${s.role}</span>
          </div>
          <div class="lineMeta"><span>${esc(s.login)}</span></div>
        </div>
        <div style="display:flex;align-items:center;gap:10px">
          <div class="vActiveDot ${s.is_active ? "vDotOn" : "vDotOff"}"></div>
          <span class="muted" style="font-size:20px">›</span>
        </div>
      </div>
    `).join("");

    el.querySelectorAll(".vStaffRow").forEach((row) => {
      const s = staff.find((x) => x.id === row.dataset.id);
      if (!s) return;
      if (s.id === profile.user_id) row.onclick = () => openProfileModal();
      else row.onclick = () => openEditModal(s);
    });
  }

  /* ── staff modal (add / edit) ── */
  function openAddModal() {
    showStaffModal({ title: "Add staff", okText: "Create", s: null });
  }

  function openEditModal(s) {
    showStaffModal({ title: "Edit staff", okText: "Save", s });
  }

  function showStaffModal({ title, okText, s }) {
    const back = $("staffModalBack");
    const isEdit = !!s;

    back.innerHTML = `
      <div class="modal" style="width:min(92vw,420px)">
        <div class="modalTitle">${esc(title)}</div>
        <div style="display:flex;flex-direction:column;gap:10px;margin-bottom:14px">
          <input class="inp" id="smName"  placeholder="Name"  value="${esc(s ? s.name : "")}" />
          <input class="inp" id="smLogin" placeholder="Login" value="${esc(s ? s.login : "")}" ${isEdit ? "readonly style='opacity:.6'" : ""} />
          <input class="inp" id="smEmail" type="email" placeholder="Email (for password reset)" value="${esc(s ? (s.email || "") : "")}" />
          <input class="inp" id="smPw" type="password" placeholder="${isEdit ? "New password (leave blank to keep)" : "Password"}" />
          <label style="display:flex;align-items:center;gap:10px;font-size:14px;cursor:pointer;padding:4px 0">
            <input type="checkbox" id="smIsManager" ${isEdit && s.role === "manager" ? "checked" : ""} style="width:18px;height:18px;accent-color:var(--accent)" />
            Manager (can access venue settings)
          </label>
          ${isEdit ? `
            <label style="display:flex;align-items:center;gap:10px;font-size:14px;cursor:pointer;padding:4px 0">
              <input type="checkbox" id="smActive" ${s.is_active ? "checked" : ""} style="width:18px;height:18px;accent-color:var(--accent)" />
              Active
            </label>
          ` : ""}
        </div>
        <div class="modalBtns" style="justify-content:space-between">
          ${isEdit && s.role !== "manager" ? '<button class="btn danger" id="smDelete">Delete</button>' : '<div></div>'}
          <div style="display:flex;gap:8px">
            <button class="btn" id="smCancel">Cancel</button>
            <button class="btn primary" id="smOk">${esc(okText)}</button>
          </div>
        </div>
      </div>
    `;
    back.classList.remove("hide");

    $("smCancel").onclick = () => back.classList.add("hide");
    back.onclick = (e) => { if (e.target === back) back.classList.add("hide"); };

    const delBtn = $("smDelete");
    if (delBtn) {
      delBtn.onclick = async () => {
        const ok = await CHK.confirm({
          title: "Delete staff?",
          text: `"${s.name}" will be permanently deleted.`,
          okText: "Delete",
          danger: true,
        });
        if (!ok) return;
        try {
          await api(`/api/staff/${s.id}`, { method: "DELETE" });
          CHK.toast?.("Deleted");
          back.classList.add("hide");
          await load();
        } catch (e) {
          CHK.toast?.("Error: " + (e.message || String(e)));
        }
      };
    }

    $("smOk").onclick = async () => {
      const name    = ($("smName").value  || "").trim();
      const login   = ($("smLogin").value || "").trim();
      const pw      = ($("smPw").value    || "").trim();
      const email   = ($("smEmail").value || "").trim().toLowerCase() || null;
      const isManager = $("smIsManager")?.checked || false;
      const activeEl  = $("smActive");
      const role = isManager ? "manager" : "staff";
      if (!name || !login)  return CHK.toast?.("Name and login required");
      if (!isEdit && !pw)   return CHK.toast?.("Password required");
      try {
        if (!isEdit) {
          await api("/api/staff", {
            method: "POST",
            body: JSON.stringify({ name, login, password: pw, role, email }),
          });
          CHK.toast?.("Staff added");
        } else {
          const body = { name, role, is_active: activeEl ? activeEl.checked : true, email };
          if (pw) body.password = pw;
          await api(`/api/staff/${s.id}`, { method: "PATCH", body: JSON.stringify(body) });
          CHK.toast?.("Saved");
        }
        back.classList.add("hide");
        await load();
      } catch (e) {
        CHK.toast?.("Error: " + (e.message || String(e)));
      }
    };
  }

  /* ── profile modal (self-edit) ── */
  async function openProfileModal() {
    const back = $("staffModalBack");
    let profileData = { email: "", name: "" };
    try {
      profileData = await api("/api/profile", { method: "GET" });
    } catch (_) {}

    back.innerHTML = `
      <div class="modal" style="width:min(92vw,420px)">
        <div class="modalTitle">My profile</div>
        <div style="display:flex;flex-direction:column;gap:10px;margin-bottom:14px">
          <input class="inp" id="pmEmail" type="email" placeholder="Email (for password reset)" value="${esc(profileData.email || "")}" />
          <input class="inp" id="pmPw" type="password" placeholder="New password (leave blank to keep)" />
        </div>
        <div class="modalBtns">
          <button class="btn" id="pmCancel">Cancel</button>
          <button class="btn primary" id="pmOk">Save</button>
        </div>
      </div>
    `;
    back.classList.remove("hide");

    $("pmCancel").onclick = () => back.classList.add("hide");
    back.onclick = (e) => { if (e.target === back) back.classList.add("hide"); };

    $("pmOk").onclick = async () => {
      const email = ($("pmEmail").value || "").trim().toLowerCase() || null;
      const pw = ($("pmPw").value || "").trim();
      const body = { email };
      if (pw) body.password = pw;
      try {
        await api("/api/profile", { method: "PATCH", body: JSON.stringify(body) });
        CHK.toast?.("Saved");
        back.classList.add("hide");
      } catch (e) {
        CHK.toast?.("Error: " + (e.message || String(e)));
      }
    };
  }

  /* ── bind static elements ── */
  function init() {
    const btn = $("btnAddStaff");
    if (btn) btn.onclick = () => openAddModal();

    const btnCatalog = $("btnGoCatalog");
    if (btnCatalog) btnCatalog.onclick = async () => {
      const tok = CHK.getToken?.() || "";
      if (typeof CHK.show === "function") CHK.show("screenCatalog", tok);
      try { await CHK.catalog?.load(); } catch (e) { CHK.toast?.("Catalog: " + e.message); }
    };

    const btnGoSupplies = $("btnGoSupplies");
    if (btnGoSupplies) btnGoSupplies.onclick = () => {
      const tok = CHK.getToken?.() || "";
      CHK.show("screenSupplies", tok);
      CHK.supplies?.load();
    };
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();

  CHK.venue = {
    load: async () => {
      await load().catch((e) => CHK.toast?.("Venue: " + (e.message || String(e))));
    },
  };
})();
