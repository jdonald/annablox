// Annabelle's Obby — mini browser version.
// A small three.js take on the 5-stage Roblox obby: rainbow xylophone, forest climb,
// ocean (water double jump), space (super jumps) and the Moon (low gravity) ending at a portal.
// Units are Roblox "studs" and use the real game's numbers where we know them.
import * as THREE from 'three';

// ---------------------------------------------------------------- constants
const G = 196.2;                         // Roblox default gravity
const WALK = 16;                         // Roblox default walk speed
const JUMP_V = Math.sqrt(2 * G * 7.2);   // jump height 7.2
const SPACE_JUMP_V = 120;                // space super jump
const MOON_G = 65.4;                     // moon gravity
const MOON_JUMP_V = Math.sqrt(2 * MOON_G * 12);
const WATER_JUMP_V = 60;                 // water double jump
const SWIM = 12;
const PR = 1;                            // player radius
const PH = 5;                            // player height
const KILL_Y = -45;

const ZONE = { LAND: 0, OCEAN: 1, SPACE: 2, MOON: 3 };
function zoneAt(z) {
  if (z > -158) return ZONE.LAND;
  if (z > -278.5) return ZONE.OCEAN;
  if (z > -399) return ZONE.SPACE;
  return ZONE.MOON;
}

const isTouch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
if (isTouch) document.body.classList.add('touch');

// ---------------------------------------------------------------- renderer / scene
const canvas = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, isTouch ? 1.5 : 2));
renderer.shadowMap.enabled = !isTouch;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
const DAY = new THREE.Color(0x8fd3ff);
const NIGHT = new THREE.Color(0x070512);
scene.background = DAY.clone();

const camera = new THREE.PerspectiveCamera(70, 1, 0.3, 2000);

const hemi = new THREE.HemisphereLight(0xffffff, 0x99a6b8, 2.2);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xffffff, 2.2);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
const sc = sun.shadow.camera;
sc.left = -45; sc.right = 45; sc.top = 45; sc.bottom = -45; sc.near = 1; sc.far = 200;
sun.shadow.bias = -0.0005;
scene.add(sun, sun.target);

function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.fov = w < h ? 80 : 70;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();

// ---------------------------------------------------------------- textures
function makeStudTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#ffffff';
  g.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 2; i++) {
    for (let j = 0; j < 2; j++) {
      const x = 32 + i * 64, y = 32 + j * 64;
      g.beginPath(); g.arc(x + 2, y + 3, 17, 0, Math.PI * 2); g.fillStyle = '#d8d8d8'; g.fill();
      g.beginPath(); g.arc(x, y, 17, 0, Math.PI * 2); g.fillStyle = '#f4f4f4'; g.fill();
      g.beginPath(); g.arc(x - 3, y - 3, 10, 0, Math.PI * 2); g.fillStyle = '#ffffff'; g.fill();
    }
  }
  g.strokeStyle = 'rgba(0,0,0,0.06)';
  g.lineWidth = 2;
  g.strokeRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}
const STUDS = makeStudTexture();

function studMaterial(color, sx, sz, opts = {}) {
  const tex = STUDS.clone();
  tex.repeat.set(Math.max(1, sx / 4), Math.max(1, sz / 4));
  tex.needsUpdate = true;
  return new THREE.MeshLambertMaterial({ color, map: tex, ...opts });
}

// ---------------------------------------------------------------- level data
const solids = [];      // things you can stand on / bump into
const hazards = [];     // touching these sends you back to the checkpoint
const updaters = [];    // per-frame animations
const checkpoints = [];
const signs = [];

function addMesh(mesh, shadows = true) {
  mesh.castShadow = shadows;
  mesh.receiveShadow = true;
  scene.add(mesh);
  return mesh;
}

// Axis-aligned box. (cx, cz) centre, `top` = y of the walkable top face.
function box(cx, top, cz, sx, sy, sz, color, opts = {}) {
  const geo = new THREE.BoxGeometry(sx, sy, sz);
  const mat = opts.material || (opts.plain
    ? new THREE.MeshLambertMaterial({ color, ...(opts.matOpts || {}) })
    : studMaterial(color, sx, sz, opts.matOpts));
  const mesh = addMesh(new THREE.Mesh(geo, mat), opts.shadow !== false);
  mesh.position.set(cx, top - sy / 2, cz);
  const s = {
    type: 'box', mesh,
    min: new THREE.Vector3(cx - sx / 2, top - sy, cz - sz / 2),
    max: new THREE.Vector3(cx + sx / 2, top, cz + sz / 2),
    ...opts.extra,
  };
  if (!opts.noCollide) solids.push(s);
  return s;
}

function cyl(x, z, r, bottom, top, color, opts = {}) {
  const geo = new THREE.CylinderGeometry(r, opts.rBottom ?? r, top - bottom, opts.segments || 32);
  const mat = opts.material || new THREE.MeshLambertMaterial({ color });
  const mesh = addMesh(new THREE.Mesh(geo, mat), opts.shadow !== false);
  mesh.position.set(x, (top + bottom) / 2, z);
  const s = { type: 'cyl', mesh, x, z, r, bottom, top, ...opts.extra };
  if (!opts.noCollide) solids.push(s);
  return s;
}

function sphere(x, y, z, r, color, opts = {}) {
  const mat = opts.material || new THREE.MeshLambertMaterial({ color });
  const mesh = addMesh(new THREE.Mesh(new THREE.SphereGeometry(r, 40, 24), mat));
  mesh.position.set(x, y, z);
  const s = { type: 'sphere', mesh, x, y, z, r };
  solids.push(s);
  return s;
}

function checkpoint(stage, x, top, z, color) {
  const pad = new THREE.Mesh(
    new THREE.CylinderGeometry(3, 3, 0.3, 32),
    new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85 }),
  );
  pad.position.set(x, top + 0.16, z);
  scene.add(pad);
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(3, 0.25, 8, 40),
    new THREE.MeshBasicMaterial({ color }),
  );
  ring.rotation.x = Math.PI / 2;
  ring.position.set(x, top + 0.3, z);
  scene.add(ring);
  const cp = { stage, pos: new THREE.Vector3(x, top, z), pad, ring, color };
  checkpoints.push(cp);
  updaters.push((t) => { ring.position.y = top + 0.3 + Math.sin(t * 3 + stage) * 0.15; });
  return cp;
}

function makeTextTexture(lines, opts = {}) {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = opts.bg || '#4a2f1d';
  const r = 26;
  g.beginPath();
  g.roundRect(6, 6, 500, 244, r);
  g.fill();
  g.lineWidth = 8;
  g.strokeStyle = opts.border || '#2c1b10';
  g.stroke();
  g.fillStyle = '#ffffff';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  const size = lines.length > 1 ? 54 : 64;
  g.font = `700 ${size}px Fredoka, system-ui, sans-serif`;
  lines.forEach((line, i) => {
    g.fillText(line, 256, 128 + (i - (lines.length - 1) / 2) * size * 1.15, 470);
  });
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function sign(lines, x, y, z, opts = {}) {
  const w = 10, h = 5;
  const mat = new THREE.MeshBasicMaterial({ map: makeTextTexture(lines, opts), side: THREE.DoubleSide, transparent: true });
  const board = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
  board.position.set(x, y + h / 2 + 3, z);
  scene.add(board);
  if (!opts.noPost) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.6, 3.2, 0.6), new THREE.MeshLambertMaterial({ color: 0x5b3a22 }));
    post.position.set(x, y + 1.6, z - 0.05);
    post.castShadow = true;
    scene.add(post);
  }
  signs.push(board);
  return board;
}

function tree(x, top, z, scale = 1) {
  cyl(x, z, 0.8 * scale, top - 1, top + 6 * scale, 0x7a4a26, { segments: 10 });
  const leaves = new THREE.Mesh(
    new THREE.ConeGeometry(4 * scale, 8 * scale, 10),
    new THREE.MeshLambertMaterial({ color: 0x2f9e44 }),
  );
  leaves.position.set(x, top + 9 * scale, z);
  addMesh(leaves);
  const leaves2 = new THREE.Mesh(
    new THREE.ConeGeometry(3 * scale, 6 * scale, 10),
    new THREE.MeshLambertMaterial({ color: 0x37b24d }),
  );
  leaves2.position.set(x, top + 12.5 * scale, z);
  addMesh(leaves2);
}

function cloud(x, y, z, s) {
  const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9 });
  const grp = new THREE.Group();
  [[0, 0, 0, 12, 4, 8], [5, 2, 1, 8, 4, 6], [-6, 1, -1, 8, 3, 6]].forEach(([dx, dy, dz, w, h, d]) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w * s, h * s, d * s), mat);
    m.position.set(dx * s, dy * s, dz * s);
    grp.add(m);
  });
  grp.position.set(x, y, z);
  scene.add(grp);
  updaters.push((t) => { grp.position.x = x + Math.sin(t * 0.05 + z) * 8; });
}

// ---------------------------------------------------------------- build the course
const NOTE = [261.63, 293.66, 329.63, 349.23, 392.0, 440.0, 493.88, 523.25];
const RAINBOW = [0xff3b30, 0xff9500, 0xffcc00, 0x34c759, 0x007aff, 0x5856d6, 0xaf52de];

function buildCourse() {
  // ---- Stage 1: rainbow xylophone
  box(0, 0, 0, 16, 2, 12, 0xcfd6df);
  checkpoint(1, 0, 0, 0, 0xff3b30);
  sign(['Stage 1', 'Rainbow Xylophone'], -9.5, 0, -2);
  for (let i = 0; i < 7; i++) {
    const z = -12 - i * 8;
    const width = 15 - i * 1.1;
    box(0, i * 0.5, z, width, 1.2, 4, RAINBOW[i], { extra: { note: NOTE[i] }, plain: true, matOpts: { emissive: RAINBOW[i], emissiveIntensity: 0.15 } });
    // little mallet posts at the ends of each bar, like a xylophone frame
    box(-width / 2 - 0.5, i * 0.5 - 0.6, z, 0.6, 3, 0.6, 0xdddddd, { noCollide: true, plain: true });
    box(width / 2 + 0.5, i * 0.5 - 0.6, z, 0.6, 3, 0.6, 0xdddddd, { noCollide: true, plain: true });
  }

  // ---- Stage 2: forest climb
  box(0, 0, -79, 36, 3, 22, 0x58a944);
  checkpoint(2, 0, 0, -74, 0xff9500);
  sign(['Stage 2', 'Climb the Forest'], -9, 0, -72);
  tree(-14, 0, -76); tree(14, 0, -82, 1.2); tree(-13, 0, -87, 0.9); tree(12, 0, -73, 0.8);
  // rocks rise out of a deep gap
  const rock = (x, top, z, color) => box(x, top, z, 6, top + 40, 6, color, { plain: true, extra: { rock: true } });
  rock(-5, 3, -95, 0xd9480f);
  rock(4, 6, -103, 0xf08c00);
  box(0, 8, -116, 32, 4, 16, 0x4c9a3a);
  tree(-12, 8, -112, 1.1); tree(12, 8, -119); tree(-11, 8, -121, 0.8); tree(9, 8, -111, 0.7);
  rock(-6, 10.5, -129, 0xfab005);
  rock(5, 13, -137, 0x2f9e44);
  box(0, 13, -150, 32, 4, 16, 0x58a944);
  tree(-12, 13, -146, 0.9); tree(12, 13, -154, 1.1); tree(13, 13, -144, 0.7);

  // ---- Stage 3: ocean with islands
  checkpoint(3, 0, 13, -152, 0xffcc00);
  sign(['Stage 3', 'Swim, then jump high!'], -9, 13, -147);
  const water = new THREE.Mesh(
    new THREE.PlaneGeometry(600, 121),
    new THREE.MeshPhongMaterial({ color: 0x1e88e5, transparent: true, opacity: 0.72, shininess: 80, side: THREE.DoubleSide }),
  );
  water.rotation.x = -Math.PI / 2;
  water.position.set(0, 0, -218.5);
  water.receiveShadow = true;
  scene.add(water);
  updaters.push((t) => { water.position.y = Math.sin(t * 1.5) * 0.08; });
  box(0, -12, -218, 120, 2, 121, 0xe9d8a6, { plain: true }); // sandy ocean floor
  const island = (x, z, r, color) => {
    cyl(x, z, r, -12, 4, 0xf2d58a, { segments: 28 });
    const grass = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.75, r * 0.75, 0.3, 28), new THREE.MeshLambertMaterial({ color }));
    grass.position.set(x, 4.15, z);
    addMesh(grass);
  };
  island(0, -172, 5, 0xff3b30);
  island(-12, -190, 5, 0xff9500);
  island(10, -207, 5, 0xffcc00);
  island(-4, -225, 5, 0x34c759);
  island(9, -243, 5, 0x007aff);
  island(-5, -258, 5, 0xaf52de);
  island(0, -270, 8, 0xffffff);
  // a palm-ish tree on the big island
  cyl(5, -268, 0.6, 3.5, 11, 0x8d5a2b, { segments: 8 });
  const frond = new THREE.Mesh(new THREE.SphereGeometry(3, 12, 8), new THREE.MeshLambertMaterial({ color: 0x2b8a3e }));
  frond.scale.y = 0.4;
  frond.position.set(5, 11.5, -268);
  addMesh(frond);

  // ---- Stage 4: space, super jumps between planets
  const spaceMat = (sx, sz) => studMaterial(0x6741d9, sx, sz, { emissive: 0x2b1a6b, emissiveIntensity: 0.4 });
  const spacePad = (z0, z1) => {
    const sz = Math.abs(z1 - z0);
    box(0, 0, (z0 + z1) / 2, 14, 2, sz, 0, { material: spaceMat(14, sz) });
  };
  spacePad(-280, -292);
  checkpoint(4, 0, 0, -286, 0x34c759);
  sign(['Stage 4', 'Super jumps in space!'], -9, 0, -282);
  sphere(-6, 15, -302, 6, 0xe03131);
  spacePad(-312, -324);
  sphere(7, 16, -334, 6, 0xfcc419);
  spacePad(-344, -356);
  sphere(-5, 15, -366, 6, 0x1c7ed6);
  spacePad(-376, -386);
  sphere(-8, 8, -393, 5, 0xb197fc);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(7, 0.5, 8, 48), new THREE.MeshLambertMaterial({ color: 0xffd8a8 }));
  ring.rotation.x = Math.PI / 2.4;
  ring.position.set(-8, 8, -393);
  scene.add(ring);

  // ---- Stage 5: the Moon (low gravity, glowing craters, aliens), portal at the end
  box(0, 0, -461, 44, 3, 122, 0xbfc4cc);
  checkpoint(5, 0, 0, -405, 0x007aff);
  sign(['Final stage:', 'the Moon!'], -9, 0, -403);
  const craters = [
    [0, -418, 4, 0x22d3ee], [-12, -425, 3.5, 0xfacc15], [10, -430, 4, 0xef4444],
    [-3, -440, 4.5, 0xa855f7], [12, -452, 3.5, 0x22c55e], [-10, -458, 4, 0x22d3ee],
    [2, -468, 5, 0xfacc15], [-14, -478, 3.5, 0xef4444], [9, -485, 4, 0xa855f7],
    [-2, -496, 4.5, 0x22c55e], [14, -500, 3.5, 0x22d3ee],
  ];
  craters.forEach(([x, z, r, color]) => {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.2, 32), new THREE.MeshBasicMaterial({ color }));
    m.position.set(x, 0.11, z);
    scene.add(m);
    const glow = new THREE.Mesh(
      new THREE.CylinderGeometry(r * 1.25, r * 1.25, 0.15, 32),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.35 }),
    );
    glow.position.set(x, 0.08, z);
    scene.add(glow);
    updaters.push((t) => { glow.material.opacity = 0.25 + Math.sin(t * 4 + x) * 0.12; });
    hazards.push({ test: (p) => p.y < 0.5 && Math.hypot(p.x - x, p.z - z) < r - 0.4 });
  });
  const alien = (z, speed, phase) => {
    const grp = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(2.6, 3, 2.6), new THREE.MeshLambertMaterial({ color: 0x51cf66 }));
    body.position.y = 1.5;
    body.castShadow = true;
    grp.add(body);
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0x111111 });
    [-0.6, 0.6].forEach((ex) => {
      const eye = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.7, 0.1), eyeMat);
      eye.position.set(ex, 2.1, 1.31);
      grp.add(eye);
    });
    [-0.8, 0.8].forEach((ax) => {
      const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 1.2), new THREE.MeshLambertMaterial({ color: 0x51cf66 }));
      ant.position.set(ax, 3.5, 0);
      const tip = new THREE.Mesh(new THREE.SphereGeometry(0.25), new THREE.MeshBasicMaterial({ color: 0xffe066 }));
      tip.position.set(ax, 4.2, 0);
      grp.add(ant, tip);
    });
    scene.add(grp);
    grp.position.set(0, 0, z);
    updaters.push((t) => {
      grp.position.x = Math.sin(t * speed + phase) * 17;
      grp.position.y = Math.abs(Math.sin(t * 5 + phase)) * 0.6;
    });
    hazards.push({
      test: (p) => Math.abs(p.x - grp.position.x) < 1.3 + PR && Math.abs(p.z - z) < 1.3 + PR && p.y < grp.position.y + 3,
    });
  };
  alien(-446, 0.9, 0);
  alien(-474, 1.15, 2);
  alien(-506, 0.8, 4);

  // portal
  const gold = new THREE.MeshLambertMaterial({ color: 0xd4a72c });
  [-5, 5].forEach((x) => box(x, 12, -515, 1.5, 12, 1.5, 0, { material: gold }));
  box(0, 13.5, -515, 11.5, 1.5, 1.5, 0, { material: gold });
  const portalMat = new THREE.MeshBasicMaterial({ color: 0x9775fa, transparent: true, opacity: 0.85, side: THREE.DoubleSide });
  const portal = new THREE.Mesh(new THREE.PlaneGeometry(8.5, 12), portalMat);
  portal.position.set(0, 6, -515);
  scene.add(portal);
  updaters.push((t) => {
    portalMat.color.setHSL(0.72 + Math.sin(t * 2) * 0.05, 0.85, 0.65 + Math.sin(t * 3) * 0.08);
  });

  // stars for space and the Moon
  const starGeo = new THREE.BufferGeometry();
  const pts = [];
  for (let i = 0; i < 1600; i++) {
    const v = new THREE.Vector3().randomDirection().multiplyScalar(700);
    v.y = Math.abs(v.y) * 0.9 - 60;
    pts.push(v.x, v.y, v.z);
  }
  starGeo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  stars = new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 2.2, sizeAttenuation: false, transparent: true, opacity: 0 }));
  scene.add(stars);

  // a big Earth hanging in the sky over the Moon
  const ec = document.createElement('canvas');
  ec.width = 256; ec.height = 128;
  const eg = ec.getContext('2d');
  eg.fillStyle = '#2f80ed';
  eg.fillRect(0, 0, 256, 128);
  eg.fillStyle = '#40c057';
  [[40, 50, 26, 18], [70, 85, 14, 22], [140, 40, 30, 16], [160, 75, 16, 20], [215, 60, 20, 14]].forEach(([x, y, rx, ry]) => {
    eg.beginPath(); eg.ellipse(x, y, rx, ry, 0.4, 0, Math.PI * 2); eg.fill();
  });
  eg.fillStyle = 'rgba(255,255,255,.85)';
  eg.fillRect(0, 0, 256, 10); eg.fillRect(0, 118, 256, 10);
  const etex = new THREE.CanvasTexture(ec);
  etex.colorSpace = THREE.SRGBColorSpace;
  earth = new THREE.Mesh(new THREE.SphereGeometry(40, 32, 20), new THREE.MeshBasicMaterial({ map: etex, transparent: true, opacity: 0 }));
  updaters.push((t) => { earth.rotation.y = t * 0.05; });
  scene.add(earth);

  // clouds around the early stages
  cloud(-60, 20, -40, 1.5); cloud(55, 30, -90, 2); cloud(-70, 26, -140, 1.8);
  cloud(70, 18, -10, 1.2); cloud(-50, 35, -200, 2.2); cloud(60, 28, -230, 1.6);
}
let stars, earth;

// ---------------------------------------------------------------- player avatar
function faceTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#ffd43b';
  g.fillRect(0, 0, 128, 128);
  g.fillStyle = '#222';
  g.beginPath(); g.ellipse(44, 50, 7, 11, 0, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.ellipse(84, 50, 7, 11, 0, 0, Math.PI * 2); g.fill();
  g.lineWidth = 7; g.lineCap = 'round'; g.strokeStyle = '#222';
  g.beginPath(); g.arc(64, 70, 26, 0.15 * Math.PI, 0.85 * Math.PI); g.stroke();
  g.fillStyle = 'rgba(255,120,150,.55)';
  g.beginPath(); g.arc(30, 78, 9, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.arc(98, 78, 9, 0, Math.PI * 2); g.fill();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

const player = new THREE.Group();
const parts = {};
(function buildAvatar() {
  const skin = new THREE.MeshLambertMaterial({ color: 0xffd43b });
  const shirt = new THREE.MeshLambertMaterial({ color: 0xe64980 });
  const pants = new THREE.MeshLambertMaterial({ color: 0x7048e8 });
  const face = new THREE.MeshLambertMaterial({ map: faceTexture() });
  const mk = (geo, mat, x, y, z, pivotY) => {
    const pivot = new THREE.Group();
    pivot.position.set(x, pivotY, z);
    const m = new THREE.Mesh(geo, mat);
    m.position.y = y - pivotY;
    m.castShadow = true;
    pivot.add(m);
    player.add(pivot);
    return pivot;
  };
  parts.legL = mk(new THREE.BoxGeometry(0.95, 2, 1), pants, -0.5, 1, 0, 2);
  parts.legR = mk(new THREE.BoxGeometry(0.95, 2, 1), pants, 0.5, 1, 0, 2);
  parts.torso = mk(new THREE.BoxGeometry(2, 2, 1), shirt, 0, 3, 0, 3);
  parts.armL = mk(new THREE.BoxGeometry(0.95, 2, 1), skin, -1.5, 3, 0, 3.9);
  parts.armR = mk(new THREE.BoxGeometry(0.95, 2, 1), skin, 1.5, 3, 0, 3.9);
  // head: face on the front (+z)
  const head = new THREE.Mesh(new THREE.BoxGeometry(1.25, 1.25, 1.25), [skin, skin, skin, skin, face, skin]);
  head.position.y = 4.65;
  head.castShadow = true;
  player.add(head);
  // little hair bow
  const bow = new THREE.Mesh(new THREE.BoxGeometry(1, 0.4, 0.3), new THREE.MeshLambertMaterial({ color: 0xff6b9d }));
  bow.position.set(0.3, 5.35, -0.35);
  player.add(bow);
  scene.add(player);
})();

// ---------------------------------------------------------------- state
const state = {
  pos: new THREE.Vector3(),
  vel: new THREE.Vector3(),
  facing: Math.PI,
  grounded: false,
  ground: null,
  inWater: false,
  stage: 1,
  checkpoint: null,
  deaths: 0,
  running: false,
  won: false,
  startTime: 0,
  endTime: 0,
  walkPhase: 0,
};
let camYaw = 0, camPitch = 0.38, camDist = 20;

// ---------------------------------------------------------------- input
const keys = new Set();
const input = { x: 0, y: 0, jumpHeld: false };
window.addEventListener('keydown', (e) => {
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
  keys.add(e.code);
});
window.addEventListener('keyup', (e) => keys.delete(e.code));
window.addEventListener('blur', () => keys.clear());

// camera drag (mouse anywhere / touch on right side or anywhere not used by the joystick)
const drags = new Map();
let joyId = null;
const joyEl = document.getElementById('joy');
const knobEl = document.getElementById('knob');
const joyOrigin = { x: 0, y: 0 };
const joyVec = { x: 0, y: 0 };

canvas.addEventListener('pointerdown', (e) => {
  try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* pointer already gone */ }
  if (e.pointerType === 'touch' && e.clientX < window.innerWidth * 0.45 && joyId === null) {
    joyId = e.pointerId;
    joyOrigin.x = e.clientX; joyOrigin.y = e.clientY;
    joyEl.style.left = e.clientX + 'px';
    joyEl.style.top = e.clientY + 'px';
    joyEl.classList.add('on');
    knobEl.style.transform = 'translate(0,0)';
    return;
  }
  drags.set(e.pointerId, { x: e.clientX, y: e.clientY });
});
canvas.addEventListener('pointermove', (e) => {
  if (e.pointerId === joyId) {
    let dx = e.clientX - joyOrigin.x, dy = e.clientY - joyOrigin.y;
    const len = Math.hypot(dx, dy), max = 50;
    if (len > max) { dx *= max / len; dy *= max / len; }
    knobEl.style.transform = `translate(${dx}px, ${dy}px)`;
    joyVec.x = dx / max; joyVec.y = -dy / max;
    return;
  }
  const d = drags.get(e.pointerId);
  if (!d) return;
  const sens = e.pointerType === 'touch' ? 0.008 : 0.006;
  camYaw -= (e.clientX - d.x) * sens;
  camPitch = THREE.MathUtils.clamp(camPitch + (e.clientY - d.y) * sens, -0.15, 1.3);
  d.x = e.clientX; d.y = e.clientY;
});
function endPointer(e) {
  if (e.pointerId === joyId) {
    joyId = null;
    joyVec.x = joyVec.y = 0;
    joyEl.classList.remove('on');
  }
  drags.delete(e.pointerId);
}
canvas.addEventListener('pointerup', endPointer);
canvas.addEventListener('pointercancel', endPointer);
canvas.addEventListener('wheel', (e) => {
  e.preventDefault();
  camDist = THREE.MathUtils.clamp(camDist + e.deltaY * 0.02, 8, 40);
}, { passive: false });
canvas.addEventListener('contextmenu', (e) => e.preventDefault());

const jumpBtn = document.getElementById('jump');
let touchJump = false;
jumpBtn.addEventListener('pointerdown', (e) => { e.preventDefault(); touchJump = true; jumpBtn.classList.add('down');
  try { jumpBtn.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
});
const jumpUp = () => { touchJump = false; jumpBtn.classList.remove('down'); };
jumpBtn.addEventListener('pointerup', jumpUp);
jumpBtn.addEventListener('pointercancel', jumpUp);

function readInput() {
  let x = 0, y = 0;
  if (keys.has('KeyW') || keys.has('ArrowUp')) y += 1;
  if (keys.has('KeyS') || keys.has('ArrowDown')) y -= 1;
  if (keys.has('KeyA') || keys.has('ArrowLeft')) x -= 1;
  if (keys.has('KeyD') || keys.has('ArrowRight')) x += 1;
  x += joyVec.x; y += joyVec.y;
  const len = Math.hypot(x, y);
  if (len > 1) { x /= len; y /= len; }
  input.x = x; input.y = y;
  input.jumpHeld = keys.has('Space') || touchJump;
}

// ---------------------------------------------------------------- sound
let actx = null;
let muted = false;
try { muted = localStorage.getItem('annablox-muted') === '1'; } catch (e) { /* storage blocked */ }
const soundBtn = document.getElementById('sound');
function updateSoundBtn() {
  soundBtn.textContent = muted ? '🔇' : '🔊';
  soundBtn.setAttribute('aria-label', muted ? 'Sound off' : 'Sound on');
}
updateSoundBtn();
soundBtn.addEventListener('click', () => {
  muted = !muted;
  try { localStorage.setItem('annablox-muted', muted ? '1' : '0'); } catch (e) { /* ignore */ }
  updateSoundBtn();
});
function tone(freq, dur = 0.25, type = 'sine', vol = 0.18, slideTo = null, delay = 0) {
  if (muted || !actx) return;
  const t0 = actx.currentTime + delay;
  const o = actx.createOscillator();
  const g = actx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t0);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
  g.gain.setValueAtTime(vol, t0);
  g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
  o.connect(g).connect(actx.destination);
  o.start(t0);
  o.stop(t0 + dur + 0.02);
}
const sfx = {
  jump: () => tone(420, 0.12, 'square', 0.05, 700),
  bigJump: () => tone(300, 0.4, 'triangle', 0.12, 1200),
  note: (f) => { tone(f, 0.6, 'sine', 0.22); tone(f * 2, 0.3, 'sine', 0.06); },
  die: () => tone(300, 0.4, 'sawtooth', 0.07, 80),
  splash: () => tone(900, 0.25, 'triangle', 0.06, 150),
  checkpoint: () => [523, 659, 784].forEach((f, i) => tone(f, 0.25, 'triangle', 0.12, null, i * 0.08)),
  win: () => [523, 659, 784, 1046, 784, 1046].forEach((f, i) => tone(f, 0.3, 'triangle', 0.14, null, i * 0.12)),
};

// ---------------------------------------------------------------- UI helpers
const stageEl = document.getElementById('stage');
const timerEl = document.getElementById('timer');
const toastEl = document.getElementById('toast');
const flashEl = document.getElementById('flash');
let toastTimer = null;
function toast(text, ms = 2600) {
  toastEl.textContent = text;
  toastEl.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove('show'), ms);
}
function fmtTime(s) {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${String(sec).padStart(2, '0')}`;
}
const STAGE_TIPS = {
  1: 'Hop across the rainbow!',
  2: 'Climb through the forest!',
  3: 'Fall in? Hold jump to swim up and leap out!',
  4: 'Super jumps in space!',
  5: 'Float on the Moon — dodge craters and aliens!',
};

// ---------------------------------------------------------------- physics
function overlapsXZ(s, px, pz, pad = 0) {
  if (s.type === 'box') {
    return px + PR - pad > s.min.x && px - PR + pad < s.max.x && pz + PR - pad > s.min.z && pz - PR + pad < s.max.z;
  }
  const d = Math.hypot(px - s.x, pz - s.z);
  if (s.type === 'cyl') return d < s.r + PR - pad;
  return d < s.r * 0.97; // sphere: stand on it if over the ball
}
function topAt(s, px, pz) {
  if (s.type === 'box') return s.max.y;
  if (s.type === 'cyl') return s.top;
  const d = Math.min(Math.hypot(px - s.x, pz - s.z), s.r);
  return s.y + Math.sqrt(s.r * s.r - d * d);
}
function bottomAt(s, px, pz) {
  if (s.type === 'box') return s.min.y;
  if (s.type === 'cyl') return s.bottom;
  const d = Math.min(Math.hypot(px - s.x, pz - s.z), s.r);
  return s.y - Math.sqrt(s.r * s.r - d * d);
}

function resolveHorizontal() {
  const p = state.pos;
  for (const s of solids) {
    if (!overlapsXZ(s, p.x, p.z)) continue;
    const top = topAt(s, p.x, p.z), bottom = bottomAt(s, p.x, p.z);
    if (p.y >= top - 0.01 || p.y + PH <= bottom + 0.01) continue;
    if (top - p.y <= 1.1 && state.vel.y <= 0.1 && s.type !== 'sphere') {
      p.y = top; // step up small ledges
      continue;
    }
    if (s.type === 'box') {
      const pushPX = s.max.x - (p.x - PR), pushNX = (p.x + PR) - s.min.x;
      const pushPZ = s.max.z - (p.z - PR), pushNZ = (p.z + PR) - s.min.z;
      const m = Math.min(pushPX, pushNX, pushPZ, pushNZ);
      if (m === pushPX) p.x += pushPX; else if (m === pushNX) p.x -= pushNX;
      else if (m === pushPZ) p.z += pushPZ; else p.z -= pushNZ;
    } else {
      const R = s.type === 'cyl' ? s.r + PR : s.r * 0.97 + 0.01;
      const dx = p.x - s.x, dz = p.z - s.z;
      const d = Math.hypot(dx, dz) || 0.0001;
      p.x = s.x + (dx / d) * R;
      p.z = s.z + (dz / d) * R;
    }
  }
}

function resolveVertical(prevY) {
  const p = state.pos;
  state.grounded = false;
  let ground = null;
  for (const s of solids) {
    if (!overlapsXZ(s, p.x, p.z, s.type === 'cyl' ? 0.4 : 0)) continue;
    const top = topAt(s, p.x, p.z), bottom = bottomAt(s, p.x, p.z);
    if (state.vel.y <= 0 && prevY >= top - 0.6 && p.y <= top) {
      p.y = top;
      state.vel.y = 0;
      state.grounded = true;
      ground = s;
    } else if (state.vel.y > 0 && prevY + PH <= bottom + 0.05 && p.y + PH > bottom) {
      p.y = bottom - PH;
      state.vel.y = 0;
    }
  }
  if (ground && ground !== state.ground) {
    if (ground.note) sfx.note(ground.note);
  }
  state.ground = ground;
}

function step(dt) {
  const p = state.pos, v = state.vel;
  const zone = zoneAt(p.z);
  const wasInWater = state.inWater;
  state.inWater = zone === ZONE.OCEAN && p.y < -0.5;
  if (state.inWater && !wasInWater) sfx.splash();

  // movement relative to the camera
  const fx = -Math.sin(camYaw), fz = -Math.cos(camYaw);
  const rx = Math.cos(camYaw), rz = -Math.sin(camYaw);
  const mx = fx * input.y + rx * input.x;
  const mz = fz * input.y + rz * input.x;
  const speed = state.inWater ? SWIM : WALK;
  v.x = mx * speed;
  v.z = mz * speed;
  if (Math.hypot(mx, mz) > 0.1) {
    const target = Math.atan2(mx, mz);
    let diff = target - state.facing;
    diff = Math.atan2(Math.sin(diff), Math.cos(diff));
    state.facing += diff * Math.min(1, dt * 14);
  }

  if (state.inWater) {
    // float / swim: hold jump to rise, then pop out with the water double jump
    // (idle: drift to the surface and bob there with your head out of the water)
    const targetVy = input.jumpHeld ? 16 : (p.y > -3.6 ? -2 : 3);
    v.y += (targetVy - v.y) * Math.min(1, dt * 4);
    if (input.jumpHeld && v.y > 0 && p.y > -4.2) {
      v.y = WATER_JUMP_V;
      state.inWater = false;
      sfx.bigJump();
    }
  } else {
    const g = zone === ZONE.MOON ? MOON_G : G;
    v.y -= g * dt;
    if (state.grounded && input.jumpHeld) {
      if (zone === ZONE.SPACE) { v.y = SPACE_JUMP_V; sfx.bigJump(); }
      else if (zone === ZONE.MOON) { v.y = MOON_JUMP_V; sfx.jump(); }
      else { v.y = JUMP_V; sfx.jump(); }
      state.grounded = false;
    }
  }

  p.x += v.x * dt;
  p.z += v.z * dt;
  resolveHorizontal();
  const prevY = p.y;
  p.y += v.y * dt;
  resolveVertical(prevY);

  // hazards, falling, checkpoints, portal
  if (p.y < KILL_Y) return die();
  for (const h of hazards) if (h.test(p)) return die();

  if (state.grounded) {
    for (const cp of checkpoints) {
      if (cp.stage > state.stage && Math.hypot(p.x - cp.pos.x, p.z - cp.pos.z) < 3.5 && Math.abs(p.y - cp.pos.y) < 1) {
        reachCheckpoint(cp);
      }
    }
  }
  if (!state.won && Math.abs(p.x) < 4.5 && p.z < -514 && p.z > -517 && p.y < 12) win();
}

function reachCheckpoint(cp, quiet = false) {
  state.stage = cp.stage;
  state.checkpoint = cp;
  checkpoints.forEach((c) => c.pad.material.color.set(c.stage <= cp.stage ? c.color : 0xffffff));
  stageEl.textContent = `Stage ${cp.stage}/5`;
  if (!quiet) {
    sfx.checkpoint();
    toast(STAGE_TIPS[cp.stage]);
  }
}

function respawnAt(cp) {
  state.pos.copy(cp.pos);
  state.vel.set(0, 0, 0);
  state.grounded = false;
  state.ground = null;
  state.inWater = false;
  state.facing = Math.PI;
  camYaw = 0;
  camInit = false; // snap the camera instead of swooping across the map
}

let dying = false;
function die() {
  if (dying) return;
  dying = true;
  state.deaths++;
  sfx.die();
  flashEl.classList.add('on');
  requestAnimationFrame(() => requestAnimationFrame(() => flashEl.classList.remove('on')));
  respawnAt(state.checkpoint);
  dying = false;
}

function win() {
  state.won = true;
  state.running = false;
  state.endTime = performance.now();
  sfx.win();
  const secs = (state.endTime - state.startTime) / 1000;
  document.getElementById('win-stats').textContent =
    `Time ${fmtTime(secs)} · ${state.deaths} ${state.deaths === 1 ? 'oops' : 'oopses'}`;
  document.getElementById('win').hidden = false;
}

function startGame() {
  if (!actx) {
    try { actx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { actx = null; }
  }
  if (actx && actx.state === 'suspended') actx.resume();
  state.deaths = 0;
  state.won = false;
  state.stage = 0;
  reachCheckpoint(checkpoints[0], true);
  respawnAt(checkpoints[0]);
  state.running = true;
  state.startTime = performance.now();
  document.getElementById('start').hidden = true;
  document.getElementById('win').hidden = true;
  toast(STAGE_TIPS[1]);
}
document.getElementById('go').addEventListener('click', startGame);
document.getElementById('again').addEventListener('click', startGame);

// ---------------------------------------------------------------- animation of the avatar
function animateAvatar(dt) {
  const moving = Math.hypot(state.vel.x, state.vel.z) > 1;
  if (state.inWater) {
    state.walkPhase += dt * 6;
    const s = Math.sin(state.walkPhase);
    parts.armL.rotation.x = -2.6 + s * 0.6; parts.armR.rotation.x = -2.6 - s * 0.6;
    parts.legL.rotation.x = s * 0.5; parts.legR.rotation.x = -s * 0.5;
  } else if (!state.grounded) {
    parts.armL.rotation.x = parts.armR.rotation.x = -2.8;
    parts.legL.rotation.x = 0.4; parts.legR.rotation.x = -0.3;
  } else if (moving) {
    state.walkPhase += dt * 11;
    const s = Math.sin(state.walkPhase);
    parts.armL.rotation.x = s * 0.9; parts.armR.rotation.x = -s * 0.9;
    parts.legL.rotation.x = -s * 0.9; parts.legR.rotation.x = s * 0.9;
  } else {
    for (const k of ['armL', 'armR', 'legL', 'legR']) parts[k].rotation.x *= 0.8;
  }
  player.position.copy(state.pos);
  player.rotation.y = state.facing;
}

// ---------------------------------------------------------------- camera + sky
const camTarget = new THREE.Vector3();
const camPos = new THREE.Vector3();
let camInit = false;
function updateCamera(dt) {
  camTarget.set(state.pos.x, state.pos.y + 3.5, state.pos.z);
  const cp = Math.cos(camPitch);
  const want = new THREE.Vector3(
    camTarget.x + Math.sin(camYaw) * camDist * cp,
    camTarget.y + Math.sin(camPitch) * camDist,
    camTarget.z + Math.cos(camYaw) * camDist * cp,
  );
  if (!camInit) { camPos.copy(want); camInit = true; }
  camPos.lerp(want, 1 - Math.exp(-dt * 10));
  camera.position.copy(camPos);
  camera.lookAt(camTarget);

  // day sky fades into space as you leave the ocean
  const k = THREE.MathUtils.smoothstep(-state.pos.z, 262, 290);
  scene.background.copy(DAY).lerp(NIGHT, k);
  stars.material.opacity = k;
  stars.position.copy(state.pos);
  earth.material.opacity = k;
  earth.position.set(state.pos.x + 160, 150, state.pos.z - 420);
  hemi.intensity = 2.2 - k * 0.6;

  sun.position.set(state.pos.x + 30, state.pos.y + 60, state.pos.z + 25);
  sun.target.position.copy(state.pos);
}

// ---------------------------------------------------------------- main loop
let last = performance.now();
let elapsed = 0;
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  elapsed += dt;
  readInput();
  if (state.running) {
    const n = Math.ceil(dt / (1 / 240));
    for (let i = 0; i < n; i++) step(dt / n);
    timerEl.textContent = fmtTime((now - state.startTime) / 1000);
  }
  for (const u of updaters) u(elapsed);
  animateAvatar(dt);
  updateCamera(dt);
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}

// wait briefly for the font so the signs render in Fredoka
const fontReady = document.fonts && document.fonts.load
  ? Promise.race([document.fonts.load('700 40px Fredoka'), new Promise((r) => setTimeout(r, 1500))])
  : Promise.resolve();
fontReady.catch(() => {}).then(() => {
  buildCourse();
  reachCheckpoint(checkpoints[0], true);
  respawnAt(checkpoints[0]);
  // idle camera on the start screen looks down the course
  camYaw = 0.5;
  requestAnimationFrame(frame);
});

// debug hook for testing: window.__obby
window.__obby = { state, checkpoints, solids, topAt, overlapsXZ, startGame, respawnAt, reachCheckpoint, step, input, setCamYaw: (y) => { camYaw = y; } };
