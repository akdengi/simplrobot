const fs=require('fs');const p='js/scene.js';let s=fs.readFileSync(p,'utf8');
s=s.replace('    const stlGeo = stlGeos.golem && stlGeos.golem[color];\n    if (stlGeo) {',
            '    const stlGeo = stlGeos.golem && stlGeos.golem[color];\n    const stlOn = window.BG4 && window.BG4.Progress && window.BG4.Progress.stlEnabled && window.BG4.Progress.stlEnabled();\n    if (stlGeo && stlOn) {');
s=s.replace("    if (stlGeos.barrel) {","    if (stlGeos.barrel && window.BG4 && window.BG4.Progress && window.BG4.Progress.stlEnabled && window.BG4.Progress.stlEnabled()) {");
s=s.replace("    if (stlGeos.stone) {","    if (stlGeos.stone && window.BG4 && window.BG4.Progress && window.BG4.Progress.stlEnabled && window.BG4.Progress.stlEnabled()) {");
s=s.replace("    if (stlGeos.portal) {","    if (stlGeos.portal && window.BG4 && window.BG4.Progress && window.BG4.Progress.stlEnabled && window.BG4.Progress.stlEnabled()) {");
// portal special - fix the portal condition pattern if already split
fs.writeFileSync(p,s,'utf8');
console.log('ok');
