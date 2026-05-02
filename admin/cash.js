/* Cash register — venue stat widget + full cash screen */
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
  const todayStr = () => new Date().toISOString().slice(0, 10);

  /* ── Mini balance card in venue stats ───────────────────────────── */
  async function loadBalance() {
    try {
      const d = await api("/api/cash/shift", { method: "GET" });
      const el = $("cashBalanceStat");
      if (!el) return;
      const val = el.querySelector(".archStatVal");
      if (val) val.textContent = d.is_opened ? money(d.balance) + " ₾" : "—";
    } catch (_) {}
  }

  /* ── Full cash screen ───────────────────────────────────────────── */
  async function load() {
    const from = $("cashFrom")?.value || todayStr();
    const to   = $("cashTo")?.value   || todayStr();
    const el = $("cashContent");
    if (!el) return;
    el.innerHTML = `<div class="muted" style="text-align:center;padding:24px">…</div>`;
    try {
      const d = await api(`/api/cash/movements?from=${from}&to=${to}`, { method: "GET" });
      renderScreen(d);
    } catch (e) {
      el.innerHTML = `<div class="muted">${esc(e.message || String(e))}</div>`;
    }
  }

  function renderScreen(d) {
    const el = $("cashContent");
    if (!el) return;
    const { summary, shifts } = d;
    const to = $("cashTo")?.value || todayStr();
    const todayShift = to === todayStr() ? shifts.find((s) => s.is_today) : null;

    el.innerHTML = `
      ${todayShift !== null ? `
        <div style="display:flex;gap:6px;margin-bottom:12px">
          ${!todayShift?.is_opened
            ? `<button class="btn compact primary" id="btnCashOpen">${CHK.t("cash_open_shift")}</button>`
            : `<button class="btn compact" id="btnCashOut">− ${CHK.t("cash_out_btn")}</button>
               <button class="btn compact primary" id="btnCashIn">+ ${CHK.t("cash_in_btn")}</button>`
          }
        </div>
      ` : ""}
      <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:8px;margin-bottom:12px">
        <div class="archStatCard" style="text-align:center">
          <div class="archStatVal">${money(summary.opening)} ₾</div>
          <div class="archStatLabel">${CHK.t("cash_opening")}</div>
        </div>
        <div class="archStatCard" style="text-align:center">
          <div class="archStatVal" style="color:#4caf50">+${money(summary.cash_in)} ₾</div>
          <div class="archStatLabel">${CHK.t("cash_in_stat")}</div>
        </div>
        <div class="archStatCard" style="text-align:center">
          <div class="archStatVal" style="color:#ff5a6a">−${money(summary.cash_out)} ₾</div>
          <div class="archStatLabel">${CHK.t("cash_out_stat")}</div>
        </div>
        <div class="archStatCard" style="text-align:center">
          <div class="archStatVal" style="font-size:20px">${money(summary.balance)} ₾</div>
          <div class="archStatLabel">${CHK.t("cash_balance")}</div>
        </div>
      </div>
      ${shifts.map(_renderShift).join("")}
    `;

    $("btnCashOpen")?.addEventListener("click", () => openModal("open"));
    $("btnCashIn")?.addEventListener("click",   () => openModal("in"));
    $("btnCashOut")?.addEventListener("click",  () => openModal("out"));
  }

  function _renderShift(s) {
    const lang = CHK.i18n?.getLang() === "ka" ? "ka-GE" : "en-US";
    let label = s.shift_date;
    try { label = new Date(s.shift_date + "T12:00:00").toLocaleDateString(lang, { day: "numeric", month: "short", year: "numeric" }); }
    catch (_) {}
    return `
      <div style="font-size:12px;font-weight:600;color:var(--muted);text-transform:uppercase;margin:12px 0 6px">${label}</div>
      <div style="display:flex;flex-direction:column;gap:4px">
        ${s.movements.map((m) => `
          <div class="item" style="padding:8px 12px">
            <div class="lineLeft">
              <div class="lineTitle" style="font-size:13px">${esc(_movLabel(m))}</div>
              ${m.note && m.type === "out" ? `<div class="lineMeta">${esc(m.note)}</div>` : ""}
            </div>
            <div style="font-weight:600;font-size:13px;color:${m.type === "out" ? "#ff5a6a" : m.type === "open" ? "var(--fg)" : "#4caf50"}">
              ${m.type === "out" ? "−" : "+"}${money(m.amount)} ₾
            </div>
          </div>
        `).join("")}
      </div>
    `;
  }

  function _movLabel(m) {
    if (m.type === "open") return CHK.t("cash_opening");
    if (m.type === "in" && m.check_id) return m.note || CHK.t("cash_in_stat");
    if (m.type === "in")  return CHK.t("cash_in_stat");
    return CHK.t("cash_out_stat");
  }

  /* ── Add movement modal ─────────────────────────────────────────── */
  function openModal(type) {
    const back  = $("cashModalBack");
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
        await api("/api/cash/movement", { method: "POST", body: JSON.stringify({ type, amount, note }) });
        back.classList.add("hide");
        await load();
        await loadBalance();
      } catch (e) {
        CHK.toast?.("Error: " + (e.message || String(e)));
      }
    };
  }

  /* ── PDF download ───────────────────────────────────────────────── */
  async function downloadReport() {
    const btn  = $("btnCashReport");
    const from = $("cashFrom")?.value || todayStr();
    const to   = $("cashTo")?.value   || todayStr();
    if (btn) { btn.disabled = true; }
    try {
      const resp = await CHK.apiFetch(`/api/cash/report?from=${from}&to=${to}`);
      if (!resp.ok) throw new Error("Report error " + resp.status);
      const blob  = await resp.blob();
      const fname = `cash-${from}-${to}.pdf`;
      const file  = new File([blob], fname, { type: "application/pdf" });
      const isMobile = navigator.maxTouchPoints > 0;
      if (isMobile && navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: "Cash Report" });
      } else {
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = fname;
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 3000);
      }
    } catch (e) {
      if (e.name !== "AbortError") CHK.toast?.("Report: " + (e.message || String(e)));
    } finally {
      if (btn) { btn.disabled = false; }
    }
  }

  /* ── Quick date filters ─────────────────────────────────────────── */
  function _setQuick(q) {
    const t   = todayStr();
    const now = new Date();
    let from = t, to = t;
    if (q === "week") {
      const d = new Date(); d.setDate(d.getDate() - 6);
      from = d.toISOString().slice(0, 10);
    } else if (q === "month") {
      const d = new Date(); d.setDate(d.getDate() - 29);
      from = d.toISOString().slice(0, 10);
    } else if (q === "curmonth") {
      from = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
    } else if (q === "all") {
      from = "2020-01-01";
    }
    const fromEl = $("cashFrom"), toEl = $("cashTo");
    if (fromEl) { fromEl.value = from; fromEl.dispatchEvent(new Event("change", { bubbles: true })); }
    if (toEl)   { toEl.value   = to;   toEl.dispatchEvent(new Event("change", { bubbles: true })); }
    CHK.datepicker?.updateButtons?.();
    document.querySelectorAll(".cashQuick").forEach((b) => b.classList.remove("primary"));
    document.querySelector(`.cashQuick[data-q="${q}"]`)?.classList.add("primary");
  }

  /* ── Init ───────────────────────────────────────────────────────── */
  function init() {
    $("btnBackFromCash")?.addEventListener("click", () => CHK.nav.back());
    $("btnCashReport")?.addEventListener("click", downloadReport);
    $("btnCashReset")?.addEventListener("click", () => {
      const t = todayStr();
      const fromEl = $("cashFrom"), toEl = $("cashTo");
      if (fromEl) { fromEl.value = t; fromEl.dispatchEvent(new Event("change", { bubbles: true })); }
      if (toEl)   { toEl.value   = t; toEl.dispatchEvent(new Event("change", { bubbles: true })); }
      CHK.datepicker?.updateButtons?.();
    });
    document.querySelectorAll(".cashQuick").forEach((btn) => {
      btn.addEventListener("click", () => _setQuick(btn.dataset.q));
    });
    $("cashFrom")?.addEventListener("change", load);
    $("cashTo")?.addEventListener("change", load);

    // Set current month label
    const cm = $("btnCashCurMonth");
    if (cm) cm.textContent = new Date().toLocaleDateString(
      CHK.i18n?.getLang() === "ka" ? "ka-GE" : "en-US", { month: "long" }
    );
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();

  CHK.cash = {
    loadBalance,
    load: () => {
      // Switch datepicker context to cash inputs
      CHK.datepicker?.setContext?.("cashFrom", "cashTo", "cashDpBtnFrom", "cashDpBtnTo");
      // Default to today if inputs are empty
      const t = todayStr();
      const fromEl = $("cashFrom"), toEl = $("cashTo");
      if (fromEl && !fromEl.value) fromEl.value = t;
      if (toEl   && !toEl.value)   toEl.value   = t;
      CHK.datepicker?.updateButtons?.();
      _setQuick("today");
    },
  };
})();
