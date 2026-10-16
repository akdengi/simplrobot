// Unit tests for the program model: Python round-trips and reference-solution parsing.
// Usage: node tools/test-programs.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const win = { window: {} };
globalThis.window = win.window;
function load(p) { new Function('window', fs.readFileSync(path.join(root, p), 'utf8'))(win.window); }
load('js/programs.js');
const P = win.window.BG4.Prog;

let pass = 0, fail = 0;
function eq(name, got, want) {
  const a = JSON.stringify(got), b = JSON.stringify(want);
  if (a === b) { pass++; console.log('PASS  ' + name); }
  else { fail++; console.log('FAIL  ' + name + '\n   got:  ' + a + '\n   want: ' + b); }
}

// --- Python parsing (indentation bugs used to break nested blocks) ---
const cfg = 'forward()\nif obstacle:\n    right()\nelse:\n    left()\nrepeat(2):\n    forward()';
let r = P.parsePython(cfg);
eq('python: no errors', r.errors, []);
eq('python: nested structure', r.model, {
  lines: [
    { t: 'cmd', cmd: 'forward' },
    { t: 'if', then: { t: 'cmd', cmd: 'right' }, else: { t: 'cmd', cmd: 'left' } },
    { t: 'loop', body: { t: 'cmd', cmd: 'forward' } },
  ],
  endless: false,
});
eq('python: render round-trip', P.toPython(r.model), cfg);

r = P.parsePython('while True:\n    forward()\n    if obstacle:\n        right()');
eq('python: while True => endless', r.model.endless, true);
eq('python: while body parsed', r.model.lines, [
  { t: 'cmd', cmd: 'forward' },
  { t: 'if', then: { t: 'cmd', cmd: 'right' }, else: null },
]);

r = P.parsePython('вперёд\nвлево\nудар');
eq('python: russian words', r.model.lines, [
  { t: 'cmd', cmd: 'forward' }, { t: 'cmd', cmd: 'left' }, { t: 'cmd', cmd: 'attack' },
]);

r = P.parsePython('forward()\n# comment\n\nbroken line');
eq('python: unknown line error', r.errors.length, 1);

// --- reference solution parsing ---
eq('solution: arrows', P.parseSolution('Вперед → Вперед'), [{ t: 'cmd', cmd: 'forward' }, { t: 'cmd', cmd: 'forward' }]);
eq('solution: if/else', P.parseSolution('Если Препятствие, то (Влево), Иначе (Защита)'), [
  { t: 'if', then: { t: 'cmd', cmd: 'left' }, else: { t: 'cmd', cmd: 'defend' } },
]);
eq('solution: цикл 2', P.parseSolution('Цикл 2 (Вперед)'), [{ t: 'loop', body: { t: 'cmd', cmd: 'forward' } }]);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
