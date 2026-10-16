import fs from 'node:fs';
const ex = JSON.parse(fs.readFileSync(new URL('../data/bg4_export.json', import.meta.url), 'utf8'));
function text(html) {
  return String(html || '')
    .replace(/<\s*\/\s*(div|p|h[1-6]|li|tr)\s*>/gi, '\n')
    .replace(/<\s*(h[1-6]|div|p|li|tr)[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/\r/g, '').replace(/[ \t]+\n/g, '\n').replace(/\n{2,}/g, '\n').trim();
}
for (const r of ex.rooms) {
  const all = [...String(r.htmlText || '').matchAll(/<div[^>]*class="[^"]*t-redactor__text[^"]*"[^>]*>([\s\S]*?)<\/div>/gi)];
  const last = all.length ? text(all[all.length - 1][1]).replace(/\n/g, ' | ') : '(NONE)';
  const hasHr = /<hr/i.test(r.htmlText || '');
  console.log(r.id, hasHr ? 'HR' : '--', '::', last.slice(0, 90));
}
