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
const Prog = win.window.BG4.Prog;
const Engine = win.window.BG4.Engine;

const CMDS = ['forward', 'back', 'left', 'right', 'attack', 'defend', 'wait'];
const WORDS = { forward: 'Вперед', back: 'Назад', left: 'Влево', right: 'Вправо', attack: 'Удар', defend: 'Защита', wait: 'Ждать' };

function run(level, scn, seq) {
  const lines = seq.map((c) => ({ t: 'cmd', cmd: c }));
  return Engine.simulate(level, scn, { lines, endless: !!scn.endless });
}

function search(level, scn, maxDepth) {
  for (let depth = 0; depth <= maxDepth; depth++) {
    const total = Math.pow(CMDS.length, depth);
    for (let i = 0; i < total; i++) {
      const seq = [];
      let x = i;
      for (let d = 0; d < depth; d++) { seq.push(CMDS[x % CMDS.length]); x = Math.floor(x / CMDS.length); }
      const res = run(level, scn, seq);
      if (res.result === 'success') return seq;
    }
    console.log('  depth', depth, 'done');
  }
  return null;
}

for (const id of process.argv.slice(2)) {
  const level = L.rooms.find((r) => r.id === id);
  const scn = S[id] || {};
  console.log('=====', id, 'course solution:', JSON.stringify(level.solutionText));
  const courseLines = Prog.parseSolution(level.solutionText);
  const courseRes = Engine.simulate(level, scn, { lines: courseLines, endless: !!scn.endless });
  console.log('  course ->', courseRes.result, courseRes.message);
  if (courseRes.result === 'success') { console.log('  OK: use course solution'); continue; }
  const found = search(level, scn, 9);
  if (found) console.log('  FOUND:', found.map((c) => WORDS[c]).join(' → '), '|', JSON.stringify(found));
  else console.log('  no solution found up to depth 9');
}
