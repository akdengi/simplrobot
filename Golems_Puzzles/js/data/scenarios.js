/*
 * Golems Puzzles — per-room scenarios.
 *
 * For every room of the course we describe HOW it is played:
 *   objective   – win condition (goal | defeat | survive | destroyBarrel | soakBarrel)
 *   constraints – noDamage, mustDamageBots, noBarrelDamage, keepBots,
 *                 noBarrelMove (1.4/1.5/3.4 — Бочку нельзя сдвигать),
 *                 maxBarrelsBroken (2.4 — разрушить можно только N бочек),
 *                 barrelsRemaining (2.5 — сколько бочек осталось к победе),
 *                 destroyAllBarrels (5.4 — разбить ВСЕ бочки),
 *                 defenseFacing (4.5 — Защита работает только лицом к врагу),
 *                 edgeFail: 'W'|'E'|'N'|'S' (4.8 — Бочка/Робот у края = проигрыш)
 *   requires    – обязательные элементы программы: { loop, attack, condition,
 *                 conditionFirst } (3.7/3.8/3.9 — Цикл; 4.1/4.2/4.3 — Условие)
 *   bots        – behaviour of the enemy golems (idle | attackAt | everyLine | program | perLineProgram)
 *   dynamics    – moving barrels (floor 5)
 *   endless     – program is repeated until the goal is met (floors 5.1–5.4)
 *   botGoal     – a bot that reaches a "goal" tile makes the player lose (floor 6)
 *   params      – особые механики комнаты, независимые от objective/bots.
 *                 Пока одна: params.bombBarrel = { fuse, radius, damage } — бомба в
 *                 Бочке (взрыв при атаке по сухой Бочке и после `fuse` команд, если
 *                 Бочка не оказалась в воде); пример — комната 4.10.
 *
 * Bot block-language (see engine.js runBotNode):
 *   { c:'move', n }  { c:'turn', d:'cw'|'ccw', n }  { c:'attack' }
 *   { c:'repeat', n, body:[...] }
 *   { c:'ifSee', side:'front'|'both', then, else }   – «Вижу противника на расстоянии 1»
 *   { c:'ifObstacle', n:0|1, then, else }            – «Препятствие = n»
 *   { c:'ifAttack', n:1, then, else }                – «Можно в Атаку = n»
 *   { c:'ai', value }                                – «Кинь AI кубик»
 *
 * Reference solutions are taken from the course (solutionText). A few rooms in the
 * course use a wrong/idealised answer; those get an explicit `answer` override here.
 */
(function () {
  'use strict';
  const BG4 = (window.BG4 = window.BG4 || {});

  const goal = { type: 'goal' };
  const defeat = { type: 'defeat' };

  const S = {};

  // ---------- floor 1: simple movement ----------
  for (const id of ['1.1', '1.2', '1.3', '1.4', '1.5', '1.6', '1.7', '1.8', '1.9', '1.10']) S[id] = { objective: goal };
  // 1.4/1.5: «Бочки сдвигать нельзя» — сдвинул Бочку → проиграл.
  S['1.4'] = { objective: goal, constraints: { noBarrelMove: true } };
  S['1.5'] = { objective: goal, constraints: { noBarrelMove: true } };

  // ---------- floor 2: attack & defence ----------
  S['2.1'] = { objective: goal };
  // 2.2: «обязательно разрушив Бочку» — без разрушенной Бочки победы нет.
  S['2.2'] = { objective: goal, barrelsMustBeGone: true };
  S['2.3'] = { objective: goal };
  // 2.4: «разрушив только ОДНУ бочку».
  S['2.4'] = { objective: goal, constraints: { maxBarrelsBroken: 1 } };
  // 2.5: «к моменту победы на поле должны остаться только ДВЕ бочки».
  S['2.5'] = { objective: goal, constraints: { barrelsRemaining: 2 } };
  S['2.6'] = { objective: goal, constraints: { mustDamageBots: true } };
  S['2.7'] = { objective: goal, constraints: { mustDamageBots: true, noBarrelDamage: true } };
  S['2.8'] = { objective: goal, constraints: { noDamage: true }, bots: [{ kind: 'attackAt', lines: [2] }] };
  S['2.9'] = { objective: goal, constraints: { noDamage: true }, bots: [{ kind: 'attackAt', lines: [1, 4] }] };
  S['2.10'] = { objective: defeat, bots: [{ kind: 'everyLine', cmd: 'forward' }] };

  // Этажи 3–6 («Циклы», «Условия», «Автономные Големы», «Шахматный Этаж») — это
  // ЗАЩИЩЁННАЯ часть данных: они приходят из js/data/scenarios-full.js, который
  // на сервере отдаётся только при полном доступе (cookie-ключ, см. README).
  // js/license.js подключает его до этого файла, поэтому здесь просто дописываем.
  if (window.BG4_SCENARIOS_EXTRA) for (const id in window.BG4_SCENARIOS_EXTRA) S[id] = window.BG4_SCENARIOS_EXTRA[id];

  BG4.SCENARIOS = S;
})();
