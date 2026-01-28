(function () {
  const statusEl = document.getElementById("globeStatus");
  const canvas = document.getElementById("globeCanvas");
  const tooltip = document.getElementById("globeTooltip");

  function setStatus(t) { if (statusEl) statusEl.textContent = "Status: " + t; }
  function setHint(t) { const el = document.getElementById("globeHint"); if (el) el.textContent = t || ""; }

  if (!canvas) { console.error("globeCanvas missing"); return; }
  if (!window.THREE) { setStatus("FEHLER – three.js wurde nicht geladen (THREE fehlt)."); return; }
  if (!THREE.WebGLRenderer) { setStatus("FEHLER – WebGLRenderer fehlt (three.js unvollständig)."); return; }

  try {
    const test = document.createElement("canvas");
    const gl = test.getContext("webgl") || test.getContext("experimental-webgl");
    if (!gl) { setStatus("FEHLER – WebGL ist deaktiviert/nicht verfügbar."); return; }
  } catch (e) { setStatus("FEHLER – WebGL Check fehlgeschlagen."); return; }

  const params = new URLSearchParams(location.search);
  const focusId = params.get("id");
  const focusPinIndex = Number(params.get("pin") || "0");

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
  camera.position.set(0, 0.15, 3.2);

  let controls = null;
  if (THREE.OrbitControls) {
    controls = new THREE.OrbitControls(camera, canvas);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.enablePan = false;
    controls.minDistance = 2.0;
    controls.maxDistance = 6.0;
    controls.rotateSpeed = 0.6;
    controls.zoomSpeed = 1.0;
  } else {
    setHint("Hinweis: OrbitControls fehlen – nur Auto-Rotation.");
  }

  scene.add(new THREE.AmbientLight(0xffffff, 0.85));
  const dir = new THREE.DirectionalLight(0xffffff, 0.85);
  dir.position.set(3, 2, 2);
  scene.add(dir);

  const group = new THREE.Group();
  scene.add(group);

  const R = 1.18;

  const loader = new THREE.TextureLoader();
  const earthTex = loader.load(
    "/textures/earth.jpg",
    () => {},
    undefined,
    () => { console.warn("earth texture failed to load: /textures/earth.jpg"); }
  );
  earthTex.colorSpace = THREE.SRGBColorSpace;
  earthTex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());

  const globe = new THREE.Mesh(
    new THREE.SphereGeometry(R, 96, 96),
    new THREE.MeshStandardMaterial({
      map: earthTex,
      roughness: 0.95,
      metalness: 0.05
    })
  );
  group.add(globe);

  const atmosphere = new THREE.Mesh(
    new THREE.SphereGeometry(R * 1.03, 96, 96),
    new THREE.MeshBasicMaterial({
      color: 0x7fffd4,
      transparent: true,
      opacity: 0.06
    })
  );
  group.add(atmosphere);

  const pinGroup = new THREE.Group();
  group.add(pinGroup);

  function latLonToVec3(lat, lon, radius) {
    const phi = (90 - lat) * Math.PI / 180;
    const theta = (lon + 180) * Math.PI / 180;
    const x = -radius * Math.sin(phi) * Math.cos(theta);
    const z =  radius * Math.sin(phi) * Math.sin(theta);
    const y =  radius * Math.cos(phi);
    return new THREE.Vector3(x, y, z);
  }

  function createPinMesh() {
    const geom = new THREE.ConeGeometry(0.028, 0.12, 16);
    const mat = new THREE.MeshStandardMaterial({ color: 0xff5a3d, roughness: 0.6, metalness: 0.0 });
    return new THREE.Mesh(geom, mat);
  }

  function addPin(lat, lon, label, productId) {
    const pos = latLonToVec3(lat, lon, R + 0.03);
    const pin = createPinMesh();
    pin.position.copy(pos);
    pin.lookAt(latLonToVec3(lat, lon, R + 0.25));
    pin.userData = { label, lat, lon, productId };
    pinGroup.add(pin);
    return pin;
  }

  const raycaster = new THREE.Raycaster();
  const mouse = new THREE.Vector2(-10, -10);
  let hovered = null;

  function onPointerMove(ev) {
    const rect = canvas.getBoundingClientRect();
    const x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
    const y = -(((ev.clientY - rect.top) / rect.height) * 2 - 1);
    mouse.set(x, y);
    window.__lastMouseEvent = ev;
  }
  canvas.addEventListener("pointermove", onPointerMove, { passive: true });

  function showTooltip(ev, text) {
    if (!tooltip) return;
    tooltip.style.display = "block";
    tooltip.textContent = text;
    tooltip.style.left = (ev.clientX + 12) + "px";
    tooltip.style.top = (ev.clientY + 12) + "px";
  }
  function hideTooltip() { if (tooltip) tooltip.style.display = "none"; }

  function resize() {
    const rect = canvas.getBoundingClientRect();
    const w = Math.max(320, Math.floor(rect.width));
    const h = Math.max(420, Math.floor(rect.height));
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  window.addEventListener("resize", resize);

  async function loadPinsJSON() {
    const res = await fetch("/pins.json", { cache: "no-store" });
    if (!res.ok) throw new Error("pins.json not found");
    return await res.json();
  }

  function flattenPins(pinsJson) {
    const products = pinsJson?.products || {};
    const out = [];
    for (const [pid, p] of Object.entries(products)) {
      const list = Array.isArray(p.pins) ? p.pins : [];
      for (const pin of list) {
        out.push({
          productId: pid,
          productName: p.name || pid,
          name: pin.name,
          lat: Number(pin.lat),
          lon: Number(pin.lon)
        });
      }
    }
    return out;
  }

  function clearPins() {
    while (pinGroup.children.length) pinGroup.remove(pinGroup.children[0]);
  }

  const focusAnim = { active: false, t: 0, fromX: 0, fromY: 0, toX: 0, toY: 0, fromD: 0, toD: 0 };

  function focusCameraOn(lat, lon) {
    const phi = (90 - lat) * Math.PI / 180;
    const theta = (lon + 180) * Math.PI / 180;

    const targetRotY = theta - Math.PI;
    const targetRotX = (phi - Math.PI / 2) * 0.6;

    focusAnim.active = true;
    focusAnim.t = 0;
    focusAnim.fromY = group.rotation.y;
    focusAnim.fromX = group.rotation.x;
    focusAnim.toY = targetRotY;
    focusAnim.toX = targetRotX;

    if (controls) {
      controls.target.set(0, 0, 0);
      const d = controls.getDistance();
      focusAnim.fromD = d;
      focusAnim.toD = Math.max(2.4, Math.min(3.2, d));
    }
  }

  function stepFocus(dt) {
    if (!focusAnim.active) return;
    focusAnim.t += dt;
    const p = Math.min(1, focusAnim.t / 0.9);
    const e = 1 - Math.pow(1 - p, 3);

    group.rotation.y = focusAnim.fromY + (focusAnim.toY - focusAnim.fromY) * e;
    group.rotation.x = focusAnim.fromX + (focusAnim.toX - focusAnim.fromX) * e;

    if (controls) {
      const d = focusAnim.fromD + (focusAnim.toD - focusAnim.fromD) * e;
      const dir = camera.position.clone().normalize();
      camera.position.copy(dir.multiplyScalar(d));
      controls.update();
    }

    if (p >= 1) focusAnim.active = false;
  }

  let allPins = [];
  let pinsForView = [];

  async function init() {
    resize();
    setStatus("lädt…");

    try {
      const pinsJson = await loadPinsJSON();
      allPins = flattenPins(pinsJson);

      pinsForView = focusId ? allPins.filter(p => p.productId === focusId) : allPins.slice();

      clearPins();

      if (pinsForView.length === 0) {
        setStatus("bereit ✅ (keine Pins für diese Auswahl)");
      } else {
        for (const p of pinsForView) addPin(p.lat, p.lon, `${p.productName}: ${p.name}`, p.productId);
        setStatus(`bereit ✅ (${pinsForView.length} Pins)`);

        if (focusId) {
          const idx = Math.max(0, Math.min(focusPinIndex, pinsForView.length - 1));
          const fp = pinsForView[idx];
          if (fp) focusCameraOn(fp.lat, fp.lon);
        }
      }

      const focusName = (pinsForView[0]?.productName) || "";
      if (focusId) setHint(`Fokus: ${focusId}${focusName ? " – " + focusName : ""} • Tipp: ?id=f03&pin=0`);
      else setHint("Alle Produkte • Tipp: ?id=f03 (z. B. Banane)");
    } catch (e) {
      console.error(e);
      setStatus("FEHLER – pins.json fehlt oder ist kaputt.");
      setHint("Lege public/pins.json an und lade neu.");
    }
  }

  let last = performance.now();
  function tick(now) {
    const dt = (now - last) / 1000;
    last = now;

    globe.rotation.y += 0.0016;
    atmosphere.rotation.y += 0.0016;

    raycaster.setFromCamera(mouse, camera);
    const hits = raycaster.intersectObjects(pinGroup.children, false);
    const hit = hits[0]?.object || null;

    if (hit !== hovered) {
      hovered = hit;
      if (!hovered) hideTooltip();
    }

    if (hovered && window.__lastMouseEvent && tooltip) {
      showTooltip(window.__lastMouseEvent, hovered.userData.label);
    }

    stepFocus(dt);
    if (controls) controls.update();
    renderer.render(scene, camera);
    requestAnimationFrame(tick);
  }

  init().then(() => requestAnimationFrame(tick));
})();


