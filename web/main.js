// Phần hiển thị 3D. Mọi luật chơi nằm trong src/core/game.js (dùng chung với headless).
import * as THREE from 'three';
import { Game } from '../src/core/game.js';
import { TUNING, WORLD, TICK_RATE } from '../src/core/config.js';

const $ = (id) => document.getElementById(id);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
document.body.prepend(renderer.domElement);

const scene = new THREE.Scene();
const NIGHT = new THREE.Color(0x150c2a);
const WARM = new THREE.Color(0x3a2a52);
scene.background = NIGHT.clone();
scene.fog = new THREE.Fog(0x150c2a, 25, 95);
const camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 300);
addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

const hemi = new THREE.HemisphereLight(0x9a8ad0, 0x2a2040, 1.1);
scene.add(hemi);
const moon = new THREE.DirectionalLight(0xb9a8ff, 0.9);
moon.position.set(-30, 50, -20);
scene.add(moon);

// ---------- đảo và biển mây ----------
const groundMat = new THREE.MeshStandardMaterial({ color: 0x3a5048, roughness: 0.95 });
const island = new THREE.Mesh(new THREE.CylinderGeometry(WORLD.island_radius, WORLD.island_radius - 3, 3, 72), groundMat);
island.position.y = -1.5;
scene.add(island);
const rim = new THREE.Mesh(new THREE.TorusGeometry(WORLD.island_radius, 0.25, 8, 96), new THREE.MeshStandardMaterial({ color: 0x6a5a8a, emissive: 0x2a1a4a }));
rim.rotation.x = Math.PI / 2;
scene.add(rim);
const clouds = new THREE.Mesh(new THREE.CircleGeometry(260, 48), new THREE.MeshStandardMaterial({ color: 0x3b2e5e, roughness: 1 }));
clouds.rotation.x = -Math.PI / 2;
clouds.position.y = -6;
scene.add(clouds);
// vài tảng đá, cỏ trang trí (cố định, không ảnh hưởng luật chơi)
const deco = new THREE.MeshStandardMaterial({ color: 0x3d3550, roughness: 1 });
for (let i = 0; i < 30; i++) {
  const a = i * 2.399;
  const r = 8 + ((i * 37) % 29);
  const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(0.4 + (i % 4) * 0.25), deco);
  rock.position.set(r * Math.sin(a), 0.1, r * Math.cos(a));
  scene.add(rock);
}

// ---------- Mây: người giữ đèn đội nón lá ----------
function makeMay() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.42, 1.0, 16), new THREE.MeshStandardMaterial({ color: 0x4f7cc4 }));
  body.position.y = 0.6;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.3, 16, 12), new THREE.MeshStandardMaterial({ color: 0xf2cfa5 }));
  head.position.y = 1.35;
  const hat = new THREE.Mesh(new THREE.ConeGeometry(0.62, 0.38, 24), new THREE.MeshStandardMaterial({ color: 0xe8d29a }));
  hat.position.y = 1.72;
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.11, 12, 8), new THREE.MeshStandardMaterial({ color: 0xffb04a, emissive: 0xff8a1a, emissiveIntensity: 2 }));
  lamp.position.set(0.55, 1.42, 0);
  const string = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.2), new THREE.MeshBasicMaterial({ color: 0x5a4020 }));
  string.position.set(0.55, 1.6, 0);
  const light = new THREE.PointLight(0xffa040, 6, 10, 1.2);
  light.position.copy(lamp.position);
  g.add(body, head, hat, lamp, string, light);
  return g;
}
const may = makeMay();
scene.add(may);

// ---------- đèn lồng lớn ----------
const lanternViews = new Map();
function makeLantern() {
  const g = new THREE.Group();
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.2, 3.2, 10), new THREE.MeshStandardMaterial({ color: 0x5a3b28 }));
  post.position.y = 1.6;
  const shellMat = new THREE.MeshStandardMaterial({ color: 0x7a2a2a, emissive: 0xff7a20, emissiveIntensity: 0.05 });
  const shell = new THREE.Mesh(new THREE.SphereGeometry(0.75, 20, 14), shellMat);
  shell.scale.y = 1.2;
  shell.position.y = 3.7;
  const light = new THREE.PointLight(0xffa850, 0, 22, 1.4);
  light.position.y = 3.7;
  const ring = new THREE.Mesh(new THREE.RingGeometry(TUNING.safe_radius - 0.12, TUNING.safe_radius, 64), new THREE.MeshBasicMaterial({ color: 0xffb860, transparent: true, opacity: 0, side: THREE.DoubleSide }));
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.03;
  g.add(post, shell, light, ring);
  return { g, shellMat, light, ring };
}

// ---------- đom đóm và Bóng Mực ----------
const moteGeo = new THREE.SphereGeometry(0.16, 10, 8);
const moteMat = new THREE.MeshStandardMaterial({ color: 0xfff1a0, emissive: 0xffd040, emissiveIntensity: 2.5 });
const shadeGeo = new THREE.SphereGeometry(0.85, 18, 14);
const shadeMat = new THREE.MeshStandardMaterial({ color: 0x1a0828, emissive: 0x5a1a8a, emissiveIntensity: 0.6, roughness: 0.4 });
const stunMat = new THREE.MeshStandardMaterial({ color: 0x40406a, emissive: 0x8ab0ff, emissiveIntensity: 0.4 });
const moteViews = new Map();
const shadeViews = new Map();
// Sáng tạo (chỉ hiển thị): đom đóm Mây đang mang bay vòng quanh cô bé.
const orbit = [];
for (let i = 0; i < TUNING.carry_capacity; i++) {
  const m = new THREE.Mesh(moteGeo, moteMat);
  m.scale.setScalar(0.7);
  scene.add(m);
  orbit.push(m);
}
const pulseFx = new THREE.Mesh(new THREE.RingGeometry(0.9, 1, 48), new THREE.MeshBasicMaterial({ color: 0xffd080, transparent: true, opacity: 0, side: THREE.DoubleSide }));
pulseFx.rotation.x = -Math.PI / 2;
scene.add(pulseFx);
let pulseAge = 99;

function sync(map, list, make) {
  const seen = new Set();
  for (const it of list) {
    seen.add(it.id);
    if (!map.has(it.id)) {
      const v = make();
      scene.add(v);
      map.set(it.id, v);
    }
  }
  for (const [id, v] of map) if (!seen.has(id)) {
    scene.remove(v);
    map.delete(id);
  }
}

// ---------- điều khiển ----------
const keys = new Set();
let camYaw = 0;
let dragging = false;
addEventListener('keydown', (e) => {
  keys.add(e.code);
  if (e.code === 'KeyR') newGame();
  if (e.code === 'Space') e.preventDefault();
});
addEventListener('keyup', (e) => keys.delete(e.code));
addEventListener('blur', () => keys.clear());
renderer.domElement.addEventListener('mousedown', () => (dragging = true));
addEventListener('mouseup', () => (dragging = false));
addEventListener('mousemove', (e) => {
  if (dragging) camYaw -= e.movementX * 0.006;
});

function readInput() {
  let mx = 0;
  let mz = 0;
  if (keys.has('KeyW') || keys.has('ArrowUp')) mz += 1;
  if (keys.has('KeyS') || keys.has('ArrowDown')) mz -= 1;
  // camera nhìn theo +Z khi yaw = 0 thì +X nằm bên trái màn hình
  if (keys.has('KeyA')) mx += 1;
  if (keys.has('KeyD')) mx -= 1;
  return {
    move: [mx, mz],
    cam_yaw_deg: (camYaw * 180) / Math.PI,
    jump: keys.has('Space'),
    interact: keys.has('KeyE'),
    pulse: keys.has('KeyQ'),
  };
}

// ---------- vòng lặp ----------
let game;
let started = false;
function newGame() {
  game = new Game({ seed: (Date.now() & 0x7fffffff) >>> 0 });
  for (const v of lanternViews.values()) scene.remove(v.g);
  lanternViews.clear();
  for (const L of game.lanterns) {
    const v = makeLantern();
    v.g.position.set(L.pos[0], 0, L.pos[2]);
    scene.add(v.g);
    lanternViews.set(L.id, v);
  }
  $('overlay').style.display = 'none';
}
newGame();
$('start').addEventListener('click', () => {
  $('start').style.display = 'none';
  started = true;
});

const STEP = 1 / TICK_RATE;
let acc = 0;
let last = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  if (keys.has('ArrowLeft')) camYaw += 1.8 * dt;
  if (keys.has('ArrowRight')) camYaw -= 1.8 * dt;
  if (started && game.state === 'playing') {
    acc += dt;
    while (acc >= STEP) {
      game.step(readInput());
      for (const e of game.drainEvents()) if (e.name === 'pulse') pulseAge = 0;
      acc -= STEP;
    }
  }
  draw(now / 1000, dt);
}

function draw(t, dt) {
  const s = game;
  const p = s.player;
  may.position.set(p.pos[0], p.pos[1], p.pos[2]);
  may.rotation.y = p.facing;
  may.visible = !(p.invulnTicks > 0 && Math.floor(t * 10) % 2 === 0);

  let lit = 0;
  for (const L of s.lanterns) {
    const v = lanternViews.get(L.id);
    const k = L.lit ? 1 : L.deposited / TUNING.lantern_cost;
    v.shellMat.emissiveIntensity = L.lit ? 2.2 + 0.2 * Math.sin(t * 3) : 0.05 + 0.6 * k;
    v.light.intensity = L.lit ? 60 : 0;
    v.ring.material.opacity = L.lit ? 0.45 : 0;
    if (L.lit) lit++;
  }
  // Đảo sáng dần lên khi thắp đèn
  const glow = lit / s.lanterns.length;
  hemi.intensity = 1.1 + 1.2 * glow;
  scene.background.copy(NIGHT).lerp(WARM, glow);
  scene.fog.color.copy(scene.background);
  groundMat.color.setHex(0x3a5048).lerp(new THREE.Color(0x4f7a4a), glow);

  sync(moteViews, s.motes, () => new THREE.Mesh(moteGeo, moteMat));
  for (const m of s.motes) {
    const v = moteViews.get(m.id);
    const seed = Number(m.id.slice(1));
    v.position.set(m.pos[0], 0.5 + 0.25 * Math.sin(t * 2 + seed), m.pos[2]);
  }
  sync(shadeViews, s.shades, () => new THREE.Mesh(shadeGeo, shadeMat));
  for (const sh of s.shades) {
    const v = shadeViews.get(sh.id);
    v.position.set(sh.pos[0], sh.pos[1] + 0.15 * Math.sin(t * 4 + sh.pos[0]), sh.pos[2]);
    v.material = sh.state === 'stunned' ? stunMat : shadeMat;
    v.scale.setScalar(1 + 0.06 * Math.sin(t * 6));
  }
  orbit.forEach((m, i) => {
    m.visible = i < p.carried;
    const a = t * 2.2 + (i * Math.PI * 2) / Math.max(1, p.carried);
    m.position.set(p.pos[0] + 0.9 * Math.sin(a), p.pos[1] + 1.1 + 0.15 * Math.sin(t * 5 + i), p.pos[2] + 0.9 * Math.cos(a));
  });
  pulseAge += dt;
  const pr = Math.min(1, pulseAge / 0.4);
  pulseFx.scale.setScalar(0.1 + pr * TUNING.pulse_radius);
  pulseFx.material.opacity = pulseAge < 0.4 ? 0.8 * (1 - pr) : 0;
  pulseFx.position.set(p.pos[0], 0.1, p.pos[2]);

  // camera góc nhìn thứ ba
  const fx = Math.sin(camYaw);
  const fz = Math.cos(camYaw);
  camera.position.set(p.pos[0] - fx * 9, p.pos[1] + 5.5, p.pos[2] - fz * 9);
  camera.lookAt(p.pos[0] + fx * 2, p.pos[1] + 1.2, p.pos[2] + fz * 2);
  renderer.render(scene, camera);

  // HUD
  $('flames').textContent = '🔥'.repeat(p.flames) || '0';
  $('carried').textContent = `${p.carried}/${TUNING.carry_capacity}`;
  $('lit').textContent = `${lit}/${s.lanterns.length}`;
  const tl = Math.max(0, Math.ceil(s.timeLeft));
  $('time').textContent = `${Math.floor(tl / 60)}:${String(tl % 60).padStart(2, '0')}`;
  $('score').textContent = s.score;
  $('pulse').textContent = p.pulseCdTicks > 0 ? `${(p.pulseCdTicks / 60).toFixed(1)}s` : p.carried >= TUNING.pulse_cost ? 'sẵn sàng' : 'cần đom đóm';
  let prompt = '';
  const near = s.lanterns.find((L) => !L.lit && Math.hypot(L.pos[0] - p.pos[0], L.pos[2] - p.pos[2]) <= TUNING.interact_radius);
  if (near) prompt = p.carried > 0 ? `Bấm E để nạp đèn ${near.id} (${near.deposited}/${TUNING.lantern_cost})` : `Đèn ${near.id} cần ${TUNING.lantern_cost - near.deposited} đom đóm`;
  $('prompt').textContent = prompt;

  if (s.state !== 'playing') {
    $('overlay').style.display = 'flex';
    $('ovTitle').textContent = s.state === 'won' ? 'Đảo đã sáng trở lại!' : 'Mây đã thua…';
    const reasons = { all_lit: 'Cả 5 Đèn Lồng Lớn đều đã thắp.', dawn: 'Trời đã sáng mà đèn chưa thắp đủ.', no_flames: 'Bóng Mực đã dập hết lửa của Mây.' };
    $('ovReason').textContent = reasons[s.result.reason];
    $('ovScore').textContent = `Điểm: ${s.score}`;
  }
}
requestAnimationFrame(frame);
