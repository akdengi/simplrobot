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

  let renderer, scene, camera, root;
  let raf = null;
  let clock = null;
  let level = null;
  let bounds = { minR: 0, maxR: 0, minC: 0, maxC: 0, cx: 0, cz: 0 };
  let golemMeshes = new Map();
  let dynGroup, fxGroup, boardGroup;
  let camState = { theta: Math.PI * 0.15, phi: 0.95, dist: 9, target: new T.Vector3(0, 0, 0) };
  let dragging = false, lastX = 0, lastY = 0;
  const anims = [];       // active tweens
  const effects = [];     // active effects
  let playing = false;
  let playQueue = [];
  let playTimer = 0;
  let playOnDone = null;
  let playSpeed = 1;

  function cellToWorld(r, c) {
    return { x: c - bounds.cx, z: r - bounds.cz };
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

    clock = new T.Clock();
    bindInput(canvas);
    resize();
    loop();
  }

  function bindInput(canvas) {
    canvas.addEventListener('mousedown', (e) => { dragging = true; lastX = e.clientX; lastY = e.clientY; });
    window.addEventListener('mouseup', () => { dragging = false; });
    window.addEventListener('mousemove', (e) => {
      if (!dragging) return;
      const dx = e.clientX - lastX, dy = e.clientY - lastY;
      lastX = e.clientX; lastY = e.clientY;
      camState.theta -= dx * 0.01;
      camState.phi = Math.max(0.25, Math.min(1.45, camState.phi - dy * 0.008));
    });
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

  // ---------- board construction ----------
  function clearGroup(g) {
    while (g.children.length) {
      const c = g.children.pop();
      c.traverse && c.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) { if (Array.isArray(o.material)) o.material.forEach((m) => m.dispose()); else o.material.dispose(); } });
    }
  }

  function mat(color, opts) { return new T.MeshStandardMaterial(Object.assign({ color, roughness: 0.75, metalness: 0.05 }, opts || {})); }

  function tileMesh(color, h, y) {
    const m = new T.Mesh(new T.BoxGeometry(0.96, h || 0.18, 0.96), mat(color));
    m.position.y = (y == null ? -0.09 : y);
    m.receiveShadow = true;
    return m;
  }

  function setLevel(lv) {
    level = lv;
    stop();
    clearGroup(boardGroup); clearGroup(dynGroup); clearGroup(fxGroup);
    golemMeshes = new Map();
    anims.length = 0; effects.length = 0;

    // bounds over valid cells
    const valid = BG4.Engine.validCells(lv);
    let minR = 99, maxR = -99, minC = 99, maxC = -99;
    for (const k of valid) { const [r, c] = k.split(',').map(Number); minR = Math.min(minR, r); maxR = Math.max(maxR, r); minC = Math.min(minC, c); maxC = Math.max(maxC, c); }
    bounds = { minR, maxR, minC, maxC, cx: (minC + maxC) / 2, cz: (minR + maxR) / 2 };

    // ground plane under the board
    const gw = (maxC - minC + 1) + 1.4, gd = (maxR - minR + 1) + 1.4;
    const ground = new T.Mesh(new T.BoxGeometry(gw, 0.3, gd), mat(0x243049));
    ground.position.y = -0.32; ground.receiveShadow = true;
    boardGroup.add(ground);

    const tileColor = (lv.fields[0] && lv.fields[0].side === 'winter') ? 0xcdd8ea : 0x6f8f6a;
    for (const k of valid) {
      const [r, c] = k.split(',').map(Number);
      const w = cellToWorld(r, c);
      const t = tileMesh(tileColor, 0.18, -0.09);
      t.position.x = w.x; t.position.z = w.z;
      boardGroup.add(t);
    }

    // static tokens
    for (const tok of lv.tokens) {
      if (!valid.has(tok.r + ',' + tok.c)) continue;
      const w = cellToWorld(tok.r, tok.c);
      switch (tok.type) {
        case 'water': boardGroup.add(waterMesh(w)); break;
        case 'ice': boardGroup.add(iceMesh(w)); break;
        case 'wall': boardGroup.add(wallMesh(w)); break;
        case 'portal': boardGroup.add(portalMesh(w, tok.rot)); break;
        case 'goal': boardGroup.add(goalMesh(w)); break;
        case 'line_straight': case 'line_corner': boardGroup.add(lineMesh(w, tok)); break;
        case 'spring': boardGroup.add(springMesh(w)); break;
        default: break;
      }
    }

    // golems (positions will be updated by frames)
    const golems = [];
    if (lv.start) golems.push({ id: 'player', color: lv.start.color, r: lv.start.r, c: lv.start.c, dir: lv.start.dir, isPlayer: true });
    lv.bots.forEach((b, i) => golems.push({ id: 'bot' + i, color: b.color, r: b.r, c: b.c, dir: b.dir, isPlayer: false }));
    for (const g of golems) {
      const mesh = golemMesh(g.color, g.isPlayer);
      placeGolem(mesh, g.r, g.c, g.dir, false);
      dynGroup.add(mesh);
      golemMeshes.set(g.id, mesh);
    }

    camState.dist = Math.max(6.5, (maxC - minC + maxR - minR) * 1.5);
    camState.target.set(0, 0.3, 0);
    updateCamera();
  }

  function waterMesh(w) {
    const m = new T.Mesh(new T.BoxGeometry(0.96, 0.06, 0.96), new T.MeshStandardMaterial({ color: 0x2f7fd6, roughness: 0.2, metalness: 0.3, transparent: true, opacity: 0.85 }));
    m.position.set(w.x, 0.02, w.z); m.receiveShadow = true;
    return m;
  }
  function iceMesh(w) {
    const m = new T.Mesh(new T.BoxGeometry(0.92, 0.16, 0.92), new T.MeshStandardMaterial({ color: 0xbfe8ff, roughness: 0.1, metalness: 0.1, transparent: true, opacity: 0.9 }));
    m.position.set(w.x, 0.0, w.z); m.receiveShadow = true;
    return m;
  }
  function wallMesh(w) {
    const g = new T.Group();
    const m = new T.Mesh(new T.BoxGeometry(0.92, 0.6, 0.92), mat(0x8a8f98, { roughness: 0.95 }));
    m.position.set(w.x, 0.2, w.z); m.castShadow = true; m.receiveShadow = true;
    g.add(m);
    return g;
  }
  function portalMesh(w, rot) {
    const g = new T.Group();
    const torus = new T.Mesh(new T.TorusGeometry(0.34, 0.1, 10, 20), new T.MeshStandardMaterial({ color: 0xb04dd8, emissive: 0x4a1568, emissiveIntensity: 0.8, roughness: 0.4 }));
    torus.position.set(w.x, 0.34, w.z); torus.rotation.x = Math.PI / 2;
    g.add(torus);
    return g;
  }
  function goalMesh(w) {
    const g = new T.Group();
    const ring = new T.Mesh(new T.TorusGeometry(0.32, 0.06, 8, 24), new T.MeshStandardMaterial({ color: 0xffd54a, emissive: 0x7a5a00, emissiveIntensity: 0.7 }));
    ring.position.set(w.x, 0.06, w.z); ring.rotation.x = Math.PI / 2;
    g.add(ring);
    const pole = new T.Mesh(new T.CylinderGeometry(0.03, 0.03, 0.7, 8), mat(0xf0f0f0));
    pole.position.set(w.x, 0.35, w.z); g.add(pole);
    const flag = new T.Mesh(new T.PlaneGeometry(0.3, 0.2), new T.MeshStandardMaterial({ color: 0xffd54a, side: T.DoubleSide, emissive: 0x7a5a00, emissiveIntensity: 0.4 }));
    flag.position.set(w.x + 0.16, 0.6, w.z); g.add(flag);
    return g;
  }
  function lineMesh(w, tok) {
    const m = new T.Mesh(new T.BoxGeometry(0.7, 0.04, 0.14), mat(0xe8e0c0, { roughness: 0.6 }));
    m.position.set(w.x, 0.12, w.z);
    m.rotation.y = (tok.rot || 0) * Math.PI / 180;
    return m;
  }
  function springMesh(w) {
    const m = new T.Mesh(new T.CylinderGeometry(0.28, 0.28, 0.1, 12), mat(0xcc7733));
    m.position.set(w.x, 0.06, w.z);
    return m;
  }

  function barrelMesh(floating) {
    const g = new T.Group();
    const body = new T.Mesh(new T.CylinderGeometry(0.3, 0.3, 0.5, 14), mat(0xa9713c, { roughness: 0.8 }));
    body.position.y = 0.25; body.castShadow = true;
    g.add(body);
    for (const y of [0.12, 0.38]) {
      const ring = new T.Mesh(new T.TorusGeometry(0.31, 0.03, 6, 16), mat(0x5c3b1e));
      ring.position.y = y; ring.rotation.x = Math.PI / 2; g.add(ring);
    }
    g.userData.floating = floating;
    return g;
  }

  function golemMesh(color, isPlayer) {
    const g = new T.Group();
    const c = COLORS[color] || 0xcccccc;
    const body = new T.Mesh(new T.CylinderGeometry(0.26, 0.3, 0.5, 12), mat(c, { roughness: 0.5, metalness: 0.25 }));
    body.position.y = 0.35; body.castShadow = true;
    g.add(body);
    const head = new T.Mesh(new T.SphereGeometry(0.22, 14, 12), mat(c, { roughness: 0.4, metalness: 0.3 }));
    head.position.y = 0.72; head.castShadow = true;
    g.add(head);
    // eyes / facing marker
    const nose = new T.Mesh(new T.ConeGeometry(0.08, 0.22, 8), mat(0xffffff));
    nose.rotation.x = Math.PI / 2;
    nose.position.set(0, 0.72, 0.24);
    g.add(nose);
    if (!isPlayer) {
      const flag = new T.Mesh(new T.ConeGeometry(0.07, 0.18, 8), mat(0xff5555));
      flag.position.y = 1.0; g.add(flag);
    }
    return g;
  }

  function placeGolem(mesh, r, c, dir, animate) {
    const w = cellToWorld(r, c);
    if (animate) {
      anims.push({ obj: mesh, from: mesh.position.clone(), to: new T.Vector3(w.x, 0, w.z), t: 0, dur: 0.28, kind: 'pos' });
      const fromRot = mesh.rotation.y;
      let toRot = DIR_YAW[dir] || 0;
      // shortest rotation
      while (toRot - fromRot > Math.PI) toRot -= Math.PI * 2;
      while (toRot - fromRot < -Math.PI) toRot += Math.PI * 2;
      anims.push({ obj: mesh, fromRot, toRot, t: 0, dur: 0.28, kind: 'rot' });
    } else {
      mesh.position.set(w.x, 0, w.z);
      mesh.rotation.y = DIR_YAW[dir] || 0;
    }
  }

  // ---------- frames ----------
  function setFrame(frame, animate) {
    if (!frame) return;
    // golems
    const seen = new Set();
    for (const g of frame.golems) {
      seen.add(g.id);
      const mesh = golemMeshes.get(g.id);
      if (!mesh) continue;
      mesh.visible = true;
      if (animate) placeGolem(mesh, g.r, g.c, g.dir, true);
      else placeGolem(mesh, g.r, g.c, g.dir, false);
      // damage tint
      const t = Math.min(3, g.damage || 0);
      mesh.userData.damage = t;
    }
    for (const [id, mesh] of golemMeshes) if (!seen.has(id)) mesh.visible = false;

    // barrels (rebuilt)
    clearGroup(dynGroupBarrels());
    for (const b of frame.barrels) {
      const w = cellToWorld(b.r, b.c);
      const m = barrelMesh(b.floating);
      m.position.set(w.x, b.floating ? -0.02 : 0, w.z);
      dynGroupBarrels().add(m);
    }

    // events -> effects
    for (const ev of frame.events || []) spawnEffect(ev, frame);
  }

  let _barrelsGroup = null;
  function dynGroupBarrels() { if (!_barrelsGroup) { _barrelsGroup = new T.Group(); dynGroup.add(_barrelsGroup); } return _barrelsGroup; }

  function spawnEffect(ev, frame) {
    if (ev.type === 'attack' || ev.type === 'hit') {
      const p = ev.pos ? cellToWorld(ev.pos[0], ev.pos[1]) : null;
      if (!p) return;
      const ring = new T.Mesh(new T.TorusGeometry(0.2, 0.05, 6, 16), new T.MeshStandardMaterial({ color: 0xff8844, emissive: 0xff4400, emissiveIntensity: 1 }));
      ring.position.set(p.x, 0.5, p.z); ring.rotation.x = Math.PI / 2;
      fxGroup.add(ring);
      effects.push({ obj: ring, t: 0, dur: 0.45, kind: 'pulse' });
    } else if (ev.type === 'break_barrel' || ev.type === 'destroy' || ev.type === 'explode') {
      const p = cellToWorld(ev.pos[0], ev.pos[1]);
      const ring = new T.Mesh(new T.TorusGeometry(0.3, 0.06, 6, 20), new T.MeshStandardMaterial({ color: 0xffcc55, emissive: 0xff8800, emissiveIntensity: 1 }));
      ring.position.set(p.x, 0.3, p.z); ring.rotation.x = Math.PI / 2;
      fxGroup.add(ring);
      effects.push({ obj: ring, t: 0, dur: 0.6, kind: 'pulse' });
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

  // ---------- play a list of frames ----------
  function play(frames, opts) {
    opts = opts || {};
    playQueue = frames.slice();
    playOnDone = opts.onDone || null;
    playSpeed = opts.speed || 1;
    playTimer = 0;
    playing = true;
    setFrame(playQueue[0], false);
  }
  function stop() { playing = false; playQueue = []; playOnDone = null; }

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
      const k = Math.min(1, f.t / f.dur);
      if (f.kind === 'pulse') { f.obj.scale.setScalar(1 + k * 2); f.obj.material.opacity = 1 - k; f.obj.material.transparent = true; }
      else if (f.kind === 'puff') { f.obj.position.y += dt * 1.2; f.obj.material.opacity = 0.9 * (1 - k); }
      if (k >= 1) { fxGroup.remove(f.obj); f.obj.geometry.dispose(); f.obj.material.dispose(); effects.splice(i, 1); }
    }

    // frame playback
    if (playing) {
      playTimer += dt * playSpeed;
      const step = 0.5; // seconds per frame
      if (playTimer >= step) {
        playTimer = 0;
        playQueue.shift();
        if (!playQueue.length) { playing = false; const cb = playOnDone; playOnDone = null; if (cb) cb(); }
        else setFrame(playQueue[0], true);
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

  BG4.Scene3D = { init, setLevel, setFrame, play, stop, resize, dispose, COLORS };
})();
