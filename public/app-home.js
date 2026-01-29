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

    // ---- Optional: additional home grids managed by the editor
    // They render under the two fixed feature cards and above the 15 product tiles.
    (function renderHomeGrids(){
      const section = document.getElementById("moreGrids");
      const gridEl = document.getElementById("moreGridsGrid");
      if(!section || !gridEl) return;

      const raw = (data?.site?.homeGrids || []);
      const list = Array.isArray(raw) ? raw.filter(g => g && g.enabled !== false) : [];

      // Sort by explicit order (number) then stable by title
      list.sort((a,b) => {
        const ao = (typeof a.order === "number") ? a.order : 9999;
        const bo = (typeof b.order === "number") ? b.order : 9999;
        if(ao !== bo) return ao - bo;
        return String(a.title || "").localeCompare(String(b.title || ""), "de");
      });

      gridEl.innerHTML = "";
      if(!list.length){
        section.hidden = true;
        return;
      }
      section.hidden = false;

      for(const g of list){
        const a = document.createElement("a");
        a.className = "tile tile--wide";
        if(g.variant === "bio") a.classList.add("tile--bio");
        if(g.variant === "globe") a.classList.add("tile--globe");
        a.href = g.href || "#";
        a.setAttribute("aria-label", g.title || "Grid");
        a.innerHTML = `
          <div class="tileTop">
            <div class="emoji">${esc(g.emoji || "✨")}</div>
            <div>
              <div class="title">${esc(g.title || "")}</div>
              <div class="meta">${esc(g.subtitle || "")}</div>
            </div>
          </div>
          <div class="desc">${esc(g.desc || "")}</div>
          <div class="cta">Öffnen →</div>
        `;
        gridEl.appendChild(a);
      }
    })();

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
