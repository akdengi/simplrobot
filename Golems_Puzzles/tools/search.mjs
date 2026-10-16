// Brute-force search for a short winning program for a room.
// Usage: node tools/search.mjs 6.1 6.2 ...   (maxLen optional via MAXLEN env)
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
const Engine = win.window.BG4.Engine;

const CMDS = ['forward', 'back', 'left', 'right', 'wait', 'attack', 'defend'];
const RU = { forward: 'Вперед', back: 'Назад', left: 'Влево', right: 'Вправо', wait: 'Стоять на месте', attack: 'Удар', defend: 'Защита' };
const MAX = Number(process.env.MAXLEN || 5);

function mkSeq(cmds) { return cmds.map((c) => ({ t: 'cmd', cmd: c })); }
function text(cmds) { return cmds.map((c) => RU[c]).join(' → '); }

for (const id of process.argv.slice(2)) {
  const level = L.find((r) => r.id === id);
  const scn = S[id] || {};
  let found = null;
  const cmds = [];
  function rec() {
    if (found) return;
    const res = Engine.simulate(level, scn, { lines: mkSeq(cmds), endless: false });
    if (res.result === 'success') { found = cmds.slice(); return; }
    if (cmds.length >= MAX) return;
    for (const c of CMDS) { cmds.push(c); rec(); if (found) return; cmds.pop(); }
  }
  rec();
  console.log(id, found ? `FOUND: ${text(found)}` : `none up to ${MAX}`);
}
