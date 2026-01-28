(function () {
  const statusEl = document.getElementById("globeStatus");
  const canvas = document.getElementById("globeCanvas");

  function setStatus(t) {
    if (statusEl) statusEl.textContent = "Status: " + t;
  }

  if (!canvas) {
    console.error("globeCanvas fehlt");
    return;
  }

  if (!window.THREE) {
    setStatus("FEHLER – three.js nicht geladen (THREE fehlt).");
    return;
  }

  // WebGL check
  try {
    const test = document.createElement("canvas");
    const gl = test.getContext("webgl") || test.getContext("experimental-webgl");
    if (!gl) {
      setStatus("FEHLER – WebGL nicht verfügbar.");
      return;
    }
  } catch {
    setStatus("FEHLER – WebGL-Check fehlgeschlagen.");
    return;
  }

  /* =========================
     Canvas: Eingaben sicher machen
  ========================== */
  canvas.style.touchAction = "none";
  canvas.style.pointerEvents = "auto";

  // block page scrolling when using wheel over canvas
  canvas.addEventListener(
    "wheel",
    (e) => {
      e.preventDefault();
    },
    { passive: false }
  );

  /* =========================
     Renderer / Scene / Camera
  ========================== */
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();

  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);

  // Zoom-Parameter (wir bewegen die Kamera nach vorne/hinten)
  let camDist = 3.2;
  const CAM_MIN = 2.0;
  const CAM_MAX = 6.0;

  function updateCamera() {
    camera.position.set(0, 0.15, camDist);
    camera.lookAt(0, 0, 0);
  }
  updateCamera();

  /* =========================
     Licht (clean + "teurer")
  ========================== */
  scene.add(new THREE.AmbientLight(0xffffff, 0.7));

  const key = new THREE.DirectionalLight(0xffffff, 1.0);
  key.position.set(3, 2, 2);
  scene.add(key);

  const rim = new THREE.DirectionalLight(0x9fffe6, 0.35);
  rim.position.set(-3, 0.6, -2);
  scene.add(rim);

  /* =========================
     Textur
  ========================== */
  const textureLoader = new THREE.TextureLoader();
  const earthTexture = textureLoader.load(
    "/textures/earth.jpg",
    () => setStatus("bereit ✅ (drag = drehen, scroll = zoomen)"),
    undefined,
    () => setStatus("FEHLER – earth.jpg nicht gefunden (/textures/earth.jpg)")
  );
  earthTexture.colorSpace = THREE.SRGBColorSpace;
  earthTexture.anisotropy = renderer.capabilities.getMaxAnisotropy();

  /* =========================
     Globe
  ========================== */
  const R = 1.18;

  const globe = new THREE.Mesh(
    new THREE.SphereGeometry(R, 128, 128),
    new THREE.MeshStandardMaterial({
      map: earthTexture,
      roughness: 0.65,
      metalness: 0.05,
    })
  );
  scene.add(globe);

  const glow = new THREE.Mesh(
    new THREE.SphereGeometry(R * 1.03, 96, 96),
    new THREE.MeshBasicMaterial({ color: 0x46f7c5, transparent: true, opacity: 0.07 })
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
  window.addEventListener("resize", resize);
  resize();

  /* =========================
     ✅ Eigene Interaktion (Drag + Zoom)
  ========================== */
  let isDown = false;
  let lastX = 0;
  let lastY = 0;

  // Rotation state
  let rotY = 0;   // horizontal
  let rotX = 0;   // vertical (clamped)
  const ROT_X_MIN = -0.9;
  const ROT_X_MAX = 0.9;

  function clamp(v, a, b) {
    return Math.max(a, Math.min(b, v));
  }

  canvas.addEventListener("pointerdown", (e) => {
    isDown = true;
    lastX = e.clientX;
    lastY = e.clientY;
    canvas.setPointerCapture(e.pointerId);
  });

  canvas.addEventListener("pointermove", (e) => {
    if (!isDown) return;
    const dx = e.clientX - lastX;
    const dy = e.clientY - lastY;
    lastX = e.clientX;
    lastY = e.clientY;

    rotY += dx * 0.006;
    rotX += dy * 0.006;
    rotX = clamp(rotX, ROT_X_MIN, ROT_X_MAX);
  });

  function endPointer(e) {
    isDown = false;
    try { canvas.releasePointerCapture(e.pointerId); } catch {}
  }
  canvas.addEventListener("pointerup", endPointer);
  canvas.addEventListener("pointercancel", endPointer);
  canvas.addEventListener("pointerleave", () => (isDown = false));

  // Zoom via wheel
  canvas.addEventListener(
    "wheel",
    (e) => {
      // deltaY > 0 = rauszoomen, <0 = reinzoomen
      const zoomStrength = 0.0022;
      camDist += e.deltaY * zoomStrength;
      camDist = clamp(camDist, CAM_MIN, CAM_MAX);
      updateCamera();
    },
    { passive: false }
  );

  /* =========================
     Auto-Rotation (nur wenn nicht gezogen)
  ========================== */
  let autoSpin = true;
  canvas.addEventListener("pointerdown", () => (autoSpin = false));
  canvas.addEventListener("pointerup", () => (autoSpin = true));

  /* =========================
     Render Loop
  ========================== */
  function animate() {
    if (autoSpin) rotY += 0.002;

    globe.rotation.y = rotY;
    globe.rotation.x = rotX;

    glow.rotation.y = rotY;
    glow.rotation.x = rotX;

    renderer.render(scene, camera);
    requestAnimationFrame(animate);
  }

  animate();
})();


