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
    CHK._venueData = r.venue;
    _updateLangButtons(r.venue.lang || "en");
    _renderSubscriptionRow(r.venue);
    _renderReferral(r.venue);
  }

  /* ── subscription row (compact) ── */
  function _renderSubscriptionRow(v) {
    const el = $("venueSubRowValue");
    if (!el) return;
    const { sub_status, subscription_expires_at, trial_ends_at, is_free } = v;
    if (is_free || sub_status === "free") {
      el.textContent = "✓ Бесплатный";
      el.style.color = "#4cd964";
    } else if (sub_status === "trial") {
      const d = trial_ends_at
        ? new Date(trial_ends_at).toLocaleDateString("ru-RU", { day: "numeric", month: "short" })
        : "";
      el.textContent = `Пробный · до ${d} →`;
      el.style.color = "#ffd60a";
    } else if (sub_status === "active") {
      const d = subscription_expires_at
        ? new Date(subscription_expires_at).toLocaleDateString("ru-RU", { day: "numeric", month: "short" })
        : "";
      el.textContent = `Активна · до ${d} →`;
      el.style.color = "#4cd964";
    } else {
      el.textContent = "⚠ Истекла →";
      el.style.color = "#ff5a6a";
    }
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
    const btnGoSubscription = $("btnGoSubscription");
    if (btnGoSubscription) btnGoSubscription.onclick = () => {
      CHK.nav.go("screenSubscription");
      CHK.subscription?.load();
    };

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
