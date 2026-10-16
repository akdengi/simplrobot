import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const win = { window: {} };
globalThis.window = win.window;
function load(p) { new Function('window', fs.readFileSync(path.join(root, p), 'utf8'))(win.window); }
load('js/data/levels.js');
load('js/data/scenarios.js');
load('js/programs.js');
load('js/engine.js');
const { BG4_LEVELS: L } = win.window;
const S = win.window.BG4.SCENARIOS;
const Engine = win.window.BG4.Engine;

const id = process.argv[2];
const seq = process.argv[3].split(',');
const level = L.rooms.find((r) => r.id === id);
const scn = S[id] || {};
const lines = seq.map((c) => ({ t: 'cmd', cmd: c }));
const res = Engine.simulate(level, scn, { lines, endless: !!scn.endless });
console.log('result:', res.result, res.message);
for (const f of res.frames) {
  console.log('---', f.phase, f.line == null ? '' : 'line ' + f.line, f.actor || '', f.result || '');
  console.log('  golems:', f.golems.map((g) => g.id + '(' + g.color + ')@' + g.r + ',' + g.c + ' ' + g.dir + ' dmg' + g.damage).join('  '));
  console.log('  log:', (f.log || []).join(' | '));
}
