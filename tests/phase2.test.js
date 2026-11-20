import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { Game, DEFAULT_INPUT } from '../src/core/game.js';
import { TUNING as T, TICK_RATE } from '../src/core/config.js';
import { CONTRACT } from '../scripts/gen-contract.mjs';

const quiet = {
  random_motes: false, random_shades: false, random_drifters: false,
  motes: [], shades: [], drifters: [],
};
const input = (v = {}) => ({ ...DEFAULT_INPUT, ...v });
const run = (g, n, v = input()) => { for (let i = 0; i < n; i++) g.step(v); };
const events = (g) => g.drainEvents().filter((e) => e.name !== 'night_start').map((e) => [e.tick, e.name, e.data]);
const near = (actual, expected, eps = 0.001) => assert.ok(Math.abs(actual - expected) <= eps, `${actual} != ${expected}`);

test('contract v1.1 khai báo đủ số chuẩn và game.contract.json khớp config', () => {
  const file = JSON.parse(readFileSync(new URL('../game.contract.json', import.meta.url), 'utf8'));
  assert.equal(CONTRACT.contract_version, '1.1');
  assert.deepEqual(file, JSON.parse(JSON.stringify(CONTRACT)));
  assert.equal(T.dash_speed, 14);
  assert.equal(T.dash_duration_s, 0.2);
  assert.equal(T.dash_cooldown_s, 1.5);
  assert.equal(T.night2_duration_s, 330);
  assert.equal(T.night3_duration_s, 360);
  assert.equal(T.lantern_cost, 10);
  assert.equal(T.pulse_cost, 3);
});

test('ba bản đồ có đúng đèn, thời lượng, điểm sinh và xuất phát chuẩn', () => {
  const n1 = new Game({ seed: 1, night: 1 }).snapshot();
  assert.deepEqual(n1.lanterns.map((l) => l.pos), [[0, 0, 25], [23.8, 0, 7.7], [14.7, 0, -20.2], [-14.7, 0, -20.2], [-23.8, 0, 7.7]]);
  assert.equal(n1.motes.length, 20);
  assert.equal(new Set(n1.motes.map((m) => m.pos.join(','))).size, 20);
  assert.equal(n1.shades.length, 0);

  const n2 = new Game({ seed: 2, night: 2 }).snapshot();
  assert.equal(n2.lanterns.length, 6);
  assert.equal(n2.motes.length, 20);
  assert.deepEqual(n2.lanterns[0].pos, [0, 0, 20]);
  assert.deepEqual(n2.lanterns[3].pos, [70, 0, 20]);
  assert.equal(n2.time_left_s, T.night2_duration_s);

  const n3 = new Game({ seed: 3, night: 3 }).snapshot();
  assert.equal(n3.lanterns.length, 7);
  assert.equal(n3.motes.length, 20);
  assert.deepEqual(n3.lanterns[0].pos, [0, 6, 6]);
  assert.equal(n3.time_left_s, T.night3_duration_s);
});

test('đi bộ đạt 6 m/s, nhảy dùng trọng lực chuẩn và lướt đúng 12 tick theo hướng mặt', () => {
  const g = new Game({ seed: 1, night: 1, scenario: quiet });
  run(g, 60, input({ move: [0, 1] }));
  near(g.player.pos[2], 5.75, 0.02); // gia tốc tối đa 0.1 s
  near(Math.hypot(g.player.vel[0], g.player.vel[2]), T.player_speed);

  const j = new Game({ seed: 1, scenario: quiet });
  j.step(input({ jump: true }));
  assert.ok(j.player.pos[1] > 0);
  near(j.player.vel[1], T.jump_speed + T.gravity / TICK_RATE);

  const d = new Game({ seed: 1, scenario: quiet });
  d.step(input({ dash: true }));
  assert.deepEqual(events(d), [[1, 'dash', {}]]);
  run(d, 11, input({ dash: true }));
  near(d.player.pos[2], 2.8);
  near(d.snapshot().player.dash_cd_s, 79 / TICK_RATE);
  assert.equal(d.snapshot().player.invuln, 0);
});

test('nhặt xét khoảng cách XZ và chênh cao tối đa 1.5 m', () => {
  const g = new Game({ seed: 1, scenario: {
    ...quiet,
    motes: [[0, 0, 1], [0, 1.5, 0], [0, 1.501, 0]],
  } });
  g.step(input());
  assert.deepEqual(events(g), [
    [1, 'mote_picked', { carried: 1 }],
    [1, 'mote_picked', { carried: 2 }],
  ]);
  assert.equal(g.player.carried, 2);
  assert.equal(g.motes.length, 1);
});

test('bị đánh làm rơi floor(carried/2) đom đóm với TTL 480 tick', () => {
  const g = new Game({ seed: 1, scenario: {
    ...quiet, player: { carried: 5 }, shades: [{ id: 'S1', pos: [0.5, 1, 0] }],
  } });
  g.step(input());
  assert.deepEqual(events(g), [[1, 'player_hit', { by: 'shade', flames: 2, dropped: 2 }]]);
  assert.equal(g.player.carried, 3);
  assert.equal(g.motes.filter((m) => m.kind === 'dropped').length, 2);
  assert.ok(g.motes.every((m) => m.ttlTicks === 480));
  assert.equal(g.snapshot().player.invuln, 1.5);
});

test('mỗi lần tương tác nạp một đèn chưa sáng gần nhất và chỉ phần còn thiếu', () => {
  const g = new Game({ seed: 4, scenario: {
    ...quiet,
    player: { pos: [0, 0, 23.5], carried: 10 },
    lanterns: [{ id: 'L1', deposited: 8 }],
  } });
  g.step(input({ interact: true }));
  assert.deepEqual(events(g).map((e) => e.slice(1)), [
    ['deposit', { lantern_id: 'L1', amount: 2, deposited: 10 }],
    ['lantern_lit', { lantern_id: 'L1' }],
  ]);
  assert.equal(g.player.carried, 8);
  assert.equal(g.score, T.score.per_mote * 0 + T.score.per_lantern);
});

test('pulse tốn 3, khóa mục tiêu 3D trong 5 m, làm choáng 120 tick và lùi tổng 4 m', () => {
  const g = new Game({ seed: 5, scenario: {
    ...quiet,
    player: { carried: 3 },
    shades: [
      { id: 'S1', pos: [0, 1, 4.9], state: 'wander' },
      { id: 'S2', pos: [0, 8, 0], state: 'stunned', state_ticks_left: 120 },
    ],
  } });
  const before = g.shades[0].pos[2];
  g.step(input({ pulse: true }));
  assert.deepEqual(events(g), [[1, 'pulse', { stunned_ids: ['S1'] }]]);
  assert.equal(g.player.carried, 0);
  assert.equal(g.shades[0].state, 'stunned');
  run(g, 14, input());
  near(g.shades[0].pos[2] - before, T.pulse_push_m); // push sums 4 m
  assert.equal(g.shades[0].stunTicks, 106);
  assert.equal(g.player.pulseCdTicks, 166);
});

test('Bóng Mực sinh hai con ở tick 300, sau đó mỗi 480 tick; theo dõi và recoil', () => {
  const g = new Game({ seed: 6, scenario: { ...quiet, random_shades: true, player: { flames: 99 } } });
  run(g, 299);
  assert.equal(g.shades.length, 0);
  g.step(input());
  assert.equal(g.shades.length, 2);
  assert.deepEqual(events(g).map((e) => [e[0], e[1]]), [[300, 'shade_spawned'], [300, 'shade_spawned']]);
  run(g, 479);
  assert.equal(g.shades.length, 2);
  g.step(input());
  assert.equal(g.shades.length, 3);
  assert.equal(g.shades[2].id, 'S3');
});

test('đảo Đêm 2 có cầu, bục phóng và đáp trên đảo B', () => {
  const g = new Game({ seed: 7, night: 2, scenario: { ...quiet, player: { pos: [20, 0, 18] } } });
  run(g, 85);
  near(g.player.pos[0], 54, 0.02);
  assert.equal(g.player.grounded, true);
  assert.equal(g.player.pos[1], 0);
  const bridge = new Game({ seed: 7, night: 2, scenario: { ...quiet, charms: [], player: { pos: [35, 0, 0] } } });
  run(bridge, 10, input({ move: [0, 1] }));
  near(bridge.player.pos[2], 0.75, 0.02);
});

test('Đêm 3 có dốc, bục lên tầng 2 và gió theo chu kỳ 30 s', () => {
  const g = new Game({ seed: 8, night: 3, scenario: { ...quiet, player: { pos: [0, 3, 13] } } });
  run(g, 90);
  near(g.player.pos[1], 6);
  assert.ok(Math.abs(g.player.pos[2]) <= 8);
  assert.equal(g.player.grounded, true);

  const w = new Game({ seed: 8, night: 3, scenario: { ...quiet } });
  run(w, 1800);
  assert.equal(w.snapshot().wind.active, true);
  assert.ok(w.snapshot().wind.dir_deg >= 0 && w.snapshot().wind.dir_deg < 360);
  assert.equal(w.snapshot().sim_tick, 1800);
});

test('Gió Lạc cướp tối đa 3; pulse lên flee làm rơi đom đóm đã cướp', () => {
  const g = new Game({ seed: 9, night: 2, scenario: {
    ...quiet,
    player: { carried: 5 },
    drifters: [{ id: 'D1', pos: [0, 0, 1.3], state: 'chase' }],
  } });
  g.step(input());
  assert.deepEqual(events(g), [[1, 'drifter_steal', { drifter_id: 'D1', amount: 3, carried: 2 }]]);
  assert.equal(g.drifters[0].state, 'flee');
  g.drifters[0].pos = [0, 0, 3];
  g.drifters[0].stolen = 3;
  g.player.carried = 3;
  g.player.pulseCdTicks = 0;
  g.step(input({ pulse: true }));
  assert.deepEqual(events(g).map((e) => e[1]), ['pulse', 'drifter_drop']);
  assert.equal(g.motes[0].kind, 'dropped');
  assert.equal(g.motes[0].ttlTicks, 480);
});

test('Bùa Gió tăng tốc và bỏ hồi dash; bùa hồi sinh sau 2700 simulation tick', () => {
  const g = new Game({ seed: 10, night: 2, scenario: { ...quiet, player: { pos: [35, 0, 0] } } });
  g.step(input());
  assert.deepEqual(events(g), [[1, 'charm_picked', { charm_id: 'C1', charm_ticks: 600 }]]);
  assert.equal(g.player.charmTicks, 600);
  assert.equal(g.snapshot().charms[0].available, false);
  g.player.dashCdTicks = 50;
  g.step(input({ dash: true }));
  assert.equal(g.player.dashCdTicks, 0);
  assert.equal(g.player.dashTicks, 11);

  const r = new Game({ seed: 10, night: 2, scenario: { ...quiet, player: { pos: [35, 0, 0] } } });
  r.step(input());
  run(r, 30, input({ move: [1, 0] }));
  run(r, 2670, input());
  assert.equal(r.charms[0].available, true);
});

test('pause dừng toàn bộ simulation; rơi phạt một lần rồi hồi sinh sau 60 tick', () => {
  const p = new Game({ seed: 11, scenario: { ...quiet, time_left_s: 10 } });
  p.step(input({ pause: true }));
  assert.equal(p.snapshot().state, 'paused');
  assert.equal(p.snapshot().tick, 1);
  assert.equal(p.snapshot().sim_tick, 0);
  near(p.timeLeft, 10);
  p.step(input({ pause: false }));
  p.step(input({ pause: true }));
  assert.equal(p.snapshot().state, 'playing');
  assert.equal(p.snapshot().sim_tick, 0);
  p.step(input({ pause: false }));
  assert.equal(p.snapshot().sim_tick, 1);

  const f = new Game({ seed: 12, scenario: { ...quiet, player: { pos: [0, -10.1, 0], carried: 4, flames: 2 } } });
  f.step(input());
  assert.deepEqual(events(f), [[1, 'player_hit', { by: 'fall', flames: 1, lost: 4 }]]);
  run(f, 60);
  assert.deepEqual(f.player.pos, [0, 0, 0]);
  assert.equal(f.player.invulnTicks, 90);
  assert.equal(f.player.flames, 1);
});

test('mọi night snapshot chứa trường bắt buộc và src/core không gọi đồng hồ hay RNG toàn cục', () => {
  const s = new Game({ seed: 13, night: 3 }).snapshot();
  assert.equal(s.night, 3);
  assert.deepEqual(s.wind, { active: false, dir_deg: 0 });
  assert.ok(Array.isArray(s.player.vel));
  for (const key of ['grounded', 'invuln', 'dash_cd_s', 'pulse_cd_s', 'charm_s']) assert.ok(key in s.player);
  for (const key of ['id', 'pos', 'kind', 'ttl_s']) assert.ok(key in s.motes[0]);
  assert.ok(Array.isArray(s.drifters));
  assert.ok(Array.isArray(s.charms));
  for (const f of readdirSync(new URL('../src/core/', import.meta.url))) {
    const src = readFileSync(new URL(f, new URL('../src/core/', import.meta.url)), 'utf8');
    assert.ok(!/Math\.random|Date\.now|performance\.now/.test(src), `${f} dùng nguồn không tất định`);
  }
});
