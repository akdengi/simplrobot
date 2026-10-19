/*
 * Golems Puzzles — ЗАЩИЩЁННЫЕ сценарии этажей 3–7.
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

  // Этаж 7: победа — оба Голема игрока на своих Целевых точках в один ход.
  const twinGoals = { type: 'twinGoals' };

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
    '3.4': { objective: { type: 'goal' }, constraints: { noBarrelMove: true } },
    '3.5': { objective: { type: 'goal' } },
    '3.6': { objective: { type: 'goal' } },
    // 3.7/3.9 — атаковать Синего можно только в лоб (по передней части),
    // 3.8 — только сбоку (проверяется по последней атаке, см. engine resolveLine)
    // И во всех трёх ОБЯЗАТЕЛЬНО использовать Цикл (3.7 — ещё и Атаку).
    '3.7': { objective: { type: 'defeat' }, constraints: { frontOnly: true }, requires: { loop: true, attack: true } },
    '3.8': { objective: { type: 'defeat' }, constraints: { flankOnly: true }, requires: { loop: true } },
    '3.9': { objective: { type: 'defeat' }, constraints: { frontOnly: true }, requires: { loop: true } },
    '3.10': { objective: { type: 'defeat' }, bots: [{ hp: 2 }] },

    // ---------- floor 4: conditions ----------
    '4.1': { objective: { type: 'goal' }, requires: { conditionFirst: true }, answer: 'Если <Препятствие>, то (Влево), Иначе (Защита) → Вперед' },
    '4.2': { objective: { type: 'goal' }, requires: { condition: true } },
    '4.3': { objective: { type: 'defeat' }, requires: { condition: true } },
    '4.4': { objective: { type: 'goal' }, constraints: { mustDamageBots: true }, requireObstacle: true },
    '4.5': { objective: { type: 'survive' }, lines: 2, constraints: { noDamage: true, defenseFacing: true }, bots: [{ kind: 'randomProgram' }] },
    '4.6': { objective: { type: 'defeat' } },
    '4.7': { objective: { type: 'goal' }, params: { inConditionOnly: ['left', 'right'] } },
    // Синий Голем шагает Вперёд перед каждой НАШЕЙ командой (в том числе внутри Цикла).
    // Нельзя дать добраться до противоположного (западного) края ни Бочке, ни Роботу.
    '4.8': { objective: { type: 'defeat' }, constraints: { edgeFail: 'W' }, bots: [{ kind: 'everyCommand', cmd: 'forward' }] },
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
    // 5.4: «проведи Голема по линии Бочек и все их разбей» — вставать на Цель
    // можно только с пустым полем. Программа повторяется (endless): атакуем
    // Бочку впереди, шагаем на её место, а если впереди пусто — поворачиваем
    // направо (так Голем обходит всю линию Бочек до Цели).
    '5.4': { objective: { type: 'goal' }, endless: true, commandLimit: 4, constraints: { destroyAllBarrels: true }, answer: 'Атака → Вперед → Если <Препятствие>, то (Атака), Иначе (Вправо)' },
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

    // ---------- floor 7: «Параллельные Големы» ----------
    // В комнате ДВА Голема игрока и ОДНА Программа: Красный — первый, Синий —
    // второй, у Синего «Поворот влево»/«Поворот вправо» работают наоборот.
    // Победа (twinGoals) — ОБА Голема на СВОИХ Целевых точках в один и тот же
    // ход; какие Цели чьи, движок берёт из данных комнаты (level.twinGoals).
    '7.1': { objective: twinGoals },
    '7.2': { objective: twinGoals },
    '7.3': { objective: twinGoals },
    '7.4': { objective: twinGoals },
    '7.5': { objective: twinGoals },
    // 7.6: Бочку перед Красным убирает только Атака (за Бочкой — Камень).
    '7.6': { objective: twinGoals, requires: { attack: true } },
    // 7.7: Зелёный страж бьёт клетку перед собой, Жёлтый бродяга шагает Вперёд и
    // уступает Красному дорогу. Бьют они В КОНЦЕ хода, поэтому первый ход —
    // «Защита» (params.noDefenseFacing — Защита держит и удар в спину).
    '7.7': {
      objective: twinGoals,
      params: { noDefenseFacing: true },
      bots: [
        { kind: 'guard', name: 'Зелёный страж' },
        { kind: 'walker', name: 'Жёлтый бродяга' },
      ],
    },
    '7.8': { objective: twinGoals, requires: { loop: true } },
    '7.9': { objective: twinGoals, requires: { loop: true, condition: true } },
    '7.10': { objective: twinGoals, requires: { loop: true, condition: true } },
  };
})();
