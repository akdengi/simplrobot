/*
 * «Головоломки Големов» — мягкая защита: полная версия или ДЕМО.
 *
 * Полная версия (все 6 этажей) открывается, если игрок пришёл со страниц
 * simplrobot.ru — в идеале со страницы курса
 *   https://simplrobot.ru/members/courses/bg4_golovolomki/onlajnversia-golovolomok-*
 * (код после дефиса может быть любым). Во всех остальных случаях — ДЕМО:
 * доступны только первые два этажа, этажи 3–6 видны на главной, но не
 * открываются.
 *
 * Проверка идёт по document.referrer, то есть защита «мягкая»: её видно в браузере
 * и её легко обойти (в том числе очисткой localStorage). Настоящая защита — на
 * сервере: проверять заголовок Referer и отдавать демо-сборку. Как это сделать
 * (nginx + SSI-врезка флага в index.html) — в README, раздел
 * «Полная версия и ДЕМО-режим».
 *
 * Результат проверки запоминается в localStorage: игрок, пришедший со страницы
 * курса, остаётся с полной версией и после перезагрузки страницы (когда referrer
 * уже пустой).
 *
 * Отладка и локальный запуск (в том числе двойным щелчком по index.html):
 *   index.html?access=full  — полная версия;
 *   index.html?access=demo  — демо;
 *   BG4_LICENSE.setFull(true) — то же самое из консоли браузера.
 * Серверная демо-сборка ставит window.BG4_FORCE_DEMO = true перед этим файлом.
 */
(function () {
  'use strict';

  // Страница курса, с которой приходит «полный» доступ. Браузеры по умолчанию
  // (strict-origin-when-cross-origin) при переходе на другой домен отсылают в
  // referrer только origin («https://simplrobot.ru/»), поэтому принимаем и
  // полный адрес курса, и одно происхождение.
  const COURSE_PAGE_REF =
    /^https?:\/\/simplrobot\.ru\/members\/courses\/bg4_golovolomki\/onlajnversia-golovolomok(?:-[^/?#]*)?/i;
  const COURSE_HOST_REF = /^https?:\/\/simplrobot\.ru\/?(?:$|[?#])/i;
  const STORAGE_KEY = 'bg4.license.full';
  const DEMO_MAX_FLOOR = 2; // в демо-версии открыты этажи 1–2
  const ALL_FLOORS = 6;

  function stored() {
    try { return localStorage.getItem(STORAGE_KEY) === '1'; } catch (e) { return false; }
  }
  function store(v) {
    try { v ? localStorage.setItem(STORAGE_KEY, '1') : localStorage.removeItem(STORAGE_KEY); } catch (e) { /* приватный режим */ }
  }
  function query(name) {
    try { return new URLSearchParams(location.search).get(name) || ''; } catch (e) { return ''; }
  }

  const referrer = document.referrer || '';
  const fromCourse = COURSE_PAGE_REF.test(referrer) || COURSE_HOST_REF.test(referrer);
  const access = String(query('access') || '').toLowerCase();

  let full = stored() || fromCourse;
  if (access === 'full') full = true;
  if (access === 'demo') full = false;
  if (window.BG4_FORCE_DEMO) full = false;  // демо-сборка для nginx
  if (window.BG4_FORCE_FULL) full = true;   // полная сборка для nginx

  if (fromCourse || access === 'full') store(true);
  if (access === 'demo') store(false);

  window.BG4_LICENSE = {
    full: () => full,
    demo: () => !full,
    maxFloor: () => (full ? ALL_FLOORS : DEMO_MAX_FLOOR),
    allowsFloor: (n) => full || n <= DEMO_MAX_FLOOR,
    demoMaxFloor: DEMO_MAX_FLOOR,
    referrer: referrer,
    fromCourse: fromCourse,
    // откуда взялся режим: клиент (referrer/localStorage/?access) или серверные флаги
    src: window.BG4_FORCE_DEMO ? 'сервер: ДЕМО' : window.BG4_FORCE_FULL ? 'сервер: полная' : 'клиент',
    setFull: (v) => { full = !!v; store(full); return full; },
  };
})();
