// Smoke: демо-сборка не должна содержать данных этажей 3–6; full-сборка — должна.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const win = { window: {} };
globalThis.window = win.window;
const load = (p, storage) => { new Function('window', fs.readFileSync(path.join(root, p), 'utf8'))(win.window); };

// --- ДЕМО: только публичные файлы ---
const demoWin = { window: {} };
globalThis.window = demoWin.window;
for (const p of ['js/data/levels.js', 'js/data/scenarios.js']) {
  new Function('window', fs.readFileSync(path.join(root, p), 'utf8'))(demoWin.window);
}
const Ld = demoWin.window.BG4_LEVELS;
const Sd = demoWin.window.BG4.SCENARIOS;
const okDemo =
  Ld.rooms.length === 20 && !Ld.rooms.some((r) => r.floor > 2) &&
  Ld.floors.length === 6 && Ld.floors.every((f) => f.total === 10) &&
  !Sd['3.1'] && !Sd['6.10'] && !!Sd['2.10'] &&
  !fs.readFileSync(path.join(root, 'js/data/levels.js'), 'utf8').includes('bombBarrel') &&
  !fs.readFileSync(path.join(root, 'js/data/scenarios.js'), 'utf8').includes('Пешка');
console.log(okDemo ? 'PASS  демо-сборка: 20 комнат, метаданные 6 этажей, без данных 3–6' : 'FAIL  демо-сборка протекает');
if (!okDemo) process.exit(1);

// --- FULL: все файлы, как в браузере при полном доступе ---
const fullWin = { window: {} };
globalThis.window = fullWin.window;
for (const p of ['js/data/levels-full.js', 'js/data/scenarios-full.js', 'js/data/levels.js', 'js/data/scenarios.js']) {
  new Function('window', fs.readFileSync(path.join(root, p), 'utf8'))(fullWin.window);
}
const Lf = fullWin.window.BG4_LEVELS;
const Sf = fullWin.window.BG4.SCENARIOS;
const okFull =
  Lf.rooms.length === 60 && Lf.rooms.some((r) => r.floor === 6) &&
  !!Sf['6.10'] && !!Sf['4.10'] && Sf['6.1'].bots[0].program.length === 1;
console.log(okFull ? 'PASS  full-сборка: все 60 комнат и сценарии этажей 3–6' : 'FAIL  full-сборка сломана');
if (!okFull) process.exit(1);
console.log('2 passed, 0 failed');
