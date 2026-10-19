// Minimal static file server for local testing of Golems Puzzles.
// Usage: node tools/serve.mjs [port]
//
// Особенность: сервер не обрабатывает SSI, поэтому в сыром index.html всегда
// срабатывает ветка <script>window.BG4_FORCE_DEMO = true;</script> (ветка
// полного доступа лежит внутри HTML-комментария <!--# if --> и как JS ломается).
// Чтобы документированный в README `?access=full` работал локально, при таком
// запросе подменяем демо-флаг на полный. На боевом nginx это не влияет.
function patchIndex(html, url) {
  if (!/[?&]access=full(?:&|$)/.test(url)) return html;
  return html.replace('window.BG4_FORCE_DEMO = true;', 'window.BG4_FORCE_FULL = true;');
}
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const port = Number(process.argv[2] || 8181);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

http.createServer((req, res) => {
  let urlPath = decodeURIComponent(req.url.split('?')[0]);
  if (urlPath === '/') urlPath = '/index.html';
  const file = path.join(root, urlPath);
  if (!file.startsWith(root)) { res.writeHead(403); res.end('forbidden'); return; }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); res.end('not found'); return; }
    let body = data;
    if (path.basename(file) === 'index.html') {
      body = Buffer.from(patchIndex(data.toString('utf8'), req.url), 'utf8');
    }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream' });
    res.end(body);
  });
}).listen(port, () => console.log(`Serving ${root} at http://localhost:${port}/`));
