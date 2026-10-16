/*
 * Golems Puzzles — client-side progress (localStorage) with export/import.
 *
 * Progress is stored as:
 *   { completed: { "1.1": { stars, lines }, ... }, hints: {id:true}, coins, seenIntro }
 *
 * Sequential unlocking: a room is available when every previous room (in course
 * order) has been solved. Floors therefore unlock one after another.
 */
(function () {
  'use strict';
  const BG4 = (window.BG4 = window.BG4 || {});
  const KEY = 'bg4.progress.v1';

  const state = load();

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) return Object.assign({ completed: {}, hints: {}, coins: 0, seenIntro: false, unlockAll: false }, JSON.parse(raw));
    } catch (e) { /* ignore */ }
    return { completed: {}, hints: {}, coins: 0, seenIntro: false, unlockAll: false };
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* ignore */ } }

  let rooms = [];
  function setRooms(list) { rooms = list; }

  function indexOf(id) { return rooms.findIndex((r) => r.id === id); }

  function isCompleted(id) { return !!state.completed[id]; }
  function unlockAllEnabled() { return !!state.unlockAll; }
  function setUnlockAll(v) { state.unlockAll = !!v; save(); }
  function isUnlocked(id) {
    if (state.unlockAll) return true;
    const i = indexOf(id);
    if (i <= 0) return true;
    for (let k = 0; k < i; k++) if (!state.completed[rooms[k].id]) return false;
    return true;
  }
  function unlockedCount() { let n = 0; for (const r of rooms) { if (state.completed[r.id]) n++; else break; } return n; }
  function floorUnlocked(n) {
    if (state.unlockAll) return true;
    // a floor is unlocked when the first room of the floor is unlocked
    const first = rooms.find((r) => r.floor === n);
    return first ? isUnlocked(first.id) : false;
  }
  function floorProgress(n) {
    const list = rooms.filter((r) => r.floor === n);
    const done = list.filter((r) => state.completed[r.id]).length;
    const stars = list.reduce((s, r) => s + ((state.completed[r.id] && state.completed[r.id].stars) || 0), 0);
    return { total: list.length, done, stars, maxStars: list.length * 3 };
  }
  function totalStars() { return Object.values(state.completed).reduce((s, c) => s + (c.stars || 0), 0); }
  function completedCount() { return Object.keys(state.completed).length; }

  function complete(id, stars, lines) {
    const prev = state.completed[id];
    const best = prev ? Math.max(prev.stars || 0, stars) : stars;
    const bestLines = prev && prev.lines != null ? Math.min(prev.lines, lines) : lines;
    const first = !prev;
    state.completed[id] = { stars: best, lines: bestLines };
    if (first) state.coins += 10 + stars * 5;
    save();
    return { first, stars: best };
  }
  function markHint(id) { state.hints[id] = true; save(); }
  function usedHint(id) { return !!state.hints[id]; }
  function setSeenIntro() { state.seenIntro = true; save(); }

  function reset() { state.completed = {}; state.hints = {}; state.coins = 0; state.seenIntro = false; save(); }

  function exportJSON() { return JSON.stringify(state, null, 2); }
  function importJSON(text) {
    try {
      const data = JSON.parse(text);
      if (!data || typeof data !== 'object') return false;
      state.completed = data.completed || {};
      state.hints = data.hints || {};
      state.coins = data.coins || 0;
      state.seenIntro = !!data.seenIntro;
      state.unlockAll = !!data.unlockAll;
      save();
      return true;
    } catch (e) { return false; }
  }

  BG4.Progress = {
    setRooms, isCompleted, isUnlocked, unlockedCount, floorUnlocked, floorProgress,
    totalStars, completedCount, complete, markHint, usedHint, setSeenIntro,
    unlockAllEnabled, setUnlockAll,
    reset, exportJSON, importJSON, state,
  };
})();
