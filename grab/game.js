// Grab 'n' Go Adventure — mini browser version, built on the shared ANNABLOX engine.
// A tiny Maplebrook with the start of each storyline:
//  [Main] Morning Rush: find coins → buy coffee → wake up Dana → Arcade Token
//  [Main] The Great Trading Trail: claw machine → Hamato Doll → ribbon → dog food → bananas → monkey (→ Roblox)
//  [Side] Cluck Cluck: find 5 chickens; carry them on your head to glide over the Windy Cliffs gap
//  [Side] Roadster Rescue: find Mr. Goldbucks' gas-thruster Roadster (driving it → Roblox)
//  [Main] Fraudanos: pitch BoogerScan™ in Silicon Hills, get found out, get "arrested" (→ Roblox)
import { Game, THREE, labelSprite, textTexture, fontsReady, store } from '../shared/engine.js';

const SAVE_KEY = 'annablox-grab-v1';
const CHICKENS = 5;

const game = new Game({ look: { skin: 0xffd43b, shirt: 0xf59f00, pants: 0x1c4fbf, hair: 0x3b2a20 }, camDist: 20 });
const { scene } = game;
scene.background.set(0x74c0fc);
scene.fog = new THREE.Fog(0xbfe3ff, 160, 520);

// ---------------------------------------------------------------- items & quests
const ITEMS = {
  coins: { e: '🪙', name: 'Coins' },
  coffee: { e: '☕', name: 'Coffee' },
  token: { e: '🎟️', name: 'Arcade Token' },
  doll: {
    e: '🐀', name: 'Hamato Doll',
    fact: 'This plush rat sensei is a nod to Hamato Yoshi, the wise teacher of the Teenage Mutant Ninja Turtles — and to the Yoshi Doll you trade in Zelda: Link\'s Awakening!',
  },
  ribbon: { e: '🎀', name: 'Ribbon' },
  dogfood: { e: '🥫', name: 'Dog Food' },
  bananas: {
    e: '🍌', name: 'Bananas',
    fact: 'Banana "trees" aren\'t really trees — they\'re giant herbs! The "trunk" is made of leaves rolled up tight, and each bunch of bananas grows from one big flower.',
  },
  stick: { e: '🪵', name: 'A Very Nice Stick' },
  glider: {
    e: '🐓', name: 'Rooster Glider',
    fact: 'Chickens can\'t fly far, but they flap up into trees and glide down. The longest chicken flight on record lasted 13 seconds! Hold jump in the air to glide.',
  },
};

const QUESTS = {
  morning: { title: 'Morning Rush', main: true },
  trail: { title: 'The Great Trading Trail', main: true },
  chickens: { title: 'Cluck Cluck, Where\'d They Go?', main: false },
  roadster: { title: 'Roadster Rescue', main: false },
  fraud: { title: 'Fraudanos', main: true },
};

let S = defaultState();
function defaultState() {
  return {
    q: {},              // id -> { status: 'active'|'done'|'roblox', step }
    items: [],
    coinsTaken: false,
    chickens: [],       // ids picked up (carried or delivered)
    carrying: 0,
    delivered: 0,
    glider: false,
    tracked: null,
  };
}
const save = () => store.set(SAVE_KEY, S);
const has = (k) => S.items.includes(k);
const give = (k) => { if (!has(k)) S.items.push(k); };
const take = (k) => { S.items = S.items.filter((x) => x !== k); };
const qs = (id) => S.q[id] || null;
const active = (id) => qs(id) && qs(id).status === 'active';
const done = (id) => qs(id) && qs(id).status !== 'active';

function objective(id) {
  const q = qs(id);
  if (!q) return '';
  if (q.status === 'done') return 'Done!';
  if (q.status === 'roblox') return 'Continues in the full game on Roblox';
  switch (id) {
    case 'morning':
      if (has('coffee')) return 'Bring the coffee to Dana';
      if (has('coins')) return 'Buy a coffee at Bean There Café';
      return 'Find some money for coffee (try the park)';
    case 'trail':
      if (has('bananas')) return 'Someone in the banana grove looks hungry…';
      if (has('dogfood')) return 'Grocer Gus\'s pup is out of food';
      if (has('ribbon')) return 'Mr. Patel\'s dog needs something fancy';
      if (has('doll')) return 'Mia at the playground loves ninjas';
      return 'Win a prize from the claw machine at the Arcade';
    case 'chickens':
      if (S.carrying) return `Bring ${S.carrying} chicken${S.carrying > 1 ? 's' : ''} to Farmer Hattie`;
      return `Find Farmer Hattie's chickens (${S.delivered}/${CHICKENS} home)`;
    case 'roadster': return 'Find the Roadster at the cliff garage (west)';
    case 'fraud': return 'Pitch your startup to Venture Val';
    default: return '';
  }
}

// ---------------------------------------------------------------- UI helpers
const $ = (id) => document.getElementById(id);
const objEl = $('objective');
function updateObjective() {
  let id = S.tracked && active(S.tracked) ? S.tracked : null;
  if (!id) id = Object.keys(S.q).reverse().find((k) => active(k)) || null;
  S.tracked = id;
  if (!id) { objEl.textContent = 'Explore Maplebrook'; objEl.classList.remove('side'); return; }
  objEl.textContent = '▶ ' + objective(id);
  objEl.classList.toggle('side', !QUESTS[id].main);
}
let bannerTimer = null;
function banner(kind, title, cls) {
  const b = $('banner');
  $('banner-kind').textContent = kind;
  $('banner-title').textContent = title;
  b.className = 'banner ' + (cls || '');
  b.hidden = false;
  // restart the pop animation
  b.style.animation = 'none'; void b.offsetWidth; b.style.animation = '';
  clearTimeout(bannerTimer);
  bannerTimer = setTimeout(() => { b.hidden = true; }, 2600);
}
function startQuest(id) {
  if (qs(id)) return;
  S.q[id] = { status: 'active', step: 0 };
  S.tracked = id;
  game.sfx.chime();
  banner(QUESTS[id].main ? 'NEW MAIN QUEST' : 'NEW SIDE QUEST', QUESTS[id].title, QUESTS[id].main ? '' : 'side');
  changed();
}
function finishQuest(id, status = 'done') {
  S.q[id].status = status;
  game.sfx.win();
  banner(status === 'done' ? 'QUEST COMPLETE' : 'TO BE CONTINUED', QUESTS[id].title, 'done');
  changed();
}
function gotItem(k) {
  give(k);
  game.toast(`${ITEMS[k].e} Got: ${ITEMS[k].name}`, 2200);
  game.sfx.coin();
  changed();
}
function changed() { updateObjective(); updateAlerts(); updateCarry(); save(); }

// overlays
function openOverlay(id) { $(id).hidden = false; game.locked = true; }
function closeOverlay(id) {
  $(id).hidden = true;
  if (['quests', 'pouch', 'fact', 'claw', 'more', 'start'].every((o) => $(o).hidden) && $('dialog').hidden) game.locked = false;
}
document.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', () => closeOverlay(b.closest('.overlay').id)));

function showFact(k) {
  const it = ITEMS[k];
  $('fact-emoji').textContent = it.e;
  $('fact-title').textContent = it.name;
  $('fact-text').textContent = it.fact;
  openOverlay('fact');
}
function showMore(icon, title, text) {
  $('more-icon').textContent = icon;
  $('more-title').textContent = title;
  $('more-text').textContent = text;
  openOverlay('more');
}
function renderQuests() {
  const list = $('quest-list');
  list.innerHTML = '';
  const ids = Object.keys(S.q);
  if (!ids.length) list.innerHTML = '<p class="sub">No quests yet. Talk to people with a ! over their heads.</p>';
  for (const id of ids) {
    const q = QUESTS[id];
    const d = document.createElement('div');
    d.className = 'quest' + (q.main ? '' : ' side') + (active(id) ? '' : ' done');
    d.innerHTML = `<span class="tag2">${q.main ? 'MAIN QUEST' : 'SIDE QUEST'}</span><b></b><span class="obj"></span>`;
    d.querySelector('b').textContent = (active(id) ? '' : (qs(id).status === 'done' ? '✓ ' : '🎮 ')) + q.title;
    d.querySelector('.obj').textContent = objective(id);
    if (active(id)) {
      d.style.cursor = 'pointer';
      d.title = 'Track this quest';
      d.addEventListener('click', () => { S.tracked = id; updateObjective(); closeOverlay('quests'); });
    }
    list.appendChild(d);
  }
}
function renderPouch() {
  const list = $('pouch-list');
  list.innerHTML = '';
  if (!S.items.length) {
    list.innerHTML = '<div class="item empty">Empty! Go help someone.</div>';
    return;
  }
  for (const k of S.items) {
    const it = ITEMS[k];
    const b = document.createElement('button');
    b.className = 'item';
    b.innerHTML = `<span class="e"></span><span class="n"></span>`;
    b.querySelector('.e').textContent = it.e;
    b.querySelector('.n').textContent = it.name + (it.fact ? ' ⭐' : '');
    if (it.fact) b.addEventListener('click', () => { closeOverlay('pouch'); showFact(k); });
    list.appendChild(b);
  }
}
const toggleQuests = () => { if ($('quests').hidden) { if (game.locked) return; renderQuests(); openOverlay('quests'); } else closeOverlay('quests'); };
const togglePouch = () => { if ($('pouch').hidden) { if (game.locked) return; renderPouch(); openOverlay('pouch'); } else closeOverlay('pouch'); };
$('btn-quests').addEventListener('click', toggleQuests);
$('btn-pouch').addEventListener('click', togglePouch);
game.onKey('KeyJ', toggleQuests);
game.onKey('KeyB', togglePouch);
game.onKey('KeyI', togglePouch);

// ---------------------------------------------------------------- dialogue
// lines: strings, or { text, choices: [{ label, then: () => moreLines | undefined }] }
const dlg = { lines: [], i: 0, who: '', done: null, openedAt: 0 };
function talk(who, lines, doneFn) {
  dlg.lines = lines.slice();
  dlg.i = 0;
  dlg.who = who;
  dlg.done = doneFn || null;
  dlg.openedAt = performance.now();
  $('dialog').hidden = false;
  game.locked = true;
  showLine();
}
function showLine() {
  const line = dlg.lines[dlg.i];
  $('dialog-who').textContent = dlg.who;
  const box = $('dialog-choices');
  box.innerHTML = '';
  const text = typeof line === 'string' ? line : line.text;
  $('dialog-text').textContent = text;
  game.tone(500 + Math.random() * 200, 0.06, 'square', 0.03);
  if (typeof line === 'string' || !line.choices) {
    const b = document.createElement('button');
    b.textContent = dlg.i < dlg.lines.length - 1 ? 'Next ▶' : 'OK';
    b.addEventListener('click', advance);
    box.appendChild(b);
  } else {
    line.choices.forEach((c, n) => {
      const b = document.createElement('button');
      b.textContent = c.label;
      if (n > 0) b.className = 'alt';
      b.addEventListener('click', () => {
        const more = c.then ? c.then() : null;
        if (more && more.length) { dlg.lines.splice(dlg.i + 1, 0, ...more); }
        advance(true);
      });
      box.appendChild(b);
    });
  }
}
function advance(fromChoice) {
  const line = dlg.lines[dlg.i];
  if (!fromChoice && line && line.choices) return; // must pick a choice
  dlg.i++;
  if (dlg.i >= dlg.lines.length) {
    $('dialog').hidden = true;
    game.locked = false;
    const d = dlg.done;
    dlg.done = null;
    if (d) d();
    return;
  }
  showLine();
}
for (const code of ['KeyE', 'Space', 'Enter']) {
  const prev = game.keyHandlers[code];
  game.onKey(code, (e) => {
    if (prev) prev(e);
    if (!$('dialog').hidden && performance.now() - dlg.openedAt > 200) advance(false);
  });
}

// ---------------------------------------------------------------- world building
const box = game.box.bind(game);
function flat(x, z, w, d, color, y = 0.03) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshLambertMaterial({ color }));
  m.rotation.x = -Math.PI / 2;
  m.position.set(x, y, z);
  m.receiveShadow = true;
  scene.add(m);
  return m;
}
function building(x, z, w, h, d, wall, roof, title, signOpts = {}) {
  box(x, h, z, w, h, d, wall);
  box(x, h + 0.8, z, w + 1.2, 0.8, d + 1.2, roof, { noCollide: true });
  const door = new THREE.Mesh(new THREE.PlaneGeometry(4, 7), new THREE.MeshLambertMaterial({ color: 0x5c3d2e }));
  door.position.set(x, 3.5, z + d / 2 + 0.03);
  scene.add(door);
  const winMat = new THREE.MeshLambertMaterial({ color: 0xa5d8ff, emissive: 0x4dabf7, emissiveIntensity: 0.2 });
  for (const wx of [-w / 2 + 3.5, w / 2 - 3.5]) {
    const win = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 3), winMat);
    win.position.set(x + wx, 4.5, z + d / 2 + 0.03);
    scene.add(win);
  }
  if (title) {
    const sg = new THREE.Mesh(new THREE.PlaneGeometry(Math.min(w - 2, 14), 3.2),
      new THREE.MeshBasicMaterial({ map: textTexture([title], { bg: signOpts.bg || '#ffffff', border: signOpts.border || '#1d2433', color: signOpts.color || '#1d2433', size: 70 }), transparent: true }));
    sg.position.set(x, h - 1.8, z + d / 2 + 0.06);
    scene.add(sg);
  }
}

function chickenModel() {
  const g = new THREE.Group();
  const white = new THREE.MeshLambertMaterial({ color: 0xffffff });
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.2, 1.8), white);
  body.position.y = 0.8;
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.9, 0.8), white);
  head.position.set(0, 1.7, 0.7);
  const comb = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.4, 0.6), new THREE.MeshLambertMaterial({ color: 0xe03131 }));
  comb.position.set(0, 2.3, 0.7);
  const beak = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.25, 0.4), new THREE.MeshLambertMaterial({ color: 0xf59f00 }));
  beak.position.set(0, 1.7, 1.25);
  const wingL = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.8, 1.2), white);
  wingL.position.set(-0.8, 0.9, 0);
  const wingR = wingL.clone();
  wingR.position.x = 0.8;
  const legs = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.3, 0.2), new THREE.MeshLambertMaterial({ color: 0xf59f00 }));
  legs.position.y = 0.1;
  g.add(body, head, comb, beak, wingL, wingR, legs);
  g.traverse((m) => { if (m.isMesh) m.castShadow = true; });
  g.wings = [wingL, wingR];
  return g;
}

function roadsterModel() {
  const g = new THREE.Group();
  const red = new THREE.MeshLambertMaterial({ color: 0xe03131 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(5.6, 1.6, 11), red);
  body.position.y = 1.6;
  const nose = new THREE.Mesh(new THREE.BoxGeometry(5.2, 1, 3), red);
  nose.position.set(0, 1.2, 6.5);
  const cab = new THREE.Mesh(new THREE.BoxGeometry(4.6, 1.4, 4), new THREE.MeshLambertMaterial({ color: 0x1d2433 }));
  cab.position.set(0, 3, -0.5);
  g.add(body, nose, cab);
  for (const [dx, dz] of [[-2.9, -3.6], [2.9, -3.6], [-2.9, 3.6], [2.9, 3.6]]) {
    const w = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.1, 0.8, 16), new THREE.MeshLambertMaterial({ color: 0x212529 }));
    w.rotation.z = Math.PI / 2;
    w.position.set(dx, 1.1, dz);
    g.add(w);
  }
  for (const dx of [-1.6, 1.6]) {
    const n = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.8, 1.4, 12), new THREE.MeshLambertMaterial({ color: 0x868e96 }));
    n.rotation.x = Math.PI / 2;
    n.position.set(dx, 1.8, -6.1);
    const flame = new THREE.Mesh(new THREE.ConeGeometry(0.5, 1.8, 10), new THREE.MeshBasicMaterial({ color: 0x74c0fc }));
    flame.rotation.x = -Math.PI / 2;
    flame.position.set(dx, 1.8, -7.6);
    g.add(n, flame);
    game.updaters.push((t) => { flame.scale.setScalar(0.8 + Math.sin(t * 20 + dx) * 0.2); });
  }
  g.traverse((m) => { if (m.isMesh) m.castShadow = true; });
  return g;
}

// ---------------------------------------------------------------- NPCs
const npcs = {};
const alertMat = () => labelSprite('!', { scale: 4, color: '#ffd43b', size: 110, canvasWidth: 256, canvasHeight: 128 });
function addNPC(id, name, x, top, z, look, facing, onTalk, alert) {
  const n = game.npc(name, x, top, z, look, facing);
  const mark = alertMat();
  mark.position.set(x, top + 9, z);
  scene.add(mark);
  game.updaters.push((t) => { mark.position.y = top + 9 + Math.sin(t * 4) * 0.3; });
  n.alert = alert;
  n.mark = mark;
  npcs[id] = n;
  game.addInteractable({ pos: n.pos, radius: 7, label: `Talk to ${name}`, onInteract: onTalk });
  return n;
}
function updateAlerts() {
  for (const n of Object.values(npcs)) n.mark.visible = !!n.alert();
}

// ---------------------------------------------------------------- the town of Maplebrook
const chickenObjs = [];
let fraudNpcs = [];
let dogCollar = null;

function buildTown() {
  // ground with a pit for the Windy Cliffs gap (x 95..125, z 55..105)
  const g = 0x6cc35a;
  box(-52.5, 0, 0, 295, 22, 400, g, { blockCamera: false, shadow: false });
  box(162.5, 0, 0, 75, 22, 400, g, { blockCamera: false, shadow: false });
  box(110, 0, -72.5, 30, 22, 255, g, { blockCamera: false, shadow: false });
  box(110, 0, 152.5, 30, 22, 95, g, { blockCamera: false, shadow: false });
  box(110, -20, 80, 30, 2, 50, 0x6b5b4b, { blockCamera: false });

  // roads + town square
  flat(0, 0, 300, 12, 0x5b6170);
  flat(0, 0, 12, 300, 0x5b6170);
  const plaza = new THREE.Mesh(new THREE.CircleGeometry(15, 40), new THREE.MeshLambertMaterial({ color: 0xb8bec6 }));
  plaza.rotation.x = -Math.PI / 2;
  plaza.position.y = 0.05;
  plaza.receiveShadow = true;
  scene.add(plaza);
  game.cyl(0, 0, 4, 0, 1.6, 0x74c0fc, { segments: 24 });
  game.cyl(0, 0, 0.8, 1.6, 5, 0xadb5bd, { segments: 12 });
  const spray = new THREE.Mesh(new THREE.SphereGeometry(1.4, 12, 8), new THREE.MeshLambertMaterial({ color: 0xa5d8ff, transparent: true, opacity: 0.8 }));
  spray.position.set(0, 5.5, 0);
  scene.add(spray);
  game.updaters.push((t) => spray.scale.setScalar(1 + Math.sin(t * 6) * 0.15));
  game.sign(['Maplebrook', 'Town Square'], 9, 0, 9, { bg: '#2b8a3e', border: '#1e6b2f', rotY: -0.5 });

  // buildings
  building(40, -34, 18, 10, 14, 0xfff4e6, 0x8d5a2b, 'Bean There Café', { bg: '#8d5a2b', border: '#5c3d2e', color: '#fff' });
  building(-34, -36, 16, 9, 12, 0xd0ebff, 0x1c7ed6, 'Post Office', { bg: '#1c7ed6', border: '#1864ab', color: '#fff' });
  building(0, -66, 20, 10, 14, 0x9c36b5, 0xf06595, 'ARCADE', { bg: '#212529', border: '#f06595', color: '#ffd43b' });
  building(72, -24, 16, 9, 12, 0xebfbee, 0x2f9e44, 'Gus\'s Grocery', { bg: '#2f9e44', border: '#1e6b2f', color: '#fff' });
  building(-40, -76, 14, 8, 12, 0xffe3e3, 0xc92a2a, null);
  building(40, 70, 16, 8, 12, 0xfff9db, 0xe67700, null);
  // claw machine in front of the arcade
  box(6, 7, -54, 4, 7, 4, 0xf06595);
  const glass = new THREE.Mesh(new THREE.BoxGeometry(3.4, 3, 3.4), new THREE.MeshLambertMaterial({ color: 0xd0ebff, transparent: true, opacity: 0.5 }));
  glass.position.set(6, 5, -54);
  scene.add(glass);

  // park with benches
  flat(-45, 35, 34, 28, 0x51b44a, 0.04);
  for (const [x, z] of [[-55, 25], [-35, 45], [-58, 45], [-32, 22]]) game.tree(x, 0, z, 0.9);
  const bench = (x, z, ry = 0) => {
    const b = new THREE.Group();
    const wood = new THREE.MeshLambertMaterial({ color: 0x8d5a2b });
    const seat = new THREE.Mesh(new THREE.BoxGeometry(5, 0.4, 1.6), wood); seat.position.y = 1.6;
    const back = new THREE.Mesh(new THREE.BoxGeometry(5, 1.4, 0.3), wood); back.position.set(0, 2.5, -0.7);
    const l1 = new THREE.Mesh(new THREE.BoxGeometry(0.4, 1.6, 1.4), new THREE.MeshLambertMaterial({ color: 0x343a40 })); l1.position.set(-2.2, 0.8, 0);
    const l2 = l1.clone(); l2.position.x = 2.2;
    b.add(seat, back, l1, l2);
    b.position.set(x, 0, z);
    b.rotation.y = ry;
    b.traverse((m) => { if (m.isMesh) m.castShadow = true; });
    scene.add(b);
  };
  bench(-42, 34); bench(-48, 28, Math.PI / 2); bench(-30, -26, Math.PI);

  // playground
  flat(-62, -4, 22, 20, 0xffc078, 0.04);
  box(-66, 6, -8, 4, 6, 4, 0xf03e3e);
  const slide = new THREE.Mesh(new THREE.BoxGeometry(3, 0.4, 10), new THREE.MeshLambertMaterial({ color: 0xfcc419 }));
  slide.position.set(-66, 3.2, -1.5);
  slide.rotation.x = -0.6;
  scene.add(slide);

  // farm
  flat(-88, 70, 40, 34, 0x8fbf5a, 0.04);
  building(-100, 78, 18, 12, 14, 0xc92a2a, 0xf8f9fa, null);
  box(-78, 3.5, 78, 6, 3.5, 5, 0xe9c46a); // coop
  for (let x = -106; x <= -70; x += 4) box(x, 2, 54, 0.4, 2, 0.4, 0xf8f9fa, { noCollide: true });
  game.sign(['Hattie\'s Farm'], -70, 0, 54, { bg: '#c92a2a', border: '#8b1e1e', w: 8, h: 3 });

  // Windy Cliffs: climb up, then a gap that's too far to jump
  box(82.5, 12, 80, 25, 34, 40, 0x8a7a68);
  box(137.5, 12, 80, 25, 34, 40, 0x8a7a68);
  flat(82.5, 80, 25, 40, 0x7bc05f, 12.03);
  flat(137.5, 80, 25, 40, 0x7bc05f, 12.03);
  for (let s = 0; s < 12; s++) box(58.5 + s, s + 1, 80, 1.02, s + 1, 8, 0xa58f78);           // stairs up (west)
  for (let s = 0; s < 12; s++) box(161.5 - s, s + 1, 72, 1.02, s + 1, 8, 0xa58f78);          // stairs down (east)
  game.sign(['Windy Cliffs', 'Too far to jump…'], 90, 12, 64, { bg: '#495057', border: '#212529', rotY: -Math.PI / 2 });

  // Silicon Hills
  flat(100, -80, 50, 40, 0xc5f6fa, 0.04);
  box(104, 40, -88, 20, 40, 16, 0x99e9f2, { matOpts: { emissive: 0x1098ad, emissiveIntensity: 0.15 } });
  for (let y = 6; y < 40; y += 6) box(104, y, -88, 20.4, 0.6, 16.4, 0xffffff, { noCollide: true });
  const fsign = new THREE.Mesh(new THREE.PlaneGeometry(14, 3.5),
    new THREE.MeshBasicMaterial({ map: textTexture(['FRAUDANOS'], { bg: '#ffffff', border: '#0b7285', color: '#0b7285', size: 80 }), transparent: true }));
  fsign.position.set(104, 30, -79.7);
  scene.add(fsign);
  game.sign(['Silicon Hills'], 86, 0, -66, { bg: '#0b7285', border: '#095c6b', w: 8, h: 3 });

  // cliff garage (west) with the Roadster parked out front
  box(-125, 26, -90, 36, 26, 30, 0x8a7a68);
  const gdoor = new THREE.Mesh(new THREE.PlaneGeometry(12, 9), new THREE.MeshLambertMaterial({ color: 0x343a40 }));
  gdoor.position.set(-125, 4.5, -74.95);
  scene.add(gdoor);
  game.sign(['Cliff Garage'], -116, 0, -70, { bg: '#495057', border: '#212529', w: 7, h: 3 });
  const car = roadsterModel();
  car.position.set(-125, 0, -64);
  car.rotation.y = Math.PI * 0.1;
  scene.add(car);
  game.box(-125, 3.5, -64, 6.5, 3.5, 13, 0, { material: new THREE.MeshBasicMaterial({ visible: false }), blockCamera: false });
  game.addInteractable({
    pos: new THREE.Vector3(-125, 0, -64), radius: 10, label: 'Check out the Roadster',
    onInteract: () => {
      if (!qs('roadster')) {
        talk('Roadster', ['A shiny red Roadster with gas-thruster engines! Someone must really miss it…'], () => {});
        return;
      }
      talk('Roadster', ['The Nikola Roadster! It has GAS THRUSTERS on the back.',
        'To get it home you\'ll have to drive up the curved wall and thrust-hover across the canyon…'], () => {
        if (active('roadster')) finishQuest('roadster', 'roblox');
        showMore('🏎️', 'Roadster Rescue',
          'Driving the Roadster up the curved wall, thrust-hovering across the canyon and re-pumping thruster gas are in the full Grab \'n\' Go Adventure on Roblox!');
      });
    },
  });

  // banana grove + Momo's tree
  for (const [x, z] of [[-10, -112], [-34, -104], [-6, -126], [-38, -122]]) {
    game.cyl(x, z, 0.7, 0, 9, 0x8d6e4c, { segments: 8 });
    const leaves = new THREE.Mesh(new THREE.SphereGeometry(4, 10, 6), new THREE.MeshLambertMaterial({ color: 0x40c057 }));
    leaves.scale.set(1.3, 0.5, 1.3);
    leaves.position.set(x, 9.5, z);
    game.addMesh(leaves);
  }
  game.cyl(-22, -112, 1.2, 0, 6, 0x8d6e4c, { segments: 10 });
  box(-22, 6, -112, 10, 1, 8, 0x8d6e4c);                                                   // tree house platform
  for (let s = 0; s < 5; s++) box(-22, 5 - s, -107.4 + s * 1.2, 4, 5 - s, 1.2, 0xa58f78);     // little steps
  const canopy = new THREE.Mesh(new THREE.SphereGeometry(7, 12, 8), new THREE.MeshLambertMaterial({ color: 0x37b24d }));
  canopy.scale.y = 0.6;
  canopy.position.set(-22, 15, -114);
  game.addMesh(canopy);
  game.sign(['Banana Grove'], -8, 0, -98, { bg: '#f59f00', border: '#b35c00', w: 7, h: 3 });

  // scattered trees
  for (const [x, z] of [[-90, -20], [-110, 20], [60, 45], [20, 40], [-20, 60], [120, -20], [140, 20], [30, -100], [-70, -60], [70, -110], [-140, -30], [-60, 110]]) game.tree(x, 0, z, 1);

  // dog for Mr. Patel
  const dog = new THREE.Group();
  const fur = new THREE.MeshLambertMaterial({ color: 0xe0a96d });
  const db = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.2, 2.6), fur); db.position.y = 1.4;
  const dh = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.2, 1.2), fur); dh.position.set(0, 2.3, 1.4);
  const dn = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.5, 0.6), new THREE.MeshLambertMaterial({ color: 0x3b2a20 })); dn.position.set(0, 2.1, 2.1);
  const dog_legs = [[-0.5, -0.9], [0.5, -0.9], [-0.5, 0.9], [0.5, 0.9]].map(([lx, lz]) => {
    const l = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.9, 0.35), fur); l.position.set(lx, 0.45, lz); return l;
  });
  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.25, 1), fur); tail.position.set(0, 1.9, -1.6); tail.rotation.x = 0.6;
  dog.add(db, dh, dn, tail, ...dog_legs);
  dog.position.set(58, 0, 26);
  dog.rotation.y = -0.8;
  dog.traverse((m) => { if (m.isMesh) m.castShadow = true; });
  scene.add(dog);
  game.updaters.push((t) => { tail.rotation.y = Math.sin(t * 12) * 0.6; });
  const collar = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.25, 1.3), new THREE.MeshLambertMaterial({ color: 0xf06595 }));
  collar.position.set(0, 1.7, 1.4);
  collar.visible = false;
  dog.add(collar);
  dog.collar = collar;
  dogCollar = collar;

  // chickens
  const spots = [[-48, 0, 42], [20, 0, -92], [86, 0, -34], [88, 12, 68], [142, 12, 92]];
  spots.forEach(([x, y, z], id) => {
    const c = chickenModel();
    c.position.set(x, y, z);
    c.rotation.y = Math.random() * 6;
    scene.add(c);
    const base = y;
    game.updaters.push((t) => {
      if (!c.visible) return;
      c.position.y = base + Math.abs(Math.sin(t * 5 + id)) * 0.4;
      c.wings.forEach((w, k) => { w.rotation.z = (k ? -1 : 1) * Math.abs(Math.sin(t * 9 + id)) * 0.6; });
    });
    chickenObjs.push(c);
    game.addInteractable({
      pos: new THREE.Vector3(x, y, z), radius: 5, label: 'Pick up chicken',
      enabled: () => !S.chickens.includes(id),
      onInteract: () => {
        S.chickens.push(id);
        S.carrying++;
        c.visible = false;
        game.tone(900, 0.15, 'square', 0.06, 1400);
        if (!qs('chickens')) startQuest('chickens');
        game.toast(S.carrying === 1 ? '🐔 Hold jump in the air to glide!' : `🐔 ×${S.carrying} — a chicken tower!`, 2600);
        changed();
      },
    });
  });
}

// ---------------------------------------------------------------- people of Maplebrook
function buildPeople() {
  // Dana the sleepy mail carrier
  addNPC('dana', 'Dana', -28, 0, -25, { skin: 0xf1c27d, shirt: 0x1c7ed6, pants: 0x364fc7, hat: 0x1c7ed6 }, 0.4, () => {
    if (!qs('morning')) {
      talk('Dana', ['*Yaaawn*… Oh! Hi. I\'m Dana, the mail carrier.',
        'I can\'t start my route without my morning coffee… and my pockets are empty.',
        'Could you get me a coffee from Bean There Café? Pleeease?'], () => startQuest('morning'));
    } else if (active('morning') && has('coffee')) {
      talk('Dana', ['Is that… COFFEE?!', '*sip*… I can see colors again! Thank you!',
        'Here — I found this Arcade Token on my route. Maybe you can win something at the claw machine!'], () => {
        take('coffee');
        finishQuest('morning');
        gotItem('token');
        setTimeout(() => startQuest('trail'), 2700);
      });
    } else if (active('morning')) {
      talk('Dana', ['Coffee… please… *snore*']);
    } else {
      talk('Dana', ['My route is going great today. Thanks again!']);
    }
  }, () => !qs('morning') || (active('morning') && has('coffee')));

  // Bea the barista
  addNPC('bea', 'Bea', 40, 0, -23, { skin: 0xc68642, shirt: 0x8d5a2b, pants: 0x212529, hair: 0x212529 }, 0, () => {
    if (has('coins') && !has('coffee') && !done('morning')) {
      talk('Bea', ['Welcome to Bean There Café! One coffee? That\'s 5 coins.', {
        text: 'Want one?', choices: [{ label: 'Yes please!', then: () => { take('coins'); gotItem('coffee'); return ['Here you go — extra hot!']; } }, { label: 'Not now' }],
      }]);
    } else if (!has('coins') && !done('morning')) {
      talk('Bea', ['Morning! A coffee is 5 coins. Come back when you\'ve got some!']);
    } else {
      talk('Bea', ['Have a bean-tastic day!']);
    }
  }, () => has('coins') && !has('coffee') && !done('morning'));

  // Mia at the playground
  addNPC('mia', 'Mia', -58, 0, -2, { skin: 0xffdbac, shirt: 0xf06595, pants: 0x7048e8, bow: 0xfcc419 }, 0.8, () => {
    if (has('doll')) {
      talk('Mia', ['Is that a HAMATO DOLL?! He\'s a wise old rat sensei!',
        'I need him for my ninja training. Will you trade? I\'ll give you my very best ribbon!'], () => {
        take('doll'); gotItem('ribbon');
      });
    } else if (active('trail') && !has('ribbon') && !has('dogfood') && !has('bananas') && !has('stick')) {
      talk('Mia', ['Hi-yah! I\'m practicing ninja moves… but I wish I had a sensei.']);
    } else {
      talk('Mia', ['Wanna race down the slide?']);
    }
  }, () => has('doll'));

  // Mr. Patel and his dog Biscuit
  addNPC('patel', 'Mr. Patel', 54, 0, 22, { skin: 0x8d5524, shirt: 0x37b24d, pants: 0x495057, hair: 0x212529 }, -0.6, () => {
    if (has('ribbon')) {
      talk('Mr. Patel', ['A ribbon! Biscuit will look SO fancy at the dog show!',
        'Take this bag of dog food. Biscuit only eats the gourmet stuff now.'], () => {
        take('ribbon'); dogCollar.visible = true; gotItem('dogfood');
      });
    } else {
      talk('Mr. Patel', ['Biscuit has a dog show today, but he needs something fancy to wear…']);
    }
  }, () => has('ribbon'));

  // Grocer Gus
  addNPC('gus', 'Gus', 72, 0, -13, { skin: 0xf1c27d, shirt: 0xffffff, pants: 0x2f9e44, hat: 0x2f9e44 }, 0, () => {
    if (has('dogfood')) {
      talk('Gus', ['Dog food! My pup Peanut has been begging all morning.', 'I\'ll trade you a bunch of bananas for it!'], () => {
        take('dogfood'); gotItem('bananas');
        setTimeout(() => showFact('bananas'), 900);
      });
    } else {
      talk('Gus', ['Fresh fruit! Well… mostly bananas.']);
    }
  }, () => has('dogfood'));

  // Momo the monkey in the banana grove
  addNPC('momo', 'Momo', -22, 6, -112, { skin: 0xa0522d, shirt: 0x8b4513, pants: 0x8b4513, armsShirt: true }, 0, () => {
    if (has('bananas')) {
      talk('Momo', ['Ooh ooh! BANANAS!', '*Momo hands you a stick. It\'s a very nice stick.*'], () => {
        take('bananas'); gotItem('stick');
        setTimeout(() => {
          finishQuest('trail', 'roblox');
          showMore('🐒', 'The trail keeps going!',
            'Stick → honeycomb → pineapple → hibiscus → love letter → broom → fishing → mermaid\'s necklace → mermaid\'s scale → microscope → boomerang! Keep trading in the full Grab \'n\' Go Adventure on Roblox.');
        }, 1500);
      });
    } else {
      talk('Momo', ['Ooh ooh ah ah! (Momo looks hungry.)']);
    }
  }, () => has('bananas'));

  // Farmer Hattie
  addNPC('hattie', 'Farmer Hattie', -80, 0, 62, { skin: 0xffdbac, shirt: 0xc92a2a, pants: 0x1c7ed6, hat: 0xe9c46a }, 0.3, () => {
    if (!qs('chickens')) {
      talk('Farmer Hattie', [`Oh dear, oh dear! My ${CHICKENS} chickens flew the coop!`,
        'Could you find them and bring them back?',
        'Carry them on your head — and if you jump while carrying one, hold jump to GLIDE!'], () => startQuest('chickens'));
    } else if (active('chickens') && S.carrying > 0) {
      const n = S.carrying;
      S.delivered += n;
      S.carrying = 0;
      if (S.delivered >= CHICKENS) {
        talk('Farmer Hattie', [`${n === 1 ? 'And that\'s' : 'That\'s'} all of them! Bawk bawk hooray!`,
          'Take my rooster as a thank-you. With him on your head you can glide anywhere!'], () => {
          S.glider = true;
          finishQuest('chickens');
          gotItem('glider');
          setTimeout(() => showFact('glider'), 900);
        });
      } else {
        talk('Farmer Hattie', [`You found ${n}! Back in the coop you go${n > 1 ? ', all of you' : ''}.`,
          `Still missing ${CHICKENS - S.delivered}. One was last seen across the Windy Cliffs gap!`], changed);
      }
    } else if (active('chickens')) {
      talk('Farmer Hattie', [`Still missing ${CHICKENS - S.delivered}. One was last seen across the Windy Cliffs gap!`]);
    } else {
      talk('Farmer Hattie', ['Keep that rooster happy and he\'ll keep you floating!']);
    }
  }, () => !qs('chickens') || (active('chickens') && S.carrying > 0));

  // Reginald Goldbucks III
  addNPC('gold', 'Mr. Goldbucks', 54, 0, -40, { skin: 0xffdbac, shirt: 0x212529, pants: 0x212529, hat: 0x212529 }, -0.4, () => {
    if (!S.coinsTaken && !qs('roadster')) {
      talk('Mr. Goldbucks', ['Busy, busy! I only talk to people with money. Shoo!']);
    } else if (!qs('roadster')) {
      talk('Mr. Goldbucks', ['Ahem! You there, with the jingly pockets. I\'m Reginald Goldbucks the Third.',
        'My Nikola Roadster is parked at the cliff garage, and my valet is on vacation.',
        'Fetch it for me, would you? It has GAS THRUSTERS!'], () => startQuest('roadster'));
    } else if (active('roadster')) {
      talk('Mr. Goldbucks', ['The cliff garage is out west, past the post office.']);
    } else {
      talk('Mr. Goldbucks', ['Vroom vroom, as they say.']);
    }
  }, () => S.coinsTaken && !qs('roadster'));

  // Venture Val in Silicon Hills
  addNPC('val', 'Venture Val', 94, 0, -70, { skin: 0xf1c27d, shirt: 0x868e96, pants: 0x343a40, hair: 0xfab005 }, 0.5, () => {
    if (!done('morning')) {
      talk('Venture Val', ['We only fund disruptors. Come back when you\'ve disrupted something. Like… breakfast.']);
    } else if (!qs('fraud') || (active('fraud') && !qs('fraud').step)) {
      if (!qs('fraud')) startQuest('fraud');
      pitch();
    } else if (active('fraud')) {
      exposé();
    } else {
      talk('Venture Val', ['Sorry, we\'re not taking meetings right now. For… legal reasons.']);
    }
  }, () => done('morning') && !qs('fraud'));
}

function pitch() {
  const what = () => ({
    text: '"So… what does your startup do?"',
    choices: [
      { label: 'One drop of BOOGER tests your health!', then: () => [works()] },
      { label: 'Uh… it\'s an app… for apps?', then: () => ['"Boring! Next!"', what()] },
    ],
  });
  const works = () => ({
    text: '"BoogerScan™! Genius! …Does it actually work?"',
    choices: [
      { label: 'Not yet… but it will!', then: () => money() },
      { label: 'Totally! Trust me!', then: () => money() },
    ],
  });
  const money = () => ['"Love it! We\'re investing NINE BILLION DOLLARS!"', '*Fraudanos is now the hottest company in Silicon Hills.*'];
  talk('Venture Val', ['Welcome to Silicon Hills! I\'m Venture Val.', '"Got a startup? Pitch me!"',
    { text: 'You: "It\'s called… FRAUDANOS!"', choices: [{ label: 'Keep going ▶', then: () => [what()] }] }], () => {
    S.q.fraud.step = 1;
    save();
    game.toast('💰 Fraudanos raised $9,000,000,000!', 2600);
    game.sfx.coin();
    setTimeout(exposé, 1800);
  });
}
function exposé() {
  if (fraudNpcs.length) return;
  const rhea = game.npc('Reporter Rhea', 100, 0, -62, { skin: 0xc68642, shirt: 0xf8f9fa, pants: 0x495057, hair: 0x212529 }, Math.PI * 0.9);
  const pat = game.npc('Officer Pat', 90, 0, -60, { skin: 0xffdbac, shirt: 0x1864ab, pants: 0x1d2433, hat: 0x1d2433 }, Math.PI * 1.1);
  fraudNpcs.push(rhea, pat);
  talk('Reporter Rhea', ['STOP THE PRESSES! I tested BoogerScan™…',
    'It said my hamster is a professional skateboarder. I don\'t even HAVE a hamster!',
    'The whole thing is fake!'], () => {
    talk('Officer Pat', ['You\'re under arrest for… extreme fibbing!', '*click* Off to Striker Isle you go.'], () => {
      finishQuest('fraud', 'roblox');
      showMore('🚓', 'Off to Striker Isle!',
        'A secret mission from Health & Human Services, a giant pudding food fight and Operation Orange Shirt are waiting in the full Grab \'n\' Go Adventure on Roblox!');
    });
  });
}

// coins in the park + the claw machine
function buildPickups() {
  const sparkle = new THREE.Mesh(new THREE.OctahedronGeometry(0.7), new THREE.MeshBasicMaterial({ color: 0xffd43b }));
  sparkle.position.set(-42, 0.9, 32);
  scene.add(sparkle);
  game.updaters.push((t) => { sparkle.rotation.y = t * 3; sparkle.position.y = 0.9 + Math.sin(t * 4) * 0.2; sparkle.visible = !S.coinsTaken; });
  game.addInteractable({
    pos: new THREE.Vector3(-42, 0, 32), radius: 5, label: 'Look under the bench',
    enabled: () => !S.coinsTaken,
    onInteract: () => {
      S.coinsTaken = true;
      gotItem('coins');
      game.toast('🪙 You found 5 coins under the bench!', 2400);
    },
  });
  game.addInteractable({
    pos: new THREE.Vector3(6, 0, -51), radius: 6, label: 'Play the claw machine',
    onInteract: () => {
      if (has('doll') || (qs('trail') && !has('token'))) { talk('Claw Machine', ['You already won the Hamato Doll!']); return; }
      if (!has('token')) { talk('Claw Machine', ['INSERT ARCADE TOKEN. (You don\'t have one yet.)']); return; }
      openClaw();
    },
  });
}

// ---------------------------------------------------------------- claw machine mini-game
const PRIZES = ['🦆', '🐙', '🧸', '🐀'];
const claw = { x: 50, dir: 1, dropping: false, order: [], raf: 0 };
function openClaw() {
  claw.order = PRIZES.slice().sort(() => Math.random() - 0.5);
  const pz = $('prizes');
  pz.innerHTML = '';
  claw.order.forEach((p) => { const s = document.createElement('span'); s.textContent = p; pz.appendChild(s); });
  $('claw-msg').textContent = 'Drop the claw on the Hamato Doll 🐀!';
  claw.dropping = false;
  openOverlay('claw');
  let last = performance.now();
  const tick = (now) => {
    const dt = (now - last) / 1000; last = now;
    if (!claw.dropping) {
      claw.x += claw.dir * dt * 32;
      if (claw.x > 92) { claw.x = 92; claw.dir = -1; }
      if (claw.x < 8) { claw.x = 8; claw.dir = 1; }
      $('claw-el').style.left = claw.x + '%';
    }
    if (!$('claw').hidden) claw.raf = requestAnimationFrame(tick);
  };
  claw.raf = requestAnimationFrame(tick);
}
function dropClaw() {
  if (claw.dropping) return;
  claw.dropping = true;
  const cable = document.querySelector('#claw-el .cable');
  cable.style.height = '120px';
  game.tone(300, 0.5, 'triangle', 0.08, 150);
  const slots = [12.5, 37.5, 62.5, 87.5];
  let best = -1;
  slots.forEach((sx, n) => { if (Math.abs(claw.x - sx) < 10) best = n; });
  setTimeout(() => {
    const spans = document.querySelectorAll('#prizes span');
    if (best >= 0 && claw.order[best] === '🐀') {
      spans[best].style.transform = 'translateY(-110px)';
      $('claw-msg').textContent = 'You got the Hamato Doll!';
      setTimeout(() => {
        closeOverlay('claw');
        take('token');
        gotItem('doll');
        setTimeout(() => showFact('doll'), 700);
      }, 1100);
    } else {
      if (best >= 0) spans[best].style.transform = 'translateY(-40px)';
      $('claw-msg').textContent = best >= 0 ? `So close… the ${claw.order[best]} slipped out! Try again.` : 'Missed! Try again.';
      game.sfx.error();
      setTimeout(() => {
        if (best >= 0) spans[best].style.transform = '';
        cable.style.height = '16px';
        claw.dropping = false;
      }, 900);
    }
  }, 600);
}
$('claw-drop').addEventListener('click', dropClaw);
$('claw-quit').addEventListener('click', () => closeOverlay('claw'));
game.onKey('Space', ((prev) => (e) => { if (prev) prev(e); if (!$('claw').hidden) dropClaw(); })(game.keyHandlers.Space));

// ---------------------------------------------------------------- chicken carrying + gliding
const carried = [];
function updateCarry() {
  const n = S.carrying + (S.glider ? 1 : 0);
  while (carried.length < n) {
    const c = chickenModel();
    c.scale.setScalar(0.8);
    game.avatar.group.add(c);
    carried.push(c);
  }
  carried.forEach((c, i) => { c.visible = i < n; c.position.set(0, 5.6 + i * 1.7, 0); });
  game.state.carrying = n > 0 ? n : null;
}
game.updaters.push((t) => {
  const gliding = !game.state.grounded && game.input.jumpHeld;
  carried.forEach((c, i) => c.wings.forEach((w, k) => {
    w.rotation.z = (k ? -1 : 1) * (gliding ? 0.4 + Math.abs(Math.sin(t * 18 + i)) * 1.1 : 0.1);
  }));
});
game.physics = () => {
  const glide = S.carrying > 0 || S.glider;
  return glide ? { glide: true, glideFall: 5, glideSpeedMult: 1.4, flaps: 2, flapV: 28 } : {};
};

// ---------------------------------------------------------------- per-step rules
const SPAWN = new THREE.Vector3(0, 0, 18);
const CLIFF = new THREE.Vector3(80, 12, 80);
game.afterStep = () => {
  const p = game.state.pos;
  if (p.y < -8 && p.x > 94 && p.x < 126 && p.z > 54 && p.z < 106) {
    game.teleport(CLIFF, -Math.PI / 2, Math.PI / 2);
    game.toast(S.carrying || S.glider ? 'Hold jump while falling to glide!' : 'Too far to jump… maybe something with wings could help?', 3000);
  } else if (p.y < -30) {
    game.teleport(SPAWN, Math.PI, 0);
  }
};

// ---------------------------------------------------------------- start
function begin() {
  game.unlockAudio();
  closeOverlay('start');
  game.running = true;
  if (!Object.keys(S.q).length) game.toast('Dana the mail carrier looks sleepy…', 3000);
}
$('go').addEventListener('click', begin);
$('restart').addEventListener('click', () => {
  if (!confirm('Start the adventure over from the beginning?')) return;
  store.del(SAVE_KEY);
  location.reload();
});
game.bindSoundButton($('sound'));
game.locked = true;

fontsReady().then(() => {
  const saved = store.get(SAVE_KEY);
  if (saved && saved.q) {
    S = { ...defaultState(), ...saved };
    if (Object.keys(S.q).length) {
      $('go').textContent = 'Continue';
      $('restart-row').hidden = false;
    }
  }
  buildTown();
  buildPeople();
  buildPickups();
  S.chickens.forEach((id) => { chickenObjs[id].visible = false; });
  if (has('dogfood') || has('bananas') || has('stick') || done('trail')) dogCollar.visible = true;
  changed();
  game.teleport(SPAWN, Math.PI, 0);
  game.start();
});

window.__grab = { game, get S() { return S; }, npcs, talk, advance };
