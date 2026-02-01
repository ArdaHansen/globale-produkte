/*
  Biosiegel Page (UI + Render)
  - Data is stored inside the site JSON loaded via SiteStore (backend preferred)
  - Field: data.bioSeals (Array)
  - bio-editor.js provides editing UI and calls window.BioSeals.setSeals(...)
*/
(function () {
  const timelineEl = document.getElementById("bioTimeline");
  const gridEl = document.getElementById("bioGrid");

  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function safeText(s) {
    return (s || "").replace(/[&<>"']/g, (m) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    }[m]));
  }

  function defaultSeals() {
    return [
      {
        id: "eu-bio",
        title: "EU‑Bio‑Logo",
        year: 2010,
        strictness: 3,
        verdict: "Basis-Standard",
        short: "Pflichtkennzeichen für vorverpackte Bio‑Lebensmittel in der EU (mind. 95% Bio‑Zutaten).",
        points: [
          "EU‑Öko‑Verordnung (Mindeststandard)",
          "mind. 95% Zutaten aus ökologischem Landbau",
          "Kontrollstellen prüfen regelmäßig"
        ],
        image: "./bioseals/eu-bio.svg",
        sourceLinks: [
          { label: "WWF: Siegel erklärt", url: "https://www.wwf.de/aktiv-werden/tipps-fuer-den-alltag/tipps-fuer-ernaehrung-und-einkauf/was-bedeutet-welches-siegel" },
          { label: "UBA: Organic farming", url: "https://www.umweltbundesamt.de/en/topics/agriculture/toward-ecofriendly-farming/organic-farming" }
        ],
        enabled: true
      },
      {
        id: "de-bio",
        title: "Deutsches Bio‑Siegel",
        year: 2001,
        strictness: 3,
        verdict: "Wie EU‑Bio",
        short: "Deutsches Markenzeichen – inhaltlich gleich zu EU‑Bio (keine extra strengeren Regeln).",
        points: [
          "Freiwillig nutzbar, aber EU‑Bio‑Zertifizierung nötig",
          "Erhöht Wiedererkennung im Handel",
          "Keine strengeren Anforderungen als EU‑Bio"
        ],
        image: "./bioseals/de-bio.svg",
        sourceLinks: [
          { label: "WWF: Siegel erklärt", url: "https://www.wwf.de/aktiv-werden/tipps-fuer-den-alltag/tipps-fuer-ernaehrung-und-einkauf/was-bedeutet-welches-siegel" },
          { label: "UBA: Organic farming", url: "https://www.umweltbundesamt.de/en/topics/agriculture/toward-ecofriendly-farming/organic-farming" }
        ],
        enabled: true
      },
      {
        id: "bioland",
        title: "Bioland",
        year: 1971,
        strictness: 4,
        verdict: "Strenger als EU‑Bio",
        short: "Größter deutscher Bio‑Anbauverband. Zusätzliche Tierwohl‑ und Umweltauflagen.",
        points: [
          "Strengere Regeln als EU‑Bio",
          "Mehr Tierwohl‑Vorgaben",
          "Umweltauflagen gehen häufig weiter"
        ],
        image: "./bioseals/bioland.svg",
        sourceLinks: [
          { label: "Bingenheimer Saatgut: Zertifikate", url: "https://www.bingenheimersaatgut.de/en/info/en/service-download/certificates.html" }
        ],
        enabled: true
      },
      {
        id: "naturland",
        title: "Naturland",
        year: 1982,
        strictness: 4,
        verdict: "Bio + Soziales",
        short: "Internationaler Verband. Zusätzliche soziale Kriterien (Fairness / Handel).",
        points: [
          "Zusätzliche Sozial‑/Fairness‑Kriterien",
          "International verbreitet",
          "Bio‑Standards oft über EU‑Bio"
        ],
        image: "./bioseals/naturland.svg",
        sourceLinks: [
          { label: "Bingenheimer Saatgut: Zertifikate", url: "https://www.bingenheimersaatgut.de/en/info/en/service-download/certificates.html" }
        ],
        enabled: true
      },
      {
        id: "demeter",
        title: "Demeter",
        year: 1924,
        strictness: 5,
        verdict: "Sehr streng",
        short: "Ältestes Bio‑Siegel. Biodynamischer Ansatz, besonders strenge Regeln.",
        points: [
          "Sehr strenge Regeln (biodynamisch)",
          "Hohe Anforderungen an Tierhaltung und Bodenpflege",
          "Starker Fokus auf Kreislaufwirtschaft"
        ],
        image: "./bioseals/demeter.svg",
        sourceLinks: [
          { label: "Bingenheimer Saatgut: Zertifikate", url: "https://www.bingenheimersaatgut.de/en/info/en/service-download/certificates.html" }
        ],
        enabled: true
      }
    ];
  }

  function verdictTag(v) {
    const t = String(v || "").toLowerCase();
    if (t.includes("sehr") || t.includes("streng")) return "tag tag-strong";
    if (t.includes("bio +") || t.includes("sozial")) return "tag tag-good";
    if (t.includes("basis") || t.includes("eu")) return "tag tag-neutral";
    return "tag";
  }

  function stars(n) {
    const v = clamp(Number(n || 0), 0, 5);
    return "🌿".repeat(v) + "▫️".repeat(5 - v);
  }

  function el(tag, cls, html) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  }

  function renderTimeline(seals) {
    if (!timelineEl) return;
    timelineEl.innerHTML = "";

    const list = seals.filter(s => s && s.enabled !== false).slice().sort((a,b)=> (a.year||0) - (b.year||0));
    if (!list.length) {
      timelineEl.appendChild(el("div", "muted", "Keine Biosiegel aktiviert."));
      return;
    }

    const line = el("div", "bio-line");
    timelineEl.appendChild(line);

    const nodes = el("div", "bio-nodes");
    timelineEl.appendChild(nodes);

    for (const s of list) {
      const node = el("button", "bio-node", "");
      node.type = "button";
      node.title = `${s.title || s.id}${s.year ? " ("+s.year+")" : ""}`;
      node.innerHTML = `<span class="bio-node-dot"></span><span class="bio-node-label">${safeText(s.title || s.id)}</span>`;
      node.addEventListener("click", () => {
        const target = document.getElementById("seal-" + s.id);
        if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
      });
      nodes.appendChild(node);
    }
  }

  function renderGrid(seals) {
    if (!gridEl) return;
    gridEl.innerHTML = "";
    const list = seals.filter(s => s && s.enabled !== false).slice().sort((a,b)=> (a.year||0) - (b.year||0));

    for (const s of list) {
      const card = el("article", "bio-card", "");
      card.id = "seal-" + s.id;

      const img = el("div", "bio-img", "");
      img.innerHTML = `<img src="${safeText(s.image || "./bioseals/eu-bio.svg")}" alt="${safeText(s.title || s.id)}" loading="lazy" />`;

      const body = el("div", "bio-body", "");

      const top = el("div", "bio-top", "");
      top.innerHTML = `
        <div class="bio-title">${safeText(s.title || s.id)}</div>
        <div class="${verdictTag(s.verdict)}">${safeText(s.verdict || "")}</div>
      `;

      const meta = el("div", "bio-meta", "");
      meta.innerHTML = `
        <span class="bio-year">${s.year ? safeText(String(s.year)) : "—"}</span>
        <span class="bio-stars" title="Strenge">${safeText(stars(s.strictness))}</span>
      `;

      const p = el("div", "bio-short", safeText(s.short || ""));

      const ul = el("ul", "bio-points", "");
      for (const pt of (s.points || [])) {
        const li = document.createElement("li");
        li.textContent = pt;
        ul.appendChild(li);
      }

      const src = el("div", "bio-sources", "");
      if (Array.isArray(s.sourceLinks) && s.sourceLinks.length) {
        src.innerHTML = `<div class="muted" style="margin-top:8px;">Quellen:</div>`;
        const aWrap = el("div", "bio-src-links", "");
        for (const l of s.sourceLinks.slice(0, 4)) {
          const a = document.createElement("a");
          a.href = l.url;
          a.target = "_blank";
          a.rel = "noreferrer";
          a.className = "link";
          a.textContent = l.label || l.url;
          aWrap.appendChild(a);
        }
        src.appendChild(aWrap);
      }

      body.appendChild(top);
      body.appendChild(meta);
      body.appendChild(p);
      body.appendChild(ul);
      body.appendChild(src);

      card.appendChild(img);
      card.appendChild(body);
      gridEl.appendChild(card);
    }
  }

  async function loadSiteData() {
    try {
      if (window.SiteStore && typeof SiteStore.loadAsync === "function") {
        return await SiteStore.loadAsync();
      }
    } catch (e) {}
    // fallback to local defaults
    return (window.SiteStore && typeof SiteStore.load === "function")
      ? SiteStore.load()
      : (window.DEFAULT_SITE_DATA || {});
  }

  async function saveSiteData(data, password) {
    if (!window.SiteStore) return false;
    if (typeof SiteStore.saveAsync === "function") return await SiteStore.saveAsync(data, password);
    try { SiteStore.save(data); return true; } catch(e){ return false; }
  }

  // Public bridge for editor
  window.BioSeals = {
    getSeals: async function () {
      const data = await loadSiteData();
      const seals = Array.isArray(data.bioSeals) ? data.bioSeals : null;
      return { data, seals: seals || defaultSeals() };
    },
    setSeals: async function (seals, password) {
      const current = await loadSiteData();
      current.bioSeals = Array.isArray(seals) ? seals : [];
      const ok = await saveSiteData(current, password);
      return ok;
    },
    render: function (seals) {
      const list = Array.isArray(seals) ? seals : defaultSeals();
      renderTimeline(list);
      renderGrid(list);
    },
    defaultSeals
  };

  // Boot render
  (async function boot() {
    const { seals } = await window.BioSeals.getSeals();
    window.BioSeals.render(seals);
  })();
})();
