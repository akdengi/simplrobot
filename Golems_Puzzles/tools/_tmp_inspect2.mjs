import fs from 'fs';

const GOLEM = { 'К↑': 'red', 'К1': 'red', 'C↑': 'blue', 'C1': 'blue', 'З↑': 'green', 'З1': 'green', 'Ж↑': 'yellow', 'Ж1': 'yellow' };
const raw = JSON.parse(fs.readFileSync('data/bg4_export.json', 'utf8'));
console.log('export extracted:', raw.extracted);

const s = fs.readFileSync('js/data/levels.js', 'utf8');
const lv = JSON.parse(s.slice(s.indexOf('{'), s.lastIndexOf('}') + 1));
console.log('levels extracted:', lv.extracted);

function derive(room) {
  const g = room.puzzle.grid;
  const golems = [];
  for (let r = 0; r < g.length; r++) for (let c = 0; c < (g[r] || []).length; c++) {
    const cell = g[r][c] || [];
    const t = cell.find((x) => GOLEM[x]);
    if (!t) continue;
    golems.push({ color: GOLEM[t], r, c, marked: cell.some((x) => x === 'МБ') });
  }
  let start = null; const bots = [];
  for (const gl of golems) {
    if (gl.marked) bots.push(gl);
    else if (!start) start = gl;
    else bots.push(gl);
  }
  if (!start && golems.length) start = golems[0];
  return { start, bots };
}

let diffs = 0;
for (const l of lv.rooms) {
  const room = raw.rooms.find((r) => r.id === l.id);
  const d = derive(room);
  const a = l.start.color + '@' + l.start.r + ',' + l.start.c;
  const b = d.start.color + '@' + d.start.r + ',' + d.start.c;
  const ab = (l.bots || []).map((x) => x.color + '@' + x.r + ',' + x.c).join(' ');
  const bb = d.bots.map((x) => x.color + '@' + x.r + ',' + x.c).join(' ');
  if (a !== b || ab !== bb) {
    diffs++;
    console.log('DIFF', l.id, '\n  levels:', a, '|', ab, '\n  export:', b, '|', bb);
  }
}
console.log('\ndiffs:', diffs);
