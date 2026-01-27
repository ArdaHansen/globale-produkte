/* renderSectionsDynamic */
(async function(){
  SiteStore.ensure();

  function getId(){
    const params = new URLSearchParams(window.location.search);
    return params.get("id") || "f01";
  }

  function esc(s){
    return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
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

function render(){
    function renderSectionsDynamic(page){
      const wrap = document.getElementById('sections');
      if(!wrap) return;
      const secs = Array.isArray(page.sections) ? page.sections : [];
      wrap.innerHTML = secs.map((s)=>{
        const h = (s.h||'').trim();
        const p = (s.p||'').trim();
        return `\n          <section class="psection reveal">\n            <h2>${escapeHtml(h)}</h2>\n            <p>${escapeHtml(p).replaceAll('\n','<br>')}</p>\n          </section>\n        `;
      }).join('');
    }

    const data = (SiteStore.loadAsync ? await SiteStore.loadAsync() : SiteStore.load());
    const id = getId();

    document.getElementById("siteTitle").textContent = data.site?.title || "EcoSupply";

    const page = data.pages?.[id];
    const tile = (data.tiles || []).find(t => (t.pageId || t.id) === id);

    const title = page?.title || tile?.title || "Seite";
    const hero = page?.hero || (tile ? `${tile.emoji||"🌿"} ${tile.title}` : "🌿 Seite");

    document.title = `${title} – ${data.site?.title || "EcoSupply"}`;

    document.getElementById("pageHero").textContent = hero;
    document.getElementById("pageTitle").textContent = title;

    const introBits = [];
    if(tile?.origin) introBits.push(`Herkunft/Region: ${tile.origin}`);
    if(tile?.short) introBits.push(tile.short);
    document.getElementById("pageIntro").textContent = introBits.length ? introBits.join(" • ") : "Inhalte aus dem Editor.";

    const grid = document.getElementById("pageGrid");
    grid.innerHTML = "";

    const sections = Array.isArray(page?.sections) ? page.sections : [];
    sections.slice(0,4).forEach(sec => {
      const box = document.createElement("div");
      box.className = "psection";
      box.innerHTML = `<h2>${esc(sec.h || "")}</h2><p>${esc(sec.p || "")}</p>`;
      grid.appendChild(box);
    });

    const extraBox = document.getElementById("pageExtraBox");
    const extraEl = document.getElementById("pageExtra");
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
  window.addEventListener("site:updated", render);
})();