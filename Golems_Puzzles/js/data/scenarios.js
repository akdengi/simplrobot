/*
 * Golems Puzzles — per-room scenarios.
 *
 * For every room of the course we describe HOW it is played:
 *   objective   – win condition (goal | defeat | survive | destroyBarrel | soakBarrel)
 *   constraints – noDamage, mustDamageBots, noBarrelDamage, keepBots
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

  // ---------- reusable bot programs ----------
  const move = (n) => ({ c: 'move', n: n || 1 });
  const turn = (d, n) => ({ c: 'turn', d, n: n || 90 });
  const attack = () => ({ c: 'attack' });

  const PAWN = [{ c: 'ifSee', side: 'both', then: [attack()], else: [move(1)] }];
  const BISHOP = [{ c: 'ifSee', side: 'front', then: [attack()], else: [move(1), turn('cw'), move(1), turn('cw')] }];
  const ROOK = [{ c: 'ifSee', side: 'front', then: [attack()], else: [{ c: 'repeat', n: 3, body: [move(1)] }, turn('cw')] }];
  const KNIGHT = [move(1), move(1), turn('cw'), move(1), attack()];

  const QUEEN = {
    1: [{ c: 'repeat', n: 3, body: [move(1)] }, turn('cw'), attack()],
    2: [{ c: 'repeat', n: 2, body: [move(1)] }, turn('cw'), attack()],
    3: [{ c: 'repeat', n: 2, body: [move(1), turn('cw'), move(1), turn('cw')] }, attack()],
    4: [move(1), turn('cw'), move(1)],
    default: [move(1), turn('cw'), move(1)],
  };
  const ROOK_VAR = {
    1: [{ c: 'repeat', n: 3, body: [move(1)] }, turn('cw'), attack()],
    2: [move(1), move(1), turn('cw')],
    3: [{ c: 'repeat', n: 3, body: [move(1)] }, attack(), turn('cw')],
    4: [move(1), turn('cw'), { c: 'repeat', n: 3, body: [move(1)] }],
    default: [move(1)],
  };
  const BROKEN_KNIGHT = {
    1: [{ c: 'repeat', n: 2, body: [move(1)] }, attack(), turn('cw'), move(1)],
    2: [{ c: 'repeat', n: 2, body: [move(1)] }, attack(), turn('cw'), move(1)],
    3: [move(1), turn('cw'), { c: 'repeat', n: 2, body: [move(1)] }, attack()],
    4: [move(1), turn('cw'), { c: 'repeat', n: 2, body: [move(1)] }, attack()],
    default: [move(1)],
  };
  const KING = {
    1: [{ c: 'ifSee', side: 'front', then: [attack()], else: [turn('cw')] }],
    2: [{ c: 'ifSee', side: 'front', then: [attack()], else: [{ c: 'repeat', n: 2, body: [turn('cw')] }] }],
    3: [{ c: 'ifSee', side: 'front', then: [attack()], else: [turn('cw')] }],
    4: [move(1)],
    default: [move(1)],
  };
  const BROKEN_ROOK = [{ c: 'ifSee', side: 'front', then: [attack()], else: [move(1)] }];

  const goal = { type: 'goal' };
  const defeat = { type: 'defeat' };

  const S = {};

  // ---------- floor 1: simple movement ----------
  for (const id of ['1.1', '1.2', '1.3', '1.4', '1.5', '1.6', '1.7', '1.8', '1.9', '1.10']) S[id] = { objective: goal };

  // ---------- floor 2: attack & defence ----------
  S['2.1'] = { objective: goal };
  S['2.2'] = { objective: goal };
  S['2.3'] = { objective: goal };
  S['2.4'] = { objective: goal };
  S['2.5'] = { objective: goal };
  S['2.6'] = { objective: goal, constraints: { mustDamageBots: true } };
  S['2.7'] = { objective: goal, constraints: { mustDamageBots: true, noBarrelDamage: true } };
  S['2.8'] = { objective: goal, constraints: { noDamage: true }, bots: [{ kind: 'attackAt', lines: [2] }] };
  S['2.9'] = { objective: goal, constraints: { noDamage: true }, bots: [{ kind: 'attackAt', lines: [1, 4] }] };
  S['2.10'] = { objective: defeat, bots: [{ kind: 'everyLine', cmd: 'forward' }] };

  // ---------- floor 3: loops ----------
  for (const id of ['3.1', '3.2', '3.3', '3.4', '3.5', '3.6']) S[id] = { objective: goal };
  // 3.7/3.9 — атаковать Синего можно только в лоб (по передней части),
  // 3.8 — только сбоку (проверяется по последней атаке, см. engine resolveLine)
  S['3.7'] = { objective: defeat, constraints: { frontOnly: true } };
  S['3.8'] = { objective: defeat, constraints: { flankOnly: true } };
  S['3.9'] = { objective: defeat, constraints: { frontOnly: true } };
  S['3.10'] = { objective: defeat, bots: [{ hp: 2 }] };

  // ---------- floor 4: conditions ----------
  S['4.1'] = { objective: goal, answer: 'Если <Препятствие>, то (Влево), Иначе (Защита) → Вперед' };
  S['4.2'] = { objective: goal };
  S['4.3'] = { objective: defeat };
  S['4.4'] = { objective: goal, constraints: { mustDamageBots: true }, requireObstacle: true };
  S['4.5'] = { objective: { type: 'survive' }, lines: 2, constraints: { noDamage: true }, bots: [{ kind: 'randomProgram' }] };
  S['4.6'] = { objective: defeat };
  S['4.7'] = { objective: goal, params: { inConditionOnly: ['left', 'right'] } };
  // Синий Голем шагает Вперед перед каждой НАШЕЙ командой (в том числе внутри Цикла)
  S['4.8'] = { objective: defeat, bots: [{ kind: 'everyCommand', cmd: 'forward' }] };
  S['4.9'] = { objective: goal, params: { inConditionOnly: ['forward', 'back', 'left', 'right'] } };
  S['4.10'] = {
    objective: { type: 'soakBarrel' },
    // В Бочке бомба: атака по сухой Бочке и «предохранитель» (после 1 выполненной
    // команды, если Бочка всё ещё на суше) дают взрыв (радиус 1, урон смертельный).
    params: { bombBarrel: { fuse: 1, radius: 1, damage: 4 } },
  };

  // ---------- floor 5: autonomous / dynamic ----------
  S['5.1'] = { objective: goal, endless: true };
  S['5.2'] = { objective: goal, endless: true };
  S['5.3'] = { objective: defeat, endless: true };
  S['5.4'] = { objective: goal, endless: true, commandLimit: 4, answer: 'Вправо → Вперед → Влево → Вперед' };
  S['5.5'] = {
    objective: goal,
    dynamics: [{ when: 'before', mode: 'pingpong', cells: [[2, 6], [2, 5], [2, 4], [2, 3]] }],
  };
  S['5.6'] = {
    objective: goal,
    answer: 'Вперед → Вперед → Вперед → Влево → Вперед → Вперед',
    dynamics: [{ when: 'before', mode: 'pingpong', cells: [[2, 6], [2, 5], [2, 4], [2, 3]] }],
  };
  S['5.7'] = {
    objective: goal,
    dynamics: [{ when: 'after', mode: 'line', cells: [[3, 3], [3, 4], [3, 5], [3, 6]] }],
  };
  S['5.8'] = {
    objective: goal,
    dynamics: [
      { when: 'before', mode: 'pingpong', cells: [[1, 3], [1, 4], [1, 5], [1, 6]] },
      { when: 'before', mode: 'pingpong', cells: [[2, 4], [2, 5]] },
    ],
  };
  S['5.9'] = {
    objective: goal,
    answer: 'Вперед → Вперед → Вправо → Вперед → Вперед',
    dynamics: [{ when: 'before', mode: 'loop', cells: [[1, 4], [1, 5], [2, 5], [2, 4]] }],
  };
  S['5.10'] = {
    objective: { type: 'defeat' },
    aiTable: { 1: 'forward', 2: 'right', 3: 'left', 4: 'back', 5: 'attack', 6: 'wait' },
    bots: [{
      kind: 'program',
      name: 'Автономный голем',
      program: [{ c: 'ifObstacle', n: 0, then: [move(1)], else: [{ c: 'ifAttack', n: 1, then: [attack()], else: [{ c: 'ai', value: 2 }] }] }],
    }],
  };

  // ---------- floor 6: chess room ----------
  // Bots execute the printed block-programs from the course before every player command.
  S['6.1'] = { objective: defeat, bots: [{ kind: 'program', name: 'Пешка', piece: 'pawn', program: PAWN }] };
  S['6.2'] = { objective: defeat, bots: [{ kind: 'program', name: 'Слон', program: BISHOP }], answer: 'Назад → Назад → Влево → Вперед → Атака' };
  S['6.3'] = { objective: defeat, bots: [{ kind: 'program', name: 'Ладья', program: ROOK }], answer: 'Вперед → Вперед → Влево → Атака' };
  S['6.4'] = { objective: defeat, bots: [{ kind: 'program', name: 'Конь', program: KNIGHT }], answer: 'Вперед → Влево → Вперед → Влево → Атака' };
  S['6.5'] = { objective: defeat, bots: [{ kind: 'perLineProgram', name: 'Королева', lines: QUEEN }], answer: 'Вперед → Вперед → Влево → Назад → Атака' };
  S['6.6'] = { objective: { type: 'defeat', targets: ['green'] }, constraints: { keepBots: true }, bots: [{ kind: 'program', name: 'Пешка', piece: 'pawn', program: PAWN }, { kind: 'program', name: 'Пешка', piece: 'pawn', program: PAWN }], answer: 'Влево → Вперед → Вправо → Атака' };
  S['6.7'] = { objective: defeat, bots: [{ kind: 'perLineProgram', name: 'Ладья', lines: ROOK_VAR }] };
  S['6.8'] = { objective: defeat, bots: [{ kind: 'perLineProgram', name: 'Сломанный конь', lines: BROKEN_KNIGHT }, { kind: 'perLineProgram', name: 'Сломанный конь', lines: BROKEN_KNIGHT }], answer: 'Влево → Назад → Защита → Атака' };
  S['6.9'] = { objective: defeat, bots: [{ kind: 'program', name: 'Сломанная ладья', program: BROKEN_ROOK }, { kind: 'program', name: 'Сломанная ладья', program: BROKEN_ROOK }, { kind: 'program', name: 'Сломанная ладья', program: BROKEN_ROOK }], answer: 'Атака → Влево → Атака → Вперед → Влево → Атака' };
  S['6.10'] = { objective: defeat, bots: [{ kind: 'perLineProgram', name: 'Король', lines: KING }], answer: 'Вперед → Вперед → Назад → Вправо → Атака' };

  BG4.SCENARIOS = S;
})();
