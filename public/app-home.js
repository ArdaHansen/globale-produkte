(async function () {
  function esc(s){
    return String(s).replace(/[&<>"']/g, c => ({
      '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
    }[c]));
  }

  function updateCounts(data){
    const n = (data?.tiles || []).filter(t => t.enabled !== false).length;
    document.querySelectorAll('[data-count="tiles"]').forEach(el => {
      el.textContent = String(n);
    });
  }

  function setupReveal(){
    const revealEls = document.querySelectorAll('.reveal');
    const io = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if(entry.isIntersecting){
          entry.target.classList.add('is-visible');
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12 });
    revealEls.forEach(el => io.observe(el));
  }

  async function render(){
    const data = (SiteStore.loadAsync ? await SiteStore.loadAsync() : SiteStore.load());
    updateCounts(data);

    // ✅ Wichtig: UI freischalten, sonst bleibt alles "unsichtbar"
    document.body.classList.add("is-ready");

    document.getElementById("siteTitle").textContent = data.site?.title || "EcoSupply";
    document.getElementById("siteHeadline").textContent = data.site?.title || "Globale Produkte";
    document.getElementById("siteSubtitle").textContent = data.site?.subtitle || "";

    const grid = document.getElementById("tileGrid");
    grid.innerHTML = "";

    (data.tiles || []).forEach(tile => {
      // Optional: deaktivierte komplett ausblenden
      // if(tile.enabled === false) return;

      const a = document.createElement("a");
      a.href = `page.html?id=${encodeURIComponent(tile.pageId || tile.id)}`;
      a.className = "tile" + ((tile.enabled === false) ? " tile--disabled" : "");
      a.setAttribute("data-tile-id", tile.id);

      a.innerHTML = `
        <span class="tile__tag">${(tile.enabled === false) ? "Aus" : "Aktiv"}</span>
        <span class="tile__emoji">${esc(tile.emoji || "🌿")}</span>
        <span class="tile__title">${esc(tile.title || "Feld")}</span>
        <span class="tile__origin">${esc(tile.origin || "")}</span>
        <div class="tile__short">${esc(tile.short || "")}</div>
      `;
      grid.appendChild(a);
    });

    setupReveal();
  }

  window.addEventListener("site:updated", () => render());
  render();

  // Reset (optional)
  const btn = document.getElementById("resetSiteBtn");
  if(btn){
    btn.addEventListener("click", () => {
      if(!confirm("Zurücksetzen? Alle lokalen Änderungen werden gelöscht.")) return;
      try{ SiteStore.reset(); } catch(e){}
      location.reload();
    });
  }
})();
