/*
 * models3d.js — low-poly 3D-модели и текстуры подземелья (Three.js r128).
 *
 * Мир собран из простых форм: каменные стены, факелы, сундуки, портал и
 * ПароБоты. Карты-предметы — это 3D-плоскости, на которые натянуты
 * рисованные SVG-иллюстрации из art-svg.js.
 */
(function () {
  'use strict';
  const KVP = (window.KVP = window.KVP || {});
  const T = window.THREE;

  const WALL_H = 1.95;
  const EYE = 0.85;

  /* ------------------------------------------------------------------ */
  /*  ТЕКСТУРЫ                                                          */
  /* ------------------------------------------------------------------ */
  function canvasTex(size, draw, repeat) {
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const g = c.getContext('2d');
    draw(g, size);
    const tex = new T.CanvasTexture(c);
    tex.wrapS = tex.wrapT = T.RepeatWrapping;
    if (repeat) tex.repeat.set(repeat, repeat);
    tex.anisotropy = 4;
    tex.encoding = T.sRGBEncoding;
    /* 8/16-битный вид: пиксели текстуры остаются резкими, без сглаживания. */
    tex.magFilter = T.NearestFilter;
    tex.minFilter = T.NearestMipmapNearestFilter;
    return tex;
  }

  function noise(g, s, n, alpha, colors) {
    for (let i = 0; i < n; i++) {
      g.fillStyle = colors[(Math.random() * colors.length) | 0];
      g.globalAlpha = alpha * (0.4 + Math.random() * 0.6);
      const w = 1 + Math.random() * 4;
      g.fillRect(Math.random() * s, Math.random() * s, w, w);
    }
    g.globalAlpha = 1;
  }

  function brickTexture(base, mortar, tint) {
    return canvasTex(128, function (g, s) {
      g.fillStyle = mortar; g.fillRect(0, 0, s, s);
      const bh = 16, bw = 32;
      for (let row = 0; row < s / bh; row++) {
        const off = (row % 2) * (bw / 2);
        for (let x = -bw; x < s + bw; x += bw) {
          const bx = x + off, by = row * bh;
          const c = base[(Math.random() * base.length) | 0];
          g.fillStyle = c;
          g.fillRect(bx + 1, by + 1, bw - 2, bh - 2);
          g.fillStyle = 'rgba(255,255,255,.07)';
          g.fillRect(bx + 1, by + 1, bw - 2, 1);
          g.fillStyle = 'rgba(0,0,0,.18)';
          g.fillRect(bx + 1, by + bh - 3, bw - 2, 2);
        }
      }
      noise(g, s, 460, 0.22, [tint, '#000000', '#ffffff']);
      // трещины
      g.strokeStyle = 'rgba(20,15,12,.35)'; g.lineWidth = 1;
      for (let i = 0; i < 3; i++) {
        g.beginPath();
        let x = Math.random() * s, y = Math.random() * s;
        g.moveTo(x, y);
        for (let k = 0; k < 4; k++) { x += (Math.random() - 0.5) * 22; y += 8 + Math.random() * 10; g.lineTo(x, y); }
        g.stroke();
      }
    });
  }

  function wallTexture(type) {
    switch (type) {
      case 'wall_corridor':
        return brickTexture(['#3a3433', '#413a37', '#332e2d'], '#1c1817', '#6b5c52');
      case 'wall_castle':
        return brickTexture(['#4a423c', '#52483f', '#423a35'], '#231f1d', '#8a7661');
      case 'wall_armory':
        return canvasTex(128, function (g, s) {
          g.fillStyle = '#2b2622'; g.fillRect(0, 0, s, s);
          g.fillStyle = '#3c342d'; g.fillRect(4, 4, s - 8, s - 8);
          // стойка с оружием
          g.strokeStyle = '#7c6a55'; g.lineWidth = 3;
          g.beginPath(); g.moveTo(12, 110); g.lineTo(116, 110); g.stroke();
          g.strokeStyle = '#b9c2c8'; g.lineWidth = 4;
          for (let i = 0; i < 4; i++) {
            const x = 24 + i * 26;
            g.beginPath(); g.moveTo(x, 108); g.lineTo(x + 4, 30); g.stroke();
            g.beginPath(); g.arc(x + 4, 26, 7, 0, 6.28); g.stroke();
          }
          g.fillStyle = '#8f2f2a';
          g.beginPath(); g.arc(64, 70, 20, 0, 6.28); g.fill();
          g.fillStyle = '#d8a33f'; g.beginPath(); g.arc(64, 70, 7, 0, 6.28); g.fill();
          noise(g, s, 260, 0.2, ['#000', '#fff']);
        });
      case 'wall_library':
        return canvasTex(128, function (g, s) {
          g.fillStyle = '#241f1b'; g.fillRect(0, 0, s, s);
          // полки
          for (let row = 0; row < 3; row++) {
            const y = 14 + row * 38;
            g.fillStyle = '#4a3528'; g.fillRect(8, y + 28, 112, 6);
            for (let i = 0; i < 12; i++) {
              const c = ['#8f2f2a', '#3e5f86', '#4f7a4a', '#a8842c', '#6c4a8f'][(Math.random() * 5) | 0];
              g.fillStyle = c;
              const w = 5 + Math.random() * 5, h = 20 + Math.random() * 8;
              g.fillRect(10 + i * 9, y + 28 - h, w, h);
              g.fillStyle = 'rgba(255,255,255,.18)'; g.fillRect(10 + i * 9, y + 28 - h, w, 2);
            }
          }
          noise(g, s, 300, 0.18, ['#000', '#ffd36a']);
        });
      case 'wall_forge':
        return canvasTex(128, function (g, s) {
          g.fillStyle = '#2a1d19'; g.fillRect(0, 0, s, s);
          for (let i = 0; i < 40; i++) {
            g.fillStyle = ['#3b2a24', '#46312a', '#31231f'][(Math.random() * 3) | 0];
            g.fillRect(Math.random() * s, Math.random() * s, 14 + Math.random() * 22, 10 + Math.random() * 14);
          }
          // раскалённые трещины
          for (let i = 0; i < 5; i++) {
            g.strokeStyle = 'rgba(255,120,40,' + (0.35 + Math.random() * 0.4) + ')';
            g.lineWidth = 2;
            g.beginPath();
            let x = Math.random() * s, y = Math.random() * s;
            g.moveTo(x, y);
            for (let k = 0; k < 3; k++) { x += (Math.random() - 0.5) * 20; y += 8; g.lineTo(x, y); }
            g.stroke();
          }
          noise(g, s, 300, 0.2, ['#000', '#ff7a2a']);
        });
      case 'wall_barrack':
        return canvasTex(128, function (g, s) {
          g.fillStyle = '#3b2b22'; g.fillRect(0, 0, s, s);
          for (let i = 0; i < 6; i++) {
            g.fillStyle = i % 2 ? '#46342a' : '#513b2f';
            g.fillRect(0, i * 22, s, 20);
            g.fillStyle = 'rgba(0,0,0,.2)'; g.fillRect(0, i * 22 + 18, s, 4);
          }
          // знамя
          g.fillStyle = '#4f7a4a'; g.fillRect(42, 18, 46, 76);
          g.fillStyle = '#d8a33f'; g.fillRect(42, 18, 46, 5);
          g.fillStyle = '#e8d6ae';
          g.beginPath(); g.moveTo(65, 34); g.lineTo(73, 52); g.lineTo(91, 52); g.lineTo(77, 64); g.lineTo(83, 82); g.lineTo(65, 70); g.lineTo(47, 82); g.lineTo(53, 64); g.lineTo(39, 52); g.lineTo(57, 52); g.closePath(); g.fill();
          noise(g, s, 220, 0.18, ['#000', '#fff']);
        });
      case 'wall_treasure':
        return canvasTex(128, function (g, s) {
          g.fillStyle = '#2d2720'; g.fillRect(0, 0, s, s);
          for (let i = 0; i < 50; i++) {
            g.fillStyle = ['#453a28', '#51442e', '#3a3022'][(Math.random() * 3) | 0];
            g.fillRect(Math.random() * s, Math.random() * s, 10 + Math.random() * 24, 8 + Math.random() * 12);
          }
          g.fillStyle = '#d8a33f';
          for (let i = 0; i < 16; i++) {
            const x = Math.random() * s, y = Math.random() * s;
            g.beginPath(); g.arc(x, y, 1.6 + Math.random() * 2, 0, 6.28); g.fill();
          }
          noise(g, s, 240, 0.22, ['#000', '#ffd36a']);
        });
      case 'wall_trap':
        return canvasTex(128, function (g, s) {
          g.fillStyle = '#2c2a2a'; g.fillRect(0, 0, s, s);
          for (let y = 0; y < s; y += 16) {
            for (let x = 0; x < s; x += 16) {
              g.fillStyle = (x + y) % 32 === 0 ? '#3b3a3c' : '#343335';
              g.fillRect(x + 1, y + 1, 14, 14);
              g.fillStyle = '#8d9aa3';
              g.beginPath(); g.arc(x + 8, y + 8, 2, 0, 6.28); g.fill();
            }
          }
          g.strokeStyle = '#b9c2c8'; g.lineWidth = 2;
          g.beginPath(); g.moveTo(12, 12); g.lineTo(116, 116); g.moveTo(116, 12); g.lineTo(12, 116); g.stroke();
          noise(g, s, 180, 0.2, ['#000', '#fff']);
        });
      case 'wall_altar':
        return canvasTex(128, function (g, s) {
          g.fillStyle = '#2a2336'; g.fillRect(0, 0, s, s);
          for (let i = 0; i < 30; i++) {
            g.fillStyle = ['#342b44', '#3d3350', '#2e263a'][(Math.random() * 3) | 0];
            g.fillRect(Math.random() * s, Math.random() * s, 16 + Math.random() * 22, 10 + Math.random() * 16);
          }
          g.font = '26px Georgia'; g.fillStyle = 'rgba(190,150,255,.75)';
          const syms = ['∧', '∨', '¬', '⊕', '∞'];
          for (let i = 0; i < 4; i++) g.fillText(syms[i % syms.length], 12 + Math.random() * 82, 30 + Math.random() * 70);
          noise(g, s, 200, 0.2, ['#000', '#c9a8ff']);
        });
      case 'wall_arena':
        return canvasTex(128, function (g, s) {
          g.fillStyle = '#332a2a'; g.fillRect(0, 0, s, s);
          for (let i = 0; i < 40; i++) {
            g.fillStyle = ['#423434', '#4b3a39', '#3a2f2f'][(Math.random() * 3) | 0];
            g.fillRect(Math.random() * s, Math.random() * s, 14 + Math.random() * 20, 9 + Math.random() * 14);
          }
          g.fillStyle = '#8f2f2a';
          for (const x of [22, 84]) {
            g.fillRect(x, 12, 22, 92);
            g.beginPath(); g.moveTo(x, 104); g.lineTo(x + 11, 120); g.lineTo(x + 22, 104); g.fill();
            g.fillStyle = '#d8a33f';
            g.beginPath(); g.arc(x + 11, 52, 6, 0, 6.28); g.fill();
            g.fillStyle = '#8f2f2a';
          }
          noise(g, s, 240, 0.2, ['#000', '#fff']);
        });
      case 'wall_boss':
        return canvasTex(128, function (g, s) {
          g.fillStyle = '#241a1f'; g.fillRect(0, 0, s, s);
          for (let i = 0; i < 36; i++) {
            g.fillStyle = ['#33232a', '#3c2930', '#2b1d23'][(Math.random() * 3) | 0];
            g.fillRect(Math.random() * s, Math.random() * s, 16 + Math.random() * 22, 10 + Math.random() * 14);
          }
          // черепа
          g.fillStyle = '#b9a98d';
          for (const p of [[30, 38], [94, 70], [56, 98]]) {
            g.beginPath(); g.arc(p[0], p[1], 10, 0, 6.28); g.fill();
            g.fillStyle = '#241a12'; g.beginPath(); g.arc(p[0] - 4, p[1] - 2, 2.3, 0, 6.28); g.arc(p[0] + 4, p[1] - 2, 2.3, 0, 6.28); g.fill();
            g.fillStyle = '#b9a98d';
          }
          noise(g, s, 260, 0.22, ['#000', '#ff6b3e']);
        });
      case 'wall_door':
        /* Закрытая дверь: существующий, но пока недоступный проход. */
        return canvasTex(64, function (g, s) {
          /* Каменная рама */
          g.fillStyle = '#2b2521'; g.fillRect(0, 0, s, s);
          g.fillStyle = '#4a4038'; g.fillRect(2, 2, s - 4, s - 4);
          /* Деревянное полотно */
          g.fillStyle = '#5a3a22'; g.fillRect(9, 4, s - 18, s - 6);
          for (let i = 0; i < 5; i++) {
            g.fillStyle = i % 2 ? '#664326' : '#4e301b';
            g.fillRect(10 + i * ((s - 20) / 5), 5, (s - 20) / 5 - 1, s - 8);
            g.fillStyle = 'rgba(255,190,110,.10)';
            g.fillRect(10 + i * ((s - 20) / 5), 5, (s - 20) / 5 - 1, 1);
          }
          /* Железные полосы и заклёпки */
          g.fillStyle = '#7f8890';
          g.fillRect(8, 14, s - 16, 4);
          g.fillRect(8, s - 22, s - 16, 4);
          g.fillStyle = '#b8c2c8';
          for (let i = 0; i < 5; i++) {
            g.fillRect(12 + i * 10, 15, 2, 2);
            g.fillRect(12 + i * 10, s - 21, 2, 2);
          }
          /* Ручка-кольцо */
          g.strokeStyle = '#d8a33f'; g.lineWidth = 3;
          g.beginPath(); g.arc(s - 20, s / 2 + 4, 5, 0, Math.PI * 1.6); g.stroke();
          g.fillStyle = '#d8a33f'; g.fillRect(s - 24, s / 2 - 2, 8, 3);
          noise(g, s, 90, 0.18, ['#000', '#ffd36a']);
        });
      default:
        return brickTexture(['#4a423c', '#52483f'], '#231f1d', '#8a7661');
    }
  }

  const texCache = {};
  function getWallTex(type) {
    if (!texCache[type]) texCache[type] = wallTexture(type);
    return texCache[type];
  }

  /* ------------------------------------------------------------------ */
  /*  ПОЛ КОМНАТЫ — ПО ЕЁ НАЗВАНИЮ                                        */
  /* ------------------------------------------------------------------ */
  const roomFloorCache = {};
  function roomFloorTex(type) {
    if (roomFloorCache[type]) return roomFloorCache[type];
    roomFloorCache[type] = roomFloorTexture(type);
    return roomFloorCache[type];
  }

  function roomFloorTexture(type) {
    switch (type) {
      case 'armory':      // Оружейная — дощатый пол
        return canvasTex(128, function (g, s) {
          g.fillStyle = '#3a2c1f'; g.fillRect(0, 0, s, s);
          for (let i = 0; i < 6; i++) {
            g.fillStyle = i % 2 ? '#5a4229' : '#4d3823';
            g.fillRect(0, i * 22, s, 20);
            g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(0, i * 22 + 19, s, 3);
            g.fillStyle = 'rgba(255,220,160,.06)';
            for (let k = 0; k < 4; k++) g.fillRect(k * 32 + 4, i * 22 + 3, 26, 2);
          }
          noise(g, s, 200, 0.16, ['#000', '#c9a45c']);
        });
      case 'library':     // Книжная палата — тёмный ковёр с узором
        return canvasTex(128, function (g, s) {
          g.fillStyle = '#3a2430'; g.fillRect(0, 0, s, s);
          g.strokeStyle = 'rgba(201,164,92,.5)'; g.lineWidth = 3;
          g.strokeRect(10, 10, s - 20, s - 20);
          g.strokeRect(22, 22, s - 44, s - 44);
          g.fillStyle = 'rgba(201,164,92,.28)';
          g.beginPath(); g.arc(s / 2, s / 2, 20, 0, 6.28); g.fill();
          g.fillStyle = 'rgba(255,255,255,.05)'; g.fillRect(0, 0, s, 4);
          noise(g, s, 220, 0.16, ['#000', '#c9a45c']);
        });
      case 'forge':       // Кузница — обожжённый камень с жилками жара
        return canvasTex(128, function (g, s) {
          g.fillStyle = '#241a17'; g.fillRect(0, 0, s, s);
          for (let i = 0; i < 26; i++) {
            g.fillStyle = ['#33241f', '#3d2b24', '#2b1e1a'][(Math.random() * 3) | 0];
            g.fillRect(Math.random() * s, Math.random() * s, 18 + Math.random() * 20, 12 + Math.random() * 14);
          }
          for (let i = 0; i < 4; i++) {
            g.strokeStyle = 'rgba(255,110,40,' + (0.3 + Math.random() * 0.4) + ')';
            g.lineWidth = 2;
            let x = Math.random() * s, y = Math.random() * s;
            g.beginPath(); g.moveTo(x, y);
            for (let k = 0; k < 3; k++) { x += (Math.random() - 0.5) * 26; y += 9; g.lineTo(x, y); }
            g.stroke();
          }
          noise(g, s, 240, 0.18, ['#000', '#ff7a2a']);
        });
      case 'barrack':    // Казарма — камень с соломой
        return canvasTex(128, function (g, s) {
          g.fillStyle = '#2e2a20'; g.fillRect(0, 0, s, s);
          for (let i = 0; i < 34; i++) {
            g.fillStyle = ['#3a3529', '#433c2e', '#332e24'][(Math.random() * 3) | 0];
            g.fillRect(Math.random() * s, Math.random() * s, 14 + Math.random() * 18, 10 + Math.random() * 12);
          }
          g.strokeStyle = 'rgba(180,150,90,.35)'; g.lineWidth = 1;
          for (let i = 0; i < 60; i++) {
            const x = Math.random() * s, y = Math.random() * s, a = Math.random() * 3;
            g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * 7, y + Math.sin(a) * 7); g.stroke();
          }
          noise(g, s, 200, 0.16, ['#000', '#c9b06a']);
        });
      case 'chest':      // Сокровищница — плиты с золотой крошкой
        return canvasTex(128, function (g, s) {
          g.fillStyle = '#2b2620'; g.fillRect(0, 0, s, s);
          for (let y = 0; y < s; y += 32) {
            for (let x = 0; x < s; x += 32) {
              g.fillStyle = ['#453a2c', '#4e4232', '#3d342a'][(Math.random() * 3) | 0];
              g.fillRect(x + 1, y + 1, 30, 30);
              g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(x + 1, y + 29, 30, 2);
            }
          }
          g.fillStyle = 'rgba(216,163,63,.5)';
          for (let i = 0; i < 22; i++) {
            g.beginPath(); g.arc(Math.random() * s, Math.random() * s, 1.4 + Math.random() * 1.8, 0, 6.28); g.fill();
          }
          noise(g, s, 220, 0.2, ['#000', '#ffd36a']);
        });
      case 'trap':       // Зал капканов — металлический grating
        return canvasTex(128, function (g, s) {
          g.fillStyle = '#232527'; g.fillRect(0, 0, s, s);
          g.strokeStyle = '#5a6068'; g.lineWidth = 3;
          for (let i = 0; i < s; i += 21) {
            g.beginPath(); g.moveTo(i, 0); g.lineTo(i, s); g.stroke();
            g.beginPath(); g.moveTo(0, i); g.lineTo(s, i); g.stroke();
          }
          g.fillStyle = '#6d7681';
          for (let y = 6; y < s; y += 42) for (let x = 6; x < s; x += 42) {
            g.beginPath(); g.arc(x, y, 2.4, 0, 6.28); g.fill();
          }
          noise(g, s, 160, 0.2, ['#000', '#fff']);
        });
      case 'altar':      // Алтарь заклинаний — пурпурный мрамор
        return canvasTex(128, function (g, s) {
          g.fillStyle = '#2b2440'; g.fillRect(0, 0, s, s);
          for (let i = 0; i < 22; i++) {
            g.fillStyle = ['#372d4e', '#3f3459', '#312a45'][(Math.random() * 3) | 0];
            g.fillRect(Math.random() * s, Math.random() * s, 20 + Math.random() * 22, 14 + Math.random() * 16);
          }
          g.strokeStyle = 'rgba(201,168,255,.5)'; g.lineWidth = 2;
          g.beginPath();
          g.moveTo(20, 90); g.lineTo(64, 40); g.lineTo(108, 90); g.stroke();
          g.beginPath(); g.arc(64, 100, 12, 0, 6.28); g.stroke();
          noise(g, s, 200, 0.2, ['#000', '#c9a8ff']);
        });
      case 'arena':      // Дуэльная арена — утоптанный песок
        return canvasTex(128, function (g, s) {
          g.fillStyle = '#4a3d2c'; g.fillRect(0, 0, s, s);
          for (let i = 0; i < 60; i++) {
            g.fillStyle = ['#584a36', '#635440', '#514533'][(Math.random() * 3) | 0];
            g.fillRect(Math.random() * s, Math.random() * s, 12 + Math.random() * 22, 9 + Math.random() * 14);
          }
          g.strokeStyle = 'rgba(150,70,60,.4)'; g.lineWidth = 4;
          g.beginPath(); g.arc(s / 2, s / 2, 40, 0, 6.28); g.stroke();
          noise(g, s, 260, 0.2, ['#000', '#c9a45c']);
        });
      case 'boss':       // Тронный зал — чёрный мрамор с багровыми прожилками
        return canvasTex(128, function (g, s) {
          g.fillStyle = '#1d1418'; g.fillRect(0, 0, s, s);
          for (let i = 0; i < 18; i++) {
            g.fillStyle = ['#2a1e24', '#31232a', '#261b21'][(Math.random() * 3) | 0];
            g.fillRect(Math.random() * s, Math.random() * s, 22 + Math.random() * 24, 16 + Math.random() * 18);
          }
          g.strokeStyle = 'rgba(200,60,45,.4)'; g.lineWidth = 2;
          for (let i = 0; i < 4; i++) {
            let x = Math.random() * s, y = Math.random() * s;
            g.beginPath(); g.moveTo(x, y);
            for (let k = 0; k < 3; k++) { x += (Math.random() - 0.5) * 30; y += 10; g.lineTo(x, y); }
            g.stroke();
          }
          noise(g, s, 200, 0.2, ['#000', '#ff6b3e']);
        });
      case 'vault':      // Тайник — тёмный камень со свитками
        return canvasTex(128, function (g, s) {
          g.fillStyle = '#25212a'; g.fillRect(0, 0, s, s);
          for (let i = 0; i < 24; i++) {
            g.fillStyle = ['#2f2a35', '#37313e', '#2a2531'][(Math.random() * 3) | 0];
            g.fillRect(Math.random() * s, Math.random() * s, 18 + Math.random() * 20, 13 + Math.random() * 15);
          }
          g.fillStyle = 'rgba(216,206,178,.5)';
          for (let i = 0; i < 5; i++) {
            const x = 12 + Math.random() * 100, y = 12 + Math.random() * 100;
            g.fillRect(x, y, 16, 5);
          }
          noise(g, s, 200, 0.2, ['#000', '#c9bca0']);
        });
      default:           // Врата подземелья — серый камень
        return canvasTex(128, function (g, s) {
          g.fillStyle = '#2b2823'; g.fillRect(0, 0, s, s);
          for (let y = 0; y < s; y += 32) {
            for (let x = 0; x < s; x += 32) {
              g.fillStyle = ['#3c372f', '#443e35', '#35302a'][(Math.random() * 3) | 0];
              g.fillRect(x + 1, y + 1, 30, 30);
              g.fillStyle = 'rgba(0,0,0,.28)'; g.fillRect(x + 1, y + 29, 30, 2);
              g.fillStyle = 'rgba(255,255,255,.04)'; g.fillRect(x + 1, y + 1, 30, 1);
            }
          }
          noise(g, s, 220, 0.18, ['#000', '#8a7661']);
        });
    }
  }

  const floorTex = canvasTex(128, function (g, s) {
    g.fillStyle = '#151210'; g.fillRect(0, 0, s, s);
    const n = 4, c = s / n;
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        g.fillStyle = ['#3a332d', '#423a32', '#352f2a', '#3e372f'][(Math.random() * 4) | 0];
        g.fillRect(x * c + 2, y * c + 2, c - 4, c - 4);
        /* 8/16-битный скос плиты: светлая кромка и тёмный низ. */
        g.fillStyle = 'rgba(255,230,190,.12)';
        g.fillRect(x * c + 2, y * c + 2, c - 4, 2);
        g.fillStyle = 'rgba(0,0,0,.34)';
        g.fillRect(x * c + 2, y * c + c - 4, c - 4, 2);
        /* Пара трещин на плиту. */
        if ((x + y * n) % 3 === 0) {
          g.strokeStyle = 'rgba(10,8,7,.45)'; g.lineWidth = 1;
          g.beginPath();
          g.moveTo(x * c + 6, y * c + 8);
          g.lineTo(x * c + c - 10, y * c + c - 8);
          g.stroke();
        }
      }
    }
    noise(g, s, 420, 0.16, ['#000', '#6b5c52', '#a88c6e']);
  }, 22);

  const ceilTex = canvasTex(64, function (g, s) {
    g.fillStyle = '#3a3444'; g.fillRect(0, 0, s, s);
    /* Каменные блоки потолка — светлее, чтобы читались в 3D. */
    const n = 2, c = s / n;
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        g.fillStyle = ['#4a4258', '#554c62', '#443c50', '#5c5268'][(Math.random() * 4) | 0];
        g.fillRect(x * c + 2, y * c + 2, c - 4, c - 4);
        g.fillStyle = 'rgba(255,230,190,.12)';
        g.fillRect(x * c + 2, y * c + 2, c - 4, 1);
        g.fillStyle = 'rgba(0,0,0,.22)';
        g.fillRect(x * c + 2, y * c + c - 4, c - 4, 2);
      }
    }
    /* Балки по краям тайла — при повторе получается решётка. */
    g.fillStyle = '#6a4a32'; g.fillRect(0, 0, s, 7); g.fillRect(0, 0, 7, s);
    g.fillStyle = '#8a6440'; g.fillRect(0, 0, s, 2); g.fillRect(0, 0, 2, s);
    g.fillStyle = 'rgba(0,0,0,.3)'; g.fillRect(0, 7, s, 1); g.fillRect(7, 0, 1, s);
    noise(g, s, 220, 0.16, ['#000', '#b8a890']);
  }, 18);

  /* ------------------------------------------------------------------ */
  /*  МАТЕРИАЛЫ                                                         */
  /* ------------------------------------------------------------------ */
  const wallMats = {};
  function wallMat(type) {
    if (!wallMats[type]) {
      const map = getWallTex(type);
      wallMats[type] = new T.MeshLambertMaterial({ map: map });
    }
    return wallMats[type];
  }

  const MAT = {
    wood: new T.MeshLambertMaterial({ color: 0x6b4a2a }),
    darkWood: new T.MeshLambertMaterial({ color: 0x4a3420 }),
    steel: new T.MeshLambertMaterial({ color: 0x8d9aa3 }),
    darkSteel: new T.MeshLambertMaterial({ color: 0x56636b }),
    stoneDark: new T.MeshLambertMaterial({ color: 0x4a4038 }),
    gold: new T.MeshLambertMaterial({ color: 0xd8a33f, emissive: 0x3a2600 }),
    rust: new T.MeshLambertMaterial({ color: 0x96513a }),
    rustDark: new T.MeshLambertMaterial({ color: 0x6f362a }),
    /* Песчаный камень — ноги/голова големов (как на референсах). */
    sand: new T.MeshLambertMaterial({ color: 0xdcb894 }),
    sandDark: new T.MeshLambertMaterial({ color: 0xb08858 }),
    purple: new T.MeshLambertMaterial({ color: 0x6c4a8f }),
    red: new T.MeshLambertMaterial({ color: 0x8f2f2a }),
    green: new T.MeshLambertMaterial({ color: 0x4f7a4a }),
    bone: new T.MeshLambertMaterial({ color: 0xd8cba8 }),
    black: new T.MeshLambertMaterial({ color: 0x1b1719 }),
    glowOrange: new T.MeshBasicMaterial({ color: 0xff8a2a }),
    glowYellow: new T.MeshBasicMaterial({ color: 0xffd36a }),
    glowBlue: new T.MeshBasicMaterial({ color: 0x7ecbff }),
    glowGreen: new T.MeshBasicMaterial({ color: 0x8dffb0 }),
    glowPurple: new T.MeshBasicMaterial({ color: 0xc9a8ff }),
    flame: new T.MeshBasicMaterial({ color: 0xffb24a, transparent: true, opacity: 0.92 }),
    flameCore: new T.MeshBasicMaterial({ color: 0xfff0b0 })
  };

  function box(w, h, d, mat, x, y, z) {
    const m = new T.Mesh(new T.BoxGeometry(w, h, d), mat);
    m.position.set(x || 0, y || 0, z || 0);
    return m;
  }
  function cyl(rt, rb, h, mat, x, y, z, seg) {
    const m = new T.Mesh(new T.CylinderGeometry(rt, rb, h, seg || 8), mat);
    m.position.set(x || 0, y || 0, z || 0);
    return m;
  }
  function cone(r, h, mat, x, y, z, seg) {
    const m = new T.Mesh(new T.ConeGeometry(r, h, seg || 8), mat);
    m.position.set(x || 0, y || 0, z || 0);
    return m;
  }
  function sphere(r, mat, x, y, z, seg) {
    const m = new T.Mesh(new T.SphereGeometry(r, seg || 8, seg || 6), mat);
    m.position.set(x || 0, y || 0, z || 0);
    return m;
  }

  /* ------------------------------------------------------------------ */
  /*  МИР                                                               */
  /* ------------------------------------------------------------------ */
  /* ------------------------------------------------------------------ */
  /*  УКАЗАТЕЛЬ НЕИССЛЕДОВАННОГО ПРОХОДА                                */
  /* ------------------------------------------------------------------ */
  function makeExitSign(dir) {
    const cv = document.createElement('canvas');
    cv.width = 256;
    cv.height = 128;
    const g = cv.getContext('2d');
    g.clearRect(0, 0, 256, 128);
    g.fillStyle = 'rgba(16, 12, 9, .78)';
    g.strokeStyle = '#ffd36a';
    g.lineWidth = 5;
    g.beginPath();
    if (g.roundRect) g.roundRect(8, 8, 240, 112, 14);
    else g.rect(8, 8, 240, 112);
    g.fill();
    g.stroke();
    // Стрелка вперёд.
    g.strokeStyle = '#ffe6a0';
    g.lineWidth = 9;
    g.lineCap = 'round';
    g.lineJoin = 'round';
    g.beginPath();
    g.moveTo(128, 62);
    g.lineTo(128, 30);
    g.moveTo(106, 48);
    g.lineTo(128, 26);
    g.lineTo(150, 48);
    g.stroke();
    g.fillStyle = '#ffd36a';
    g.font = 'bold 27px Georgia, serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText('ТЯНИ КАРТУ', 128, 98);
    const tex = new T.CanvasTexture(cv);
    tex.needsUpdate = true;
    const mat = new T.MeshBasicMaterial({
      map: tex, transparent: true, depthWrite: false, side: T.DoubleSide
    });
    const mesh = new T.Mesh(new T.PlaneGeometry(1.7, 0.85), mat);
    // Плоскость смотрит на игрока (внутрь комнаты).
    if (dir === 'n') mesh.rotation.y = 0;
    else if (dir === 's') mesh.rotation.y = Math.PI;
    else if (dir === 'w') mesh.rotation.y = Math.PI / 2;
    else mesh.rotation.y = -Math.PI / 2;
    mesh.renderOrder = 3;
    return mesh;
  }

  /* ------------------------------------------------------------------ */
  /*  СОДЕРЖИМОЕ КОМНАТЫ — ПО ЕЁ НАЗВАНИЮ                                 */
  /*                                                                     */
  /*  Углы комнаты свободны от проёмов (проёмы вырезаны в середине       */
  /*  сторон), поэтому весь реквизит ставим по углам, оставляя центр    */
  /*  и подходы к выходам пустыми.                                       */
  /* ------------------------------------------------------------------ */
  /* ------------------------------------------------------------------ */
  /*  КАМЕННО-ЖЕЛЕЗНАЯ ДВЕРЬ (замковые двери)                          */
  /* ------------------------------------------------------------------ */
  function makeCastleDoor(spanNS) {
    /* spanNS: поперечная ось двери — X ('ns') или Z ('ew'). */
    const g = new T.Group();
    const H = WALL_H - 0.06;             // высота дверного полотна
    const W = 1.78;                     // ширина дверного полотна (немного меньше проёма 2.0)
    const D = 0.22;                     // толщина двери
    const leafW = (W - 0.06) / 2;       // каждый ставень — половина двери
    const wood = MAT.darkWood;
    const woodLight = MAT.wood;
    const iron = MAT.darkSteel;
    const stud = MAT.steel;
    const stone = MAT.darkSteel;

    /* ---- Каменная рама дверного проёма ---- */
    /* Левый и правый столбы */
    g.add(box(0.18, H + 0.18, 0.34, stone, -W / 2 - 0.16, (H + 0.18) / 2, 0));
    g.add(box(0.18, H + 0.18, 0.34, stone, W / 2 + 0.16, (H + 0.18) / 2, 0));
    /* Нижняя перемычка (порог) */
    g.add(box(W + 0.32 + 0.36, 0.12, 0.34, stone, 0, 0.06, 0));

    /* ---- Аркадное закруглённое завершение сверху (полуцилиндр) ---- */
    /* Полуцилиндр лежит на боку: поворот вокруг X на 90°, центр сверху проёма. */
    const archR = W / 2 + 0.16;
    const arch = new T.Group();
    const archMesh = new T.Mesh(
      new T.CylinderGeometry(archR, archR, 0.32, 20, 1, false, 0, Math.PI),
      new T.MeshLambertMaterial({ color: 0x5a4a38 })
    );
    archMesh.rotation.z = -Math.PI / 2;
    archMesh.rotation.y = Math.PI / 2;
    archMesh.position.set(0, H + 0.16, 0);
    arch.add(archMesh);
    /* поперечная балка арки (камень) поверх */
    g.add(box(W + 0.32, 0.14, 0.36, stone, 0, H + 0.16 + archR - 0.06, 0));
    g.add(arch);

    /* ---- Два ставня (створки) ---- */
    const leafH = H - 0.04;
    const leafL = new T.Mesh(new T.BoxGeometry(leafW, leafH, D), new T.MeshLambertMaterial({ color: 0x6b4528 }));
    leafL.position.set(-leafW / 2 - 0.02, leafH / 2 + 0.02, 0);
    /* планки выступают рельефом: шесть вертикальных дощечек на каждом ставне */
    const plankW = leafW / 4 - 0.02;
    for (let i = 0; i < 4; i++) {
      const px = -leafW / 2 - 0.02 - leafW / 4 + i * (leafW / 4 - 0.02); // approximate
      leafL.add(box(plankW, leafH - 0.08, 0.04, new T.MeshLambertMaterial({ color: 0x583922 }),
                    -leafW / 4 + (i - 1.5) * (leafW / 4), 0, D / 2 - 0.01));
    }
    g.add(leafL);

    const leafRmesh = leafL.clone();
    leafRmesh.position.x = leafW / 2 + 0.02;
    g.add(leafRmesh);

    /* ---- Железные полосы (3 горизонтальные) ---- */
    for (let b = 0; b < 3; b++) {
      const by = 0.25 + b * (leafH / 3);
      g.add(box(W + 0.04, 0.12, D + 0.06, iron, 0, by, 0));
    }
    /* Вертикальное железо по шву между ставнями (замок) */
    g.add(box(0.1, leafH + 0.08, D + 0.04, iron, 0, leafH / 2 + 0.04, 0));

    /* ---- Железные заклёпки по краям полос ---- */
    for (let b = 0; b < 3; b++) {
      const by = 0.25 + b * (leafH / 3);
      for (let x = -1; x <= 1; x += 2) {
        const r = new T.Mesh(new T.CylinderGeometry(0.055, 0.055, 0.12, 8), new T.MeshLambertMaterial({ color: stud }));
        r.rotation.x = Math.PI / 2;
        r.position.set(x * (W / 2 - 0.12), by, D / 2 + 0.04);
        g.add(r);
      }
    }

    /* ---- Ручка (кольцо) ---- */
    const handleGroup = new T.Group();
    const ring = new T.Mesh(new T.TorusGeometry(0.13, 0.028, 6, 12, Math.PI * 1.6), new T.MeshLambertMaterial({ color: iron }));
    ring.rotation.y = 0;
    ring.position.set(0.32, leafH * 0.55, D / 2 + 0.05);
    handleGroup.add(ring);
    const latch = box(0.06, 0.38, 0.06, MAT.darkSteel, 0.16, leafH * 0.55, D / 2);
    handleGroup.add(latch);
    g.add(handleGroup);

    /* Если конструкция должна поворачиваться на 90° (для В/З выходов), делаем это внешним образом */
    return g;
  }

  function makeRoomProps(type, ox, oz, w, h) {
    const g = new T.Group();
    const rw = w || 8, rh = h || 8;
    const cx = ox + 1 + rw / 2, cz = oz + 1 + rh / 2;   // центр комнаты
    const AX = rw * 0.3;                      // разброс по длинной стороне
    const AZ = rh * 0.28;                     // разброс по короткой стороне

    function at(sx, sz) { return [cx + sx * AX, cz + sz * AZ]; }

    /* Стойка с оружием — Оружейная. */
    function weaponRack(sx, sz) {
      const p = at(sx, sz);
      g.add(box(0.16, 1.5, 0.16, MAT.darkWood, p[0], 0.75, p[1] - 0.45));
      g.add(box(0.16, 1.5, 0.16, MAT.darkWood, p[0], 0.75, p[1] + 0.45));
      g.add(box(0.14, 0.12, 1.2, MAT.wood, p[0], 1.42, p[1]));
      g.add(box(0.1, 0.1, 1.1, MAT.darkWood, p[0], 0.24, p[1]));
      /* три меча на стойке */
      for (let i = 0; i < 3; i++) {
        const z = p[1] - 0.34 + i * 0.34;
        g.add(box(0.05, 0.85, 0.05, MAT.steel, p[0], 1.05, z));
        g.add(box(0.06, 0.07, 0.24, MAT.gold, p[0], 0.64, z));
      }
      /* щит на стойке */
      g.add(cyl(0.26, 0.26, 0.06, MAT.steel, p[0] - 0.14, 0.66, p[1], 10));
      g.add(cyl(0.09, 0.09, 0.08, MAT.gold, p[0] - 0.14, 0.66, p[1], 8));
    }

    /* Стеллаж с книгами — Библиотека. */
    function bookshelf(sx, sz) {
      const p = at(sx, sz);
      g.add(box(0.24, 1.7, 1.3, MAT.darkWood, p[0], 0.85, p[1]));
      const cols = [0x8f2f2a, 0x3e5f86, 0x4f7a4a, 0xa8842c, 0x6c4a8f];
      for (let row = 0; row < 3; row++) {
        const y = 0.35 + row * 0.5;
        g.add(box(0.3, 0.06, 1.24, MAT.wood, p[0], y, p[1]));
        for (let i = 0; i < 5; i++) {
          const m = new T.MeshLambertMaterial({ color: cols[(i + row) % cols.length] });
          g.add(box(0.2, 0.3 + (i % 2) * 0.06, 0.16, m, p[0], y + 0.2, p[1] - 0.5 + i * 0.25));
        }
      }
    }

    /* Горн с огнём — Кузница. */
    function forge(sx, sz) {
      const p = at(sx, sz);
      g.add(box(0.9, 0.8, 0.9, MAT.darkSteel, p[0], 0.4, p[1]));
      g.add(box(0.7, 0.34, 0.06, MAT.black, p[0], 0.42, p[1] + 0.46));
      g.add(box(0.5, 0.22, 0.04, MAT.flame, p[0], 0.44, p[1] + 0.44));
      g.add(box(0.3, 0.14, 0.03, MAT.flameCore, p[0], 0.46, p[1] + 0.42));
      g.add(box(0.34, 0.9, 0.34, MAT.darkSteel, p[0] - 0.2, 1.2, p[1] - 0.2));
      /* наковальня */
      g.add(box(0.5, 0.16, 0.22, MAT.darkSteel, p[0] + 0.9, 0.42, p[1]));
      g.add(cone(0.11, 0.3, MAT.darkSteel, p[0] + 1.2, 0.42, p[1], 6));
      g.add(box(0.26, 0.3, 0.24, MAT.wood, p[0] + 0.9, 0.2, p[1]));
    }

    /* Кровать — Казарма. */
    function bed(sx, sz) {
      const p = at(sx, sz);
      g.add(box(0.9, 0.16, 1.9, MAT.darkWood, p[0], 0.32, p[1]));
      g.add(box(0.86, 0.16, 1.82, MAT.green, p[0], 0.46, p[1]));
      g.add(box(0.7, 0.16, 0.42, MAT.bone, p[0], 0.56, p[1] - 0.66));
      g.add(box(0.1, 0.7, 1.9, MAT.darkWood, p[0] - 0.42, 0.5, p[1]));
    }

    /* Сундук с золотом — Сокровищница. */
    function treasure(sx, sz) {
      const p = at(sx, sz);
      g.add(box(0.7, 0.44, 0.5, MAT.darkWood, p[0], 0.22, p[1]));
      g.add(box(0.74, 0.1, 0.54, MAT.gold, p[0], 0.46, p[1]));
      g.add(box(0.16, 0.5, 0.54, MAT.gold, p[0], 0.25, p[1]));
      /* куча монет */
      for (let i = 0; i < 6; i++) {
        const a = i * 1.05;
        g.add(cyl(0.09, 0.09, 0.03, MAT.gold, p[0] + 0.5 + Math.cos(a) * 0.2, 0.02 + (i % 3) * 0.03, p[1] + Math.sin(a) * 0.2, 8));
      }
    }

    /* Клетка — Клетки-ловушки. */
    function cage(sx, sz) {
      const p = at(sx, sz);
      g.add(box(0.9, 0.08, 0.9, MAT.darkSteel, p[0], 0.04, p[1]));
      for (let i = 0; i < 5; i++) {
        const t = -0.4 + i * 0.2;
        g.add(box(0.05, 1.1, 0.05, MAT.steel, p[0] + t, 0.55, p[1] - 0.42));
        g.add(box(0.05, 1.1, 0.05, MAT.steel, p[0] + t, 0.55, p[1] + 0.42));
        g.add(box(0.05, 0.05, 0.9, MAT.steel, p[0] - 0.42, 0.55, p[1] + t));
        g.add(box(0.05, 0.05, 0.9, MAT.steel, p[0] + 0.42, 0.55, p[1] + t));
      }
      g.add(box(0.95, 0.08, 0.95, MAT.darkSteel, p[0], 1.12, p[1]));
    }

    /* Алтарь с кристаллом — Алтарь Алгоримума. */
    function altar(sx, sz) {
      const p = at(sx, sz);
      g.add(box(0.8, 0.8, 0.8, MAT.darkWood, p[0], 0.4, p[1]));
      g.add(box(0.94, 0.12, 0.94, MAT.purple, p[0], 0.86, p[1]));
      const cr = new T.Mesh(new T.OctahedronGeometry(0.28), MAT.glowPurple);
      cr.position.set(p[0], 1.16, p[1]);
      g.add(cr);
      /* свечи */
      for (let i = 0; i < 2; i++) {
        const z = p[1] + (i ? 0.3 : -0.3);
        g.add(cyl(0.06, 0.06, 0.3, MAT.bone, p[0] + 0.52, 0.95, z, 6));
        g.add(cone(0.04, 0.12, MAT.flame, p[0] + 0.52, 1.16, z, 5));
      }
    }

    /* Колонна — Арена. */
    function pillar(sx, sz) {
      const p = at(sx, sz);
      /* Каменная колонна с кирпичной текстурой — не «белый столб». */
      g.add(cyl(0.26, 0.3, 1.7, wallMat('wall_castle'), p[0], 0.85, p[1], 10));
      g.add(box(0.7, 0.12, 0.7, MAT.stoneDark, p[0], 0.06, p[1]));
      g.add(box(0.66, 0.12, 0.66, MAT.stoneDark, p[0], 1.72, p[1]));
    }

    /* Трон — Тронный зал. */
    function throne(sx, sz) {
      const p = at(sx, sz);
      g.add(box(0.9, 0.24, 0.9, MAT.darkSteel, p[0], 0.12, p[1]));
      g.add(box(0.8, 1.0, 0.2, MAT.red, p[0], 0.7, p[1] - 0.36));
      g.add(box(0.22, 0.5, 0.86, MAT.darkSteel, p[0] - 0.34, 0.45, p[1]));
      g.add(box(0.22, 0.5, 0.86, MAT.darkSteel, p[0] + 0.34, 0.45, p[1]));
      /* зубцы короны трона */
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        g.add(cone(0.05, 0.22, MAT.gold, p[0] + Math.cos(a) * 0.3, 1.35, p[1] - 0.36 + Math.sin(a) * 0.16, 4));
      }
    }

    /* Знамя — Тронный зал / Вход. */
    function banner(sx, sz, col) {
      const p = at(sx, sz);
      g.add(box(0.5, 1.1, 0.04, col, p[0], 1.5, p[1]));
      g.add(box(0.56, 0.07, 0.06, MAT.gold, p[0], 2.06, p[1]));
      g.add(box(0.06, 1.2, 0.06, MAT.darkWood, p[0] - 0.32, 1.5, p[1]));
    }

    switch (type) {
      case 'armory':
        weaponRack(-1, -1); weaponRack(1, -1);
        g.add(cyl(0.34, 0.34, 0.07, MAT.steel, cx + AX, 1.0, cz - AZ, 12));
        g.add(cyl(0.1, 0.1, 0.09, MAT.gold, cx + AX, 1.0, cz - AZ, 8));
        break;
      case 'library':
        bookshelf(-1, -1); bookshelf(1, -1);
        /* стол со свитком */
        g.add(box(1.0, 0.1, 0.6, MAT.wood, cx - AX, 0.78, cz + AZ));
        g.add(box(0.12, 0.74, 0.12, MAT.darkWood, cx - AX - 0.4, 0.39, cz + AZ));
        g.add(box(0.12, 0.74, 0.12, MAT.darkWood, cx - AX + 0.4, 0.39, cz + AZ));
        g.add(cyl(0.09, 0.09, 0.5, MAT.bone, cx - AX, 0.83, cz + AZ, 8));
        break;
      case 'forge':
        forge(-1, -1);
        g.add(cyl(0.4, 0.44, 0.7, MAT.darkSteel, cx + AX, 0.35, cz + AZ, 10));
        g.add(cone(0.42, 0.5, MAT.rustDark, cx + AX, 0.95, cz + AZ, 10));
        break;
      case 'barrack':
        bed(-1, -1); bed(1, 1);
        g.add(box(0.7, 0.5, 0.5, MAT.wood, cx + AX, 0.25, cz - AZ));
        g.add(box(0.74, 0.08, 0.54, MAT.darkSteel, cx + AX, 0.52, cz - AZ));
        break;
      case 'chest':
        treasure(-1, -1); treasure(1, 1);
        g.add(box(0.6, 0.36, 0.44, MAT.darkWood, cx + AX, 0.18, cz - AZ));
        g.add(box(0.64, 0.09, 0.48, MAT.gold, cx + AX, 0.38, cz - AZ));
        break;
      case 'trap':
        cage(-1, -1);
        g.add(box(0.7, 0.08, 0.7, MAT.darkSteel, cx + AX, 0.04, cz + AZ));
        for (let i = 0; i < 4; i++) {
          const a = i * 1.57;
          g.add(box(0.06, 0.24, 0.5, MAT.steel, cx + AX + Math.cos(a) * 0.22, 0.14, cz + AZ + Math.sin(a) * 0.22));
        }
        break;
      case 'altar':
        altar(-1, -1);
        g.add(box(0.5, 0.5, 0.5, MAT.purple, cx + AX, 0.25, cz + AZ));
        const glow = new T.Mesh(new T.OctahedronGeometry(0.16), MAT.glowBlue);
        glow.position.set(cx + AX, 0.66, cz + AZ);
        g.add(glow);
        break;
      case 'arena':
        pillar(-1, -1); pillar(1, -1); pillar(-1, 1); pillar(1, 1);
        break;
      case 'vault':      // Тайник — сундук со свитками в нише
        g.add(box(0.8, 0.55, 0.6, MAT.darkWood, cx - AX, 0.28, cz - AZ));
        g.add(box(0.84, 0.1, 0.64, MAT.darkSteel, cx - AX, 0.58, cz - AZ));
        for (let i = 0; i < 4; i++) {
          g.add(cyl(0.06, 0.06, 0.34, MAT.bone, cx + AX - 0.2 + i * 0.14, 0.62, cz + AZ, 6));
        }
        break;
      case 'boss':
        throne(0, -1);
        banner(-1, 1, MAT.red); banner(1, 1, MAT.red);
        break;
      default:  // Вход в подземелье
        banner(-1, -1, MAT.steel); banner(1, -1, MAT.steel);
        /* ворота */
        g.add(box(0.4, 2.0, 0.4, MAT.darkSteel, cx - 1.3, 1.0, cz + AZ));
        g.add(box(0.4, 2.0, 0.4, MAT.darkSteel, cx + 1.3, 1.0, cz + AZ));
        g.add(box(3.0, 0.4, 0.4, MAT.darkSteel, cx, 2.1, cz + AZ));
        break;
    }
    return g;
  }

  function buildWorld(scene, dungeon) {
    const root = new T.Group();
    root.name = 'dungeon';
    scene.add(root);

    // Пол и потолок
    const mapW = dungeon.sizeX || dungeon.size;
    const mapH = dungeon.sizeZ || dungeon.size;
    const floor = new T.Mesh(
      new T.PlaneGeometry(mapW, mapH),
      new T.MeshLambertMaterial({ map: floorTex, color: 0xffffff })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(mapW / 2, 0, mapH / 2);
    root.add(floor);

    const ceil = new T.Mesh(
      new T.PlaneGeometry(mapW, mapH),
      new T.MeshLambertMaterial({ map: ceilTex, color: 0xffffff })
    );
    ceil.rotation.x = Math.PI / 2;
    ceil.position.set(mapW / 2, WALL_H, mapH / 2);
    root.add(ceil);

    // Стены: собираем InstancedMesh по типу текстуры — меньше draw calls.
    const byType = {};
    for (let z = 0; z < mapH; z++) {
      for (let x = 0; x < mapW; x++) {
        if (dungeon.tiles[z * mapW + x] === 0) continue;
        const type = dungeon.wallTex[z][x] || 'wall_castle';
        if (!byType[type]) byType[type] = [];
        // Внешнюю границу тоже рисуем: лабиринт может дойти до края карты.
        byType[type].push([x + 0.5, z + 0.5]);
      }
    }
    const wallGeo = new T.BoxGeometry(1, WALL_H, 1);
    const walls = [];
    Object.keys(byType).forEach(function (type) {
      const arr = byType[type];
      const inst = new T.InstancedMesh(wallGeo, wallMat(type), arr.length);
      const m = new T.Matrix4();
      for (let i = 0; i < arr.length; i++) {
        m.makeTranslation(arr[i][0], WALL_H / 2, arr[i][1]);
        inst.setMatrixAt(i, m);
      }
      inst.instanceMatrix.needsUpdate = true;
      root.add(inst);
      walls.push(inst);
    });

       // Тонкая рамка комнаты + цветной медальон: акцент карты Местности,
    // не закрывающий каменный пол.
    const roomRugs = [];
    const rugColors = {
      start: 0x6b5c4a, armory: 0x7a5a36, library: 0x4b4a6e, forge: 0x7a3d2c,
      barrack: 0x4a5c3a, chest: 0x7a642c, trap: 0x4a4242, altar: 0x4a3a6b,
      arena: 0x6b3232, boss: 0x5c2f2f, vault: 0x4a3a6b
    };
    for (let i = 0; i < dungeon.rooms.length; i++) {
      const r = dungeon.rooms[i];
      const c = rugColors[r.type] || 0x554a40;
      const bx = r.x + r.w / 2, bz = r.z + r.h / 2;
      const bw = r.w - 2.6, bh = r.h - 2.6;

      // Пол комнаты — своя текстура по названию (дощатый, ковёр, песок…).
      const rfloor = new T.Mesh(
        new T.PlaneGeometry(r.w, r.h),
        new T.MeshLambertMaterial({ map: roomFloorTex(r.type) })
      );
      rfloor.rotation.x = -Math.PI / 2;
      rfloor.position.set(bx, 0.008, bz);
      root.add(rfloor);

      // Содержимое комнаты по её названию: стойки, полки, горн, клетки, трон.
      const props = makeRoomProps(r.type, r.ox, r.oz, r.w, r.h);
      if (props) root.add(props);

      const lineMat = new T.MeshBasicMaterial({
        color: 0xcaa35a, transparent: true, opacity: 0.34, side: T.DoubleSide
      });
      const t = 0.07;
      const parts = [
        [bw, t, 0, -bh / 2],
        [bw, t, 0, bh / 2],
        [t, bh, -bw / 2, 0],
        [t, bh, bw / 2, 0]
      ];
      for (let k = 0; k < parts.length; k++) {
        const pp = parts[k];
        const line = new T.Mesh(new T.PlaneGeometry(pp[0], pp[1]), lineMat);
        line.rotation.x = -Math.PI / 2;
        line.position.set(bx + pp[2], 0.018, bz + pp[3]);
        root.add(line);
      }
      const medallion = new T.Mesh(
        new T.CircleGeometry(0.62, 24),
        new T.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.4 })
      );
      medallion.rotation.x = -Math.PI / 2;
      medallion.position.set(bx, 0.014, bz);
      root.add(medallion);
      roomRugs.push(medallion);
    }

    // Факелы
    for (let i = 0; i < dungeon.torches.length; i++) {
      const td = dungeon.torches[i];
      const torch = makeTorch();
      torch.position.set(td.x, 0, td.y);
      torch.userData.phase = td.phase;
      root.add(torch);
    }

    return { root: root, walls: walls, rugs: roomRugs };
  }

  /* ------------------------------------------------------------------ */
  /*  ФАКЕЛ                                                             */
  /* ------------------------------------------------------------------ */
  function makeTorch() {
    const g = new T.Group();
    g.add(box(0.12, 0.5, 0.12, MAT.darkWood, 0, 1.0, 0));
    g.add(box(0.24, 0.08, 0.24, MAT.steel, 0, 1.24, 0));
    const flame = cone(0.1, 0.3, MAT.flame, 0, 1.42, 0, 6);
    flame.userData.flame = true;
    g.add(flame);
    const core = cone(0.05, 0.16, MAT.flameCore, 0, 1.38, 0, 5);
    g.add(core);
    const glow = new T.Sprite(new T.SpriteMaterial({
      color: 0xffa64a, transparent: true, opacity: 0.45, depthWrite: false,
      map: glowTexture()
    }));
    glow.scale.set(1.1, 1.1, 1);
    glow.position.y = 1.42;
    g.add(glow);
    // держатель
    g.add(box(0.08, 0.08, 0.18, MAT.steel, 0, 1.0, 0.08));
    return g;
  }

  let _glowTex = null;
  function glowTexture() {
    if (_glowTex) return _glowTex;
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const g = c.getContext('2d');
    const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grd.addColorStop(0, 'rgba(255,220,150,1)');
    grd.addColorStop(0.35, 'rgba(255,160,60,.65)');
    grd.addColorStop(1, 'rgba(255,120,30,0)');
    g.fillStyle = grd; g.fillRect(0, 0, 64, 64);
    _glowTex = new T.CanvasTexture(c);
    return _glowTex;
  }

  /* ------------------------------------------------------------------ */
  /*  ПАРОБОТ                                                           */
  /* ------------------------------------------------------------------ */
  function makeLabelSprite(text, bgColor, fgColor) {
    const c = document.createElement('canvas');
    c.width = 256; c.height = 64;
    const g = c.getContext('2d');
    g.clearRect(0, 0, 256, 64);
    g.fillStyle = bgColor || 'rgba(24,18,14,.82)';
    roundRect(g, 2, 6, 252, 52, 12);
    g.fill();
    g.strokeStyle = '#d8a33f'; g.lineWidth = 3;
    roundRect(g, 2, 6, 252, 52, 12);
    g.stroke();
    g.fillStyle = fgColor || '#f2e3bf';
    g.font = 'bold 22px Georgia, serif';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(text, 128, 33);
    const tex = new T.CanvasTexture(c);
    tex.encoding = T.sRGBEncoding;
    const spr = new T.Sprite(new T.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
    spr.scale.set(1.5, 0.375, 1);
    return spr;
  }

  function roundRect(g, x, y, w, h, r) {
    g.beginPath();
    g.moveTo(x + r, y);
    g.arcTo(x + w, y, x + w, y + h, r);
    g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r);
    g.arcTo(x, y, x + w, y, r);
    g.closePath();
  }

  function makeBot(type) {
    const def = KVP.BOTS[type];
    const g = new T.Group();
    const s = (def.scale || 1) * 0.66;
    const body = new T.Group();
    body.scale.setScalar(s);
    g.add(body);

    const isArmored = type === 'armored';
    const isSpear = type === 'spearman';
    const isGiant = type === 'giant' || type === 'titan' || type === 'titan2';
    /* Палитра по референсам големов: ноги/стопы — песчаный камень у всех,
       грудь — яркий акцент своего цвета, голова — светлый камень. */
    const P = isArmored
      ? { chest: 0xc0b8b8, dark: 0x8f8282, trim: 0xa05020, head: 0xd8d0d0, eye: 0xff8a4a }
      : isSpear
      ? { chest: 0x30b030, dark: 0x207020, trim: 0xd05000, head: 0xb0c0c0, eye: 0x8dffb0 }
      : isGiant
      ? { chest: 0x96513a, dark: 0x6f362a, trim: 0xd8a33f, head: 0xc8b8a0, eye: 0xffd36a }
      : { chest: 0xf06000, dark: 0xa04000, trim: 0x201000, head: 0xe0c8a8, eye: 0xffd36a };
    const chestMat = new T.MeshLambertMaterial({ color: P.chest });
    const darkMat = new T.MeshLambertMaterial({ color: P.dark });
    const trimMat = new T.MeshLambertMaterial({ color: P.trim });
    const headMat = new T.MeshLambertMaterial({ color: P.head });
    const eyeMat = new T.MeshBasicMaterial({ color: P.eye });
    const jointMat = new T.MeshLambertMaterial({ color: 0x201000 });
    const bodyMat = chestMat;
    const bodyDark = darkMat;

    // Ноги — песчаный камень (как у големов на референсах)
    const legL = box(0.17, 0.36, 0.17, MAT.sand, -0.15, 0.18, 0);
    const legR = box(0.17, 0.36, 0.17, MAT.sand, 0.15, 0.18, 0);
    body.add(legL, legR);
    body.add(box(0.21, 0.06, 0.27, MAT.sandDark, -0.15, 0.03, 0.03));
    body.add(box(0.21, 0.06, 0.27, MAT.sandDark, 0.15, 0.03, 0.03));

    // Корпус-печь — яркий акцент (оранжевый/зелёный/стальной)
    const torso = box(0.58, 0.58, 0.44, chestMat, 0, 0.62, 0);
    body.add(torso);
    body.add(box(0.62, 0.08, 0.48, darkMat, 0, 0.9, 0));
    // тёмный пояс
    body.add(box(0.6, 0.1, 0.46, jointMat, 0, 0.36, 0));
    // топка
    const grate = box(0.38, 0.26, 0.03, MAT.black, 0, 0.58, 0.235);
    body.add(grate);
    body.add(box(0.3, 0.04, 0.02, MAT.glowOrange, 0, 0.64, 0.25));
    body.add(box(0.3, 0.04, 0.02, MAT.glowOrange, 0, 0.57, 0.25));
    body.add(box(0.3, 0.04, 0.02, MAT.glowOrange, 0, 0.50, 0.25));
    const fire = box(0.12, 0.13, 0.02, MAT.glowYellow, 0, 0.57, 0.255);
    body.add(fire);

    // Голова — светлый камень с акцентной гривой
    const headY = 1.1;
    body.add(box(0.42, 0.3, 0.34, headMat, 0, headY, 0));
    // грива/гребень цвета акцента
    body.add(box(0.44, 0.08, 0.36, chestMat, 0, headY + 0.19, 0));
    body.add(box(0.34, 0.1, 0.05, MAT.black, 0, headY + 0.02, 0.175));
    const eyeL = box(0.07, 0.05, 0.03, eyeMat, -0.08, headY + 0.03, 0.205);
    const eyeR = box(0.07, 0.05, 0.03, eyeMat, 0.08, headY + 0.03, 0.205);
    body.add(eyeL, eyeR);

    // Труба
    body.add(box(0.12, 0.32, 0.12, MAT.darkSteel, 0.16, 1.32, -0.08));
    body.add(box(0.2, 0.06, 0.2, MAT.darkSteel, 0.16, 1.49, -0.08));

    // Руки — каменные, цвета акцента, с тёмными кулаками
    const armL = new T.Group();
    armL.position.set(-0.34, 0.84, 0);
    const upperL = box(0.13, 0.36, 0.13, chestMat, 0, -0.16, 0);
    armL.add(upperL);
    armL.add(sphere(0.09, jointMat, 0, -0.36, 0, 6));
    body.add(armL);
    const armR = new T.Group();
    armR.position.set(0.34, 0.84, 0);
    armR.add(box(0.13, 0.36, 0.13, chestMat, 0, -0.16, 0));
    armR.add(sphere(0.09, jointMat, 0, -0.36, 0, 6));
    body.add(armR);

    // Варианты
    if (isArmored) {
      // наплечники и шлем
      body.add(box(0.26, 0.14, 0.38, MAT.steel, -0.3, 0.86, 0));
      body.add(box(0.26, 0.14, 0.38, MAT.steel, 0.3, 0.86, 0));
      body.add(box(0.46, 0.1, 0.38, MAT.steel, 0, headY + 0.2, 0));
      body.add(cone(0.12, 0.18, trimMat, 0, headY + 0.34, 0, 4));
      // щит с ¬
      const shield = new T.Group();
      shield.position.set(-0.44, 0.66, 0.18);
      shield.rotation.y = 0.35;
      const sh = box(0.34, 0.4, 0.05, trimMat, 0, 0, 0);
      shield.add(sh);
      shield.add(box(0.28, 0.32, 0.06, chestMat, 0, 0, 0.01));
      const label = new T.Sprite(new T.SpriteMaterial({ map: textTexture('¬', '#f2e3bf'), transparent: true, depthWrite: false }));
      label.scale.set(0.24, 0.24, 1);
      label.position.set(0, 0, 0.06);
      shield.add(label);
      body.add(shield);
      body.add(box(0.1, 0.5, 0.02, MAT.darkSteel, 0, 0.62, -0.22));
    }
    if (isSpear) {
      // копьё
      const spear = new T.Group();
      spear.position.set(0.48, 0.5, 0.1);
      spear.rotation.z = -0.08;
      spear.add(cyl(0.025, 0.025, 1.5, MAT.wood, 0, 0.35, 0, 6));
      spear.add(cone(0.07, 0.22, trimMat, 0, 1.2, 0, 6));
      spear.add(box(0.14, 0.04, 0.04, chestMat, 0, 1.05, 0));
      body.add(spear);
      // капюшон
      body.add(cone(0.26, 0.3, chestMat, 0, headY + 0.22, 0, 6));
    }
    if (isGiant) {
      /* === ВЫРАЗИТЕЛЬНЫЙ БОСС-ОБЛИК ГИГАНТА ===
         Широкие наплечники с шипами, огромные изогнутые рога, крупная корона,
         раскалённое ядро-топка на груди, гребень шипов на спине,
         шипастые кулаки и плащ — явный босс, а не увеличенный моб. */

      // Броневые пластины на груди (объём + «железо»)
      body.add(box(0.5, 0.16, 0.06, trimMat, 0, 0.82, 0.23));
      body.add(box(0.54, 0.1, 0.06, darkMat, 0, 0.44, 0.23));

      // Широкие наплечники
      body.add(box(0.32, 0.2, 0.46, darkMat, -0.4, 0.94, 0));
      body.add(box(0.32, 0.2, 0.46, darkMat, 0.4, 0.94, 0));
      body.add(box(0.34, 0.06, 0.48, trimMat, -0.4, 1.05, 0));
      body.add(box(0.34, 0.06, 0.48, trimMat, 0.4, 1.05, 0));
      // шипы на наплечниках
      body.add(cone(0.06, 0.22, MAT.gold, -0.44, 1.16, 0.14, 5));
      body.add(cone(0.06, 0.22, MAT.gold, -0.44, 1.16, -0.14, 5));
      body.add(cone(0.06, 0.22, MAT.gold, 0.44, 1.16, 0.14, 5));
      body.add(cone(0.06, 0.22, MAT.gold, 0.44, 1.16, -0.14, 5));

      // Огромные изогнутые рога (2 сегмента на сторону — загиб вверх)
      function bossHorn(sx) {
        const h = new T.Group();
        h.position.set(sx * 0.22, headY + 0.1, 0);
        const s1 = cone(0.08, 0.3, MAT.bone, sx * 0.07, 0.14, 0, 6);
        s1.rotation.z = -sx * 0.55;
        h.add(s1);
        const s2 = cone(0.055, 0.26, MAT.bone, sx * 0.2, 0.34, 0, 6);
        s2.rotation.z = -sx * 1.05;
        h.add(s2);
        return h;
      }
      body.add(bossHorn(-1));
      body.add(bossHorn(1));

      // Крупная золотая корона
      const crown = new T.Group();
      crown.position.set(0, headY + 0.36, 0);
      crown.add(cyl(0.23, 0.25, 0.13, MAT.gold, 0, 0, 0, 8));
      for (let i = 0; i < 7; i++) {
        const a = (i / 7) * Math.PI * 2;
        crown.add(cone(0.05, 0.2, MAT.gold, Math.cos(a) * 0.19, 0.14, Math.sin(a) * 0.19, 4));
      }
      body.add(crown);

      // Раскалённое ядро-топка на груди (крупный светящийся «реактор»)
      body.add(box(0.34, 0.34, 0.04, MAT.glowOrange, 0, 0.64, 0.245));
      body.add(box(0.2, 0.2, 0.03, MAT.glowYellow, 0, 0.64, 0.265));
      // свечение-кант вокруг ядра
      body.add(box(0.4, 0.03, 0.02, MAT.glowYellow, 0, 0.83, 0.25));
      body.add(box(0.4, 0.03, 0.02, MAT.glowYellow, 0, 0.45, 0.25));

      // Гребень шипов на спине
      for (let i = 0; i < 3; i++) {
        body.add(cone(0.055, 0.2 - i * 0.04, trimMat, 0, 0.56 + i * 0.2, -0.27, 5));
      }

      // Шипастые кулаки-гаунты
      body.add(sphere(0.17, darkMat, -0.4, 0.4, 0, 6));
      body.add(sphere(0.17, darkMat, 0.4, 0.4, 0, 6));
      body.add(cone(0.045, 0.14, MAT.gold, -0.4, 0.4, 0.18, 5));
      body.add(cone(0.045, 0.14, MAT.gold, 0.4, 0.4, 0.18, 5));
      body.add(cone(0.045, 0.12, MAT.gold, -0.4, 0.55, 0, 5));
      body.add(cone(0.045, 0.12, MAT.gold, 0.4, 0.55, 0, 5));

      // Плащ сзади
      body.add(box(0.64, 0.78, 0.02, new T.MeshLambertMaterial({ color: 0x5e1f1b }), 0, 0.6, -0.31));
    }

    // Индикатор брони и условия над головой
    const short = def.conditionShort.replace('🚫', 'НЕ ');
    const label = makeLabelSprite('🛡' + def.armor + '  ' + short, 'rgba(22,16,12,.86)', '#f2e3bf');
    label.position.y = (isGiant ? 1.74 : 1.22);
    label.scale.set(isGiant ? 0.96 : 0.74, isGiant ? 0.24 : 0.185, 1);
    g.add(label);

    g.userData = {
      type: 'bot', botType: type, body: body, legL: legL, legR: legR,
      armL: armL, armR: armR, eyeL: eyeL, eyeR: eyeR, fire: fire, label: label,
      baseY: 0, phase: Math.random() * 6.28
    };
    return g;
  }

  /* ------------------------------------------------------------------ */
  /*  РЫЦАРИ (своя команда и соперники-враги)                            */
  /* ------------------------------------------------------------------ */
  /**
   * Low-poly Рыцарь. type — swordsman|maceman|archer|cook|mag.
   * opts.foe — соперник: багрово-чёрный силуэт со светящимися глазами.
   * Свои Рыцари носят цвет ордена (табард, щит, плюмаж) — сразу видно,
   * кто «наш», а кто враг.
   */
  function makeKnight(type, opts) {
    opts = opts || {};
    const def = KVP.KNIGHTS[type] || KVP.KNIGHTS.swordsman;
    const foe = !!opts.foe;
    const g = new T.Group();
    const body = new T.Group();
    body.scale.setScalar(opts.scale || 0.66);
    g.add(body);

    const orderColor = new T.Color(def.color || '#8d9aa3');
    const tint = new T.MeshLambertMaterial({ color: orderColor });
    // Враг — багровый: сразу читается как «не наш».
    const plate = new T.MeshLambertMaterial({ color: foe ? 0x8a3026 : 0x9aa7b0 });
    const dark = new T.MeshLambertMaterial({ color: foe ? 0x3a1a18 : 0x454d55 });
    const cloth = foe ? new T.MeshLambertMaterial({ color: 0xb03a2c }) : tint;
    const skin = new T.MeshLambertMaterial({ color: foe ? 0x2a1614 : 0xd8b48c });

    // Ноги
    body.add(box(0.17, 0.4, 0.17, dark, -0.13, 0.2, 0));
    body.add(box(0.17, 0.4, 0.17, dark, 0.13, 0.2, 0));
    body.add(box(0.2, 0.07, 0.28, MAT.black, -0.13, 0.035, 0.04));
    body.add(box(0.2, 0.07, 0.28, MAT.black, 0.13, 0.035, 0.04));

    // Торс и табард цвета ордена (у врага — багровый)
    body.add(box(0.52, 0.56, 0.32, plate, 0, 0.68, 0));
    body.add(box(0.56, 0.5, 0.06, cloth, 0, 0.68, 0.175));
    // гербовая эмблема
    const crest = new T.Sprite(new T.SpriteMaterial({
      map: textTexture(def.icon && def.icon.length <= 2 ? def.icon : '⚜', foe ? '#ffd9cf' : '#fff3d0'),
      transparent: true, depthWrite: false
    }));
    crest.scale.set(0.24, 0.24, 1);
    crest.position.set(0, 0.72, 0.22);
    body.add(crest);

    // Плечи
    body.add(box(0.2, 0.14, 0.32, plate, -0.3, 0.9, 0));
    body.add(box(0.2, 0.14, 0.32, plate, 0.3, 0.9, 0));

    // Голова и шлем
    const headY = 1.1;
    body.add(box(0.3, 0.28, 0.3, skin, 0, headY, 0));
    body.add(box(0.34, 0.2, 0.34, plate, 0, headY + 0.12, 0));          // шлем
    body.add(box(0.05, 0.16, 0.34, plate, 0, headY + 0.02, 0));         // забрало
    const eyeMat = foe ? MAT.glowOrange : MAT.glowYellow;
    const eyeL = box(0.05, 0.05, 0.03, eyeMat, -0.07, headY + 0.03, 0.16);
    const eyeR = box(0.05, 0.05, 0.03, eyeMat, 0.07, headY + 0.03, 0.16);
    body.add(eyeL, eyeR);

    // Плюмаж на шлеме — цвет ордена виден издалека
    const plume = box(0.07, 0.26, 0.16, cloth, 0, headY + 0.33, -0.04);
    body.add(plume);

    // Руки
    body.add(box(0.12, 0.4, 0.12, dark, -0.33, 0.66, 0));
    body.add(box(0.12, 0.4, 0.12, dark, 0.33, 0.66, 0));

    // Оружие по типу рыцаря
    const armR = new T.Group();
    armR.position.set(0.33, 0.85, 0.12);
    if (type === 'archer') {
      armR.add(box(0.08, 0.08, 0.5, MAT.darkWood, 0, 0, 0.1));
      armR.add(box(0.5, 0.05, 0.06, MAT.wood, 0, 0.02, 0.22));
      armR.add(box(0.05, 0.05, 0.3, MAT.steel, 0, 0, -0.06));
    } else if (type === 'maceman') {
      armR.add(cyl(0.03, 0.03, 0.5, MAT.wood, 0, -0.18, 0, 6));
      armR.add(sphere(0.1, MAT.darkSteel, 0, -0.42, 0, 7));
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        armR.add(cone(0.03, 0.1, MAT.steel, Math.cos(a) * 0.1, -0.42 + Math.sin(a) * 0.1, 0, 4));
      }
    } else if (type === 'cook') {
      armR.add(cyl(0.025, 0.025, 0.55, MAT.wood, 0, -0.2, 0, 6));
      armR.add(sphere(0.08, MAT.steel, 0, -0.5, 0, 7));
    } else if (type === 'mag') {
      armR.add(cyl(0.025, 0.03, 1.1, MAT.darkWood, 0, -0.05, 0, 6));
      armR.add(sphere(0.09, MAT.glowPurple, 0, 0.5, 0, 8));
    } else {
      armR.add(box(0.06, 0.5, 0.06, MAT.steel, 0, -0.22, 0));
      armR.add(box(0.2, 0.05, 0.07, MAT.gold, 0, -0.02, 0));       // гарда
      armR.add(cone(0.05, 0.12, MAT.steel, 0, 0.08, 0, 4));        // острие
    }
    body.add(armR);

    // Щит на левой руке — у своих цвет ордена, у врага багровый крест
    const shield = new T.Group();
    shield.position.set(-0.38, 0.68, 0.14);
    shield.add(box(0.34, 0.42, 0.05, new T.MeshLambertMaterial({ color: foe ? 0x3a1816 : new T.Color(orderColor).multiplyScalar(0.8) }), 0, 0, 0));
    shield.add(box(0.28, 0.34, 0.06, new T.MeshLambertMaterial({ color: foe ? 0xb83224 : orderColor }), 0, 0, 0.01));
    shield.add(box(0.06, 0.26, 0.07, new T.MeshLambertMaterial({ color: foe ? 0x1a0c0b : 0x111820 }), 0, 0, 0.02));
    body.add(shield);

    // Плащ соперника
    if (foe) {
      body.add(box(0.62, 0.72, 0.06, new T.MeshLambertMaterial({ color: 0x5e1f1b }), 0, 0.72, -0.21));
    }

    const short = foe ? 'ВРАГ' : (def.name || 'Рыцарь').replace('Рыцарь-', '');
    const label = makeLabelSprite((def.icon || '🛡') + ' ' + short,
      foe ? 'rgba(46,10,8,.92)' : 'rgba(22,16,12,.86)',
      foe ? '#ffb3a6' : '#f2e3bf');
    label.position.y = 1.46;
    label.scale.set(0.78, 0.2, 1);
    if (!opts.noLabel) g.add(label);

    g.userData = {
      type: foe ? 'foe' : 'knight', knightType: type, foe: foe,
      body: body, armR: armR, baseY: 0, phase: Math.random() * 6.28
    };
    return g;
  }

  let _textCache = {};
  function textTexture(text, color) {
    const key = text + '|' + color;
    if (_textCache[key]) return _textCache[key];
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const g = c.getContext('2d');
    g.clearRect(0, 0, 64, 64);
    g.fillStyle = color || '#fff';
    g.font = 'bold 44px Georgia, serif';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(text, 32, 34);
    const tex = new T.CanvasTexture(c);
    tex.encoding = T.sRGBEncoding;
    _textCache[key] = tex;
    return tex;
  }

  /* ------------------------------------------------------------------ */
  /*  КАРТЫ-ПРЕДМЕТЫ В МИРЕ                                             */
  /* ------------------------------------------------------------------ */
  const cardTexCache = {};

  function cardTexture(svg) {
    const key = svg.length + ':' + svg.slice(40, 120);
    if (cardTexCache[key]) return cardTexCache[key];
    const tex = new T.Texture();
    // 1×1 заглушка, чтобы не было WebGL-предупреждений о текстуре нулевого размера
    const ph = document.createElement('canvas');
    ph.width = ph.height = 1;
    tex.image = ph;
    tex.encoding = T.sRGBEncoding;
    tex.anisotropy = 4;
    // SVG-карты не являются степенью двойки — мипмапы не нужны
    tex.generateMipmaps = false;
    tex.minFilter = T.LinearFilter;
    tex.needsUpdate = true;
    const img = new Image();
    img.onload = function () {
      tex.image = img;
      tex.needsUpdate = true;
    };
    img.src = KVP.SVG.dataUrl(svg);
    cardTexCache[key] = tex;
    return tex;
  }

  function makeCardPickup(kind, id, opts) {
    opts = opts || {};
    const g = new T.Group();
    // постамент
    const ped = cyl(0.3, 0.36, 0.08, MAT.darkSteel, 0, 0.04, 0, 8);
    g.add(ped);
    const glow = new T.Sprite(new T.SpriteMaterial({
      map: glowTexture(), color: opts.color || 0xffc45a, transparent: true,
      opacity: 0.4, depthWrite: false
    }));
    glow.scale.set(0.9, 0.9, 1);
    glow.position.y = 0.1;
    g.add(glow);

    // карта
    const card = new T.Group();
    card.position.y = 0.62;
    const back = box(0.54, 0.72, 0.035, MAT.gold, 0, 0, 0);
    card.add(back);
    const face = new T.Mesh(
      new T.PlaneGeometry(0.5, 0.66),
      new T.MeshBasicMaterial({ map: cardTexture(opts.svg || KVP.SVG.bot('normal')), transparent: true, side: T.DoubleSide })
    );
    face.position.z = 0.021;
    card.add(face);
    const backFace = new T.Mesh(
      new T.PlaneGeometry(0.5, 0.66),
      new T.MeshLambertMaterial({ color: 0x6b4a2a })
    );
    backFace.rotation.y = Math.PI;
    backFace.position.z = -0.021;
    card.add(backFace);
    g.add(card);

    g.userData = {
      type: 'pickup', kind: kind, itemId: id, card: card, glow: glow,
      baseY: 0.62, phase: Math.random() * 6.28
    };
    return g;
  }

  /* ------------------------------------------------------------------ */
  /*  СУНДУК, КЛЕТКА, ПОРТАЛ                                            */
  /* ------------------------------------------------------------------ */
  function makeChest() {
    const g = new T.Group();
    g.add(box(0.8, 0.4, 0.5, MAT.wood, 0, 0.2, 0));
    g.add(box(0.84, 0.05, 0.54, MAT.gold, 0, 0.41, 0));
    const lid = new T.Group();
    lid.position.set(0, 0.42, -0.25);
    const lidMesh = box(0.8, 0.22, 0.5, MAT.darkWood, 0, 0.11, 0.25);
    lid.add(lidMesh);
    lid.add(box(0.84, 0.05, 0.06, MAT.gold, 0, 0.2, 0.49));
    g.add(lid);
    g.add(box(0.12, 0.14, 0.06, MAT.gold, 0, 0.3, 0.26));
    const glow = new T.Sprite(new T.SpriteMaterial({
      map: glowTexture(), color: 0xffd36a, transparent: true, opacity: 0.5, depthWrite: false
    }));
    glow.scale.set(1, 1, 1);
    glow.position.set(0, 0.35, 0);
    g.add(glow);
    g.userData = { type: 'chest', lid: lid, opened: false, glow: glow };
    g.position.y = 0;
    return g;
  }

  function makeCage() {
    const g = new T.Group();
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const bar = cyl(0.025, 0.025, 0.8, MAT.steel, Math.cos(a) * 0.32, 0.4, Math.sin(a) * 0.32, 5);
      g.add(bar);
    }
    g.add(cyl(0.34, 0.34, 0.05, MAT.darkSteel, 0, 0.8, 0, 12));
    g.add(cyl(0.34, 0.34, 0.05, MAT.darkSteel, 0, 0.02, 0, 12));
    const glow = new T.Sprite(new T.SpriteMaterial({
      map: glowTexture(), color: 0x7ecbff, transparent: true, opacity: 0.35, depthWrite: false
    }));
    glow.scale.set(0.9, 0.9, 1);
    glow.position.y = 0.4;
    g.add(glow);
    g.userData = { type: 'cage', glow: glow };
    return g;
  }

  function makePortal() {
    const g = new T.Group();
    const ring = new T.Mesh(
      new T.TorusGeometry(0.52, 0.07, 8, 24),
      new T.MeshLambertMaterial({ color: 0x4a4550, emissive: 0x1a1030 })
    );
    ring.position.y = 0.9;
    g.add(ring);
    const inner = new T.Mesh(
      new T.CircleGeometry(0.48, 24),
      new T.MeshBasicMaterial({ color: 0x2a1f44, transparent: true, opacity: 0.7, side: T.DoubleSide })
    );
    inner.position.y = 0.9;
    g.add(inner);
    const glow = new T.Sprite(new T.SpriteMaterial({
      map: glowTexture(), color: 0x9a6cff, transparent: true, opacity: 0.25, depthWrite: false
    }));
    glow.scale.set(1.8, 1.8, 1);
    glow.position.y = 0.9;
    g.add(glow);
    // камни-опоры
    g.add(box(0.18, 0.2, 0.18, MAT.darkSteel, -0.62, 0.1, 0));
    g.add(box(0.18, 0.2, 0.18, MAT.darkSteel, 0.62, 0.1, 0));
    g.userData = { type: 'portal', ring: ring, inner: inner, glow: glow, active: false };
    return g;
  }

  /* ------------------------------------------------------------------ */
  /*  СНАРЯД И ЧАСТИЦЫ                                                  */
  /* ------------------------------------------------------------------ */
  function makeProjectile(color) {
    const g = new T.Group();
    const core = sphere(0.09, new T.MeshBasicMaterial({ color: color || 0xff8a2a }), 0, 0, 0, 8);
    g.add(core);
    const glow = new T.Sprite(new T.SpriteMaterial({
      map: glowTexture(), color: color || 0xff8a2a, transparent: true, opacity: 0.8, depthWrite: false
    }));
    glow.scale.set(0.5, 0.5, 1);
    g.add(glow);
    return g;
  }

  const bursts = [];
  /* ------------------------------------------------------------------ */
  /*  ДРАКОН — модель для «Дракон»-спецкарты                             */
  /*                                                                     */
  /*  По правилам Дракон сжигает всю бумагу и забирает одного Персонажа.  */
  /*  Модель показывается в 3D-мире: летит над комнатой и дышит огнём.  */
  /* ------------------------------------------------------------------ */
  function makeDragon() {
    const g = new T.Group();
    const body = new T.Group();
    g.add(body);

    const scale = 0.0001;
    const skin = new T.MeshLambertMaterial({ color: 0x8f2f26 });
    const skinDark = new T.MeshLambertMaterial({ color: 0x5e1d18 });
    const belly = new T.MeshLambertMaterial({ color: 0xc98a3a });
    const wing = new T.MeshLambertMaterial({ color: 0x6d221c });
    const horn = new T.MeshLambertMaterial({ color: 0xe0d0a8 });

    /* Тело — вытянутое, с перехватом хвоста. */
    const torso = sphere(0.42, skin, 0, 0, 0, 10);
    torso.scale.set(1, 0.82, 1.5);
    body.add(torso);
    const neck = sphere(0.2, skin, 0, 0.12, -0.5, 8);
    neck.scale.set(1, 1, 1.3);
    body.add(neck);

    /* Голова с мордой и рогами. */
    const head = sphere(0.19, skin, 0, 0.2, -0.72, 8);
    head.scale.set(1, 0.9, 1.25);
    body.add(head);
    const snout = box(0.16, 0.12, 0.26, skinDark, 0, 0.12, -0.9);
    body.add(snout);
    body.add(cone(0.035, 0.16, horn, -0.08, 0.36, -0.66, 5));
    body.add(cone(0.035, 0.16, horn, 0.08, 0.36, -0.66, 5));
    /* Глаза — светятся. */
    body.add(box(0.05, 0.04, 0.03, MAT.glowOrange, -0.09, 0.25, -0.83));
    body.add(box(0.05, 0.04, 0.03, MAT.glowOrange, 0.09, 0.25, -0.83));

    /* Крылья — расправлены, как у летящего. */
    const wings = new T.Group();
    wings.position.set(0, 0.12, 0.05);
    [-1, 1].forEach(function (side) {
      const w = new T.Group();
      const mem = box(0.62, 0.05, 0.42, wing, side * 0.34, 0, 0.1);
      mem.rotation.z = side * 0.22;
      w.add(mem);
      /* Пальцы крыла. */
      for (let i = 0; i < 3; i++) {
        const f = box(0.34, 0.04, 0.07, wing, side * (0.4 + i * 0.1), -0.03, 0.3 - i * 0.16);
        f.rotation.z = side * 0.5;
        f.rotation.y = side * 0.2;
        w.add(f);
      }
      wings.add(w);
    });
    body.add(wings);

    /* Хвост — длинный, с наконечником. */
    const tail = new T.Group();
    tail.position.set(0, 0.02, 0.55);
    for (let i = 0; i < 4; i++) {
      const seg = box(0.2 - i * 0.04, 0.18 - i * 0.035, 0.24, i % 2 ? skin : skinDark, 0, -i * 0.02, i * 0.24);
      tail.add(seg);
    }
    const tip = cone(0.07, 0.24, belly, 0, -0.06, 0.98, 5);
    tip.rotation.x = Math.PI / 2;
    tail.add(tip);
    body.add(tail);

    /* Лапы. */
    [-1, 1].forEach(function (side) {
      body.add(cyl(0.06, 0.07, 0.2, skinDark, side * 0.22, -0.32, 0.12, 6));
      body.add(box(0.14, 0.07, 0.2, skinDark, side * 0.22, -0.44, 0.16));
    });

    /* Огонь из пасти — конус света. */
    const fire = cone(0.14, 0.55, MAT.flame, 0, 0.08, -1.15, 7);
    fire.rotation.x = -Math.PI / 2;
    body.add(fire);
    const core = cone(0.08, 0.36, MAT.flameCore, 0, 0.08, -1.05, 6);
    core.rotation.x = -Math.PI / 2;
    body.add(core);

    body.scale.setScalar(scale);
    g.userData = {
      type: 'dragon', body: body, wings: wings, tail: tail, fire: fire, core: core,
      scale: scale, baseY: 0, phase: Math.random() * 6.28
    };
    return g;
  }

  function spawnBurst(scene, x, y, z, color, count, power) {
    const n = count || 16;
    const pos = new Float32Array(n * 3);
    const vel = [];
    for (let i = 0; i < n; i++) {
      pos[i * 3] = x; pos[i * 3 + 1] = y; pos[i * 3 + 2] = z;
      const a = Math.random() * Math.PI * 2;
      const up = Math.random() * 2.4;
      const sp = (0.6 + Math.random() * 1.8) * (power || 1);
      vel.push({ x: Math.cos(a) * sp, y: up, z: Math.sin(a) * sp });
    }
    const geo = new T.BufferGeometry();
    geo.setAttribute('position', new T.BufferAttribute(pos, 3));
    const mat = new T.PointsMaterial({ color: color || 0xffa64a, size: 0.12, transparent: true, opacity: 1, depthWrite: false });
    const pts = new T.Points(geo, mat);
    scene.add(pts);
    bursts.push({ pts: pts, vel: vel, life: 0, max: 0.9 });
  }

  function updateBursts(dt) {
    for (let i = bursts.length - 1; i >= 0; i--) {
      const b = bursts[i];
      b.life += dt;
      const pos = b.pts.geometry.attributes.position.array;
      for (let k = 0; k < b.vel.length; k++) {
        const v = b.vel[k];
        v.y -= 4 * dt;
        pos[k * 3] += v.x * dt;
        pos[k * 3 + 1] += v.y * dt;
        pos[k * 3 + 2] += v.z * dt;
        if (pos[k * 3 + 1] < 0.05) { pos[k * 3 + 1] = 0.05; v.y *= -0.3; v.x *= 0.7; v.z *= 0.7; }
      }
      b.pts.geometry.attributes.position.needsUpdate = true;
      b.pts.material.opacity = 1 - b.life / b.max;
      if (b.life >= b.max) {
        b.pts.parent && b.pts.parent.remove(b.pts);
        b.pts.geometry.dispose();
        b.pts.material.dispose();
        bursts.splice(i, 1);
      }
    }
  }

  /* ------------------------------------------------------------------ */
  /*  ПРЕВЬЮ МОДЕЛИ (для модалок боя и Дуэли)                            */
  /* ------------------------------------------------------------------ */
  let _previewRenderer = null;
  let _previewCache = {};
  /**
   * Рисует модель в отдельной мини-сцене и возвращает PNG dataURL.
   * @param {THREE.Object3D} model
   * @param {object} opts { size, yaw, pitch, zoom, bg, ground }
   */
  function renderPreview(model, opts) {
    opts = opts || {};
    const size = opts.size || 160;
    if (!_previewRenderer) {
      _previewRenderer = new T.WebGLRenderer({ antialias: true, alpha: !opts.bg, preserveDrawingBuffer: true });
      _previewRenderer.setPixelRatio(1);
      _previewRenderer.outputEncoding = T.sRGBEncoding;
    }
    const r = _previewRenderer;
    r.setSize(size, size, false);
    r.setClearColor(opts.bg || 0x000000, opts.bg ? 1 : 0);

    /* Свет подобран так, чтобы цвета ордена и багровый цвет врага
       оставались насыщенными (суммарно ≈1.1 на лицевой поверхности). */
    const sc = new T.Scene();
    sc.add(new T.AmbientLight(0xb9adc4, 0.30));
    const hemi = new T.HemisphereLight(0xfff0d8, 0x2a2430, 0.30);
    sc.add(hemi);
    const key = new T.DirectionalLight(0xffe9c4, 0.58);
    key.position.set(3, 5, 4);
    sc.add(key);
    const rim = new T.DirectionalLight(0x88aaff, 0.24);
    rim.position.set(-4, 3, -4);
    sc.add(rim);
    const fill = new T.DirectionalLight(0xffd0b0, 0.18);
    fill.position.set(0, 2, 5);
    sc.add(fill);

    const holder = new T.Group();
    holder.add(model);
    // Центрируем по горизонтали и ставим на «пол»
    const bb = new T.Box3().setFromObject(model);
    const cx = (bb.min.x + bb.max.x) / 2;
    const cz = (bb.min.z + bb.max.z) / 2;
    model.position.x -= cx;
    model.position.z -= cz;
    model.position.y -= bb.min.y;
    holder.rotation.y = opts.yaw != null ? opts.yaw : -0.6;
    sc.add(holder);

    if (opts.ground !== false) {
      const disc = new T.Mesh(
        new T.CircleGeometry(1.1, 32),
        new T.MeshBasicMaterial({ color: 0x2a2320, transparent: true, opacity: 0.55 })
      );
      disc.rotation.x = -Math.PI / 2;
      disc.position.y = 0.001;
      sc.add(disc);
    }

    const h = bb.max.y - bb.min.y;
    const cam = new T.PerspectiveCamera(30, 1, 0.1, 30);
    const dist = (h * 2.5) / (opts.zoom || 1);
    const ang = opts.camAngle != null ? opts.camAngle : 0.35;
    cam.position.set(Math.sin(ang) * dist, h * 0.62 + dist * 0.25, Math.cos(ang) * dist);
    cam.lookAt(0, h * 0.5, 0);
    sc.add(cam);

    r.render(sc, cam);
    const url = r.domElement.toDataURL('image/png');

    // Сцену выбрасываем — модель возвращается владельцу
    sc.remove(holder);
    return url;
  }

  /* ------------------------------------------------------------------ */
  /*  ЖИВОЙ ПАРОБОТ В ОКНЕ БОЯ                                         */
  /* ------------------------------------------------------------------ */
  let _botViewer = null;
  /* Один WebGL-контекст на все окна боя. Раньше каждый показ/перерисовка
     создавали новый renderer, контексты копились и браузер мог отобрать
     контекст у основного 3D-окна — оно становилось белым до перезагрузки. */
  let _botViewerRenderer = null;

  function botViewerRenderer() {
    let r = _botViewerRenderer;
    try {
      const ctx = r && r.getContext && r.getContext();
      if (ctx && ctx.isContextLost && ctx.isContextLost()) {
        try { r.dispose(); } catch (e) { /* контекст уже потерян */ }
        _botViewerRenderer = null;
        r = null;
      }
    } catch (e) { r = null; }
    if (!r) {
      r = new T.WebGLRenderer({ antialias: true, alpha: true });
      r.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      r.outputEncoding = T.sRGBEncoding;
      _botViewerRenderer = r;
    }
    return r;
  }

  function roomWallType(type) {
    const map = {
      start: 'wall_castle', armory: 'wall_armory', library: 'wall_library',
      forge: 'wall_forge', barrack: 'wall_barrack', chest: 'wall_treasure',
      vault: 'wall_treasure', trap: 'wall_trap', altar: 'wall_altar',
      arena: 'wall_arena', boss: 'wall_boss'
    };
    return map[type] || 'wall_corridor';
  }

  /** Останавливает живой 3D-просмотр и убирает его canvas из модалки.
   *  Сам renderer не уничтожаем: он один на все бои и переиспользуется. */
  function unmountBotViewer() {
    const v = _botViewer;
    if (!v) return;
    _botViewer = null;
    if (v.raf) cancelAnimationFrame(v.raf);
    const cv = v.renderer && v.renderer.domElement;
    if (cv && cv.parentNode) cv.parentNode.removeChild(cv);
  }

  /**
   * Монтирует вращающегося ПароБота в комнатном окружении.
   * @param {HTMLElement} host контейнер в окне боя
   * @param {string} botType тип ПароБота
   * @param {string} roomType тип текущего помещения
   */
  function mountBotViewer(host, botType, roomType) {
    if (!host || !T || !KVP.BOTS[botType]) return null;
    const room = roomType || 'start';

    /* Перерисовка модалки (выбор Рыцаря) не должна создавать новый
       WebGL-контекст: переставляем уже готовый canvas в новый контейнер. */
    const prev = _botViewer;
    if (prev && prev.botType === botType && prev.roomType === room &&
        prev.renderer && prev.renderer.domElement) {
      let lost = false;
      try {
        const ctx = prev.renderer.getContext();
        lost = !!(ctx && ctx.isContextLost && ctx.isContextLost());
      } catch (e) { lost = true; }
      if (!lost) {
        const w = Math.max(110, host.clientWidth || 180);
        const h = Math.max(130, host.clientHeight || 210);
        prev.host = host;
        host.appendChild(prev.renderer.domElement);
        prev.w = w; prev.h = h;
        prev.renderer.setSize(w, h, false);
        prev.camera.aspect = w / h;
        prev.camera.updateProjectionMatrix();
        return prev;
      }
    }
    unmountBotViewer();

    const width = Math.max(110, host.clientWidth || 180);
    const height = Math.max(130, host.clientHeight || 210);
    const renderer = botViewerRenderer();
    renderer.setSize(width, height, false);
    renderer.domElement.className = 'bot3d-canvas';
    host.appendChild(renderer.domElement);

    const sc = new T.Scene();
    /* Пол и стена берутся из того же помещения, где игрок встретил бота. */
    const floor = new T.Mesh(
      new T.PlaneGeometry(2.8, 2.8),
      new T.MeshLambertMaterial({ map: roomFloorTex(room) })
    );
    floor.rotation.x = -Math.PI / 2;
    sc.add(floor);

    const wall = new T.Mesh(
      new T.PlaneGeometry(2.9, 2.35),
      new T.MeshLambertMaterial({ map: getWallTex(roomWallType(room)) })
    );
    wall.position.set(0, 1.08, -1.32);
    sc.add(wall);

    const sideMat = new T.MeshLambertMaterial({ color: 0x201a18 });
    const left = new T.Mesh(new T.PlaneGeometry(2.6, 2.35), sideMat);
    left.position.set(-1.42, 1.08, -0.02);
    left.rotation.y = Math.PI / 2;
    sc.add(left);
    const right = left.clone();
    right.position.x = 1.42;
    right.rotation.y = -Math.PI / 2;
    sc.add(right);

    sc.add(new T.AmbientLight(0xb9adc4, 0.34));
    sc.add(new T.HemisphereLight(0xfff0d8, 0x2a2430, 0.30));
    const key = new T.DirectionalLight(0xffe9c4, 0.64);
    key.position.set(3, 5, 4);
    sc.add(key);
    const rim = new T.DirectionalLight(0x88aaff, 0.26);
    rim.position.set(-4, 3, -4);
    sc.add(rim);
    const fill = new T.DirectionalLight(0xffd0b0, 0.20);
    fill.position.set(0, 2, 5);
    sc.add(fill);

    const holder = new T.Group();
    const model = makeBot(botType);
    holder.add(model);
    const bb = new T.Box3().setFromObject(model);
    model.position.x -= (bb.min.x + bb.max.x) / 2;
    model.position.z -= (bb.min.z + bb.max.z) / 2;
    model.position.y -= bb.min.y;
    sc.add(holder);

    const h = Math.max(0.8, bb.max.y - bb.min.y);
    const cam = new T.PerspectiveCamera(32, width / height, 0.1, 30);
    const dist = h * 2.35;
    cam.position.set(0, h * 0.68 + dist * 0.16, dist);
    cam.lookAt(0, h * 0.48, 0);

    const state = {
      renderer: renderer, scene: sc, camera: cam, holder: holder,
      host: host, botType: botType, roomType: room,
      raf: 0, t: 0, last: 0, w: width, h: height
    };
    _botViewer = state;

    function frame(now) {
      if (_botViewer !== state) return;
      if (!state.host || !state.host.isConnected) { unmountBotViewer(); return; }
      if (!state.last) state.last = now;
      const dt = Math.min(0.05, (now - state.last) / 1000);
      state.last = now;
      state.t += dt;
      const nw = state.host.clientWidth, nh = state.host.clientHeight;
      if (nw && nh && (nw !== state.w || nh !== state.h)) {
        state.w = nw; state.h = nh;
        state.renderer.setSize(nw, nh, false);
        state.camera.aspect = nw / nh;
        state.camera.updateProjectionMatrix();
      }
      state.holder.rotation.y = state.t * 0.55;
      state.holder.position.y = Math.sin(state.t * 1.5) * 0.012;
      state.renderer.render(state.scene, state.camera);
      state.raf = requestAnimationFrame(frame);
    }
    state.raf = requestAnimationFrame(frame);
    return state;
  }

  /* ------------------------------------------------------------------ */
  /*  ЭКСПОРТ                                                           */
  /* ------------------------------------------------------------------ */
  KVP.M3 = {
    WALL_H: WALL_H,
    EYE: EYE,
    MAT: MAT,
    buildWorld: buildWorld,
    makeBot: makeBot,
    makeKnight: makeKnight,
    makeDragon: makeDragon,
    renderPreview: renderPreview,
    mountBotViewer: mountBotViewer,
    unmountBotViewer: unmountBotViewer,
    makeCardPickup: makeCardPickup,
    makeChest: makeChest,
    makeCage: makeCage,
    makePortal: makePortal,
    makeTorch: makeTorch,
    makeProjectile: makeProjectile,
    makeLabelSprite: makeLabelSprite,
    glowTexture: glowTexture,
    spawnBurst: spawnBurst,
    updateBursts: updateBursts,
    box: box, cyl: cyl, cone: cone, sphere: sphere,
    cardTexture: cardTexture
  };
})();
