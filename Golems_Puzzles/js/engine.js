/*
 * Golems Puzzles — rules engine (no rendering).
 * Deterministic simulator of "Битва Големов v4.0" mechanics for the puzzle course.
 *
 * simulate(level, scenario, program) -> { frames, result, message, log }
 *   level    – entry from window.BG4_LEVELS.rooms
 *   scenario – entry from window.BG4_SCENARIOS[level.id] (may be undefined)
 *   program  – engine IR: { lines:[Statement], endless:boolean }
 *
 * Statement: { t:'cmd', cmd } | { t:'loop', body } | { t:'if', then, else }
 *
 * Frames are JSON snapshots of the world that the 3D renderer animates.
 */
(function () {
  'use strict';
  const BG4 = (window.BG4 = window.BG4 || {});

  const DIRS = {
    N: { dr: -1, dc: 0, rot: 0 },
    E: { dr: 0, dc: 1, rot: 90 },
    S: { dr: 1, dc: 0, rot: 180 },
    W: { dr: 0, dc: -1, rot: 270 },
  };
  const DIR_ORDER = ['N', 'E', 'S', 'W'];
  const RIGHT = { N: 'E', E: 'S', S: 'W', W: 'N' };
  const LEFT = { N: 'W', W: 'S', S: 'E', E: 'N' };
  const OPPOSITE = { N: 'S', S: 'N', E: 'W', W: 'E' };
  const key = (r, c) => r + ',' + c;
  const parseKey = (k) => k.split(',').map(Number);

  const FIELD_SIZE = {
    '4x4': [4, 4], '2x4_1': [2, 4], '2x4_2': [2, 4], '4x2_1': [4, 2], '4x2_2': [4, 2],
  };

  // ---------- world construction ----------

  function validCells(level) {
    const set = new Set();
    for (const f of level.fields) {
      const [w, h] = FIELD_SIZE[f.key] || [4, 4];
      for (let dr = 0; dr < h; dr++) for (let dc = 0; dc < w; dc++) set.add(key(f.row + dr, f.col + dc));
    }
    return set;
  }

  function buildWorld(level) {
    const w = {
      valid: validCells(level),
      water: new Set(), ice: new Set(), walls: new Set(), goals: new Set(),
      lines: new Map(), portals: [], barrels: [], golems: [],
      destroyed: new Set(),
    };
    for (const t of level.tokens) {
      const k = key(t.r, t.c);
      if (!w.valid.has(k)) continue; // «жетоны из руки» живут вне поля, пока их не поставят
      switch (t.type) {
        case 'water': w.water.add(k); break;
        case 'wall': w.walls.add(k); break;
        case 'ice': w.ice.add(k); break;
        case 'goal': w.goals.add(k); break;
        case 'portal': w.portals.push({ r: t.r, c: t.c }); break;
        case 'line_straight':
        case 'line_corner': w.lines.set(k, { kind: t.type === 'line_straight' ? 'straight' : 'corner', rot: t.rot }); break;
        case 'barrel': w.barrels.push({ r: t.r, c: t.c, content: 'empty', floating: false }); break;
        default: break;
      }
    }
    // barrels that start on water are floating (bridges)
    for (const b of w.barrels) b.floating = w.water.has(key(b.r, b.c));
    if (level.start) {
      w.golems.push({
        id: 'player', color: level.start.color, r: level.start.r, c: level.start.c,
        dir: level.start.dir, alive: true, damage: 0, isPlayer: true, hp: 4,
      });
    }
    level.bots.forEach((b, i) => {
      w.golems.push({
        id: 'bot' + i, color: b.color, r: b.r, c: b.c, dir: b.dir,
        alive: true, damage: 0, hp: 1, isPlayer: false, botIndex: i,
      });
    });
    return w;
  }

  // ---------- cell helpers ----------

  function golemAt(w, r, c) { return w.golems.find((g) => g.alive && g.r === r && g.c === c) || null; }
  function barrelAt(w, r, c) { for (let i = w.barrels.length - 1; i >= 0; i--) { const b = w.barrels[i]; if (b.r === r && b.c === c) return b; } return null; }
  function barrelCountAt(w, r, c) { return w.barrels.filter((b) => b.r === r && b.c === c).length; }
  function isWater(w, r, c) { const k = key(r, c); return w.water.has(k) && !w.destroyed.has('water:' + k); }
  function isIce(w, r, c) { const k = key(r, c); return w.ice.has(k) && !w.destroyed.has('ice:' + k); }
  function isWall(w, r, c) { const k = key(r, c); return w.walls.has(k) && !w.destroyed.has('wall:' + k); }
  function lineAt(w, r, c) { const k = key(r, c); return w.destroyed.has('line:' + k) ? null : (w.lines.get(k) || null); }
  function portalAt(w, r, c) { return w.portals.find((p) => p.r === r && p.c === c && !w.destroyed.has('portal:' + key(r, c))) || null; }

  // Obstacle for the "Если Препятствие" condition.
  function obstacleAhead(w, g) {
    const d = DIRS[g.dir];
    const r = g.r + d.dr, c = g.c + d.dc;
    if (!w.valid.has(key(r, c))) return true;
    if (isWall(w, r, c)) return true;
    const b = barrelAt(w, r, c);
    if (b && barrelIsDry(w, b)) return true;                // dry barrel — obstacle
    if (golemAt(w, r, c)) return true;
    if (lineAt(w, r, c)) return true;
    // «Считаем, что Бочка в воде не определяется как Препятствие» (подсказка 4.10):
    // плавающая Бочка укрывает воду — её можно добить или перейти по ней.
    if (b) return false;
    if (isWater(w, r, c)) return true;
    return false;
  }
  // For bots: a floating barrel (bridge) is NOT an obstacle.
  function obstacleAheadBot(w, g) {
    const d = DIRS[g.dir];
    const r = g.r + d.dr, c = g.c + d.dc;
    if (!w.valid.has(key(r, c))) return true;
    if (isWall(w, r, c)) return true;
    const b = barrelAt(w, r, c);
    if (b && !b.floating) return true;
    if (isWater(w, r, c) && !b) return true;
    if (lineAt(w, r, c)) return true;
    if (golemAt(w, r, c)) return true;
    return false;
  }

  // ---------- snapshot ----------

  function snapshot(w, log, extra) {
    return {
      golems: w.golems.filter((g) => g.alive).map((g) => ({ id: g.id, color: g.color, r: g.r, c: g.c, dir: g.dir, isPlayer: !!g.isPlayer, damage: g.damage })),
      barrels: w.barrels.map((b) => ({ r: b.r, c: b.c, content: b.content, floating: !!b.floating })),
      ice: [...w.ice].filter((k) => !w.destroyed.has('ice:' + k)),
      water: [...w.water].filter((k) => !w.destroyed.has('water:' + k)),
      walls: [...w.walls].filter((k) => !w.destroyed.has('wall:' + k)),
      lines: [...w.lines.entries()].filter(([k]) => !w.destroyed.has('line:' + k)).map(([k, v]) => ({ r: +k.split(',')[0], c: +k.split(',')[1], kind: v.kind, rot: v.rot })),
      portals: w.portals.filter((p) => !w.destroyed.has('portal:' + key(p.r, p.c))).map((p) => ({ r: p.r, c: p.c })),
      goals: [...w.goals],
      log: log.slice(-6),
      ...(extra || {}),
    };
  }

  // ---------- movement ----------

  function pushBarrels(w, r, c, dr, dc, node, log) {
    const stack = w.barrels.filter((b) => b.r === r && b.c === c);
    if (!stack.length) return true;
    const nr = r + dr, nc = c + dc;
    if (!w.valid.has(key(nr, nc))) return false;
    if (isWall(w, nr, nc)) return false;
    if (golemAt(w, nr, nc)) return false;
    if (barrelCountAt(w, nr, nc)) return false;
    if (portalAt(w, nr, nc)) {
      for (const b of stack) w.barrels.splice(w.barrels.indexOf(b), 1);
      node.push({ type: 'vanish', pos: [r, c] });
      log.push('Бочка исчезла в Портале');
      return true;
    }
    for (const b of stack) { b.r = nr; b.c = nc; b.floating = isWater(w, nr, nc); }
    node.push({ type: 'push', from: [r, c], to: [nr, nc] });
    return true;
  }

  function enterCell(w, g, r, c, node, log) {
    g.r = r; g.c = c;
    const line = lineAt(w, r, c);
    if (line) {
      node.push({ type: 'line', pos: [r, c] });
    }
    const p = portalAt(w, r, c);
    if (p) {
      const other = w.portals.find((q) => q !== p && !w.destroyed.has('portal:' + key(q.r, q.c)));
      if (other && !golemAt(w, other.r, other.c)) {
        g.r = other.r; g.c = other.c;
        node.push({ type: 'portal', from: [r, c], to: [other.r, other.c] });
        log.push('Голем прошёл через Портал');
      }
    }
    if (w.goals.has(key(g.r, g.c))) node.push({ type: 'goal' });
  }
  function rotToDir(rot) { return { 0: 'N', 90: 'E', 180: 'S', 270: 'W' }[rot] || null; }

  // returns: 'moved' | 'blocked' | 'drowned'
  function step(w, g, sign, node, log) {
    const d = DIRS[g.dir];
    const nr = g.r + d.dr * sign, nc = g.c + d.dc * sign;
    if (!w.valid.has(key(nr, nc))) { log.push('Упёрся в край поля'); return 'blocked'; }
    if (isWall(w, nr, nc)) { log.push('Стена — ход невозможен'); return 'blocked'; }
    const other = golemAt(w, nr, nc);
    if (other) { return 'blocked'; }
    const destBarrel = barrelAt(w, nr, nc);
    if (destBarrel) {
      if (destBarrel.floating && isWater(w, nr, nc)) {
        // A barrel floating in water is a bridge: step onto it, it stays in place.
        enterCell(w, g, nr, nc, node, log);
        return 'moved';
      }
      if (!pushBarrels(w, nr, nc, d.dr * sign, d.dc * sign, node, log)) return 'blocked';
    }
    if (isWater(w, nr, nc) && !barrelAt(w, nr, nc) && !isIce(w, nr, nc)) {
      return 'drowned';
    }
    enterCell(w, g, nr, nc, node, log);
    return 'moved';
  }

  function turnG(g, dir, node) {
    if (g.dir === dir) return;
    node.push({ type: 'rotate', who: g.id, from: g.dir, to: dir });
    g.dir = dir;
  }

  // ---------- attacks (deferred) ----------

  function addPending(w, target, fromId, force, node, dir) {
    // `dir` keeps the direction the blow came from, so the objectives can check
    // «атака в лоб» / «атака сбоку» (3.7/3.8/3.9).
    w.pending.push({ target: target.id, from: fromId, amount: force, dir: dir || null, targetDir: target.dir || null });
    node.push({ type: 'hit', who: target.id, from: fromId, amount: force });
  }

  function attackCell(w, g, r, c, node, log) {
    if (!w.valid.has(key(r, c))) { log.push('Атака в пустоту'); return; }
    const b = barrelAt(w, r, c);
    if (b) {
      // бомба в Бочке (4.10): удар по сухой Бочке — взрыв, а не разрушение
      if (bombArmed(w) && barrelIsDry(w, b)) { explodeBarrel(w, b, node, log); return; }
      breakBarrel(w, b, g, node, log);
      return;
    }
    if (portalAt(w, r, c)) { w.destroyed.add('portal:' + key(r, c)); node.push({ type: 'destroy', kind: 'portal', pos: [r, c] }); log.push('Портал разрушен'); return; }
    if (lineAt(w, r, c)) { w.destroyed.add('line:' + key(r, c)); node.push({ type: 'destroy', kind: 'line', pos: [r, c] }); log.push('Линия разрушена'); return; }
    if (isIce(w, r, c)) { w.destroyed.add('ice:' + key(r, c)); node.push({ type: 'destroy', kind: 'ice', pos: [r, c] }); log.push('Лёд разбит'); const under = golemAt(w, r, c); if (under) addPending(w, under, g.id, 1, node); return; }
    const t = golemAt(w, r, c);
    if (t) { addPending(w, t, g.id, 1, node, g.dir); return; }
    if (isWall(w, r, c)) { log.push('Атака по Стене — без эффекта'); return; }
    log.push('Атака не нашла цель');
  }

  // ---------- бомба в Бочке (параметры уровня; пример — 4.10) ----------

  function bombArmed(w) { return !!(w.bomb && !w.bomb.exploded); }
  // «мокрая» Бочка — та, что плавает в воде (бомба намокла)
  function barrelIsDry(w, b) { return !(b.floating && isWater(w, b.r, b.c)); }

  // Взрыв: Бочка исчезает, всё живое в радиусе получает урон (у бомбы — смертельный).
  function explodeBarrel(w, b, node, log) {
    const bomb = w.bomb || {};
    const R = bomb.radius == null ? 1 : bomb.radius;
    const dmg = bomb.damage == null ? 4 : bomb.damage;
    w.barrels.splice(w.barrels.indexOf(b), 1);
    if (w.bomb) { w.bomb.exploded = true; w.bomb.at = [b.r, b.c]; }
    node.push({ type: 'explode', pos: [b.r, b.c] });
    log.push('Бомба взорвалась!');
    for (const g2 of w.golems.slice()) {
      if (!g2.alive) continue;
      if (Math.max(Math.abs(g2.r - b.r), Math.abs(g2.c - b.c)) > R) continue;
      addPending(w, g2, 'bomb', dmg, node);
    }
  }

  // Предохранитель: `fuse` — сколько команд даётся игроку, чтобы столкнуть Бочку в воду.
  // Проверка идёт ПОСЛЕ каждой выполненной команды: если отведённые команды кончились,
  // а Бочка всё ещё на суше — взрыв (при `fuse: 1` — уже после первой команды).
  function tickBomb(w, node, log) {
    const bomb = w.bomb;
    if (!bomb || bomb.exploded) return;
    bomb.commands = (bomb.commands || 0) + 1;
    if (bomb.fuse == null || bomb.commands < bomb.fuse) return;
    const dry = w.barrels.find((b) => barrelIsDry(w, b));
    if (dry) explodeBarrel(w, dry, node, log);
  }

  function breakBarrel(w, b, attacker, node, log) {
    const wasSoaked = !barrelIsDry(w, b);
    w.barrels.splice(w.barrels.indexOf(b), 1);
    node.push({ type: 'break_barrel', pos: [b.r, b.c], by: attacker && attacker.id });
    log.push('Бочка разрушена');
    if (wasSoaked) {
      w.soaked = true; // разрушена в воде — бомба намокла и обезврежена
      log.push('Бомба намокла');
    }
    if (b.floating) {
      log.push('Бочка утонула');
      const on = golemAt(w, b.r, b.c);
      if (on) {
        if (on.isPlayer) drownPlayer(w, on, node, log);
        else { on.alive = false; node.push({ type: 'killed', who: on.id, reason: 'water' }); log.push('Робот упал в Воду и сломался'); }
      }
    }
  }

  function attackForward(w, g, node, log) {
    const d = DIRS[g.dir];
    attackCell(w, g, g.r + d.dr, g.c + d.dc, node, log);
  }
  function attackSide(w, g, node, log, side, log2) {
    // side: 'left'|'right'|'both'
    const dirs = side === 'both' ? [LEFT[g.dir], RIGHT[g.dir]] : [side === 'left' ? LEFT[g.dir] : RIGHT[g.dir]];
    for (const dir of dirs) {
      const d = DIRS[dir];
      attackCell(w, g, g.r + d.dr, g.c + d.dc, node, log);
    }
  }

  // ---------- resolve deferred damage for the line ----------

  function resolveLine(w, node, log) {
    const byTarget = {};
    const atkDirs = {};
    for (const p of w.pending) {
      byTarget[p.target] = (byTarget[p.target] || 0) + p.amount;
      if (p.dir) (atkDirs[p.target] = atkDirs[p.target] || []).push({ dir: p.dir, targetDir: p.targetDir });
    }
    for (const tid of Object.keys(byTarget)) {
      const g = w.golems.find((x) => x.id === tid && x.alive);
      if (!g) continue;
      const dmg = byTarget[tid];
      const def = w.defense[tid] || 0;
      const net = Math.max(0, dmg - def);
      if (def > 0 && net < dmg) { node.push({ type: 'blocked', who: tid, amount: dmg - net }); log.push('Защита поглотила урон'); }
      if (net <= 0) continue;
      g.damage += net;
      node.push({ type: 'damage', who: tid, amount: net });
      if (!g.isPlayer && g.damage >= (g.hp || 1)) {
        g.alive = false;
        node.push({ type: 'killed', who: tid });
        // how the killing blow landed (the last one of the line)
        const dirs = atkDirs[tid] || [];
        const last = dirs[dirs.length - 1];
        w.kills = w.kills || {};
        w.kills[tid] = { frontal: !!last && last.dir === OPPOSITE[last.targetDir] };
        log.push('Робот-противник выведен из строя');
      }
      if (g.isPlayer && g.damage >= 4) { node.push({ type: 'dead', who: tid }); log.push('Голем игрока разрушен'); }
    }
    w.pending = [];
    w.defense = {};
  }

  // ---------- player statement execution ----------

  function executeCommand(w, g, cmd, node, log, ctx) {
    switch (cmd) {
      case 'forward': return step(w, g, +1, node, log);
      case 'back': return step(w, g, -1, node, log);
      case 'left': turnG(g, LEFT[g.dir], node); return 'turned';
      case 'right': turnG(g, RIGHT[g.dir], node); return 'turned';
      case 'wait': log.push('Голем стоит на месте'); return 'warp';
      case 'attack': attackForward(w, g, node, log); return 'attacked';
      case 'defend': w.defense[g.id] = (w.defense[g.id] || 0) + 1; node.push({ type: 'defend', who: g.id }); log.push('Голем защищается'); return 'defended';
      default: return 'unknown';
    }
  }

  function runStatement(w, g, st, node, log, ctx, nested) {
    if (!st) return;
    // Bots that act before EVERY player card (4.8: «Синий Голем движется только
    // вперёд» — он шагает и внутри Цикла). A card is a «cmd» or an «if»; the
    // statements inside an «if» are part of the same card, hence `nested`.
    const botTurn = () => { if (!nested && ctx && ctx.beforeCommand) ctx.beforeCommand(); };
    const flush = () => { if (ctx && ctx.afterCommand) ctx.afterCommand(); };
    if (st.t === 'cmd') {
      botTurn();
      const r = executeCommand(w, g, st.cmd, node, log, ctx);
      // Предохранитель бомбы (4.10): после отведённых команд сухая Бочка взрывается.
      tickBomb(w, node, log);
      flush();
      if (r === 'drowned') drownPlayer(w, g, node, log);
      return;
    }
    if (st.t === 'loop') { runStatement(w, g, st.body, node, log, ctx); runStatement(w, g, st.body, node, log, ctx); return; }
    if (st.t === 'if') {
      botTurn();
      const obs = obstacleAhead(w, g);
      log.push(obs ? 'Условие: Препятствие ЕСТЬ' : 'Условие: Препятствия НЕТ');
      runStatement(w, g, obs ? st.then : st.else, node, log, ctx, true);
      flush();
    }
  }

  function drownPlayer(w, g, node, log) {
    g.damage = 4; g.alive = false;
    node.push({ type: 'drowned', who: g.id });
    log.push('Голем упал в Воду!');
  }

  // ---------- bot block programs ----------

  // Node types (authored in scenarios):
  //  { c:'move', n }                      Идти n шагов
  //  { c:'turn', d:'cw'|'ccw', n }        Повернуть на n градусов
  //  { c:'attack', side:'front'|'both' }  Атака
  //  { c:'repeat', n, body:[...] }        Повторить n раз
  //  { c:'ifSee', side, then, else }      Если Вижу противника на расстоянии 1
  //  { c:'ifObstacle', n:0|1, then, else } Если Препятствие = n
  //  { c:'ifAttack', n:1, then, else }    Если Можно в Атаку = n
  //  { c:'ai', value }                    Кинь AI кубик
  //  { c:'wait' }

  function playerGolem(w) { return w.golems.find((g) => g.isPlayer && g.alive) || null; }

  function botSeesPlayer(w, g, side) {
    const p = playerGolem(w); if (!p) return false;
    if (side === 'both') {
      return (LEFT[g.dir] && p.r === g.r + DIRS[LEFT[g.dir]].dr && p.c === g.c + DIRS[LEFT[g.dir]].dc) ||
             (p.r === g.r + DIRS[RIGHT[g.dir]].dr && p.c === g.c + DIRS[RIGHT[g.dir]].dc);
    }
    const d = DIRS[g.dir];
    return p.r === g.r + d.dr && p.c === g.c + d.dc;
  }

  function botKill(w, g, node, log, reason) {
    g.alive = false;
    node.push({ type: 'killed', who: g.id, reason: reason || 'water' });
    log.push('Робот-противник вышел из строя');
  }

  function runBotNode(w, g, prg, node, log) {
    if (!g.alive) return;
    if (Array.isArray(prg)) { for (const n of prg) { if (!g.alive) break; runBotNode(w, g, n, node, log); } return; }
    switch (prg.c) {
      case 'move': {
        for (let i = 0; i < (prg.n || 1); i++) {
          const r = step(w, g, +1, node, log);
          if (r === 'blocked') break;
          if (r === 'drowned') { botKill(w, g, node, log, 'water'); break; }
        }
        break;
      }
      case 'turn': {
        const times = Math.round((prg.n || 90) / 90) % 4;
        for (let i = 0; i < times; i++) turnG(g, prg.d === 'ccw' ? LEFT[g.dir] : RIGHT[g.dir], node);
        break;
      }
      case 'attack': attackForward(w, g, node, log); break;
      case 'attackBoth': attackSide(w, g, node, log, 'both'); break;
      case 'repeat': for (let i = 0; i < (prg.n || 2); i++) { if (!g.alive) break; runBotNode(w, g, prg.body, node, log); } break;
      case 'ifSee': {
        const sees = botSeesPlayer(w, g, prg.side || 'front');
        runBotNode(w, g, sees ? prg.then : prg.else, node, log);
        break;
      }
      case 'ifObstacle': {
        const obs = obstacleAheadBot(w, g) ? 1 : 0;
        runBotNode(w, g, obs === (prg.n == null ? 1 : prg.n) ? prg.then : prg.else, node, log);
        break;
      }
      case 'ifAttack': {
        const can = botSeesPlayer(w, g, prg.side || 'front') ? 1 : 0;
        runBotNode(w, g, can === (prg.n == null ? 1 : prg.n) ? prg.then : prg.else, node, log);
        break;
      }
      case 'ai': {
        const cmd = (w._aiTable && w._aiTable[prg.value]) || 'wait';
        if (cmd === 'forward') runBotNode(w, g, { c: 'move', n: 1 }, node, log);
        else if (cmd === 'back') { const r = step(w, g, -1, node, log); if (r === 'drowned') botKill(w, g, node, log); }
        else if (cmd === 'left') turnG(g, LEFT[g.dir], node);
        else if (cmd === 'right') turnG(g, RIGHT[g.dir], node);
        else if (cmd === 'attack') attackForward(w, g, node, log);
        break;
      }
      default: break;
    }
  }

  // ---------- environment dynamics (moving barrels) ----------

  function runEnvironmentTick(w, when, lineNo, log, frames) {
    if (!w._dynamics) return;
    const node = [];
    let changed = false;
    for (const rule of w._dynamics) {
      if (rule.when !== when) continue;
      changed = applyBarrelRule(w, rule, lineNo, log, node) || changed;
    }
    if (changed && node.length) frames.push({ ...snapshot(w, log), events: node, phase: 'env-' + when });
  }

  function applyBarrelRule(w, rule, lineNo, log, node) {
    if (rule.mode === 'line' || rule.mode === 'pingpong' || rule.mode === 'loop') {
      const cells = rule.cells;
      const idx = rule._idx == null ? 0 : rule._idx;
      rule._dir = rule._dir || 1;
      let ni = idx + rule._dir;
      if (rule.mode === 'loop') ni = (ni + cells.length) % cells.length;
      else if (ni < 0 || ni >= cells.length) { rule._dir *= -1; ni = idx + rule._dir; }
      ni = Math.max(0, Math.min(cells.length - 1, ni));
      const [fr, fc] = cells[idx], [tr, tc] = cells[ni];
      const b = barrelAt(w, fr, fc);
      if (!b) { rule._idx = ni; return false; }
      if (barrelCountAt(w, tr, tc)) return false;
      if (golemAt(w, tr, tc)) { if (rule.mode !== 'loop') rule._dir *= -1; return false; }
      b.r = tr; b.c = tc; b.floating = isWater(w, tr, tc);
      node.push({ type: 'push', from: [fr, fc], to: [tr, tc] });
      rule._idx = ni;
      return true;
    }
    if (rule.mode === 'crushCheck') {
      // handled elsewhere
    }
    return false;
  }

  // ---------- objectives ----------

  function makeObjective(level, scenario) {
    const scn = scenario || {};
    const obj = scn.objective || { type: level.goals.length && !level.bots.length ? 'goal' : (level.bots.length ? 'defeat' : 'goal') };
    const type = typeof obj === 'string' ? obj : obj.type;
    const targets = typeof obj === 'object' && obj.targets ? obj.targets : null;
    const constraints = scn.constraints || {};
    const bumpGoal = scn.botGoal !== false && level.bots.length > 0 && level.goals.length > 0;
    return {
      type, constraints,
      check(w, g, atEnd) {
        if (w.bomb && w.bomb.exploded) {
          return { done: false, failed: true, message: 'Бомба в Бочке взорвалась! Сначала столкните Бочку в воду.' };
        }
        if (!g.alive) return { done: false, failed: true, message: 'Голем вышел из строя' };
        if (constraints.noDamage && g.damage > 0) return { done: false, failed: true, message: 'Голем получил повреждение' };
        if (constraints.noBarrelDamage && w.barrels.length < (w._initialBarrels || 0)) return { done: false, failed: true, message: 'Бочку трогать нельзя' };
        if (constraints.keepBots && targets) {
          if (w.golems.some((x) => !x.isPlayer && !x.alive && !targets.includes(x.color))) return { done: false, failed: true, message: 'Этого робота трогать нельзя!' };
        }
        const liveBots = w.golems.filter((x) => !x.isPlayer && x.alive);
        // lose if a bot reached a goal cell
        if (bumpGoal) {
          for (const b of liveBots) if (w.goals.has(key(b.r, b.c))) return { done: false, failed: true, message: 'Противник добрался до цели!' };
        }
        if (type === 'defeat') {
          const relevant = targets ? liveBots.filter((b) => targets.includes(b.color)) : liveBots;
          const others = targets ? liveBots.filter((b) => !targets.includes(b.color)) : liveBots;
          if (!relevant.length) {
            // «атаковать только сбоку» (3.8) / «только в лоб» (3.7, 3.9)
            if (constraints.flankOnly || constraints.frontOnly) {
              const killed = w.golems.filter((x) => !x.isPlayer && !x.alive && (!targets || targets.includes(x.color)));
              const kills = w.kills || {};
              if (constraints.frontOnly && killed.some((b) => !(kills[b.id] || {}).frontal)) {
                return { done: false, failed: true, message: 'Бить надо в лоб, по передней части робота!' };
              }
              if (constraints.flankOnly && killed.some((b) => (kills[b.id] || {}).frontal)) {
                return { done: false, failed: true, message: 'В лоб бить нельзя — нужен удар сбоку!' };
              }
            }
            if (constraints.mustDamageBots && liveBots.length) return { done: false, failed: false };
            if (constraints.keepBots && others.length === 0) return { done: false, failed: true, message: 'Нельзя уничтожать этого робота' };
            return { done: true, message: 'Задание выполнено!' };
          }
          return { done: false, failed: false };
        }
        if (type === 'survive') {
          const limit = scn.lines || 6;
          if ((w._lineCounter || 0) >= limit) return { done: true, message: 'Голем выжил!' };
          return { done: false, failed: false };
        }
        if (type === 'destroyBarrel') {
          if (!w.barrels.length) return { done: true, message: 'Бочка разрушена!' };
          return { done: false, failed: false };
        }
        if (type === 'soakBarrel') {
          // Правило комнаты 4.10: Бочку нужно СНАЧАЛА столкнуть в воду, а потом
          // разрушить. Разрушенная на суше (или оставленная на суше) — взрыв;
          // оставленная в воде — уровень не пройден, но и не взрывается.
          if (w.soaked) return { done: true, message: 'Бочка намокла — бомба обезврежена!' };
          if (!w.barrels.length) return { done: false, failed: true, message: 'Бочку надо разрушить, пока она плавает в воде!' };
          if (atEnd) {
            const floating = w.barrels.some((b) => !barrelIsDry(w, b));
            return {
              done: false, failed: true,
              message: floating
                ? 'Бочка плавает в воде, но не разрушена — доведите удар!'
                : 'Бочка осталась на суше — столкните её в воду и разрушьте там!',
            };
          }
          return { done: false, failed: false };
        }
        // goal
        if (w.goals.has(key(g.r, g.c))) {
          if (constraints.mustDamageBots) {
            for (const b of liveBots) if ((b.damage || 0) < 1 && !(targets && !targets.includes(b.color))) return { done: false, failed: false };
          }
          return { done: true, message: 'Цель достигнута!' };
        }
        return { done: false, failed: false };
      },
    };
  }

  function checkStaticEnd(level, scenario, player, w, objective) {
    const oc = objective.check(w, player, true);
    if (oc.done) return { result: 'success', message: oc.message };
    return { result: 'fail', message: oc.message || 'Программа закончилась, а цель не достигнута' };
  }

  // ---------- bot plans ----------

  function buildBotPlans(level, scenario) {
    const plans = { preLine: [], perLine: [], perCommand: [] };
    const bots = level.bots.map((b, i) => ({ id: 'bot' + i, index: i, ...b }));
    const authored = (scenario && scenario.bots) || [];
    bots.forEach((b) => {
      const cfg = authored[b.index] || {};
      const kind = cfg.kind || 'idle';
      if (kind === 'program') plans.preLine.push({ id: b.id, program: cfg.program });
      else if (kind === 'perLineProgram') plans.preLine.push({ id: b.id, perLine: cfg.lines });
      else if (kind === 'chess') plans.preLine.push({ id: b.id, chess: { piece: cfg.piece, goal: cfg.goal } });
      else if (kind === 'attackAt') { const byLine = {}; for (const ln of cfg.lines || []) byLine[ln] = 'attack'; plans.perLine.push({ id: b.id, byLine }); }
      else if (kind === 'everyLine') { const byLine = {}; for (let ln = 1; ln <= 64; ln++) byLine[ln] = cfg.cmd || 'forward'; plans.perLine.push({ id: b.id, byLine }); }
      else if (kind === 'everyCommand') plans.perCommand.push({ id: b.id, cmd: cfg.cmd || 'forward' });
    });
    return plans;
  }

  // ---------- greedy chess bots (floor 6) ----------

  const CHESS = {
    pawn: { diag: true, ortho: false, jumps: false, straightOnly: true },
    bishop: { diag: true, ortho: false },
    rook: { diag: false, ortho: true },
    knight: { jumps: true },
    queen: { diag: true, ortho: true },
    king: { diag: true, ortho: true },
  };
  const ORTHO = [[-1, 0], [1, 0], [0, -1], [0, 1]];
  const DIAG = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
  const KNIGHTJ = [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]];

  function dirFromDelta(dr, dc) {
    if (dr < 0) return 'N'; if (dr > 0) return 'S';
    if (dc < 0) return 'W'; return 'E';
  }

  function chessAttackCells(g, piece) {
    const out = [];
    if (piece === 'pawn') { out.push(DIRS[LEFT[g.dir]], DIRS[RIGHT[g.dir]]); return out.map((d) => [g.r + d.dr, g.c + d.dc]); }
    const spec = CHESS[piece] || CHESS.king;
    const deltas = [];
    if (spec.jumps) deltas.push(...KNIGHTJ);
    if (spec.ortho) deltas.push(...ORTHO);
    if (spec.diag) deltas.push(...DIAG);
    for (const [dr, dc] of deltas) out.push([g.r + dr, g.c + dc]);
    return out;
  }

  function chessStep(w, g, cfg, node, log) {
    const piece = cfg.piece || 'king';
    const player = playerGolem(w);
    // 1) attack if the player stands in an attack cell
    for (const [r, c] of chessAttackCells(g, piece)) {
      if (player && player.r === r && player.c === c) {
        const nd = dirFromDelta(r - g.r, c - g.c);
        if (g.dir !== nd) turnG(g, nd, node);
        attackForward(w, g, node, log);
        return;
      }
    }
    // 2) otherwise move toward the goal
    let goal = cfg.goal;
    if (!goal) {
      if (piece === 'pawn') goal = { r: g.r < 2 ? 3 : 0, c: g.c };
      else goal = { r: g.r < 2 ? 3 : 0, c: g.c < 2 ? 3 : 0 };
    }
    const spec = CHESS[piece] || CHESS.king;
    let deltas;
    if (spec.straightOnly) deltas = [[goal.r < g.r ? -1 : 1, 0]];
    else if (spec.jumps) deltas = KNIGHTJ;
    else { deltas = []; if (spec.ortho) deltas.push(...ORTHO); if (spec.diag) deltas.push(...DIAG); }
    let best = null, bestScore = Infinity;
    for (const [dr, dc] of deltas) {
      const r = g.r + dr, c = g.c + dc;
      if (!w.valid.has(key(r, c))) continue;
      if (isWall(w, r, c)) continue;
      if (golemAt(w, r, c)) continue;
      const b = barrelAt(w, r, c);
      if (b && !b.floating) continue;
      const score = Math.abs(r - goal.r) + Math.abs(c - goal.c);
      if (score < bestScore) { bestScore = score; best = [dr, dc]; }
    }
    if (!best) { log.push('Бот не может двигаться'); return; }
    const nd = dirFromDelta(best[0], best[1]);
    if (g.dir !== nd) turnG(g, nd, node);
    const r = g.r + best[0], c = g.c + best[1];
    if (isWater(w, r, c) && !barrelAt(w, r, c) && !isIce(w, r, c)) { botKill(w, g, node, log, 'water'); return; }
    enterCell(w, g, r, c, node, log);
  }

  // ---------- public simulate ----------

  const MAX_LINES = 400;

  function simulate(level, scenario, program) {
    scenario = scenario || {};
    const w = buildWorld(level);
    if (scenario.dynamics) w._dynamics = JSON.parse(JSON.stringify(scenario.dynamics));
    if (scenario.aiTable) w._aiTable = scenario.aiTable;
    (scenario.bots || []).forEach((cfg, i) => {
      const g = w.golems.find((x) => x.id === 'bot' + i);
      if (g && cfg.hp) g.hp = cfg.hp;
    });
    w.defense = {};
    w.pending = [];
    w._lineCounter = 0;
    w._initialBarrels = w.barrels.length;
    const objective = makeObjective(level, scenario);
    const botPlans = buildBotPlans(level, scenario);

    // Параметры конкретной комнаты (S['X.Y'].params). Первая механика — бомба в Бочке.
    const params = scenario.params || {};
    if (params.bombBarrel) {
      const cfg = params.bombBarrel || {};
      w.bomb = {
        fuse: cfg.fuse == null ? null : cfg.fuse,
        radius: cfg.radius == null ? 1 : cfg.radius,
        damage: cfg.damage == null ? 4 : cfg.damage,
        commands: 0,
        exploded: false,
      };
    }

    const frames = [];
    const log = [];
    const player = w.golems.find((g) => g.isPlayer);
    if (!player) return { frames: [], result: 'error', message: 'Нет Голема игрока', log };

    frames.push(snapshot(w, log, { phase: 'start' }));

    // «Красный Голем начнёт выполнение Программы только если перед ним будет
    // препятствие» (4.4): без Бочки на клетке перед Големом программа не стартует.
    if (scenario.requireObstacle && !obstacleAhead(w, player)) {
      const message = 'Голем не начал выполнение: перед ним нет препятствия. Поставьте Бочку на клетку перед Големом.';
      frames.push({ ...snapshot(w, log), phase: 'end', result: 'fail', message });
      return { frames, result: 'fail', message, log, linesExecuted: 0 };
    }

    const endless = !!scenario.endless;
    const maxPasses = endless ? MAX_LINES : 1;
    let linesExecuted = 0;
    let result = 'running';
    let message = '';

    for (let pass = 0; pass < maxPasses && result === 'running'; pass++) {
      for (let li = 0; li < program.lines.length && result === 'running'; li++) {
        linesExecuted++;
        w._lineCounter++;
        if (linesExecuted > MAX_LINES) { result = 'fail'; message = 'Слишком длинная программа'; break; }
        const lineNo = li + 1;
        w.pending = []; w.defense = {};

        runEnvironmentTick(w, 'before', lineNo, log, frames);

        for (const plan of botPlans.preLine) {
          const g = w.golems.find((x) => x.id === plan.id);
          if (!g || !g.alive) continue;
          const node = [];
          let prg = plan.program;
          if (plan.perLine) prg = plan.perLine[lineNo] || plan.perLine.default;
          if (plan.chess) chessStep(w, g, plan.chess, node, log);
          else if (prg) runBotNode(w, g, prg, node, log);
          if (node.length) frames.push({ ...snapshot(w, log), events: node, actor: g.id, phase: 'bot', line: lineNo });
        }

        for (const plan of botPlans.perLine) {
          const g = w.golems.find((x) => x.id === plan.id);
          if (!g || !g.alive) continue;
          const action = plan.byLine[lineNo];
          if (!action) continue;
          const bnode = [];
          if (action === 'attack') attackForward(w, g, bnode, log);
          else executeCommand(w, g, action, bnode, log, { defending: [] });
          if (bnode.length) frames.push({ ...snapshot(w, log), events: bnode, actor: g.id, phase: 'bot', line: lineNo });
        }

        const ctx = { defending: [] };
        const node = [];
        // Каждая ВЫПОЛНЕННАЯ команда получает свой кадр — тогда виден каждый шаг
        // (4.10: Бочку столкнули в воду → отдельным кадром разрушили её в воде).
        const flush = () => {
          if (!node.length) return;
          const chunk = node.splice(0, node.length);
          frames.push({ ...snapshot(w, log), events: chunk, actor: 'player', line: lineNo, phase: 'player' });
        };
        ctx.afterCommand = flush;
        if (botPlans.perCommand.length) {
          ctx.beforeCommand = () => {
            for (const plan of botPlans.perCommand) {
              const bg = w.golems.find((x) => x.id === plan.id);
              if (!bg || !bg.alive) continue;
              const bnode = [];
              const before = bg.r + ',' + bg.c + ',' + bg.dir;
              executeCommand(w, bg, plan.cmd, bnode, log, { defending: [] });
              if (bnode.length || (bg.r + ',' + bg.c + ',' + bg.dir) !== before) {
                frames.push({ ...snapshot(w, log), events: bnode, actor: bg.id, phase: 'bot', line: lineNo });
              }
            }
          };
        }
        runStatement(w, player, program.lines[li], node, log, ctx);

        resolveLine(w, node, log);
        // (команды уже отдали свои кадры; тут добираем только отложенный урон)
        if (node.length) frames.push({ ...snapshot(w, log), events: node, actor: 'player', line: lineNo, phase: 'player' });

        runEnvironmentTick(w, 'after', lineNo, log, frames);

        const oc = objective.check(w, player);
        if (oc.done) { result = 'success'; message = oc.message; break; }
        if (oc.failed) { result = 'fail'; message = oc.message; break; }
      }
      if (result === 'running' && !endless) {
        const end = checkStaticEnd(level, scenario, player, w, objective);
        result = end.result;
        if (end.message) message = end.message;
      }
    }

    if (result === 'running') { result = 'fail'; message = 'Программа не достигла цели'; }

    frames.push({ ...snapshot(w, log), phase: 'end', result, message });
    return { frames, result, message, log, linesExecuted };
  }

  BG4.Engine = { DIRS, RIGHT, LEFT, OPPOSITE, key, obstacleAhead, simulate, buildWorld, validCells };
})();
