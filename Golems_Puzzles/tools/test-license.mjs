// tools/test-license.mjs — проверка логики «полная версия / ДЕМО» (js/license.js).
// Запуск: node tools/test-license.mjs  → ждём «N passed, 0 failed».
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const src = fs.readFileSync(path.join(here, '..', 'js', 'license.js'), 'utf8');

// Прогоняем настоящий файл в песочнице: подменяем referrer, localStorage и query.
function load({ referrer = '', stored = null, search = '', forceDemo = false, forceFull = false } = {}) {
  const db = new Map();
  if (stored !== null) db.set('bg4.license.full', stored);
  const localStorage = {
    getItem: (k) => (db.has(k) ? db.get(k) : null),
    setItem: (k, v) => db.set(k, String(v)),
    removeItem: (k) => db.delete(k),
  };
  const window = {};
  if (forceDemo) window.BG4_FORCE_DEMO = true;
  if (forceFull) window.BG4_FORCE_FULL = true;
  new Function('window', 'document', 'localStorage', 'location', src)(
    window, { referrer }, localStorage, { search },
  );
  return { lic: window.BG4_LICENSE, flag: db.get('bg4.license.full') || null };
}

const COURSE = 'https://simplrobot.ru/members/courses/bg4_golovolomki/onlajnversia-golovolomok-297972714671';
const cases = [
  ['со страницы курса (числовой код) → полная', { referrer: COURSE }, true, '1'],
  ['со страницы курса, любой код после дефиса', { referrer: 'https://simplrobot.ru/members/courses/bg4_golovolomki/onlajnversia-golovolomok-abc-def' }, true, '1'],
  ['со страницы курса без кода сессии (как реальный урок)', { referrer: 'https://simplrobot.ru/members/courses/bg4_golovolomki/onlajnversia-golovolomok' }, true, '1'],
  ['со страницы курса + параметры/хвост', { referrer: COURSE + '?a=1#top' }, true, '1'],
  ['со страницы курса со слэшем на конце', { referrer: COURSE + '/' }, true, '1'],
  ['страница курса без onlajnversia → демо', { referrer: 'https://simplrobot.ru/members/courses/bg4_golovolomki/' }, false, null],
  ['другая страница simplrobot.ru (полный адрес) → демо', { referrer: 'https://simplrobot.ru/bitvagolemov4' }, false, null],
  ['только origin (браузер обрезал реферер) → полная', { referrer: 'https://simplrobot.ru/' }, true, '1'],
  ['похожий чужой домен → демо', { referrer: 'https://simplrobot.ru.evil.com/members/courses/bg4_golovolomki/onlajnversia-golovolomok-x' }, false, null],
  ['похожий чужой origin → демо', { referrer: 'https://simplrobot.ru.evil.com/' }, false, null],
  ['simplrobot в поддомене чужого домена → демо', { referrer: 'https://simplrobot.ru.evil.com' }, false, null],
  ['внешний сайт → демо', { referrer: 'https://www.google.com/' }, false, null],
  ['открыли напрямую (referrer пустой) → демо', { referrer: '' }, false, null],
  ['файл с диска (referrer пустой) → демо', { referrer: '', search: '' }, false, null],
  ['правило запомнено в localStorage → полная', { referrer: '', stored: '1' }, true, '1'],
  ['localStorage мусор → демо', { referrer: '', stored: 'yes' }, false, undefined],
  ['?access=full → полная и запоминается', { referrer: '', search: '?access=full' }, true, '1'],
  ['?access=demo поверх правила → демо и сброс', { referrer: '', stored: '1', search: '?access=demo' }, false, null],
  ['?access=full важнее сохранённого «нет»', { referrer: '', stored: null, search: '?access=full&x=1' }, true, '1'],
  ['серверная демо-сборка (BG4_FORCE_DEMO) → демо', { referrer: COURSE, forceDemo: true }, false, '1'],
  ['серверная полная сборка (BG4_FORCE_FULL) → полная', { referrer: '', forceFull: true }, true, null],
  ['http-версия страницы курса → полная', { referrer: 'http://simplrobot.ru/members/courses/bg4_golovolomki/onlajnversia-golovolomok-1' }, true, '1'],
];

const lim = (o) => ({ referrer: o.referrer || '—', stored: o.stored, search: o.search, force: o.forceDemo ? 'DEMO' : (o.forceFull ? 'FULL' : '') });
let pass = 0, fail = 0;
for (const [name, opt, wantFull, wantFlag] of cases) {
  const { lic, flag } = load(opt);
  const flagOk = wantFlag === undefined || flag === wantFlag;
  const ok = lic.full() === wantFull && lic.demo() === !wantFull && flagOk
    && lic.maxFloor() === (wantFull ? 6 : 2) && lic.allowsFloor(3) === wantFull;
  if (ok) { pass++; console.log('PASS  ' + name); }
  else {
    fail++;
    console.log('FAIL  ' + name + ' → full=' + lic.full() + ' (ждали ' + wantFull + '), флаг=' + JSON.stringify(flag) + ' (ждали ' + JSON.stringify(wantFlag) + '), вход=' + JSON.stringify(lim(opt)));
  }
}
// максимум этажей и граница «2/3»
const demo = load({ referrer: '' }).lic;
const full = load({ referrer: COURSE }).lic;
const edge = demo.allowsFloor(2) && !demo.allowsFloor(3) && demo.maxFloor() === 2 && full.allowsFloor(6) && full.maxFloor() === 6;
if (edge) { pass++; console.log('PASS  в демо открыты этажи 1–2, в полной — все 6'); }
else { fail++; console.log('FAIL  границы этажей: demo.max=' + demo.maxFloor() + ', full.max=' + full.maxFloor()); }

// источник режима (для диагностики в плашке ДЕМО)
const srcOk = load({ referrer: '' }).lic.src === 'клиент'
  && load({ referrer: '', forceDemo: true }).lic.src === 'сервер: ДЕМО'
  && load({ referrer: '', forceFull: true }).lic.src === 'сервер: полная';
if (srcOk) { pass++; console.log('PASS  src указывает источник режима (клиент/сервер)'); }
else {
  fail++;
  console.log('FAIL  src: ' + JSON.stringify([load({ referrer: '' }).lic.src, load({ referrer: '', forceDemo: true }).lic.src, load({ referrer: '', forceFull: true }).lic.src]));
}


console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
