import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { CONTRACT } from '../scripts/gen-contract.mjs';
import { rankEntries, validLeaderboardName } from '../src/core/leaderboard.js';
import { runSoak } from '../src/headless/soak.js';
import { makeBenchmarkScenario } from '../src/core/benchmark.js';
import { Game } from '../src/core/game.js';

test('Contract v1.3 khai báo lệnh benchmark và soak', () => {
  assert.equal(CONTRACT.contract_version, '1.3');
  assert.equal(CONTRACT.bench_cmd, 'node scripts/bench.mjs');
  assert.equal(CONTRACT.soak_cmd, 'node --no-opt --max-semi-space-size=1 --expose-gc src/headless/soak.js');
});

test('cài đặt bảng màu mù màu được lưu và áp dụng cho cảnh báo, Bóng Mực', async () => {
  const html = await readFile(new URL('../web/index.html', import.meta.url), 'utf8');
  const main = await readFile(new URL('../web/main.js', import.meta.url), 'utf8');
  assert.match(html, /id="colorblindPalette"/);
  assert.match(html, /\.colorblind \.warning-cue::before/);
  assert.match(main, /colorblindPalette: \$\('colorblindPalette'\)\.checked/);
  assert.match(main, /shadeEyeMaterial\.color\.setHex\(enabled \? 0x00b3ff/);
  assert.match(main, /view\.tear\.visible = !lantern\.lit/);
});

test('lướt chỉ dùng phím đã gán, không giữ phím Shift phải làm phím ẩn', async () => {
  const main = await readFile(new URL('../web/main.js', import.meta.url), 'utf8');
  assert.match(main, /dash: keys\.has\(bindings\.dash\)/);
  assert.doesNotMatch(main, /keys\.has\('ShiftRight'\)/);
});

test('hình học bản đồ được khai báo tập trung trong config', async () => {
  const config = await readFile(new URL('../src/core/config.js', import.meta.url), 'utf8');
  const maps = await readFile(new URL('../src/core/maps.js', import.meta.url), 'utf8');
  assert.match(config, /export const MAPS\s*=/);
  assert.match(maps, /import \{ MAPS \} from '\.\/config\.js'/);
  assert.doesNotMatch(maps, /const night[123]\s*=/);
});

test('night_start phát đúng một lần ở tick mô phỏng đầu tiên', () => {
  const game = new Game({ seed: 4, night: 2 });
  game.step();
  assert.deepEqual(game.drainEvents(), [{ type: 'event', tick: 1, name: 'night_start', data: { night: 2 } }]);
  game.step();
  assert.deepEqual(game.drainEvents(), []);
});

test('leaderboard giới hạn tên và xếp điểm giảm dần, hòa điểm theo thời gian', () => {
  assert.equal(validLeaderboardName('May_2026'), true);
  assert.equal(validLeaderboardName('TênMay'), true);
  assert.equal(validLeaderboardName('Maȳ'), true);
  assert.equal(validLeaderboardName('ab'), false);
  assert.equal(validLeaderboardName('Mây Cưng'), false);
  const ranked = rankEntries([
    { name: 'Late', score: 20, achieved_at: '2026-01-02T00:00:00Z', nights_won: 1, seed: 1 },
    { name: 'High', score: 30, achieved_at: '2026-01-03T00:00:00Z', nights_won: 2, seed: 1 },
    { name: 'Early', score: 20, achieved_at: '2026-01-01T00:00:00Z', nights_won: 1, seed: 1 },
  ]);
  assert.deepEqual(ranked.map((entry) => entry.name), ['High', 'Early', 'Late']);
  assert.equal(rankEntries(Array.from({ length: 12 }, (_, i) => ({ name: `Player${i}`, score: i, achieved_at: '2026-01-01T00:00:00Z', nights_won: 1, seed: i }))).length, 10);
});

test('soak chạy 10 đêm liên tiếp, seed và input tất định, đủ trường output', () => {
  const first = runSoak({ seed: 7, nights: 10, durationLimitS: 2 });
  const second = runSoak({ seed: 7, nights: 10, durationLimitS: 2 });
  assert.deepEqual(first.results, second.results);
  assert.equal(first.nights, 10);
  assert.equal(first.crashes, 0);
  assert.equal(first.results.length, 10);
  assert.equal(first.mem_end_mb > 0, true);
  assert.equal(first.duration_s >= 0, true);
});

test('benchmark tạo đúng cảnh seed 42 và tắt damage, fuel drain, điều kiện kết thúc', () => {
  const scenario = makeBenchmarkScenario(42);
  assert.deepEqual(scenario, makeBenchmarkScenario(42));
  assert.equal(scenario.shades.length, 200);
  assert.ok(scenario.shades.every((shade) => shade.state === 'wander'));
  assert.equal(scenario.motes.length, 100);
  const game = new Game({ seed: 42, scenario });
  for (let i = 0; i < 1800; i++) game.step();
  assert.equal(game.state, 'playing');
  assert.equal(game.player.flames, 3);
  assert.equal(game.lanterns.slice(0, 3).every((lantern) => lantern.lit && lantern.fuelTicks === 6000), true);
  assert.equal(game.shades.length, 200);
});

test('API leaderboard lưu cục bộ, xếp top 10 và lệnh export trả đúng thứ tự', async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'ddl-leaderboard-test-'));
  const portServer = createServer();
  await new Promise((resolve, reject) => portServer.once('error', reject).listen(0, '127.0.0.1', resolve));
  const port = portServer.address().port;
  await new Promise((resolve) => portServer.close(resolve));
  const file = join(directory, 'leaderboard.json');
  const output = join(directory, 'export.json');
  const server = spawn(process.execPath, ['scripts/serve.mjs'], {
    cwd: new URL('..', import.meta.url),
    env: { ...process.env, PORT: String(port), LEADERBOARD_FILE: file },
    stdio: 'ignore',
  });
  t.after(async () => { server.kill(); await rm(directory, { recursive: true, force: true }); });
  const url = `http://127.0.0.1:${port}/api/leaderboard`;
  let ready = false;
  for (let attempt = 0; attempt < 50 && !ready; attempt++) {
    try { ready = (await fetch(url)).ok; } catch { await new Promise((resolve) => setTimeout(resolve, 50)); }
  }
  assert.equal(ready, true);
  const add = async (entry) => fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ entry }) });
  assert.equal((await add({ name: 'Alice', score: 20, nights_won: 1, achieved_at: '2026-01-02T00:00:00Z', seed: 7 })).status, 200);
  assert.equal((await add({ name: 'Bob_1', score: 20, nights_won: 2, achieved_at: '2026-01-01T00:00:00+07:00', seed: 8 })).status, 200);
  assert.equal((await add({ name: 'bad', score: 0, nights_won: 0, achieved_at: '2026-01-01T00:00:00', seed: 1 })).status, 400);
  const exportProc = spawn(process.execPath, ['scripts/serve.mjs', '--export-leaderboard', output], {
    cwd: new URL('..', import.meta.url),
    env: { ...process.env, LEADERBOARD_FILE: file },
    stdio: 'ignore',
  });
  const code = await new Promise((resolve) => exportProc.once('exit', resolve));
  assert.equal(code, 0);
  const exported = JSON.parse(await readFile(output, 'utf8'));
  assert.deepEqual(exported.entries.map((entry) => entry.name), ['Bob_1', 'Alice']);
});
