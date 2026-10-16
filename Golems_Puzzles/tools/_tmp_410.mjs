import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const win = { window: {} };
globalThis.window = win.window;
function load(p) { new Function('window', fs.readFileSync(path.join(root, p), 'utf8'))(win.window); }
load('js/data/levels.js');
const L = win.window.BG4_LEVELS;
const room = L.rooms.find((r) => r.id === '4.10');
console.log(JSON.stringify(room, null, 1));
// what token types exist at all?
const types = new Set();
for (const r of L.rooms) for (const t of r.tokens || []) types.add(t.type);
console.log('token types:', [...types].sort().join(', '));
const raw = fs.readFileSync(path.join(root, 'data/bg4_export.json'), 'utf8');
console.log('mentions bomb:', (raw.match(/bomb/gi) || []).length);
