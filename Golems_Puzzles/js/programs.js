/*
 * Golems Puzzles — program model, compilers and parsers.
 *
 * A program is a list of top-level statements ("lines"), matching the board game:
 *   { t:'cmd',  cmd:'forward'|'back'|'left'|'right'|'wait'|'attack'|'defend' }
 *   { t:'loop', body: Statement }                 // Повторить 2 раза
 *   { t:'if',   then: Statement|null, else: Statement|null }
 *
 * The same model is edited by the three editors (cards / scratch / python)
 * and executed by the engine.
 */
(function () {
  'use strict';
  const BG4 = (window.BG4 = window.BG4 || {});

  const CMDS = {
    forward: { label: 'Вперёд', short: 'Вперёд', text: 'Вперёд', group: 'move', color: '#3aa655' },
    back: { label: 'Назад', short: 'Назад', text: 'Назад', group: 'move', color: '#3aa655' },
    left: { label: 'Поворот влево', short: 'Поворот влево', text: 'Поворот влево', group: 'move', color: '#3aa655' },
    right: { label: 'Поворот вправо', short: 'Поворот вправо', text: 'Поворот вправо', group: 'move', color: '#3aa655' },
    wait: { label: 'Стоять на месте', short: 'Стоять на месте', text: 'Стоять на месте', group: 'move', color: '#3aa655' },
    attack: { label: 'Атака', short: 'Атака', text: 'Атака', group: 'action', color: '#d9534f' },
    defend: { label: 'Защита', short: 'Защита', text: 'Защита', group: 'action', color: '#d9534f' },
  };

  // Which commands are available for a level. Перемещения есть всегда, а карты
  // (кроме перемещений) — строго по бонусам комнаты: если в сведениях стоит
  // «Разрешённые карты …: нет», то в палитре будут только перемещения.
  // Исключение — `anyCards` (этаж 6): «применяй любые карты, которые посчитаешь
  // необходимыми».
  function allowedCommands(level) {
    const b = (level && level.bonuses) || {};
    const any = !!(level && level.anyCards);
    return {
      forward: true, back: true, left: true, right: true, wait: true,
      attack: any || !!b.attack,
      defend: any || !!b.defense,
      loop: any || !!b.loop,
      if: any || !!b.condition,
    };
  }

  const mk = (cmd) => ({ t: 'cmd', cmd });

  // ---------- model helpers ----------
  function clone(model) { return JSON.parse(JSON.stringify(model || { lines: [], endless: false })); }
  function emptyModel(level) { return { lines: [], endless: !!(level && level.endless) }; }

  function availableCounts(level) {
    const a = allowedCommands(level);
    return {
      forward: 2, back: 2, left: 2, right: 2, wait: 1,
      attack: a.attack ? 2 : 0,
      defend: a.defend ? 2 : 0,
      loop: a.loop ? 1 : 0,
      if: a.if ? 1 : 0,
    };
  }

  // Сколько карт реально израсходовано. Бонусные карты тоже расходуются: одна
  // карта «Цикл 2» — один блок «Повторить 2 раза», одна карта «Условие» — один
  // блок условия. Команды ВНУТРИ цикла/условия карт не тратят: карта нужна на
  // сам блок, а не на каждое его исполнение.
  function countUsage(model) {
    const counts = { forward: 0, back: 0, left: 0, right: 0, wait: 0, attack: 0, defend: 0, loop: 0, if: 0 };
    function walk(st) {
      if (!st) return;
      if (st.t === 'cmd') { if (counts[st.cmd] !== undefined) counts[st.cmd]++; return; }
      if (st.t === 'loop') { counts.loop++; walk(st.body); return; }
      if (st.t === 'if') { counts.if++; walk(st.then); walk(st.else); return; }
    }
    for (const st of model.lines || []) walk(st);
    return counts;
  }

  // Count of top-level lines (bonus bodies do not count against the processor limit).
  function topCount(model) { return (model.lines || []).length; }

  function validate(model, level) {
    const errors = [];
    const allowed = allowedCommands(level);
    const walk = (st, depth) => {
      if (!st) return;
      if (st.t === 'cmd') { if (!allowed[st.cmd]) errors.push(`Команда «${CMDS[st.cmd] ? CMDS[st.cmd].label : st.cmd}» недоступна в этой комнате`); return; }
      if (st.t === 'loop') { if (!allowed.loop) errors.push('Цикл недоступен в этой комнате'); walk(st.body, depth + 1); return; }
      if (st.t === 'if') { if (!allowed.if) errors.push('Условие недоступно в этой комнате'); walk(st.then, depth + 1); walk(st.else, depth + 1); return; }
    };
    for (const st of model.lines || []) walk(st, 0);
    if (!allowed.loop && !allowed.if) {
      // allow blank bodies only for command lines
    }
    if (model.lines.some((st) => st.t === 'loop' && !st.body)) errors.push('В Цикле нет команды');
    if (model.lines.some((st) => st.t === 'if' && !st.then && !st.else)) errors.push('В Условии нет команд для «Да»/«Нет»');
    if (level && level.commandLimit != null && topCount(model) > level.commandLimit) {
      errors.push(`Превышен лимит строк: ${topCount(model)} из ${level.commandLimit}`);
    }
    if (!model.lines.length) errors.push('Программа пуста');
    return errors;
  }

  // ---------- engine IR ----------
  function toIR(model) {
    function conv(st) {
      if (!st) return null;
      if (st.t === 'cmd') return { t: 'cmd', cmd: st.cmd };
      if (st.t === 'loop') return { t: 'loop', body: conv(st.body) };
      if (st.t === 'if') return { t: 'if', then: conv(st.then), else: conv(st.else) };
      return null;
    }
    return { lines: (model.lines || []).map(conv).filter(Boolean), endless: !!model.endless };
  }

  // ---------- Python-like rendering ----------
  const PY_NAME = {
    forward: 'forward()', back: 'back()', left: 'left()', right: 'right()',
    wait: 'wait()', attack: 'attack()', defend: 'defend()',
  };
  // Заголовок «настоящей» мини-программы. По умолчанию его нет (движок и тесты
  // сравнивают «голый» код), но редактор Python просит его показать. Строки с «#»
  // парсер игнорирует, так что заголовок можно свободно печатать в редакторе.
  function pythonHeader(opts) {
    const o = opts || {};
    if (!o.room && !o.task) return [];
    const out = ['# === Программа Голема ==='];
    if (o.room) out.push('# ' + o.room + (o.title ? ' — ' + o.title : ''));
    if (o.task) out.push('# Задача: ' + o.task);
    out.push('#');
    return out;
  }

  function toPython(model, opts) {
    const out = pythonHeader(opts);
    const indent = (n) => '    '.repeat(n);
    function emit(st, d) {
      if (!st) { out.push(indent(d) + 'pass'); return; }
      if (st.t === 'cmd') { out.push(indent(d) + PY_NAME[st.cmd]); return; }
      if (st.t === 'loop') { out.push(indent(d) + 'repeat(2):'); emit(st.body, d + 1); return; }
      if (st.t === 'if') {
        out.push(indent(d) + 'if obstacle:');
        emit(st.then, d + 1);
        out.push(indent(d) + 'else:');
        emit(st.else, d + 1);
        return;
      }
    }
    if (model.endless) out.push('while True:');
    const base = model.endless ? 1 : 0;
    if (!model.lines.length) out.push(indent(base) + 'pass');
    for (const st of model.lines) emit(st, base);
    return out.join('\n');
  }

  // Parse a Python-like program.
  function parsePython(text) {
    const raw = String(text || '').replace(/\r/g, '').split('\n');
    const lines = [];
    for (const ln of raw) {
      if (!ln.trim()) continue;
      if (ln.trim().startsWith('#')) continue;
      const indent = ln.match(/^[ \t]*/)[0].replace(/\t/g, '    ').length;
      lines.push({ indent, text: ln.trim() });
    }
    const errors = [];
    let endless = false;
    let i = 0;
    const pick1 = (list) => list.find((x) => x.t === 'cmd') || list[0] || null;
    // The indent of the nested block that follows `parent`, or parent+1 for an empty block.
    function childIndent(parent) {
      return (i < lines.length && lines[i].indent > parent) ? lines[i].indent : parent + 1;
    }
    // Parse statements whose indentation is >= `indent`. A line indented deeper
    // than expected opens a nested block (used for while/repeat/if bodies).
    function block(indent) {
      const items = [];
      while (i < lines.length) {
        const ln = lines[i];
        if (ln.indent < indent) break;
        if (ln.indent > indent) { items.push(...block(ln.indent)); continue; }
        i++;
        if (/^while\s+True\s*:?$/i.test(ln.text)) { endless = true; continue; }
        if (/^repeat\s*\(\s*2\s*\)\s*:?$/i.test(ln.text)) {
          items.push({ t: 'loop', body: pick1(block(childIndent(indent))) });
          continue;
        }
        if (/^if\s+obstacle\s*:?$/i.test(ln.text)) {
          const thenB = block(childIndent(indent));
          let elseB = [];
          if (i < lines.length && lines[i].indent === indent && /^else\s*:?$/i.test(lines[i].text)) { i++; elseB = block(childIndent(indent)); }
          items.push({ t: 'if', then: pick1(thenB), else: pick1(elseB) });
          continue;
        }
        if (/^pass$/i.test(ln.text)) continue;
        const cmd = cmdFromPython(ln.text);
        if (cmd) items.push({ t: 'cmd', cmd });
        else errors.push('Неизвестная строка: ' + ln.text);
      }
      return items;
    }
    const linesOut = block(lines.length ? lines[0].indent : 0);
    return { model: { lines: linesOut, endless }, errors };
  }

  function cmdFromPython(s) {
    const m = /^(forward|back|left|right|wait|attack|defend)\s*\(\s*\)\s*;?$/i.exec(s);
    if (!m) {
      const map = { 'вперёд': 'forward', 'вперед': 'forward', 'назад': 'back', 'влево': 'left', 'вправо': 'right', 'стоять': 'wait', 'удар': 'attack', 'атака': 'attack', 'атаковать': 'attack', 'защита': 'defend' };
      const w = s.toLowerCase().replace(/[();]/g, '').trim();
      return map[w] || null;
    }
    return m[1].toLowerCase();
  }

  // ---------- reference solution parsing ----------
  const RU = [
    ['стоять на месте', 'wait'], ['вперёд', 'forward'], ['вперед', 'forward'],
    ['назад', 'back'], ['влево', 'left'], ['вправо', 'right'],
    ['поворот влево', 'left'], ['поворот вправо', 'right'],
    ['удар', 'attack'], ['атака', 'attack'], ['атаковать', 'attack'], ['защита', 'defend'],
  ];
  function refCmd(word) {
    const w = word.toLowerCase().trim().replace(/[«»()\s]+/g, ' ').trim();
    for (const [ru, cmd] of RU) if (w === ru) return cmd;
    return null;
  }

  function parseSolution(text) {
    // Split by the arrow used in the course solutions.
    const parts = String(text || '').split(/→|->/).map((s) => s.trim()).filter(Boolean);
    return parts.map(parseStatement).filter(Boolean);
  }

  function parseStatement(p) {
    p = String(p || '').replace(/[«»]/g, '').trim();
    if (!p) return null;
    let m;
    if ((m = /^цикл\s*2\s*[\(\[]\s*([\s\S]*?)\s*[\)\]]\s*$/i.exec(p))) {
      return { t: 'loop', body: parseStatement(m[1]) };
    }
    if (/^если/i.test(p)) {
      const im = /^если[\s\S]*?то\s*[\(\[]\s*([\s\S]*?)\s*[\)\]]\s*(?:,?\s*иначе\s*[\(\[]\s*([\s\S]*?)\s*[\)\]]\s*)?$/i.exec(p);
      if (im) return { t: 'if', then: parseStatement(im[1]), else: im[2] != null ? parseStatement(im[2]) : null };
    }
    const cmd = refCmd(p);
    return wrap(cmd);
  }
  function wrap(cmd) { return cmd ? { t: 'cmd', cmd } : null; }

  // ---------- human readable ----------
  function toText(model) {
    return toPython(model);
  }

  BG4.Prog = {
    CMDS, allowedCommands, availableCounts, countUsage, emptyModel, clone, topCount, validate, toIR,
    toPython, parsePython, parseSolution, toText,
  };
})();
