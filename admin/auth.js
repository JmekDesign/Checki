/* Auth, tab navigation, initial screen */
window.CHK = window.CHK || {};

(function () {
  const CHK = window.CHK;
  const api = CHK.api;
  const $ = CHK.$;
  const toast = (msg) => CHK.toast?.(msg);

  let token = CHK.getToken() || "";

  function setToken(t) {
    token = t || "";
    CHK.setToken(token);
    $("btnLogout")?.classList.toggle("hide", !token);
    $("btnHelp")?.classList.toggle("hide", !token);
  }
  setToken(token);

  $("btnLogout").onclick = () => {
    setToken("");
    CHK.setUserProfile(null);
    CHK.nav.reset("screenLogin");
    toast(CHK.t("logout"));
  };

  const tabOpen = $("tabOpen");
  if (tabOpen) tabOpen.onclick = async () => {
    await CHK.open?.load().catch(() => {});
    CHK.nav.reset("screenOpen");
  };

  const tabArchive = $("tabArchive");
  if (tabArchive) tabArchive.onclick = async () => {
    CHK.nav.reset("screenArchive");
    try { await CHK.archive?.load(); } catch (e) { toast("Archive: " + e.message); }
  };

  const btnVenue = $("btnVenue");
  if (btnVenue) btnVenue.onclick = async () => {
    const hEl = $("venueHeader"); if (hEl) hEl.innerHTML = "";
    const sEl = $("venueStaff");  if (sEl) sEl.innerHTML = "";
    CHK.nav.go("screenVenue");
    try { await CHK.venue?.load(); } catch (e) { toast("Venue: " + e.message); }
  };

  const btnBackFromVenue = $("btnBackFromVenue");
  if (btnBackFromVenue) btnBackFromVenue.onclick = () => CHK.nav.back();

  $("btnLogin").onclick = async () => {
    try {
      const login = $("login").value.trim();
      const password = $("password").value.trim();
      const r = await api("/api/auth/login", { method: "POST", body: JSON.stringify({ login, password }) });
      setToken(r.token);
      CHK.setUserProfile(r.user || null);
      if (r.user?.lang) CHK.i18n?.setLang(r.user.lang);
      toast("OK");
      await CHK.open?.load();
      CHK.nav.reset("screenOpen");
      CHK.help?.init?.();
    } catch (e) { toast("Login error: " + e.message); }
  };

  // Initial screen on page load
  (async () => {
    try {
      if (token) {
        try {
          const me = await api("/api/auth/me", { method: "GET" });
          CHK.setUserProfile(me.user || null);
          if (me.user?.lang) CHK.i18n?.setLang(me.user.lang);
        } catch (_) {}
        await CHK.open?.load();
        CHK.nav.reset("screenOpen");
      } else {
        CHK.nav.reset("screenLogin");
      }
    } catch (e) {
      setToken("");
      CHK.nav.reset("screenLogin");
    }
  })();
})();
