(function(){
  const statusEl = document.getElementById("globeStatus");
  const canvas = document.getElementById("globeCanvas");

  function setStatus(t){ if(statusEl) statusEl.textContent = "Status: " + t; }

  // Script/Env Checks
  if(!window.THREE){
    setStatus("FEHLER – three.js wurde nicht geladen (THREE fehlt).");
    return;
  }
  if(!THREE.WebGLRenderer){
    setStatus("FEHLER – WebGLRenderer fehlt (three.js unvollständig).");
    return;
  }

  // WebGL support check
  try{
    const test = document.createElement("canvas");
    const gl = test.getContext("webgl") || test.getContext("experimental-webgl");
    if(!gl){
      setStatus("FEHLER – WebGL ist deaktiviert/nicht verfügbar (Grafiktreiber/Browser).");
      return;
    }
  }catch(e){
    setStatus("FEHLER – WebGL Check fehlgeschlagen.");
    return;
  }

  // Renderer
  const renderer = new THREE.WebGLRenderer({ canvas, antialias:true, alpha:true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
  camera.position.set(0, 0.15, 3.2);

  // OrbitControls (falls OrbitControls nicht geladen -> fallback ohne Controls)
  let controls = null;
  try{
    if(THREE.OrbitControls){
      controls = new THREE.OrbitControls(camera, canvas);
      controls.enableDamping = true;
      controls.enablePan = false;
      controls.minDistance = 2.0;
      controls.maxDistance = 6.0;
    } else {
      setStatus("Hinweis – OrbitControls nicht geladen, Globe läuft ohne Drag.");
    }
  }catch(e){
    setStatus("Hinweis – Controls Fehler, Globe läuft ohne Drag.");
  }

  // Lights
  scene.add(new THREE.AmbientLight(0xffffff, 0.9));
  const dir = new THREE.DirectionalLight(0xffffff, 0.8);
  dir.position.set(3,2,2);
  scene.add(dir);

  // Globe
  const R = 1.18;
  const globe = new THREE.Mesh(
    new THREE.SphereGeometry(R, 64, 64),
    new THREE.MeshStandardMaterial({
      color: 0x0b3d2e,
      roughness: 0.85,
      metalness: 0.12
    })
  );
  scene.add(globe);

  // Glow
  const glow = new THREE.Mesh(
    new THREE.SphereGeometry(R * 1.03, 64, 64),
    new THREE.MeshBasicMaterial({ color: 0x46f7c5, transparent:true, opacity: 0.08 })
  );
  scene.add(glow);

  // Resize (retry until canvas has real size)
  function resize(){
    const rect = canvas.getBoundingClientRect();
    const w = Math.max(320, Math.floor(rect.width));
    const h = Math.max(420, Math.floor(rect.height)); // canvas height via CSS (520) -> ok
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }

  let tries = 0;
  function resizeUntilReady(){
    resize();
    const r = canvas.getBoundingClientRect();
    if((r.width < 10 || r.height < 10) && tries < 60){
      tries++;
      requestAnimationFrame(resizeUntilReady);
      return;
    }
    setStatus("bereit ✅ (drag = drehen, scroll = zoomen)");
  }

  window.addEventListener("resize", resize);
  resizeUntilReady();

  // Render loop
  function tick(){
    globe.rotation.y += 0.002;
    glow.rotation.y += 0.002;

    if(controls) controls.update();
    renderer.render(scene, camera);
    requestAnimationFrame(tick);
  }

  tick();
})();
