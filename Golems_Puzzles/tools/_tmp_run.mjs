import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const win = { window: { BG4_DEBUG: true } };
globalThis.window = win.window;
function load(p) { new Function('window', fs.readFileSync(path.join(root, p), 'utf8'))(win.window); }
load('js/data/levels.js');
load('js/data/scenarios.js');
load('js/programs.js');
load('js/engine.js');
const L = win.window.BG4_LEVELS;
const S = win.window.BG4.SCENARIOS;
const Prog = win.window.BG4.Prog;
const Engine = win.window.BG4.Engine;
const id = process.argv[2] || '4.8';
const level = L.rooms.find((r) => r.id === id);
const scn = S[id] || {};
const text = process.argv[3] || scn.answer || level.solutionText;
const program = { lines: Prog.parseSolution(text), endless: !!scn.endless };
console.log('level:', id, '| program:', text);
const res = Engine.simulate(level, scenarioFor(scn), program);
function scenarioFor(s) { return s; }
console.log('result:', res.result, '| message:', JSON.stringify(res.message), '| lines:', res.linesExecuted);
res.frames.forEach((f, i) => {
  console.log('--- frame', i, 'phase', f.phase, 'events', JSON.stringify(f.events || []));
  console.log('     player', JSON.stringify(f.golems.filter((g) => g.isPlayer).map((g) => ({ r: g.r, c: g.c, dir: g.dir, alive: g.alive }))));
  console.log('     bots  ', JSON.stringify(f.golems.filter((g) => !g.isPlayer).map((g) => ({ r: g.r, c: g.c, dir: g.dir, alive: g.alive, dmg: g.damage }))));
  console.log('     barrels', JSON.stringify(f.barrels));
});
