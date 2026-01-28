(function () {
  const canvas = document.getElementById("globeCanvas");
  const statusEl = document.getElementById("globeStatus");

  function setStatus(t) {
    if (statusEl) statusEl.textContent = "Status: " + t;
  }

  /* ================================
     BASIC CHECKS
  ================================= */
  if (!window.THREE) {
    setStatus("FEHLER – three.js nicht geladen");
    return;
  }

  /* ================================
     LOAD SITE DATA (Hybrid Store)
  ================================= */
  async function loadSiteData() {
    if (window.SiteStore?.loadAsync) {
      return await SiteStore.loadAsync();
    }
    return window.DEFAULT_SITE_DATA || null;
  }

  /* ================================
     SCENE / CAMERA / RENDERER
  ================================= */
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true
  });

  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

  const scene = new THREE.Scene();

  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
  camera.position.set(0, 0.15, 3.2);

  /* ================================
     CONTROLS (ZOOM + ROTATE)
  ================================= */
  let controls = null;
  if (THREE.OrbitControls) {
    controls = new THREE.OrbitControls(camera, canvas);
    controls.enableDamping = true;
    controls.enablePan = false;
    controls.minDistance = 2.0;
    controls.maxDistance = 6.0;
  }

  /* ================================
     LIGHTS
  ================================= */
  scene.add(new THREE.AmbientLight(0xffffff, 0.9));
  const dir = new THREE.DirectionalLight(0xffffff, 0.8);
  dir.position.set(3, 2, 2);
  scene.add(dir);

  /* ================================
     GLOBE
  ================================= */
  const R = 1.18;

  const globe = new THREE.Mesh(
    new THREE.SphereGeometry(R, 64, 64),
    new THREE.MeshStandardMaterial({
      color: 0x0b3d2e,
      roughness: 0.85,
      metalness: 0.15
    })
  );
  scene.add(globe);

  const glow = new THREE.Mesh(
    new THREE.SphereGeometry(R * 1.03, 64, 64),
    new THREE.MeshBasicMaterial({
      color: 0x46f7c5,
      transparent: true,
      opacity: 0.08
    })
  );
  scene.add(glow);

  /* ================================
     RESIZE
  ================================= */
  function resize() {
    const rect = canvas.getBoundingClientRect();
    const w = Math.max(320, rect.width);
    const h = Math.max(420, rect.height);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }

  window.addEventListener("resize", resize);
  resize();

  /* ================================
     PINS
  ================================= */
  const pinsGroup = new THREE.Group();
  scene.add(pinsGroup);

  function latLonToVec3(lat, lon, radius) {
    const phi = (90 - lat) * Math.PI / 180;
    const theta = (lon + 180) * Math.PI / 180;
    return new THREE.Vector3(
      -radius * Math.sin(phi) * Math.cos(theta),
       radius * Math.cos(phi),
       radius * Math.sin(phi) * Math.sin(theta)
    );
  }

  function makePin() {
    const dot = new THREE.Mesh(
      new THREE.SphereGeometry(0.022, 16, 16),
      new THREE.MeshBasicMaterial({ color: 0x22b356 })
    );

    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.03, 0.055, 32),
      new THREE.MeshBasicMaterial({
        color: 0x7cf0b4,
        transparent: true,
        opacity: 0.35,
        side: THREE.DoubleSide
      })
    );
    ring.rotation.x = Math.PI / 2;

    const g = new THREE.Group();
    g.add(dot);
    g.add(ring);
    return g;
  }

  async function buildPins() {
    const data = await loadSiteData();
    if (!data) {
      setStatus("FEHLER – keine Daten");
      return;
    }

    pinsGroup.clear();

    Object.entries(data.pages || {}).forEach(([id, page]) => {
      if (!Array.isArray(page.origins)) return;

      page.origins.forEach(o => {
        const pin = makePin();
        pin.position.copy(
          latLonToVec3(o.lat, o.lon, R * 1.01)
        );
        pin.lookAt(0, 0, 0);

        pin.userData = {
          productId: id,
          title: page.title,
          origin: o.name
        };

        pinsGroup.add(pin);
      });
    });

    setStatus("Pins geladen ✅");
  }

  buildPins();

  /* ================================
     OPTIONAL: FOCUS VIA URL (?id=f03)
  ================================= */
  function focusOnProduct(productId) {
    const pin = pinsGroup.children.find(
      p => p.userData?.productId === productId
    );
    if (!pin) return;

    const target = pin.position.clone().normalize().multiplyScalar(2.6);
    camera.position.copy(target);
    camera.lookAt(0, 0, 0);
    if (controls) controls.update();
  }

  const params = new URLSearchParams(window.location.search);
  const focusId = params.get("id");
  if (focusId) {
    setTimeout(() => focusOnProduct(focusId), 600);
  }

  /* ================================
     ANIMATION LOOP
  ================================= */
  function animate() {
    globe.rotation.y += 0.0015;
    glow.rotation.y += 0.0015;

    if (controls) controls.update();
    renderer.render(scene, camera);
    requestAnimationFrame(animate);
  }

  animate();
})();

