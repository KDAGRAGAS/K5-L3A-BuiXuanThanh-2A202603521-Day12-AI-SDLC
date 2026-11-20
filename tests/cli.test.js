import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const CLI = fileURLToPath(new URL('../src/headless/cli.js', import.meta.url));
const dir = mkdtempSync(join(tmpdir(), 'ddl-'));
const file = (name, obj) => {
  const p = join(dir, name);
  writeFileSync(p, typeof obj === 'string' ? obj : JSON.stringify(obj));
  return p;
};
const headless = (args) => spawnSync(process.execPath, [CLI, ...args], { encoding: 'utf8' });
const readLines = (p) => readFileSync(p, 'utf8').trim().split('\n').map((l) => JSON.parse(l));

const inputs = file('inputs.json', {
  frames: [
    { tick: 0, move: [0, 1], cam_yaw_deg: 0 },
    { tick: 120, move: [0, 0], interact: true },
    { tick: 121, interact: false },
  ],
});
const scenario = file('scenario.json', { random_motes: false, random_shades: false, motes: [[0, 0, 5]], shades: [] });

test('CLI: chạy đúng định dạng, snapshot tick 0, dòng end cuối, mã thoát 0', () => {
  const out = join(dir, 'a.jsonl');
  const r = headless(['--seed', '7', '--night', '1', '--scenario', scenario, '--inputs', inputs, '--ticks', '200', '--out', out]);
  assert.equal(r.status, 0, r.stderr);
  const lines = readLines(out);
  assert.equal(lines[0].type, 'snapshot');
  assert.equal(lines[0].tick, 0);
  // v1.2: pickup không cho điểm → score = 0
  assert.deepEqual(lines.at(-1), { type: 'end', ticks: 200, state: 'playing', score: 0 });
  const snaps = lines.filter((l) => l.type === 'snapshot');
  assert.equal(snaps.length, 21); // tick 0,10,...,200
  assert.ok(snaps.every((s, i) => s.tick === i * 10 && s.sim_tick === s.tick));
  const ev = lines.filter((l) => l.type === 'event');
  assert.deepEqual(ev.filter((e) => e.name !== 'night_start'), [{ type: 'event', tick: 43, name: 'mote_picked', data: { carried: 1 } }]);
  assert.deepEqual(snaps[12].player.pos, [0, 0, 11.75]);
  // v1.2: night1 = 240s, tick 120 = 2s → time_left_s = 238
  assert.equal(snaps[12].time_left_s, 238);
});

test('CLI: --snapshot-every và dừng sớm khi game kết thúc', () => {
  const sc = file('dawn.json', { random_motes: false, random_shades: false, time_left_s: 2 });
  const out = join(dir, 'b.jsonl');
  const r = headless(['--seed', '1', '--night', '1', '--scenario', sc, '--ticks', '1000', '--out', out, '--snapshot-every', '25']);
  assert.equal(r.status, 0, r.stderr);
  const lines = readLines(out);
  assert.deepEqual(lines.filter((l) => l.type === 'snapshot').map((s) => s.tick), [0, 25, 50, 75, 100]);
  assert.deepEqual(lines.at(-2), { type: 'event', tick: 120, name: 'game_over', data: { result: 'lost', reason: 'dawn', score: 0 } });
  assert.deepEqual(lines.at(-1), { type: 'end', ticks: 120, state: 'lost', score: 0 });
});

test('CLI: tính tất định, hai lần chạy cho file giống hệt', () => {
  const a = join(dir, 'd1.jsonl');
  const b = join(dir, 'd2.jsonl');
  for (const out of [a, b]) assert.equal(headless(['--seed', '99', '--night', '1', '--inputs', inputs, '--ticks', '3000', '--out', out]).status, 0);
  assert.equal(readFileSync(a, 'utf8'), readFileSync(b, 'utf8'));
});

test('CLI: file sai định dạng -> mã thoát 2 và báo lỗi ra stderr', () => {
  const bads = [
    file('bad1.json', '{not json'),
    file('bad2.json', { frames: [{ tick: 5 }, { tick: 5 }] }),
    file('bad3.json', { frames: [{ tick: 0, move: [2, 0] }] }),
  ];
  for (const bad of bads) {
    const r = headless(['--seed', '1', '--night', '1', '--inputs', bad, '--ticks', '10', '--out', join(dir, 'x.jsonl')]);
    assert.equal(r.status, 2);
    assert.ok(r.stderr.length > 0);
  }
  const badSc = file('bad4.json', { motes: [[1, 2]] });
  assert.equal(headless(['--seed', '1', '--night', '1', '--scenario', badSc, '--ticks', '10', '--out', join(dir, 'y.jsonl')]).status, 2);
});

test('CLI: thiếu tham số -> mã thoát khác 0', () => {
  const r = headless(['--seed', '1', '--ticks', '10']);
  assert.notEqual(r.status, 0);
  assert.ok(r.stderr.length > 0);
});
