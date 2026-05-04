/* Venue / manager screen — header, stats, subscription, referral, lang */
window.CHK = window.CHK || {};

(function () {
  const CHK = window.CHK;
  const api = (...a) => CHK.api(...a);
  const $ = (id) => document.getElementById(id);
  const money = (x) => {
    const n = Number(x || 0);
    return isFinite(n) ? n.toFixed(2).replace(/\.00$/, "") : "0";
  };

  /* ── load ── */
  async function load() {
    const headerEl = $("venueHeader");
    const staffEl  = $("venueStaff");
    if (headerEl) headerEl.innerHTML = `
      <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:8px">
        ${[CHK.t("open_now"),CHK.t("closed_today"),CHK.t("revenue"),CHK.t("cash_balance")].map(l => `
          <div class="archStatCard" style="text-align:center">
            <div class="archStatVal" style="color:#ddd">—</div>
            <div class="archStatLabel" style="color:#ddd">${l}</div>
          </div>`).join("")}
      </div>`;
    if (staffEl) staffEl.innerHTML = "";

    const [venueRes, staffRes] = await Promise.all([
      api("/api/venue", { method: "GET" }),
      api("/api/staff", { method: "GET" }),
    ]);
    renderVenue(venueRes);
    CHK.venueStaff?.render(Array.isArray(staffRes.items) ? staffRes.items : []);
  }

  /* ── venue header + today stats ── */
  function renderVenue(r) {
    const el = $("venueHeader");
    if (!el || !r.venue) return;
    const s = r.stats || {};
    el.innerHTML = `
      <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:8px">
        <div class="archStatCard" style="text-align:center">
          <div class="archStatVal">${s.open_now ?? 0}</div>
          <div class="archStatLabel">${CHK.t("open_now")}</div>
        </div>
        <div class="archStatCard" style="text-align:center">
          <div class="archStatVal">${s.closed_today ?? 0}</div>
          <div class="archStatLabel">${CHK.t("closed_today")}</div>
        </div>
        <div class="archStatCard" style="text-align:center">
          <div class="archStatVal">${money(s.revenue_today)} ₾</div>
          <div class="archStatLabel">${CHK.t("revenue")}</div>
        </div>
        <div class="archStatCard" style="text-align:center" id="cashBalanceStat">
          <div class="archStatVal">—</div>
          <div class="archStatLabel">${CHK.t("cash_balance")}</div>
        </div>
      </div>
    `;
    _updateLangButtons(r.venue.lang || "en");
    _renderSubscription(r.venue);
    _renderReferral(r.venue);
  }

  /* ── subscription block ── */
  function _renderSubscription(v) {
    const el = $("venueSubBlock");
    if (!el) return;
    const { sub_status, subscription_expires_at, trial_ends_at, is_free } = v;

    let statusHtml = "";
    let expiryHtml = "";
    let payHtml    = "";

    if (is_free || sub_status === "free") {
      statusHtml = `<span style="color:#4cd964;font-weight:700">✓ Бесплатный доступ</span>`;
    } else if (sub_status === "trial") {
      const d = trial_ends_at ? new Date(trial_ends_at).toLocaleDateString("ru-RU", { day:"numeric", month:"long" }) : "";
      statusHtml = `<span style="color:#ffd60a;font-weight:700">Пробный период</span>`;
      expiryHtml = `<div style="font-size:13px;color:#aaa;margin-top:2px">До ${d}</div>`;
      payHtml = _payButton();
    } else if (sub_status === "active") {
      const d = subscription_expires_at ? new Date(subscription_expires_at).toLocaleDateString("ru-RU", { day:"numeric", month:"long", year:"numeric" }) : "";
      statusHtml = `<span style="color:#4cd964;font-weight:700">✓ Подписка активна</span>`;
      expiryHtml = `<div style="font-size:13px;color:#aaa;margin-top:2px">До ${d}</div>`;
      payHtml = _payButton("Продлить");
    } else {
      statusHtml = `<span style="color:#ff5a6a;font-weight:700">⚠ Подписка истекла</span>`;
      expiryHtml = `<div style="font-size:13px;color:#aaa;margin-top:2px">Запись заблокирована</div>`;
      payHtml = _payButton("Оплатить 49 ₾");
    }

    el.innerHTML = `
      <div style="padding:12px 0 4px">
        <div>${statusHtml}</div>
        ${expiryHtml}
      </div>
      ${payHtml}
    `;
  }

  function _payButton(label) {
    label = label || "Оплатить подписку";
    return `
      <a href="https://transfer.tbcbank.ge/?iban=GE49TB7114236010100048&amount=49&description=Checki"
         target="_blank"
         class="btn primary" style="display:block;text-align:center;text-decoration:none;margin-top:8px">
        ${label} →
      </a>
      <div style="font-size:12px;color:#888;margin-top:8px;text-align:center">
        После оплаты напишите нам в
        <a href="https://t.me/checkilive" target="_blank" style="color:var(--accent)">Telegram @checkilive</a>
      </div>
    `;
  }

  /* ── referral code + copy button ── */
  function _renderReferral(v) {
    const row = $("venueReferralRow");
    if (!row || !v.referral_code) return;
    row.style.display = "";
    const codeEl = $("venueReferralCode");
    if (codeEl) codeEl.textContent = v.referral_code;
    const copyBtn = $("venueReferralCopy");
    if (copyBtn) {
      copyBtn.onclick = () => {
        const link = "https://checki.ge/?ref=" + v.referral_code;
        navigator.clipboard.writeText(link).then(() => {
          copyBtn.textContent = "✓";
          setTimeout(() => { copyBtn.textContent = "📋"; }, 2000);
        }).catch(() => { CHK.toast?.(link); });
      };
    }
  }

  /* ── lang ── */
  function _updateLangButtons(activeLang) {
    const en = $("btnLangEn");
    const ka = $("btnLangKa");
    if (en) en.classList.toggle("primary", activeLang === "en");
    if (ka) ka.classList.toggle("primary", activeLang === "ka");
  }

  async function _setVenueLang(lang) {
    try {
      await api("/api/venue/lang", { method: "PATCH", body: JSON.stringify({ lang }) });
      CHK.i18n?.setLang(lang, true);
      _updateLangButtons(lang);
      const el = $("venueHeader");
      if (el) el.querySelectorAll(".archStatLabel").forEach((lbl, i) => {
        lbl.textContent = CHK.t(["open_now", "closed_today", "revenue"][i] || "");
      });
    } catch (e) {
      CHK.toast?.("Error: " + (e.message || String(e)));
    }
  }

  /* ── init ── */
  function init() {
    const btnCatalog = $("btnGoCatalog");
    if (btnCatalog) btnCatalog.onclick = async () => {
      CHK.nav.go("screenCatalog");
      try { await CHK.catalog?.load(); } catch (e) { CHK.toast?.("Catalog: " + e.message); }
    };

    const btnGoSupplies = $("btnGoSupplies");
    if (btnGoSupplies) btnGoSupplies.onclick = () => {
      CHK.nav.go("screenSupplies");
      CHK.supplies?.load();
    };

    const btnGoCash = $("btnGoCash");
    if (btnGoCash) btnGoCash.onclick = () => {
      CHK.nav.go("screenCash");
      CHK.cash?.load();
    };

    const btnLangEn = $("btnLangEn");
    if (btnLangEn) btnLangEn.onclick = () => _setVenueLang("en");
    const btnLangKa = $("btnLangKa");
    if (btnLangKa) btnLangKa.onclick = () => _setVenueLang("ka");

    _updateLangButtons(CHK.i18n?.getLang() || "en");

    CHK.i18n?.onLangChange(() => {
      CHK.venueStaff?.render([]);
      _updateLangButtons(CHK.i18n.getLang());
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();

  CHK.venue = {
    load: async () => {
      await load().catch((e) => CHK.toast?.("Venue: " + (e.message || String(e))));
      CHK.cash?.loadBalance().catch(() => {});
    },
  };
})();
