/*
 * ui.js — карточные компоненты интерфейса.
 *
 * Все карты верстаются из одних и тех же элементов: пергамент, тёмная
 * окантовка, золотой уголок, рисованная SVG-иллюстрация, лента с ТТХ.
 * Это визуальный «мост» между настольной игрой и 3D-шутером.
 */
(function () {
  'use strict';
  const KVP = (window.KVP = window.KVP || {});
  const UI = (KVP.UI = KVP.UI || {});

  function esc(s) { return KVP.escapeHtml(s); }
  function corner() {
    return '<span class="gcard-corner tl">' + KVP.SVG.corner() + '</span>' +
      '<span class="gcard-corner tr">' + KVP.SVG.corner() + '</span>' +
      '<span class="gcard-corner bl">' + KVP.SVG.corner() + '</span>' +
      '<span class="gcard-corner br">' + KVP.SVG.corner() + '</span>';
  }
  function coin(n) {
    return '<span class="coin" aria-label="' + n + ' золота"><span class="coin-in">' + n + '</span></span>';
  }
  function shield(n) {
    return '<span class="shield-badge" title="Броня"><span class="shield-ico">' + KVP.SVG.shield() + '</span><b>' + n + '</b></span>';
  }
  function force(n) {
    return '<span class="force-badge" title="Сила"><span class="force-ico">' + KVP.SVG.sword() + '</span><b>' + n + '</b></span>';
  }
  function art(svg) { return '<div class="gcard-art">' + svg + '</div>'; }

  /* ------------------------------------------------------------------ */
  /*  ТРОФЕЙ                                                            */
  /* ------------------------------------------------------------------ */
  UI.trophy = function (type, opts) {
    opts = opts || {};
    const d = KVP.TROPHIES[type];
    if (!d) return '';
    if (opts.empty) {
      return '<article class="gcard gcard-empty' + (opts.compact ? ' compact' : '') + '">' +
        '<div class="gcard-frame">' + (opts.compact ? '' : corner()) +
        '<div class="gcard-top"><span class="gcard-kind">ТРОФЕЙ</span></div>' +
        '<div class="empty-mark">＋</div>' +
        '<div class="gcard-title">Пустой слот</div>' +
        '</div></article>';
    }
    return '<article class="gcard gcard-trophy theme-' + type + (opts.compact ? ' compact' : '') + (opts.selected ? ' selected' : '') + '"' +
      (opts.slot != null ? ' data-slot="' + opts.slot + '"' : '') + '>' +
      '<div class="gcard-frame">' + (opts.compact ? '' : corner()) +
      (opts.key != null ? '<span class="key-badge">' + opts.key + '</span>' : '') +
      '<div class="gcard-top"><span class="gcard-kind">ТРОФЕЙ</span>' + coin(d.gold) + '</div>' +
      art(KVP.SVG.trophy(type)) +
      '<div class="gcard-title">' + esc(d.name) + '</div>' +
      '<div class="gcard-ribbon">' + force(d.force) + '<span>СИЛА</span></div>' +
      (opts.compact ? '' :
        '<div class="gcard-desc">' + esc(d.desc) + '</div>' +
        '<div class="gcard-foot">Убивает: ' + esc(d.kills) + '</div>') +
      '</div></article>';
  };

  /* ------------------------------------------------------------------ */
  /*  КАРТА ТРОФЕЯ — настоящая карта того же формата, что и карты       */
  /*  Рыцарей: лежит под Рыцарём и чуть заходит на неё, как бумажные     */
  /*  карты, положенные на игровой стол                                  */
  /* ------------------------------------------------------------------ */
  UI.trophyCard = function (type, opts) {
    opts = opts || {};
    const d = type ? KVP.TROPHIES[type] : null;
    if (!d) {
      /* тот же формат карты, только пустой — сюда кладут Трофей */
      return '<article class="gcard gcard-empty trophy-card empty">' +
        '<div class="gcard-frame">' + corner() +
        '<div class="gcard-top"><span class="gcard-kind">ТРОФЕЙ</span></div>' +
        '<div class="empty-mark">＋</div>' +
        '<div class="gcard-title">' + esc(opts.emptyTitle || 'Слот для Трофея') + '</div>' +
        '</div></article>';
    }
    return '<article class="gcard gcard-trophy trophy-card theme-' + type + '"' +
      (opts.drag ? ' data-drag="chip"' : '') +
      ' title="Трофей «' + esc(d.name) + '» — перетащите на другого Рыцаря или в руку">' +
      '<div class="gcard-frame">' + corner() +
      '<div class="gcard-top"><span class="gcard-kind">ТРОФЕЙ</span>' + coin(d.gold) + '</div>' +
      art(KVP.SVG.trophy(type)) +
      '<div class="gcard-title">' + esc(d.name) + '</div>' +
      '<div class="gcard-ribbon">' + force(d.force) + '<span>СИЛА</span></div>' +
      '</div></article>';
  };

  /* ------------------------------------------------------------------ */
  /*  РЫЦАРЬ                                                            */
  /* ------------------------------------------------------------------ */
  UI.knight = function (knight, opts) {
    opts = opts || {};
    const type = typeof knight === 'string' ? knight : knight.type;
    const d = KVP.KNIGHTS[type];
    if (!d) return '';
    const trophy = knight && knight.trophy ? KVP.TROPHIES[knight.trophy.type] : null;
    const slotHTML = trophy
      ? '<div class="slot-filled theme-' + trophy.id + '"><span class="slot-mini">' + KVP.SVG.trophy(trophy.id) + '</span>' +
        '<span>' + esc(trophy.name) + ' · ⚔' + trophy.force + '</span></div>'
      : type === 'mag'
        ? '<div class="slot-empty">Маг: ВСЕ РЫЦАРИ бьют ТОЛЬКО Бумагой</div>'
        : '<div class="slot-empty">＋ слот для Трофея</div>';
    // В раскладе на столе Рыцарь — карта целиком, а Трофей лежит отдельной
    // карточкой под ней (с небольшим заходом), как в настоящей игре.
    const artBlock = opts.chip
      ? '<div class="gcard-art">' + KVP.SVG.knight(type) + '</div>'
      : art(KVP.SVG.knight(type));
    const tail = opts.compact
      ? ''
      : opts.chip
        ? ''
        : '<div class="gcard-desc">' + esc(d.tagline) + '</div>' +
          '<div class="gcard-slot">' + slotHTML + '</div>';
    const card = '<article class="gcard gcard-knight theme-k-' + type + (opts.compact ? ' compact' : '') + '"' +
      (opts.teamIndex != null ? ' data-knight="' + opts.teamIndex + '"' : '') + '>' +
      '<div class="gcard-frame">' + (opts.compact ? '' : corner()) +
      '<div class="gcard-top"><span class="gcard-kind">КОМАНДА</span>' + force('+' + d.bonus) + '</div>' +
      artBlock +
      '<div class="gcard-title">' + esc(d.name) + '</div>' +
      tail +
      '</div></article>';
    if (!opts.chip) return card;
    /* У Мага тоже есть слот: он может взять Бумагу. Если Трофея пока нет,
       показываем пустой слот, чтобы это было видно на столе. */
    return card + UI.trophyCard(trophy ? trophy.id : null, {
      drag: opts.drag,
      emptyTitle: type === 'mag' ? 'Магу — Бумагу' : ''
    });
  };

  /* ------------------------------------------------------------------ */
  /*  ПАРОБОТ                                                           */
  /* ------------------------------------------------------------------ */
  UI.bot = function (type, opts) {
    opts = opts || {};
    const d = KVP.BOTS[type];
    if (!d) return '';
    const condText = opts.compact
      ? (d.conditionText || d.conditionShort)
      : (d.conditionCard || d.conditionText || d.conditionShort);
    return '<article class="gcard gcard-bot theme-b-' + type + (opts.compact ? ' compact' : '') + '">' +
      '<div class="gcard-frame">' + (opts.compact ? '' : corner()) +
      '<div class="gcard-top"><span class="gcard-kind">ВРАГ</span>' + shield(d.armor) + '</div>' +
      art(KVP.SVG.bot(type)) +
      '<div class="gcard-title">' + esc(d.name) + '</div>' +
      (opts.compact ? '' :
        '<div class="gcard-logic" title="Логическая схема: ' + esc(d.conditionText || '') + '">' +
          KVP.SVG.logic(type) +
        '</div>') +
      '<div class="gcard-ribbon condition" title="' + esc(d.conditionText || '') + '">' +
        '<span class="logic">' + (opts.compact ? KVP.SVG.logicMini(type) : 'ПОБЕЖДАЕТСЯ') + '</span>' +
        '<span class="cond-rule">' + esc(condText) + '</span></div>' +
      (opts.compact ? '' :
        '<div class="gcard-desc">' + esc(d.desc) + '</div>' +
        '<div class="gcard-foot">' + coin(d.reward) + ' награда · Броня ' + d.armor + '</div>') +
      '</div></article>';
  };

  /* ------------------------------------------------------------------ */
  /*  СПЕЦКАРТА                                                         */
  /* ------------------------------------------------------------------ */
  UI.special = function (id, opts) {
    opts = opts || {};
    const d = KVP.SPECIALS[id];
    if (!d) return '';
    return '<article class="gcard gcard-special theme-s-' + id + (opts.compact ? ' compact' : '') + '"' +
      (opts.drag ? ' data-drag="item" data-item="' + id + '" title="Перетащите на Рыцаря — он применит"' : '') + '>' +
      '<div class="gcard-frame">' + (opts.compact ? '' : corner()) +
      '<div class="gcard-top"><span class="gcard-kind">СПЕЦКАРТА</span><span class="star">✦</span></div>' +
      art(KVP.SVG.special(id)) +
      '<div class="gcard-title">' + esc(d.name) + '</div>' +
      (opts.compact ? '' :
        '<div class="gcard-desc">' + esc(d.text) + '</div>' +
        '<div class="gcard-foot">' + esc(d.effect) + '</div>') +
      '</div></article>';
  };

  /* ------------------------------------------------------------------ */
  /*  ВСПОМОГАТЕЛЬНОЕ                                                   */
  /* ------------------------------------------------------------------ */
  /**
   * Настоящая карта по виду и типу — для зоны «ВЫТЯНУТО» и для дуэли.
   * Трофей, Рыцарь, ПароБот и Спецкарта рисуются своими компонентами;
   * Клетка-ловушка и карта Местности собираются здесь.
   */
  UI.cardFor = function (kind, itemType, opts) {
    opts = opts || {};
    if (kind === 'trophy') return UI.trophy(itemType, opts);
    if (kind === 'knight') return UI.knight(itemType, opts);
    if (kind === 'bot') return UI.bot(itemType, opts);
    if (kind === 'special') return UI.special(itemType, opts);
    let name, icon, kindLabel, theme;
    if (kind === 'cell') {
      name = 'Клетка-ловушка'; icon = '🪤'; kindLabel = 'КЛЕТКА'; theme = 'cell';
    } else {
      const t = KVP.tileCardById(itemType);
      name = t ? t.name : 'Карта Местности';
      icon = t ? t.icon : '🗺';
      kindLabel = 'МЕСТНОСТЬ'; theme = 'tile';
    }
    return '<article class="gcard gcard-plain theme-' + theme + (opts.compact ? ' compact' : '') + '">' +
      '<div class="gcard-frame">' + (opts.compact ? '' : corner()) +
      '<div class="gcard-top"><span class="gcard-kind">' + kindLabel + '</span></div>' +
      art('<span class="gcard-ico">' + icon + '</span>') +
      '<div class="gcard-title">' + esc(name) + '</div>' +
      '</div></article>';
  };

  UI.cardForPickup = function (kind, id, opts) {
    if (kind === 'trophy') return UI.trophy(id, opts);
    if (kind === 'knight') return UI.knight(id, opts);
    if (kind === 'special') return UI.special(id, opts);
    return '';
  };

  UI.smallTrophy = function (type) {
    const d = KVP.TROPHIES[type];
    return '<span class="mini-trophy theme-' + type + '">' + KVP.SVG.trophy(type) + '<b>' + d.name + '</b></span>';
  };

  UI.toast = function (text, kind, ms) {
    const host = document.getElementById('toasts');
    if (!host) return;
    const el = document.createElement('div');
    el.className = 'toast toast-' + (kind || 'info');
    el.innerHTML = text;
    host.appendChild(el);
    while (host.children.length > 4) host.removeChild(host.firstChild);
    const ttl = ms || (kind === 'bad' ? 4200 : 3200);
    setTimeout(function () {
      el.classList.add('out');
      setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 350);
    }, ttl);
  };

  UI.roomBanner = function (room) {
    const el = document.getElementById('room-banner');
    if (!el) return;
    el.innerHTML = '<span class="room-icon">' + room.icon + '</span>' +
      '<span class="room-name">' + esc(room.name) + '</span>';
    el.classList.remove('show');
    // reflow, чтобы анимация повторилась
    void el.offsetWidth;
    el.classList.add('show');
    clearTimeout(UI._roomTimer);
    UI._roomTimer = setTimeout(function () { el.classList.remove('show'); }, 3600);
  };

  UI.setBar = function (id, value, max) {
    const el = document.getElementById(id);
    if (el) el.style.width = Math.max(0, Math.min(100, (value / max) * 100)) + '%';
  };

  /* ------------------------------------------------------------------ */
  /*  ВСПЛЫВАЮЩАЯ ПОДСКАЗКА                                               */
  /*                                                                     */
  /*  Любой элемент с data-tip="..." при наведении показывает плашку:     */
  /*  что это за карта и как её применить.                                */
  /* ------------------------------------------------------------------ */
  let tipEl = null;
  let tipTimer = null;

  function ensureTip() {
    if (tipEl) return tipEl;
    tipEl = document.createElement('div');
    tipEl.className = 'card-tip';
    tipEl.setAttribute('role', 'tooltip');
    document.body.appendChild(tipEl);
    return tipEl;
  }

  function tipShow(html, anchor) {
    const el = ensureTip();
    if (tipTimer) { clearTimeout(tipTimer); tipTimer = null; }
    el.innerHTML = html;
    el.classList.add('show');
    const r = anchor.getBoundingClientRect();
    const tw = el.offsetWidth, th = el.offsetHeight;
    let left = r.left + r.width / 2 - tw / 2;
    let top = r.top - th - 10;
    if (top < 6) top = r.bottom + 10;            /* сверху не влезает — покажем снизу */
    left = Math.max(6, Math.min(left, window.innerWidth - tw - 6));
    el.style.left = Math.round(left) + 'px';
    el.style.top = Math.round(top) + 'px';
    /* На телефоне mouseover после тапа остаётся «залипшим» — плашка
       сама убирается через 2 секунды, чтобы не закрывать игру. */
    tipTimer = setTimeout(function () {
      tipTimer = null;
      tipHide();
    }, 2000);
  }

  function tipHide() {
    if (tipTimer) { clearTimeout(tipTimer); tipTimer = null; }
    if (tipEl) tipEl.classList.remove('show');
  }

  /** Имя карты любого вида — для подсказки. */
  UI.cardName = function (card) {
    if (!card) return '';
    if (card.kind === 'trophy') return (KVP.TROPHIES[card.itemType] || {}).name || 'Трофей';
    if (card.kind === 'knight') return (KVP.KNIGHTS[card.itemType] || {}).name || 'Рыцарь';
    if (card.kind === 'special') return (KVP.SPECIALS[card.itemType] || {}).name || 'Спецкарта';
    if (card.kind === 'bot') return (KVP.BOTS[card.itemType] || {}).name || 'ПароБот';
    if (card.kind === 'cell') return 'Клетка-ловушка';
    if (card.kind === 'tile') {
      const t = KVP.tileCardById(card.itemType);
      return t ? t.name : 'Карта Местности';
    }
    return 'Карта';
  };

  /** Подсказка по карте: что она делает и как её применить. */
  UI.tipFor = function (card, howTo) {
    if (!card) return '';
    let what = '';
    if (card.kind === 'trophy') {
      const d = KVP.TROPHIES[card.itemType] || {};
      what = 'Сила <b>' + (d.force || 0) + '</b> · золото ' + (d.gold || 0) +
        (d.kills ? ' · бьёт: ' + esc(d.kills) : '');
    } else if (card.kind === 'bot') {
      const b = KVP.BOTS[card.itemType] || {};
      what = 'Броня <b>' + (b.armor || 0) + '</b> · награда ' + (b.reward || 0) + ' золота' +
        (b.conditionText ? ' · нужно: ' + esc(b.conditionText) : '');
    } else if (card.kind === 'special') {
      const sp = KVP.SPECIALS[card.itemType] || {};
      what = esc(sp.text || sp.effect || '');
    } else if (card.kind === 'knight') {
      const k = KVP.KNIGHTS[card.itemType] || {};
      what = esc(k.tagline || '');
    } else if (card.kind === 'cell') {
      what = 'Ловит любого ПароБота без боя.';
    } else if (card.kind === 'tile') {
      const t2 = KVP.tileCardById(card.itemType);
      what = t2 ? 'Комната <b>' + esc(t2.name) + '</b> — пристраивается к лабиринту.' : '';
    }
    return '<div class="tip-name">' + esc(UI.cardName(card)) + '</div>' +
      (what ? '<div class="tip-what">' + what + '</div>' : '') +
      (howTo ? '<div class="tip-how">' + howTo + '</div>' : '');
  };

  /* Один делегированный слушатель на весь документ. */
  document.addEventListener('mouseover', function (ev) {
    const t = ev.target && ev.target.closest ? ev.target.closest('[data-tip]') : null;
    if (!t) return;
    tipShow(t.getAttribute('data-tip'), t);
  });
  document.addEventListener('mouseout', function (ev) {
    const t = ev.target && ev.target.closest ? ev.target.closest('[data-tip]') : null;
    if (!t) return;
    if (ev.relatedTarget && t.contains(ev.relatedTarget)) return;
    tipHide();
  });
  window.addEventListener('scroll', tipHide, true);
})();
