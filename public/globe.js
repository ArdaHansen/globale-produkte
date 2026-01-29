(function(){
  const statusEl = document.getElementById("globeStatus");
  const filterChip = document.getElementById("globeFilterChip");
  const canvas = document.getElementById("globeCanvas");

  function setStatus(text, kind){
    if(!statusEl) return;
    const dot = statusEl.querySelector(".dot");
    if(dot){
      dot.classList.remove("ok","warn","err");
      dot.classList.add(kind || "ok");
    }
    statusEl.lastChild ? (statusEl.lastChild.textContent = "") : null;
    statusEl.innerHTML = `<span class="dot ${kind||"ok"}"></span> Status: ${text}`;
  }

  // ---- Guards ----
  if(!canvas){ console.error("globeCanvas missing"); return; }
  if(!window.THREE){ setStatus("FEHLER – three.js nicht geladen.", "err"); return; }
  if(!THREE.WebGLRenderer){ setStatus("FEHLER – WebGLRenderer fehlt.", "err"); return; }

  // WebGL support check
  try{
    const test = document.createElement("canvas");
    const gl = test.getContext("webgl") || test.getContext("experimental-webgl");
    if(!gl){ setStatus("FEHLER – WebGL deaktiviert/nicht verfügbar.", "err"); return; }
  }catch(e){
    setStatus("FEHLER – WebGL Check fehlgeschlagen.", "err");
    return;
  }

  // ---- URL filter (?id=f03) ----
  const params = new URLSearchParams(location.search);
  const focusId = (params.get("id") || params.get("product") || "").trim();
  if(filterChip){
    filterChip.textContent = focusId ? (`Produkt: ${focusId}`) : "Alle Produkte";
  }

  // ---- Renderer / Scene / Camera ----
  const renderer = new THREE.WebGLRenderer({ canvas, antialias:true, alpha:true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();

  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
  camera.position.set(0, 0.2, 3.4);

  // OrbitControls
  let controls = null;
  if(THREE.OrbitControls){
    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.enablePan = false;

    controls.enableZoom = true;
    controls.zoomSpeed = 0.9;

    controls.minDistance = 2.0;
    controls.maxDistance = 6.0;

    controls.rotateSpeed = 0.65;

    // Keep globe centered
    controls.target.set(0, 0, 0);
    controls.update();
  } else {
    setStatus("Hinweis – OrbitControls fehlen, nur Auto‑Rotation.", "warn");
  }

  // ---- Lights ----
  scene.add(new THREE.AmbientLight(0xffffff, 0.85));
  const sun = new THREE.DirectionalLight(0xffffff, 0.9);
  sun.position.set(3, 2, 2);
  scene.add(sun);

  // ---- Globe Group (earth + pins share rotation) ----
  const globeGroup = new THREE.Group();
  scene.add(globeGroup);

  const R = 1.18;

  // Texture loader
  const loader = new THREE.TextureLoader();
  loader.setCrossOrigin("anonymous");

  const earthTex = loader.load(
    "/textures/earth.jpg",
    () => { /* ok */ },
    undefined,
    () => { console.warn("earth texture failed to load"); }
  );
  earthTex.colorSpace = THREE.SRGBColorSpace;
  earthTex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());

  const earth = new THREE.Mesh(
    new THREE.SphereGeometry(R, 96, 96),
    new THREE.MeshStandardMaterial({
      map: earthTex,
      roughness: 0.95,
      metalness: 0.05
    })
  );
  globeGroup.add(earth);

  // Subtle glow
  const glow = new THREE.Mesh(
    new THREE.SphereGeometry(R * 1.03, 64, 64),
    new THREE.MeshBasicMaterial({ color: 0x46f7c5, transparent:true, opacity: 0.06 })
  );
  globeGroup.add(glow);

  // ---- Pins ----
  const pinsGroup = new THREE.Group();
  globeGroup.add(pinsGroup);

  // Convert lat/lon -> position on sphere
  function latLonToVec3(lat, lon, radius){
    const phi = (90 - lat) * (Math.PI / 180);
    const theta = (lon + 180) * (Math.PI / 180);
    const x = -radius * Math.sin(phi) * Math.cos(theta);
    const z = radius * Math.sin(phi) * Math.sin(theta);
    const y = radius * Math.cos(phi);
    return new THREE.Vector3(x,y,z);
  }

  // CanvasTexture sprite for "blib" pins with emoji
  function makeBlipTexture(emoji){
    const size = 256;
    const cnv = document.createElement("canvas");
    cnv.width = cnv.height = size;
    const ctx = cnv.getContext("2d");

    // soft shadow
    ctx.clearRect(0,0,size,size);
    ctx.beginPath();
    ctx.arc(size/2, size/2, 86, 0, Math.PI*2);
    ctx.fillStyle = "rgba(0,0,0,0.22)";
    ctx.filter = "blur(10px)";
    ctx.fill();
    ctx.filter = "none";

    // outer ring
    ctx.beginPath();
    ctx.arc(size/2, size/2, 78, 0, Math.PI*2);
    ctx.fillStyle = "rgba(255,255,255,0.92)";
    ctx.fill();

    // inner fill (accent-like)
    const grad = ctx.createRadialGradient(size/2, size/2, 10, size/2, size/2, 70);
    grad.addColorStop(0, "rgba(34,179,86,0.92)");
    grad.addColorStop(1, "rgba(15,122,53,0.92)");
    ctx.beginPath();
    ctx.arc(size/2, size/2, 66, 0, Math.PI*2);
    ctx.fillStyle = grad;
    ctx.fill();

    // emoji text
    ctx.font = "92px system-ui, Apple Color Emoji, Segoe UI Emoji, Noto Color Emoji";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#0b0f14";
    ctx.fillText(emoji || "📍", size/2, size/2+2);

    const tex = new THREE.CanvasTexture(cnv);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    return tex;
  }

  const blipTextureCache = new Map();
  function getBlipTexture(emoji){
    const key = emoji || "default";
    if(blipTextureCache.has(key)) return blipTextureCache.get(key);
    const t = makeBlipTexture(emoji);
    blipTextureCache.set(key, t);
    return t;
  }

  function addBlip(pin){
    const emoji = pin.emoji || "📍";
    const tex = getBlipTexture(emoji);
    const mat = new THREE.SpriteMaterial({
      map: tex,
      transparent: true,
      depthTest: true,
      depthWrite: false
    });
    const spr = new THREE.Sprite(mat);

    // size scales with zoom via Sprite, but we keep base here
    const base = 0.18; // world units
    spr.scale.set(base, base, 1);

    const p = latLonToVec3(pin.lat, pin.lon, R * 1.005);
    spr.position.copy(p);

    // face camera automatically (Sprite)
    spr.userData = pin;

    pinsGroup.add(spr);
    return spr;
  }

  function clearPins(){
    while(pinsGroup.children.length){
      const obj = pinsGroup.children.pop();
      if(obj.material && obj.material.map && obj.material.map.isTexture){
        // cached textures -> don't dispose map here
      }
      if(obj.material) obj.material.dispose();
      // geometry none
    }
  }

  async function loadPins(){
    setStatus("lade Pins…", "warn");
    let list = [];
    try{
      const res = await fetch("/pins.json", { cache:"no-store" });
      if(!res.ok) throw new Error("pins.json not found");
      list = await res.json();
      if(!Array.isArray(list)) throw new Error("pins.json must be array");
    }catch(e){
      console.warn(e);
      setStatus("FEHLER – pins.json konnte nicht geladen werden.", "err");
      return [];
    }

    // filter
    if(focusId){
      list = list.filter(p => String(p.productId||"").toLowerCase() === focusId.toLowerCase());
    }

    clearPins();
    for(const p of list){
      // validate minimal
      if(typeof p.lat !== "number" || typeof p.lon !== "number") continue;
      addBlip(p);
    }

    setStatus(`bereit ✅ (${list.length} Pins)`, "ok");
    return list;
  }

  // ---- Resize ----
  function resize(){
    const rect = canvas.getBoundingClientRect();
    const w = Math.max(320, Math.floor(rect.width));
    const h = Math.max(320, Math.floor(rect.height));
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  window.addEventListener("resize", resize);

  // ---- Interaction state (pause auto-rotate while user interacts) ----
  let userIsInteracting = false;
  let lastInteractionTs = 0;
  function markInteract(){
    userIsInteracting = true;
    lastInteractionTs = performance.now();
  }
  if(controls){
    controls.addEventListener("start", markInteract);
    controls.addEventListener("change", markInteract);
    controls.addEventListener("end", () => {
      lastInteractionTs = performance.now();
      // userIsInteracting stays true briefly
    });
  }
  canvas.addEventListener("wheel", markInteract, { passive:true });
  canvas.addEventListener("pointerdown", markInteract, { passive:true });
  canvas.addEventListener("touchstart", markInteract, { passive:true });

  // ---- Render loop ----
  const autoSpeed = 0.0022;

  function tick(){
    // auto-rotate only if user hasn't interacted recently
    const now = performance.now();
    if(!controls || (now - lastInteractionTs) > 1200){
      globeGroup.rotation.y += autoSpeed;
    }

    if(controls) controls.update();
    renderer.render(scene, camera);
    requestAnimationFrame(tick);
  }

  // ---- Boot ----
  try{
    resize();
    await loadPins();
    setStatus("bereit ✅", "ok");
  }catch(e){
    console.warn(e);
  }
  tick();
})();