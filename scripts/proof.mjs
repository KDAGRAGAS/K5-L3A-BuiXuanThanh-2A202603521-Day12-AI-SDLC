// Chạy các scenario trong tests/scenarios qua đúng lệnh headless của contract,
// kiểm tra kết quả mong đợi, kiểm tra tính tất định (chạy 2 lần, so sha256),
// đo thời gian đủ cả ba đêm (Contract v1.1), rồi ghi docs/proof/<phase>/.
// Không sửa tay file nào trong docs/proof: chạy lại `npm run proof` để sinh lại.
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const PHASE = process.env.PHASE || 'phase-1';
const OUT = join(ROOT, 'docs', 'proof', PHASE);
const RUNS = join(OUT, 'runs');
const SC_DIR = join(ROOT, 'tests', 'scenarios');
const CLI = join(ROOT, 'src', 'headless', 'cli.js');
const TMP = join(os.tmpdir(), 'ddl-proof');
rmSync(RUNS, { recursive: true, force: true });
mkdirSync(RUNS, { recursive: true });
mkdirSync(TMP, { recursive: true });

const sha = (p) => createHash('sha256').update(readFileSync(p)).digest('hex').slice(0, 16);
const get = (obj, path) => path.split('.').reduce((o, k) => (o == null ? o : o[k]), obj);
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

function headless(args) {
  const t0 = process.hrtime.bigint();
  const r = spawnSync(process.execPath, [CLI, ...args], { encoding: 'utf8' });
  return { ...r, ms: Number(process.hrtime.bigint() - t0) / 1e6 };
}

const rows = [];
let failed = 0;
for (const f of readdirSync(SC_DIR).filter((x) => x.endsWith('.json')).sort()) {
  const name = f.replace(/\.json$/, '');
  const spec = JSON.parse(readFileSync(join(SC_DIR, f), 'utf8'));
  const scPath = join(TMP, `${name}.scenario.json`);
  writeFileSync(scPath, JSON.stringify(spec.scenario));
  const args = ['--seed', String(spec.seed), '--night', String(spec.night ?? 1), '--scenario', scPath, '--ticks', String(spec.ticks), '--snapshot-every', String(spec.snapshot_every ?? 1)];
  if (spec.inputs) {
    const inPath = join(TMP, `${name}.inputs.json`);
    writeFileSync(inPath, JSON.stringify(spec.inputs));
    args.push('--inputs', inPath);
  }
  const out1 = join(RUNS, `${name}.jsonl`);
  const out2 = join(TMP, `${name}.again.jsonl`);
  const r1 = headless([...args, '--out', out1]);
  const r2 = headless([...args, '--out', out2]);
  const problems = [];
  if (r1.status !== 0) problems.push(`exit ${r1.status}: ${r1.stderr.trim()}`);
  let lines = [];
  if (r1.status === 0) {
    lines = readFileSync(out1, 'utf8').trim().split('\n').map((l) => JSON.parse(l));
    const ev = lines.filter((l) => l.type === 'event').map((e) => [e.tick, e.name, e.data]);
    const starts = ev.filter((e) => e[1] === 'night_start');
    if (starts.length !== 1 || starts[0][2].night !== (spec.night ?? 1)) problems.push(`night_start = ${JSON.stringify(starts)}`);
    const exp = spec.expect;
    if (exp.events) {
      const checkedEvents = exp.events.some((e) => e[1] === 'night_start') ? ev : ev.filter((e) => e[1] !== 'night_start');
      if (exp.events.length === 0 && checkedEvents.length) problems.push(`mong đợi không có sự kiện, có ${checkedEvents.length}`);
      let i = 0;
      for (const e of checkedEvents) if (i < exp.events.length && same(e, exp.events[i])) i++;
      if (i < exp.events.length) problems.push(`thiếu sự kiện ${JSON.stringify(exp.events[i])}`);
    }
    if (exp.end && !same(lines.at(-1), exp.end)) problems.push(`end = ${JSON.stringify(lines.at(-1))}`);
    if (exp.snapshot) {
      const [tick, path, value] = exp.snapshot;
      const s = lines.find((l) => l.type === 'snapshot' && l.tick === tick);
      if (!s || !same(get(s, path), value)) problems.push(`snapshot tick ${tick} ${path} = ${JSON.stringify(s && get(s, path))}`);
    }
    if (exp.snapshots) {
      for (const [tick, path, value] of exp.snapshots) {
        const s = lines.find((l) => l.type === 'snapshot' && l.tick === tick);
        if (!s || !same(get(s, path), value)) problems.push(`snapshot tick ${tick} ${path} = ${JSON.stringify(s && get(s, path))}`);
      }
    }
    if (exp.snapshot_fields) {
      const s = lines.filter((l) => l.type === 'snapshot').at(-1);
      for (const [path, value] of Object.entries(exp.snapshot_fields)) {
        if (!same(get(s, path), value)) problems.push(`snapshot ${path} = ${JSON.stringify(get(s, path))}, mong đợi ${JSON.stringify(value)}`);
      }
    }
    if (sha(out1) !== sha(out2)) problems.push('hai lần chạy cho output khác nhau');
  }
  if (problems.length) failed++;
  rows.push({ name, req: spec.requirement, ok: !problems.length, problems, hash: r1.status === 0 ? sha(out1) : '-', lines: lines.length });
}

// Chạy đủ thời lượng tối đa cho từng đêm hai lần, đo độ tất định và thời gian.
const fullRuns = [];
for (const night of [1, 2, 3]) {
  const full1 = join(RUNS, `full-night-${night}-seed-123.jsonl`);
  const full2 = join(TMP, `full-night-${night}-again.jsonl`);
  const scenario = join(TMP, `full-night-${night}.scenario.json`);
  const duration = [18000, 19800, 21600][night - 1];
  writeFileSync(scenario, JSON.stringify({ random_motes: false, random_shades: false, random_drifters: false, motes: [], player: { flames: 99 } }));
  const first = headless(['--seed', '123', '--night', String(night), '--scenario', scenario, '--ticks', String(duration), '--out', full1]);
  const second = headless(['--seed', '123', '--night', String(night), '--scenario', scenario, '--ticks', String(duration), '--out', full2]);
  const deterministic = first.status === 0 && second.status === 0 && sha(full1) === sha(full2);
  if (!deterministic) failed++;
  fullRuns.push({ night, duration, path: full1, deterministic, ms: first.ms, end: first.status === 0 ? JSON.parse(readFileSync(full1, 'utf8').trim().split('\n').at(-1)) : null });
}

const md = [
  `# Bằng chứng ${PHASE}: scenario headless`,
  '',
  'File này do `npm run proof` sinh ra, không sửa tay. Mỗi scenario chạy đúng lệnh `headless_cmd` trong `game.contract.json`,',
  'chạy hai lần để so sha256 (tính tất định). Output đầy đủ nằm trong `runs/`.',
  '',
  `- Máy: ${os.platform()} ${os.arch()}, ${os.cpus()[0]?.model ?? '?'}, Node ${process.version}`,
  `- Kết quả: **${rows.length - rows.filter((r) => !r.ok).length}/${rows.length} scenario đạt**`,
  '',
  '| Scenario | Yêu cầu kiểm chứng | Kết quả | sha256 (16 ký tự đầu) |',
  '|---|---|---|---|',
  ...rows.map((r) => `| \`${r.name}\` | ${r.req} | ${r.ok ? 'đạt' : 'CHƯA ĐẠT: ' + r.problems.join('; ')} | \`${r.hash}\` |`),
  '',
  '## Chạy đủ từng Đêm (seed 123, không input)',
  '',
  '| Đêm | Tick | Kết thúc | Tất định | Thời gian |',
  '|---|---:|---|---|---:|',
  ...fullRuns.map((r) => `| ${r.night} | ${r.duration} | \`${JSON.stringify(r.end)}\` | ${r.deterministic ? 'đạt' : 'CHƯA ĐẠT'} (\`${sha(r.path)}\`) | ${r.ms.toFixed(0)} ms |`),
  '',
];
writeFileSync(join(OUT, 'RESULTS.md'), md.join('\n'));
console.log(md.join('\n'));
process.exit(failed ? 1 : 0);
