/* Subscription management screen */
window.CHK = window.CHK || {};

(function () {
  const CHK = window.CHK;
  const $ = (id) => document.getElementById(id);

  const TBC_IBAN = "GE49TB7114236010100048";
  const TBC_URL  = `https://transfer.tbcbank.ge/?iban=${TBC_IBAN}`;

  let _plan = "monthly"; // "monthly" | "yearly"

  function _amount()      { return _plan === "yearly" ? "490" : "49"; }
  function _description() { return `Checki / ${CHK._venueData?.name || ""}`; }

  function _copyText(text, btnId) {
    const btn = $(btnId);
    navigator.clipboard.writeText(text)
      .then(() => {
        if (btn) { btn.textContent = "✓"; setTimeout(() => { btn.textContent = "Скопировать"; }, 2000); }
      })
      .catch(() => CHK.toast?.(text));
  }

  function render() {
    const el = $("subscriptionContent");
    if (!el) return;
    const v = CHK._venueData;
    if (!v) { el.innerHTML = "<p>—</p>"; return; }

    const { sub_status, subscription_expires_at, trial_ends_at, is_free, name } = v;

    /* ── status ── */
    let statusHtml = "";
    if (is_free || sub_status === "free") {
      statusHtml = `<div style="color:#4cd964;font-weight:700;font-size:16px">✓ Бесплатный доступ</div>`;
    } else if (sub_status === "trial") {
      const d = trial_ends_at
        ? new Date(trial_ends_at).toLocaleDateString("ru-RU", { day: "numeric", month: "long" })
        : "";
      statusHtml = `
        <div style="color:#ffd60a;font-weight:700;font-size:16px">Пробный период</div>
        <div style="color:#aaa;margin-top:4px;font-size:14px">До ${d}</div>`;
    } else if (sub_status === "active") {
      const d = subscription_expires_at
        ? new Date(subscription_expires_at).toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" })
        : "";
      statusHtml = `
        <div style="color:#4cd964;font-weight:700;font-size:16px">✓ Подписка активна</div>
        <div style="color:#aaa;margin-top:4px;font-size:14px">До ${d}</div>`;
    } else {
      statusHtml = `
        <div style="color:#ff5a6a;font-weight:700;font-size:16px">⚠ Подписка истекла</div>
        <div style="color:#aaa;margin-top:4px;font-size:14px">Запись заблокирована</div>`;
    }

    const showPay = !(is_free || sub_status === "free");

    /* ── plan selector ── */
    const planHtml = showPay ? `
      <div style="margin:20px 0 8px;font-size:13px;color:#888">Выберите план:</div>
      <div style="display:flex;gap:8px;margin-bottom:20px">
        <button class="btn${_plan === "monthly" ? " primary" : ""}" id="subPlanMonthly"
          style="flex:1;padding:12px 8px;display:flex;flex-direction:column;align-items:center;gap:2px">
          <span style="font-size:13px;color:inherit;opacity:.7">Месяц</span>
          <span style="font-size:20px;font-weight:700">49 ₾</span>
        </button>
        <button class="btn${_plan === "yearly" ? " primary" : ""}" id="subPlanYearly"
          style="flex:1;padding:12px 8px;display:flex;flex-direction:column;align-items:center;gap:2px">
          <span style="font-size:13px;color:inherit;opacity:.7">Год</span>
          <span style="font-size:20px;font-weight:700">490 ₾</span>
          <span style="font-size:11px;color:#4cd964">−2 месяца</span>
        </button>
      </div>` : "";

    /* ── payment card ── */
    const cardHtml = showPay ? `
      <div style="background:#1a1a22;border-radius:12px;padding:16px;margin-bottom:16px;position:relative">
        <div style="font-weight:700;font-size:15px;margin-bottom:14px;font-family:monospace">Оплата Checki</div>
        <div style="display:flex;flex-direction:column;gap:8px;font-size:14px;font-family:monospace">
          <div style="display:flex;justify-content:space-between;align-items:center">
            <div>
              <span style="color:#888">Заведение: </span>${name || ""}
            </div>
          </div>
          <div style="display:flex;justify-content:space-between;align-items:center">
            <div>
              <span style="color:#888">Сумма: </span>${_amount()} GEL
            </div>
            <button class="btn compact" id="subCopyAmount" style="font-size:12px;padding:3px 8px">Скопировать</button>
          </div>
          <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px">
            <div style="flex:1">
              <span style="color:#888">Назначение: </span>${_description()}
            </div>
            <button class="btn compact" id="subCopyDesc" style="font-size:12px;padding:3px 8px;flex-shrink:0">Скопировать</button>
          </div>
        </div>
      </div>

      <a href="${TBC_URL}" target="_blank" id="subPayBtn"
         class="btn primary"
         style="display:block;text-align:center;text-decoration:none;padding:14px;margin-bottom:12px;font-size:15px">
        Открыть оплату TBC →
      </a>

      <div style="font-size:12px;color:#666;text-align:center;line-height:1.6">
        После перевода напишите в
        <a href="https://t.me/CheckiService_Bot" target="_blank" style="color:var(--accent)">Telegram @CheckiService_Bot</a>
        — подтвердим оплату
      </div>` : "";

    el.innerHTML = `
      <div style="background:#1a1a22;border-radius:12px;padding:16px;margin-bottom:4px">
        ${statusHtml}
      </div>
      ${planHtml}
      ${cardHtml}`;

    if (showPay) _bindEvents();
  }

  function _bindEvents() {
    $("subPlanMonthly")?.addEventListener("click", () => { _plan = "monthly"; render(); });
    $("subPlanYearly")?.addEventListener("click",  () => { _plan = "yearly";  render(); });
    $("subCopyAmount")?.addEventListener("click",  () => _copyText(_amount(), "subCopyAmount"));
    $("subCopyDesc")?.addEventListener("click",    () => _copyText(_description(), "subCopyDesc"));
  }

  function init() {
    $("btnBackFromSubscription")?.addEventListener("click", () => CHK.nav.back());
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();

  CHK.subscription = { load: () => render() };
})();
