// Сколько кадров получается у эталонных решений (чтобы анимация не растягивалась).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
globalThis.window = {};
const load = (p) => new Function('window', fs.readFileSync(path.join(root, p), 'utf8'))(globalThis.window);
load('js/engine.js'); load('js/programs.js'); load('js/data/levels.js'); load('js/data/scenarios.js');
const BG4 = globalThis.window.BG4;
const rows = [];
for (const r of globalThis.window.BG4_LEVELS.rooms) {
  const scn = BG4.SCENARIOS[r.id] || {};
  const text = scn.answer || r.solutionText;
  if (!text) continue;
  const res = BG4.Engine.simulate(r, scn, { lines: BG4.Prog.parseSolution(text) });
  rows.push({ id: r.id, frames: res.frames.length, result: res.result });
}
rows.sort((a, b) => b.frames - a.frames);
console.log('самые «длинные» решения (по кадрам):');
for (const x of rows.slice(0, 8)) console.log(' ', x.id, x.frames, x.result);
console.log('всего уровней:', rows.length, '| среднее кадров:', (rows.reduce((s, x) => s + x.frames, 0) / rows.length).toFixed(1));
