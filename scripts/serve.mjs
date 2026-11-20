// Server tĩnh tối giản (không cần thư viện) để chơi bản web: npm start
import { createServer } from 'node:http';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { extname, join, normalize, sep, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { rankEntries, validLeaderboardEntry } from '../src/core/leaderboard.js';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const PORT = Number(process.env.PORT) || 5173;
const LEADERBOARD_FILE = process.env.LEADERBOARD_FILE || join(ROOT, '.local', 'leaderboard.json');
const DATA_DIR = dirname(LEADERBOARD_FILE);
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.json': 'application/json', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml' };

async function readLeaderboard() {
  try {
    const data = JSON.parse(await readFile(LEADERBOARD_FILE, 'utf8'));
    return rankEntries(Array.isArray(data.entries) ? data.entries : []);
  } catch { return []; }
}

if (process.argv[2] === '--export-leaderboard') {
  const output = process.argv[3];
  if (!output) { process.stderr.write('cú pháp: npm start -- --export-leaderboard out.json\n'); process.exit(1); }
  await writeFile(resolve(output), `${JSON.stringify({ entries: await readLeaderboard() }, null, 2)}\n`);
  process.exit(0);
}

createServer(async (req, res) => {
  let path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (path === '/api/leaderboard' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
    return res.end(JSON.stringify({ entries: await readLeaderboard() }));
  }
  if (path === '/api/leaderboard' && req.method === 'POST') {
    let body = '';
    for await (const chunk of req) body += chunk;
    try {
      const entry = JSON.parse(body).entry;
      if (!validLeaderboardEntry(entry)) throw new Error('invalid_entry');
      const entries = rankEntries([...(await readLeaderboard()), entry]);
      await mkdir(DATA_DIR, { recursive: true });
      await writeFile(LEADERBOARD_FILE, `${JSON.stringify({ entries }, null, 2)}\n`);
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      return res.end(JSON.stringify({ entries }));
    } catch {
      res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
      return res.end(JSON.stringify({ error: 'invalid_entry' }));
    }
  }
  if (path === '/') {
    res.writeHead(302, { Location: '/web/' });
    return res.end();
  }
  if (path.endsWith('/')) path += 'index.html';
  const file = normalize(join(ROOT, path));
  if (!file.startsWith(ROOT.endsWith(sep) ? ROOT : ROOT + sep) || !/^\/(web|src)\//.test(path)) {
    res.writeHead(404);
    return res.end('not found');
  }
  try {
    const body = await readFile(file);
    res.writeHead(200, { 'Content-Type': TYPES[extname(file)] ?? 'application/octet-stream' });
    res.end(body);
  } catch {
    res.writeHead(404);
    res.end('not found');
  }
}).listen(PORT, '127.0.0.1', () => {
  console.log(`Dao Den Long dang chay: http://localhost:${PORT}/  (Ctrl+C de dung)`);
});
