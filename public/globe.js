/* globe.js – EcoSupply / Globale Produkte */

(async function () {
  const canvas = document.getElementById("globeCanvas");
  const statusEl = document.getElementById("globeStatus");

  function setStatus(t) {
    if (statusEl) statusEl.textContent = "Status: " + t;
  }

  // === Safety Checks ===
  if (!canvas) {
    console.error("globeCanvas fehlt");
    return;
  }
  if (!window.THREE) {
    setStatus("FEHLER – three.js fehlt");
    return;
  }

  // === Load data from backend ===
  let siteData;
  try {
    siteData = await SiteStore.loadAsync();
  } catch (e) {
    console.error(e);
    setStatus("FEHLER – Daten konnten nicht geladen werden");
    return;
  }

  // === Collect origins ===
  const origins = [];
  Object.values(siteData.pages || {}).forEach(p => {
    if (Array.isArray(p.origins)) {
      p.origins.forEach(o => {
        if (typeof o.lat === "number" && typeof o.lon === "number") {
          origins.push(o);
        }
      });
    }
  });

  // === Scene ===
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  const scene = new THREE.Scene();

  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
  camera.position.set(0, 0, 3.2);

  // === Controls ===
  const controls = new THREE.OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.enablePan = false;
  controls.minDistance = 2.0;
  controls.maxDistance = 6.0;

  // === Lights ===
  scene.add(new THREE.AmbientLight(0xffffff, 0.9));
  const sun = new THREE.DirectionalLight(0xffffff, 0.8);
  sun.position.set(5, 3, 5);
  scene.add(sun);

  // === Earth texture (FIXED PATH) ===
  const textureLoader = new THREE.TextureLoader();
  const earthTexture = textureLoader.load(
    "/textures/earth.jpg",
    () => setStatus(origins.length ? "bereit ✅" : "bereit (keine Origins → keine Pins)"),
    undefined,
    () => setStatus("FEHLER – earth.jpg nicht gefunden")
  );

  // === Globe ===
  const R = 1.15;
  const globe = new THREE.Mesh(
    new THREE.SphereGeometry(R, 64, 64),
    new THREE.MeshStandardMaterial({
      map: earthTexture,
      roughness: 1,
      metalness: 0
    })
  );
  scene.add(globe);

  // === Atmosphere glow ===
  const glow = new THREE.Mesh(
    new THREE.SphereGeometry(R * 1.02, 64, 64),
    new THREE.MeshBasicMaterial({
      color: 0x4efacb,
      transparent: true,
      opacity: 0.08
    })
  );
  scene.add(glow);

  // === Helpers ===
  function latLonToVec3(lat, lon, r) {
    const phi = (90 - lat) * Math.PI / 180;
    const theta = (lon + 180) * Math.PI / 180;
    return new THREE.Vector3(
      -r * Math.sin(phi) * Math.cos(theta),
       r * Math.cos(phi),
       r * Math.sin(phi) * Math.sin(theta)
    );
  }

  // === Pins ===
  const pinMat = new THREE.MeshBasicMaterial({ color: 0xff4444 });
  origins.forEach(o => {
    const pin = new THREE.Mesh(
      new THREE.SphereGeometry(0.025, 8, 8),
      pinMat
    );
    pin.position.copy(latLonToVec3(o.lat, o.lon, R + 0.02));
    globe.add(pin);
  });

  // === Resize ===
  function resize() {
    const rect = canvas.getBoundingClientRect();
    const w = Math.max(300, rect.width);
    const h = Math.max(300, rect.height);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  window.addEventListener("resize", resize);
  resize();

  // === Render loop ===
  function animate() {
    globe.rotation.y += 0.0015; // auto rotation
    controls.update();
    renderer.render(scene, camera);
    requestAnimationFrame(animate);
  }
  animate();

})();



