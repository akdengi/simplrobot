/*
 * game.js — игровой цикл, 3D-сцена, боты, карточная логика боя и HUD.
 *
 * Ключевая идея: Wolfenstein-подобное подземелье, но врага нельзя убить
 * «просто выстрелом». Игрок выбирает Трофей (Камень/Ножницы/Бумага), игра
 * проверяет логическое условие бота и математическую силу команды.
 */
(function () {
  'use strict';
  const KVP = (window.KVP = window.KVP || {});
  const T = window.THREE;
  const UI = KVP.UI;
  const G = (KVP.Game = {});

  const MAX_HP = 100;
  const HAND_LIMIT = 10;
  const PLAYER_RADIUS = 0.26;

  /* На телефоне в портретном режиме 3D-окошко скрыто: карта и карточный
     стол занимают весь экран, а боты 3D-подземелья не стреляют. */
  let mobilePortraitQuery = null;
  function isMobilePortrait() {
    try {
      if (!mobilePortraitQuery && window.matchMedia) {
        mobilePortraitQuery = window.matchMedia('(max-width: 760px) and (orientation: portrait)');
      }
      return !!(mobilePortraitQuery && mobilePortraitQuery.matches);
    } catch (e) {
      return false;
    }
  }

  const S = {
    mode: 'menu',
    settings: null,
    run: null,
    floorSnapshot: null,
    dungeon: null,
    bots: [],
    pickups: [],
    chests: [],
    portal: null,
    projectiles: [],
    cardThrows: [],
    player: null,
    keys: {},
    selectedSlot: -1,
    targetBot: null,
    targetInfo: null,
    interact: null,
    currentRoom: -1,
    floorCleared: false,
    seenTimer: 0,
    flowTimer: 0,
    hudTimer: 0,
    minimapTimer: 0,
    targetTimer: 0,
    stepTimer: 0,
    shake: 0,
    invuln: 0,
    dragonFx: null,
    deckHandIndex: -1,
    deckSelectedKnight: -1,
    modalReturn: 'playing',
    stepAnim: null,
    turnAnim: null,
    autoTurnLock: false,
    _turnBannerTimer: null,
    worldObj: null,
    tokens: [],
    worldBot: null,
    turn: { moved: false, skipped: false, drawn: false, number: 1 },
    pendingTile: null,
    pendingFight: null,
    pendingCard: null,
    pendingDuel: null,
    tutorial: false,
    modalOnClose: null,
    log: [],
    mapView: null,
    mapPanX: 0,
    mapPanZ: 0,
    mapZoom: 1,
    mapDrag: null,
    lastDrawn: null,
    startedAt: 0,
    elapsed: 0,
    lastFrame: 0,
    raf: 0,
    menuTick: 0
  };

  let canvas, renderer, scene, camera, camLight;
  let worldRoot, entityRoot, fxRoot, tokenRoot;
  let clock;
  let gameOverTimer = null;

  /* ================================================================== */
  /*  НАСТРОЙКИ                                                         */
  /* ================================================================== */
  function loadSettings() {
    const s = KVP.storage.get('settings', {});
    return Object.assign({}, KVP.DEFAULT_SETTINGS, s || {});
  }

  G.getSettings = function () { return S.settings; };

  G.saveSettings = function (patch) {
    Object.assign(S.settings, patch || {});
    KVP.storage.set('settings', S.settings);
    KVP.Audio.setVolume(S.settings.volume);
    applyQuality();
  };

  function applyQuality() {
    if (!renderer) return;
    const q = S.settings.quality;
    const pr = q === 'low' ? 0.75 : (q === 'high' ? Math.min(window.devicePixelRatio || 1, 2) : Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.setPixelRatio(pr);
    resize(true);
  }

  /* ================================================================== */
  /*  ИНИЦИАЛИЗАЦИЯ                                                     */
  /* ================================================================== */
  G.init = function () {
    S.settings = loadSettings();
    canvas = document.getElementById('view');
    if (!canvas) return;

    renderer = new T.WebGLRenderer({ canvas: canvas, antialias: true, powerPreference: 'high-performance' });
    renderer.setClearColor(0x0a0910, 1);
    renderer.outputEncoding = T.sRGBEncoding;

    scene = new T.Scene();
    scene.background = new T.Color(0x0a0910);
    scene.fog = new T.Fog(0x0a0910, 5, 22);

    camera = new T.PerspectiveCamera(74, 1.6, 0.04, 60);
    camera.rotation.order = 'YXZ';
    camera.position.set(0, KVP.M3.EYE, 0);
    scene.add(camera);

    scene.add(new T.AmbientLight(0x8d819c, 0.5));
    const hemi = new T.HemisphereLight(0x9d8bb8, 0x261b16, 0.6);
    hemi.position.set(0, 1, 0);
    scene.add(hemi);
    const dir = new T.DirectionalLight(0xffc890, 0.22);
    dir.position.set(0.4, 1, 0.2);
    scene.add(dir);

    camLight = new T.PointLight(0xffb066, 1.05, 9, 2);
    camLight.position.set(0, 0.05, 0);
    camera.add(camLight);

    worldRoot = new T.Group(); scene.add(worldRoot);
    entityRoot = new T.Group(); scene.add(entityRoot);
    fxRoot = new T.Group(); scene.add(fxRoot);
    tokenRoot = new T.Group(); scene.add(tokenRoot);

    clock = new T.Clock();

    KVP.Audio.setVolume(S.settings.volume);
    bindInput();
    bindButtons();
    window.addEventListener('resize', function () { resize(); fitTableau(); });
    document.addEventListener('visibilitychange', function () {
      if (document.hidden && S.mode === 'playing') pauseGame();
    });
    applyQuality();
    loop();
  };

  /* 3D-вид живёт в маленьком окошке (#view внутри .viewport),
     поэтому размер буфера берём из размеров самого canvas-элемента. */
  let vpW = -1, vpH = -1;
  function resize(force) {
    if (!renderer || !camera || !canvas) return;
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return;                     /* скрыт (меню) — держим прежний размер */
    if (!force && w === vpW && h === vpH) return;
    vpW = w; vpH = h;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);
  }

  /* ================================================================== */
  /*  ЭКРАНЫ И РЕЖИМЫ                                                   */
  /* ================================================================== */
  function el(id) { return document.getElementById(id); }
  function show(id) { const e = el(id); if (e) e.classList.remove('hidden'); }
  function hide(id) { const e = el(id); if (e) e.classList.add('hidden'); }

  function logEvent(text) {
    if (!S.log) S.log = [];
    S.log.unshift(text);
    if (S.log.length > 8) S.log.length = 8;
    renderLog();
  }
  S.logEvent = logEvent;

  function renderLog() {
    const host = el('log');
    if (!host) return;
    if (!S.log || !S.log.length) {
      host.innerHTML = '<div class="muted">Выберите проход и кликните по комнате перехода — начнётся исследование.</div>';
      return;
    }
    host.innerHTML = S.log.slice(0, 6).map(function (t) {
      return '<div>' + t + '</div>';
    }).join('');
  }

  function hideGameScreens() {
    ['screen-floor', 'screen-pause', 'screen-modal',
      'screen-tutorial', 'screen-gameover', 'screen-victory', 'screen-floorclear'].forEach(hide);
  }

  function setMode(m) {
    S.mode = m;
    document.body.setAttribute('data-mode', m);
  }

  function requestLock() {
    /* 3D-окно не управляется мышью — захват курсора не нужен. */
  }

  function exitLock() {
    if (document.pointerLockElement) {
      try { document.exitPointerLock(); } catch (e) { /* ignore */ }
    }
  }

  function enterPlay() {
    if (!S.run) return;
    hideGameScreens();
    hide('screen-menu');
    show('hud');
    resize(true);
    setMode('playing');
    requestLock();
    KVP.Audio.resume();
    updateTable();
    updateTurnBar();
  }

  function pauseGame() {
    if (S.mode !== 'playing') return;
    setMode('paused');
    show('screen-pause');
    exitLock();
    fillPause();
  }

  function cancelGameOverTimer() {
    if (gameOverTimer) {
      clearTimeout(gameOverTimer);
      gameOverTimer = null;
    }
  }

  function scheduleGameOver(delay) {
    cancelGameOverTimer();
    gameOverTimer = setTimeout(function () {
      gameOverTimer = null;
      gameOver();
    }, delay || 400);
  }

  function fillPause() {
    if (!S.run) return;
    const p = el('pause-stats');
    if (p) {
      p.innerHTML = '<span>💰 ' + S.run.gold + '</span>' +
        '<span>⚔ Сила команды: ' + teamTotalPower() + ' (Рыцари ' + teamPower() + ' + Трофеи ' + teamTrophyPower() + ')</span>' +
        '<span>🎴 В колоде: ' + (S.run.deck ? S.run.deck.length : 0) + '</span>' +
        '<span>🗺 Карт Местности: ' + (S.run.map ? S.run.map.length : 1) + '</span>' +
        '<span>⏱ ' + KVP.formatTime(S.run.stats.time) + '</span>';
    }
  }

  /* Сводка (бывший экран по Tab) живёт всегда в сайдбаре: здесь только
     обновляем её и подсвечиваем — отдельное окно больше не нужно. */
  function openDeck() {
    if (!S.run) return;
    renderDeck();
    const box = el('side-summary');
    if (box && box.animate) {
      box.animate([
        { boxShadow: '0 0 0 rgba(242, 205, 107, 0)' },
        { boxShadow: '0 0 22px rgba(242, 205, 107, .55)' },
        { boxShadow: '0 0 0 rgba(242, 205, 107, 0)' }
      ], { duration: 700, easing: 'ease-out' });
    }
  }

  function closeDeck() {
    S.deckHandIndex = -1;
    enterPlay();
  }

  /**
   * Показать модальное окно. ownActions = true — если в теле окна уже есть
   * свои кнопки (например «Завершить дуэль»), универсальная «Продолжить»
   * в подвале прячется, чтобы не было двух кнопок подряд.
   */
  function showModal(title, html, returnMode, ownActions) {
    S.modalReturn = returnMode ||
      (S.mode === 'playing' ? 'playing' : (S.mode === 'paused' ? 'paused' : 'playing'));
    /* Старый защитник закрытия не должен висеть на новом окне:
       вызывающий сам поставит нужный сразу после showModal. */
    S.modalOnClose = null;
    const t = el('modal-title'), b = el('modal-body');
    if (t) t.innerHTML = title;
    if (b) b.innerHTML = html;
    const close = el('btn-modal-close');
    if (close) {
      close.classList.toggle('hidden', !!ownActions);
      close.textContent = ownActions ? '' : 'Продолжить';
    }
    hideGameScreens();
    show('screen-modal');
    setMode('modal');
    exitLock();
  }

  function closeModal() {
    if (S.modalOnClose) {
      const fn = S.modalOnClose;
      S.modalOnClose = null;
      fn();
      return;
    }
    const back = (S.modalReturn && S.modalReturn !== 'modal') ? S.modalReturn : 'playing';
    if (back === 'playing') {
      enterPlay();
    } else if (back === 'paused') {
      hide('screen-modal');
      setMode('paused');
      show('screen-pause');
    } else {
      hide('screen-modal');
      setMode(back);
    }
  }

  G.pause = pauseGame;
  G.resume = enterPlay;
  G.showModal = showModal;

  /* ================================================================== */
  /*  НОВАЯ ИГРА / ЭТАЖ                                                  */
  /* ================================================================== */
  G.newGame = function (difficulty) {
    const diff = difficulty || S.settings.difficulty || 'normal';
    const run = {
      version: KVP.VERSION,
      seed: (Date.now() ^ Math.floor(Math.random() * 1e9)) >>> 0,
      floorIndex: 0,
      difficulty: diff,
      hp: MAX_HP,
      maxHp: MAX_HP,
      gold: 0,
      team: [],
      hand: [],
      cells: 0,
      stats: emptyStats()
    };
    // Команда по правилам: Лёгкая 5 Рыцарей, Средняя 4, Сложная 3, Экстрим 2.
    const setup = {
      easy: [['swordsman', 'scissors'], ['maceman', 'rock'], ['archer', 'scissors'], ['cook', null], ['cook', null]],
      normal: [['swordsman', 'scissors'], ['maceman', 'rock'], ['archer', null], ['cook', null]],
      hard: [['swordsman', 'rock'], ['maceman', null], ['archer', null]],
      extreme: [['swordsman', null], ['archer', null]]
    }[diff] || [['swordsman', 'scissors'], ['maceman', 'rock'], ['archer', null], ['cook', null]];
    setup.forEach(function (pair) {
      const k = KVP.newKnight(pair[0]);
      if (pair[1]) k.trophy = KVP.newTrophy(pair[1]);
      run.team.push(k);
    });
    S.run = run;
    startFloor(0, run);
  };

  function emptyStats() {
    return {
      botGold: 0, treasure: 0, kills: 0, shots: 0, hits: 0,
      time: 0, papersBurned: 0, cellsUsed: 0, dragonsUsed: 0,
      byType: {}
    };
  }

  function cloneRun(run) {
    return JSON.parse(JSON.stringify(run));
  }

  function loadSavedRun() {
    const save = KVP.storage.get('save', null);
    if (!save || !save.run) return null;
    const run = save.run;
    run.stats = Object.assign(emptyStats(), run.stats || {});
    run.maxHp = run.maxHp || MAX_HP;
    run.hp = Math.max(20, Math.min(run.maxHp, run.hp || MAX_HP));
    return run;
  }

  function setPlayingActive(v) {
    KVP.storage.set('active', !!v);
  }

  G.continueGame = function () {
    const run = loadSavedRun();
    if (!run) return false;
    S.run = run;
    startFloor(run.floorIndex || 0, run);
    return true;
  };

  /* После перезагрузки страницы продолжаем игру сразу, если игрок
     не выходил в главное меню. Флаг сбрасывается только кнопкой
     «Завершить игру» и на экранах поражения/победы. */
  G.autoResume = function () {
    /* Для старых сохранений флага ещё нет — считаем, что игра активна. */
    if (KVP.storage.get('active', null) === false) return false;
    const run = loadSavedRun();
    if (!run) { setPlayingActive(false); return false; }
    S.run = run;
    startFloor(run.floorIndex || 0, run);
    enterPlay();
    return true;
  };

  G.hasSave = function () {
    const save = KVP.storage.get('save', null);
    return !!(save && save.run);
  };

  G.getSaveInfo = function () {
    const save = KVP.storage.get('save', null);
    if (!save || !save.run) return null;
    return save.run;
  };

  function saveRun() {
    if (!S.run) return;
    S.run.turn = S.turn;   /* порядок действий хода тоже переживает сохранение */
    KVP.storage.set('save', { version: KVP.VERSION, savedAt: Date.now(), run: S.run });
    if (KVP.Menu && KVP.Menu.refresh) KVP.Menu.refresh();
  }
  G.save = saveRun;

  function startFloor(index, run) {
    if (!run) return;
    cancelGameOverTimer();
    setPlayingActive(true);
    run.floorIndex = index || 0;
    S.run = run;
    run.stats = Object.assign(emptyStats(), run.stats || {});
    S.floorSeed = (run.seed || 1) >>> 0;

    clearFloorWorld();

    S.dungeon = KVP.createLabyrinth(S.floorSeed);

    // Продолжение сохранения: восстанавливаем уже пристроенные карты.
    if (run.map && run.map.length > 1) {
      for (let i = 1; i < run.map.length; i++) {
        const t = run.map[i];
        S.dungeon.placeTile(t.cardId, t.gx, t.gz, t.rot || 0);
      }
    } else {
      const st0 = S.dungeon.rooms[0];
      run.map = [{ cardId: KVP.START_TILE.id, gx: st0.gx, gz: st0.gz, rot: 0 }];
    }

    if (!run.deck) run.deck = [];
    if (run.deck.length === 0 && !run.started) {
      run.deck = KVP.shuffleDeck(KVP.buildDeck(run.difficulty || 'normal'), new KVP.RNG(S.floorSeed ^ 0x9e3779b9));
    } else {
      /* Совместимость со старыми сохранениями: карта Местности с Сундуком
         теперь лежит в колоде (последней картой) — до неё надо дойти. */
      let chestAt = -1;
      for (let i = 0; i < run.deck.length; i++) {
        if (run.deck[i].kind === 'tile' && run.deck[i].itemType === KVP.CHEST_TILE.id) { chestAt = i; break; }
      }
      if (chestAt < 0) {
        run.deck.push({ id: 'c-chest', kind: 'tile', itemType: KVP.CHEST_TILE.id });
      } else {
        const ch = run.deck.splice(chestAt, 1)[0];
        run.deck.push(ch);           /* Сундук — всегда последняя карта колоды */
      }
    }
    run.started = true;
    if (!run.botHand) run.botHand = [];
    if (!run.wins) run.wins = [];
    if (run.map && run.map.some(function (t) { return t.cardId === KVP.CHEST_TILE.id; })) {
      run.chestPlaced = true;
    }

    S.worldObj = KVP.M3.buildWorld(worldRoot, S.dungeon);

    refreshTokens();

    S.bots = [];
    S.pickups = [];
    S.chests = [];
    S.projectiles = [];
    S.cardThrows = [];
    S.portal = null;
    S.floorCleared = false;
    S.dragonFx = null;
    S.selectedSlot = -1;
    S.shake = 0;
    S.stepAnim = null;
    S.turn = (function () {
      const t = run.turn && typeof run.turn === 'object' ? run.turn : null;
      return {
        moved: !!(t && t.moved),
        skipped: !!(t && t.skipped),
        drawn: !!(t && t.drawn),
        number: (t && t.number) || 1
      };
    })();
    S.pendingTile = null;
    S.pendingFight = null;
    S.pendingDuel = null;
    S.pendingCard = null;
    S.fightSel = [];
    S.fightLossPick = [];
    S.fightError = '';
    S.modalOnClose = null;
    S.lastDrawn = null;
    S.deckHandIndex = -1;
    // карта, вытянутая и оставленная на столе, переживает сохранение
    if (run.pendingCard) {
      S.pendingCard = run.pendingCard;
      S.turn.drawn = true;
      showDrawnCard(S.pendingCard, true);
    }
    S.log = [];
    renderLog();

    for (let i = 0; i < S.dungeon.rooms.length; i++) {
      if (S.dungeon.rooms[i].type === 'chest') placeChestForTile(S.dungeon.rooms[i]);
    }

    let startTile = S.dungeon.rooms[0];
    let startYaw = Math.PI;
    if (run.lastTile) {
      const lt = S.dungeon.tileAt(run.lastTile.gx, run.lastTile.gz);
      if (lt) {
        startTile = lt;
        startYaw = run.lastTile.yaw != null ? run.lastTile.yaw : Math.PI;
      }
    }
    const c = S.dungeon.center(startTile);
    S.player = {
      x: c.x, z: c.y, yaw: startYaw, pitch: 0,
      hp: Math.max(1, Math.min(run.maxHp || MAX_HP, run.hp || MAX_HP)),
      radius: PLAYER_RADIUS,
      walkPhase: 0,
      cooldown: 0,
      moving: false
    };
    S.invuln = 0;
    S.currentRoom = startTile.id;
    startTile.discovered = true;
    startTile.entered = true;

    S.selectedSlot = firstUsableSlot();
    syncRunHp();
    updateHUD();
    drawMinimap(true);

    S.floorSnapshot = cloneRun(run);
    saveRun();

    fillFloorIntro(0);
    hideGameScreens();
    show('hud');
    resize(true);
    show('screen-floor');
    setMode('floor-intro');
    exitLock();
  }

  function clearFloorWorld() {
    [worldRoot, entityRoot, fxRoot, tokenRoot].forEach(function (root) {
      if (!root) return;
      while (root.children.length) {
        const c = root.children[root.children.length - 1];
        root.remove(c);
      }
    });
    S.projectiles = [];
    S.cardThrows = [];
    S.bots = [];
    S.pickups = [];
    S.chests = [];
    S.portal = null;
    S.worldObj = null;
    S.tokens = [];
    S.worldBot = null;
  }

  function fillFloorIntro(index) {
    const diff = KVP.DIFFICULTY[S.run.difficulty] || KVP.DIFFICULTY.normal;
    const set = function (id, text) { const e = el(id); if (e) e.innerHTML = text; };
    set('floor-kicker', 'СОЛО-ПОХОД · ' + diff.icon + ' ' + KVP.escapeHtml(diff.name));
    set('floor-title', '🏰 Лабиринт карт Местности');
    set('floor-sub', 'Каждая карта Местности — прямоугольник 2:1 (комната 7×16, длинная сторона сверху-снизу). Проход между картами есть только там, где стрелки на обеих картах смотрят друг на друга. Вытянутую карту Местности вы сами пристраиваете к лабиринту (повернуть можно только на 180°).');
    set('floor-hint', isMobilePortrait()
      ? 'Мобильный режим: 3D отключено. Переход — <b>тап по комнате перехода на карте лабиринта</b> (только через проход). Карту берите тапом по <b>колоде</b>. Вытянутую карту Местности пристраивайте к лабиринту — клетка выбирается на карте.'
      : 'Переход — <b>кликните по комнате перехода мышкой</b> на карте лабиринта (только через проход), поворот взгляда — клик по краю своей комнаты или по компасу. Карту берите кликом по <b>колоде</b> (клавиша T). Вытянутую карту Местности пристраивайте к лабиринту — клетка выбирается на карте.');
    set('floor-objective', 'Исследуйте лабиринт: пристраивайте карты Местности. Когда колода опустеет или вы выложите <b>8 карт Местности</b>, появится <b>Сундук</b> — дойдите до него.');
    set('floor-loadout',
      '<div class="loadout-team">' + teamMiniHTML() + '</div>' +
      '<div class="loadout-cards">' + loadoutMiniHTML() + '</div>');
    const btn = el('btn-enter-dungeon');
    if (btn) btn.textContent = '⚔ Войти в лабиринт';
  }

  function teamMiniHTML() {
    return S.run.team.filter(function (k) { return k.alive; }).map(function (k) {
      return '<span class="mini-team">' + k.icon + ' ' + KVP.escapeHtml(k.name) +
        (k.trophy ? '<i>⚔ ' + KVP.escapeHtml(KVP.TROPHIES[k.trophy.type].name) + '</i>' : '<i>пусто</i>') + '</span>';
    }).join('');
  }

  function loadoutMiniHTML() {
    const counts = { rock: 0, scissors: 0, paper: 0 };
    S.run.team.forEach(function (k) { if (k.alive && k.trophy) counts[k.trophy.type]++; });
    S.run.hand.forEach(function (t) { counts[t.type]++; });
    return KVP.TROPHY_LIST.map(function (t) {
      return '<span class="mini-loot theme-' + t + '">' + KVP.SVG.trophy(t) + '<b>' + counts[t] + '</b></span>';
    }).join('') +
      '<span class="mini-extra">🪤 ' + S.run.cells + '</span>' +
      '<span class="mini-extra">💰 ' + S.run.gold + '</span>';
  }

  G.enterFloor = function () { enterPlay(); };

  G.nextFloor = function () {
    if (!S.run) return;
    S.run.floorIndex++;
    if (S.run.floorIndex >= KVP.FLOORS.length) { showVictory(); return; }
    S.run.hp = Math.min(S.run.maxHp, S.run.hp + 30);
    startFloor(S.run.floorIndex, S.run);
  };

  G.restartFloor = function () {
    cancelGameOverTimer();
    hideGameScreens();
    if (!S.floorSnapshot) {
      /* Страховка: если снимок этажа потерян, начинаем забег заново. */
      G.newGame(S.run ? S.run.difficulty : 'normal');
      return;
    }
    const snap = cloneRun(S.floorSnapshot);
    snap.floorIndex = S.run ? S.run.floorIndex : 0;
    S.run = snap;
    startFloor(snap.floorIndex, snap);
  };

  G.toMenu = function () {
    cancelGameOverTimer();
    setPlayingActive(false);
    exitLock();
    hideGameScreens();
    hide('hud');
    show('screen-menu');
    setMode('menu');
    if (KVP.Menu && KVP.Menu.refresh) KVP.Menu.refresh();
  };

  function trophyColor(type) {
    if (type === 'rock') return 0x7fd18b;
    if (type === 'scissors') return 0xff8b7e;
    return 0x9cc9ff;
  }

  /* ================================================================== */
  /*  ВВОД                                                              */
  /* ================================================================== */
  /*  3D-окно — чистая визуализация состояния: игрок не ходит и не
      оборачивается мышью. Камера сама следует за рыцарем, а поворот
      делается кликом по мини-карте или по компасу.                      */
  function bindInput() {
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('keyup', function (e) { S.keys[e.code] = false; });
    canvas.addEventListener('contextmenu', function (e) { e.preventDefault(); });
  }

  function onKeyDown(e) {
    const tag = (e.target && e.target.tagName) || '';
    if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;

    if (e.code === 'Escape') {
      if (S.mode === 'playing') { e.preventDefault(); pauseGame(); }
      else if (S.mode === 'paused') { e.preventDefault(); enterPlay(); }
      else if (S.mode === 'modal') { e.preventDefault(); closeModal(); }
      else if (S.mode === 'tutorial') { e.preventDefault(); closeTutorial(); }
      return;
    }
    if (S.mode === 'tutorial') {
      if (e.code === 'Enter' || e.code === 'Space' || e.code === 'NumpadEnter') { e.preventDefault(); tutNext(); }
      return;
    }
    if (S.mode !== 'playing') return;

    S.keys[e.code] = true;

    if (e.code === 'Space' || e.code === 'Enter' || e.code === 'NumpadEnter') {
      e.preventDefault();
      if (!e.repeat) endTurn();
      return;
    }
    if (e.code === 'KeyT') {
      e.preventDefault();
      if (!e.repeat) drawFromDeck();
      return;
    }

    if (e.code.indexOf('Digit') === 0) {
      const n = parseInt(e.code.slice(5), 10) - 1;
      selectWeaponSlot(n);
    } else if (e.code === 'KeyE') {
      interact();
    } else if (e.code === 'KeyF') {
      useCell();
    } else if (e.code === 'KeyH') {
      if (KVP.Menu && KVP.Menu.openHelp) { pauseGame(); KVP.Menu.openHelp('paused'); }
    } else if (e.code === 'KeyW' || e.code === 'ArrowUp') {
      if (!e.repeat) { e.preventDefault(); tryStep(); }
    } else if (e.code === 'KeyA' || e.code === 'ArrowLeft') {
      if (!e.repeat) { e.preventDefault(); tryStep('left'); }
    } else if (e.code === 'KeyS' || e.code === 'ArrowDown') {
      if (!e.repeat) { e.preventDefault(); tryStep('back'); }
    } else if (e.code === 'KeyD' || e.code === 'ArrowRight') {
      if (!e.repeat) { e.preventDefault(); tryStep('right'); }
    }
    if (e.code === 'Space') {
      e.preventDefault();
    }
  }

  function bindButtons() {
    const on = function (id, fn) {
      const e = el(id);
      if (e) e.addEventListener('click', function (ev) { ev.preventDefault(); fn(ev); });
    };
    on('btn-enter-dungeon', function () { enterPlay(); maybeShowTutorial(); });
    on('btn-end-turn', endTurn);
    on('btn-end-game', pauseGame);
    on('btn-pause-resume', enterPlay);
    on('btn-pause-restart', function () { hide('screen-pause'); G.restartFloor(); });
    on('btn-pause-menu', function () { G.toMenu(); });
    on('btn-pause-help', function () { if (KVP.Menu) KVP.Menu.openHelp('paused'); });
    on('btn-modal-close', closeModal);
    on('btn-floorclear-next', G.nextFloor);
    on('btn-gameover-retry', function () { hide('screen-gameover'); G.restartFloor(); });
    on('btn-gameover-menu', G.toMenu);
    on('btn-victory-again', function () { hide('screen-victory'); if (KVP.Menu) KVP.Menu.newGame(); });
    on('btn-victory-menu', G.toMenu);
    on('deck-pile', function () { drawFromDeck(); });
    on('place-ok', confirmPlace);
    on('place-cancel', cancelPlace);
    on('place-rot-l', function () { rotatePending(-1); });
    on('place-rot-r', function () { rotatePending(1); });

    const minimap = el('minimap');
    if (minimap) {
      minimap.addEventListener('click', onMinimapClick);
      minimap.addEventListener('pointermove', onMinimapHover);
      minimap.addEventListener('pointerleave', function () {
        minimap.style.cursor = '';
      });
      /* Панорамирование мышью: тяните карту, чтобы осмотреть соседей. */
      minimap.addEventListener('pointerdown', function (ev) {
        if (S.pendingTile) return;                 // в режиме раскладки карта не панорамируется
        S.mapDrag = { x: ev.clientX, y: ev.clientY, px: S.mapPanX || 0, pz: S.mapPanZ || 0, moved: false };
        minimap.setPointerCapture && minimap.setPointerCapture(ev.pointerId);
      });
      minimap.addEventListener('pointermove', function (ev) {
        const d = S.mapDrag;
        if (!d) return;
        const dx = ev.clientX - d.x, dy = ev.clientY - d.y;
        if (Math.abs(dx) > 3 || Math.abs(dy) > 3) d.moved = true;
        const v = S.mapView;
        if (!v || !v.cell) return;
        const cw = v.cellW || v.cell, ch = v.cellH || v.cell;
        S.mapPanX = d.px - dx / cw;
        S.mapPanZ = d.pz - dy / ch;
        drawMinimap(true);
      });
      const endDrag = function (ev) {
        if (!S.mapDrag) return;
        const moved = S.mapDrag.moved;
        S.mapDrag = null;
        if (moved) {
          /* Клик после перетаскивания — не шаг. */
          suppressClickUntil = Date.now() + 350;
        }
      };
      minimap.addEventListener('pointerup', endDrag);
      minimap.addEventListener('pointercancel', endDrag);
    }
    /* Масштабирование мини-карты колесиком мыши (zoom) и dblclick для сброса. */
    const onWheel = function (ev) {
      ev.preventDefault();
      if (S.mode !== 'playing') return;
      const delta = ev.deltaY > 0 ? -1 : 1;
      S.mapZoom = Math.max(0.5, Math.min(3.0, (S.mapZoom || 1) + delta * 0.15));
      if (S.mapZoom < 0.55) S.mapZoom = 0.5;
      drawMinimap(true);
    };
    minimap.onwheel = onWheel;
    /* dblclick — сброс zoom + pan. */
    minimap.ondblclick = function () {
      S.mapPanX = 0; S.mapPanZ = 0; S.mapZoom = 1;
      drawMinimap(true);
    };
    const compass = el('compass');
    if (compass) {
      compass.addEventListener('click', onCompassClick);
      compass.style.cursor = 'pointer';
      compass.title = 'Клик по стороне — повернуть взгляд';
    }
    const placeDirs = el('place-dirs');
    if (placeDirs) {
      placeDirs.addEventListener('click', function (e) {
        const b = e.target.closest('[data-cand]');
        if (b) selectCandidate(parseInt(b.getAttribute('data-cand'), 10));
      });
    }
    const handBar = el('hand-bar');
    if (handBar) {
      handBar.addEventListener('click', function (e) {
        /* Спецпредмет (Клетка) — применить выбранным Рыцарем. */
        const item = e.target.closest('[data-item]');
        if (item) {
          const itemId = item.getAttribute('data-item');
          let islot = S.selectedSlot;
          if (islot < 0 || !S.run.team[islot] || !S.run.team[islot].alive) islot = firstUsableSlot();
          if (islot < 0) { UI.toast('Применить некому — в команде нет живых Рыцарей.', 'bad'); return; }
          useItemOn(S.run.team[islot], itemId);
          return;
        }
        /* Трофей — снарядить выбранного Рыцаря. */
        const c = e.target.closest('[data-hand]');
        if (!c) return;
        const hi = parseInt(c.getAttribute('data-hand'), 10);
        let slot = S.selectedSlot;
        if (slot < 0) slot = firstUsableSlot();
        if (slot < 0) { UI.toast('Снаряжать некому — в команде нет живых Рыцарей.', 'bad'); return; }
        equipFromHand(hi, slot);
      });
    }

    const cardsBar = el('cards-bar');
    if (cardsBar) {
      cardsBar.addEventListener('click', function (e) {
        const card = e.target.closest('[data-slot]');
        if (card) selectWeaponSlot(parseInt(card.getAttribute('data-slot'), 10), true);
      });
    }

    // Клик по вытянутой карте на столе — применить её.
    const reveal = el('deck-reveal');
    if (reveal) {
      reveal.addEventListener('click', function () {
        if (Date.now() < suppressClickUntil) return;
        if (!S.pendingCard) return;
        applyPendingCard(null, false);
      });
    }

    on('btn-tut-next', tutNext);
    on('btn-tut-skip', function () { closeTutorial(true); });
    initDragAndDrop();
  }

  /* ================================================================== */
  /*  ПЕРЕТАСКИВАНИЕ КАРТ: «ТЯНУ И КЛАДУ», КАК НАСТОЯЩИМИ              */
  /* ================================================================== */
  const DRAG_THRESH = 6;
  let drag = null;
  let suppressClickUntil = 0;
  let statSec = -1;               /* последняя секунда, показанная в сводке */

  function knightFromSlotNode(node) {
    if (!node) return null;
    const idx = parseInt(node.getAttribute('data-slot'), 10);
    if (isNaN(idx) || !S.run || !S.run.team[idx]) return null;
    return { idx: idx, k: S.run.team[idx] };
  }

  /** Что тащим, куда можно бросить и что из этого получится. */
  function dragPayload(src) {
    if (S.mode !== 'playing' || !S.run) return null;
    const kind = src.getAttribute('data-drag');

    /* Колоду больше не тянут — карту берут простым нажатием (см. bindButtons). */

    if (kind === 'item') {
      const itemId = src.getAttribute('data-item');
      if (itemId !== 'cell' && itemId !== 'dragon') return null;
      return {
        html: '<div class="ghost-card">' + UI.special(itemId, { compact: true }) + '</div>',
        sel: '.tb-slot[data-slot]',
        valid: function (t) {
          const s = knightFromSlotNode(t);
          return !!(s && s.k.alive);
        },
        drop: function (t) {
          const s = knightFromSlotNode(t);
          if (!s) return;
          useItemOn(s.k, itemId);
        },
        invalid: function () {
          UI.toast('Предмет применяет живой Рыцарь из расклада.', 'info', 2200);
        }
      };
    }

    if (kind === 'hand') {
      const hi = parseInt(src.getAttribute('data-hand'), 10);
      if (isNaN(hi) || !S.run.hand[hi]) return null;
      const card = S.run.hand[hi];
      return {
        html: '<div class="ghost-card">' + UI.trophy(card.type, { compact: true }) + '</div>',
        sel: '.tb-slot[data-slot]',
        valid: function (t) {
          const s = knightFromSlotNode(t);
          if (!s || !s.k.alive) return false;
          if (s.k.type === 'mag') return card.type === 'paper';
          return true;
        },
        drop: function (t) {
          const s = knightFromSlotNode(t);
          if (!s) return;
          equipFromHand(hi, s.idx);
          S.selectedSlot = s.idx;
          KVP.Audio.play('pickup');
          UI.toast('🃏 <b>' + KVP.escapeHtml(KVP.TROPHIES[card.type].name) + '</b> → ' +
            KVP.escapeHtml(s.k.name) + '.', 'good', 1800);
          S.logEvent('🃏 ' + KVP.TROPHIES[card.type].name + ' → ' + s.k.name + '.');
          saveRun();
        },
        invalid: function () {
          UI.toast(S.run.team.some(function (k) { return k.alive && k.type !== 'mag'; })
            ? 'Маг не носит Трофеи — бросьте карту на другого Рыцаря.'
            : 'Снаряжать некого — в команде нет живых Рыцарей.', 'info', 2400);
        }
      };
    }

    if (kind === 'chip') {
      const host = src.closest('.tb-slot');
      const s = knightFromSlotNode(host);
      if (!s || !s.k.alive || !s.k.trophy) return null;
      const card = s.k.trophy;
      return {
        html: UI.trophyCard(card.type, {}),
        w: Math.max(64, Math.round(src.getBoundingClientRect().width || 140)),
        sel: '.tb-slot[data-slot], #hand-bar',
        valid: function (t) {
          if (t.id === 'hand-bar') return S.run.hand.length < HAND_LIMIT;
          const to = knightFromSlotNode(t);
          return !!(to && to.k.alive && to.k.type !== 'mag' && to.idx !== s.idx);
        },
        drop: function (t) {
          if (t.id === 'hand-bar') {
            unequipFromKnight(s.idx);
            UI.toast('🏆 ' + KVP.escapeHtml(KVP.TROPHIES[card.type].name) + ' снят и убран в руку.', 'good', 1800);
            S.logEvent('🏆 ' + KVP.TROPHIES[card.type].name + ' → рука.');
            saveRun();
            return;
          }
          const to = knightFromSlotNode(t);
          if (!to) return;
          const a = s.k, b = to.k;
          const fromA = a.trophy;   /* тащимый Трофей (card) */
          const fromB = b.trophy;   /* что было у второго Рыцаря */
          a.trophy = fromB;
          b.trophy = fromA;
          S.selectedSlot = to.idx;
          KVP.Audio.play('card');
          UI.toast('🔄 ' + KVP.escapeHtml(KVP.TROPHIES[card.type].name) + ' → ' +
            KVP.escapeHtml(b.name) + (fromB ? ', а ' + KVP.escapeHtml(KVP.TROPHIES[fromB.type].name) + ' → ' + KVP.escapeHtml(a.name) : '') + '.',
            'good', 2200);
          S.logEvent('🔄 Трофей → ' + b.name + '.');
          updateHUD(); renderDeck(); saveRun();
        },
        invalid: function () {
          UI.toast('Переложить можно только на живого Рыцаря (кроме Мага) или в руку.', 'info', 2400);
        }
      };
    }

    if (kind === 'reveal') {
      const card = S.pendingCard;
      const rv = el('deck-reveal');
      if (!card || !rv) return null;
      const clone = rv.cloneNode(true);
      clone.removeAttribute('id');
      clone.removeAttribute('data-drag');
      clone.classList.remove('pending', 'flash', 'pop', 'empty', 'drop-ok');
      const act = clone.querySelector('.rv-act');
      if (act && act.parentNode) act.parentNode.removeChild(act);
      return {
        html: clone.outerHTML,
        w: rv.offsetWidth || 98,
        sel: '.tb-slot[data-slot], #hand-bar',
        valid: function (t) {
          if (t.id === 'hand-bar') return card.kind === 'trophy' && S.run.hand.length < HAND_LIMIT;
          const s = knightFromSlotNode(t);
          if (!s || !s.k.alive || s.k.type === 'mag') return false;
          /* Трофей можно бросить, если старый есть куда положить */
          if (card.kind === 'trophy') return !s.k.trophy || S.run.hand.length < HAND_LIMIT;
          if (card.kind === 'bot') return !!s.k.trophy;
          return false;
        },
        drop: function (t) {
          if (t.id === 'hand-bar') { applyPendingCard(null, true); return; }
          const s = knightFromSlotNode(t);
          if (!s) return;
          applyPendingCard(s.idx);
        },
        invalid: function (t) {
          const s = knightFromSlotNode(t);
          if (card.kind === 'trophy' && s && s.k.trophy && S.run.hand.length >= HAND_LIMIT) {
            UI.toast('Рука полна (макс. ' + HAND_LIMIT + ') — старый Трофей некуда положить.', 'info', 2400);
          } else if (card.kind === 'trophy') {
            UI.toast('Трофей кладут в зону руки или на Рыцаря — Маг Трофеи не носит.', 'info', 2400);
          } else if (card.kind === 'bot') {
            UI.toast(s && !s.k.trophy
              ? 'У Рыцаря нет Трофея — нечем бить. Клик по карте откроет бой.'
              : 'Бросьте карту бота на Рыцаря с Трофеем — или кликните по карте.', 'info', 2600);
          } else if (card.kind === 'knight') {
            UI.toast('Карту Рыцаря в команду не берут: клик по карте — и соперник станет жетоном врага на вашей карте Местности.', 'info', 3200);
          } else {
            UI.toast('Эту карту применяют обычным кликом по ней.', 'info', 2200);
          }
        }
      };
    }
    return null;
  }

  function positionGhost(x, y) {
    if (!drag || !drag.ghost) return;
    drag.ghost.style.left = x + 'px';
    drag.ghost.style.top = y + 'px';
  }

  function hitElement(x, y) {
    const n = document.elementFromPoint(x, y);
    if (!n || !n.closest) return null;
    return n.closest(drag.p.sel);
  }

  function startGhost(ev) {
    drag.started = true;
    document.body.classList.add('is-dragging');
    const g = document.createElement('div');
    g.className = 'drag-ghost';
    g.innerHTML = drag.p.html;
    if (drag.p.w) g.style.width = drag.p.w + 'px';
    document.body.appendChild(g);
    drag.ghost = g;
    drag.src.classList.add('drag-src');
    drag.cands = [].slice.call(document.querySelectorAll(drag.p.sel));
    drag.cands.forEach(function (n) { n.classList.add('drop-cand'); });
    positionGhost(ev.clientX, ev.clientY);
  }

  function onDragDown(ev) {
    if (ev.button && ev.button !== 0) return;
    if (drag) return;
    const src = ev.target && ev.target.closest ? ev.target.closest('[data-drag]') : null;
    if (!src) return;
    const payload = dragPayload(src);
    if (!payload) return;
    drag = {
      p: payload, src: src, rect: src.getBoundingClientRect(),
      x0: ev.clientX, y0: ev.clientY,
      started: false, hit: null, hitEl: null, ghost: null, cands: []
    };
    document.addEventListener('pointermove', onDragMove);
    document.addEventListener('pointerup', onDragUp);
    document.addEventListener('pointercancel', onDragCancel);
    document.addEventListener('keydown', onDragEsc, true);
  }

  function onDragMove(ev) {
    if (!drag) return;
    const dx = ev.clientX - drag.x0, dy = ev.clientY - drag.y0;
    if (!drag.started) {
      if (Math.abs(dx) < DRAG_THRESH && Math.abs(dy) < DRAG_THRESH) return;
      startGhost(ev);
    }
    ev.preventDefault();
    positionGhost(ev.clientX, ev.clientY);
    const hitEl = hitElement(ev.clientX, ev.clientY);
    const valid = hitEl && drag.p.valid(hitEl) ? hitEl : null;
    drag.hitEl = hitEl;
    if (valid !== drag.hit) {
      if (drag.hit) drag.hit.classList.remove('drop-ok');
      drag.hit = valid;
      if (valid) valid.classList.add('drop-ok');
    }
  }

  function finishDragListeners() {
    document.removeEventListener('pointermove', onDragMove);
    document.removeEventListener('pointerup', onDragUp);
    document.removeEventListener('pointercancel', onDragCancel);
    document.removeEventListener('keydown', onDragEsc, true);
  }

  function cleanupDragClasses(d) {
    document.body.classList.remove('is-dragging');
    if (d.src && d.src.classList) d.src.classList.remove('drag-src');
    (d.cands || []).forEach(function (n) { n.classList.remove('drop-cand'); });
    if (d.hit) d.hit.classList.remove('drop-ok');
  }

  function removeGhost(g) { if (g && g.parentNode) g.parentNode.removeChild(g); }

  function flyGhost(g, rect) {
    if (!g) return;
    g.classList.add('snap');
    g.style.left = (rect.left + rect.width / 2) + 'px';
    g.style.top = (rect.top + rect.height / 2) + 'px';
    setTimeout(function () { removeGhost(g); }, 230);
  }

  function returnGhost(g, rect) {
    if (!g) return;
    g.classList.add('settle');
    g.style.left = (rect.left + rect.width / 2) + 'px';
    g.style.top = (rect.top + rect.height / 2) + 'px';
    setTimeout(function () { removeGhost(g); }, 280);
  }

  function onDragUp(ev) {
    if (!drag) return;
    const d = drag;
    finishDragListeners();
    if (!d.started) { drag = null; return; }        /* обычный клик — работает как раньше */
    suppressClickUntil = Date.now() + 400;
    cleanupDragClasses(d);
    const hit = d.hit, hitEl = d.hitEl;
    drag = null;
    if (hit) {
      const rect = (d.p.targetRect && d.p.targetRect()) || hit.getBoundingClientRect();
      flyGhost(d.ghost, rect);
      d.p.drop(hit);
    } else {
      if (hitEl && d.p.invalid) d.p.invalid(hitEl);
      returnGhost(d.ghost, d.rect);
    }
  }

  function onDragCancel() {
    if (!drag) return;
    const d = drag;
    finishDragListeners();
    cleanupDragClasses(d);
    if (d.started) {
      suppressClickUntil = Date.now() + 400;
      returnGhost(d.ghost, d.rect);
    }
    drag = null;
  }

  function onDragEsc(e) {
    if (e.code !== 'Escape') return;
    e.stopPropagation();
    e.preventDefault();
    onDragCancel();
  }

  function initDragAndDrop() {
    document.addEventListener('pointerdown', onDragDown);
    /* клик, следующий за броском, не должен сработать второй раз */
    document.addEventListener('click', function (ev) {
      if (Date.now() < suppressClickUntil) {
        ev.stopPropagation();
        ev.preventDefault();
      }
    }, true);
  }

  /* ================================================================== */
  /*  ИГРОВОЙ ЦИКЛ                                                      */
  /* ================================================================== */
  function loop() {
    S.raf = requestAnimationFrame(loop);
    resize();
    const dt = Math.min(0.05, clock ? clock.getDelta() : 0.016);
    const mobile2D = isMobilePortrait();
    if (S.mode === 'playing') update(dt);
    else if (!mobile2D) idleAnimate(dt);
    if (!mobile2D) {
      KVP.M3.updateBursts(dt);
      if (renderer && scene && camera && S.run) renderer.render(scene, camera);
    }
  }

  function idleAnimate(dt) {
    if (!S.dungeon) return;
    animatePickupMeshes(dt);
    animatePortal(dt);
    animateTokens();
  }

  function update(dt) {
    if (!S.player || !S.dungeon) return;
    S.run.stats.time += dt;
    if ((S.run.stats.time | 0) !== statSec) { statSec = S.run.stats.time | 0; patchStatsTime(); }
    S.elapsed += dt;

    const mobile2D = isMobilePortrait();
    updatePlayer(dt);
    if (!mobile2D) {
      if (S.bots.length) updateFlow(dt);
      updateBots(dt);
      updateProjectiles(dt);
      updateCardThrows(dt);
      animatePickupMeshes(dt);
      animatePortal(dt);
      animateTokens();
      animateWorldBot(dt);
      animateDragonFx(dt);
      updateCamera();
    }

    S.shake = Math.max(0, S.shake - dt * 2.2);
    S.invuln = Math.max(0, S.invuln - dt);

    checkRoom();
    if (!mobile2D) {
      markSeen(dt);
      updateTargetPanel(dt);
      updateInteract(dt);
    }
    maybeAutoNextTurn();
    updateHudTick(dt);
    drawMinimap(false);
  }

  /* ================================================================== */
  /*  ИГРОК — ПОШАГОВОЕ ДВИЖЕНИЕ ПО КАРТАМ                              */
  /* ================================================================== */
  const OPP = { n: 's', e: 'w', s: 'n', w: 'e' };
  const DIR_NAMES = { n: 'север', e: 'восток', s: 'юг', w: 'запад' };

  function dirFromYaw(yaw) {
    const fx = -Math.sin(yaw), fz = -Math.cos(yaw);
    if (Math.abs(fx) > Math.abs(fz)) return fx > 0 ? 'e' : 'w';
    return fz > 0 ? 's' : 'n';
  }

  function yawForDir(dir) {
    if (dir === 'n') return 0;
    if (dir === 'w') return Math.PI / 2;
    if (dir === 's') return Math.PI;
    return -Math.PI / 2;
  }

  function rotateDir(dir, steps) {
    const list = ['n', 'e', 's', 'w'];
    return list[(list.indexOf(dir) + steps + 8) % 4];
  }

  function updatePlayer(dt) {
    const p = S.player;
    if (!p) return;
    p.cooldown = Math.max(0, p.cooldown - dt);
    p.turnCd = Math.max(0, (p.turnCd || 0) - dt);

    // Анимация шага между центрами карт.
    if (S.stepAnim) {
      const a = S.stepAnim;
      a.t += dt;
      const k = Math.min(1, a.t / a.dur);
      const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
      p.x = a.x0 + (a.x1 - a.x0) * e;
      p.z = a.z0 + (a.z1 - a.z0) * e;
      p.yaw = a.yaw0 + (a.yaw1 - a.yaw0) * e;
      p.walkPhase += dt * 9;
      p.moving = true;
      if (k >= 1) {
        p.x = a.x1; p.z = a.z1; p.yaw = a.yaw1;
        p.moving = false;
        const tile = a.tile;
        S.stepAnim = null;
        if (tile) {
          KVP.Audio.play('step');
          onStepArrived(tile);
        }
      }
      return;
    }

    p.moving = false;

    // Плавный поворот по клику (мини-карта / компас).
    if (S.turnAnim) {
      const t = S.turnAnim;
      t.t += dt;
      const k = Math.min(1, t.t / t.dur);
      const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
      p.yaw = t.yaw0 + (t.yaw1 - t.yaw0) * e;
      if (k >= 1) { p.yaw = t.yaw1; S.turnAnim = null; }
    }
    syncRunHp();
  }

  /** Повернуть рыцаря в абсолютную сторону света ('n'|'e'|'s'|'w'). */
  function faceDir(dir) {
    const p = S.player;
    if (!p || S.mode !== 'playing' || S.stepAnim) return;
    const target = yawForDir(dir);
    let delta = target - p.yaw;
    while (delta > Math.PI) delta -= Math.PI * 2;
    while (delta < -Math.PI) delta += Math.PI * 2;
    if (Math.abs(delta) < 0.01) return;
    S.turnAnim = { yaw0: p.yaw, yaw1: p.yaw + delta, t: 0, dur: 0.3 };
    KVP.Audio.play('step');
  }

  function onStepArrived(tile) {
    checkRoom();
    if (S.run && tile) {
      S.run.lastTile = { gx: tile.gx, gz: tile.gz, yaw: S.player.yaw };
    }
    updateHUD();
    maybePlaceChest();
    drawMinimap(true);
    saveRun();
    if (tile && tile.type === 'chest') {
      openVictoryChest(tile);
      return;
    }
    /* Правила Соло: вошли на карту Местности, где стоят жетоны врагов, — ОБЯЗАНЫ на Дуэль,
       второе действие в этом ходу пропускается. Открываем сразу, чтобы нельзя было
       успеть вытянуть карту раньше Дуэли. */
    if (S.run && tile && S.mode === 'playing' && enemiesAt(tile) > 0) {
      openDuel();
    }
  }

  function startStep(tile, dir) {
    const p = S.player;
    if (!tile || !p) return;
    const c = S.dungeon.center(tile);
    S.stepAnim = {
      x0: p.x, z0: p.z, x1: c.x, z1: c.y,
      yaw0: p.yaw, yaw1: yawForDir(dir || dirFromYaw(p.yaw)),
      t: 0, dur: 0.42, tile: tile
    };
    S.turn.moved = true;
    unlockAutoTurn();
    tile.discovered = true;
    tile.entered = true;
    p.moving = true;
  }

  function tryStep(rel) {
    if (S.mode !== 'playing' || !S.player || S.stepAnim) return;
    if (S.pendingTile) {
      UI.toast('Сначала пристройте вытянутую карту Местности.', 'info', 1800);
      KVP.Audio.play('denied');
      return;
    }
    if (step1Done()) {
      UI.toast(S.turn.moved
        ? 'Один шаг за ход. Осталось <b>действие 2</b> — возьмите карту из колоды.'
        : 'Действие 1 в этом ходу пропущено (сходить было некуда). Возьмите карту, а шагнёте в следующем ходу.',
        'info', 2600);
      highlightDeck();
      KVP.Audio.play('denied');
      return;
    }
    if (!canMoveNow()) {
      S.turn.skipped = true;
      UI.toast('Сходить некуда: рядом нет карты Местности с проходом. Действие 1 пропускается — берите карту (действие 2).', 'info', 3200);
      highlightDeck();
      updateTurnBar();
      KVP.Audio.play('denied');
      return;
    }
    const tile = S.dungeon.rooms[S.currentRoom];
    if (!tile) return;

    const base = dirFromYaw(S.player.yaw);
    let dir = base;
    if (rel === 'back') dir = rotateDir(base, 2);
    else if (rel === 'left') dir = rotateDir(base, 1);
    else if (rel === 'right') dir = rotateDir(base, 3);

    stepToDir(dir);
  }

  /** Шаг в абсолютную сторону света ('n'|'e'|'s'|'w') с проверками. */
  /** Перемещение возможно ТОЛЬКО ОДИН раз за ход (действие 1).
   *  После того как действие 1 выполнено или пропущено, дальше можно
   *  только взять карту (действие 2) и закончить ход — возвращения к
   *  перемещению нет. */
  function stepToDir(dir) {
    if (S.mode !== 'playing' || !S.player || S.stepAnim) return;
    if (step1Done()) {
      UI.toast('В этом ходу вы уже переместились — <b>всего один шаг за ход</b>. Дальше только действие 2: взять карту.', 'bad', 2400);
      KVP.Audio.play('denied');
      return;
    }
    const tile = S.dungeon.rooms[S.currentRoom];
    if (!tile) return;

    if (!tile.exits[dir]) {
      UI.toast('В эту сторону — стена. На карте нет прохода на ' + DIR_NAMES[dir] + '.', 'info', 1800);
      KVP.Audio.play('denied');
      return;
    }

    const n = S.dungeon.neighborCell(tile.gx, tile.gz, dir);
    const other = S.dungeon.tileAt(n.gx, n.gz);
    if (other) {
      if (!S.dungeon.passage(tile, dir)) {
        UI.toast('Прохода нет: стрелки на картах не совпадают.', 'bad', 2000);
        KVP.Audio.play('denied');
        return;
      }
      startStep(other, dir);
    } else {
      // Карты Местности там ещё нет — её надо вытянуть из колоды.
      UI.toast('Здесь ещё нет карты Местности — выложите её рядом (действие 2).', 'info', 2600);
      KVP.Audio.play('denied');
      highlightDeck();
    }
  }

  /* ================================================================== */
  /*  КОЛОДА: ТЯНЕМ КАРТУ — явное действие игрока                       */
  /* ================================================================== */
  function cardArtHTML(card) {
    if (!card) return '🃏';
    if (card.kind === 'trophy') return KVP.SVG.trophy(card.itemType);
    if (card.kind === 'knight') return KVP.SVG.knight(card.itemType);
    if (card.kind === 'special') return KVP.SVG.special(card.itemType);
    if (card.kind === 'bot') return KVP.SVG.bot(card.itemType);
    if (card.kind === 'cell') return '<span style="font-size:30px">🪤</span>';
    if (card.kind === 'tile') {
      const d = KVP.tileCardById(card.itemType);
      return '<span style="font-size:30px">' + (d ? d.icon : '🗺') + '</span>';
    }
    return '🃏';
  }

  function cardName(card) {
    if (!card) return 'Карта';
    if (card.kind === 'trophy') return (KVP.TROPHIES[card.itemType] || {}).name || 'Трофей';
    if (card.kind === 'knight') return (KVP.KNIGHTS[card.itemType] || {}).name || 'Рыцарь';
    if (card.kind === 'special') return (KVP.SPECIALS[card.itemType] || {}).name || 'Спецкарта';
    if (card.kind === 'bot') return (KVP.BOTS[card.itemType] || {}).name || 'ПароБот';
    if (card.kind === 'cell') return 'Клетка-ловушка';
    if (card.kind === 'tile') {
      const d = KVP.tileCardById(card.itemType);
      return d ? d.name : 'Карта Местности';
    }
    return 'Карта';
  }

  /* ================================================================== */
  /*  ПОРЯДОК ХОДА: 1) ШАГ — 2) ВЗЯТЬ КАРТУ                             */
  /* ================================================================== */
  function tileCount() {
    return (S.run && S.run.map && S.run.map.length) ? S.run.map.length : 1;
  }
  function step1Done() {
    return !!(S.turn && (S.turn.moved || S.turn.skipped));
  }
  /** Есть ли хотя бы один доступный шаг с текущей клетки. */
  function canMoveNow() {
    const tile = S.dungeon && S.dungeon.rooms[S.currentRoom];
    if (!tile || !S.player) return false;
    const dirs = ['n', 'e', 's', 'w'];
    for (let i = 0; i < 4; i++) {
      const d = dirs[i];
      if (!tile.exits || !tile.exits[d]) continue;
      const n = S.dungeon.neighborCell(tile.gx, tile.gz, d);
      const other = S.dungeon.tileAt(n.gx, n.gz);
      if (other && S.dungeon.passage(tile, d)) return true;
    }
    return false;
  }
  /** Правило даёт сразу второе действие: на поле одна карта или сходить некуда. */
  function stepMustSkip() {
    return tileCount() <= 1 || !canMoveNow();
  }
  function flashStep(n) {
    const s = el('tstep-' + n);
    if (!s) return;
    s.classList.remove('flash');
    void s.offsetWidth;
    s.classList.add('flash');
    setTimeout(function () { s.classList.remove('flash'); }, 1500);
  }
  function flashReveal() {
    const r = el('deck-reveal');
    if (!r) return;
    r.classList.remove('flash');
    void r.offsetWidth;
    r.classList.add('flash');
    setTimeout(function () { r.classList.remove('flash'); }, 1500);
  }

  function showDrawnCard(card, pending) {
    S.lastDrawn = card;
    const host = el('deck-reveal');
    if (!host) return;
    host.classList.remove('empty');
    /* Настоящая карта в зоне «ВЫТЯНУТО» + всплывашка: что делает и как применить. */
    host.setAttribute('data-tip', UI.tipFor(card, pending
      ? 'Кликните по карте — применить. Или перетащите её на Рыцаря.'
      : 'Карта уже сыграна.'));
    host.innerHTML = '<div class="rv-cap">ВЫТЯНУТО</div>' +
      '<div class="rv-card">' + UI.cardFor(card.kind, card.itemType, { compact: true }) + '</div>' +
    host.classList.toggle('pending', !!pending);
    if (pending) host.setAttribute('data-drag', 'reveal');
    else host.removeAttribute('data-drag');
    host.classList.remove('pop');
    void host.offsetWidth;
    host.classList.add('pop');
  }

  /** Действие 2: карта с колоды ложится на стол и ждёт решения игрока. */
  function drawFromDeck() {
    if (S.mode !== 'playing' || !S.run) return;
    if (S.pendingTile) {
      UI.toast('Сначала пристройте вытянутую карту Местности.', 'info', 1800);
      KVP.Audio.play('denied');
      return;
    }
    if (S.pendingCard) {
      UI.toast('Карта уже лежит на столе — кликните её, чтобы применить.', 'info', 2000);
      flashReveal();
      KVP.Audio.play('denied');
      return;
    }
    if (!S.run.deck || !S.run.deck.length) {
      UI.toast('Колода пуста — тянуть нечего.', 'bad', 2400);
      maybePlaceChest();
      return;
    }
    if (S.turn.drawn) {
      UI.toast('В этом ходу карта уже вытянута. Нажмите «Конец хода».', 'info', 2000);
      KVP.Audio.play('denied');
      return;
    }
    if (!step1Done()) {
      if (stepMustSkip()) {
        S.turn.skipped = true;
        UI.toast(tileCount() <= 1
          ? 'На поле одна карта Местности — действие 1 пропускается, сразу второе.'
          : 'Сходить некуда: рядом нет карт с проходом — действие 1 пропускается.', 'info', 2800);
      } else {
        UI.toast('Сначала <b>действие 1</b> — переход: выберите комнату перехода на карте. Потом действие 2: взять карту.', 'bad', 3000);
        flashStep(1);
        KVP.Audio.play('denied');
        return;
      }
    }
    /* Правила Соло: стоишь на карте с жетонами врага и не уходишь — обязана Дуэль
       вместо второго действия. Уйти можно только шагом (действие 1). */
    const curRoom = S.dungeon.rooms[S.currentRoom];
    if (curRoom && enemiesAt(curRoom) > 0 && !S.turn.moved && !S.pendingDuel) {
      UI.toast('⚔ На этой карте стоят жетоны врага — вы обязаны на Дуэль (вместо взятия карты).', 'info', 2600);
      openDuel();
      return;
    }
    const card = S.run.deck.shift();
    S.run.stats.drawn = (S.run.stats.drawn || 0) + 1;
    S.turn.drawn = true;
    unlockAutoTurn();
    KVP.Audio.play('card');

    /* Правила Соло-режима: «Если выпадает Спецкарта, то играйте её немедленно».
       Спецкарта не попадает в руку — она срабатывает здесь и сейчас. */
    if (card.kind === 'special') {
      showDrawnCard(card, false);
      S.logEvent('🃏 Вытянута Спецкарта «' + cardName(card) + '» — играется немедленно.');
      resolveDrawnCard(card);
      saveRun();
      return;
    }

    S.pendingCard = card;
    S.run.pendingCard = card;
    showDrawnCard(card, true);
    S.logEvent('🃏 Вытянута карта «' + cardName(card) + '» — она ждёт решения на столе.');
    updateHUD();
    saveRun();

    /* По правилам Соло-режима вытянутый ПароБот нападает сразу:
       «если вы вытаскиваете ПароБота, до должны или победить его Трофеем
       из-под вашего Персонажа… или потерять одного любого Персонажа».
       Значит, карта не ждёт клика — сразу показываем бой и 3D-врага. */
    if (card.kind === 'bot') {
      clearPendingCard();
      openBotFight(card.itemType);
    }
  }

  function clearPendingCard() {
    if (!S.pendingCard) return false;
    S.pendingCard = null;
    if (S.run) S.run.pendingCard = null;
    /* Карта применена или ушла в руку — зона «ВЫТЯНУТО» очищается. */
    S.lastDrawn = null;
    const host = el('deck-reveal');
    if (host) {
      host.classList.remove('pending', 'pop', 'flash');
      host.removeAttribute('data-drag');
      host.classList.add('empty');
      host.innerHTML = '<div class="rv-cap">ВЫТЯНУТО</div><div class="rv-empty">пока<br>пусто</div>';
    }
    return true;
  }

  /**
   * Решение по вытянутой карте: клик — применение по умолчанию,
   * перетаскивание — сразу на цель (слот Рыцаря или зона руки).
   */
  function applyPendingCard(slotIdx, toHand) {
    const card = S.pendingCard;
    if (!card) return;
    const name = KVP.escapeHtml(cardName(card));

    if (card.kind === 'trophy' && slotIdx != null) {
      const k = S.run.team[slotIdx];
      if (!k || !k.alive) return;
      if (k.type === 'mag' && card.itemType !== 'paper') { UI.toast('Маг в Команде — ВСЕ РЫЦАРИ сражаются ТОЛЬКО Бумагой. Экипируйте её под любого Рыцаря.', 'info', 2600); return; }
      const old = k.trophy;
      k.trophy = KVP.newTrophy(card.itemType);   /* карта колоды → нормальный Трофей */
      if (old) UI.toast('🃏 Старый Трофей сброшен.', 'info', 2000);
      clearPendingCard();
      S.selectedSlot = slotIdx;
      KVP.Audio.play('pickup');
      UI.toast('🃏 <b>' + name + '</b> — Трофей встал в слот: ' + KVP.escapeHtml(k.name) + '.', 'good', 2400);
      S.logEvent('🃏 ' + name + ' → ' + k.name + '.');
      updateHUD(); renderDeck(); saveRun();
      return;
    }
    if (card.kind === 'trophy' && toHand) {
      if (S.run.hand.length >= HAND_LIMIT) { UI.toast('Рука полна (макс. ' + HAND_LIMIT + ').', 'bad', 2200); return; }
      S.run.hand.push(KVP.newTrophy(card.itemType));   /* карта колоды → нормальный Трофей */
      clearPendingCard();
      KVP.Audio.play('pickup');
      UI.toast('🃏 <b>' + name + '</b> — в руке. Снарядите кого-нибудь из расклада.', 'good', 2200);
      S.logEvent('🃏 ' + name + ' → рука.');
      updateHUD(); renderDeck(); saveRun();
      return;
    }
    if (card.kind === 'bot' && slotIdx != null) {
      S.selectedSlot = slotIdx;
      clearPendingCard();
      updateHUD();
      openBotFight(card.itemType);
      saveRun();
      return;
    }
    clearPendingCard();
    resolveDrawnCard(card);
    saveRun();
  }

  function resolveDrawnCard(card) {
    if (card.kind === 'tile') {
      const def = KVP.tileCardById(card.itemType);
      if (!def) { S.turn.drawn = false; return; }
      openTilePlacement(card);
      return;
    }
    if (card.kind === 'trophy') {
      addTrophy(card.itemType);
      KVP.Audio.play('pickup');
      UI.toast('🃏 Трофей «' + KVP.TROPHIES[card.itemType].name + '» — ' +
        (S.run.team.some(function (k) { return k.alive && k.trophy && k.trophy.type === card.itemType; })
          ? 'снаряжён под Рыцаря.' : 'в руке (снаряжение — в раскладе).'), 'good', 2200);
      S.logEvent('🃏 Трофей «' + KVP.TROPHIES[card.itemType].name + '».');
    } else if (card.kind === 'knight') {
      /* Правила Соло: вытянутый Рыцарь — НЕ союзник. Он встаёт жетоном врага
         на ту карту Местности, где стоит игрок. Третий жетон на карте — поражение. */
      const roomE = S.dungeon.rooms[S.currentRoom];
      const n = addEnemyToken(roomE);
      if (n >= 3) { updateHUD(); drawMinimap(true); return; }  /* duelDefeat уже объявил поражение */
      KVP.Audio.play('bad');
      UI.toast('⚔ Вытянут <b>Рыцарь-соперник</b>! Он встал жетоном врага на текущую карту Местности. Жетонов на карте: <b>' + n + '</b>. Действие 2 выполнено.', 'bad', 3800);
      S.logEvent('⚔ Рыцарь-соперник — жетон врага на карте Местности (всего: ' + n + ').');
      drawMinimap(true);
    } else if (card.kind === 'special') {
      if (card.itemType === 'mag') {
        addKnight('mag');
        KVP.Audio.play('mag');
        UI.toast('🧙 <b>Маг присоединился!</b> Теперь отбивайтесь Бумагой.', 'good', 3000);
        S.logEvent('🧙 Маг присоединился к команде.');
        S.turn.drawn = false;
        updateHUD();
        return;
      }
      applySpecial(card.itemType);
    } else if (card.kind === 'cell') {
      const freeKnight = S.run.team.find(function(k){ return k.alive && !k.trophy; });
      if (freeKnight) {
        freeKnight.trophy = KVP.newTrophy('trap');
        S.run.cells = S.run.team.filter(function(k){ return k.alive && k.trophy && k.trophy.type === 'trap'; }).length;
        KVP.Audio.play('pickup');
        UI.toast('🪤 Клетка-ловушка под Рыцарем ' + KVP.escapeHtml(freeKnight.name) + '.', 'good', 2000);
        S.logEvent('🪤 Клетка-ловушка → ' + freeKnight.name + '.');
      } else {
        KVP.Audio.play('denied');
        UI.toast('🪤 Нет свободного Рыцаря — Клетка уходит в сброс.', 'info', 2000);
      }
    } else if (card.kind === 'bot') {
      openBotFight(card.itemType);
    }
    updateHUD();
  }

  /* ================================================================== */
  /*  КАРТА МЕСТНОСТИ: ВЫБОР ПРОХОДА И ПОВОРОТА                         */
  /* ================================================================== */
  function rotatedExits(shapeName, rot) {
    const shape = KVP.TILE_SHAPES[shapeName] || KVP.TILE_SHAPES.dead;
    const order = ['n', 'e', 's', 'w'];
    const out = { n: 0, e: 0, s: 0, w: 0 };
    for (let i = 0; i < order.length; i++) {
      if (shape.exits[order[i]]) out[order[(i + rot) % 4]] = 1;
    }
    return out;
  }

  function shapeGridHTML(exits, icon) {
    return '<div class="shape-grid">' +
      '<span class="sg n">' + (exits.n ? '↑' : '') + '</span>' +
      '<span class="sg w">' + (exits.w ? '←' : '') + '</span>' +
      '<span class="sg c">' + (icon || '🚪') + '</span>' +
      '<span class="sg e">' + (exits.e ? '→' : '') + '</span>' +
      '<span class="sg s">' + (exits.s ? '↓' : '') + '</span>' +
      '</div>';
  }

  /**
   * Повороты карты Местности, при которых вход смотрит в сторону backDir.
   * Карта — прямоугольник 2:1, её нельзя повернуть на 90° (тогда она ляжет
   * не длинной стороной к длинной), поэтому поворотов всего два: 0° и 180°.
   * Пустой список = карту сюда положить нельзя.
   */
  function validRotations(shapeName, backDir) {
    const out = [];
    for (let k = 0; k < 2; k++) {
      const r = k * 2;
      if (rotatedExits(shapeName, r)[backDir]) out.push(r);
    }
    return out;
  }

  /**
   * Свободные места для новой карты Местности — все проходы без карты.
   * Учитывается только те места, где карта действительно может войти
   * входом к соседней карте (правило: «на карте должен быть вход хотя бы
   * с одной соседней карты»).
   */
  function placementCandidates(shapeName) {
    const out = [];
    const rooms = S.dungeon.rooms;
    for (let i = 0; i < rooms.length; i++) {
      const r = rooms[i];
      for (let k = 0; k < 4; k++) {
        const d = ['n', 'e', 's', 'w'][k];
        if (!r.exits || !r.exits[d]) continue;
        const n = S.dungeon.neighborCell(r.gx, r.gz, d);
        if (n.gx < 0 || n.gz < 0 || n.gx >= S.dungeon.gridSize || n.gz >= S.dungeon.gridSize) continue;
        if (S.dungeon.hasTile(n.gx, n.gz)) continue;
        if (shapeName && !validRotations(shapeName, OPP[d]).length) continue;
        out.push({ gx: n.gx, gz: n.gz, dir: d, roomId: r.id, roomName: r.name, icon: r.icon });
      }
    }
    const cur = S.currentRoom;
    out.sort(function (a, b) {
      return (a.roomId === cur ? 0 : 1) - (b.roomId === cur ? 0 : 1);
    });
    return out;
  }

  function openTilePlacement(card) {
    const def = KVP.tileCardById(card.itemType);
    if (!def) { S.turn.drawn = false; return; }
    const cands = placementCandidates(def.shape);
    if (!cands.length) {
      if (def.id === KVP.CHEST_TILE.id) {
        /* Правила Соло: если карту с Сундуком нельзя выложить так, чтобы
           на неё можно было перейти с другой карты — игрок проигрывает. */
        S.logEvent('💀 Карту с Сундуком некуда выложить — поражение.');
        UI.toast('💀 Карту с Сундуком некуда выложить — по правилам это поражение.', 'bad', 6000);
        S.pendingTile = null;
        S.turn.drawn = false;
        gameOver();
        return;
      }
      /* Карта не подходит — по правилам она уходит в сброс. */
      UI.toast('Нет места для «' + KVP.escapeHtml(def.name) + '» — карта уходит в сброс.', 'info', 3000);
      S.logEvent('🃏 «' + def.name + '» некуда пристроить — в сброс.');
      S.pendingTile = null;
      clearPendingCard();
      S.turn.drawn = true;
      maybePlaceChest();
      updateHUD();
      saveRun();
      return;
    }
    S.pendingTile = { card: card, def: def, cands: cands, sel: 0, rot: 0 };
    selectCandidate(0);
    S.logEvent('🃏 Вытянута карта Местности «' + def.name + '» — пристройте её к лабиринту.');
    UI.toast(def.icon + ' <b>' + KVP.escapeHtml(def.name) + '</b> — выберите клетку на карте лабиринта.', 'good', 3200);
    KVP.Audio.play('card');
    updateHUD();
  }

  function selectCandidate(idx) {
    const p = S.pendingTile;
    if (!p || !p.cands[idx]) return;
    p.sel = idx;
    const c = p.cands[idx];
    const valid = validRotations(p.def.shape, OPP[c.dir]);
    p.rot = valid.length ? valid[0] : 0;
    renderPlacePanel();
    drawMinimap(true);
  }

  function rotatePending(step) {
    const p = S.pendingTile;
    if (!p) return;
    const c = p.cands[p.sel];
    const valid = validRotations(p.def.shape, OPP[c.dir]);
    if (!valid.length) return;
    let at = valid.indexOf(p.rot);
    if (at < 0) at = 0;
    p.rot = valid[(at + step + valid.length) % valid.length];
    renderPlacePanel();
    drawMinimap(true);
  }

  function renderPlacePanel() {
    const p = S.pendingTile;
    const host = el('place-panel');
    if (!host) return;
    if (!p) { host.classList.add('hidden'); return; }
    host.classList.remove('hidden');
    const icon = el('place-icon'), title = el('place-title'), sub = el('place-sub');
    if (icon) icon.textContent = p.def.icon;
    if (title) title.textContent = p.def.name;
    if (sub) sub.textContent = 'Кликните клетку на карте или выберите сторону';
    const shape = el('place-shape');
    if (shape) shape.innerHTML = shapeGridHTML(rotatedExits(p.def.shape, p.rot), '');
    const dirs = el('place-dirs');
    if (dirs) {
      dirs.innerHTML = p.cands.map(function (c, i) {
        const dn = DIR_NAMES[c.dir] || c.dir;
        return '<button class="place-dir' + (i === p.sel ? ' on' : '') + '" data-cand="' + i + '">' +
          dn + ' <small>' + KVP.escapeHtml(c.roomName) + '</small></button>';
      }).join('');
    }
    const cv = el('minimap');
    if (cv) cv.classList.add('placing');
  }

  function hidePlacePanel() {
    const host = el('place-panel');
    if (host) host.classList.add('hidden');
    const cv = el('minimap');
    if (cv) cv.classList.remove('placing');
  }

  /** Пиксель мини-карты → клетка {gx,gz} или null. */
  function minimapCellFromEvent(ev) {
    const cv = el('minimap');
    const v = S.mapView;
    if (!cv || !v) return null;
    const r = cv.getBoundingClientRect();
    if (!r.width || !r.height) return null;
    const x = (ev.clientX - r.left) * (cv.width / r.width);
    const y = (ev.clientY - r.top) * (cv.height / r.height);
    const cw = v.cellW || v.cell, ch = v.cellH || v.cell;
    return {
      gx: v.gx0 + (x - v.ox) / cw,
      gz: v.gz0 + (y - v.oy) / ch
    };
  }

  /** Соседняя клетка, на которую можно шагнуть с текущей, либо null. */
  function walkableNeighborAt(gx, gz) {
    if (!S.dungeon || S.currentRoom == null) return null;
    const tile = S.dungeon.rooms[S.currentRoom];
    if (!tile) return null;
    const dx = gx - tile.gx, dz = gz - tile.gz;
    if (!dx && !dz) return null;
    if (Math.abs(dx) + Math.abs(dz) !== 1) return null;
    const dir = dx === 1 ? 'e' : dx === -1 ? 'w' : dz === 1 ? 's' : 'n';
    if (!tile.exits[dir]) return null;
    const n = S.dungeon.neighborCell(tile.gx, tile.gz, dir);
    if (!S.dungeon.tileAt(n.gx, n.gz)) return null;   // карты Местности ещё нет
    if (!S.dungeon.passage(tile, dir)) return null;   // стрелки не совпадают
    return dir;
  }

  /** Поворот взгляда: сторона комнаты, к которой ближе клик (0..1 внутри клетки).
   *  aspect = cellW/cellH: карта Местности прямоугольная 2:1, поэтому
   *  до боковых краёв в пикселях расстояние больше. */
  function turnSideInCell(fx, fz, aspect) {
    const ar = aspect || 1;
    const sides = [
      { dir: 'n', d: fz },
      { dir: 's', d: 1 - fz },
      { dir: 'w', d: fx * ar },
      { dir: 'e', d: (1 - fx) * ar }
    ];
    let best = sides[0];
    for (let i = 1; i < sides.length; i++) if (sides[i].d < best.d) best = sides[i];
    /* Ближе к краю — поворачиваем взгляд в эту сторону. */
    if (best.d > 0.3) return null;
    return best.dir;
  }

  /** Сторона взгляда под кликом в текущей комнате, либо null. */
  function turnSideAt(gx, gz) {
    if (!S.dungeon || S.currentRoom == null) return null;
    const tile = S.dungeon.rooms[S.currentRoom];
    if (!tile) return null;
    if (Math.floor(gx) !== tile.gx || Math.floor(gz) !== tile.gz) return null;
    const v = S.mapView;
    const aspect = v ? (v.cellW || v.cell) / (v.cellH || v.cell) : 1;
    return turnSideInCell(gx - tile.gx, gz - tile.gz, aspect);
  }

  /** Курсор «рука» над соседней картой, куда можно шагнуть. */
  function onMinimapHover(ev) {
    const cv = el('minimap');
    if (!cv) return;
    /* В режиме раскладки карты — просто crosshair, movement неактуален. */
    if (S.pendingTile) { cv.style.cursor = 'crosshair'; return; }
    if (S.mode !== 'playing' || !S.player) { cv.style.cursor = ''; return; }
    const c = minimapCellFromEvent(ev);
    if (!c) { cv.style.cursor = ''; return; }
    if (walkableNeighborAt(Math.floor(c.gx), Math.floor(c.gz))) { cv.style.cursor = 'pointer'; return; }
    cv.style.cursor = turnSideAt(c.gx, c.gz) ? 'ew-resize' : '';
  }

  /** Клик по карте лабиринта: в режиме раскладки — выбрать клетку,
      иначе — шагнуть на соседнюю карту Местности. */
  function onMinimapClick(ev) {
    const p = S.pendingTile;
    const c = minimapCellFromEvent(ev);
    if (!c) return;
    /* После перетаскивания карты клик не считается шагом. */
    if (Date.now() < suppressClickUntil) return;

    if (p) {
      for (let i = 0; i < p.cands.length; i++) {
        const cand = p.cands[i];
        if (Math.floor(c.gx) === cand.gx && Math.floor(c.gz) === cand.gz) { selectCandidate(i); return; }
      }
      return;
    }

    /* Обычный режим: клик по соседней карте — шаг в её сторону. */
    if (S.mode !== 'playing' || !S.player || S.stepAnim) return;
    const dir = walkableNeighborAt(Math.floor(c.gx), Math.floor(c.gz));
    if (!dir) {
      const tile = S.dungeon.rooms[S.currentRoom];
      const dx = Math.floor(c.gx) - tile.gx, dz = Math.floor(c.gz) - tile.gz;
      if (!dx && !dz) {
        /* Клик внутри своей комнаты у края — повернуть взгляд в эту сторону. */
        const side = turnSideAt(c.gx, c.gz);
        if (side) { faceDir(side); return; }
        return;
      }
      if (Math.abs(dx) + Math.abs(dz) !== 1) {
        UI.toast('Идти можно только на соседнюю карту Местности.', 'info', 1800);
      } else {
        UI.toast('Туда пройти нельзя — на карте нет прохода.', 'info', 1800);
        KVP.Audio.play('denied');
      }
      return;
    }
    stepToDir(dir);
  }

  function confirmPlace() {
    const p = S.pendingTile;
    if (!p) return;
    const c = p.cands[p.sel];
    /* Правило: на новой карте должен быть вход хотя бы с одной соседней
       карты — то есть стрелки должны встретиться. */
    if (!validRotations(p.def.shape, OPP[c.dir]).length) {
      UI.toast('Карту нельзя повернуть входом к «' + KVP.escapeHtml(c.roomName) + '» — выберите другую клетку.', 'bad', 2600);
      KVP.Audio.play('denied');
      return;
    }
    const room = S.dungeon.placeTile(p.def.id, c.gx, c.gz, p.rot);
    if (!room) {
      UI.toast('Сюда карту поставить нельзя — выберите другую клетку.', 'bad', 2200);
      return;
    }
    if (!S.run.map) S.run.map = [];
    S.run.map.push({ cardId: p.def.id, gx: c.gx, gz: c.gz, rot: p.rot });
    rebuildWorld();
    S.pendingTile = null;
    hidePlacePanel();
    S.logEvent('🏗 «' + p.def.name + '» пристроена (' + (DIR_NAMES[c.dir] || c.dir) + ' от «' + c.roomName + '»).');
    if (p.def.id === KVP.CHEST_TILE.id) {
      /* Последняя карта колоды — карта с Сундуком. Её выложили: идём к ней. */
      S.run.chestPlaced = true;
      placeChestForTile(room);
      const dist = roomDistances(S.currentRoom);
      S.run.chestDistance = dist[room.id] == null ? 1 : Math.max(1, dist[room.id]);
      KVP.Audio.play('chest');
      UI.toast('💰 <b>Карта с Сундуком выложена!</b><br>До Сундука ' +
        S.run.chestDistance + ' переход(ов) — идите к нему.', 'gold', 6000);
      S.logEvent('💰 Карта с Сундуком выложена. Переходов до него: ' + S.run.chestDistance + '.');
    } else {
      UI.toast(p.def.icon + ' <b>' + KVP.escapeHtml(p.def.name) + '</b> — карта пристроена к лабиринту.', 'good', 2600);
      KVP.Audio.play('card');
    }
    S.turn.drawn = true;
    maybePlaceChest();
    updateHUD();
    drawMinimap(true);
    saveRun();

    /* По требованию: после выкладывания карты Местности ход завершается
       автоматически — нет нужды жать «Конец хода». */
    setTimeout(function () { endTurn(); }, 350);
  }

  function cancelPlace() {
    const p = S.pendingTile;
    if (p) {
      S.run.deck.unshift(p.card);
      S.turn.drawn = false;
      S.logEvent('Карта «' + p.def.name + '» возвращена в колоду.');
      S.pendingTile = null;
    }
    hidePlacePanel();
    updateHUD();
  }

  /* ================================================================== */
  /*  БОЙ С ПАРОБОТОМ (пошаговый, по картам)                            */
  /* ================================================================== */
  /**
   * Разрушение ПароБота по правилам (Games Rules v3.3.4).
   * Условие оружия:
   *   • обычный ПароБот      — Камень ИЛИ Ножницы;
   *   • бронированный       — НЕ Ножницы (то есть Камень);
   *   • ПароБот-копейщик    — НЕ Камень (то есть Ножницы);
   *   • Гигант              — логическое И: Камень И Ножницы с разных Рыцарей.
   * Если в команде Маг — работает ТОЛЬКО Бумага.
   * Сила = сила Трофея + по +1 за каждого живого Рыцаря; её должно хватать
   * на броню ПароБота.
   */
  function botDefeatPlan(botType, trophies) {
    const bot = KVP.BOTS[botType];
    const armor = bot ? bot.armor : 0;
    const tp = teamPower();
    const set = (trophies || []).filter(Boolean);
    if (!bot) return { ok: false, power: 0, armor: 0, reason: 'Неизвестный ПароБот.' };

    /* Клетка-ловушка ловит любого ПароБота, в том числе комбо. */
    if (set.length === 1 && set[0] === 'trap') {
      return { ok: true, power: '∞', armor: armor, need: ['trap'], reason: '' };
    }

    if (hasMag()) {
      if (botType === 'giant' && (set.filter(function(t){ return t === 'paper'; }).length < 2)) {
        return { ok: false, power: 0, armor: armor, need: ['paper','paper'], reason: 'Гиганта нужно уничтожить двумя Бумагами.' };
      }
      if (set.indexOf('paper') < 0) {
        return { ok: false, power: 0, armor: armor, need: ['paper'], reason: 'С Магом в команде работает только Бумага.' };
      }
      return { ok: true, power: '∞', armor: armor, need: ['paper'], reason: '' };
    }

    /* Правило: без Мага Бумага ничего не пробивает. */
    if (set.indexOf('paper') >= 0) {
      return { ok: false, power: 0, armor: armor, reason: 'Без Мага Бумага не разрушает ПароБотов.' }
    }
    if (isComboBot(botType)) {
      const def = KVP.BOTS[botType];
      const partsRaw = String(def.condition).split('&&').map(function(x){return x.trim();});
      const wanted = partsRaw.map(function(x){return x.replace(/^!/,'');});
      const need = wanted.slice();
      for (let wi = 0; wi < wanted.length; wi++) {
        const w = wanted[wi];
        const neg = partsRaw[wi].charAt(0) === '!';
        if (neg) {
          if (set.indexOf(w) >= 0) {
            return { ok: false, power: 0, armor: armor, need: need, reason: 'Логическое И: запрещён ' + w + '.' };
          }
        } else if (set.indexOf(w) < 0) {
          return { ok: false, power: 0, armor: armor, need: need, reason: 'Нужны ' + wanted.join(' И ') + ' (с разных Рыцарей).' };
        }
      }
      let power2 = tp;
      for (const w of wanted) if (set.indexOf(w) >= 0) power2 += ((KVP.TROPHIES[w]||{}).force || 0);
      return {
        ok: power2 >= armor, power: power2, armor: armor, need: need,
        reason: power2 >= armor ? '' : 'Не хватает силы: ' + power2 + ' < брони ' + armor + '.'
      };
    }

    /* XOR: rovno odno iz dvuh */
    if (String(bot.condition).indexOf('^') >= 0) {
      const partsX = String(bot.condition).split('^').map(function (x) { return String(x).trim(); });
      const a0 = partsX[0], b0 = partsX[1];
      const hasA = set.indexOf(a0) >= 0, hasB = set.indexOf(b0) >= 0;
      if (hasA && hasB) return { ok: false, power: 0, armor: armor, reason: 'XOR: nelzya ispolzovat oba trofea srazu.' };
      const chosen = hasA ? a0 : (hasB ? b0 : null);
      if (!chosen) return { ok: false, power: 0, armor: armor, reason: 'Nuzhno rovno odno iz dvuh: ' + a0 + ' ili ' + b0 + '.' };
      if (chosen === 'paper' && !hasMag()) return { ok: false, power: 0, armor: armor, reason: 'Bumaga bez Maga ne razrushaet.' };
      const fuer = (KVP.TROPHIES[chosen] || {}).force || 0;
      const power = fuer + tp;
      return { ok: (power >= armor), power: power, armor: armor, reason: (power >= armor) ? '' : ('Ne khvataet sily: ' + power + ' < ' + armor + '.') };
    }

    const t = set[0];
    if (!t) return { ok: false, power: 0, armor: armor, reason: 'Нет Трофея.' };
    /* Без Мага Бумага ничего не пробивает — она не оружие, а инструмент ̈запутывания либо работает только при Маге. */
    if (t === 'paper' && !hasMag()) {
      return { ok: false, power: 0, armor: armor, reason: 'Без Мага Бумага не разрушает ПароБотов.' };
    }
    let condOk = true, why = '';
    if (bot.condition === 'rock || scissors') {
      condOk = (t === 'rock' || t === 'scissors');
      why = condOk ? 'Условие «Камень ИЛИ Ножницы» выполнено.' : 'Нужен Камень или Ножницы.';
    } else if (bot.condition === '!scissors') {
      condOk = (t !== 'scissors');
      why = condOk ? 'Условие «НЕ Ножницы» выполнено.' : 'Ножницы запрещены: сработало логическое НЕ.';
    } else if (bot.condition === '!rock') {
      condOk = (t !== 'rock');
      why = condOk ? 'Условие «НЕ Камень» выполнено.' : 'Камень запрещён: сработало логическое НЕ.';
    }
    const force = (KVP.TROPHIES[t] || {}).force || 0;
    const power = force + tp;
    if (!condOk) return { ok: false, power: power, armor: armor, reason: why };
    return {
      ok: power >= armor, power: power, armor: armor,
      reason: power >= armor ? '' : 'Не хватает силы: ' + power + ' < брони ' + armor + '.'
    };
  }

  /** Может ли этот Трофей (плюс сила команды) разрушить ПароБота. */
  function canDefeat(botType, trophyType) {
    if (!trophyType) return false;
    return botDefeatPlan(botType, [trophyType]).ok;
  }

  function fightCloseGuard() {
    UI.toast('Сначала отбейтесь Трофеем или потеряйте Рыцаря.', 'bad', 2200);
    S.modalOnClose = fightCloseGuard;
  }

  /* Кэш 3D-портретов, чтобы не рендерить заново каждый раз. */
  const _previewCache = {};
  function previewBot(botType, size) {
    const key = 'bot:' + botType + ':' + size;
    if (_previewCache[key]) return _previewCache[key];
    if (!KVP.M3 || !KVP.M3.renderPreview) return '';
    try {
      const url = KVP.M3.renderPreview(KVP.M3.makeBot(botType), { size: size || 150, yaw: -0.7 });
      _previewCache[key] = url;
      return url;
    } catch (e) { return ''; }
  }
  function previewKnight(type, opts, size) {
    opts = opts || {};
    const key = 'kn:' + type + ':' + (opts.foe ? 'f' : 'a') + ':' + (size || 90);
    if (_previewCache[key]) return _previewCache[key];
    if (!KVP.M3 || !KVP.M3.renderPreview) return '';
    try {
      const url = KVP.M3.renderPreview(KVP.M3.makeKnight(type, { foe: opts.foe }), { size: size || 90, yaw: -0.75 });
      _previewCache[key] = url;
      return url;
    } catch (e) { return ''; }
  }
  /** Портрет с запасным вариантом, если 3D-рендер недоступен. */
  function portraitHTML(url, fallback, cls) {
    if (url) return '<span class="' + (cls || 'p3d') + '"><img src="' + url + '" alt=""></span>';
    return '<span class="' + (cls || 'p3d') + ' ' + (cls || 'p3d') + '-fallback">' + fallback + '</span>';
  }

  /**
   * Все способы победить ПароБота трофеями команды — по правилам.
   * Для Гиганта нужно два Трофея с разных Рыцарей (логическое И).
   */
  function fightWinOptions(botType) {
    const team = S.run.team;
    const opts = [];
    for (let i = 0; i < team.length; i++) {
      const k = team[i];
      if (!k.alive || k.type === 'mag' || !k.trophy) continue;
      if (k.trophy.type === 'trap') continue;   /* ловушка — отдельной кнопкой */
      opts.push({ slots: [i], trophies: [k.trophy.type], plan: botDefeatPlan(botType, [k.trophy.type]) });
    }
    if (isComboBot(botType)) {
      for (let i = 0; i < team.length; i++) {
        for (let j = i + 1; j < team.length; j++) {
          const a = team[i], b = team[j];
          if (!a.alive || !b.alive || a.type === 'mag' || b.type === 'mag') continue;
          if (!a.trophy || !b.trophy) continue;
          if (a.trophy.type === 'trap' || b.trophy.type === 'trap') continue;
          const tr = [a.trophy.type, b.trophy.type];
          opts.push({ slots: [i, j], trophies: tr, plan: botDefeatPlan(botType, tr) });
        }
      }
    }
    return opts.filter(function (o) { return o.plan.ok; });
  }

  function botFightHTML() {
    const f = S.pendingFight;
    if (!f) return '';
    const def = KVP.BOTS[f.bot] || {};
    const team = S.run.team;
    const sel = S.fightSel || [];
    const alive = team.filter(function (k) { return k.alive; });
    const winOpts = fightWinOptions(f.bot);
    const normalAttackPossible = winOpts.length > 0;
    const combo = isComboBot(f.bot);
    /* Клетка тоже выбирается Рыцарем и срабатывает по кнопке «Атаковать»:
       отдельной кнопки для неё нет. */
    const trapOwner = team.find(function (k) {
      return k.alive && k.trophy && k.trophy.type === 'trap';
    });
    const trapInSel = sel.some(function (s) {
      const k = team[s];
      return !!(k && k.alive && k.trophy && k.trophy.type === 'trap');
    });
    /* Для Титанов с Магом одна Бумага уже побеждает: блокировать одиночную
       атаку нельзя. Два Рыцаря обязательны только там, где нет ни одного
       одиночного победного варианта (Гигант, либо комбо без Мага). */
    const singleWin = winOpts.some(function (o) { return o.slots.length === 1; });
    const needsTwoAttack = combo && !singleWin;
    const requiredLoss = Math.min(combo ? 2 : 1, alive.length);
    const lossPicks = Array.isArray(S.fightLossPick) ? S.fightLossPick : [];
    const fightError = S.fightError || '';
    const errorHTML = fightError
      ? '<div class="fight-note" style="color:#ff8f72; font-weight:700">⚠ ' + KVP.escapeHtml(fightError) + '</div>'
      : '';

    /* Все живые Рыцари показываются одинаково: карта Рыцаря + карта его
       Трофея (ПароБот/Клетка/Камень/Ножницы/Бумага) либо пустой слот. */
    let teamHTML = '';
    let losses = '';
    for (let i = 0; i < team.length; i++) {
      const k = team[i];
      if (!k.alive) continue;
      const on = sel.indexOf(i) >= 0;
      const trName = k.trophy && KVP.TROPHIES[k.trophy.type]
        ? KVP.TROPHIES[k.trophy.type].name : '';
      const trForce = k.trophy && KVP.TROPHIES[k.trophy.type] && k.trophy.type !== 'trap'
        ? (KVP.TROPHIES[k.trophy.type].force || 0) : 0;
      teamHTML += '<button type="button" class="fight-knight' + (on ? ' sel' : '') + '" onclick="KVP.Game.fightToggle(' + i + ')">' +
        '<span class="fk-cards">' + UI.knight(k, { compact: true }) +
          (k.type === 'mag' ? '' : UI.trophy(k.trophy ? k.trophy.type : null, { compact: true, empty: !k.trophy })) +
        '</span>' +
        '<span class="fk-name">' + (on ? '✓ ' : '') + KVP.escapeHtml(k.name) + '</span>' +
        '<span class="fk-hint">' + (k.type === 'mag'
          ? 'Маг · без Трофея'
          : (trName ? 'Трофей: ' + KVP.escapeHtml(trName) + (k.trophy.type === 'trap' ? ' · ловит без боя' : ' · +' + trForce + ' к силе') : 'Слот пуст')) + '</span>' +
        '</button>';

      losses += '<button type="button" class="fight-knight loss' + (lossPicks.indexOf(i) >= 0 ? ' sel' : '') + '" onclick="KVP.Game.fightPickLoss(' + i + ')" data-idx="' + i + '">' +
        '<span class="fk-cards">' + UI.knight(k, { compact: true }) +
          (k.type === 'mag' ? '' : UI.trophy(k.trophy ? k.trophy.type : null, { compact: true, empty: !k.trophy })) +
        '</span>' +
        '<span class="fk-name">💀 Потерять: ' + KVP.escapeHtml(k.name) + '</span>' +
        '<span class="fk-hint">' + (k.trophy && KVP.TROPHIES[k.trophy.type]
          ? 'В сброс уходит также ' + KVP.escapeHtml(KVP.TROPHIES[k.trophy.type].name)
          : 'Без Трофея') + '</span>' +
      '</button>';
    }

    const powerLow = (teamTotalPower() < (def.armor || 0));
    /* Неверная атака не блокируется: игрок вправе нажать кнопку и потерять
       выбранного Рыцаря. Кнопка доступна при любом выборе. */
    const canCommit = sel.length > 0;
    let selForce = 0;
    sel.forEach(function (s) {
      const k = team[s];
      if (k && k.type !== 'mag' && k.trophy && k.trophy.type !== 'trap') {
        selForce += (KVP.TROPHIES[k.trophy.type] || {}).force || 0;
      }
    });
    const powerText = trapInSel
      ? 'Клетка ловит без боя — сила не важна'
      : (sel.length
        ? 'В атаке: Рыцари +' + teamPower() + ' + Трофеи +' + selForce + ' = ' + (teamPower() + selForce)
        : 'В атаке: Рыцари +' + teamPower() + ' + выбранный Трофей. Выберите Рыцаря');
    let attackHint;
    if (trapInSel) {
      attackHint = sel.length === 1
        ? 'Клетка поймает «' + KVP.escapeHtml(def.name || 'ПароБота') + '» без боя. Нажмите «Атаковать».'
        : 'Клетка ловит только одним Рыцарем — уберите лишний выбор.';
    } else if (!normalAttackPossible) {
      attackHint = (powerLow
        ? 'Итоговой силы команды ' + teamTotalPower() + ' не хватает против брони ' + (def.armor || '?') + '.'
        : 'Подходящего оружия нет.') +
        ' Можно выбрать Клетку или сразу кого потерять.';
    } else if (needsTwoAttack) {
      attackHint = sel.length === 2
        ? 'Для «' + KVP.escapeHtml(def.conditionText || 'этого ПароБота') + '» нужны ДВА разных Трофея. ' + powerText + ' · броня ' + (def.armor || 0) + '.'
        : 'Выберите второго Рыцаря — для «' + KVP.escapeHtml(def.conditionText || 'этого ПароБота') + '» нужна атака двумя Рыцарями. ' + powerText + '.';
    } else if (combo) {
      attackHint = 'Можно бить одним Рыцарем: для «' + KVP.escapeHtml(def.conditionText || 'этого ПароБота') +
        '» уже есть одиночный победный вариант. ' + powerText + '.';
    } else {
      attackHint = 'Можно бить одним Рыцарем; смена цели вытесняет текущего. ' + powerText + '.';
    }
    const botFace = UI.bot(f.bot, { compact: false });

    const trapHTML = trapOwner
      ? '<div class="fight-note">🪤 Клетка-ловушка: выберите Рыцаря с Клеткой и нажмите «Атаковать» — он поймает любого ПароБота без боя.</div>'
      : '';

    const lossLabel = requiredLoss > 1
      ? 'Или потерять двух Рыцарей вместе с Трофеями'
      : 'Или потерять Рыцаря вместе с Трофеем';
    const lossWarning = (requiredLoss > 1 && lossPicks.length < requiredLoss)
      ? '<div class="fight-note" style="color:#ffb088; font-weight:700">Выберите второго Рыцаря — для «' +
          KVP.escapeHtml(def.conditionText || 'этого ПароБота') + '» потери идут двумя.</div>'
      : '';
    const lossAction = '<div class="tp-label">' + lossLabel + '</div>' +
      lossWarning +
      '<div class="fight-list">' + losses + '</div>' +
      '<div class="fight-actions" style="display:flex; gap:10px; justify-content:center; margin:8px 0 2px;">' +
        '<button type="button" class="btn bad primary big" onclick="KVP.Game.fightCommitLoss()"' +
          (lossPicks.length < requiredLoss ? ' disabled' : '') + '>💀 Потерять ' +
          (requiredLoss > 1 ? 'выбранных' : 'выбранного') +
          (lossPicks.length ? ' · ' + lossPicks.length : '') + '</button>' +
      '</div>';

    return '<div class="fight">' +
      '<div class="fight-bot">' + botFace + '<div class="fb-info">' +
        '<div class="fb-name">' + KVP.escapeHtml(def.name || 'ПароБот') + '</div>' +
        '<div class="fb-armor">🛡 Броня <b>' + (def.armor || '?') + '</b> · 💰 ' + (def.reward || 0) + '</div>' +
        '<div class="fb-rule">Нужно: <b>' + KVP.escapeHtml(def.conditionText || '') + '</b>. ' +
          'В команде' + (hasMag() ? ' есть Маг — работает только Бумага.' : ' нет Мага.') +
          ' Итоговая сила команды: <b>' + teamTotalPower() + '</b> ' +
          '(Рыцари +' + teamPower() + ' + все Трофеи +' + teamTrophyPower() + '). ' +
          'В атаке учитывается только выбранное оружие: Рыцари + один Трофей (у комбо — два).</div>' +
      '</div></div>' +
      trapHTML +
      '<div class="tp-label">Все Рыцари и их Трофеи</div>' +
      '<div class="fight-note">Выберите Рыцаря (для комбинации — двух) и нажмите «Атаковать». ' +
        powerText + ' · броня ' + (def.armor || '?') + '.</div>' +
      '<div class="fight-note" style="color:#ffb088; font-weight:700">' + attackHint + '</div>' +
      errorHTML +
      '<div class="fight-team">' + teamHTML + '</div>' +
      '<button type="button" class="btn primary fight-commit"' + (canCommit ? '' : ' disabled') +
        ' onclick="KVP.Game.fightCommit()">⚔ Атаковать выбранными' + (sel.length ? ' · ' + sel.length : '') + '</button>' +
      lossAction +
      '<div class="fight-note">В атаке: сила выбранного Трофея + по +1 за каждого живого Рыцаря (у комбо — два Трофея). Итоговая сила команды в шапке — все Рыцари и все Трофеи. Поверженный ПароБот отправляется в коллекцию «Победы», Трофей — в сброс.</div>' +
      '</div>';
  }

  function rerenderFightModal() {
    const b = el('modal-body');
    if (b) b.innerHTML = botFightHTML();
  }

  /* Выбор Рыцарей в бою: без подсказок, можно одного или двух. */
  G.fightToggle = function (idx) {
    const k = S.run && S.run.team ? S.run.team[idx] : null;
    if (!k || !k.alive) return;
    const f = S.pendingFight;
    if (!f) return;
    S.fightError = '';
    const sel = S.fightSel || (S.fightSel = []);
    const p = sel.indexOf(idx);
    const isTrap = !!(k.trophy && k.trophy.type === 'trap');
    if (p >= 0) {
      sel.splice(p, 1);
    } else {
      /* Клетка всегда выбирается одна: при выборе она вытесняет остальных,
         а обычный Рыцарь вытесняет выбранную Клетку. */
      if (isTrap) {
        sel.length = 0;
      } else {
        const hasTrap = sel.some(function (s) {
          const t = S.run.team[s];
          return !!(t && t.trophy && t.trophy.type === 'trap');
        });
        if (hasTrap) sel.length = 0;
        /* Не-комбо бот: можно бить только одним Рыцарем — переключаем, а не добавляем. */
        if (isComboBot(f.bot)) {
          if (sel.length >= 2) sel.shift();
        } else {
          sel.length = 0;
        }
      }
      sel.push(idx);
    }
    S.fightLossPick = [];
    rerenderFightModal();
    KVP.Audio.play('click');
  };

  G.fightPickLoss = function (idx) {
    const k = S.run && S.run.team ? S.run.team[idx] : null;
    if (!k || !k.alive) return;
    S.fightError = '';
    S.fightSel = [];
    if (!Array.isArray(S.fightLossPick)) S.fightLossPick = [];
    const aliveCount = S.run.team.filter(function (k) { return k.alive; }).length;
    const need = Math.min((S.pendingFight && isComboBot(S.pendingFight.bot)) ? 2 : 1, aliveCount);
    const pos = S.fightLossPick.indexOf(idx);
    if (pos >= 0) S.fightLossPick.splice(pos, 1);
    else {
      if (S.fightLossPick.length >= need) S.fightLossPick.shift();
      S.fightLossPick.push(idx);
    }
    rerenderFightModal();
    KVP.Audio.play('click');
  };

  G.fightCommitLoss = function () {
    const picks = Array.isArray(S.fightLossPick) ? S.fightLossPick.slice(0, 2) : [];
    const aliveCount = S.run.team.filter(function (k) { return k.alive; }).length;
    const need = Math.min((S.pendingFight && isComboBot(S.pendingFight.bot)) ? 2 : 1, aliveCount);
    if (!picks.length) { UI.toast('Сначала выберите, кого потерять.', 'info', 1800); KVP.Audio.play('denied'); return; }
    if (picks.length < need) { UI.toast('Выберите ещё Рыцаря — для Гиганта/Титана потери идут двумя.', 'info', 2200); KVP.Audio.play('denied'); return; }
    S.fightSel = [];
    if (picks.length === 1) G.fightUI('lose', picks[0]);
    else G.fightUI('lose', picks[0], picks[1]);
  };

  function failFightAttack(reason, slots) {
    S.fightError = '';
    S.fightSel = [];
    if (slots.length === 1) G.fightUI('lose', slots[0], null, reason);
    else G.fightUI('lose', slots[0], slots[1], reason);
  }

  G.fightCommit = function () {
    const f = S.pendingFight;
    const slots = (S.fightSel || []).slice(0, 2);
    if (!f || !slots.length) return;
    const trapSlot = slots.find(function (s) {
      const k = S.run.team[s];
      return !!(k && k.alive && k.trophy && k.trophy.type === 'trap');
    });
    if (trapSlot != null) {
      if (slots.length !== 1) {
        S.fightError = 'Клетка ловит только одним Рыцарем — уберите лишний выбор.';
        S.fightSel = [];
        rerenderFightModal();
        UI.toast(S.fightError, 'bad', 3000);
        KVP.Audio.play('denied');
        return;
      }
      /* Клетка не бьёт по силе: она просто ловит ПароБота. */
      S.fightSel = [];
      G.fightUI('cell', trapSlot);
      return;
    }
    /* Неверный выбор не блокируем: игрок нажал «Атаковать» — выбранные
       Рыцари погибают вместе с Трофеями. */
    const trs = [];
    let fatal = '';
    for (let s = 0; s < slots.length; s++) {
      const k = S.run.team[slots[s]];
      if (!k || !k.alive) {
        S.fightError = 'Рыцарь не найден.';
        S.fightSel = [];
        rerenderFightModal();
        UI.toast(S.fightError, 'bad', 3000);
        KVP.Audio.play('denied');
        return;
      }
      if (k.type === 'mag' || !k.trophy) {
        fatal = k.type === 'mag'
          ? 'Маг «' + k.name + '» не умеет бить Трофеем.'
          : 'У Рыцаря «' + k.name + '» пустой слот Трофея.';
        break;
      }
      trs.push(k.trophy.type);
    }
    if (!fatal) {
      const plan = botDefeatPlan(f.bot, trs);
      if (!plan.ok) fatal = plan.reason || 'Это оружие не пробивает ПароБота.';
    }
    if (fatal) {
      failFightAttack(fatal, slots);
      return;
    }
    if (slots.length === 1) G.fightUI('win', slots[0]);
    else G.fightUI('win', slots[0], slots[1]);
    if (!S.pendingFight) {
      S.fightSel = [];
    }
  };

  function openBotFight(botType) {
    S.fightSel = [];
    S.fightLossPick = [];
    S.fightError = '';
    S.pendingFight = { bot: botType };
    S.logEvent('🤖 Из колоды вышел ' + (KVP.BOTS[botType] ? KVP.BOTS[botType].name : 'ПароБот') + '.');
    showBotInWorld(botType);
    /* В бою свои кнопки (отбиться / поймать / потерять) — «Продолжить» прячем. */
  showModal('🤖 ПароБот!', botFightHTML(), 'playing', true);
    S.modalOnClose = fightCloseGuard;
    KVP.Audio.play('bad');
  }

  /* ------------------------------------------------------------------ */
  /*  ПАРОБОТ ПЕРЕД ИГРОКОМ В 3D                                         */
  /* ------------------------------------------------------------------ */
  /* ПароБот из колоды шагает в лабиринт и встаёт перед игроком. */
  function showBotInWorld(botType) {
    if (!entityRoot || !KVP.M3.makeBot || !S.player) return;
    hideBotInWorld();
    const p = S.player;
    const fx = -Math.sin(p.yaw), fz = -Math.cos(p.yaw);
    const mesh = KVP.M3.makeBot(botType);
    mesh.scale.setScalar(1.05);
    mesh.position.set(p.x + fx * 2.35, 0, p.z + fz * 2.35);
    mesh.rotation.y = p.yaw + Math.PI;
    const tag = KVP.M3.makeLabelSprite('ПАРОБОТ', 'rgba(30,10,10,.9)', '#ffcf9a');
    tag.position.y = 1.5;
    tag.scale.set(0.78, 0.2, 1);
    mesh.add(tag);
    entityRoot.add(mesh);
    S.worldBot = { mesh: mesh, bot: botType, phase: 0, life: 0 };
  }

  function hideBotInWorld() {
    if (S.worldBot && S.worldBot.mesh && S.worldBot.mesh.parent) {
      S.worldBot.mesh.parent.remove(S.worldBot.mesh);
    }
    S.worldBot = null;
  }

  function animateWorldBot(dt) {
    const b = S.worldBot;
    if (!b) return;
    b.life += dt;
    const t = performance.now() * 0.001;
    b.mesh.position.y = Math.abs(Math.sin(t * 3 + b.phase)) * 0.05;
    // плавно поворачивается к игроку
    const p = S.player;
    if (p) {
      const want = Math.atan2(p.x - b.mesh.position.x, p.z - b.mesh.position.z);
      let diff = want - b.mesh.rotation.y;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      b.mesh.rotation.y += diff * Math.min(1, dt * 4);
    }
  }

  function resolveFightDone() {
    S.pendingFight = null;
    S.fightSel = [];
    S.fightLossPick = [];
    S.fightError = '';
    S.modalOnClose = null;
    hideBotInWorld();
    closeModal();
    updateHUD();
    saveRun();
  }

  G.fightUI = function (action, idx, idx2, why) {
    const f = S.pendingFight;
    if (!f) return;
    const def = KVP.BOTS[f.bot] || { reward: 10, name: 'ПароБот' };

    if (action === 'win') {
      /* idx — Рыцарь, idx2 — второй (для Гиганта: Камень И Ножницы). */
      const slots = (idx2 == null) ? [idx] : [idx, idx2];
      const team = S.run.team;
      if (slots.length === 1 && team[slots[0]] && team[slots[0]].trophy &&
          team[slots[0]].trophy.type === 'trap') {
        G.fightUI('cell', slots[0]);
        return;
      }
      const trophies = [];
      const badReasons = [];
      let bad = false;
      for (let s = 0; s < slots.length; s++) {
        const k = team[slots[s]];
        if (!k || !k.alive) return;
        if (k.type === 'mag') {
          bad = true;
          badReasons.push(KVP.escapeHtml(k.name) + ' — Маг не умеет бить Трофеем (у него нет Трофея).');
          continue;
        }
        if (!k.trophy) {
          bad = true;
          badReasons.push(KVP.escapeHtml(k.name) + ' — слот Трофея пуст, бить нечем.');
          continue;
        }
        trophies.push(k.trophy.type);
      }
      let plan = null;
      if (!bad) {
        plan = botDefeatPlan(f.bot, trophies);
        if (!plan || !plan.ok) {
          bad = true;
          badReasons.push('ПароБот отражает удар: ' + KVP.escapeHtml((plan && plan.reason) || 'это оружие ему не угрожает'));
        }
      }

      /* Не убиваем Рыцарей автоматически: показываем причину и оставляем
         игроку явный выбор потери/жертвы. */
      if (bad) {
        S.fightError = badReasons.join(' ');
        S.fightSel = [];
        const fb = el('modal-body');
        if (fb) fb.innerHTML = botFightHTML();
        UI.toast('Атака не удалась: ' + S.fightError, 'bad', 3600);
        KVP.Audio.play('denied');
        return;
      }
      const names = [];
      for (let s = 0; s < slots.length; s++) {
        const k = S.run.team[slots[s]];
        names.push(k.name);
        k.trophy = null;                      /* оружие уходит в сброс */
        if (S.selectedSlot === slots[s]) S.selectedSlot = firstUsableSlot();
      }
      const tr = trophies.map(function (t) { return KVP.TROPHIES[t].name; }).join(' и ');
      S.run.wins = S.run.wins || [];
      S.run.wins.push(f.bot);
      S.run.stats.kills = (S.run.stats.kills || 0) + 1;
      S.run.stats.byType = S.run.stats.byType || {};
      S.run.stats.byType[f.bot] = (S.run.stats.byType[f.bot] || 0) + 1;
      S.run.stats.botGold = (S.run.stats.botGold || 0) + (def.reward || 0);
      S.run.gold += def.reward || 0;

      S.logEvent('⚔ ' + names.join(' и ') + ' отбились ' + tr + ' (сила ' + plan.power + ' ≥ ' + plan.armor + ') — ПароБот повержен (+' + (def.reward || 0) + ' золота).');
      KVP.Audio.play('coin');
      resolveFightDone();
      const html = '<p><b>' + KVP.escapeHtml(def.name) + '</b> повержен в бою.</p>' +
        '<div class="duel-note">+💰 ' + (def.reward || 0) + ' · добавлен в коллекцию «Победы».</div>';
      showModal('🏆 ПОБЕДА над ПароБотом!', html, 'playing', false);
      return;
    }

    if (action === 'cell') {
      S.fightError = '';
      const picked = (idx != null) ? S.run.team[idx] : null;
      const owner = picked && picked.alive && picked.trophy && picked.trophy.type === 'trap'
        ? picked
        : S.run.team.find(function(k){ return k.alive && k.trophy && k.trophy.type === 'trap'; });
      if (!owner) return;
      owner.trophy = null;
      S.run.cells = S.run.team.filter(function(k){ return k.alive && k.trophy && k.trophy.type === 'trap'; }).length;
      S.run.stats.cellsUsed = (S.run.stats.cellsUsed || 0) + 1;
      S.run.wins = S.run.wins || [];
      S.run.wins.push(f.bot);
      S.run.stats.kills = (S.run.stats.kills || 0) + 1;
      S.run.stats.byType = S.run.stats.byType || {};
      S.run.stats.byType[f.bot] = (S.run.stats.byType[f.bot] || 0) + 1;
      S.run.gold += def.reward || 0;
      S.run.stats.botGold = (S.run.stats.botGold || 0) + (def.reward || 0);
      S.logEvent('🪤 ПароБот пойман Клеткой (+' + (def.reward || 0) + ' золота).');
      KVP.Audio.play('pickup');
      S.pendingFight = null;
      S.fightSel = [];
      S.fightLossPick = [];
      S.modalOnClose = null;
      hideBotInWorld();
      updateHUD();
      saveRun();
      const html = '<p><b>' + KVP.escapeHtml(KVP.BOTS[f.bot].name) + '</b> пойман Клеткой без боя.</p>' +
        '<div class="duel-note">+💰 ' + (def.reward || 0) + ' · добавлен в коллекцию «Победы».</div>';
      showModal('🏆 ПОБЕДА! ПароБот пойман клеткой!', html, 'playing', false);
      return;
    }

    if (action === 'lose') {
      S.fightError = '';
      const slots = (idx2 == null) ? [idx] : [idx, idx2];
      const whyText = why ? KVP.escapeHtml(why) : '';
      const lostNames = [];
      const dead = [];
      for (let s = 0; s < slots.length; s++) {
        const k = S.run.team[slots[s]];
        if (!k || !k.alive) continue;
        k.alive = false;
        const trName = k.trophy ? KVP.TROPHIES[k.trophy.type].name : '';
        const tr = trName ? ' и ' + trName : '';
        k.trophy = null;
        S.run.stats.lost = (S.run.stats.lost || 0) + 1;
        lostNames.push(KVP.escapeHtml(k.name) + (tr ? KVP.escapeHtml(tr) : ' (без Трофея)'));
        dead.push({ name: k.name, trophy: trName });
        KVP.Audio.play('gameover');
      }
      S.fightLossPick = [];
      S.logEvent('💀 ' + (whyText ? 'Атака провалилась: ' + whyText + ' — ' : '') +
        lostNames.join(', ') + ' потеряны в бою с ПароБотом.');
      if (!whyText) {
        UI.toast('💀 ' + lostNames.join(', ') + ' — потеряны в бою.', 'bad', 3600);
      }
      resolveFightDone();
      const anyAlive = S.run.team.some(function (x) { return x.alive; });
      if (whyText) {
        const plural = dead.length > 1;
        const names = dead.map(function (d) { return KVP.escapeHtml(d.name); });
        const trophies = dead.filter(function (d) { return d.trophy; })
          .map(function (d) { return KVP.escapeHtml(d.trophy); });
        const html = '<p>Атака на <b>' + KVP.escapeHtml(def.name) + '</b> провалилась. ' +
            (plural ? 'Погибли' : 'Погиб') + ': <b>' + names.join('</b>, <b>') + '</b>.</p>' +
          '<div class="duel-note"><b>Причина:</b> ' + whyText + '</div>' +
          (trophies.length
            ? '<div class="duel-note"><b>В сброс ушло:</b> ' + trophies.join(', ') + '.</div>'
            : '<div class="duel-note">Трофеев под погибшими не было.</div>') +
          '<div class="duel-note">Победа над ПароБотом не засчитана.</div>';
        showModal(plural ? '💀 Рыцари погибли!' : '💀 Рыцарь погиб!', html, 'playing', false);
        if (!anyAlive) {
          const closeBtn = el('btn-modal-close');
          if (closeBtn) closeBtn.textContent = 'К итогам →';
          S.modalOnClose = function () { gameOver(); };
        }
      } else if (!anyAlive) {
        scheduleGameOver(400);
      }
      return;
    }
  };

  /* ================================================================== */
  /*  ДУЭЛЬ: жетоны врага на картах Местности                          */
  /*  Правила Соло: вытянутый Рыцарь — жетон врага на текущей карте;    */
  /*  вход на карту с жетонами — обязательная Дуэль вместо действия 2.  */
  /* ================================================================== */

  /** Запись выложенной карты Местности по клетке лабиринта. */
  function mapEntryByCell(gx, gz) {
    if (!S.run || !S.run.map) return null;
    for (let i = 0; i < S.run.map.length; i++) {
      const e = S.run.map[i];
      if (e.gx === gx && e.gz === gz) return e;
    }
    return null;
  }

  function mapEntryByRoom(room) {
    return room ? mapEntryByCell(room.gx, room.gz) : null;
  }

  /** Жетоны врагов на той карте, где стоит игрок. */
  function curTileEnemies() {
    const room = S.dungeon && S.dungeon.rooms ? S.dungeon.rooms[S.currentRoom] : null;
    return enemiesAt(room);
  }

  /** Сколько жетонов врага стоит на этой карте Местности. */
  function enemiesAt(room) {
    const e = mapEntryByRoom(room);
    return e && e.enemies ? e.enemies : 0;
  }

  function addEnemyToken(room) {
    const e = mapEntryByRoom(room);
    if (!e) return 0;
    e.enemies = (e.enemies || 0) + 1;
    refreshTokens();
    if (e.enemies >= 3) duelDefeat();
    return e.enemies;
  }

  function removeEnemyToken(room) {
    const e = mapEntryByRoom(room);
    if (!e || !e.enemies) return 0;
    e.enemies = e.enemies > 0 ? e.enemies - 1 : 0;
    refreshTokens();
    return e.enemies;
  }

  /** Третий жетон на одной карте — отряд разбит (правила Соло). */
  function duelDefeat() {
    S.logEvent('💀 Жетонов врага на карте стало три — отряд разбит.');
    UI.toast('💀 <b>Три жетона врага на одной карте Местности!</b> Отряд разбит — игра окончена.', 'bad', 6000);
    KVP.Audio.play('gameover');
    updateHUD(); drawMinimap(true); saveRun();
    scheduleGameOver(1100);
  }

  /** Карта из колоды для Дуэли (за игрока или за соперника). */
  function duelDraw() {
    if (!S.run.deck || !S.run.deck.length) return null;
    const c = S.run.deck.shift();
    S.run.stats.drawn = (S.run.stats.drawn || 0) + 1;
    return c;
  }

  /** Камень тупит Ножницы — Ножницы режут Бумагу — Бумага заворачивает Камень. */
  function trophyBeats(a, b) {
    return (a === 'rock' && b === 'scissors') ||
      (a === 'scissors' && b === 'paper') ||
      (a === 'paper' && b === 'rock');
  }

  /**
   * Трофеи из Инвентаря (под Рыцарями), которыми можно отбиться от Паробота.
   * Возвращает список слотов Рыцарей (для Гиганта — два: Камень и Ножницы).
   */
  function isComboBot(botType) { const b = KVP.BOTS[botType]; return !!(b && String(b.condition).indexOf('&&')>=0); }
  function duelWeaponSlots(botType) {
    const team = S.run.team;
    /* Клетка-ловушка под Рыцарем ловит любого ПароБота, в том числе комбо. */
    for (let i = 0; i < team.length; i++) {
      const k = team[i];
      if (k.alive && k.trophy && k.trophy.type === 'trap') return [i];
    }
    if (isComboBot(botType)) {
      if (hasMag()) {
        if (botType === 'giant') {
          const papers = [];
          for (let i = 0; i < team.length; i++) {
            const k = team[i];
            if (k.alive && k.type !== 'mag' && k.trophy && k.trophy.type === 'paper') papers.push(i);
            if (papers.length === 2) return papers;
          }
          return [];
        }
        /* С Магом Бумага бьёт Титанов/Титан-Бронированных в одиночку. */
        for (let i = 0; i < team.length; i++) {
          const k = team[i];
          if (k.alive && k.type !== 'mag' && k.trophy && canDefeat(botType, k.trophy.type)) return [i];
        }
        return [];
      }
      for (let i = 0; i < team.length; i++) {
        for (let j = i + 1; j < team.length; j++) {
          const a = team[i], b = team[j];
          if (!a.alive || !b.alive || a.type === 'mag' || b.type === 'mag') continue;
          if (!a.trophy || !b.trophy) continue;
          const tr = [a.trophy.type, b.trophy.type];
          if (botDefeatPlan(botType, tr).ok) return [i, j];
        }
      }
      return [];
    }
    for (let i = 0; i < team.length; i++) {
      const k = team[i];
      if (k.alive && k.type !== 'mag' && k.trophy && canDefeat(botType, k.trophy.type)) return [i];
    }
    return [];
  }

  /** Трофей из Инвентаря (под Рыцарем), которым можно отбиться от Паробота. */
  function duelWeapon(botType) {
    const slots = duelWeaponSlots(botType);
    return slots.length ? slots[0] : -1;
  }

  /**
   * Разрушенный ПароБот соперника переходит в коллекцию «Победа».
   * Общие правила (v3.3.4): «вы забираете Steamobot себе в коллекцию,
   * а оружие отправляется в сброс».
   */
  function captureDefeatedBot(botType) {
    if (!botType) return;
    S.run.wins = S.run.wins || [];
    S.run.wins.push(botType);
    S.run.stats.kills = (S.run.stats.kills || 0) + 1;
    S.run.stats.byType = S.run.stats.byType || {};
    S.run.stats.byType[botType] = (S.run.stats.byType[botType] || 0) + 1;
    const reward = (KVP.BOTS[botType] || {}).reward || 0;
    S.run.gold += reward;
    S.run.stats.botGold = (S.run.stats.botGold || 0) + reward;
    UI.toast('🏆 ПОБЕДА! ПароБот побеждён в Дуэли! +' + reward + ' 💰 · «Победы».', 'good', 4000);
    S.logEvent('⚔ Дуэль: повержен ' + ((KVP.BOTS[botType] && KVP.BOTS[botType].name) || 'ПароБот') + ' (+' + reward + ').');
    /* Захват ПароБота в Запас убран — он ломает игру.
       ПароБот всё равно остаётся в «Победах» (S.run.wins). */
  }

  /** Чистая оценка исхода Дуэли для игрока: 'win' | 'lose' | 'draw'. */
  function duelVerdict(mine, theirs) {
    if (!mine || !theirs) return 'draw';
    /* Карта Местности у кого-либо — выкладывается, дуэль завершается. */
    if (mine.kind === 'tile' || theirs.kind === 'tile') return 'draw';
    /* Из Спецкарт при Дуэли работает только Дракон — прочие не играют. */
    if (mine.kind === 'special' || theirs.kind === 'special') return 'draw';
    /* Клетка против Паробота соперника — ловишь и направляешь на него. */
    if (mine.kind === 'cell' && theirs.kind === 'bot') return 'win';
    /* Пойманный ПароБот в Запасе — выложиться поверх Трофея: автоматическая победа над ПароБотом соперника. */
    if (mine.kind === 'trophy' && mine.itemType === 'bot' && theirs.kind === 'bot') return 'win';
    if (theirs.kind === 'cell' && mine.kind === 'bot') return 'lose';
    /* Клетка против прочего (в т.ч. Камень-Ножницы-Бумага) — обе в сброс. */
    if (mine.kind === 'cell' || theirs.kind === 'cell') return 'draw';
    /* Клетка-ловушка из-под Рыцаря против ПароБота соперника — тоже ловит. */
    if (mine.kind === 'trophy' && mine.itemType === 'trap' && theirs.kind === 'bot') return 'win';
    /* Рыцарь сам по себе не оружие: чтобы победить ПароБота, нужен
       подходящий Трофей из-под Рыцаря. Без него это не ничья, а проигрыш. */
    if (theirs.kind === 'bot' && mine.kind === 'knight') return 'lose';
    /* Соперник выставил Паробота: разрушаешь картой либо Инвентарём, иначе теряешь Персонажа. */
    if (theirs.kind === 'bot' && mine.kind === 'trophy') {
      /* Только карта, вытянутая в Дуэли, решает исход немедленно.
         Трофей из-под Рыцаря — отдельный выбор игрока после вскрытия. */
      return canDefeat(theirs.itemType, mine.itemType) ? 'win' : 'lose';
    }
    /* Мой ПароБот против «не ПароБота» (Трофей/Рыцарь/Маг). Если Трофей
       соперника реально разрушает бота — проигрыш; иначе бот обращает
       соперника в бегство (но это не «испуг Рыцаря», текст разный). */
    if (mine.kind === 'bot') {
      if (theirs.kind === 'bot') return 'draw';
      if (theirs.kind === 'trophy') {
        if (canDefeat(mine.itemType, theirs.itemType)) return 'lose';
        return 'win';
      }
      return 'win';
    }
    /* Камень-Ножницы-Бумага против Трофея соперника. */
    if (mine.kind === 'trophy' && theirs.kind === 'trophy') {
      if (mine.itemType === theirs.itemType) return 'draw';  /* одного вида — ничья */
      return trophyBeats(mine.itemType, theirs.itemType) ? 'win' : 'lose';
    }
    /* Рыцарь против прочего и иные сочетания — без действия. */
    return 'draw';
  }

  /** Обязательная Дуэль: игрок вошёл на карту Местности с жетонами врагов. */
  function openDuel() {
    if (S.mode !== 'playing' || !S.run || S.pendingDuel || S.pendingFight || S.pendingTile) return;
    const room = S.dungeon.rooms[S.currentRoom];
    const tokens = enemiesAt(room);
    if (!tokens) return;
    const mine = duelDraw();
    /* На арене может стоять несколько жетонов, но Дуэль идёт только с одним:
       и игрок, и соперник тянут ровно по одной карте. Победа убирает один жетон. */
    const theirs = duelDraw();
    S.pendingDuel = {
      roomId: room.id, roomName: room.name, tokens: tokens,
      mine: mine, theirs: theirs,
      stage: 'wait', layOut: null, needSacrifice: false, salvage: false, choiceHTML: '',
      recruitKnight: null,
      verdictClass: 'draw', verdictTitle: '', verdictText: ''
    };
    S.turn.drawn = true;   /* Дуэль заменяет собой действие 2 — ход почти завершён */
    S.logEvent('⚔ Дуэль на карте «' + room.name + '» — жетонов врага: ' + tokens + '.');
    /* В Дуэли свои кнопки («Вскрыть карты!» / «Завершить дуэль») —
       универсальная «Продолжить» не нужна и только мешает. */
    showModal('⚔ ДУЭЛЬ!', duelHTML(), 'playing', true);
    S.modalOnClose = duelCloseGuard;
    KVP.Audio.play('bad');
    updateHUD();
  }

  function duelCloseGuard() {
    const d = S.pendingDuel;
    if (d && d.needSacrifice) UI.toast('Дуэль не завершена: выберите Персонажа в сброс.', 'bad', 2200);
    else UI.toast('Дуэль ещё не разрешена — дождитесь результата.', 'info', 1800);
    S.modalOnClose = duelCloseGuard;
  }

  const DUEL_KINDS = {
    trophy: 'ТРОФЕЙ', knight: 'РЫЦАРЬ', special: 'СПЕЦКАРТА',
    cell: 'КЛЕТКА', bot: 'ПАРОБОТ', tile: 'МЕСТНОСТЬ'
  };

  /** Рубашка карты — ровно того же размера, что и вскрытая карта. */
  function duelBackHTML(label) {
    return '<div class="duel-card back">' +
      '<div class="db-kind">' + label + '</div>' +
      '<div class="db-crest">⚜</div>' +
      '<div class="db-name">рубашка</div>' +
      '</div>';
  }

  /**
   * Вскрытая карта — настоящая карта того же вида, что и лежит в колоде.
   * Размер совпадает с рубашкой.
   */
  function duelFaceHTML(card) {
    if (!card) {
      return '<div class="duel-card back empty">' +
        '<div class="db-kind">ПУСТО</div>' +
        '<div class="db-crest">⚜</div>' +
        '<div class="db-name">колода кончилась</div>' +
        '</div>';
    }
    return '<div class="duel-card face">' +
      UI.cardFor(card.kind, card.itemType, { compact: true }) +
      '</div>';
  }

  /** Одна сторона Дуэли: крупная подпись «ВЫ»/«СОПЕРНИК» над картой. */
  function duelSide(role, cardHTML) {
    const isYou = role === 'you';
    return '<div class="duel-side ' + (isYou ? 'side-you' : 'side-foe') + '">' +
      '<div class="ds-role">' + (isYou ? '🛡 ВЫ' : '⚔ СОПЕРНИК') + '</div>' +
      cardHTML +
      '</div>';
  }

  /**
   * Карты ваших Рыцарей в Дуэли: видно, кто может выйти на бой
   * и какой Трофей у него под ним. Именно из их Инвентаря отбиваются
   * от ПароБота.
   */
  function duelFightersHTML() {
    const d = S.pendingDuel;
    const team = S.run.team;
    const figs = team.map(function (k, idx) {
      if (!k.alive) return '';
      const tr = k.trophy ? KVP.TROPHIES[k.trophy.type] : null;
      return '<div class="df-item">' +
        '<div class="df-card">' + UI.knight(k, { compact: true }) + '</div>' +
        '<div class="df-trophy' + (tr ? '' : ' none') + '">' +
          (tr ? KVP.SVG.trophy(tr.type) + '<span>' + KVP.escapeHtml(tr.name) + '</span>' : 'без Трофея') +
        '</div>' +
        '</div>';
    }).join('');
    if (!figs.trim()) return '';
    return '<div class="duel-fighters">' +
      '<div class="df-title">ВАШИ РЫЦАРИ — КТО МОЖЕТ ВЫСТУПИТЬ НА БОЙ</div>' +
      '<div class="df-row">' + figs + '</div>' +
      '</div>';
  }

  function duelHTML() {
    const d = S.pendingDuel;
    if (!d) return '';
    const tokensNow = (d.roomId != null && S.dungeon && S.dungeon.rooms && S.dungeon.rooms[d.roomId])
      ? enemiesAt(S.dungeon.rooms[d.roomId]) : d.tokens;
    const cards = d.stage === 'result'
      ? duelSide('you', duelFaceHTML(d.mine)) + '<div class="duel-vs">ПРОТИВ</div>' + duelSide('foe', duelFaceHTML(d.theirs))
      : duelSide('you', duelBackHTML('ВЫ')) + '<div class="duel-vs">ПРОТИВ</div>' + duelSide('foe', duelBackHTML('СОПЕРНИК'));
    const head = '<div class="duel-head">Жетонов врага на карте «<b>' + KVP.escapeHtml(d.roomName) + '</b>»: <b>' + tokensNow + '</b>' +
      (tokensNow > 1
        ? ' — Дуэль идёт только с одним жетоном. После победы уберётся один, остальные останутся.'
        : ' — по правилам каждый тянет по одной карте.') +
      (tokensNow >= 2 ? '<br><span class="duel-warn">Третий жетон на этой карте = поражение в игре.</span>' : '') + '</div>';
    const doneLabel = d.recruitKnight ? 'Забрать Рыцаря в команду' : 'Завершить дуэль';
    const resultMark = d.stage === 'result'
      ? '<div class="duel-result-mark ' + d.verdictClass + '">' +
        (d.verdictClass === 'win' ? 'Дуэль выиграна'
          : d.verdictClass === 'lose' ? 'Дуэль проиграна'
            : 'Дуэль — ничья') + '</div>'
      : '';
    const mid = d.stage === 'result'
      ? resultMark +
        '<div class="duel-verdict ' + d.verdictClass + '"><b>' + d.verdictTitle + '</b><br>' + d.verdictText + '</div>' +
        (d.choiceHTML || '') +
        '<div class="duel-actions"><button class="btn primary big" onclick="KVP.Game.duelUI(\'done\')">' + doneLabel + '</button></div>'
      : '<div class="duel-actions"><button class="btn primary big" onclick="KVP.Game.duelUI(\'reveal\')">Вскрыть карты!</button></div>';
    return head + '<div class="duel-cards">' + cards + '</div>' + duelFightersHTML() + mid;
  }

  /** Все Трофеи из-под Рыцарей, которыми игрок может отбиться от карты соперника. */
  function duelSalvageOptions(d) {
    const out = [];
    if (!d || !d.theirs || !S.run || !S.run.team) return out;
    const theirs = d.theirs;
    const team = S.run.team;

    if (theirs.kind === 'bot') {
      for (let i = 0; i < team.length; i++) {
        const k = team[i];
        if (!k.alive || k.type === 'mag' || !k.trophy) continue;
        const tr = k.trophy.type;
        if (tr === 'trap' || canDefeat(theirs.itemType, tr)) {
          out.push({ slots: [i], trophies: [tr], names: [k.name] });
        }
      }
      if (isComboBot(theirs.itemType) && (!hasMag() || theirs.itemType === 'giant')) {
        for (let i = 0; i < team.length; i++) {
          for (let j = i + 1; j < team.length; j++) {
            const a = team[i], b = team[j];
            if (!a.alive || !b.alive || a.type === 'mag' || b.type === 'mag') continue;
            if (!a.trophy || !b.trophy) continue;
            if (a.trophy.type === 'trap' || b.trophy.type === 'trap') continue;
            const plan = botDefeatPlan(theirs.itemType, [a.trophy.type, b.trophy.type]);
            if (!plan.ok) continue;
            out.push({ slots: [i, j], trophies: [a.trophy.type, b.trophy.type], names: [a.name, b.name] });
          }
        }
      }
    } else if (theirs.kind === 'trophy') {
      for (let i = 0; i < team.length; i++) {
        const k = team[i];
        if (!k.alive || k.type === 'mag' || !k.trophy) continue;
        const tr = k.trophy.type;
        if (tr === theirs.itemType || !trophyBeats(tr, theirs.itemType)) continue;
        out.push({ slots: [i], trophies: [tr], names: [k.name] });
      }
    }
    return out;
  }

  /** Предупреждение второй фазы: победная карта соперника перейдёт игроку. */
  function duelPhaseWarning(d) {
    const prize = d && d.theirs ? cardName(d.theirs) : 'карта Соперника';
    return '<div class="duel-warn duel-phase-warn">⚠ При победе вы заберёте карту у Соперника дуэли — «' +
      KVP.escapeHtml(prize) + '».</div>';
  }

  function duelSalvageButtons(opts) {
    return '<div class="fight-list">' + opts.map(function (o) {
      const names = o.names.map(function (n) { return KVP.escapeHtml(n); }).join(' + ');
      const trs = o.trophies.map(function (t) {
        return KVP.escapeHtml((KVP.TROPHIES[t] || {}).name || t);
      }).join(' + ');
      return '<button class="fight-btn win" onclick="KVP.Game.duelUI(\'upgrade\',' + o.slots.join(',') + ')">' +
        '🫴 <b>' + names + '</b><small>+' + trs + '</small></button>';
    }).join('') + '</div>';
  }

  /** Игрок обязан выбрать Персонажа, которого потеряют в Дуэли. */
  function duelNeedSacrifice(d) {
    d.needSacrifice = true;
    const totalAlive = S.run.team.filter(function (k) { return k.alive; }).length;
    if (!totalAlive) {
      d.needSacrifice = false;
      d.choiceHTML = '<div class="duel-note">Живых Рыцарей в команде не осталось.</div>';
      return;
    }
    const combo = ((d.theirs && d.theirs.kind === 'bot' && isComboBot(d.theirs.itemType)) ||
                   (d.mine && d.mine.kind === 'bot' && isComboBot(d.mine.itemType)));
    if (!d.sacrificeRequired) {
      d.sacrificeRequired = Math.min(combo ? 2 : 1, totalAlive);
    }
    if (!d.sacrificedCount) d.sacrificedCount = 0;

    let btns = '';
    S.run.team.forEach(function (k, i) {
      if (!k.alive) return;
      btns += '<button class="fight-btn bad" onclick="KVP.Game.duelUI(\'sacrifice\',' + i + ')">' +
        '<span>🔻 <b>' + KVP.escapeHtml(k.name) + '</b></span>' +
        '<small>Потерять' + (k.trophy ? ' · + ' + KVP.escapeHtml(KVP.TROPHIES[k.trophy.type].name) : ' · без Трофея') + '</small></button>';
    });

    /* Вторая фаза: потратить Трофей из-под Рыцаря, если он сам
       побеждает карту соперника. Игрок сам выбирает, у кого взять Трофей.
       После начала жертв выбор Трофея уже закрыт. */
    const salvage = d.sacrificedCount ? [] : duelSalvageOptions(d);
    let ch = '';
    if (salvage.length) {
      ch += '<div class="duel-phase">Вторая фаза · можно изменить исход</div>' +
        duelPhaseWarning(d) +
        duelSalvageButtons(salvage);
    }
    ch += '<div class="duel-note">' +
      (salvage.length ? 'Или потеряйте живого Рыцаря:' : 'Кого потерять:') + '</div>';
    ch += '<div class="fight-list">' + btns + '</div>';
    if (d.sacrificeRequired > 1) {
      ch += '<div class="duel-note">Нужно убрать ' + d.sacrificeRequired + ' Рыцарей.</div>';
    }
    d.choiceHTML = ch;
  }

  /** Ничья/проигрыш карты, но есть чем отбиться из Инвентаря: выбор только за игроком. */
  function duelSalvageOnly(d) {
    const salvage = duelSalvageOptions(d);
    if (!salvage.length) return false;
    d.needSacrifice = false;
    d.salvage = true;
    d.choiceHTML = '<div class="duel-phase">Вторая фаза · можно изменить исход</div>' +
      duelPhaseWarning(d) +
      duelSalvageButtons(salvage);
    if (d.recruitKnight) {
      d.choiceHTML += '<div class="duel-note">Иначе выпавший Рыцарь останется в команде.</div>';
    }
    return true;
  }

  /** Вскрытие карт Дуэли и применение исхода (правила Соло, раздел «Дуэль»). */
  function resolveDuel() {
    const d = S.pendingDuel;
    if (!d || d.stage === 'result') return;
    d.stage = 'result';
    const mine = d.mine, theirs = d.theirs;
    const v = duelVerdict(mine, theirs);
    if (mine && mine.kind === 'knight' && v === 'win') {
      addKnight(mine.itemType); KVP.Audio.play('pickup'); const dk = KVP.KNIGHTS[mine.itemType] || {}; UI.toast((dk.icon || '⚔️') + ' <b>' + KVP.escapeHtml(dk.name || 'Рыцарь') + '</b> из своей карты — в команду.', 'good', 3200);
    }
    const room = S.dungeon.rooms[d.roomId];
    const mineName = mine ? cardName(mine) : 'пусто';
    const theirsName = theirs ? cardName(theirs) : 'пусто';
    const layOut = mine && mine.kind === 'tile' ? mine : (theirs && theirs.kind === 'tile' ? theirs : null);
    const dragon = (mine && mine.kind === 'special' && mine.itemType === 'dragon') ||
      (theirs && theirs.kind === 'special' && theirs.itemType === 'dragon');

    if (layOut) {
      /* Местность у кого-либо выкладывается, вторая карта в сброс, дуэль кончается. */
      d.layOut = layOut;
      d.verdictClass = 'draw';
      d.verdictTitle = '🗺 На поле выкладывается карта Местности!';
      d.verdictText = '«' + KVP.escapeHtml(cardName(layOut)) + '» идёт в лабиринт, вторая карта — в сброс. Дуэль завершается, жетон остаётся.';
      S.logEvent('⚔ Дуэль: выложена Местность «' + cardName(layOut) + '», жетон остаётся.');
    } else if (dragon) {
      /* Дракон сжигает всю бумагу у всех и пугает одного Персонажа. */
      let burned = 0;
      S.run.team.forEach(function (k) {
        if (k.alive && k.trophy && k.trophy.type === 'paper') { k.trophy = null; burned++; }
      });
      for (let i = S.run.hand.length - 1; i >= 0; i--) {
        if (S.run.hand[i].type === 'paper') { S.run.hand.splice(i, 1); burned++; }
      }
      d.verdictClass = 'lose';
      d.verdictTitle = '🔥 Дракон сработал на обоих!';
      d.verdictText = 'Сожжено карт Бумаги: <b>' + burned + '</b>. Дракон пугает одного вашего Персонажа — выберите, кто уйдёт в сброс.';
      S.logEvent('🔥 Дракон в Дуэли: сожжено Бумаг ' + burned + ', нужен Персонаж в сброс.');
      duelNeedSacrifice(d);
      KVP.Audio.play('fail');
    } else if ((mine && mine.kind === 'special') || (theirs && theirs.kind === 'special')) {
      d.verdictClass = 'draw';
      d.verdictTitle = '✨ Спецкарта в Дуэли не играет';
      d.verdictText = 'По правилам Соло при Дуэли срабатывает только Дракон. Обе карты — в сброс, жетон остаётся.';
      S.logEvent('⚔ Дуэль: спецкарта не сработала — ничья.');
    } else if (v === 'win') {
      if (mine.kind === 'cell') {
        /* Клетка против Паробота соперника: ловишь и направляешь на него. */
        d.verdictClass = 'win';
        d.verdictTitle = '🪤 Пойман и направлен обратно!';
        d.verdictText = 'Клетка ловит «' + KVP.escapeHtml(theirsName) + '» и направляет его на соперника. Жетон сбегает, обе карты — в сброс.';
        S.run.stats.cellsCaught = (S.run.stats.cellsCaught || 0) + 1;
      } else if (mine.kind === 'bot') {
        /* ПароБот не разрушен Трофеем соперника — жетон сбегает.
           Для Рыцаря/Мага это «испуг», для Трофея — «выстоял». */
        if (theirs.kind === 'trophy') {
          d.verdictClass = 'win';
          d.verdictTitle = '🤖 ПароБот выстоял!';
          d.verdictText = 'Трофей соперника «' + KVP.escapeHtml(theirsName) +
            '» не разрушает вашего ПароБота «' + KVP.escapeHtml(mineName) +
            '». ПароБот обращает соперника в бегство — жетон сбегает. Трофей «' +
            KVP.escapeHtml(KVP.TROPHIES[theirs.itemType].name) + '» ваш — под свободного Рыцаря или в сброс.';
          addTrophy(theirs.itemType);
          S.logEvent('⚔ ' + mineName + ' выстоял против Трофея «' + theirsName + '» — жетон сбегает.');
        } else {
          d.verdictClass = 'win';
          d.verdictTitle = '🤖 ПароБот напугал соперника!';
          d.verdictText = '«' + KVP.escapeHtml(mineName) + '» напугал «' + KVP.escapeHtml(theirsName) +
            '» — соперник убегает, жетон врага сбегает.';
          S.logEvent('⚔ ' + mineName + ' напугал соперника «' + theirsName + '». Жетон сбегает.');
        }
      } else if (theirs.kind === 'bot') {
        if (mine.kind === 'trophy' && mine.itemType === 'trap') {
          d.verdictClass = 'win';
          d.verdictTitle = '🪤 Пойман Клеткой!';
          d.verdictText = 'Карта Клетки-ловушки из-под Рыцаря ловит «' + KVP.escapeHtml(theirsName) +
            '». ПароБот отправляется в «Победы», жетон убирается с карты Местности.';
          S.run.stats.cellsCaught = (S.run.stats.cellsCaught || 0) + 1;
          S.logEvent('⚔ Дуэль: Клетка из-под Рыцаря поймала ПароБота соперника.');
          captureDefeatedBot(theirs.itemType);
        } else if (mine.kind === 'trophy' && mine.itemType === 'bot') {
          d.verdictClass = 'win';
          d.verdictTitle = '🤖 Пойманный ПароБот уничтожил соперника!';
          d.verdictText = 'Пойманный ПароБот с вашей карты уничтожает «' + KVP.escapeHtml(theirsName) + '». Жетон сбегает.';
          S.logEvent('⚔ Дуэль: пойманный ПароБот уничтожил ПароБота соперника.');
          captureDefeatedBot(theirs.itemType);
        } else if (canDefeat(theirs.itemType, mine.itemType)) {
          d.verdictClass = 'win';
          d.verdictTitle = '⚔ Паробот соперника разрушен!';
          d.verdictText = '«' + KVP.escapeHtml(mineName) + '» разрушает «' + KVP.escapeHtml(theirsName) + '». ПароБот переходит в вашу коллекцию «Победа», жетон сбегает.';
          S.logEvent('⚔ ' + mineName + ' разрушает Паробота соперника — ПароБот в коллекции «Победа», жетон сбегает.');
          captureDefeatedBot(theirs.itemType);
        } else {
          /* Запасной путь: сюда не должны попадать при корректном duelVerdict.
             Но если попали — не тратим Трофей автоматически, а даём выбор. */
          const salvage = duelSalvageOptions(d);
          d.verdictClass = 'lose';
          d.verdictTitle = salvage.length ? '⚔ Можно взять Трофей у Рыцаря!' : '💀 ПароБота не разрушили!';
          d.verdictText = salvage.length
            ? 'Под Рыцарем есть подходящий Трофей — выберите, у кого взять, или потеряйте Рыцаря.'
            : 'Подходящего Трофея в Инвентаре нет — «' + KVP.escapeHtml(theirsName) + '» не разрушен. Вы обязаны потерять Рыцаря.';
          S.logEvent('⚔ Дуэль: Паробот соперника не разрушен — ' +
            (salvage.length ? 'предложен Трофей из Инвентаря.' : 'нужен Персонаж в сброс.'));
          duelNeedSacrifice(d);
        }
      } else {
        /* Трофей-победитель забирается себе (под Рыцаря при свободном месте). */
        addTrophy(theirs.itemType);
        d.verdictClass = 'win';
        d.verdictTitle = '🏆 Трофей забран!';
        d.verdictText = '«' + KVP.escapeHtml(mineName) + '» бьёт «' + KVP.escapeHtml(theirsName) + '». Трофей «' +
          KVP.escapeHtml(KVP.TROPHIES[theirs.itemType].name) + '» ваш — под свободного Рыцаря или в сброс. Жетон сбегает.';
      }
      if (d.verdictClass === 'win') {
        removeEnemyToken(room);
        KVP.Audio.play('coin');
        S.logEvent('⚔ Дуэль выиграна (' + mineName + ' против ' + theirsName + ') — жетон сбегает.');
      } else {
        KVP.Audio.play('bad');
      }
      updateHUD(); drawMinimap(true);
    } else if (v === 'lose') {
      if (theirs.kind === 'bot' && mine.kind === 'trophy') {
        const salvage = duelSalvageOptions(d);
        d.verdictClass = 'lose';
        d.verdictTitle = salvage.length ? '⚔ Прямо карта не бьёт — можно взять Трофей у Рыцаря!' : '💀 ПароБота не разрушили!';
        d.verdictText = salvage.length
          ? '«' + KVP.escapeHtml(mineName) + '» не разрушает «' + KVP.escapeHtml(theirsName) +
            '». Но под Рыцарем есть подходящий Трофей — выберите, у кого взять, или потеряйте Рыцаря.'
          : '«' + KVP.escapeHtml(mineName) + '» не разрушает «' + KVP.escapeHtml(theirsName) +
            '», а подходящего Трофея в Инвентаре нет. Вы обязаны потерять любого Рыцаря или Мага.';
        S.logEvent('⚔ Дуэль: Паробот соперника не разрушен — ' +
          (salvage.length ? 'предложен Трофей из Инвентаря.' : 'нужен Персонаж в сброс.'));
        duelNeedSacrifice(d);
      } else if (mine.kind === 'bot' && theirs.kind === 'trophy') {
        const salvage = duelSalvageOptions(d);
        d.verdictClass = 'lose';
        d.verdictTitle = salvage.length ? '⚔ Можно выложить карту из-под Рыцаря!' : '💀 Ваш ПароБот побеждён!';
        d.verdictText = salvage.length
          ? 'Трофей соперника бьёт вашего ПароБота. Рыцарь не теряется: в сброс уходит только карта ПароБота. Можно выложить встречную карту из-под Рыцаря — выберите, у кого взять.'
          : 'Трофей соперника бьёт вашего ПароБота. В сброс уходит только карта ПароБота — Рыцарь не теряется. Жетон врага остаётся.';
        S.logEvent('⚔ Дуэль: ваш ПароБот побеждён Трофеем соперника — Рыцарь не потерян' +
          (salvage.length ? ', предложена карта из-под Рыцаря.' : '.'));
        if (salvage.length) duelSalvageOnly(d);
      } else if (mine.kind === 'bot' && theirs.kind === 'cell') {
        d.verdictClass = 'lose';
        d.verdictTitle = '🚤 Ваш ПароБот пойман!';
        d.verdictText = 'Клетка соперника ловит вашего ПароБота «' + KVP.escapeHtml(mineName) + '» — обе карты в сброс, жетон остаётся. Рыцарь не теряется.';
        S.logEvent('⚔ Дуэль: ваш ПароБот пойман Клеткой соперника.');
      } else if (mine.kind === 'bot') {
        d.verdictClass = 'lose';
        d.verdictTitle = '⚔ Дуэль проиграна';
        d.verdictText = '«' + KVP.escapeHtml(mineName) + '» проигрывает «' + KVP.escapeHtml(theirsName) + '». Обе — в сброс, жетон врага остаётся на карте Местности. Рыцарь не теряется.';
        S.logEvent('⚔ Дуэль проиграна (' + mineName + ' против ' + theirsName + ').');
      } else if (theirs.kind === 'bot') {
        /* Рыцарь/иная карта без оружия против ПароБота: это не ничья.
           Вторая фаза даёт выложить Трофей из-под Рыцаря или убрать Рыцаря. */
        const salvage = duelSalvageOptions(d);
        d.verdictClass = 'lose';
        d.verdictTitle = salvage.length
          ? '⚔ Рыцарь сам не бьёт — можно выложить Трофей или потерять его!'
          : '💀 Рыцарь не может победить ПароБота — но вы можете его потерять!';
        d.verdictText = '«' + KVP.escapeHtml(mineName) + '» не побеждает «' + KVP.escapeHtml(theirsName) + '». ' +
          (salvage.length
            ? 'Можно выложить подходящий Трофей из-под Рыцаря — или вы можете его потерять.'
            : 'Подходящего Трофея под Рыцарями нет — но вы можете его потерять: выберите, кого убрать из команды.') +
          (isComboBot(theirs.itemType)
            ? ' Для комбо-ПароБота нужны два Трофея с разных Рыцарей или Клетка-ловушка.' : '');
        S.logEvent('⚔ Дуэль: ' + mineName + ' не побеждает ' + theirsName + ' — ' +
          (salvage.length ? 'предложен Трофей из-под Рыцаря.' : 'нужно убрать Рыцаря.'));
        duelNeedSacrifice(d);
      } else {
        const salvage = duelSalvageOptions(d);
        d.verdictClass = 'lose';
        if (salvage.length) {
          d.verdictTitle = '⚔ Можно выложить карту из-под Рыцаря!';
          d.verdictText = '«' + KVP.escapeHtml(mineName) + '» проигрывает «' + KVP.escapeHtml(theirsName) +
            '». Можно выложить карту из-под Рыцаря, которая бьёт карту соперника — выберите, у кого взять, или завершите дуэль.';
          S.logEvent('⚔ Дуэль проиграна картой, но есть Трофей для отбоя.');
          duelSalvageOnly(d);
        } else {
          d.verdictTitle = '💀 Дуэль проиграна';
          d.verdictText = '«' + KVP.escapeHtml(mineName) + '» проигрывает «' + KVP.escapeHtml(theirsName) + '». Обе карты — в сброс, жетон врага остаётся на карте Местности (накопится до трёх — и конец).';
          S.logEvent('⚔ Дуэль проиграна (' + mineName + ' против ' + theirsName + ').');
        }
      }
      KVP.Audio.play('bad');
    } else {
      const salvage = duelSalvageOptions(d);
      const drawnKnight = (mine && mine.kind === 'knight') ? mine.itemType : null;
      const canChange = !!(drawnKnight && salvage.length);
      if (drawnKnight && !salvage.length) {
        addKnight(drawnKnight);
        KVP.Audio.play('pickup');
        const dk = KVP.KNIGHTS[drawnKnight] || {};
        UI.toast((dk.icon || '⚔️') + ' <b>' + KVP.escapeHtml(dk.name || 'Рыцарь') +
          '</b> из своей карты — в команду.', 'good', 3200);
        S.logEvent('⚔ Дуэль: Рыцарь «' + (dk.name || drawnKnight) + '» из ничьей вступает в команду.');
      }
      if (canChange) d.recruitKnight = drawnKnight;
      const enemyKnightNote = (theirs && theirs.kind === 'knight')
        ? ' Рыцарь соперника не переходит в вашу команду — в команду идёт только ваш вытянутый Рыцарь.'
        : '';
      d.verdictClass = 'draw';
      if (salvage.length) {
        d.verdictTitle = drawnKnight
          ? '🤝 Ничья — изменить исход или забрать Рыцаря?'
          : '🤝 Ничья — но можно выложить карту из-под Рыцаря!';
        d.verdictText = 'Карты не решили исход (' + KVP.escapeHtml(mineName) + ' / ' + KVP.escapeHtml(theirsName) + ').' +
          (drawnKnight
            ? ' Можно изменить исход дуэли, выложив Трофей из-под Рыцаря; тогда выпавший Рыцарь уйдёт в сброс. Иначе заберите его в команду.'
            : ' Можно выложить карту из-под Рыцаря, которая бьёт карту соперника, — выберите, у кого взять, или завершите дуэль.') +
          enemyKnightNote;
        S.logEvent('⚔ Дуэль: ничья, но есть карта из-под Рыцаря для отбоя.' +
          (drawnKnight ? ' Рыцарь ждёт выбора: Трофей или команда.' : ''));
        duelSalvageOnly(d);
      } else {
        d.verdictTitle = '🤝 Ничья';
        d.verdictText = drawnKnight
          ? 'Карты не решили исход (' + KVP.escapeHtml(mineName) + ' / ' + KVP.escapeHtml(theirsName) +
            '). Выпавший Рыцарь «' + KVP.escapeHtml(mineName) + '» вступает в команду, карта соперника — в сброс, жетон остаётся.'
          : 'Карты одного вида либо без взаимного действия (' + KVP.escapeHtml(mineName) + ' / ' + KVP.escapeHtml(theirsName) +
            '). Обе — в сброс, жетон остаётся.';
        d.verdictText += enemyKnightNote;
        S.logEvent('⚔ Дуэль: ничья (' + mineName + ' / ' + theirsName + ').' +
          (drawnKnight ? ' Рыцарь вступает в команду.' : '') +
          (theirs && theirs.kind === 'knight' ? ' Рыцарь соперника в команду не переходит.' : ''));
      }
    }
    updateHUD(); drawMinimap(true); saveRun();
  }

  G.duelUI = function (action, idx, idx2) {
        if (action === 'botreplace') { if (!S.pendingDuel || S.pendingDuel.replacedOnce) return; const k = S.run.team.find(function(t){return t.alive && t.trophy && t.trophy.type === 'bot';}); if (!k) return; k.trophy = null; S.pendingDuel.mine = { kind: 'trophy', itemType: 'bot' }; S.pendingDuel.replacedOnce = true; S.turn.drawn = true; showModal('⚔ ДУЭЛЬ!', duelHTML(), 'playing', true); updateHUD(); return; }
    if (action === 'magsac') { const d2=S.pendingDuel; if(!d2 || !d2.theirs || d2.theirs.kind !== 'bot') return; const mag=S.run.team.find(function(t){ return t.alive && t.type==='mag'; }); if (!mag) return; mag.alive = false; if (mag.trophy) mag.trophy = null; d2.mine = { kind: 'trophy', itemType: 'bot' }; d2.replacedOnce = true; S.turn.drawn = true; UI.toast('🧙 Маг принят в жертву — бот уничтожен.', 'good', 3000); showModal('⚔ ДУЭЛЬ!', duelHTML(), 'playing', true); updateHUD(); return; }

    const d = S.pendingDuel;
    if (!d) return;

    if (action === 'reveal') {
      resolveDuel();
      const b0 = el('modal-body');
      if (b0) b0.innerHTML = duelHTML();
      return;
    }

    if (action === 'sacrifice') {
      const k = S.run.team[idx];
      if (!k || !k.alive) return;
      k.alive = false;
      const tr = k.trophy ? ' и ' + KVP.TROPHIES[k.trophy.type].name : '';
      k.trophy = null;
      S.run.stats.lost = (S.run.stats.lost || 0) + 1;
      d.sacrificedCount = (d.sacrificedCount || 0) + 1;
      if (d.sacrificedCount < (d.sacrificeRequired || 1)) {
        const left = (d.sacrificeRequired || 1) - d.sacrificedCount;
        const note = '<div class="duel-note"><b>' + KVP.escapeHtml(k.name) + '</b>' + KVP.escapeHtml(tr) + ' уничтожен(ы). Нужно выбрать ещё ' + left + ' Рыцаря.</div>';
        duelNeedSacrifice(d);              /* заново строим кнопки для оставшихся */
        d.choiceHTML = note + d.choiceHTML;
        const bn = el('modal-body'); if (bn) bn.innerHTML = duelHTML(); updateHUD(); saveRun(); KVP.Audio.play('denied'); return;
      }
      d.needSacrifice = false;
      d.choiceHTML = '<div class="duel-note">В сброс ушёл: <b>' + KVP.escapeHtml(k.name) + '</b>' + KVP.escapeHtml(tr) + '.</div>';
      S.logEvent('💀 ' + k.name + tr + ' потерян' + (tr ? 'ы' : '') + ' в Дуэли.');
      UI.toast('💀 ' + k.name + tr + ' — ушёл в сброс.', 'bad', 3000);
      KVP.Audio.play('gameover');
      if (S.selectedSlot === idx) S.selectedSlot = firstUsableSlot();
      const b1 = el('modal-body');
      if (b1) b1.innerHTML = duelHTML();
      updateHUD(); drawMinimap(true); saveRun();
      return;
    }

    if (action === 'upgrade') {
      if (!d || !d.theirs || (!d.needSacrifice && !d.salvage)) return;
      const kk = S.run.team[idx];
      if (!kk || !kk.alive || !kk.trophy) return;

      if (d.theirs.kind === 'bot') {
        if (idx2 != null) {
          const k2 = S.run.team[idx2];
          if (!k2 || !k2.alive || !k2.trophy) return;
          const trA = kk.trophy.type, trB = k2.trophy.type;
          const plan = botDefeatPlan(d.theirs.itemType, [trA, trB]);
          if (!plan.ok) return;
          kk.trophy = null; k2.trophy = null;
          d.recruitKnight = null;
          d.needSacrifice = false;
          d.salvage = false;
          d.upgraded = true;
          captureDefeatedBot(d.theirs.itemType);
          removeEnemyToken(S.dungeon.rooms[d.roomId]);
          d.verdictClass = 'win';
          d.verdictTitle = '⚔ Отбито двумя Трофеями Рыцарей!';
          d.verdictText = '<b>' + KVP.escapeHtml(kk.name) + '</b> и <b>' + KVP.escapeHtml(k2.name) + '</b> отбивают комбо-ПароБота — он разрушен.';
          d.choiceHTML = '<div class="duel-note">Трофеи использованы: <b>' +
            KVP.escapeHtml(KVP.TROPHIES[trA].name) + '</b> и <b>' + KVP.escapeHtml(KVP.TROPHIES[trB].name) + '</b>.</div>';
          const b2 = el('modal-body'); if (b2) b2.innerHTML = duelHTML();
          updateHUD(); drawMinimap(true); saveRun(); KVP.Audio.play('coin');
          return;
        }
        const tr = kk.trophy.type;
        if (!(tr === 'trap' || canDefeat(d.theirs.itemType, tr))) return;
        kk.trophy = null;
        d.mine = { kind: 'trophy', itemType: tr };
        d.recruitKnight = null;
        if (tr === 'trap') {
          S.run.stats.cellsUsed = (S.run.stats.cellsUsed || 0) + 1;
          S.run.cells = S.run.team.filter(function (k) { return k.alive && k.trophy && k.trophy.type === 'trap'; }).length;
        }
        d.needSacrifice = false;
        d.salvage = false;
        d.upgraded = true;
        captureDefeatedBot(d.theirs.itemType);
        removeEnemyToken(S.dungeon.rooms[d.roomId]);
        d.verdictClass = 'win';
        d.verdictTitle = tr === 'trap' ? '🪤 Пойман Клеткой!' : '⚔ Отбито Трофеем Рыцаря!';
        d.verdictText = '<b>' + KVP.escapeHtml(kk.name) + '</b> ' +
          (tr === 'trap'
            ? 'ловит «' + KVP.escapeHtml(d.theirs.itemType && KVP.BOTS[d.theirs.itemType] ? KVP.BOTS[d.theirs.itemType].name : 'ПароБота') + '» Клеткой-ловушкой.'
            : 'отбивает ' + KVP.escapeHtml(KVP.TROPHIES[tr].name) + ' — ПароБот соперника разрушен.');
        d.choiceHTML = '<div class="duel-note">Трофей Рыцаря использован: <b>' + KVP.escapeHtml(KVP.TROPHIES[tr].name) + '</b>.</div>';
        const b2 = el('modal-body'); if (b2) b2.innerHTML = duelHTML();
        updateHUD(); drawMinimap(true); saveRun(); KVP.Audio.play('coin');
        return;
      }

      if (d.theirs.kind === 'trophy') {
        const tr = kk.trophy.type;
        if (tr === d.theirs.itemType || !trophyBeats(tr, d.theirs.itemType)) return;
        const replacedKnight = d.recruitKnight;
        kk.trophy = null;
        d.mine = { kind: 'trophy', itemType: tr };
        d.recruitKnight = null;
        d.needSacrifice = false;
        d.salvage = false;
        d.upgraded = true;
        addTrophy(d.theirs.itemType);
        removeEnemyToken(S.dungeon.rooms[d.roomId]);
        d.verdictClass = 'win';
        d.verdictTitle = '⚔ Отбито Трофеем Рыцаря!';
        d.verdictText = '<b>' + KVP.escapeHtml(kk.name) + '</b> отбивает ' + KVP.escapeHtml(KVP.TROPHIES[tr].name) +
          ' и забирает ' + KVP.escapeHtml(KVP.TROPHIES[d.theirs.itemType].name) +
          ' — под свободного Рыцаря или в сброс.';
        d.choiceHTML = '<div class="duel-note">Трофей Рыцаря использован: <b>' + KVP.escapeHtml(KVP.TROPHIES[tr].name) + '</b>.</div>' +
          (replacedKnight ? '<div class="duel-note">Выпавший Рыцарь ушёл в сброс.</div>' : '');
        const b2 = el('modal-body'); if (b2) b2.innerHTML = duelHTML();
        updateHUD(); drawMinimap(true); saveRun(); KVP.Audio.play('coin');
        return;
      }
    }

  if (action === 'done') {
      if (d.needSacrifice) {
        UI.toast('Сначала выберите Персонажа, которого потеряете.', 'bad', 2200);
        return;
      }
      if (d.recruitKnight) {
        const rec = d.recruitKnight;
        d.recruitKnight = null;
        addKnight(rec);
        const dk = KVP.KNIGHTS[rec] || {};
        KVP.Audio.play('pickup');
        UI.toast((dk.icon || '⚔️') + ' <b>' + KVP.escapeHtml(dk.name || 'Рыцарь') +
          '</b> из своей карты — в команду.', 'good', 3200);
        S.logEvent('⚔ Дуэль: Рыцарь «' + (dk.name || rec) + '» вступает в команду.');
      }
      const layOut = d.layOut || null;
      const noTeam = !S.run.team.some(function (x) { return x.alive; });
      S.pendingDuel = null;
      S.modalOnClose = null;
      closeModal();
      updateHUD(); drawMinimap(true); saveRun();
      if (noTeam) { scheduleGameOver(500); return; }
      /* Карта Местности из Дуэли выкладывается на поле — как в настоящей игре. */
      if (layOut) setTimeout(function () { openTilePlacement(layOut); }, 300);
      return;
    }
  };

  function rebuildWorld() {
    if (S.worldObj && S.worldObj.root && S.worldObj.root.parent) {
      S.worldObj.root.parent.remove(S.worldObj.root);
    }
    S.worldObj = KVP.M3.buildWorld(worldRoot, S.dungeon);
  }

  /* ------------------------------------------------------------------ */
  /*  ЖЕТОНЫ ВРАГА В МИРЕ                                                */
  /* ------------------------------------------------------------------ */
  /* Жетон = враг, вставший на карту Местности. Рисуем его моделью
     Рыцаря-соперника по кругу вокруг центра комнаты; число моделей =
     число жетонов (до трёх). Игрок стоит в центре, поэтому враги
     расставлены по четырём сторонам света — куда ни посмотри, враг виден. */
  const TOKEN_SPOTS = [
    { x: 0, z: -1 },   // север
    { x: 1, z: 0 },    // восток
    { x: 0, z: 1 },    // юг
    { x: -1, z: 0 }    // запад
  ];
  function refreshTokens() {
    if (!tokenRoot) return;
    while (tokenRoot.children.length) {
      const o = tokenRoot.children[0];
      tokenRoot.remove(o);
    }
    S.tokens = [];
    if (!S.run || !S.run.map || !S.dungeon || !KVP.M3.makeKnight) return;
    /* Сопоставляем карту Местности и комнату по клетке, а не по индексу —
       порядок в run.map и в dungeon.rooms может различаться. */
    for (let i = 0; i < S.dungeon.rooms.length; i++) {
      const room = S.dungeon.rooms[i];
      if (!room) continue;
      const entry = mapEntryByCell(room.gx, room.gz);
      const n = entry && entry.enemies ? entry.enemies : 0;
      if (!n) continue;
      const c = S.dungeon.center(room);
      for (let t = 0; t < n; t++) {
        const spot = TOKEN_SPOTS[t % TOKEN_SPOTS.length];
        const dist = 2.1 + (t >= 4 ? 0.7 * ((t / 4) | 0) : 0);
        const mesh = KVP.M3.makeKnight('swordsman', { foe: true, scale: 0.8 });
        mesh.position.set(c.x + spot.x * dist, 0, c.y + spot.z * dist);
        mesh.rotation.y = Math.atan2(-spot.x, -spot.z);
        // Номер жетона — видно, что их копится до трёх (выше подписи «ВРАГ»)
        const tag = KVP.M3.makeLabelSprite('ЖЕТОН ' + (t + 1) + '/3', 'rgba(46,10,8,.92)', '#ffb3a6');
        tag.position.y = 1.78;
        tag.scale.set(0.9, 0.23, 1);
        mesh.add(tag);
        tokenRoot.add(mesh);
        S.tokens.push({ mesh: mesh, room: i, phase: Math.random() * 6.28 });
      }
    }
  }

  function animateTokens() {
    if (!S.tokens || !S.tokens.length) return;
    const t = performance.now() * 0.001;
    for (let i = 0; i < S.tokens.length; i++) {
      const tk = S.tokens[i];
      tk.mesh.position.y = Math.abs(Math.sin(t * 2.4 + tk.phase)) * 0.05;
      tk.mesh.rotation.y += 0.006;
    }
  }

  function placeChestForTile(room) {
    if (!room || room.type !== 'chest') return;
    for (let i = 0; i < S.chests.length; i++) {
      if (S.chests[i].roomId === room.id) return;
    }
    const c = S.dungeon.center(room);
    const mesh = KVP.M3.makeChest();
    mesh.position.set(c.x, 0, c.y);
    entityRoot.add(mesh);
    S.chests.push({
      id: KVP.uid('chest'), x: c.x, z: c.y,
      mesh: mesh, opened: false, roomId: room.id
    });
  }

  function openVictoryChest(tile) {
    const ch = S.chests.filter(function (c) { return c.roomId === tile.id; })[0] || null;
    if (ch && !ch.opened) {
      ch.opened = true;
      if (ch.mesh && ch.mesh.userData.lid) ch.mesh.userData.lid.rotation.x = -1.1;
    }
    KVP.Audio.play('chest');
    UI.toast('💰 <b>Сундук найден!</b> Лабиринт пройден.', 'gold', 5000);
    setTimeout(function () { showVictory(); }, 700);
  }

  function roomDistances(startId) {
    const dist = {};
    const q = [startId];
    dist[startId] = 0;
    while (q.length) {
      const id = q.shift();
      const t = S.dungeon.rooms[id];
      if (!t) continue;
      for (let i = 0; i < 4; i++) {
        const d = ['n', 'e', 's', 'w'][i];
        if (!S.dungeon.passage(t, d)) continue;
        const n = S.dungeon.neighborCell(t.gx, t.gz, d);
        const nt = S.dungeon.tileAt(n.gx, n.gz);
        if (nt && dist[nt.id] == null) {
          dist[nt.id] = dist[id] + 1;
          q.push(nt.id);
        }
      }
    }
    return dist;
  }

  /**
   * Конец игры: карта Местности с Сундуком лежит в колоде ПОСЛЕДНЕЙ картой.
   * Игрок вытягивает её, выкладывает на поле (вход — с соседней карты)
   * и идёт до Сундука. Если колода пуста, а Сундук на поле не попал —
   * по правилам соло-режима игрок проигрывает.
   */
  function maybePlaceChest() {
    if (!S.run || S.run.chestPlaced) return;
    /* Карта с Сундуком ещё в колоде — всё в порядке. */
    const deck = S.run.deck || [];
    for (let i = 0; i < deck.length; i++) {
      if (deck[i].kind === 'tile' && deck[i].itemType === KVP.CHEST_TILE.id) return;
    }
    /* Карта вытянута и ждёт решения — не мешаем игроку. */
    if (S.pendingCard || S.pendingTile || S.pendingFight || S.pendingDuel) return;
    /* Колода пуста, а Сундук не на поле — по правилам это поражение. */
    if (!deck.length) {
      S.logEvent('💀 Колода пуста, а карта с Сундуком не выложена — поражение.');
      UI.toast('💀 Колода пуста, а карта с Сундуком не на поле — по правилам это поражение.', 'bad', 6000);
      gameOver();
    }
  }

  function endTurn() {
    if (S.mode !== 'playing' || !S.player) return;
    if (S.stepAnim) return;
    if (S.pendingFight) {
      UI.toast('Сначала завершите бой с ПароБотом.', 'info', 2000);
      KVP.Audio.play('denied');
      return;
    }
    if (S.pendingTile) {
      UI.toast('Действие 2 не закончено: пристройте вытянутую карту Местности.', 'info', 2400);
      flashStep(2);
      KVP.Audio.play('denied');
      return;
    }
    if (S.pendingCard) {
      UI.toast('Вытянутая карта ждёт решения — кликните её на столе или перетащите на Рыцаря.', 'info', 2800);
      flashReveal();
      KVP.Audio.play('denied');
      return;
    }
    if (!step1Done() && canMoveNow()) {
      UI.toast('Обязательное <b>действие 1</b> — переход: выберите комнату перехода на карте.', 'bad', 2600);
      flashStep(1);
      KVP.Audio.play('denied');
      return;
    }
    const deckLen = S.run && S.run.deck ? S.run.deck.length : 0;
    if (!S.turn.drawn && deckLen) {
      UI.toast('Действие 2 не выполнено: обязательно возьмите карту из колоды.', 'bad', 2600);
      flashStep(2);
      KVP.Audio.play('denied');
      return;
    }
    S.turn = { moved: false, skipped: false, drawn: false, number: (S.turn.number || 1) + 1 };
    maybePlaceChest();
    updateHUD();
    KVP.Audio.play('click');
  }

  /**
   * Автопереход к новому ходу: если у игрока не осталось НИ ОДНОГО действия
   * (ход уже сделан, колода пуста и шагнуть некуда), показываем плашку
   * «Новый ход N» и открываем следующий ход сами.
   *
   * S.autoTurnLock не даёт перескочить через несколько ходов подряд:
   * он снимается, только когда игрок реально что-то сделал.
   */
  function maybeAutoNextTurn() {
    if (S.mode !== 'playing' || !S.run || !S.player) return;
    if (S.stepAnim || S.pendingCard || S.pendingTile || S.pendingFight) return;
    const deckLen = S.run.deck ? S.run.deck.length : 0;
    /* Действие 1 ещё доступно? */
    if (!step1Done() && canMoveNow()) return;
    /* Действие 2 ещё доступно? */
    if (!S.turn.drawn && deckLen > 0) return;
    /* Игрок не может ничего делать — автозавершаем ход (даже если lock висел). */
    S.autoTurnLock = false;
    /* Ничего не осталось — переходим к новому ходу. */
    S.autoTurnLock = true;
    const num = (S.turn.number || 1) + 1;
    S.turn = { moved: false, skipped: false, drawn: false, number: num };
    maybePlaceChest();
    updateHUD();
    updateTurnBar();
    KVP.Audio.play('click');
    showTurnBanner(num);
  }

  /** Плашка «Новый ход N» — крупно, по центру окна, на 2.5 секунды. */
  function showTurnBanner(num) {
    const host = el('turn-banner');
    if (!host) return;
    host.innerHTML = '<span class="tb-num">НОВЫЙ ХОД ' + num + '</span>' +
      '<span class="tb-sub">действий не осталось — ход переходит дальше</span>';
    host.classList.remove('show');
    void host.offsetWidth;
    host.classList.add('show');
    clearTimeout(S._turnBannerTimer);
    S._turnBannerTimer = setTimeout(function () {
      host.classList.remove('show');
    }, 2500);
  }

  /** Игрок начал действовать — автопереход снова разрешён. */
  function unlockAutoTurn() {
    S.autoTurnLock = false;
  }

  function updateCamera() {
    const p = S.player;
    if (!p) return;
    const bob = p.moving ? Math.sin(p.walkPhase) * 0.035 : Math.sin(p.walkPhase) * 0.008;
    const sh = S.shake;
    camera.position.set(
      p.x + (Math.random() - 0.5) * sh,
      KVP.M3.EYE + bob + (Math.random() - 0.5) * sh * 0.5,
      p.z + (Math.random() - 0.5) * sh
    );
    camera.rotation.y = p.yaw + (Math.random() - 0.5) * sh * 0.3;
    camera.rotation.x = p.pitch + (Math.random() - 0.5) * sh * 0.3;
    camera.rotation.z = 0;
  }

  function syncRunHp() {
    if (S.run && S.player) S.run.hp = Math.round(S.player.hp);
  }

  function updateFlow(dt) {
    S.flowTimer -= dt;
    if (S.flowTimer <= 0) {
      S.flowTimer = 0.35;
      S.dungeon.computeFlow(S.player.x, S.player.z);
    }
  }

  function teamPower() {
    if (!S.run) return 0;
    let n = 0;
    for (let i = 0; i < S.run.team.length; i++) {
      const k = S.run.team[i];
      if (k.alive && k.type !== 'mag') n += KVP.KNIGHTS[k.type].bonus;
    }
    return n;
  }

  /* Сила всех Трофеев, которые сейчас лежат у живых Рыцарей. */
  function teamTrophyPower() {
    if (!S.run) return 0;
    let n = 0;
    for (let i = 0; i < S.run.team.length; i++) {
      const k = S.run.team[i];
      if (!k.alive || !k.trophy) continue;
      const tr = KVP.TROPHIES[k.trophy.type];
      if (tr && tr.force) n += tr.force;
    }
    return n;
  }

  /* Итоговая сила команды для отображения: все Рыцари + все Трофеи. */
  function teamTotalPower() {
    return teamPower() + teamTrophyPower();
  }

  function aliveBots() {
    let n = 0;
    for (let i = 0; i < S.bots.length; i++) if (S.bots[i].alive) n++;
    return n;
  }

  /* ================================================================== */
  /*  БОТЫ                                                              */
  /* ================================================================== */
  function updateBots(dt) {
    const p = S.player;
    for (let i = 0; i < S.bots.length; i++) {
      const b = S.bots[i];
      if (!b.alive) continue;
      const def = KVP.BOTS[b.type];
      const diff = KVP.DIFFICULTY[S.run.difficulty] || KVP.DIFFICULTY.normal;

      if (b.stun > 0) {
        b.stun -= dt;
        b.mesh.position.y = Math.sin(performance.now() * 0.006 + b.phase) * 0.02;
        b.mesh.rotation.z = Math.sin(performance.now() * 0.004 + b.phase) * 0.12;
        if (b.stun <= 0) {
          b.mesh.rotation.z = 0;
          if (b.stunSprite && b.stunSprite.parent) b.stunSprite.parent.remove(b.stunSprite);
          b.stunSprite = null;
        }
        continue;
      }

      const dx = p.x - b.x, dz = p.z - b.z;
      const dist = Math.sqrt(dx * dx + dz * dz) || 0.001;
      const los = S.dungeon.lineOfSight(b.x, b.z, p.x, p.z);
      const inRoom = S.dungeon.roomAtPos(b.x, b.z) === S.currentRoom;

      if (!b.alert && ((dist < 8.5 && los) || inRoom)) {
        b.alert = true;
        b.shotCd = Math.max(b.shotCd, 1.0);
        b.patrol = null;
      }

      b.moving = false;
      if (b.alert) {
        b.mesh.rotation.y = Math.atan2(dx, dz);
        if (los && dist < 10) {
          // держим дистанцию и стреляем
          b.shotCd -= dt;
          if (b.shotCd <= 0) {
            fireBotProjectile(b);
            b.shotCd = def.fireCd * diff.fireCd * (0.85 + Math.random() * 0.35);
          }
          let sx = 0, sz = 0;
          if (dist < 2.4) { sx = -dx / dist; sz = -dz / dist; }
          else if (dist > 7) { sx = dx / dist; sz = dz / dist; }
          else {
            const strafe = Math.sin(performance.now() * 0.0012 + b.phase);
            sx = -dz / dist * strafe * 0.55;
            sz = dx / dist * strafe * 0.55;
          }
          // расталкивание
          const sep = separation(b);
          sx += sep.x; sz += sep.z;
          moveBot(b, sx, sz, def.speed * diff.speed * dt * 0.55);
        } else {
          followFlow(b, def.speed * diff.speed * dt * 0.78);
        }
      } else {
        patrolBot(b, dt, def.speed * diff.speed);
      }

      animateBot(b, dt);
    }
  }

  function separation(b) {
    let sx = 0, sz = 0;
    for (let i = 0; i < S.bots.length; i++) {
      const o = S.bots[i];
      if (o === b || !o.alive) continue;
      const dx = b.x - o.x, dz = b.z - o.z;
      const d = Math.sqrt(dx * dx + dz * dz);
      if (d > 0.01 && d < 0.85) {
        sx += dx / d * (0.85 - d) * 1.8;
        sz += dz / d * (0.85 - d) * 1.8;
      }
    }
    return { x: sx, z: sz };
  }

  function moveBot(b, sx, sz, step) {
    const len = Math.sqrt(sx * sx + sz * sz);
    if (len < 0.001) return;
    sx /= len; sz /= len;
    const moved = S.dungeon.moveCircle(b.x, b.z, sx * step, sz * step, 0.3);
    if (moved.x !== b.x || moved.z !== b.z) {
      b.x = moved.x; b.z = moved.z;
      b.moving = true;
      b.mesh.rotation.y = Math.atan2(sx, sz);
    }
  }

  function followFlow(b, step) {
    const next = S.dungeon.nextStep(b.x, b.z);
    if (!next) return;
    const dx = next.x - b.x, dz = next.z - b.z;
    moveBot(b, dx, dz, step);
  }

  function patrolBot(b, dt, speed) {
    b.patrolTimer -= dt;
    if (!b.patrol || b.patrolTimer <= 0) {
      const room = S.dungeon.rooms[b.homeRoom];
      if (!room) return;
      b.patrol = S.dungeon.randomSpot(room, 1.5, 0.7);
      b.patrolTimer = 2.5 + Math.random() * 3.5;
    }
    const dx = b.patrol.x - b.x, dz = b.patrol.y - b.z;
    const d = Math.sqrt(dx * dx + dz * dz);
    if (d < 0.35) { b.patrol = null; return; }
    moveBot(b, dx, dz, Math.min(d, speed * 0.5 * dt));
  }

  function animateBot(b, dt) {
    const t = performance.now() * 0.001;
    const bob = b.moving ? Math.abs(Math.sin(t * 8 + b.phase)) * 0.035 : Math.sin(t * 2.2 + b.phase) * 0.012;
    b.mesh.position.y = bob;
    b.mesh.position.x = b.x;
    b.mesh.position.z = b.z;
    const ud = b.mesh.userData;
    if (ud.legL) ud.legL.rotation.x = b.moving ? Math.sin(t * 9 + b.phase) * 0.4 : 0;
    if (ud.legR) ud.legR.rotation.x = b.moving ? -Math.sin(t * 9 + b.phase) * 0.4 : 0;
    if (ud.armL) ud.armL.rotation.x = b.moving ? -Math.sin(t * 9 + b.phase) * 0.3 : 0;
    if (ud.armR) ud.armR.rotation.x = b.moving ? Math.sin(t * 9 + b.phase) * 0.3 : 0;
  }

  function fireBotProjectile(b) {
    const p = S.player;
    const dx = p.x - b.x, dz = p.z - b.z;
    const dist = Math.sqrt(dx * dx + dz * dz) || 1;
    const diff = KVP.DIFFICULTY[S.run.difficulty] || KVP.DIFFICULTY.normal;
    const hardLike = S.run.difficulty === 'hard' || S.run.difficulty === 'extreme';
    const spread = (isComboBot(b.type) ? 0.06 : 0.1) * (S.run.difficulty === 'easy' ? 1.4 : (hardLike ? 0.7 : 1));
    const angles = isComboBot(b.type) ? [-0.14, 0, 0.14] : [0];
    for (let k = 0; k < angles.length; k++) {
      const a = Math.atan2(dx, dz) + angles[k] + (Math.random() - 0.5) * spread * 2;
      const speed = (isComboBot(b.type) ? 3.1 : 3.5) * (S.run.difficulty === 'easy' ? 0.85 : (hardLike ? 1.18 : 1));
      const mesh = KVP.M3.makeProjectile(isComboBot(b.type) ? 0xff5a3e : 0xffa64a);
      mesh.position.set(b.x, 0.7, b.z);
      entityRoot.add(mesh);
      S.projectiles.push({
        x: b.x, z: b.z, y: 0.72,
        dx: Math.sin(a), dz: Math.cos(a),
        speed: speed,
        damage: KVP.BOTS[b.type].damage * (1 + S.run.floorIndex * 0.12) * diff.damage,
        mesh: mesh, life: 0
      });
    }
    KVP.Audio.play('enemyShot');
  }

  function updateProjectiles(dt) {
    for (let i = S.projectiles.length - 1; i >= 0; i--) {
      const pr = S.projectiles[i];
      pr.life += dt;
      const nx = pr.x + pr.dx * pr.speed * dt;
      const nz = pr.z + pr.dz * pr.speed * dt;
      let dead = false;
      if (S.dungeon.isSolid(nx, nz)) {
        dead = true;
        KVP.M3.spawnBurst(scene, nx, 0.7, nz, 0xffa64a, 8, 0.5);
      } else {
        pr.x = nx; pr.z = nz;
        pr.mesh.position.set(pr.x, pr.y, pr.z);
      }
      if (!dead && S.player && KVP.dist2(pr.x, pr.z, S.player.x, S.player.z) < 0.3 * 0.3) {
        dead = true;
        damagePlayer(pr.damage);
      }
      if (dead || pr.life > 5) {
        if (pr.mesh.parent) pr.mesh.parent.remove(pr.mesh);
        S.projectiles.splice(i, 1);
      }
    }
  }

  function damagePlayer(amount) {
    if (S.invuln > 0 || S.mode !== 'playing') return;
    const p = S.player;
    p.hp -= amount;
    S.invuln = 0.5;
    S.shake = 0.16;
    KVP.Audio.play('hurt');
    flashDamage();
    updateHUD();
    if (p.hp <= 0) handleDown();
  }

  function flashDamage() {
    const f = el('damage-flash');
    if (!f) return;
    f.classList.remove('hit');
    void f.offsetWidth;
    f.classList.add('hit');
  }

  function handleDown() {
    if (S.mode !== 'playing') return;
    const p = S.player;
    if (p.hp > 0) return;
    const knights = [];
    S.run.team.forEach(function (k, idx) { if (k.alive && k.type !== 'mag') knights.push(idx); });
    if (knights.length) {
      const idx = knights[Math.floor(Math.random() * knights.length)];
      const k = S.run.team[idx];
      k.alive = false;
      if (k.trophy) {
        if (S.run.hand.length < HAND_LIMIT) S.run.hand.push(k.trophy);
        k.trophy = null;
      }
      p.hp = 55;
      S.invuln = 1.6;
      S.shake = 0.3;
      KVP.Audio.play('fail');
      UI.toast('💀 <b>' + KVP.escapeHtml(k.name) + '</b> пал! Команда теряет +1 силы. Осталось здоровья: 55.', 'bad', 5200);
      if (S.selectedSlot === idx) S.selectedSlot = firstUsableSlot();
      syncRunHp();
      updateHUD();
      return;
    }
    gameOver();
  }

  function gameOver() {
    if (S.mode === 'gameover') return;
    setPlayingActive(false);
    setMode('gameover');
    exitLock();
    KVP.Audio.play('gameover');
    const st = S.run.stats;
    const acc = st.shots ? Math.round(st.hits / st.shots * 100) : 0;
    const info = el('gameover-stats');
    if (info) {
      info.innerHTML =
        '<div class="stat-row"><span>Пройдено этажей</span><b>' + (S.run.floorIndex + 1) + ' / 3</b></div>' +
        '<div class="stat-row"><span>Уничтожено ПароБотов</span><b>' + st.kills + '</b></div>' +
        '<div class="stat-row"><span>Золото</span><b>💰 ' + S.run.gold + '</b></div>' +
        '<div class="stat-row"><span>Точность алгоритма</span><b>' + acc + '%</b></div>' +
        '<div class="stat-row"><span>Время в подземелье</span><b>' + KVP.formatTime(st.time) + '</b></div>';
    }
    hideGameScreens();
    show('screen-gameover');
  }

  /* ================================================================== */
  /*  КАРТЫ, ТРОФЕИ, КОМАНДА                                            */
  /* ================================================================== */
  function usableSlots() {
    const arr = [];
    if (!S.run) return arr;
    S.run.team.forEach(function (k, idx) {
      if (k.alive && k.type !== 'mag') arr.push(idx);
    });
    return arr;
  }

  function firstUsableSlot() {
    const slots = usableSlots();
    for (let i = 0; i < slots.length; i++) {
      if (S.run.team[slots[i]].trophy) return slots[i];
    }
    return slots.length ? slots[0] : -1;
  }

  function selectWeaponSlot(n, byTeamIndex) {
    const slots = usableSlots();
    if (!slots.length) return;
    let idx;
    if (byTeamIndex) idx = n;
    else idx = slots[n];
    if (idx == null || slots.indexOf(idx) < 0) return;
    S.selectedSlot = idx;
    updateTable();
    updateTargetPanel(0, true);
    KVP.Audio.play('card');
  }

  function selectedTrophy() {
    if (S.selectedSlot < 0 || !S.run) return null;
    const k = S.run.team[S.selectedSlot];
    if (!k || !k.alive || !k.trophy) return null;
    return k.trophy;
  }

  function weaponTypesForTarget(bot) {
    const tr = selectedTrophy();
    if (!tr) return [];
    const types = [tr.type];
    if (!bot) return types;
    if (tr.type === 'trap') return types;
    const def = KVP.BOTS[bot.type] || {};
    const cond = String(def.condition || '');
    if (cond.indexOf('^') >= 0) return types;       /* XOR — ровно один */
    if (cond.indexOf('&&') < 0) return types;

    if (hasMag()) {
      if (bot.type === 'giant' && tr.type === 'paper') {
        for (let i = 0; i < S.run.team.length; i++) {
          if (i === S.selectedSlot) continue;
          const k = S.run.team[i];
          if (k.alive && k.trophy && k.trophy.type === 'paper') { types.push('paper'); break; }
        }
      }
      return types;
    }

    const wanted = cond.split('&&').map(function (x) { return x.trim().replace(/^!/, ''); });
    if (wanted.indexOf(tr.type) < 0) return types;
    for (let wi = 0; wi < wanted.length; wi++) {
      const w = wanted[wi];
      if (w === tr.type || w === 'paper') continue;   /* Бумага без Мага не бьёт */
      for (let i = 0; i < S.run.team.length; i++) {
        if (i === S.selectedSlot) continue;
        const k = S.run.team[i];
        if (k.alive && k.trophy && k.trophy.type === w) { types.push(w); break; }
      }
    }
    return types;
  }

  function addTrophy(type) {
    if (!type) return;
    let equipped = null;
    for (let i = 0; i < S.run.team.length; i++) {
      const k = S.run.team[i];
      if (k.alive && k.type !== 'mag' && !k.trophy) {
        k.trophy = KVP.newTrophy(type);
        equipped = i;
        break;
      }
    }
    if (equipped == null) {
      // Запаса нет — Трофей уходит в сброс (по правилам: все места заняты).
      UI.toast('🃏 Трофей «' + (KVP.TROPHIES[type]||{}).name + '» сброшён: нет свободного Рыцаря.', 'info', 2400);
    }
    S.run.cells = S.run.team.filter(function (k) {
      return k.alive && k.trophy && k.trophy.type === 'trap';
    }).length;
    if (S.selectedSlot < 0 || !selectedTrophy()) S.selectedSlot = firstUsableSlot();
    updateHUD();
    return equipped;
  }

  function randomTrophyType() {
    return KVP.TROPHY_LIST[Math.floor(Math.random() * KVP.TROPHY_LIST.length)];
  }

  function consumeTrophy(slotIndex) {
    const k = S.run.team[slotIndex];
    if (!k || !k.trophy) return null;
    const type = k.trophy.type;
    k.trophy = null;
    // Руки нет — добирать неоткуда.
    if (S.selectedSlot === slotIndex && !k.trophy) S.selectedSlot = firstUsableSlot();
    return type;
  }

  function discardOneTrophy() {
    if (!S.run) return null;
    // сначала бумага, потом из руки, потом снаряжённые
    let idx = S.run.hand.findIndex(function (t) { return t.type === 'paper'; });
    if (idx >= 0) return S.run.hand.splice(idx, 1)[0];
    for (let i = 0; i < S.run.team.length; i++) {
      const k = S.run.team[i];
      if (k.trophy && k.trophy.type === 'paper') {
        const t = k.trophy; k.trophy = null; return t;
      }
    }
    if (S.run.hand.length) return S.run.hand.pop();
    for (let i = 0; i < S.run.team.length; i++) {
      const k = S.run.team[i];
      if (k.trophy) { const t = k.trophy; k.trophy = null; return t; }
    }
    return null;
  }

  function addKnight(type) {
    const def = KVP.KNIGHTS[type];
    if (!def) return;
    if (type === 'mag') {
      const has = S.run.team.some(function (k) { return k.alive && k.type === 'mag'; });
      if (has) { S.run.gold += 25; return; }
    }
    if (S.run.team.filter(function (k) { return k.alive; }).length >= 7) {
      S.run.gold += 25;
      UI.toast('Команда полна — +25 золота', 'gold');
      return;
    }
    const k = KVP.newKnight(type);
    S.run.team.push(k);
    if (type === 'cook') {
      S.player.hp = Math.min(S.run.maxHp, S.player.hp + (def.heal || 25));
      syncRunHp();
    }
    if (S.selectedSlot < 0) S.selectedSlot = firstUsableSlot();
    updateHUD();
  }

  function equipFromHand(handIndex, teamIndex) {
    if (!S.run) return;
    const k = S.run.team[teamIndex];
    if (!k || !k.alive) return;
    const card = S.run.hand[handIndex];
    if (!card) return;
    if (k.type === 'mag' && card.type !== 'paper') { UI.toast('Маг в Команде — ВСЕ РЫЦАРИ сражаются ТОЛЬКО Бумагой. Камень и Ножницы непригодны.', 'info', 2600); return; }
    if (!card) return;
    const old = k.trophy;
    k.trophy = card;
    S.run.hand.splice(handIndex, 1);
    if (old) S.run.hand.push(old);
    S.deckHandIndex = -1;
    if (S.selectedSlot < 0) S.selectedSlot = teamIndex;
    updateHUD();
    renderDeck();
  }

  function unequipFromKnight(teamIndex) {
    const k = S.run.team[teamIndex];
    if (!k || !k.trophy) return;
    if (S.run.hand.length >= HAND_LIMIT) { UI.toast('Рука полна', 'bad'); return; }
    S.run.hand.push(k.trophy);
    k.trophy = null;
    if (S.selectedSlot === teamIndex) S.selectedSlot = firstUsableSlot();
    updateHUD();
    renderDeck();
  }

  /* ================================================================== */
  /*  БОЙ                                                               */
  /* ================================================================== */
  function attack() {
    const p = S.player;
    if (!S.run || p.cooldown > 0) return;
    const target = pickBot(14);
    if (!target) {
      UI.toast('Нет цели: наведите прицел на ПароБота.', 'info', 1600);
      p.cooldown = 0.25;
      return;
    }
    const tr = selectedTrophy();
    if (!tr) {
      UI.toast('Слот пуст. Перетащите карточку Трофея из руки на Рыцаря.', 'bad');
      p.cooldown = 0.5;
      KVP.Audio.play('denied');
      return;
    }

    const types = weaponTypesForTarget(target);
    const a = KVP.analyze(target.type, types, teamPower(), hasMag());
    S.run.stats.shots++;
    p.cooldown = 0.42;
    KVP.Audio.play('shoot');
    throwCardVisual(types[0] || tr.type, target);

    if (a.mode === 'kill') {
      S.run.stats.hits++;
      // расход трофеев (запоминаем слот до расхода — consumeTrophy может сменить выбор)
      const firstSlot = S.selectedSlot;
      const isTrapShot = (tr.type === 'trap');
      consumeTrophy(firstSlot);
      if (isTrapShot) {
        S.run.cells = S.run.team.filter(function (k) { return k.alive && k.trophy && k.trophy.type === 'trap'; }).length;
        S.run.stats.cellsUsed = (S.run.stats.cellsUsed || 0) + 1;
        target.alert = true;
        killBot(target, true);
        S.shake = 0.1;
        UI.toast('🪤 Клетка-ловушка поймала <b>' + KVP.escapeHtml(KVP.BOTS[target.type].name) + '</b> без боя!', 'good');
        updateHUD();
        updateTargetPanel(0, true);
        return;
      }
      if (isComboBot(target.type) && types.length > 1) {
        for (let i = 0; i < S.run.team.length; i++) {
          if (i === firstSlot) continue;
          const k = S.run.team[i];
          if (k.alive && k.trophy && k.trophy.type === types[1]) { consumeTrophy(i); break; }
        }
      }
      target.alert = true;
      killBot(target, false);
      S.shake = 0.1;
      UI.toast('✅ ' + KVP.escapeHtml(KVP.BOTS[target.type].name) + ' уничтожен! <b>+' + rewardFor(target) + ' золота</b>', 'good');
      updateHUD();
      updateTargetPanel(0, true);
      return;
    }

    if (a.mode === 'stun') {
      S.run.stats.hits++;
      consumeTrophy(S.selectedSlot);
      target.stun = 6;
      target.alert = true;
      target.patrol = null;
      addStunSprite(target);
      KVP.Audio.play('stun');
      UI.toast('📜 Бумага запутала <b>' + KVP.escapeHtml(KVP.BOTS[target.type].short) + '</b> на 6 секунд. Броня не пробита — но бой отложен.', 'info', 4200);
      updateHUD();
      updateTargetPanel(0, true);
      return;
    }

    // Провал логики
    target.alert = true;
    target.shotCd = Math.min(target.shotCd, 0.5);
    S.shake = 0.08;
    KVP.Audio.play('fail');
    UI.toast('⛔ <b>' + KVP.escapeHtml(a.title) + '</b><br>' + KVP.escapeHtml(a.detail), 'bad', 5000);
    updateHUD();
    updateTargetPanel(0, true);
  }

  function rewardFor(bot) {
    const base = KVP.BOTS[bot.type].reward + S.run.floorIndex * 5;
    return base;
  }

  function killBot(bot, captured) {
    if (!bot.alive) return;
    bot.alive = false;
    const reward = Math.round(rewardFor(bot) * (captured ? 0.5 : 1));
    S.run.gold += reward;
    S.run.stats.botGold += reward;
    S.run.stats.kills++;
    S.run.stats.byType[bot.type] = (S.run.stats.byType[bot.type] || 0) + 1;
    S.run.wins = S.run.wins || [];
    S.run.wins.push(bot.type);

    const bx = bot.x, bz = bot.z;
    if (bot.mesh.parent) bot.mesh.parent.remove(bot.mesh);
    if (bot.stunSprite && bot.stunSprite.parent) bot.stunSprite.parent.remove(bot.stunSprite);

    KVP.M3.spawnBurst(scene, bx, 0.6, bz, captured ? 0x7ecbff : 0xffa64a, captured ? 14 : 22, captured ? 0.7 : 1.1);
    KVP.Audio.play(captured ? 'stun' : 'explode');

    // выпадение трофея
    const chance = bot.type === 'giant' ? 2 : (bot.type === 'normal' ? 0.4 : 1);
    const drops = chance === 2 ? 2 : (Math.random() < chance ? 1 : 0);
    for (let i = 0; i < drops; i++) {
      const type = randomTrophyType();
      dropTrophyAt(bx + (Math.random() - 0.5) * 0.5, bz + (Math.random() - 0.5) * 0.5, type);
    }
    if (aliveBots() === 0) openPortal();
    updateHUD();
    KVP.Audio.play('coin');
    S.logEvent('🤖 ' + (KVP.BOTS[bot.type] || { name:'ПароБот' }).name + ' повержен! +' + reward + ' 💰 → Победы.');
    const html = '<p><b>' + KVP.escapeHtml((KVP.BOTS[bot.type] || { name:'ПароБот' }).name) + '</b> повержен в бою.</p>' +
      '<div class="duel-note">+💰 ' + reward + ' · добавлен в коллекцию «Победы».</div>';
    showModal('🏆 ПОБЕДА над ПароБотом!', html, 'playing', false);
  }

  function dropTrophyAt(x, z, type) {
    // Не роняем карту в стену: ищем ближайшее свободное место.
    if (!S.dungeon.canStand(x, z, 0.3)) {
      let placed = false;
      for (let i = 0; i < 24 && !placed; i++) {
        const a = Math.random() * Math.PI * 2;
        const r = 0.35 + Math.random() * 1.1;
        const nx = x + Math.cos(a) * r, nz = z + Math.sin(a) * r;
        if (S.dungeon.canStand(nx, nz, 0.3)) { x = nx; z = nz; placed = true; }
      }
    }
    const rec = {
      id: KVP.uid('drop'), kind: 'trophy', itemType: type,
      x: x, z: z, taken: false, mesh: null, roomId: S.dungeon.roomAtPos(x, z),
      amount: 0, phase: Math.random() * 6.28
    };
    const mesh = KVP.M3.makeCardPickup('trophy', type, { svg: KVP.SVG.trophy(type), color: trophyColor(type) });
    mesh.position.set(x, 0, z);
    entityRoot.add(mesh);
    rec.mesh = mesh;
    S.pickups.push(rec);
  }

  function addStunSprite(bot) {
    if (bot.stunSprite) return;
    const giant = isComboBot(bot.type);
    const spr = KVP.M3.makeLabelSprite('💤', 'rgba(20,28,48,.85)', '#9cc9ff');
    spr.scale.set(giant ? 0.72 : 0.54, giant ? 0.34 : 0.26, 1);
    spr.position.y = giant ? 1.96 : 1.42;
    bot.mesh.add(spr);
    bot.stunSprite = spr;
  }

  function pickBot(maxDist) {
    if (!S.player || !S.dungeon) return null;
    const p = S.player;
    const fx = -Math.sin(p.yaw), fz = -Math.cos(p.yaw);
    let best = null, bestScore = 1e9;
    for (let i = 0; i < S.bots.length; i++) {
      const b = S.bots[i];
      if (!b.alive) continue;
      const dx = b.x - p.x, dz = b.z - p.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      if (dist < 0.05 || dist > maxDist) continue;
      const dot = (dx * fx + dz * fz) / dist;
      if (dot <= 0) continue;
      const lateral = Math.abs(dx * fz - dz * fx);
      const allowed = 0.42 + dist * 0.032;
      if (lateral > allowed) continue;
      if (!S.dungeon.lineOfSight(p.x, p.z, b.x, b.z)) continue;
      const score = dist + lateral * 4;
      if (score < bestScore) { bestScore = score; best = b; }
    }
    return best;
  }

  function throwCardVisual(type, target) {
    if (!type) return;
    const svg = KVP.SVG.trophy(type);
    const mesh = new T.Mesh(
      new T.PlaneGeometry(0.22, 0.3),
      new T.MeshBasicMaterial({ map: KVP.M3.cardTexture(svg), transparent: true, side: T.DoubleSide })
    );
    const p = S.player;
    const fx = -Math.sin(p.yaw), fz = -Math.cos(p.yaw);
    mesh.position.set(p.x + fx * 0.35, KVP.M3.EYE - 0.12, p.z + fz * 0.35);
    fxRoot.add(mesh);
    const tx = target.x, tz = target.z, ty = 0.72;
    const dx = tx - mesh.position.x, dy = ty - mesh.position.y, dz = tz - mesh.position.z;
    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1;
    S.cardThrows.push({
      mesh: mesh, x: dx / dist, y: dy / dist, z: dz / dist,
      speed: Math.max(6, dist * 6), life: 0, max: Math.min(0.35, dist / 10)
    });
  }

  function updateCardThrows(dt) {
    for (let i = S.cardThrows.length - 1; i >= 0; i--) {
      const c = S.cardThrows[i];
      c.life += dt;
      c.mesh.position.x += c.x * c.speed * dt;
      c.mesh.position.y += c.y * c.speed * dt;
      c.mesh.position.z += c.z * c.speed * dt;
      c.mesh.rotation.y += dt * 18;
      c.mesh.rotation.z += dt * 8;
      if (c.life >= c.max) {
        if (c.mesh.parent) c.mesh.parent.remove(c.mesh);
        S.cardThrows.splice(i, 1);
      }
    }
  }

  /* ================================================================== */
  /*  СПЕЦКАРТЫ И ПРЕДМЕТЫ                                              */
  /* ================================================================== */
  function useCell() {
    if (!S.run) return;
    const owner = S.run.team.find(function (k) { return k.alive && k.trophy && k.trophy.type === 'trap'; });
    if (!owner) { UI.toast('Нет свободного Рыцаря с Клеткой. Ищите 🪤 в комнатах-ловушках.', 'bad'); KVP.Audio.play('denied'); return; }
    const target = pickBot(14);
    if (!target) { UI.toast('Наведитесь на ПароБота, чтобы поставить клетку.', 'info'); return; }
    owner.trophy = null;
    S.run.cells = S.run.team.filter(function (k) { return k.alive && k.trophy && k.trophy.type === 'trap'; }).length;
    S.run.stats.cellsUsed = (S.run.stats.cellsUsed || 0) + 1;
    killBot(target, true); /* Уже показывает окно победы. */
    updateHUD();
    updateTargetPanel(0, true);
  }

  function hasMag() {
    return S.run.team.some(function (k) { return k.alive && k.type === 'mag'; });
  }

  function countPaper() {
    let n = 0;
    S.run.team.forEach(function (k) { if (k.alive && k.trophy && k.trophy.type === 'paper') n++; });
    S.run.hand.forEach(function (t) { if (t.type === 'paper') n++; });
    return n;
  }

  /**
   * Дракон по правилам (Соло-режим, «Если выпадает Спецкарта, то играйте её
   * немедленно»): сжигает ВСЮ бумагу — и в Инвентаре, и в руке — и забирает
   * одного Вашего Персонажа. Действие сразу: карта не попадает в руку.
   */
  function dragonStrike() {
    if (!S.run) return;
    S.run.stats.dragonsUsed = (S.run.stats.dragonsUsed || 0) + 1;

    /* 1. Сжигаем всю бумагу — и в Инвентаре (под Рыцарями), и в руке. */
    let burned = 0;
    S.run.team.forEach(function (k) {
      if (k.trophy && k.trophy.type === 'paper') { k.trophy = null; burned++; }
    });
    S.run.hand = S.run.hand.filter(function (t) {
      if (t.type === 'paper') { burned++; return false; }
      return true;
    });
    S.run.stats.papersBurned = (S.run.stats.papersBurned || 0) + burned;

    /* 2. Огонь Дракона сжигает ПароБотов в этой комнате. */
    let killed = 0;
    S.bots.forEach(function (b) {
      if (!b.alive) return;
      if (S.dungeon.roomAtPos(b.x, b.z) === S.currentRoom) {
        killBot(b, false);
        killed++;
      }
    });

    /* 3. 3D: Дракон пролетает по комнате, дыша огнём. */
    spawnDragonFx();
    S.shake = 0.65;
    KVP.Audio.play('dragon');

    /* 4. Дракон забирает одного Персонажа — игрок сам выбирает, кого. */
    const alive = [];
    S.run.team.forEach(function (k, i) { if (k.alive) alive.push(i); });
    let btns = '';
    alive.forEach(function (i) {
      const k = S.run.team[i];
      btns += '<button class="fight-btn bad" onclick="KVP.Game.dragonUI(' + i + ')">' +
        '<span class="p3d-sm p3d-sm-fallback">' + ((KVP.KNIGHTS[k.type] || {}).icon || '🛡') + '</span>' +
        '<span class="fb-txt">💀 В сброс: <b>' + KVP.escapeHtml(k.name) + '</b>' +
        '<small>' + (k.trophy ? '+ ' + KVP.escapeHtml(KVP.TROPHIES[k.trophy.type].name) : 'без Трофея') + '</small></span>' +
        '<small class="fb-tag">забрать</small></button>';
    });
    const d = KVP.SPECIALS.dragon;
    const html = '<p>' + KVP.escapeHtml(d.effect) + '</p>' +
      '<div class="dragon-result">' +
      '<div>🔥 Сожжено Бумаги: <b>' + burned + '</b></div>' +
      '<div>🤖 Сожжено ПароБотов в комнате: <b>' + killed + '</b></div>' +
      '</div>' +
      '<div class="tp-label">Дракон забирает одного Вашего Персонажа</div>' +
      '<div class="fight-list">' + (btns || '<div class="fight-note">У вас не осталось живых Персонажей.</div>') + '</div>';
    updateHUD();
    /* В Дуэли/модалке Дракона свои кнопки — универсальная «Продолжить» не нужна. */
    showModal('<span class="special-icon">🐉</span> ' + KVP.escapeHtml(d.name), html, 'playing', true);
    S.logEvent('🐉 Дракон: сожжено Бумаг ' + burned + ', ПароБотов ' + killed + '.');
  }

  /** Игрок выбирает, кого Дракон забирает. */
  G.dragonUI = function (idx) {
    if (!S.run) return;
    const k = S.run.team[idx];
    if (!k || !k.alive) return;
    k.alive = false;
    const tr = k.trophy ? ' и ' + KVP.TROPHIES[k.trophy.type].name : '';
    if (k.trophy) {
      if (S.run.hand.length < HAND_LIMIT) S.run.hand.push(k.trophy);
      k.trophy = null;
    }
    S.run.stats.lost = (S.run.stats.lost || 0) + 1;
    if (S.selectedSlot === idx) S.selectedSlot = firstUsableSlot();
    closeModal();
    updateHUD();
    saveRun();
    UI.toast('💀 ' + k.name + tr + ' — Дракон забрал его в сброс.', 'bad', 3400);
    KVP.Audio.play('gameover');
    if (!S.run.team.some(function (x) { return x.alive; })) {
      scheduleGameOver(400);
    }
  };

  /* ------------------------------------------------------------------ */
  /*  3D-ДРАКОН: пролетает по комнате и дышит огнём                       */
  /* ------------------------------------------------------------------ */
  function spawnDragonFx() {
    if (!entityRoot || !KVP.M3.makeDragon || !S.dungeon || S.currentRoom == null) return;
    const room = S.dungeon.rooms[S.currentRoom];
    if (!room) return;
    const c = S.dungeon.center(room);
    const mesh = KVP.M3.makeDragon();
    const ud = mesh.userData || {};
    if (ud.body && ud.scale) ud.body.scale.setScalar(1.3);
    const p = S.player;
    /* Пролетает поперёк комнаты, напротив игрока. */
    let ax = 1, az = 0;
    if (p) { ax = Math.cos(p.yaw); az = -Math.sin(p.yaw); }
    const R = 2.9;
    const x0 = c.x - ax * R, z0 = c.y - az * R;
    const x1 = c.x + ax * R, z1 = c.y + az * R;
    mesh.position.set(x0, 1.62, z0);
    mesh.rotation.y = Math.atan2(ax, az);
    if (KVP.M3.makeLabelSprite) {
      const tag = KVP.M3.makeLabelSprite('ДРАКОН', 'rgba(60,10,6,.92)', '#ffc38a');
      tag.position.y = 1.55;
      tag.scale.set(0.8, 0.2, 1);
      mesh.add(tag);
    }
    entityRoot.add(mesh);
    S.dragonFx = { mesh: mesh, x0: x0, z0: z0, x1: x1, z1: z1, t: 0, dur: 2.8 };
  }

  function animateDragonFx(dt) {
    const d = S.dragonFx;
    if (!d) return;
    d.t += dt;
    const k = Math.min(1, d.t / d.dur);
    const x = d.x0 + (d.x1 - d.x0) * k;
    const z = d.z0 + (d.z1 - d.z0) * k;
    const ud = d.mesh.userData || {};
    const t = performance.now() * 0.001;
    d.mesh.position.set(x, 1.62 + Math.sin(t * 2.6) * 0.12, z);
    /* Крылья машут, хвост извивается, из пасти летит огонь. */
    if (ud.wings) {
      const flap = Math.sin(t * 7);
      ud.wings.children.forEach(function (w, i) {
        w.rotation.z = (i === 0 ? 1 : -1) * flap * 0.26;
      });
    }
    if (ud.tail) ud.tail.rotation.y = Math.sin(t * 3.1) * 0.24;
    if (ud.fire) ud.fire.scale.setScalar(0.9 + Math.sin(t * 12) * 0.14);
    if (scene && KVP.M3.spawnBurst && Math.random() < dt * 24) {
      const fx = x + (Math.random() - 0.5) * 1.1;
      const fz = z + (Math.random() - 0.5) * 1.1;
      KVP.M3.spawnBurst(scene, fx, 0.5, fz, 0xff7a1e, 12, 1.2);
      KVP.M3.spawnBurst(scene, fx, 0.95, fz, 0xffd27a, 5, 0.7);
    }
    if (k >= 1) {
      if (d.mesh.parent) d.mesh.parent.remove(d.mesh);
      S.dragonFx = null;
    }
  }

  function applySpecial(id) {
    const d = KVP.SPECIALS[id];
    if (!d) return;
    let html = '';
    if (id === 'greed') {
      const a = randomTrophyType(), b = randomTrophyType();
      addTrophy(a); addTrophy(b);
      KVP.Audio.play('pickup');
      html = '<p>' + KVP.escapeHtml(d.effect) + '</p><div class="reward-cards">' +
        UI.trophy(a, { compact: true }) + UI.trophy(b, { compact: true }) + '</div>' +
        '<p class="muted">Получено: ' + KVP.TROPHIES[a].name + ' и ' + KVP.TROPHIES[b].name + '.</p>';
    } else if (id === 'market') {
      let card = null, where = null;
      for (let i = 0; i < S.run.team.length; i++) {
        if (S.run.team[i].trophy) { card = S.run.team[i].trophy; where = 'equipped'; break; }
      }
      if (!card && S.run.hand.length) { card = S.run.hand[0]; where = 'hand'; }
      let oldType = null, newType = null;
      if (card) {
        oldType = card.type;
        newType = randomTrophyType();
        if (newType === oldType) newType = oldType === 'rock' ? 'scissors' : 'rock';
        card.type = newType;
        if (where === 'equipped') card.id = KVP.uid('tr');
      } else {
        newType = randomTrophyType();
        addTrophy(newType);
      }
      KVP.Audio.play('card');
      html = '<p>' + KVP.escapeHtml(d.effect) + '</p>' +
        (oldType
          ? '<div class="reward-cards">' + UI.trophy(oldType, { compact: true }) + '<div class="arrow">→</div>' + UI.trophy(newType, { compact: true }) + '</div>'
          : '<p>У вас не было Трофея — Рынок выдал новый.</p><div class="reward-cards">' + UI.trophy(newType, { compact: true }) + '</div>');
    } else if (id === 'thief') {
      const t = randomTrophyType();
      addTrophy(t);
      S.run.gold += 10;
      KVP.Audio.play('coin');
      html = '<p>' + KVP.escapeHtml(d.effect) + '</p><div class="reward-cards">' + UI.trophy(t, { compact: true }) + '</div>' +
        '<p class="muted">Украдено: ' + KVP.TROPHIES[t].name + ' и 10 золота.</p>';
    } else if (id === 'dragon') {
      /* По правилам Спецкарта играется немедленно: Дракон сжигает всю
         бумагу и забирает одного Персонажа прямо сейчас. */
      dragonStrike();
      return;
    } else if (id === 'mag') {
      addKnight('mag');
      KVP.Audio.play('mag');
      UI.toast('🧙 <b>Маг присоединился к команде!</b> Теперь отбивайтесь от ПароБотов только Бумагой.', 'good', 3600);
      S.logEvent('🧙 Маг присоединился к команде.');
      updateHUD();
      return;
    }
    updateHUD();
    showModal('<span class="special-icon">' + d.icon + '</span> ' + KVP.escapeHtml(d.name), html);
  }

  /* ================================================================== */
  /*  ПРЕДМЕТЫ И ВЗАИМОДЕЙСТВИЕ                                          */
  /* ================================================================== */
  function collectPickup(p) {
    if (!p || p.taken) return;
    p.taken = true;
    if (p.mesh && p.mesh.parent) p.mesh.parent.remove(p.mesh);

    if (p.kind === 'trophy') {
      addTrophy(p.itemType);
      KVP.Audio.play('pickup');
      UI.toast('🃏 Трофей «' + KVP.TROPHIES[p.itemType].name + '» — ' +
        (S.run.team.some(function (k) { return k.alive && k.trophy && k.trophy.type === p.itemType; })
          ? 'снаряжён под Рыцаря.' : 'в руке — перетащите её на Рыцаря.'), 'good');
    } else if (p.kind === 'knight') {
      addKnight(p.itemType);
      KVP.Audio.play('pickup');
      const d = KVP.KNIGHTS[p.itemType];
      UI.toast(d.icon + ' <b>' + KVP.escapeHtml(d.name) + '</b> присоединился! Бонус Рыцарей +' + d.bonus + '.', 'good', 4000);
      if (p.itemType === 'cook') UI.toast('🍲 Повар подлечил команду на 25 здоровья.', 'good');
    } else if (p.kind === 'special') {
      applySpecial(p.itemType);
    } else if (p.kind === 'cell') {
      const freeKnight = S.run.team.find(function(k){ return k.alive && !k.trophy; });
      if (freeKnight) { freeKnight.trophy = KVP.newTrophy('trap'); S.run.cells = S.run.team.filter(function(k){ return k.alive && k.trophy && k.trophy.type === 'trap'; }).length; KVP.Audio.play('pickup'); UI.toast('🪤 Клетка-ловушка → ' + KVP.escapeHtml(freeKnight.name) + '. Нажмите <b>F</b>, чтобы поймать бота без боя.', 'good'); }
      else { KVP.Audio.play('denied'); UI.toast('🪤 Клетка уходит в сброс (нет свободного Рыцаря).', 'info'); }
    } else if (p.kind === 'gold') {
      const amt = p.amount || 5;
      S.run.gold += amt;
      S.run.stats.treasure += amt;
      KVP.Audio.play('coin');
      UI.toast('💰 +' + amt + ' золота', 'gold', 1800);
    }
    updateHUD();
  }

  function interact() {
    const it = S.interact;
    if (!it) { UI.toast('Рядом нет ничего, с чем можно взаимодействовать.', 'info', 1600); return; }
    if (it.type === 'portal') {
      usePortal();
    } else if (it.type === 'chest') {
      openChest(it.ref);
    } else if (it.type === 'pickup') {
      collectPickup(it.ref);
    }
  }

  function openChest(chest) {
    if (!chest || chest.opened) return;
    chest.opened = true;
    if (chest.mesh && chest.mesh.userData.lid) {
      chest.mesh.userData.lid.rotation.x = -1.1;
    }
    KVP.Audio.play('chest');
    const discarded = discardOneTrophy();
    const loot = [];
    for (let i = 0; i < 2; i++) {
      const t = randomTrophyType();
      addTrophy(t);
      loot.push(t);
    }
    const gold = 15 + Math.floor(Math.random() * 16);
    S.run.gold += gold;
    S.run.stats.treasure += gold;
    if (Math.random() < 0.5) S.run.cells++;
    updateHUD();
    updateTable();

    const html = '<p>Сундук взял плату по правилам: <b>' +
      (discarded ? 'сброшен Трофей «' + KVP.TROPHIES[discarded.type].name + '»' : 'трофеев не было — плата не нужна') +
      '</b>.</p>' +
      '<div class="reward-cards">' + loot.map(function (t) { return UI.trophy(t, { compact: true }); }).join('') + '</div>' +
      '<p class="muted">💰 +' + gold + ' золота' + (S.run.cells ? ' · 🪤 клетка-ловушка' : '') + '</p>';
    showModal('💰 Сокровищница', html);
  }

  function usePortal() {
    if (!S.floorCleared) {
      UI.toast('Портал закрыт. Осталось ПароБотов: <b>' + aliveBots() + '</b>.', 'bad');
      KVP.Audio.play('denied');
      return;
    }
    KVP.Audio.play('portal');
    if (S.run.floorIndex >= KVP.FLOORS.length - 1) {
      showVictory();
      return;
    }
    // Этаж пройден
    setMode('floorclear');
    exitLock();
    S.run.stats.floors = S.run.floorIndex + 1;
    const st = S.run.stats;
    const info = el('floorclear-stats');
    if (info) {
      info.innerHTML =
        '<div class="stat-row"><span>Уничтожено ботов</span><b>' + st.kills + '</b></div>' +
        '<div class="stat-row"><span>Золото</span><b>💰 ' + S.run.gold + '</b></div>' +
        '<div class="stat-row"><span>Сила команды</span><b>⚔ ' + teamTotalPower() + '</b></div>' +
        '<div class="stat-row"><span>Время</span><b>' + KVP.formatTime(st.time) + '</b></div>';
    }
    const nextCfg = KVP.FLOORS[S.run.floorIndex + 1];
    const title = el('floorclear-title');
    if (title) title.textContent = 'Этаж пройден!';
    const sub = el('floorclear-sub');
    if (sub) sub.textContent = 'Впереди — ' + nextCfg.name + '. Отдых восстанавливает 30 здоровья.';
    hideGameScreens();
    show('screen-floorclear');
    saveRun();
  }

  function openPortal() {
    if (S.floorCleared) return;
    S.floorCleared = true;
    if (S.portal && S.portal.mesh) {
      const ud = S.portal.mesh.userData;
      if (ud.ring) ud.ring.material = new T.MeshBasicMaterial({ color: 0x9a6cff });
      if (ud.inner) ud.inner.material = new T.MeshBasicMaterial({ color: 0x9a6cff, transparent: true, opacity: 0.65, side: T.DoubleSide });
      if (ud.glow) ud.glow.material.color.setHex(0xc9a8ff);
    }
    KVP.Audio.play('portal');
    UI.toast('🌀 <b>Все ПароБоты уничтожены!</b> Портал у входа открыт. Возвращайтесь к началу подземелья.', 'good', 6000);
    updateHUD();
  }

  function findInteractable() {
    const p = S.player;
    if (!p) return null;
    const fx = -Math.sin(p.yaw), fz = -Math.cos(p.yaw);
    let best = null, bestDist = 1e9;
    function consider(obj, type, label, range) {
      const dx = obj.x - p.x, dz = obj.z - p.z;
      const d = Math.sqrt(dx * dx + dz * dz);
      if (d > (range || 1.7)) return;
      const dot = (dx * fx + dz * fz) / (d || 1);
      if (dot < 0.15) return;
      if (d < bestDist) { bestDist = d; best = { type: type, ref: obj, label: label }; }
    }
    for (let i = 0; i < S.pickups.length; i++) {
      const pk = S.pickups[i];
      if (pk.taken) continue;
      let label = '';
      if (pk.kind === 'trophy') label = 'Взять Трофей «' + KVP.TROPHIES[pk.itemType].name + '»';
      else if (pk.kind === 'knight') label = 'Принять в команду: ' + KVP.KNIGHTS[pk.itemType].name;
      else if (pk.kind === 'special') label = 'Взять спецкарту «' + KVP.SPECIALS[pk.itemType].name + '»';
      else if (pk.kind === 'cell') label = 'Взять клетку-ловушку';
      else if (pk.kind === 'gold') label = 'Собрать ' + pk.amount + ' золота';
      consider(pk, 'pickup', label, 1.8);
    }
    for (let i = 0; i < S.chests.length; i++) {
      const ch = S.chests[i];
      if (!ch.opened) consider(ch, 'chest', 'Открыть сундук (сбросив 1 Трофей)', 1.9);
    }
    if (S.portal) {
      consider(S.portal, 'portal', S.floorCleared ? 'Войти в портал' : 'Портал закрыт: осталось ботов ' + aliveBots(), 2.2);
    }
    return best;
  }

  function updateInteract(dt) {
    const it = findInteractable();
    S.interact = it;
    const host = el('interact-prompt');
    if (!host) return;
    if (!it) { host.classList.add('hidden'); return; }
    host.classList.remove('hidden');
    host.innerHTML = '<span class="key">E</span><span>' + KVP.escapeHtml(it.label) + '</span>';
  }

  /* ================================================================== */
  /*  КОМНАТЫ, МИНИ-КАРТА                                               */
  /* ================================================================== */
  function checkRoom() {
    const p = S.player;
    const rid = S.dungeon.roomAtPos(p.x, p.z);
    if (rid >= 0 && rid !== S.currentRoom) {
      S.currentRoom = rid;
      const room = S.dungeon.rooms[rid];
      if (room) {
        const first = !room.discovered;
        room.discovered = true;
        room.entered = true;
        revealRoom(room);
        UI.roomBanner(room);
        if (first) KVP.Audio.play('card');
      }
    }
    // помещения, в которых стоим, считаются увиденными
    if (rid >= 0) {
      const room = S.dungeon.rooms[rid];
      if (room && !room.discovered) { room.discovered = true; revealRoom(room); }
    }
  }

  function revealRoom(room) {
    for (let z = room.z; z < room.z + room.h; z++) {
      for (let x = room.x; x < room.x + room.w; x++) {
        if (x >= 0 && z >= 0 && x < S.dungeon.size && z < S.dungeon.size) {
          S.dungeon.seen[z * S.dungeon.size + x] = 1;
        }
      }
    }
  }

  function markSeen(dt) {
    S.seenTimer -= dt;
    if (S.seenTimer > 0) return;
    S.seenTimer = 0.15;
    const p = S.player;
    const cx = Math.floor(p.x), cz = Math.floor(p.z);
    for (let z = cz - 5; z <= cz + 5; z++) {
      for (let x = cx - 5; x <= cx + 5; x++) {
        if (x < 0 || z < 0 || x >= S.dungeon.size || z >= S.dungeon.size) continue;
        if (KVP.dist2(x, z, p.x, p.z) > 30) continue;
        S.dungeon.seen[z * S.dungeon.size + x] = 1;
      }
    }
  }

  const ROOM_MAP_COLORS = {
    start: '#4a3f33', armory: '#54432c', library: '#3b3a57', forge: '#5a3328',
    barrack: '#3c4a2e', chest: '#6b5a22', trap: '#3a3636', altar: '#43345e',
    arena: '#5c2e2e', boss: '#4a2626'
  };

  /** Крупная карта: размещённые карты Местности, проходы, игрок, Сундук. */
  function drawMinimap(force) {
    S.minimapTimer -= 1 / 60;
    if (!force && S.minimapTimer > 0) return;
    S.minimapTimer = 0.12;
    const cv = el('minimap');
    if (!cv || !S.dungeon) return;
    const g = cv.getContext('2d');
    const W = cv.width, H = cv.height;
    g.clearRect(0, 0, W, H);
    g.fillStyle = '#120f15';
    g.fillRect(0, 0, W, H);

    const rooms = S.dungeon.rooms;
    if (!rooms.length) return;

    /* Слот карты Местности — прямоугольник 2:1: длинная сторона по X. */
    const SLOT_W = 14, SLOT_H = 18;  // must match dungeon.js
    const cands = (S.pendingTile && S.pendingTile.cands) ? S.pendingTile.cands : [];
    let cellW, cellH, vgx0, vgz0;
    if (cands.length) {
      let gx0 = 999, gz0 = 999, gx1 = -999, gz1 = -999;
      const acc = function (gx, gz) {
        if (gx < gx0) gx0 = gx; if (gx > gx1) gx1 = gx;
        if (gz < gz0) gz0 = gz; if (gz > gz1) gz1 = gz;
      };
      for (let i = 0; i < rooms.length; i++) { acc(rooms[i].gx, rooms[i].gz); }
      for (let i = 0; i < cands.length; i++) { acc(cands[i].gx, cands[i].gz); }
      gx0 = Math.max(0, gx0 - 0.65); gz0 = Math.max(0, gz0 - 0.65);
      gx1 = Math.min(S.dungeon.gridSize - 1, gx1 + 0.65); gz1 = Math.min(S.dungeon.gridSize - 1, gz1 + 0.65);
      const cols = gx1 - gx0 + 1, rows = gz1 - gz0 + 1;
      const cw = Math.min((W - 16) / (cols * 3), (H - 16) / (rows * 4));
      const zoom = S.mapZoom || 1;
      cellW = cw * 3 * zoom; cellH = cw * 4 * zoom;
      vgx0 = gx0; vgz0 = gz0;
    } else {
      const zoom = S.mapZoom || 1;
      cellW = 90 * zoom; cellH = 120 * zoom;              // cards 3:4 on a square minimap, масштабируемый
      const cur = rooms[S.currentRoom] || rooms[0];
      /* Смещение камеры мышью — можно осмотреть соседей. */
      vgx0 = cur.gx + 0.5 - (W / cellW) / 2 + (S.mapPanX || 0);
      vgz0 = cur.gz + 0.5 - (H / cellH) / 2 + (S.mapPanZ || 0);
    }
    const sc = cellW / SLOT_W;              // пикселей на клетку мира
    S.mapView = { gx0: vgx0, gz0: vgz0, cellW: cellW, cellH: cellH, cell: cellH, ox: 0, oy: 0, W: W, H: H };

    function gx2px(gx) { return (gx - vgx0) * cellW; }
    function gz2px(gz) { return (gz - vgz0) * cellH; }

    function tileRect(r) {
      return {
        x: gx2px(r.gx), y: gz2px(r.gz),
        w: cellW, h: cellH
      };
    }

    // Лёгкая сетка — только по видимой части.
    g.strokeStyle = 'rgba(216,163,63,.06)';
    g.lineWidth = 1;
    for (let gx = Math.floor(vgx0) - 1; gx <= Math.ceil(vgx0 + W / cellW) + 1; gx++) {
      const x = gx2px(gx);
      g.beginPath(); g.moveTo(x, 0); g.lineTo(x, H); g.stroke();
    }
    for (let gz = Math.floor(vgz0) - 1; gz <= Math.ceil(vgz0 + H / cellH) + 1; gz++) {
      const y = gz2px(gz);
      g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke();
    }

    // Карты-комнаты: вид сверху. Пол комнаты + стены с проходами.
    for (let i = 0; i < rooms.length; i++) {
      const r = rooms[i];
      const tr = tileRect(r);
      const pad = Math.max(2, sc * 0.9);

      /* 3D-«сверху»: тень под картой, скос пола и блик у верхней кромки. */
      const depth = Math.max(2, sc * 0.6);
      g.fillStyle = 'rgba(0,0,0,.55)';
      g.fillRect(tr.x + depth, tr.y + depth, tr.w, tr.h);
      const baseCol = ROOM_MAP_COLORS[r.type] || '#3a3228';
      const fg = g.createLinearGradient(tr.x, tr.y, tr.x + tr.w, tr.y + tr.h);
      fg.addColorStop(0, baseCol);
      fg.addColorStop(1, '#171310');
      g.fillStyle = fg;
      g.globalAlpha = 0.82;
      g.fillRect(tr.x, tr.y, tr.w, tr.h);
      g.globalAlpha = 1;
      g.fillStyle = 'rgba(255,230,180,.10)';
      g.fillRect(tr.x + 1, tr.y + 1, tr.w - 2, 1);
      g.fillStyle = 'rgba(0,0,0,.28)';
      g.fillRect(tr.x + 1, tr.y + tr.h - 2, tr.w - 2, 1);
      g.strokeStyle = r.id === S.currentRoom ? '#ffd36a' : 'rgba(180,140,80,.35)';
      g.lineWidth = 1;
      g.strokeRect(tr.x + 0.5, tr.y + 0.5, tr.w - 1, tr.h - 1);

      /* ---- стены 3D-«сверху»: скос, тень, проём только в середине ---- */
      const wallT = Math.max(2, sc * 0.7);
      const wallCol = r.id === S.currentRoom ? '#ffd36a' : '#5a4a38';
      const wallHi = r.id === S.currentRoom ? 'rgba(255,238,190,.6)' : 'rgba(255,230,180,.18)';
      const doorGap = Math.max(7, sc * 2.2);
      const strokeSeg = function (x1, y1, x2, y2) {
        g.strokeStyle = 'rgba(0,0,0,.78)';
        g.lineWidth = wallT * 1.6;
        g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke();
        g.strokeStyle = wallCol;
        g.lineWidth = wallT;
        g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke();
        g.strokeStyle = wallHi;
        g.lineWidth = Math.max(1, wallT * 0.32);
        g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke();
      };
      const drawDoor = function (x, y, dir, connected) {
        if (connected) {
          /* Открытый проход — золотой порог. */
          g.strokeStyle = '#ffd36a';
          g.lineWidth = Math.max(2, sc * 0.6);
          g.beginPath();
          if (dir === 'n' || dir === 's') {
            g.moveTo(x - doorGap / 2, y); g.lineTo(x + doorGap / 2, y);
          } else {
            g.moveTo(x, y - doorGap / 2); g.lineTo(x, y + doorGap / 2);
          }
          g.stroke();
          return;
        }
        /* Закрытая дверь — деревянное полотно с железной оковкой. */
        const dw = doorGap;
        const dh = Math.max(4, sc * 0.75);
        g.save();
        g.translate(x, y);
        if (dir === 'e' || dir === 'w') g.rotate(Math.PI / 2);
        g.fillStyle = '#1b100a';
        g.fillRect(-dw / 2 - 1, -dh / 2 - 1, dw + 2, dh + 2);
        g.fillStyle = '#6b4426';
        g.fillRect(-dw / 2, -dh / 2, dw, dh);
        g.fillStyle = '#a86832';
        g.fillRect(-dw / 2 + 1, -dh / 2 + 1, dw - 2, 1);
        g.fillStyle = '#ffd36a';
        g.fillRect(dw / 2 - 3, -dh / 2 + 1, 2, dh - 2);
        g.restore();
      };
      const walls = [
        { d: 'n', x1: tr.x, y1: tr.y, x2: tr.x + tr.w, y2: tr.y, cx: tr.x + tr.w / 2, cy: tr.y, horiz: true },
        { d: 's', x1: tr.x, y1: tr.y + tr.h, x2: tr.x + tr.w, y2: tr.y + tr.h, cx: tr.x + tr.w / 2, cy: tr.y + tr.h, horiz: true },
        { d: 'w', x1: tr.x, y1: tr.y, x2: tr.x, y2: tr.y + tr.h, cx: tr.x, cy: tr.y + tr.h / 2, horiz: false },
        { d: 'e', x1: tr.x + tr.w, y1: tr.y, x2: tr.x + tr.w, y2: tr.y + tr.h, cx: tr.x + tr.w, cy: tr.y + tr.h / 2, horiz: false }
      ];
      for (let si = 0; si < walls.length; si++) {
        const s = walls[si];
        const hasExit = !!(r.exits && r.exits[s.d]);
        if (!hasExit) {
          strokeSeg(s.x1, s.y1, s.x2, s.y2);
          continue;
        }
        if (s.horiz) {
          strokeSeg(s.x1, s.y1, s.cx - doorGap / 2, s.y1);
          strokeSeg(s.cx + doorGap / 2, s.y1, s.x2, s.y1);
        } else {
          strokeSeg(s.x1, s.y1, s.x1, s.cy - doorGap / 2);
          strokeSeg(s.x1, s.cy + doorGap / 2, s.x1, s.y2);
        }
        drawDoor(s.cx, s.cy, s.d, S.dungeon.passage(r, s.d));
      }

      /* Выходы (проходы) — на краях комнаты рисуем кружочки
         («ТЯНИ-КАРТУ» надписи здесь убраны — только кружки). */
      if (r.id === S.currentRoom && !cands.length) {
        const b = Math.min(cellW, cellH) * 0.3;
        g.strokeStyle = 'rgba(255,230,160,.5)';
        g.lineWidth = Math.max(1.5, cellH * 0.02);
        g.setLineDash([cellH * 0.05, cellH * 0.04]);
        g.strokeRect(tr.x + b, tr.y + b, tr.w - b * 2, tr.h - b * 2);
        g.setLineDash([]);
        const midX = tr.x + tr.w / 2, midY = tr.y + tr.h / 2;
        const halfW = tr.w / 2 - b * 0.5, halfH = tr.h / 2 - b * 0.5;
        const positions = [
          { d: 'n', x: midX, y: tr.y + b * 0.8 },
          { d: 's', x: midX, y: tr.y + tr.h - b * 0.8 },
          { d: 'w', x: tr.x + b * 0.8, y: midY },
          { d: 'e', x: tr.x + tr.w - b * 0.8, y: midY }
        ];
        for (let k = 0; k < positions.length; k++) {
          const p = positions[k];
          if (!r.exits || !r.exits[p.d]) continue;
          const connected = S.dungeon.passage(r, p.d);
          // filled circle (gold) for available passage, open circle for placed neighbour exit
          g.fillStyle = connected ? '#ffd36a' : '#c49a4a';
          g.globalAlpha = 0.9;
          g.beginPath();
          g.arc(p.x, p.y, Math.max(3, b * 0.5), 0, Math.PI * 2);
          g.fill();
          g.globalAlpha = 1;
          g.strokeStyle = '#241a12';
          g.lineWidth = 1;
          g.stroke();
        }
      }

      // Убраны надписи с мини-карты — название комнаты смотрится сверху через HUD.

      // Жетоны врагов на карте Местности (Дуэли) — красные метки в правом верхнем углу.
      const me = mapEntryByCell(r.gx, r.gz);
      const ne = me && me.enemies ? me.enemies : 0;
      if (ne > 0) {
        const br = Math.max(6, cellH * 0.22);
        for (let t = 0; t < Math.min(ne, 3); t++) {
          const bx = tr.x + tr.w - pad - br * 0.75 - t * (br * 1.05);
          const by = tr.y + pad + br * 0.75;
          g.fillStyle = t >= 2 ? '#8f1d16' : '#c0392b';
          g.beginPath();
          g.arc(bx, by, br * 0.62, 0, Math.PI * 2);
          g.fill();
          g.strokeStyle = 'rgba(255,214,190,.9)';
          g.lineWidth = Math.max(1, br * 0.14);
          g.stroke();
          g.fillStyle = '#ffe9dc';
          g.font = 'bold ' + Math.round(br * 0.8) + 'px Georgia, serif';
          g.textAlign = 'center';
          g.textBaseline = 'middle';
          g.fillText(t === 2 ? '☠' : '⚔', bx, by + br * 0.06);
        }
      }
    }

    // Соединения между картами.
    for (let i = 0; i < rooms.length; i++) {
      const r = rooms[i];
      if (!r.exits) continue;
      const tr = tileRect(r);
      const cx = tr.x + tr.w / 2, cy = tr.y + tr.h / 2;
      const outX = cellW * 0.11, outZ = cellH * 0.22;
      for (let k = 0; k < 4; k++) {
        const d = ['n', 'e', 's', 'w'][k];
        if (!r.exits[d]) continue;
        const connected = S.dungeon.passage(r, d);
        const n = S.dungeon.neighborCell(r.gx, r.gz, d);
        const had = S.dungeon.hasTile(n.gx, n.gz);
        // Проём/стрелка на границе карты.
        let x1 = cx, y1 = cy, x2 = cx, y2 = cy;
        if (d === 'n') { x1 = cx; y1 = tr.y + 2; x2 = cx; y2 = tr.y - outZ; }
        if (d === 's') { x1 = cx; y1 = tr.y + tr.h - 2; x2 = cx; y2 = tr.y + tr.h + outZ; }
        if (d === 'w') { x1 = tr.x + 2; y1 = cy; x2 = tr.x - outX; y2 = cy; }
        if (d === 'e') { x1 = tr.x + tr.w - 2; y1 = cy; x2 = tr.x + tr.w + outX; y2 = cy; }
        if (connected) {
          g.strokeStyle = '#ffd36a';
          g.lineWidth = Math.max(2, sc * 1.15);
          g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke();
        } else if (!had) {
          // Неисследованный проход — пунктир и стрелка.
          g.save();
          g.setLineDash([Math.max(2, sc * 0.5), Math.max(2, sc * 0.35)]);
          g.strokeStyle = 'rgba(255,211,106,.85)';
          g.lineWidth = Math.max(1.5, sc * 0.35);
          g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke();
          g.restore();
        }
        /* Сосед есть, но встречной стрелки нет — на карте уже стоит
           закрытая дверь (drawDoor), отдельная красная линия не нужна. */
      }
    }

    /* Свободные места для новых карт Местности — видно всегда:
       пунктирный прямоугольник с «+» там, где карта может выйти в пустоту. */
    const freeCells = {};
    for (let i = 0; i < rooms.length; i++) {
      const r = rooms[i];
      if (!r.exits) continue;
      for (let k = 0; k < 4; k++) {
        const d = ['n', 'e', 's', 'w'][k];
        if (!r.exits[d]) continue;
        const n = S.dungeon.neighborCell(r.gx, r.gz, d);
        if (n.gx < 0 || n.gz < 0 || n.gx >= S.dungeon.gridSize || n.gz >= S.dungeon.gridSize) continue;
        if (S.dungeon.hasTile(n.gx, n.gz)) continue;
        freeCells[n.gz * S.dungeon.gridSize + n.gx] = true;
      }
    }
    Object.keys(freeCells).forEach(function (key) {
      const gx = parseInt(key, 10) % S.dungeon.gridSize;
      const gz = Math.floor(parseInt(key, 10) / S.dungeon.gridSize);
      const x = gx2px(gx), y = gz2px(gz);
      if (x < -cellW || y < -cellH || x > W + cellW || y > H + cellH) return;
      g.strokeStyle = 'rgba(255,211,106,.42)';
      g.lineWidth = Math.max(1.5, cellH * 0.02);
      g.setLineDash([cellH * 0.06, cellH * 0.045]);
      g.strokeRect(x + cellW * 0.12, y + cellH * 0.12, cellW * 0.76, cellH * 0.76);
      g.setLineDash([]);
      g.fillStyle = 'rgba(255,211,106,.5)';
      g.font = Math.round(Math.min(30, cellH * 0.5)) + 'px serif';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText('+', x + cellW / 2, y + cellH / 2);
    });

    // Свободные клетки для новой карты Местности.
    if (S.pendingTile && S.pendingTile.cands) {
      const cands2 = S.pendingTile.cands;
      for (let i = 0; i < cands2.length; i++) {
        const c = cands2[i];
        const x = gx2px(c.gx);
        const y = gz2px(c.gz);
        const sel = i === S.pendingTile.sel;
        g.fillStyle = sel ? 'rgba(255,211,106,.34)' : 'rgba(255,211,106,.12)';
        g.fillRect(x + 3, y + 3, cellW - 6, cellH - 6);
        g.strokeStyle = sel ? '#ffd36a' : 'rgba(255,211,106,.65)';
        g.lineWidth = sel ? 3 : 1.5;
        g.setLineDash(sel ? [] : [7, 5]);
        g.strokeRect(x + 3, y + 3, cellW - 6, cellH - 6);
        g.setLineDash([]);
        g.fillStyle = sel ? '#ffe6a0' : 'rgba(255,211,106,.75)';
        g.font = Math.round(Math.min(30, cellH * 0.6)) + 'px serif';
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        g.fillText('+', x + cellW / 2, y + cellH / 2);
      }
    }

    // Сундук.
    for (let i = 0; i < rooms.length; i++) {
      const r = rooms[i];
      if (r.type !== 'chest') continue;
      const tr = tileRect(r);
      const cx = tr.x + tr.w / 2, cy = tr.y + tr.h / 2;
      g.save();
      g.translate(cx, cy);
      g.rotate(Math.PI / 4);
      g.fillStyle = '#ffd36a';
      g.fillRect(-sc * 0.9, -sc * 0.9, sc * 1.8, sc * 1.8);
      g.restore();
    }

    // Игрок: мировая клетка — 18 по X и 9 по Z (карта Местности 2:1).
    if (S.player) {
      const px = gx2px(S.player.x / SLOT_W);
      const py = gz2px(S.player.z / SLOT_H);
      const fx = -Math.sin(S.player.yaw), fz = -Math.cos(S.player.yaw);
      const a = cellH * 0.14;                      // длина стрелки взгляда (в 3 раза меньше)
      const w = cellH * 0.055;                     // ширина пера
      g.save();
      g.shadowColor = '#ffe6a0';
      g.shadowBlur = 6;
      g.fillStyle = '#ffe6a0';
      g.beginPath();
      g.moveTo(px + fx * a, py + fz * a);
      g.lineTo(px - fz * w - fx * w, py + fx * w - fz * w);
      g.lineTo(px + fz * w - fx * w, py - fx * w - fz * w);
      g.closePath(); g.fill();
      g.restore();
      g.strokeStyle = '#241a12'; g.lineWidth = 1; g.stroke();
    }

    // Рамка.
    g.strokeStyle = 'rgba(216,163,63,.5)';
    g.lineWidth = 2;
    g.strokeRect(1, 1, W - 2, H - 2);

    drawCompass();
  }

  /** Клик по компасу: сторона, к которой ближе клик, — поворот взгляда. */
  function onCompassClick(ev) {
    if (S.mode !== 'playing' || !S.player || S.stepAnim) return;
    const cv = el('compass');
    if (!cv) return;
    const r = cv.getBoundingClientRect();
    if (!r.width || !r.height) return;
    const x = (ev.clientX - r.left) * (cv.width / r.width) - cv.width / 2;
    const y = (ev.clientY - r.top) * (cv.height / r.height) - cv.height / 2;
    const dist = Math.sqrt(x * x + y * y);
    if (dist < 4) return;                       // клик в центр — ничего
    /* Стороны света: С сверху, Ю снизу, З слева, В справа. */
    const side = (y < 0 && Math.abs(y) >= Math.abs(x)) ? 'n'
      : (y > 0 && Math.abs(y) >= Math.abs(x)) ? 's'
      : (x < 0 ? 'w' : 'e');
    faceDir(side);
  }

  /** Компас: куда смотрим, где открытые проходы и где Сундук. */
  function drawCompass() {
    const cv = el('compass');
    if (!cv || !S.player || !S.dungeon) return;
    const g = cv.getContext('2d');
    const W = cv.width, H = cv.height;
    const cx = W / 2, cy = H / 2, R = Math.min(W, H) / 2 - 7;
    g.clearRect(0, 0, W, H);
    g.fillStyle = 'rgba(18,15,21,.95)';
    g.beginPath(); g.arc(cx, cy, R, 0, 6.2832); g.fill();
    g.strokeStyle = 'rgba(216,163,63,.6)';
    g.lineWidth = 2;
    g.stroke();
    g.strokeStyle = 'rgba(216,163,63,.18)';
    g.lineWidth = 1;
    g.beginPath(); g.arc(cx, cy, R * 0.62, 0, 6.2832); g.stroke();

    const tile = S.dungeon.rooms[S.currentRoom];
    const exits = tile ? tile.exits : {};
    const ang = { n: -Math.PI / 2, e: 0, s: Math.PI / 2, w: Math.PI };
    const order = ['n', 'e', 's', 'w'];
    for (let i = 0; i < order.length; i++) {
      const d = order[i];
      const a = ang[d];
      const dx = Math.cos(a) * (R - 13);
      const dy = Math.sin(a) * (R - 13);
      if (exits[d]) {
        g.fillStyle = '#ffd36a';
        g.beginPath(); g.arc(cx + Math.cos(a) * (R - 25), cy + Math.sin(a) * (R - 25), 4.2, 0, 6.2832); g.fill();
      } else {
        g.fillStyle = 'rgba(160,80,70,.6)';
        g.fillRect(cx + Math.cos(a) * (R - 25) - 2.5, cy + Math.sin(a) * (R - 25) - 2.5, 5, 5);
      }
    }

    g.fillStyle = '#f2e3bf';
    g.font = 'bold 15px Georgia, serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText('С', cx, cy - R + 14);
    g.fillText('Ю', cx, cy + R - 14);
    g.fillText('З', cx - R + 14, cy);
    g.fillText('В', cx + R - 14, cy);

    // Направление взгляда.
    const fx = -Math.sin(S.player.yaw), fz = -Math.cos(S.player.yaw);
    g.strokeStyle = '#ffe6a0';
    g.lineWidth = 3;
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(cx, cy);
    g.lineTo(cx + fx * (R - 22), cy + fz * (R - 22));
    g.stroke();
    g.fillStyle = '#ffe6a0';
    g.beginPath();
    g.arc(cx, cy, 3.5, 0, 6.2832);
    g.fill();

    // Сундук — золотой ромб на кромке.
    if (S.run && S.run.chestPlaced) {
      let chestRoom = null;
      for (let i = 0; i < S.dungeon.rooms.length; i++) {
        if (S.dungeon.rooms[i].type === 'chest') { chestRoom = S.dungeon.rooms[i]; break; }
      }
      if (chestRoom) {
        const c = S.dungeon.center(chestRoom);
        const dx = c.x - S.player.x, dz = c.y - S.player.z;
        const a = Math.atan2(dz, dx);
        const qx = cx + Math.cos(a) * (R - 24);
        const qy = cy + Math.sin(a) * (R - 24);
        g.save();
        g.translate(qx, qy);
        g.rotate(Math.PI / 4);
        g.fillStyle = '#ffd36a';
        g.fillRect(-5, -5, 10, 10);
        g.restore();
      }
    }
    g.lineCap = 'butt';
  }

  /* ================================================================== */
  /*  HUD                                                               */
  /* ================================================================== */
  function updateHUD() {
    if (!S.run) return;
    const gold = el('hud-gold');
    if (gold) gold.textContent = S.run.gold;
    const hp = el('hud-hp');
    if (hp) hp.textContent = Math.max(0, Math.round(S.player ? S.player.hp : S.run.hp));
    UI.setBar('hp-fill', Math.max(0, S.player ? S.player.hp : S.run.hp), S.run.maxHp);
    const power = el('hud-power');
    if (power) {
      power.textContent = '+' + teamTotalPower();
      power.title = 'Итоговая сила команды: Рыцари +' + teamPower() + ', Трофеи +' + teamTrophyPower();
    }
    updateTable();
    updateSpecials();
    renderDeck();
    updateObjective();
    updateSidebar();
    drawMinimap(true);
    const floorName = el('hud-floor');
    if (floorName) {
      const placed = S.run.map ? S.run.map.length : 1;
      floorName.innerHTML = '🗺 Лабиринт · карт: ' + placed;
    }
    updateTurnBar();
  }

  function updateTurnBar() {
    const num = el('turn-num'), btn = el('btn-end-turn');
    if (!num || !S.turn) return;
    const mobile = isMobilePortrait();
    num.textContent = 'ХОД ' + S.turn.number;

    const deckLen = S.run && S.run.deck ? S.run.deck.length : 0;
    const s1done = step1Done();
    const s1skip = !s1done && stepMustSkip();

    const t1 = el('tstep-1'), h1 = el('tstep-1h');
    if (t1) {
      t1.classList.remove('now', 'done', 'skip', 'wait');
      if (s1done) {
        t1.classList.add('done');
        if (h1) h1.textContent = S.turn.moved ? '✓ сделан' : 'пропущено · некуда ходить';
      } else if (s1skip) {
        t1.classList.add('skip');
        if (h1) h1.textContent = 'нечего ходить · пропускается';
      } else {
        t1.classList.add('now');
        if (h1) h1.textContent = S.stepAnim ? 'переход…' : (mobile ? 'тап по комнате на карте' : 'клик по комнате перехода');
      }
    }

    const s2done = !!S.turn.drawn;
    const t2 = el('tstep-2'), h2 = el('tstep-2h');
    if (t2) {
      t2.classList.remove('now', 'done', 'skip', 'wait');
      if (!deckLen) {
        t2.classList.add('skip');
        if (h2) h2.textContent = 'колода пуста';
      } else if (s1done || s1skip) {
        t2.classList.add(s2done ? 'done' : 'now');
        if (h2) h2.textContent = s2done ? '✓ карта взята' : (mobile ? 'тап по колоде' : 'кликом по колоде');
      } else {
        t2.classList.add('wait');
        if (h2) h2.textContent = 'после действия 1';
      }
    }

    if (btn) btn.classList.toggle('ready', (s1done || s1skip) && (s2done || !deckLen));
    updateHint();
  }

  function pendingCardHint(card) {
    if (!card) return '';
    if (card.kind === 'trophy') return '<b>Трофей лежит на столе.</b> Клик — забрать (в свободный слот или в руку), либо потащите прямо на Рыцаря.';
    if (card.kind === 'bot') return '<b>ПароБот напал!</b> Бой открывается сразу — отбейтесь Трофеем, поймайте Клеткой или потеряйте Рыцаря вместе с Трофеем.';
    if (card.kind === 'knight') return '<b>Рыцарь-соперник!</b> Клик по карте — он встанет жетоном врага на текущую карту Местности (в команду НЕ идёт).';
    if (card.kind === 'special' && card.itemType === 'mag') return '<b>Маг!</b> Клик по карте — он вступает в команду, после чего действие 2 продолжается.';
    if (card.kind === 'tile') return '<b>Карта Местности.</b> Клик по ней — выбрать клетку и пристроить карту к лабиринту.';
    if (card.kind === 'cell') return '<b>Клетка-ловушка.</b> Клик по карте — забрать (пригодится, чтобы поймать бота).';
    return '<b>Спецкарта.</b> Клик по карте — применить.';
  }

  /** Живая подсказка «что делать сейчас» — показывает номер обязательного действия. */
  function updateHint() {
    const box = el('next-hint'), badge = el('nh-badge'), text = el('next-hint-text');
    if (!box || !text) return;
    if (!S.run) { box.classList.add('hidden'); return; }
    box.classList.remove('hidden');

    const deckLen = S.run.deck ? S.run.deck.length : 0;
    const s1done = step1Done();
    const s1skip = !s1done && stepMustSkip();
    const mobile = isMobilePortrait();
    let n = '1', html = '', done = false;

    if (S.pendingDuel) {
      n = '⚔';
      html = '<b>Дуэль!</b> Вскройте карты — узнаете, чья взяла.';
    } else if (S.pendingFight) {
      n = '⚔';
      html = '<b>Бой!</b> Выберите Трофей нужного типа и достаточной силы — либо Клетку.';
    } else if (S.pendingTile) {
      n = '2';
      html = mobile
        ? 'Карта Местности на столе: тапните клетку на карте лабиринта → <b>Пристроить</b>.'
        : 'Карта Местности на столе: кликните клетку на карте лабиринта → <b>Пристроить</b>.';
    } else if (S.pendingCard) {
      n = '2';
      html = pendingCardHint(S.pendingCard);
    } else if (S.stepAnim) {
      n = '1';
      html = 'Переход…';
    } else if (!s1done && !s1skip) {
      n = '1';
      html = mobile
        ? '<b>Действие 1 — шаг.</b> Тапните соседнюю клетку на карте лабиринта (только через проход).'
        : '<b>Действие 1 — шаг.</b> Переместитесь на соседнюю клетку через проход, кликнув на неё на мини-карте (только через проход).';
    } else if (!S.turn.moved && curTileEnemies() > 0) {
      n = '⚔';
      html = mobile
        ? '<b>Здесь стоят жетоны врага.</b> Возьмите карту — вас вызовут на Дуэль. Уйти можно переходом (тап по комнате перехода).'
        : '<b>Здесь стоят жетоны врага.</b> Возьмите карту — вас вызовут на Дуэль. Уйти можно переходом (клик по комнате перехода).';
    } else if (!S.turn.drawn && deckLen) {
      n = '2';
      html = mobile
        ? '<b>Действие 2 — взять карту.</b> Тапните по колоде.'
        : '<b>Действие 2 — взять карту.</b> Кликните по колоде (или клавиша <kbd>T</kbd>).';
    } else if (!deckLen) {
      n = '✓';
      html = mobile
        ? 'Колода пуста — взять нечего. Нажмите «Конец хода» и идите к Сундуку.'
        : 'Колода пуста — взять нечего. <kbd>Пробел</kbd> — завершить ход и идти к Сундуку.';
      done = true;
    } else {
      n = '✓';
      html = mobile
        ? 'Ход выполнен. Нажмите «Конец хода».'
        : 'Ход выполнен. <kbd>Пробел</kbd> — завершить ход.';
      done = true;
    }
    if (badge) badge.textContent = n;
    text.innerHTML = html;
    box.classList.toggle('done', done);
  }

  function updateObjective() {
    const obj = el('objective-text');
    if (!obj) return;
    if (S.run && S.run.chestPlaced) {
      obj.innerHTML = '💰 <b>Сундук в лабиринте</b> · переходов: <b>' +
        (S.run.chestDistance || '?') + '</b>';
      if (obj.parentNode) obj.parentNode.classList.add('done');
      return;
    }
    const deck = S.run && S.run.deck ? S.run.deck.length : 0;
    const tiles = Math.max(0, ((S.run && S.run.map) ? S.run.map.length : 1) - 1);
    obj.innerHTML = '🎴 Колода: <b>' + deck + '</b> · 🗺 Местность: <b>' + tiles + '/8</b>' +
      ' · 💰 Сундук: <b>в конце</b>';
    if (obj.parentNode) obj.parentNode.classList.remove('done');
  }

  function updateSidebar() {
    if (!S.run) return;
    const roomEl = el('sidebar-room');
    if (roomEl) {
      const t = S.dungeon && S.dungeon.rooms ? S.dungeon.rooms[S.currentRoom] : null;
      if (!t) roomEl.textContent = '—';
      else {
        const short = { n: 'С', e: 'В', s: 'Ю', w: 'З' };
        const exits = ['n', 'e', 's', 'w'].filter(function (d) { return t.exits && t.exits[d]; })
          .map(function (d) { return short[d]; }).join('·');
        roomEl.textContent = (t.icon || '') + ' ' + t.name + (exits ? ' · выходы: ' + exits : ' · без выходов');
        const ne = enemiesAt(t);
        if (ne > 0) {
          roomEl.innerHTML = KVP.escapeHtml(roomEl.textContent) +
            ' <span class="room-enemy">⚔ враг: ' + ne + '</span>';
        }
      }
    }
    const deckEl = el('sidebar-deck');
    if (deckEl) deckEl.textContent = S.run.deck ? S.run.deck.length : 0;
    const tilesEl = el('sidebar-tiles');
    if (tilesEl) {
      const n = Math.max(0, (S.run.map ? S.run.map.length : 1) - 1);
      tilesEl.textContent = n + '/8';
    }
    const chestEl = el('sidebar-chest');
    if (chestEl) chestEl.textContent = S.run.chestPlaced ? (S.run.chestDistance || 0) + ' пер.' : 'ждёт';
  }

  /** Настольный расклад: под каждым Рыцарём лежит вторая карта — Трофей.
      Подбираем размер карт так, чтобы (1) вся команда поместилась в один
      ряд и (2) стопка «Рыцарь + Трофей» была целиком на виду. */
  function fitTableau() {
    const bar = el('cards-bar');
    if (!bar) return;
    bar.style.removeProperty('--knight-w');          /* вернуть CSS-размер */
    const slots = bar.querySelectorAll('.tb-slot');
    if (!slots.length) return;
    const probe = bar.querySelector('.gcard-knight') || bar.querySelector('.gcard');
    const base = probe ? probe.getBoundingClientRect().width : 0;
    if (!base) return;                                /* расклад скрыт (меню) */
    const gap = parseFloat(getComputedStyle(bar).columnGap) || 12;
    const n = slots.length;

    /* ширина: все бойцы + их Трофеи в один ряд */
    const availW = bar.clientWidth - 4;
    let w = Math.floor((availW - (n - 1) * gap) / n);

    /* высота: две карты одинакового формата с заходом одной на другую */
    const host = bar.parentNode;
    const title = host && host.querySelector ? host.querySelector('.table-title') : null;
    const availH = host && host.clientHeight
      ? host.clientHeight - (title ? title.offsetHeight + 6 : 0) - 4
      : 0;
    if (availH > 0) w = Math.min(w, Math.floor(((availH - 6 + 14) * 0.7) / 2));

    w = Math.max(64, Math.min(w, 160));
    if (Math.abs(w - base) > 1) bar.style.setProperty('--knight-w', w + 'px');
  }

  function updateTable() {
    if (!S.run) return;
    const deckLen = S.run.deck ? S.run.deck.length : 0;
    const deckEl = el('deck-count');
    if (deckEl) deckEl.textContent = deckLen;
    const pile = el('deck-pile');
    if (pile) {
      const canDraw = deckLen > 0 && !S.turn.drawn && !S.pendingCard && !S.pendingTile &&
        (step1Done() || stepMustSkip());
      pile.classList.toggle('empty', deckLen === 0);
      pile.classList.toggle('ready', canDraw && S.mode === 'playing');
    }
    const disc = el('discard-count');
    if (disc) disc.textContent = S.run.stats.drawn || 0;

    // Расклад: полноценные карты Рыцарей и Мага на виду, а не полоска-чип.
    const bar = el('cards-bar');
    if (bar) {
      let html = '';
      S.run.team.forEach(function (k, idx) {
        if (!k.alive) {
          html += '<div class="tb-slot tb-fallen">' +
            '<div class="gcard gcard-fallen gcard-tb">' +
            '<div class="gcard-frame"><div class="fall-mark">✝</div>' +
            '<div class="gcard-title">' + KVP.escapeHtml(k.name) + '</div>' +
            '<div class="gcard-desc">Пал в бою. Бонус Рыцарей уменьшился.</div></div></div></div>';
          return;
        }
        const sel = idx === S.selectedSlot ? ' sel' : '';
        html += '<div class="tb-slot' + sel + '" data-slot="' + idx + '" title="Клик — сделать бойца выбранным">' +
          UI.knight(k, { teamIndex: idx, chip: true, drag: !!k.trophy }) + '</div>';
      });
      if (!S.run.team.length) html = '<div class="cards-empty">Команда пуста</div>';
      bar.innerHTML = html;
    }

    /* Пойманные ПароБоты — линейкой рядом со Сбросом. */
    const winsHost = el('wins-cards');
    if (winsHost) {
      const wins = S.run.wins || [];
      if (!wins.length) {
        winsHost.innerHTML = '<div class="wins-empty">пока ни одного</div>';
      } else {
        winsHost.innerHTML = wins.map(function (bt) {
          return '<div class="wcard">' + UI.bot(bt, { compact: true }) + '</div>';
        }).join('');
      }
      const wcount = el('table-wins-count');
      if (wcount) wcount.textContent = wins.length;
    }

    /* Рука — все карты игрока: Трофеи и спецпредметы вперемешку.
       Любую карту можно перетащить на Рыцаря (Трофей — снарядить,
       спецпредмет — применить) или оставить в руке. */
    const hand = el('hand-bar');
    if (hand) {
      let html = '';
      /* В резерве — пойманные ПароБоты (в ряд), а не «рука». */
      (S.run.wins || []).forEach(function (bt, i) {
        html += '<div class="slot-wrap captured-bot" data-tip="' + KVP.escapeHtml(UI.tipFor ? '' : '') + '" title="' + KVP.escapeHtml((KVP.BOTS[bt]||{}).name || bt) + '">' +
          UI.bot(bt, { compact: true }) + '</div>';
      });
      html += renderItemCards();
      if (!html) html = '<div class="hand-empty">пока ни одного</div>';
      hand.innerHTML = html;
    }

    // Последняя вытянутая карта.
    const reveal = el('deck-reveal');
    if (reveal && !S.lastDrawn) {
      reveal.classList.add('empty');
      reveal.innerHTML = '<div class="rv-cap">ВЫТЯНУТО</div><div class="rv-empty">пока<br>пусто</div>';
    }

    fitTableau();
  }

  function highlightDeck() {
    const pile = el('deck-pile');
    if (!pile) return;
    pile.classList.add('ready');
    pile.animate([
      { transform: 'scale(1)' }, { transform: 'scale(1.06)' }, { transform: 'scale(1)' }
    ], { duration: 420, easing: 'ease-out' });
  }

  /**
   * Спецпредметы (Клетка) — настоящие карточки в общей руке.
   * По правилам Клетка — карта-ловушка (ловит любого ПароБота).
   * Остальные спецкарты применяются сразу при выпадении.
   */
  function renderItemCards() {
    if (!S.run) return '';
    const items = [
      { id: 'cell', n: S.run.cells || 0, hint: 'Ловит любого ПароБота без боя. Перетащите на Рыцаря.' }
    ];
    return items.filter(function (i) { return i.n > 0; }).map(function (i) {
      const sp = KVP.SPECIALS[i.id] || {};
      const tip = UI.tipFor({ kind: 'special', itemType: i.id },
        'Перетащите карточку на Рыцаря — он её применит. ' + i.hint);
      return '<div class="slot-wrap item-wrap" data-drag="item" data-item="' + i.id + '" ' +
        'data-tip="' + KVP.escapeHtml(tip) + '" title="' + KVP.escapeHtml(i.hint) + '">' +
        UI.special(i.id, { compact: true, drag: true }) +
        '<span class="item-count">×' + i.n + '</span></div>';
    }).join('');
  }

  /** Спецпредмет, применённый Рыцарем: клетка ловит бота. */
  function useItemOn(knight, itemId) {
    if (!S.run || !knight) return;
    if (itemId === 'cell') {
      if (S.run.cells <= 0) { UI.toast('Клеток-ловушек нет.', 'bad'); KVP.Audio.play('denied'); return; }
      const target = pickBot(14);
      if (!target) { UI.toast('Рядом нет ПароБота, которого можно поймать.', 'info', 2000); KVP.Audio.play('denied'); return; }
      S.run.cells--;
      S.run.stats.cellsUsed = (S.run.stats.cellsUsed || 0) + 1;
      killBot(target, true);
      UI.toast('🏆 ПОБЕДА! 🪤 <b>' + KVP.escapeHtml(knight.name) + '</b> поймал клеткой ' +
        KVP.escapeHtml(KVP.BOTS[target.type].name) + ' без боя! +' +
        Math.round(rewardFor(target) * 0.5) + ' 💰 · в «Победы».', 'good', 4000);
      S.logEvent('🪤 ' + knight.name + ' поймал ' + KVP.BOTS[target.type].name + ' клеткой.');
      updateHUD(); renderDeck(); updateTargetPanel(0, true);
      return;
    }
  }

  function updateSpecials() {
    const host = el('specials-bar');
    if (!host || !S.run) return;
    let html = '';
    /* Клетка показана карточкой в зоне ПРЕДМЕТЫ — здесь только то,
       что не помещается в карточку: статус Мага и сила команды. */
    if (hasMag()) {
      html += '<span class="spec-chip mag on">🧙 Маг · ВСЕ РЫЦАРИ бьют ТОЛЬКО Бумагой</span>';
    }
    host.innerHTML = (html || '');
  }

  function updateHudTick(dt) {
    S.hudTimer -= dt;
    if (S.hudTimer > 0) return;
    S.hudTimer = 0.25;
    const hp = el('hud-hp');
    if (hp) hp.textContent = Math.max(0, Math.round(S.player.hp));
    UI.setBar('hp-fill', Math.max(0, S.player.hp), S.run.maxHp);
    const gold = el('hud-gold');
    if (gold) gold.textContent = S.run.gold;
    const power = el('hud-power');
    if (power) {
      power.textContent = '+' + teamTotalPower();
      power.title = 'Итоговая сила команды: Рыцари +' + teamPower() + ', Трофеи +' + teamTrophyPower();
    }
    updateSpecials();
    updateObjective();
  }

  /* ================================================================== */
  /*  ПРИЦЕЛ И АНАЛИЗ ЦЕЛИ                                              */
  /* ================================================================== */
  function updateTargetPanel(dt, force) {
    S.targetTimer -= dt;
    if (!force && S.targetTimer > 0) return;
    S.targetTimer = 0.09;
    const cross = el('crosshair');
    if (!cross) return;
    const panel = el('target-panel');
    if (!S.settings.showAnalyzer) {
      if (panel) panel.classList.add('hidden');
      if (S.targetBot) setCrosshair('', '');
      S.targetBot = null;
      return;
    }
    const bot = pickBot(14);
    S.targetBot = bot;
    if (!bot) {
      if (panel) panel.classList.add('hidden');
      setCrosshair('', '');
      return;
    }
    const types = weaponTypesForTarget(bot);
    const a = KVP.analyze(bot.type, types, teamPower(), hasMag());
    S.targetInfo = a;
    const cls = a.mode === 'kill' ? 'kill' : (a.mode === 'stun' ? 'stun' : 'bad');
    setCrosshair(cls, a.mode);
    if (!panel) return;
    panel.classList.remove('hidden');
    panel.className = 'target-panel ' + cls;
    const def = KVP.BOTS[bot.type];
    const tr = selectedTrophy();
    const formula = '<span class="f-item">⚔ ' + a.power + '</span><span class="f-item">🛡 ' + def.armor + '</span>';
    panel.innerHTML =
      '<div class="tp-head">' +
        '<span class="tp-name">' + KVP.escapeHtml(def.name) + '</span>' +
        '<span class="tp-armor">' + KVP.SVG.shield() + ' <b>' + def.armor + '</b></span>' +
      '</div>' +
      '<div class="tp-cond"><span>УСЛОВИЕ</span><b>' + def.conditionShort + '</b><span class="tp-hint">' + KVP.escapeHtml(def.hint) + '</span></div>' +
      '<div class="tp-formula">' +
        '<span class="tp-card">' + (tr ? KVP.SVG.trophy(tr.type) : '—') + '</span>' +
        '<span class="tp-verdict ' + cls + '">' + KVP.escapeHtml(a.title) + '</span>' +
        formula +
      '</div>' +
      '<div class="tp-detail">' + KVP.escapeHtml(a.detail) + '</div>';
  }

  function setCrosshair(cls, mode) {
    const cross = el('crosshair');
    if (!cross) return;
    cross.className = 'crosshair' + (cls ? ' ' + cls : '');
    const hit = el('hitmarker');
    if (hit) hit.className = 'hitmarker' + (mode === 'kill' ? ' kill' : (mode === 'stun' ? ' stun' : ''));
  }

  /* ================================================================== */
  /*  АНИМАЦИИ                                                          */
  /* ================================================================== */
  function animatePickupMeshes(dt) {
    const t = performance.now() * 0.001;
    for (let i = 0; i < S.pickups.length; i++) {
      const p = S.pickups[i];
      if (p.taken || !p.mesh) continue;
      const ud = p.mesh.userData;
      if (ud.baseY != null && ud.card) {
        ud.card.position.y = ud.baseY + Math.sin(t * 1.8 + p.phase) * 0.06;
        ud.card.rotation.y += dt * 0.8;
      } else if (ud.type === 'gold' && ud.glow) {
        p.mesh.rotation.y += dt * 0.7;
        ud.glow.material.opacity = 0.3 + Math.sin(t * 2 + p.phase) * 0.12;
      } else if (ud.type === 'cage' && ud.glow) {
        p.mesh.rotation.y += dt * 0.35;
        ud.glow.material.opacity = 0.28 + Math.sin(t * 2 + p.phase) * 0.12;
      }
    }
  }

  function animatePortal(dt) {
    if (!S.portal || !S.portal.mesh) return;
    const t = performance.now() * 0.001;
    const ud = S.portal.mesh.userData;
    if (ud.ring) ud.ring.rotation.z += dt * (S.floorCleared ? 1.4 : 0.25);
    if (ud.inner) ud.inner.material.opacity = (S.floorCleared ? 0.55 : 0.2) + Math.sin(t * 2) * 0.12;
    if (ud.glow) ud.glow.material.opacity = (S.floorCleared ? 0.55 : 0.18) + Math.sin(t * 1.6) * 0.1;
  }

  /* ================================================================== */
  /*  ПОБЕДА И ОЧКИ                                                     */
  /* ================================================================== */
  function computeScore() {
    const st = S.run.stats;
    const team = S.run.team;
    const teamAlive = team.filter(function (k) { return k.alive; }).length;
    const wins = S.run.wins || [];
    let basicBots = 0, armoredBots = 0, bossBots = 0;
    wins.forEach(function (t) {
      if (t === 'normal' || t === 'spearman') basicBots++;
      else if (t === 'armored') armoredBots++;
      else if (t === 'giant' || t === 'titan' || t === 'titan2') bossBots++;
    });
    const mag = hasMag();
    const aliveKnights = team.filter(function (k) { return k.alive; });
    const rocks = aliveKnights.filter(function (k) { return k.trophy && k.trophy.type === 'rock'; }).length;
    const scissors = aliveKnights.filter(function (k) { return k.trophy && k.trophy.type === 'scissors'; }).length;
    const papers = aliveKnights.filter(function (k) { return k.trophy && k.trophy.type === 'paper'; }).length;
    const traps = aliveKnights.filter(function (k) { return k.trophy && k.trophy.type === 'trap'; }).length;
    const tiles = S.run.map ? S.run.map.length : 1;
    const settingsBonus = KVP.settingBonus(S.run.team);
    const timeBonus = Math.max(0, Math.round((1500 - st.time) / 15));
    const rows = [
      { label: 'Поверженные ПароБоты: обычные и копейщики (1)', value: basicBots * 1, icon: '🤖' },
      { label: 'Бронированные ПароБоты (2)', value: armoredBots * 2, icon: '🛡' },
      { label: 'Боссы-ПароБоты (3)', value: bossBots * 3, icon: '👑' },
      { label: 'Живые Рыцари (1)', value: teamAlive * 1, icon: '⚔️' },
      { label: 'Маг (1)', value: mag ? 1 : 0, icon: '🧙' },
      { label: 'Трофеи Камень/Ножницы (2)', value: (rocks + scissors) * 2, icon: '🪨' },
      { label: 'Трофеи Бумага (2 при Маге)', value: (mag ? papers * 2 : 0), icon: '📜' },
      { label: 'Клетки-ловушки (0)', value: 0, icon: '🪤' },
      { label: 'Сеттинг (30)', value: settingsBonus * 30, icon: '🎨' },
      { label: 'Карты Местности (10)', value: tiles * 10, icon: '🗺' },
      { label: 'Бонус времени', value: timeBonus, icon: '⏱' }
    ];
    const total = rows.reduce(function (s, r) { return s + r.value; }, 0);
    let rank = 'Оруженосец';
    if (total >= 500) rank = 'Магистр логики';
    else if (total >= 380) rank = 'Рыцарь Кибертании';
    else if (total >= 260) rank = 'Страж подземелья';
    else if (total >= 160) rank = 'Бывалый воин';
    return { rows: rows, total: total, rank: rank, tiles: tiles, teamAlive: teamAlive };
  }
  function showVictory() {
    setMode('victory');
    exitLock();
    KVP.Audio.play('victory');
    const score = computeScore();
    const host = el('victory-score');
    if (host) {
      host.innerHTML = '';
      score.rows.forEach(function (r, i) {
        setTimeout(function () {
          const div = document.createElement('div');
          div.className = 'score-row score-reveal';
          div.innerHTML = '<span>' + r.icon + ' ' + KVP.escapeHtml(r.label) + '</span><b>+' + r.value + '</b>';
          host.appendChild(div);
          KVP.Audio.play('coin');
        }, i * 280);
      });
      setTimeout(function () {
        const div = document.createElement('div');
        div.className = 'score-total';
        div.innerHTML = '<span>ИТОГО</span><b>' + score.total + '</b>';
        host.appendChild(div);
        KVP.Audio.play('victory');
      }, score.rows.length * 280 + 200);
    }
    const rank = el('victory-rank');
    if (rank) rank.innerHTML = '<span>Ваш титул</span><b>' + KVP.escapeHtml(score.rank) + '</b>';
    const stats = el('victory-stats');
    if (stats) {
      stats.innerHTML =
        '<span>🗺 ' + score.tiles + ' карт</span>' +
        '<span>⚔ ' + score.teamAlive + ' рыцарей</span>' +
        '<span>💰 ' + S.run.gold + ' золота</span>' +
        '<span>⏱ ' + KVP.formatTime(S.run.stats.time) + '</span>';
    }
    // Лучший результат
    const best = KVP.storage.get('best', 0);
    if (score.total > best) KVP.storage.set('best', score.total);
    KVP.storage.remove('save');
    setPlayingActive(false);
    if (KVP.Menu && KVP.Menu.refresh) KVP.Menu.refresh();
    hideGameScreens();
    hide('hud');
    show('screen-victory');
  }

  /* ================================================================== */
  /*  ПОДСКАЗКИ И МИНИ-ОБУЧЕНИЕ — показывается один раз при первом входе */
  /* ================================================================== */
  const TUT_KEY = 'tutor_v3';   /* в localStorage ключ выглядит как kvp_tutor_v3 */
  let tutStep = 0;

  const TUT_STEPS = [
    {
      ico: '🎲',
      h: 'За ход — два обязательных действия',
      p: 'Их номера всегда видны в панели над подсказкой. <b>1 · ШАГ</b> — переход: выберите комнату перехода на карте (нужен проход). ' +
        '<b>2 · ВЗЯТЬ КАРТУ</b> — достать карту из колоды. Пропустить нельзя: игра подсветит следующий шаг и не даст завершить ход. ' +
        'Если на поле одна карта или сходить некуда — первый шаг пропускается сам.',
      keys: ['1 · ШАГ', '2 · ВЗЯТЬ КАРТУ', 'ПРОБЕЛ — конец хода']
    },
    {
      ico: '🃏',
      h: 'Берём карту из колоды',
      p: 'Нажмите на стопку колоды — карта ляжет в зону <b>ВЫТЯНУТО</b> рядом. ' +
        'Как в жизни: потянули, положили, смотрите, что выпало. То же самое даёт клавиша <kbd>T</kbd>.',
      keys: ['клик по колоде', 'T']
    },
    {
      ico: '✋',
      h: 'Карта ждёт вашего решения',
      p: 'Вытянутая карта лежит на столе и никуда не уходит, пока вы не решите, что с ней делать. ' +
        '<b>Клик</b> по ней — применить по умолчанию. <b>Перетаскивание</b> — сразу на цель: Трофей на Рыцаря, бота — на того, кем будете бить, Трофей — в зону руки. ' +
        'Промахнулись мимо цели — карта пружинкой вернётся на место.',
      keys: ['клик — применить', 'перетащить — на цель', 'ESC — пауза']
    },
    {
      ico: '⚔',
      h: 'Снаряжение и бой',
      p: 'Трофей из руки перетаскивается на карту Рыцаря. «Наклейку» Трофея на Рыцаре можно стащить на другого Рыцаря — они поменяются местами — или в зону руки. ' +
        'Каждый бот пробивается только своим типом оружия: читайте условие на карте и складывайте силу со всеми Рыцарями.',
      keys: ['ТРОФЕЙ → РЫЦАРЬ', '1–9 — выбрать бойца', 'TAB — колода']
    }
  ];

  function renderTutorial() {
    const stage = el('tut-stage'), dots = el('tut-dots');
    const kick = el('tut-kicker'), next = el('btn-tut-next');
    if (stage) {
      stage.innerHTML = TUT_STEPS.map(function (s, i) {
        return '<div class="tut-step' + (i === tutStep ? ' on' : '') + '">' +
          '<div class="tut-ico">' + s.ico + '</div>' +
          '<div class="tut-h">' + s.h + '</div>' +
          '<div class="tut-p">' + s.p + '</div>' +
          '<div class="tut-keys">' + s.keys.map(function (k) {
            return '<span class="tut-key">' + k + '</span>';
          }).join('') + '</div>' +
          '</div>';
      }).join('');
    }
    if (dots) {
      dots.innerHTML = TUT_STEPS.map(function (s, i) {
        return '<span class="tut-dot' + (i === tutStep ? ' on' : '') + '"></span>';
      }).join('');
    }
    if (kick) kick.textContent = 'ПЕРВЫЙ ХОД · ШАГ ' + (tutStep + 1) + ' ИЗ ' + TUT_STEPS.length;
    if (next) next.textContent = tutStep >= TUT_STEPS.length - 1 ? '⚔ Начать игру' : 'Далее →';
  }

  function maybeShowTutorial() {
    if (!S.run || S.run.floorIndex !== 0) return;
    if (KVP.storage.get(TUT_KEY, false)) return;
    /* перенос старого ключа (писался с двойным префиксом: kvp_kvp_tutor_v3) */
    if (KVP.storage.get('kvp_tutor_v3', false)) {
      KVP.storage.set(TUT_KEY, true);
      KVP.storage.remove('kvp_tutor_v3');
      return;
    }
    openTutorial();
  }

  function openTutorial() {
    tutStep = 0;
    renderTutorial();
    hideGameScreens();
    show('screen-tutorial');
    setMode('tutorial');
    exitLock();
    setTimeout(exitLock, 120);   /* браузер может выдать захват чуть позже — гасим и его */
  }

  function tutNext() {
    if (tutStep < TUT_STEPS.length - 1) {
      tutStep += 1;
      renderTutorial();
      KVP.Audio.play('card');
    } else {
      closeTutorial();
    }
  }

  function closeTutorial() {
    hide('screen-tutorial');
    KVP.storage.set(TUT_KEY, true);
    enterPlay();
  }

  G.showTutorial = openTutorial;

  /* ================================================================== */
  /*  СВОДКА В САЙДБАРЕ (раньше — отдельный экран по Tab)                */
  /* ================================================================== */
  function renderDeck() {
    if (!S.run) return;
    const colHost = el('deck-collection');
    const specHost = el('deck-specials');

    if (colHost) {
      /* Победы — это в первую очередь S.run.wins (туда попадает каждый
         поверженный ПароБот: и в бою Трофеем, и в Дуэли, и в 3D-мире).
         byType — запасной источник для старых сохранений. Берём максимум,
         чтобы ничего не потерять и не посчитать дважды. */
      const winsCount = {};
      (S.run.wins || []).forEach(function (bt) {
        if (!bt) return;
        winsCount[bt] = (winsCount[bt] || 0) + 1;
      });
      const by = {};
      const bt = (S.run.stats && S.run.stats.byType) || {};
      Object.keys(bt).forEach(function (k) { by[k] = bt[k]; });
      Object.keys(winsCount).forEach(function (k) {
        by[k] = Math.max(by[k] || 0, winsCount[k]);
      });
      const keys = Object.keys(by).filter(function (k) { return !!KVP.BOTS[k]; });
      if (!keys.length) {
        colHost.innerHTML = '<div class="deck-empty">Пока ни одного поверженного — всё впереди.</div>';
      } else {
        colHost.innerHTML = keys.map(function (k) {
          return '<div class="collection-item"><div class="col-card">' + UI.bot(k, { compact: true }) + '</div>' +
            '<span class="col-count">×' + by[k] + '</span></div>';
        }).join('');
      }
    }
    const winsTotal = (S.run.wins || []).length;
    const wc = el('deck-wins-count');
    if (wc) wc.textContent = winsTotal;
    const hw = el('hud-wins');
    if (hw) hw.textContent = winsTotal;

    if (specHost) {
      /* Спецпредметы видны в РУКЕ (карточками) — здесь только статус Мага и сила. */
      let html = '';
      html += '<div class="spec-line"><span>🧙 Маг в команде</span><b>' + (hasMag() ? 'да · только Бумага' : 'нет') + '</b></div>';
      html += '<div class="spec-line"><span>⚔ Сила команды</span><b>' + teamTotalPower() +
        ' <span style="opacity:.7; font-weight:400">(Рыцари +' + teamPower() + ', Трофеи +' + teamTrophyPower() + ')</span></b></div>';
      specHost.innerHTML = html;
    }

    renderStats();
  }

  function renderStats() {
    const host = el('deck-stats');
    if (!host || !S.run) return;
    const st = S.run.stats;
    const acc = st.shots ? Math.round(st.hits / st.shots * 100) : 0;
    statSec = -1;
    host.innerHTML =
      '<div class="brief-line"><span>💰 Золото</span><b>' + S.run.gold + '</b></div>' +
      '<div class="brief-line"><span>🤖 Уничтожено</span><b>' + st.kills + '</b></div>' +
      '<div class="brief-line"><span>🎯 Точность</span><b>' + acc + '%</b></div>' +
      '<div class="brief-line"><span>⏱ Время</span><b id="stat-time">' + KVP.formatTime(st.time) + '</b></div>';
  }

  /* время тикает само — правим только текст, без перерисовки сводки */
  function patchStatsTime() {
    const t = el('stat-time');
    if (t && S.run) t.textContent = KVP.formatTime(S.run.stats.time);
  }

  /* ================================================================== */
  /*  ЭКСПОРТ ДЛЯ ОТЛАДКИ                                                */
  /* ================================================================== */
  G.state = S;
  G.tick = function (dt) { update(dt || 0.016); };
  G.debug3d = function () {
    return {
      scene: scene, camera: camera, renderer: renderer,
      tokenRoot: tokenRoot, entityRoot: entityRoot,
      tokens: S.tokens || [], worldBot: S.worldBot || null
    };
  };
  G.snapshot = function () {
    if (!renderer || !scene || !camera) return null;
    updateCamera();
    renderer.render(scene, camera);
    return renderer.domElement.toDataURL('image/png');
  };
  G.tryStep = tryStep;
  G.endTurn = endTurn;
  G.drawFromDeck = drawFromDeck;
  G.applyPendingCard = applyPendingCard;
  G.updateHint = updateHint;
  G.confirmPlace = confirmPlace;
  G.cancelPlace = cancelPlace;
  G.selectCandidate = selectCandidate;
  G.openDuel = openDuel;
  G.resolveDuel = resolveDuel;
  G.duelVerdict = duelVerdict;
  G.tileEnemies = function (gx, gz) {
    const e = mapEntryByCell(gx, gz);
    return e && e.enemies ? e.enemies : 0;
  };
  G.curTileEnemies = curTileEnemies;
  G.addEnemyToken = function (n) {
    const room = S.dungeon.rooms[S.currentRoom];
    let last = 0;
    for (let i = 0; i < (n || 1); i++) last = addEnemyToken(room);
    return last;
  };
  G.aliveBots = aliveBots;
  G.refreshTokens = refreshTokens;
  G.showBotInWorld = showBotInWorld;
  G.hideBotInWorld = hideBotInWorld;
  G.openBotFight = openBotFight;
  G.botFightHTML = botFightHTML;
  G.teamPower = teamPower;
  G.teamTrophyPower = teamTrophyPower;
  G.teamTotalPower = teamTotalPower;
  G.computeScore = computeScore;
  G.openDeck = openDeck;
  G.closeDeck = closeDeck;
  G.selectWeaponSlot = selectWeaponSlot;
  G.fitTableau = fitTableau;
  G.attack = attack;
  G.updateHUD = updateHUD;
})();
