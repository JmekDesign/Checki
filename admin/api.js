/* API + auth token (shared) */
window.CHK = window.CHK || {};

(function(){
  const API_BASE = window.CHK.API_BASE || "https://api.checki.ge";

  function getToken(){ return localStorage.getItem("checki_token") || ""; }
  function setToken(t){
    if(t) localStorage.setItem("checki_token", t);
    else localStorage.removeItem("checki_token");
  }

  /* ── Subscription expired banner ── */
  function _showExpiredBanner() {
    if (document.getElementById("subExpiredBanner")) return;
    const el = document.createElement("div");
    el.id = "subExpiredBanner";
    el.style.cssText = [
      "position:fixed", "top:0", "left:0", "right:0", "z-index:9999",
      "background:#ff5a6a", "color:#fff", "text-align:center",
      "padding:10px 16px", "font-size:14px", "font-weight:600",
      "display:flex", "align-items:center", "justify-content:center", "gap:12px",
    ].join(";");
    el.innerHTML = `
      <span>Пробный период завершён — продлите подписку для работы</span>
      <a href="https://transfer.tbcbank.ge/?iban=GE49TB7114236010100048&amount=49&description=Checki"
         target="_blank"
         style="background:#fff;color:#ff5a6a;padding:4px 12px;border-radius:8px;font-weight:700;text-decoration:none;white-space:nowrap">
        Оплатить 49 ₾
      </a>
    `;
    document.body.prepend(el);
  }

  async function api(path, opts){
    const token = getToken();
    const headers = Object.assign(
      {"Content-Type":"application/json"},
      token ? {"Authorization": "Bearer " + token} : {}
    );
    const res = await fetch(API_BASE + path, Object.assign({headers}, opts||{}));
    const text = await res.text();
    let data = null;
    try{ data = text ? JSON.parse(text) : null; }catch(e){ data = {raw:text}; }
    if (res.status === 402) {
      _showExpiredBanner();
      throw new Error("subscription_expired");
    }
    if(!res.ok){
      const msg = (data && (data.detail || data.error || data.message))
        ? (data.detail || data.error || data.message)
        : (res.status + " " + res.statusText);
      throw new Error(msg);
    }
    return data;
  }

  function getUserProfile() {
    try { return JSON.parse(localStorage.getItem("checki_user") || "null"); } catch (_) { return null; }
  }
  function setUserProfile(u) {
    if (u) localStorage.setItem("checki_user", JSON.stringify(u));
    else localStorage.removeItem("checki_user");
  }

  async function apiFetch(path, opts) {
    const token = getToken();
    const headers = token ? { "Authorization": "Bearer " + token } : {};
    return fetch(API_BASE + path, Object.assign({ headers }, opts || {}));
  }

  window.CHK.API_BASE = API_BASE;
  window.CHK.api = api;
  window.CHK.apiFetch = apiFetch;
  window.CHK.getToken = getToken;
  window.CHK.setToken = setToken;
  window.CHK.getUserProfile = getUserProfile;
  window.CHK.setUserProfile = setUserProfile;
})();
