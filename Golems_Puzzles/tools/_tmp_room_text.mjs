import fs from 'node:fs';
const raw = JSON.parse(fs.readFileSync(new URL('../data/bg4_export.json', import.meta.url), 'utf8'));
const want = process.argv.slice(2);
function text(html) {
  return String(html || '')
    .replace(/<\s*(br|BR)\s*\/?>/g, '\n')
    .replace(/<\s*\/\s*(div|p|h[1-6]|li|tr|blockquote)\s*>/gi, '\n')
    .replace(/<\s*(h[1-6]|div|p|li|tr|blockquote)[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/\r/g, '').replace(/[ \t]+\n/g, '\n').replace(/\n{2,}/g, '\n').trim();
}
for (const room of raw.rooms) {
  if (want.length && !want.includes(room.id)) continue;
  const html = String(room.htmlText || '');
  const noEmbed = html.replace(/<div[^>]*class="[^"]*t-redactor__embedcode[^"]*"[^>]*>[\s\S]*?<\/div>/gi, '\n');
  console.log('===== ' + room.id + ' =====');
  console.log(text(noEmbed));
}
