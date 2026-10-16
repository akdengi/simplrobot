// Dump embedded bot-program images/text for floors 5-6 from the raw export.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const raw = JSON.parse(fs.readFileSync(path.join(root, 'data', 'bg4_export.json'), 'utf8'));

const ids = process.argv.slice(2);
const rooms = ids.length ? raw.rooms.filter((r) => ids.includes(r.id)) : raw.rooms;

for (const r of rooms) {
  const h = String(r.htmlText || '');
  const imgs = [...h.matchAll(/<img[^>]*?src="([^"]+)"/g)].map((m) => m[1]);
  const text = h
    .replace(/<div[^>]*class="[^"]*t-redactor__embedcode[^"]*"[\s\S]*?<\/div>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
  console.log('===== ' + r.id + ' ' + r.title + ' =====');
  if (imgs.length) { console.log('images:'); imgs.forEach((u) => console.log('  ' + u)); }
  if (/Задание/.test(text)) {
    const after = text.replace(/^[\s\S]*?Подсказка:/, '');
    console.log('hint+after: ' + after.slice(0, 500));
  }
  console.log();
}
