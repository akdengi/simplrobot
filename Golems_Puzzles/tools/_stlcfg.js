const fs=require('fs');const p='js/progress.js';let s=fs.readFileSync(p,'utf8');
s=s.replace("const KEY = 'bg4.progress.v1';","const KEY = 'bg4.progress.v1';");
s=s.replace("return Object.assign({ completed: {}, hints: {}, coins: 0, seenIntro: false }, JSON.parse(raw));",
            "return Object.assign({ completed: {}, hints: {}, coins: 0, seenIntro: false, settings: { stlEnabled: true } }, JSON.parse(raw));");
s=s.replace("return { completed: {}, hints: {}, coins: 0, seenIntro: false };",
            "return { completed: {}, hints: {}, coins: 0, seenIntro: false, settings: { stlEnabled: true } };");
// insert accessors after state declaration
s=s.replace("state.importJSON = data => importJSON(data);\n",
            "state.importJSON = data => importJSON(data);\n");
// exports
s=s.replace("  // a floor is unlocked when the first room of the floor is unlocked", "  function stlEnabled() { if (!state.settings) state.settings = { stlEnabled: true }; return !!state.settings.stlEnabled; }\n  function setStlEnabled(v) { if (!state.settings) state.settings = { stlEnabled: true }; state.settings.stlEnabled = !!v; state.save(); }\n  // a floor is unlocked when the first room of the floor is unlocked");
s=s.replace("BG4.Progress = {\n    setRooms, isCompleted, isUnlocked, unlockedCount, floorUnlocked, floorProgress,\n    totalStars, completedCount, complete, markHint, usedHint, setSeenIntro,\n    reset, exportJSON, importJSON, state,\n  };","BG4.Progress = {\n    setRooms, isCompleted, isUnlocked, unlockedCount, floorUnlocked, floorProgress,\n    totalStars, completedCount, complete, markHint, usedHint, setSeenIntro,\n    stlEnabled, setStlEnabled, reset, exportJSON, importJSON, state,\n  };");
s=s.replace("state.completed = {}; state.hints = {}; state.coins = 0; state.seenIntro = false; save();",
            "state.completed = {}; state.hints = {}; state.coins = 0; state.seenIntro = false;\n    state.settings = { stlEnabled: true }; save();");
fs.writeFileSync(p,s,'utf8');
console.log(s.includes('stlEnabled:') && s.includes('stlEnabled()') && s.includes('setStlEnabled'));
