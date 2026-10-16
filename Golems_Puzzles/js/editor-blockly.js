// Blockly editor (visual blocks) for Golems Puzzles — 4th editor mode.
(function () {
  'use strict';
  const BG4 = (window.BG4 = window.BG4 || {});

  function cmdLabel(cmd) {
    return { forward:'Вперёд', back:'Назад', left:'Влево', right:'Вправо', wait:'Стоять', attack:'Удар', defend:'Защита' }[cmd];
  }

  function bodyFirst(block, inputName) {
    const input = block.getInput(inputName);
    if (!input || !input.connection) return null;
    const t = input.connection.targetBlock();
    if (!t) return null;
    return serializeSingle(t);
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
      case 'bg_repeat2': return { t: 'loop', body: bodyFirst(block, 'DO') };
      case 'bg_if': return { t: 'if', then: bodyFirst(block, 'THEN'), else: bodyFirst(block, 'ELSE') };
      default: return null;
    }
  }

  function ensureBlocks(Blockly) {
    if (window.__bgBlocksDefined) return;
    window.__bgBlocksDefined = true;
    const json = [
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
    // toolbox as XML
    if (!document.getElementById('bg-toolbox')) {
      const xml = '<xml xmlns="https://developers.google.com/blockly/xml" id="bg-toolbox" style="display:none">' +
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
      div.id = 'bg-toolbox-host';
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
          const t = makeBlock(ws, st.then);
          if (t && b.getInput('THEN').connection) b.getInput('THEN').connection.connect(t.previousConnection);
        }
        if (st.else) {
          const e = makeBlock(ws, st.else);
          if (e && b.getInput('ELSE').connection) b.getInput('ELSE').connection.connect(e.previousConnection);
        }
        break;
      default: return null;
    }
    b.initSvg();
    b.render();
    return b;
  }

  const instances = {};

  async function ensureBlocklyLib() {
    if (window.Blockly) return true;
    // try local path then CDN
    function loadScript(src) {
      return new Promise((res, rej) => {
        const s = document.createElement('script');
        s.src = src;
        s.onload = () => res(true);
        s.onerror = () => rej(new Error('load failed ' + src));
        document.head.appendChild(s);
      });
    }
    if (location.protocol === 'file:') {
      // cannot XHR-ish; attempt local paths
      try { await loadScript('lib/blockly/blockly.min.js'); await loadScript('lib/blockly/msg_ru.js').catch(() => {}); return !!window.Blockly; } catch (e) { return false; }
    }
    try { await loadScript('lib/blockly/blockly.min.js'); await loadScript('lib/blockly/msg_ru.js').catch(() => {}); if (window.Blockly) return true; } catch (e) {}
    try { await loadScript('https://unpkg.com/blockly@12.2.0/blockly.min.js'); await loadScript('https://unpkg.com/blockly@12.2.0/msg/ru.js').catch(() => {}); return !!window.Blockly; } catch (e) { return false; }
  }

  function topBlocksInOrder(ws) {
    const tops = ws.getTopBlocks(true);
    tops.sort((a, b) => {
      const ay = a.getRelativeToSurfaceXY().y;
      const by = b.getRelativeToSurfaceXY().y;
      const ax = a.getRelativeToSurfaceXY().x;
      const bx = b.getRelativeToSurfaceXY().x;
      if (Math.abs(ay - by) > 8) return ay - by;
      return ax - bx;
    });
    return tops;
  }

  function serializeChain(block) {
    const out = [];
    let cur = block;
    while (cur) {
      const st = serializeSingle(cur);
      if (st) out.push(st);
      cur = cur.getNextBlock();
    }
    return out;
  }

  function modelFromWorkspace(ws) {
    const lines = [];
    for (const top of topBlocksInOrder(ws)) {
      lines.push(...serializeChain(top));
    }
    return { lines: lines, endless: false };
  }

  function modelToWorkspace(ws, model) {
    ws.clear();
    if (!model || !model.lines) return;
    let prev = null;
    for (const st of model.lines) {
      const b = makeBlock(ws, st);
      if (!b) continue;
      if (prev && prev.nextConnection && b.previousConnection) {
        try { prev.nextConnection.connect(b.previousConnection); } catch (e) {}
      } else {
        // place lower each time
      }
      prev = b;
      b.moveBy(prev ? 0 : 0, 0);
    }
  }

  BG4.BlocklyEditor = {
    async mount(container, model) {
      if (!container) return;
      const ok = await ensureBlocklyLib();
      if (!ok) { container.innerHTML = '<div class="empty">Blockly не загрузилась ( нет сети / нет lib/blockly ).</div>'; return null; }
      if (window.__bgBlocksDefined) ensureBlocks(window.Blockly);
      else { ensureBlocks(window.Blockly); }
      const div = document.createElement('div');
      div.className = 'blocklyDiv';
      div.style.width = '100%';
      div.style.height = '360px';
      div.style.position = 'relative';
      container.innerHTML = '';
      container.appendChild(div);
      let ws;
      try {
        ws = window.Blockly.inject(div, { toolbox: document.getElementById('bg-toolbox') });
      } catch (e) {
        // fallback: create toolbox element
        const tb = document.getElementById('bg-toolbox-host');
        if (tb && tb.querySelector('xml')) ws = window.Blockly.inject(div, { toolbox: tb.querySelector('xml') });
      }
      if (!ws) return null;
      modelToWorkspace(ws, model || { lines: [] });
      const home = instances[container] = { ws: ws, model: model || { lines: [] } };
      // fire changes
      ws.addChangeListener(() => {
        const m = modelFromWorkspace(ws);
        home.model = m;
        if (typeof home.onChange === 'function') home.onChange(m);
      });
      return home;
    },
    getModel(inst) { return inst ? inst.model : null; },
    syncModel(inst, onChange) {
      if (!inst) return null;
      const m = modelFromWorkspace(inst.ws);
      inst.model = m;
      if (onChange) onChange(m);
      return m;
    }
  };

  window.BG4.BlocklyEditor = BG4.BlocklyEditor;
})();
