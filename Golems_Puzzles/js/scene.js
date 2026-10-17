/*
 * Golems Puzzles — 3D view (Three.js r128, no build step).
 *
 * The engine produces frames (world snapshots); this module renders the board and
 * animates golems/barrels between frames, plus small effects for game events.
 *
 * Public API (window.BG4.Scene3D):
 *   init(canvas)                 – create renderer/scene/camera
 *   setLevel(level)              – rebuild the static board for a level
 *   setFrame(frame, animate)     – show a snapshot
 *   play(frames, {onDone, speed})– animate a list of frames
 *   stop() / resize() / dispose()
 */
(function () {
  'use strict';
  const BG4 = (window.BG4 = window.BG4 || {});
  const T = window.THREE;

  const COLORS = {
    red: 0xd9534f, blue: 0x3b7dd8, green: 0x3aa655, yellow: 0xe0b000,
  };
  const DIR_YAW = { N: Math.PI, S: 0, E: Math.PI / 2, W: -Math.PI / 2 };

  // Board vertical layout (field surface is y = 0; everything rests just above it)
  const FIELD_Y = 0;              // top surface of the board
  const TOKEN_T = 0.06;           // cardboard token thickness
  const TOKEN_Y = FIELD_Y + 0.004; // base of a token lying on the field
  const WATER_TOP = FIELD_Y + 0.06; // surface a floating barrel rests on

  let renderer, scene, camera, root;
  let raf = null;
  let clock = null;
  let level = null;
  let bounds = { minR: 0, maxR: 0, minC: 0, maxC: 0, cx: 0, cz: 0 };
  let golemMeshes = new Map();
  let dynGroup, fxGroup, boardGroup, threatGroup;
  let threatMarks = [];      // подсветка зон Атаки (переиспользуемые квадраты)
  let levelThreats = [];     // зоны Атаки начальной доски (пока программа не запущена)
  let camState = { theta: Math.PI * 0.15, phi: 0.95, dist: 9, target: new T.Vector3(0, 0, 0) };
  let dragging = false, lastX = 0, lastY = 0;
  const anims = [];       // active tweens
  const effects = [];     // active effects
  const portalAnims = []; // portals keep turning/pulsing («они — телепорты»)
  let playing = false;
  let playQueue = [];
  let playTimer = 0;
  let playOnDone = null;
  let playOnFrame = null;
  let playSpeed = 1;
  let raycaster = null;
  let dragMoved = 0;
  // «Жетоны из руки» — the printed tokens that lie BESIDE the board until the
  // player puts them on a cell himself (e.g. 4.4: Бочка на клетку Цели).
  let reserveMeshes = []; // [{ index, mesh, baseY }]
  let reserveSelected = -1;

  function cellToWorld(r, c) {
    return { x: c - bounds.cx, z: r - bounds.cz };
  }


  const stlGeos = { golem: {}, figurine: {}, barrel: null, stone: null, portal: null };
  // «Акриловые» фигурки (Figurine *.stl) — плоские детали: рисунок лежит в
  // плоскости X×Y, толщина по Z (в STL-файле они «лежат на боковой стороне»).
  // Поэтому их НЕ надо поворачивать Z-up → Y-up: в исходной ориентации деталь
  // уже стоит вертикально. Остаётся довернуть её «лицом вперёд»: на рисунке
  // фигурка смотрит в −X, а «вперёд» в игре — +Z (как у голема при yaw 0).
  const FIG_YAW = Math.PI / 2;
  function normalizeFigurine(geo, targetH, maxFoot) {
    if (!geo) return null;
    geo.computeBoundingBox();
    const bb = geo.boundingBox;
    const c = new T.Vector3(); bb.getCenter(c);
    geo.translate(-c.x, -bb.min.y, -c.z);
    geo.rotateY(FIG_YAW);
    geo.computeBoundingBox();
    const size = new T.Vector3(); geo.boundingBox.getSize(size);
    const h = Math.max(size.y, 1e-8);
    const foot = Math.max(size.x, size.z, 1e-8);
    const sc = Math.min((targetH || 1.15) / h, (maxFoot || 1.15) / foot);
    geo.scale(sc, sc, sc);
    geo.computeVertexNormals();
    sharedGeos.add(geo);
    return geo;
  }
  const sharedGeos = new Set(); // STL geometries must survive board rebuilds
  let stlLoading = false;
  // respect the "показывать 3D-модели (STL)" setting; falls back to 2D tokens
  function stlOn() {
    const P = BG4.Progress;
    return !!(P && P.stlEnabled && P.stlEnabled());
  }
  // Rotate Z-up STL to Y-up, centre on X/Z, sit bottom on y=0, then scale
  // uniformly so the model fits both a target height and a target footprint
  // (never wider than one board cell).
  function normalizeGeo(geo, targetH, maxFoot) {
    if (!geo) return null;
    geo.rotateX(-Math.PI / 2);
    geo.computeBoundingBox();
    const bb = geo.boundingBox;
    const c = new T.Vector3(); bb.getCenter(c);
    geo.translate(-c.x, -bb.min.y, -c.z);
    geo.computeBoundingBox();
    const size = new T.Vector3(); geo.boundingBox.getSize(size);
    const h = Math.max(size.y, 1e-8);
    const foot = Math.max(size.x, size.z, 1e-8);
    const sH = (targetH || 1.1) / h;
    const sF = (maxFoot || 1.2) / foot;
    const sc = Math.min(sH, sF);
    geo.scale(sc, sc, sc);
    geo.computeVertexNormals();
    sharedGeos.add(geo);
    return geo;
  }
  function loadSTLs() {
    if (stlLoading) return;
    stlLoading = true;
    const loader = new T.STLLoader();
    const wl = (path, targetH, maxFoot, fn) => new Promise((res) => {
      loader.load(path, (g) => { fn(normalizeGeo(g, targetH, maxFoot)); res(); }, undefined, (e) => { console.warn('stl fail', path, e); res(); });
    });
    const tasks = [];
    const golems = [
      ['red', 'stl/Red Golem New Low.stl'],
      ['blue', 'stl/Blue Golem New Low.stl'],
      ['green', 'stl/Green Golem New Low.stl'],
      ['yellow', 'stl/Yellow Golem New Low.stl'],
    ];
    for (const [col, f] of golems) tasks.push(wl(f, 1.1, 1.3, (g) => { stlGeos.golem[col] = g; }));
    tasks.push(wl('stl/Barell New Low 2.stl', 0.72, 0.82, (g) => { stlGeos.barrel = g; }));
    tasks.push(wl('stl/Stone New Low.stl', 0.62, 0.9, (g) => { stlGeos.stone = g; }));
    tasks.push(wl('stl/Portal New Low.stl', 1.05, 0.98, (g) => { stlGeos.portal = g; }));
    // акриловые фигурки — режим «2D» (без 3D-моделей)
    const WL_FIG = (path, col) => new Promise((res) => {
      loader.load(path, (g) => { stlGeos.figurine[col] = normalizeFigurine(g, 0.84, 0.89); res(); }, undefined, (e) => { console.warn('stl fail', path, e); res(); });
    });
    for (const [col, nm] of [['red', 'Red'], ['blue', 'Blue'], ['green', 'Green'], ['yellow', 'Yellow']]) {
      tasks.push(WL_FIG('stl/Figurine ' + nm + '.stl', col));
    }
    Promise.all(tasks).then(() => { if (level) { const lv = level; setLevel(lv); } });
  }
  function makeCheckerTex(hexA, hexB) {
    hexA = String(hexA).startsWith('#') ? hexA : '#' + (hexA & 0xffffff).toString(16).padStart(6, '0');
    hexB = String(hexB).startsWith('#') ? hexB : '#' + (hexB & 0xffffff).toString(16).padStart(6, '0');
    const size = 256, cell = 64;
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = size;
    const ctx = canvas.getContext('2d');
    for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) {
      ctx.fillStyle = (r + c) % 2 ? hexA : hexB;
      ctx.fillRect(c * cell, r * cell, cell, cell);
    }
    ctx.strokeStyle = 'rgba(0,0,0,.35)'; ctx.lineWidth = 2;
    for (let i = 1; i < 4; i++) {
      ctx.beginPath(); ctx.moveTo(i * cell, 0); ctx.lineTo(i * cell, size); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, i * cell); ctx.lineTo(size, i * cell); ctx.stroke();
    }
    const tex = new T.CanvasTexture(canvas); tex.needsUpdate = true;
    return tex;
  }
  function enhanceFieldTex(plane) {
    try { new T.TextureLoader().load('assets/img/pole_4x4.png', (t) => { plane.material.map = t; plane.material.needsUpdate = true; }, undefined, function(){}); } catch (e) {}
  }

  // ---------- init ----------
  function init(canvas) {
    // Re-entering the level screen re-uses the same canvas; creating a second
    // WebGLRenderer on it would fail, so keep the first renderer.
    if (renderer && renderer.domElement === canvas) { resize(); return; }
    renderer = new T.WebGLRenderer({ canvas, antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = T.PCFSoftShadowMap;

    scene = new T.Scene();
    scene.background = new T.Color(0x0e1524);
    scene.fog = new T.Fog(0x0e1524, 14, 30);

    camera = new T.PerspectiveCamera(45, 1, 0.1, 100);

    scene.add(new T.HemisphereLight(0xdfe9ff, 0x1b2233, 0.85));
    const dir = new T.DirectionalLight(0xffffff, 0.9);
    dir.position.set(5, 10, 6);
    dir.castShadow = true;
    dir.shadow.mapSize.set(1024, 1024);
    dir.shadow.camera.left = -8; dir.shadow.camera.right = 8;
    dir.shadow.camera.top = 8; dir.shadow.camera.bottom = -8;
    scene.add(dir);

    root = new T.Group();
    scene.add(root);
    boardGroup = new T.Group(); root.add(boardGroup);
    dynGroup = new T.Group(); root.add(dynGroup);
    fxGroup = new T.Group(); root.add(fxGroup);
    threatGroup = new T.Group(); root.add(threatGroup);

    clock = new T.Clock();
    raycaster = new T.Raycaster();
    bindInput(canvas);
    resize();
    loop();
    loadSTLs();
  }

  function bindInput(canvas) {
    canvas.addEventListener('mousedown', (e) => { dragging = true; lastX = e.clientX; lastY = e.clientY; dragMoved = 0; });
    window.addEventListener('mouseup', () => { dragging = false; });
    window.addEventListener('mousemove', (e) => {
      if (!dragging) return;
      const dx = e.clientX - lastX, dy = e.clientY - lastY;
      lastX = e.clientX; lastY = e.clientY;
      dragMoved += Math.abs(dx) + Math.abs(dy);
      camState.theta -= dx * 0.01;
      camState.phi = Math.max(0.25, Math.min(1.45, camState.phi - dy * 0.008));
    });
    // a click (not a camera drag) can pick a «жетон из руки» or a board cell
    canvas.addEventListener('click', (e) => { if (dragMoved < 8) pickAt(e.clientX, e.clientY); });
    canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      camState.dist = Math.max(4.5, Math.min(18, camState.dist + e.deltaY * 0.01));
    }, { passive: false });
    canvas.addEventListener('touchstart', (e) => {
      if (e.touches.length === 1) { dragging = true; lastX = e.touches[0].clientX; lastY = e.touches[0].clientY; }
    }, { passive: true });
    canvas.addEventListener('touchmove', (e) => {
      if (!dragging || e.touches.length !== 1) return;
      const t = e.touches[0];
      const dx = t.clientX - lastX, dy = t.clientY - lastY;
      lastX = t.clientX; lastY = t.clientY;
      camState.theta -= dx * 0.01;
      camState.phi = Math.max(0.25, Math.min(1.45, camState.phi - dy * 0.008));
    }, { passive: true });
    canvas.addEventListener('touchend', () => { dragging = false; });
  }

  function updateCamera() {
    const d = camState.dist;
    const x = camState.target.x + d * Math.cos(camState.phi) * Math.sin(camState.theta);
    const z = camState.target.z + d * Math.cos(camState.phi) * Math.cos(camState.theta);
    const y = camState.target.y + d * Math.sin(camState.phi);
    camera.position.set(x, y, z);
    camera.lookAt(camState.target);
  }

  // ---------- picking: tokens beside the board and board cells ----------
  function pickAt(clientX, clientY) {
    if (!raycaster || !camera || !renderer || !boardGroup) return;
    const rect = renderer.domElement.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const ndc = new T.Vector2(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1
    );
    raycaster.setFromCamera(ndc, camera);
    const api = BG4.Scene3D;
    // 1) a «жетон из руки» lying beside the board?
    if (reserveMeshes.length) {
      const hits = raycaster.intersectObjects(reserveMeshes.map((r) => r.mesh), true);
      if (hits.length) {
        let o = hits[0].object;
        while (o && o.userData.reserveIndex == null) o = o.parent;
        if (o && api.onReservePick) { api.onReservePick(o.userData.reserveIndex); return; }
      }
    }
    // 2) a board cell?
    const plane = boardGroup.getObjectByName('fieldPlane');
    if (plane) {
      const hits = raycaster.intersectObject(plane, false);
      if (hits.length && api.onCellPick) {
        const p = hits[0].point;
        api.onCellPick(Math.round(p.z + bounds.cz), Math.round(p.x + bounds.cx));
      }
    }
  }

  // a printed token from «руки» (rendered beside the board until it is placed)
  function reserveMeshFor(t) {
    if (t.type === 'barrel') return barrelMesh(false);
    const name = (t.type === 'line_corner' ? 'line_corner.png'
      : t.type === 'line_straight' ? 'line_straight.png'
      : t.type === 'wall' ? 'stone.png' : t.type + '.png');
    const g = new T.Group();
    g.add(tokenTile({ x: 0, z: 0 }, name, 0.94, TOKEN_Y, -(t.rot || 0)));
    return g;
  }

  function buildReserve(lv) {
    reserveMeshes = [];
    const all = lv.reserve || [];
    const items = all.map((t, i) => ({ t, i })).filter((x) => !x.t.placed);
    if (!items.length) return;
    const trayX = (bounds.maxC - bounds.cx) + 1.15;
    items.forEach((x, k) => {
      const mesh = reserveMeshFor(x.t);
      if (!mesh) return;
      mesh.position.set(trayX, TOKEN_Y, (bounds.minR + k * 1.05) - bounds.cz);
      mesh.traverse((o) => { o.userData.reserveIndex = x.i; });
      boardGroup.add(mesh);
      reserveMeshes.push({ index: x.i, mesh, baseY: TOKEN_Y });
    });
  }

  // ---------- board construction ----------
  function clearGroup(g) {
    while (g.children.length) {
      const c = g.children.pop();
      c.traverse && c.traverse((o) => {
        if (o.geometry && !sharedGeos.has(o.geometry)) o.geometry.dispose();
        if (o.material) { if (Array.isArray(o.material)) o.material.forEach((m) => m.dispose()); else o.material.dispose(); }
      });
    }
  }

  function mat(color, opts) { return new T.MeshStandardMaterial(Object.assign({ color, roughness: 0.75, metalness: 0.05 }, opts || {})); }

  function tileMesh(color, h, y) {
    const m = new T.Mesh(new T.BoxGeometry(0.96, h || 0.18, 0.96), mat(color));
    m.position.y = (y == null ? -0.09 : y);
    m.receiveShadow = true;
    return m;
  }

  // ---------- 2D token images (used when "3D-модели (STL)" is off) ----------
  const texCache = {};
  function tokenTex(name) {
    if (!texCache[name]) {
      const t = new T.TextureLoader().load('assets/img/' + name);
      t.anisotropy = 4;
      texCache[name] = t;
    }
    return texCache[name];
  }
  // cardboard token: a thin slab with the picture printed on top
  function tokenTile(w, name, size, y, rotDeg) {
    const s = size || 0.94;
    const h = TOKEN_T;
    const g = new T.Group();
    const slab = new T.Mesh(
      new T.BoxGeometry(s, h, s),
      new T.MeshStandardMaterial({ color: 0xbfa77f, roughness: 0.95, metalness: 0 })
    );
    slab.castShadow = true; slab.receiveShadow = true;
    slab.position.y = h / 2;               // bottom sits at local y = 0
    g.add(slab);
    const face = new T.Mesh(
      new T.PlaneGeometry(s, s),
      new T.MeshStandardMaterial({ map: tokenTex(name), transparent: true, alphaTest: 0.4, roughness: 0.95, metalness: 0 })
    );
    face.rotation.x = -Math.PI / 2;
    face.position.y = h + 0.002;           // printed picture on the cardboard top
    g.add(face);
    g.position.set(w.x, y == null ? TOKEN_Y : y, w.z);
    g.rotation.y = (rotDeg || 0) * Math.PI / 180;
    return g;
  }

  function setLevel(lv, opts) {
    level = lv;
    if (opts && opts.threats) levelThreats = opts.threats;
    stop();
    clearGroup(boardGroup); clearGroup(dynGroup); clearGroup(fxGroup);
    clearGroup(threatGroup); threatMarks = [];
    _barrelsGroup = null; // will be re-created inside dynGroup
    golemMeshes = new Map();
    anims.length = 0; effects.length = 0; portalAnims.length = 0;

    // bounds over valid cells
    const valid = BG4.Engine.validCells(lv);
    let minR = 99, maxR = -99, minC = 99, maxC = -99;
    for (const k of valid) { const [r, c] = k.split(',').map(Number); minR = Math.min(minR, r); maxR = Math.max(maxR, r); minC = Math.min(minC, c); maxC = Math.max(maxC, c); }
    bounds = { minR, maxR, minC, maxC, cx: (minC + maxC) / 2, cz: (minR + maxR) / 2 };

    // ground plane under the board (checkerboard field image)
    // «жетоны из руки» lie on a strip of table beside the board
    const hasTray = (lv.reserve || []).some((t) => !t.placed);
    const gw = (maxC - minC + 1) + 0.6 + (hasTray ? 2.1 : 0), gd = (maxR - minR + 1) + 0.6;
    const ground = new T.Mesh(new T.BoxGeometry(Math.max(gw, 4.6), 0.3, Math.max(gd, 4.6)), mat(0x1a2338));
    ground.position.set(hasTray ? 1.0 : 0, FIELD_Y - 0.16, 0); ground.receiveShadow = true;
    boardGroup.add(ground);

    const planeMat = new T.MeshStandardMaterial({ map: makeCheckerTex('#2e76c9', '#cda055'), roughness: 0.7, metalness: 0.05 });
    const plane = new T.Mesh(new T.PlaneGeometry(Math.max(maxC - minC + 1, 4), Math.max(maxR - minR + 1, 4)), planeMat);
    plane.rotation.x = -Math.PI / 2;
    plane.position.y = FIELD_Y;
    plane.receiveShadow = true;
    plane.name = 'fieldPlane';
    boardGroup.add(plane);
    enhanceFieldTex(plane);

    // static tokens
    const waterCells = new Set();
    const barrelCells = new Set();
    for (const t of lv.tokens) {
      if (t.type === 'water') waterCells.add(t.r + ',' + t.c);
      if (t.type === 'barrel') barrelCells.add(t.r + ',' + t.c);
    }

    // stacking: several tokens in one cell sit one cardboard thickness apart
    stackDy = new Map();
    cellLift = new Map();
    {
      const byCell = new Map();
      for (const t of lv.tokens) {
        const k = t.r + ',' + t.c;
        if (!valid.has(k)) continue;
        if (!byCell.has(k)) byCell.set(k, []);
        byCell.get(k).push(t);
        if (t.type === 'line_straight' || t.type === 'line_corner' || t.type === 'ice' || t.type === 'spring') {
          cellLift.set(k, (cellLift.get(k) || 0) + TOKEN_T);
        }
      }
      for (const list of byCell.values()) {
        if (list.length < 2) continue;
        list.sort((a, b) => (a.layer || 1) - (b.layer || 1));
        list.forEach((t, i) => { if (i) stackDy.set(t, i * TOKEN_T); });
      }
    }

    for (const tok of lv.tokens) {
      if (!valid.has(tok.r + ',' + tok.c)) continue;
      const w = cellToWorld(tok.r, tok.c);
      const dy = stackDy.get(tok) || 0;
      const put = (obj, extra) => { if (obj) { obj.position.y += (extra || 0); boardGroup.add(obj); } };
      switch (tok.type) {
        case 'water': put(waterMesh(w), dy); break;
        case 'ice': put(iceMesh(w), dy); break;
        case 'wall': put(wallMesh(w), dy); break;
        case 'portal': put(portalMesh(w, tok.rot), dy); break;
        case 'goal': {
          const onBarrel = barrelCells.has(tok.r + ',' + tok.c);
          boardGroup.add(goalMesh(w, Math.max(dy, onBarrel ? TOKEN_T + 0.006 : 0)));
          break;
        }
        case 'line_straight': case 'line_corner': put(lineMesh(w, tok), dy); break;
        case 'spring': put(springMesh(w), dy); break;
        default: break;
      }
    }

    // barrels (initial state; rebuilt every frame while the program plays)
    for (const tok of lv.tokens) {
      if (tok.type !== 'barrel' || !valid.has(tok.r + ',' + tok.c)) continue;
      const w = cellToWorld(tok.r, tok.c);
      const floating = waterCells.has(tok.r + ',' + tok.c);
      const m = barrelMesh(floating);
      m.userData.static = true; // replaced by the animated set on the first frame
      m.position.set(w.x, barrelBaseY(tok.r, tok.c, floating), w.z);
      dynGroupBarrels().add(m);
    }

    // golems (positions will be updated by frames)
    const golems = [];
    if (lv.start) golems.push({ id: 'player', color: lv.start.color, r: lv.start.r, c: lv.start.c, dir: lv.start.dir, isPlayer: true });
    lv.bots.forEach((b, i) => golems.push({ id: 'bot' + i, color: b.color, r: b.r, c: b.c, dir: b.dir, isPlayer: false }));
    const initBarrels = lv.tokens
      .filter((t) => t.type === 'barrel' && valid.has(t.r + ',' + t.c))
      .map((t) => ({ r: t.r, c: t.c, floating: waterCells.has(t.r + ',' + t.c) }));
    for (const g of golems) {
      const mesh = golemMesh(g.color, g.isPlayer);
      placeGolem(mesh, g.r, g.c, g.dir, false, standYAt(g.r, g.c, initBarrels));
      dynGroup.add(mesh);
      golemMeshes.set(g.id, mesh);
    }

    // tokens lying beside the board («из руки»), e.g. 4.4: Бочка
    buildReserve(lv);

    // подсветка зон Атаки начальной доски (пока программа не запущена)
    updateThreats(levelThreats);

    camState.dist = Math.max(6.5, (maxC - minC + maxR - minR) * 1.5) + (hasTray ? 1.1 : 0);
    camState.target.set(hasTray ? 0.6 : 0, 0.3, 0);
    updateCamera();
  }

  function waterMesh(w) {
    if (!stlOn()) return tokenTile(w, 'water.png', 0.94);
    const m = new T.Mesh(new T.BoxGeometry(0.96, 0.06, 0.96), new T.MeshStandardMaterial({ color: 0x2f7fd6, roughness: 0.2, metalness: 0.3, transparent: true, opacity: 0.85 }));
    m.position.set(w.x, WATER_TOP - 0.03, w.z); m.receiveShadow = true;
    return m;
  }
  function iceMesh(w) {
    if (!stlOn()) return tokenTile(w, 'ice.png', 0.94);
    const m = new T.Mesh(new T.BoxGeometry(0.92, 0.16, 0.92), new T.MeshStandardMaterial({ color: 0xbfe8ff, roughness: 0.1, metalness: 0.1, transparent: true, opacity: 0.9 }));
    m.position.set(w.x, 0.08, w.z); m.receiveShadow = true;
    return m;
  }
  function wallMesh(w) {
    if (!stlOn()) return tokenTile(w, 'stone.png', 0.94);
    if (stlGeos.stone) {
      const m = new T.Mesh(stlGeos.stone, mat(0x565b64, { roughness: 0.98, flatShading: true }));
      m.castShadow = true; m.receiveShadow = true;
      m.position.set(w.x, 0, w.z);
      const g = new T.Group();
      g.add(m);
      return g;
    }
    const g = new T.Group();
    const m = new T.Mesh(new T.BoxGeometry(0.92, 0.6, 0.92), mat(0x565b64, { roughness: 0.98 }));
    m.position.set(w.x, 0.3, w.z); m.castShadow = true; m.receiveShadow = true;
    g.add(m);
    return g;
  }


  // Portals read as «телепорты»: a semi-transparent blue halo floats up and down
  // above them (nothing turns). Works both with the STL model and the printed token.
  function portalMat(intensity, opacity) {
    const m = new T.MeshStandardMaterial({
      color: 0x5aa8ff, emissive: 0x1f6fff, emissiveIntensity: intensity == null ? 1 : intensity,
      roughness: 0.35, metalness: 0.1,
    });
    if (opacity != null) { m.transparent = true; m.opacity = opacity; m.depthWrite = false; }
    return m;
  }
  function portalMesh(w, rot) {
    const turned = -(rot || 0) * Math.PI / 180; // puzzle rot grows clockwise
    const g = new T.Group();
    g.position.set(w.x, 0, w.z);
    g.rotation.y = turned;

    const params = { baseY: TOKEN_Y + 0.5, bob: 0.12 };
    if (!stlOn()) {
      const tile = tokenTile(w, 'portal.png', 0.94, TOKEN_Y, 0);
      tile.position.set(0, tile.position.y, 0); // the group already sits on the cell
      g.add(tile);
    } else if (stlGeos.portal) {
      stlGeos.portal.computeBoundingBox();
      const m = new T.Mesh(stlGeos.portal, portalMat(0.9));
      m.castShadow = true;
      g.add(m);
      params.baseY = (stlGeos.portal.boundingBox.max.y || 0.6) + 0.22;
    } else {
      const torus = new T.Mesh(new T.TorusGeometry(0.34, 0.1, 10, 20), portalMat(0.9));
      torus.position.y = 0.1; torus.rotation.x = Math.PI / 2;
      g.add(torus);
      params.baseY = 0.55;
    }

    // semi-transparent blue ring that floats up and down above the portal
    const ring = new T.Mesh(new T.TorusGeometry(0.27, 0.045, 12, 32), portalMat(1.1, 0.5));
    ring.position.y = params.baseY;
    ring.rotation.x = Math.PI / 2;
    g.add(ring);
    params.ring = ring;

    // faint core glow inside the portal opening
    const disc = new T.Mesh(new T.CircleGeometry(0.22, 26), new T.MeshBasicMaterial({
      color: 0x7fc0ff, transparent: true, opacity: 0.16, side: T.DoubleSide,
      depthWrite: false, blending: T.AdditiveBlending,
    }));
    disc.position.y = params.baseY - 0.32;
    disc.rotation.x = -Math.PI / 2;
    g.add(disc);
    params.disc = disc;

    params.t = (w.x * 0.7 + w.z * 1.3 + 4) % 6.283;
    portalAnims.push(params);
    return g;
  }


  function goalMesh(w, dy) {
    // the goal marker must always sit above barrels / water / ice / line tokens
    dy = dy || 0;
    if (!stlOn()) {
      const g = tokenTile(w, 'goal.png', 0.94, TOKEN_Y + dy);
      g.traverse((o) => { if (o.isMesh) { o.renderOrder = 30; if (o.material) o.material.depthWrite = false; } });
      return g;
    }
    const g = new T.Group();
    g.position.y = dy;
    const ring = new T.Mesh(new T.TorusGeometry(0.32, 0.06, 8, 24), new T.MeshStandardMaterial({ color: 0xffd54a, emissive: 0x7a5a00, emissiveIntensity: 0.7 }));
    ring.position.set(w.x, 0.06, w.z); ring.rotation.x = Math.PI / 2;
    g.add(ring);
    const pole = new T.Mesh(new T.CylinderGeometry(0.03, 0.03, 0.8, 8), mat(0xf0f0f0));
    pole.position.set(w.x, 0.4, w.z); g.add(pole);
    const flag = new T.Mesh(new T.PlaneGeometry(0.3, 0.2), new T.MeshStandardMaterial({ color: 0xffd54a, side: T.DoubleSide, emissive: 0x7a5a00, emissiveIntensity: 0.4 }));
    flag.position.set(w.x + 0.16, 0.66, w.z); g.add(flag);
    g.traverse((o) => { if (o.isMesh) o.renderOrder = 30; });
    return g;
  }
  function lineMesh(w, tok) {
    // Lines are always flat cardboard tokens with the printed picture on top —
    // a 3D bar looks wrong. rot grows clockwise in the puzzle data, so the
    // sprite is turned the other way (Three.js rotation.y grows counter-clockwise).
    const name = tok.type === 'line_corner' ? 'line_corner.png' : 'line_straight.png';
    return tokenTile(w, name, 0.94, TOKEN_Y, -(tok.rot || 0));
  }
  function springMesh(w) {
    if (!stlOn()) return tokenTile(w, 'spring.png', 0.94);
    const m = new T.Mesh(new T.CylinderGeometry(0.28, 0.28, 0.1, 12), mat(0xcc7733));
    m.position.set(w.x, 0.05, w.z);
    return m;
  }

  function barrelMesh(floating) {
    if (!stlOn()) {
      const g = tokenTile({ x: 0, z: 0 }, 'barell.png', 0.88, 0);
      g.userData.floating = floating;
      return g;
    }
    if (stlGeos.barrel) {
      const m = new T.Mesh(stlGeos.barrel, mat(0x9c6b3a, { roughness: 0.85, flatShading: true }));
      m.castShadow = true;
      m.userData.floating = floating;
      return m;
    }
    const g = new T.Group();
    const body = new T.Mesh(new T.CylinderGeometry(0.3, 0.3, 0.5, 14), mat(0x9c6b3a, { roughness: 0.85 }));
    body.position.y = 0.25; body.castShadow = true;
    g.add(body);
    for (const y of [0.12, 0.38]) {
      const ring = new T.Mesh(new T.TorusGeometry(0.31, 0.03, 6, 16), mat(0x5c3b1e));
      ring.position.y = y; ring.rotation.x = Math.PI / 2; g.add(ring);
    }
    g.userData.floating = floating;
    return g;
  }



  // «Акрил»: полупрозрачный цветной пластик — блестящий, просвечивающий, с
  // яркой кромкой (плоская деталь, поэтому DoubleSide и без записи в depth).
  function acrylicMat(colorHex) {
    return new T.MeshPhysicalMaterial({
      color: colorHex, transparent: true, opacity: 0.76, roughness: 0.12, metalness: 0.0,
      clearcoat: 1, clearcoatRoughness: 0.06, reflectivity: 0.6,
      emissive: colorHex, emissiveIntensity: 0.13,
      side: T.DoubleSide, depthWrite: false,
    });
  }

  function golemMesh(color, isPlayer) {
    const stlGeo = stlOn() && stlGeos.golem && stlGeos.golem[color];
    if (stlGeo) {
      const c = COLORS[color] || 0xcccccc;
      const m = new T.Mesh(stlGeo, mat(c, { roughness: 0.5, metalness: 0.25 }));
      m.castShadow = true;
      if (!isPlayer) {
        const flag = new T.Mesh(new T.ConeGeometry(0.07, 0.18, 8), mat(0xff5555));
        flag.position.set(0, 1.22, 0); flag.castShadow = true;
        m.add(flag);
      }
      return m;
    }
    // Без 3D-моделей — акриловая фигурка из «Figurine *.stl» (стоит вертикально,
    // смотрит туда же, куда и голем).
    const figGeo = stlGeos.figurine && stlGeos.figurine[color];
    if (figGeo) {
      figGeo.computeBoundingBox();
      const top = figGeo.boundingBox.max.y || 1.1;
      const m = new T.Mesh(figGeo, acrylicMat(COLORS[color] || 0xcccccc));
      m.castShadow = true;
      m.userData.acrylic = true;
      if (!isPlayer) {
        const flag = new T.Mesh(new T.ConeGeometry(0.07, 0.18, 8), mat(0xff5555));
        flag.position.set(0, top + 0.12, 0); flag.castShadow = true;
        m.add(flag);
      }
      return m;
    }
    const g = new T.Group();
    const c = COLORS[color] || 0xcccccc;
    const body = new T.Mesh(new T.CylinderGeometry(0.26, 0.3, 0.5, 12), mat(c, { roughness: 0.5, metalness: 0.25 }));
    body.position.y = 0.25; body.castShadow = true;
    g.add(body);
    const head = new T.Mesh(new T.SphereGeometry(0.22, 14, 12), mat(c, { roughness: 0.4, metalness: 0.3 }));
    head.position.y = 0.66; head.castShadow = true;
    g.add(head);
    const nose = new T.Mesh(new T.ConeGeometry(0.08, 0.22, 8), mat(0xffffff));
    nose.rotation.x = Math.PI / 2;
    nose.position.set(0, 0.66, 0.24);
    g.add(nose);
    if (!isPlayer) {
      const flag = new T.Mesh(new T.ConeGeometry(0.07, 0.18, 8), mat(0xff5555));
      flag.position.y = 0.96; g.add(flag);
    }
    return g;
  }



  function placeGolem(mesh, r, c, dir, animate, standY) {
    const w = cellToWorld(r, c);
    const y = (standY == null ? TOKEN_Y : standY);
    if (animate) {
      anims.push({ obj: mesh, from: mesh.position.clone(), to: new T.Vector3(w.x, y, w.z), t: 0, dur: 0.28, kind: 'pos' });
      const fromRot = mesh.rotation.y;
      let toRot = DIR_YAW[dir] || 0;
      // shortest rotation
      while (toRot - fromRot > Math.PI) toRot -= Math.PI * 2;
      while (toRot - fromRot < -Math.PI) toRot += Math.PI * 2;
      anims.push({ obj: mesh, fromRot, toRot, t: 0, dur: 0.28, kind: 'rot' });
    } else {
      mesh.position.set(w.x, y, w.z);
      mesh.rotation.y = DIR_YAW[dir] || 0;
    }
  }

  // ---------- зоны Атаки (подсветка клеток, по которым можно ударить) ----------
  // Игрок и боты «простреливают» клетку перед собой (Пешка — две диагонали
  // впереди). Клетки приходят из кадров движка (`frame.threats`), а цвет
  // подсветки совпадает с цветом Голема (красный/синий/зелёный/жёлтый).
  const THREAT_COLOR = {
    player: '70,150,255', bot: '255,80,72',
    red: '255,80,72', blue: '70,150,255', green: '70,200,110', yellow: '255,215,60',
  };
  const threatTexCache = {};
  const threatMatCache = {};
  function roundRectPath(x, X, Y, W, H, R) {
    x.beginPath();
    x.moveTo(X + R, Y);
    x.arcTo(X + W, Y, X + W, Y + H, R);
    x.arcTo(X + W, Y + H, X, Y + H, R);
    x.arcTo(X, Y + H, X, Y, R);
    x.arcTo(X, Y, X + W, Y, R);
    x.closePath();
  }
  function threatTexture(kind) {
    if (threatTexCache[kind]) return threatTexCache[kind];
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const x = c.getContext('2d');
    const col = THREAT_COLOR[kind] || THREAT_COLOR.bot;
    x.clearRect(0, 0, 128, 128);
    // рамка пунктиром + «перекрестие»: сюда достанет Атака.
    // Сначала тёмная подложка — иначе цвет плохо читается на цветных клетках.
    x.strokeStyle = 'rgba(0,0,0,0.45)';
    x.lineWidth = 17;
    roundRectPath(x, 8, 8, 112, 112, 18); x.stroke();
    x.fillStyle = 'rgba(' + col + ',0.30)';
    roundRectPath(x, 8, 8, 112, 112, 18); x.fill();
    x.strokeStyle = 'rgba(' + col + ',1)';
    x.lineWidth = 10;
    x.setLineDash([16, 10]);
    roundRectPath(x, 8, 8, 112, 112, 18); x.stroke();
    x.setLineDash([]);
    x.strokeStyle = 'rgba(0,0,0,0.4)';
    x.lineWidth = 12;
    x.beginPath();
    x.moveTo(46, 46); x.lineTo(82, 82);
    x.moveTo(82, 46); x.lineTo(46, 82);
    x.stroke();
    x.strokeStyle = 'rgba(' + col + ',1)';
    x.lineWidth = 7;
    x.beginPath();
    x.moveTo(46, 46); x.lineTo(82, 82);
    x.moveTo(82, 46); x.lineTo(46, 82);
    x.stroke();
    const t = new T.CanvasTexture(c);
    t.anisotropy = 4;
    threatTexCache[kind] = t;
    return t;
  }
  function threatMat(kind) {
    if (!threatMatCache[kind]) {
      threatMatCache[kind] = new T.MeshBasicMaterial({
        map: threatTexture(kind), transparent: true, depthWrite: false, opacity: 0.95,
      });
    }
    return threatMatCache[kind];
  }
  function updateThreats(list) {
    if (!threatGroup) return;
    let i = 0;
    for (const t of (list || [])) {
      let m = threatMarks[i];
      if (!m) {
        m = new T.Mesh(new T.PlaneGeometry(0.88, 0.88), threatMat('bot'));
        m.rotation.x = -Math.PI / 2;
        m.renderOrder = 3;
        threatMarks.push(m);
        threatGroup.add(m);
      }
      const w = cellToWorld(t.r, t.c);
      m.position.set(w.x, FIELD_Y + 0.016, w.z);
      // цвет зоны = цвет Голема, который держит эту клетку под Атакой
      m.material = threatMat(t.color || (t.kind === 'player' ? 'player' : 'bot'));
      m.visible = true;
      i++;
    }
    for (; i < threatMarks.length; i++) threatMarks[i].visible = false;
  }

  // ---------- frames ----------
  function setFrame(frame, animate) {
    if (!frame) return;
    const frameBarrels = frame.barrels || [];
    const events = frame.events || [];
    // barrels swallowed by a portal just disappear (no «crush»)
    const vanished = new Set(events.filter((e) => e.type === 'vanish' && e.pos).map((e) => e.pos[0] + ',' + e.pos[1]));
    // a golem coming out of a portal must appear at once, not slide across the board
    const jumpedIn = new Set(events.filter((e) => e.type === 'portal' && e.to).map((e) => e.to[0] + ',' + e.to[1]));

    // Barrels keep their mesh: a barrel pushed by a golem SLIDES into the next
    // cell (goem + barrel move together), only a destroyed one gets the «crush».
    const grp = dynGroupBarrels();
    const old = new Map();
    for (const m of grp.children.slice()) {
      if (m.userData.static) { grp.remove(m); disposeObj(m); continue; } // pre-play board copy
      if (m.userData.cellKey) old.set(m.userData.cellKey, m);
    }
    const used = new Set();
    for (const b of frameBarrels) {
      const k = b.r + ',' + b.c;
      const w = cellToWorld(b.r, b.c);
      const y = barrelBaseY(b.r, b.c, b.floating);
      let m = old.get(k);
      if (m) used.add(k);
      else {
        // no barrel was here — is it a barrel that was pushed over from a neighbour?
        for (const [nr, nc] of [[b.r - 1, b.c], [b.r + 1, b.c], [b.r, b.c - 1], [b.r, b.c + 1]]) {
          const nk = nr + ',' + nc;
          const cand = old.get(nk);
          if (cand && !used.has(nk)) { m = cand; used.add(nk); break; }
        }
      }
      if (m) {
        if (m.position.x !== w.x || m.position.y !== y || m.position.z !== w.z) {
          anims.push({ obj: m, from: m.position.clone(), to: new T.Vector3(w.x, y, w.z), t: 0, dur: 0.3, kind: 'pos' });
        }
      } else {
        m = barrelMesh(b.floating);
        m.position.set(w.x, y, w.z);
        grp.add(m);
      }
      m.userData.cellKey = k;
    }
    // barrels that left the board
    for (const [k, m] of old) {
      if (used.has(k)) continue;
      grp.remove(m);
      if (vanished.has(k)) { disposeObj(m); continue; } // went through a portal
      fxGroup.add(m);
      effects.push({ obj: m, t: -0.14, dur: 0.5, kind: 'crush', baseY: m.position.y });
    }

    // golems (stand on top of a barrel if one is on their cell)
    const seen = new Set();
    for (const g of frame.golems) {
      seen.add(g.id);
      const mesh = golemMeshes.get(g.id);
      if (!mesh || mesh.userData.dying) continue;
      mesh.visible = true;
      const animateHere = !!animate && !jumpedIn.has(g.r + ',' + g.c);
      placeGolem(mesh, g.r, g.c, g.dir, animateHere, standYAt(g.r, g.c, frameBarrels));
      // damage tint
      const t = Math.min(3, g.damage || 0);
      mesh.userData.damage = t;
    }
    // a golem that leaves the board (destroyed) sinks + fades instead of blinking out
    for (const [id, mesh] of golemMeshes) {
      if (seen.has(id) || mesh.userData.dying || !mesh.visible) continue;
      mesh.userData.dying = true;
      effects.push({
        obj: mesh, t: -0.14, dur: 0.5, kind: 'crush', baseY: mesh.position.y, keepAlive: true,
        onEnd: () => { mesh.visible = false; mesh.userData.dying = false; },
      });
    }

    // events -> effects
    for (const ev of frame.events || []) spawnEffect(ev, frame);

    // зоны Атаки пересчитываются в каждом кадре (Големы ходят и поворачиваются)
    updateThreats(frame.threats || []);
  }

  let _barrelsGroup = null;
  function dynGroupBarrels() { if (!_barrelsGroup) { _barrelsGroup = new T.Group(); dynGroup.add(_barrelsGroup); } return _barrelsGroup; }

  // ---------- stacking helpers ----------
  // Tokens that share a cell are stacked one cardboard thickness apart, so the
  // token underneath stays visible (e.g. 5.9: линия + бочка).
  let stackDy = new Map();   // token object -> extra height
  let cellLift = new Map();  // 'r,c' -> height of the flat tokens lying in the cell

  // height of a barrel (STL model or flat token) — what a golem stands on
  function barrelTopH() {
    if (stlOn() && stlGeos.barrel) {
      stlGeos.barrel.computeBoundingBox();
      return stlGeos.barrel.boundingBox.max.y;
    }
    return TOKEN_T;
  }
  function barrelBaseY(r, c, floating) {
    return (floating ? WATER_TOP : TOKEN_Y) + (cellLift.get(r + ',' + c) || 0);
  }
  // y of the surface a golem stands on in this cell (top of a barrel, else the field)
  function standYAt(r, c, barrels) {
    for (const b of barrels || []) {
      if (b.r === r && b.c === c) return barrelBaseY(b.r, b.c, b.floating) + barrelTopH();
    }
    return TOKEN_Y;
  }

  function cellOfWho(frame, who) {
    const g = (frame.golems || []).find((x) => x.id === who);
    if (!g) return null;
    return cellToWorld(g.r, g.c);
  }
  function spawnEffect(ev, frame) {
    // Attack/Hit: red slashing pulse on the FRONT cell, plus a tiny marker
    if (ev.type === 'attack' || ev.type === 'hit' || ev.type === 'damage') {
      const p = ev.pos ? cellToWorld(ev.pos[0], ev.pos[1]) : cellOfWho(frame, ev.who);
      if (!p) return;
      // red disk (slash mark)
      const disk = new T.Mesh(new T.RingGeometry(0.15, 0.4, 16), new T.MeshStandardMaterial({ color: 0xff4444, emissive: 0xff0000, emissiveIntensity: 1.2, side: T.DoubleSide }));
      disk.position.set(p.x, 0.05, p.z); disk.rotation.x = -Math.PI / 2;
      fxGroup.add(disk);
      effects.push({ obj: disk, t: 0, dur: 0.45, kind: 'pulse' });
      // white flash in the target's face
      const flash = new T.Mesh(new T.SphereGeometry(0.18, 8, 6), new T.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 2, transparent: true }));
      flash.position.set(p.x, 0.35, p.z);
      fxGroup.add(flash);
      effects.push({ obj: flash, t: 0, dur: 0.3, kind: 'puff' });
      // a slash that grows across the target cell
      const slash = new T.Mesh(new T.PlaneGeometry(0.95, 0.16), new T.MeshBasicMaterial({ color: 0xffe0e0, transparent: true, opacity: 0.9, side: T.DoubleSide, depthWrite: false }));
      slash.position.set(p.x, 0.62, p.z);
      slash.rotation.z = Math.PI / 5;
      fxGroup.add(slash);
      effects.push({ obj: slash, t: 0, dur: 0.32, kind: 'slash' });
    } else if (ev.type === 'defend' || ev.type === 'blocked') {
      // blue shield bubble around the defender + a shock ring
      const p = ev.pos ? cellToWorld(ev.pos[0], ev.pos[1]) : cellOfWho(frame, ev.who);
      if (!p) return;
      const dome = new T.Mesh(new T.SphereGeometry(0.55, 18, 14), new T.MeshStandardMaterial({
        color: 0x6fc4ff, emissive: 0x1a6bff, emissiveIntensity: 0.9,
        transparent: true, opacity: 0.55, roughness: 0.2, metalness: 0.1,
        side: T.DoubleSide, depthWrite: false,
      }));
      dome.position.set(p.x, 0.42, p.z);
      fxGroup.add(dome);
      effects.push({ obj: dome, t: 0, dur: 0.7, kind: 'shield' });
      const ring = new T.Mesh(new T.TorusGeometry(0.5, 0.07, 8, 26), new T.MeshStandardMaterial({ color: 0x9fe0ff, emissive: 0x2f8bff, emissiveIntensity: 1.4, transparent: true }));
      ring.position.set(p.x, 0.42, p.z); ring.rotation.x = Math.PI / 2;
      fxGroup.add(ring);
      effects.push({ obj: ring, t: 0, dur: 0.7, kind: 'pulse' });
    } else if (ev.type === 'explode') {
      // бомба в Бочке (4.10): вспышка + взрывная волна + дым
      const p = cellToWorld(ev.pos[0], ev.pos[1]);
      const flash = new T.Mesh(new T.SphereGeometry(0.34, 14, 10), new T.MeshBasicMaterial({ color: 0xffe08a, transparent: true, opacity: 0.95 }));
      flash.position.set(p.x, 0.4, p.z);
      fxGroup.add(flash);
      effects.push({ obj: flash, t: 0, dur: 0.5, kind: 'blast' });
      const wave = new T.Mesh(new T.TorusGeometry(0.32, 0.06, 8, 26), new T.MeshBasicMaterial({ color: 0xff9a3c, transparent: true, opacity: 0.95 }));
      wave.position.set(p.x, 0.12, p.z); wave.rotation.x = Math.PI / 2;
      fxGroup.add(wave);
      effects.push({ obj: wave, t: 0, dur: 0.65, kind: 'pulse' });
      for (let i = 0; i < 3; i++) puff(p.x, p.z, 0xff8844);
    } else if (ev.type === 'break_barrel' || ev.type === 'destroy') {

      const p = cellToWorld(ev.pos[0], ev.pos[1]);
      const ring = new T.Mesh(new T.TorusGeometry(0.3, 0.06, 6, 20), new T.MeshStandardMaterial({ color: 0xffcc55, emissive: 0xff8800, emissiveIntensity: 1 }));
      ring.position.set(p.x, 0.3, p.z); ring.rotation.x = Math.PI / 2;
      fxGroup.add(ring);
      effects.push({ obj: ring, t: 0, dur: 0.6, kind: 'pulse' });
    } else if (ev.type === 'portal') {
      // swirl at both ends of the jump
      for (const cell of [ev.from, ev.to]) {
        if (!cell) continue;
        const p = cellToWorld(cell[0], cell[1]);
        const ring = new T.Mesh(new T.TorusGeometry(0.28, 0.05, 8, 24), new T.MeshStandardMaterial({ color: 0xd0a0ff, emissive: 0x9b4dff, emissiveIntensity: 1.6, transparent: true }));
        ring.position.set(p.x, 0.5, p.z); ring.rotation.x = Math.PI / 2;
        fxGroup.add(ring);
        effects.push({ obj: ring, t: 0, dur: 0.55, kind: 'pulse' });
        puff(p.x, p.z, 0xc98cff);
      }
    } else if (ev.type === 'drowned' || ev.type === 'killed') {
      const g = frame.golems.find((x) => x.id === ev.who);
      if (g) { const p = cellToWorld(g.r, g.c); puff(p.x, p.z, 0x88bbff); }
    }
  }
  function puff(x, z, color) {
    const m = new T.Mesh(new T.SphereGeometry(0.2, 10, 8), new T.MeshStandardMaterial({ color, transparent: true, opacity: 0.9 }));
    m.position.set(x, 0.4, z);
    fxGroup.add(m);
    effects.push({ obj: m, t: 0, dur: 0.7, kind: 'puff' });
  }

  // fade a whole mesh/group (used by the destruction animations)
  function setObjOpacity(obj, o) {
    obj.traverse((m) => {
      if (!m.isMesh || !m.material) return;
      const mats = Array.isArray(m.material) ? m.material : [m.material];
      for (const mm of mats) {
        if (!mm) continue;
        if (o < 1) { mm.transparent = true; mm.opacity = o; }
        else mm.opacity = 1;
      }
    });
  }
  function disposeObj(obj) {
    obj.traverse((m) => {
      if (!m.isMesh) return;
      if (m.geometry && !sharedGeos.has(m.geometry)) m.geometry.dispose();
      if (m.material) { const mats = Array.isArray(m.material) ? m.material : [m.material]; for (const mm of mats) if (mm) mm.dispose(); }
    });
  }

  // ---------- play a list of frames ----------
  function play(frames, opts) {
    opts = opts || {};
    playQueue = frames.slice();
    playOnDone = opts.onDone || null;
    playOnFrame = opts.onFrame || null;
    playSpeed = opts.speed || 1;
    playTimer = 0;
    playing = true;
    setFrame(playQueue[0], false);
    if (playOnFrame) playOnFrame(playQueue[0]);
  }
  function stop() { playing = false; playQueue = []; playOnDone = null; playOnFrame = null; }

  // ---------- render loop ----------
  function loop() {
    raf = requestAnimationFrame(loop);
    const dt = Math.min(0.05, clock.getDelta());
    updateCamera();

    // tweens
    for (let i = anims.length - 1; i >= 0; i--) {
      const a = anims[i];
      a.t += dt;
      const k = Math.min(1, a.t / a.dur);
      const e = k * k * (3 - 2 * k);
      if (a.kind === 'pos') a.obj.position.lerpVectors(a.from, a.to, e);
      else a.obj.rotation.y = a.fromRot + (a.toRot - a.fromRot) * e;
      if (k >= 1) anims.splice(i, 1);
    }
    // effects
    for (let i = effects.length - 1; i >= 0; i--) {
      const f = effects[i];
      f.t += dt;
      const k = Math.max(0, Math.min(1, f.t / f.dur));
      if (f.kind === 'pulse') { f.obj.scale.setScalar(1 + k * 2); f.obj.material.opacity = 1 - k; f.obj.material.transparent = true; }
      else if (f.kind === 'shield') { f.obj.scale.setScalar(0.55 + 0.8 * k); f.obj.material.opacity = 0.6 * (1 - k * k); }
      else if (f.kind === 'blast') { f.obj.scale.setScalar(0.5 + 2.2 * k); f.obj.material.opacity = 0.95 * (1 - k * k); }
      else if (f.kind === 'puff') { f.obj.position.y += dt * 1.2; f.obj.material.opacity = 0.9 * (1 - k); }
      else if (f.kind === 'slash') {
        f.obj.scale.set(0.4 + 0.9 * k, 1, 1);
        f.obj.material.opacity = 0.95 * (1 - k * k);
      }
      else if (f.kind === 'crush') {
        // destroyed barrel/golem: flashes bigger, then collapses and sinks away
        const s = k < 0.25 ? 1 + 0.2 * (k / 0.25) : 1.2 * (1 - (k - 0.25) / 0.75);
        f.obj.scale.setScalar(Math.max(0.05, s));
        f.obj.position.y = f.baseY - 0.3 * k * k;
        f.obj.rotation.z = Math.sin(k * 20) * 0.16 * (1 - k);
        setObjOpacity(f.obj, 1 - k);
      }
      if (f.t >= f.dur) {
        fxGroup.remove(f.obj);
        if (f.keepAlive) { f.obj.scale.setScalar(1); f.obj.rotation.z = 0; setObjOpacity(f.obj, 1); }
        else disposeObj(f.obj);
        if (f.onEnd) f.onEnd();
        effects.splice(i, 1);
      }
    }

    // portals: a semi-transparent blue ring floats up and down above them
    for (const p of portalAnims) {
      p.t += dt;
      const k = 0.5 + 0.5 * Math.sin(p.t * 1.8);
      p.ring.position.y = p.baseY + (k * 2 - 1) * p.bob;
      if (p.ring.material) p.ring.material.opacity = 0.3 + 0.35 * k;
      if (p.disc.material) p.disc.material.opacity = 0.06 + 0.14 * k;
      p.disc.scale.setScalar(0.85 + 0.12 * k);
    }

    // «жетоны из руки»: they float a little; the picked one rises and turns
    for (let i = 0; i < reserveMeshes.length; i++) {
      const r = reserveMeshes[i];
      const sel = r.index === reserveSelected;
      const tsec = clock ? clock.elapsedTime : 0;
      r.mesh.position.y = r.baseY + (sel ? 0.18 + Math.sin(tsec * 3) * 0.04 : 0.04 + Math.sin(tsec * 1.6 + i) * 0.03);
      r.mesh.rotation.y += dt * (sel ? 0.9 : 0.12);
      r.mesh.scale.setScalar(sel ? 1.12 : 1);
    }

    // frame playback
    if (playing) {
      playTimer += dt * playSpeed;
      const step = 0.5; // seconds per frame
      if (playTimer >= step) {
        playTimer = 0;
        playQueue.shift();
        if (!playQueue.length) { playing = false; const cb = playOnDone; playOnDone = null; if (cb) cb(); }
        else { setFrame(playQueue[0], true); if (playOnFrame) playOnFrame(playQueue[0]); }
      }
    }

    renderer.render(scene, camera);
  }

  function resize() {
    if (!renderer) return;
    const canvas = renderer.domElement;
    const parent = canvas.parentElement;
    const w = parent ? parent.clientWidth : window.innerWidth;
    const h = parent ? parent.clientHeight : window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / Math.max(1, h);
    camera.updateProjectionMatrix();
  }

  function dispose() { stop(); if (raf) cancelAnimationFrame(raf); if (renderer) renderer.dispose(); }

  BG4.Scene3D = {
    init, setLevel, setFrame, play, stop, resize, dispose, COLORS,
    // «жетоны из руки» (4.4: Бочка стоит сбоку поля, игрок сам ставит её на клетку)
    onReservePick: null,
    onCellPick: null,
    reserveCount() { return reserveMeshes.length; },
    setReserveSelected(i) { reserveSelected = (i == null ? -1 : i); },
  };

})();
