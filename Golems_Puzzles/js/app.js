/*
 * Golems Puzzles — application UI.
 * Screens: menu -> floor map -> level (3D + program editor) ; help / answer / rewards.
 */
(function () {
  'use strict';
  const BG4 = window.BG4;
  const L = window.BG4_LEVELS;
  const ROOMS = L.rooms;
  const SCEN = BG4.SCENARIOS;
  const Prog = BG4.Prog;
  const Engine = BG4.Engine;
  const Progress = BG4.Progress;
  const Scene3D = BG4.Scene3D;

  Progress.setRooms(ROOMS);

  // ---------- tiny DOM helpers ----------
  function h(tag, attrs, children) {
    const el = document.createElement(tag);
    if (attrs) for (const k in attrs) {
      if (k === 'class') el.className = attrs[k];
      else if (k === 'text') el.textContent = attrs[k];
      else if (k === 'html') el.innerHTML = attrs[k];
      else if (k.startsWith('on') && typeof attrs[k] === 'function') el.addEventListener(k.slice(2), attrs[k]);
      else if (attrs[k] != null) el.setAttribute(k, attrs[k]);
    }
    if (children) for (const c of [].concat(children)) if (c != null) el.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    return el;
  }
  const $ = (sel) => document.querySelector(sel);
  function clear(el) { while (el.firstChild) el.removeChild(el.firstChild); }

  function scenarioFor(id) { return SCEN[id] || {}; }
  function commandLimit(level) { const s = scenarioFor(level.id); return s.commandLimit !== undefined ? s.commandLimit : level.commandLimit; }
  function answerText(level) { const s = scenarioFor(level.id); return s.answer || level.solutionText; }

  // ---------- «жетоны из руки» ----------
  // currentLevel + the tokens the player has put on the board himself
  function effectiveLevel() {
    if (!reserveState.length) return currentLevel;
    const keys = new Set(reserveState.map((t) => t.row + ',' + t.col));
    const tokens = currentLevel.tokens.filter((t) => !keys.has(t.r + ',' + t.c));
    for (const t of reserveState) {
      if (t.placed && t.r != null) tokens.push({ r: t.r, c: t.c, layer: 1, t: t.t, type: t.type, rot: t.rot || 0 });
    }
    return Object.assign({}, currentLevel, { tokens, reserve: reserveState });
  }
  function canPlaceOn(r, c) {
    if (!currentLevel) return false;
    if (!BG4.Engine.validCells(currentLevel).has(r + ',' + c)) return false;
    for (const t of currentLevel.tokens) {
      if (t.r !== r || t.c !== c) continue;
      if (t.type === 'wall' || t.type === 'barrel' || t.type === 'portal' || t.type === 'golem') return false;
    }
    for (const t of reserveState) if (t.placed && t.r === r && t.c === c) return false;
    return true;
  }
  function refreshBoard() { Scene3D.setLevel(effectiveLevel()); }

  const CMDS = Prog.CMDS;
  const CMD_ORDER = ['forward', 'back', 'left', 'right', 'wait', 'attack', 'defend'];

  const OBJECTIVE_LABEL = {
    goal: 'Доведи Голема до Целевой точки', defeat: 'Выведи из строя противника',
    survive: 'Продержись и не получи повреждений', destroyBarrel: 'Разрушь Бочку',
    soakBarrel: 'Утопи Бочку в Воде (намокнет — обезвредишь)',
  };

  // ---------- state ----------
  let currentLevel = null;
  let model = { lines: [], endless: false };
  let editorMode = 'cards';
  let usedAnswerThisRun = false;
  let running = false;
  let curBlockly = null;

  // «Жетоны из руки»: printed tokens that lie beside the board until the player
  // puts them on a cell himself (4.4: «Поставьте на клетку с целевой точкой Бочку»).
  let reserveState = [];   // [{t, type, row, col, layer, rot, placed, r, c}]
  let pickedReserve = -1;  // index of the token currently «в руке»

  // Родительский пароль для настройки «Открыть все уровни».
  // Чтобы сменить пароль — поменяйте строку ниже.
  const PARENT_PASSWORD = 'golem';

  // =========================================================
  // Navigation
  // =========================================================
  // Stop a running program and re-arm the Run button. Endless levels never
  // fire play's onDone when the scene is reset or the screen is left mid-play,
  // which used to leave «Запустить» disabled forever.
  function stopRun() {
    running = false;
    const btn = $('#btn-run');
    if (btn) btn.disabled = false;
    Scene3D.stop();
  }

  function show(screen) {
    for (const s of document.querySelectorAll('.screen')) s.classList.toggle('active', s.id === 'screen-' + screen);
    if (screen !== 'level') stopRun();
  }

  function buildMenu() {
    const done = Progress.completedCount();
    const stars = Progress.totalStars();
    $('#menu-stats').textContent = `Пройдено комнат: ${done} / ${ROOMS.length}   ·   ⭐ ${stars} / ${ROOMS.length * 3}   ·   🪙 ${Progress.state.coins}`;
    const grid = $('#menu-floors');
    clear(grid);
    for (const f of L.floors) {
      const p = Progress.floorProgress(f.n);
      const unlocked = Progress.floorUnlocked(f.n);
      const card = h('button', { class: 'floor-card' + (unlocked ? '' : ' locked'), onclick: () => unlocked && openMap(f.n) }, [
        h('div', { class: 'floor-n', text: 'Этаж ' + f.n }),
        h('div', { class: 'floor-name', text: f.name }),
        h('div', { class: 'floor-sub', text: f.subtitle }),
        h('div', { class: 'floor-prog' }, [bar(p.done, p.total), h('span', { text: ` ${p.done}/${p.total} ⭐${p.stars}` })]),
        unlocked ? null : h('div', { class: 'lock', text: '🔒' }),
      ]);
      grid.appendChild(card);
    }
  }

  function bar(done, total) {
    const b = h('div', { class: 'bar' });
    b.appendChild(h('div', { class: 'bar-fill', style: `width:${total ? (done / total * 100) : 0}%` }));
    return b;
  }

  let mapFloor = 1;
  // Текст описания этажа: абзацы, подзаголовки («# …») и списки («- …»).
  function renderFloorIntro(host, text) {
    clear(host);
    const src = String(text || '').trim();
    if (!src) { host.classList.add('hidden'); return; }
    host.classList.remove('hidden');
    for (const block of src.split(/\n{2,}/)) {
      const lines = block.split('\n').map((s) => s.trim()).filter(Boolean);
      if (!lines.length) continue;
      if (lines[0].startsWith('# ')) host.appendChild(h('h3', { class: 'floor-intro-head', text: lines.shift().slice(2) }));
      let list = null;
      for (const ln of lines) {
        if (ln.startsWith('- ')) {
          if (!list) { list = h('ul', { class: 'floor-intro-list' }); host.appendChild(list); }
          list.appendChild(h('li', { text: ln.slice(2) }));
          continue;
        }
        list = null;
        host.appendChild(h('div', { class: 'floor-intro-para', text: ln }));
      }
    }
    // первый подзаголовок без верхнего отступа (его съедает CSS)
    const first = host.firstElementChild;
    if (first && first.classList.contains('floor-intro-head')) first.classList.add('first');
  }
  function openMap(n) {
    mapFloor = n;
    const f = L.floors.find((x) => x.n === n);
    $('#map-title').textContent = `Этаж ${n} — ${f.name}`;
    $('#map-sub').textContent = f.subtitle;
    const introEl = $('#map-intro');
    if (introEl) renderFloorIntro(introEl, (window.BG4_FLOOR_INTROS || {})[n] || f.description || '');
    const grid = $('#map-rooms');
    clear(grid);
    for (const room of ROOMS.filter((r) => r.floor === n)) {
      const unlocked = Progress.isUnlocked(room.id);
      const comp = Progress.isCompleted(room.id);
      const stars = comp ? comp.stars : 0;
      grid.appendChild(h('button', {
        class: 'room-card' + (unlocked ? '' : ' locked') + (comp ? ' done' : ''),
        onclick: () => unlocked && openLevel(room.id),
      }, [
        h('div', { class: 'room-id', text: room.id }),
        h('div', { class: 'room-name', text: 'Комната ' + room.id }), // uniform
        h('div', { class: 'room-stars', text: '⭐'.repeat(stars) + '☆'.repeat(3 - stars) }),
        unlocked ? null : h('div', { class: 'lock', text: '🔒' }),
      ]));
    }
    show('map');
  }

  function nextLevelId(id) {
    const i = ROOMS.findIndex((r) => r.id === id);
    return i >= 0 && i + 1 < ROOMS.length ? ROOMS[i + 1].id : null;
  }

  // =========================================================
  // Level screen
  // =========================================================

  // ---------- bot programs (reference block diagrams, like the course) ----------
  const BOT_COLOR = { red: '#e2564f', blue: '#4f8fe2', green: '#57b45a', yellow: '#d8b23c' };
  const BOT_COLOR_NAME = { red: 'Красный', blue: 'Синий', green: 'Зелёный', yellow: 'Жёлтый' };

  function bpPill(text, cls) { return h('span', { class: 'bp-pill ' + cls, text }); }

  function bpActionLabel(n) {
    switch (n.c) {
      case 'move': return { cls: 'bp-move', label: `Идти ${n.n || 1} шагов` };
      case 'turn': return { cls: 'bp-turn', label: `Повернуть ${n.d === 'ccw' ? '↺' : '↻'} на ${n.n || 90} градусов` };
      case 'attack': return { cls: 'bp-attack', label: 'Атака на 1 силой 1' };
      case 'attackBoth': return { cls: 'bp-attack', label: 'Атака в обе стороны' };
      case 'ai': return { cls: 'bp-ai', label: `Кинь AI кубик (${n.value})` };
      default: return { cls: 'bp-move', label: n.c };
    }
  }
  function bpCondLabel(n) {
    switch (n.c) {
      case 'ifSee': return { cls: 'bp-cond', label: 'Вижу противника на расстоянии 1' };
      case 'ifObstacle': return { cls: 'bp-cond', label: `Препятствие = ${n.n == null ? 1 : n.n}` };
      case 'ifAttack': return { cls: 'bp-cond', label: `Можно в Атаку = ${n.n == null ? 1 : n.n}` };
      default: return { cls: 'bp-cond', label: n.c };
    }
  }

  function bpRenderList(nodes, host) {
    for (const n of (nodes || [])) {
      if (n.c === 'repeat') {
        const ctrl = h('div', { class: 'bp-ctrl' });
        ctrl.appendChild(h('div', { class: 'bp-headline' }, [
          h('span', { class: 'bp-kw', text: 'Повторить' }),
          bpPill(`${n.n || 2} раз(а)`, 'bp-rep'),
        ]));
        const body = h('div', { class: 'bp-arm-body' });
        bpRenderList(n.body, body);
        ctrl.appendChild(body);
        host.appendChild(ctrl);
      } else if (n.c === 'ifSee' || n.c === 'ifObstacle' || n.c === 'ifAttack') {
        const info = bpCondLabel(n);
        const ctrl = h('div', { class: 'bp-ctrl' });
        ctrl.appendChild(h('div', { class: 'bp-headline' }, [
          h('span', { class: 'bp-kw', text: 'если' }),
          bpPill(info.label, info.cls),
        ]));
        const thenBody = h('div', { class: 'bp-arm-body' });
        bpRenderList(n.then, thenBody);
        ctrl.appendChild(h('div', { class: 'bp-arm' }, [h('span', { class: 'bp-kw', text: 'то' }), thenBody]));
        const elseBody = h('div', { class: 'bp-arm-body' });
        bpRenderList(n.else, elseBody);
        if (!elseBody.childNodes.length) elseBody.appendChild(h('span', { class: 'bp-none', text: 'ничего' }));
        ctrl.appendChild(h('div', { class: 'bp-arm' }, [h('span', { class: 'bp-kw', text: 'иначе' }), elseBody]));
        host.appendChild(ctrl);
      } else {
        const info = bpActionLabel(n);
        host.appendChild(h('div', { class: 'bp-line' }, [bpPill(info.label, info.cls)]));
      }
    }
  }

  // Split a bot config into the per-line sections printed by the course:
  // a numbered "Перед строкой Программ игроков N" section per player line,
  // plus a trailing "Перед следующими строками" section for the default program.
  function bpSections(cfg) {
    if (cfg.lines) {
      const out = [];
      const keys = Object.keys(cfg.lines).filter((k) => k !== 'default').sort((a, b) => +a - +b);
      for (const k of keys) out.push({ line: +k, program: cfg.lines[k] || [] });
      if (cfg.lines.default) out.push({ next: true, program: cfg.lines.default });
      return out;
    }
    return [{ line: null, program: cfg.program || [] }];
  }

  function bpCard(cfg, color, caption) {
    const card = h('div', { class: 'bp-card' });
    if (caption) {
      card.appendChild(h('div', { class: 'bp-caption' }, [
        color ? h('span', { class: 'bp-dot', style: 'background:' + color }) : null,
        caption,
      ]));
    }
    const hostEl = h('div', { class: 'bp-view' });
    card.appendChild(hostEl);
    return { card, job: { hostEl, spec: { name: cfg.name || 'Бот', hp: cfg.hp || 1, sections: bpSections(cfg) } } };
  }

  // Show the printed program of every bot that has one (floors 5–6, etc.).
  // Rendered as one read-only Blockly program per bot: an orange
  // «=== Программа для Бота: … ===» wrapper holding the green HP block and the
  // per-line sections. Falls back to plain rows if Blockly is unavailable.
  function renderBotPrograms(scn, level) {
    const host = $('#bot-programs');
    clear(host);
    const authored = (scn && scn.bots) || [];
    const bots = level.bots || [];
    const eligible = [];
    bots.forEach((b, i) => {
      const cfg = authored[i];
      if (!cfg || (!cfg.program && !cfg.lines)) return;
      // for per-line programs the course prints the program per player line
      if (cfg.lines && !cfg.lines[1] && !cfg.lines.default) return;
      eligible.push({ b, cfg });
    });
    const jobs = [];
    const captions = [];
    eligible.forEach((e) => {
      // label each bot by its colour so multi-bot rooms are unambiguous
      const colorName = BOT_COLOR_NAME[e.b.color] || 'Голем';
      const piece = e.cfg.name && e.cfg.name !== colorName ? ` — ${e.cfg.name}` : '';
      const caption = `${colorName} Бот${piece}`;
      captions.push(caption);
      const built = bpCard(e.cfg, BOT_COLOR[e.b.color] || '#9fb3dd', caption);
      host.appendChild(built.card);
      jobs.push(built.job);
    });
    const has = jobs.length > 0;
    const panel = $('#bot-panel');
    if (panel) panel.classList.toggle('hidden', !has);
    host.classList.toggle('hidden', !has);
    const label = $('#bot-toggle .bot-toggle-label');
    if (label) {
      label.textContent = !has ? 'Программа бота'
        : (jobs.length > 1 ? `Программы ботов (${jobs.length})` : `Программа: ${captions[0]}`);
    }
    const viewer = window.BG4.BlocklyEditor && window.BG4.BlocklyEditor.mountViewer;
    for (const job of jobs) {
      if (!viewer) { bpFallback(job); continue; }
      viewer(job.hostEl, job.spec).then((inst) => { if (!inst) bpFallback(job); });
    }
  }

  function bpFallback(job) {
    const hostEl = job.hostEl;
    const spec = job.spec || {};
    clear(hostEl);
    const wrap = h('div', { class: 'bp-wrap' });
    wrap.appendChild(h('div', { class: 'bp-wrap-title', text: `=== Программа для Бота: ${spec.name || 'Бот'} ===` }));
    wrap.appendChild(h('div', { class: 'bp-wrap-hp', text: `Прочность Бота ${spec.hp || 1} единиц Атаки` }));
    for (const sec of spec.sections || []) {
      if (sec.line != null) wrap.appendChild(h('div', { class: 'bp-perline', text: `Перед строкой Программ игроков ${sec.line}` }));
      else if (sec.next) wrap.appendChild(h('div', { class: 'bp-perline', text: 'Перед следующими строками Программ игроков' }));
      const body = h('div', { class: 'bp-body bp-sec' });
      bpRenderList(sec.program, body);
      wrap.appendChild(body);
    }
    hostEl.appendChild(wrap);
  }

  function openLevel(id) {
    stopRun();
    currentLevel = ROOMS.find((r) => r.id === id);
    model = Prog.emptyModel(currentLevel);
    model.endless = !!scenarioFor(id).endless;
    usedAnswerThisRun = false;
    editorMode = 'cards';
    // fresh «рука»: the printed tokens start beside the board
    reserveState = (currentLevel.reserve || []).map((t) => ({
      t: t.t, type: t.type, row: t.row, col: t.col,
      layer: t.layer || 1, rot: t.rot || 0, placed: false,
    }));
    pickedReserve = -1;
    Scene3D.setReserveSelected(-1);

    $('#level-id').textContent = `Комната ${currentLevel.id}`;
    $('#level-task').textContent = currentLevel.task || '';
    $('#level-hint').textContent = currentLevel.hint || '';

    // the course prints a quote under the board (it sometimes hints at the task)
    const quoteEl = $('#level-quote');
    if (quoteEl) {
      const q = String(currentLevel.quote || '').trim();
      quoteEl.textContent = q;
      quoteEl.classList.toggle('hidden', !q);
    }

    const scn = scenarioFor(id);
    renderBotPrograms(scn, currentLevel);
    const obj = scn.objective ? (typeof scn.objective === 'string' ? scn.objective : scn.objective.type) : 'goal';
    const lim = commandLimit(currentLevel);
    const b = currentLevel.bonuses;
    const cards = [];
    if (b.attack) cards.push('Удар'); if (b.defense) cards.push('Защита');
    if (b.loop) cards.push('Цикл 2'); if (b.condition) cards.push('Условие');
    const infoLines = [
      ['Задача: ', OBJECTIVE_LABEL[obj] || obj],
      ['Число строк команд: ', lim != null ? `не более ${lim}` : 'без ограничений'],
      ['Разрешённые карты (кроме перемещений): ', currentLevel.anyCards ? 'любые' : (cards.length ? cards.join(', ') : 'нет')],
      ['Число звёзд: ', '1 — решить, 2 — без показа ответа, 3 — ещё и уложиться в лимит строк без повреждений'],
    ];
    if (scn.endless) infoLines.splice(1, 0, ['Программа: ', 'повторяется бесконечно ∞']);
    const objEl = $('#level-obj');
    clear(objEl);
    for (const [k, v] of infoLines) {
      objEl.appendChild(h('div', { class: 'lo-line' + (k.startsWith('Число звёзд') ? ' lo-stars' : '') }, [
        h('span', { class: 'lo-k', text: k }),
        h('span', { class: 'lo-v', text: v }),
      ]));
    }
    $('#level-hint').textContent = currentLevel.hint || '';

    $('#level-hint').classList.add('hidden');
    if (reserveState.length) setStatus('Жетон из руки: щёлкните по Бочке сбоку поля, затем по клетке, куда её поставить.', '');
    else setStatus('', '');
    $('#reward').classList.add('hidden');

    show('level');
    setTimeout(() => { Scene3D.init($('#canvas3d')); refreshBoard(); Scene3D.resize(); }, 0);
    renderEditor();
  }

  function setStatus(text, kind) {
    const el = $('#status');
    el.textContent = text || '';
    el.className = 'status' + (kind ? ' ' + kind : '');
  }

  // =========================================================
  // Editor
  // =========================================================
  function allowed() { return Prog.allowedCommands(currentLevel); }

  function setMode(mode) {
    if (mode === editorMode) return;
    if (editorMode === 'python' && mode !== 'python') {
      const parsed = Prog.parsePython($('#py-editor').value);
      if (!parsed.errors.length) { model = parsed.model; model.endless = !!scenarioFor(currentLevel.id).endless; }
      else { setStatus('Ошибка в Python-коде: ' + parsed.errors[0], 'bad'); return; }
    }
    if (editorMode === 'blockly' && mode !== 'blockly' && curBlockly) {
      const m = window.BG4.BlocklyEditor.syncModel(curBlockly);
      if (m) { model = m; model.endless = !!scenarioFor(currentLevel.id).endless; }
    }
    editorMode = mode;
    renderEditor();
  }

  function renderEditor() {
    const tabs = $('#editor-tabs');
    clear(tabs);
    for (const [m, label] of [['cards', 'Карты команд'], ['blockly', 'Блоки (Scratch)'], ['python', 'Python-код']]) {
      tabs.appendChild(h('button', { class: 'tab' + (editorMode === m ? ' active' : ''), text: label, onclick: () => setMode(m) }));
    }
    const host = $('#editor');
    clear(host);
    if (editorMode === 'python') { renderPython(host); return; }
    if (editorMode === 'blockly') {
      host.className = 'editor blockly';
      window.BG4.BlocklyEditor.onRequestModel = function () { return model; };
      (function (h) { setTimeout(() => {
        window.BG4.BlocklyEditor.mount(h, model).then((inst) => { curBlockly = inst; if (inst) { inst.onChange = (m) => { model = m; model.endless = !!scenarioFor(currentLevel.id).endless; }; } });
      }, 0); })(host);
      // show a placeholder
      host.appendChild(h('div', { class: 'scratch-hint', text: 'Загружаем Blockly…' }));
      return;
    }
    host.className = 'editor cards';
    renderBlockEditor(host);
  }

  function renderPython(host) {
    host.className = 'editor python';
    host.appendChild(h('p', { class: 'py-hint', text: 'Пиши программу командами: forward(), left(), attack(), repeat(2):, if obstacle: / else:  — и while True: для бесконечного повтора. Строки, начинающиеся с #, — комментарии: Голем их не выполняет.' }));
    const ta = h('textarea', { id: 'py-editor', class: 'py-area', spellcheck: 'false' });
    ta.value = Prog.toPython(model, pyHeader());
    host.appendChild(ta);
  }

  // Заголовок мини-программы для редактора Python.
  function pyHeader() {
    if (!currentLevel) return null;
    return { room: `Комната ${currentLevel.id}`, task: currentLevel.task || '' };
  }

  function renderBlockEditor(host) {
    const list = h('div', { class: 'stmt-list' });
    model.lines.forEach((st, i) => list.appendChild(renderStatement(st, {
      onChange: (v) => { model.lines[i] = v; renderEditor(); },
      onDelete: () => { model.lines.splice(i, 1); renderEditor(); },
      onMove: (d) => { const j = i + d; if (j < 0 || j >= model.lines.length) return; const t = model.lines[i]; model.lines[i] = model.lines[j]; model.lines[j] = t; renderEditor(); },
    }, 0)));
    if (!model.lines.length) list.appendChild(h('div', { class: 'empty', text: 'Программа пуста — добавь команды из палитры ниже.' }));
    host.appendChild(list);
    host.appendChild(h('div', { class: 'palette-title', text: 'Добавить команду:' }));
    host.appendChild(palette((st) => { model.lines.push(st); renderEditor(); }, 0, 'palette'));
    if (scenarioFor(currentLevel.id).endless || model.endless) {
      host.appendChild(h('div', { class: 'endless-note', text: '♾ Программа будет повторяться, пока цель не достигнута.' }));
    }
  }

  function cmdCard(cmd, opts) {
    const c = CMDS[cmd];
    const el = h('div', { class: 'card card-' + c.group });
    const CARDNAME = ({ forward:'Вперед', back:'Назад', left:'Влево', right:'Вправо', wait:'Стоять на месте', attack:'Атака', defend:'Защита' })[cmd];
    if (CARDNAME) {
      const cn = (currentLevel && currentLevel.start && currentLevel.start.color === 'blue') ? 'Синий' : 'Красный';
      const im = h('img', { class: 'card-img', src: 'cards/' + CARDNAME + ' ' + cn + '.png', alt: c.label });
      im.addEventListener('error', function(){ im.style.display = 'none'; });
      el.appendChild(im);
    }
    el.appendChild(h('span', { class: 'card-label', text: c.label }));
    if (opts) {
      const ctr = h('span', { class: 'card-ctr' });
      if (opts.onUp) ctr.appendChild(icon('▲', opts.onUp));
      if (opts.onDown) ctr.appendChild(icon('▼', opts.onDown));
      ctr.appendChild(icon('✕', opts.onDelete));
      el.appendChild(ctr);
    }
    return el;
  }
  function icon(txt, fn) { return h('button', { class: 'mini', text: txt, onclick: fn }); }

  function renderStatement(st, cb, depth) {
    const wrap = h('div', { class: 'stmt depth-' + depth });
    if (st.t === 'cmd') {
      wrap.appendChild(cmdCard(st.cmd, cb));
      return wrap;
    }
    if (st.t === 'loop') {
      const head = h('div', { class: 'card card-bonus' }, []);
      const loopImg = h('img', { class: 'card-img', src: 'cards/Цикл ' + ((currentLevel && currentLevel.start && currentLevel.start.color === 'blue') ? 'Синий' : 'Красный') + '.png', alt: 'Цикл' });
      loopImg.addEventListener('error', function(){ loopImg.style.display = 'none'; });
      head.appendChild(loopImg);
      head.appendChild(h('span', { class: 'card-label', text: 'Цикл 2 (повторить 2 раза)' }));
      const ctr = h('span', { class: 'card-ctr' });
      if (cb.onUp) ctr.appendChild(icon('▲', cb.onUp));
      if (cb.onDown) ctr.appendChild(icon('▼', cb.onDown));
      ctr.appendChild(icon('✕', cb.onDelete));
      head.appendChild(ctr);
      wrap.appendChild(head);
      wrap.appendChild(h('div', { class: 'slot-label', text: 'тело цикла:' }));
      wrap.appendChild(bodySlot(st.body, (v) => cb.onChange({ t: 'loop', body: v }), depth + 1));
      return wrap;
    }
    if (st.t === 'if') {
      const head = h('div', { class: 'card card-bonus' }, []);
      const ifImg = h('img', { class: 'card-img', src: 'cards/Условие ' + ((currentLevel && currentLevel.start && currentLevel.start.color === 'blue') ? 'Синий' : 'Красный') + '.png', alt: 'Условие' });
      ifImg.addEventListener('error', function(){ ifImg.style.display = 'none'; });
      head.appendChild(ifImg);
      head.appendChild(h('span', { class: 'card-label', text: 'Условие: Препятствие' }));
      const ctr = h('span', { class: 'card-ctr' });
      if (cb.onUp) ctr.appendChild(icon('▲', cb.onUp));
      if (cb.onDown) ctr.appendChild(icon('▼', cb.onDown));
      ctr.appendChild(icon('✕', cb.onDelete));
      head.appendChild(ctr);
      wrap.appendChild(head);
      wrap.appendChild(h('div', { class: 'slot-label', text: 'ДА (есть препятствие):' }));
      wrap.appendChild(bodySlot(st.then, (v) => cb.onChange({ t: 'if', then: v, else: st.else }), depth + 1));
      wrap.appendChild(h('div', { class: 'slot-label', text: 'НЕТ (препятствия нет):' }));
      wrap.appendChild(bodySlot(st.else, (v) => cb.onChange({ t: 'if', then: st.then, else: v }), depth + 1));
      return wrap;
    }
    return wrap;
  }

  function bodySlot(st, onChange, depth) {
    const box = h('div', { class: 'slot' });
    if (st) {
      box.appendChild(renderStatement(st, { onChange, onDelete: () => onChange(null) }, depth));
    } else {
      box.appendChild(palette((s) => onChange(s), depth, 'slot-palette'));
    }
    return box;
  }

  function palette(onPick, depth, cls) {
    const a = allowed();
    const counts = Prog.availableCounts(currentLevel);
    const used = Prog.countUsage(model);
    const suffix = (currentLevel && currentLevel.start && currentLevel.start.color === 'blue') ? 'Синий' : 'Красный';
    const cardName = (cmd) => ({ forward:'Вперед', back:'Назад', left:'Влево', right:'Вправо', wait:'Стоять на месте', attack:'Атака', defend:'Защита' })[cmd];
    const p = h('div', { class: 'palette ' + (cls || '') });
    for (const cmd of CMD_ORDER) {
      if (!a[cmd]) continue;
      const c = CMDS[cmd];
      const left = (counts[cmd] || 0) - (used[cmd] || 0);
      const btn = h('button', { class: 'pbtn pbtn-' + c.group + (left <= 0 ? ' pbtn-disabled' : ''), disabled: left <= 0 ? true : undefined });
      const imPath = cardName(cmd) ? ('cards/' + cardName(cmd) + ' ' + suffix + '.png') : null;
      if (imPath) {
        const im = h('img', { class: 'pbtn-img', src: imPath, alt: c.short });
        im.addEventListener('error', () => { im.style.display = 'none'; });
        btn.appendChild(im);
      }
      btn.appendChild(document.createTextNode('+ ' + c.short + (left > 0 ? ' (' + left + '/' + counts[cmd] + ')' : '')));
      btn.addEventListener('click', () => {
        if (left <= 0) return;
        onPick({ t: 'cmd', cmd });
      });
      p.appendChild(btn);
    }
    if (a.loop) {
      const nLeft = (counts.loop || 0) - (used.loop || 0);
      const b = h('button', { class: 'pbtn pbtn-bonus' + (nLeft <= 0 ? ' pbtn-disabled' : ''), disabled: nLeft <= 0 ? true : undefined });
      const im = h('img', { class: 'pbtn-img', src: 'cards/Цикл ' + ((currentLevel && currentLevel.start && currentLevel.start.color === 'blue') ? 'Синий' : 'Красный') + '.png', alt: 'Цикл 2' });
      im.addEventListener('error', () => { im.style.display = 'none'; });
      b.appendChild(im);
      b.appendChild(document.createTextNode('+ Цикл 2' + (nLeft > 0 ? ' (' + nLeft + '/' + counts.loop + ')' : '')));
      b.addEventListener('click', () => { if (nLeft > 0) onPick({ t: 'loop', body: null }); });
      if (nLeft <= 0) b.classList.add('pbtn-disabled');
      p.appendChild(b);
    }
    if (a.if) {
      const nLeft = (counts.if || 0) - (used.if || 0);
      const b = h('button', { class: 'pbtn pbtn-bonus' + (nLeft <= 0 ? ' pbtn-disabled' : ''), disabled: nLeft <= 0 ? true : undefined });
      const im = h('img', { class: 'pbtn-img', src: 'cards/Условие ' + ((currentLevel && currentLevel.start && currentLevel.start.color === 'blue') ? 'Синий' : 'Красный') + '.png', alt: 'Условие' });
      im.addEventListener('error', () => { im.style.display = 'none'; });
      b.appendChild(im);
      b.appendChild(document.createTextNode('+ Условие' + (nLeft > 0 ? ' (' + nLeft + '/' + counts.if + ')' : '')));
      b.addEventListener('click', () => { if (nLeft > 0) onPick({ t: 'if', then: null, else: null }); });
      if (nLeft <= 0) b.classList.add('pbtn-disabled');
      p.appendChild(b);
    }
    return p;
  }

  // =========================================================
  // Run
  // =========================================================
  function run() {
    if (running) return;
    if (editorMode === 'python') {
      const parsed = Prog.parsePython($('#py-editor').value);
      if (parsed.errors.length) { setStatus('Ошибка: ' + parsed.errors[0], 'bad'); return; }
      model = parsed.model; model.endless = !!scenarioFor(currentLevel.id).endless;
    }
    if (editorMode === 'blockly' && curBlockly) {
      const m = window.BG4.BlocklyEditor.syncModel(curBlockly);
      if (m) { model = m; model.endless = !!scenarioFor(currentLevel.id).endless; }
    }
    const errs = Prog.validate(model, Object.assign({}, currentLevel, { commandLimit: commandLimit(currentLevel) }));
    if (errs.length) { setStatus('⚠ ' + errs[0], 'bad'); return; }

    const program = Prog.toIR(model);
    const res = Engine.simulate(effectiveLevel(), scenarioFor(currentLevel.id), program);
    running = true;
    setStatus('Голем выполняет программу…', '');
    $('#btn-run').disabled = true;
    Scene3D.play(res.frames, {
      speed: 1.6,
      onDone: () => {
        running = false;
        $('#btn-run').disabled = false;
        finishRun(res);
      },
    });
  }

  function finishRun(res) {
    if (res.result === 'success') {
      const limit = commandLimit(currentLevel);
      let stars = 1;
      const clean = !usedAnswerThisRun && !Progress.usedHint(currentLevel.id);
      if (clean) stars++;
      const efficient = (limit == null || res.linesExecuted <= limit) && !playerDamaged(res);
      if (clean && efficient) stars++;
      const info = Progress.complete(currentLevel.id, stars, res.linesExecuted);
      setStatus('✅ ' + (res.message || 'Задание выполнено!'), 'good');
      showReward(stars, info);
    } else {
      setStatus('❌ ' + (res.message || 'Программа не достигла цели') + ' — попробуй ещё раз.', 'bad');
    }
  }

  function playerDamaged(res) {
    const end = res.frames[res.frames.length - 1];
    const p = end.golems.find((g) => g.isPlayer);
    return !p || (p.damage || 0) > 0;
  }

  function showReward(stars, info) {
    const r = $('#reward');
    clear(r);
    r.appendChild(h('div', { class: 'reward-title', text: 'Комната пройдена!' }));
    r.appendChild(h('div', { class: 'reward-stars', text: '⭐'.repeat(stars) + '☆'.repeat(3 - stars) }));
    if (info.first) r.appendChild(h('div', { class: 'reward-coins', text: '🪙 +' + (10 + stars * 5) }));
    const next = nextLevelId(currentLevel.id);
    const btns = h('div', { class: 'reward-btns' });
    if (next && Progress.isUnlocked(next)) btns.appendChild(h('button', { class: 'btn primary', text: 'Следующая комната →', onclick: () => openLevel(next) }));
    btns.appendChild(h('button', { class: 'btn', text: 'К этажу', onclick: () => openMap(currentLevel.floor) }));
    r.appendChild(btns);
    r.classList.remove('hidden');
  }

  function resetProgram() {
    stopRun();
    model = Prog.emptyModel(currentLevel);
    model.endless = !!scenarioFor(currentLevel.id).endless;
    usedAnswerThisRun = false;
    renderEditor();
    // the placed «жетоны из руки» stay on the board — they are part of the setup
    if (reserveState.length) setStatus('Жетон из руки: щёлкните по Бочке сбоку поля, затем по клетке, куда её поставить.', '');
    else setStatus('', '');
    refreshBoard();
  }

  function showAnswer() {
    usedAnswerThisRun = true;
    Progress.markHint(currentLevel.id);
    const parsed = Prog.parseSolution(answerText(currentLevel));
    model = { lines: parsed, endless: !!scenarioFor(currentLevel.id).endless };
    editorMode = 'cards';
    renderEditor();
    setStatus('Подсказка: ответ показан (звёзд будет меньше).', 'warn');
  }

  // =========================================================
  // Help / settings modals
  // =========================================================
  function openHelp() {
    const body = $('#help-body');
    clear(body);
    const tabs = $('#help-tabs');
    clear(tabs);
    L.info.forEach((page, i) => {
      tabs.appendChild(h('button', { class: 'tab' + (i === 0 ? ' active' : ''), text: page.title, onclick: () => selectHelp(page, body, tabs) }));
    });
    if (L.info[0]) selectHelp(L.info[0], body, tabs);
    $('#help').classList.remove('hidden');
  }
  function commandCardName(line) {
    const l = line.toLowerCase().trim();
    if (l.startsWith('вперед')) return 'cards/Вперед Красный.png';
    if (l.startsWith('назад')) return 'cards/Назад Красный.png';
    if (l.startsWith('поворот влево')) return 'cards/Влево Красный.png';
    if (l.startsWith('поворот вправо')) return 'cards/Вправо Красный.png';
    if (l.startsWith('стоять на месте')) return 'cards/Стоять на месте Красный.png';
    if (l.startsWith('атака')) return 'cards/Атака Красный.png';
    if (l.startsWith('защита')) return 'cards/Защита Красный.png';
    if (l.startsWith('цикл 2')) return 'cards/Цикл Красный.png';
    if (l.startsWith('условие')) return 'cards/Условие Красный.png';
    return null;
  }
  function selectHelp(page, body, tabs) {
    [...tabs.children].forEach((c) => c.classList.toggle('active', c.textContent === page.title));
    clear(body);
    const cmdPage = page.title && page.title.toLowerCase().indexOf('доступные команды') >= 0;
    const notPage = page.title && page.title.toLowerCase().indexOf('обозначения') >= 0;
    for (const para of String(page.text || '').split('\n')) {
      if (!para.trim()) continue;
      const src = cmdPage ? commandCardName(para) : null;
      if (src) {
        const row = h('div', { class: 'help-command' });
        const img = h('img', { class: 'help-cmd-img', src: src, alt: para });
        img.addEventListener('error', () => { img.style.display = 'none'; });
        row.appendChild(img);
        row.appendChild(h('div', { class: 'help-cmd-text', text: para }));
        body.appendChild(row);
      } else {
        body.appendChild(h('p', { text: para }));
      }
    }
    // Token/model legend (image cheat-sheet) only for "Обозначения"
    if (notPage) {
      const grid = h('div', { class: 'help-card-grid' });
      const items = [
        ['water', 'Вода', 'assets/img/water.png'],
        ['ice', 'Лёд', 'assets/img/ice.png'],
        ['barell', 'Бочка', 'assets/img/barell.png'],
        ['stone', 'Камень (стена)', 'assets/img/stone.png'],
        ['portal', 'Портал', 'assets/img/portal.png'],
        ['goal', 'Цель', 'assets/img/goal.png'],
        ['spring', 'Пружина', 'assets/img/spring.png'],
        ['line_straight', 'Линия прямая', 'assets/img/line_straight.png'],
        ['line_corner', 'Линия угол', 'assets/img/line_corner.png'],
      ];
      for (const [k, lab, src] of items) {
        const card = h('div', { class: 'help-card' });
        const img = h('img', { class: 'help-card-img', src: src, alt: lab });
        img.addEventListener('error', () => { img.style.display = 'none'; });
        card.appendChild(img);
        card.appendChild(h('div', { class: 'help-card-label', text: lab }));
        grid.appendChild(card);
      }
      body.appendChild(h('h3', { text: 'Препятствия и токены' }));
      body.appendChild(grid);
      const robots = h('div', { class: 'help-card-grid' });
      for (const [f, lab] of [["Красный Рубашка", "Красный Голем"], ["Синий Рубашка", "Синий Голем"], ["Зеленый Рубашка", "Зеленый Голем"], ["Желтый Рубашка", "Желтый Голем"]]) {
        const card = h('div', { class: 'help-card' });
        const img = h('img', { class: 'help-card-img', src: 'cards/' + f + '.png', alt: lab });
        img.addEventListener('error', () => { img.style.display = 'none'; });
        card.appendChild(img);
        card.appendChild(h('div', { class: 'help-card-label', text: lab }));
        robots.appendChild(card);
      }
      body.appendChild(h('h3', { text: 'Роботы/Големы' }));
      body.appendChild(robots);
      // Field image cue
      const pole = h('img', { class: 'help-card-img', src: 'assets/img/pole_4x4.png', alt: 'Поле 4x4' });
      pole.addEventListener('error', () => { pole.style.display = 'none'; });
      body.appendChild(h('h3', { text: 'Поле 4×4' }));
      body.appendChild(pole);
    }
  }



  function openSettings() {
    $('#export-area').value = Progress.exportJSON();
    try {
      if ($('#stl-toggle')) $('#stl-toggle').checked = Progress.stlEnabled();
      renderUnlockState();
    } catch (e) { console.warn('settings setup failed', e); }
    $('#settings').classList.remove('hidden');
  }

  // ---- parental "unlock all levels" ----
  function renderUnlockState() {
    const on = Progress.unlockAllEnabled();
    const toggle = $('#unlock-all-toggle');
    if (toggle) toggle.checked = on;
    const row = $('#unlock-pass-row');
    if (row) row.classList.add('hidden');
    const pass = $('#unlock-pass');
    if (pass) pass.value = '';
    const status = $('#unlock-status');
    if (status) status.textContent = on ? 'Уровни открыты (режим родителей).' : '';
  }

  // rebuild the menu + current floor map so lock icons disappear/appear
  function refreshLocks() {
    buildMenu();
    const active = document.querySelector('.screen.active');
    if (active && active.id === 'screen-map') openMap(mapFloor);
  }

  // =========================================================
  // wire up
  // =========================================================
  function init() {
    $('#btn-continue').onclick = () => {
      const id = ROOMS.find((r) => Progress.isUnlocked(r.id) && !Progress.isCompleted(r.id));
      openLevel(id ? id.id : ROOMS[0].id);
    };
    $('#btn-help').onclick = openHelp;
    $('#btn-settings').onclick = openSettings;
    $('#help-close').onclick = () => $('#help').classList.add('hidden');
    $('#settings-close').onclick = () => $('#settings').classList.add('hidden');
    $('#map-back').onclick = () => { buildMenu(); show('menu'); };
    $('#btn-back').onclick = () => openMap(currentLevel.floor);
    $('#btn-run').onclick = run;
    $('#btn-reset').onclick = resetProgram;
    $('#btn-answer').onclick = showAnswer;
    $('#btn-hint').onclick = () => $('#level-hint').classList.toggle('hidden');

    // «жетоны из руки» (4.4: Бочка лежит сбоку поля — игрок сам ставит её на клетку)
    Scene3D.onReservePick = (index) => {
      if (pickedReserve === index) {
        pickedReserve = -1;
        Scene3D.setReserveSelected(-1);
        setStatus('', '');
        return;
      }
      pickedReserve = index;
      Scene3D.setReserveSelected(index);
      setStatus('Жетон в руке: щёлкните по клетке поля, чтобы поставить его.', '');
    };
    Scene3D.onCellPick = (r, c) => {
      if (!reserveState.length) return;
      // putting the token we are holding onto the board
      if (pickedReserve >= 0) {
        const t = reserveState[pickedReserve];
        if (!canPlaceOn(r, c)) { setStatus('Сюда этот жетон поставить нельзя.', 'bad'); return; }
        t.placed = true; t.r = r; t.c = c;
        pickedReserve = -1;
        Scene3D.setReserveSelected(-1);
        refreshBoard();
        setStatus('Жетон поставлен на поле.', 'good');
        return;
      }
      // taking back a token that is already lying on the board
      const idx = reserveState.findIndex((t) => t.placed && t.r === r && t.c === c);
      if (idx >= 0) {
        reserveState[idx].placed = false;
        reserveState[idx].r = undefined;
        reserveState[idx].c = undefined;
        refreshBoard();
        setStatus('Жетон возвращён за поле.', '');
      }
    };

    // collapse/expand the printed bot programs so the player's editor gets room
    const botToggle = $('#bot-toggle');
    if (botToggle) botToggle.onclick = () => {
      const panel = $('#bot-panel');
      if (!panel) return;
      const collapsed = panel.classList.toggle('collapsed');
      botToggle.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
      const caret = botToggle.querySelector('.bot-caret');
      if (caret) caret.textContent = collapsed ? '▸' : '▾';
    };
    $('#btn-import').onclick = () => { if (Progress.importJSON($('#export-area').value)) { buildMenu(); openSettings(); } };
    $('#btn-reset-progress').onclick = () => { if (confirm('Сбросить весь прогресс?')) { Progress.reset(); buildMenu(); openSettings(); } };
    const astl = $('#apply-stl'); if (astl) astl.onclick = () => { Progress.setStlEnabled($('#stl-toggle').checked); if (currentLevel) refreshBoard(); };

    // parental unlock-all: checkbox needs the parent password to turn ON;
    // turning it OFF (re-locking) is always allowed.
    const unlockToggle = $('#unlock-all-toggle');
    if (unlockToggle) unlockToggle.onchange = () => {
      const status = $('#unlock-status');
      const row = $('#unlock-pass-row');
      if (Progress.unlockAllEnabled()) {
        Progress.setUnlockAll(false);
        renderUnlockState();
        refreshLocks();
        if (status) status.textContent = 'Уровни снова закрыты.';
        return;
      }
      // blocked: revert the tick and ask for the password
      unlockToggle.checked = false;
      if (row) row.classList.remove('hidden');
      const p = $('#unlock-pass');
      if (p) { p.value = ''; p.focus(); }
      if (status) status.textContent = 'Введите пароль родителя.';
    };

    const unlockApply = $('#unlock-apply');
    if (unlockApply) unlockApply.onclick = () => {
      const status = $('#unlock-status');
      const pass = $('#unlock-pass');
      const val = pass ? pass.value : '';
      if (val === PARENT_PASSWORD) {
        Progress.setUnlockAll(true);
        renderUnlockState();
        refreshLocks();
        if (status) status.textContent = 'Готово: все уровни открыты.';
      } else {
        if (status) status.textContent = 'Неверный пароль.';
        if (pass) { pass.value = ''; pass.focus(); }
      }
    };

    const unlockPass = $('#unlock-pass');
    if (unlockPass) unlockPass.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); if (unlockApply) unlockApply.onclick(); }
    });
    window.addEventListener('resize', () => Scene3D.resize());

    if (!Progress.state.seenIntro) { Progress.setSeenIntro(); openHelp(); }
    buildMenu();
    show('menu');
  }

  window.addEventListener('DOMContentLoaded', init);
})();
