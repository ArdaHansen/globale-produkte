const canvas = document.getElementById("globeCanvas");
const statusEl = document.getElementById("globeStatus");
const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 1000);
camera.position.set(0, 0, 3);

const renderer = new THREE.WebGLRenderer({ canvas, antialias:true, alpha:true });
renderer.setPixelRatio(window.devicePixelRatio);

const controls = new THREE.OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.enableZoom = true;

function resize(){
  const rect = canvas.parentElement.getBoundingClientRect();
  renderer.setSize(rect.width, rect.height);
  camera.aspect = rect.width / rect.height;
  camera.updateProjectionMatrix();
}
window.addEventListener("resize", resize);
resize();

scene.add(new THREE.AmbientLight(0xffffff, 0.8));
const dir = new THREE.DirectionalLight(0xffffff, 0.6);
dir.position.set(5,3,5);
scene.add(dir);

const loader = new THREE.TextureLoader();
loader.load("/textures/earth.jpg", tex => {
  const earth = new THREE.Mesh(
    new THREE.SphereGeometry(1, 64, 64),
    new THREE.MeshStandardMaterial({ map: tex })
  );
  scene.add(earth);
  loadPins();
});

function latLonToVec(lat, lon, r=1.01){
  const phi = (90 - lat) * Math.PI/180;
  const theta = (lon + 180) * Math.PI/180;
  return new THREE.Vector3(
    r * Math.sin(phi) * Math.cos(theta),
    r * Math.cos(phi),
    r * Math.sin(phi) * Math.sin(theta)
  );
}

async function loadPins(){
  const res = await fetch("/pins.json");
  const pins = await res.json();

  pins.forEach(p => {
    const sprite = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: new THREE.CanvasTexture(makeIcon(p.emoji)),
        transparent:true
      })
    );
    sprite.scale.set(0.15,0.15,0.15);
    sprite.position.copy(latLonToVec(p.lat, p.lon));
    scene.add(sprite);
  });

  statusEl.textContent = `Status: bereit (${pins.length} Pins)`;
}

function makeIcon(txt){
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const ctx = c.getContext("2d");
  ctx.beginPath();
  ctx.arc(64,64,60,0,Math.PI*2);
  ctx.fillStyle="#22b356";
  ctx.fill();
  ctx.font="64px serif";
  ctx.textAlign="center";
  ctx.textBaseline="middle";
  ctx.fillStyle="#fff";
  ctx.fillText(txt,64,70);
  return c;
}

function animate(){
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
}
animate();
