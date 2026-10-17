// Blockly editor (visual blocks) for Golems Puzzles — 4th editor mode.
(function () {
  'use strict';
  const BG4 = (window.BG4 = window.BG4 || {});

  function numField(block, name, def) {
    const f = block.getField(name);
    if (!f) return def;
    const v = Number(f.getValue());
    return isFinite(v) ? v : def;
  }

  function bodyChain(block, inputName) {
    const out = [];
    const input = block.getInput(inputName);
    if (!input || !input.connection) return out;
    let cur = input.connection.targetBlock();
    while (cur) {
      out.push(...serializeBlock(cur));
      cur = cur.getNextBlock();
    }
    return out;
  }

  // Returns an array of statements: "Идти N шагов" expands into N commands.
  function serializeBlock(block) {
    if (!block) return [];
    switch (block.type) {
      case 'bg_forward': { const n = Math.max(1, Math.round(numField(block, 'N', 1))); return Array.from({ length: n }, () => ({ t: 'cmd', cmd: 'forward' })); }
      case 'bg_back': { const n = Math.max(1, Math.round(numField(block, 'N', 1))); return Array.from({ length: n }, () => ({ t: 'cmd', cmd: 'back' })); }
      case 'bg_left': { const n = Math.max(1, Math.round(numField(block, 'N', 90) / 90)); return Array.from({ length: n }, () => ({ t: 'cmd', cmd: 'left' })); }
      case 'bg_right': { const n = Math.max(1, Math.round(numField(block, 'N', 90) / 90)); return Array.from({ length: n }, () => ({ t: 'cmd', cmd: 'right' })); }
      case 'bg_stand': return [{ t: 'cmd', cmd: 'wait' }];
      case 'bg_attack': return [{ t: 'cmd', cmd: 'attack' }];
      case 'bg_defend': return [{ t: 'cmd', cmd: 'defend' }];
      case 'bg_repeat2': return [{ t: 'loop', body: bodyChain(block, 'DO')[0] || null }];
      case 'bg_if': return [{ t: 'if', then: bodyChain(block, 'THEN')[0] || null, else: bodyChain(block, 'ELSE')[0] || null }];
      default: return [];
    }
  }

  function serializeSingle(block) { return serializeBlock(block)[0] || null; }

  // Player blocks reuse the same visual language as the printed bot programs:
  // the same colours and the same parameters (Идти N шагов, Повернуть ↻ на N
  // градусов, Атака на N силой M, Повторить N раз(а), если … то … иначе …).
  const P_MOVE = '#4a90e2';
  const P_ATTACK = '#e26ba5';
  const P_LOGIC = '#f7941d';
  const P_COND = '#7cc576';

  function ensureBlocks(Blockly) {
    if (window.__bgBlocksDefined) return;
    window.__bgBlocksDefined = true;
    const A = 'Action';
    const json = [
      { type:'bg_program', message0:'=== Программа Голема ===', message1:'%1', args1:[{type:'input_statement', name:'PROGRAM', check:A}], colour:P_LOGIC, deletable:false },
      { type:'bg_forward', message0:'Идти %1 шагов', args0:[{type:'field_number', name:'N', value:1, min:1, precision:1}], previousStatement:A, nextStatement:A, colour:P_MOVE },
      { type:'bg_back', message0:'Назад %1 шагов', args0:[{type:'field_number', name:'N', value:1, min:1, precision:1}], previousStatement:A, nextStatement:A, colour:P_MOVE },
      { type:'bg_left', message0:'Повернуть ↺ на %1 градусов', args0:[{type:'field_number', name:'N', value:90, min:0, precision:90}], previousStatement:A, nextStatement:A, colour:P_MOVE },
      { type:'bg_right', message0:'Повернуть ↻ на %1 градусов', args0:[{type:'field_number', name:'N', value:90, min:0, precision:90}], previousStatement:A, nextStatement:A, colour:P_MOVE },
      { type:'bg_stand', message0:'Стоять на месте', previousStatement:A, nextStatement:A, colour:P_MOVE },
      { type:'bg_attack', message0:'Атака на %1 силой %2', args0:[{type:'field_number', name:'N', value:1, min:1, max:1}, {type:'field_number', name:'P', value:1, min:1, max:1}], previousStatement:A, nextStatement:A, colour:P_ATTACK },
      { type:'bg_defend', message0:'Защита', previousStatement:A, nextStatement:A, colour:P_ATTACK },
      { type:'bg_obstacle', message0:'Препятствие = %1', args0:[{type:'field_number', name:'N', value:1, min:0, max:1}], output:'Boolean', colour:P_COND },
      { type:'bg_repeat2', message0:'Повторить %1 раз(а)', args0:[{type:'field_number', name:'N', value:2, min:1}], message1:'%1', args1:[{type:'input_statement', name:'DO', check:A}], previousStatement:A, nextStatement:A, colour:P_LOGIC },
      { type:'bg_if', message0:'если %1', args0:[{type:'input_value', name:'COND', check:'Boolean', align:'RIGHT'}], message1:'то %1', args1:[{type:'input_statement', name:'THEN', check:A}], message2:'иначе %1', args2:[{type:'input_statement', name:'ELSE', check:A}], previousStatement:A, nextStatement:A, colour:P_LOGIC }
    ];
    Blockly.defineBlocksWithJsonArray(json);
    if (!document.getElementById('bg-toolbox')) {
      const xml = '<xml xmlns="https://developers.google.com/blockly/xml" id="bg-toolbox" style="display:none">' +
        '<block type="bg_program"></block>' +
        '<category name="Движение" colour="' + P_MOVE + '">' +
          '<block type="bg_forward"/><block type="bg_back"/><block type="bg_left"/><block type="bg_right"/><block type="bg_stand"/>' +
        '</category>' +
        '<category name="Действия" colour="' + P_ATTACK + '">' +
          '<block type="bg_attack"/><block type="bg_defend"/>' +
        '</category>' +
        '<category name="Бонусы" colour="' + P_LOGIC + '">' +
          '<block type="bg_repeat2"/><block type="bg_if"/><block type="bg_obstacle"/>' +
        '</category>' +
      '</xml>';
      const div = document.createElement('div');
      div.innerHTML = xml;
      document.body.appendChild(div);
    }
  }

  function makeBlock(ws, st) {
    let b;
    switch (st.t) {
      case 'cmd':
        switch (st.cmd) {
          case 'forward': b = ws.newBlock('bg_forward'); break;
          case 'back': b = ws.newBlock('bg_back'); break;
          case 'left': b = ws.newBlock('bg_left'); break;
          case 'right': b = ws.newBlock('bg_right'); break;
          case 'wait': b = ws.newBlock('bg_stand'); break;
          case 'attack': b = ws.newBlock('bg_attack'); break;
          case 'defend': b = ws.newBlock('bg_defend'); break;
          default: return null;
        }
        break;
      case 'loop':
        b = ws.newBlock('bg_repeat2');
        if (b.getField('N')) b.getField('N').setValue('2');
        if (st.body) {
          const inner = makeBlock(ws, st.body);
          if (inner && b.getInput('DO').connection) b.getInput('DO').connection.connect(inner.previousConnection);
        }
        break;
      case 'if': {
        b = ws.newBlock('bg_if');
        // the condition block shown inside «если …» (Препятствие = 1)
        const cond = ws.newBlock('bg_obstacle');
        const ci = b.getInput('COND');
        if (cond && ci && ci.connection && cond.outputConnection) ci.connection.connect(cond.outputConnection);
        if (st.then) {
          const th = makeBlock(ws, st.then);
          if (th && b.getInput('THEN').connection) b.getInput('THEN').connection.connect(th.previousConnection);
        }
        if (st.else) {
          const el = makeBlock(ws, st.else);
          if (el && b.getInput('ELSE').connection) b.getInput('ELSE').connection.connect(el.previousConnection);
        }
        break;
      }
      default: return null;
    }
    return b;
  }

  const instances = {};

  async function ensureBlocklyLib() {
    if (window.Blockly) return true;
    function loadScript(src) {
      return new Promise((res, rej) => {
        const s = document.createElement('script');
        s.src = src;
        s.onload = () => res(true);
        s.onerror = () => rej(new Error('load failed ' + src));
        document.head.appendChild(s);
      });
    }
    // local (non-CORS in same origin) then CDN
    const attempts = [
      ['lib/blockly/blockly.min.js', 'lib/blockly/msg_ru.js'],
      ['https://unpkg.com/blockly@12.2.0/blockly.min.js', 'https://unpkg.com/blockly@12.2.0/msg/ru.js']
    ];
    for (const a of attempts) {
      try {
        await loadScript(a[0]);
        if (a[1]) await loadScript(a[1]).catch(() => {});
        if (window.Blockly) return true;
      } catch (e) {}
    }
    return false;
  }

  function modelFromWorkspace(ws) {
    let lines = [];
    const programs = ws.getBlocksByType('bg_program', true);
    if (programs.length) {
      for (const p of programs) lines = lines.concat(bodyChain(p, 'PROGRAM'));
    } else {
      // fallback: top action blocks
      const tops = ws.getTopBlocks(true);
      tops.sort((a, b) => a.getRelativeToSurfaceXY().y - b.getRelativeToSurfaceXY().y);
      for (const t of tops) {
        let cur = t;
        while (cur) { const st = serializeSingle(cur); if (st) lines.push(st); cur = cur.getNextBlock(); }
      }
    }
    return { lines: lines, endless: false };
  }

  function modelToWorkspace(ws, model) {
    ws.clear();
    // create a single program block
    const prog = ws.newBlock('bg_program');
    prog.initSvg();
    let prev = null;
    for (const st of (model.lines || [])) {
      const b = makeBlock(ws, st);
      if (!b) continue;
      b.initSvg();
      b.render();
      const input = prog.getInput('PROGRAM');
      if (input && input.connection) {
        if (!input.connection.targetBlock()) input.connection.connect(b.previousConnection);
        else {
          // append to chain of last
          let last = input.connection.targetBlock();
          while (last.getNextBlock()) last = last.getNextBlock();
          if (last.nextConnection && b.previousConnection) last.nextConnection.connect(b.previousConnection);
        }
      }
      prev = b;
    }
    prog.render();
    // render every block (including the ones nested inside Цикл/Условие)
    ws.getAllBlocks(false).forEach((b) => { if (b.initSvg) b.initSvg(); if (b.render) b.render(); });
    prog.moveBy(20, 20);
  }

  // ---------- read-only viewer for printed bot programs (floors 5–6) ----------
  // Blocks mirror the course printout: an orange «=== Программа для Бота: … ===»
  // wrapper, a green "Прочность Бота N …" block and the program inside it.
  const BOTC = { prog: '#f7941d', hp: '#5cb85c', cond: '#7cc576', move: '#4a90e2', attack: '#e26ba5', logic: '#f7941d', ai: '#9b59b6' };
  const BOT_ACTION = 'BotAction';
  const BOT_COND = 'BotCond';

  function ensureBotBlocks(Blockly) {
    if (window.__bgBotBlocksDefined) return;
    window.__bgBotBlocksDefined = true;
    const A = BOT_ACTION, C = BOT_COND;
    Blockly.defineBlocksWithJsonArray([
      { type: 'bgb_program', message0: '=== Программа для Бота: %1 ===', args0: [{ type: 'field_input', name: 'NAME', text: 'Бот' }], message1: '%1', args1: [{ type: 'input_statement', name: 'PROGRAM', check: A }], colour: BOTC.prog, deletable: false },
      { type: 'bgb_hp', message0: 'Прочность Бота %1 единиц Атаки', args0: [{ type: 'field_number', name: 'HP', value: 1, min: 1 }], previousStatement: A, nextStatement: A, colour: BOTC.hp },
      { type: 'bgb_line', message0: 'Перед строкой Программ игроков %1', args0: [{ type: 'field_number', name: 'LINE', value: 1, min: 1 }], message1: '%1', args1: [{ type: 'input_statement', name: 'DO', check: A }], previousStatement: A, nextStatement: A, colour: BOTC.prog },
      { type: 'bgb_line_next', message0: 'Перед следующими строками Программ игроков', message1: '%1', args1: [{ type: 'input_statement', name: 'DO', check: A }], previousStatement: A, nextStatement: A, colour: BOTC.prog },
      { type: 'bgb_if', message0: 'если %1', args0: [{ type: 'input_value', name: 'COND', check: C, align: 'RIGHT' }], message1: 'то %1', args1: [{ type: 'input_statement', name: 'THEN', check: A }], message2: 'иначе %1', args2: [{ type: 'input_statement', name: 'ELSE', check: A }], previousStatement: A, nextStatement: A, colour: BOTC.logic },
      { type: 'bgb_repeat', message0: 'Повторить %1 раз(а)', args0: [{ type: 'field_number', name: 'N', value: 2, min: 1 }], message1: '%1', args1: [{ type: 'input_statement', name: 'DO', check: A }], previousStatement: A, nextStatement: A, colour: BOTC.logic },
      { type: 'bgb_see', message0: 'Вижу противника на расстоянии %1', args0: [{ type: 'field_number', name: 'N', value: 1, min: 1 }], output: C, colour: BOTC.cond },
      { type: 'bgb_obstacle', message0: 'Препятствие = %1', args0: [{ type: 'field_number', name: 'N', value: 1, min: 0, max: 1 }], output: C, colour: BOTC.cond },
      { type: 'bgb_can_attack', message0: 'Можно в Атаку = %1', args0: [{ type: 'field_number', name: 'N', value: 1, min: 0, max: 1 }], output: C, colour: BOTC.cond },
      { type: 'bgb_move', message0: 'Идти %1 шагов', args0: [{ type: 'field_number', name: 'N', value: 1, min: 1, precision: 1 }], previousStatement: A, nextStatement: A, colour: BOTC.move },
      { type: 'bgb_turn', message0: 'Повернуть %1 на %2 градусов', args0: [{ type: 'field_dropdown', name: 'D', options: [['↻', 'cw'], ['↺', 'ccw']] }, { type: 'field_number', name: 'N', value: 90, min: 0, precision: 90 }], previousStatement: A, nextStatement: A, colour: BOTC.move },
      { type: 'bgb_attack', message0: 'Атака на %1 силой %2', args0: [{ type: 'field_number', name: 'N', value: 1, min: 1 }, { type: 'field_number', name: 'P', value: 1, min: 1 }], previousStatement: A, nextStatement: A, colour: BOTC.attack },
      { type: 'bgb_attack_both', message0: 'Атака в обе стороны', previousStatement: A, nextStatement: A, colour: BOTC.attack },
      { type: 'bgb_ai', message0: 'Кинь AI кубик %1', args0: [{ type: 'field_number', name: 'V', value: 1, min: 1, max: 6 }], previousStatement: A, nextStatement: A, colour: BOTC.ai }
    ]);
  }

  function botConditionBlock(ws, n) {
    let c;
    if (n.c === 'ifSee') { c = ws.newBlock('bgb_see'); }
    else if (n.c === 'ifObstacle') { c = ws.newBlock('bgb_obstacle'); }
    else if (n.c === 'ifAttack') { c = ws.newBlock('bgb_can_attack'); }
    else return null;
    if (c.getField('N')) c.getField('N').setValue(String(n.n == null ? 1 : n.n));
    return c;
  }

  function makeBotAction(ws, n) {
    if (!n || !n.c) return null;
    switch (n.c) {
      case 'move': { const b = ws.newBlock('bgb_move'); b.getField('N').setValue(String(n.n || 1)); return b; }
      case 'turn': { const b = ws.newBlock('bgb_turn'); b.getField('D').setValue(n.d === 'ccw' ? 'ccw' : 'cw'); b.getField('N').setValue(String(n.n || 90)); return b; }
      case 'attack': { const b = ws.newBlock('bgb_attack'); b.getField('N').setValue('1'); b.getField('P').setValue('1'); return b; }
      case 'attackBoth': return ws.newBlock('bgb_attack_both');
      case 'ai': { const b = ws.newBlock('bgb_ai'); b.getField('V').setValue(String(n.value == null ? 1 : n.value)); return b; }
      case 'repeat': { const b = ws.newBlock('bgb_repeat'); b.getField('N').setValue(String(n.n || 2)); chainBotInput(ws, b, 'DO', n.body); return b; }
      case 'ifSee': case 'ifObstacle': case 'ifAttack': {
        const b = ws.newBlock('bgb_if');
        const cond = botConditionBlock(ws, n);
        const ci = b.getInput('COND');
        if (cond && ci && ci.connection) ci.connection.connect(cond.outputConnection);
        chainBotInput(ws, b, 'THEN', n.then);
        chainBotInput(ws, b, 'ELSE', n.else);
        return b;
      }
      default: return null;
    }
  }

  // Append a list of statements to a connection (or chain after a previous block).
  function appendBotChain(ws, connection, list, head) {
    let prev = head || null;
    for (const node of list || []) {
      const b = makeBotAction(ws, node);
      if (!b) continue;
      if (!prev) { if (connection) connection.connect(b.previousConnection); }
      else if (prev.nextConnection && b.previousConnection) prev.nextConnection.connect(b.previousConnection);
      prev = b;
    }
    return prev;
  }

  function chainBotInput(ws, parent, inputName, list) {
    if (!list || !list.length) return;
    const inp = parent.getInput(inputName);
    if (!inp || !inp.connection) return;
    appendBotChain(ws, inp.connection, list);
  }

  function fitViewer(ws, div, opts) {
    try {
      const box = ws.getBlocksBoundingBox();
      const w = box ? (box.right - box.left) : 0;
      const hh = box ? (box.bottom - box.top) : 0;
      if (!box || !isFinite(w) || !isFinite(hh) || w <= 0 || hh <= 0) {
        div.style.height = '80px';
        window.Blockly.svgResize(ws);
        return;
      }
      const pad = 28;
      // grow the div to the full height of the printed program so nothing is clipped;
      // the surrounding panel scrolls if it gets tall.
      div.style.height = Math.max(Math.ceil(hh + pad), 80) + 'px';
      window.Blockly.svgResize(ws);
      if (ws.zoomToFit) ws.zoomToFit();
    } catch (e) {}
  }

  // Build the orange "Перед строкой Программ игроков N" header block.
  function botLineHeader(ws, section) {
    if (section.line != null) {
      const b = ws.newBlock('bgb_line');
      if (b.getField('LINE')) b.getField('LINE').setValue(String(section.line));
      return b;
    }
    if (section.next) return ws.newBlock('bgb_line_next');
    return null;
  }

  // Mount a read-only Blockly workspace that just shows the blocks (no toolbox, no dragging).
  // spec = { name, hp, sections:[{ line:N|next:true, program:[...] }] }
  async function mountViewer(container, spec, opts) {
    opts = opts || {};
    if (!container) return null;
    const ok = await ensureBlocklyLib();
    if (!ok) return null;
    ensureBotBlocks(window.Blockly);
    const div = document.createElement('div');
    div.className = 'blocklyDiv bot-blockly';
    div.style.height = '120px';
    container.innerHTML = '';
    container.appendChild(div);
    let ws;
    try {
      ws = window.Blockly.inject(div, {
        readOnly: true,
        trashcan: false,
        renderer: 'geras',
        zoom: { controls: false, wheel: false, startScale: 1, maxScale: 1, minScale: 0.3, pinch: false },
        move: { scrollbars: false, wheel: false, drag: false },
      });
    } catch (e) { container.innerHTML = ''; return null; }
    if (!ws) { container.innerHTML = ''; return null; }
    ws.clear();

    spec = spec || {};
    const name = spec.name || opts.name || 'Бот';
    const hpVal = spec.hp || opts.hp || 1;
    const sections = spec.sections && spec.sections.length
      ? spec.sections
      : [{ line: null, program: spec.program || opts.program || [] }];

    // orange wrapper with the bot name, holding the HP block and every per-line section
    const prog = ws.newBlock('bgb_program');
    if (prog.getField('NAME')) prog.getField('NAME').setValue(String(name));
    const hp = ws.newBlock('bgb_hp');
    if (hp.getField('HP')) hp.getField('HP').setValue(String(hpVal));
    const pInput = prog.getInput('PROGRAM');
    if (pInput && pInput.connection) pInput.connection.connect(hp.previousConnection);
    let tail = hp;
    for (const sec of sections) {
      const header = botLineHeader(ws, sec);
      if (header) {
        if (tail.nextConnection && header.previousConnection) tail.nextConnection.connect(header.previousConnection);
        const inp = header.getInput('DO');
        const after = inp && inp.connection ? appendBotChain(ws, inp.connection, sec.program || [], null) : null;
        tail = after || header;
      } else {
        tail = appendBotChain(ws, null, sec.program || [], tail) || tail;
      }
    }

    ws.getAllBlocks(false).forEach((b) => { if (b.initSvg) b.initSvg(); if (b.render) b.render(); });
    fitViewer(ws, div, opts);
    // re-fit once layout settles (fonts / container width) so nothing stays clipped
    if (typeof requestAnimationFrame === 'function') requestAnimationFrame(() => fitViewer(ws, div, opts));
    return { ws, div };
  }

  BG4.BlocklyEditor = {
    async mount(container, model) {
      if (!container) return null;
      const ok = await ensureBlocklyLib();
      if (!ok) { container.innerHTML = '<div class="empty">Blockly не загрузилась (нет сети / lib/blockly).</div>'; return null; }
      ensureBlocks(window.Blockly);
      const div = document.createElement('div');
      div.className = 'blocklyDiv';
      div.style.width = '100%';
      div.style.height = '360px';
      div.style.position = 'relative';
      container.innerHTML = '';
      container.appendChild(div);
      let ws;
      try {
        const tb = document.getElementById('bg-toolbox');
        ws = window.Blockly.inject(div, { toolbox: tb });
      } catch (e) { try { ws = window.Blockly.inject(div, { toolbox: document.getElementById('bg-toolbox') }); } catch (e2) { ws = null; } }
      if (!ws) { container.innerHTML = '<div class="empty">Не удалось создать Blockly.</div>'; return null; }
      window.Blockly.svgResize(ws);
      modelToWorkspace(ws, model || { lines: [] });
      const home = { ws: ws, model: model || { lines: [] } };
      ws.addChangeListener(() => {
        const m = modelFromWorkspace(ws);
        home.model = m;
        if (typeof home.onChange === 'function') home.onChange(m);
      });
      return home;
    },
    syncModel(inst) {
      if (!inst) return null;
      const m = modelFromWorkspace(inst.ws);
      inst.model = m;
      return m;
    },
    mountViewer(container, program, opts) { return mountViewer(container, program, opts); }
  };

  window.BG4.BlocklyEditor = BG4.BlocklyEditor;
})();
