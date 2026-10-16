import fs from 'node:fs';
const raw = JSON.parse(fs.readFileSync(new URL('../data/bg4_export.json', import.meta.url), 'utf8'));

// Print rotations + full grid for selected levels
for (const id of ['1.2','1.5','3.4','4.1','6.1']) {
  const r = raw.rooms.find(x => x.id === id);
  const p = r.puzzle;
  console.log(`\n===== ${id} =====`);
  console.log('checkboxes:', JSON.stringify(p.checkboxes));
  console.log('userFieldPositions:', JSON.stringify(p.userFieldPositions));
  console.log('fieldImageIndices:', JSON.stringify(p.fieldImageIndices));
  console.log('rotations:', JSON.stringify(p.rotations));
  // compact non-empty grid
  const toks = [];
  for (let rr=0; rr<10; rr++) for (let cc=0; cc<10; cc++) for (let ll=0; ll<3; ll++) { const t=p.grid[rr][cc][ll]; if(t) toks.push(`L${ll}(${rr},${cc})=${t}`); }
  console.log('tokens:', toks.join('  '));
}

// Collect all distinct rotation values
const rots = new Set();
for (const r of raw.rooms) { const p = r.puzzle; if(!p||!p.rotations) continue; for (const v of Object.values(p.rotations)) rots.add(v); }
console.log('\ndistinct rotations:', [...rots].sort((a,b)=>a-b));
