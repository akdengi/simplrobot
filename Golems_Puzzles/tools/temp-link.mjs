// tools/temp-link.mjs — временная ссылка полного доступа к «Головоломкам Големов».
//
// Что делает: печатает одноразовый токен, срок действия и готовые блоки для
// nginx-конфига /data/nginx/user_conf.d/invapi.online.conf. Ссылка
//   https://invapi.online/golovolomki/go/<токен>   (или короткая /g/<код>)
// пока жива, ставит cookie полного доступа bg4gt и перебрасывает в игру;
// после срока отдаёт 404. Cookie живёт отдельно (--max-age-days).
//
// Запуск (из папки Golems_Puzzles/):
//   node tools/temp-link.mjs                     # 7 дней, токен случайный
//   node tools/temp-link.mjs --short             # короткая ссылка /g/<8 знаков>
//   node tools/temp-link.mjs --days 30
//   node tools/temp-link.mjs --until 2026-11-05
//   node tools/temp-link.mjs --from 2026-10-22 --days 3 --max-age-days 1
//   node tools/temp-link.mjs --token <32 hex>    # повторить/продлить старую ссылку
//   node tools/temp-link.mjs --short --code abc2defg
//
// Короткий код — 8 знаков [a-z2-9] без похожих символов (0/o, 1/l/i), его легко
// продиктовать. Перебор исключён: 31^8 ≈ 8,5·10^11 вариантов.
//
// Срок считается по UTC — время сервера (и контейнера nginx) в UTC.
import crypto from 'node:crypto';

const DAY = 86400000;
const argv = process.argv.slice(2);

function arg(name, fallback) {
  const i = argv.indexOf('--' + name);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : fallback;
}

const pad2 = (n) => String(n).padStart(2, '0');
const fmt = (ms) => new Date(ms).toISOString().slice(0, 10);
const parse = (s) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s || ''));
  if (!m) return null;
  return Date.UTC(+m[1], +m[2] - 1, +m[3]);
};

const todayUtc = (() => { const d = new Date(); return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()); })();
const fromMs = parse(arg('from')) ?? todayUtc;
if (!fromMs) { console.error('--from: нужен формат YYYY-MM-DD'); process.exit(2); }

const untilArg = parse(arg('until'));
const days = Math.max(1, Number(arg('days', 7)) || 7);
const untilMs = untilArg ?? fromMs + (days - 1) * DAY;
if (untilMs < fromMs) { console.error('--until раньше --from'); process.exit(2); }
const totalDays = Math.round((untilMs - fromMs) / DAY) + 1;
if (totalDays > 400) { console.error('слишком длинный срок (максимум 400 дней)'); process.exit(2); }

const maxAgeDays = Math.max(1, Number(arg('max-age-days', 7)) || 7);

// Ссылка бывает двух видов:
//   обычная  https://invapi.online/golovolomki/go/<32 hex>
//   короткая https://invapi.online/g/<8 знаков>          (--short)
const short = argv.includes('--short');
const ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789'; // без 0/o, 1/l/i — удобно диктовать
const prefix = arg('path', short ? '/g/' : '/golovolomki/go/');
const token = arg('code') || arg('token') ||
  (short
    ? Array.from({ length: 8 }, () => ALPHABET[crypto.randomInt(ALPHABET.length)]).join('')
    : crypto.randomBytes(16).toString('hex'));

const shortStyle = short || !!arg('path') || !!arg('code');
const tokenRe = shortStyle ? /^[a-z0-9]{6,24}$/ : /^[A-Za-z0-9_-]{16,64}$/;
if (!tokenRe.test(token)) {
  console.error(shortStyle ? '--code: 6–24 символа [a-z0-9]' : '--token: 16–64 символа [A-Za-z0-9_-]');
  process.exit(2);
}

// Дни месяца в виде компактной регулярки: 22..29 → 2[2-9], 1..5 → 0[1-5].
function unitsPattern(units) {
  const parts = [];
  let i = 0;
  while (i < units.length) {
    let j = i;
    while (j + 1 < units.length && units[j + 1] === units[j] + 1) j++;
    parts.push(i === j ? String(units[i]) : units[i] + '-' + units[j]);
    i = j + 1;
  }
  if (parts.length === 1 && /^\d$/.test(parts[0])) return parts[0]; // одна цифра: 22
  return '[' + parts.join('') + ']';                                  // класс: 2[2-8], 0[1-5]
}
function dayPattern(daysOfMonth) {
  const parts = [];
  let i = 0;
  while (i < daysOfMonth.length) {
    const tens = Math.floor(daysOfMonth[i] / 10);
    const units = [];
    while (i < daysOfMonth.length && Math.floor(daysOfMonth[i] / 10) === tens) {
      units.push(daysOfMonth[i] % 10);
      i++;
    }
    parts.push(tens + unitsPattern(units));
  }
  return parts.join('|');
}

// Группируем дни по месяцам: "~^2026-10-(22|...)".
const byMonth = new Map();
for (let ms = fromMs; ms <= untilMs; ms += DAY) {
  const d = new Date(ms);
  const key = d.getUTCFullYear() + '-' + pad2(d.getUTCMonth() + 1);
  if (!byMonth.has(key)) byMonth.set(key, []);
  byMonth.get(key).push(d.getUTCDate());
}
const mapRows = [...byMonth].map(([ym, list]) => `    "~^${ym}-(${dayPattern(list)})" 1;`).join('\n');

const url = 'https://invapi.online' + prefix + token;
const line = '─'.repeat(72);

console.log(line);
console.log('Временная ссылка полного доступа');
console.log('  действует: ' + fmt(fromMs) + ' — ' + fmt(untilMs) + ' включительно (' + totalDays + ' дн., UTC)');
console.log('  cookie bg4gt: ' + maxAgeDays + ' дн. с момента перехода по ссылке');
console.log('  URL: ' + url);
console.log(line);
console.log('');
console.log('1) В http-контекст конфига (рядом с другими map) — срок действия:');
console.log('');
console.log('map $time_iso8601 $golems_link_live {');
console.log('    default 0;');
console.log(mapRows);
console.log('}');
console.log('');
console.log('2) В server-блок invapi.online (рядом с location /golovolomki/) — сама дверь:');
console.log('');
console.log('location = ' + prefix + token + ' {');
console.log('    if ($golems_link_live = 0) { return 404; }');
console.log('    add_header Cache-Control "no-store";');
console.log('    add_header Set-Cookie "bg4gt=$golems_gate_secret; Path=/golovolomki/; Max-Age=' + (maxAgeDays * 86400) + '; Secure; SameSite=Lax";');
console.log('    return 302 /golovolomki/;');
console.log('}');
console.log('');
console.log('   и рядом — 404 на все прочие адреса под ' + prefix + ' (если ещё нет):');
console.log('');
console.log('location ^~ ' + prefix + ' {');
console.log('    return 404;');
console.log('}');
console.log('');
console.log('3) Проверить и перезагрузить nginx (на сервере):');
console.log('');
console.log('docker exec 3x-ui-nginx-1 nginx -t && docker exec 3x-ui-nginx-1 nginx -s reload');
console.log('');
console.log('Отозвать раньше срока: поменять токен/код в location (старая ссылка → 404)');
console.log('или поставить в map дату в прошлом. Продлить: перезапустить скрипт с тем же');
console.log('--token/--code и новым --days/--until, заменить оба блока.');
