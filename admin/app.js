(function(){
  // Shared API/token (loaded by main.js -> api.js)
  const api = (window.CHK && window.CHK.api) ? window.CHK.api : null;
  const getToken = (window.CHK && window.CHK.getToken) ? window.CHK.getToken : (()=>"");
  const setTokenStore = (window.CHK && window.CHK.setToken) ? window.CHK.setToken : (()=>{});

  let token = getToken() || "";
  let openChecks = [];
  let currentCheckId = null;
  let currentCheck = null;

  let qty = 1;
  let selectedProductId = null;
  let selectedProductName = null;
  let selectedProductPrice = null;
  let suggestTimer = null;
  const $ = (window.CHK && window.CHK.$) ? window.CHK.$ : ((id)=>document.getElementById(id));
  const toast = (window.CHK && window.CHK.toast) ? window.CHK.toast : ((msg)=>console.log(msg));
  const chkConfirm = (window.CHK && window.CHK.confirm) ? window.CHK.confirm : (async (o)=>window.confirm((typeof o==="string") ? o : String((o && (o.text || o.title)) || "Are you sure?")));
  const chkPayConfirm = (opts) => (window.CHK && window.CHK.paymentConfirm) ? window.CHK.paymentConfirm(opts) : Promise.resolve(null);
  const setAddMsg = (window.CHK && window.CHK.setAddMsg) ? window.CHK.setAddMsg : (()=>{});
  const show = (screen)=>{ const fn = (window.CHK && window.CHK.show) ? window.CHK.show : null; if(fn) return fn(screen, token); };
  const setToken = (t)=>{
    token = t || "";
    setTokenStore(token);
    $("btnLogout").classList.toggle("hide", !token);
  };
  setToken(token);

  $("btnLogout").onclick = ()=>{
    setToken("");
    if(window.CHK.setUserProfile) window.CHK.setUserProfile(null);
    currentCheckId=null; currentCheck=null;
    show("screenLogin");
    toast("Logged out");
  };

  // Tab navigation
  const tabOpen = $("tabOpen");
  if(tabOpen) tabOpen.onclick = async ()=>{
    currentCheckId=null; currentCheck=null;
    await loadOpen().catch(()=>{});
    show("screenOpen", token);
  };

  const tabArchive = $("tabArchive");
  if(tabArchive) tabArchive.onclick = async ()=>{
    show("screenArchive", token);
    try{
      if(window.CHK?.archive) await window.CHK.archive.load();
    }catch(e){ toast("Archive: " + e.message); }
  };

  // Back from check detail → open checks (without closing)
  const btnBackFromCheck = $("btnBackFromCheck");
  if(btnBackFromCheck) btnBackFromCheck.onclick = async ()=>{
    currentCheckId=null; currentCheck=null;
    await loadOpen().catch(()=>{});
    show("screenOpen", token);
  };

  $("btnLogin").onclick = async ()=>{
    try{
      const login = $("login").value.trim();
      const password = $("password").value.trim();
      const r = await api("/api/auth/login", {method:"POST", body:JSON.stringify({login, password})});
      setToken(r.token);
      if(r.user && window.CHK.setUserProfile) window.CHK.setUserProfile(r.user);
      toast("OK");
      await loadOpen();
      show("screenOpen", r.token);
    }catch(e){ toast("Login error: " + e.message); }
  };

  const btnVenue = $("btnVenue");
  if(btnVenue) btnVenue.onclick = async ()=>{
    show("screenVenue", token);
    try{
      if(window.CHK && window.CHK.venue) await window.CHK.venue.load();
    }catch(e){ toast("Venue: " + e.message); }
  };

  $("btnNewCheck").onclick = ()=>{ $("guestName").value=""; show("screenNew"); $("guestName").focus(); };
  $("btnBackOpen").onclick = ()=>show("screenOpen");
  $("openSearch").oninput = ()=>renderOpen();

  async function loadOpen(){
    const r = await api("/api/checks/open", {method:"GET"});
    openChecks = Array.isArray(r) ? r : (r.checks || r.items || []);
    renderOpen();
  }

  function renderOpen(){
    const q = ($("openSearch").value||"").trim().toLowerCase();
    const list = $("openList");
    list.innerHTML = "";

    const filtered = openChecks.filter(c=>{
      const num = (c.number ?? c.check_number ?? c.id ?? "").toString().toLowerCase();
      const g = (c.guest_name_snapshot ?? c.guest ?? c.guest_name ?? "").toString().toLowerCase();
      return !q || num.includes(q) || g.includes(q);
    });

    if(filtered.length===0){
      $("openHint").textContent = "No open checks. Create a new check.";
      return;
    }
    $("openHint").textContent = "";

    filtered.forEach(c=>{
      const num = c.number ?? c.check_number ?? "";
      const guest = c.guest_name_snapshot ?? c.guest ?? c.guest_name ?? "—";
      const total = Number(c.total ?? c.check_total ?? c.total_amount ?? 0);
      const totalText = Number.isFinite(total) && total > 0 ? `${fmtMoney(total)} ₾` : "";
      const timeStr = c.opened_at
        ? new Date(c.opened_at).toLocaleTimeString(undefined, {hour:"2-digit", minute:"2-digit"})
        : "";
      const el = document.createElement("div");
      el.className = "item";
      el.style.cssText = "cursor:pointer; display:flex; align-items:center; gap:10px";
      el.innerHTML = `
        <div class="lineLeft" style="flex:1;min-width:0">
          <div class="lineTitle"><b>#${escapeHtml(num)} · ${escapeHtml(guest)}</b></div>
          <div class="lineMeta">
            <span>${escapeHtml(timeStr)}</span>
            ${totalText ? `<span style="font-weight:700;color:var(--text)">${escapeHtml(totalText)}</span>` : ""}
          </div>
        </div>
        <button class="btn compact danger" style="flex:none;white-space:nowrap">Close</button>
      `;
      const closeBtn = el.querySelector("button");
      closeBtn.onclick = async (e)=>{ e.stopPropagation(); await closeCheckInline(c); };
      el.onclick = ()=>openCheck(c.id || c.check_id);
      list.appendChild(el);
    });
  }

  async function closeCheckInline(c) {
    const id    = c.id || c.check_id;
    const num   = c.number ?? c.check_number ?? "";
    const guest = c.guest_name_snapshot ?? c.guest ?? c.guest_name ?? "—";
    let total   = Number(c.total ?? c.check_total ?? c.total_amount ?? 0);
    let items   = [];
    // Fetch full check to show items in receipt
    try {
      const r = await api(`/api/checks/${id}`, {method:"GET"});
      const chk = r.check || r;
      total = Number(chk.total ?? total);
      items = chk.items || chk.lines || [];
    } catch(_) {}
    const method = await chkPayConfirm({ number: num, guest, total, items });
    if (method === null) return;
    try {
      await api(`/api/checks/${id}/close`, { method:"POST", body:JSON.stringify({ payment_method: method }) });
      toast("Check closed");
      await loadOpen().catch(()=>{});
    } catch(e) { toast("Close error: " + e.message); }
  }

  $("btnCreateCheck").onclick = async ()=>{
    try{
      const guest = $("guestName").value.trim();
      if(!guest) return toast("Enter guest / table");
      const r = await api("/api/checks", {method:"POST", body:JSON.stringify({guest})});
      const id = r.id || r.check_id;
      toast("Check opened");
      await openCheck(id);
    }catch(e){ toast("Create error: " + e.message); }
  };

  $("btnCloseCheck").onclick = async ()=>{
    if(!currentCheckId) return;
    const num   = currentCheck ? (currentCheck.number ?? "") : "";
    const guest = currentCheck ? (currentCheck.guest_name_snapshot ?? "—") : "—";
    const total = currentCheck ? Number(currentCheck.total ?? 0) : 0;
    const items = currentCheck ? (currentCheck.items || []) : [];
    const method = await chkPayConfirm({ number: num, guest, total, items });
    if(method === null) return;
    try{
      await api(`/api/checks/${currentCheckId}/close`, {
        method:"POST",
        body: JSON.stringify({ payment_method: method }),
      });
      toast("Check closed");
      currentCheckId=null; currentCheck=null;
      await loadOpen().catch(()=>{});
      show("screenOpen");
    }catch(e){ toast("Close error: " + e.message); }
  };

  async function openCheck(id){
    currentCheckId = id;
    await loadCheck();
    show("screenCheck", token);
    resetAddForm();
  }

  window.CHK.openCheck = openCheck;

  async function loadCheck(){
    const r = await api(`/api/checks/${currentCheckId}`, {method:"GET"});
    currentCheck = r.check || r;
    renderCheck();
  }

  function renderCheck(){
    const num = currentCheck.number ?? currentCheck.check_number ?? "";
    const guest = currentCheck.guest_name_snapshot ?? currentCheck.guest ?? currentCheck.guest_name ?? "—";
    const total = (currentCheck.total ?? 0);
    $("checkTitle").textContent = `Check #${num}`;
    $("checkMeta").textContent = guest;
    $("checkTotal").textContent = `${fmtMoney(total)} ₾`;

    const items = currentCheck.items || currentCheck.lines || [];
    const list = $("itemsList");
    list.innerHTML = "";

    if(!items.length){
      $("itemsHint").textContent = "Empty. Add items below.";
    } else {
      $("itemsHint").textContent = "";
    }

    items.forEach(it=>{
      const itemId = it.id;
      const name = it.name_snapshot ?? it.name ?? "—";
      const q = Number(it.qty ?? it.quantity ?? 1);
      const price = Number(it.price_snapshot ?? it.price ?? 0);
      const lt = Number(it.line_total ?? (price*q));

      const category = it.category || "";
      const el = document.createElement("div");
      el.className = "item";
      el.setAttribute("data-item-id", String(itemId));
      el.innerHTML = `
        <div class="lineLeft">
          <div class="lineTitle"><b>${escapeHtml(name)}</b></div>
          <div class="lineMeta">
            <span>${escapeHtml(String(q))}</span>
            <span>×</span>
            <span>${escapeHtml(fmtMoney(price))} ₾</span>
            ${category && category !== "Other" ? `<span class="muted" style="font-size:11px">${escapeHtml(category)}</span>` : ""}
          </div>
        </div>

        <div class="lineRight">
          <div class="lineTotal">${escapeHtml(fmtMoney(lt))} ₾</div>
          <div class="qtyCtl" title="Adjust quantity">
            <button class="btn" data-act="dec">–</button>
            <strong style="min-width:16px;text-align:center;display:inline-block">${escapeHtml(String(q))}</strong>
            <button class="btn" data-act="inc">+</button>
          </div>
        </div>
      `;

      const decBtn = el.querySelector('[data-act="dec"]');
      const incBtn = el.querySelector('[data-act="inc"]');

      decBtn.onclick = async ()=>{
        try{
          let didRemove = false;
          if(q === 1){
            if(!(await chkConfirm({title:"Remove item", text:`Remove "${name}" from check?`, okText:"Remove", cancelText:"Cancel", danger:true}))) return;
            didRemove = true;
          }
          await api(`/api/checks/${currentCheckId}/items/${itemId}/qty?delta=-1`, {method:"POST"});
          await loadCheck();
          if(didRemove) toast(`Removed "${name}"`);
          else flashItemRow(itemId);
        }catch(e){ toast("Qty: " + e.message); }
      };
      incBtn.onclick = async ()=>{
        try{
          await api(`/api/checks/${currentCheckId}/items/${itemId}/qty?delta=1`, {method:"POST"});
          await loadCheck();
          flashItemRow(itemId);
        }catch(e){ toast("Qty: " + e.message); }
      };

      list.appendChild(el);
    });

    /* Small spacer (about 1 row), so last item can scroll above bottom bar */
    const spacer = document.createElement("div");
    spacer.style.height = "70px";
    list.appendChild(spacer);
  }

  function resetAddForm(){
    qty = 1;
    selectedProductId = null;
    selectedProductPrice = null;
    selectedProductName = null;

    $("qtyVal").textContent = "1";
    $("itemName").value = "";
    $("itemPrice").value = "";
    $("itemTotal").value = "";
    hideSuggest();    renderQuickChips();
    recalcAddTotal();
    updateAddButtonState();
  }

  $("btnQtyDec").onclick = ()=>{ qty = Math.max(1, qty-1); $("qtyVal").textContent = String(qty); recalcAddTotal(); updateAddButtonState(); };
  $("btnQtyInc").onclick = ()=>{ qty = Math.min(99, qty+1); $("qtyVal").textContent = String(qty); recalcAddTotal(); updateAddButtonState(); };

  function renderQuickChips(){
    const chips = $("quickChips");
    chips.innerHTML = "";
    const top = ["Beer","Hoegaarden","Negroni","Jerky","Saperavi"];
    top.forEach(x=>{
      const c = document.createElement("div");
      c.className = "chip";
      c.textContent = x;
      c.onclick = ()=>{
        // No focus (no keyboard). Just set value and let autocomplete kick in.
        $("itemName").value = x;
        $("itemName").dispatchEvent(new Event("input"));
      };
      chips.appendChild(c);
    });
  }

  function showSuggest(){ $("suggestBox").style.display = "block"; }
  function hideSuggest(){ $("suggestBox").style.display = "none"; $("suggestBox").innerHTML = ""; }

  function updateAddButtonState(){
    const name = $("itemName").value.trim();
    const priceStr = $("itemPrice").value.trim();
    const btn = $("btnAddItem");
    const priceEl = $("itemPrice");

    if(!name){
      btn.disabled = true;      return;
    }

    // If selected catalog item and it has price OR user typed a price override -> OK
    if(selectedProductId){
      const hasCatalogPrice = (selectedProductPrice !== null && selectedProductPrice !== undefined);
      const typed = parseNum(priceStr);
      if(hasCatalogPrice || typed !== null){
        btn.disabled = false;        return;
      }
      // Catalog item without price -> require price once
      btn.disabled = true;      return;
    }

    // No selected product -> require price
    const p = parseNum(priceStr);
    if(p === null){
      btn.disabled = true;      return;
    }

    btn.disabled = false;  }

  $("itemName").addEventListener("input", ()=>{
    selectedProductId = null;
    selectedProductPrice = null;
    selectedProductName = null;

    // user changed the name -> clear price if it was auto-filled
    // (we will auto-fill again on exact match)
    $("itemPrice").value = "";
    hideSuggest();    const q = $("itemName").value.trim();
    if(suggestTimer) clearTimeout(suggestTimer);
    suggestTimer = setTimeout(()=>loadSuggest(q), 140);

    recalcAddTotal();
    updateAddButtonState();
  });

  $("itemName").addEventListener("keydown",(e)=>{
    if(e.key==="Escape"){ hideSuggest(); }
  });

  $("itemPrice").addEventListener("input", ()=>{ recalcAddTotal(); updateAddButtonState(); });
  $("itemPrice").addEventListener("keydown",(e)=>{
    if(e.key==="Enter"){ e.preventDefault(); addItem(); }
    if(e.key==="Escape"){ hideSuggest(); }
  });

  async function loadSuggest(q){
    hideSuggest();    if(!q) { updateAddButtonState(); return; }

    try{
      const r = await api(`/api/products?q=${encodeURIComponent(q)}&limit=20&active_only=true`, {method:"GET"});
      const items = r.items || [];

            // Nothing found -> treat as new item. No suggestions.
      if(!items.length){
        hideSuggest();
        updateAddButtonState();
        return;
      }

      const qn = q.toLowerCase();
      const exact = items.find(p => (p.name||"").trim().toLowerCase() === qn);

      // Exact match: auto-select and auto-fill price, no clicking required.
      if(exact){
        selectedProductId = exact.id;
        selectedProductName = exact.name;
        selectedProductPrice = exact.last_price;

        if(exact.last_price!==null && exact.last_price!==undefined){
          $("itemPrice").value = fmtMoney(exact.last_price);
        } else {
          $("itemPrice").value = "";
        }
        recalcAddTotal();
        updateAddButtonState();

        // If exact match has no price -> focus price and show message
        if(exact.last_price===null || exact.last_price===undefined){        }
        return;
      }

      // Not exact -> show suggestions (tap to select)
      showSuggest();
      const box = $("suggestBox");
      items.forEach(p=>{
        const row = document.createElement("div");
        row.className = "suggestItem";
        const pr = (p.last_price===null || p.last_price===undefined) ? "—" : (fmtMoney(p.last_price) + " ₾");
        row.innerHTML = `
          <div style="min-width:0">
            <b>${escapeHtml(p.name)}</b>
            <div><small>${escapeHtml(p.category || "Other")}</small></div>
          </div>
          <div class="kbd">${escapeHtml(pr)}</div>
        `;
        row.onclick = ()=>{
          selectedProductId = p.id;
          selectedProductName = p.name;
          selectedProductPrice = p.last_price;

          $("itemName").value = p.name;
          if(p.last_price!==null && p.last_price!==undefined){
            $("itemPrice").value = fmtMoney(p.last_price);
          } else {
            $("itemPrice").value = "";
          }
          hideSuggest();
          recalcAddTotal();
          updateAddButtonState();

          if(p.last_price===null || p.last_price===undefined){          }
        };
        box.appendChild(row);
      });

      updateAddButtonState();
    }catch(e){
      hideSuggest();
      updateAddButtonState();
      toast("Search: " + e.message);
    }
  }

  $("btnAddItem").onclick = ()=>addItem();

  async function addItem(){
    if(!currentCheckId) return;

    const name = $("itemName").value.trim();
    const priceStr = $("itemPrice").value.trim();
    if(!name) return toast("Enter item");

    if($("btnAddItem").disabled){
      // keep it silent-ish, but still feedback:
      return toast("Add disabled: price required for new item");
    }

    try{
      // Merge stability: if product exists but wasn't auto-selected, resolve exact match by name
      if(!selectedProductId){
        try{
          const rr = await api(`/api/products?q=${encodeURIComponent(name)}&limit=20`, {method:"GET"});
          const items0 = (rr && rr.items) ? rr.items : [];
          const qn0 = name.toLowerCase();
          const matches = items0.filter(p => ((p.name||"").trim().toLowerCase() === qn0));
          if(matches.length){
            matches.sort((a,b)=>(Number(b.id)||0)-(Number(a.id)||0)); // newest wins
            const p0 = matches[0];
            selectedProductId = p0.id;
            selectedProductName = p0.name;
            selectedProductPrice = p0.last_price;
          }
        }catch(e){}
      }

      if(selectedProductId){
        const body = { product_id: selectedProductId, qty: qty };
        const maybe = parseNum(priceStr);
        if(maybe !== null) body.price = maybe;
        const changedId = await addItemAndReturnItemId(body);
        toast("Added");
        resetAddForm();
        await loadCheck();
        flashItemRow(changedId);
        return;
      }

      const price = parseNum(priceStr);
      if(price === null){
        return toast("Price required for new item");
      }
      const changedId = await addItemAndReturnItemId({ name, price, qty });
      toast("Added & saved");
      resetAddForm();
      await loadCheck();
      flashItemRow(changedId);
    }catch(e){
      toast("Add: " + e.message);
    }
  }

  function parseNum(s){
    if(!s) return null;
    const t = s.replace(",", ".").replace(/[^\d.]/g,"");
    if(!t) return null;
    const n = Number(t);
    if(!isFinite(n)) return null;
    return n;
  }

  function recalcAddTotal(){
    const p = parseNum($("itemPrice").value.trim());
    if(p === null){ $("itemTotal").value = ""; return; }
    $("itemTotal").value = fmtMoney(p * qty) + " ₾";
  }

  function fmtMoney(x){
    const n = Number(x||0);
    if(!isFinite(n)) return "0";
    return n.toFixed(2).replace(/\.00$/,"");
  }

  
  function flashItemRow(itemId){
    if(!itemId) return;
    const el = document.querySelector(`[data-item-id="${itemId}"]`);
    if(!el) return;
    el.classList.remove("flashRow"); // restart animation
    void el.offsetWidth;
    el.classList.add("flashRow");
    setTimeout(()=>{ try{ el.classList.remove("flashRow"); }catch(e){} }, 950);
  }

  async function addItemAndReturnItemId(body){
    // returns item_id if backend provided it
    const r = await api(`/api/checks/${currentCheckId}/items/add`, { method:"POST", body: JSON.stringify(body) });
    return r.item_id || r.id || null;
  }


  function escapeHtml(s){
    return (s||"").toString().replace(/[&<>"']/g, (c)=>({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c]));
  }

  (async ()=>{
    try{
      if(token){
        // Refresh profile from server so venue_name is always current
        try{
          const me = await api("/api/auth/me", {method:"GET"});
          if(me.user && window.CHK.setUserProfile) window.CHK.setUserProfile(me.user);
        }catch(_){}
        await loadOpen();
        show("screenOpen", token);
      } else {
        show("screenLogin");
      }
    }catch(e){
      setToken("");
      show("screenLogin");
    }
  })();
})();

// === ARCHIVE READONLY PATCH (AUTO) ===
(function(){
  const CHK = (window.CHK = window.CHK || {});

  function _getToken(){
    try{ return (typeof CHK.getToken === "function") ? CHK.getToken() : ""; }catch(e){ return ""; }
  }

  async function _gotoArchive(){
    try{ document.body.classList.remove("chk-readonly"); }catch(e){}
    CHK._checkReadonly = false;
    if(typeof CHK.show === "function") CHK.show("screenArchive", _getToken());
    try{
      // Use reload (keeps current filters) instead of load (resets to "week")
      const fn = CHK.archive?.reload ?? CHK.archive?.load;
      if(typeof fn === "function") await fn();
    }catch(e){
      if(typeof CHK.toast === "function") CHK.toast("Archive: " + (e && e.message ? e.message : String(e)));
    }
  }

  function setReadonly(on){
    CHK._checkReadonly = !!on;
    try{
      if(document.body) document.body.classList.toggle("chk-readonly", !!on);
    }catch(e){}

    const btnClose = document.getElementById("btnCloseCheck");
    if(btnClose){
      if(on){
        // Replace Close with Back -> Archive
        btnClose.disabled = false;
        btnClose.classList.remove("danger");
        btnClose.textContent = "← Back";
        btnClose.onclick = async ()=>{ await _gotoArchive(); };
      }else{
        // when opening a normal (non-archive) check, app.js will set correct handler itself
        try{ btnClose.classList.add("danger"); }catch(e){}
        // do not force text/onclick here to avoid fighting legacy logic
      }
    }

    // bottom bar is hidden by CSS in .chk-readonly
  }

  // Block any action clicks in readonly (delete item buttons etc.)
  if(!CHK.__roClickBlocker){
    document.addEventListener("click", (e)=>{
      try{
        if(!(document.body && document.body.classList.contains("chk-readonly"))) return;
        const t = e.target;

        // Block clicks inside items list on buttons/controls
        if(t && t.closest && t.closest("#itemsList") && t.closest("button")){
          e.preventDefault();
          e.stopPropagation();
          if(typeof CHK.toast === "function") CHK.toast("Read-only");
          return;
        }
        // Block bottom bar entirely (safety)
        if(t && t.closest && t.closest("#bottomBar")){
          e.preventDefault();
          e.stopPropagation();
          if(typeof CHK.toast === "function") CHK.toast("Read-only");
          return;
        }
      }catch(_){}
    }, true);
    CHK.__roClickBlocker = true;
  }

  // Wrap openCheck to accept opts {readonly:true}
  if(!CHK.__openCheckWrapped && typeof CHK.openCheck === "function"){
    const orig = CHK.openCheck;
    CHK.openCheck = async (id, opts)=>{
      const o = opts || {};
      await orig(id);
      setReadonly(!!o.readonly);
    };
    CHK.__openCheckWrapped = true;
  }

  CHK.setReadonly = setReadonly;
})();
// === /ARCHIVE READONLY PATCH (AUTO) ===

