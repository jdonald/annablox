// City of Houses — mini browser version, built on the shared ANNABLOX engine.
// Collect from mailboxes, buy a cottage on an empty lot, watch it build up in stages,
// walk in through the front door (it's bigger on the inside!), buy upgrades,
// rebuild as a Two-Story House, then add a bedroom and an arcade upstairs.
import { Game, THREE, labelSprite, textTexture, studMaterial, fontsReady, store } from '../shared/engine.js';

const SAVE_KEY = 'annablox-city-v1';
const LOTS = [-66, -22, 22, 66];          // lot centres along the street (x)
const INTERIOR_Y = 300;                   // interiors float far above the city, out of sight
const HOUSE = { W: 18, D: 16, CZ: -26 };  // footprint; front face at z = -18

const TYPES = {
  cottage: { name: 'Small Cottage', base: 5, mult: 1, height: 14 },
  twostory: { name: 'Two-Story House', base: 20, mult: 2, height: 26, cost: 1200 },
};
const UPGRADES = {
  bath: { name: 'Bathroom', cost: 150, rate: 2, pad: [-16, 0, -11] },
  kitchen: { name: 'Kitchen', cost: 250, rate: 3, pad: [12, 0, -5] },
  washer: { name: 'Washer & Dryer', cost: 350, rate: 3, pad: [14, 0, 10] },
  tv: { name: 'Big-Screen TV', cost: 400, rate: 4, pad: [-14, 0, 6] },
  bedroom: { name: 'Bedroom', cost: 800, rate: 6, pad: [-12, 12, -4.8], twostory: true },
  arcade: { name: 'Arcade', cost: 3000, rate: 25, pad: [6, 12, -9], twostory: true },
  carport: { name: 'Carport', cost: 600, rate: 4, outside: true },
  car: { name: 'Car', cost: 900, rate: 6, outside: true, after: 'carport' },
};
const RANKS = ['Newcomer', 'Homeowner', 'Builder', 'Landlord'];
const NEXT_HINT = ['Next: buy a house', 'Next: own 2 houses', 'Next: an Arcade in a Two-Story', 'More ranks on Roblox!'];
const STARTER = { rate: 4, cap: 400 };

const game = new Game({ look: { skin: 0xffd43b, shirt: 0x4dabf7, pants: 0x364fc7, hair: 0x5c3d2e }, camDist: 22 });
const { scene } = game;
scene.fog = new THREE.Fog(0xa9cfe8, 90, 420);
scene.background.set(0xa9cfe8);

// ---------------------------------------------------------------- state
let S = defaultState();
function defaultState() {
  return { cash: 0, starter: 100, bought: 0, rank: 0, sawMore: false, houses: [null, null, null, null] };
}
function save() { store.set(SAVE_KEY, S); }

const fmt = (n) => '$' + Math.floor(n).toLocaleString('en-US');
function houseRate(h) {
  if (!h) return 0;
  const t = TYPES[h.type];
  let r = t.base;
  for (const k of Object.keys(h.up)) if (h.up[k]) r += UPGRADES[k].rate * t.mult;
  return r;
}
function totalRate() { return STARTER.rate + S.houses.reduce((a, h) => a + houseRate(h), 0); }
function cottagePrice() { return Math.round(100 * Math.pow(1.6, S.bought) / 10) * 10; }
function computeRank() {
  const owned = S.houses.filter(Boolean);
  let r = 0;
  if (owned.length >= 1) r = 1;
  if (owned.length >= 2) r = 2;
  if (owned.some((h) => h.type === 'twostory' && h.up.arcade)) r = 3;
  return Math.max(r, S.rank);
}

// ---------------------------------------------------------------- HUD
const cashEl = document.getElementById('cash');
const rateEl = document.getElementById('rate');
const rankEl = document.getElementById('rank');
const nextEl = document.getElementById('next');
const overhead = labelSprite('Newcomer', { scale: 6, color: '#ffd43b' });
scene.add(overhead);
function updateHUD() {
  cashEl.textContent = fmt(S.cash);
  rateEl.textContent = `+${fmt(totalRate())}/s`;
  rankEl.textContent = RANKS[S.rank];
  nextEl.textContent = NEXT_HINT[S.rank];
}
function checkRank() {
  const r = computeRank();
  if (r > S.rank) {
    S.rank = r;
    overhead.setText(RANKS[r], '#ffd43b');
    game.sfx.win();
    game.toast(`RANK UP! ${RANKS[r]}`, 3200);
    if (r === 3 && !S.sawMore) {
      S.sawMore = true;
      setTimeout(() => showMore('🏡', "You're a Landlord!",
        'Duplexes, pools, the Modern Villa and becoming Mayor are waiting in the full City of Houses on Roblox.'), 1600);
    }
  }
}

// ---------------------------------------------------------------- build animation
// Parts pop in one after another (foundation → walls → roof → windows), like the Roblox game.
const queue = [];
function track(list, s, stage, ctx) {
  list.push(s);
  if (ctx && ctx.animate) {
    s.mesh.scale.setScalar(0.001);
    s.disabled = true;
    queue.push({ s, at: ctx.t0 + stage * ctx.stageDelay + (ctx.n++) * 0.08, t: 0 });
  }
  return s;
}
game.updaters.push((t, dt) => {
  let sound = false;
  for (let i = queue.length - 1; i >= 0; i--) {
    const q = queue[i];
    if (t < q.at) continue;
    if (q.t === 0) sound = true;
    q.t += dt / 0.3;
    const k = Math.min(1, q.t);
    const e = k < 1 ? 1 + 2.2 * Math.pow(k - 1, 3) + 1.2 * Math.pow(k - 1, 2) : 1;
    q.s.mesh.scale.setScalar(Math.max(0.001, e));
    if (k >= 1) { q.s.disabled = false; queue.splice(i, 1); }
  }
  if (sound) game.sfx.build();
});
const mesh = (geo, mat) => ({ mesh: game.addMesh(new THREE.Mesh(geo, mat)) });
const ctxNew = (animate) => ({ animate, t0: game.elapsed, stageDelay: 0.9, n: 0 });
const removeAll = (list) => { list.forEach((s) => game.remove(s)); list.length = 0; };

// ---------------------------------------------------------------- city scenery
function buildCity() {
  // ground + streets
  game.box(0, 0, -100, 1400, 2, 1400, 0x7cc66b, { blockCamera: false, shadow: false });
  const flat = (x, z, w, d, color, y = 0.02) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshLambertMaterial({ color }));
    m.rotation.x = -Math.PI / 2;
    m.position.set(x, y, z);
    m.receiveShadow = true;
    scene.add(m);
  };
  flat(0, 14, 1400, 20, 0x5b6170);                // main street
  flat(0, 1, 1400, 6, 0xd5d9df, 0.04);            // sidewalk (our side)
  flat(0, 27, 1400, 6, 0xd5d9df, 0.04);           // sidewalk (far side)
  for (let x = -690; x < 700; x += 12) flat(x, 14, 6, 0.6, 0xffd43b, 0.05);
  // other streets of the big, empty city
  for (const x of [-110, 110, -330, 330]) flat(x, -150, 20, 1400, 0x5b6170, 0.03);
  for (const z of [-170, 200, -400]) flat(0, z, 1400, 20, 0x5b6170, 0.03);
  // "Future Development" blocks
  for (const [x, z] of [[0, 110], [-220, 110], [220, 110], [-220, -60], [220, -60], [0, -280], [-220, -280], [220, -280]]) {
    flat(x, z, 170, 140, 0x9aa5a0, 0.025);
  }
  game.sign(['Future', 'Development'], -12, 0, 60, { bg: '#6b7280', border: '#4b5563', rotY: 0 });
  game.sign(['Future', 'Development'], 130, 0, -50, { bg: '#6b7280', border: '#4b5563', rotY: -Math.PI / 2 });
  // our block: brighter lots with low hedges between them
  for (const lx of LOTS) {
    flat(lx, -24, 38, 42, 0x69bd5a, 0.03);
    flat(lx - 3, -10, 4, 14, 0xcfd3d8, 0.045); // front path
  }
  // streetlights
  for (let x = -100; x <= 100; x += 44) {
    game.cyl(x, 3.5, 0.35, 0, 12, 0x868e96, { segments: 8 });
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.4, 3), new THREE.MeshLambertMaterial({ color: 0x868e96 }));
    arm.position.set(x, 12, 5);
    scene.add(arm);
    const lamp = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.5, 1.2), new THREE.MeshBasicMaterial({ color: 0xfff3bf }));
    lamp.position.set(x, 11.7, 6.4);
    scene.add(lamp);
  }
  // a few trees at the edges of the block
  for (const [x, z] of [[-96, -10], [-96, -40], [96, -12], [96, -38], [-100, 34], [60, 36], [-40, 36]]) game.tree(x, 0, z, 0.9);
  // starter mailbox + spawn plaza sign
  game.sign(['City of Houses', 'Build it. Fill it!'], 0, 0, -8, { bg: '#1c7ed6', border: '#1864ab' });
}

// ---------------------------------------------------------------- mailboxes
const mailboxes = []; // { x, z, get(), take(), label, last }
function makeMailbox(x, z, get, take) {
  game.cyl(x, z, 0.25, 0, 3.4, 0x343a40, { segments: 8 });
  const boxM = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.2, 2), new THREE.MeshLambertMaterial({ color: 0x2b8a3e }));
  boxM.position.set(x, 4, z);
  boxM.castShadow = true;
  scene.add(boxM);
  const flag = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.8, 0.5), new THREE.MeshLambertMaterial({ color: 0xe03131 }));
  flag.position.set(x + 0.78, 4.4, z - 0.3);
  scene.add(flag);
  const label = labelSprite('$0', { scale: 5, color: '#8ce99a' });
  label.position.set(x, 6.2, z);
  scene.add(label);
  const mb = { x, z, get, take, label, last: -1, parts: [boxM, flag, label] };
  mailboxes.push(mb);
  return mb;
}

// ---------------------------------------------------------------- houses (outside)
const lotParts = LOTS.map(() => ({ ext: [], int: [], items: {}, mailbox: null }));

function gable(W, D, h, color) {
  const shape = new THREE.Shape([new THREE.Vector2(-D / 2, 0), new THREE.Vector2(D / 2, 0), new THREE.Vector2(0, h)]);
  const geo = new THREE.ExtrudeGeometry(shape, { depth: W, bevelEnabled: false });
  geo.translate(0, 0, -W / 2);
  const m = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ color }));
  m.rotation.y = Math.PI / 2;
  return m;
}

function buildExterior(i, animate) {
  const h = S.houses[i];
  const L = lotParts[i];
  removeAll(L.ext);
  const lx = LOTS[i];
  const cx = lx - 3, cz = HOUSE.CZ, W = HOUSE.W, D = HOUSE.D;
  const two = h.type === 'twostory';
  const wallTop = two ? 21 : 11;
  const ctx = ctxNew(animate);
  const add = (s, stage) => track(L.ext, s, stage, ctx);
  const wallColor = two ? 0xd0e7ff : [0xf8f9fa, 0xfff4e6, 0xebfbee, 0xf3f0ff][i];

  // stage 0: foundation
  add(game.box(cx, 1, cz, W + 0.8, 1.2, D + 0.6, 0xadb5bd), 0);
  // stage 1: walls
  add(game.box(cx, wallTop, cz, W, wallTop - 1, D, wallColor), 1);
  if (two) add(game.box(cx, 11.6, cz + 0.05, W + 0.6, 0.8, D + 0.6, 0xffffff, { noCollide: true }), 1);
  // stage 2: roof
  const rh = 5;
  const roofColor = two ? 0xc92a2a : 0xe8590c;
  const g = gable(W + 0.2, D, rh, wallColor);
  g.position.set(cx, wallTop, cz);
  add({ mesh: game.addMesh(g) }, 2);
  const ang = Math.atan2(rh, D / 2);
  const len = Math.hypot(rh, D / 2) + 1;
  for (const side of [1, -1]) {
    const p = new THREE.Mesh(new THREE.BoxGeometry(W + 1.6, 0.6, len), new THREE.MeshLambertMaterial({ color: roofColor }));
    p.position.set(cx, wallTop + rh / 2 + 0.25, cz + side * D / 4);
    p.rotation.x = side * ang;
    add({ mesh: game.addMesh(p) }, 2);
  }
  const chim = new THREE.Mesh(new THREE.BoxGeometry(1.6, 4, 1.6), new THREE.MeshLambertMaterial({ color: 0xa5524a }));
  chim.position.set(cx + 5, wallTop + rh, cz - 3);
  add({ mesh: game.addMesh(chim) }, 2);
  // stage 3: door + windows
  const winMat = new THREE.MeshLambertMaterial({ color: 0xa5d8ff, emissive: 0x4dabf7, emissiveIntensity: 0.25 });
  const front = cz + D / 2 + 0.03;
  const door = new THREE.Mesh(new THREE.PlaneGeometry(4.6, 7.5), new THREE.MeshLambertMaterial({ color: 0x5c3d2e }));
  door.position.set(cx, 1 + 3.75, front + 0.02);
  add({ mesh: game.addMesh(door) }, 3);
  const doorTrim = new THREE.Mesh(new THREE.BoxGeometry(5.6, 0.5, 0.4), new THREE.MeshLambertMaterial({ color: 0xffffff }));
  doorTrim.position.set(cx, 9, front + 0.2);
  add({ mesh: game.addMesh(doorTrim) }, 3);
  const rows = two ? [6.5, 16] : [6.5];
  for (const y of rows) {
    for (const wx of (y > 10 ? [-5.5, 0, 5.5] : [-5.5, 5.5])) {
      const w = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 3), winMat);
      w.position.set(cx + wx, y, front + 0.01);
      add({ mesh: game.addMesh(w) }, 3);
    }
  }
  for (const side of [1, -1]) {
    const w = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 3), winMat);
    w.rotation.y = side * Math.PI / 2;
    w.position.set(cx + side * (W / 2 + 0.03), 6.5, cz);
    add({ mesh: game.addMesh(w) }, 3);
  }
  // bushes
  for (const bx of [-7, 7]) {
    const b = new THREE.Mesh(new THREE.SphereGeometry(1.6, 12, 8), new THREE.MeshLambertMaterial({ color: 0x2f9e44 }));
    b.position.set(cx + bx, 1.4, cz + D / 2 + 2);
    add({ mesh: game.addMesh(b) }, 3);
  }
  if (h.up.carport) buildCarport(i, animate);
  if (h.up.car) buildCar(i, animate);
}

function buildCarport(i, animate) {
  const L = lotParts[i];
  const x = LOTS[i] + 13, z = HOUSE.CZ;
  const ctx = ctxNew(animate);
  const add = (s, st) => track(L.ext, s, st, ctx);
  for (const [dx, dz] of [[-4.5, -7.5], [4.5, -7.5], [-4.5, 7.5], [4.5, 7.5]]) add(game.box(x + dx, 9, z + dz, 0.7, 9, 0.7, 0xf1f3f5), 0);
  add(game.box(x, 9.6, z, 11, 0.6, 17, 0xc92a2a, { noCollide: true }), 1);
  const slab = new THREE.Mesh(new THREE.PlaneGeometry(10, 26), new THREE.MeshLambertMaterial({ color: 0x868e96 }));
  slab.rotation.x = -Math.PI / 2;
  slab.position.set(x, 0.05, z + 5);
  add({ mesh: game.addMesh(slab) }, 0);
}

function buildCar(i, animate) {
  const L = lotParts[i];
  const x = LOTS[i] + 13, z = HOUSE.CZ;
  const ctx = ctxNew(animate);
  const add = (s, st) => track(L.ext, s, st, ctx);
  const color = [0x1c7ed6, 0xe03131, 0x2f9e44, 0xf08c00][i];
  add(game.box(x, 3.2, z, 5.6, 2.2, 10, color), 0);
  add(game.box(x, 5.4, z - 0.5, 5, 2.2, 5.5, color, { noCollide: true }), 1);
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(4.4, 1.8), new THREE.MeshLambertMaterial({ color: 0x1d2433 }));
  glass.position.set(x, 5.3, z + 2.27);
  add({ mesh: game.addMesh(glass) }, 1);
  for (const [dx, dz] of [[-2.9, -3.3], [2.9, -3.3], [-2.9, 3.3], [2.9, 3.3]]) {
    const w = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.1, 0.8, 14), new THREE.MeshLambertMaterial({ color: 0x212529 }));
    w.rotation.z = Math.PI / 2;
    w.position.set(x + dx, 1.1, z + dz);
    add({ mesh: game.addMesh(w) }, 0);
  }
  for (const dx of [-1.8, 1.8]) {
    const hl = new THREE.Mesh(new THREE.PlaneGeometry(1, 0.6), new THREE.MeshBasicMaterial({ color: 0xfff9db }));
    hl.position.set(x + dx, 3, z + 5.02);
    add({ mesh: game.addMesh(hl) }, 1);
  }
}

// ---------------------------------------------------------------- interiors
function interiorOrigin(i) { return new THREE.Vector3(LOTS[i] * 3, INTERIOR_Y, -300); }

function buildInterior(i) {
  const h = S.houses[i];
  const L = lotParts[i];
  removeAll(L.int);
  for (const k of Object.keys(L.items)) removeAll(L.items[k]);
  L.items = {};
  const O = interiorOrigin(i);
  const H = TYPES[h.type].height;
  const two = h.type === 'twostory';
  const add = (s) => { L.int.push(s); return s; };
  const box = (x, top, z, sx, sy, sz, color, opts = {}) => add(game.box(O.x + x, O.y + top, O.z + z, sx, sy, sz, color, { shadow: false, ...opts }));
  const floorMat = new THREE.MeshLambertMaterial({ color: 0xb5bcc6 });
  const wallMat = new THREE.MeshLambertMaterial({ color: 0xf1ece4 });
  const ceilMat = new THREE.MeshLambertMaterial({ color: 0x6c7a92 });

  box(0, 0, 0, 50, 2, 38, 0, { material: floorMat });
  box(0, H, -18.5, 50, H, 1, 0, { material: wallMat });
  box(-24.5, H, 0, 1, H, 38, 0, { material: wallMat });
  box(24.5, H, 0, 1, H, 38, 0, { material: wallMat });
  box(-13.75, H, 18.5, 21.5, H, 1, 0, { material: wallMat });
  box(13.75, H, 18.5, 21.5, H, 1, 0, { material: wallMat });
  box(0, H, 18.5, 6, H - 8, 1, 0, { material: wallMat });
  // invisible stopper just outside the exit so you can't walk off into the sky
  box(0, 8, 19.6, 6.4, 8, 1, 0, { material: new THREE.MeshBasicMaterial({ visible: false }), blockCamera: false });
  box(0, H + 1, 0, 50, 1, 38, 0, { material: ceilMat });
  // ceiling lights
  for (const [x, z] of [[-12, 8], [12, 8], [-12, -10], [12, -10]]) {
    const l = new THREE.Mesh(new THREE.PlaneGeometry(6, 2), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    l.rotation.x = Math.PI / 2;
    l.position.set(O.x + x, O.y + H - 0.02, O.z + z);
    add({ mesh: game.addMesh(l, false) });
  }
  // frosted windows
  for (const [x, z, ry] of [[-23.9, 0, Math.PI / 2], [23.9, -9, -Math.PI / 2], [-12, -17.9, 0], [12, -17.9, 0]]) {
    const w = new THREE.Mesh(new THREE.PlaneGeometry(7, 4), new THREE.MeshBasicMaterial({ color: 0x99e9f2 }));
    w.rotation.y = ry;
    w.position.set(O.x + x, O.y + 6.5, O.z + z);
    add({ mesh: game.addMesh(w, false) });
  }
  // exit door
  const exitDoor = new THREE.Mesh(new THREE.PlaneGeometry(6, 8), new THREE.MeshBasicMaterial({ color: 0x2b3a4a }));
  exitDoor.position.set(O.x, O.y + 4, O.z + 18.9);
  exitDoor.rotation.y = Math.PI;
  add({ mesh: game.addMesh(exitDoor, false) });
  const exitSign = new THREE.Mesh(new THREE.PlaneGeometry(5, 2.5), new THREE.MeshBasicMaterial({ map: textTexture(['EXIT'], { bg: '#2f9e44', border: '#1e6b2f', size: 120 }), transparent: true }));
  exitSign.position.set(O.x, O.y + 9.5, O.z + 17.9);
  exitSign.rotation.y = Math.PI;
  add({ mesh: game.addMesh(exitSign, false) });
  // bathroom partition walls (back-left corner)
  box(-21.5, 12, -6, 5, 12, 0.6, 0xe9ecef);
  box(-10.5, 12, -6, 5, 12, 0.6, 0xe9ecef);
  box(-8, 12, -12, 0.6, 12, 12, 0xe9ecef);
  // rug + plant
  const rug = new THREE.Mesh(new THREE.PlaneGeometry(10, 12), new THREE.MeshLambertMaterial({ color: 0xd9b48f }));
  rug.rotation.x = -Math.PI / 2;
  rug.position.set(O.x - 14, O.y + 0.03, O.z + 6);
  add({ mesh: game.addMesh(rug, false) });

  if (two) {
    // stairs up the right wall to a second floor over the back half
    for (let s = 0; s < 12; s++) {
      const zc = 14 - (s + 0.5) * (16 / 12);
      box(21.5, s + 1, zc, 5, s + 1, 16 / 12 + 0.02, 0x8d5a2b);
    }
    box(-2.5, 12, -10, 45, 1, 16, 0xcbb89d);           // upstairs floor (x -25..20)
    box(21.5, 12, -10, 5, 1, 16, 0xcbb89d);            // landing next to the top step
    box(-3, 15, -2.2, 43, 3, 0.4, 0xffffff);            // railing along the edge
    game.sign(['Upstairs!'], O.x + 21.5, O.y + 12, O.z - 14, { noPost: true, w: 5, h: 2.5, bg: '#7048e8', border: '#5f3dc4' });
  }
  for (const k of Object.keys(UPGRADES)) if (h.up[k] && !UPGRADES[k].outside) buildItem(i, k, false);
}

function buildItem(i, key, animate) {
  const L = lotParts[i];
  const O = interiorOrigin(i);
  const list = (L.items[key] = []);
  const ctx = ctxNew(animate);
  ctx.stageDelay = 0.4;
  const box = (x, top, z, sx, sy, sz, color, opts = {}) =>
    track(list, game.box(O.x + x, O.y + top, O.z + z, sx, sy, sz, color, { shadow: false, ...opts }), opts.stage || 0, ctx);
  const plane = (x, y, z, w, hgt, mat, ry = 0) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, hgt), mat);
    m.position.set(O.x + x, O.y + y, O.z + z);
    m.rotation.y = ry;
    return track(list, { mesh: game.addMesh(m, false) }, 1, ctx);
  };
  if (key === 'tv') {
    box(-22.6, 2.4, 6, 2.4, 2.4, 11, 0x3b2a20);
    box(-23.5, 10, 6, 0.5, 6, 10.5, 0x111111, { stage: 1 });
    const screen = new THREE.MeshBasicMaterial({ color: 0x22b8cf });
    plane(-23.2, 7, 6, 9.6, 5.2, screen, Math.PI / 2);
    game.updaters.push((t) => screen.color.setHSL((t * 0.08) % 1, 0.7, 0.55));
    box(-9.5, 2.2, 6, 3.5, 2.2, 10, 0x364fc7, { stage: 1 });
    box(-7.9, 4.6, 6, 1, 4.6, 10, 0x364fc7, { stage: 1 });
    box(-22.6, 5, 0, 1.4, 5, 1.4, 0x212529, { noCollide: true, stage: 1 });
    box(-22.6, 5, 12, 1.4, 5, 1.4, 0x212529, { noCollide: true, stage: 1 });
  } else if (key === 'kitchen') {
    box(13, 3.5, -16.5, 18, 3.5, 3, 0x8d6e63);
    box(13, 3.8, -16.5, 18.4, 0.3, 3.4, 0x212529, { noCollide: true, stage: 1 });
    box(13, 11, -17.4, 14, 3, 1.2, 0x8d6e63, { noCollide: true, stage: 1 });
    box(23, 9, -15.5, 2.6, 9, 4, 0xced4da, { stage: 1 });
    box(10, 3.5, -10, 7, 3.5, 3.2, 0x8d6e63, { stage: 1 });
    box(10, 3.8, -10, 7.4, 0.3, 3.6, 0xf8f9fa, { noCollide: true, stage: 2 });
    for (const dx of [-2, 2]) box(10 + dx, 2.4, -7.3, 1.4, 2.4, 1.4, 0x212529, { noCollide: true, stage: 2 });
  } else if (key === 'bath') {
    box(-19.5, 2.4, -15.5, 8, 2.4, 4, 0xf8f9fa);
    const water = new THREE.MeshLambertMaterial({ color: 0x74c0fc });
    const w = new THREE.Mesh(new THREE.PlaneGeometry(7, 3), water);
    w.rotation.x = -Math.PI / 2;
    w.position.set(O.x - 19.5, O.y + 2.42, O.z - 15.5);
    track(list, { mesh: game.addMesh(w, false) }, 1, ctx);
    box(-11, 2.2, -16.5, 2, 2.2, 2.4, 0xf8f9fa, { stage: 1 });
    box(-11, 4.6, -17.6, 2.4, 2.4, 0.8, 0xf8f9fa, { stage: 1 });
    box(-10, 3.4, -9, 2.6, 3.4, 2, 0xf1f3f5, { stage: 2 });
    plane(-10, 8, -6.35, 2.4, 3, new THREE.MeshBasicMaterial({ color: 0xc5f6fa }), Math.PI);
  } else if (key === 'washer') {
    for (const dx of [-2.2, 2.2]) {
      box(14 + dx, 4.2, 15.8, 4, 4.2, 3.6, 0xf8f9fa);
      const d = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.2, 0.2, 20), new THREE.MeshLambertMaterial({ color: 0x495057 }));
      d.rotation.x = Math.PI / 2;
      d.position.set(O.x + 14 + dx, O.y + 2.2, O.z + 13.9);
      track(list, { mesh: game.addMesh(d, false) }, 1, ctx);
    }
  } else if (key === 'bedroom') {
    box(-14, 13.8, -13, 8, 1.8, 10, 0x8d5a2b);
    box(-14, 14.6, -13, 7.4, 0.8, 9.4, 0xf8f9fa, { noCollide: true, stage: 1 });
    box(-14, 15.2, -16.4, 6, 0.8, 1.8, 0xffffff, { noCollide: true, stage: 2 });
    box(-14, 14.75, -11, 7.6, 0.4, 5.6, 0xf783ac, { noCollide: true, stage: 2 });
    box(-14, 18, -17.6, 8.4, 6, 0.6, 0x8d5a2b, { stage: 1 });
    box(-7.5, 15, -16, 2.4, 2, 2.4, 0x8d5a2b, { stage: 1 });
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.9, 12, 8), new THREE.MeshBasicMaterial({ color: 0xfff3bf }));
    lamp.position.set(O.x - 7.5, O.y + 15.9, O.z - 16);
    track(list, { mesh: game.addMesh(lamp, false) }, 2, ctx);
  } else if (key === 'arcade') {
    const cols = [0xf03e3e, 0x7048e8, 0x1098ad, 0xf59f00];
    cols.forEach((c, n) => {
      const x = -2 + n * 5.2;
      box(x, 20.5, -16.2, 3.6, 7.5, 3, c, { stage: n % 2 });
      const scr = new THREE.MeshBasicMaterial({ color: 0x000000 });
      plane(x, 17.5, -14.65, 2.8, 2.2, scr);
      game.updaters.push((t) => scr.color.setHSL((t * 0.3 + n * 0.25) % 1, 0.9, 0.5 + 0.1 * Math.sin(t * 6 + n)));
      box(x, 15.8, -14.2, 3.6, 0.6, 1.2, 0x212529, { noCollide: true, stage: 1 });
    });
    for (let n = 0; n < 6; n++) {
      const tile = new THREE.Mesh(new THREE.PlaneGeometry(3, 3), new THREE.MeshBasicMaterial({ color: cols[n % 4], transparent: true, opacity: 0.6 }));
      tile.rotation.x = -Math.PI / 2;
      tile.position.set(O.x - 1 + (n % 3) * 4.5, O.y + 12.04, O.z - 10 + Math.floor(n / 3) * 4);
      track(list, { mesh: game.addMesh(tile, false) }, 2, ctx);
    }
    game.sign(['ARCADE'], O.x + 6, O.y + 21, O.z - 17.8, { noPost: true, w: 8, h: 2.5, bg: '#212529', border: '#f03e3e', color: '#ffd43b' });
  }
}

// ---------------------------------------------------------------- build pads
const pads = []; // { x, y, z, r, mesh, sprite, onBuy, inside }
function clearPads() {
  for (const p of pads) { p.mesh.removeFromParent(); p.sprite.removeFromParent(); }
  pads.length = 0;
}
function addPad(x, y, z, title, price, onBuy, color = 0x51cf66) {
  const affordable = price === null || S.cash >= price;
  const m = new THREE.Mesh(new THREE.BoxGeometry(6, 0.3, 6), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.85 }));
  m.position.set(x, y + 0.16, z);
  scene.add(m);
  const tex = textTexture([title, price === null ? '' : fmt(price)].filter(Boolean), {
    bg: price === null ? '#7048e8' : (affordable ? '#2b8a3e' : '#495057'),
    border: '#ffffff', size: 56, width: 512, height: 220,
  });
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthWrite: false }));
  sprite.scale.set(7, 3, 1);
  sprite.position.set(x, y + 4.5, z);
  scene.add(sprite);
  // if you're already standing here (e.g. the next pad appears under you), wait until you step off
  const p = game.state.pos;
  const inside = Math.abs(p.x - x) < 3 && Math.abs(p.z - z) < 3 && Math.abs(p.y - y) < 2;
  const pad = { x, y, z, mesh: m, sprite, price, onBuy, inside, title };
  pads.push(pad);
  return pad;
}

function tryBuy(price, what, fn) {
  if (S.cash < price) {
    game.sfx.error();
    game.toast(`Need ${fmt(price - S.cash)} more for ${what}`);
    return;
  }
  S.cash -= price;
  game.sfx.coin();
  fn();
  checkRank();
  refreshPads();
  updateHUD();
  save();
}

function refreshPads() {
  clearPads();
  LOTS.forEach((lx, i) => {
    const h = S.houses[i];
    if (!h) {
      const price = cottagePrice();
      addPad(lx - 3, 0, -10, 'Small Cottage', price, () => tryBuy(price, 'a cottage', () => {
        S.houses[i] = { type: 'cottage', up: {}, mail: 0 };
        S.bought++;
        buildExterior(i, true);
        buildInterior(i);
        ensureMailbox(i);
        game.toast('Your cottage is being built!');
      }));
      return;
    }
    // outside upgrades: carport, then car
    if (S.rank >= 1) {
      const key = !h.up.carport ? 'carport' : (!h.up.car ? 'car' : null);
      if (key) {
        const u = UPGRADES[key];
        addPad(lx + 13, 0, -10, u.name, u.cost, () => tryBuy(u.cost, u.name, () => {
          h.up[key] = true;
          if (key === 'carport') buildCarport(i, true); else buildCar(i, true);
        }));
      }
    }
    if (h.type === 'cottage' && S.rank >= 2) {
      const cost = TYPES.twostory.cost;
      addPad(lx - 3, 0, -10, 'Rebuild: Two-Story', cost, () => tryBuy(cost, 'a Two-Story House', () => {
        payMailbox(i);
        h.type = 'twostory';
        buildExterior(i, true);
        buildInterior(i);
        game.toast('Rebuilding as a Two-Story House!');
      }), 0x339af0);
    } else if (h.type === 'twostory') {
      addPad(lx - 3, 0, -10, 'Modern Villa', null, () => showMore('🏙️', 'Modern Villa',
        'Villas, duplexes, pools and the Mayor rank are in the full City of Houses on Roblox!'), 0x9775fa);
    }
    // inside upgrades
    if (S.rank >= 1) {
      const O = interiorOrigin(i);
      for (const [key, u] of Object.entries(UPGRADES)) {
        if (u.outside || h.up[key]) continue;
        if (u.twostory && h.type !== 'twostory') continue;
        addPad(O.x + u.pad[0], O.y + u.pad[1], O.z + u.pad[2], u.name, u.cost, () => tryBuy(u.cost, u.name, () => {
          h.up[key] = true;
          buildItem(i, key, true);
          game.toast(`${u.name} installed! +${fmt(u.rate * TYPES[h.type].mult)}/s`);
        }));
      }
    }
  });
}

// pads change colour when you can (or can't) afford them
let lastAffordKey = '';
function refreshAffordability() {
  const key = pads.map((p) => (p.price === null || S.cash >= p.price ? 1 : 0)).join('');
  if (key !== lastAffordKey) { lastAffordKey = key; refreshPads(); }
}

// ---------------------------------------------------------------- mailboxes per house
function ensureMailbox(i) {
  const L = lotParts[i];
  if (L.mailbox) return;
  L.mailbox = makeMailbox(LOTS[i] - 15, -5,
    () => S.houses[i].mail,
    () => { const v = S.houses[i].mail; S.houses[i].mail = 0; return v; });
}
function payMailbox(i) {
  const v = S.houses[i].mail;
  if (v >= 1) { S.cash += v; S.houses[i].mail = 0; }
}

// ---------------------------------------------------------------- doors (portals)
let portalCooldown = 0;
function enterHouse(i) {
  const O = interiorOrigin(i);
  game.teleport(new THREE.Vector3(O.x, O.y, O.z + 13), Math.PI, 0);
  portalCooldown = 1.2;
  game.sfx.pop();
  if (!S.seenInside) { S.seenInside = true; game.toast('Bigger on the inside!'); }
}
function exitHouse(i) {
  game.teleport(new THREE.Vector3(LOTS[i] - 3, 0, -12), 0, Math.PI);
  portalCooldown = 1.2;
  game.sfx.pop();
}

// ---------------------------------------------------------------- per-step rules
const st = game.state;
game.afterStep = (dt) => {
  const p = st.pos;
  portalCooldown = Math.max(0, portalCooldown - dt);
  if (p.y < -30) game.teleport(new THREE.Vector3(0, 0, 8), Math.PI, 0);
  // pads
  for (const pad of pads) {
    const inside = Math.abs(p.x - pad.x) < 3 && Math.abs(p.z - pad.z) < 3 && Math.abs(p.y - pad.y) < 2;
    if (inside && !pad.inside) { pad.inside = true; pad.onBuy(); return; }
    pad.inside = inside;
  }
  // mailboxes
  for (const mb of mailboxes) {
    if (Math.hypot(p.x - mb.x, p.z - mb.z) < 3 && p.y < 6) {
      const v = Math.floor(mb.get());
      if (v >= 1) {
        S.cash += mb.take();
        game.sfx.coin();
        game.toast(`+${fmt(v)}`, 1200);
        updateHUD();
        save();
      }
    }
  }
  if (portalCooldown > 0) return;
  // front doors / exits
  S.houses.forEach((h, i) => {
    if (!h) return;
    const cx = LOTS[i] - 3;
    if (Math.abs(p.x - cx) < 2.6 && p.z < -16.3 && p.z > -17.8 && p.y < 3) enterHouse(i);
    const O = interiorOrigin(i);
    if (Math.abs(p.x - O.x) < 3 && p.z > O.z + 16.3 && Math.abs(p.y - O.y) < 3) exitHouse(i);
  });
};

// ---------------------------------------------------------------- money ticking
let saveTimer = 0;
game.updaters.push((t, dt) => {
  if (!game.running) return;
  S.starter = Math.min(STARTER.cap, S.starter + STARTER.rate * dt);
  S.houses.forEach((h) => { if (h) h.mail = Math.min(houseRate(h) * 100, h.mail + houseRate(h) * dt); });
  for (const mb of mailboxes) {
    const v = Math.floor(mb.get());
    if (v !== mb.last) { mb.last = v; mb.label.setText(fmt(v), '#8ce99a'); }
  }
  refreshAffordability();
  saveTimer += dt;
  if (saveTimer > 3) { saveTimer = 0; save(); }
});
game.onFrame = () => {
  overhead.position.set(st.pos.x, st.pos.y + 7.2, st.pos.z);
  cashEl.textContent = fmt(S.cash);
};

// ---------------------------------------------------------------- overlays
const moreEl = document.getElementById('more');
function showMore(icon, title, text) {
  document.getElementById('more-icon').textContent = icon;
  document.getElementById('more-title').textContent = title;
  document.getElementById('more-text').textContent = text;
  moreEl.hidden = false;
  game.locked = true;
}
document.getElementById('keep').addEventListener('click', () => { moreEl.hidden = true; game.locked = false; });

function loadWorld() {
  S.houses.forEach((h, i) => {
    if (!h) return;
    buildExterior(i, false);
    buildInterior(i);
    ensureMailbox(i);
  });
  overhead.setText(RANKS[S.rank], '#ffd43b');
  refreshPads();
  updateHUD();
}

function begin() {
  game.unlockAudio();
  document.getElementById('start').hidden = true;
  game.running = true;
  if (S.houses.every((h) => !h)) game.toast('Grab the money in the mailbox!');
}
document.getElementById('go').addEventListener('click', begin);
document.getElementById('restart').addEventListener('click', () => {
  if (!confirm('Start a brand new city? Your houses will be gone.')) return;
  store.del(SAVE_KEY);
  location.reload();
});
game.bindSoundButton(document.getElementById('sound'));

fontsReady().then(() => {
  const saved = store.get(SAVE_KEY);
  if (saved && saved.houses) {
    S = { ...defaultState(), ...saved };
    document.getElementById('go').textContent = 'Continue';
    document.getElementById('restart-row').hidden = false;
  }
  buildCity();
  makeMailbox(-4, 1, () => S.starter, () => { const v = S.starter; S.starter = 0; return v; });
  loadWorld();
  game.teleport(new THREE.Vector3(4, 0, 8), Math.PI, 0.35);
  game.start();
});

window.__city = { game, get S() { return S; }, set S(v) { S = v; }, LOTS, interiorOrigin, refreshPads, updateHUD };
