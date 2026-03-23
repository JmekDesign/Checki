/* UI helpers (stable screen navigation + confirm + toast) */
window.CHK = window.CHK || {};

(function(){
  const CHK = window.CHK;
  const $ = (id)=>document.getElementById(id);

  const SCREENS = ["screenLogin","screenOpen","screenNew","screenCheck","screenArchive","screenVenue","screenCatalog","screenSupplies","screenNewSupply","screenSupplyDetail"];

  const toast = (msg)=>{
    const el = $("toast");
    if(!el){ console.log("TOAST:", msg); return; }
    el.textContent = String(msg ?? "");
    el.style.display = "block";
    clearTimeout(el._t);
    el._t = setTimeout(()=>{ el.style.display="none"; }, 2200);
  };

  // Single source of truth for screen + nav + bottom bar
  const show = (screen, token) => {
    try {
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
      const TAB_SCREENS = ["screenOpen", "screenArchive", "screenVenue", "screenSupplies"];
      $("tabBar")?.classList.toggle("hide", !(token && TAB_SCREENS.includes(screen)));
      $("tabOpen")?.classList.toggle("active", screen === "screenOpen");
      $("tabArchive")?.classList.toggle("active", screen === "screenArchive");
      // "+ New" button in tab bar
      $("btnNewCheck")?.classList.toggle("hide", screen !== "screenOpen");
      $("btnNewSupply")?.classList.toggle("hide", screen !== "screenSupplies");

      // Gear / venue button + Supplies tab (manager+ only)
      const profile = window.CHK?.getUserProfile?.() || null;
      const isManager = profile?.role === "manager" || profile?.role === "superadmin";
      $("btnVenue")?.classList.toggle("hide", !(token && isManager));
      $("tabSupplies")?.classList.toggle("hide", !(token && isManager));
      $("tabSupplies")?.classList.toggle("active", screen === "screenSupplies");

      // Brand name
      const brandEl = $("brandName");
      if (brandEl) {
        brandEl.textContent = (token && profile?.venue_name) ? profile.venue_name : "Checki";
      }

      // Bottom bar (check screen only)
      if (screen === "screenCheck") $("bottomBar")?.classList.remove("hide");
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

  // ── receipt helpers ──
  const _rcptEsc = (s) =>
    (s || "").toString().replace(/[&<>"']/g, (c) =>
      ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c])
    );
  const _rcptMoney = (x) => {
    const n = Number(x || 0);
    return isFinite(n) ? n.toFixed(2).replace(/\.00$/, "") : "0";
  };

  // Payment method picker — renders a paper-receipt modal.
  // Resolves "cash" | "card" | null (cancel).
  const paymentConfirm = (opts) => {
    const o     = opts || {};
    const back  = $("payBack");
    if (!back) return Promise.resolve(null);

    const num   = String(o.number  || "");
    const guest = String(o.guest   || "—");
    const total = Number(o.total   || 0);
    const items = Array.isArray(o.items) ? o.items : [];

    const now = new Date();
    const ts  = now.toLocaleDateString(undefined, { day:"numeric", month:"short" })
              + " · "
              + now.toLocaleTimeString(undefined, { hour:"2-digit", minute:"2-digit" });

    const itemsHtml = items.length
      ? items.map((it) => {
          const name = String(it.name || it.name_snapshot || "—");
          const qty  = Number(it.qty  || 1);
          const lt   = Number(it.line_total || 0);
          return `<div class="rcptRow">
            <span class="rcptName">${_rcptEsc(name)}</span>
            <span class="rcptQty">×${qty}</span>
            <span class="rcptAmt">${_rcptMoney(lt)}</span>
          </div>`;
        }).join("")
      : `<div class="rcptEmpty">Empty check</div>`;

    back.innerHTML = `
      <div class="rcptModal" role="dialog" aria-modal="true">
        <div class="rcptBrand">Checki</div>
        <div class="rcptCheckNum">#${_rcptEsc(num)}</div>
        <div class="rcptGuest">${_rcptEsc(guest)}</div>
        <div class="rcptDash"></div>
        <div class="rcptItems">${itemsHtml}</div>
        <div class="rcptDash"></div>
        <div class="rcptTotalLabel">Total</div>
        <div class="rcptTotalVal">${_rcptMoney(total)} ₾</div>
        <div class="rcptTs">${_rcptEsc(ts)}</div>
        <div class="rcptDash" style="margin-bottom:16px"></div>
        <div class="rcptPayBtns">
          <button class="rcptBtnPay" id="payCash">💵 Cash</button>
          <button class="rcptBtnPay" id="payCard">💳 Card</button>
        </div>
        <button class="rcptBtnCancel" id="payCancel">Don't close</button>
      </div>
    `;
    back.classList.remove("hide");

    return new Promise((resolve) => {
      let done = false;
      const cleanup = () => {
        if (done) return;
        done = true;
        back.classList.add("hide");
        document.removeEventListener("keydown", onKey);
      };
      const finish = (val) => { cleanup(); resolve(val); };
      const onKey  = (e) => { if (e.key === "Escape") finish(null); };

      $("payCash").onclick   = () => finish("cash");
      $("payCard").onclick   = () => finish("card");
      $("payCancel").onclick = () => finish(null);
      back.onclick = (e) => { if (e.target === back) finish(null); };
      document.addEventListener("keydown", onKey);
      setTimeout(() => { try { $("payCash").focus(); } catch (_) {} }, 0);
    });
  };

  CHK.$ = $;
  CHK.toast = toast;
  CHK.show = show;
  CHK.setAddMsg = setAddMsg;
  CHK.confirm = confirm;
  CHK.paymentConfirm = paymentConfirm;
})();
