// Phần trình bày và đọc phím; toàn bộ luật chạy trong src/core.
import * as THREE from 'three';
import { Game } from '../src/core/game.js';
import { TUNING, WORLD, TICK_RATE } from '../src/core/config.js';
import { MAPS } from '../src/core/maps.js';
import { rankEntries, validLeaderboardName } from '../src/core/leaderboard.js';
import { makeBenchmarkScenario } from '../src/core/benchmark.js';

const $ = (id) => document.getElementById(id);
const COLORS = {
  sky: 0x0e1430, mist: 0x1b2350, grass: 0x2f5d50, sand: 0xc9b48a,
  wood: 0x6b4a2f, cloud: 0x12384a, lamp: 0xffb347, lampCore: 0xffe9b0,
  lampOff: 0x5b5f6e, mote: 0xfff6c2, moteGlow: 0xffe58a,
  shade: 0x120a1a, shadeEdge: 0x7a3cff, stunned: 0x3a3450,
  may: 0xe8e2d0, scarf: 0xc8102e, gold: 0xf2c14e, drifter: 0x8fa3b8,
};
const ISLANDS = { 1: 'Đảo Bến', 2: 'Đảo Cau', 3: 'Đảo Chuông' };
const STORIES = {
  1: '“Đảo Bến giữ ngọn đèn đầu tiên. Mây hãy gom ánh sáng dưới chân, rồi thắp lại từng đèn. Bóng Mực chỉ chờ mình lạc bước.” — Ông Đăng',
  2: '“Cầu tre không có lan can đâu nhé. Bục phóng sẽ đưa con qua Đảo Cau. Gió Lạc thích những ai mang nhiều đom đóm.” — Ông Đăng',
  3: '“Đảo Chuông có ba tầng và một ngọn gió đổi chiều. Đi theo hai con dốc, dùng bục ở tầng trên, rồi tìm những chiếc đèn cuối cùng.” — Ông Đăng',
};
const STEP = 1 / TICK_RATE;
const benchQuery = new URLSearchParams(location.search);
const BENCH_MODE = benchQuery.has('bench');
const BENCH_DURATION = Math.max(1, Math.min(300, Number(benchQuery.get('bench')) || 30));
let benchStartedAt = 0;
let benchLoadMs = null;
let benchDeltas = [];
let benchComplete = false;
const clockText = (seconds) => {
  const n = Math.max(0, Math.ceil(seconds));
  return `${Math.floor(n / 60)}:${String(n % 60).padStart(2, '0')}`;
};

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.5));
renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.setClearColor(COLORS.sky, 1);
document.body.prepend(renderer.domElement);
renderer.domElement.setAttribute('aria-label', 'Thế giới 3D Đảo Đèn Lồng');

const scene = new THREE.Scene();
const skyColor = new THREE.Color(COLORS.sky);
const litSky = new THREE.Color(COLORS.mist);
scene.background = skyColor.clone();
scene.fog = new THREE.Fog(COLORS.sky, 42, 140);
const camera = new THREE.PerspectiveCamera(58, innerWidth / innerHeight, 0.1, 320);
const ambient = new THREE.HemisphereLight(0xd5ddff, 0x23392f, 0.15);
scene.add(ambient);
const keyLight = new THREE.DirectionalLight(0xffedcf, 0.45);
keyLight.position.set(-24, 42, -20);
scene.add(keyLight);
const playerGlow = new THREE.PointLight(COLORS.lamp, 2.2, 8, 1.6);
scene.add(playerGlow);
addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

const worldGroup = new THREE.Group();
scene.add(worldGroup);
const groundMaterials = [];
const lanternViews = new Map();
const moteViews = new Map();
const shadeViews = new Map();
const drifterViews = new Map();
const charmViews = new Map();
let currentNight = 1;
let game = null;
let started = false;
let resultHandled = false;
let runSeed = 1;
let totalScore = 0;
let lastNightScore = 0;
let acc = 0;
let lastFrame = performance.now();
let cameraYaw = 0;
let dragging = false;
let pauseRequest = false;
let previousSettingsPanel = 'menuPanel';
let lastWarningTick = -1;
let lastCountdown = null;
let toastTimeout = 0;
let fpsSamples = [];
const DEFAULT_BINDINGS = { up: 'KeyW', down: 'KeyS', left: 'KeyA', right: 'KeyD', jump: 'Space', dash: 'ShiftLeft', interact: 'KeyE', pulse: 'KeyQ', pause: 'Escape' };
let bindings = { ...DEFAULT_BINDINGS };
let bindingCapture = null;
let leaderboardEntries = [];
let latestShadesVisible = false;
let lastLowFuelCue = false;

const mat = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.9, ...extra });
const setTopDisk = (radius, y, material, group = worldGroup, segments = 72, cx = 0, cz = 0) => {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, 1.5, segments), material);
  mesh.position.set(cx, y - 0.75, cz);
  mesh.receiveShadow = true;
  group.add(mesh);
  return mesh;
};
const addTorus = (radius, tube, color, x, y, z, group = worldGroup, opacity = 1) => {
  const mesh = new THREE.Mesh(new THREE.TorusGeometry(radius, tube, 8, 72), new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.16, transparent: opacity < 1, opacity }));
  mesh.rotation.x = Math.PI / 2;
  mesh.position.set(x, y, z);
  group.add(mesh);
  return mesh;
};
const addRock = (x, z, radius, color) => {
  const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(radius, 0), mat(color));
  rock.position.set(x, 0.12, z);
  rock.rotation.set(radius * 2, x * 0.1, z * 0.07);
  worldGroup.add(rock);
};

function clearWorld() {
  worldGroup.clear();
  groundMaterials.length = 0;
  lanternViews.clear(); moteViews.clear(); shadeViews.clear(); drifterViews.clear(); charmViews.clear();
}

function makeIsland(cx, cz, radius, color = COLORS.grass) {
  const ground = mat(color, { roughness: 1 });
  groundMaterials.push(ground);
  setTopDisk(radius, 0, ground, worldGroup, 72, cx, cz);
  const cliff = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius - 3, 4, 72), mat(0x24453f));
  cliff.position.set(cx, -2, cz);
  worldGroup.add(cliff);
  addTorus(radius - 0.15, 0.28, COLORS.sand, cx, 0.04, cz);
}

function makeBridge() {
  const deck = new THREE.Mesh(new THREE.BoxGeometry(18, 0.34, 4), mat(COLORS.wood, { roughness: 1 }));
  deck.position.set(35, -0.17, 0);
  worldGroup.add(deck);
  const plankMaterial = mat(0x8b6542);
  for (let i = 0; i <= 18; i++) {
    const plank = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.04, 4), plankMaterial);
    plank.position.set(26 + i, 0.015, 0);
    worldGroup.add(plank);
  }
  for (const x of [26, 44]) {
    for (const z of [-1.5, 1.5]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.2, 1.4, 8), mat(COLORS.wood));
      post.position.set(x, -0.65, z);
      worldGroup.add(post);
    }
  }
}

function makeNight3Layers() {
  const terrace = new THREE.Mesh(new THREE.RingGeometry(12, 24, 72, 1, 0, Math.PI), mat(COLORS.sand, { roughness: 1, side: THREE.DoubleSide }));
  terrace.rotation.x = Math.PI / 2;
  terrace.position.y = 3;
  worldGroup.add(terrace);
  const upper = mat(0xc4b38d, { roughness: 1 });
  setTopDisk(8, 6, upper);
  addTorus(24, 0.22, 0xe0cb9d, 0, 3.02, 0, worldGroup, 0.8);
  addTorus(12, 0.16, 0x776b55, 0, 3.03, 0, worldGroup, 0.9);
  addTorus(8, 0.18, COLORS.gold, 0, 6.03, 0, worldGroup, 0.8);

  // Vách đứng của tầng 1; những phần nằm bên ngoài dốc vẫn là mép rơi.
  for (const [radius, count] of [[24, 34], [12, 18]]) {
    const start = radius === 24 ? 0 : 0;
    const end = Math.PI;
    for (let i = 0; i < count; i++) {
      const a = start + ((end - start) * (i + 0.5)) / count;
      const length = (radius * Math.PI) / count;
      const wall = new THREE.Mesh(new THREE.BoxGeometry(length + 0.08, 3, 0.24), mat(radius === 24 ? 0x526655 : 0x8b8067));
      wall.position.set(radius * Math.cos(a), 1.5, radius * Math.sin(a));
      wall.rotation.y = a + Math.PI / 2;
      worldGroup.add(wall);
    }
  }

  for (const deg of [30, 150]) {
    const a = (deg * Math.PI) / 180;
    const ramp = new THREE.Mesh(new THREE.BoxGeometry(3, 0.35, 6.2), mat(COLORS.sand, { roughness: 1 }));
    ramp.position.set(27 * Math.cos(a), 1.5, 27 * Math.sin(a));
    ramp.rotation.set(Math.PI / 6, Math.PI / 2 - a, 0);
    worldGroup.add(ramp);
    for (let i = 0; i < 5; i++) {
      const step = new THREE.Mesh(new THREE.BoxGeometry(3.05, 0.08, 0.12), mat(0x9b8968));
      step.position.set((28.8 - i * 1.2) * Math.cos(a), 0.6 + i * 0.6, (28.8 - i * 1.2) * Math.sin(a));
      step.rotation.y = Math.PI / 2 - a;
      worldGroup.add(step);
    }
  }

  const tower = new THREE.Mesh(new THREE.CylinderGeometry(2, 2.5, 8, 16), mat(COLORS.wood, { roughness: 0.85 }));
  tower.position.set(0, 10, 0);
  worldGroup.add(tower);
  const roof = new THREE.Mesh(new THREE.ConeGeometry(2.7, 1.2, 16), mat(COLORS.gold));
  roof.position.set(0, 14.6, 0);
  worldGroup.add(roof);
  addTorus(2.8, 0.12, COLORS.lamp, 0, 6.1, 0);
}

function makeJumpPad(pad) {
  const base = new THREE.Mesh(new THREE.CylinderGeometry(pad.radius, pad.radius * 1.25, 0.24, 24), mat(COLORS.wood));
  base.position.set(pad.pos[0], pad.pos[1] + 0.12, pad.pos[2]);
  worldGroup.add(base);
  addTorus(pad.radius * 0.72, 0.09, COLORS.lamp, pad.pos[0], pad.pos[1] + 0.28, pad.pos[2]);
  const coil = new THREE.Mesh(new THREE.TorusKnotGeometry(0.32, 0.07, 48, 6, 2, 3), mat(COLORS.gold, { emissive: COLORS.lamp, emissiveIntensity: 0.55 }));
  coil.position.set(pad.pos[0], pad.pos[1] + 0.55, pad.pos[2]);
  coil.scale.set(0.7, 0.42, 0.7);
  worldGroup.add(coil);
}

function makeWorld(night) {
  clearWorld();
  currentNight = night;
  const world = MAPS[night];
  if (BENCH_MODE) worldGroup.add(benchMoteInstances, benchShadeBodyInstances, benchShadeEyeLeftInstances, benchShadeEyeRightInstances);
  const islandColor = night === 2 ? COLORS.grass : 0x365d4b;
  for (const island of world.islands) makeIsland(island.center[0], island.center[2], island.radius, islandColor);
  if (world.bridges.length) makeBridge();
  if (night === 3) makeNight3Layers();
  for (const pad of world.jumpPads) makeJumpPad(pad);

  const cloudSea = new THREE.Mesh(new THREE.CircleGeometry(260, 48), mat(COLORS.cloud, { roughness: 1 }));
  cloudSea.rotation.x = -Math.PI / 2;
  cloudSea.position.y = -12;
  worldGroup.add(cloudSea);

  for (let i = 0; i < 28; i++) {
    const a = i * 2.399;
    const radius = 8 + ((i * 37) % (night === 3 ? 34 : 25));
    if (night === 3 && radius < 26 && Math.sin(a) > 0) continue;
    if (night === 2) {
      addRock(radius * Math.sin(a), radius * Math.cos(a), 0.3 + (i % 3) * 0.13, 0x426452);
      addRock(70 + radius * Math.sin(a), radius * Math.cos(a), 0.3 + (i % 4) * 0.1, 0x426452);
    } else addRock(radius * Math.sin(a), radius * Math.cos(a), 0.3 + (i % 4) * 0.14, 0x426452);
  }

  for (const point of world.moteSpawns) {
    const flower = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), mat(0xb7c58b, { emissive: 0x536d45, emissiveIntensity: 0.2 }));
    flower.position.set(point[0], point[1] + 0.08, point[2]);
    flower.scale.set(1, 0.4, 1);
    worldGroup.add(flower);
  }

  for (const lantern of world.lanterns) {
    const view = makeLantern(lantern.pos[1]);
    view.group.position.set(lantern.pos[0], lantern.pos[1], lantern.pos[2]);
    worldGroup.add(view.group);
    lanternViews.set(lantern.id, view);
  }
  ambient.intensity = 0.15;
}

function makeLantern(y) {
  const group = new THREE.Group();
  const wood = mat(COLORS.wood, { roughness: 1 });
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.23, 3.0, 10), wood);
  post.position.y = 1.5;
  const shellMaterial = mat(0x792d35, { emissive: COLORS.lamp, emissiveIntensity: 0.03, roughness: 0.7 });
  const shell = new THREE.Mesh(new THREE.SphereGeometry(0.72, 18, 12), shellMaterial);
  shell.scale.y = 1.1;
  shell.position.y = 3.55;
  const tear = new THREE.Mesh(new THREE.TetrahedronGeometry(0.14), mat(0x211b25));
  tear.position.set(0, 3.55, 0.68);
  const light = new THREE.PointLight(COLORS.lamp, 0, 15, 1.6);
  light.position.y = 3.6;
  const ring = new THREE.Mesh(new THREE.RingGeometry(TUNING.safe_radius - 0.1, TUNING.safe_radius, 64), new THREE.MeshBasicMaterial({ color: COLORS.lamp, transparent: true, opacity: 0, side: THREE.DoubleSide }));
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.04;
  group.add(post, shell, light, ring, tear);
  return { group, shell, shellMaterial, light, ring, tear, y };
}

function makeMay() {
  const group = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.42, 0.95, 16), mat(COLORS.may));
  body.position.y = 0.57;
  const scarf = new THREE.Mesh(new THREE.TorusGeometry(0.38, 0.09, 8, 18), mat(COLORS.scarf));
  scarf.position.set(0, 0.96, 0);
  scarf.rotation.x = Math.PI / 2;
  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.12, 0.12), mat(COLORS.scarf));
  tail.position.set(-0.36, 0.95, -0.08);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.3, 16, 12), mat(0xe5c2a2));
  head.position.y = 1.32;
  const hat = new THREE.Mesh(new THREE.ConeGeometry(0.64, 0.38, 24), mat(COLORS.sand));
  hat.position.y = 1.72;
  const hatRim = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 0.045, 24), mat(0x8e7954));
  hatRim.position.y = 1.57;
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 8), mat(COLORS.lampCore, { emissive: COLORS.lamp, emissiveIntensity: 2.1 }));
  lamp.position.set(0.48, 1.13, 0);
  group.add(body, scarf, tail, head, hat, hatRim, lamp);
  return group;
}
const may = makeMay();
scene.add(may);

const moteGeo = new THREE.SphereGeometry(0.14, 10, 8);
const moteMaterial = mat(COLORS.mote, { emissive: COLORS.moteGlow, emissiveIntensity: 2.3, roughness: 0.5 });
const droppedMaterial = mat(0xffd77a, { emissive: 0xffa840, emissiveIntensity: 1.25, roughness: 0.6 });
const shadeGeo = new THREE.SphereGeometry(0.82, 16, 12);
const shadeMaterial = mat(COLORS.shade, { emissive: COLORS.shadeEdge, emissiveIntensity: 0.28, roughness: 0.3 });
const shadeEyeGeo = new THREE.SphereGeometry(0.07, 8, 6);
const shadeEyeMaterial = new THREE.MeshBasicMaterial({ color: 0xc6a5ff });
const stunMaterial = mat(COLORS.stunned, { emissive: 0x7d78b1, emissiveIntensity: 0.65 });
const benchMoteInstances = new THREE.InstancedMesh(moteGeo, moteMaterial, 100);
const benchShadeBodyInstances = new THREE.InstancedMesh(shadeGeo, shadeMaterial, 200);
const benchShadeEyeLeftInstances = new THREE.InstancedMesh(shadeEyeGeo, shadeEyeMaterial, 200);
const benchShadeEyeRightInstances = new THREE.InstancedMesh(shadeEyeGeo, shadeEyeMaterial, 200);
for (const instances of [benchMoteInstances, benchShadeBodyInstances, benchShadeEyeLeftInstances, benchShadeEyeRightInstances]) instances.frustumCulled = false;
const benchInstanceObject = new THREE.Object3D();
const carriedLights = [];
for (let i = 0; i < TUNING.carry_capacity; i++) {
  const mesh = new THREE.Mesh(moteGeo, moteMaterial);
  mesh.scale.setScalar(0.62);
  mesh.visible = false;
  scene.add(mesh);
  carriedLights.push(mesh);
}
const pulseFx = new THREE.Mesh(new THREE.RingGeometry(0.88, 1, 56), new THREE.MeshBasicMaterial({ color: COLORS.lampCore, transparent: true, opacity: 0, side: THREE.DoubleSide }));
pulseFx.rotation.x = -Math.PI / 2;
scene.add(pulseFx);
let pulseAge = 99;
let pulseHeight = 0;

function makeMote() {
  const glow = new THREE.PointLight(COLORS.moteGlow, 0.65, 3.5, 2);
  glow.add(new THREE.Mesh(moteGeo, moteMaterial));
  return glow;
}
function makeShade() {
  const group = new THREE.Group();
  const body = new THREE.Mesh(shadeGeo, shadeMaterial);
  body.scale.set(1, 1.22, 0.88);
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0xc6a5ff });
  for (const x of [-0.22, 0.22]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), eyeMat);
    eye.position.set(x, 0.08, 0.72);
    group.add(eye);
  }
  group.add(body);
  return group;
}
function makeDrifter() {
  const group = new THREE.Group();
  const ribbonMaterial = new THREE.MeshStandardMaterial({ color: COLORS.drifter, emissive: 0x33465f, emissiveIntensity: 0.45, transparent: true, opacity: 0.86, roughness: 0.45, side: THREE.DoubleSide });
  const ribbon = new THREE.Mesh(new THREE.TorusKnotGeometry(0.55, 0.11, 64, 8, 2, 3), ribbonMaterial);
  ribbon.scale.set(1.1, 0.6, 0.55);
  const core = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 8), mat(0xb9cad9, { emissive: COLORS.drifter, emissiveIntensity: 0.9 }));
  group.add(ribbon, core);
  return group;
}
function makeCharm() {
  const group = new THREE.Group();
  const seal = new THREE.Mesh(new THREE.OctahedronGeometry(0.42, 0), mat(COLORS.scarf, { emissive: 0x65121f, emissiveIntensity: 0.6, metalness: 0.25 }));
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.055, 8, 24), mat(COLORS.gold, { metalness: 0.55 }));
  ring.rotation.x = Math.PI / 2;
  group.add(seal, ring);
  return group;
}

function syncViews(map, list, make, parent = worldGroup) {
  const seen = new Set();
  for (const item of list) {
    seen.add(item.id);
    if (!map.has(item.id)) {
      const view = make(item);
      parent.add(view);
      map.set(item.id, view);
    }
  }
  for (const [id, view] of map) {
    if (seen.has(id)) continue;
    parent.remove(view);
    map.delete(id);
  }
}

const keys = new Set();
addEventListener('keydown', (event) => {
  if (bindingCapture) {
    event.preventDefault();
    event.stopPropagation();
    if (event.code === 'Escape') { bindingCapture = null; renderBindings(); return; }
    const conflict = Object.entries(bindings).find(([action, code]) => code === event.code && action !== bindingCapture);
    if (conflict) { $('bindingMessage').textContent = `Phím đã dùng cho ${bindingLabel(conflict[0])}. Chọn phím khác.`; return; }
    bindings[bindingCapture] = event.code;
    const action = bindingCapture;
    bindingCapture = null;
    keys.clear();
    $('bindingMessage').textContent = `Đã đổi ${bindingLabel(action)} thành ${keyLabel(event.code)}.`;
    saveSettings(); renderBindings();
    return;
  }
  if ([...Object.values(bindings), 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.code)) event.preventDefault();
  keys.add(event.code);
});
addEventListener('keyup', (event) => keys.delete(event.code));
addEventListener('blur', () => keys.clear());
renderer.domElement.addEventListener('pointerdown', (event) => {
  if (event.pointerType === 'mouse') dragging = true;
});
addEventListener('pointerup', () => { dragging = false; });
addEventListener('pointermove', (event) => {
  if (dragging) cameraYaw -= event.movementX * getSensitivity();
});
renderer.domElement.addEventListener('contextmenu', (event) => event.preventDefault());

for (const button of document.querySelectorAll('[data-touch-key]')) {
  const code = button.dataset.touchKey;
  const release = (event) => { event.preventDefault(); keys.delete(code); };
  button.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    keys.add(code);
    button.setPointerCapture(event.pointerId);
  });
  button.addEventListener('pointerup', release);
  button.addEventListener('pointercancel', release);
  button.addEventListener('lostpointercapture', release);
}

function readInput() {
  let mx = 0;
  let mz = 0;
  if (keys.has(bindings.left)) mx += 1;
  if (keys.has(bindings.right)) mx -= 1;
  if (keys.has(bindings.up)) mz += 1;
  if (keys.has(bindings.down)) mz -= 1;
  const pause = pauseRequest || keys.has(bindings.pause);
  pauseRequest = false;
  return {
    move: [mx, mz], cam_yaw_deg: (cameraYaw * 180) / Math.PI,
    jump: keys.has(bindings.jump), dash: keys.has(bindings.dash),
    interact: keys.has(bindings.interact), pulse: keys.has(bindings.pulse), pause,
  };
}

const BINDING_LABELS = { up: 'Tiến', down: 'Lùi', left: 'Trái', right: 'Phải', jump: 'Nhảy', dash: 'Lướt', interact: 'Tương tác', pulse: 'Tỏa sáng', pause: 'Tạm dừng' };
function bindingLabel(action) { return BINDING_LABELS[action]; }
function keyLabel(code) { return ({ Space: 'Space', Escape: 'Esc', ShiftLeft: 'Shift trái', ShiftRight: 'Shift phải', ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→' })[code] ?? code.replace(/^Key/, '').replace(/^Digit/, ''); }
function renderBindings() {
  const host = $('bindingList');
  if (!host) return;
  host.replaceChildren();
  for (const [action, code] of Object.entries(bindings)) {
    const row = document.createElement('div'); row.className = 'binding-row';
    const label = document.createElement('span'); label.textContent = bindingLabel(action);
    const button = document.createElement('button'); button.type = 'button';
    button.textContent = bindingCapture === action ? 'Nhấn phím…' : keyLabel(code);
    button.setAttribute('aria-label', `Đổi phím ${bindingLabel(action)} (hiện ${keyLabel(code)})`);
    button.addEventListener('click', () => { bindingCapture = action; $('bindingMessage').textContent = `Nhấn phím mới cho ${bindingLabel(action)}; Esc để hủy.`; renderBindings(); });
    row.append(label, button); host.append(row);
  }
}

function loadSettings() {
  try {
    const data = JSON.parse(localStorage.getItem('dao-den-long-settings') ?? '{}');
    if (Number.isFinite(data.volume)) $('volume').value = String(Math.max(0, Math.min(100, data.volume)));
    if (Number.isFinite(data.sensitivity)) $('sensitivity').value = String(Math.max(20, Math.min(150, data.sensitivity)));
    if (data.bindings && Object.keys(DEFAULT_BINDINGS).every((action) => typeof data.bindings[action] === 'string')) bindings = { ...data.bindings };
    $('reduceMotion').checked = data.reduceMotion === true;
    $('largeText').checked = data.largeText === true;
    $('colorblindPalette').checked = data.colorblindPalette === true;
  } catch { /* storage is optional */ }
  document.body.classList.toggle('reduce-motion', $('reduceMotion').checked);
  document.documentElement.classList.toggle('large-text', $('largeText').checked);
  applyVisualSettings();
  renderBindings();
  updateSettingsLabels();
}
function getSensitivity() { return Number($('sensitivity').value) / 30000; }
function saveSettings() {
  try {
    localStorage.setItem('dao-den-long-settings', JSON.stringify({ volume: Number($('volume').value), sensitivity: Number($('sensitivity').value), bindings, reduceMotion: $('reduceMotion').checked, largeText: $('largeText').checked, colorblindPalette: $('colorblindPalette').checked }));
  } catch { /* storage is optional */ }
  updateSettingsLabels();
  sound.setVolume(Number($('volume').value) / 100);
}
for (const id of ['volume', 'sensitivity']) $(id).addEventListener('input', saveSettings);
$('reduceMotion').addEventListener('change', () => { document.body.classList.toggle('reduce-motion', $('reduceMotion').checked); saveSettings(); });
$('largeText').addEventListener('change', () => { document.documentElement.classList.toggle('large-text', $('largeText').checked); saveSettings(); });
$('colorblindPalette').addEventListener('change', () => { applyVisualSettings(); saveSettings(); });
function applyVisualSettings() {
  const enabled = !BENCH_MODE && $('colorblindPalette')?.checked === true;
  document.body.classList.toggle('colorblind', enabled);
  shadeMaterial.color.setHex(enabled ? 0x00b3ff : COLORS.shade);
  shadeMaterial.emissive.setHex(enabled ? 0x00b3ff : COLORS.shadeEdge);
  shadeEyeMaterial.color.setHex(enabled ? 0x00b3ff : 0xc6a5ff);
}
function updateSettingsLabels() {
  $('volumeValue').value = `${$('volume').value}%`;
  $('sensitivityValue').value = `${$('sensitivity').value}%`;
}

async function refreshLeaderboard() {
  try {
    const response = await fetch('/api/leaderboard', { cache: 'no-store' });
    if (!response.ok) throw new Error('Không đọc được bảng xếp hạng');
    leaderboardEntries = rankEntries((await response.json()).entries ?? []);
  } catch {
    leaderboardEntries = [];
  }
}
async function showLeaderboard() {
  await refreshLeaderboard();
  const host = $('leaderboardContent'); host.replaceChildren();
  if (!leaderboardEntries.length) {
    const empty = document.createElement('p'); empty.textContent = 'Chưa có điểm được lưu trên thiết bị này.'; host.append(empty);
  } else {
    const table = document.createElement('table'); table.className = 'leaderboard-list';
    const head = document.createElement('thead'); head.innerHTML = '<tr><th>#</th><th>Tên</th><th>Điểm</th><th>Đêm</th></tr>';
    const body = document.createElement('tbody');
    leaderboardEntries.forEach((entry, index) => {
      const row = document.createElement('tr');
      for (const value of [index + 1, entry.name, entry.score.toLocaleString('vi-VN'), entry.nights_won]) {
        const cell = document.createElement('td'); cell.textContent = String(value); row.append(cell);
      }
      body.append(row);
    });
    table.append(head, body); host.append(table);
  }
  openPanel('leaderboardPanel');
}
async function saveScore() {
  const name = $('playerName').value.trim().normalize('NFC');
  if (!validLeaderboardName(name)) { $('scoreMessage').textContent = 'Tên cần 3–12 ký tự chữ Latin (có thể dùng dấu), số hoặc gạch dưới.'; return; }
  const entry = {
    name, score: totalScore,
    nights_won: Math.max(0, Math.min(3, currentNight - (game?.state === 'won' ? 0 : 1))),
    achieved_at: new Date().toISOString(), seed: runSeed,
  };
  try {
    const response = await fetch('/api/leaderboard', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ entry }) });
    if (!response.ok) throw new Error('Không thể lưu');
    leaderboardEntries = rankEntries((await response.json()).entries ?? []);
    $('scoreMessage').textContent = 'Đã lưu điểm trên thiết bị này.';
    $('scoreForm').hidden = true;
  } catch {
    $('scoreMessage').textContent = 'Chưa lưu được. Hãy chạy game bằng npm start rồi thử lại.';
  }
}
$('scoreForm').addEventListener('submit', (event) => { event.preventDefault(); saveScore(); });

const sound = {
  context: null, master: null, drone: null, droneGain: null,
  ensure() {
    if (!this.context) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) return;
      this.context = new AudioContextClass();
      this.master = this.context.createGain();
      this.master.gain.value = Number($('volume').value) / 100;
      this.master.connect(this.context.destination);
    }
    if (this.context.state === 'suspended') this.context.resume();
  },
  setVolume(value) {
    this.ensure();
    if (this.master && this.context) this.master.gain.setTargetAtTime(value, this.context.currentTime, 0.04);
  },
  startNight(night) {
    this.ensure();
    if (!this.context || this.drone) return;
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.value = [55, 49, 42][night - 1];
    gain.gain.value = 0.035;
    oscillator.connect(gain);
    gain.connect(this.master);
    oscillator.start();
    this.drone = oscillator;
    this.droneGain = gain;
  },
  stopNight() {
    if (!this.drone || !this.context) return;
    const oscillator = this.drone;
    this.droneGain.gain.setTargetAtTime(0, this.context.currentTime, 0.12);
    oscillator.stop(this.context.currentTime + 0.5);
    this.drone = null;
    this.droneGain = null;
  },
  tone(frequency, duration = 0.16, type = 'sine', volume = 0.16, endFrequency = frequency) {
    this.ensure();
    if (!this.context || !this.master) return;
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    const now = this.context.currentTime;
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, now);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(30, endFrequency), now + duration);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(volume, now + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    oscillator.connect(gain);
    gain.connect(this.master);
    oscillator.start(now);
    oscillator.stop(now + duration + 0.02);
  },
  play(name) {
    const cues = {
      pickup: [880, 0.12, 'sine', 0.12, 1320],
      lantern: [392, 0.38, 'sine', 0.22, 880],
      pulse: [540, 0.24, 'triangle', 0.16, 120],
      hit: [170, 0.3, 'sawtooth', 0.12, 65],
      jump: [270, 0.14, 'triangle', 0.08, 420],
      dash: [620, 0.17, 'sawtooth', 0.1, 230],
      win: [440, 0.6, 'sine', 0.2, 990],
      loss: [220, 0.65, 'triangle', 0.16, 75],
      shade: [190, 0.33, 'sine', 0.1, 125],
      wind: [360, 0.45, 'triangle', 0.08, 120],
      countdown: [760, 0.11, 'sine', 0.08, 620],
      steal: [330, 0.23, 'triangle', 0.13, 185],
      charm: [740, 0.35, 'sine', 0.14, 1240],
    };
    if (cues[name]) this.tone(...cues[name]);
  },
};

loadSettings();

function showToast(message, duration = 1900) {
  $('toast').textContent = message;
  $('toast').classList.add('show');
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => $('toast').classList.remove('show'), duration);
}

function openPanel(panelId) {
  for (const section of document.querySelectorAll('#screen > .panel')) section.hidden = section.id !== panelId;
  $('screen').classList.add('visible');
  requestAnimationFrame(() => $(panelId).querySelector('button')?.focus());
}
function closePanel() { $('screen').classList.remove('visible'); }

function makeSeed() {
  const array = new Uint32Array(1);
  if (globalThis.crypto?.getRandomValues) globalThis.crypto.getRandomValues(array);
  else array[0] = Math.floor(Math.random() * 0x7fffffff);
  return array[0] || 1;
}

function beginJourney() {
  sound.ensure();
  runSeed = makeSeed();
  totalScore = 0;
  currentNight = 1;
  openNightIntro(1);
}
function openNightIntro(night) {
  currentNight = night;
  $('introEyebrow').textContent = `Đêm ${night} · ${ISLANDS[night]}`;
  $('introTitle').textContent = ISLANDS[night];
  $('introStory').textContent = STORIES[night];
  openPanel('introPanel');
}
function startNight(night) {
  currentNight = night;
  sound.stopNight();
  game = BENCH_MODE
    ? new Game({ seed: Number(benchQuery.get('seed')) || 42, night: 1, scenario: makeBenchmarkScenario(Number(benchQuery.get('seed')) || 42) })
    : new Game({ seed: (runSeed + night * 9973) >>> 0, night });
  resultHandled = false;
  started = true;
  document.body.classList.add('in-game');
  acc = 0;
  lastCountdown = null;
  lastWarningTick = -1;
  pulseAge = 99;
  makeWorld(night);
  cameraYaw = 0;
  if (!BENCH_MODE) sound.startNight(night);
  closePanel();
  updateHud();
}

function showSettings() {
  const visiblePanel = document.querySelector('#screen.visible > .panel:not([hidden])');
  previousSettingsPanel = visiblePanel?.id ?? 'menuPanel';
  openPanel('settingsPanel');
}
function settingsBack() {
  openPanel(previousSettingsPanel);
}
function restartNight() {
  if (!game) return startNight(currentNight);
  startNight(currentNight);
}
function goToMenu() {
  started = false;
  document.body.classList.remove('in-game');
  sound.stopNight();
  openPanel('menuPanel');
}
function continueNight() {
  if (!game) return;
  started = true;
  pauseRequest = true;
  closePanel();
}

function handleAction(action) {
  switch (action) {
    case 'start': beginJourney(); break;
    case 'play-night': startNight(currentNight); break;
    case 'settings': showSettings(); break;
    case 'settings-back': settingsBack(); break;
    case 'leaderboard': showLeaderboard(); break;
    case 'leaderboard-back': openPanel('menuPanel'); break;
    case 'reset-bindings': bindings = { ...DEFAULT_BINDINGS }; bindingCapture = null; $('bindingMessage').textContent = 'Đã khôi phục phím mặc định.'; keys.clear(); saveSettings(); renderBindings(); break;
    case 'continue': continueNight(); break;
    case 'restart': restartNight(); break;
    case 'menu': goToMenu(); break;
    case 'next-night': openNightIntro(currentNight + 1); break;
  }
}
document.querySelectorAll('[data-action]').forEach((button) => button.addEventListener('click', () => handleAction(button.dataset.action)));

function handleGameOver() {
  if (resultHandled || !game || !game.result) return;
  resultHandled = true;
  started = false;
  document.body.classList.remove('in-game');
  lastNightScore = game.score;
  if (game.state === 'won') totalScore += game.score;
  sound.stopNight();
  if (game.state === 'won') sound.play('win'); else sound.play('loss');
  $('resultEyebrow').textContent = `Kết quả Đêm ${currentNight} · ${ISLANDS[currentNight]}`;
  $('nightScore').textContent = game.score.toLocaleString('vi-VN');
  $('totalScore').textContent = totalScore.toLocaleString('vi-VN');
  $('scoreForm').hidden = !(game.state === 'lost' || currentNight === 3);
  $('scoreMessage').textContent = '';
  $('playerName').value = '';
  const actions = $('resultActions');
  actions.replaceChildren();
  if (game.state === 'lost') {
    $('resultTitle').textContent = 'Bình minh đã tới';
    $('resultText').textContent = game.result.reason === 'no_flames'
      ? 'Ngọn Lửa của Mây đã tắt. Hãy thử lại đêm này.'
      : 'Đêm khép lại khi những chiếc đèn vẫn còn tối. Mây có thể thử lại.';
    addAction(actions, 'Chơi lại Đêm này', 'restart', true);
  } else if (currentNight < 3) {
    $('resultTitle').textContent = 'Đèn đảo đã sáng';
    $('resultText').textContent = `Mây đã giữ được ánh sáng cho ${ISLANDS[currentNight]}. Một hòn đảo khác đang chờ.`;
    addAction(actions, `Tiếp tục đến Đêm ${currentNight + 1}`, 'next-night', true);
  } else {
    $('resultEyebrow').textContent = 'Mây đã đi qua ba đêm';
    $('resultTitle').textContent = 'Bình minh';
    $('resultText').textContent = 'Chuông vang lên giữa những hòn đảo sáng đèn. Tổng điểm là thành quả của các đêm Mây chiến thắng.';
    $('nightScore').textContent = game.score.toLocaleString('vi-VN');
    $('totalScore').textContent = totalScore.toLocaleString('vi-VN');
    addAction(actions, 'Chơi lại từ Đêm 1', 'start', true);
  }
  addAction(actions, 'Về menu', 'menu');
  openPanel('resultPanel');
}
function addAction(parent, label, action, primary = false) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = `action${primary ? ' primary' : ''}`;
  button.textContent = label;
  button.dataset.action = action;
  button.addEventListener('click', () => handleAction(action));
  parent.append(button);
}

function handleEvents(events) {
  for (const event of events) {
    switch (event.name) {
      case 'night_start': showToast(`Đêm ${event.data.night} · ${ISLANDS[event.data.night]}`); sound.startNight(event.data.night); break;
      case 'mote_picked': sound.play('pickup'); break;
      case 'charm_picked': sound.play('charm'); showToast('Bùa Gió: lướt sẵn sàng · chạy nhanh hơn'); break;
      case 'deposit': showToast(`Đã nạp ${event.data.amount} đom đóm vào ${event.data.lantern_id}`); break;
      case 'lantern_lit': sound.play('lantern'); showToast(`${event.data.lantern_id} đã sáng`); break;
      case 'pulse': sound.play('pulse'); pulseAge = 0; pulseHeight = game?.player.pos[1] ?? 0; break;
      case 'dash': sound.play('dash'); break;
      case 'player_hit': sound.play('hit'); if (event.data.by === 'fall') showToast(`Mây rơi mất ${event.data.lost} đom đóm`); break;
      case 'shade_spawned': sound.play('shade'); showToast('Bóng Mực đang tới'); break;
      case 'drifter_steal': sound.play('steal'); showToast(`Gió Lạc lấy ${event.data.amount} đom đóm`); break;
      case 'drifter_drop': showToast('Gió Lạc làm rơi đom đóm đã cướp'); break;
      case 'paused': started = true; $('pauseNight').textContent = `Đêm ${currentNight} đang tạm dừng`; openPanel('pausePanel'); break;
      case 'resumed': closePanel(); break;
      case 'game_over': handleGameOver(); break;
    }
  }
}

function updateHud() {
  if (!game) return;
  const p = game.player;
  $('nightLabel').textContent = `Đêm ${game.night}`;
  $('flames').replaceChildren();
  for (let i = 0; i < TUNING.flames; i++) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 20 24');
    svg.setAttribute('class', `flame${i < p.flames ? ' on' : ''}`);
    svg.setAttribute('aria-hidden', 'true');
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', 'M10 1C8 7 2 9 3 16a7 7 0 0 0 14 0c0-4-2-7-5-10 0 4-1 6-3 7 1-5 1-8 1-12Z');
    path.setAttribute('fill', 'currentColor');
    svg.append(path);
    $('flames').append(svg);
  }
  $('carried').textContent = `${p.carried}/${TUNING.carry_capacity}`;
  $('lit').textContent = `${game.lanterns.filter((l) => l.lit).length}/${game.lanterns.length}`;
  $('score').textContent = game.score.toLocaleString('vi-VN');
  const time = Math.max(0, game.timeLeft);
  $('time').textContent = clockText(time);
  $('timerChip').setAttribute('aria-live', time <= 10 ? 'polite' : 'off');
  $('timerChip').classList.toggle('alarm', time <= 30);
  $('pulse').textContent = p.pulseCdTicks > 0
    ? `${(p.pulseCdTicks / TICK_RATE).toFixed(1)} giây`
    : p.carried >= TUNING.pulse_cost ? 'Sẵn sàng' : 'Cần 3 đom đóm';
  $('dash').textContent = '';
  $('dashStatus').textContent = p.charmTicks > 0 ? 'Không hồi chiêu' : p.dashCdTicks > 0 ? `${(p.dashCdTicks / TICK_RATE).toFixed(1)} giây` : 'Sẵn sàng';
  const cells = $('moteCells');
  if (cells.children.length !== TUNING.carry_capacity) {
    cells.replaceChildren();
    for (let i = 0; i < TUNING.carry_capacity; i++) {
      const cell = document.createElement('span');
      cell.className = 'mote-cell';
      cells.append(cell);
    }
  }
  [...cells.children].forEach((cell, index) => cell.classList.toggle('on', index < p.carried));

  const lowFuel = game.lanterns.some((lantern) => lantern.lit && lantern.fuel < TUNING.low_fuel_threshold);
  $('fuelCue').hidden = !lowFuel;
  if (lowFuel && !lastLowFuelCue) showToast('Có đèn dưới 30 nhiên liệu');
  lastLowFuelCue = lowFuel;

  const near = [...game.lanterns]
    .filter((l) => !l.lit && Math.hypot(l.pos[0] - p.pos[0], l.pos[1] - p.pos[1], l.pos[2] - p.pos[2]) <= TUNING.interact_radius)
    .sort((a, b) => Math.hypot(a.pos[0] - p.pos[0], a.pos[1] - p.pos[1], a.pos[2] - p.pos[2]) - Math.hypot(b.pos[0] - p.pos[0], b.pos[1] - p.pos[1], b.pos[2] - p.pos[2]) || a.id.localeCompare(b.id))[0];
  if (near) {
    $('prompt').textContent = `E — Nạp ánh sáng (${p.carried}/${TUNING.lantern_cost}) · ${near.id} ${near.deposited}/${TUNING.lantern_cost}`;
    $('prompt').style.display = 'block';
  } else {
    $('prompt').style.display = 'none';
  }
  updateTargetArrow();
}

function updateTargetArrow() {
  if (!game || !started) { $('targetArrow').style.display = 'none'; $('shadeCue').hidden = true; $('shadeArrow').style.display = 'none'; return; }
  const p = game.player;
  const nearestShade = game.shades.filter((shade) => !['stunned', 'spawning'].includes(shade.state))
    .sort((a, b) => Math.hypot(a.pos[0] - p.pos[0], a.pos[2] - p.pos[2]) - Math.hypot(b.pos[0] - p.pos[0], b.pos[2] - p.pos[2]))[0];
  $('shadeCue').hidden = !nearestShade;
  if (nearestShade) {
    const shadePoint = new THREE.Vector3(nearestShade.pos[0], nearestShade.pos[1] + 1, nearestShade.pos[2]).project(camera);
    const outside = Math.abs(shadePoint.x) > 0.82 || Math.abs(shadePoint.y) > 0.82 || shadePoint.z > 1;
    const arrow = $('shadeArrow'); arrow.style.display = outside ? 'block' : 'none';
    if (outside) {
      const x = shadePoint.x * (shadePoint.z > 1 ? -1 : 1);
      const y = -shadePoint.y * (shadePoint.z > 1 ? -1 : 1);
      arrow.style.left = `${Math.min(innerWidth - 28, Math.max(28, innerWidth * (0.5 + x * 0.42)))}px`;
      arrow.style.top = `${Math.min(innerHeight - 28, Math.max(28, innerHeight * (0.5 + y * 0.42)))}px`;
      arrow.style.transform = `translate(-50%, -50%) rotate(${Math.atan2(y, x) * 180 / Math.PI + 90}deg)`;
    }
  } else $('shadeArrow').style.display = 'none';
  const target = [...game.lanterns].filter((l) => !l.lit)
    .sort((a, b) => Math.hypot(a.pos[0] - p.pos[0], a.pos[1] - p.pos[1], a.pos[2] - p.pos[2]) - Math.hypot(b.pos[0] - p.pos[0], b.pos[1] - p.pos[1], b.pos[2] - p.pos[2]) || a.id.localeCompare(b.id))[0];
  if (!target) { $('targetArrow').style.display = 'none'; return; }
  camera.updateMatrixWorld();
  const point = new THREE.Vector3(target.pos[0], target.pos[1] + 3.5, target.pos[2]).project(camera);
  let x = point.x;
  let y = -point.y;
  if (point.z > 1) { x *= -1; y *= -1; }
  const offscreen = Math.abs(point.x) > 0.82 || Math.abs(point.y) > 0.82 || point.z > 1;
  $('targetArrow').style.display = offscreen ? 'flex' : 'none';
  if (offscreen) $('targetArrow').style.transform = `rotate(${Math.atan2(y, x) * 180 / Math.PI + 90}deg)`;
}

function updateScene(now, dt) {
  if (!game) return;
  const p = game.player;
  may.position.set(p.pos[0], p.pos[1], p.pos[2]);
  may.rotation.y = p.facing;
  may.visible = document.body.classList.contains('reduce-motion') || !(p.invulnTicks > 0 && Math.floor(now * 10) % 2 === 0);
  playerGlow.position.set(p.pos[0], p.pos[1] + 1.3, p.pos[2]);

  const lit = game.lanterns.filter((l) => l.lit).length;
  const progress = game.lanterns.length ? lit / game.lanterns.length : 0;
  ambient.intensity = 0.15 + 0.55 * progress;
  scene.background.copy(skyColor).lerp(litSky, progress);
  scene.fog.color.copy(scene.background);
  for (const ground of groundMaterials) ground.color.setHex(COLORS.grass).lerp(new THREE.Color(0x5c7952), progress);

  for (const lantern of game.lanterns) {
    const view = lanternViews.get(lantern.id);
    if (!view) continue;
    const fill = lantern.lit ? 1 : lantern.deposited / TUNING.lantern_cost;
    const lowFuel = lantern.lit && lantern.fuel < TUNING.low_fuel_threshold;
    const blink = lowFuel && Math.floor(now * 2) % 2 === 0;
    view.shell.scale.y = lantern.lit ? 1.1 : 0.88;
    view.tear.visible = !lantern.lit;
    view.shellMaterial.emissiveIntensity = lantern.lit ? (blink ? 0.25 : 2.1 + 0.18 * Math.sin(now * 2.4)) : 0.03 + fill * 0.9;
    view.light.intensity = lantern.lit ? (blink ? 6 : 24) : 0;
    view.ring.material.opacity = lantern.lit ? (blink ? 0.08 : 0.26) : 0;
  }

  if (BENCH_MODE) {
    benchMoteInstances.count = game.motes.length;
    game.motes.forEach((mote, index) => {
      benchInstanceObject.position.set(mote.pos[0], mote.pos[1] + 0.5 + Math.sin(now * 2.6 + index) * 0.12, mote.pos[2]);
      benchInstanceObject.scale.setScalar(1);
      benchInstanceObject.updateMatrix();
      benchMoteInstances.setMatrixAt(index, benchInstanceObject.matrix);
    });
    benchMoteInstances.instanceMatrix.needsUpdate = true;
    benchShadeBodyInstances.count = game.shades.length;
    benchShadeEyeLeftInstances.count = game.shades.length;
    benchShadeEyeRightInstances.count = game.shades.length;
    game.shades.forEach((shade, index) => {
      const bob = Math.sin(now * 3.3 + shade.pos[0]) * 0.12;
      benchInstanceObject.position.set(shade.pos[0], shade.pos[1] + bob, shade.pos[2]);
      benchInstanceObject.scale.set(1, 1.22, 0.88);
      benchInstanceObject.updateMatrix();
      benchShadeBodyInstances.setMatrixAt(index, benchInstanceObject.matrix);
      benchInstanceObject.scale.setScalar(1);
      benchInstanceObject.position.set(shade.pos[0] - 0.22, shade.pos[1] + bob + 0.08, shade.pos[2] + 0.72);
      benchInstanceObject.updateMatrix();
      benchShadeEyeLeftInstances.setMatrixAt(index, benchInstanceObject.matrix);
      benchInstanceObject.position.x = shade.pos[0] + 0.22;
      benchInstanceObject.updateMatrix();
      benchShadeEyeRightInstances.setMatrixAt(index, benchInstanceObject.matrix);
    });
    for (const instances of [benchShadeBodyInstances, benchShadeEyeLeftInstances, benchShadeEyeRightInstances]) instances.instanceMatrix.needsUpdate = true;
  } else {
    syncViews(moteViews, game.motes, () => makeMote());
    for (const mote of game.motes) {
      const view = moteViews.get(mote.id);
      view.position.set(mote.pos[0], mote.pos[1] + 0.5 + Math.sin(now * 2.6 + Number(mote.id.slice(1))) * 0.12, mote.pos[2]);
      const mesh = view.children[0];
      mesh.material = mote.kind === 'dropped' ? droppedMaterial : moteMaterial;
      if (mote.kind === 'dropped') view.intensity = Math.max(0.1, 0.65 * Math.min(1, mote.ttl_s / 1.5));
    }
    syncViews(shadeViews, game.shades, () => makeShade());
    for (const shade of game.shades) {
      const view = shadeViews.get(shade.id);
      view.position.set(shade.pos[0], shade.pos[1] + Math.sin(now * 3.3 + shade.pos[0]) * 0.12, shade.pos[2]);
      const body = view.children.find((child) => child.isMesh && child.geometry === shadeGeo);
      if (body) body.material = shade.state === 'stunned' ? stunMaterial : shadeMaterial;
      view.scale.setScalar(shade.state === 'spawning' ? 0.65 + 0.35 * Math.sin(now * 10) ** 2 : 1 + 0.045 * Math.sin(now * 5));
    }
  }

  syncViews(drifterViews, game.drifters, () => makeDrifter());
  for (const drifter of game.drifters) {
    const view = drifterViews.get(drifter.id);
    view.position.set(drifter.pos[0], drifter.pos[1] + 0.75 + Math.sin(now * 4 + Number(drifter.id.slice(1))) * 0.2, drifter.pos[2]);
    view.rotation.set(Math.sin(now * 0.7) * 0.18, now * 0.7, Math.cos(now * 0.6) * 0.14);
    view.scale.setScalar(drifter.state === 'flee' ? 0.8 : 1);
  }
  syncViews(charmViews, game.charms.filter((charm) => charm.available), () => makeCharm());
  for (const charm of game.charms) {
    const view = charmViews.get(charm.id);
    if (view) {
      view.position.set(charm.pos[0], charm.pos[1] + 0.75 + Math.sin(now * 3 + Number(charm.id.slice(1))) * 0.12, charm.pos[2]);
      view.rotation.y = now * 0.9;
    }
  }

  carriedLights.forEach((light, i) => {
    light.visible = i < p.carried;
    if (light.visible) {
      const angle = now * 1.8 + (i * Math.PI * 2) / Math.max(1, p.carried);
      light.position.set(p.pos[0] + 0.75 * Math.sin(angle), p.pos[1] + 1.15 + Math.sin(now * 4 + i) * 0.08, p.pos[2] + 0.75 * Math.cos(angle));
    }
  });

  pulseAge += dt;
  const pulseProgress = Math.min(1, pulseAge / 0.42);
  pulseFx.scale.setScalar(0.15 + pulseProgress * TUNING.pulse_radius);
  pulseFx.position.set(p.pos[0], p.pos[1] + pulseHeight + 0.04, p.pos[2]);
  pulseFx.material.opacity = pulseAge < 0.42 ? 0.85 * (1 - pulseProgress) : 0;

  const forwardX = Math.sin(cameraYaw);
  const forwardZ = Math.cos(cameraYaw);
  camera.position.set(p.pos[0] - forwardX * 9, p.pos[1] + 5.5, p.pos[2] - forwardZ * 9);
  camera.lookAt(p.pos[0] + forwardX * 1.4, p.pos[1] + 1.15, p.pos[2] + forwardZ * 1.4);
  camera.updateMatrixWorld();
}

function updateWindCue() {
  if (!game || currentNight !== 3) { $('windCue').hidden = true; return; }
  const simTick = game.steps;
  const remainder = simTick % TUNING.wind_interval_ticks;
  const warning = remainder >= TUNING.wind_interval_ticks - TUNING.wind_warning_ticks && remainder < TUNING.wind_interval_ticks;
  const cue = $('windCue');
  cue.hidden = !(warning || game.wind.active);
  cue.classList.toggle('warning', warning);
  $('windCueText').textContent = warning ? 'Gió sắp nổi' : 'Gió đang đẩy Mây';
  if (warning && remainder === TUNING.wind_interval_ticks - TUNING.wind_warning_ticks && simTick !== lastWarningTick) {
    lastWarningTick = simTick;
    sound.play('wind');
  }
}

function frame(nowMs) {
  requestAnimationFrame(frame);
  const frameInterval = Math.max(0, (nowMs - lastFrame) / 1000);
  const dt = Math.min(0.1, frameInterval);
  lastFrame = nowMs;
  const now = nowMs / 1000;

  if (keys.has('ArrowLeft')) cameraYaw += dt * 1.8;
  if (keys.has('ArrowRight')) cameraYaw -= dt * 1.8;

  if (BENCH_MODE && started && game && game.state === 'playing') {
    acc += dt;
    while (acc >= STEP) { game.step(); game.drainEvents(); acc -= STEP; }
  } else if (started && game && game.state === 'playing') {
    acc += dt;
    while (acc >= STEP) {
      const before = game.timeLeft;
      game.step(readInput());
      handleEvents(game.drainEvents());
      acc -= STEP;
      if (game.state === 'playing' && !game.paused) {
        const seconds = Math.ceil(game.timeLeft);
        if (seconds <= 10 && seconds > 0 && seconds !== lastCountdown) {
          lastCountdown = seconds;
          sound.play('countdown');
        }
      }
      if (game.state !== 'playing') break;
      if (game.paused) break;
      if (before <= 0) break;
    }
  }

  if (game) {
    updateScene(now, dt);
    if (BENCH_MODE) {
      if (benchLoadMs === null) {
        benchLoadMs = performance.now();
        benchStartedAt = nowMs;
      }
      const elapsed = Math.max(0, (nowMs - benchStartedAt) / 1000);
      const angle = (elapsed * Math.PI * 2) / 15;
      camera.position.set(30 * Math.cos(angle), 15, 30 * Math.sin(angle));
      camera.lookAt(0, 0, 0);
      camera.updateMatrixWorld();
      if (elapsed >= 3 && elapsed < 3 + BENCH_DURATION && frameInterval > 0) benchDeltas.push(frameInterval * 1000);
      if (!benchComplete && elapsed >= 3 + BENCH_DURATION) {
        benchComplete = true;
        const ordered = [...benchDeltas].sort((a, b) => a - b);
        const slowCount = Math.max(1, Math.ceil(ordered.length * 0.01));
        const slowMean = ordered.slice(-slowCount).reduce((sum, value) => sum + value, 0) / slowCount;
        const debug = renderer.getContext().getExtension('WEBGL_debug_renderer_info');
        const result = {
          contract_version: '1.3',
          avg_fps: Number((1000 * ordered.length / Math.max(1e-9, ordered.reduce((sum, value) => sum + value, 0))).toFixed(1)),
          p1_low_fps: Number((1000 / slowMean).toFixed(1)),
          frame_ms_p95: Number(ordered[Math.max(0, Math.ceil(ordered.length * 0.95) - 1)]?.toFixed(2) ?? 0),
          frames: ordered.length,
          load_ms: Math.round(benchLoadMs),
          peak_mem_mb: null,
          vsync_off: true,
          renderer: `Three.js r${THREE.REVISION} · ${debug ? renderer.getContext().getParameter(debug.UNMASKED_RENDERER_WEBGL) : renderer.getContext().getParameter(renderer.getContext().RENDERER)}`,
          os: navigator.userAgent,
        };
        window.__benchResult = result;
        window.dispatchEvent(new CustomEvent('benchmark-complete', { detail: result }));
      }
    }
    updateHud();
    updateWindCue();
  } else {
    const t = now;
    camera.position.set(0, 5.5, -9);
    camera.lookAt(0, 1, 0);
    camera.position.x = Math.sin(t * 0.08) * 0.8;
  }
  renderer.render(scene, camera);

  if (dt > 0) {
    fpsSamples.push(1 / dt);
    if (fpsSamples.length > 120) fpsSamples.shift();
    if (fpsSamples.length >= 30) $('fps').textContent = `FPS TB ${Math.round(fpsSamples.reduce((a, b) => a + b, 0) / fpsSamples.length)}`;
  }
}
requestAnimationFrame(frame);

makeWorld(1);
document.addEventListener('keydown', (event) => {
  if (event.code === 'Escape' && !bindingCapture && $('screen').classList.contains('visible') && !$('settingsPanel').hidden) {
    event.preventDefault();
    event.stopPropagation();
    settingsBack();
    return;
  }
  if (event.code === bindings.jump && !event.repeat && started && game && !game.paused) sound.play('jump');
});

if (BENCH_MODE) {
  $('screen').classList.remove('visible');
  startNight(1);
  started = true;
}
