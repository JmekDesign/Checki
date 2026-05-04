/* Subscription management screen */
window.CHK = window.CHK || {};

(function () {
  const CHK = window.CHK;
  const $ = (id) => document.getElementById(id);

  const TBC_IBAN = "GE49TB7114236010100048";
  const TBC_URL  = `https://transfer.tbcbank.ge/?iban=${TBC_IBAN}&description=Checki`;

  let _plan = "monthly"; // "monthly" | "yearly"

  function _planAmount() { return _plan === "yearly" ? "490" : "49"; }

  function render() {
    const el = $("subscriptionContent");
    if (!el) return;
    const v = CHK._venueData;
    if (!v) { el.innerHTML = "<p>—</p>"; return; }

    const { sub_status, subscription_expires_at, trial_ends_at, is_free } = v;

    /* status block */
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

    /* payment block (not shown for free accounts) */
    const showPay = !(is_free || sub_status === "free");
    const payHtml = showPay ? `
      <div style="margin:20px 0 8px;font-size:13px;color:#888">Выберите план:</div>
      <div style="display:flex;gap:8px;margin-bottom:16px">
        <button class="btn${_plan === "monthly" ? " primary" : ""}" id="subPlanMonthly"
          style="flex:1;padding:12px 8px;display:flex;flex-direction:column;align-items:center;gap:2px">
          <span style="font-size:13px;color:#aaa">Месяц</span>
          <span style="font-size:20px;font-weight:700">49 ₾</span>
        </button>
        <button class="btn${_plan === "yearly" ? " primary" : ""}" id="subPlanYearly"
          style="flex:1;padding:12px 8px;display:flex;flex-direction:column;align-items:center;gap:2px">
          <span style="font-size:13px;color:#aaa">Год</span>
          <span style="font-size:20px;font-weight:700">490 ₾</span>
          <span style="font-size:11px;color:#4cd964">−2 месяца в подарок</span>
        </button>
      </div>

      <div style="background:#1a1a22;border-radius:10px;padding:14px;margin-bottom:14px">
        <div style="font-size:12px;color:#888;margin-bottom:8px">Сумма к оплате:</div>
        <div style="display:flex;align-items:center;justify-content:space-between">
          <div style="font-size:24px;font-weight:700" id="subAmountDisplay">${_planAmount()} ₾</div>
          <button class="btn compact" id="subCopyAmount" style="padding:5px 12px;font-size:13px">
            📋 Скопировать
          </button>
        </div>
      </div>

      <a href="${TBC_URL}" target="_blank" id="subPayBtn"
         class="btn primary"
         style="display:block;text-align:center;text-decoration:none;margin-bottom:10px;padding:14px">
        Перейти к оплате TBC →
      </a>

      <div style="background:#1a1a22;border-radius:10px;padding:12px;font-size:13px;color:#888;line-height:1.6">
        <div style="color:#fff;font-weight:600;margin-bottom:4px">Как оплатить:</div>
        1. Нажмите кнопку выше — откроется форма TBC<br>
        2. В поле «Сумма» введите <strong style="color:#fff">${_planAmount()} ₾</strong><br>
        3. Сделайте перевод и напишите нам в
        <a href="https://t.me/checkilive" target="_blank" style="color:var(--accent)">Telegram @checkilive</a>
        — мы активируем подписку
      </div>` : "";

    el.innerHTML = `
      <div style="background:#1a1a22;border-radius:12px;padding:16px;margin-bottom:20px">
        ${statusHtml}
      </div>
      ${payHtml}`;

    if (showPay) _bindPayEvents();
  }

  function _bindPayEvents() {
    $("subPlanMonthly")?.addEventListener("click", () => { _plan = "monthly"; render(); });
    $("subPlanYearly")?.addEventListener("click",  () => { _plan = "yearly";  render(); });

    $("subCopyAmount")?.addEventListener("click", () => {
      const amount = _planAmount();
      const btn = $("subCopyAmount");
      navigator.clipboard.writeText(amount)
        .then(() => {
          if (btn) {
            btn.textContent = "✓ Скопировано";
            setTimeout(() => { btn.innerHTML = "📋 Скопировать"; }, 2000);
          }
        })
        .catch(() => CHK.toast?.(amount));
    });
  }

  function init() {
    $("btnBackFromSubscription")?.addEventListener("click", () => CHK.nav.back());
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();

  CHK.subscription = { load: () => render() };
})();
