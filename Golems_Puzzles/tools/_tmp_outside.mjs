import fs from 'node:fs';
const src = fs.readFileSync(new URL('../js/data/levels.js', import.meta.url), 'utf8');
const L = JSON.parse(src.slice(src.indexOf('=') + 1).trim().replace(/;\s*$/, ''));

// replicate Engine.validCells
function validCells(lv) {
  const set = new Set();
  for (const f of lv.fields) {
    const w = { '4x4': 4, '2x4_1': 2, '2x4_2': 2, '4x2_1': 4, '4x2_2': 4 }[f.key];
    const h = { '4x4': 4, '2x4_1': 4, '2x4_2': 4, '4x2_1': 2, '4x2_2': 2 }[f.key];
    for (let r = f.row; r < f.row + h; r++) for (let c = f.col; c < f.col + w; c++) set.add(r + ',' + c);
  }
  return set;
}
const re = /(Поставь|поставьте|полож|перенес|Рядом|рядом|из руки|снаружи|вне поля|добавь)/i;
for (const lv of L.rooms) {
  const v = validCells(lv);
  const outside = lv.tokens.filter((t) => !v.has(t.r + ',' + t.c));
  const taskHit = re.test(lv.task || '') || re.test(lv.hint || '');
  if (outside.length || taskHit) {
    console.log('=== ' + lv.id + ' floors:' + lv.floor + ' ===');
    console.log('  task:', (lv.task || '').slice(0, 150));
    if (outside.length) console.log('  outside tokens:', outside.map((t) => `${t.t}@${t.r},${t.c}L${t.layer}`).join(' '));
    if (taskHit) console.log('  (task/hint mentions placement)');
    if (!outside.length) console.log('  tokens on field:', lv.tokens.map((t) => `${t.t}@${t.r},${t.c}`).join(' '));
  }
}
