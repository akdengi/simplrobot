// Trace a single room's simulation: prints the log line by line.
// Usage: node tools/trace.mjs 5.6
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const win = { window: {} };
globalThis.window = win.window;
const load = (p) => new Function('window', fs.readFileSync(path.join(root, p), 'utf8'))(win.window);
load('js/data/levels.js'); load('js/data/scenarios.js'); load('js/programs.js'); load('js/engine.js');
const L = win.window.BG4_LEVELS.rooms;
const S = win.window.BG4.SCENARIOS;
const Prog = win.window.BG4.Prog;
const Engine = win.window.BG4.Engine;

for (const id of process.argv.slice(2)) {
  const level = L.find((r) => r.id === id);
  const scn = S[id] || {};
  const text = scn.answer || level.solutionText;
  const program = { lines: Prog.parseSolution(text), endless: !!scn.endless };
  console.log(`=== ${id} ===`);
  console.log('text :', text);
  console.log('ir   :', JSON.stringify(program.lines));
  const res = Engine.simulate(level, scn, program);
  console.log('result:', res.result, res.message, 'lines:', res.linesExecuted);
  for (const f of res.frames) {
    const p = f.golems.find((g) => g.isPlayer);
    const bots = f.golems.filter((g) => !g.isPlayer).map((g) => `${g.color}@${g.r},${g.c}${g.dir} dmg${g.damage}`).join(' ');
    console.log(`  [${f.phase}${f.line ? ' L' + f.line : ''}] P@${p ? p.r + ',' + p.c + p.dir + ' dmg' + p.damage : 'DEAD'} | ${bots} | ${(f.events || []).map((e) => e.type).join(',')}`);
  }
  console.log('log:', res.log.join(' | '));
  console.log();
}
