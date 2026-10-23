/*
 * audio.js — весь звук синтезируется в браузере через WebAudio.
 * Никаких внешних файлов: игра полностью локальная.
 */
(function () {
  'use strict';
  const KVP = (window.KVP = window.KVP || {});

  let ctx = null, master = null, sfxGain = null, ambGain = null;
  let ambient = null;
  let volume = 0.55;
  let ready = false;

  function init() {
    if (ready) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = volume;
      master.connect(ctx.destination);
      sfxGain = ctx.createGain();
      sfxGain.gain.value = 0.7;
      sfxGain.connect(master);
      ambGain = ctx.createGain();
      ambGain.gain.value = 0.4;
      ambGain.connect(master);
      ready = true;
      startAmbient();
      return true;
    } catch (e) { return false; }
  }

  function resume() {
    if (ctx && ctx.state === 'suspended') ctx.resume();
  }

  function setVolume(v) {
    volume = Math.max(0, Math.min(1, v));
    if (master) master.gain.setTargetAtTime(volume, ctx.currentTime, 0.05);
  }

  function now() { return ctx ? ctx.currentTime : 0; }

  function tone(freq, type, dur, vol, slideTo, delay) {
    if (!ready || !ctx) return;
    const t = now() + (delay || 0);
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type || 'sine';
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0001, vol || 0.1), t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(sfxGain);
    o.start(t); o.stop(t + dur + 0.02);
  }

  function noise(dur, vol, filterHz, type, delay) {
    if (!ready || !ctx) return;
    const t = now() + (delay || 0);
    const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const g = ctx.createGain();
    g.gain.value = vol || 0.1;
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    let node = src;
    if (filterHz) {
      const f = ctx.createBiquadFilter();
      f.type = type || 'lowpass';
      f.frequency.value = filterHz;
      node.connect(f); node = f;
    }
    node.connect(g); g.connect(sfxGain);
    src.start(t); src.stop(t + dur + 0.02);
  }

  function startAmbient() {
    if (!ready || ambient) return;
    ambient = {};
    const t = now();
    const base = ctx.createGain();
    base.gain.value = 0.055;
    base.connect(ambGain);
    const oscs = [];
    [55, 82.5, 110].forEach(function (f, i) {
      const o = ctx.createOscillator();
      o.type = i === 0 ? 'sine' : 'triangle';
      o.frequency.value = f;
      const g = ctx.createGain();
      g.gain.value = i === 0 ? 0.5 : 0.18;
      o.connect(g); g.connect(base);
      o.start(t);
      oscs.push({ o: o, g: g });
    });
    // медленный «воздух» подземелья
    const len = Math.floor(ctx.sampleRate * 3);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * 0.5;
    const src = ctx.createBufferSource();
    src.buffer = buf; src.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass'; f.frequency.value = 320; f.Q.value = 0.7;
    const ng = ctx.createGain(); ng.gain.value = 0.05;
    src.connect(f); f.connect(ng); ng.connect(ambGain);
    src.start(t);
    ambient = { base: base, oscs: oscs, src: src, ng: ng };
  }

  function stopAmbient() {
    if (!ambient) return;
    try {
      ambient.oscs.forEach(function (x) { x.o.stop(); });
      ambient.src.stop();
    } catch (e) { /* ignore */ }
    ambient = null;
  }

  const sfx = {
    pickup: function () {
      tone(660, 'triangle', 0.09, 0.1);
      tone(880, 'triangle', 0.12, 0.1, null, 0.07);
      tone(1320, 'sine', 0.14, 0.07, null, 0.14);
    },
    coin: function () {
      tone(1046, 'square', 0.06, 0.06);
      tone(1568, 'square', 0.1, 0.05, null, 0.05);
    },
    card: function () {
      noise(0.12, 0.1, 2400, 'highpass');
      tone(320, 'sine', 0.1, 0.05, 180);
    },
    shoot: function () {
      noise(0.09, 0.16, 1200, 'lowpass');
      tone(180, 'square', 0.09, 0.06, 70);
    },
    hit: function () {
      noise(0.12, 0.2, 800, 'lowpass');
      tone(120, 'sawtooth', 0.12, 0.1, 50);
    },
    explode: function () {
      noise(0.5, 0.35, 500, 'lowpass');
      tone(90, 'sawtooth', 0.4, 0.18, 30);
      tone(150, 'square', 0.2, 0.08, 40, 0.03);
    },
    fail: function () {
      tone(220, 'square', 0.18, 0.1, 180);
      tone(160, 'square', 0.22, 0.1, 100, 0.16);
    },
    denied: function () {
      tone(140, 'square', 0.1, 0.08);
      tone(120, 'square', 0.14, 0.07, null, 0.12);
    },
    hurt: function () {
      tone(90, 'sawtooth', 0.28, 0.16, 50);
      noise(0.15, 0.16, 600, 'lowpass');
    },
    enemyShot: function () {
      tone(760, 'sawtooth', 0.15, 0.07, 220);
      noise(0.12, 0.08, 1800, 'bandpass');
    },
    stun: function () {
      tone(420, 'sine', 0.2, 0.08, 260);
      tone(520, 'triangle', 0.25, 0.06, 300, 0.1);
    },
    portal: function () {
      [262, 330, 392, 523].forEach(function (f, i) {
        tone(f, 'sine', 0.35, 0.06, null, i * 0.07);
      });
      noise(0.4, 0.07, 3000, 'bandpass');
    },
    chest: function () {
      tone(180, 'square', 0.1, 0.08);
      tone(240, 'square', 0.18, 0.07, 320, 0.08);
      tone(880, 'sine', 0.2, 0.05, 1320, 0.2);
    },
    step: function () {
      noise(0.07, 0.05, 500, 'lowpass');
    },
    victory: function () {
      const seq = [523, 659, 784, 1046, 784, 1046, 1318];
      seq.forEach(function (f, i) {
        tone(f, 'triangle', 0.32, 0.1, null, i * 0.15);
      });
      noise(0.6, 0.06, 2600, 'highpass', 0.4);
    },
    gameover: function () {
      const seq = [392, 330, 262, 196];
      seq.forEach(function (f, i) {
        tone(f, 'sawtooth', 0.4, 0.09, null, i * 0.28);
      });
      noise(0.8, 0.08, 400, 'lowpass', 0.5);
    },
    mag: function () {
      [440, 554, 659, 880, 1108].forEach(function (f, i) {
        tone(f, 'sine', 0.5, 0.06, null, i * 0.06);
      });
    },
    dragon: function () {
      noise(0.9, 0.35, 700, 'lowpass');
      tone(70, 'sawtooth', 0.8, 0.2, 35);
      noise(0.5, 0.2, 2400, 'highpass', 0.2);
    }
  };

  KVP.Audio = {
    init: init,
    resume: resume,
    setVolume: setVolume,
    play: function (name) {
      if (!ready) return;
      try { if (sfx[name]) sfx[name](); } catch (e) { /* ignore */ }
    },
    startAmbient: startAmbient,
    stopAmbient: stopAmbient
  };
})();
