/*
 * dungeon.js — лабиринт из «карт Местности».
 *
 * Карта Местности — ПРЯМОУГОЛЬНИК 2:1: длинная сторона 18 клеток,
 * короткая 9. Такая карта кладётся в прямоугольный слот сетки.
 * По правилам карты выкладываются одинаково — длинной стороной к длинной
 * (сверху-снизу) и короткой к короткой (слева-справа), — поэтому у карты
 * всего ДВА поворота (0° и 180°), а не четыре.
 *
 * Карты пристраиваются по ходу игры (placeTile), поэтому лабиринт растёт.
 */
(function () {
  'use strict';
  const KVP = (window.KVP = window.KVP || {});

  const SLOT_W = 14;         // короткая сторона карты Местности (по X)
  const SLOT_H = 18;        // длинная сторона карты Местности (по Z)
  const INNER_W = SLOT_W - 2;
  const INNER_H = SLOT_H - 2;
  const GRID = 11;          // карт в стороне
  const MAP_X = GRID * SLOT_W;  // 99  — ширина карты
  const MAP_Z = GRID * SLOT_H;  // 198 — высота карты

  const DIRS = {
    n: { dx: 0, dz: -1, opp: 's' },
    e: { dx: 1, dz: 0, opp: 'w' },
    s: { dx: 0, dz: 1, opp: 'n' },
    w: { dx: -1, dz: 0, opp: 'e' }
  };
  const DIR_LIST = ['n', 'e', 's', 'w'];

  function rotateExits(exits, rot) {
    const out = { n: 0, e: 0, s: 0, w: 0 };
    const r = ((rot % 4) + 4) % 4;
    for (let i = 0; i < DIR_LIST.length; i++) {
      const d = DIR_LIST[i];
      if (!exits[d]) continue;
      out[DIR_LIST[(i + r) % 4]] = 1;
    }
    return out;
  }

  function Labyrinth(seed) {
    this.seed = seed >>> 0;
    this.rng = new KVP.RNG(this.seed);
    this.sizeX = MAP_X;
    this.sizeZ = MAP_Z;
    this.size = MAP_X;
    this.tileSize = SLOT_W;
    this.gridSize = GRID;
    this.tiles = new Uint8Array(MAP_X * MAP_Z);
    this.roomAt = new Int16Array(MAP_X * MAP_Z);
    this.roomAt.fill(-1);
    this.wallTex = [];
    this.portal = null;
    this.seen = new Uint8Array(MAP_X * MAP_Z);
    this.torches = [];
    for (let z = 0; z < MAP_Z; z++) {
      const row = [];
      for (let x = 0; x < MAP_X; x++) row.push('wall_castle');
      this.wallTex.push(row);
    }
    this.rooms = [];

    // Стартовая карта — в центре сетки.
    const gx = Math.floor(GRID / 2), gz = Math.floor(GRID / 2);
    this.placeTile(KVP.START_TILE.id, gx, gz, 0);
    const start = this.rooms[0];
    const c = this.center(start);
    this.playerStart = { x: c.x, y: c.y, angle: Math.PI };
    this.startTile = start;
  }

  Labyrinth.prototype.idx = function (x, z) { return z * MAP_X + x; };

  Labyrinth.prototype.isSolid = function (x, z) {
    const ix = Math.floor(x), iz = Math.floor(z);
    if (ix < 0 || iz < 0 || ix >= MAP_X || iz >= MAP_Z) return true;
    return this.tiles[iz * MAP_X + ix] !== 0;
  };

  Labyrinth.prototype.isFloor = function (x, z) {
    return !this.isSolid(x, z);
  };

  Labyrinth.prototype.roomAtPos = function (x, z) {
    const ix = Math.floor(x), iz = Math.floor(z);
    if (ix < 0 || iz < 0 || ix >= MAP_X || iz >= MAP_Z) return -1;
    return this.roomAt[iz * MAP_X + ix];
  };

  Labyrinth.prototype.center = function (room) {
    return { x: room.ox + 1 + room.w / 2, y: room.oz + 1 + room.h / 2 };
  };

  Labyrinth.prototype.randomSpot = function (room, margin, avoidCenter) {
    const m = margin == null ? 1.4 : margin;
    const w = room.w, h = room.h;
    for (let tries = 0; tries < 60; tries++) {
      const x = room.ox + 1 + m + this.rng.next() * (w - 2 * m);
      const z = room.oz + 1 + m + this.rng.next() * (h - 2 * m);
      if (this.isSolid(x, z)) continue;
      const c = this.center(room);
      if (avoidCenter && KVP.dist(x, z, c.x, c.y) < avoidCenter) continue;
      return { x: x, y: z };
    }
    const c = this.center(room);
    return { x: c.x, y: c.y };
  };

  /* ------------------------------------------------------------------ */
  /*  СЕТКА КАРТ                                                        */
  /* ------------------------------------------------------------------ */

  Labyrinth.prototype.tileAt = function (gx, gz) {
    for (let i = 0; i < this.rooms.length; i++) {
      const r = this.rooms[i];
      if (r.gx === gx && r.gz === gz) return r;
    }
    return null;
  };

  Labyrinth.prototype.hasTile = function (gx, gz) {
    return !!this.tileAt(gx, gz);
  };

  Labyrinth.prototype.neighborCell = function (gx, gz, dir) {
    const d = DIRS[dir];
    if (!d) return null;
    return { gx: gx + d.dx, gz: gz + d.dz };
  };

  /** Проход в сторону dir существует и сосед отвечает встречным выходом. */
  Labyrinth.prototype.passage = function (tile, dir) {
    if (!tile || !tile.exits[dir]) return false;
    const n = this.neighborCell(tile.gx, tile.gz, dir);
    const other = this.tileAt(n.gx, n.gz);
    return !!(other && other.exits[DIRS[dir].opp]);
  };

  /**
   * Подбирает поворот карты так, чтобы она соединилась с соседями.
   * Если задан backDir (сторона, с которой должен быть вход) и карту нельзя
   * повернуть нужной стороной — возвращает null: такую карту класть нельзя
   * (правило: вход должен быть хотя бы с одной соседней карты).
   */
  Labyrinth.prototype.findPlacement = function (def, gx, gz, backDir) {
    const shape = KVP.TILE_SHAPES[def.shape] || KVP.TILE_SHAPES.dead;
    let best = null, bestScore = -1;
    /* Карта Местности — прямоугольник 2:1: поворачиваем только на 180°. */
    for (let k = 0; k < 2; k++) {
      const rot = k * 2;
      const exits = rotateExits(shape.exits, rot);
      if (backDir && !exits[backDir]) continue;
      let score = 0;
      for (let i = 0; i < DIR_LIST.length; i++) {
        const d = DIR_LIST[i];
        if (!exits[d]) continue;
        const n = this.neighborCell(gx, gz, d);
        const other = this.tileAt(n.gx, n.gz);
        if (other && other.exits[DIRS[d].opp]) score += 2;
        else if (!other) score += 0.25;
      }
      score += this.rng.next() * 0.1;
      if (score > bestScore) { bestScore = score; best = { rot: rot, exits: exits }; }
    }
    return best;
  };

  /** Ставит карту Местности на сетку. Возвращает объект комнаты. */
  Labyrinth.prototype.placeTile = function (cardId, gx, gz, rotation) {
    if (gx < 0 || gz < 0 || gx >= GRID || gz >= GRID) return null;
    if (this.tileAt(gx, gz)) return this.tileAt(gx, gz);
    const def = KVP.tileCardById(cardId);
    if (!def) return null;
    const shape = KVP.TILE_SHAPES[def.shape] || KVP.TILE_SHAPES.dead;
    const exits = rotateExits(shape.exits, rotation || 0);
    const roomDef = KVP.ROOM_TYPES[def.room] || KVP.ROOM_TYPES.arena;
    const room = {
      id: this.rooms.length,
      gx: gx, gz: gz,
      ox: gx * SLOT_W, oz: gz * SLOT_H,
      x: gx * SLOT_W + 1, z: gz * SLOT_H + 1,
      w: INNER_W, h: INNER_H,
      type: def.room,
      name: def.name,
      icon: def.icon,
      cardId: def.id,
      shape: def.shape,
      rot: rotation || 0,
      exits: exits,
      wall: roomDef.wall,
      discovered: true,
      entered: false,
      cleared: false
    };
    room.center = this.center(room);
    this.rooms.push(room);

    // Факелы на северной стене (декор).
    const rng = this.rng;
    const tx = [room.ox + 2.5, room.ox + SLOT_W - 2.5];
    for (let i = 0; i < tx.length; i++) {
      this.torches.push({
        type: 'torch', x: tx[i], y: room.oz + 1.02,
        sprite: 'torch', light: true, phase: rng.next() * 6.28
      });
    }

    this._rebuildSolid();
    this._reveal(room);
    return room;
  };

  Labyrinth.prototype._reveal = function (room) {
    for (let z = room.z; z < room.z + room.h; z++) {
      for (let x = room.x; x < room.x + room.w; x++) {
        if (x >= 0 && z >= 0 && x < MAP_X && z < MAP_Z) {
          this.seen[z * MAP_X + x] = 1;
        }
      }
    }
  };

  Labyrinth.prototype._rebuildSolid = function () {
    this.tiles.fill(1);
    this.roomAt.fill(-1);
    for (let z = 0; z < MAP_Z; z++) {
      for (let x = 0; x < MAP_X; x++) this.wallTex[z][x] = 'wall_castle';
    }
    // Комнаты.
    for (let i = 0; i < this.rooms.length; i++) {
      const r = this.rooms[i];
      for (let z = r.oz + 1; z <= r.oz + INNER_H; z++) {
        for (let x = r.ox + 1; x <= r.ox + INNER_W; x++) {
          if (x < 0 || z < 0 || x >= MAP_X || z >= MAP_Z) continue;
          this.tiles[this.idx(x, z)] = 0;
          this.roomAt[this.idx(x, z)] = r.id;
          this.wallTex[z][x] = r.wall || 'wall_castle';
        }
      }
    }
    // Проёмы: в каждую сторону, где на карте есть стрелка.
    // Есть встречная стрелка у соседа — открываем настоящий проход.
    // Нет соседа / сосед не отвечает — оставляем СТЕНУ, но помечаем её
    // текстурой закрытой двери: игрок видит, что проход здесь есть,
    // просто пока недоступен.
    for (let i = 0; i < this.rooms.length; i++) {
      const r = this.rooms[i];
      for (let k = 0; k < DIR_LIST.length; k++) {
        const dir = DIR_LIST[k];
        if (!r.exits[dir]) continue;
        const n = this.neighborCell(r.gx, r.gz, dir);
        if (n.gx < 0 || n.gz < 0 || n.gx >= GRID || n.gz >= GRID) {
          this._markDoor(r, dir);
          continue;
        }
        const other = this.tileAt(n.gx, n.gz);
        if (!other || !other.exits[DIRS[dir].opp]) {
          this._markDoor(r, dir);
          continue;
        }
        this._carveDoor(r, dir);
      }
    }
  };

  /** Клетки стены комнаты r со стороны dir. side: 'current' | 'neighbor'. */
  Labyrinth.prototype._wallCells = function (r, dir, side) {
    const wz = r.oz + Math.floor(SLOT_H / 2) - 1;
    const wx = r.ox + Math.floor(SLOT_W / 2) - 1;
    let cells;
    if (dir === 'e') {
      cells = [[r.ox + SLOT_W - 1, wz], [r.ox + SLOT_W - 1, wz + 1]];
    } else if (dir === 'w') {
      cells = [[r.ox, wz], [r.ox, wz + 1]];
    } else if (dir === 's') {
      cells = [[wx, r.oz + SLOT_H - 1], [wx + 1, r.oz + SLOT_H - 1]];
    } else {
      cells = [[wx, r.oz], [wx + 1, r.oz]];
    }
    if (side === 'neighbor') {
      const d = DIRS[dir];
      for (let i = 0; i < cells.length; i++) {
        cells[i] = [cells[i][0] + d.dx, cells[i][1] + d.dz];
      }
    }
    return cells;
  };

  /** Закрытая дверь: стена остаётся, но получает дверную текстуру. */
  Labyrinth.prototype._markDoor = function (r, dir) {
    const cells = this._wallCells(r, dir, 'current');
    for (let i = 0; i < cells.length; i++) {
      const x = cells[i][0], z = cells[i][1];
      if (x < 0 || z < 0 || x >= MAP_X || z >= MAP_Z) continue;
      /* Пол не трогаем: дверь — это именно стена. */
      if (this.tiles[this.idx(x, z)] === 0) continue;
      this.wallTex[z][x] = 'wall_door';
    }
  };

  /** Открытые направления карты: куда можно шагнуть или что исследовать. */
  Labyrinth.prototype.openExits = function (tile) {
    const out = [];
    if (!tile) return out;
    for (let i = 0; i < DIR_LIST.length; i++) {
      const dir = DIR_LIST[i];
      if (!tile.exits[dir]) continue;
      const n = this.neighborCell(tile.gx, tile.gz, dir);
      if (n.gx < 0 || n.gz < 0 || n.gx >= GRID || n.gz >= GRID) continue;
      const other = this.tileAt(n.gx, n.gz);
      if (other && !other.exits[DIRS[dir].opp]) continue;
      out.push({ dir: dir, gx: n.gx, gz: n.gz, placed: !!other, tile: other || null });
    }
    return out;
  };

  Labyrinth.prototype._carveDoor = function (r, dir) {
    /* Настоящий проход: вырезаем ОБЕ стены — свою и соседнюю.
       Раньше вырезалась только одна клетка, из-за чего в 3D
       оставалась невидимая стена и проход «глючил». */
    const sides = [
      this._wallCells(r, dir, 'current'),
      this._wallCells(r, dir, 'neighbor')
    ];
    for (let s = 0; s < sides.length; s++) {
      const cells = sides[s];
      for (let i = 0; i < cells.length; i++) {
        const x = cells[i][0], z = cells[i][1];
        if (x < 0 || z < 0 || x >= MAP_X || z >= MAP_Z) continue;
        this.tiles[this.idx(x, z)] = 0;
        this.roomAt[this.idx(x, z)] = -1;
        this.wallTex[z][x] = 'wall_corridor';
      }
    }
  };

  /* ------------------------------------------------------------------ */
  /*  ДВИЖЕНИЕ / ВИДИМОСТЬ (совместимость со старым API)                */
  /* ------------------------------------------------------------------ */

  /** Волновое поле расстояний (для ботов; в соло не используется). */
  Labyrinth.prototype.computeFlow = function (px, pz) {
    const sx = Math.floor(px), sz = Math.floor(pz);
    if (sx < 0 || sz < 0 || sx >= MAP_X || sz >= MAP_Z) return null;
    if (this.flowTarget && this.flowTarget.x === sx && this.flowTarget.z === sz) return this.flow;
    const dist = this.flow || new Int16Array(MAP_X * MAP_Z);
    dist.fill(-1);
    const qx = new Int16Array(MAP_X * MAP_Z);
    const qz = new Int16Array(MAP_X * MAP_Z);
    let head = 0, tail = 0;
    if (this.isSolid(sx, sz)) return dist;
    const si = sz * MAP_X + sx;
    dist[si] = 0; qx[tail] = sx; qz[tail] = sz; tail++;
    const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    while (head < tail) {
      const x = qx[head], z = qz[head]; head++;
      const d = dist[z * MAP_X + x];
      for (let k = 0; k < 4; k++) {
        const nx = x + dirs[k][0], nz = z + dirs[k][1];
        if (nx < 0 || nz < 0 || nx >= MAP_X || nz >= MAP_Z) continue;
        if (this.tiles[nz * MAP_X + nx] !== 0) continue;
        const ni = nz * MAP_X + nx;
        if (dist[ni] >= 0) continue;
        dist[ni] = d + 1;
        qx[tail] = nx; qz[tail] = nz; tail++;
      }
    }
    this.flow = dist;
    this.flowTarget = { x: sx, z: sz };
    return dist;
  };

  Labyrinth.prototype.nextStep = function (x, z) {
    const ix = Math.floor(x), iz = Math.floor(z);
    if (!this.flow || ix < 0 || iz < 0 || ix >= MAP_X || iz >= MAP_Z) return null;
    let best = this.flow[iz * MAP_X + ix];
    if (best < 0) return null;
    let bx = ix, bz = iz;
    const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    for (let k = 0; k < 4; k++) {
      const nx = ix + dirs[k][0], nz = iz + dirs[k][1];
      if (nx < 0 || nz < 0 || nx >= MAP_X || nz >= MAP_Z) continue;
      const d = this.flow[nz * MAP_X + nx];
      if (d >= 0 && d < best) { best = d; bx = nx; bz = nz; }
    }
    return { x: bx + 0.5, z: bz + 0.5, dist: best };
  };

  Labyrinth.prototype.lineOfSight = function (ax, az, bx, bz) {
    const dx = bx - ax, dz = bz - az;
    const dist = Math.sqrt(dx * dx + dz * dz);
    const steps = Math.ceil(dist * 4);
    for (let i = 1; i < steps; i++) {
      const t = i / steps;
      if (this.isSolid(ax + dx * t, az + dz * t)) return false;
    }
    return true;
  };

  Labyrinth.prototype.canStand = function (x, z, radius) {
    const r = radius || 0.28;
    const pts = [
      [-r, -r], [r, -r], [-r, r], [r, r],
      [-r, 0], [r, 0], [0, -r], [0, r]
    ];
    for (let i = 0; i < pts.length; i++) {
      if (this.isSolid(x + pts[i][0], z + pts[i][1])) return false;
    }
    return true;
  };

  Labyrinth.prototype.moveCircle = function (x, z, dx, dz, radius) {
    let nx = x, nz = z;
    const r = radius || 0.28;
    if (this.canStand(x + dx, z, r)) nx = x + dx;
    if (this.canStand(nx, z + dz, r)) nz = z + dz;
    return { x: nx, z: nz };
  };

  /* ------------------------------------------------------------------ */
  /*  ЭКСПОРТ                                                           */
  /* ------------------------------------------------------------------ */

  KVP.Labyrinth = Labyrinth;
  KVP.LABYRINTH_TILE = SLOT_W;
  KVP.LABYRINTH_SLOT = { w: SLOT_W, h: SLOT_H };

  KVP.createLabyrinth = function (seed) {
    return new Labyrinth(seed);
  };

  // Совместимость с прежним именем.
  KVP.createDungeon = function (floorIndex, seed) {
    return new Labyrinth(seed);
  };
})();
