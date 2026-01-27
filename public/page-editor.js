(function(){
  const PASSWORD = "55";

  function getId(){
    const params = new URLSearchParams(window.location.search);
    return params.get("id") || "f01";
  }

  const fab = document.getElementById("pageEditorFab");
  const drawer = document.getElementById("pageEditorDrawer");
  const closeBtn = document.getElementById("pageEditorClose");

  const lockArea = document.getElementById("pageLockArea");
  const editorArea = document.getElementById("pageEditorArea");
  const status = document.getElementById("pageEditorStatus");

  const pwInput = document.getElementById("pagePwInput");
  const unlockBtn = document.getElementById("pageUnlockBtn");
  const lockBtn = document.getElementById("pageLockBtn");

  const peTitle = document.getElementById("peTitle");
  const peOrigin = document.getElementById("peOrigin");
  const peShort = document.getElementById("peShort");
  const peHero = document.getElementById("peHero");

  const sectionsWrap = document.getElementById("peSections");
  const addSectionBtn = document.getElementById("peAddSection");

  const peExtra = document.getElementById("peExtra");

  const saveBtn = document.getElementById("peSave");
  const resetBtn = document.getElementById("peReset");

  let unlocked = false;

  function openDrawer(){
    drawer.classList.add("is-open");
    drawer.setAttribute("aria-hidden", "false");
    drawer.addEventListener("click", (e) => {
      if(e.target === drawer) closeDrawer();
    }, { once: true });
  }
  function closeDrawer(){
    drawer.classList.remove("is-open");
    drawer.setAttribute("aria-hidden", "true");
  }

  fab?.addEventListener("click", openDrawer);
  closeBtn?.addEventListener("click", closeDrawer);

  function setUnlocked(value){
    unlocked = value;
    if(unlocked){
      status.textContent = "Entsperrt";
      lockArea.hidden = true;
      editorArea.hidden = false;
      loadIntoForm();
    }else{
      status.textContent = "Gesperrt";
      lockArea.hidden = false;
      editorArea.hidden = true;
      pwInput.value = "";
    }
  }

  unlockBtn?.addEventListener("click", () => {
    const pw = (pwInput.value || "").trim();
    if(pw === PASSWORD){ window.__EDITOR_PASSWORD__ = pw;
      setUnlocked(true);
    }else{
      pwInput.value = "";
      pwInput.placeholder = "Falsches Passwort";
      pwInput.focus();
    }
  });

  lockBtn?.addEventListener("click", () => setUnlocked(false));

  function getTileByPageId(data, pageId){
    return (data.tiles || []).find(t => (t.pageId || t.id) === pageId);
  }

  function ensurePage(data, id){
    if(!data.pages) data.pages = {};
    if(!data.pages[id]) data.pages[id] = { title: "", hero: "", sections: [], extra: "" };
    if(!Array.isArray(data.pages[id].sections)) data.pages[id].sections = [];
    return data.pages[id];
  }

  function defaultSectionsFor(id){
    const def = window.DEFAULT_SITE_DATA;
    const p = def?.pages?.[id];
    if(p?.sections?.length) return p.sections.map(s => ({h:s.h||"", p:s.p||""}));
    // fallback
    return [
      {h:"Anbau / Produktion", p:""},
      {h:"Arbeitsbedingungen", p:""},
      {h:"Transport & Logistik", p:""},
      {h:"Folgen vor Ort", p:""},
    ];
  }

  function renderSections(sections){
    if(!sectionsWrap) return;
    sectionsWrap.innerHTML = "";

    sections.forEach((sec, idx) => {
      const item = document.createElement("div");
      item.className = "secitem";
      item.dataset.index = String(idx);

      item.innerHTML = `
        <div class="secitem__top">
          <span class="iconpill">#${idx+1}</span>
          <div class="secitem__actions">
            <button class="btn btn--mini btn--ghost" data-act="up" ${idx===0 ? "disabled":""}>↑</button>
            <button class="btn btn--mini btn--ghost" data-act="down" ${idx===sections.length-1 ? "disabled":""}>↓</button>
            <button class="btn btn--mini btn--ghost" data-act="del">Löschen</button>
          </div>
        </div>
        <label class="label">Überschrift</label>
        <input class="input" data-field="h" value="${escapeHtml(sec.h||"")}" />
        <label class="label">Text</label>
        <textarea class="input area" data-field="p" rows="4">${escapeHtml(sec.p||"")}</textarea>
      `;

      // Attach action handlers
      item.querySelectorAll("button[data-act]").forEach(btn => {
        btn.addEventListener("click", () => {
          const act = btn.getAttribute("data-act");
          if(act === "del"){
            sections.splice(idx, 1);
            renderSections(sections);
          }else if(act === "up" && idx > 0){
            const tmp = sections[idx-1]; sections[idx-1] = sections[idx]; sections[idx] = tmp;
            renderSections(sections);
          }else if(act === "down" && idx < sections.length-1){
            const tmp = sections[idx+1]; sections[idx+1] = sections[idx]; sections[idx] = tmp;
            renderSections(sections);
          }
        });
      });

      // Live binding
      item.querySelectorAll("[data-field]").forEach(el => {
        el.addEventListener("input", () => {
          const f = el.getAttribute("data-field");
          sections[idx][f] = el.value;
        });
      });

      sectionsWrap.appendChild(item);
    });

    if(sections.length === 0){
      const empty = document.createElement("div");
      empty.className = "muted small";
      empty.textContent = "Noch keine Abschnitte. Klicke „+ Abschnitt hinzufügen“.";
      sectionsWrap.appendChild(empty);
    }
  }

  function escapeHtml(str){
    return String(str)
      .replaceAll("&","&amp;")
      .replaceAll("<","&lt;")
      .replaceAll(">","&gt;")
      .replaceAll('"',"&quot;");
  }

  let currentSections = [];

  function loadIntoForm(){
    const id = getId();
    const data = SiteStore.load();
    const tile = getTileByPageId(data, id);
    const page = ensurePage(data, id);

    // If empty sections, seed with defaults
    if(page.sections.length === 0){
      page.sections = defaultSectionsFor(id);
      if(SiteStore.saveAsync){ SiteStore.saveAsync(data, window.__EDITOR_PASSWORD__ || PASSWORD); } else { SiteStore.save(data); }
    }

    peTitle.value = page.title || tile?.title || "";
    peOrigin.value = tile?.origin || "";
    peShort.value = tile?.short || "";
    peHero.value = page.hero || (tile ? `${tile.emoji || "🌿"} ${tile.title || ""}` : "");

    peExtra.value = page.extra || "";

    currentSections = page.sections.map(s => ({ h: s.h || "", p: s.p || "" }));
    renderSections(currentSections);
  }

  function saveFromForm(){
    const id = getId();
    const data = SiteStore.load();
    const tile = getTileByPageId(data, id);
    const page = ensurePage(data, id);

    if(tile){
      tile.origin = (peOrigin.value || "").trim();
      tile.short = (peShort.value || "").trim();
      if((peTitle.value || "").trim()) tile.title = (peTitle.value || "").trim();

      // If hero begins with emoji, store it
      const hero = (peHero.value || "").trim();
      const emojiMatch = hero.match(/^([\u{1F300}-\u{1FAFF}\u2600-\u27BF\uFE0F\u200D\u{1F1E6}-\u{1F1FF}]+)\s+/u);
      if(emojiMatch) tile.emoji = emojiMatch[1];
    }

    page.title = (peTitle.value || "").trim() || page.title || tile?.title || "Seite";
    page.hero = (peHero.value || "").trim() || page.hero || "";

    // sections (dynamic)
    page.sections = (currentSections || [])
      .map(s => ({ h: (s.h || "").trim(), p: (s.p || "").trim() }))
      .filter(s => s.h.length || s.p.length); // drop fully empty

    page.extra = (peExtra.value || "").trim();

    data.pages[id] = page;
    if(SiteStore.saveAsync){ SiteStore.saveAsync(data, window.__EDITOR_PASSWORD__ || PASSWORD); } else { SiteStore.save(data); }
    window.dispatchEvent(new CustomEvent("site:updated"));
  }

  addSectionBtn?.addEventListener("click", () => {
    if(!unlocked) return;
    currentSections.push({ h: "Neuer Abschnitt", p: "" });
    renderSections(currentSections);
  });

  saveBtn?.addEventListener("click", () => {
    if(!unlocked) return;
    saveFromForm();
  });

  resetBtn?.addEventListener("click", () => {
    if(!unlocked) return;
    const id = getId();
    const def = structuredClone(window.DEFAULT_SITE_DATA);
    const data = SiteStore.load();

    // reset page
    if(def.pages?.[id]) data.pages[id] = def.pages[id];

    // reset tile
    const idx = (data.tiles || []).findIndex(t => (t.pageId || t.id) === id);
    const defIdx = (def.tiles || []).findIndex(t => (t.pageId || t.id) === id);
    if(idx >= 0 && defIdx >= 0) data.tiles[idx] = def.tiles[defIdx];

    if(SiteStore.saveAsync){ SiteStore.saveAsync(data, window.__EDITOR_PASSWORD__ || PASSWORD); } else { SiteStore.save(data); }
    window.dispatchEvent(new CustomEvent("site:updated"));
    loadIntoForm();
  });

  window.addEventListener("site:updated", () => {
    if(unlocked) loadIntoForm();
  });

  setUnlocked(false);
})();