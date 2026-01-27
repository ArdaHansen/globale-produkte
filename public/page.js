/* renderSectionsDynamic */
(async function(){
  function getId(){
    const params = new URLSearchParams(window.location.search);
    return params.get("id") || "f01";
  }

  function esc(s){
    return String(s).replace(/[&<>"']/g, c => ({
      '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
    }[c]));
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

  function escapeHtml(str){
    return String(str)
      .replaceAll('&','&amp;')
      .replaceAll('<','&lt;')
      .replaceAll('>','&gt;')
      .replaceAll('"','&quot;');
  }

  function renderSectionsDynamic(page){
    // ✅ Render to #sections if present, otherwise #pageGrid (dein bestehendes Layout)
    const wrap =
      document.getElementById('sections') ||
      document.getElementById('pageGrid');

    if(!wrap) return;

    const secs = Array.isArray(page?.sections) ? page.sections : [];
    wrap.innerHTML = secs.map((s)=>{
      const h = (s.h||'').trim();
      const p = (s.p||'').trim();
      return `
        <section class="psection reveal">
          <h2>${escapeHtml(h)}</h2>
          <p>${escapeHtml(p).replaceAll('\\n','<br>')}</p>
        </section>
      `;
    }).join('');
  }

  async function render(){
    const data = (SiteStore.loadAsync ? await SiteStore.loadAsync() : SiteStore.load());
    const id = getId();

    // ✅ Wichtig: Seite sichtbar machen
    document.body.classList.add("is-ready");

    const page = data.pages?.[id];
    const tile = (data.tiles || []).find(t => (t.pageId || t.id) === id);

    const title = page?.title || tile?.title || "Seite";
    const hero  = page?.hero  || (tile ? `${tile.emoji||"🌿"} ${tile.title}` : "🌿 Seite");

    document.getElementById("siteTitle").textContent = data.site?.title || "EcoSupply";
    document.title = `${title} – ${data.site?.title || "EcoSupply"}`;

    document.getElementById("pageHero").textContent  = hero;
    document.getElementById("pageTitle").textContent = title;

    const introBits = [];
    if(tile?.origin) introBits.push(`Herkunft/Region: ${tile.origin}`);
    if(tile?.short)  introBits.push(tile.short);
    document.getElementById("pageIntro").textContent =
      introBits.length ? introBits.join(" • ") : "Inhalte aus dem Editor.";

    // ✅ Dynamische Abschnitte rendern
    renderSectionsDynamic(page || { sections: [] });

    // ❌ NICHT mehr grid leeren! (sonst löscht du gerade gerenderte Sections wieder)

    // Extra
    const extraBox = document.getElementById("pageExtraBox");
    const extraEl  = document.getElementById("pageExtra");
    const extra = (page?.extra || "").trim();
    if(extra){
      extraBox.hidden = false;
      extraEl.textContent = extra;
    }else{
      extraBox.hidden = true;
      extraEl.textContent = "";
    }

    setupReveal();
  }

  render();
  window.addEventListener("site:updated", () => render());
})();

