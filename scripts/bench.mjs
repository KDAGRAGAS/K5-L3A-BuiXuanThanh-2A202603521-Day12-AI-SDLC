#!/usr/bin/env node
// Launches the real WebGL benchmark scene in local headless Chrome and records frame timings.
import { spawn, spawnSync } from 'node:child_process';
import { access, mkdtemp, readFile, rm, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { createServer } from 'node:net';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
function parseArgs(argv) {
  const opts = { seed: 42, duration: 30, out: null };
  for (let i = 0; i < argv.length; i++) {
    const key = argv[i]; const value = argv[++i];
    if (key === '--seed') opts.seed = Number(value);
    else if (key === '--duration') opts.duration = Number(value);
    else if (key === '--out') opts.out = value;
    else throw new Error(`tham số không hợp lệ: ${key}`);
  }
  if (!Number.isInteger(opts.seed) || !Number.isFinite(opts.duration) || opts.duration <= 0 || opts.duration > 300 || !opts.out) {
    throw new Error('cú pháp: node scripts/bench.mjs --seed 42 --duration 30 --out bench.json');
  }
  return opts;
}
async function unusedPort() {
  const server = createServer();
  await new Promise((resolveListen, reject) => server.once('error', reject).listen(0, '127.0.0.1', resolveListen));
  const { port } = server.address();
  await new Promise((resolveClose) => server.close(resolveClose));
  return port;
}
async function findChrome() {
  const candidates = [process.env.CHROME_PATH,
    process.platform === 'win32' ? join(process.env.ProgramFiles ?? 'C:\\Program Files', 'Google/Chrome/Application/chrome.exe') : null,
    process.platform === 'win32' ? join(process.env['ProgramFiles(x86)'] ?? 'C:\\Program Files (x86)', 'Microsoft/Edge/Application/msedge.exe') : null,
    process.platform === 'darwin' ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' : null,
  ].filter(Boolean);
  for (const candidate of candidates) { try { await access(candidate); return candidate; } catch { /* try next */ } }
  for (const name of ['google-chrome', 'chromium', 'chromium-browser', 'chrome', 'msedge']) {
    const found = spawnSync(process.platform === 'win32' ? 'where' : 'which', [name], { encoding: 'utf8' });
    if (found.status === 0) return found.stdout.trim().split(/\r?\n/)[0];
  }
  throw new Error('Không tìm thấy Chrome/Chromium. Đặt CHROME_PATH trỏ tới trình duyệt Chromium đã cài.');
}
async function waitJson(url, timeoutMs) {
  const end = Date.now() + timeoutMs;
  while (Date.now() < end) {
    try { const response = await fetch(url); if (response.ok) return await response.json(); } catch { /* wait for startup */ }
    await new Promise((resolveWait) => setTimeout(resolveWait, 150));
  }
  throw new Error(`Hết thời gian chờ ${url}`);
}

export async function runBenchmark(opts) {
  const chrome = await findChrome();
  const profile = await mkdtemp(join(tmpdir(), 'dao-den-long-bench-'));
  const httpPort = await unusedPort();
  const cdpPort = await unusedPort();
  const server = spawn(process.execPath, [join(ROOT, 'scripts/serve.mjs')], {
    cwd: ROOT, env: { ...process.env, PORT: String(httpPort) }, stdio: 'ignore',
  });
  let browser;
  let socket;
  try {
    await waitJson(`http://127.0.0.1:${httpPort}/api/leaderboard`, 10000);
    const url = `http://127.0.0.1:${httpPort}/web/?bench=${opts.duration}&seed=${opts.seed}`;
    browser = spawn(chrome, [
      '--headless=new', '--disable-gpu-vsync', '--disable-frame-rate-limit', '--window-size=1280,720',
      '--force-device-scale-factor=1', '--enable-webgl', '--enable-gpu', '--ignore-gpu-blocklist', '--use-gl=angle',
      '--use-angle=d3d11', '--remote-allow-origins=*',
      `--remote-debugging-port=${cdpPort}`, `--user-data-dir=${profile}`, '--no-first-run', '--disable-background-networking', url,
    ], { cwd: ROOT, stdio: 'ignore' });
    const pages = await waitJson(`http://127.0.0.1:${cdpPort}/json/list`, 20000);
    const page = pages.find((item) => item.type === 'page' && item.url.startsWith(`http://127.0.0.1:${httpPort}/web/`));
    if (!page?.webSocketDebuggerUrl) throw new Error('Chrome не tạo được tab benchmark.');
    const result = await new Promise((resolveResult, rejectResult) => {
      socket = new WebSocket(page.webSocketDebuggerUrl);
      let id = 0; let pendingId = null;
      let poll;
      const timeout = setTimeout(() => { clearInterval(poll); rejectResult(new Error('Benchmark không hoàn tất đúng hạn.')); }, (opts.duration + 60) * 1000);
      const ask = () => {
        if (socket.readyState !== WebSocket.OPEN || pendingId !== null) return;
        pendingId = ++id;
        socket.send(JSON.stringify({ id: pendingId, method: 'Runtime.evaluate', params: { expression: 'window.__benchResult || null', returnByValue: true } }));
      };
      socket.addEventListener('open', () => {
        socket.send(JSON.stringify({ id: ++id, method: 'Runtime.enable' }));
        poll = setInterval(ask, 250);
      });
      socket.addEventListener('message', (event) => {
        const message = JSON.parse(event.data);
        if (message.method === 'Runtime.exceptionThrown') {
          clearTimeout(timeout); clearInterval(poll);
          const details = message.params.exceptionDetails;
          rejectResult(new Error(`Lỗi trong trang benchmark: ${details.exception?.description ?? details.text} (${details.url ?? ''}:${details.lineNumber ?? 0})`));
          return;
        }
        if (message.id !== pendingId) return;
        pendingId = null;
        const value = message.result?.result?.value;
        if (value?.contract_version === '1.3' && value.frames > 0) {
          clearTimeout(timeout); clearInterval(poll); resolveResult(value);
        }
      });
      socket.addEventListener('error', () => { clearTimeout(timeout); clearInterval(poll); rejectResult(new Error('Không thể đọc kết quả benchmark từ Chrome.')); });
    });
    const target = resolve(opts.out);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, `${JSON.stringify(result, null, 2)}\n`);
    return result;
  } finally {
    try { socket?.close(); } catch { /* already closed */ }
    if (browser?.pid && process.platform === 'win32') spawnSync('taskkill', ['/pid', String(browser.pid), '/T', '/F'], { stdio: 'ignore' });
    else browser?.kill();
    server.kill();
    await rm(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  }
}

if (process.argv[1] && process.argv[1].replaceAll('\\', '/').endsWith('/scripts/bench.mjs')) {
  try { const result = await runBenchmark(parseArgs(process.argv.slice(2))); process.stdout.write(`${JSON.stringify(result, null, 2)}\n`); }
  catch (error) { process.stderr.write(`loi: ${error.message}\n`); process.exitCode = 1; }
}
