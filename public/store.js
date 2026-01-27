/**
 * Hybrid Store:
 * - If hosted with backend (server.js), data is loaded/saved via /api/site
 * - Otherwise it falls back to localStorage (for offline demo)
 */
(function(){
  const STORAGE_KEY = "globale_produkte_site_shared_fallback";
  const API_URL = "/api/site";

  async function apiGet(){
    const res = await fetch(API_URL, { cache: "no-store" });
    if(!res.ok) throw new Error("apiGet failed");
    return await res.json();
  }

  async function apiPut(data, password){
    const res = await fetch(API_URL, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "x-editor-password": password || ""
      },
      body: JSON.stringify(data)
    });
    if(!res.ok){
      const msg = await res.text().catch(()=> "");
      throw new Error("apiPut failed: " + res.status + " " + msg);
    }
    return await res.json().catch(()=> ({}));
  }

  function localLoad(){
    try{
      const raw = localStorage.getItem(STORAGE_KEY);
      if(raw) return JSON.parse(raw);
    }catch(e){}
    return structuredClone(window.DEFAULT_SITE_DATA);
  }

  function localSave(data){
    try{
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    }catch(e){}
  }

  function localReset(){
    try{ localStorage.removeItem(STORAGE_KEY); }catch(e){}
  }

  // Public API
  window.SiteStore = {
    mode: "hybrid",
    load: function(){
      // synchronous legacy API used by existing code
      // -> returns last known cached copy OR defaults
      return localLoad();
    },
    save: function(data){
      localSave(data);
      // also try to save to API in background if possible (with last password)
      const pw = (window.__EDITOR_PASSWORD__ || "");
      fetch(API_URL, {
        method: "PUT",
        headers: {"Content-Type":"application/json","x-editor-password": pw},
        body: JSON.stringify(data)
      }).catch(()=>{});
    },
    reset: function(){
      localReset();
      // no API reset for safety; use server file replace if needed
    },
    // Async methods (preferred)
    loadAsync: async function(){
      try{
        const data = await apiGet();
        localSave(data);
        return data;
      }catch(e){
        return localLoad();
      }
    },
    saveAsync: async function(data, password){
      // store password for subsequent quick saves
      if(password) window.__EDITOR_PASSWORD__ = password;
      // optimistic local save
      localSave(data);
      try{
        await apiPut(data, password || window.__EDITOR_PASSWORD__ || "");
        return true;
      }catch(e){
        // keep local; user can still work offline
        console.warn(e);
        return false;
      }
    }
  };
})();