#!/usr/bin/env node
// Chế độ headless theo Test Contract v1.0.
// node src/headless/cli.js --seed <int> --night 1 [--scenario f] [--inputs f]
//                          --ticks <int> --out <file.jsonl> [--snapshot-every <int>]
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { Game, DEFAULT_INPUT } from '../core/game.js';
import { validateInputs, validateScenario, FormatError } from './validate.js';

class UsageError extends Error {}

function parseArgs(argv) {
  const opts = { snapshotEvery: 10 };
  const intArg = (name, v) => {
    if (v === undefined || !/^-?\d+$/.test(v)) throw new UsageError(`${name} cần một số nguyên`);
    return Number(v);
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const v = argv[i + 1];
    switch (a) {
      case '--seed': opts.seed = intArg(a, v); i++; break;
      case '--night': opts.night = intArg(a, v); i++; break;
      case '--ticks': opts.ticks = intArg(a, v); i++; break;
      case '--snapshot-every': opts.snapshotEvery = intArg(a, v); i++; break;
      case '--scenario': if (!v) throw new UsageError('--scenario cần đường dẫn'); opts.scenario = v; i++; break;
      case '--inputs': if (!v) throw new UsageError('--inputs cần đường dẫn'); opts.inputs = v; i++; break;
      case '--out': if (!v) throw new UsageError('--out cần đường dẫn'); opts.out = v; i++; break;
      default: throw new UsageError(`tham số không hợp lệ: ${a}`);
    }
  }
  for (const k of ['seed', 'night', 'ticks', 'out']) if (opts[k] === undefined) throw new UsageError(`thiếu --${k}`);
  if (opts.ticks < 0) throw new UsageError('--ticks phải >= 0');
  if (opts.snapshotEvery < 1) throw new UsageError('--snapshot-every phải >= 1');
  return opts;
}

function readJson(path, what) {
  let text;
  try {
    text = readFileSync(path, 'utf8');
  } catch (e) {
    throw new UsageError(`không đọc được file ${what}: ${path} (${e.code ?? e.message})`);
  }
  try {
    return JSON.parse(text);
  } catch (e) {
    throw new FormatError(`file ${what} không phải JSON hợp lệ: ${e.message}`);
  }
}

export function run(opts) {
  const scenario = opts.scenario ? validateScenario(readJson(opts.scenario, 'scenario')) : null;
  const inputs = opts.inputs ? validateInputs(readJson(opts.inputs, 'inputs')) : { frames: [] };
  const game = new Game({ seed: opts.seed, night: opts.night, scenario });

  const frames = new Map(inputs.frames.map((f) => [f.tick, f]));
  const cur = { ...DEFAULT_INPUT, move: [...DEFAULT_INPUT.move] };
  const lines = [JSON.stringify(game.snapshot())];

  for (let k = 0; k < opts.ticks && game.state === 'playing'; k++) {
    const f = frames.get(k);
    if (f) {
      for (const key of ['move', 'cam_yaw_deg', 'jump', 'interact', 'pulse']) if (f[key] !== undefined) cur[key] = f[key];
    }
    game.step(cur);
    for (const e of game.drainEvents()) lines.push(JSON.stringify(e));
    if (game.tick % opts.snapshotEvery === 0) lines.push(JSON.stringify(game.snapshot()));
  }
  lines.push(JSON.stringify({ type: 'end', ticks: game.steps, state: game.state, score: game.score }));

  const out = resolve(opts.out);
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, lines.join('\n') + '\n');
  return game;
}

function main() {
  try {
    run(parseArgs(process.argv.slice(2)));
    process.exit(0);
  } catch (e) {
    process.stderr.write(`loi: ${e.message}\n`);
    process.exit(e instanceof FormatError ? 2 : 1);
  }
}

main();
