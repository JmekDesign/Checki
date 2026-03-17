/* Loader: gradually migrate from app.js into modules without breaking behavior. */
(function(){
  function load(src){
    return new Promise((resolve, reject)=>{
      const s = document.createElement("script");
      s.src = src;
      s.defer = true;
      s.onload = ()=>resolve();
      s.onerror = ()=>reject(new Error("Failed to load " + src));
      document.head.appendChild(s);
    });
  }

  (async ()=>{
    try{
      await load("./api.js");
      await load("./ui.js");
      await load("./archive.js");
      await load("./app.js"); // legacy (will be removed gradually)
    }catch(err){
      console.error(err);
      alert(err.message);
    }
  })();
})();
