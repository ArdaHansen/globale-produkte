/*
  Globe (three.js) – Globale Produkte
  - Pins: /pins.json
  - Produktdaten optional: SiteStore.loadAsync() -> /api/site
  - Interaktiv: Drag = drehen, Scroll = zoomen, Klick = Tooltip
  - Fokus: /globe.html?id=f03 (z. B. Banane)
*/

(function () {
  const statusEl = document.getElementById("globeStatus");
  const canvas = document.getElementById("globeCanvas");
  const productSelect = document.getElementById("productSelect");
  const tooltip = document.getElementById("pinTooltip");

  function setStatus(t) {
    if (statusEl) statusEl.textContent = "Status: " + t;
  }

  function qs(name) {
    const u = new URL(location.href);
    return u.searchParams.get(name);
  }

  // ---- Guards
  if (!canvas) {
    console.error("globeCanvas fehlt");
    return;
  }
  if (!window.THREE || !THREE.WebGLRenderer) {
    setStatus("FEHLER – three.js nicht geladen");
    return;
  }

  // WebGL support check
  try {
    const test = document.createElement("canvas");
    const gl = test.getContext("webgl") || test.getContext("experimental-webgl");
    if (!gl) {
      setStatus("FEHLER – WebGL deaktiviert");
      return;
    }
  } catch (e) {
    setStatus("FEHLER – WebGL Check fehlgeschlagen");
    return;
  }

  // ---- Scene
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputEncoding = THREE.sRGBEncoding;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
  camera.position.set(0, 0.12, 3.1);

  // Controls
  let controls = null;
  if (THREE.OrbitControls) {
    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.enablePan = false;
    controls.enableZoom = true;
    controls.zoomSpeed = 0.9;
    controls.rotateSpeed = 0.6;
    controls.minDistance = 1.8;
    controls.maxDistance = 6.0;
    // smoother limits
    controls.minPolarAngle = 0.15;
    controls.maxPolarAngle = Math.PI - 0.15;
  } else {
    setStatus("Hinweis – OrbitControls fehlt (kein Drag/Zoom)");
  }

  // Lights
  scene.add(new THREE.AmbientLight(0xffffff, 0.95));
  const dir = new THREE.DirectionalLight(0xffffff, 0.85);
  dir.position.set(4, 2.5, 2);
  scene.add(dir);

  // World group (Earth + pins)
  const world = new THREE.Group();
  scene.add(world);

  const R = 1.18;

  // Earth mesh
  const loader = new THREE.TextureLoader();
  const earthMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.9,
    metalness: 0.0,
  });

  const earth = new THREE.Mesh(new THREE.SphereGeometry(R, 64, 64), earthMat);
  world.add(earth);

  // Atmosphere glow
  const glow = new THREE.Mesh(
    new THREE.SphereGeometry(R * 1.03, 64, 64),
    new THREE.MeshBasicMaterial({ color: 0x46f7c5, transparent: true, opacity: 0.08 })
  );
  world.add(glow);

  // Pins container as child of earth -> rotates with globe
  const pinsGroup = new THREE.Group();
  let activeFilterId = "all";

  earth.add(pinsGroup);

  // ---- Utils
  function latLonToVector3(lat, lon, radius) {
    // lat: -90..90, lon: -180..180
    const phi = (90 - lat) * (Math.PI / 180);
    const theta = (lon + 180) * (Math.PI / 180);
    const x = -radius * Math.sin(phi) * Math.cos(theta);
    const z = radius * Math.sin(phi) * Math.sin(theta);
    const y = radius * Math.cos(phi);
    return new THREE.Vector3(x, y, z);
  }

  // High‑contrast emoji badge texture so the fruit is recognizable.
  function makeEmojiTexture(emoji, bg, fg) {
    const size = 320; // higher res => crisper at distance
    const c = document.createElement("canvas");
    c.width = size;
    c.height = size;
    const ctx = c.getContext("2d");
    // shadow
    ctx.save();
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size * 0.46, 0, Math.PI * 2);
    ctx.shadowColor = "rgba(0,0,0,0.28)";
    ctx.shadowBlur = size * 0.06;
    ctx.shadowOffsetY = size * 0.02;
    ctx.fillStyle = "rgba(0,0,0,0.01)";
    ctx.fill();
    ctx.restore();

    // circle
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size * 0.44, 0, Math.PI * 2);
    ctx.fillStyle = bg;
    ctx.fill();

    // thick ring (high contrast)
    ctx.lineWidth = size * 0.075;
    ctx.strokeStyle = "rgba(255,255,255,0.98)";
    ctx.stroke();

    // inner ring for separation from background
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size * 0.36, 0, Math.PI * 2);
    ctx.lineWidth = size * 0.02;
    ctx.strokeStyle = "rgba(0,0,0,0.10)";
    ctx.stroke();

    // emoji (bigger + clearer)
    // Use emoji-capable fonts first. Avoid forcing bold weights: some systems drop color-emoji in canvas.
    ctx.font = `${Math.floor(size * 0.68)}px "Segoe UI Emoji","Apple Color Emoji","Noto Color Emoji","Twemoji Mozilla",system-ui,sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = fg || "#000";
    // stronger outline + small shadow => readable over any terrain
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.25)";
    ctx.shadowBlur = size * 0.04;
    ctx.shadowOffsetY = size * 0.01;
    ctx.lineWidth = size * 0.018;
    ctx.strokeStyle = "rgba(255,255,255,0.80)";
    const textY = size / 2 + 6;
    ctx.strokeText(emoji || "•", size / 2, textY);
    ctx.fillText(emoji || "•", size / 2, textY);
    ctx.restore();
    const tex = new THREE.CanvasTexture(c);
    tex.encoding = THREE.sRGBEncoding;
    tex.needsUpdate = true;
    return tex;
  }

  function hideTooltip() {
    if (!tooltip) return;
    tooltip.style.display = "none";
  }

  function showTooltip(html, x, y) {
    if (!tooltip) return;
    tooltip.innerHTML = html;
    tooltip.style.left = `${x}px`;
    tooltip.style.top = `${y}px`;
    tooltip.style.display = "block";
  }

  function safeText(s) {
    return (s || "").replace(/[&<>"']/g, (m) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    }[m]));
  }

  // ---- Data load
  async function loadPins() {
    const res = await fetch("/pins.json", { cache: "no-store" });
    if (!res.ok) throw new Error("pins.json nicht gefunden");
    const json = await res.json();
    return Array.isArray(json.pins) ? json.pins : [];
  }

  async function loadTilesFromBackend() {
    try {
      if (window.SiteStore && typeof SiteStore.loadAsync === "function") {
        const data = await SiteStore.loadAsync();
        if (data && Array.isArray(data.tiles)) return data.tiles;
      }
    } catch (e) {}
    return null;
  }

  // ---- Pins rendering
  const spriteMeta = new WeakMap();
  const sprites = [];

  function clearPins() {
    while (pinsGroup.children.length) pinsGroup.remove(pinsGroup.children[0]);
    sprites.length = 0;
  }

  function addPin(pin, productInfo) {
    const emoji = (productInfo && productInfo.emoji) || pin.emoji || "📍";
    const bg = (productInfo && productInfo.color) || pin.color || "#ff6a3d";
    const tex = makeEmojiTexture(emoji, bg);
    // depthTest=false so badges don't disappear behind the globe surface at shallow angles
    const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false, depthWrite: false });
    const spr = new THREE.Sprite(mat);

    const pos = latLonToVector3(pin.lat, pin.lon, R + 0.02);
    spr.position.copy(pos);

    // baseline scale (will be adjusted each frame)
    const baseScale = (activeFilterId === 'all') ? 0.15 : 0.19;
    spr.userData.baseScale = baseScale;
    spr.scale.set(baseScale, baseScale, baseScale);

    pinsGroup.add(spr);
    sprites.push(spr);
    spriteMeta.set(spr, {
      pin,
      product: productInfo || { id: pin.productId, title: pin.productTitle, emoji },
    });
  }

  function colorByProductId(id) {
    // small palette
    const palette = {
      f01: "#22b356",
      f02: "#ff8a00",
      f03: "#ffd000",
      f04: "#7a4b2a",
      f05: "#7b3f00",
      f06: "#ffe066",
      f07: "#d8c690",
      f08: "#ff4d6d",
      f09: "#ff3b3b",
      f10: "#8a2be2",
      f11: "#ffa1c9",
      f12: "#40c057",
      f13: "#74c0fc",
      f14: "#c2255c",
      f15: "#fab005",
    };
    return palette[id] || "#ff6a3d";
  }

  function buildProductIndex(pins, tiles) {
    const byId = {};
    // from backend tiles
    if (Array.isArray(tiles)) {
      for (const t of tiles) {
        if (!t || !t.id) continue;
        byId[t.id] = {
          id: t.id,
          title: t.title || t.id,
          emoji: t.emoji || "📍",
          color: colorByProductId(t.id),
        };
      }
    }
    // ensure products that appear in pins
    for (const p of pins) {
      if (!p || !p.productId) continue;
      if (!byId[p.productId]) {
        byId[p.productId] = {
          id: p.productId,
          title: p.productTitle || p.productId,
          emoji: p.emoji || "📍",
          color: colorByProductId(p.productId),
        };
      }
    }
    return byId;
  }

  function populateDropdown(products, pins) {
    if (!productSelect) return;
    const current = productSelect.value || "all";
    const items = Object.values(products).sort((a, b) => (a.title || "").localeCompare(b.title || ""));
    productSelect.innerHTML = "";

    const optAll = document.createElement("option");
    optAll.value = "all";
    optAll.textContent = "Alle Produkte";
    productSelect.appendChild(optAll);

    for (const it of items) {
      const cnt = pins.filter((p) => p.productId === it.id).length;
      const o = document.createElement("option");
      o.value = it.id;
      o.textContent = `${it.emoji} ${it.title}${cnt ? ` (${cnt})` : ""}`;
      productSelect.appendChild(o);
    }

    productSelect.value = current;
  }

  function renderPins(pins, products, filterId) {
    activeFilterId = (filterId || 'all');

    clearPins();
    const list = filterId && filterId !== "all" ? pins.filter((p) => p.productId === filterId) : pins;
    for (const p of list) {
      const info = products[p.productId];
      addPin(p, info);
    }
    window.__pinSprites = pinsGroup.children.slice();
    setStatus(`bereit ✅ (${list.length} Pins)`);
  }

  // ---- Focus
  let focusAnim = null;

  function focusOnLatLon(lat, lon, distance) {
    if (!controls) return;
    const dirVec = latLonToVector3(lat, lon, 1).normalize();
    const target = new THREE.Vector3(0, 0, 0);
    const dist = distance || Math.max(2.4, Math.min(4.2, camera.position.length()));
    const desiredPos = dirVec.clone().multiplyScalar(dist);

    const startPos = camera.position.clone();
    const startTime = performance.now();
    const dur = 650;
    focusAnim = () => {
      const t = Math.min(1, (performance.now() - startTime) / dur);
      const ease = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
      camera.position.lerpVectors(startPos, desiredPos, ease);
      controls.target.copy(target);
      controls.update();
      if (t >= 1) focusAnim = null;
    };
  }

  // ---- Interaction (Raycast)
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  let selectedSprite = null;

  function setSelected(sprite) {
    if (selectedSprite && selectedSprite.material) {
      selectedSprite.material.opacity = 1;
    }
    selectedSprite = sprite;
    if (selectedSprite && selectedSprite.material) {
      selectedSprite.material.opacity = 0.95;
    }
  }

  function onPointerDown(ev) {
    const rect = canvas.getBoundingClientRect();
    const x = (ev.clientX - rect.left) / rect.width;
    const y = (ev.clientY - rect.top) / rect.height;
    pointer.x = x * 2 - 1;
    pointer.y = -(y * 2 - 1);
    raycaster.setFromCamera(pointer, camera);
    const hits = raycaster.intersectObjects(sprites, false);
    if (!hits.length) {
      hideTooltip();
      setSelected(null);
      return;
    }
    const spr = hits[0].object;
    setSelected(spr);
    const meta = spriteMeta.get(spr);
    if (!meta) return;
    const pin = meta.pin;
    const prod = meta.product;

    const html = `
      <div style="font-weight:700; font-size:14px; margin-bottom:4px;">
        ${safeText(prod.emoji || "")}&nbsp;${safeText(prod.title || prod.id || "Produkt")}
      </div>
      <div style="font-size:12px; opacity:.9;">
        ${safeText(pin.label || pin.name || "")}
      </div>
      <div style="font-size:11px; opacity:.75; margin-top:4px;">
        ${pin.lat.toFixed(2)}, ${pin.lon.toFixed(2)}
      </div>
    `;
    showTooltip(html, ev.clientX + 12, ev.clientY + 12);

    // focus smoothly
    focusOnLatLon(pin.lat, pin.lon);
  }

  canvas.addEventListener("pointerdown", onPointerDown);
  window.addEventListener("scroll", () => hideTooltip(), { passive: true });
  window.addEventListener("resize", () => hideTooltip());

  // ---- Resize
  function resize() {
    const rect = canvas.getBoundingClientRect();
    const w = Math.max(320, Math.floor(rect.width));
    const h = Math.max(420, Math.floor(rect.height));
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  window.addEventListener("resize", resize);

  // ---- Auto-rotate (pause while interacting)
  let autoRotate = true;
  let lastUserActionAt = 0;
  if (controls) {
    controls.addEventListener("start", () => {
      lastUserActionAt = performance.now();
    });
    controls.addEventListener("change", () => {
      lastUserActionAt = performance.now();
    });
  }

  // ---- Boot
  async function boot() {
    setStatus("lädt...");
    resize();

    // load earth texture with robust error handling
    try {
      const earthTex = await new Promise((resolve, reject) => {
        loader.load(
          "/textures/earth.jpg",
          (t) => resolve(t),
          undefined,
          (err) => reject(err)
        );
      });
      earthTex.encoding = THREE.sRGBEncoding;
      earthMat.map = earthTex;
      earthMat.needsUpdate = true;
    } catch (e) {
      console.warn("earth.jpg konnte nicht geladen werden", e);
      earthMat.color = new THREE.Color(0x0b3d2e);
    }

    let pins = [];
    try {
      pins = await loadPins();
    } catch (e) {
      console.error(e);
      setStatus("FEHLER – pins.json fehlt");
      pins = [];
    }

    const tiles = await loadTilesFromBackend();
    const products = buildProductIndex(pins, tiles);
    populateDropdown(products, pins);

    const initialId = qs("id") || "all";
    if (productSelect) productSelect.value = initialId;
    renderPins(pins, products, initialId);

    if (productSelect) {
      productSelect.addEventListener("change", () => {
        hideTooltip();
        const id = productSelect.value;
        const u = new URL(location.href);
        if (id && id !== "all") u.searchParams.set("id", id);
        else u.searchParams.delete("id");
        history.replaceState({}, "", u);
        renderPins(pins, products, id);

        const first = pins.find((p) => (id === "all" ? true : p.productId === id));
        if (first) focusOnLatLon(first.lat, first.lon, 3.2);
      });
    }

    // focus if id present
    if (initialId && initialId !== "all") {
      const first = pins.find((p) => p.productId === initialId);
      if (first) focusOnLatLon(first.lat, first.lon, 3.15);
    }

    tick();
  }

  function tick() {
    // --- Pins: readable, but not overwhelming ---
    // 1) scale with zoom
    // 2) hide/fade pins on the back side of the globe (major declutter)
    const dist = camera.position.length();
    // bigger minimum so you can always recognize the fruit icon
    const baseS = clamp(dist * 0.078, 0.18, 0.34);
    const camDir = camera.position.clone().normalize();
    for (const spr of sprites) {
      const pDir = spr.position.clone().normalize();
      const dot = pDir.dot(camDir); // 1 = front, 0 = rim, <0 = behind
      if (dot < 0.05) {
        spr.visible = false;
        continue;
      }
      spr.visible = true;
      const rimFade = clamp((dot - 0.05) / 0.25, 0.25, 1);
      if (spr.material) {
        spr.material.transparent = true;
        spr.material.opacity = rimFade;
      }
      const s = baseS * (0.85 + 0.35 * rimFade);
      spr.scale.set(s, s, s);
    }

    if (controls) controls.update();

    // auto-rotate if user idle
    const now = performance.now();
    autoRotate = now - lastUserActionAt > 1200;
    if (autoRotate) {
      world.rotation.y += 0.0016;
      glow.rotation.y += 0.0016;
    }

    if (focusAnim) focusAnim();

    renderer.render(scene, camera);
    requestAnimationFrame(tick);
  }

  boot();
})();
