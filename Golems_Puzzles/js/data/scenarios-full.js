/*
 * Golems Puzzles — ЗАЩИЩЁННЫЕ сценарии этажей 3–6.
 *
 * На сервере nginx отдаёт этот файл только с cookie-ключом, который выдаётся
 * при заходе со страницы курса (см. README, раздел «Полная версия и ДЕМО-режим»).
 * В ДЕМО-сборке файл не запрашивается вовсе: js/license.js подключает его через
 * document.write только при полном доступе, а js/data/scenarios.js затем
 * дописывает эти сценарии в общий список BG4.SCENARIOS.
 *
 * Формат сценариев — как в js/data/scenarios.js (см. описание там).
 */
(function () {
  'use strict';

  // ---------- reusable bot programs (шахматные фигуры и пр.) ----------
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

  window.BG4_SCENARIOS_EXTRA = {

    // ---------- floor 3: loops ----------
    '3.1': { objective: { type: 'goal' } },
    '3.2': { objective: { type: 'goal' } },
    '3.3': { objective: { type: 'goal' } },
    '3.4': { objective: { type: 'goal' } },
    '3.5': { objective: { type: 'goal' } },
    '3.6': { objective: { type: 'goal' } },
    // 3.7/3.9 — атаковать Синего можно только в лоб (по передней части),
    // 3.8 — только сбоку (проверяется по последней атаке, см. engine resolveLine)
    '3.7': { objective: { type: 'defeat' }, constraints: { frontOnly: true } },
    '3.8': { objective: { type: 'defeat' }, constraints: { flankOnly: true } },
    '3.9': { objective: { type: 'defeat' }, constraints: { frontOnly: true } },
    '3.10': { objective: { type: 'defeat' }, bots: [{ hp: 2 }] },

    // ---------- floor 4: conditions ----------
    '4.1': { objective: { type: 'goal' }, answer: 'Если <Препятствие>, то (Влево), Иначе (Защита) → Вперед' },
    '4.2': { objective: { type: 'goal' } },
    '4.3': { objective: { type: 'defeat' } },
    '4.4': { objective: { type: 'goal' }, constraints: { mustDamageBots: true }, requireObstacle: true },
    '4.5': { objective: { type: 'survive' }, lines: 2, constraints: { noDamage: true }, bots: [{ kind: 'randomProgram' }] },
    '4.6': { objective: { type: 'defeat' } },
    '4.7': { objective: { type: 'goal' }, params: { inConditionOnly: ['left', 'right'] } },
    // Синий Голем шагает Вперед перед каждой НАШЕЙ командой (в том числе внутри Цикла)
    '4.8': { objective: { type: 'defeat' }, bots: [{ kind: 'everyCommand', cmd: 'forward' }] },
    '4.9': { objective: { type: 'goal' }, params: { inConditionOnly: ['forward', 'back', 'left', 'right'] } },
    '4.10': {
      objective: { type: 'soakBarrel' },
      // В Бочке бомба: атака по сухой Бочке и «предохранитель» (после 1 выполненной
      // команды, если Бочка всё ещё на суше) дают взрыв (радиус 1, урон смертельный).
      params: { bombBarrel: { fuse: 1, radius: 1, damage: 4 } },
    },

    // ---------- floor 5: autonomous / dynamic ----------
    '5.1': { objective: { type: 'goal' }, endless: true },
    '5.2': { objective: { type: 'goal' }, endless: true },
    '5.3': { objective: { type: 'defeat' }, endless: true },
    '5.4': { objective: { type: 'goal' }, endless: true, commandLimit: 4, answer: 'Вправо → Вперед → Влево → Вперед' },
    '5.5': {
      objective: { type: 'goal' },
      dynamics: [{ when: 'before', mode: 'pingpong', cells: [[2, 6], [2, 5], [2, 4], [2, 3]] }],
    },
    '5.6': {
      objective: { type: 'goal' },
      answer: 'Вперед → Вперед → Вперед → Влево → Вперед → Вперед',
      dynamics: [{ when: 'before', mode: 'pingpong', cells: [[2, 6], [2, 5], [2, 4], [2, 3]] }],
    },
    '5.7': {
      objective: { type: 'goal' },
      // «Дойди до Цели не взорвавшись и РАЗРУШИВ бочку!» — дойти мало, Бочка
      // должна быть разбита Големом (самовзорвавшаяся на Целевой точке не зачёт)
      barrelsMustBeGone: true,
      // Бочка сдетонирует, доехав до Целевой точки (последняя клетка Линии)
      dynamics: [{ when: 'after', mode: 'line', cells: [[3, 3], [3, 4], [3, 5], [3, 6]], explodeOnGoal: true }],
    },
    '5.8': {
      objective: { type: 'goal' },
      // crush: Бочка наезжает на Голема (и на клетку, куда он приходит) — проигрыш
      dynamics: [
        { when: 'before', mode: 'pingpong', cells: [[1, 3], [1, 4], [1, 5], [1, 6]], crush: true },
        { when: 'before', mode: 'pingpong', cells: [[2, 4], [2, 5]], crush: true },
      ],
    },
    '5.9': {
      objective: { type: 'goal' },
      // Старый эталон ждал на (1,4), и по новым условиям (crush) Бочка наезжала на Голема.
      // Новый: Голем отталкивает Бочку назад с кольца (Назад в (2,4)), обходит
      // кольцо с востока и заходит на Цель без Бочки на рельсах.
      answer: 'Вперед → Вперед → Назад → Вперед → Вправо → Вперед → Вперед',
      crush: true,
      dynamics: [{ when: 'before', mode: 'loop', cells: [[1, 4], [1, 5], [2, 5], [2, 4]], crush: true }],
    },
    '5.10': {
      objective: { type: 'defeat' },
      aiTable: { 1: 'forward', 2: 'right', 3: 'left', 4: 'back', 5: 'attack', 6: 'wait' },
      bots: [{
        kind: 'program',
        name: 'Автономный голем',
        program: [{ c: 'ifObstacle', n: 0, then: [move(1)], else: [{ c: 'ifAttack', n: 1, then: [attack()], else: [{ c: 'ai', value: 2 }] }] }],
      }],
    },

    // ---------- floor 6: chess room ----------
    // Bots execute the printed block-programs from the course before every player command.
    '6.1': { objective: { type: 'defeat' }, bots: [{ kind: 'program', name: 'Пешка', piece: 'pawn', program: PAWN }] },
    '6.2': { objective: { type: 'defeat' }, bots: [{ kind: 'program', name: 'Слон', program: BISHOP }], answer: 'Назад → Назад → Влево → Вперед → Атака' },
    '6.3': { objective: { type: 'defeat' }, bots: [{ kind: 'program', name: 'Ладья', program: ROOK }], answer: 'Вперед → Вперед → Влево → Атака' },
    '6.4': { objective: { type: 'defeat' }, bots: [{ kind: 'program', name: 'Конь', program: KNIGHT }], answer: 'Вперед → Влево → Вперед → Влево → Атака' },
    '6.5': { objective: { type: 'defeat' }, bots: [{ kind: 'perLineProgram', name: 'Королева', lines: QUEEN }], answer: 'Вперед → Вперед → Влево → Назад → Атака' },
    '6.6': { objective: { type: 'defeat', targets: ['green'] }, constraints: { keepBots: true }, bots: [{ kind: 'program', name: 'Пешка', piece: 'pawn', program: PAWN }, { kind: 'program', name: 'Пешка', piece: 'pawn', program: PAWN }], answer: 'Влево → Вперед → Вправо → Атака' },
    '6.7': { objective: { type: 'defeat' }, bots: [{ kind: 'perLineProgram', name: 'Ладья', lines: ROOK_VAR }] },
    '6.8': { objective: { type: 'defeat' }, bots: [{ kind: 'perLineProgram', name: 'Сломанный конь', lines: BROKEN_KNIGHT }, { kind: 'perLineProgram', name: 'Сломанный конь', lines: BROKEN_KNIGHT }], answer: 'Влево → Назад → Защита → Атака' },
    '6.9': { objective: { type: 'defeat' }, bots: [{ kind: 'program', name: 'Сломанная ладья', program: BROKEN_ROOK }, { kind: 'program', name: 'Сломанная ладья', program: BROKEN_ROOK }, { kind: 'program', name: 'Сломанная ладья', program: BROKEN_ROOK }], answer: 'Атака → Влево → Атака → Вперед → Влево → Атака' },
    '6.10': { objective: { type: 'defeat' }, bots: [{ kind: 'perLineProgram', name: 'Король', lines: KING }], answer: 'Вперед → Вперед → Назад → Вправо → Атака' },
  };
})();
