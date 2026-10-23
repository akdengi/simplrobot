// Простейший статический сервер для локального запуска игры.
// Запуск: node tools/serve.mjs [port]
import { createServer } from 'node:http';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const port = Number(process.argv[2] || 8137);

const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.json': 'application/json; charset=utf-8',
  '.ico': 'image/x-icon'
};

createServer(async (req, res) => {
  try {
    /* --- служебное: приём скриншотов из страницы (для отладки) --------- */
    if (req.method === 'POST' && (req.url || '').split('?')[0] === '/__shot') {
      const chunks = [];
      for await (const c of req) chunks.push(c);
      const body = Buffer.concat(chunks).toString('utf8');
      let name = 'shot';
      let b64 = body;
      const m = /^data:image\/png;base64,/.exec(body);
      if (m) b64 = body.slice(m[0].length);
      try {
        const j = JSON.parse(body);
        if (j && j.name) name = String(j.name).replace(/[^\w.-]/g, '_');
        if (j && j.png) b64 = String(j.png).replace(/^data:image\/png;base64,/, '');
      } catch { /* пришли голый base64 */ }
      const dir = join(root, 'shots');
      await mkdir(dir, { recursive: true });
      const file = join(dir, name + '.png');
      await writeFile(file, Buffer.from(b64, 'base64'));
      res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' }).end(file);
      return;
    }

    let path = decodeURIComponent((req.url || '/').split('?')[0]);
    if (path === '/') path = '/index.html';
    const file = join(root, normalize(path).replace(/^([/\\])+/, ''));
    if (!file.startsWith(root)) { res.writeHead(403).end('forbidden'); return; }
    const data = await readFile(file);
    res.writeHead(200, { 'Content-Type': types[extname(file).toLowerCase()] || 'application/octet-stream' });
    res.end(data);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('not found');
  }
}).listen(port, () => console.log('KVP dev server: http://localhost:' + port + '/'));
