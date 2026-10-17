// Build clean game levels from the raw bg4 course export.
// Usage: node tools/build-levels.mjs
//
// Reads:  data/bg4_export.json   (extracted from simplrobot.ru via API)
// Writes: js/data/levels.js      (window.BG4_LEVELS = {...})
//         js/data/help.js        (window.BG4_HELP = {...})  info pages as text

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const raw = JSON.parse(fs.readFileSync(path.join(root, 'data', 'bg4_export.json'), 'utf8'));

// ---------- helpers ----------

// В игре карта называется «Атака» (в курсе местами написано «Удар»): приводим
// весь текст курса к словам игры. Замены — обычными строками и от длинных форм
// к коротким: «Удары» → «Атаки», «Ударом» → «Атакой», «Ударить» → «Атаковать».
const WORD_FIX = [
  ['одного удара', 'одной атаки'], ['одного Удара', 'одной Атаки'],
  ['Ударить', 'Атаковать'], ['ударить', 'атаковать'],
  ['Ударять', 'Атаковать'], ['ударять', 'атаковать'],
  ['Удары', 'Атаки'], ['удары', 'атаки'],
  ['Ударов', 'Атак'], ['ударов', 'атак'],
  ['Удару', 'Атаке'], ['удару', 'атаке'],
  ['Ударом', 'Атакой'], ['ударом', 'атакой'],
  ['Удара', 'Атаки'], ['удара', 'атаки'],
  ['Ударная', 'Взрывная'], ['ударная', 'взрывная'],
  ['Удар', 'Атака'], ['удар', 'атака'],
];
function fixWords(s) {
  let out = String(s || '');
  for (const [from, to] of WORD_FIX) out = out.split(from).join(to);
  return out;
}

function htmlToText(html) {
  return fixWords(String(html || '')
    .replace(/<\s*(br|BR)\s*\/?>/g, '\n')
    .replace(/<\s*\/\s*(div|p|h[1-6]|li|tr)\s*>/gi, '\n')
    .replace(/<\s*(h[1-6]|div|p|li|tr)[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\r/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{2,}/g, '\n')
    .trim());
}

function parseLecture(html) {
  // Extract the embedded puzzle JSON (t-redactor__embedcode block).
  let puzzle = null;
  const embedRe = /<div[^>]*class="[^"]*t-redactor__embedcode[^"]*"[^>]*>([\s\S]*?)<\/div>/gi;
  const m = embedRe.exec(html);
  if (m) {
    const jsonText = htmlToText(m[1]).trim();
    try { puzzle = JSON.parse(jsonText); } catch (e) { /* leave null */ }
  }
  // Extract preface (solution) - it is a <blockquote class="t-redactor__preface">.
  let solution = '';
  const preRe = /<(blockquote|div)[^>]*class="[^"]*t-redactor__preface[^"]*"[^>]*>([\s\S]*?)<\/\1>/i;
  const pm = preRe.exec(html);
  if (pm) solution = htmlToText(pm[2]).trim();

  const noEmbed = html.replace(embedRe, '\n');
  const text = htmlToText(noEmbed);

  const task = section(text, 'Задание:', ['Подсказка:', 'Решение:']);
  const hint = section(text, 'Подсказка:', ['Решение:', 'Задание:']);
  const sol = (solution.replace(/^\s*Решение\s*:?\s*/i, '').trim()) || section(text, 'Решение:', []);

  return { puzzle, task, hint, solutionText: sol, quote: extractQuote(html), rawText: text };
}

function section(text, startLabel, endLabels) {
  const i = text.indexOf(startLabel);
  if (i === -1) return '';
  let s = text.slice(i + startLabel.length);
  let end = s.length;
  for (const lbl of endLabels) {
    const j = s.indexOf(lbl);
    if (j !== -1 && j < end) end = j;
  }
  return s.slice(0, end).replace(/\s+/g, ' ').trim();
}

// Each room ends with a centred quote (after the <hr> at the bottom of the
// page): «Аккуратный программист — быстрый программист.» etc. It is printed
// under the board and sometimes hints at the task.
function extractQuote(html) {
  const re = /<div[^>]*class="[^"]*t-redactor__text[^"]*"[^>]*>([\s\S]*?)<\/div>/gi;
  const all = [...String(html || '').matchAll(re)];
  if (!all.length) return '';
  return htmlToText(all[all.length - 1][1]).trim();
}

// ---------- token vocabulary ----------

const GOLEM = {
  'К↑': 'red', 'К1': 'red',
  'C↑': 'blue', 'C1': 'blue',
  'З↑': 'green', 'З1': 'green',
  'Ж↑': 'yellow', 'Ж1': 'yellow',
};

// token -> semantic type used by the engine
function tokenType(t) {
  if (t in GOLEM) return 'golem';
  switch (t) {
    case 'ВК': case 'ВП': case 'ВУТ': return 'water';
    case 'КВ': return 'wall';
    case 'ПВ': return 'portal';
    case 'Л': return 'ice';
    case 'Б': return 'barrel';
    case 'Ц': return 'goal';
    case 'МБ': return 'botmark';
    case 'ПЛ': return 'line_straight';
    case 'УЛ': return 'line_corner';
    case 'ПРЖ': return 'spring';
    case 'AM1': case 'AM2': case 'AM3':
    case 'AM1_2': case 'AM2_2': case 'AM3_2': return 'aruco';
    default: return 'unknown';
  }
}

const DIR_FROM_ROT = { 0: 'N', 90: 'E', 180: 'S', 270: 'W' };

const FIELD_POS_DEFAULT = {
  '4x4': { row: 0, col: 3 },
  '2x4_1': { row: 0, col: 0 },
  '2x4_2': { row: 0, col: 8 },
  '4x2_1': { row: 0, col: 0 },
  '4x2_2': { row: 0, col: 6 },
};
const FIELD_SIZE = {
  '4x4': { w: 4, h: 4 },
  '2x4_1': { w: 2, h: 4 },
  '2x4_2': { w: 2, h: 4 },
  '4x2_1': { w: 4, h: 2 },
  '4x2_2': { w: 4, h: 2 },
};

// ---------- level conversion ----------

function convertRoom(room) {
  const p = room.puzzle;
  const id = room.id;
  const floor = parseInt(id.split('.')[0], 10);
  const index = parseInt(id.split('.')[1], 10);

  const icons = (p && p.puzzleIcons) || [];
  const iconAt = (i) => icons[i] || '';
  const diffIcon = iconAt(0);
  const difficulty = /^lvl([1-5])$/.exec(diffIcon) ? parseInt(RegExp.$1, 10) : 1;

  const lineIcon = (icons.find((k) => /^line(\d+|N)$/.test(k || '')) || '');
  let commandLimit = null;
  if (lineIcon === 'lineN') commandLimit = null; // unlimited
  else if (/^line(\d)$/.test(lineIcon)) commandLimit = parseInt(RegExp.$1, 10);

  const bonusKeys = icons.slice(1).filter(Boolean);
  const bonuses = {
    loop: bonusKeys.includes('repeat2'),
    condition: bonusKeys.includes('condition'),
    attack: bonusKeys.includes('attack'),
    defense: bonusKeys.includes('defense'),
  };

  // fields
  const fields = [];
  const cbs = (p && p.checkboxes) || {};
  for (const key of Object.keys(FIELD_SIZE)) {
    if (cbs[key]) {
      const pos = (p.userFieldPositions && p.userFieldPositions[key]) || FIELD_POS_DEFAULT[key];
      const img = (p.fieldImageIndices && p.fieldImageIndices[key]) || 0;
      fields.push({ key, row: pos.row, col: pos.col, imageIndex: img, side: img === 1 ? 'winter' : 'summer' });
    }
  }

  // tokens
  const tokens = [];
  const rotations = (p && p.rotations) || {};
  const grid = (p && p.grid) || [];
  const golems = [];
  for (let r = 0; r < grid.length; r++) {
    for (let c = 0; c < (grid[r] || []).length; c++) {
      const layers = grid[r][c] || [];
      for (let l = 0; l < layers.length; l++) {
        const t = layers[l];
        if (!t) continue;
        const rot = rotations[`rotation_${r}_${c}_${t}_layer${l + 1}`] || 0;
        const type = tokenType(t);
        const dir = DIR_FROM_ROT[rot] || 'N';
        tokens.push({ r, c, layer: l + 1, t, type, rot, ...(type === 'golem' ? { color: GOLEM[t], dir } : {}) });
        if (type === 'golem') golems.push({ r, c, layer: l + 1, t, color: GOLEM[t], dir, rot });
      }
    }
  }

  // bot detection: a golem sharing a cell with a bot-mark on the layer above
  const botMarks = new Set(tokens.filter((t) => t.type === 'botmark').map((t) => `${t.r},${t.c}`));
  let start = null;
  const bots = [];
  for (const g of golems) {
    if (botMarks.has(`${g.r},${g.c}`)) bots.push({ color: g.color, r: g.r, c: g.c, dir: g.dir });
    else if (!start) start = { color: g.color, r: g.r, c: g.c, dir: g.dir };
    else bots.push({ color: g.color, r: g.r, c: g.c, dir: g.dir }); // extra golems => treat as bots
  }
  if (!start && golems.length) {
    // fallback: first golem
    start = { color: golems[0].color, r: golems[0].r, c: golems[0].c, dir: golems[0].dir };
  }

  const goals = tokens.filter((t) => t.type === 'goal').map((t) => ({ r: t.r, c: t.c }));

  // Tokens printed OUTSIDE the field are «жетоны из руки»: the board game shows
  // them beside the board and the player puts them on a cell himself
  // (4.4: «Поставьте на клетку с целевой точкой Бочку»).
  const validKeys = new Set();
  for (const f of fields) {
    const sz = FIELD_SIZE[f.key] || { w: 4, h: 4 };
    for (let r = f.row; r < f.row + sz.h; r++) for (let c = f.col; c < f.col + sz.w; c++) validKeys.add(r + ',' + c);
  }
  const reserve = tokens
    .filter((t) => !validKeys.has(t.r + ',' + t.c))
    .map((t) => ({ t: t.t, type: t.type, row: t.r, col: t.c, layer: t.layer, rot: t.rot, placed: false }));

  const parsed = parseLecture(room.htmlText);

  return {
    id,
    floor,
    index,
    title: room.title,
    puzzleName: p ? p.name : '',
    difficulty,
    commandLimit,
    bonuses,
    // Этаж 6 («Шахматный Этаж»): в сведениях о комнате карты не перечисляются, игрок
    // применяет любые — «можешь применять любые карты, которые посчитаешь необходимыми».
    ...(floor === 6 ? { anyCards: true } : {}),
    botsUsed: bonuses ? icons.some((k) => k === 'bot1' || k === 'bot2') : false,
    task: parsed.task,
    hint: parsed.hint,
    solutionText: parsed.solutionText,
    quote: parsed.quote,
    fields,
    start,
    bots,
    goals,
    tokens,
    reserve,
  };
}

// ---------- info pages ----------

function convertInfo(page) {
  return { id: page.id, title: page.title, text: htmlToText(page.htmlText) };
}

// ---------- build ----------

const rooms = raw.rooms.map(convertRoom).filter((l) => l.start);
const skipped = raw.rooms.filter((r) => !r.puzzle).map((r) => r.id);

const floorsMeta = [
  { n: 1, name: 'Простые Движения', subtitle: 'Движение и повороты' },
  { n: 2, name: 'Атака! Ещё Атака!', subtitle: 'Атака и Защита' },
  { n: 3, name: 'Враг за бочками', subtitle: 'ЦИКЛЫ (повторы)' },
  { n: 4, name: 'А ЕСЛИ?', subtitle: 'УСЛОВИЯ (проверки)' },
  { n: 5, name: 'Автономные Големы', subtitle: 'Бесконечные циклы и динамика' },
  { n: 6, name: 'Шахматный Этаж', subtitle: 'Големы-противники' },
];

const levels = { floors: floorsMeta, rooms, info: raw.info.map(convertInfo), extracted: raw.extracted };

const outJs = `// AUTO-GENERATED by tools/build-levels.mjs — do not edit by hand.
// Data extracted from the "Головоломки Големов v4.0" course (simplrobot.ru).
window.BG4_LEVELS = ${JSON.stringify(levels)};
`;
fs.writeFileSync(path.join(root, 'js', 'data', 'levels.js'), outJs, 'utf8');

// stats
const byFloor = {};
for (const l of rooms) byFloor[l.floor] = (byFloor[l.floor] || 0) + 1;
console.log('levels written:', rooms.length);
console.log('by floor:', JSON.stringify(byFloor));
console.log('skipped (no puzzle):', skipped.join(',') || 'none');
console.log('output bytes:', outJs.length);
