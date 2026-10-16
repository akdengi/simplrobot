const fs = require('fs');
const p='js/scene.js';
let s=fs.readFileSync(p,'utf8');
s=s.replace("  const stlGeos = { golem: {}, barrel: null, stone: null, portal: null };\n",
            "  const stlGeos = { golem: {}, barrel: null, stone: null, portal: null };\n  try { if (!window.BG4) window.BG4 = {}; window.BG4.stlGeos = stlGeos; } catch (e) {}\n");
fs.writeFileSync(p,s,'utf8');
console.log(s.includes('window.BG4.stlGeos = stlGeos')?'ok':'MISSING');
