(function(){
  const statusEl = document.getElementById("globeStatus");
  const canvas = document.getElementById("globeCanvas");
  const tipEl = document.getElementById("pinTip");
  const filterPill = document.getElementById("globeFilterPill");

  function setStatus(t){ if(statusEl) statusEl.textContent = "Status: " + t; }
  function setFilterLabel(text){ if(filterPill) filterPill.textContent = text; }

  if(!window.THREE){ setStatus("FEHLER – three.js nicht geladen"); return; }
  if(!canvas){ console.error("globeCanvas fehlt"); return; }

  // load pins JSON (embedded in page)
  async function loadPins(){
    const embedded = document.getElementById("pinsJson");
    if(embedded && embedded.textContent && embedded.textContent.trim().startsWith("{")){
      return JSON.parse(embedded.textContent);
    }
    const res = await fetch("pins.json", {cache:"no-store"});
    if(!res.ok) throw new Error("pins.json not found");
    return await res.json();
  }

  const params = new URLSearchParams(location.search);
  const focusId = (params.get("id") || "").trim();

  const renderer = new THREE.WebGLRenderer({ canvas, antialias:true, alpha:true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
  camera.position.set(0, 0.0, 3.2);

  let controls = null;
  if(THREE.OrbitControls){
    controls = new THREE.OrbitControls(camera, canvas);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.enablePan = false;
    controls.enableZoom = true;
    controls.minDistance = 2.1;
    controls.maxDistance = 7.0;
    controls.rotateSpeed = 0.55;
    controls.zoomSpeed = 0.9;
  }

  scene.add(new THREE.AmbientLight(0xffffff, 0.75));
  const key = new THREE.DirectionalLight(0xffffff, 1.0);
  key.position.set(3, 2, 2);
  scene.add(key);

  const rim = new THREE.DirectionalLight(0x9fffe3, 0.25);
  rim.position.set(-3, 0.5, -2);
  scene.add(rim);

  const root = new THREE.Group();
  scene.add(root);

  const globeGroup = new THREE.Group();
  root.add(globeGroup);

  const R = 1.18;

  const loader = new THREE.TextureLoader();
  const earthTex = loader.load(
    "/textures/earth.jpg",
    () => {},
    undefined,
    (err) => {
      console.error("Texture load error:", err);
      setStatus("FEHLER – earth.jpg nicht gefunden (public/textures/earth.jpg)");
    }
  );
  earthTex.colorSpace = THREE.SRGBColorSpace;
  earthTex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());

  const globe = new THREE.Mesh(
    new THREE.SphereGeometry(R, 128, 128),
    new THREE.MeshStandardMaterial({ map: earthTex, roughness: 1.0, metalness: 0.0 })
  );
  globeGroup.add(globe);

  const glow = new THREE.Mesh(
    new THREE.SphereGeometry(R * 1.02, 64, 64),
    new THREE.MeshBasicMaterial({ color: 0x46f7c5, transparent:true, opacity: 0.06 })
  );
  globeGroup.add(glow);

  const pinsGroup = new THREE.Group();
  globeGroup.add(pinsGroup);

  function latLonToVec3(lat, lon, radius){
    const phi = THREE.MathUtils.degToRad(90 - lat);
    const theta = THREE.MathUtils.degToRad(lon + 180);
    const x = -(radius * Math.sin(phi) * Math.cos(theta));
    const z =  (radius * Math.sin(phi) * Math.sin(theta));
    const y =  (radius * Math.cos(phi));
    return new THREE.Vector3(x, y, z);
  }

  function makePinMesh(color){
    const h = 0.13;
    const r = 0.028;
    const geo = new THREE.ConeGeometry(r, h, 14, 1);
    geo.translate(0, h/2, 0);
    const mat = new THREE.MeshStandardMaterial({ color, roughness:0.55, metalness:0.05 });
    return new THREE.Mesh(geo, mat);
  }

  function clearPins(){
    for(const c of [...pinsGroup.children]){
      pinsGroup.remove(c);
      c.geometry?.dispose?.();
      if(c.material){
        if(Array.isArray(c.material)) c.material.forEach(m=>m.dispose?.());
        else c.material.dispose?.();
      }
    }
  }

  const raycaster = new THREE.Raycaster();
  const mouse = new THREE.Vector2(999, 999);
  let isPointerDown = false;

  canvas.addEventListener("pointerdown", ()=>{ isPointerDown = true; }, {passive:true});
  window.addEventListener("pointerup", ()=>{ isPointerDown = false; }, {passive:true});

  function showTip(x, y, title, subtitle){
    if(!tipEl) return;
    tipEl.style.left = x + "px";
    tipEl.style.top = y + "px";
    tipEl.innerHTML = `<strong>${title}</strong><div class="small">${subtitle}</div>`;
    tipEl.style.opacity = "1";
    tipEl.setAttribute("aria-hidden","false");
  }
  function hideTip(){
    if(!tipEl) return;
    tipEl.style.opacity = "0";
    tipEl.setAttribute("aria-hidden","true");
  }

  function getCanvasRelativeXY(ev){
    const rect = canvas.getBoundingClientRect();
    return { x: ev.clientX - rect.left, y: ev.clientY - rect.top, rect };
  }

  function updateRayFromEvent(ev){
    const {x,y,rect} = getCanvasRelativeXY(ev);
    mouse.x = (x / rect.width) * 2 - 1;
    mouse.y = -(y / rect.height) * 2 + 1;
    return {x,y};
  }

  canvas.addEventListener("mousemove", (ev)=>{
    const {x,y} = updateRayFromEvent(ev);
    raycaster.setFromCamera(mouse, camera);
    const hits = raycaster.intersectObjects(pinsGroup.children, false);
    if(hits.length){
      const obj = hits[0].object;
      const ud = obj.userData || {};
      showTip(x, y, `${ud.emoji||""} ${ud.product||ud.id||"Produkt"}`.trim(), ud.label || "");
      canvas.style.cursor = "pointer";
    } else {
      hideTip();
      canvas.style.cursor = "grab";
    }
  }, {passive:true});

  canvas.addEventListener("mouseleave", ()=>{
    hideTip();
    canvas.style.cursor = "grab";
  }, {passive:true});

  canvas.addEventListener("click", (ev)=>{
    updateRayFromEvent(ev);
    raycaster.setFromCamera(mouse, camera);
    const hits = raycaster.intersectObjects(pinsGroup.children, false);
    if(!hits.length) return;

    const obj = hits[0].object;
    const ud = obj.userData || {};
    setStatus(`Fokus: ${ud.emoji||""} ${ud.product||ud.id||""} – ${ud.label||""}`.trim());

    // rotate globe to bring pin to front
    const target = obj.position.clone().normalize();
    const camDir = new THREE.Vector3();
    camera.getWorldDirection(camDir);
    const desired = camDir.clone().multiplyScalar(-1).normalize();
    const q = new THREE.Quaternion().setFromUnitVectors(target, desired);
    globeGroup.quaternion.premultiply(q);
  });

  function buildPins(data){
    clearPins();

    const products = data?.products || [];
    let used = products;

    if(focusId){
      used = products.filter(p => String(p.id).toLowerCase() === focusId.toLowerCase());
      if(used.length) setFilterLabel(`Fokus: ${used[0].emoji||""} ${used[0].name||used[0].id}`.trim());
      else setFilterLabel(`Fokus: ${focusId} (nicht gefunden)`);
    } else {
      setFilterLabel("Alle Produkte");
    }

    let count = 0;
    const hash = (s)=>{ let h=0; for(let i=0;i<s.length;i++) h=(h*31 + s.charCodeAt(i))>>>0; return h; };

    for(const p of used){
      if(!p?.pins?.length) continue;
      const h = hash(p.id || p.name || "x");
      const color = 0xff5a3d ^ (h & 0x00ffff);

      for(const pin of p.pins){
        if(typeof pin.lat !== "number" || typeof pin.lon !== "number") continue;
        const mesh = makePinMesh(color);
        const pos = latLonToVec3(pin.lat, pin.lon, R * 1.001);
        mesh.position.copy(pos);

        const normal = pos.clone().normalize();
        mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0), normal);

        mesh.userData = {
          id: p.id,
          product: p.name,
          emoji: p.emoji,
          label: pin.label || ""
        };

        pinsGroup.add(mesh);
        count++;
      }
    }

    return count;
  }

  function resize(){
    const rect = canvas.getBoundingClientRect();
    const w = Math.max(320, Math.floor(rect.width));
    const h = Math.max(320, Math.floor(rect.height));
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  window.addEventListener("resize", resize);

  setStatus("lädt…");
  canvas.style.cursor = "grab";

  let tries = 0;
  (function resizeUntilReady(){
    resize();
    const r = canvas.getBoundingClientRect();
    if((r.width < 10 || r.height < 10) && tries < 60){
      tries++;
      requestAnimationFrame(resizeUntilReady);
      return;
    }
  })();

  let pinCount = 0;
  loadPins()
    .then((data)=>{
      pinCount = buildPins(data);
      setStatus(`bereit ✅ (${pinCount} Pins)`);
      if(focusId && pinCount === 0) setStatus(`bereit ✅ (0 Pins) – id=${focusId} hat keine Pins`);
    })
    .catch((e)=>{
      console.error(e);
      setStatus("FEHLER – pins.json konnte nicht geladen werden");
    });

  function tick(){
    if(!isPointerDown){
      globeGroup.rotation.y += 0.0015; // auto rotate
    }
    glow.rotation.y += 0.0008;
    if(controls) controls.update();
    renderer.render(scene, camera);
    requestAnimationFrame(tick);
  }
  tick();
})();