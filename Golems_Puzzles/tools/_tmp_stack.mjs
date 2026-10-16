import fs from 'node:fs';
const src = fs.readFileSync(new URL('../js/data/levels.js', import.meta.url), 'utf8');
const json = src.slice(src.indexOf('=') + 1).trim().replace(/;\s*$/, '');
const L = JSON.parse(json);
const lv = L.rooms.find((r) => r.id === process.argv[2]);
for (const t of lv.tokens) console.log(`r${t.r} c${t.c} L${t.layer} ${t.t} (${t.type}) rot=${t.rot}`);
console.log('--- raw export rotations for 5.9 ---');
const ex = JSON.parse(fs.readFileSync(new URL('../data/bg4_export.json', import.meta.url), 'utf8'));
const room = ex.rooms.find((r) => r.id === process.argv[2]);
const p = room.puzzle;
console.log('puzzleIcons', JSON.stringify(p.puzzleIcons));
console.log('rotations', JSON.stringify(p.rotations, null, 1));
for (let r = 0; r < p.grid.length; r++) {
  for (let c = 0; c < p.grid[r].length; c++) {
    const cell = p.grid[r][c].filter(Boolean);
    if (cell.length) console.log(`  r${r} c${c}: ${JSON.stringify(cell)}`);
  }
}
