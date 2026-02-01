/*
  Biosiegel Editor
  - Uses window.BioSeals bridge (biosiegel.js)
  - Saves to backend using SiteStore.saveAsync (password)
  - Keeps UI lightweight and consistent with existing site editor patterns
*/
(function () {
  const fab = document.getElementById("bioEditorFab");
  const drawer = document.getElementById("bioEditorDrawer");
  const closeBtn = document.getElementById("bioEditorClose");
  const pwInput = document.getElementById("bioEditorPw");
  const listEl = document.getElementById("bioEditorList");
  const addBtn = document.getElementById("bioAddSeal");
  const saveBtn = document.getElementById("bioSave");
  const resetBtn = document.getElementById("bioReset");
  const toast = document.getElementById("bioToast");

  function showToast(msg, ok) {
    if (!toast) return;
    toast.textContent = msg;
    toast.classList.toggle("toast-ok", !!ok);
    toast.classList.toggle("toast-bad", !ok);
    toast.classList.add("toast-show");
    setTimeout(() => toast.classList.remove("toast-show"), 2200);
  }

  function openDrawer() {
    if (!drawer) return;
    drawer.classList.add("drawer-open");
    drawer.setAttribute("aria-hidden", "false");
  }
  function closeDrawer() {
    if (!drawer) return;
    drawer.classList.remove("drawer-open");
    drawer.setAttribute("aria-hidden", "true");
  }

  function uid() {
    return "seal_" + Math.random().toString(16).slice(2, 10);
  }

  function normalizeSeal(s) {
    const o = Object.assign({
      id: uid(),
      title: "Neues Siegel",
      year: 2000,
      strictness: 3,
      verdict: "—",
      short: "",
      points: [],
      image: "./bioseals/eu-bio.svg",
      sourceLinks: [],
      enabled: true
    }, s || {});
    // coerce
    o.year = Number(o.year || 0) || 0;
    o.strictness = Number(o.strictness || 0) || 0;
    o.points = Array.isArray(o.points) ? o.points : String(o.points || "").split("\n").map(x=>x.trim()).filter(Boolean);
    o.sourceLinks = Array.isArray(o.sourceLinks) ? o.sourceLinks : [];
    return o;
  }

  let siteData = null;
  let seals = [];

  function renderList() {
    if (!listEl) return;
    listEl.innerHTML = "";
    seals.forEach((s, idx) => {
      const row = document.createElement("div");
      row.className = "editor-item";

      row.innerHTML = `
        <div class="editor-item-head">
          <div class="editor-item-title">
            <span class="pill">${idx + 1}</span>
            <input class="input input-sm" data-k="title" value="${escapeAttr(s.title || "")}" />
          </div>
          <div class="editor-item-actions">
            <button class="btn btn-ghost btn-sm" data-act="up" title="hoch">↑</button>
            <button class="btn btn-ghost btn-sm" data-act="down" title="runter">↓</button>
            <button class="btn btn-ghost btn-sm" data-act="toggle" title="aktiv/deaktiv">${s.enabled ? "✓" : "⨯"}</button>
            <button class="btn btn-ghost btn-sm" data-act="del" title="löschen">🗑</button>
          </div>
        </div>

        <div class="editor-grid">
          <label class="label">ID</label>
          <input class="input input-sm" data-k="id" value="${escapeAttr(s.id || "")}" />

          <label class="label">Jahr</label>
          <input class="input input-sm" type="number" data-k="year" value="${escapeAttr(String(s.year || ""))}" />

          <label class="label">Strenge (1–5)</label>
          <input class="input input-sm" type="number" min="1" max="5" data-k="strictness" value="${escapeAttr(String(s.strictness || ""))}" />

          <label class="label">Bewertung (Tag)</label>
          <input class="input input-sm" data-k="verdict" value="${escapeAttr(s.verdict || "")}" />

          <label class="label">Bild (URL)</label>
          <input class="input input-sm" data-k="image" value="${escapeAttr(s.image || "")}" />

          <label class="label">Kurztext</label>
          <textarea class="input textarea" data-k="short" rows="2">${escapeHtml(s.short || "")}</textarea>

          <label class="label">Kriterien (je Zeile)</label>
          <textarea class="input textarea" data-k="points" rows="4">${escapeHtml((s.points || []).join("\n"))}</textarea>

          <label class="label">Quellen (Label|URL je Zeile)</label>
          <textarea class="input textarea" data-k="sources" rows="3">${escapeHtml((s.sourceLinks || []).map(x => `${x.label || ""}|${x.url || ""}`).join("\n"))}</textarea>
        </div>
      `;

      row.addEventListener("input", (ev) => {
        const el = ev.target;
        const k = el && el.getAttribute && el.getAttribute("data-k");
        if (!k) return;
        if (k === "points") {
          seals[idx].points = String(el.value || "").split("\n").map(x => x.trim()).filter(Boolean);
        } else if (k === "sources") {
          const lines = String(el.value || "").split("\n").map(x => x.trim()).filter(Boolean);
          seals[idx].sourceLinks = lines.map(line => {
            const [label, url] = line.split("|");
            return { label: (label || "").trim(), url: (url || "").trim() };
          }).filter(x => x.url);
        } else if (k === "year" || k === "strictness") {
          seals[idx][k] = Number(el.value || 0) || 0;
        } else {
          seals[idx][k] = el.value;
        }
        // live re-render (nice feedback)
        if (window.BioSeals && typeof window.BioSeals.render === "function") {
          window.BioSeals.render(seals);
        }
      });

      row.addEventListener("click", (ev) => {
        const btn = ev.target;
        const act = btn && btn.getAttribute && btn.getAttribute("data-act");
        if (!act) return;
        ev.preventDefault();

        if (act === "up" && idx > 0) {
          const tmp = seals[idx - 1]; seals[idx - 1] = seals[idx]; seals[idx] = tmp;
          renderList(); window.BioSeals.render(seals);
        }
        if (act === "down" && idx < seals.length - 1) {
          const tmp = seals[idx + 1]; seals[idx + 1] = seals[idx]; seals[idx] = tmp;
          renderList(); window.BioSeals.render(seals);
        }
        if (act === "toggle") {
          seals[idx].enabled = !seals[idx].enabled;
          renderList(); window.BioSeals.render(seals);
        }
        if (act === "del") {
          seals.splice(idx, 1);
          renderList(); window.BioSeals.render(seals);
        }
      });

      listEl.appendChild(row);
    });
  }

  function escapeHtml(s) {
    return String(s || "").replace(/[&<>"']/g, (m) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    }[m]));
  }
  function escapeAttr(s) { return escapeHtml(s).replace(/"/g, "&quot;"); }

  async function load() {
    if (!window.BioSeals || typeof window.BioSeals.getSeals !== "function") return;
    const res = await window.BioSeals.getSeals();
    siteData = res.data || null;
    seals = (res.seals || []).map(normalizeSeal);
    renderList();
  }

  async function save() {
    const pw = (pwInput && pwInput.value) ? pwInput.value : (window.__EDITOR_PASSWORD__ || "");
    if (!pw) {
      showToast("Passwort fehlt (55).", false);
      return;
    }
    // clamp strictness
    seals.forEach(s => { s.strictness = Math.max(1, Math.min(5, Number(s.strictness||3))); });
    const ok = await window.BioSeals.setSeals(seals, pw);
    if (ok) {
      window.__EDITOR_PASSWORD__ = pw;
      showToast("Gespeichert ✅", true);
    } else {
      showToast("Konnte nicht speichern (Backend?)", false);
    }
  }

  function resetToDefault() {
    if (!window.BioSeals || typeof window.BioSeals.defaultSeals !== "function") return;
    seals = window.BioSeals.defaultSeals().map(normalizeSeal);
    renderList();
    window.BioSeals.render(seals);
    showToast("Zurückgesetzt (lokal).", true);
  }

  if (fab) fab.addEventListener("click", () => { openDrawer(); load(); });
  if (closeBtn) closeBtn.addEventListener("click", closeDrawer);
  if (addBtn) addBtn.addEventListener("click", () => {
    seals.push(normalizeSeal({ title: "Neues Siegel", year: 2026, strictness: 3, verdict: "—" }));
    renderList(); window.BioSeals.render(seals);
  });
  if (saveBtn) saveBtn.addEventListener("click", save);
  if (resetBtn) resetBtn.addEventListener("click", resetToDefault);

  // ESC close
  window.addEventListener("keydown", (e) => { if (e.key === "Escape") closeDrawer(); });
})();
