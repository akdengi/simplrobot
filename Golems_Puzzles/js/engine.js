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

  function buildWorld(level, scenario) {
    const w = {
      params: (scenario || {}).params || {},
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
        dir: level.start.dir, alive: true, damage: 0, isPlayer: true,
        hp: w.params.hp || (level.start && level.start.hp) || 1,
      });
    }
    // Этаж 7 («Параллельные Големы»): в комнате ДВА Голема игрока, а Программа
    // у них ОДНА на двоих. Второй — «зеркальный»: команды «Поворот влево» и
    // «Поворот вправо» у него работают наоборот (см. executeCommand).
    if (level.startTwin) {
      w.golems.push({
        id: 'player2', color: level.startTwin.color, r: level.startTwin.r, c: level.startTwin.c,
        dir: level.startTwin.dir, alive: true, damage: 0, isPlayer: true, invertTurns: true, twin: true,
        hp: w.params.twinHp || w.params.hp || (level.startTwin && level.startTwin.hp) || 1,
      });
      w.twin = true;
    }
    level.bots.forEach((b, i) => {
      w.golems.push({
        id: 'bot' + i, color: b.color, r: b.r, c: b.c, dir: b.dir,
        alive: true, damage: 0, isPlayer: false, botIndex: i,
        hp: w.params.botHp || b.hp || 1,
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
      golems: w.golems.filter((g) => g.alive).map((g) => ({ id: g.id, color: g.color, r: g.r, c: g.c, dir: g.dir, isPlayer: !!g.isPlayer, damage: g.damage, hp: g.hp || 1 })),
      // зоны Атаки: подсветка клеток, по которым кто-то может атаковать сейчас
      threats: threats(w),
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
    w._barrelMoved = true; // 1.4/1.5/3.4: «Бочку с места не сдвигать» — сдвинул → проиграл
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
    if (isWall(w, nr, nc)) { log.push('Камень — ход невозможен'); return 'blocked'; }
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
      // бомба в Бочке (4.10): атака по сухой Бочке — взрыв, а не разрушение
      if (bombArmed(w) && barrelIsDry(w, b)) { explodeBarrel(w, b, node, log); return; }
      breakBarrel(w, b, g, node, log);
      return;
    }
    if (portalAt(w, r, c)) { w.destroyed.add('portal:' + key(r, c)); node.push({ type: 'destroy', kind: 'portal', pos: [r, c] }); log.push('Портал разрушен'); return; }
    if (lineAt(w, r, c)) { w.destroyed.add('line:' + key(r, c)); node.push({ type: 'destroy', kind: 'line', pos: [r, c] }); log.push('Линия разрушена'); return; }
    if (isIce(w, r, c)) { w.destroyed.add('ice:' + key(r, c)); node.push({ type: 'destroy', kind: 'ice', pos: [r, c] }); log.push('Лёд разбит'); const under = golemAt(w, r, c); if (under) addPending(w, under, g.id, 1, node); return; }
    const t = golemAt(w, r, c);
    if (t) { addPending(w, t, g.id, 1, node, g.dir); return; }
    if (isWall(w, r, c)) { log.push('Атака по Камню — без эффекта'); return; }
    log.push('Атака не нашла цель');
  }

  // ---------- бомба в Бочке (параметры уровня; пример — 4.10) ----------

  function bombArmed(w) { return !!(w.bomb && !w.bomb.exploded); }
  // «мокрая» Бочка — та, что плавает в воде (бомба намокла)
  function barrelIsDry(w, b) { return !(b.floating && isWater(w, b.r, b.c)); }

  // Взрыв: Бочка исчезает, всё живое в радиусе получает урон (у бомбы — смертельный).
  // opts.immediate — урон применяется СРАЗУ (взрывы из тиков среды, например
  // детонация Бочки на Целевой точке в 5.7): отложенный урон бы потерялся,
  // потому что resolveLine той строки уже отработал — и игрок «не терял» жизнь.
  function explodeBarrel(w, b, node, log, opts) {
    const bomb = w.bomb || {};
    const R = bomb.radius == null ? 1 : bomb.radius;
    const dmg = bomb.damage == null ? 4 : bomb.damage;
    w.barrels.splice(w.barrels.indexOf(b), 1);
    if (w.bomb) { w.bomb.exploded = true; w.bomb.at = [b.r, b.c]; }
    node.push({ type: 'explode', pos: [b.r, b.c] });
    log.push('Бочка взорвалась!');
    for (const g2 of w.golems.slice()) {
      if (!g2.alive) continue;
      if (Math.max(Math.abs(g2.r - b.r), Math.abs(g2.c - b.c)) > R) continue;
      if (opts && opts.immediate) {
        g2.damage = (g2.damage || 0) + dmg;
        node.push({ type: 'damage', who: g2.id, amount: dmg });
        if (g2.damage < (g2.hp || 1)) continue; // выжил (если у Голема не одна жизнь)
        node.push(g2.isPlayer ? { type: 'dead', who: g2.id } : { type: 'killed', who: g2.id, reason: 'explode' });
        g2.alive = false;
        if (g2.isPlayer) {
          w._playerDead = 'boom';
          log.push('Бочка взорвалась и задела Голема!');
        } else log.push('Взрыв уничтожил робота');
      } else addPending(w, g2, 'bomb', dmg, node);
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
    w._barrelsBroken = (w._barrelsBroken || 0) + 1; // разрушена ГОЛЕМОМ (5.7 требует именно этого)
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
      let def = w.defense[tid] || 0;
      // 4.5: «Синий Голем может защититься только стоя лицом к Красному» —
      // Защита поглощает урон, только если защищающийся смотрит на нападающего.
      if (def > 0 && w._defenseFacing) {
        const dirs0 = atkDirs[tid] || [];
        const facing = dirs0.length > 0 && dirs0.every((d) => g.dir === OPPOSITE[d.dir]);
        if (!facing) {
          def = 0;
          node.push({ type: 'defense_broken', who: tid });
          log.push('Защита не сработала: Голем стоит не лицом к противнику');
        }
      }
      const net = Math.max(0, dmg - def);
      if (def > 0 && net < dmg) { node.push({ type: 'blocked', who: tid, amount: dmg - net }); log.push('Защита поглотила урон'); }
      if (net <= 0) continue;
      g.damage += net;
      node.push({ type: 'damage', who: tid, amount: net });
      // У каждого Голема (и игрока, и ботов) ВСЕГО ОДНА жизнь: атака без Защиты
      // уничтожает бота и убивает Голема игрока (уровень проигран).
      if (g.damage < (g.hp || 1)) continue;
      if (g.isPlayer) {
        g.alive = false;
        w._playerDead = 'attack';
        node.push({ type: 'dead', who: tid });
        log.push('Голем игрока разрушен — атака без Защиты!');
        continue;
      }
      g.alive = false;
      node.push({ type: 'killed', who: tid });
      // how the killing blow landed (the last one of the line)
      const dirs = atkDirs[tid] || [];
      const last = dirs[dirs.length - 1];
      w.kills = w.kills || {};
      w.kills[tid] = { frontal: !!last && last.dir === OPPOSITE[last.targetDir] };
      log.push('Робот-противник выведен из строя');
    }
    w.pending = [];
    w.defense = {};
  }

  // ---------- player statement execution ----------

  function executeCommand(w, g, cmd, node, log, ctx) {
    switch (cmd) {
      case 'forward': return step(w, g, +1, node, log);
      case 'back': return step(w, g, -1, node, log);
      case 'left': turnG(g, (g.invertTurns ? RIGHT : LEFT)[g.dir], node); return 'turned';
      case 'right': turnG(g, (g.invertTurns ? LEFT : RIGHT)[g.dir], node); return 'turned';
      case 'wait': log.push('Голем стоит на месте'); return 'warp';
      case 'attack': attackForward(w, g, node, log); return 'attacked';
      case 'defend': w.defense[g.id] = (w.defense[g.id] || 0) + 1; node.push({ type: 'defend', who: g.id }); log.push('Голем защищается'); return 'defended';
      default: return 'unknown';
    }
  }

  // 4.7/4.9: у Голема «сломался блок управления» — часть команд срабатывает
  // ТОЛЬКО внутри Условия (params.inConditionOnly: [команды]).
  const CMD_RU = {
    forward: 'Вперёд', back: 'Назад', left: 'Поворот влево', right: 'Поворот вправо',
    wait: 'Стоять на месте', attack: 'Атака', defend: 'Защита',
  };

  function runStatement(w, g, st, node, log, ctx, nested, inCond) {
    if (!st) return;
    // Bots that act before EVERY player card (4.8: «Синий Голем движется только
    // вперёд» — он шагает и внутри Цикла). A card is a «cmd» or an «if»; the
    // statements inside an «if» are part of the same card, hence `nested`.
    const botTurn = () => { if (!nested && ctx && ctx.beforeCommand) ctx.beforeCommand(); };
    const flush = () => { if (ctx && ctx.afterCommand) ctx.afterCommand(); };
    if (st.t === 'cmd') {
      // «Сломанный блок управления» (4.7: повороты, 4.9: всё движение) —
      // вне Условия такая команда просто не срабатывает.
      const gate = w.params.inConditionOnly;
      if (!inCond && gate && gate.indexOf(st.cmd) >= 0) {
        log.push('Вне Условия команда «' + (CMD_RU[st.cmd] || st.cmd) + '» не срабатывает');
        return;
      }
      botTurn();
      const r = executeCommand(w, g, st.cmd, node, log, ctx);
      // Предохранитель бомбы (4.10): после отведённых команд сухая Бочка взрывается.
      tickBomb(w, node, log);
      flush();
      if (r === 'drowned') drownPlayer(w, g, node, log);
      return;
    }
    if (st.t === 'loop') { runStatement(w, g, st.body, node, log, ctx, false, inCond); runStatement(w, g, st.body, node, log, ctx, false, inCond); return; }
    if (st.t === 'if') {
      botTurn();
      const obs = obstacleAhead(w, g);
      log.push(obs ? 'Условие: Препятствие ЕСТЬ' : 'Условие: Препятствия НЕТ');
      runStatement(w, g, obs ? st.then : st.else, node, log, ctx, true, true);
      flush();
    }
  }

  function drownPlayer(w, g, node, log) {
    g.damage = g.hp || 1; g.alive = false;
    w._playerDead = w._playerDead || 'water';
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

  // Живые Големы игрока. На этаже 7 их ДВА («Параллельные Големы»): красный и
  // синий, у каждого своя Целевая точка, а Программа — общая.
  function playerGolems(w) { return w.golems.filter((g) => g.isPlayer); }
  function livingPlayers(w) { return w.golems.filter((g) => g.isPlayer && g.alive); }
  function playerGolem(w) { return livingPlayers(w)[0] || null; }

  // Пешка (модифицированный робот этажа 6) бьёт как НАСТОЯЩАЯ шахматная пешка:
  // по двум клеткам ПО ДИАГОНАЛИ впереди (слева и справа). Клетку прямо перед
  // собой она НЕ задевает.
  function pawnAttackCells(g) {
    const d = DIRS[g.dir], l = DIRS[LEFT[g.dir]], r = DIRS[RIGHT[g.dir]];
    return [
      [g.r + d.dr + l.dr, g.c + d.dc + l.dc],
      [g.r + d.dr + r.dr, g.c + d.dc + r.dc],
    ];
  }

  // Клетки, по которым этот Голем может атаковать прямо сейчас (для подсветки зон).
  function attackCellsOf(g) {
    if (!g.isPlayer && g.piece === 'pawn') return pawnAttackCells(g);
    const d = DIRS[g.dir];
    return [[g.r + d.dr, g.c + d.dc]];
  }

  // Все клетки на поле, которые сейчас простреливаются чьим-то Атакой.
  // Голем попадает сюда, только если Атака ему доступен: у игрока — если карта
  // «Атака» разрешена в комнате, у бота — если в его программе есть Атака.
  function threats(w) {
    const out = [];
    for (const g of w.golems) {
      if (!g.alive || !g.canAttack) continue;
      for (const [r, c] of attackCellsOf(g)) {
        if (!w.valid.has(key(r, c))) continue;
        out.push({ r, c, who: g.id, kind: g.isPlayer ? 'player' : 'bot', color: g.color });
      }
    }
    return out;
  }

  function botSeesPlayer(w, g, side) {
    const players = livingPlayers(w);
    if (!players.length) return false;
    if (side === 'both') {
      // «Вижу противника слева/справа» у Пешки = две диагонали впереди.
      return pawnAttackCells(g).some(([r, c]) => players.some((p) => p.r === r && p.c === c));
    }
    const d = DIRS[g.dir];
    return players.some((p) => p.r === g.r + d.dr && p.c === g.c + d.dc);
  }

  function botKill(w, g, node, log, reason) {
    g.alive = false;
    node.push({ type: 'killed', who: g.id, reason: reason || 'water' });
    log.push('Робот-противник вышел из строя');
  }

  // Бот выполняет свою программу ПО ШАГАМ: после каждого движения, поворота и
  // атаки вызывается `flush` — движок отдаёт отдельный кадр, и сцена показывает
  // перемещение, а не ставит бота сразу на итоговую клетку (этаж 6 и другие
  // комнаты с программами ботов).
  function runBotNode(w, g, prg, node, log, flush) {
    const done = () => { if (flush) flush(); };
    if (!g.alive) return;
    if (Array.isArray(prg)) { for (const n of prg) { if (!g.alive) break; runBotNode(w, g, n, node, log, flush); } return; }
    switch (prg.c) {
      case 'move': {
        for (let i = 0; i < (prg.n || 1); i++) {
          const was = g.r + ',' + g.c + ',' + g.dir;
          const r = step(w, g, +1, node, log);
          if ((g.r + ',' + g.c + ',' + g.dir) !== was) done();
          if (r === 'blocked') break;
          if (r === 'drowned') { botKill(w, g, node, log, 'water'); done(); break; }
        }
        break;
      }
      case 'turn': {
        const times = Math.round((prg.n || 90) / 90) % 4;
        for (let i = 0; i < times; i++) { turnG(g, prg.d === 'ccw' ? LEFT[g.dir] : RIGHT[g.dir], node); done(); }
        break;
      }
      case 'attack': {
        // Пешка рубит по диагоналям впереди, остальные — клетку перед собой.
        if (g.piece === 'pawn') for (const [r, c] of pawnAttackCells(g)) attackCell(w, g, r, c, node, log);
        else attackForward(w, g, node, log);
        done();
        break;
      }
      case 'attackBoth': attackSide(w, g, node, log, 'both'); done(); break;
      case 'repeat': for (let i = 0; i < (prg.n || 2); i++) { if (!g.alive) break; runBotNode(w, g, prg.body, node, log, flush); } break;
      case 'ifSee': {
        const sees = botSeesPlayer(w, g, prg.side || 'front');
        runBotNode(w, g, sees ? prg.then : prg.else, node, log, flush);
        break;
      }
      case 'ifObstacle': {
        const obs = obstacleAheadBot(w, g) ? 1 : 0;
        runBotNode(w, g, obs === (prg.n == null ? 1 : prg.n) ? prg.then : prg.else, node, log, flush);
        break;
      }
      case 'ifAttack': {
        const can = botSeesPlayer(w, g, prg.side || 'front') ? 1 : 0;
        runBotNode(w, g, can === (prg.n == null ? 1 : prg.n) ? prg.then : prg.else, node, log, flush);
        break;
      }
      case 'ai': {
        const cmd = (w._aiTable && w._aiTable[prg.value]) || 'wait';
        if (cmd === 'forward') runBotNode(w, g, { c: 'move', n: 1 }, node, log, flush);
        else if (cmd === 'back') { const r = step(w, g, -1, node, log); if (r === 'drowned') botKill(w, g, node, log); done(); }
        else if (cmd === 'left') { turnG(g, LEFT[g.dir], node); done(); }
        else if (cmd === 'right') { turnG(g, RIGHT[g.dir], node); done(); }
        else if (cmd === 'attack') { attackForward(w, g, node, log); done(); }
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
      // Голем на пути Бочки. По условиям 5.8/5.9 (rule.crush) Бочка наезжает:
      // стоящих на клетке ломает, игрок проигрывает. В остальных этажах
      // Бочка просто отскакивает, не наезжая (5.5/5.6).
      const victims = w.golems.filter((x) => x.alive && x.r === tr && x.c === tc);
      if (victims.length && !rule.crush) { if (rule.mode !== 'loop') rule._dir *= -1; return false; }
      b.r = tr; b.c = tc; b.floating = isWater(w, tr, tc);
      node.push({ type: 'push', from: [fr, fc], to: [tr, tc] });
      rule._idx = ni;
      if (victims.length) { // rule.crush: Бочка прижала Голема
        for (const v of victims) {
          v.alive = false;
          node.push({ type: 'killed', who: v.id, reason: 'crushed' });
          if (v.isPlayer) { w._playerDead = 'barrel'; log.push('Бочка наехала на Голема!'); }
          else log.push('Бочка наехала на Робота!');
        }
        return true;
      }
      // 5.7: «Бочка … если достигнет Целевой точки, то сдетонирует».
      // Если на Цели стоит сам игрок — он выиграл раньше приезда (проверка ниже),
      // поэтому Бочка отскакивает от него, не взрываясь.
      if (rule.explodeOnGoal && w.goals.has(key(tr, tc))) {
        log.push('Бочка достигла Целевой точки!');
        explodeBarrel(w, b, node, log, { immediate: true });
      }
      return true;
    }
    if (rule.mode === 'crushCheck') {
      // handled elsewhere
    }
    return false;
  }

  // Границы поля (по валидным клеткам) — нужно для правила «дойти до края поля» (4.8).
  function fieldBounds(w) {
    let minR = Infinity, maxR = -Infinity, minC = Infinity, maxC = -Infinity;
    for (const k of w.valid) {
      const [r, c] = parseKey(k);
      if (r < minR) minR = r;
      if (r > maxR) maxR = r;
      if (c < minC) minC = c;
      if (c > maxC) maxC = c;
    }
    return { minR, maxR, minC, maxC };
  }

  // Обязательные элементы программы (3.7/3.8/3.9 — Цикл; 4.1/4.2/4.3 — Условие).
  // Проверяются в момент победы: без них задание не засчитывается.
  function inspectProgram(lines) {
    const f = { loop: false, attack: false, condition: false, condFirst: false };
    const walk = (st) => {
      if (!st) return;
      if (st.t === 'cmd') { if (st.cmd === 'attack') f.attack = true; return; }
      if (st.t === 'loop') { f.loop = true; walk(st.body); return; }
      if (st.t === 'if') { f.condition = true; walk(st.then); walk(st.else); return; }
    };
    for (const st of lines || []) walk(st);
    f.condFirst = !!(lines && lines.length && lines[0] && lines[0].t === 'if');
    return f;
  }
  function programRequirementError(lines, req) {
    if (!req) return null;
    const f = inspectProgram(lines);
    if (req.conditionFirst && !f.condFirst) return 'Условие обязательно должно быть в ПЕРВОЙ строке программы!';
    if (req.condition && !f.condition) return 'В программе обязательно должно быть Условие!';
    if (req.loop && !f.loop) return 'В программе обязательно должен быть Цикл!';
    if (req.attack && !f.attack) return 'В программе обязательно должна быть Атака!';
    return null;
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
        // Големов игрока может быть ДВА (этаж 7): проигрыш — если погиб любой из них.
        const players = w.golems.filter((x) => x.isPlayer);
        const dead = players.find((x) => !x.alive) || null;
        if (w.bomb && w.bomb.exploded) {
          return { done: false, failed: true, message: 'Бомба в Бочке взорвалась! Сначала столкните Бочку в воду.' };
        }
        if (dead) {
          return {
            done: false, failed: true,
            message: w._playerDead === 'water'
              ? 'Голем упал в Воду'
              : w._playerDead === 'boom'
                ? 'Бочка взорвалась и задела Голема — проигрыш!'
                : w._playerDead === 'barrel'
                  ? 'Бочка наехала на Голема! Так проходить эту головоломку нельзя.'
                  : 'Голем игрока разрушен: атака без Защиты! (у Голема одна жизнь)',
          };
        }
        if (constraints.noDamage && players.some((x) => x.damage > 0)) return { done: false, failed: true, message: 'Голем получил повреждение' };
        if (constraints.noBarrelDamage && w.barrels.length < (w._initialBarrels || 0)) return { done: false, failed: true, message: 'Бочку трогать нельзя' };
        // 1.4/1.5/3.4: «Бочку с места не сдвигать!» — сдвинул → проиграл.
        if (constraints.noBarrelMove && w._barrelMoved) {
          return { done: false, failed: true, message: 'Бочку с места сдвигать нельзя! Придётся начать комнату заново' };
        }
        // 2.4: «разрушив только ОДНУ бочку» — две и больше нельзя.
        if (constraints.maxBarrelsBroken != null && (w._barrelsBroken || 0) > constraints.maxBarrelsBroken) {
          return { done: false, failed: true, message: 'Разрушить можно только одну Бочку!' };
        }
        if (constraints.keepBots && targets) {
          if (w.golems.some((x) => !x.isPlayer && !x.alive && !targets.includes(x.color))) return { done: false, failed: true, message: 'Этого робота трогать нельзя!' };
        }
        const liveBots = w.golems.filter((x) => !x.isPlayer && x.alive);
        // lose if a bot reached a goal cell
        if (bumpGoal) {
          for (const b of liveBots) if (w.goals.has(key(b.r, b.c))) return { done: false, failed: true, message: 'Противник добрался до цели!' };
        }
        // 4.8: «не дайте добраться до противоположного края поля ничему» —
        // и Бочка, и Робот-противник, дошедшие до края, означают проигрыш.
        if (constraints.edgeFail) {
          const bd = fieldBounds(w);
          const dir = typeof constraints.edgeFail === 'string' ? constraints.edgeFail : 'W';
          const atEdge = (r, c) => dir === 'W' ? c <= bd.minC : dir === 'E' ? c >= bd.maxC : dir === 'N' ? r <= bd.minR : r >= bd.maxR;
          if (w.barrels.some((x) => atEdge(x.r, x.c))) return { done: false, failed: true, message: 'Бочка добралась до края поля — проигрыш!' };
          if (liveBots.some((x) => atEdge(x.r, x.c))) return { done: false, failed: true, message: 'Робот-противник добрался до края поля — проигрыш!' };
        }
        // Этаж 7: победа — когда ОБА Голема стоят на СВОИХ Целевых точках в один
        // и тот же ход. Токен «Цель» цвета не размечает, поэтому пару
        // «Голем ↔ Цель» задаёт уровень полем twinGoals: { red: {r,c}, blue: {r,c} }.
        if (type === 'twinGoals') {
          const tg = level.twinGoals || {};
          const at = (p, t) => !!p && !!t && p.r === t.r && p.c === t.c;
          const red = players.find((x) => x.color === 'red');
          const blue = players.find((x) => x.color === 'blue');
          const redOk = at(red, tg.red);
          const blueOk = at(blue, tg.blue);
          if (redOk && blueOk) return { done: true, message: 'Оба Голема на своих Целевых точках!' };
          if (atEnd) {
            const who = (!redOk && !blueOk) ? 'Ни один Голем' : (!redOk ? 'Красный Голем' : 'Синий Голем');
            return { done: false, failed: true, message: who + ' не дошёл до своей Целевой точки!' };
          }
          return { done: false, failed: false };
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
                return { done: false, failed: true, message: 'В лоб бить нельзя — нужен атака сбоку!' };
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
                ? 'Бочка плавает в воде, но не разрушена — доведите атака!'
                : 'Бочка осталась на суше — столкните её в воду и разрушьте там!',
            };
          }
          return { done: false, failed: false };
        }
        // goal
        if (w.goals.has(key(g.r, g.c))) {
          if (constraints.mustDamageBots) {
            const need = liveBots.filter((b) => (b.damage || 0) < 1 && !(targets && !targets.includes(b.color)));
            if (need.length) {
              if (atEnd) return { done: false, failed: true, message: 'Голем на Цели, но Синего Голема обязательно надо было атаковать!' };
              return { done: false, failed: false };
            }
          }
          // 5.7/2.2: «Дойди до Цели … и РАЗРУШИВ бочку!» — мало дойти: Бочка должна
          // быть разрушена самим Големом. Сдетонировавшая на Целевой точке или
          // оставшаяся целой — уровень не пройден.
          if (scn.barrelsMustBeGone && !(w._barrelsBroken > 0)) {
            if (atEnd) {
              return { done: false, failed: true, message: w.barrels.length ? 'Мало дойти до Цели — Бочку нужно разрушить!' : 'Мало дойти до Цели: Бочка взорвалась сама, а разбить её должен был Голем!' };
            }
            return { done: false, failed: false };
          }
          // 2.5: «когда доберёшься до Цели, на поле должны остаться только ДВЕ бочки».
          if (constraints.barrelsRemaining != null && w.barrels.length !== constraints.barrelsRemaining) {
            if (atEnd) return { done: false, failed: true, message: 'К моменту победы на поле должно остаться ровно ' + constraints.barrelsRemaining + ' бочки!' };
            return { done: false, failed: false };
          }
          // 5.4: «проведи Голема по линии Бочек и все их разбей» — вставать на Цель
          // можно только когда на поле не осталось ни одной Бочки.
          if (constraints.destroyAllBarrels && w.barrels.length) {
            if (atEnd) return { done: false, failed: true, message: 'Сначала разбей ВСЕ Бочки — и только потом вставай на Цель!' };
            return { done: false, failed: false };
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
    return { result: 'fail', message: oc.message || 'Программа закончилась, а цель не достигнута — попробуй ещё раз' };
  }

  // ---------- bot plans ----------

  // Есть ли в программе бота команда «Атака»: по этому признаку на поле
  // подсвечиваются зоны Атаки ботов.
  function botCfgHasAttack(cfg) {
    if (!cfg) return false;
    if (cfg.cmd === 'attack') return true;
    if (cfg.kind === 'attackAt') return true;
    // Этаж 7: «страж» бьёт клетку перед собой в конце каждого хода.
    if (cfg.kind === 'guard') return true;
    if (cfg.kind === 'randomProgram') return true; // программа разыгрывается случайно (4.5)
    const has = (n) => {
      if (!n) return false;
      if (Array.isArray(n)) return n.some(has);
      if (n.c === 'attack' || n.c === 'attackBoth') return true;
      if (n.c === 'ai') return true;                    // кубик AI может дать «Атака»
      if (n.c === 'repeat') return has(n.body);
      if (n.c === 'ifSee' || n.c === 'ifObstacle' || n.c === 'ifAttack') return has(n.then) || has(n.else);
      return false;
    };
    if (has(cfg.program)) return true;
    if (cfg.lines && typeof cfg.lines === 'object') return Object.keys(cfg.lines).some((k) => has(cfg.lines[k]));
    return false;
  }

  function buildBotPlans(level, scenario) {
    const plans = { preLine: [], perLine: [], perCommand: [], endLine: [] };
    const bots = level.bots.map((b, i) => ({ id: 'bot' + i, index: i, ...b }));
    const authored = (scenario && scenario.bots) || [];
    bots.forEach((b) => {
      const cfg = authored[b.index] || {};
      const kind = cfg.kind || 'idle';
      if (kind === 'program') plans.preLine.push({ id: b.id, program: cfg.program });
      else if (kind === 'perLineProgram') plans.preLine.push({ id: b.id, perLine: cfg.lines });
      else if (kind === 'chess') plans.preLine.push({ id: b.id, chess: { piece: cfg.piece, goal: cfg.goal } });
      else if (kind === 'attackAt') { const byLine = {}; for (const ln of cfg.lines || []) byLine[ln] = 'attack'; plans.perLine.push({ id: b.id, byLine }); }
      // Этаж 7: боты ходят в КОНЦЕ хода, после команд обоих Големов игрока.
      //   guard  — «страж»: бьёт клетку перед собой (а если впереди Бочка — разбивает её);
      //   walker — «бродяга»: шагает Вперёд, а если впереди Голем игрока — бьёт его.
      else if (kind === 'guard') plans.endLine.push({ id: b.id, mode: 'guard' });
      else if (kind === 'walker') plans.endLine.push({ id: b.id, mode: 'walker' });
      else if (kind === 'everyLine') { const byLine = {}; for (let ln = 1; ln <= 64; ln++) byLine[ln] = cfg.cmd || 'forward'; plans.perLine.push({ id: b.id, byLine }); }
      else if (kind === 'everyCommand') plans.perCommand.push({ id: b.id, cmd: cfg.cmd || 'forward' });
      else if (kind === 'randomProgram') {
        // 4.5: программа бота разыгрывается случайно при КАЖДОМ запуске
        const prg = drawRandomBotProgram(cfg);
        const byLine = {};
        prg.forEach((cmd, i) => { byLine[i + 1] = cmd; });
        plans.perLine.push({ id: b.id, byLine, randomProgram: prg });
      }
    });
    // В конце хода сначала двигаются «бродяги», и только потом бьют «стражи».
    plans.endLine.sort((a, b) => (a.mode === 'walker' ? 0 : 1) - (b.mode === 'walker' ? 0 : 1));
    return plans;
  }

  // Программа Красного Голема в 4.5. Курс: «Красный Голем может пойти в любом
  // направлении и атаковать Синего на второй строке Программы (а может и нет)».
  // Поэтому берём один из двух вариантов:
  //   1) [Вперёд, Атака, <движение>, <движение>]
  //   2) четыре случайные команды движения
  function drawRandomBotProgram(cfg) {
    const moves = ['forward', 'back', 'left', 'right'];
    const shuffled = (list) => {
      const a = list.slice();
      for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        const t = a[i]; a[i] = a[j]; a[j] = t;
      }
      return a;
    };
    const len = cfg && cfg.length ? cfg.length : 4;
    if (Math.random() < 0.5) {
      // 1-я строка — Вперёд, 2-я — Атака, остальные — движения БЕЗ «Вперёд»
      const rest = shuffled(moves.filter((m) => m !== 'forward'));
      const out = ['forward', 'attack'];
      while (out.length < len) out.push(rest[(out.length - 2) % rest.length]);
      return out;
    }
    const out = shuffled(moves);
    while (out.length < len) out.push(moves[Math.floor(Math.random() * moves.length)]);
    return out;
  }

  // Бот этажа 7 действует в КОНЦЕ хода (после команд ОБОИХ Големов игрока).
  //   guard  — «страж»: бьёт клетку перед собой;
  //   walker — «бродяга»: шагает Вперёд, а если впереди Голем игрока — бьёт его.
  // Урон уходит в общую очередь (addPending) и разбирается следующим resolveLine,
  // поэтому «Защита», использованная Големом в этом ходу, спасает от удара.
  function runEndLineBot(w, g, mode, node, log) {
    if (!g.alive) return false;
    const d = DIRS[g.dir];
    const r = g.r + d.dr, c = g.c + d.dc;
    const target = w.valid.has(key(r, c)) ? golemAt(w, r, c) : null;
    if (target && target.isPlayer) {
      addPending(w, target, g.id, 1, node, g.dir);
      log.push(mode === 'guard' ? 'Страж бьёт Голема перед собой' : 'Бродяга бьёт Голема перед собой');
      return true;
    }
    if (mode === 'guard') {
      // «Страж Атакует клетку перед собой»: по Камню — звон, по пустой — тихо,
      // по Бочке — разбивает.
      if (barrelAt(w, r, c)) { attackForward(w, g, node, log); return true; }
      return false;
    }
    // walker: шаг Вперёд (Бочку толкает, в Воду и в Камень не идёт)
    const was = g.r + ',' + g.c;
    const res = step(w, g, +1, node, log);
    if (res === 'drowned') { botKill(w, g, node, log, 'water'); return true; }
    return (g.r + ',' + g.c) !== was;
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
    if (piece === 'pawn') return pawnAttackCells(g);
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
    const w = buildWorld(level, scenario);
    if (scenario.dynamics) w._dynamics = JSON.parse(JSON.stringify(scenario.dynamics));
    if (scenario.aiTable) w._aiTable = scenario.aiTable;
    (scenario.bots || []).forEach((cfg, i) => {
      const g = w.golems.find((x) => x.id === 'bot' + i);
      if (!g) return;
      if (cfg.hp) g.hp = cfg.hp;
      // «Робот модифицирован и рубит как настоящая пешка» (6.1) и «может ли этот
      // бот вообще бить» — нужно и движку (его атаки), и подсветке зон Атаки.
      g.piece = cfg.piece || null;
      g.canAttack = botCfgHasAttack(cfg);
    });
    // Игрок может атаковать, если в комнате разрешена карта «Атака».
    for (const pg of playerGolems(w)) pg.canAttack = !!(level.anyCards || (level.bonuses || {}).attack);
    w.defense = {};
    w.pending = [];
    w._lineCounter = 0;
    w._initialBarrels = w.barrels.length;
    if ((scenario.constraints || {}).defenseFacing) w._defenseFacing = true; // 4.5
    // 7.7: «Защита» Голема спасает и от удара стража «в спину» —
    // обнуляем правило 4.5, даже если оно случайно пришло из constraints.
    if ((scenario.params || {}).noDefenseFacing) w._defenseFacing = false;
    const objective = makeObjective(level, scenario);
    const botPlans = buildBotPlans(level, scenario);
    const requires = scenario.requires || null;
    const requireError = () => programRequirementError(program.lines, requires);

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
    const players = playerGolems(w);
    const player = players[0];
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

        // «Состояние поля» строкой: кадр отдаётся, только если что-то изменилось
        // (или есть события). Так каждый шаг Голема — отдельный кадр, а пустых нет.
        const stateKey = () => [
          ...w.golems.map((g) => `${g.id}:${g.alive ? 1 : 0}:${g.r},${g.c},${g.dir}:${g.damage || 0}`),
          ...w.barrels.map((b) => `b${b.r},${b.c}${b.floating ? 'w' : ''}`),
          ...Array.from(w.destroyed || []),
        ].join('|');
        const node = [];          // события текущей строки игрока
        let lastKey = stateKey(); // состояние, уже показанное последним кадром
        const pushFrame = (evts, actor) => {
          const chunk = evts.splice(0, evts.length);
          frames.push({ ...snapshot(w, log), events: chunk, actor, line: lineNo, phase: actor === 'player' ? 'player' : 'bot' });
          lastKey = stateKey();
        };

        runEnvironmentTick(w, 'before', lineNo, log, frames);
        lastKey = stateKey();
        // Бочка могла наехать на Голема игрока ещё ДО его хода (5.8/5.9) —
        // фиксируем проигрыш сразу, мёртвый Голем программу не исполняет.
        if (!player.alive || players.some((g) => !g.alive)) {
          const oc0 = objective.check(w, player);
          if (oc0.failed) { result = 'fail'; message = oc0.message; break; }
        }

        for (const plan of botPlans.preLine) {
          const g = w.golems.find((x) => x.id === plan.id);
          if (!g || !g.alive) continue;
          const bnode = [];
          // Каждое действие бота (шаг, поворот, атака — в том числе внутри Цикла
          // и Условия) отдаётся своим кадром: бот идёт по клеткам, а не прыгает.
          const bflush = () => { if (bnode.length || stateKey() !== lastKey) pushFrame(bnode, g.id); };
          let prg = plan.program;
          if (plan.perLine) prg = plan.perLine[lineNo] || plan.perLine.default;
          if (plan.chess) chessStep(w, g, plan.chess, bnode, log);
          else if (prg) runBotNode(w, g, prg, bnode, log, bflush);
          bflush();
        }

        for (const plan of botPlans.perLine) {
          const g = w.golems.find((x) => x.id === plan.id);
          if (!g || !g.alive) continue;
          const action = plan.byLine[lineNo];
          if (!action) continue;
          const bnode = [];
          if (action === 'attack') attackForward(w, g, bnode, log);
          else executeCommand(w, g, action, bnode, log, { defending: [] });
          if (bnode.length || stateKey() !== lastKey) pushFrame(bnode, g.id);
        }

        const ctx = { defending: [] };
        // Каждая ВЫПОЛНЕННАЯ команда получает свой кадр — тогда виден каждый шаг
        // (4.10: Бочку столкнули в воду → отдельным кадром разрушили её в воде).
        ctx.afterCommand = () => { if (node.length || stateKey() !== lastKey) pushFrame(node, 'player'); };
        if (botPlans.perCommand.length) {
          ctx.beforeCommand = () => {
            for (const plan of botPlans.perCommand) {
              const bg = w.golems.find((x) => x.id === plan.id);
              if (!bg || !bg.alive) continue;
              const bnode = [];
              const before = bg.r + ',' + bg.c + ',' + bg.dir;
              executeCommand(w, bg, plan.cmd, bnode, log, { defending: [] });
              if (bnode.length || (bg.r + ',' + bg.c + ',' + bg.dir) !== before) pushFrame(bnode, bg.id);
            }
          };
        }
        // ОДНА Программа на двоих (этаж 7): каждый ход каждый живой Голем игрока
        // получает одну и ту же команду — Красный первым, затем Синий.
        for (const pg of players) {
          if (!pg.alive) continue;
          runStatement(w, pg, program.lines[li], node, log, ctx);
        }

        // «Защита» этого хода: стражи и бродяги бьют в КОНЦЕ хода, поэтому
        // запоминаем защиту, пока resolveLine её не обнулил.
        const lineDefense = Object.assign({}, w.defense);
        resolveLine(w, node, log);
        // (команды уже отдали свои кадры; тут добираем только отложенный урон)
        if (node.length || stateKey() !== lastKey) pushFrame(node, 'player');

        runEnvironmentTick(w, 'after', lineNo, log, frames);
        lastKey = stateKey();

        // Победа проверяется ПОСЛЕ команд Големов и ДО хода ботов: Голем, дошедший
        // до своей Цели, успевает её «взять» (в 7.7 удар стража уже не отнимает победу).
        const oc = objective.check(w, player);
        if (oc.done) {
          const rq = requireError();
          if (rq) { result = 'fail'; message = rq; break; }
          result = 'success'; message = oc.message; break;
        }
        if (oc.failed) { result = 'fail'; message = oc.message; break; }

        // Ход ботов этажа 7 — в самом конце хода (после команд игрока).
        if (botPlans.endLine.length) {
          for (const plan of botPlans.endLine) {
            const bg = w.golems.find((x) => x.id === plan.id);
            if (!bg || !bg.alive) continue;
            const bnode = [];
            // Защита, использованная Големом в этом ходу, отбивает удар и стража,
            // и бродяги (params.noDefenseFacing на этаже 7 — см. сценарии).
            w.defense = Object.assign({}, lineDefense);
            const acted = runEndLineBot(w, bg, plan.mode, bnode, log);
            resolveLine(w, bnode, log);
            if (acted || bnode.length || stateKey() !== lastKey) pushFrame(bnode, bg.id);
          }
          const ob = objective.check(w, player);
          if (ob.failed) { result = 'fail'; message = ob.message; break; }
        }
      }
      if (result === 'running' && !endless) {
        const end = checkStaticEnd(level, scenario, player, w, objective);
        result = end.result;
        if (end.message) message = end.message;
        if (result === 'success') {
          const rq = requireError();
          if (rq) { result = 'fail'; message = rq; }
        }
      }
    }

    if (result === 'running') { result = 'fail'; message = 'Программа не достигла цели'; }

    frames.push({ ...snapshot(w, log), phase: 'end', result, message });
    return { frames, result, message, log, linesExecuted };
  }

  // Начальное состояние комнаты для статичной доски: кто где стоит, сколько
  // жизней, какие клетки простреливаются Атакой (подсветка зон атаки).
  function initialState(level, scenario) {
    const scn = scenario || {};
    const w = buildWorld(level, scn);
    (scn.bots || []).forEach((cfg, i) => {
      const g = w.golems.find((x) => x.id === 'bot' + i);
      if (!g) return;
      if (cfg.hp) g.hp = cfg.hp;
      g.piece = cfg.piece || null;
      g.canAttack = botCfgHasAttack(cfg);
    });
    for (const pg of playerGolems(w)) pg.canAttack = !!(level.anyCards || (level.bonuses || {}).attack);
    return snapshot(w, []);
  }

  BG4.Engine = { DIRS, RIGHT, LEFT, OPPOSITE, key, obstacleAhead, simulate, buildWorld, validCells, initialState, threats, pawnAttackCells };
})();
