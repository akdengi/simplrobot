// temp: brute-force a short working program for a room (cards editor vocabulary)
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
const L = win.window.BG4_LEVELS;
const S = win.window.BG4.SCENARIOS;
const Engine = win.window.BG4.Engine;

const CMDS = ['forward', 'back', 'left', 'right', 'attack', 'defend', 'wait'];
const RU = { forward: 'Вперед', back: 'Назад', left: 'Поворот влево', right: 'Поворот вправо', attack: 'Удар', defend: 'Защита', wait: 'Стоять на месте' };
const maxLen = Number(process.argv[3] || 5);

for (const id of process.argv[2].split(',')) {
  const level = L.rooms.find((r) => r.id === id);
  const scn = S[id] || {};
  let found = [];
  const tryLen = (len) => {
    const seq = [];
    const rec = (i) => {
      if (found.length >= 6) return;
      if (i === len) {
        const res = Engine.simulate(level, scn, { lines: seq.map((c) => ({ t: 'cmd', cmd: c })), endless: !!scn.endless });
        if (res.result === 'success') found.push(seq.slice());
        return;
      }
      for (const c of CMDS) { seq.push(c); rec(i + 1); seq.pop(); if (found.length >= 6) return; }
    };
    rec(0);
    return found.length > 0;
  };
  for (let len = 1; len <= maxLen && !found.length; len++) tryLen(len);
  console.log(`=== ${id}`);
  console.log(found.length ? found.map((f) => '   ' + f.map((c) => RU[c]).join(' → ')).join('\n') : `   none up to ${maxLen}`);
}
