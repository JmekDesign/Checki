/* Venue staff management — modals for add/edit/profile */
window.CHK = window.CHK || {};

(function () {
  const CHK = window.CHK;
  const api = (...a) => CHK.api(...a);
  const $ = (id) => document.getElementById(id);
  const esc = (s) =>
    (s || "").toString().replace(/[&<>"']/g, (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
    );

  function reload() { CHK.venue?.load(); }

  /* ── staff list renderer ── */
  function renderStaff(staff) {
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
            <span class="vRoleBadge ${s.role === "manager" ? "vRoleManager" : "vRoleStaff"}">${CHK.t("role_" + s.role)}</span>
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
    showStaffModal({ title: CHK.t("add_staff"), okText: CHK.t("create"), s: null });
  }

  function openEditModal(s) {
    showStaffModal({ title: CHK.t("edit_staff"), okText: CHK.t("save"), s });
  }

  function showStaffModal({ title, okText, s }) {
    const back = $("staffModalBack");
    const isEdit = !!s;

    back.innerHTML = `
      <div class="modal" style="width:min(92vw,420px)">
        <div class="modalTitle">${esc(title)}</div>
        <div style="display:flex;flex-direction:column;gap:10px;margin-bottom:14px">
          <input class="inp" id="smName"  placeholder="${CHK.t('ph_staff_name')}"  value="${esc(s ? s.name : "")}" />
          <input class="inp" id="smLogin" placeholder="${CHK.t('ph_staff_login')}" value="${esc(s ? s.login : "")}" ${isEdit ? "readonly style='opacity:.6'" : ""} />
          <input class="inp" id="smEmail" type="email" placeholder="${CHK.t('ph_staff_email')}" value="${esc(s ? (s.email || "") : "")}" />
          <input class="inp" id="smPw" type="password" placeholder="${isEdit ? CHK.t('ph_staff_pw') : CHK.t('pw_required')}" />
          <label style="display:flex;align-items:center;gap:10px;font-size:14px;cursor:pointer;padding:4px 0">
            <input type="checkbox" id="smIsManager" ${isEdit && s.role === "manager" ? "checked" : ""} style="width:18px;height:18px;accent-color:var(--accent)" />
            ${CHK.t("lbl_manager_access")}
          </label>
          ${isEdit ? `
            <label style="display:flex;align-items:center;gap:10px;font-size:14px;cursor:pointer;padding:4px 0">
              <input type="checkbox" id="smActive" ${s.is_active ? "checked" : ""} style="width:18px;height:18px;accent-color:var(--accent)" />
              ${CHK.t("lbl_active")}
            </label>
          ` : ""}
          <div id="smError" style="display:none;color:var(--danger,#ff5a6a);font-size:13px;padding:8px 10px;background:rgba(255,90,106,.08);border-radius:8px"></div>
        </div>
        <div class="modalBtns" style="justify-content:space-between">
          ${isEdit && s.role !== "manager" ? `<button class="btn danger" id="smDelete">${CHK.t("delete_")}</button>` : '<div></div>'}
          <div style="display:flex;gap:8px">
            <button class="btn" id="smCancel">${CHK.t("cancel")}</button>
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
          title: CHK.t("delete_staff_q"),
          text: `"${s.name}" will be permanently deleted.`,
          okText: CHK.t("delete_"),
          danger: true,
        });
        if (!ok) return;
        try {
          await api(`/api/staff/${s.id}`, { method: "DELETE" });
          CHK.toast?.(CHK.t("deleted"));
          back.classList.add("hide");
          reload();
        } catch (e) {
          CHK.toast?.("Error: " + (e.message || String(e)));
        }
      };
    }

    const showErr = (msg) => {
      const el = $("smError");
      if (!el) return CHK.toast?.(msg);
      el.textContent = msg;
      el.style.display = "block";
    };

    $("smOk").onclick = async () => {
      const name      = ($("smName").value  || "").trim();
      const login     = ($("smLogin").value || "").trim();
      const pw        = ($("smPw").value    || "").trim();
      const email     = ($("smEmail").value || "").trim().toLowerCase() || null;
      const isManager = $("smIsManager")?.checked || false;
      const activeEl  = $("smActive");
      const role = isManager ? "manager" : "staff";
      const errEl = $("smError");
      if (errEl) errEl.style.display = "none";
      if (!name || !login) return showErr(CHK.t("name_login_req"));
      if (!isEdit && !pw)  return showErr(CHK.t("pw_required"));
      try {
        if (!isEdit) {
          await api("/api/staff", {
            method: "POST",
            body: JSON.stringify({ name, login, password: pw, role, email }),
          });
          CHK.toast?.(CHK.t("staff_added"));
        } else {
          const body = { name, role, is_active: activeEl ? activeEl.checked : true, email };
          if (pw) body.password = pw;
          await api(`/api/staff/${s.id}`, { method: "PATCH", body: JSON.stringify(body) });
          CHK.toast?.(CHK.t("saved"));
        }
        back.classList.add("hide");
        reload();
      } catch (e) {
        showErr(e.message || String(e));
      }
    };
  }

  /* ── profile modal (self-edit) ── */
  async function openProfileModal() {
    const back = $("staffModalBack");
    let profileData = { email: "", name: "" };
    try { profileData = await api("/api/profile", { method: "GET" }); } catch (_) {}

    back.innerHTML = `
      <div class="modal" style="width:min(92vw,420px)">
        <div class="modalTitle">${CHK.t("my_profile")}</div>
        <div style="display:flex;flex-direction:column;gap:10px;margin-bottom:14px">
          <input class="inp" id="pmName"  placeholder="${CHK.t('ph_staff_name')}"  value="${esc(profileData.name || "")}" />
          <input class="inp" id="pmLogin" placeholder="${CHK.t('ph_staff_login')}" value="${esc(profileData.login || "")}" />
          <input class="inp" id="pmEmail" type="email" placeholder="${CHK.t('ph_staff_email')}" value="${esc(profileData.email || "")}" />
          <input class="inp" id="pmPw" type="password" placeholder="${CHK.t('ph_staff_pw')}" />
        </div>
        <div class="modalBtns">
          <button class="btn" id="pmCancel">${CHK.t("cancel")}</button>
          <button class="btn primary" id="pmOk">${CHK.t("save")}</button>
        </div>
      </div>
    `;
    back.classList.remove("hide");

    $("pmCancel").onclick = () => back.classList.add("hide");
    back.onclick = (e) => { if (e.target === back) back.classList.add("hide"); };

    $("pmOk").onclick = async () => {
      const name  = ($("pmName").value  || "").trim();
      const login = ($("pmLogin").value || "").trim();
      const email = ($("pmEmail").value || "").trim().toLowerCase() || null;
      const pw    = ($("pmPw").value    || "").trim();
      if (!name || !login) return CHK.toast?.(CHK.t("name_login_req"));
      const body = { name, login, email };
      if (pw) body.password = pw;
      try {
        await api("/api/profile", { method: "PATCH", body: JSON.stringify(body) });
        CHK.toast?.(CHK.t("saved"));
        back.classList.add("hide");
        reload();
      } catch (e) {
        CHK.toast?.("Error: " + (e.message || String(e)));
      }
    };
  }

  /* ── bind add-staff button ── */
  function init() {
    const btn = $("btnAddStaff");
    if (btn) btn.onclick = () => openAddModal();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();

  CHK.venueStaff = { render: renderStaff };
})();
