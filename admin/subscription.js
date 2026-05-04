/* Subscription management screen */
window.CHK = window.CHK || {};

(function () {
  const CHK = window.CHK;
  const $ = (id) => document.getElementById(id);

  const TBC_IBAN = "GE49TB7114236010100048";
  const TBC_URL  = `https://transfer.tbcbank.ge/?iban=${TBC_IBAN}`;

  const T = {
    ru: {
      free:          "✓ Бесплатный доступ",
      trial:         "Пробный период",
      active:        "✓ Подписка активна",
      expired:       "⚠ Подписка истекла",
      blocked:       "Запись заблокирована",
      until:         "До",
      plan_label:    "Выберите план:",
      monthly:       "Месяц",
      yearly:        "Год",
      gift:          "−2 месяца в подарок",
      amount_label:  "Сумма к оплате:",
      copy_amount:   "📋 Скопировать",
      copied:        "✓ Скопировано",
      pay_btn:       "Открыть оплату TBC →",
      venue_label:   "Заведение:",
      amount_field:  "Сумма:",
      desc_field:    "Назначение:",
      copy_desc:     "Скопировать",
      how_title:     "Как оплатить:",
      how_1:         "Нажмите кнопку выше — откроется форма TBC",
      how_2_pre:     "В поле «Сумма» введите",
      how_3_pre:     "После перевода напишите в",
      how_3_post:    "— подтвердим оплату",
    },
    en: {
      free:          "✓ Free access",
      trial:         "Trial period",
      active:        "✓ Subscription active",
      expired:       "⚠ Subscription expired",
      blocked:       "Writing is blocked",
      until:         "Until",
      plan_label:    "Choose a plan:",
      monthly:       "Monthly",
      yearly:        "Yearly",
      gift:          "−2 months free",
      amount_label:  "Amount to pay:",
      copy_amount:   "📋 Copy",
      copied:        "✓ Copied",
      pay_btn:       "Open TBC payment →",
      venue_label:   "Venue:",
      amount_field:  "Amount:",
      desc_field:    "Description:",
      copy_desc:     "Copy",
      how_title:     "How to pay:",
      how_1:         "Tap the button above — TBC payment form will open",
      how_2_pre:     "In the «Amount» field enter",
      how_3_pre:     "After the transfer write to",
      how_3_post:    "— we will activate your subscription",
    },
    ka: {
      free:          "✓ უფასო წვდომა",
      trial:         "საცდელი პერიოდი",
      active:        "✓ გამოწერა აქტიურია",
      expired:       "⚠ გამოწერა ამოიწურა",
      blocked:       "ჩაწერა დაბლოკილია",
      until:         "მდე",
      plan_label:    "აირჩიეთ გეგმა:",
      monthly:       "თვე",
      yearly:        "წელი",
      gift:          "−2 თვე საჩუქრად",
      amount_label:  "გადასახდელი თანხა:",
      copy_amount:   "📋 კოპირება",
      copied:        "✓ დაკოპირდა",
      pay_btn:       "TBC-ს გადახდის გახსნა →",
      venue_label:   "დაწესებულება:",
      amount_field:  "თანხა:",
      desc_field:    "დანიშნულება:",
      copy_desc:     "კოპირება",
      how_title:     "როგორ გადაიხადოთ:",
      how_1:         "დააჭირეთ ღილაკს — გაიხსნება TBC-ს ფორმა",
      how_2_pre:     "«თანხა» ველში შეიყვანეთ",
      how_3_pre:     "გადარიცხვის შემდეგ დაწერეთ",
      how_3_post:    "— გავააქტიურებთ გამოწერას",
    },
  };

  let _plan = "monthly";

  function _lang() { return CHK.i18n?.getLang() || "en"; }
  function _t(key) { const l = _lang(); return (T[l] || T.en)[key] || T.en[key] || key; }
  function _amount() { return _plan === "yearly" ? "490" : "49"; }
  function _description() { return `Checki / ${CHK._venueData?.name || ""}`; }

  function _copyField(text, btnId, resetLabel) {
    const btn = $(btnId);
    navigator.clipboard.writeText(text)
      .then(() => {
        if (btn) { btn.textContent = _t("copied"); setTimeout(() => { btn.textContent = resetLabel; }, 2000); }
      })
      .catch(() => CHK.toast?.(text));
  }

  function render() {
    const el = $("subscriptionContent");
    if (!el) return;
    const v = CHK._venueData;
    if (!v) { el.innerHTML = "<p>—</p>"; return; }

    const { sub_status, subscription_expires_at, trial_ends_at, is_free, name } = v;
    const locale = _lang() === "ka" ? "ka-GE" : _lang() === "ru" ? "ru-RU" : "en-GB";
    const fmt = (iso) => iso ? new Date(iso).toLocaleDateString(locale, { day: "numeric", month: "long" }) : "";
    const fmtFull = (iso) => iso ? new Date(iso).toLocaleDateString(locale, { day: "numeric", month: "long", year: "numeric" }) : "";

    let statusColor = "#aaa";
    let statusText = "";
    let expiryText = "";

    if (is_free || sub_status === "free") {
      statusColor = "#4cd964"; statusText = _t("free");
    } else if (sub_status === "trial") {
      statusColor = "#ffd60a"; statusText = _t("trial");
      expiryText = `${_t("until")} ${fmt(trial_ends_at)}`;
    } else if (sub_status === "active") {
      statusColor = "#4cd964"; statusText = _t("active");
      expiryText = `${_t("until")} ${fmtFull(subscription_expires_at)}`;
    } else {
      statusColor = "#ff5a6a"; statusText = _t("expired");
      expiryText = _t("blocked");
    }

    const showPay = !(is_free || sub_status === "free");

    const planHtml = showPay ? `
      <div style="margin:20px 0 8px;font-size:13px;color:#888">${_t("plan_label")}</div>
      <div style="display:flex;gap:8px;margin-bottom:20px">
        <button class="btn${_plan === "monthly" ? " primary" : ""}" id="subPlanMonthly"
          style="flex:1;padding:12px 8px;display:flex;flex-direction:column;align-items:center;gap:2px">
          <span style="font-size:13px;opacity:.7">${_t("monthly")}</span>
          <span style="font-size:20px;font-weight:700">49 ₾</span>
        </button>
        <button class="btn${_plan === "yearly" ? " primary" : ""}" id="subPlanYearly"
          style="flex:1;padding:12px 8px;display:flex;flex-direction:column;align-items:center;gap:2px">
          <span style="font-size:13px;opacity:.7">${_t("yearly")}</span>
          <span style="font-size:20px;font-weight:700">490 ₾</span>
          <span style="font-size:11px;color:#4cd964">${_t("gift")}</span>
        </button>
      </div>` : "";

    const cardHtml = showPay ? `
      <div style="background:#1a1a22;border-radius:12px;padding:16px;margin-bottom:16px">
        <div style="font-weight:700;font-size:15px;margin-bottom:14px;font-family:monospace">Checki</div>
        <div style="display:flex;flex-direction:column;gap:10px;font-size:14px;font-family:monospace">
          <div><span style="color:#888">${_t("venue_label")} </span>${name || ""}</div>
          <div style="display:flex;justify-content:space-between;align-items:center;gap:8px">
            <div><span style="color:#888">${_t("amount_field")} </span>${_amount()} GEL</div>
            <button class="btn compact" id="subCopyAmount" style="font-size:12px;padding:3px 8px">${_t("copy_amount")}</button>
          </div>
          <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px">
            <div style="flex:1"><span style="color:#888">${_t("desc_field")} </span>${_description()}</div>
            <button class="btn compact" id="subCopyDesc" style="font-size:12px;padding:3px 8px;flex-shrink:0">${_t("copy_desc")}</button>
          </div>
        </div>
      </div>
      <a href="${TBC_URL}" target="_blank"
         class="btn primary"
         style="display:block;text-align:center;text-decoration:none;padding:14px;margin-bottom:12px;font-size:15px">
        ${_t("pay_btn")}
      </a>
      <div style="background:#1a1a22;border-radius:10px;padding:12px;font-size:13px;color:#888;line-height:1.7">
        <div style="color:#fff;font-weight:600;margin-bottom:4px">${_t("how_title")}</div>
        1. ${_t("how_1")}<br>
        2. ${_t("how_2_pre")} <strong style="color:#fff">${_amount()} ₾</strong><br>
        3. ${_t("how_3_pre")}
        <a href="https://t.me/CheckiService_Bot" target="_blank" style="color:var(--accent)">@CheckiService_Bot</a>
        ${_t("how_3_post")}
      </div>` : "";

    el.innerHTML = `
      <div style="background:#1a1a22;border-radius:12px;padding:16px;margin-bottom:4px">
        <div style="color:${statusColor};font-weight:700;font-size:16px">${statusText}</div>
        ${expiryText ? `<div style="color:#aaa;margin-top:4px;font-size:14px">${expiryText}</div>` : ""}
      </div>
      ${planHtml}${cardHtml}`;

    if (showPay) {
      $("subPlanMonthly")?.addEventListener("click", () => { _plan = "monthly"; render(); });
      $("subPlanYearly")?.addEventListener("click",  () => { _plan = "yearly";  render(); });
      $("subCopyAmount")?.addEventListener("click",  () => _copyField(_amount(), "subCopyAmount", _t("copy_amount")));
      $("subCopyDesc")?.addEventListener("click",    () => _copyField(_description(), "subCopyDesc", _t("copy_desc")));
    }
  }

  function init() {
    $("btnBackFromSubscription")?.addEventListener("click", () => CHK.nav.back());
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();

  CHK.subscription = { load: () => render() };
})();
