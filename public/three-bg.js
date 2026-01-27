import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.159.0/build/three.module.js";

const canvas = document.getElementById("bg3d");
if (!canvas) {
  // no background canvas on this page
  // (keeps JS safe on pages without it)
  // eslint-disable-next-line no-console
  // console.log("bg3d canvas not found");
} else {
  // Renderer
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true,
    powerPreference: "high-performance",
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  // Scene / Camera
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 80);
  camera.position.set(0, 0.2, 8);

  // Lights (soft)
  const ambient = new THREE.AmbientLight(0xffffff, 0.65);
  scene.add(ambient);

  const key = new THREE.DirectionalLight(0xffffff, 0.65);
  key.position.set(3, 4, 2);
  scene.add(key);

  const rim = new THREE.DirectionalLight(0xffffff, 0.35);
  rim.position.set(-4, 1, -3);
  scene.add(rim);

  // Subtle fog for depth
  scene.fog = new THREE.FogExp2(0xffffff, 0.045);

  // Background "glass" blobs (two torus knots)
  const knotGeo = new THREE.TorusKnotGeometry(1.25, 0.38, 180, 18);
  const mat1 = new THREE.MeshStandardMaterial({
    color: 0x22b356,
    roughness: 0.5,
    metalness: 0.1,
    transparent: true,
    opacity: 0.18,
  });
  const mat2 = new THREE.MeshStandardMaterial({
    color: 0x0f7a35,
    roughness: 0.55,
    metalness: 0.08,
    transparent: true,
    opacity: 0.14,
  });

  const knotA = new THREE.Mesh(knotGeo, mat1);
  knotA.position.set(-3.2, 1.2, -6);
  knotA.rotation.set(0.4, 0.2, 0.1);
  scene.add(knotA);

  const knotB = new THREE.Mesh(knotGeo, mat2);
  knotB.position.set(3.4, -0.9, -8);
  knotB.rotation.set(-0.2, 0.5, -0.1);
  scene.add(knotB);

  // Particle field (Instanced)
  const COUNT = 520;
  const particleGeo = new THREE.IcosahedronGeometry(0.08, 0);
  const particleMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.9,
    metalness: 0.0,
    transparent: true,
    opacity: 0.55,
  });
  const particles = new THREE.InstancedMesh(particleGeo, particleMat, COUNT);
  particles.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  scene.add(particles);

  const dummy = new THREE.Object3D();
  const p = [];
  for (let i = 0; i < COUNT; i++) {
    const x = (Math.random() - 0.5) * 22;
    const y = (Math.random() - 0.5) * 12;
    const z = -Math.random() * 30;
    const s = 0.6 + Math.random() * 1.6;
    p.push({ x, y, z, s, r: Math.random() * Math.PI * 2 });
    dummy.position.set(x, y, z);
    dummy.scale.setScalar(0.08 * s);
    dummy.rotation.set(0, 0, 0);
    dummy.updateMatrix();
    particles.setMatrixAt(i, dummy.matrix);
  }

  // Emoji sprites (more "three.js usage" but still lightweight)
  const EMOJIS = ["🍌","🍍","🍎","🍓","🥑","🍇","🍊","🍋","🥕","🥦","🫘","🍅","🥭","🥬"];
  function makeEmojiTexture(emoji) {
    const c = document.createElement("canvas");
    c.width = 128; c.height = 128;
    const ctx = c.getContext("2d");
    ctx.clearRect(0, 0, c.width, c.height);
    ctx.font = "88px system-ui, Apple Color Emoji, Segoe UI Emoji";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(emoji, 64, 70);
    const tex = new THREE.CanvasTexture(c);
    tex.needsUpdate = true;
    return tex;
  }

  const spriteGroup = new THREE.Group();
  scene.add(spriteGroup);

  const sprites = [];
  for (let i = 0; i < 18; i++) {
    const emoji = EMOJIS[Math.floor(Math.random() * EMOJIS.length)];
    const tex = makeEmojiTexture(emoji);
    const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, opacity: 0.75 });
    const spr = new THREE.Sprite(mat);
    spr.position.set((Math.random() - 0.5) * 14, (Math.random() - 0.5) * 7, -4 - Math.random() * 14);
    const scale = 0.65 + Math.random() * 0.65;
    spr.scale.set(scale, scale, 1);
    spriteGroup.add(spr);
    sprites.push({ spr, drift: 0.35 + Math.random() * 0.55, phase: Math.random() * Math.PI * 2 });
  }

  // Resize
  function resize() {
    const w = canvas.clientWidth || window.innerWidth;
    const h = canvas.clientHeight || window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  window.addEventListener("resize", resize, { passive: true });
  resize();

  // Parallax (mouse + scroll)
  const mouse = { x: 0, y: 0 };
  window.addEventListener("pointermove", (e) => {
    mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
    mouse.y = (e.clientY / window.innerHeight) * 2 - 1;
  }, { passive: true });

  let scrollY = window.scrollY || 0;
  window.addEventListener("scroll", () => {
    scrollY = window.scrollY || 0;
  }, { passive: true });

  // Animate
  const clock = new THREE.Clock();
  function animate() {
    const t = clock.getElapsedTime();

    // background knots
    knotA.rotation.x += 0.0022;
    knotA.rotation.y += 0.0016;
    knotB.rotation.x -= 0.0014;
    knotB.rotation.y += 0.0020;

    // particles drift forward + wrap
    for (let i = 0; i < COUNT; i++) {
      const pi = p[i];
      pi.r += 0.002 + (pi.s * 0.0006);
      pi.z += 0.03 + pi.s * 0.008;
      if (pi.z > 2) pi.z = -30;

      dummy.position.set(pi.x + Math.sin(pi.r) * 0.35, pi.y + Math.cos(pi.r) * 0.25, pi.z);
      dummy.scale.setScalar(0.08 * pi.s);
      dummy.updateMatrix();
      particles.setMatrixAt(i, dummy.matrix);
    }
    particles.instanceMatrix.needsUpdate = true;

    // emoji sprites float
    sprites.forEach((it, idx) => {
      const s = it.spr;
      s.position.y += Math.sin(t * it.drift + it.phase) * 0.0018;
      s.position.x += Math.cos(t * it.drift + it.phase) * 0.0014;
      s.material.opacity = 0.62 + Math.sin(t * 0.8 + idx) * 0.10;
    });

    // camera subtle parallax
    const scrollNorm = Math.min(1, scrollY / (window.innerHeight * 1.2));
    camera.position.x = mouse.x * 0.35;
    camera.position.y = 0.2 + (-mouse.y) * 0.25 - scrollNorm * 0.35;
    camera.lookAt(0, 0, -10);

    renderer.render(scene, camera);
    requestAnimationFrame(animate);
  }
  animate();
}