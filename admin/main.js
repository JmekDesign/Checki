/* Loader: gradually migrate from app.js into modules without breaking behavior. */
(function(){
  const V = "20260422d"; // bump on every deploy to bust browser cache
  function load(src){
    return new Promise((resolve, reject)=>{
      const s = document.createElement("script");
      s.src = src + "?v=" + V;
      s.defer = true;
      s.onload = ()=>resolve();
      s.onerror = ()=>reject(new Error("Failed to load " + src));
      document.head.appendChild(s);
    });
  }

  function loadExt(src){
    return new Promise((resolve, reject)=>{
      const s = document.createElement("script");
      s.src = src; s.defer = true;
      s.onload = ()=>resolve();
      s.onerror = ()=>reject(new Error("Failed to load " + src));
      document.head.appendChild(s);
    });
  }

  (async ()=>{
    try{
      await loadExt("https://cdn.jsdelivr.net/npm/qr-code-styling@1.6.0-rc.1/lib/qr-code-styling.js");
      await load("./i18n.js");
      await load("./api.js");
      await load("./ui.js");
      await load("./payment.js");
      await load("./nav.js");
      await load("./archive.js");
      await load("./datepicker.js");
      await load("./venue.js");
      await load("./catalog.js");
      await load("./catalog-scan.js");
      await load("./supplies.js");
      await load("./open.js");
      await load("./check.js");
      await load("./check-form.js");
      await load("./voice.js");
      await load("./auth.js");
      await load("./password-reset.js");
      await load("./scan.js");
      await load("./help.js");
    }catch(err){
      console.error(err);
      alert(err.message);
    }
  })();
})();
