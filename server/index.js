// Zeno Voice token server for Google Cloud Run.
// Keeps the Gemini API key on the server and hands the browser a short-lived,
// single-use ephemeral token that is locked to the Live model.
//
//   GEMINI_API_KEY=... node index.js
//   open https://<your-service>/ -> the prototype calls /token and connects with ?token=
//
// Deploy from the repo root (the Dockerfile is there):
//   gcloud run deploy zeno-voice --source . --region asia-south1 \
//     --set-secrets GEMINI_API_KEY=gemini-api-key:latest --allow-unauthenticated

import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';

const PORT = process.env.PORT || 8080;
const KEY = process.env.GEMINI_API_KEY;
const MODEL = process.env.LIVE_MODEL || 'gemini-3.8-live';
const STATIC = process.env.STATIC_DIR || new URL('..', import.meta.url).pathname;
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.otf': 'font/otf', '.mp4': 'video/mp4', '.png': 'image/png', '.pdf': 'application/pdf' };

async function mintToken() {
  const now = Date.now();
  const body = {
    uses: 1,
    expireTime: new Date(now + 30 * 60_000).toISOString(),
    newSessionExpireTime: new Date(now + 60_000).toISOString(),
    liveConnectConstraints: { model: `models/${MODEL}`, config: { responseModalities: ['AUDIO'], sessionResumption: {} } },
  };
  const r = await fetch('https://generativelanguage.googleapis.com/v1beta/auth_tokens', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': KEY },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`auth_tokens ${r.status}: ${await r.text()}`);
  const j = await r.json();
  return j.name; // the token string
}

http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://x');
    if (url.pathname === '/token') {
      if (!KEY) { res.writeHead(500); return res.end('GEMINI_API_KEY is not set'); }
      const token = await mintToken();
      res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
      return res.end(JSON.stringify({ token, model: MODEL }));
    }
    if (url.pathname === '/healthz') { res.writeHead(200); return res.end('ok'); }
    let path = normalize(decodeURIComponent(url.pathname)).replace(/^(\.\.[/\\])+/, '');
    if (path.endsWith('/')) path += 'index.html';
    const file = join(STATIC, path);
    if (!file.startsWith(STATIC)) { res.writeHead(403); return res.end(); }
    const data = await readFile(file);
    res.writeHead(200, { 'Content-Type': TYPES[extname(file)] || 'application/octet-stream' });
    res.end(data);
  } catch (e) {
    res.writeHead(e.code === 'ENOENT' ? 404 : 500);
    res.end(e.code === 'ENOENT' ? 'not found' : String(e.message || e));
  }
}).listen(PORT, () => console.log(`Zeno Voice on :${PORT}, model ${MODEL}`));
