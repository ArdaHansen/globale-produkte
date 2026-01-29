/*
  Globe (three.js) – Globale Produkte
  - Pins: ./pins.json
  - Produktdaten optional: SiteStore.loadAsync() -> /api/site
  - Interaktiv: Drag = drehen, Scroll = zoomen, Klick = Tooltip + Fokus
  - Fokus: /globe.html?id=f03 (z. B. Banane)

  WICHTIG (Fixes):
  - Entfernt doppelte latLonToVector3 / doppelte fetch() / doppelte Render-Loops
  - Nur EIN requestAnimationFrame-Loop (tick)
  - Pins hängen am Earth-Mesh (rotieren korrekt mit dem Globus)
  - Pfade sind relativ (./textures/earth.jpg, ./pins.json) -> funktioniert auch in Unterordnern
*/

(function () {
  const statusEl = document.getElementById("globeStatus");
  const canvas = document.getElementById("globeCanvas");
  const productSelect = document.getElementById("productSelect");
  // Note: HTML uses id="globeTooltip" — ensure we reference that element
  const tooltip = document.getElementById("globeTooltip");

  function setStatus(t) {
    if (statusEl) statusEl.textContent = "Status: " + t;
  }

  function qs(name) {
    const u = new URL(location.href);
    return u.searchParams.get(name);
  }

  function clamp(v, a, b) {
    return Math.max(a, Math.min(b, v));
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
  // Ensure the canvas can receive pointer & wheel events (avoid overlay swallowing events)
  renderer.domElement.style.pointerEvents = "auto";
  renderer.domElement.style.touchAction = "none";
  // three r152+ uses outputColorSpace; older uses outputEncoding.
  if ("outputColorSpace" in renderer) renderer.outputColorSpace = THREE.SRGBColorSpace;
  else renderer.outputEncoding = THREE.sRGBEncoding;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
  camera.position.set(0, 0.12, 3.1);

// Controls (supports BOTH: THREE.OrbitControls, window.OrbitControls or dynamic ES Module)
let controls = null;
let lastUserActionAt = 0;

async function initControls() {
  // try existing globals first
  const tryGetCtor = () => (THREE && THREE.OrbitControls) ? THREE.OrbitControls : (window.OrbitControls || null);
  let OrbitControlsCtor = tryGetCtor();

  // dynamic import fallback (ES Module from CDN) for three r150+ (examples moved to jsm)
  if (!OrbitControlsCtor) {
    // Derive a sensible semver-like version from THREE.REVISION when possible
    let version = '0.152.2'; // safe default
    try {
      const rev = (THREE && THREE.REVISION) ? String(THREE.REVISION) : '';
      if (rev) {
        if (/^\d+$/.test(rev)) {
          // e.g. '152' -> '0.152.0'
          version = `0.${rev}.0`;
        } else if (/^\d+\.\d+\.\d+$/.test(rev)) {
          version = rev;
        } else {
          // fallback to default if format unexpected
          version = `0.${rev}`;
        }
      }
    } catch (err) {
      // ignore and keep default
    }

    const urlsToTry = [
      `https://cdn.jsdelivr.net/npm/three@${version}/examples/jsm/controls/OrbitControls.js`,
      `https://unpkg.com/three@${version}/examples/jsm/controls/OrbitControls.js`,
      // final fallback to a known good version
      `https://cdn.jsdelivr.net/npm/three@0.152.2/examples/jsm/controls/OrbitControls.js`
    ];

    let loaded = false;
    for (const url of urlsToTry) {
      try {
        const mod = await import(url);
        OrbitControlsCtor = mod.OrbitControls || mod.default || null;
        if (OrbitControlsCtor) {
          window.OrbitControls = OrbitControlsCtor;
          if (THREE) THREE.OrbitControls = OrbitControlsCtor;
          console.log("Dynamically loaded OrbitControls from", url);
          loaded = true;
          break;
        }
      } catch (e) {
        console.warn("Dynamic import failed for", url, e);
      }
    }

    if (!loaded) {
      // Last-resort: load legacy (non-module) OrbitControls script via <script> tag
      const legacyUrl = `https://unpkg.com/three@0.128.0/examples/js/controls/OrbitControls.js`;
      try {
        await new Promise((resolve, reject) => {
          const s = document.createElement('script');
          s.src = legacyUrl;
          s.onload = resolve;
          s.onerror = () => reject(new Error('script failed to load: ' + legacyUrl));
          document.head.appendChild(s);
        });
        OrbitControlsCtor = (THREE && THREE.OrbitControls) ? THREE.OrbitControls : (window.OrbitControls || null);
        if (OrbitControlsCtor) {
          console.log('Loaded legacy OrbitControls script', legacyUrl);
          loaded = true;
        }
      } catch (e) {
        console.warn('Loading legacy OrbitControls script failed:', e);
      }
    }
  }

  if (!OrbitControlsCtor) {
    setStatus("FEHLER – OrbitControls nicht geladen (kein Drag/Zoom)");
    console.warn("OrbitControls missing. Add OrbitControls (legacy or ES Module) before globe.js or enable dynamic import.");
    return;
  }

  controls = new OrbitControlsCtor(camera, renderer.domElement);

  controls.enableDamping = true;
  controls.dampingFactor = 0.08;

  controls.enablePan = false;
  controls.enableZoom = true;
  controls.zoomSpeed = 0.9;

  // Mouse button mapping – use THREE constants when available, otherwise try OrbitControls ctor
  const mouseConst = (THREE && THREE.MOUSE) ? THREE.MOUSE : (OrbitControlsCtor.MOUSE || null);
  if (mouseConst) {
    try {
      controls.mouseButtons = {
        LEFT: mouseConst.LEFT ?? mouseConst.ROTATE ?? 0,
        MIDDLE: mouseConst.MIDDLE ?? mouseConst.DOLLY ?? 1,
        RIGHT: mouseConst.RIGHT ?? mouseConst.ROTATE ?? 2
      };
    } catch (e) {
      /* ignore */
    }
  }

  // Touch mapping (for pinch/drag)
  const touchConst = (THREE && THREE.TOUCH) ? THREE.TOUCH : (OrbitControlsCtor.TOUCH || null);
  if (touchConst) {
    try {
      controls.touches = {
        ONE: touchConst.ONE ?? touchConst.ROTATE ?? 0,
        TWO: touchConst.TWO ?? touchConst.DOLLY_PAN ?? 1
      };
    } catch (e) {
      /* ignore */
    }
  }

  controls.enableRotate = true;
  controls.rotateSpeed = 0.6;

  controls.minDistance = 1.8;
  controls.maxDistance = 6.0;
  controls.minPolarAngle = 0.15;
  controls.maxPolarAngle = Math.PI - 0.15;

  // smooth auto rotate (optional)
  controls.autoRotate = true;
  controls.autoRotateSpeed = 0.35;

  controls.addEventListener("start", () => {
    lastUserActionAt = performance.now();
    controls.autoRotate = false;
  });
  controls.addEventListener("end", () => {
    lastUserActionAt = performance.now();
  });

  console.log("OrbitControls initialized:", OrbitControlsCtor.name || OrbitControlsCtor);
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
  earth.add(pinsGroup);

  function latLonToVector3(lat, lon, radius) {
    const phi = (90 - lat) * (Math.PI / 180);
    const theta = (lon + 180) * (Math.PI / 180);
    const x = -radius * Math.sin(phi) * Math.cos(theta);
    const z = radius * Math.sin(phi) * Math.sin(theta);
    const y = radius * Math.cos(phi);
    return new THREE.Vector3(x, y, z);
  }

  // High‑contrast emoji badge texture
  function makeEmojiTexture(emoji, bg, fg) {
    const size = 320;
    const c = document.createElement("canvas");
    c.width = size;
    c.height = size;
    const ctx = c.getContext("2d");

    // soft shadow
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
    ctx.fillStyle = bg || "#ff6a3d";
    ctx.fill();

    // thick ring
    ctx.lineWidth = size * 0.075;
    ctx.strokeStyle = "rgba(255,255,255,0.98)";
    ctx.stroke();

    // inner ring
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size * 0.36, 0, Math.PI * 2);
    ctx.lineWidth = size * 0.02;
    ctx.strokeStyle = "rgba(0,0,0,0.10)";
    ctx.stroke();

    // emoji
    ctx.font = `${Math.floor(size * 0.68)}px "Segoe UI Emoji","Apple Color Emoji","Noto Color Emoji","Twemoji Mozilla",system-ui,sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = fg || "#000";

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
    if ("colorSpace" in tex) tex.colorSpace = THREE.SRGBColorSpace;
    else tex.encoding = THREE.sRGBEncoding;
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
    const res = await fetch("./pins.json", { cache: "no-store" });
    if (!res.ok) throw new Error("pins.json nicht gefunden");
    const json = await res.json();
    if (Array.isArray(json)) return json;
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
  let activeFilterId = "all";

  function clearPins() {
    while (pinsGroup.children.length) pinsGroup.remove(pinsGroup.children[0]);
    sprites.length = 0;
  }

  function colorByProductId(id) {
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

  function addPin(pin, productInfo) {
    const emoji = (productInfo && productInfo.emoji) || pin.emoji || "📍";
    const bg = (productInfo && productInfo.color) || pin.color || "#ff6a3d";
    const tex = makeEmojiTexture(emoji, bg);

    const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false, depthWrite: false });
    const spr = new THREE.Sprite(mat);

    const pos = latLonToVector3(pin.lat, pin.lon, R + 0.02);
    spr.position.copy(pos);

    spr.userData.baseScale = activeFilterId === "all" ? 0.18 : 0.22;
    spr.scale.setScalar(spr.userData.baseScale);

    pinsGroup.add(spr);
    sprites.push(spr);

    spriteMeta.set(spr, {
      pin,
      product: productInfo || { id: pin.productId, title: pin.productTitle, emoji },
    });
  }

  function renderPins(pins, products, filterId) {
    activeFilterId = filterId || "all";
    clearPins();

    const list = activeFilterId !== "all" ? pins.filter((p) => p.productId === activeFilterId) : pins;
    for (const p of list) addPin(p, products[p.productId]);

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

  // ---- Interaction
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  let selectedSprite = null;

  function setSelected(sprite) {
    if (selectedSprite && selectedSprite.material) selectedSprite.material.opacity = 1;
    selectedSprite = sprite;
    if (selectedSprite && selectedSprite.material) selectedSprite.material.opacity = 0.98;
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
        ${Number(pin.lat).toFixed(2)}, ${Number(pin.lon).toFixed(2)}
      </div>
    `;
    showTooltip(html, ev.clientX + 12, ev.clientY + 12);

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

  // ---- Auto-rotate
  // Auto-rotate is handled by OrbitControls event listeners (see controls setup above).

  async function boot() {
    setStatus("lädt...");
    resize();

    // earth texture
    try {
      const earthTex = await new Promise((resolve, reject) => {
        loader.load(
          "./textures/earth.jpg",
          (t) => resolve(t),
          undefined,
          (err) => reject(err)
        );
      });
      if ("colorSpace" in earthTex) earthTex.colorSpace = THREE.SRGBColorSpace;
      else earthTex.encoding = THREE.sRGBEncoding;
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

    if (initialId && initialId !== "all") {
      const first = pins.find((p) => p.productId === initialId);
      if (first) focusOnLatLon(first.lat, first.lon, 3.15);
    }

    // Initialize controls (try global, then dynamic ES module fallback)
    try {
      await initControls();
    } catch (e) {
      console.warn('initControls error', e);
    }

    tick();
  }

  function tick() {
    // Pin scaling + back-side declutter
    const dist = camera.position.length();
    const baseS = clamp(dist * 0.08, 0.18, 0.32);
    const camDir = camera.position.clone().normalize();

    for (const spr of sprites) {
      const worldPos = spr.getWorldPosition(new THREE.Vector3()).normalize();
      const dot = worldPos.dot(camDir);

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

    // Controls must be updated each frame for damping and auto-rotate functionality
    if (controls) controls.update();

    const now = performance.now();
    if (now - lastUserActionAt > 1200) {
      if (controls) controls.autoRotate = true;
    }

    if (focusAnim) focusAnim();

    renderer.render(scene, camera);
    requestAnimationFrame(tick);
  }

  // Prevent page scroll while zooming (important) + pointer capture (no-op)
  canvas.addEventListener("wheel", (e) => {
    e.preventDefault();
  }, { passive: false });

  renderer.domElement.addEventListener("pointerdown", () => {
    // no-op: ensures pointer events are captured by the canvas
  });

  boot();
})();
