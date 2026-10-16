import fs from 'fs';
import { execSync } from 'child_process';

const cur = JSON.parse(fs.readFileSync('data/bg4_export.json', 'utf8'));
const headText = execSync('git show HEAD:Golems_Puzzles/data/bg4_export.json', { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
const head = JSON.parse(headText);

console.log('top-level keys cur :', Object.keys(cur).join(','));
console.log('top-level keys head:', Object.keys(head).join(','));
console.log('room keys cur :', Object.keys(cur.rooms[0]).join(','));
console.log('room keys head:', Object.keys(head.rooms[0]).join(','));
console.log('puzzle keys cur :', Object.keys(cur.rooms[0].puzzle).join(','));
console.log('puzzle keys head:', Object.keys(head.rooms[0].puzzle).join(','));
console.log('rooms cur/head:', cur.rooms.length, head.rooms.length);

// per-room: golem cells + bot marks
const GOLEM = { 'К↑': 'red', 'К1': 'red', 'C↑': 'blue', 'C1': 'blue', 'З↑': 'green', 'З1': 'green', 'Ж↑': 'yellow', 'Ж1': 'yellow' };
function golemSig(room) {
  const g = room.puzzle.grid;
  const cells = [];
  for (let r = 0; r < g.length; r++) for (let c = 0; c < (g[r] || []).length; c++) {
    const cell = g[r][c] || [];
    const gi = cell.findIndex((t) => GOLEM[t]);
    if (gi < 0) continue;
    cells.push(`${GOLEM[cell[gi]]}@${r},${c}${cell.some((t) => t === 'МБ') ? '+МБ' : ''}`);
  }
  return cells.join(' ');
}
const headById = new Map(head.rooms.map((r) => [r.id, r]));
console.log('\n=== rooms whose golem/bot layout differs from HEAD ===');
for (const r of cur.rooms) {
  const h = headById.get(r.id);
  const a = h ? golemSig(h) : '(none)';
  const b = golemSig(r);
  if (a !== b) console.log(r.id, '\n  head:', a, '\n  cur :', b);
}
