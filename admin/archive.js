/* Archive module (closed checks) */
window.CHK = window.CHK || {};

(function(){
  const CHK = window.CHK;

  const api = (...args)=>{
    if(typeof CHK.api !== "function") throw new Error("CHK.api not ready");
    return CHK.api(...args);
  };
  const $ = (id)=> (typeof CHK.$ === "function" ? CHK.$(id) : document.getElementById(id));
  const toast = (m)=> (typeof CHK.toast === "function" ? CHK.toast(m) : console.log(m));

  let limit = 20;
  let offset = 0;
  let total = 0;
  let items = [];

  function fmtMoney(x){
    const n = Number(x||0);
    if(!isFinite(n)) return "0";
    return n.toFixed(2).replace(/\.00$/,"");
  }
  function escapeHtml(s){
    return (s||"").toString().replace(/[&<>"']/g, (c)=>({ "&":"&amp;","<":"&lt;",">":"&gt;", "\"":"&quot;","'":"&#39;" }[c]));
  }

  function qs(){
    const q = ($("archSearch")?.value || "").trim();
    const from = ($("archFrom")?.value || "").trim();
    const to = ($("archTo")?.value || "").trim();
    const p = new URLSearchParams();
    p.set("limit", String(limit));
    p.set("offset", String(offset));
    if(q) p.set("q", q);
    if(from) p.set("from", from);
    if(to) p.set("to", to);
    return "?" + p.toString();
  }

  async function load(){
    const r = await api("/api/checks/archive" + qs(), {method:"GET"});
    items = Array.isArray(r.items) ? r.items : [];
    total = Number(r.total ?? items.length ?? 0);
    limit = Number(r.limit ?? limit);
    offset = Number(r.offset ?? offset);
    render();
  }

  function render(){
    const list = $("archList");
    const hint = $("archHint");
    const pager = $("archPager");
    const prev = $("btnArchPrev");
    const next = $("btnArchNext");

    if(!list) return;
    list.innerHTML = "";

    if(!items.length){
      if(hint) hint.textContent = "No closed checks for this filter.";
    } else {
      if(hint) hint.textContent = "";
    }

    items.forEach(c=>{
      const id = c.id || c.check_id;
      const num = (c.number ?? "").toString();
      const guest = c.guest_name_snapshot ?? "—";
      const total0 = Number(c.total ?? 0);
      const closed = c.closed_at ? new Date(c.closed_at).toLocaleString() : "";
      const pay = c.payment_method ? String(c.payment_method) : "";

      const el = document.createElement("div");
      el.className = "item archItem";
      el.style.cursor = "pointer";
      el.innerHTML = `
        <div style="min-width:0">
          <b>#${escapeHtml(num)} • ${escapeHtml(guest)}</b>
          <div><small>${escapeHtml(closed)} ${pay ? "• " + escapeHtml(pay) : ""}</small></div>
        </div>
        <div class="lineTotal">${escapeHtml(fmtMoney(total0))} ₾</div>
      `;
      el.onclick = ()=>{
        if(typeof CHK.openCheck === "function"){
          CHK.openCheck(id, { readonly:true, backTo:"archive" });
        } else {
          toast("Open check is not ready yet");
        }
      };
      list.appendChild(el);
    });

    const from = offset + 1;
    const to = Math.min(offset + limit, total || (offset + items.length));
    if(pager) pager.textContent = (total ? `${from}-${to} of ${total}` : `${from}-${to}`);

    if(prev) prev.disabled = (offset <= 0);
    if(next) next.disabled = (total ? (offset + limit >= total) : (items.length < limit));
  }

  function bind(){
    const back = $("btnBackOpenFromArchive");
    const apply = $("btnArchApply");
    const prev = $("btnArchPrev");
    const next = $("btnArchNext");
    const search = $("archSearch");

    if(back) back.onclick = async ()=>{
      try{ document.body.classList.remove("chk-readonly"); }catch(e){}
      if(typeof CHK.show === "function") CHK.show("screenOpen", (typeof CHK.getToken==="function" ? CHK.getToken() : ""));
      // open checks list reload is handled by app.js normally; do not force here
    };

    if(apply) apply.onclick = async ()=>{ offset = 0; await load().catch(e=>toast("Archive: " + (e.message||e))); };
    if(prev) prev.onclick = async ()=>{ offset = Math.max(0, offset - limit); await load().catch(e=>toast("Archive: " + (e.message||e))); };
    if(next) next.onclick = async ()=>{ offset = offset + limit; await load().catch(e=>toast("Archive: " + (e.message||e))); };

    if(search){
      let t = null;
      search.addEventListener("input", ()=>{
        if(t) clearTimeout(t);
        t = setTimeout(async ()=>{
          offset = 0;
          await load().catch(e=>toast("Archive: " + (e.message||e)));
        }, 250);
      });
    }
  }

  function init(){
    try{ bind(); }catch(e){}
  }

  // IMPORTANT: script is loaded dynamically; DOMContentLoaded may have already fired
  if(document.readyState === "loading"){
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  CHK.archive = CHK.archive || {};
  CHK.archive.load = async ()=>{ await load(); };
})();
