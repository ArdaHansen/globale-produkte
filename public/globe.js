/* globe.js - FULL FIX (Backend + Fallback + Pins + Fokus) */
(function () {
  const statusEl = document.getElementById("globeStatus");
  const canvas = document.getElementById("globeCanvas");

  function setStatus(t) {
    if (statusEl) statusEl.textContent = "Status: " + t;
  }

  if (!canvas) {
    console.error("[Globe] #globeCanvas fehlt");
    return;
  }

  // ===========
  // CONFIG
  // ===========
  // WICHTIG: Passe den Pfad an deine echte Datei an!
  // Beispiele:
  // const EARTH_TEX_URL = "/assets/earth/earth_day_4k.jpg";
  // const EARTH_TEX_URL = "/earth_day_4k.jpg";
  const EARTH_TEX_URL = "/earth_day_4k.jpg";

  const R = 1.18; // Radius Kugel
  const PIN_RADIUS = 0.028;
  const PIN_OFFSET = 0.012; // minimal über Oberfläche

  // ===========
  // Checks
  // ===========
  if (!window.THREE || !THREE.WebGLRenderer) {
    setStatus("FEHLER – three.js fehlt/ist unvollständig.");
    return;
  }

  // WebGL check
  try {
    const test = document.createElement("canvas");
    const gl = test.getContext("webgl") || test.getContext("experimental-webgl");
    if (!gl) {
      setStatus("FEHLER – WebGL ist deaktiviert/nicht verfügbar.");
      return;
    }
  } catch (e) {
    setStatus("FEHLER – WebGL Check fehlgeschlagen.");
    return;
  }

  // ===========
  // Helpers
  // ===========
  function getQueryParam(name) {
    const p = new URLSearchParams(location.search);
    return p.get(name);
  }

  function clamp(n, a, b) {
    return Math.max(a, Math.min(b, n));
  }

  function latLonToVec3(lat, lon, radius) {
    // lat: -90..90, lon: -180..180
    const phi = (90 - lat) * (Math.PI / 180);
    const theta = (lon + 180) * (Math.PI / 180);

    const x = radius * Math.sin(phi) * Math.cos(theta);
    const y = radius * Math.cos(phi);
    const z = radius * Math.sin(phi) * Math.sin(theta);

    return new THREE.Vector3(x, y, z);
  }

  function safeOriginsFromData(data) {
    const pages = data && data.pages ? data.pages : {};
    const out = [];

    for (const [pageId, page] of Object.entries(pages)) {
      const title = page?.title || pageId;
      const hero = page?.hero || title;
      const origins = Array.isArray(page?.origins) ? page.origins : [];

      for (const o of origins) {
        const lat = Number(o.lat);
        const lon = Number(o.lon);
        if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;

        out.push({
          pageId,
          label: `${hero} – ${o.name || "Herkunft"}`,
          lat: clamp(lat, -90, 90),
          lon: ((lon + 180) % 360) - 180
        });
      }
    }
    return out;
  }

  async function loadSiteData() {
    // 1) Backend async
    try {
      if (window.SiteStore && typeof window.SiteStore.loadAsync === "function") {
        const d = await window.SiteStore.loadAsync();
        if (d && d.pages && d.tiles) return d;
      }
    } catch (e) {}

    // 2) Sync store
    try {
      if (window.SiteStore && typeof window.SiteStore.load === "function") {
        const d = window.SiteStore.load();
        if (d && d.pages && d.tiles) return d;
      }
    } catch (e) {}

    // 3) Default fallback
    if (window.DEFAULT_SITE_DATA && window.DEFAULT_SITE_DATA.pages) {
      return window.DEFAULT_SITE_DATA;
    }

    return null;
  }

  // ===========
  // Three Setup
  // ===========
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
  camera.position.set(0, 0.15, 3.2);

  // Controls (OrbitControls muss in globe.html geladen sein)
  let controls = null;
  if (THREE.OrbitControls) {
    controls = new THREE.OrbitControls(camera, canvas);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.enablePan = false;
    controls.minDistance = 2.0;
    controls.maxDistance = 6.0;
    controls.zoomSpeed = 0.9;
    controls.rotateSpeed = 0.55;
  } else {
    setStatus("Hinweis – OrbitControls fehlen (Drag/Zoom deaktiviert).");
  }

  // Lights
  scene.add(new THREE.AmbientLight(0xffffff, 0.9));
  const dir = new THREE.DirectionalLight(0xffffff, 0.9);
  dir.position.set(3, 2, 2);
  scene.add(dir);

  // Globe group (alles hier drin, damit wir easy rotieren/fokussieren)
  const globeGroup = new THREE.Group();
  scene.add(globeGroup);

  // Globe material (erst mal fallback grün)
  const globeMat = new THREE.MeshStandardMaterial({
    color: 0x0b3d2e,
    roughness: 0.92,
    metalness: 0.05
  });

  const globe = new THREE.Mesh(new THREE.SphereGeometry(R, 64, 64), globeMat);
  globeGroup.add(globe);

  // Glow
  const glow = new THREE.Mesh(
    new THREE.SphereGeometry(R * 1.03, 64, 64),
    new THREE.MeshBasicMaterial({ color: 0x46f7c5, transparent: true, opacity: 0.07 })
  );
  globeGroup.add(glow);

  // Pins group
  const pinsGroup = new THREE.Group();
  globeGroup.add(pinsGroup);

  function clearPins() {
    while (pinsGroup.children.length) {
      const c = pinsGroup.children.pop();
      if (c.geometry) c.geometry.dispose();
      if (c.material) c.material.dispose();
    }
  }

  function addPin(lat, lon, label, pageId) {
    const pos = latLonToVec3(lat, lon, R + PIN_OFFSET);

    const pin = new THREE.Mesh(
      new THREE.SphereGeometry(PIN_RADIUS, 18, 18),
      new THREE.MeshStandardMaterial({
        color: 0x22b356,
        emissive: 0x0b3d2e,
        emissiveIntensity: 0.6,
        roughness: 0.35,
        metalness: 0.1
      })
    );
    pin.position.copy(pos);
    pin.userData = { label, pageId, lat, lon };
    pinsGroup.add(pin);

    return pin;
  }

  // Resize
  function resize() {
    const rect = canvas.getBoundingClientRect();
    const w = Math.max(320, Math.floor(rect.width));
    const h = Math.max(320, Math.floor(rect.height));
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  window.addEventListener("resize", resize);
  resize();

  // ===========
  // Texture loader (macht den Globe realistisch)
  // ===========
  function loadEarthTexture(url) {
    return new Promise((resolve, reject) => {
      const loader = new THREE.TextureLoader();
      loader.setCrossOrigin("anonymous");
      loader.load(
        url,
        (tex) => {
          tex.colorSpace = THREE.SRGBColorSpace || undefined;
          tex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy?.() || 8);
          resolve(tex);
        },
        undefined,
        (err) => reject(err)
      );
    });
  }

  // ===========
  // Fokus auf Produkt (z.B. globe.html?id=f03)
  // ===========
  let targetQuat = null;

  function focusOnLatLon(lat, lon) {
    // Punkt-Vektor in Globe-Local
    const v = latLonToVec3(lat, lon, 1).normalize();
    // Wir wollen, dass dieser Punkt nach vorne (+Z) zeigt
    const target = new THREE.Vector3(0, 0, 1);
    const q = new THREE.Quaternion().setFromUnitVectors(v, target);
    targetQuat = q;
  }

  function focusOnPageId(data, pageId) {
    const page = data?.pages?.[pageId];
    const origins = Array.isArray(page?.origins) ? page.origins : [];
    if (!origins.length) return false;

    const o = origins[0];
    const lat = Number(o.lat), lon = Number(o.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return false;

    focusOnLatLon(lat, lon);
    return true;
  }

  // ===========
  // Init / Data
  // ===========
  (async function init() {
    setStatus("lädt…");

    // 1) Textur laden (wenn Pfad falsch -> bleibt grün, aber läuft)
    try {
      const tex = await loadEarthTexture(EARTH_TEX_URL);
      globeMat.map = tex;
      globeMat.color.setHex(0xffffff); // wichtig: Map soll “pur” wirken
      globeMat.needsUpdate = true;
    } catch (e) {
      console.warn("[Globe] Textur nicht geladen:", e);
      // Kein Hard-Error: Globe läuft trotzdem weiter
    }

    // 2) Daten laden (Backend/Fallback)
    const data = await loadSiteData();

    clearPins();

    if (!data) {
      setStatus("bereit ✅ (ohne Daten / ohne Pins)");
      return;
    }

    const origins = safeOriginsFromData(data);

    if (!origins.length) {
      setStatus("bereit ✅ (keine Origins → keine Pins)");
    } else {
      // Pins für alle Produkte
      for (const o of origins) addPin(o.lat, o.lon, o.label, o.pageId);
      setStatus(`bereit ✅ (${origins.length} Pins)`);
    }

    // 3) Wenn ?id=f03 gesetzt -> Fokus darauf
    const focusId = getQueryParam("id");
    if (focusId) {
      const ok = focusOnPageId(data, focusId);
      if (!ok) {
        // fallback: falls keine origins, einfach Status
        console.warn("[Globe] Fokus-ID hat keine origins:", focusId);
      }
    }
  })();

  // ===========
  // Render loop
  // ===========
  const clock = new THREE.Clock();

  function tick() {
    const dt = clock.getDelta();

    // Auto-rotate leicht, aber NICHT wenn user dreht
    if (!controls || !controls.dragging) {
      globeGroup.rotation.y += 0.10 * dt;
    }

    // Glow mitdrehen
    glow.rotation.y += 0.10 * dt;

    // Smooth focus (Quaternion slerp)
    if (targetQuat) {
      globeGroup.quaternion.slerp(targetQuat, 0.06);
      // wenn nah genug, stoppen
      if (globeGroup.quaternion.angleTo(targetQuat) < 0.003) {
        globeGroup.quaternion.copy(targetQuat);
        targetQuat = null;
      }
    }

    if (controls) controls.update();
    renderer.render(scene, camera);
    requestAnimationFrame(tick);
  }

  tick();
})();


