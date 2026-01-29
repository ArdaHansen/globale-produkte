(function(){
  const PASSWORD = "55";

  const fab = document.getElementById("homeEditorFab");
  const drawer = document.getElementById("homeEditorDrawer");
  const closeBtn = document.getElementById("homeEditorClose");

  const lockArea = document.getElementById("homeLockArea");
  const editorArea = document.getElementById("homeEditorArea");
  const pwInput = document.getElementById("homePwInput");
  const unlockBtn = document.getElementById("homeUnlockBtn");

  const lockBtn = document.getElementById("homeLockBtn");
  const lockBtn2 = document.getElementById("homeLockBtn2");

  const tilesWrap = document.getElementById("homeTilesWrap");
  const addTileBtn = document.getElementById("homeAddTile");
  const saveBtn = document.getElementById("homeSaveBtn");
  const resetBtn = document.getElementById("homeResetBtn");

  const siteTitle = document.getElementById("homeSiteTitle");
  const siteSubtitle = document.getElementById("homeSiteSubtitle");
  const saveSiteBtn = document.getElementById("homeSaveSiteBtn");

  // New: additional homepage grids (optional)
  const gridsWrap = document.getElementById("homeGridsWrap");
  const addGridBtn = document.getElementById("homeAddGrid");
  const saveGridsBtn = document.getElementById("homeSaveGridsBtn");

  const tabs = Array.from(document.querySelectorAll(".edtab"));
  const panels = Array.from(document.querySelectorAll(".edpanel"));

  let unlocked = false;
  let model = null; // working copy

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

  function setUnlocked(v){
    unlocked = v;
    if(unlocked){
      lockArea.hidden = true;
      editorArea.hidden = false;
      loadModel();
    }else{
      lockArea.hidden = false;
      editorArea.hidden = true;
      pwInput.value = "";
    }
  }

  unlockBtn?.addEventListener("click", () => {
    const pw = (pwInput.value || "").trim();
    if(pw === PASSWORD){ window.__EDITOR_PASSWORD__ = pw; setUnlocked(true);} 
    else{
      pwInput.value = "";
      pwInput.placeholder = "Falsches Passwort";
      pwInput.focus();
    }
  });
  lockBtn?.addEventListener("click", () => setUnlocked(false));
  lockBtn2?.addEventListener("click", () => setUnlocked(false));

  function switchTab(name){
    tabs.forEach(t => t.classList.toggle("is-active", t.dataset.tab === name));
    panels.forEach(p => p.hidden = (p.dataset.panel !== name));
  }
  tabs.forEach(t => t.addEventListener("click", () => switchTab(t.dataset.tab)));
  switchTab("tiles");

  function loadModel(){
    const data = SiteStore.load();
    model = structuredClone(data);

    // Ensure optional container exists for additional homepage grids
    model.site = model.site || {};
    if(!Array.isArray(model.site.homeGrids)) model.site.homeGrids = [];
    // seed site inputs
    siteTitle.value = model.site?.title || "";
    siteSubtitle.value = model.site?.subtitle || "";
    renderTiles();
    renderGrids();
  }

  function escapeHtml(str){
    return String(str)
      .replaceAll("&","&amp;")
      .replaceAll("<","&lt;")
      .replaceAll(">","&gt;")
      .replaceAll('"',"&quot;");
  }

  function renderTiles(){
    if(!tilesWrap || !model) return;
    tilesWrap.innerHTML = "";
    const tiles = model.tiles || [];

    tiles.forEach((t, idx) => {
      const item = document.createElement("div");
      item.className = "tileitem";

      const enabled = (t.enabled !== false);

      item.innerHTML = `
        <div class="tileitem__top">
          <div class="tileitem__title">
            <span class="badge">#${idx+1}</span>
            <span>${escapeHtml(t.emoji || "🍃")}</span>
            <span>${escapeHtml(t.title || "Unbenannt")}</span>
          </div>
          <div class="tileitem__actions">
            <button class="btn btn--mini btn--ghost" data-act="up" ${idx===0?"disabled":""}>↑</button>
            <button class="btn btn--mini btn--ghost" data-act="down" ${idx===tiles.length-1?"disabled":""}>↓</button>
            <button class="btn btn--mini btn--ghost" data-act="del">Löschen</button>
          </div>
        </div>

        <div class="edgrid cols2">
          <div>
            <label class="label">Emoji</label>
            <input class="input" data-field="emoji" value="${escapeHtml(t.emoji||"")}" />
          </div>
          <div>
            <label class="label">Titel</label>
            <input class="input" data-field="title" value="${escapeHtml(t.title||"")}" />
          </div>
        </div>

        <label class="label" style="margin-top:8px;">Herkunft/Region</label>
        <input class="input" data-field="origin" value="${escapeHtml(t.origin||"")}" />

        <label class="label" style="margin-top:8px;">Kurzinfo</label>
        <input class="input" data-field="short" value="${escapeHtml(t.short||"")}" />

        <div class="row" style="justify-content: space-between; margin-top:10px;">
          <label class="chk"><input type="checkbox" data-field="enabled" ${enabled?"checked":""}/> Aktiv</label>
          <span class="muted small">Seite: ${escapeHtml(t.pageId || t.id || "")}</span>
        </div>
      `;

      // actions
      item.querySelectorAll("button[data-act]").forEach(btn => {
        btn.addEventListener("click", () => {
          const act = btn.getAttribute("data-act");
          if(act === "del"){
            tiles.splice(idx, 1);
            renderTiles();
          }else if(act === "up" && idx > 0){
            const tmp = tiles[idx-1]; tiles[idx-1] = tiles[idx]; tiles[idx] = tmp;
            renderTiles();
          }else if(act === "down" && idx < tiles.length-1){
            const tmp = tiles[idx+1]; tiles[idx+1] = tiles[idx]; tiles[idx] = tmp;
            renderTiles();
    renderGrids();
          }
        });
      });

      // fields binding
      item.querySelectorAll("[data-field]").forEach(el => {
        const field = el.getAttribute("data-field");
        const isCheckbox = el.type === "checkbox";
        el.addEventListener("input", () => {
          if(field === "enabled"){
            t.enabled = isCheckbox ? el.checked : !!el.value;
          }else{
            t[field] = el.value;
          }
          // live update header line (title) by rerendering minimal: easiest rerender all
          renderTiles();
        });
        if(isCheckbox){
          el.addEventListener("change", () => {
            t.enabled = el.checked;
          });
        }
      });

      tilesWrap.appendChild(item);
    });

    if(tiles.length === 0){
      const empty = document.createElement("div");
      empty.className = "muted small";
      empty.textContent = "Noch keine Felder. Klicke „+ Feld“.";
      tilesWrap.appendChild(empty);
    }
  }

  // ---- Additional homepage grids (optional)
  function newEmptyGrid(){
    const uid = "g" + Math.random().toString(16).slice(2, 8);
    return {
      id: uid,
      title: "Neues Grid",
      subtitle: "",
      href: "./",
      emoji: "✨",
      enabled: true
    };
  }

  function renderGrids(){
    if(!gridsWrap) return;
    const list = Array.isArray(model?.site?.homeGrids) ? model.site.homeGrids : [];
    gridsWrap.innerHTML = "";

    if(!list.length){
      gridsWrap.innerHTML = "<div class='muted'>Keine zusätzlichen Grids angelegt. Mit „+ Grid hinzufügen“ kannst du neue erstellen.</div>";
      return;
    }

    list.forEach((g, idx) => {
      const row = document.createElement("div");
      row.className = "edgrid";
      row.innerHTML = `
        <div class="edgrid__top">
          <div class="edgrid__badge">#${idx+1}</div>
          <div class="edgrid__actions">
            <button type="button" class="btn btn--ghost" data-act="up" ${idx===0?"disabled":""}>▲</button>
            <button type="button" class="btn btn--ghost" data-act="down" ${idx===list.length-1?"disabled":""}>▼</button>
            <button type="button" class="btn btn--danger" data-act="delete">Löschen</button>
          </div>
        </div>

        <label class="field"><span>Emoji / Icon</span>
          <input type="text" value="${escapeHtml(g.emoji || "✨")}" maxlength="6" data-k="emoji" />
        </label>
        <label class="field"><span>Titel</span>
          <input type="text" value="${escapeHtml(g.title || "")}" data-k="title" />
        </label>
        <label class="field"><span>Untertitel</span>
          <input type="text" value="${escapeHtml(g.subtitle || "")}" data-k="subtitle" />
        </label>
        <label class="field"><span>Link (z. B. ./biosiegel.html)</span>
          <input type="text" value="${escapeHtml(g.href || "./")}" data-k="href" />
        </label>
        <label class="check">
          <input type="checkbox" data-k="enabled" ${g.enabled===false?"":"checked"} />
          <span>Aktiv</span>
        </label>
      `;

      row.addEventListener("input", (ev) => {
        const t = ev.target;
        if(!t || !t.getAttribute) return;
        const k = t.getAttribute("data-k");
        if(!k) return;
        if(k === "enabled") list[idx].enabled = !!t.checked;
        else list[idx][k] = t.value;
      });

      row.addEventListener("click", (ev) => {
        const btn = ev.target?.closest?.("button[data-act]");
        if(!btn) return;
        const act = btn.getAttribute("data-act");
        if(act === "delete"){
          list.splice(idx, 1);
          renderGrids();
          return;
        }
        if(act === "up" && idx > 0){
          const tmp = list[idx-1];
          list[idx-1] = list[idx];
          list[idx] = tmp;
          renderGrids();
          return;
        }
        if(act === "down" && idx < list.length-1){
          const tmp = list[idx+1];
          list[idx+1] = list[idx];
          list[idx] = tmp;
          renderGrids();
          return;
        }
      });

      gridsWrap.appendChild(row);
    });
  }

  addGridBtn?.addEventListener("click", () => {
    if(!unlocked || !model) return;
    model.site.homeGrids = model.site.homeGrids || [];
    model.site.homeGrids.push(newEmptyGrid());
    renderGrids();
  });

  saveGridsBtn?.addEventListener("click", async () => {
    if(!unlocked || !model) return;
    // normalize order/index (optional, but makes the JSON stable)
    if(Array.isArray(model.site.homeGrids)){
      model.site.homeGrids.forEach((g,i) => { g.order = i+1; });
    }
    try{
      if(SiteStore.saveAsync) await SiteStore.saveAsync(model);
      else SiteStore.save(model);
      document.dispatchEvent(new CustomEvent("site:updated", { detail: model }));
      toast("Grids gespeichert ✅");
    }catch(e){
      console.error(e);
      toast("Fehler beim Speichern");
    }
  });

  addTileBtn?.addEventListener("click", () => {
    if(!unlocked || !model) return;
    const n = (model.tiles?.length || 0) + 1;
    const id = "f" + String(n).padStart(2, "0");
    model.tiles = model.tiles || [];
    model.pages = model.pages || {};
    model.tiles.push({
      id, pageId: id, emoji: "🍃", title: "Neues Feld",
      origin: "", short: "Neues Feld (Fehlt)", enabled: true
    });
    if(!model.pages[id]){
      model.pages[id] = {
        title: "Neues Feld",
        hero: "🍃 Neues Feld",
        sections: [
          {h:"Anbau / Produktion", p:"(Fehlt)"},
          {h:"Arbeitsbedingungen & Lebensumstände", p:"(Fehlt)"},
          {h:"Transport & Logistik", p:"(Fehlt)"},
          {h:"CO₂ & Umweltfolgen", p:"(Fehlt)"},
        ],
        extra: ""
      };
    }
    renderTiles();
  });

  saveBtn?.addEventListener("click", () => {
    if(!unlocked || !model) return;
    // ensure page titles match tile titles if empty
    model.tiles.forEach(t => {
      const pid = t.pageId || t.id;
      if(!pid) return;
      model.pages = model.pages || {};
      if(!model.pages[pid]){
        model.pages[pid] = { title: t.title || "Seite", hero: (t.emoji||"🍃")+" "+(t.title||"Seite"), sections: [], extra: "" };
      }
      if(!model.pages[pid].title) model.pages[pid].title = t.title || "Seite";
      if(!model.pages[pid].hero) model.pages[pid].hero = (t.emoji||"🍃")+" "+(t.title||"Seite");
    });

    if(SiteStore.saveAsync){ SiteStore.saveAsync(model, window.__EDITOR_PASSWORD__ || PASSWORD); } else { if(SiteStore.saveAsync){ SiteStore.saveAsync(model, window.__EDITOR_PASSWORD__ || PASSWORD); } else { SiteStore.save(model); } }
    window.dispatchEvent(new CustomEvent("site:updated"));
    closeDrawer();
  });

  saveSiteBtn?.addEventListener("click", () => {
    if(!unlocked || !model) return;
    model.site = model.site || {};
    model.site.title = (siteTitle.value || "").trim() || model.site.title;
    model.site.subtitle = (siteSubtitle.value || "").trim() || model.site.subtitle;
    if(SiteStore.saveAsync){ SiteStore.saveAsync(model, window.__EDITOR_PASSWORD__ || PASSWORD); } else { if(SiteStore.saveAsync){ SiteStore.saveAsync(model, window.__EDITOR_PASSWORD__ || PASSWORD); } else { SiteStore.save(model); } }
    window.dispatchEvent(new CustomEvent("site:updated"));
    closeDrawer();
  });

  resetBtn?.addEventListener("click", () => {
    if(!unlocked) return;
    if(!confirm("Zurücksetzen? Alle lokalen Änderungen werden gelöscht.")) return;
    SiteStore.reset();
    location.reload();
  });

  // Keep editor model in sync if elsewhere updated
  window.addEventListener("site:updated", () => {
    if(unlocked) loadModel();
  });

  setUnlocked(false);
})();