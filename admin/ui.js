/* UI helpers (stable screen navigation + confirm + toast) */
window.CHK = window.CHK || {};

(function(){
  const CHK = window.CHK;
  const $ = (id)=>document.getElementById(id);

  const SCREENS = ["screenLogin","screenForgot","screenReset","screenOpen","screenNew","screenCheck","screenArchive","screenVenue","screenCatalog","screenSupplies","screenNewSupply","screenSupplyDetail"];

  const toast = (msg)=>{
    const el = $("toast");
    if(!el){ console.log("TOAST:", msg); return; }
    el.textContent = String(msg ?? "");
    el.style.display = "block";
    clearTimeout(el._t);
    el._t = setTimeout(()=>{ el.style.display="none"; }, 2200);
  };

  // Single source of truth for screen + nav + bottom bar
  const show = (screen) => {
    try {
      const token = CHK.getToken?.() || "";
      CHK._screen = screen;

      // Hide all screens + bottom bar
      SCREENS.forEach(id => $(id)?.classList.add("hide"));
      $("bottomBar")?.classList.add("hide");

      // Show target screen
      const target = $(screen);
      if (target) target.classList.remove("hide");
      else console.warn("CHK.show: unknown screen:", screen);

      // Logout
      $("btnLogout")?.classList.toggle("hide", !token);

      // Tab bar: visible on main screens
      const TAB_SCREENS = ["screenOpen", "screenArchive"];
      $("tabBar")?.classList.toggle("hide", !(token && TAB_SCREENS.includes(screen)));
      $("tabOpen")?.classList.toggle("active", screen === "screenOpen");
      $("tabArchive")?.classList.toggle("active", screen === "screenArchive");
      $("btnNewCheck")?.classList.toggle("hide", screen !== "screenOpen");

      // Gear / venue button + Supplies tab (manager+ only)
      const profile = window.CHK?.getUserProfile?.() || null;
      const isManager = profile?.role === "manager" || profile?.role === "superadmin";
      $("btnVenue")?.classList.toggle("hide", !(token && isManager));

      // Brand name
      const brandEl = $("brandName");
      if (brandEl) {
        brandEl.textContent = (token && profile?.venue_name) ? profile.venue_name : "Checki";
      }

      // Bottom bar (check screen only)
      if (screen === "screenCheck") {
        $("bottomBar")?.classList.remove("hide");
      } else {
        // Always clear readonly state when leaving check screen
        document.body.classList.remove("chk-readonly");
        if (window.CHK) window.CHK._checkReadonly = false;
      }
    } catch (e) {
      console.error("CHK.show failed:", e);
    }
  };

  const setAddMsg = (msg)=>{
    const el = $("addMsg");
    if(!el) return;
    if(!msg){
      el.textContent = "";
      el.classList.add("hide");
      return;
    }
    el.textContent = msg;
    el.classList.remove("hide");
  };

  // Custom confirm modal (async)
  let _confirmBusy = false;

  const confirm = (opts)=>{
    const o = (typeof opts === "string") ? { text: opts } : (opts || {});
    const title = String(o.title ?? "Confirm");
    const text = String(o.text ?? "");
    const okText = String(o.okText ?? "OK");
    const cancelText = String(o.cancelText ?? "Cancel");
    const danger = !!o.danger;

    const back = $("confirmBack");
    const elTitle = $("confirmTitle");
    const elText = $("confirmText");
    const btnOk = $("confirmOk");
    const btnCancel = $("confirmCancel");

    if(!back || !btnOk || !btnCancel || !elTitle || !elText){
      return Promise.resolve(window.confirm(text || title));
    }
    if(_confirmBusy) return Promise.resolve(false);
    _confirmBusy = true;

    elTitle.textContent = title;
    elText.textContent = text;
    btnOk.textContent = okText;
    btnCancel.textContent = cancelText;

    btnOk.classList.toggle("danger", danger);
    btnOk.classList.toggle("primary", !danger);

    back.classList.remove("hide");

    return new Promise((resolve)=>{
      let done = false;

      const cleanup = ()=>{
        if(done) return;
        done = true;
        _confirmBusy = false;
        back.classList.add("hide");
        btnOk.onclick = null;
        btnCancel.onclick = null;
        back.onclick = null;
        document.removeEventListener("keydown", onKey);
      };

      const finish = (val)=>{
        cleanup();
        resolve(!!val);
      };

      const onKey = (e)=>{
        if(e.key === "Escape") finish(false);
        if(e.key === "Enter") finish(true);
      };

      btnOk.onclick = ()=>finish(true);
      btnCancel.onclick = ()=>finish(false);

      back.onclick = (e)=>{
        if(e.target === back) finish(false);
      };

      document.addEventListener("keydown", onKey);

      setTimeout(()=>{
        try{ (danger ? btnCancel : btnOk).focus(); }catch(_){}
      }, 0);
    });
  };

  CHK.$ = $;
  CHK.toast = toast;
  CHK._show = show;
  CHK.show = show; // backwards compat alias
  CHK.setAddMsg = setAddMsg;
  CHK.confirm = confirm;
})();
