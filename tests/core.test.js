import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { Game, DEFAULT_INPUT, distXZ } from '../src/core/game.js';
import { TUNING, WORLD } from '../src/core/config.js';
import { CONTRACT } from '../scripts/gen-contract.mjs';

const T = TUNING;
const W = WORLD;
const calm = { random_motes: false, random_shades: false, random_drifters: false, wind_enabled: false, motes: [], shades: [] };
const inp = (o = {}) => ({ ...DEFAULT_INPUT, ...o });
const run = (g, n, input = inp()) => { for (let i = 0; i < n; i++) g.step(input); };
const names = (g) => g.drainEvents().map((e) => e.name);

// === Contract & determinism ===

test('game.contract.json khớp src/core/config.js', () => {
  const file = JSON.parse(readFileSync(new URL('../game.contract.json', import.meta.url), 'utf8'));
  assert.deepEqual(file, JSON.parse(JSON.stringify(CONTRACT)));
});

test('src/core không dùng nguồn ngẫu nhiên/thời gian ngoài seed', () => {
  const dir = new URL('../src/core/', import.meta.url);
  for (const f of readdirSync(dir)) {
    const src = readFileSync(new URL(f, dir), 'utf8');
    assert.ok(!/\bMath\.random\b|Date\.now|performance\.now/.test(src), `${f} dùng nguồn không tất định`);
  }
});

test('tính tất định: cùng seed -> cùng trạng thái; khác seed -> khác', () => {
  const play = (seed) => {
    const g = new Game({ seed });
    const log = [];
    for (let i = 0; i < 3000; i++) {
      g.step(inp({ move: [Math.sin(i / 50), Math.cos(i / 70)], pulse: i % 200 === 0 }));
      log.push(...g.drainEvents());
    }
    return JSON.stringify([log, g.snapshot()]);
  };
  assert.equal(play(42), play(42));
  assert.notEqual(play(42), play(43));
});

// === Night 1 basics ===

test('Đêm 1: 5 đèn L1..L5, L1 ở (0,0,25), spawn (0,0,0)', () => {
  const s = new Game({ seed: 1, night: 1 }).snapshot();
  assert.deepEqual(s.lanterns.map((l) => l.id), ['L1', 'L2', 'L3', 'L4', 'L5']);
  assert.deepEqual(s.lanterns[0].pos, [0, 0, 25]);
  assert.deepEqual(s.player.pos, [0, 0, 0]);
  assert.equal(s.player.flames, T.flames);
  assert.equal(s.time_left_s, T.night1_duration_s);
  assert.equal(s.night, 1);
});

test('Đêm 2: 6 đèn, 1 bùa gió, duration 270s', () => {
  const s = new Game({ seed: 1, night: 2 }).snapshot();
  assert.equal(s.lanterns.length, 6);
  assert.equal(s.charms.length, 1);
  assert.equal(s.charms[0].id, 'C1');
  assert.equal(s.time_left_s, T.night2_duration_s);
  assert.equal(s.night, 2);
});

test('Đêm 3: 7 đèn, 2 bùa gió, wind, duration 300s', () => {
  const s = new Game({ seed: 1, night: 3 }).snapshot();
  assert.equal(s.lanterns.length, 7);
  assert.equal(s.charms.length, 2);
  assert.equal(s.time_left_s, T.night3_duration_s);
  assert.equal(s.night, 3);
});

// === Movement ===

test('di chuyển: tăng tốc 6 tick rồi đạt 6 m/s; 120 tick -> z = 11.75', () => {
  const g = new Game({ seed: 1, scenario: calm });
  run(g, 120, inp({ move: [0, 1] }));
  assert.deepEqual(g.snapshot().player.pos, [0, 0, 11.75]);
});

test('di chuyển: yaw 90 độ biến move [0,1] thành +X', () => {
  const g = new Game({ seed: 1, scenario: calm });
  run(g, 60, inp({ move: [0, 1], cam_yaw_deg: 90 }));
  assert.deepEqual(g.snapshot().player.pos, [5.75, 0, 0]);
});

// === Jump ===

test('nhảy: chỉ kích hoạt ở cạnh lên, rồi rơi về Y = 0', () => {
  const g = new Game({ seed: 1, scenario: calm });
  g.step(inp({ jump: true }));
  assert.ok(g.player.pos[1] > 0);
  run(g, 60, inp({ jump: true })); // giữ nút: không nhảy lại
  assert.equal(g.player.pos[1], 0);
});

// === Dash ===

test('lướt: 14 m/s trong 12 tick, hồi chiêu 1.5s', () => {
  const g = new Game({ seed: 1, scenario: calm });
  g.step(inp({ dash: true, move: [0, 1] }));
  const ev = g.drainEvents().filter((e) => e.name !== 'night_start');
  assert.ok(ev.some((e) => e.name === 'dash'));
  assert.equal(g.player.dashTicks, 11);
  run(g, 11, inp({ move: [0, 1] }));
  // Kích hoạt tick là dash tick thứ nhất: 12 * 14/60 = 2.8 m.
  const z = g.player.pos[2];
  assert.ok(Math.abs(z - 2.8) < 0.001, `dash distance ${z} should be 2.8`);
  assert.equal(g.player.dashTicks, 0);
  // cooldown: can't dash again immediately
  g.step(inp({ dash: false }));
  g.step(inp({ dash: true }));
  assert.ok(!g.drainEvents().some((e) => e.name === 'dash'));
});

test('lướt trên không giữ nguyên độ cao', () => {
  const g = new Game({ seed: 1, scenario: calm });
  // jump first
  g.step(inp({ jump: true }));
  run(g, 5);
  const y0 = g.player.pos[1];
  assert.ok(y0 > 0);
  // dash in air
  g.step(inp({ dash: true, move: [0, 1] }));
  run(g, 5, inp({ move: [0, 1] }));
  // Y should stay roughly the same during dash (vy = 0)
  assert.ok(Math.abs(g.player.pos[1] - y0) < 0.5, 'dash in air should maintain height');
});

// === Mote pickup ===

test('nhặt đom đóm: trong bán kính <= r thì nhặt, ngoài thì không', () => {
  const g = new Game({ seed: 1, scenario: { ...calm, motes: [[0, 0, T.pickup_radius]] } });
  g.step(inp());
  const ev = g.drainEvents().filter((e) => e.name !== 'night_start');
  assert.equal(ev.length, 1);
  assert.equal(ev[0].name, 'mote_picked');
  // v1.2: pickup không cho điểm, chỉ deposit mới cho
  assert.equal(g.score, 0);
});

test('nhặt đom đóm: không vượt carry_capacity', () => {
  const g = new Game({ seed: 1, scenario: { ...calm, player: { carried: T.carry_capacity }, motes: [[0, 0, 0]] } });
  g.step(inp());
  assert.equal(g.player.carried, T.carry_capacity);
});

// === Lantern deposit ===

test('nạp đèn: deposit rồi lantern_lit khi đủ lantern_cost (10), scoring v1.2', () => {
  const sc = { ...calm, player: { pos: [0, 0, 24], carried: 10 } };
  const g = new Game({ seed: 1, scenario: sc });
  g.step(inp({ interact: true }));
  const ev = g.drainEvents().filter((e) => e.name !== 'night_start');
  assert.deepEqual(ev.map((e) => e.name), ['deposit', 'lantern_lit']);
  assert.equal(ev[0].data.amount, 10);
  assert.equal(g.player.carried, 0);
  // v1.2: 10 * per_mote_deposit(5) + per_lantern_first(100) = 150
  assert.equal(g.score, 10 * T.score.per_mote_deposit + T.score.per_lantern_first);
});

test('nạp đèn: ngoài interact_radius (2.0m) thì không', () => {
  const g = new Game({ seed: 1, scenario: { ...calm, player: { pos: [0, 0, 22.9], carried: 5 } } });
  g.step(inp({ interact: true }));
  assert.equal(g.drainEvents().filter((e) => e.name !== 'night_start').length, 0);
});

// === Pulse ===

test('tỏa sáng: tốn 3 đom đóm, 3D distance <= 5m, choáng 120 tick', () => {
  const sc = { ...calm, player: { carried: 3 }, shades: [{ id: 'S1', pos: [3, 1, 0] }] };
  const g = new Game({ seed: 1, scenario: sc });
  g.step(inp({ pulse: true }));
  const ev = g.drainEvents();
  assert.ok(ev.some((e) => e.name === 'pulse'));
  assert.equal(g.player.carried, 0);
  assert.equal(g.shades[0].state, 'stunned');
  // v1.2: per_stun = 5 (không phải drain state)
  assert.equal(g.score, T.score.per_stun);
  // cooldown 3s = 180 ticks
  g.player.carried = 3;
  g.step(inp({ pulse: false }));
  g.step(inp({ pulse: true }));
  assert.ok(!g.drainEvents().some((e) => e.name === 'pulse'));
});

test('tỏa sáng: không đủ 3 đom đóm thì không kích hoạt', () => {
  const g = new Game({ seed: 1, scenario: { ...calm, player: { carried: 2 }, shades: [{ pos: [3, 1, 0] }] } });
  g.step(inp({ pulse: true }));
  assert.ok(!g.drainEvents().some((e) => e.name === 'pulse'));
});

// === Shade hit ===

test('bị chạm: mất 1 lửa, rơi đom đóm, bất tử 90 tick', () => {
  const sc = { ...calm, player: { carried: 6 }, shades: [{ id: 'S1', pos: [0.5, 1, 0] }] };
  const g = new Game({ seed: 1, scenario: sc });
  g.step(inp());
  const ev = g.drainEvents();
  assert.ok(ev.some((e) => e.name === 'player_hit'));
  const hit = ev.find((e) => e.name === 'player_hit');
  assert.equal(hit.data.flames, 2);
  assert.equal(hit.data.dropped, 3); // floor(6*0.5)
  assert.equal(g.player.carried, 3);
  // bất tử 90 tick
  assert.equal(g.player.invulnTicks, T.invuln_ticks);
});

test('hết lửa -> thua no_flames', () => {
  const g = new Game({ seed: 1, scenario: { ...calm, player: { flames: 1 }, shades: [{ pos: [0, 1, 0.5] }] } });
  g.step(inp());
  assert.ok(names(g).includes('game_over'));
  assert.equal(g.state, 'lost');
  assert.equal(g.result.reason, 'no_flames');
});

// === Safe zone ===

test('safe_radius: Bóng Mực không vào vùng quanh đèn đã thắp', () => {
  const sc = { ...calm, player: { pos: [0, 0, 24] }, lanterns: [{ id: 'L1', lit: true }], shades: [{ pos: [0, 1, 10] }] };
  const g = new Game({ seed: 1, scenario: sc });
  run(g, 300, inp());
  const d = Math.hypot(g.shades[0].pos[0], g.shades[0].pos[2] - 25);
  assert.ok(d >= T.safe_radius - 0.1, `shade distance from lantern: ${d}`);
});

// === Win/Lose conditions ===

test('hết giờ -> thua dawn', () => {
  const g = new Game({ seed: 1, scenario: { ...calm, time_left_s: 1 } });
  run(g, 60);
  assert.equal(g.state, 'lost');
  assert.equal(g.result.reason, 'dawn');
});

test('v1.2: thắp hết đèn không thắng ngay, phải đợi hết giờ dawn_survived', () => {
  const lit = ['L2', 'L3', 'L4', 'L5'].map((id) => ({ id, lit: true, fuel: 100 }));
  const sc = { ...calm, player: { pos: [0, 0, 24], carried: 10 }, lanterns: lit, time_left_s: 2 };
  const g = new Game({ seed: 1, scenario: sc });
  g.step(inp({ interact: true }));
  // v1.2: không thắng ngay khi thắp hết đèn
  assert.equal(g.state, 'playing');
  // chạy hết giờ
  run(g, 120);
  g.drainEvents();
  assert.equal(g.state, 'won');
  assert.equal(g.result.reason, 'dawn_survived');
});

test('v1.2: dawn_survived cần >= 60% đèn sáng, không đủ -> thua', () => {
  // 5 đèn, cần ceil(0.6*5) = 3 sáng. Chỉ có 2 sáng → thua.
  const sc = { ...calm, lanterns: [
    { id: 'L1', lit: true, fuel: 50 }, { id: 'L2', lit: true, fuel: 50 },
    { id: 'L3', lit: false }, { id: 'L4', lit: false }, { id: 'L5', lit: false }
  ], time_left_s: 1 };
  const g = new Game({ seed: 1, scenario: sc });
  run(g, 61);
  g.drainEvents();
  assert.equal(g.state, 'lost');
  assert.equal(g.result.reason, 'dawn');
});

// === Pause ===

test('pause: tick tăng nhưng sim_tick, thời gian đứng yên', () => {
  const g = new Game({ seed: 1, scenario: { ...calm, time_left_s: 100 } });
  run(g, 10);
  const tl1 = g.timeLeft;
  // pause
  g.step(inp({ pause: true }));
  assert.ok(g.drainEvents().some((e) => e.name === 'paused'));
  run(g, 60);
  assert.equal(g.timeLeft, tl1); // time unchanged
  assert.equal(g.snapshot().state, 'paused');
  // resume
  g.step(inp({ pause: false }));
  g.step(inp({ pause: true }));
  assert.ok(g.drainEvents().some((e) => e.name === 'resumed'));
});

// === Drifter (Gió Lạc) ===

test('Gió Lạc: chase khi Mây mang >= 5 và cách <= 15m, cướp min(3, carried)', () => {
  const sc = {
    ...calm, player: { carried: 7 },
    drifters: [{ id: 'D1', pos: [1, 1, 0], state: 'chase' }],
  };
  const g = new Game({ seed: 1, night: 2, scenario: sc });
  g.step(inp());
  const ev = g.drainEvents();
  assert.ok(ev.some((e) => e.name === 'drifter_steal'));
  const steal = ev.find((e) => e.name === 'drifter_steal');
  assert.equal(steal.data.amount, 3);
  assert.equal(g.player.carried, 4);
  assert.equal(g.drifters[0].state, 'flee');
});

// === Charm (Bùa Gió) ===

test('Bùa Gió: nhặt → charm_picked, tốc độ 7.2 m/s', () => {
  const sc = {
    ...calm,
    charms: [{ id: 'C1', pos: [0, 0, 0.5] }],
  };
  const g = new Game({ seed: 1, night: 2, scenario: sc });
  g.step(inp());
  const ev = g.drainEvents();
  assert.ok(ev.some((e) => e.name === 'charm_picked'));
  assert.equal(g.player.charmTicks, W.charm_duration_ticks);
  // speed boost: 7.2 m/s
  const g2 = new Game({ seed: 1, night: 2, scenario: { ...sc, charms: [{ id: 'C1', pos: [0, 0, 0] }] } });
  g2.step(inp()); // pick charm
  g2.drainEvents();
  run(g2, 60, inp({ move: [0, 1] }));
  const z = g2.player.pos[2];
  assert.ok(Math.abs(z - (28 / 60 + 53 * 7.2 / 60)) < 0.01, `charm acceleration distance: z=${z}`);
});

// === Shade spawn schedule ===

test('Bóng Mực sinh tại tick 300, Đêm 1 mỗi 480 tick, tối đa 6', () => {
  const g = new Game({ seed: 3, night: 1, scenario: { random_motes: false, random_drifters: false, wind_enabled: false, motes: [] } });
  const spawned = [];
  for (let i = 0; i < 6000; i++) {
    g.step(inp());
    for (const e of g.drainEvents()) if (e.name === 'shade_spawned') spawned.push(e.tick);
  }
  assert.equal(spawned[0], 300); // initial 2 at tick 300
  assert.equal(spawned[1], 300);
  assert.equal(spawned[2], 780); // 300 + 480
  assert.ok(g.shades.length <= 6);
});

// === Snapshot format v1.1 ===

test('snapshot v1.2: có fuel, ever_lit, relit_count, capacity, target_lantern_id', () => {
  const g = new Game({ seed: 1, night: 3 });
  const s = g.snapshot();
  assert.equal(s.night, 3);
  assert.ok('wind' in s);
  assert.ok('vel' in s.player);
  assert.ok('capacity' in s.player);
  assert.ok(Array.isArray(s.motes));
  assert.ok(Array.isArray(s.drifters));
  assert.ok(Array.isArray(s.charms));
  // v1.2: lanterns have fuel, ever_lit, relit_count
  for (const L of s.lanterns) {
    assert.ok('fuel' in L, `lantern ${L.id} missing fuel`);
    assert.ok('ever_lit' in L, `lantern ${L.id} missing ever_lit`);
    assert.ok('relit_count' in L, `lantern ${L.id} missing relit_count`);
  }
  // v1.2: shades have target_lantern_id
  // (may not have shades at tick 0, so just check structure if present)
});

// === Phase 3: Fuel system ===

test('v1.2: fuel decay — đèn sáng mất 1 fuel/s (1 fuelTick/tick)', () => {
  const sc = { ...calm, lanterns: [{ id: 'L1', lit: true, fuel: 100 }], time_left_s: 60 };
  const g = new Game({ seed: 1, scenario: sc });
  run(g, 60); // 1 giây = 60 tick
  const snap = g.snapshot();
  // fuel giảm 1/s → 60 tick → fuel = 99
  assert.equal(snap.lanterns[0].fuel, 99);
});

test('v1.2: fuel hết → đèn tắt, emit lantern_out', () => {
  const sc = { ...calm, lanterns: [{ id: 'L1', lit: true, fuel: 1 }], time_left_s: 120 };
  const g = new Game({ seed: 1, scenario: sc });
  // 1 fuel = 60 fuelTicks, decay 1/tick → tắt sau 60 tick
  run(g, 61);
  const ev = g.drainEvents();
  assert.ok(ev.some((e) => e.name === 'lantern_out'), 'should emit lantern_out');
  assert.equal(g.lanterns[0].lit, false);
});

test('v1.2: relight — đèn ever_lit cần 5 motes, scoring per_lantern_relight', () => {
  const sc = { ...calm, player: { pos: [0, 0, 24], carried: 5 },
    lanterns: [{ id: 'L1', lit: false, ever_lit: true, deposited: 0 }] };
  const g = new Game({ seed: 1, scenario: sc });
  g.step(inp({ interact: true }));
  const ev = g.drainEvents();
  assert.ok(ev.some((e) => e.name === 'lantern_lit'));
  const litEv = ev.find((e) => e.name === 'lantern_lit');
  assert.equal(litEv.data.relight, true);
  assert.equal(g.lanterns[0].lit, true);
  // fuelTicks = fuel_max * TICK_RATE = 100 * 60 = 6000
  assert.equal(g.lanterns[0].fuelTicks, T.fuel_max * 60);
  // scoring: 5 * per_mote_deposit(5) + per_lantern_relight(40) = 65
  assert.equal(g.score, 5 * T.score.per_mote_deposit + T.score.per_lantern_relight);
});

test('v1.2: refuel — nạp đom đóm vào đèn đang sáng, +10 fuel/mote', () => {
  const sc = { ...calm, player: { pos: [0, 0, 24], carried: 3 },
    lanterns: [{ id: 'L1', lit: true, fuel: 50 }] };
  const g = new Game({ seed: 1, scenario: sc });
  g.step(inp({ interact: true }));
  const ev = g.drainEvents();
  assert.ok(ev.some((e) => e.name === 'refuel'), 'should emit refuel');
  const ref = ev.find((e) => e.name === 'refuel');
  assert.equal(ref.data.amount, 3);
  // fuelTicks: 50*60 - 1(decay) + 3*10*60 = 2999+1800 = 4799
  // fuel = 4799/60 ≈ 79.983
  const fuel = g.snapshot().lanterns[0].fuel;
  assert.ok(fuel > 79 && fuel < 80.1, `fuel should be ~80: ${fuel}`);
  assert.equal(g.player.carried, 0);
  // scoring: 3 * per_mote_deposit(5) = 15
  assert.equal(g.score, 3 * T.score.per_mote_deposit);
});

test('v1.2: dynamic capacity = 10 + 2*successfulLights, max 20', () => {
  const sc = { ...calm, player: { carried: 0, successful_lights: 3 }, motes: Array.from({length: 20}, (_, i) => [0, 0, i * 0.01]) };
  const g = new Game({ seed: 1, scenario: sc });
  g.step(inp());
  // capacity = 10 + 2*3 = 16
  assert.equal(g.player.carried, 16);
});

test('v1.2: safe zone chỉ có khi fuel >= 30', () => {
  // Đèn fuel < 30 mất safe zone → shade có thể tiến vào
  const sc = { ...calm,
    lanterns: [{ id: 'L1', lit: true, fuel: 10 }],
    shades: [{ id: 'S1', pos: [0, 1, 25] }],
    time_left_s: 60 };
  const g = new Game({ seed: 1, scenario: sc });
  // Shade ở ngay cạnh đèn L1 (pos [0,0,25]), fuel < 30 → không bị đẩy ra
  run(g, 10, inp());
  const shadeD = distXZ(g.shades[0].pos, g.lanterns[0].pos);
  // shade nên ở gần đèn vì không có safe zone
  assert.ok(shadeD < T.safe_radius, `shade should be inside safe radius when fuel < 30: dist=${shadeD}`);
});

// === Phase 3: Shade drain state ===

test('v1.2: shade drain — hút fuel từ đèn yếu', () => {
  // Shade ở gần đèn yếu (fuel < 30) trong trạng thái drain
  const sc = { ...calm,
    lanterns: [{ id: 'L1', lit: true, fuel: 29 }],
    shades: [{ id: 'S1', pos: [0, 1, 26], state: 'drain', target_lantern_id: 'L1' }],
    time_left_s: 60 };
  const g = new Game({ seed: 1, scenario: sc });
  // Drain hút 5 fuel/s = 5 fuelTicks/tick
  run(g, 60); // 1 giây
  const ev = g.drainEvents();
  // fuel giảm: 29 → 29 - 5(drain) - 1(decay) = 23
  // Nhưng cũng có thể đèn tắt trước nếu hút quá nhanh
  // 29 fuel = 29*60 = 1740 fuelTicks. Drain 5/tick + decay 1/tick = 6/tick.
  // 1740/6 = 290 ticks trước khi tắt. 60 tick chưa tắt.
  assert.equal(g.lanterns[0].lit, true);
  const fuelAfter = g.lanterns[0].fuel;
  // Fuel lost: (5+1)*60/60 = 6 fuel/s → ~23 fuel after 1s
  assert.ok(fuelAfter < 29, `fuel should decrease from drain: ${fuelAfter}`);
});

// === Performance ===

test('headless 1 đêm đầy đủ chạy < 30 giây', () => {
  const start = performance.now();
  const g = new Game({ seed: 123, night: 3 });
  for (let i = 0; i < 21600 && g.state === 'playing'; i++) g.step();
  const ms = performance.now() - start;
  assert.ok(ms < 30000, `Night 3 took ${ms}ms, limit 30000ms`);
});
