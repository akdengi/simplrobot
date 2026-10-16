// Blockly editor (visual blocks) for Golems Puzzles — 4th editor mode.
(function () {
  'use strict';
  const BG4 = (window.BG4 = window.BG4 || {});

  function bodyChain(block, inputName) {
    const out = [];
    const input = block.getInput(inputName);
    if (!input || !input.connection) return out;
    let cur = input.connection.targetBlock();
    while (cur) {
      const st = serializeSingle(cur);
      if (st) out.push(st);
      cur = cur.getNextBlock();
    }
    return out;
  }

  function serializeSingle(block) {
    if (!block) return null;
    switch (block.type) {
      case 'bg_forward': return { t: 'cmd', cmd: 'forward' };
      case 'bg_back': return { t: 'cmd', cmd: 'back' };
      case 'bg_left': return { t: 'cmd', cmd: 'left' };
      case 'bg_right': return { t: 'cmd', cmd: 'right' };
      case 'bg_stand': return { t: 'cmd', cmd: 'wait' };
      case 'bg_attack': return { t: 'cmd', cmd: 'attack' };
      case 'bg_defend': return { t: 'cmd', cmd: 'defend' };
      case 'bg_repeat2': {
        const input = block.getInput('DO');
        let inner = null;
        if (input && input.connection && input.connection.targetBlock()) inner = serializeSingle(input.connection.targetBlock());
        return { t: 'loop', body: inner };
      }
      case 'bg_if': {
        const t = block.getInput('THEN'); const e = block.getInput('ELSE');
        let th = null, el = null;
        if (t && t.connection && t.connection.targetBlock()) th = serializeSingle(t.connection.targetBlock());
        if (e && e.connection && e.connection.targetBlock()) el = serializeSingle(e.connection.targetBlock());
        return { t: 'if', then: th, else: el };
      }
      default: return null;
    }
  }

  function ensureBlocks(Blockly) {
    if (window.__bgBlocksDefined) return;
    window.__bgBlocksDefined = true;
    const json = [
      { type:'bg_program', message0:'=== Программа Голема ===', message1:'%1', args1:[{type:'input_statement', name:'PROGRAM', check:'Action'}], colour:'#FF8C00', deletable:false },
      { type:'bg_forward', message0:'Вперёд', previousStatement:'Action', nextStatement:'Action', colour:'#3aa655' },
      { type:'bg_back', message0:'Назад', previousStatement:'Action', nextStatement:'Action', colour:'#3aa655' },
      { type:'bg_left', message0:'Влево', previousStatement:'Action', nextStatement:'Action', colour:'#3aa655' },
      { type:'bg_right', message0:'Вправо', previousStatement:'Action', nextStatement:'Action', colour:'#3aa655' },
      { type:'bg_stand', message0:'Стоять', previousStatement:'Action', nextStatement:'Action', colour:'#3aa655' },
      { type:'bg_attack', message0:'Удар', previousStatement:'Action', nextStatement:'Action', colour:'#d9534f' },
      { type:'bg_defend', message0:'Защита', previousStatement:'Action', nextStatement:'Action', colour:'#d9534f' },
      { type:'bg_repeat2', message0:'Цикл 2', message1:'%1', args1:[{type:'input_statement', name:'DO', check:'Action'}], previousStatement:'Action', nextStatement:'Action', colour:'#b06ad8' },
      { type:'bg_if', message0:'Если Препятствие', message1:'Да %1', args1:[{type:'input_statement', name:'THEN', check:'Action'}], message2:'Нет %1', args2:[{type:'input_statement', name:'ELSE', check:'Action'}], previousStatement:'Action', nextStatement:'Action', colour:'#b06ad8' }
    ];
    Blockly.defineBlocksWithJsonArray(json);
    if (!document.getElementById('bg-toolbox')) {
      const xml = '<xml xmlns="https://developers.google.com/blockly/xml" id="bg-toolbox" style="display:none">' +
        '<block type="bg_program"></block>' +
        '<category name="Движение" colour="#3aa655">' +
          '<block type="bg_forward"/><block type="bg_back"/><block type="bg_left"/><block type="bg_right"/><block type="bg_stand"/>' +
        '</category>' +
        '<category name="Действия" colour="#d9534f">' +
          '<block type="bg_attack"/><block type="bg_defend"/>' +
        '</category>' +
        '<category name="Бонусы" colour="#b06ad8">' +
          '<block type="bg_repeat2"/><block type="bg_if"/>' +
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
        if (st.body) {
          const inner = makeBlock(ws, st.body);
          if (inner && b.getInput('DO').connection) b.getInput('DO').connection.connect(inner.previousConnection);
        }
        break;
      case 'if':
        b = ws.newBlock('bg_if');
        if (st.then) {
          const th = makeBlock(ws, st.then);
          if (th && b.getInput('THEN').connection) b.getInput('THEN').connection.connect(th.previousConnection);
        }
        if (st.else) {
          const el = makeBlock(ws, st.else);
          if (el && b.getInput('ELSE').connection) b.getInput('ELSE').connection.connect(el.previousConnection);
        }
        break;
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
    // collapse pieces? no
    prog.moveBy(20, 20);
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
    }
  };

  window.BG4.BlocklyEditor = BG4.BlocklyEditor;
})();
