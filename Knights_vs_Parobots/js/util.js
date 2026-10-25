/*
 * Рыцари против ПАРОБОТОВ: Перезагрузка 3D
 * util.js — небольшие общие функции и генератор случайных чисел.
 *
 * Игра — статический сайт без сборки: все модули подключаются обычными
 * <script> и складывают публичные объекты в window.KVP.
 */
(function () {
  'use strict';

  const KVP = (window.KVP = window.KVP || {});

  KVP.VERSION = '1.0.3';
  KVP.TAU = Math.PI * 2;

  KVP.clamp = function (v, a, b) { return v < a ? a : (v > b ? b : v); };
  KVP.lerp = function (a, b, t) { return a + (b - a) * t; };
  KVP.dist2 = function (ax, ay, bx, by) {
    const dx = ax - bx, dy = ay - by;
    return dx * dx + dy * dy;
  };
  KVP.dist = function (ax, ay, bx, by) { return Math.sqrt(KVP.dist2(ax, ay, bx, by)); };

  /** Приводит угол к диапазону (-PI, PI]. */
  KVP.normAngle = function (a) {
    while (a > Math.PI) a -= KVP.TAU;
    while (a <= -Math.PI) a += KVP.TAU;
    return a;
  };

  KVP.escapeHtml = function (s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };

  KVP.plural = function (n, one, few, many) {
    const a = Math.abs(n) % 100, b = a % 10;
    if (a > 10 && a < 20) return many;
    if (b > 1 && b < 5) return few;
    if (b === 1) return one;
    return many;
  };

  KVP.formatTime = function (sec) {
    sec = Math.max(0, Math.floor(sec));
    const m = Math.floor(sec / 60), s = sec % 60;
    return m + ':' + (s < 10 ? '0' : '') + s;
  };

  /** Детерминированный ГПСЧ (mulberry32). */
  KVP.RNG = function (seed) {
    let a = (seed >>> 0) || 1;
    this.next = function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    this.int = function (n) { return Math.floor(this.next() * n); };
    this.range = function (a1, b1) { return a1 + this.next() * (b1 - a1); };
    this.pick = function (arr) { return arr[Math.floor(this.next() * arr.length)]; };
    this.shuffle = function (arr) {
      const a2 = arr.slice();
      for (let i = a2.length - 1; i > 0; i--) {
        const j = Math.floor(this.next() * (i + 1));
        const t = a2[i]; a2[i] = a2[j]; a2[j] = t;
      }
      return a2;
    };
    /** Случайный элемент с весами: [{w, ...}] */
    this.weighted = function (arr) {
      let total = 0;
      for (let i = 0; i < arr.length; i++) total += arr[i].w || 0;
      let r = this.next() * total;
      for (let i = 0; i < arr.length; i++) {
        r -= arr[i].w || 0;
        if (r <= 0) return arr[i];
      }
      return arr[arr.length - 1];
    };
  };

  KVP.storage = {
    get: function (key, fallback) {
      try {
        const raw = localStorage.getItem('kvp_' + key);
        if (raw == null) return fallback;
        return JSON.parse(raw);
      } catch (e) { return fallback; }
    },
    set: function (key, value) {
      try { localStorage.setItem('kvp_' + key, JSON.stringify(value)); } catch (e) { /* приватный режим */ }
    },
    remove: function (key) {
      try { localStorage.removeItem('kvp_' + key); } catch (e) { /* ignore */ }
    }
  };

  KVP.uid = (function () {
    let n = 0;
    return function (prefix) { n++; return (prefix || 'id') + '_' + n + '_' + Math.floor(Math.random() * 1e6); };
  })();

  /** Простая проверка пересечения окружности и прямоугольника. */
  KVP.circleRect = function (cx, cy, r, x, y, w, h) {
    const nx = KVP.clamp(cx, x, x + w);
    const ny = KVP.clamp(cy, y, y + h);
    return (cx - nx) * (cx - nx) + (cy - ny) * (cy - ny) < r * r;
  };
})();
