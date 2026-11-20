// Annabelle's Obby — mini browser version, built on the shared ANNABLOX engine.
// Five stages from the Roblox obby: rainbow xylophone, forest climb, ocean (water double jump),
// space (super jumps) and the Moon (low gravity) ending at a portal.
import { Game, THREE, G, JUMP_V, PR, studMaterial, fontsReady, fmtTime } from '../shared/engine.js';

const SPACE_JUMP_V = 120;
const MOON_G = 65.4;
const MOON_JUMP_V = Math.sqrt(2 * MOON_G * 12);
const KILL_Y = -45;

const ZONE = { LAND: 0, OCEAN: 1, SPACE: 2, MOON: 3 };
function zoneAt(z) {
  if (z > -158) return ZONE.LAND;
  if (z > -278.5) return ZONE.OCEAN;
  if (z > -399) return ZONE.SPACE;
  return ZONE.MOON;
}

const game = new Game({ look: { skin: 0xffd43b, shirt: 0xe64980, pants: 0x7048e8, bow: 0xff6b9d }, cameraCollision: false });
const { scene } = game;
const DAY = new THREE.Color(0x8fd3ff);
const NIGHT = new THREE.Color(0x070512);

const hazards = [];
const checkpoints = [];
let stars, earth;

// ---------------------------------------------------------------- builders specific to the Obby
function checkpoint(stage, x, top, z, color) {
  const pad = new THREE.Mesh(
    new THREE.CylinderGeometry(3, 3, 0.3, 32),
    new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85 }),
  );
  pad.position.set(x, top + 0.16, z);
  scene.add(pad);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(3, 0.25, 8, 40), new THREE.MeshBasicMaterial({ color }));
  ring.rotation.x = Math.PI / 2;
  ring.position.set(x, top + 0.3, z);
  scene.add(ring);
  const cp = { stage, pos: new THREE.Vector3(x, top, z), pad, ring, color };
  checkpoints.push(cp);
  game.updaters.push((t) => { ring.position.y = top + 0.3 + Math.sin(t * 3 + stage) * 0.15; });
  return cp;
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
  game.updaters.push((t) => { grp.position.x = x + Math.sin(t * 0.05 + z) * 8; });
}

// ---------------------------------------------------------------- the course
const NOTE = [261.63, 293.66, 329.63, 349.23, 392.0, 440.0, 493.88, 523.25];
const RAINBOW = [0xff3b30, 0xff9500, 0xffcc00, 0x34c759, 0x007aff, 0x5856d6, 0xaf52de];

function buildCourse() {
  const box = game.box.bind(game), cyl = game.cyl.bind(game), sphere = game.sphere.bind(game);
  const tree = (x, top, z, s) => game.tree(x, top, z, s, 'pine');

  // ---- Stage 1: rainbow xylophone
  box(0, 0, 0, 16, 2, 12, 0xcfd6df, { studs: true });
  checkpoint(1, 0, 0, 0, 0xff3b30);
  game.sign(['Stage 1', 'Rainbow Xylophone'], -9.5, 0, -2);
  for (let i = 0; i < 7; i++) {
    const z = -12 - i * 8;
    const width = 15 - i * 1.1;
    box(0, i * 0.5, z, width, 1.2, 4, RAINBOW[i], { extra: { note: NOTE[i] }, matOpts: { emissive: RAINBOW[i], emissiveIntensity: 0.15 } });
    box(-width / 2 - 0.5, i * 0.5 - 0.6, z, 0.6, 3, 0.6, 0xdddddd, { noCollide: true });
    box(width / 2 + 0.5, i * 0.5 - 0.6, z, 0.6, 3, 0.6, 0xdddddd, { noCollide: true });
  }

  // ---- Stage 2: forest climb
  box(0, 0, -79, 36, 3, 22, 0x58a944, { studs: true });
  checkpoint(2, 0, 0, -74, 0xff9500);
  game.sign(['Stage 2', 'Climb the Forest'], -9, 0, -72);
  tree(-14, 0, -76); tree(14, 0, -82, 1.2); tree(-13, 0, -87, 0.9); tree(12, 0, -73, 0.8);
  const rock = (x, top, z, color) => box(x, top, z, 6, top + 40, 6, color);
  rock(-5, 3, -95, 0xd9480f);
  rock(4, 6, -103, 0xf08c00);
  box(0, 8, -116, 32, 4, 16, 0x4c9a3a, { studs: true });
  tree(-12, 8, -112, 1.1); tree(12, 8, -119); tree(-11, 8, -121, 0.8); tree(9, 8, -111, 0.7);
  rock(-6, 10.5, -129, 0xfab005);
  rock(5, 13, -137, 0x2f9e44);
  box(0, 13, -150, 32, 4, 16, 0x58a944, { studs: true });
  tree(-12, 13, -146, 0.9); tree(12, 13, -154, 1.1); tree(13, 13, -144, 0.7);

  // ---- Stage 3: ocean with islands
  checkpoint(3, 0, 13, -152, 0xffcc00);
  game.sign(['Stage 3', 'Swim, then jump high!'], -9, 13, -147);
  const water = new THREE.Mesh(
    new THREE.PlaneGeometry(600, 121),
    new THREE.MeshPhongMaterial({ color: 0x1e88e5, transparent: true, opacity: 0.72, shininess: 80, side: THREE.DoubleSide }),
  );
  water.rotation.x = -Math.PI / 2;
  water.position.set(0, 0, -218.5);
  water.receiveShadow = true;
  scene.add(water);
  game.updaters.push((t) => { water.position.y = Math.sin(t * 1.5) * 0.08; });
  box(0, -12, -218, 120, 2, 121, 0xe9d8a6); // sandy ocean floor
  const island = (x, z, r, color) => {
    cyl(x, z, r, -12, 4, 0xf2d58a, { segments: 28 });
    const grass = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.75, r * 0.75, 0.3, 28), new THREE.MeshLambertMaterial({ color }));
    grass.position.set(x, 4.15, z);
    game.addMesh(grass);
  };
  island(0, -172, 5, 0xff3b30);
  island(-12, -190, 5, 0xff9500);
  island(10, -207, 5, 0xffcc00);
  island(-4, -225, 5, 0x34c759);
  island(9, -243, 5, 0x007aff);
  island(-5, -258, 5, 0xaf52de);
  island(0, -270, 8, 0xffffff);
  cyl(5, -268, 0.6, 3.5, 11, 0x8d5a2b, { segments: 8 });
  const frond = new THREE.Mesh(new THREE.SphereGeometry(3, 12, 8), new THREE.MeshLambertMaterial({ color: 0x2b8a3e }));
  frond.scale.y = 0.4;
  frond.position.set(5, 11.5, -268);
  game.addMesh(frond);

  // ---- Stage 4: space, super jumps between planets
  const spacePad = (z0, z1) => {
    const sz = Math.abs(z1 - z0);
    box(0, 0, (z0 + z1) / 2, 14, 2, sz, 0, { material: studMaterial(0x6741d9, 14, sz, { emissive: 0x2b1a6b, emissiveIntensity: 0.4 }) });
  };
  spacePad(-280, -292);
  checkpoint(4, 0, 0, -286, 0x34c759);
  game.sign(['Stage 4', 'Super jumps in space!'], -9, 0, -282);
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
  box(0, 0, -461, 44, 3, 122, 0xbfc4cc, { studs: true });
  checkpoint(5, 0, 0, -405, 0x007aff);
  game.sign(['Final stage:', 'the Moon!'], -9, 0, -403);
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
    game.updaters.push((t) => { glow.material.opacity = 0.25 + Math.sin(t * 4 + x) * 0.12; });
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
    game.updaters.push((t) => {
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

  const gold = new THREE.MeshLambertMaterial({ color: 0xd4a72c });
  [-5, 5].forEach((x) => box(x, 12, -515, 1.5, 12, 1.5, 0, { material: gold }));
  box(0, 13.5, -515, 11.5, 1.5, 1.5, 0, { material: gold });
  const portalMat = new THREE.MeshBasicMaterial({ color: 0x9775fa, transparent: true, opacity: 0.85, side: THREE.DoubleSide });
  const portal = new THREE.Mesh(new THREE.PlaneGeometry(8.5, 12), portalMat);
  portal.position.set(0, 6, -515);
  scene.add(portal);
  game.updaters.push((t) => {
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
  game.updaters.push((t) => { earth.rotation.y = t * 0.05; });
  scene.add(earth);

  cloud(-60, 20, -40, 1.5); cloud(55, 30, -90, 2); cloud(-70, 26, -140, 1.8);
  cloud(70, 18, -10, 1.2); cloud(-50, 35, -200, 2.2); cloud(60, 28, -230, 1.6);
}

// ---------------------------------------------------------------- rules
const st = game.state;
const run = { stage: 1, checkpoint: null, deaths: 0, won: false, startTime: 0 };
const stageEl = document.getElementById('stage');
const timerEl = document.getElementById('timer');
const STAGE_TIPS = {
  1: 'Hop across the rainbow!',
  2: 'Climb through the forest!',
  3: 'Fall in? Hold jump to swim up and leap out!',
  4: 'Super jumps in space!',
  5: 'Float on the Moon — dodge craters and aliens!',
};

game.physics = (s) => {
  const zone = zoneAt(s.pos.z);
  if (zone === ZONE.OCEAN && s.pos.y < -0.5) return { water: true, waterJumpV: 60 };
  if (zone === ZONE.SPACE) return { jumpV: SPACE_JUMP_V };
  if (zone === ZONE.MOON) return { gravity: MOON_G, jumpV: MOON_JUMP_V };
  return { gravity: G, jumpV: JUMP_V };
};
game.onLand = (s) => { if (s.note) game.sfx.note(s.note); };
game.afterStep = () => {
  const p = st.pos;
  if (p.y < KILL_Y) return die();
  for (const h of hazards) if (h.test(p)) return die();
  if (st.grounded) {
    for (const cp of checkpoints) {
      if (cp.stage > run.stage && Math.hypot(p.x - cp.pos.x, p.z - cp.pos.z) < 3.5 && Math.abs(p.y - cp.pos.y) < 1) {
        reachCheckpoint(cp);
      }
    }
  }
  if (!run.won && Math.abs(p.x) < 4.5 && p.z < -514 && p.z > -517 && p.y < 12) win();
};

function reachCheckpoint(cp, quiet = false) {
  run.stage = cp.stage;
  run.checkpoint = cp;
  checkpoints.forEach((c) => c.pad.material.color.set(c.stage <= cp.stage ? c.color : 0xffffff));
  stageEl.textContent = `Stage ${cp.stage}/5`;
  if (!quiet) {
    game.sfx.chime();
    game.toast(STAGE_TIPS[cp.stage]);
  }
}
function respawnAt(cp) { game.teleport(cp.pos, Math.PI, 0); }
function die() {
  run.deaths++;
  game.sfx.die();
  game.flash();
  respawnAt(run.checkpoint);
}
function win() {
  run.won = true;
  game.running = false;
  game.sfx.win();
  const secs = (performance.now() - run.startTime) / 1000;
  document.getElementById('win-stats').textContent =
    `Time ${fmtTime(secs)} · ${run.deaths} ${run.deaths === 1 ? 'oops' : 'oopses'}`;
  document.getElementById('win').hidden = false;
}
function startGame() {
  game.unlockAudio();
  run.deaths = 0;
  run.won = false;
  run.stage = 0;
  reachCheckpoint(checkpoints[0], true);
  respawnAt(checkpoints[0]);
  game.running = true;
  run.startTime = performance.now();
  document.getElementById('start').hidden = true;
  document.getElementById('win').hidden = true;
  game.toast(STAGE_TIPS[1]);
}
document.getElementById('go').addEventListener('click', startGame);
document.getElementById('again').addEventListener('click', startGame);
game.bindSoundButton(document.getElementById('sound'));

game.onFrame = () => {
  if (game.running) timerEl.textContent = fmtTime((performance.now() - run.startTime) / 1000);
  // day sky fades into space as you leave the ocean
  const k = THREE.MathUtils.smoothstep(-st.pos.z, 262, 290);
  scene.background.copy(DAY).lerp(NIGHT, k);
  stars.material.opacity = k;
  stars.position.copy(st.pos);
  earth.material.opacity = k;
  earth.position.set(st.pos.x + 160, 150, st.pos.z - 420);
  game.hemi.intensity = 2.2 - k * 0.6;
};

fontsReady().then(() => {
  buildCourse();
  reachCheckpoint(checkpoints[0], true);
  respawnAt(checkpoints[0]);
  game.cam.yaw = 0.5; // idle camera on the start screen looks down the course
  game.start();
});

// test hook
window.__obby = { game, run, checkpoints, startGame, reachCheckpoint, respawnAt };
