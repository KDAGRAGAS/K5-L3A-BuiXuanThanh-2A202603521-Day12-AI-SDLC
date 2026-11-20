#!/usr/bin/env node
// Test Contract v1.3: soak 10 nights in one Node process.
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { performance } from 'node:perf_hooks';
import { Game, DEFAULT_INPUT } from '../core/game.js';
import { mulberry32 } from '../core/rng.js';

const rssMb = () => Math.round(process.memoryUsage().rss / (1024 * 1024) * 10) / 10;

export function runSoak({ seed = 7, nights = 10, durationLimitS = Infinity } = {}) {
  const startedAt = performance.now();
  const results = [];
  let memStart = null;
  let crashes = 0;
  for (let i = 1; i <= nights; i++) {
    let game = null;
    try {
      const night = ((i - 1) % 3) + 1;
      const nightSeed = seed + i;
      const rng = mulberry32(nightSeed);
      game = new Game({ seed: nightSeed, night });
      if (memStart === null) memStart = rssMb();
      let move = [0, 0];
      const maxTicks = Math.min(Math.ceil(game.timeLeft * 60), Math.ceil(durationLimitS * 60));
      for (let tick = 0; tick < maxTicks && game.state === 'playing'; tick++) {
        if (tick % 30 === 0) {
          const angle = rng() * Math.PI * 2;
          move = [Math.cos(angle), Math.sin(angle)];
        }
        const input = {
          ...DEFAULT_INPUT,
          move,
          jump: rng() < 0.05,
          dash: rng() < 0.03,
          pulse: rng() < 0.02,
          interact: rng() < 0.1,
        };
        game.step(input);
        game.drainEvents();
      }
      results.push(game.state === 'won' || game.state === 'lost' ? game.state : 'timeout');
    } catch {
      crashes++;
      results.push('crash');
    } finally {
      game = null;
      if (global.gc) global.gc();
    }
  }
  const memEnd = rssMb();
  return {
    nights,
    crashes,
    results,
    mem_start_mb: memStart ?? memEnd,
    mem_end_mb: memEnd,
    duration_s: Math.round((performance.now() - startedAt) / 100) / 10,
  };
}

function main(argv) {
  const opts = { seed: 7, nights: 10, out: null };
  for (let i = 0; i < argv.length; i++) {
    const key = argv[i];
    const value = argv[++i];
    if (key === '--seed') opts.seed = Number(value);
    else if (key === '--nights') opts.nights = Number(value);
    else if (key === '--out') opts.out = value;
    else throw new Error(`tham số không hợp lệ: ${key}`);
  }
  if (!Number.isInteger(opts.seed) || !Number.isInteger(opts.nights) || opts.nights < 1 || opts.nights > 100 || !opts.out) {
    throw new Error('cú pháp: node src/headless/soak.js --seed 7 --nights 10 --out soak.json');
  }
  const result = runSoak(opts);
  const target = resolve(opts.out);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, `${JSON.stringify(result, null, 2)}\n`);
}

if (process.argv[1]?.replaceAll('\\', '/').endsWith('/src/headless/soak.js')) {
  try { main(process.argv.slice(2)); }
  catch (error) { process.stderr.write(`loi: ${error.message}\n`); process.exitCode = 1; }
}
