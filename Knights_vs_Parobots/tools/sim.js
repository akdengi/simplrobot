/*
 * sim.js — симуляция игры по правилам (Соло-режим + Games Rules v3.3.4).
 *
 * Запуск:  node tools/sim.js [количество игр]
 *
 * Проверяет:
 *   • состав колоды (по правилам) и что карта с Сундуком — последняя;
 *   • начальную карту Лабиринта (4 выхода) — вне колоды;
 *   • правило раскладки: на новой карте есть вход хотя бы с одной соседней;
 *   • разрушение ПароБотов: нужное оружие + сила (сила Трофея + живые Рыцари);
 *   • конец игры: Сундук выложен последним и до него можно дойти.
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');

/* --- Мини-окружение браузера для data.js / util.js / dungeon.js --- */
const sandbox = {
  console: console,
  Math: Math,
  Date: Date,
  JSON: JSON,
  performance: { now: () => Date.now() },
  setTimeout: setTimeout,
  clearTimeout: clearTimeout
};
sandbox.window = sandbox;
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
for (const f of ['js/util.js', 'js/data.js', 'js/dungeon.js']) {
  vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), sandbox, { filename: f });
}
const KVP = sandbox.KVP;

/* ------------------------------------------------------------------ */
/*  Правила (перенесены из игрового кода, чтобы проверять одни и те же) */
/* ------------------------------------------------------------------ */
const OPP = { n: 's', e: 'w', s: 'n', w: 'e' };
const DIR_LIST = ['n', 'e', 's', 'w'];

function rotatedExits(shapeName, rot) {
  const shape = KVP.TILE_SHAPES[shapeName] || KVP.TILE_SHAPES.dead;
  const out = { n: 0, e: 0, s: 0, w: 0 };
  for (let i = 0; i < 4; i++) {
    if (shape.exits[DIR_LIST[i]]) out[DIR_LIST[(i + rot) % 4]] = 1;
  }
  return out;
}
/** Повороты, при которых вход смотрит в сторону backDir.
 *  Карта Местности — прямоугольник 2:1: поворачиваем только на 180°. */
function validRotations(shapeName, backDir) {
  const out = [];
  for (let k = 0; k < 2; k++) {
    const r = k * 2;
    if (rotatedExits(shapeName, r)[backDir]) out.push(r);
  }
  return out;
}
/** Свободные места, где карта может войти входом к соседней карте. */
function placementCandidates(dungeon, shapeName) {
  const out = [];
  for (const r of dungeon.rooms) {
    for (const d of DIR_LIST) {
      if (!r.exits || !r.exits[d]) continue;
      const n = dungeon.neighborCell(r.gx, r.gz, d);
      if (n.gx < 0 || n.gz < 0 || n.gx >= dungeon.gridSize || n.gz >= dungeon.gridSize) continue;
      if (dungeon.hasTile(n.gx, n.gz)) continue;
      if (!validRotations(shapeName, OPP[d]).length) continue;
      out.push({ gx: n.gx, gz: n.gz, dir: d, roomId: r.id });
    }
  }
  return out;
}

/* --- Команда, сила и разрушение ПароБотов (правила) --- */
function teamPower(team) {
  let n = 0;
  for (const k of team) if (k.alive && k.type !== 'mag') n += (KVP.KNIGHTS[k.type] || {}).bonus || 0;
  return n;
}
function hasMag(team) {
  return team.some(k => k.alive && k.type === 'mag');
}
function botDefeatPlan(botType, trophies, team) {
  const bot = KVP.BOTS[botType];
  const armor = bot.armor;
  const tp = teamPower(team);
  const set = trophies.filter(Boolean);
  if (hasMag(team)) {
    /* Маг: Бумага выводит из строя ЛЮБОГО Паробота, броня не проверяется. */
    if (!set.includes('paper')) return { ok: false, reason: 'с Магом работает только Бумага' };
    return { ok: true, power: '∞', armor, reason: '' };
  }
  /* Без Мага Бумага не разрушает ПароБотов. */
  if (set.indexOf('paper') >= 0) return { ok: false, reason: 'без Мага Бумага не разрушает', power: 0, armor };
  if (String(bot.condition).indexOf('&&') >= 0) {
    const partsRaw = String(bot.condition).split('&&').map(function(x){return x.trim();});
    const wanted = partsRaw.map(function(x){return x.replace(/^!/,'');});
    for (let wi=0; wi<wanted.length; wi++) {
      const w = wanted[wi]; const neg = partsRaw[wi].charAt(0)==='!';
      if (neg) { if (set.indexOf(w)>=0) return { ok:false, reason:'есть запрет '+w, power:0, armor }; }
      else if (set.indexOf(w)<0) return { ok:false, reason:'нужен '+w, power:0, armor };
    }
    let power = tp;
    for (const w of wanted) if (set.indexOf(w)>=0) power += (KVP.TROPHIES[w]||{}).force||0;
    return { ok: power>=armor, power, armor, reason: power>=armor?'':'сила '+power+' < '+armor };
  }
  const t = set[0];
  if (!t) return { ok: false, reason: 'нет Трофея' };
  if (t == 'paper') return { ok: false, reason: 'paper without mag', power: 0, armor };
  let ok = true, why = '';
  if (bot.condition === 'rock || scissors') { ok = t === 'rock' || t === 'scissors'; why = 'Камень ИЛИ Ножницы'; }
  else if (bot.condition === '!scissors') { ok = t !== 'scissors'; why = 'НЕ Ножницы'; }
  else if (bot.condition === '!rock') { ok = t !== 'rock'; why = 'НЕ Камень'; }
  const force = (KVP.TROPHIES[t] || {}).force || 0;
  const power = force + tp;
  if (!ok) return { ok: false, power, armor, reason: why };
  return { ok: power >= armor, power, armor, reason: power >= armor ? '' : 'сила ' + power + ' < ' + armor };
}

/* ------------------------------------------------------------------ */
/*  Проверки состава колоды                                            */
/* ------------------------------------------------------------------ */
function checkDeck(errs) {
  const deck = KVP.buildDeck();
  const count = {};
  for (const c of deck) {
    const key = c.kind === 'trophy' || c.kind === 'bot' || c.kind === 'knight' || c.kind === 'special'
      ? c.kind + ':' + c.itemType : c.kind;
    count[key] = (count[key] || 0) + 1;
  }
  const expect = {
    'trophy:rock': 10, 'trophy:scissors': 10, 'trophy:paper': 10,
    'knight:maceman': 1, 'knight:archer': 2, 'knight:cook': 2, 'knight:swordsman': 1,
    'special:mag': 1, 'special:dragon': 1, 'special:greed': 1,
    cell: 4,
    'bot:normal': 7, 'bot:armored': 3, 'bot:spearman': 5, 'bot:giant': 1, 'bot:titan': 2,
    tile: KVP.TILE_CARDS.length + 1
  };
  for (const k of Object.keys(expect)) {
    if ((count[k] || 0) !== expect[k]) errs.push('колода: ' + k + ' = ' + (count[k] || 0) + ', ожидалось ' + expect[k]);
  }
  for (const k of Object.keys(count)) {
    if (!(k in expect)) errs.push('колода: лишний тип ' + k);
  }
  if (deck.length !== 69) errs.push('колода: всего ' + deck.length + ' карт, ожидалось 69');
  /* Сундук — последняя карта. */
  const shuffled = KVP.shuffleDeck(deck, new KVP.RNG(12345));
  const last = shuffled[shuffled.length - 1];
  if (!(last.kind === 'tile' && last.itemType === KVP.CHEST_TILE.id)) {
    errs.push('колода: последняя карта не карта с Сундуком');
  }
  /* Начальная карта — 4 выхода и вне колоды. */
  const exits = KVP.TILE_SHAPES[KVP.START_TILE.shape].exits;
  const n = DIR_LIST.filter(d => exits[d]).length;
  if (n !== 4) errs.push('начальная карта: выходов ' + n + ', ожидалось 4');
  if (shuffled.some(c => c.itemType === KVP.START_TILE.id)) errs.push('начальная карта попала в колоду');
  const tiles = shuffled.filter(c => c.kind === 'tile');
  if (tiles.length !== 8) errs.push('карт Местности в колоде: ' + tiles.length + ', ожидалось 8 (+1 стартовая вне колоды)');
  /* Всего карт Местности в игре — 9 (по правилам). */
  if (tiles.length + 1 !== 9) errs.push('всего карт Местности: ' + (tiles.length + 1) + ', ожидалось 9');
  return { count: count, total: deck.length };
}

/* ------------------------------------------------------------------ */
/*  Симуляция одной партии                                             */
/* ------------------------------------------------------------------ */
function playGame(seed, opts) {
  opts = opts || {};
  const rng = new KVP.RNG(seed);
  const log = [];
  const errs = [];

  const SETUPS = {
    2: [['swordsman', 'scissors'], ['maceman', 'rock']],
    3: [['swordsman', 'scissors'], ['maceman', 'rock'], ['archer', 'paper']],
    4: [['swordsman', 'scissors'], ['maceman', 'rock'], ['archer', 'paper'], ['cook', 'rock']],
    5: [['swordsman', 'scissors'], ['maceman', 'rock'], ['archer', 'paper'], ['cook', 'rock'], ['swordsman', 'scissors']]
  };
  const setup = SETUPS[opts.team || 3] || SETUPS[3];
  const team = setup.map(pair => Object.assign(KVP.newKnight(pair[0]), { trophy: KVP.newTrophy(pair[1]) }));
  let hand = [];
  let cells = 1;
  const wins = [];
  const dungeon = KVP.createLabyrinth(seed);
  const map = [{ cardId: KVP.START_TILE.id, gx: dungeon.rooms[0].gx, gz: dungeon.rooms[0].gz, rot: 0 }];
  const deck = KVP.shuffleDeck(KVP.buildDeck(), rng);

  /* --- ход игрока --- */
  function drawCard() {
    if (!deck.length) return null;
    return deck.shift();
  }
  function equipBest(trophyType) {
    for (const k of team) {
      if (k.alive && k.type !== 'mag' && !k.trophy) { k.trophy = KVP.newTrophy(trophyType); return true; }
    }
    return false;
  }
  function addTrophy(t) {
    /* С Магом в команде бумага обязана быть в Инвентаре. */
    if (hasMag(team) && t === 'paper') { equipPaper(); return; }
    if (!equipBest(t)) { if (hand.length < 10) hand.push(KVP.newTrophy(t)); }
  }
  /* Ставим Бумагу под Рыцаря (вытесняя ненужный Трофей) — с Магом она обязательна. */
  function equipPaper() {
    const hasPaper = team.some(k => k.alive && k.trophy && k.trophy.type === 'paper');
    if (hasPaper) { if (hand.length < 10) hand.push(KVP.newTrophy('paper')); return; }
    if (equipBest('paper')) return;
    for (const k of team) {
      if (k.alive && k.type !== 'mag' && k.trophy && k.trophy.type !== 'paper') {
        hand.push(k.trophy); k.trophy = KVP.newTrophy('paper'); return;
      }
    }
    if (hand.length < 10) hand.push(KVP.newTrophy('paper'));
  }
  /* Снаряжаем слот тем типом, которого в Инвентаре не хватает:
     Камень — против Бронированных, Ножницы — против Копейщиков. */
  function equipMissing(t) {
    if (hasMag(team) && t === 'paper') { equipPaper(); return; }
    const have = { rock: false, scissors: false, paper: false };
    team.forEach(k => { if (k.alive && k.trophy) have[k.trophy.type] = true; });
    if (have[t]) { addTrophy(t); return; }
    if (equipBest(t)) return;
    /* Нет свободного слота — ищем Рыцаря, чей Трофей дублируется. */
    const seen = {};
    for (const k of team) {
      if (!k.alive || k.type === 'mag' || !k.trophy) continue;
      if (seen[k.trophy.type]) { k.trophy = KVP.newTrophy(t); return; }
      seen[k.trophy.type] = true;
    }
    addTrophy(t);
  }
  function freeSlot() { return team.findIndex(k => k.alive && k.type !== 'mag' && !k.trophy); }
  function dropHand() {
    if (hand.length >= 10) hand.shift();
  }

  let turns = 0, chestPlaced = false, chestCard = null, lost = 0, fights = 0, winsCount = 0;
  const lossBy = {}, lossWhy = {};
  let maxTurns = 400;

  while (deck.length && turns < maxTurns) {
    turns++;
    /* Действие 1 — шаг (в симуляции считаем, что проход есть, если есть куда идти). */
    /* Действие 2 — карта. */
    const card = drawCard();
    if (!card) break;

    if (card.kind === 'trophy') {
      equipMissing(card.itemType);
      continue;
    }
    if (card.kind === 'knight') {
      /* По правилам соло — Рыцарь становится жетоном врага на текущей карте. */
      continue;
    }
    if (card.kind === 'cell') { cells++; continue; }
    if (card.kind === 'special') {
      if (card.itemType === 'mag') {
        team.push(Object.assign(KVP.newKnight('mag'), { trophy: null }));
        /* Маг требует Бумагу в Инвентаре: достаём из руки и кладём под Рыцаря
           (если все слоты заняты — вытесняем самый ненужный Трофей). */
        const hi = hand.findIndex(t => t.type === 'paper');
        if (hi >= 0) {
          const t = hand.splice(hi, 1)[0];
          if (!equipBest('paper')) {
            for (const k of team) {
              if (k.alive && k.type !== 'mag' && k.trophy && k.trophy.type !== 'paper') {
                hand.push(k.trophy); k.trophy = t; break;
              }
            }
          }
        }
        continue;
      }
      if (card.itemType === 'dragon') {
        /* Дракон: сжечь всю бумагу и забрать одного Персонажа. */
        for (const k of team) if (k.alive && k.trophy && k.trophy.type === 'paper') k.trophy = null;
        hand = hand.filter(t => t.type !== 'paper');
        const alive = team.map((k, i) => k.alive ? i : -1).filter(i => i >= 0);
        if (alive.length) { const i = alive[Math.floor(rng.next() * alive.length)]; team[i].alive = false; lost++; }
        log.push('ход ' + turns + ': Дракон (сожёг бумагу, забрал Персонажа)');
        continue;
      }
      if (card.itemType === 'market' || card.itemType === 'thief') {
        const t = ['rock', 'scissors', 'paper'][Math.floor(rng.next() * 3)];
        addTrophy(t);
        continue;
      }
      continue;
    }
    if (card.kind === 'bot') {
      /* Бой с вытянутым ПароБотом: победить Трофеем из Инвентаря или потерять Персонажа. */
      fights++;
      /* Игрок выбирает того Рыцаря, чей Трофей подходит. Играть «подковыркой»:
         если Трофей в Инвентаре не один, тратим его; если он последний —
         бережём его и ловим бота Клеткой (Камень нужен Бронированному,
         Ножницы — Копейщику). */
      const countType = (t) => team.filter(k => k.alive && k.trophy && k.trophy.type === t).length;
      let slot = -1, unique = false;
      for (let i = 0; i < team.length; i++) {
        const k = team[i];
        if (!k.alive || k.type === 'mag' || !k.trophy) continue;
        if (!botDefeatPlan(card.itemType, [k.trophy.type], team).ok) continue;
        if (countType(k.trophy.type) >= 2) { slot = i; unique = false; break; }
        if (slot < 0) { slot = i; unique = true; }
      }
      if (slot >= 0 && !unique) {
        team[slot].trophy = null;
        wins.push(card.itemType); winsCount++;
      } else if (slot >= 0 && cells > 0) {
        cells--; wins.push(card.itemType); winsCount++;      /* бережём единственный Трофей */
      } else if (slot >= 0) {
        team[slot].trophy = null;
        wins.push(card.itemType); winsCount++;
      } else if (cells > 0) {
        cells--; wins.push(card.itemType); winsCount++;
      } else {
        const alive = team.map((k, i) => k.alive ? i : -1).filter(i => i >= 0);
        if (alive.length) {
          const i = alive[Math.floor(rng.next() * alive.length)];
          team[i].alive = false; lost++;
          const why = hasMag(team) ? 'Маг в команде — нужна Бумага' : 'не хватило подходящего Трофея';
          lossBy[card.itemType] = (lossBy[card.itemType] || 0) + 1;
          lossWhy[why] = (lossWhy[why] || 0) + 1;
          log.push('ход ' + turns + ': проигран бой с ' + card.itemType + ' (' + why + ') — потерян Персонаж');
        }
      }
      continue;
    }
    if (card.kind === 'tile') {
      const def = KVP.tileCardById(card.itemType);
      const cands = placementCandidates(dungeon, def.shape);
      if (!cands.length) {
        if (def.id === KVP.CHEST_TILE.id) { errs.push('ход ' + turns + ': карту с Сундуком некуда положить'); break; }
        log.push('ход ' + turns + ': нет места для ' + def.name + ' — карта в сброс');
        continue;   /* карта уходит в сброс, игра продолжается */
      }
      /* Ставим карту: вход — к соседней карте, и проверяем, что проход реально есть. */
      let placed = null;
      for (const c of cands) {
        const rots = validRotations(def.shape, OPP[c.dir]);
        for (const rot of rots) {
          const room = dungeon.placeTile(def.id, c.gx, c.gz, rot);
          if (!room) continue;
          const src = dungeon.rooms[c.roomId];
          if (dungeon.passage(src, c.dir)) { placed = { c, rot, room }; break; }
          /* прохода нет — убираем и пробуем дальше */
          dungeon.rooms.pop();
          dungeon._rebuildSolid();
        }
        if (placed) break;
      }
      if (!placed) {
        errs.push('ход ' + turns + ': не удалось выложить ' + def.name + ' проходом к соседней карте');
        break;
      }
      map.push({ cardId: def.id, gx: placed.c.gx, gz: placed.c.gz, rot: placed.rot });
      if (def.id === KVP.CHEST_TILE.id) { chestPlaced = true; chestCard = placed.room; }
      continue;
    }
  }

  if (!chestPlaced) errs.push('Сундук не выложен: карта не дошла до конца колоды');

  /* Проверяем, что до Сундука можно дойти. */
  let reachable = false, dist = -1;
  if (chestCard) {
    const q = [dungeon.rooms[0].id], d = { 0: 0 };
    while (q.length) {
      const id = q.shift();
      const t = dungeon.rooms[id];
      for (const dir of DIR_LIST) {
        if (!dungeon.passage(t, dir)) continue;
        const n = dungeon.neighborCell(t.gx, t.gz, dir);
        const nt = dungeon.tileAt(n.gx, n.gz);
        if (nt && d[nt.id] == null) { d[nt.id] = d[id] + 1; q.push(nt.id); }
      }
    }
    reachable = d[chestCard.id] != null;
    dist = d[chestCard.id] == null ? -1 : d[chestCard.id];
  }
  if (chestPlaced && !reachable) errs.push('до Сундука невозможно дойти');

  /* Проверяем, что каждая выложенная карта имеет вход с соседней. */
  for (let i = 1; i < map.length; i++) {
    const m = map[i];
    const room = dungeon.tileAt(m.gx, m.gz);
    if (!room) { errs.push('карта на поле не найдена'); continue; }
    let hasEntrance = false;
    for (const dir of DIR_LIST) {
      const n = dungeon.neighborCell(room.gx, room.gz, dir);
      const other = dungeon.tileAt(n.gx, n.gz);
      if (other && other.exits[OPP[dir]] && room.exits[dir]) { hasEntrance = true; break; }
    }
    if (!hasEntrance) errs.push('карта «' + (KVP.tileCardById(m.cardId) || {}).name + '» выложена БЕЗ входа с соседней карты');
  }

  return {
    seed: seed, turns: turns, errs: errs, log: log,
    teamAlive: team.filter(k => k.alive).length, lost: lost,
    fights: fights, wins: winsCount, tiles: map.length - 1,
    chestPlaced: chestPlaced, chestDist: dist, reachable: reachable,
    deckLeft: deck.length, lossBy: lossBy, lossWhy: lossWhy
  };
}

function canCatch() { return true; }

/* ------------------------------------------------------------------ */
/*  Запуск                                                             */
/* ------------------------------------------------------------------ */
const N = parseInt(process.argv[2] || '30', 10);
const TEAM = parseInt(process.argv[3] || '3', 10);
const REPORT = process.argv[4] || '';
const errs = [];
const out = [];
function say(s) { out.push(s); console.log(s); }
const info = checkDeck(errs);
say('=== Состав колоды ===');
say('всего карт: ' + info.total);
const keys = Object.keys(info.count).sort();
for (const k of keys) console.log('  ' + k.padEnd(20) + ' × ' + info.count[k]);

say('\n=== Симуляция партий (' + N + ') ===');
let fail = 0, totalTurns = 0, chestOk = 0, reachOk = 0, fights = 0, wins = 0, lost = 0;
const lossBy = {}, lossWhy = {}, teamLeft = {};
for (let i = 0; i < N; i++) {
  const r = playGame(1000 + i * 7919, { team: TEAM });
  totalTurns += r.turns; fights += r.fights; wins += r.wins; lost += r.lost;
  teamLeft[r.teamAlive] = (teamLeft[r.teamAlive] || 0) + 1;
  for (const k of Object.keys(r.lossBy)) lossBy[k] = (lossBy[k] || 0) + r.lossBy[k];
  for (const k of Object.keys(r.lossWhy)) lossWhy[k] = (lossWhy[k] || 0) + r.lossWhy[k];
  if (r.chestPlaced) chestOk++;
  if (r.reachable) reachOk++;
  if (r.errs.length) {
    fail++;
    console.log('  партия ' + i + ' (seed ' + (1000 + i * 7919) + '): ОШИБКИ');
    r.errs.forEach(e => console.log('     · ' + e));
    r.log.slice(0, 6).forEach(l => console.log('     - ' + l));
  }
}
say('партий с ошибками: ' + fail + ' из ' + N);
say('средняя длина партии: ' + (totalTurns / N).toFixed(1) + ' ходов');
say('Сундук выложен в ' + chestOk + '/' + N + ' партиях');
say('до Сундука дойти можно в ' + reachOk + '/' + N + ' партиях');
say('всего боёв с картами-ПароБотами: ' + fights + ', побед: ' + wins + ', потерянных Персонажей: ' + lost);
say('потерянные Персонажи по типам бота: ' + JSON.stringify(lossBy));
say('причины потерь: ' + JSON.stringify(lossWhy));
say('сколько Рыцарей осталось к концу партии: ' + JSON.stringify(teamLeft));
if (errs.length) {
  console.log('\n=== ОШИБКИ СОСТАВА ===');
  errs.forEach(e => console.log('  · ' + e));
}
if (REPORT) { fs.writeFileSync(REPORT, out.join('\n'), 'utf8'); }
process.exit((fail || errs.length) ? 1 : 0);
