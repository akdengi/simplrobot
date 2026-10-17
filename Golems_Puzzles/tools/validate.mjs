// Validate every room against its reference solution using the real engine.
// Usage: node tools/validate.mjs [floor ...]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');

const win = { window: {} };
globalThis.window = win.window;
function load(p) { new Function('window', fs.readFileSync(path.join(root, p), 'utf8'))(win.window); }
// защищённые части подключаются первыми, как в браузере (js/license.js)
load('js/data/levels-full.js');
load('js/data/scenarios-full.js');
load('js/data/levels.js');
load('js/data/scenarios.js');
load('js/programs.js');
load('js/engine.js');

const { BG4_LEVELS: L } = win.window;
const S = win.window.BG4.SCENARIOS;
const Prog = win.window.BG4.Prog;
const Engine = win.window.BG4.Engine;

// «Жетоны из руки» (4.4): the game lets the player put the printed token on the
// board himself. The reference solution assumes he does it as the task says —
// on the cell in front of the player (which also creates the obstacle).
function withReserve(level) {
  const reserve = level.reserve || [];
  if (!reserve.length) return level;
  const keys = new Set(reserve.map((t) => t.row + ',' + t.col));
  const tokens = level.tokens.filter((t) => !keys.has(t.r + ',' + t.c));
  const p = level.start;
  const d = Engine.DIRS[p.dir];
  const r = p.r + d.dr, c = p.c + d.dc;
  for (const t of reserve) tokens.push({ r, c, layer: 1, t: t.t, type: t.type, rot: t.rot || 0 });
  return Object.assign({}, level, { tokens });
}

const floors = process.argv.slice(2).map(Number);
let pass = 0, fail = 0;
const failures = [];

for (const level of L.rooms) {
  if (floors.length && !floors.includes(level.floor)) continue;
  const scn = S[level.id] || {};
  const text = scn.answer || level.solutionText;
  const lines = Prog.parseSolution(text);
  const program = { lines, endless: !!scn.endless };
  const res = Engine.simulate(withReserve(level), scn, program);
  const ok = res.result === 'success';
  if (ok) pass++; else { fail++; failures.push({ id: level.id, text, lines, message: res.message, result: res.result }); }
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${level.id}  ${res.result}  ${res.message}`);
}

console.log(`\n${pass} passed, ${fail} failed`);
if (failures.length) {
  console.log('\n--- failures ---');
  for (const f of failures) {
    console.log(`${f.id}: ${f.message}`);
    console.log(`   text: ${f.text}`);
    console.log(`   ir  : ${JSON.stringify(f.lines)}`);
  }
}
