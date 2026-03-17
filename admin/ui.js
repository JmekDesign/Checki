/* UI helpers (stable screen navigation + confirm + toast) */
window.CHK = window.CHK || {};

(function(){
  const CHK = window.CHK;
  const $ = (id)=>document.getElementById(id);

  const SCREENS = ["screenLogin","screenOpen","screenNew","screenCheck","screenArchive"];

  const toast = (msg)=>{
    const el = $("toast");
    if(!el){ console.log("TOAST:", msg); return; }
    el.textContent = String(msg ?? "");
    el.style.display = "block";
    clearTimeout(el._t);
    el._t = setTimeout(()=>{ el.style.display="none"; }, 2200);
  };

  // Single source of truth for screen + header buttons + bottom bar
  const show = (screen, token)=>{
    try{
      CHK._screen = screen;

      SCREENS.forEach(id=>{
        const el = $(id);
        if(el) el.classList.add("hide");
      });

      const bottom = $("bottomBar");
      if(bottom) bottom.classList.add("hide");

      const target = $(screen);
      if(target) target.classList.remove("hide");
      else console.warn("CHK.show: unknown screen:", screen);

      const btnLogout = $("btnLogout");
      if(btnLogout) btnLogout.classList.toggle("hide", !token);

      // One button used for navigation:
      // - on Open screen -> "Archive"
      // - on Check screen -> "Open checks"
      // - on Archive screen -> "Open checks"
      const btnAll = $("btnAllChecks");
      if(btnAll){
        const visible = !!(token && (screen==="screenOpen" || screen==="screenCheck" || screen==="screenArchive"));
        btnAll.classList.toggle("hide", !visible);
        if(screen === "screenOpen") btnAll.textContent = "Archive";
        else btnAll.textContent = "Open checks";
      }

      if(screen === "screenCheck" && bottom) bottom.classList.remove("hide");
    }catch(e){
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
  CHK.show = show;
  CHK.setAddMsg = setAddMsg;
  CHK.confirm = confirm;
})();
