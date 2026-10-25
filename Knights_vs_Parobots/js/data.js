/*
 * data.js — карты, враги, комнаты, этажи и «движок» логических условий.
 * Все числа и формулировки соответствуют обучающей версии настольной игры
 * «Рыцари против ПАРОБОТОВ: Перезагрузка» v2.2.
 */
(function () {
  'use strict';
  const KVP = (window.KVP = window.KVP || {});

  /* ------------------------------------------------------------------ */
  /*  ТРОФЕИ (оружие)                                                    */
  /* ------------------------------------------------------------------ */
  KVP.TROPHIES = {
    rock: {
      id: 'rock', name: 'Камень', gen: 'Камня', icon: '🪨',
      force: 1, gold: 2, color: '#7fd18b', accent: '#3f8a52',
      tagline: 'Тяжёлый и надёжный.',
      kills: 'Обычных и Бронированных',
      desc: 'Сила 1. Пробивает условие «Камень ИЛИ Ножницы», но не проходит условие «НЕ Камень».'
    },
    scissors: {
      id: 'scissors', name: 'Ножницы', gen: 'Ножниц', icon: '✂️',
      force: 1, gold: 2, color: '#ff8b7e', accent: '#b74134',
      tagline: 'Острый расчёт.',
      kills: 'Обычных и Копейщиков',
      desc: 'Сила 1. Пробивает условие «Камень ИЛИ Ножницы», но не проходит условие «НЕ Ножницы».'
    },
    paper: {
      id: 'paper', name: 'Бумага', gen: 'Бумаги', icon: '📜',
      force: 0, gold: 1, color: '#9cc9ff', accent: '#3f6fa8',
      tagline: 'Запутывает алгоритм.',
      kills: 'Никого. Зато усыпляет любого бота.',
      desc: 'Сила 0. Сбросьте Бумагу, чтобы запутать ПароБота и избежать боя. С Магом Бумага уничтожает любого врага.'
    }
  };
  KVP.TROPHIES.bot = { id:'bot', name:'Пойманный ПароБот', gen:'Пойманного ПароБота', icon:'🤖', force:9, gold:0, color:'#a97bff', accent:'#4a3a8f', tagline:'Вместо оружия на Дуэли.', kills:'Любого ПароБота на Дуэли.', desc:'Пойманный ловушкой ПароБот, которого можно выложить вместо Камня/Ножниц/Бумаги.' };
  KVP.TROPHIES.trap = { id:'trap', name:'Клетка-ловушка', gen:'Клетки-ловушки', icon:'🪤', force:0, gold:0, color:'#e8c290', accent:'#9a7a4e', tagline:'Спецпредмет: ловит без боя.', kills:'Любого ПароБота.', desc:'Попадает под Рыцаря; расходуется — ловит ПароБота без боя.' };
  KVP.TROPHY_LIST = ['rock', 'scissors', 'paper', 'trap'];

  /* ------------------------------------------------------------------ */
  /*  ПАРОБОТЫ                                                           */
  /* ------------------------------------------------------------------ */
  KVP.BOTS = {
    normal: {
      id: 'normal', name: 'Обычный ПароБот', short: 'ПароБот',
      armor: 2, reward: 10, sprite: 'bot_normal', scale: 1.0,
      condition: 'rock || scissors',
      conditionText: 'Камень ИЛИ Ножницы',
      conditionShort: '🪨 ИЛИ ✂️',
      conditionCard: 'Ножницами ИЛИ Камнем',
      hint: '',
      desc: 'Логическое ИЛИ: Камень ИЛИ Ножницы.',
      speed: 1.65, fireCd: 2.5, damage: 8, color: '#c98b4a'
    },
    armored: {
      id: 'armored', name: 'Бронированный ПароБот', short: 'Бронебот',
      armor: 3, reward: 10, sprite: 'bot_armored', scale: 1.08,
      condition: '!scissors',
      conditionText: 'НЕ Ножницы',
      conditionShort: '🚫✂️',
      conditionCard: 'НЕ Ножницами',
      hint: '',
      desc: 'Логическое НЕ: не Ножницы.',
      speed: 1.35, fireCd: 2.2, damage: 11, color: '#7d96b8'
    },
    spearman: {
      id: 'spearman', name: 'ПароБот-копейщик', short: 'Копейщик',
      armor: 2, reward: 10, sprite: 'bot_spear', scale: 1.05,
      condition: '!rock',
      conditionText: 'НЕ Камень',
      conditionShort: '🚫🪨',
      conditionCard: 'НЕ Камнем',
      hint: '',
      desc: 'Логическое НЕ: не Камень.',
      speed: 1.8, fireCd: 2.0, damage: 9, color: '#b47ad0'
    },
    giant: {
      id: 'giant', name: 'Гигантский ПароБот', short: 'Гигант',
      armor: 4, reward: 20, sprite: 'bot_giant', scale: 1.55, boss: true,
      condition: 'rock && scissors',
      conditionText: 'Камень И Ножницы',
      conditionShort: '🪨 И ✂️',
      conditionCard: 'Камнем И Ножницами',
      hint: '',
      desc: 'Логическое И: Камень И Ножницы.',
      speed: 1.1, fireCd: 1.7, damage: 15, color: '#e0574f'
    },
    titan: {
      id: 'titan', name: 'Титан-ПароБот', short: 'Титан',
      armor: 4, reward: 20, sprite: 'bot_giant', scale: 1.6, boss: true,
      condition: 'rock && rock',
      conditionText: 'Камень И Камень',
      conditionShort: '🪨 И 🪨',
      conditionCard: 'Двумя Камнями',
      hint: '',
      desc: 'Логическое И: два Камня с разных Рыцарей.',
      speed: 0.95, fireCd: 1.6, damage: 16, color: '#c94ae0'
    },
    mirror: {
      id: 'mirror', name: 'Зеркальный ПароБот', short: 'Зеркало',
      armor: 3, reward: 15, sprite: 'bot_normal', scale: 1.1, boss: true,
      condition: 'rock ^ scissors',
      conditionText: 'РОВНО ОДНО: Камень ИЛИ Ножницы, но не оба',
      conditionShort: '🪨 или ✂️',
      conditionCard: 'РОВНО ОДНИМ: Камнем ИЛИ Ножницами (оба сразу — нельзя)',
      hint: '',
      desc: 'Логическое «исключающее ИЛИ»: ровно одно условие.',
      speed: 1.25, fireCd: 2.1, damage: 12, color: '#6d7d8d'
    },
    titan2: {
      id: 'titan2', name: 'Титан-Бронированный', short: 'ТитанБр',
      armor: 5, reward: 20, sprite: 'bot_giant', scale: 1.65, boss: true,
      condition: 'rock && paper',
      conditionText: 'Камень И Бумага',
      conditionShort: '🪨 И 📜',
      conditionCard: 'Камнем И Бумагой',
      hint: '',
      desc: 'Логическое И: Камень И Бумага.',
      speed: 0.9, fireCd: 1.5, damage: 18, color: '#b74aff'
    }
  };

  /* ------------------------------------------------------------------ */
  /*  РЫЦАРИ                                                             */
  /* ------------------------------------------------------------------ */
  KVP.KNIGHTS = {
    swordsman: {
      id: 'swordsman', name: 'Рыцарь-Мечник', icon: '⚔️', affinity: 'scissors',
      bonus: 1, color: '#e05a4f', tagline: 'Красная окантовка — любит Ножницы.'
    },
    maceman: {
      id: 'maceman', name: 'Рыцарь-Булавоносец', icon: '🔨', affinity: 'rock',
      bonus: 1, color: '#4fb06a', tagline: 'Зелёная окантовка — любит Камень.'
    },
    archer: {
      id: 'archer', name: 'Рыцарь-Арбалетчик', icon: '🏹', affinity: 'paper',
      bonus: 1, color: '#4f86d8', tagline: 'Синяя окантовка — любит Бумагу.'
    },
    cook: {
      id: 'cook', name: 'Рыцарь-Повар', icon: '🍲', affinity: null,
      bonus: 1, heal: 25, color: '#e0a94a', tagline: 'Кормит команду: +25 здоровья.'
    },
    mag: {
      id: 'mag', name: 'Маг', icon: '🧙', affinity: null,
      bonus: 0, mag: true, color: '#a97bff', tagline: 'Пока Маг в команде, Бумага уничтожает любого бота.'
    }
  };

  /* ------------------------------------------------------------------ */
  /*  СПЕЦКАРТЫ                                                          */
  /* ------------------------------------------------------------------ */
  KVP.SPECIALS = {
    greed: {
      id: 'greed', name: 'Жадность', icon: '🤑', color: '#e0b000',
      text: 'Вне Дуэли даёт взять 2 карты. На Дуэли — 1 карту.',
      effect: 'Получите 2 случайных Трофея.'
    },
    market: {
      id: 'market', name: 'Рынок', icon: '⚖️', color: '#59b7c9',
      text: 'Обмен любой карты Трофея с любым игроком.',
      effect: 'Обменяйте один Трофей на другой тип.'
    },
    thief: {
      id: 'thief', name: 'Вор', icon: '🦝', color: '#9c8a73',
      text: 'Забирает один Трофей или Рыцаря-Повара, если есть место.',
      effect: 'Украдите Трофей и 10 золота.'
    },
    dragon: {
      id: 'dragon', name: 'Дракон', icon: '🐉', color: '#e0574f',
      text: 'Сжигает ВСЮ Бумагу (в Инвентаре и в руке) и забирает одного Вашего Персонажа.',
      effect: 'Сжигает всю бумагу — и в Инвентаре, и в руке — и забирает одного Вашего Персонажа в сброс.'
    },
    mag: {
      id: 'mag', name: 'Маг', icon: '🧙', color: '#a97bff',
      text: 'Наделяет Бумагу боевыми свойствами: она уничтожает любого ПароБота, но Камень и Ножницы становятся непригодны.',
      effect: 'Маг присоединяется к команде. Пока он в команде, отбиваться можно только Бумагой.'
    },
    cell: {
      id: 'cell', name: 'Клетка-ловушка', icon: '🪤', color: '#8a7550',
      text: 'Ловит ПароБота любого типа без боя.',
      effect: 'Поставьте клетку рядом с ПароБотом — он попадётся в неё.'
    }
  };

  /* ------------------------------------------------------------------ */
  /*  КОМНАТЫ-КАРТЫ МЕСТНОСТИ                                            */
  /*                                                                     */
  /*  Имена — строго «места», чтобы не путаться с картами Трофеев        */
  /*  (Камень, Ножницы, Бумага) и Спецкарт (Дракон, Рынок, Вор, Маг).  */
  /* ------------------------------------------------------------------ */
  KVP.ROOM_TYPES = {
    start: {
      name: 'Врата подземелья', icon: '🏰', wall: 'wall_castle', fill: '#5a5147',
      desc: 'Здесь начинается путь. Портал наверх откроется, когда подземелье будет очищено.'
    },
    armory: {
      name: 'Арсенал', icon: '🛡️', wall: 'wall_armory', fill: '#5d4b3a',
      desc: 'Стойки с оружием. Больше Трофеев — больше шансов пробить броню.'
    },
    library: {
      name: 'Книжная палата', icon: '📚', wall: 'wall_library', fill: '#4b4a5e',
      desc: 'Свитки и логические схемы. Здесь часто встречается Бумага и Маг.'
    },
    forge: {
      name: 'Кузнечный зал', icon: '🔥', wall: 'wall_forge', fill: '#5e3d36',
      desc: 'Жарко! Бронированные ПароБоты любят кузницы.'
    },
    barrack: {
      name: 'Казарма', icon: '🛏️', wall: 'wall_barrack', fill: '#4d5142',
      desc: 'Казарма врага: вытянутый Рыцарь-соперник встаёт сюда жетоном врага и вызывает Дуэль.'
    },
    chest: {
      name: 'Золотая кладовая', icon: '💰', wall: 'wall_treasure', fill: '#5e5130',
      desc: 'Сундук требует жертву: скиньте Трофей, прежде чем взять карты.'
    },
    trap: {
      name: 'Зал капканов', icon: '🪤', wall: 'wall_trap', fill: '#4a4242',
      desc: 'Клетки позволяют поймать любого ПароБота без боя.'
    },
    altar: {
      name: 'Алтарь заклинаний', icon: '🔮', wall: 'wall_altar', fill: '#443a5c',
      desc: 'Здесь лежат спецкарты. Их сила меняет правила боя.'
    },
    arena: {
      name: 'Дуэльная арена', icon: '⚔️', wall: 'wall_arena', fill: '#5a3e3e',
      desc: 'Патрули ПароБотов. Держите дистанцию и считайте силу.'
    },
    boss: {
      name: 'Тронный зал', icon: '👑', wall: 'wall_boss', fill: '#5c2f2f',
      desc: 'Логово Гигантского ПароБота. Логическое И требует двух трофеев.'
    },
    vault: {
      name: 'Тайник', icon: '📜', wall: 'wall_library', fill: '#413a48',
      desc: 'Скрытая ниша со старыми свитками. Туда ведёт один-единственный проход.'
    }
  };

  /* ------------------------------------------------------------------ */
  /*  ЭТАЖИ                                                              */
  /* ------------------------------------------------------------------ */
  KVP.FLOORS = [
    {
      id: 1, name: 'Подземелья замка', icon: '🏰',
      subtitle: 'Первые шаги рыцаря',
      rooms: ['start', 'armory', 'library', 'barrack', 'arena', 'forge', 'chest', 'trap', 'altar'],
      mix: { normal: 4, armored: 1, spearman: 1, giant: 0 },
      hint: 'Сначала выберите Трофей (клик по карте в руке), затем прочитайте анализ цели.',
      guarantee: { mag: false, dragon: false, greed: true }
    },
    {
      id: 2, name: 'Заброшенная кузница', icon: '🔥',
      subtitle: 'Здесь броня толще',
      rooms: ['start', 'forge', 'armory', 'library', 'barrack', 'arena', 'chest', 'trap', 'altar'],
      mix: { normal: 4, armored: 2, spearman: 2, giant: 0 },
      hint: 'Бронированный бот: 🚫 НЕ Ножницы. Копейщик: 🚫 НЕ Камень. Сила трофея + рыцари ≥ броня.',
      guarantee: { mag: true, dragon: false, greed: false }
    },
    {
      id: 3, name: 'Тронный зал Алгоримуса', icon: '👑',
      subtitle: 'Логика против машины',
      rooms: ['start', 'arena', 'forge', 'library', 'barrack', 'chest', 'trap', 'altar', 'boss'],
      mix: { normal: 4, armored: 2, spearman: 2, giant: 1 },
      hint: 'Гигант: Камень И Ножницы. Нужны оба трофея на разных Рыцарях и сила 2 + рыцари ≥ 6.',
      guarantee: { mag: false, dragon: true, greed: false }
    }
  ];

  /* ------------------------------------------------------------------ */
  /*  СЛОЖНОСТЬ                                                          */
  /* ------------------------------------------------------------------ */
  KVP.DIFFICULTY = {
    easy: {
      id: 'easy', name: 'Юный рыцарь', icon: '🐣',
      desc: '5 Рыцарей: 2 Ножницы и 1 Камень. Боты спокойные, больше трофеев.',
      damage: 0.7, fireCd: 1.35, speed: 0.85, loot: 1.35
    },
    normal: {
      id: 'normal', name: 'Рыцарь', icon: '⚔️',
      desc: '4 Рыцаря: 1 Ножницы и 1 Камень. Стандартный баланс.',
      damage: 1, fireCd: 1, speed: 1, loot: 1
    },
    hard: {
      id: 'hard', name: 'Мастер логики', icon: '🧠',
      desc: '3 Рыцаря: 1 Камень. В колоде больше сильных ПароБотов.',
      damage: 1.3, fireCd: 0.78, speed: 1.15, loot: 0.8
    },
    extreme: {
      id: 'extreme', name: 'Экстрим', icon: '💀',
      desc: '2 Рыцаря и ни одного Трофея. Максимальная сложность: добывайте всё сами.',
      damage: 1.45, fireCd: 0.7, speed: 1.22, loot: 0.7
    }
  };

  KVP.DEFAULT_SETTINGS = {
    volume: 0.55,
    muted: false,
    sensitivity: 0.0022,
    quality: 'normal', // low | normal | high
    difficulty: 'normal',
    showAnalyzer: true,
    invertY: false
  };

  KVP.QUALITY_SCALE = { low: 0.6, normal: 1, high: 1.35 };

  /* ------------------------------------------------------------------ */
  /*  БОЕВАЯ ЛОГИКА                                                      */
  /* ------------------------------------------------------------------ */
  /**
   * Проверяет алгоритм боя.
   * @param {string} botId
   * @param {string[]} weapons — типы трофеев, которые игрок применяет
   * @param {number} teamPower — сумма бонусов живых Рыцарей
   * @param {boolean} hasMag — есть ли Маг в команде (тогда работает только Бумага)
   * @returns {{mode:'kill'|'stun'|'fail', reason:string, power:number|string,
   *            need:number, conditionOk:boolean, title:string, detail:string}}
   */
  KVP.analyze = function (botId, weapons, teamPower, hasMag) {
    const bot = KVP.BOTS[botId];
    const cards = (weapons || []).filter(Boolean);
    const set = [];
    for (let i = 0; i < cards.length; i++) {
      if (set.indexOf(cards[i]) < 0) set.push(cards[i]);
    }
    const base = {
      power: '—', need: bot.armor, conditionOk: false,
      title: '', detail: '', bot: bot, weapons: set
    };
    const tname = function (type) {
      return (KVP.TROPHIES[type] || {}).name || String(type);
    };

    if (!set.length) {
      return Object.assign(base, {
        mode: 'fail', reason: 'Нет трофея',
        title: 'Слот пуст',
        detail: 'Снарядите Трофей под Рыцаря — перетащите карточку из руки на Рыцаря.'
      });
    }

    /* --- Клетка-ловушка ловит любого ПароБота, включая комбо. --- */
    if (set.length === 1 && set[0] === 'trap') {
      return Object.assign(base, {
        mode: 'kill', reason: 'Клетка-ловушка', power: '∞',
        conditionOk: true, title: 'КЛЕТКА ЛОВИТ БЕЗ БОЯ',
        detail: 'Клетка-ловушка расходуется и ловит любого ПароБота — броня и условие не важны.'
      });
    }

    /* --- Маг в команде: работает только Бумага, зато на любом боте --- */
    if (hasMag) {
      if (set.indexOf('paper') >= 0) {
        if (bot.id === 'giant') {
          const r = (weapons || []).filter(function (w) { return w === 'paper'; }).length;
          if (r < 2) {
            return Object.assign(base, {
              mode: 'fail', reason: 'Гиганта уничтожают ТОЛЬКО двумя Бумагами с разных Рыцарей.', power: '∞', conditionOk: false,
              title: 'НУЖНО ДВЕ БУМАГИ', detail: 'Под Магом Гигант уничтожается только двумя Бумагами (на разных Рыцарях).'
            });
          }
        }
        return Object.assign(base, {
          mode: 'kill', reason: 'Маг + Бумага', power: '∞',
          conditionOk: true, title: 'МАГ: БУМАГА БЬЁТ ЛЮБОГО',
          detail: 'Пока Маг в команде, Бумага уничтожает любого ПароБота. Камень и Ножницы непригодны.'
        });
      }
      return Object.assign(base, {
        mode: 'fail', reason: 'С Магом работает только Бумага',
        conditionOk: false, title: 'НУЖНА БУМАГА',
        detail: 'Пока Маг в команде, Камень и Ножницы непригодны — отбиться можно только Бумагой.'
      });
    }

    /* --- Без Мага Бумага не может бить ПароБота (даже в наборе). */
    if (!hasMag && set.indexOf('paper') >= 0) {
      return Object.assign(base, {
        mode: 'fail', reason: 'Бумага без Мага не бьёт ПароБота', power: 0, conditionOk: false,
        title: 'БЕЗ МАГА БУМАГА НЕ РАБОТАЕТ',
        detail: 'Пока Мага нет в команде, Бумага не может уничтожить ПароБота. Используйте её только с Магом.'
      });
    }

    /* --- Логическое XOR: ровно один из двух трофеев. --- */
    if (String(bot.condition).indexOf('^') >= 0) {
      const partsX = String(bot.condition).split('^').map(function (x) { return x.trim(); });
      const a0 = partsX[0], b0 = partsX[1];
      const hasA = set.indexOf(a0) >= 0, hasB = set.indexOf(b0) >= 0;
      if (hasA && hasB) {
        return Object.assign(base, {
          mode: 'fail', reason: 'Оба трофея сразу', power: 0,
          conditionOk: false, title: 'НЕЛЬЗЯ ОБА',
          detail: 'Зеркальный ПароБот требует ровно один из двух Трофеев; оба сразу не работают.'
        });
      }
      const chosen = hasA ? a0 : (hasB ? b0 : null);
      if (!chosen) {
        return Object.assign(base, {
          mode: 'fail', reason: 'Нужен ровно один трофей', power: 0,
          conditionOk: false, title: 'НУЖЕН РОВНО ОДИН',
          detail: 'Выберите Камень ИЛИ Ножницы — ровно один Трофей, но не оба.'
        });
      }
      const forceX = (KVP.TROPHIES[chosen] || {}).force || 0;
      const powerX = forceX + teamPower;
      const okX = powerX >= bot.armor;
      return Object.assign(base, {
        mode: okX ? 'kill' : 'fail', reason: okX ? 'Условие выполнено' : 'Не хватает силы',
        power: powerX, conditionOk: true,
        title: okX ? 'ПРОБИТИЕ' : 'СИЛА ' + powerX + ' < ' + bot.armor,
        detail: 'Ровно один Трофей: «' + tname(chosen) + '». Сила ' + forceX + ' + рыцари ' + teamPower + ' = ' + powerX + '. Нужно ≥ ' + bot.armor + '.'
      });
    }

    /* --- Логическое И: нужны ВСЕ трофеи; одинаковые считаются поштучно --- */
    if (String(bot.condition).indexOf('&&') >= 0) {
      const partsRaw = String(bot.condition).split('&&').map(function (x) { return x.trim(); });
      const wanted = partsRaw.map(function (x) { return x.replace(/^!/, ''); });
      const counts = {};
      for (let ci = 0; ci < cards.length; ci++) counts[cards[ci]] = (counts[cards[ci]] || 0) + 1;
      for (let wi = 0; wi < partsRaw.length; wi++) {
        const w = wanted[wi];
        const neg = partsRaw[wi].charAt(0) === '!';
        if (neg) {
          if ((counts[w] || 0) > 0) {
            return Object.assign(base, {
              mode: 'fail', reason: 'Условие нарушено: запрещён «' + tname(w) + '»', power: 0, conditionOk: false,
              title: 'ЗАПРЕЩЕНО УСЛОВИЕМ', detail: 'Условие требует отсутствия трофея «' + tname(w) + '».'
            });
          }
          continue;
        }
        const required = wanted.filter(function (x) { return x === w; }).length;
        if ((counts[w] || 0) < required) {
          return Object.assign(base, {
            mode: 'fail', reason: 'Нужны оба трофея',
            power: 0, conditionOk: false,
            title: 'НУЖНЫ ОБА ТРОФЕЯ', detail: 'Нужны одновременно ' + wanted.map(tname).join(' и ') + ' (на разных Рыцарях).'
          });
        }
      }
      let pow = teamPower;
      for (let wi = 0; wi < wanted.length; wi++) {
        if (partsRaw[wi].charAt(0) === '!') continue;
        pow += ((KVP.TROPHIES[wanted[wi]] || {}).force || 0);
      }
      const ok = pow >= bot.armor;
      return Object.assign(base, {
        mode: ok ? 'kill' : 'fail', reason: ok ? 'Логическое И выполнено' : 'Не хватает силы',
        power: pow, conditionOk: true,
        title: ok ? 'Логическое И — ПРОБИТИЕ' : 'СИЛА ' + pow + ' < ' + bot.armor,
        detail: 'Сила трофеев суммируется: ' + wanted.map(function(w){ return (KVP.TROPHIES[w]||{}).force||0; }).join(' + ') + ' и рыцари ' + teamPower + ' = ' + pow + '. Нужно ≥ ' + bot.armor + '.'
      });
    }

    /* --- Обычные условия --- */
    const t = set[0];
    const info = KVP.TROPHIES[t];
    const force = info ? info.force : 0;
    let conditionOk = false;
    let conditionWhy = '';

    if (bot.condition === 'rock || scissors') {
      conditionOk = (t === 'rock' || t === 'scissors');
      conditionWhy = conditionOk ? 'Условие «Камень ИЛИ Ножницы» выполнено.' : 'Нужен Камень или Ножницы.';
    } else if (bot.condition === '!scissors') {
      conditionOk = (t !== 'scissors');
      conditionWhy = conditionOk ? 'Условие «НЕ Ножницы» выполнено.' : 'Ножницы запрещены: сработало логическое НЕ.';
    } else if (bot.condition === '!rock') {
      conditionOk = (t !== 'rock');
      conditionWhy = conditionOk ? 'Условие «НЕ Камень» выполнено.' : 'Камень запрещён: сработало логическое НЕ.';
    }

    const power = force + teamPower;
    if (!conditionOk) {
      return Object.assign(base, {
        mode: 'fail', reason: 'Условие оружия не выполнено',
        power: power, conditionOk: false,
        title: 'ЗАПРЕЩЕНО УСЛОВИЕМ',
        detail: conditionWhy
      });
    }
    if (power < bot.armor) {
      return Object.assign(base, {
        mode: 'fail', reason: 'Не хватает силы',
        power: power, conditionOk: true,
        title: 'СИЛА ' + power + ' < БРОНЯ ' + bot.armor,
        detail: 'Сила трофея ' + force + ' + рыцари ' + teamPower + ' = ' + power + '. Нужно ≥ ' + bot.armor + '.'
      });
    }
    return Object.assign(base, {
      mode: 'kill', reason: 'Алгоритм пробит',
      power: power, conditionOk: true,
      title: 'ПРОБИТИЕ: ' + power + ' ≥ ' + bot.armor,
      detail: conditionWhy + ' Сила ' + force + ' + рыцари ' + teamPower + ' = ' + power + ' ≥ брони ' + bot.armor + '.'
    });
  };

  KVP.newTrophy = function (type) {
    return { id: KVP.uid('tr'), type: type };
  };

  KVP.newKnight = function (type) {
    const d = KVP.KNIGHTS[type];
    return {
      id: KVP.uid('kn'), type: type, name: d.name, icon: d.icon,
      trophy: null, trap: false, alive: true
    };
  };

  KVP.settingBonus = function (team) {
    let n = 0;
    for (let i = 0; i < team.length; i++) {
      const k = team[i];
      if (!k.alive || !k.trophy) continue;
      const def = KVP.KNIGHTS[k.type];
      if (def && def.affinity && def.affinity === k.trophy.type) n++;
    }
    return n;
  };

  /* ================================================================== */
  /*  КАРТЫ МЕСТНОСТИ И КОЛОДА                                          */
  /* ================================================================== */

  // Формы карт: какие стороны света открыты (проходы).
  KVP.TILE_SHAPES = {
    cross: { exits: { n: 1, e: 1, s: 1, w: 1 }, label: '4 прохода' },
    tee: { exits: { n: 1, e: 1, s: 0, w: 1 }, label: '3 прохода' },
    straight: { exits: { n: 0, e: 1, s: 0, w: 1 }, label: '2 прохода' },
    corner: { exits: { n: 1, e: 1, s: 0, w: 0 }, label: 'угол' },
    dead: { exits: { n: 1, e: 0, s: 0, w: 0 }, label: 'тупик' }
  };

  // «Дебютная» карта Лабиринта — карта Местности с ЧЕТЫРЬМЯ выходами.
  // По правилам Соло-режима она выкладывается первой и В КОЛОДУ НЕ ВХОДИТ:
  // «Выложите на свободное место начальную карту Лабиринта: карту Местности
  // с четырьмя выходами». Это единственная 4-выходная карта в игре.
  KVP.START_TILE = {
    id: 't_arena', shape: 'cross', room: 'arena',
    name: 'Дуэльная арена', icon: '⚔️'
  };

  // Карты Местности, которые лежат в колоде (7 штук).
  // Названия — «места» (см. ROOM_TYPES), чтобы не путать с Трофеями и спецкартами.
  KVP.TILE_CARDS = [
    { id: 't_trap', shape: 'tee', room: 'trap', name: 'Зал капканов', icon: '🪤' },
    { id: 't_altar', shape: 'tee', room: 'altar', name: 'Алтарь заклинаний', icon: '🔮' },
    { id: 't_armory', shape: 'straight', room: 'armory', name: 'Арсенал', icon: '🛡️' },
    { id: 't_library', shape: 'straight', room: 'library', name: 'Книжная палата', icon: '📚' },
    { id: 't_forge', shape: 'corner', room: 'forge', name: 'Кузнечный зал', icon: '🔥' },
    { id: 't_barrack', shape: 'corner', room: 'barrack', name: 'Казарма', icon: '🛏️' },
    { id: 't_dead', shape: 'dead', room: 'vault', name: 'Тайник', icon: '📜' }
  ];

  // Сундук — особая карта Местности, всегда последняя в колоде.
  KVP.CHEST_TILE = {
    id: 't_chest', shape: 'corner', room: 'chest',
    name: 'Золотая кладовая', icon: '💰'
  };

  KVP.tileCardById = function (id) {
    if (id === KVP.START_TILE.id) return KVP.START_TILE;
    if (id === KVP.CHEST_TILE.id) return KVP.CHEST_TILE;
    for (let i = 0; i < KVP.TILE_CARDS.length; i++) {
      if (KVP.TILE_CARDS[i].id === id) return KVP.TILE_CARDS[i];
    }
    return null;
  };

  /**
   * Собирает колоду для соло-забега (без перемешивания).
   * Состав — по правилам (Games Rules v3.3.4, компоненты игры) с поправками
   * Соло-режима:
   *   • 10 Камней, 10 Ножниц, 10 Бумаг (Трофеи);
   *   • 3 карты Рыцарей в общую колоду (остальные — в сброс), Маг — спецкарта;
   *   • 3 Клетки-ловушки;
   *   • спецкарты Маг, Рынок, Вор, Дракон (Жадность в соло убирается по правилам);
   *   • 6 обычных, 4 бронированных и 4 копейщика;
   *   • 7 карт Местности + карта с Сундуком ПОСЛЕДНЕЙ (её надо дойти).
   * Итого 62 карты, 9 карт Местности всего (стартовая + 7 + сундук).
   */
  KVP.buildDeck = function (difficulty) {
    const deck = [];
    let n = 0;
    function add(kind, itemType) {
      deck.push({ id: 'c' + (n++), kind: kind, itemType: itemType || null });
    }
    // Трофеи (оружие Рыцарей) — по 10 карт каждого вида.
    for (let i = 0; i < 10; i++) add('trophy', 'rock');
    for (let i = 0; i < 10; i++) add('trophy', 'scissors');
    for (let i = 0; i < 10; i++) add('trophy', 'paper');
    // Рыцари: 3 карты в общую колоду (по правилам — «три любых»).
    add('knight', 'maceman');
    add('knight', 'archer');
    add('knight', 'cook');
    add('knight', 'swordsman');
    add('knight', 'cook');
    add('knight', 'archer');
    // Спецкарты (Рынок и Вор в соло убираются по правилам v2.2).
    add('special', 'mag');
    add('special', 'dragon');
    add('special', 'greed');
    for (let i = 0; i < 4; i++) add('cell', null);
    // ПароБоты — карты-враги (сразу требуют боя).
    // Баланс по частоте появления: обычные churn, бронированные и копейщики —
    // средний балл, а Титана делаем в ×2, чтобы он реально встречался.
    for (let i = 0; i < 7; i++) add('bot', 'normal');
    for (let i = 0; i < 3; i++) add('bot', 'armored');
    for (let i = 0; i < 5; i++) add('bot', 'spearman');
    // Гигант и Титаны: тройная логика И, чаще встречающиеся на высоких сложностях.
    add('bot', 'giant');
    add('bot', 'titan');
    add('bot', 'titan');
    if (difficulty === 'hard' || difficulty === 'extreme') {
      add('bot', 'titan2');
      add('bot', 'giant');
      add('bot', 'mirror');
    }
    // Карты Местности.
    KVP.TILE_CARDS.forEach(function (t) { add('tile', t.id); });
    // Карта Местности с Сундуком — ПОСЛЕДНЯЯ в колоде.
    add('tile', KVP.CHEST_TILE.id);
    return deck;
  };

  /**
   * Перемешивает колоду. Карта Местности с Сундуком после перемешивания
   * кладётся В САМЫЙ НИЗ — её вытягивают последней, а потом до неё идут.
   */
  KVP.shuffleDeck = function (deck, rng) {
    const r = rng || new KVP.RNG((Date.now() ^ Math.floor(Math.random() * 1e9)) >>> 0);
    const out = r.shuffle(deck.slice());
    let chestIdx = -1;
    for (let i = 0; i < out.length; i++) {
      if (out[i].kind === 'tile' && out[i].itemType === KVP.CHEST_TILE.id) { chestIdx = i; break; }
    }
    if (chestIdx >= 0) {
      const chest = out.splice(chestIdx, 1)[0];
      out.push(chest);
    }
    return out;
  };
})();
