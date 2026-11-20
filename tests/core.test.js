import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { Game, DEFAULT_INPUT } from '../src/core/game.js';
import { TUNING } from '../src/core/config.js';
import { CONTRACT } from '../scripts/gen-contract.mjs';

const T = TUNING;
const calm = { random_motes: false, random_shades: false, motes: [], shades: [] };
const inp = (o = {}) => ({ ...DEFAULT_INPUT, ...o });
const run = (g, n, input = inp()) => {
  for (let i = 0; i < n; i++) g.step(input);
};
const names = (g) => g.drainEvents().map((e) => e.name);

test('game.contract.json khớp src/core/config.js', () => {
  const file = JSON.parse(readFileSync(new URL('../game.contract.json', import.meta.url), 'utf8'));
  assert.deepEqual(file, JSON.parse(JSON.stringify(CONTRACT)));
});

test('src/core không dùng nguồn ngẫu nhiên/thời gian ngoài seed', () => {
  const dir = new URL('../src/core/', import.meta.url);
  for (const f of readdirSync(dir)) {
    const src = readFileSync(new URL(f, dir), 'utf8');
    assert.ok(!/Math\.random|Date\.now|performance\.now/.test(src), `${f} dùng nguồn không tất định`);
  }
});

test('mặc định: 5 đèn L1..L5, L1 ở (0,0,25), người chơi ở gốc', () => {
  const s = new Game({ seed: 1 }).snapshot();
  assert.deepEqual(s.lanterns.map((l) => l.id), ['L1', 'L2', 'L3', 'L4', 'L5']);
  assert.deepEqual(s.lanterns[0].pos, [0, 0, 25]);
  assert.deepEqual(s.player.pos, [0, 0, 0]);
  assert.equal(s.player.flames, T.flames);
  assert.equal(s.time_left_s, T.night1_duration_s);
  assert.equal(s.motes_active, 40);
  assert.equal(s.shades.length, 2);
});

test('di chuyển: move [0,1] yaw 0 trong 120 tick -> z = 12', () => {
  const g = new Game({ seed: 1, scenario: calm });
  run(g, 120, inp({ move: [0, 1] }));
  assert.deepEqual(g.snapshot().player.pos, [0, 0, 12]);
  assert.equal(g.snapshot().time_left_s, 298);
});

test('di chuyển: yaw 90 độ biến move [0,1] thành +X; vector > 1 được chuẩn hóa', () => {
  const g = new Game({ seed: 1, scenario: calm });
  run(g, 60, inp({ move: [0, 1], cam_yaw_deg: 90 }));
  assert.deepEqual(g.snapshot().player.pos, [6, 0, 0]);
  const h = new Game({ seed: 1, scenario: calm });
  run(h, 60, inp({ move: [1, 1] }));
  const [x, , z] = h.player.pos;
  assert.ok(Math.abs(Math.hypot(x, z) - 6) < 1e-9);
});

test('đảo có mép: không đi ra ngoài bán kính 40 m (fall_enabled = false)', () => {
  const g = new Game({ seed: 1, scenario: calm });
  run(g, 60 * 20, inp({ move: [0, 1] }));
  assert.ok(Math.hypot(g.player.pos[0], g.player.pos[2]) <= 40 + 1e-9);
  assert.ok(!names(g).includes('player_hit'));
});

test('nhảy: chỉ kích hoạt ở cạnh lên, rồi rơi về Y = 0', () => {
  const g = new Game({ seed: 1, scenario: calm });
  g.step(inp({ jump: true }));
  assert.ok(g.player.pos[1] > 0);
  run(g, 60, inp({ jump: true })); // giữ nút: không nhảy lại
  assert.equal(g.player.pos[1], 0);
});

test('nhặt đom đóm: trong bán kính (<= r) thì nhặt, ngoài thì không', () => {
  const g = new Game({ seed: 1, scenario: { ...calm, motes: [[0, 0, T.pickup_radius], [0, 0, 1.5]] } });
  g.step(inp());
  const ev = g.drainEvents();
  assert.equal(ev.length, 1);
  assert.deepEqual(ev[0], { type: 'event', tick: 1, name: 'mote_picked', data: { carried: 1 } });
  assert.equal(g.score, T.score.per_mote);
  assert.equal(g.snapshot().motes_active, 1);
});

test('nhặt đom đóm: không vượt carry_capacity', () => {
  const g = new Game({ seed: 1, scenario: { ...calm, player: { carried: T.carry_capacity }, motes: [[0, 0, 0]] } });
  g.step(inp());
  assert.equal(g.player.carried, T.carry_capacity);
  assert.equal(g.snapshot().motes_active, 1);
});

test('nạp đèn: deposit rồi lantern_lit khi đủ lantern_cost; nút interact theo cạnh lên', () => {
  const sc = { ...calm, player: { pos: [0, 0, 23], carried: 3 } };
  const g = new Game({ seed: 1, scenario: sc });
  g.step(inp({ interact: true }));
  assert.deepEqual(g.drainEvents().map((e) => [e.name, e.data]), [['deposit', { lantern_id: 'L1', amount: 3, deposited: 3 }]]);
  g.step(inp({ interact: true })); // vẫn giữ: không nạp lại
  assert.equal(g.drainEvents().length, 0);
  g.player.carried = 4;
  g.step(inp({ interact: false }));
  g.step(inp({ interact: true }));
  const ev = g.drainEvents();
  assert.deepEqual(ev.map((e) => e.name), ['deposit', 'lantern_lit']);
  assert.deepEqual(ev[0].data, { lantern_id: 'L1', amount: 2, deposited: 5 });
  assert.equal(g.player.carried, 2);
  assert.equal(g.score, T.score.per_lantern);
});

test('nạp đèn: ngoài interact_radius thì không có gì', () => {
  const g = new Game({ seed: 1, scenario: { ...calm, player: { pos: [0, 0, 22.4], carried: 3 } } });
  g.step(inp({ interact: true }));
  assert.equal(g.drainEvents().length, 0);
});

test('tỏa sáng: tốn pulse_cost, choáng + đẩy Bóng Mực trong bán kính, có hồi chiêu', () => {
  const sc = { ...calm, player: { carried: 2 }, shades: [{ id: 'S1', pos: [3, 1, 0] }, { id: 'S2', pos: [20, 1, 0] }] };
  const g = new Game({ seed: 1, scenario: sc });
  g.step(inp({ pulse: true }));
  const ev = g.drainEvents();
  assert.deepEqual(ev.map((e) => [e.name, e.data]), [['pulse', { stunned_ids: ['S1'] }]]);
  const s = g.snapshot();
  assert.equal(s.player.carried, 1);
  assert.equal(s.shades[0].state, 'stunned');
  assert.equal(s.shades[0].pos[0], 3 + T.pulse_push_m);
  assert.equal(g.score, T.score.per_stun);
  g.step(inp({ pulse: false }));
  g.step(inp({ pulse: true })); // đang hồi chiêu
  assert.equal(g.drainEvents().length, 0);
  run(g, Math.round(T.pulse_stun_s * 60) - 3, inp());
  assert.equal(g.snapshot().shades[0].state, 'stunned');
  run(g, 1, inp());
  assert.equal(g.snapshot().shades[0].state, 'chase');
});

test('tỏa sáng: không đủ đom đóm thì không kích hoạt', () => {
  const g = new Game({ seed: 1, scenario: { ...calm, shades: [{ pos: [3, 1, 0] }] } });
  g.step(inp({ pulse: true }));
  assert.equal(g.drainEvents().length, 0);
});

test('bị chạm: mất 1 lửa, rơi floor(carried * ratio), bất tử invuln_s', () => {
  const sc = { ...calm, player: { carried: 5 }, shades: [{ id: 'S1', pos: [0.5, 1, 0] }] };
  const g = new Game({ seed: 1, scenario: sc });
  g.step(inp());
  assert.deepEqual(g.drainEvents().map((e) => [e.name, e.data]), [['player_hit', { by: 'shade', flames: 2, dropped: 2 }]]);
  assert.equal(g.player.carried, 3);
  run(g, Math.round(T.invuln_s * 60) - 1, inp());
  assert.equal(g.drainEvents().length, 0);
  g.step(inp());
  assert.equal(g.drainEvents()[0].name, 'player_hit');
});

test('hết lửa -> thua no_flames', () => {
  const g = new Game({ seed: 1, scenario: { ...calm, player: { flames: 1 }, shades: [{ pos: [0, 1, 0.5] }] } });
  g.step(inp());
  assert.deepEqual(names(g), ['player_hit', 'game_over']);
  assert.equal(g.state, 'lost');
  assert.deepEqual(g.result, { result: 'lost', reason: 'no_flames' });
});

test('safe_radius: Bóng Mực không vào vùng quanh đèn đã thắp', () => {
  const sc = { ...calm, player: { pos: [0, 0, 24] }, lanterns: [{ id: 'L1', lit: true }], shades: [{ pos: [0, 1, 10] }] };
  const g = new Game({ seed: 1, scenario: sc });
  run(g, 600, inp());
  const d = Math.hypot(g.shades[0].pos[0], g.shades[0].pos[2] - 25);
  assert.ok(d >= T.safe_radius - 1e-9);
  assert.ok(!names(g).includes('player_hit'));
});

test('hết giờ -> thua dawn đúng tick', () => {
  const g = new Game({ seed: 1, scenario: { ...calm, time_left_s: 1 } });
  run(g, 59);
  assert.equal(g.state, 'playing');
  g.step(inp());
  assert.equal(g.state, 'lost');
  assert.deepEqual(g.drainEvents().at(-1), { type: 'event', tick: 60, name: 'game_over', data: { result: 'lost', reason: 'dawn' } });
});

test('thắp đèn cuối -> thắng all_lit, cộng thưởng thời gian và lửa', () => {
  const lit = ['L2', 'L3', 'L4', 'L5'].map((id) => ({ id, lit: true }));
  const sc = { ...calm, player: { pos: [0, 0, 24], carried: 5 }, lanterns: lit, time_left_s: 100 };
  const g = new Game({ seed: 1, scenario: sc });
  assert.equal(g.score, 0); // dựng scenario không cộng điểm
  g.step(inp({ interact: true }));
  assert.deepEqual(names(g), ['deposit', 'lantern_lit', 'game_over']);
  assert.equal(g.state, 'won');
  const expected = T.score.per_lantern + Math.floor(100 - 1 / 60) * T.score.per_second_left + 3 * T.score.per_flame_left;
  assert.equal(g.score, expected);
});

test('sinh Bóng Mực mỗi 30 s, có sự kiện shade_spawned, tối đa 5 con', () => {
  const g = new Game({ seed: 3, scenario: { random_motes: false, motes: [], player: { flames: 99 } } });
  const spawned = [];
  for (let i = 0; i < 60 * 200; i++) {
    g.step(inp());
    for (const e of g.drainEvents()) if (e.name === 'shade_spawned') spawned.push([e.tick, e.data.id]);
  }
  assert.deepEqual(spawned, [[1800, 'S3'], [3600, 'S4'], [5400, 'S5']]);
  assert.equal(g.shades.length, 5);
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
