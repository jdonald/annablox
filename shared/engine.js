// ANNABLOX mini engine: the Roblox-like bits shared by all three mini games.
// - renderer, lights, resize
// - block builders (studded parts, cylinders, spheres, signs, labels) that register collision
// - a blocky avatar with walk / jump / swim / carry animations
// - a character controller with Roblox numbers (gravity 196.2, walk 16, jump height 7.2),
//   step-up, water swimming, gliding, and per-game physics overrides
// - keyboard + mouse, touch joystick, jump button, camera drag/zoom with camera collision
// - interaction prompts (like ProximityPrompts), touch triggers, toasts, flash, sounds
// Units are studs.
import * as THREE from 'three';
export { THREE };

export const G = 196.2;
export const WALK = 16;
export const JUMP_V = Math.sqrt(2 * G * 7.2);
export const PR = 1; // player radius
export const PH = 5; // player height

export const isTouch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;

// ---------------------------------------------------------------- textures
let studTex = null;
function studTexture() {
  if (studTex) return studTex;
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
  studTex = new THREE.CanvasTexture(c);
  studTex.wrapS = studTex.wrapT = THREE.RepeatWrapping;
  studTex.colorSpace = THREE.SRGBColorSpace;
  studTex.anisotropy = 4;
  return studTex;
}

export function studMaterial(color, sx, sz, opts = {}) {
  const tex = studTexture().clone();
  tex.repeat.set(Math.max(1, sx / 4), Math.max(1, sz / 4));
  tex.needsUpdate = true;
  return new THREE.MeshLambertMaterial({ color, map: tex, ...opts });
}

// A rounded board with centred text lines. Returns a CanvasTexture.
export function textTexture(lines, opts = {}) {
  const w = opts.width || 512, h = opts.height || 256;
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  if (opts.bg !== null) {
    g.fillStyle = opts.bg || '#4a2f1d';
    g.beginPath();
    g.roundRect(6, 6, w - 12, h - 12, opts.radius ?? 26);
    g.fill();
    g.lineWidth = 8;
    g.strokeStyle = opts.border || '#2c1b10';
    g.stroke();
  }
  g.fillStyle = opts.color || '#ffffff';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  const size = opts.size || (lines.length > 1 ? 54 : 64);
  g.font = `700 ${size}px Fredoka, system-ui, sans-serif`;
  if (opts.stroke) {
    g.lineWidth = opts.strokeWidth || 10;
    g.strokeStyle = opts.stroke;
    g.lineJoin = 'round';
  }
  lines.forEach((line, i) => {
    const y = h / 2 + (i - (lines.length - 1) / 2) * size * 1.15;
    if (opts.stroke) g.strokeText(line, w / 2, y, w - 40);
    g.fillText(line, w / 2, y, w - 40);
  });
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// ---------------------------------------------------------------- avatar
function faceTexture(skinCss) {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = skinCss;
  g.fillRect(0, 0, 128, 128);
  g.fillStyle = '#222';
  g.beginPath(); g.ellipse(44, 50, 7, 11, 0, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.ellipse(84, 50, 7, 11, 0, 0, Math.PI * 2); g.fill();
  g.lineWidth = 7; g.lineCap = 'round'; g.strokeStyle = '#222';
  g.beginPath(); g.arc(64, 70, 26, 0.15 * Math.PI, 0.85 * Math.PI); g.stroke();
  g.fillStyle = 'rgba(255,120,150,.45)';
  g.beginPath(); g.arc(30, 78, 9, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.arc(98, 78, 9, 0, Math.PI * 2); g.fill();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// Blocky R6-style character. Front faces +z. Feet at y = 0.
export function createAvatar(look = {}) {
  const skinColor = new THREE.Color(look.skin ?? 0xffd43b);
  const skin = new THREE.MeshLambertMaterial({ color: skinColor });
  const shirt = new THREE.MeshLambertMaterial({ color: look.shirt ?? 0xe64980 });
  const pants = new THREE.MeshLambertMaterial({ color: look.pants ?? 0x7048e8 });
  const face = new THREE.MeshLambertMaterial({ map: faceTexture('#' + skinColor.getHexString()) });
  const group = new THREE.Group();
  const parts = {};
  const mk = (geo, mat, x, y, z, pivotY) => {
    const pivot = new THREE.Group();
    pivot.position.set(x, pivotY, z);
    const m = new THREE.Mesh(geo, mat);
    m.position.y = y - pivotY;
    m.castShadow = true;
    pivot.add(m);
    group.add(pivot);
    return pivot;
  };
  parts.legL = mk(new THREE.BoxGeometry(0.95, 2, 1), pants, -0.5, 1, 0, 2);
  parts.legR = mk(new THREE.BoxGeometry(0.95, 2, 1), pants, 0.5, 1, 0, 2);
  parts.torso = mk(new THREE.BoxGeometry(2, 2, 1), shirt, 0, 3, 0, 3);
  parts.armL = mk(new THREE.BoxGeometry(0.95, 2, 1), look.armsShirt ? shirt : skin, -1.5, 3, 0, 3.9);
  parts.armR = mk(new THREE.BoxGeometry(0.95, 2, 1), look.armsShirt ? shirt : skin, 1.5, 3, 0, 3.9);
  const head = new THREE.Mesh(new THREE.BoxGeometry(1.25, 1.25, 1.25), [skin, skin, skin, skin, face, skin]);
  head.position.y = 4.65;
  head.castShadow = true;
  group.add(head);
  parts.head = head;
  if (look.hair) {
    const hair = new THREE.Mesh(new THREE.BoxGeometry(1.35, 0.45, 1.35), new THREE.MeshLambertMaterial({ color: look.hair }));
    hair.position.y = 5.3;
    group.add(hair);
  }
  if (look.hat) {
    const hat = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.75, 0.6, 12), new THREE.MeshLambertMaterial({ color: look.hat }));
    hat.position.y = 5.55;
    const brim = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.12, 0.7), hat.material);
    brim.position.set(0, 5.3, 0.6);
    group.add(hat, brim);
  }
  if (look.bow) {
    const bow = new THREE.Mesh(new THREE.BoxGeometry(1, 0.4, 0.3), new THREE.MeshLambertMaterial({ color: look.bow }));
    bow.position.set(0.3, 5.35, -0.35);
    group.add(bow);
  }
  let phase = 0;
  function animate(st, dt) {
    const moving = Math.hypot(st.vel.x, st.vel.z) > 1;
    if (st.carrying) {
      parts.armL.rotation.x = parts.armR.rotation.x = Math.PI; // arms straight up holding something
    }
    if (st.inWater) {
      phase += dt * 6;
      const s = Math.sin(phase);
      if (!st.carrying) { parts.armL.rotation.x = -2.6 + s * 0.6; parts.armR.rotation.x = -2.6 - s * 0.6; }
      parts.legL.rotation.x = s * 0.5; parts.legR.rotation.x = -s * 0.5;
    } else if (!st.grounded) {
      if (!st.carrying) parts.armL.rotation.x = parts.armR.rotation.x = -2.8;
      parts.legL.rotation.x = 0.4; parts.legR.rotation.x = -0.3;
    } else if (moving) {
      phase += dt * 11;
      const s = Math.sin(phase);
      if (!st.carrying) { parts.armL.rotation.x = s * 0.9; parts.armR.rotation.x = -s * 0.9; }
      parts.legL.rotation.x = -s * 0.9; parts.legR.rotation.x = s * 0.9;
    } else {
      for (const k of ['armL', 'armR', 'legL', 'legR']) {
        if (st.carrying && (k === 'armL' || k === 'armR')) continue;
        parts[k].rotation.x *= 0.8;
      }
    }
  }
  return { group, parts, animate };
}

// A floating name tag (sprite) for NPCs, mailboxes, prices…
export function labelSprite(text, opts = {}) {
  const c = document.createElement('canvas');
  const w = opts.canvasWidth || 512, h = opts.canvasHeight || 128;
  c.width = w; c.height = h;
  const mat = new THREE.SpriteMaterial({ transparent: true, depthWrite: false });
  const sprite = new THREE.Sprite(mat);
  const scale = opts.scale || 6;
  sprite.scale.set(scale, scale * h / w, 1);
  sprite.renderOrder = 5;
  function set(t, color) {
    const g = c.getContext('2d');
    g.clearRect(0, 0, w, h);
    g.font = `700 ${opts.size || 64}px Fredoka, system-ui, sans-serif`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.lineWidth = 12;
    g.lineJoin = 'round';
    g.strokeStyle = opts.stroke || 'rgba(20,24,40,.85)';
    g.strokeText(t, w / 2, h / 2, w - 20);
    g.fillStyle = color || opts.color || '#fff';
    g.fillText(t, w / 2, h / 2, w - 20);
    if (mat.map) mat.map.dispose();
    mat.map = new THREE.CanvasTexture(c);
    mat.map.colorSpace = THREE.SRGBColorSpace;
    mat.needsUpdate = true;
  }
  set(text);
  sprite.setText = set;
  return sprite;
}

// ---------------------------------------------------------------- the game shell
export class Game {
  constructor(opts = {}) {
    this.opts = opts;
    if (isTouch) document.body.classList.add('touch');
    this.canvas = document.getElementById('c');
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, isTouch ? 1.5 : 2));
    this.renderer.shadowMap.enabled = !isTouch && opts.shadows !== false;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(opts.sky ?? 0x8fd3ff);
    this.camera = new THREE.PerspectiveCamera(70, 1, 0.3, opts.far || 2000);
    this.hemi = new THREE.HemisphereLight(0xffffff, 0x99a6b8, 2.2);
    this.scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight(0xffffff, 2.2);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    const sc = this.sun.shadow.camera;
    sc.left = -50; sc.right = 50; sc.top = 50; sc.bottom = -50; sc.near = 1; sc.far = 220;
    this.sun.shadow.bias = -0.0005;
    this.scene.add(this.sun, this.sun.target);

    this.solids = [];
    this.blockers = [];       // meshes the camera won't pass through
    this.updaters = [];       // fn(t, dt) each frame
    this.interactables = [];
    this.triggers = [];
    this.cameraCollision = opts.cameraCollision !== false;

    this.state = {
      pos: new THREE.Vector3(), vel: new THREE.Vector3(),
      facing: Math.PI, grounded: false, ground: null,
      inWater: false, carrying: null, flapsLeft: 0,
    };
    this.cam = { yaw: 0, pitch: 0.38, dist: opts.camDist || 20, minDist: 6, maxDist: 45 };
    this.input = { x: 0, y: 0, jumpHeld: false, jumpPressed: false };
    this.locked = false;      // true while a dialogue/menu is open: no movement
    this.running = false;
    this.elapsed = 0;

    // hooks a game can override
    this.physics = () => ({});   // -> { gravity, jumpV, speed, water, waterJumpV, glide, flaps }
    this.onLand = null;          // (solid) when landing on a different solid
    this.afterStep = null;       // (dt) after movement each physics step
    this.onFrame = null;         // (dt) each rendered frame

    this.avatar = createAvatar(opts.look);
    this.scene.add(this.avatar.group);

    this._injectUI();
    this._bindInput();
    this._initSound();
    window.addEventListener('resize', () => this.resize());
    this.resize();
  }

  // ---------------------------------------------------------- builders
  addMesh(mesh, shadows = true) {
    mesh.castShadow = shadows;
    mesh.receiveShadow = true;
    this.scene.add(mesh);
    return mesh;
  }

  // Axis-aligned box. (cx, cz) centre, `top` = y of the top face.
  box(cx, top, cz, sx, sy, sz, color, opts = {}) {
    const geo = new THREE.BoxGeometry(sx, sy, sz);
    const mat = opts.material || (opts.studs
      ? studMaterial(color, sx, sz, opts.matOpts)
      : new THREE.MeshLambertMaterial({ color, ...(opts.matOpts || {}) }));
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(cx, top - sy / 2, cz);
    (opts.parent || this.scene).add(mesh);
    mesh.castShadow = opts.shadow !== false;
    mesh.receiveShadow = true;
    const s = {
      type: 'box', mesh,
      min: new THREE.Vector3(cx - sx / 2, top - sy, cz - sz / 2),
      max: new THREE.Vector3(cx + sx / 2, top, cz + sz / 2),
      ...opts.extra,
    };
    if (!opts.noCollide) this.solids.push(s);
    if (!opts.noCollide && opts.blockCamera !== false) this.blockers.push(mesh);
    return s;
  }

  cyl(x, z, r, bottom, top, color, opts = {}) {
    const geo = new THREE.CylinderGeometry(r, opts.rBottom ?? r, top - bottom, opts.segments || 32);
    const mat = opts.material || new THREE.MeshLambertMaterial({ color });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, (top + bottom) / 2, z);
    (opts.parent || this.scene).add(mesh);
    mesh.castShadow = opts.shadow !== false;
    mesh.receiveShadow = true;
    const s = { type: 'cyl', mesh, x, z, r, bottom, top, ...opts.extra };
    if (!opts.noCollide) this.solids.push(s);
    return s;
  }

  sphere(x, y, z, r, color, opts = {}) {
    const mat = opts.material || new THREE.MeshLambertMaterial({ color });
    const mesh = this.addMesh(new THREE.Mesh(new THREE.SphereGeometry(r, 40, 24), mat));
    mesh.position.set(x, y, z);
    const s = { type: 'sphere', mesh, x, y, z, r };
    if (!opts.noCollide) this.solids.push(s);
    return s;
  }

  // Remove a solid (and its mesh) from the world.
  remove(s) {
    const i = this.solids.indexOf(s);
    if (i >= 0) this.solids.splice(i, 1);
    if (s.mesh) {
      s.mesh.removeFromParent();
      const j = this.blockers.indexOf(s.mesh);
      if (j >= 0) this.blockers.splice(j, 1);
    }
  }

  sign(lines, x, y, z, opts = {}) {
    const w = opts.w || 10, h = opts.h || 5;
    const mat = new THREE.MeshBasicMaterial({ map: textTexture(lines, opts), side: THREE.DoubleSide, transparent: true });
    const board = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
    board.position.set(x, y + h / 2 + (opts.noPost ? 0 : 3), z);
    if (opts.rotY) board.rotation.y = opts.rotY;
    this.scene.add(board);
    if (!opts.noPost) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.6, 3.2, 0.6), new THREE.MeshLambertMaterial({ color: 0x5b3a22 }));
      post.position.set(x, y + 1.6, z);
      post.castShadow = true;
      this.scene.add(post);
    }
    return board;
  }

  // Round-topped tree (Grab 'n' Go / City style) or cone pine (Obby forest).
  tree(x, top, z, scale = 1, kind = 'round') {
    this.cyl(x, z, 0.8 * scale, top - 1, top + 6 * scale, 0x7a4a26, { segments: 10 });
    if (kind === 'pine') {
      const l1 = new THREE.Mesh(new THREE.ConeGeometry(4 * scale, 8 * scale, 10), new THREE.MeshLambertMaterial({ color: 0x2f9e44 }));
      l1.position.set(x, top + 9 * scale, z);
      this.addMesh(l1);
      const l2 = new THREE.Mesh(new THREE.ConeGeometry(3 * scale, 6 * scale, 10), new THREE.MeshLambertMaterial({ color: 0x37b24d }));
      l2.position.set(x, top + 12.5 * scale, z);
      this.addMesh(l2);
    } else {
      const l = new THREE.Mesh(new THREE.SphereGeometry(4 * scale, 14, 10), new THREE.MeshLambertMaterial({ color: 0x3fa34d }));
      l.scale.y = 0.85;
      l.position.set(x, top + 8.5 * scale, z);
      this.addMesh(l);
    }
  }

  // An NPC: avatar + name tag. Returns { group, avatar, label, pos }.
  npc(name, x, top, z, look = {}, facing = 0) {
    const av = createAvatar(look);
    av.group.position.set(x, top, z);
    av.group.rotation.y = facing;
    this.scene.add(av.group);
    const label = labelSprite(name, { scale: 7 });
    label.position.set(x, top + 7, z);
    this.scene.add(label);
    // NPCs are solid so you can't walk through them
    this.cyl(x, z, 1.1, top, top + 5, 0, { noCollide: false, material: new THREE.MeshBasicMaterial({ visible: false }), shadow: false });
    const idle = { vel: new THREE.Vector3(), grounded: true };
    const t0 = Math.random() * 10;
    this.updaters.push((t) => {
      av.parts.head.rotation.y = Math.sin(t * 0.7 + t0) * 0.3;
      av.animate(idle, 0.016);
    });
    return { group: av.group, avatar: av, label, pos: new THREE.Vector3(x, top, z) };
  }

  // ---------------------------------------------------------- interaction
  // Like a Roblox ProximityPrompt: { pos | getPos(), radius, label | getLabel(), onInteract, enabled() }
  addInteractable(it) {
    this.interactables.push({ radius: 7, enabled: () => true, ...it });
    return it;
  }
  // Touch trigger: { test(pos) -> bool, onEnter(), onExit(), once }
  addTrigger(tr) {
    this.triggers.push({ inside: false, ...tr });
    return tr;
  }

  // ---------------------------------------------------------- UI
  _injectUI() {
    document.body.insertAdjacentHTML('beforeend', `
      <div id="eng-joy"><div id="eng-knob"></div></div>
      <button id="eng-jump" aria-label="Jump">Jump</button>
      <button id="eng-prompt" hidden><kbd>E</kbd><span></span></button>
      <div id="eng-toast"></div>
      <div id="eng-flash"></div>`);
    this.ui = {
      joy: document.getElementById('eng-joy'),
      knob: document.getElementById('eng-knob'),
      jump: document.getElementById('eng-jump'),
      prompt: document.getElementById('eng-prompt'),
      promptText: document.querySelector('#eng-prompt span'),
      toast: document.getElementById('eng-toast'),
      flash: document.getElementById('eng-flash'),
    };
    this.ui.prompt.addEventListener('click', (e) => { e.preventDefault(); this.interact(); });
  }
  toast(text, ms = 2600) {
    const el = this.ui.toast;
    el.textContent = text;
    el.classList.add('show');
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => el.classList.remove('show'), ms);
  }
  flash() {
    this.ui.flash.classList.add('on');
    requestAnimationFrame(() => requestAnimationFrame(() => this.ui.flash.classList.remove('on')));
  }

  // ---------------------------------------------------------- input
  _bindInput() {
    this.keys = new Set();
    this.keyHandlers = {};
    window.addEventListener('keydown', (e) => {
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
      if (!e.repeat) {
        if (e.code === 'KeyE' && !this.locked) this.interact();
        const h = this.keyHandlers[e.code];
        if (h) h(e);
      }
      this.keys.add(e.code);
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.keys.clear());

    const canvas = this.canvas;
    const drags = new Map();
    let joyId = null;
    const joyOrigin = { x: 0, y: 0 };
    this.joyVec = { x: 0, y: 0 };
    canvas.addEventListener('pointerdown', (e) => {
      try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* pointer already gone */ }
      if (e.pointerType === 'touch' && e.clientX < window.innerWidth * 0.45 && joyId === null) {
        joyId = e.pointerId;
        joyOrigin.x = e.clientX; joyOrigin.y = e.clientY;
        this.ui.joy.style.left = e.clientX + 'px';
        this.ui.joy.style.top = e.clientY + 'px';
        this.ui.joy.classList.add('on');
        this.ui.knob.style.transform = 'translate(0,0)';
        return;
      }
      drags.set(e.pointerId, { x: e.clientX, y: e.clientY });
    });
    canvas.addEventListener('pointermove', (e) => {
      if (e.pointerId === joyId) {
        let dx = e.clientX - joyOrigin.x, dy = e.clientY - joyOrigin.y;
        const len = Math.hypot(dx, dy), max = 50;
        if (len > max) { dx *= max / len; dy *= max / len; }
        this.ui.knob.style.transform = `translate(${dx}px, ${dy}px)`;
        this.joyVec.x = dx / max; this.joyVec.y = -dy / max;
        return;
      }
      const d = drags.get(e.pointerId);
      if (!d) return;
      const sens = e.pointerType === 'touch' ? 0.008 : 0.006;
      this.cam.yaw -= (e.clientX - d.x) * sens;
      this.cam.pitch = THREE.MathUtils.clamp(this.cam.pitch + (e.clientY - d.y) * sens, -0.15, 1.3);
      d.x = e.clientX; d.y = e.clientY;
    });
    const end = (e) => {
      if (e.pointerId === joyId) {
        joyId = null;
        this.joyVec.x = this.joyVec.y = 0;
        this.ui.joy.classList.remove('on');
      }
      drags.delete(e.pointerId);
    };
    canvas.addEventListener('pointerup', end);
    canvas.addEventListener('pointercancel', end);
    canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      this.cam.dist = THREE.MathUtils.clamp(this.cam.dist + e.deltaY * 0.02, this.cam.minDist, this.cam.maxDist);
    }, { passive: false });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());

    const jb = this.ui.jump;
    this.touchJump = false;
    jb.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      this.touchJump = true;
      jb.classList.add('down');
      try { jb.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
    });
    const up = () => { this.touchJump = false; jb.classList.remove('down'); };
    jb.addEventListener('pointerup', up);
    jb.addEventListener('pointercancel', up);
  }

  onKey(code, fn) { this.keyHandlers[code] = fn; }

  readInput() {
    const k = this.keys;
    let x = 0, y = 0;
    if (k.has('KeyW') || k.has('ArrowUp')) y += 1;
    if (k.has('KeyS') || k.has('ArrowDown')) y -= 1;
    if (k.has('KeyA') || k.has('ArrowLeft')) x -= 1;
    if (k.has('KeyD') || k.has('ArrowRight')) x += 1;
    x += this.joyVec.x; y += this.joyVec.y;
    const len = Math.hypot(x, y);
    if (len > 1) { x /= len; y /= len; }
    const held = k.has('Space') || this.touchJump;
    if (this.locked) { x = 0; y = 0; }
    this.input.x = x; this.input.y = y;
    this.input.jumpPressed = held && !this.input.jumpHeld && !this.locked;
    this.input.jumpHeld = held && !this.locked;
  }

  // ---------------------------------------------------------- sound
  _initSound() {
    this.actx = null;
    try { this.muted = localStorage.getItem('annablox-muted') === '1'; } catch (e) { this.muted = false; }
  }
  unlockAudio() {
    if (!this.actx) {
      try { this.actx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { this.actx = null; }
    }
    if (this.actx && this.actx.state === 'suspended') this.actx.resume();
  }
  bindSoundButton(btn) {
    const upd = () => {
      btn.textContent = this.muted ? '🔇' : '🔊';
      btn.setAttribute('aria-label', this.muted ? 'Sound off' : 'Sound on');
    };
    upd();
    btn.addEventListener('click', () => {
      this.muted = !this.muted;
      try { localStorage.setItem('annablox-muted', this.muted ? '1' : '0'); } catch (e) { /* ignore */ }
      upd();
    });
  }
  tone(freq, dur = 0.25, type = 'sine', vol = 0.18, slideTo = null, delay = 0) {
    if (this.muted || !this.actx) return;
    const a = this.actx;
    const t0 = a.currentTime + delay;
    const o = a.createOscillator();
    const g = a.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t0);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    o.connect(g).connect(a.destination);
    o.start(t0);
    o.stop(t0 + dur + 0.02);
  }
  get sfx() {
    const t = this.tone.bind(this);
    return {
      jump: () => t(420, 0.12, 'square', 0.05, 700),
      bigJump: () => t(300, 0.4, 'triangle', 0.12, 1200),
      flap: () => t(600, 0.15, 'triangle', 0.08, 900),
      note: (f) => { t(f, 0.6, 'sine', 0.22); t(f * 2, 0.3, 'sine', 0.06); },
      die: () => t(300, 0.4, 'sawtooth', 0.07, 80),
      splash: () => t(900, 0.25, 'triangle', 0.06, 150),
      coin: () => { t(988, 0.08, 'square', 0.06); t(1319, 0.25, 'square', 0.06, null, 0.08); },
      build: () => t(220, 0.12, 'square', 0.05, 330),
      pop: () => t(700, 0.1, 'sine', 0.12, 1100),
      error: () => t(200, 0.25, 'square', 0.05, 150),
      chime: () => [523, 659, 784].forEach((f, i) => t(f, 0.25, 'triangle', 0.12, null, i * 0.08)),
      win: () => [523, 659, 784, 1046, 784, 1046].forEach((f, i) => t(f, 0.3, 'triangle', 0.14, null, i * 0.12)),
    };
  }

  // ---------------------------------------------------------- physics
  overlapsXZ(s, px, pz, pad = 0) {
    if (s.type === 'box') {
      return px + PR - pad > s.min.x && px - PR + pad < s.max.x && pz + PR - pad > s.min.z && pz - PR + pad < s.max.z;
    }
    const d = Math.hypot(px - s.x, pz - s.z);
    if (s.type === 'cyl') return d < s.r + PR - pad;
    return d < s.r * 0.97;
  }
  topAt(s, px, pz) {
    if (s.type === 'box') return s.max.y;
    if (s.type === 'cyl') return s.top;
    const d = Math.min(Math.hypot(px - s.x, pz - s.z), s.r);
    return s.y + Math.sqrt(s.r * s.r - d * d);
  }
  bottomAt(s, px, pz) {
    if (s.type === 'box') return s.min.y;
    if (s.type === 'cyl') return s.bottom;
    const d = Math.min(Math.hypot(px - s.x, pz - s.z), s.r);
    return s.y - Math.sqrt(s.r * s.r - d * d);
  }

  _resolveHorizontal() {
    const p = this.state.pos;
    for (const s of this.solids) {
      if (s.disabled || !this.overlapsXZ(s, p.x, p.z)) continue;
      const top = this.topAt(s, p.x, p.z), bottom = this.bottomAt(s, p.x, p.z);
      if (p.y >= top - 0.01 || p.y + PH <= bottom + 0.01) continue;
      if (top - p.y <= 1.1 && this.state.vel.y <= 0.1 && s.type !== 'sphere') {
        p.y = top; // step up small ledges (stairs!)
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

  _resolveVertical(prevY) {
    const st = this.state, p = st.pos;
    st.grounded = false;
    let ground = null;
    for (const s of this.solids) {
      if (s.disabled || !this.overlapsXZ(s, p.x, p.z, s.type === 'cyl' ? 0.4 : 0)) continue;
      const top = this.topAt(s, p.x, p.z), bottom = this.bottomAt(s, p.x, p.z);
      if (st.vel.y <= 0 && prevY >= top - 0.6 && p.y <= top) {
        p.y = top;
        st.vel.y = 0;
        st.grounded = true;
        ground = s;
      } else if (st.vel.y > 0 && prevY + PH <= bottom + 0.05 && p.y + PH > bottom) {
        p.y = bottom - PH;
        st.vel.y = 0;
      }
    }
    if (ground && ground !== st.ground && this.onLand) this.onLand(ground);
    st.ground = ground;
    if (st.grounded) st.flapsLeft = 0;
  }

  step(dt) {
    const st = this.state, p = st.pos, v = st.vel, inp = this.input;
    const P = this.physics(st) || {};
    const gravity = P.gravity ?? G;
    const wasInWater = st.inWater;
    st.inWater = !!P.water;
    if (st.inWater && !wasInWater) this.sfx.splash();

    const yaw = this.cam.yaw;
    const fx = -Math.sin(yaw), fz = -Math.cos(yaw);
    const rx = Math.cos(yaw), rz = -Math.sin(yaw);
    const mx = fx * inp.y + rx * inp.x;
    const mz = fz * inp.y + rz * inp.x;
    let speed = st.inWater ? (P.swimSpeed ?? 12) : (P.speed ?? WALK);
    if (P.glide && !st.grounded && inp.jumpHeld && v.y < 0) speed *= P.glideSpeedMult ?? 1.4;
    v.x = mx * speed;
    v.z = mz * speed;
    if (Math.hypot(mx, mz) > 0.1) {
      const target = Math.atan2(mx, mz);
      let diff = target - st.facing;
      diff = Math.atan2(Math.sin(diff), Math.cos(diff));
      st.facing += diff * Math.min(1, dt * 14);
    }

    if (st.inWater) {
      // idle: drift to the surface and bob with your head out; hold jump to rise and pop out
      const surf = P.waterSurface ?? 0;
      const targetVy = inp.jumpHeld ? 16 : (p.y > surf - 3.6 ? -2 : 3);
      v.y += (targetVy - v.y) * Math.min(1, dt * 4);
      if (inp.jumpHeld && v.y > 0 && p.y > surf - 4.2) {
        v.y = P.waterJumpV ?? 60;
        st.inWater = false;
        this.sfx.bigJump();
      }
    } else {
      v.y -= gravity * dt;
      if (st.grounded && inp.jumpHeld) {
        v.y = P.jumpV ?? JUMP_V;
        if ((P.jumpV ?? JUMP_V) > 80) this.sfx.bigJump(); else this.sfx.jump();
        st.grounded = false;
        st.flapsLeft = P.flaps || 0;
      } else if (!st.grounded && inp.jumpPressed && st.flapsLeft > 0) {
        v.y = P.flapV ?? 30; // rooster flap
        st.flapsLeft--;
        this.sfx.flap();
      }
      if (P.glide && !st.grounded && inp.jumpHeld && v.y < -(P.glideFall ?? 5)) {
        v.y = -(P.glideFall ?? 5);
      }
    }

    p.x += v.x * dt;
    p.z += v.z * dt;
    this._resolveHorizontal();
    const prevY = p.y;
    p.y += v.y * dt;
    this._resolveVertical(prevY);
    inp.jumpPressed = false;

    for (const tr of this.triggers) {
      const inside = tr.test(p);
      if (inside && !tr.inside && tr.onEnter) tr.onEnter();
      if (!inside && tr.inside && tr.onExit) tr.onExit();
      tr.inside = inside;
    }
    if (this.afterStep) this.afterStep(dt);
  }

  teleport(pos, facing = Math.PI, camYaw = null) {
    const st = this.state;
    st.pos.copy(pos);
    st.vel.set(0, 0, 0);
    st.grounded = false;
    st.ground = null;
    st.inWater = false;
    st.facing = facing;
    if (camYaw !== null) this.cam.yaw = camYaw;
    this._camInit = false;
  }

  // ---------------------------------------------------------- interaction prompt
  _nearestInteractable() {
    const p = this.state.pos;
    let best = null, bestD = Infinity;
    for (const it of this.interactables) {
      if (!it.enabled()) continue;
      const q = it.getPos ? it.getPos() : it.pos;
      const d = Math.hypot(q.x - p.x, q.z - p.z);
      if (d < it.radius && Math.abs(q.y - p.y) < 8 && d < bestD) { best = it; bestD = d; }
    }
    return best;
  }
  interact() {
    if (this.locked || !this.running) return;
    const it = this._nearestInteractable();
    if (it) { this.unlockAudio(); it.onInteract(); }
  }

  // ---------------------------------------------------------- camera
  updateCamera(dt) {
    const p = this.state.pos;
    const target = new THREE.Vector3(p.x, p.y + 3.5, p.z);
    const cp = Math.cos(this.cam.pitch);
    const dir = new THREE.Vector3(Math.sin(this.cam.yaw) * cp, Math.sin(this.cam.pitch), Math.cos(this.cam.yaw) * cp);
    let dist = this.cam.dist;
    if (this.cameraCollision && this.blockers.length) {
      this._ray = this._ray || new THREE.Raycaster();
      this._ray.set(target, dir);
      this._ray.far = dist;
      const hits = this._ray.intersectObjects(this.blockers, false);
      if (hits.length) dist = Math.max(2.5, hits[0].distance - 0.6);
    }
    const want = target.clone().addScaledVector(dir, dist);
    if (!this._camInit) { this._camPos = want.clone(); this._camInit = true; }
    // pull in instantly when blocked, ease out otherwise
    const curDist = this._camPos.distanceTo(target);
    if (dist < curDist - 0.5) this._camPos.copy(want);
    else this._camPos.lerp(want, 1 - Math.exp(-dt * 10));
    this.camera.position.copy(this._camPos);
    this.camera.lookAt(target);
    this.sun.position.set(p.x + 30, p.y + 60, p.z + 25);
    this.sun.target.position.copy(p);
  }

  resize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.fov = w < h ? 80 : 70;
    this.camera.updateProjectionMatrix();
  }

  // ---------------------------------------------------------- loop
  start() {
    let last = performance.now();
    const frame = (now) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      this.elapsed += dt;
      this.readInput();
      if (this.running) {
        const n = Math.ceil(dt / (1 / 240));
        for (let i = 0; i < n; i++) this.step(dt / n);
      }
      for (const u of this.updaters) u(this.elapsed, dt);
      this.avatar.animate(this.state, dt);
      this.avatar.group.position.copy(this.state.pos);
      this.avatar.group.rotation.y = this.state.facing;
      // prompt
      const it = this.running && !this.locked ? this._nearestInteractable() : null;
      if (it) {
        const label = it.getLabel ? it.getLabel() : it.label;
        if (this.ui.promptText.textContent !== label) this.ui.promptText.textContent = label;
        this.ui.prompt.hidden = false;
      } else {
        this.ui.prompt.hidden = true;
      }
      if (this.onFrame) this.onFrame(dt);
      this.updateCamera(dt);
      this.renderer.render(this.scene, this.camera);
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  }
}

// Wait (briefly) for the Fredoka web font so canvas text uses it.
export function fontsReady() {
  if (!document.fonts || !document.fonts.load) return Promise.resolve();
  return Promise.race([
    document.fonts.load('700 40px Fredoka').catch(() => {}),
    new Promise((r) => setTimeout(r, 1500)),
  ]);
}

export function fmtTime(s) {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${String(sec).padStart(2, '0')}`;
}

// Small helpers for saving progress in this browser only.
export const store = {
  get(key) { try { return JSON.parse(localStorage.getItem(key)); } catch (e) { return null; } },
  set(key, v) { try { localStorage.setItem(key, JSON.stringify(v)); } catch (e) { /* storage blocked */ } },
  del(key) { try { localStorage.removeItem(key); } catch (e) { /* ignore */ } },
};
