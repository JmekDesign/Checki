/* Cash register widget — venue screen */
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

  async function load() {
    const el = $("venueCash");
    if (!el) return;
    try {
      const data = await api("/api/cash/shift", { method: "GET" });
      render(data);
    } catch (e) {
      el.innerHTML = `<div class="muted" style="font-size:13px">${esc(String(e.message || e))}</div>`;
    }
  }

  function render(d) {
    const el = $("venueCash");
    if (!el) return;
    const { is_opened, balance, opening, cash_in, cash_out, movements } = d;

    el.innerHTML = `
      <div class="row" style="justify-content:space-between;align-items:center;margin-bottom:10px">
        <div style="font-size:15px;font-weight:700">${CHK.t("cash_title")}</div>
        <div style="display:flex;gap:6px">
          ${!is_opened
            ? `<button class="btn compact primary" id="btnCashOpen">${CHK.t("cash_open_shift")}</button>`
            : `<button class="btn compact" id="btnCashOut">− ${CHK.t("cash_out_btn")}</button>
               <button class="btn compact primary" id="btnCashIn">+ ${CHK.t("cash_in_btn")}</button>`
          }
        </div>
      </div>
      ${is_opened ? `
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:8px">
          <div class="archStatCard" style="text-align:center">
            <div class="archStatVal">${money(opening)} ₾</div>
            <div class="archStatLabel">${CHK.t("cash_opening")}</div>
          </div>
          <div class="archStatCard" style="text-align:center">
            <div class="archStatVal" style="color:#4caf50">+${money(cash_in)} ₾</div>
            <div class="archStatLabel">${CHK.t("cash_in_stat")}</div>
          </div>
          <div class="archStatCard" style="text-align:center">
            <div class="archStatVal" style="color:#ff5a6a">−${money(cash_out)} ₾</div>
            <div class="archStatLabel">${CHK.t("cash_out_stat")}</div>
          </div>
        </div>
        <div class="archStatCard" style="text-align:center;margin-bottom:10px">
          <div class="archStatVal" style="font-size:22px">${money(balance)} ₾</div>
          <div class="archStatLabel">${CHK.t("cash_balance")}</div>
        </div>
        ${movements.length > 1 ? `
          <div style="display:flex;flex-direction:column;gap:4px">
            ${movements.map((m) => `
              <div class="item" style="padding:8px 12px">
                <div class="lineLeft">
                  <div class="lineTitle" style="font-size:13px">${esc(_movLabel(m))}</div>
                  ${m.note && m.type !== "in" ? `<div class="lineMeta">${esc(m.note)}</div>` : ""}
                </div>
                <div style="font-weight:600;font-size:14px;color:${m.type === "out" ? "#ff5a6a" : m.type === "open" ? "var(--fg)" : "#4caf50"}">
                  ${m.type === "out" ? "−" : "+"}${money(m.amount)} ₾
                </div>
              </div>
            `).join("")}
          </div>
        ` : ""}
      ` : `
        <div class="muted" style="font-size:13px;padding:4px 0">${CHK.t("cash_not_opened")}</div>
      `}
    `;

    $("btnCashOpen")?.addEventListener("click", () => openModal("open"));
    $("btnCashIn")?.addEventListener("click",   () => openModal("in"));
    $("btnCashOut")?.addEventListener("click",  () => openModal("out"));
  }

  function _movLabel(m) {
    if (m.type === "open") return CHK.t("cash_opening");
    if (m.type === "in" && m.check_id) return m.note || CHK.t("cash_in_stat");
    if (m.type === "in") return CHK.t("cash_in_stat");
    return CHK.t("cash_out_stat");
  }

  function openModal(type) {
    const back = $("cashModalBack");
    const title = type === "open" ? CHK.t("cash_open_shift")
                : type === "in"   ? CHK.t("cash_add_in")
                :                   CHK.t("cash_add_out");

    back.innerHTML = `
      <div class="modal" style="width:min(92vw,360px)">
        <div class="modalTitle">${title}</div>
        <div style="display:flex;flex-direction:column;gap:10px;margin-bottom:14px">
          <input class="inp" id="cmAmount" type="number" inputmode="decimal"
            placeholder="${CHK.t("cash_amount")}" />
          ${type !== "open" ? `<input class="inp" id="cmNote" placeholder="${CHK.t("cash_note")}" />` : ""}
        </div>
        <div class="modalBtns">
          <button class="btn" id="cmCancel">${CHK.t("cancel")}</button>
          <button class="btn primary" id="cmOk">${CHK.t("save")}</button>
        </div>
      </div>
    `;
    back.classList.remove("hide");
    $("cmAmount").focus();

    $("cmCancel").onclick = () => back.classList.add("hide");
    back.onclick = (e) => { if (e.target === back) back.classList.add("hide"); };

    $("cmOk").onclick = async () => {
      const amount = parseFloat($("cmAmount").value);
      if (!amount || amount <= 0) return CHK.toast?.(CHK.t("cash_amount_req"));
      const note = $("cmNote")?.value.trim() || null;
      try {
        await api("/api/cash/movement", {
          method: "POST",
          body: JSON.stringify({ type, amount, note }),
        });
        back.classList.add("hide");
        await load();
      } catch (e) {
        CHK.toast?.("Error: " + (e.message || String(e)));
      }
    };
  }

  CHK.cash = { load };
})();
