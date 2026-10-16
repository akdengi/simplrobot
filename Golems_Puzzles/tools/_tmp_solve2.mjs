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

const CMDS = ['forward', 'back', 'left', 'right', 'attack', 'defend', 'wait'];
const WORDS = { forward: 'Вперед', back: 'Назад', left: 'Влево', right: 'Вправо', attack: 'Удар', defend: 'Защита', wait: 'Ждать' };

const id = process.argv[2];
const maxDepth = Number(process.argv[3] || 6);
const requireAttack = process.argv[4] !== 'noattack';
const level = L.rooms.find((r) => r.id === id);
const scn = S[id] || {};

function run(seq) {
  return Engine.simulate(level, scn, { lines: seq.map((c) => ({ t: 'cmd', cmd: c })), endless: !!scn.endless });
}

for (let depth = 1; depth <= maxDepth; depth++) {
  let best = null;
  const total = Math.pow(CMDS.length, depth);
  for (let i = 0; i < total; i++) {
    const seq = [];
    let x = i;
    for (let d = 0; d < depth; d++) { seq.push(CMDS[x % CMDS.length]); x = Math.floor(x / CMDS.length); }
    if (requireAttack && !seq.includes('attack')) continue;
    if (run(seq).result === 'success') { best = seq; break; }
  }
  console.log('depth', depth, best ? '-> ' + best.map((c) => WORDS[c]).join(' → ') : 'none');
  if (best) break;
}
