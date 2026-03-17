/* API + auth token (shared) */
window.CHK = window.CHK || {};

(function(){
  // Keep same base as legacy app.js for now (safe refactor step)
  const API_BASE = window.CHK.API_BASE || "https://api.checki.ge";

  function getToken(){ return localStorage.getItem("checki_token") || ""; }
  function setToken(t){
    if(t) localStorage.setItem("checki_token", t);
    else localStorage.removeItem("checki_token");
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
    if(!res.ok){
      const msg = (data && (data.detail || data.error || data.message))
        ? (data.detail || data.error || data.message)
        : (res.status + " " + res.statusText);
      throw new Error(msg);
    }
    return data;
  }

  window.CHK.API_BASE = API_BASE;
  window.CHK.api = api;
  window.CHK.getToken = getToken;
  window.CHK.setToken = setToken;
})();
