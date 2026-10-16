const fs = require('fs');
const p = 'js/app.js';
let s = fs.readFileSync(p,'utf8');
const colorSuffix = "((currentLevel && currentLevel.start && currentLevel.start.color === 'blue') ? 'Синий' : 'Красный')";
// Loop btn
s = s.replace(
`    if (a.loop) {
      const nLeft = (counts.loop || 0) - (used.loop || 0);
      const b = h('button', { class: 'pbtn pbtn-bonus' + (nLeft <= 0 ? ' pbtn-disabled' : ''), disabled: nLeft <= 0 ? true : undefined, text: '+ Цикл 2' + (nLeft > 0 ? ' (' + nLeft + '/' + counts.loop + ')' : ''), onclick: () => nLeft > 0 && onPick({ t: 'loop', body: null }) });
      p.appendChild(b);
    }`,
`    if (a.loop) {
      const nLeft = (counts.loop || 0) - (used.loop || 0);
      const b = h('button', { class: 'pbtn pbtn-bonus' + (nLeft <= 0 ? ' pbtn-disabled' : ''), disabled: nLeft <= 0 ? true : undefined });
      const im = h('img', { class: 'pbtn-img', src: 'cards/Цикл ' + ${colorSuffix} + '.png', alt: 'Цикл 2' });
      im.addEventListener('error', () => { im.style.display = 'none'; });
      b.appendChild(im);
      b.appendChild(document.createTextNode('+ Цикл 2' + (nLeft > 0 ? ' (' + nLeft + '/' + counts.loop + ')' : '')));
      b.addEventListener('click', () => nLeft > 0 && onPick({ t: 'loop', body: null }));
      p.appendChild(b);
    }`
);
s = s.replace(
`    if (a.if) {
      const nLeft = (counts.if || 0) - (used.if || 0);
      const b = h('button', { class: 'pbtn pbtn-bonus' + (nLeft <= 0 ? ' pbtn-disabled' : ''), disabled: nLeft <= 0 ? true : undefined, text: '+ Если' + (nLeft > 0 ? ' (' + nLeft + '/' + counts.if + ')' : ''), onclick: () => nLeft > 0 && onPick({ t: 'if', then: null, else: null }) });
      p.appendChild(b);
    }`,
`    if (a.if) {
      const nLeft = (counts.if || 0) - (used.if || 0);
      const b = h('button', { class: 'pbtn pbtn-bonus' + (nLeft <= 0 ? ' pbtn-disabled' : ''), disabled: nLeft <= 0 ? true : undefined });
      const im = h('img', { class: 'pbtn-img', src: 'cards/Условие ' + ${colorSuffix} + '.png', alt: 'Условие' });
      im.addEventListener('error', () => { im.style.display = 'none'; });
      b.appendChild(im);
      b.appendChild(document.createTextNode('+ Если' + (nLeft > 0 ? ' (' + nLeft + '/' + counts.if + ')' : '')));
      b.addEventListener('click', () => nLeft > 0 && onPick({ t: 'if', then: null, else: null }));
      p.appendChild(b);
    }`
);
fs.writeFileSync(p, s, 'utf8');
console.log('done');
