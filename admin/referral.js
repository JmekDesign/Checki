/* Referral program screen */
window.CHK = window.CHK || {};

(function () {
  const CHK = window.CHK;
  const $ = (id) => document.getElementById(id);
  const api = (...a) => CHK.api(...a);

  const T = {
    ru: {
      title:      "Реферальная программа",
      link_label: "Ваша реферальная ссылка:",
      copy_link:  "Скопировать ссылку",
      copied:     "✓ Скопировано",
      referred:   "Заведений привлечено",
      balance:    "Накопленный бонус",
      balance_note: "Бонус начисляется за каждое оплатившее подписку заведение",
      pay_btn:    "Оплатить подписку →",
      loading:    "Загрузка…",
    },
    en: {
      title:      "Referral Program",
      link_label: "Your referral link:",
      copy_link:  "Copy link",
      copied:     "✓ Copied",
      referred:   "Venues referred",
      balance:    "Referral bonus",
      balance_note: "Bonus is credited for each venue that activates a paid subscription",
      pay_btn:    "Manage subscription →",
      loading:    "Loading…",
    },
    ka: {
      title:      "რეფერალური პროგრამა",
      link_label: "თქვენი რეფერალური ბმული:",
      copy_link:  "ბმულის კოპირება",
      copied:     "✓ დაკოპირდა",
      referred:   "მოყვანილი დაწესებულება",
      balance:    "დარიცხული ბონუსი",
      balance_note: "ბონუსი ერიცხება ყოველ დაწესებულებაზე, რომელმაც გადაიხადა",
      pay_btn:    "გამოწერის მართვა →",
      loading:    "იტვირთება…",
    },
  };

  function _t(key) {
    const lang = CHK.i18n?.getLang() || "en";
    return (T[lang] || T.en)[key] || T.en[key] || key;
  }

  async function render() {
    const el = $("referralContent");
    if (!el) return;
    el.innerHTML = `<div style="color:#888">${_t("loading")}</div>`;

    let data;
    try {
      data = await api("/api/referral/stats", { method: "GET" });
    } catch (e) {
      el.innerHTML = `<div style="color:#ff5a6a">${e.message}</div>`;
      return;
    }

    const code = data.referral_code || "";
    const link = `https://checki.ge/?ref=${code}`;

    el.innerHTML = `
      <div style="margin-bottom:20px">
        <div style="font-size:12px;color:#888;margin-bottom:6px">${_t("link_label")}</div>
        <div style="background:#1a1a22;border-radius:10px;padding:14px;display:flex;align-items:center;gap:10px">
          <div style="flex:1;font-family:monospace;font-size:13px;word-break:break-all;color:var(--accent)">${link}</div>
          <button class="btn compact" id="refCopyBtn" style="flex-shrink:0;padding:6px 12px">${_t("copy_link")}</button>
        </div>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:20px">
        <div class="archStatCard" style="text-align:center">
          <div class="archStatVal">${data.referred_count}</div>
          <div class="archStatLabel">${_t("referred")}</div>
        </div>
        <div class="archStatCard" style="text-align:center">
          <div class="archStatVal">${Number(data.balance).toFixed(0)} ₾</div>
          <div class="archStatLabel">${_t("balance")}</div>
        </div>
      </div>

      <div style="font-size:12px;color:#555;text-align:center;margin-bottom:20px;line-height:1.5">
        ${_t("balance_note")}
      </div>

      <button class="btn primary" id="refGoSub" style="width:100%;padding:14px;font-size:15px">
        ${_t("pay_btn")}
      </button>`;

    $("refCopyBtn")?.addEventListener("click", () => {
      const btn = $("refCopyBtn");
      navigator.clipboard.writeText(link)
        .then(() => {
          if (btn) { btn.textContent = _t("copied"); setTimeout(() => { btn.textContent = _t("copy_link"); }, 2000); }
        })
        .catch(() => CHK.toast?.(link));
    });

    $("refGoSub")?.addEventListener("click", () => {
      CHK.nav.go("screenSubscription");
      CHK.subscription?.load();
    });
  }

  function init() {
    $("btnBackFromReferral")?.addEventListener("click", () => CHK.nav.back());
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();

  CHK.referral = { load: () => render() };
})();
