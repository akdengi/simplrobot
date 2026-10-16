// Summarize the raw bg4 export: what tokens, fields, icons and tasks each room has.
import fs from 'node:fs';

const raw = JSON.parse(fs.readFileSync(new URL('../data/bg4_export.json', import.meta.url), 'utf8'));

console.log('rooms:', raw.rooms.length, 'info:', raw.info.length, 'errors:', raw.errors.length);

const tokenCounts = {};
for (const r of raw.rooms) {
  const p = r.puzzle;
  if (!p) { console.log(r.id, 'NO PUZZLE'); continue; }
  const toks = [];
  for (let rr = 0; rr < 10; rr++)
    for (let cc = 0; cc < 10; cc++)
      for (let ll = 0; ll < 3; ll++) {
        const t = p.grid[rr][cc][ll];
        if (t) { toks.push(`${t}@${rr},${cc},${ll}`); tokenCounts[t] = (tokenCounts[t] || 0) + 1; }
      }
  const fields = Object.entries(p.checkboxes || {}).filter(([k, v]) => v).map(([k]) => k);
  const icons = (p.puzzleIcons || []).filter(Boolean);
  console.log(`\n## ${r.id} — ${r.title}`);
  console.log('  task:', r.taskText.replace(/\s+/g, ' ').slice(0, 160));
  console.log('  solution:', r.solution.replace(/\s+/g, ' ').slice(0, 120));
  console.log('  fields:', fields.join(','), '| icons:', icons.join(','), '| puzzleName:', p.name);
  console.log('  tokens:', toks.join(' '));
}

console.log('\n=== token counts ===');
console.log(Object.entries(tokenCounts).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}:${v}`).join('  '));

console.log('\n=== info pages ===');
for (const i of raw.info) console.log(i.id, i.title, (i.htmlText || '').length);
