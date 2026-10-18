// Проверка УСЛОВИЙ ПОБЕДЫ по комнатам (то, что не видит validate: негативные
// случаи — «сделал нельзя» должно приводить к проигрышу с понятным сообщением).
//
// Запуск:  node tools/test-rules.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const win = { window: {} };
globalThis.window = win.window;
for (const p of ['js/data/levels-full.js', 'js/data/scenarios-full.js', 'js/data/levels.js', 'js/data/scenarios.js', 'js/programs.js', 'js/engine.js']) {
  new Function('window', fs.readFileSync(path.join(root, p), 'utf8'))(win.window);
}
const L = win.window.BG4_LEVELS;
const S = win.window.BG4.SCENARIOS;
const Prog = win.window.BG4.Prog;
const Engine = win.window.BG4.Engine;

let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; /* console.log('ok  ' + name); */ }
  else { fail++; console.log('FAIL  ' + name + (extra ? '  — ' + extra : '')); }
}
function run(id, text) {
  const level = L.rooms.find((r) => r.id === id);
  const scn = S[id] || {};
  const lines = Prog.parseSolution(text);
  const res = Engine.simulate(level, scn, { lines, endless: !!scn.endless });
  const last = res.frames[res.frames.length - 1];
  const player = (last.golems || []).find((g) => g.isPlayer) || {};
  return { res, last, player };
}
function expectFail(id, text, reMessage) {
  const r = run(id, text);
  const ok = r.res.result === 'fail' && (!reMessage || reMessage.test(r.res.message || ''));
  check(`${id}: «${text}» → проигрыш (${r.res.result}: ${r.res.message})`, ok, ok ? '' : 'ожидалось fail ' + reMessage);
  return r;
}
function expectWin(id, text) {
  const r = run(id, text);
  check(`${id}: «${text}» → ПОБЕДА (${r.res.result}: ${r.res.message})`, r.res.result === 'success');
  return r;
}

// ---- 1.4 / 1.5 / 3.4: Бочку нельзя сдвигать с места ----
expectFail('1.4', 'Вперед', /Бочку с места сдвигать нельзя/);
expectWin('1.4', 'Влево → Вперед → Вправо → Вперед');
expectFail('1.5', 'Вперед', /Бочку с места сдвигать нельзя/);
expectWin('1.5', 'Назад → Вправо → Вперед');
expectFail('3.4', 'Назад', /Бочку с места сдвигать нельзя/);
expectWin('3.4', 'Влево → Вперед → Влево → Цикл 2 (Вперед) → Вправо → Назад');

// ---- 2.2: обязательно разрушить Бочку ----
expectFail('2.2', 'Влево → Вперед → Вправо → Вперед', /Бочку нужно разрушить/);
expectWin('2.2', 'Атака → Вперед → Влево → Вперед');

// ---- 2.4: разрушить можно только ОДНУ бочку ----
expectFail('2.4', 'Атака → Вперед → Атака → Вперед → Вправо → Назад', /только одну Бочку/);
expectWin('2.4', 'Атака → Вперед → Вперед  → Вправо → Назад');

// ---- 2.5: к победе на поле должны остаться ровно ДВЕ бочки ----
expectFail('2.5', 'Влево → Вперед → Влево → Вперед → Вперед → Влево → Вперед → Вперед', /ровно 2 бочки/);
expectWin('2.5', 'Назад → Вправо → Атака → Вперед → Вправо → Вперед');

// ---- 2.6: обязательно атаковать Синего Голема ----
expectFail('2.6', 'Вперед → Вперед', /атаковать/);
expectWin('2.6', 'Вперед → Влево → Атака → Вправо → Вперед');

// ---- 2.7: Бочку разрушать нельзя (только Синего Голема) ----
expectFail('2.7', 'Назад → Вправо → Атака', /Бочку трогать нельзя/);
expectWin('2.7', 'Вправо → Атака → Вперед → Вперед → Влево → Назад');

// ---- 3.7 / 3.8 / 3.9: обязателен Цикл (3.7 — ещё и Атака) ----
// эталон с раскрытым Циклом: те же действия, но БЕЗ блока «Цикл» — не зачёт
expectFail('3.7', 'Назад → Назад → Вперед → Вправо → Атака', /Цикл/);
expectWin('3.7', 'Цикл 2 (Назад) → Вперед → Вправо → Атака');
expectFail('3.8', 'Вправо → Вправо → Вперед → Вправо → Атака', /Цикл/);
expectWin('3.8', 'Цикл 2 (Вправо) → Вперед → Вправо → Атака');
expectFail('3.9', 'Вперед → Вперед → Вправо → Вперед → Атака', /Цикл/);
expectWin('3.9', 'Цикл 2 (Вперед) → Вправо → Вперед → Атака');

// ---- 4.1: Условие строго в ПЕРВОЙ строке; 4.2/4.3: Условие обязательно ----
expectFail('4.1', 'Влево → Вперед', /ПЕРВОЙ строке/);
expectWin('4.1', 'Если <Препятствие>, то (Влево), Иначе (Защита) → Вперед');
expectFail('4.2', 'Назад → Назад', /Условие/);
expectWin('4.2', 'Вправо → Если <Препятствие>, то (Вправо), Иначе ( ) → Вперед → Вперед');
expectFail('4.3', 'Вперед → Атака', /Условие/);
expectWin('4.3', 'Вперед → Если <Препятствие>, то (Атака), Иначе ( )');

// ---- 4.7 / 4.9: «сломанный блок управления» — команды работают только внутри Условия ----
{
  const r = run('4.7', 'Влево');
  check('4.7: поворот вне Условия не срабатывает', r.player.dir === 'W' && r.player.r === 1 && r.player.c === 5, `dir=${r.player.dir} @${r.player.r},${r.player.c}`);
  expectWin('4.7', 'Вперед → Если <Препятствие>, то (), Иначе (Влево) → Вперед');
}
{
  const r = run('4.9', 'Вперед → Вправо');
  check('4.9: движение и поворот вне Условия не срабатывают', r.player.dir === 'N' && r.player.r === 2 && r.player.c === 4, `dir=${r.player.dir} @${r.player.r},${r.player.c}`);
  expectWin('4.9', 'Цикл 2 [Если <Препятствие>, то (Вправо), Иначе (Вперед)]');
}

// ---- 4.8: Бочка/Робот у края поля = проигрыш ----
expectFail('4.8', 'Стоять на месте → Стоять на месте', /края поля/);
expectWin('4.8', 'Цикл 2 [Если <Препятствие>, то (Атака), Иначе ()]');

// ---- 5.4: сначала разбить ВСЕ бочки, потом вставать на Цель ----
{
  const r = run('5.4', 'Вправо → Вперед → Влево → Вперед');
  check('5.4: «дойти до Цели, не разбив Бочки» → НЕ победа', r.res.result !== 'success', r.res.result + ' ' + r.res.message);
}
expectWin('5.4', 'Атака → Вперед → Если <Препятствие>, то (Атака), Иначе (Вправо)');

// ---- 4.5: Защита работает, только если Голем стоит лицом к противнику ----
{
  const mk = (dir) => ({
    id: 'T', floor: 9, title: 'test', commandLimit: null,
    bonuses: { defense: true },
    fields: [{ key: '4x4', row: 0, col: 0 }],
    start: { color: 'red', r: 1, c: 2, dir },
    bots: [{ color: 'blue', r: 1, c: 3, dir: 'W' }],
    goals: [], tokens: [],
  });
  const scn = { objective: { type: 'survive' }, lines: 1, constraints: { defenseFacing: true }, bots: [{ kind: 'attackAt', lines: [1] }] };
  const prg = { lines: [{ t: 'cmd', cmd: 'defend' }], endless: false };
  const facing = Engine.simulate(mk('E'), scn, prg);
  const back = Engine.simulate(mk('W'), scn, prg);
  const dmgOf = (res) => { const last = res.frames[res.frames.length - 1]; const p = (last.golems || []).find((g) => g.isPlayer) || {}; return p.damage || 0; };
  check('4.5: защита ЗАЩИЩАЕТ, когда Голем лицом к врагу', facing.result === 'success' && dmgOf(facing) === 0, `damage=${dmgOf(facing)} result=${facing.result}`);
  check('4.5: защита НЕ работает, когда Голем спиной к врагу', back.result !== 'success' || dmgOf(back) > 0, `damage=${dmgOf(back)} result=${back.result}`);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
