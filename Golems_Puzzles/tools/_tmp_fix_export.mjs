import fs from 'fs';

const file = 'data/bg4_export.json';
const text = fs.readFileSync(file, 'utf8');
const raw = JSON.parse(text);

if (JSON.stringify(raw) !== text) {
  console.error('ABORT: export is not in plain JSON.stringify format; refusing to rewrite.');
  process.exit(1);
}

const GOLEM = { 'К↑': 'red', 'К1': 'red', 'C↑': 'blue', 'C1': 'blue', 'З↑': 'green', 'З1': 'green', 'Ж↑': 'yellow', 'Ж1': 'yellow' };

let added = 0;
const report = [];
for (const r of raw.rooms) {
  if (!r.id.startsWith('6.')) continue;
  const g = r.puzzle.grid;
  const cells = [];
  for (let rr = 0; rr < g.length; rr++) {
    for (let cc = 0; cc < (g[rr] || []).length; cc++) {
      const cell = g[rr][cc] || [];
      if (!GOLEM[cell[0]]) continue;
      if (GOLEM[cell[0]] === 'red') {
        cells.push('player ' + GOLEM[cell[0]] + '@' + rr + ',' + cc);
        if (cell[1] === 'МБ') { cell[1] = ''; console.log('warning: removed stray МБ from player', r.id, rr, cc); }
        continue;
      }
      if (!cell[1]) { cell[1] = 'МБ'; added++; cells.push('bot ' + GOLEM[cell[0]] + '@' + rr + ',' + cc + ' +МБ'); }
      else cells.push('bot ' + GOLEM[cell[0]] + '@' + rr + ',' + cc + ' (already ' + cell[1] + ')');
    }
  }
  report.push(r.id + ': ' + cells.join(' | '));
}

fs.writeFileSync(file, JSON.stringify(raw));
console.log('added МБ marks:', added);
console.log(report.join('\n'));
