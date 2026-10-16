import fs from 'fs';

const s = fs.readFileSync('js/data/levels.js', 'utf8');
const json = JSON.parse(s.slice(s.indexOf('{'), s.lastIndexOf('}') + 1));
for (const r of json.rooms.filter((x) => x.floor === 6)) {
  console.log('=====', r.id, r.puzzleName);
  console.log('start=' + r.start.color + '@' + r.start.r + ',' + r.start.c, 'bots=[' + (r.bots || []).map((b) => b.color + '@' + b.r + ',' + b.c).join(' ') + ']');
  console.log('task:', r.task);
}
