// Download the embedded bot-program images (floors 5-6) so we can read them.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const raw = JSON.parse(fs.readFileSync(path.join(root, 'data', 'bg4_export.json'), 'utf8'));
const outDir = process.argv[2] || path.join(root, 'data', 'botprog');
fs.mkdirSync(outDir, { recursive: true });

function full(u) {
  // Drop the Tilda thumbnail transform to get the original image.
  return u.replace(/\/-\/resizeb\/[^/]+\//, '/');
}

let n = 0;
for (const r of raw.rooms) {
  const h = String(r.htmlText || '');
  const imgs = [...h.matchAll(/<img[^>]*?src="([^"]+)"/g)].map((m) => m[1]);
  let i = 0;
  for (const u of imgs) {
    i++;
    const url = full(u);
    const ext = (url.match(/\.(png|jpg|jpeg|gif|webp)(\?|$)/i) || [, 'png'])[1];
    const name = `${r.id.replace('.', '_')}_${i}.${ext}`;
    try {
      const res = await fetch(url);
      if (!res.ok) { console.log('FAIL', name, res.status, url); continue; }
      const buf = Buffer.from(await res.arrayBuffer());
      fs.writeFileSync(path.join(outDir, name), buf);
      console.log('OK', name, buf.length, url);
      n++;
    } catch (e) {
      console.log('ERR', name, String(e));
    }
  }
}
console.log('downloaded', n, 'to', outDir);
