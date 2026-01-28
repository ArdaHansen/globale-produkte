(function () {
  const statusEl = document.getElementById("globeStatus");
  const canvas = document.getElementById("globeCanvas");

  function setStatus(t) {
    if (statusEl) statusEl.textContent = "Status: " + t;
  }

  /* =========================
     Checks
  ========================== */
  if (!window.THREE) {
    setStatus("FEHLER – three.js nicht geladen (THREE fehlt).");
    return;
  }

  try {
    const test = document.createElement("canvas");
    const gl = test.getContext("webgl") || test.getContext("experimental-webgl");
    if (!gl) {
      setStatus("FEHLER – WebGL nicht verfügbar.");
      return;
    }
  } catch (e) {
    setStatus("FEHLER – WebGL-Check fehlgeschlagen.");
    return;
  }

  /* =========================
     Renderer / Scene / Camera
  ========================== */
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true,
  });

  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();

  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
  camera.position.set(0, 0.15, 3.2);

  /* =========================
     Controls (optional)
  ========================== */
  let controls = null;
  if (THREE.OrbitControls) {
    controls = new THREE.OrbitControls(camera, canvas);
    controls.enableDamping = true;
    controls.enablePan = false;
    controls.minDistance = 2.0;
    controls.maxDistance = 6.0;
  } else {
    setStatus("Hinweis – OrbitControls fehlen, Drag deaktiviert.");
  }

  /* =========================
     Lights (weicher + teurer)
  ========================== */
  scene.add(new THREE.AmbientLight(0xffffff, 0.70));

  const key = new THREE.DirectionalLight(0xffffff, 1.0);
  key.position.set(3, 2, 2);
  scene.add(key);

  // leichtes "Rim light" (gibt Edge-Glow)
  const rim = new THREE.DirectionalLight(0x9fffe6, 0.35);
  rim.position.set(-3, 0.6, -2);
  scene.add(rim);

  /* =========================
     Earth Texture
  ========================== */
  const textureLoader = new THREE.TextureLoader();

  const earthTexture = textureLoader.load(
    "/textures/earth.jpg",
    () => setStatus("bereit ✅ (drag = drehen, scroll = zoomen)"),
    undefined,
    () => setStatus("FEHLER – earth.jpg nicht gefunden (/textures/earth.jpg)")
  );

  // bessere Filterung (macht Textur sauberer)
  earthTexture.colorSpace = THREE.SRGBColorSpace;

  /* =========================
     Globe
  ========================== */
  const R = 1.18;

  const globeMat = new THREE.MeshStandardMaterial({
    map: earthTexture,
    roughness: 0.65,
    metalness: 0.05,
  });

  // anisotropy = schärfer bei schrägem Blick
  earthTexture.anisotropy = renderer.capabilities.getMaxAnisotropy();

  const globe = new THREE.Mesh(
    // mehr Segmente = glatter
    new THREE.SphereGeometry(R, 128, 128),
    globeMat
  );
  scene.add(globe);

  /* =========================
     Subtiler Glow
  ========================== */
  const glow = new THREE.Mesh(
    new THREE.SphereGeometry(R * 1.03, 96, 96),
    new THREE.MeshBasicMaterial({
      color: 0x46f7c5,
      transparent: true,
      opacity: 0.07,
    })
  );
  scene.add(glow);

  /* =========================
     Resize
  ========================== */
  function resize() {
    const rect = canvas.getBoundingClientRect();
    const w = Math.max(320, Math.floor(rect.width));
    const h = Math.max(420, Math.floor(rect.height));
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }

  let tries = 0;
  function resizeUntilReady() {
    resize();
    const r = canvas.getBoundingClientRect();
    if ((r.width < 10 || r.height < 10) && tries < 60) {
      tries++;
      requestAnimationFrame(resizeUntilReady);
      return;
    }
  }

  window.addEventListener("resize", resize);
  resizeUntilReady();

  /* =========================
     Render Loop
  ========================== */
  function animate() {
    globe.rotation.y += 0.002;
    glow.rotation.y += 0.002;

    if (controls) controls.update();
    renderer.render(scene, camera);
    requestAnimationFrame(animate);
  }

  animate();
})();
