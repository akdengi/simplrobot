/*
 * art-svg.js — рисованные SVG-иллюстрации для карт.
 *
 * Стиль: средневековая гравюра / лубок. Тёплый пергамент, тушь, золото,
 * приглушённые цвета. Эти же SVG используются как текстуры для 3D-карт,
 * которые лежат в подземелье (data:image/svg+xml).
 */
(function () {
  'use strict';
  const KVP = (window.KVP = window.KVP || {});

  const INK = '#241a12';
  const PAPER = '#e8d6ae';
  const PAPER_D = '#d8c191';
  const GOLD = '#d8a33f';
  const RED = '#a8322d';
  const GREEN = '#4f7a4a';
  const BLUE = '#3e5f86';
  const STEEL = '#8d9aa3';
  const STEEL_D = '#5c6a73';
  const PURPLE = '#6c4a8f';

  let uid = 0;
  function nextId(p) { return (p || 'a') + '_' + (++uid); }

  function wrap(inner, vb) {
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="' + (vb || '0 0 200 200') +
      '" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">' + inner + '</svg>';
  }

  function defs(id) {
    return '<defs>' +
      '<pattern id="' + id + '_hatch" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(35)">' +
        '<path d="M0 0V7" stroke="' + INK + '" stroke-width="1" opacity=".16"/></pattern>' +
      '<pattern id="' + id + '_dots" width="9" height="9" patternUnits="userSpaceOnUse">' +
        '<circle cx="2" cy="2" r="1" fill="' + INK + '" opacity=".18"/></pattern>' +
      '<linearGradient id="' + id + '_gold" x1="0" y1="0" x2="0" y2="1">' +
        '<stop offset="0" stop-color="#f2cd6b"/><stop offset="1" stop-color="#b77c24"/></linearGradient>' +
      '<linearGradient id="' + id + '_steel" x1="0" y1="0" x2="1" y2="1">' +
        '<stop offset="0" stop-color="#c4ced4"/><stop offset=".55" stop-color="#84929b"/><stop offset="1" stop-color="#56636b"/></linearGradient>' +
      '<radialGradient id="' + id + '_glow" cx=".5" cy=".5" r=".5">' +
        '<stop offset="0" stop-color="#ffd36a" stop-opacity=".95"/><stop offset=".55" stop-color="#e2672f" stop-opacity=".45"/><stop offset="1" stop-color="#e2672f" stop-opacity="0"/></radialGradient>' +
      '</defs>';
  }

  function bg(id) {
    return '<rect width="200" height="200" fill="' + PAPER + '"/>' +
      '<rect width="200" height="200" fill="url(#' + id + '_dots)" opacity=".55"/>' +
      '<path d="M0 168 Q50 156 100 168 T200 164 V200 H0 Z" fill="' + PAPER_D + '" opacity=".65"/>' +
      '<ellipse cx="100" cy="183" rx="62" ry="7" fill="' + INK + '" opacity=".18"/>';
  }

  function flame(id, x, y, s) {
    s = s || 1;
    return '<g transform="translate(' + x + ' ' + y + ') scale(' + s + ')">' +
      '<ellipse cx="0" cy="4" rx="17" ry="13" fill="url(#' + id + '_glow)"/>' +
      '<path d="M0 8 C-10 2 -7 -8 0 -18 C7 -8 10 2 0 8Z" fill="#e2672f" stroke="' + INK + '" stroke-width="1.6"/>' +
      '<path d="M0 5 C-4 1 -2 -4 1 -9 C4 -4 4 1 0 5Z" fill="#ffd36a"/>' +
      '</g>';
  }

  /* ================================================================== */
  /*  ТРОФЕИ                                                            */
  /* ================================================================== */
  const trophy = {};

  trophy.rock = function () {
    const id = nextId('rock');
    return wrap(defs(id) + bg(id) +
      '<g stroke="' + INK + '" stroke-width="2.2" stroke-linejoin="round">' +
        '<path d="M44 143 L34 104 L54 71 L92 58 L132 66 L159 95 L154 133 L124 152 L78 154 Z" fill="#8b8d86"/>' +
        '<path d="M44 143 L34 104 L54 71 L92 58 L96 102 L78 154 Z" fill="#a4a69d"/>' +
        '<path d="M96 102 L92 58 L132 66 L159 95 L154 133 L124 152 L96 102 Z" fill="#787b74"/>' +
        '<path d="M96 102 L54 71 L92 58 Z" fill="#b3b5ab"/>' +
        '<path d="M96 102 L154 133 L124 152 Z" fill="#676a64"/>' +
        '<path d="M78 154 L96 102 L124 152" fill="none"/>' +
        '<path d="M60 78 L84 68 M66 90 L78 83 M132 78 L148 91" fill="none" stroke="#d5d7cc" stroke-width="2" opacity=".65"/>' +
      '</g>' +
      '<path d="M120 146 C130 135 145 132 151 138 C155 142 151 150 142 152 Z" fill="#5d7a4a" stroke="' + INK + '" stroke-width="1.8"/>' +
      '<path d="M128 145 C133 140 140 139 144 141" fill="none" stroke="#8fae6b" stroke-width="1.5"/>' +
      '<g fill="' + INK + '" opacity=".55"><circle cx="63" cy="112" r="1.4"/><circle cx="73" cy="126" r="1.1"/><circle cx="143" cy="113" r="1.3"/></g>' +
      '<text x="100" y="34" text-anchor="middle" font-family="Georgia,serif" font-size="15" fill="' + INK + '" letter-spacing="4" opacity=".7">КАМЕНЬ</text>'
    );
  };

  trophy.scissors = function () {
    const id = nextId('sc');
    return wrap(defs(id) + bg(id) +
      '<g transform="rotate(-16 100 100)" stroke="' + INK + '" stroke-width="2.2" stroke-linejoin="round">' +
        '<path d="M72 152 L101 82 L110 86 L82 158Z" fill="url(#' + id + '_steel)"/>' +
        '<path d="M128 152 L99 82 L90 86 L118 158Z" fill="url(#' + id + '_steel)"/>' +
        '<path d="M50 54 L96 82 L91 91 L46 66Z" fill="#c9d2d7"/>' +
        '<path d="M150 54 L104 82 L109 91 L154 66Z" fill="#aab6bd"/>' +
        '<path d="M50 54 L96 82" fill="none"/>' +
        '<path d="M150 54 L104 82" fill="none"/>' +
        '<circle cx="100" cy="90" r="7" fill="' + GOLD + '"/>' +
        '<path d="M74 149 C60 158 49 151 52 139 C55 128 72 130 78 139Z" fill="' + RED + '"/>' +
        '<path d="M126 149 C140 158 151 151 148 139 C145 128 128 130 122 139Z" fill="' + RED + '"/>' +
        '<path d="M67 145 C61 146 59 142 61 138" fill="none" stroke="#e8b9a8" stroke-width="2"/>' +
        '<path d="M133 145 C139 146 141 142 139 138" fill="none" stroke="#e8b9a8" stroke-width="2"/>' +
      '</g>' +
      '<path d="M57 105 L43 96 M143 105 L157 96" stroke="' + INK + '" stroke-width="2"/>' +
      '<text x="100" y="34" text-anchor="middle" font-family="Georgia,serif" font-size="15" fill="' + INK + '" letter-spacing="4" opacity=".7">НОЖНИЦЫ</text>'
    );
  };

  trophy.paper = function () {
    const id = nextId('pa');
    return wrap(defs(id) + bg(id) +
      '<g stroke="' + INK + '" stroke-width="2.2" stroke-linejoin="round">' +
        '<path d="M58 54 C78 48 92 58 112 52 C130 47 142 54 144 58 L148 142 C130 148 118 139 100 145 C82 150 70 143 66 139 Z" fill="#f4e7c6"/>' +
        '<path d="M58 54 C78 48 92 58 112 52 C130 47 142 54 144 58 L145 70 C126 76 112 66 94 72 C78 77 64 70 60 66 Z" fill="#e2cfa6"/>' +
        '<path d="M60 132 C78 126 92 136 108 130 C124 124 136 132 144 136" fill="none" opacity=".7"/>' +
      '</g>' +
      '<g font-family="Georgia,serif" fill="' + INK + '" text-anchor="middle">' +
        '<text x="100" y="94" font-size="25" opacity=".85">A ∨ B</text>' +
        '<text x="100" y="122" font-size="25" opacity=".85">¬ C</text>' +
      '</g>' +
      '<circle cx="132" cy="150" r="15" fill="' + RED + '" stroke="' + INK + '" stroke-width="2"/>' +
      '<path d="M126 150 L131 155 L140 145" fill="none" stroke="' + GOLD + '" stroke-width="2.4" stroke-linecap="round"/>' +
      '<text x="100" y="34" text-anchor="middle" font-family="Georgia,serif" font-size="15" fill="' + INK + '" letter-spacing="4" opacity=".7">БУМАГА</text>'
    );
  };

  /* Пойманный ПароБот — отдельный Трофей (лежит в слоте Рыцаря/на Дуэли). */
  trophy.bot = function () {
    const id = nextId('bt');
    return wrap(defs(id) + bg(id) +
      '<g stroke="' + INK + '" stroke-width="2.2" stroke-linejoin="round">' +
        '<rect x="58" y="64" width="84" height="78" rx="12" fill="#9d7bc9"/>' +
        '<rect x="70" y="82" width="24" height="18" rx="4" fill="#f4e7c6"/>' +
        '<rect x="106" y="82" width="24" height="18" rx="4" fill="#f4e7c6"/>' +
        '<circle cx="82" cy="91" r="5" fill="' + RED + '"/>' +
        '<circle cx="118" cy="91" r="5" fill="' + RED + '"/>' +
        '<path d="M78 120 H122" fill="none" stroke-width="4"/>' +
        '<path d="M100 64 V50 M84 50 H116" fill="none" stroke-width="4"/>' +
        '<circle cx="100" cy="46" r="6" fill="' + GOLD + '"/>' +
        '<path d="M58 100 H44 M142 100 H156" fill="none" stroke-width="5"/>' +
        '<path d="M70 142 V156 M130 142 V156" fill="none" stroke-width="4"/>' +
      '</g>' +
      '<text x="100" y="34" text-anchor="middle" font-family="Georgia,serif" font-size="15" fill="' + INK + '" letter-spacing="3" opacity=".7">ПАРОБОТ</text>'
    );
  };

  /* Клетка-ловушка — тоже Трофей, но ловит без боя. */
  trophy.trap = function () {
    const id = nextId('tp');
    return wrap(defs(id) + bg(id) +
      '<g stroke="' + INK + '" stroke-width="2.2" stroke-linejoin="round">' +
        '<rect x="46" y="84" width="108" height="64" rx="5" fill="#8a7550"/>' +
        '<path d="M46 84 L100 112 L154 84" fill="none"/>' +
        '<path d="M58 86 V146 M76 86 V146 M94 86 V146 M112 86 V146 M130 86 V146 M148 86 V146" fill="none" opacity=".55"/>' +
        '<rect x="42" y="72" width="116" height="14" rx="4" fill="#b89a68"/>' +
        '<circle cx="100" cy="112" r="9" fill="' + RED + '"/>' +
        '<path d="M100 103 V121 M91 112 H109" fill="none" stroke="' + GOLD + '" stroke-width="2"/>' +
      '</g>' +
      '<text x="100" y="34" text-anchor="middle" font-family="Georgia,serif" font-size="15" fill="' + INK + '" letter-spacing="3" opacity=".7">КЛЕТКА</text>'
    );
  };

  /* ================================================================== */
  /*  ПАРОБОТЫ                                                          */
  /* ================================================================== */
  const bot = {};

  function botBase(id, opts) {
    opts = opts || {};
    const body = opts.body || '#a9672f';
    const body2 = opts.body2 || '#7d4a21';
    const metal = opts.metal || '#8d9aa3';
    return bg(id) +
      '<g stroke="' + INK + '" stroke-width="2.2" stroke-linejoin="round">' +
        // ноги
        '<path d="M70 152 L64 183 H52 L58 150Z" fill="' + body2 + '"/>' +
        '<path d="M130 152 L136 183 H148 L142 150Z" fill="' + body2 + '"/>' +
        '<path d="M53 183 H67 M133 183 H147" fill="none" stroke-width="4"/>' +
        // корпус-печь
        '<path d="M62 76 L138 76 L150 152 L50 152Z" fill="' + body + '"/>' +
        '<path d="M62 76 L80 76 L74 152 L50 152Z" fill="' + body2 + '"/>' +
        // труба
        '<path d="M120 76 L120 44 L134 44 L134 76" fill="' + metal + '"/>' +
        '<path d="M114 44 H140" fill="none" stroke-width="4"/>' +
      '</g>';
  }

  function botFace(id, o) {
    o = o || {};
    if (o.face === 'visor') {
      return '<g stroke="' + INK + '" stroke-width="2">' +
        '<rect x="72" y="80" width="56" height="26" rx="5" fill="#2a2f35"/>' +
        '<path d="M82 93 H94 M106 93 H118" stroke="#ffb43e" stroke-width="4" stroke-linecap="round"/>' +
        '<path d="M78 106 H122" stroke="' + STEEL_D + '" stroke-width="2"/>' +
        '</g>';
    }
    if (o.face === 'spear') {
      return '<g stroke="' + INK + '" stroke-width="2">' +
        '<path d="M70 88 L130 88 L124 108 L76 108Z" fill="#4b3a2a"/>' +
        '<circle cx="86" cy="98" r="5" fill="#ffb43e"/>' +
        '<circle cx="114" cy="98" r="5" fill="#ffb43e"/>' +
        '<path d="M84 114 H116" stroke-width="2" fill="none"/>' +
        '</g>';
    }
    return '<g stroke="' + INK + '" stroke-width="2">' +
      '<circle cx="84" cy="94" r="9" fill="#2a2f35"/><circle cx="116" cy="94" r="9" fill="#2a2f35"/>' +
      '<circle cx="84" cy="94" r="4" fill="#ffb43e"/><circle cx="116" cy="94" r="4" fill="#ffb43e"/>' +
      '<path d="M88 114 Q100 120 112 114" fill="none" stroke-width="2.4"/>' +
      '</g>';
  }

  function furnaceGrate(id) {
    return '<g stroke="' + INK + '" stroke-width="1.8">' +
      '<path d="M78 124 H122 L126 146 H74Z" fill="#2a2018"/>' +
      '<path d="M82 128 H118 M80 134 H120 M78 140 H122" stroke="#e2672f" stroke-width="2.4"/>' +
      '<path d="M92 144 C86 138 90 130 98 126 C96 134 102 136 100 143Z" fill="#ffd36a"/>' +
      '</g>';
  }

  bot.normal = function () {
    const id = nextId('bn');
    return wrap(defs(id) + botBase(id) +
      botFace(id) + furnaceGrate(id) +
      // руки
      '<path d="M50 92 L28 122 L38 128 L58 102" fill="#7d4a21" stroke="' + INK + '" stroke-width="2.2"/>' +
      '<path d="M150 92 L172 122 L162 128 L142 102" fill="#7d4a21" stroke="' + INK + '" stroke-width="2.2"/>' +
      '<circle cx="31" cy="126" r="7" fill="' + STEEL + '" stroke="' + INK + '" stroke-width="2"/>' +
      '<circle cx="169" cy="126" r="7" fill="' + STEEL + '" stroke="' + INK + '" stroke-width="2"/>' +
      // дрова
      '<g stroke="' + INK + '" stroke-width="1.6"><path d="M44 154 L58 142 M42 160 L62 151 M142 154 L156 142 M138 160 L158 151" stroke="#6b4a2a" stroke-width="5"/></g>' +
      '<text x="100" y="30" text-anchor="middle" font-family="Georgia,serif" font-size="13" fill="' + INK + '" letter-spacing="2" opacity=".7">ПАРОБОТ</text>'
    );
  };

  bot.armored = function () {
    const id = nextId('ba');
    return wrap(defs(id) + botBase(id, { body: '#7d8b98', body2: '#55636e', metal: '#c1cbd1' }) +
      // наплечники
      '<g stroke="' + INK + '" stroke-width="2.2" stroke-linejoin="round">' +
        '<path d="M62 76 L38 84 L34 112 L62 104Z" fill="#9aa7b1"/>' +
        '<path d="M138 76 L162 84 L166 112 L138 104Z" fill="#9aa7b1"/>' +
        '<path d="M46 86 L58 82 M154 86 L142 82" stroke="#d7e0e5" stroke-width="2"/>' +
      '</g>' +
      botFace(id, { face: 'visor' }) + furnaceGrate(id) +
      // шлем
      '<g stroke="' + INK + '" stroke-width="2.2">' +
        '<path d="M70 76 Q100 50 130 76 L126 82 H74Z" fill="#aab7c0"/>' +
        '<path d="M100 56 V76" fill="none"/>' +
        '<path d="M86 68 Q100 62 114 68" fill="none" stroke-width="2"/>' +
      '</g>' +
      // щит с НЕ
      '<g transform="rotate(8 160 130)" stroke="' + INK + '" stroke-width="2.2">' +
        '<path d="M146 108 L176 108 L176 140 Q161 154 146 140Z" fill="#9b3a33"/>' +
        '<path d="M151 113 L171 113 L171 137 Q161 147 151 137Z" fill="#c04a40"/>' +
        '<text x="161" y="135" text-anchor="middle" font-family="Georgia,serif" font-size="20" fill="' + PAPER + '">¬</text>' +
      '</g>' +
      '<text x="100" y="30" text-anchor="middle" font-family="Georgia,serif" font-size="13" fill="' + INK + '" letter-spacing="2" opacity=".7">БРОНЕБОТ</text>'
    );
  };

  bot.spearman = function () {
    const id = nextId('bs');
    return wrap(defs(id) + botBase(id, { body: '#8d5a97', body2: '#5f3968', metal: '#b9a5c4' }) +
      botFace(id, { face: 'spear' }) + furnaceGrate(id) +
      // копьё
      '<g stroke="' + INK + '" stroke-width="2">' +
        '<path d="M168 42 L144 172" stroke="#6b4a2a" stroke-width="5"/>' +
        '<path d="M168 42 L158 30 L176 34Z" fill="url(#' + id + '_steel)"/>' +
        '<path d="M162 58 L172 62" stroke-width="3"/>' +
      '</g>' +
      // капюшон
      '<path d="M70 80 Q100 48 130 80 L120 88 H80Z" fill="#6c4a8f" stroke="' + INK + '" stroke-width="2.2"/>' +
      '<path d="M82 72 L118 72" stroke="#a98cc0" stroke-width="2"/>' +
      '<text x="100" y="30" text-anchor="middle" font-family="Georgia,serif" font-size="13" fill="' + INK + '" letter-spacing="2" opacity=".7">КОПЕЙЩИК</text>'
    );
  };

  bot.giant = function () {
    const id = nextId('bg');
    return wrap(defs(id) +
      // фон багровый
      '<rect width="200" height="200" fill="#dcc09a"/>' +
      '<rect width="200" height="200" fill="url(#' + id + '_hatch)" opacity=".35"/>' +
      '<path d="M0 160 Q50 148 100 160 T200 154 V200 H0Z" fill="#c9a87c"/>' +
      '<ellipse cx="100" cy="185" rx="78" ry="9" fill="' + INK + '" opacity=".25"/>' +
      '<g stroke="' + INK + '" stroke-width="2.4" stroke-linejoin="round">' +
        // ноги
        '<path d="M62 148 L52 186 H34 L46 142Z" fill="#5a3326"/>' +
        '<path d="M138 148 L148 186 H166 L154 142Z" fill="#5a3326"/>' +
        // корпус
        '<path d="M46 66 L154 66 L168 154 L32 154Z" fill="#963f35"/>' +
        '<path d="M46 66 L72 66 L64 154 L32 154Z" fill="#722f28"/>' +
        '<path d="M46 66 L154 66 L158 82 L42 82Z" fill="#b95445"/>' +
        // трубы
        '<path d="M58 66 L58 34 H74 L74 66" fill="#7d8b98"/>' +
        '<path d="M126 66 L126 28 H144 L144 66" fill="#7d8b98"/>' +
        '<path d="M52 34 H80 M120 28 H150" fill="none" stroke-width="4"/>' +
        // руки
        '<path d="M32 92 L6 120 L18 132 L46 106Z" fill="#722f28"/>' +
        '<path d="M168 92 L194 120 L182 132 L154 106Z" fill="#722f28"/>' +
        // кулаки
        '<circle cx="10" cy="128" r="12" fill="#8d9aa3"/>' +
        '<circle cx="190" cy="128" r="12" fill="#8d9aa3"/>' +
      '</g>' +
      // лицо
      '<g stroke="' + INK + '" stroke-width="2">' +
        '<path d="M72 88 L128 88 L122 112 L78 112Z" fill="#2a2018"/>' +
        '<path d="M82 98 H94 M106 98 H118" stroke="#ff6b3e" stroke-width="5" stroke-linecap="round"/>' +
        '<path d="M86 118 Q100 124 114 118" fill="none" stroke-width="3"/>' +
      '</g>' +
      // горящая пасть-решётка
      '<g stroke="' + INK + '" stroke-width="1.6">' +
        '<path d="M76 128 H124 L128 148 H72Z" fill="#2a2018"/>' +
        '<path d="M80 132 H120 M78 138 H122 M76 144 H124" stroke="#e2672f" stroke-width="2.5"/>' +
        '<path d="M94 146 C88 138 94 132 102 128 C100 136 106 138 104 146Z" fill="#ffd36a"/>' +
      '</g>' +
      // корона
      '<path d="M70 66 L64 44 L80 56 L92 36 L104 56 L120 38 L128 58 L138 44 L136 66Z" fill="url(#' + id + '_gold)" stroke="' + INK + '" stroke-width="2.2"/>' +
      '<circle cx="92" cy="56" r="3" fill="' + RED + '"/><circle cx="104" cy="52" r="3" fill="' + GREEN + '"/><circle cx="118" cy="56" r="3" fill="' + BLUE + '"/>' +
      '<text x="100" y="24" text-anchor="middle" font-family="Georgia,serif" font-size="12" fill="' + INK + '" letter-spacing="2">ГИГАНТ</text>'
    );
  };

  /* ================================================================== */
  /*  РЫЦАРИ                                                            */
  /* ================================================================== */
  const knight = {};

  function knightBase(id, color, crest) {
    return bg(id) +
      '<g stroke="' + INK + '" stroke-width="2.2" stroke-linejoin="round">' +
        // плащ
        '<path d="M62 82 C46 106 44 148 52 174 L100 184 L148 174 C156 148 154 106 138 82Z" fill="' + color + '"/>' +
        '<path d="M62 82 C50 108 48 146 56 170 L100 180 L144 170 C152 146 150 108 138 82Z" fill="none" opacity=".45"/>' +
        // доспех
        '<path d="M76 84 L124 84 L134 146 L66 146Z" fill="#b9c2c8"/>' +
        '<path d="M76 84 L124 84 L128 100 L72 100Z" fill="#d5dde1"/>' +
        '<path d="M100 100 V146" fill="none" opacity=".5"/>' +
        // ноги
        '<path d="M74 146 L70 180 H86 L94 146Z" fill="#7d8b98"/>' +
        '<path d="M126 146 L130 180 H114 L106 146Z" fill="#7d8b98"/>' +
        // голова / шлем
        '<path d="M80 62 Q100 40 120 62 L122 82 L78 82Z" fill="#c4ced4"/>' +
        '<path d="M84 68 H116 V76 H84Z" fill="#2a2f35"/>' +
        '<path d="M88 72 H96 M104 72 H112" stroke="#7ee0ff" stroke-width="3"/>' +
        '<path d="M100 44 V62" fill="none"/>' +
      '</g>' + (crest || '');
  }

  knight.swordsman = function () {
    const id = nextId('ks');
    return wrap(defs(id) + knightBase(id, RED,
      '<path d="M100 40 C96 20 114 18 116 30 C118 18 132 22 124 42" fill="#c94a40" stroke="' + INK + '" stroke-width="2"/>') +
      // меч
      '<g stroke="' + INK + '" stroke-width="2" stroke-linejoin="round">' +
        '<path d="M158 70 L170 58 L176 64 L164 76Z" fill="' + GOLD + '"/>' +
        '<path d="M164 76 L146 132 L138 140 L136 128 L154 70Z" fill="url(#' + id + '_steel)"/>' +
        '<path d="M136 126 L150 132" stroke-width="5"/>' +
      '</g>' +
      // щит
      '<g stroke="' + INK + '" stroke-width="2.2">' +
        '<path d="M34 96 L66 96 L66 136 Q50 152 34 136Z" fill="#7d2e29"/>' +
        '<path d="M39 101 L61 101 L61 132 Q50 144 39 132Z" fill="#a8322d"/>' +
        '<path d="M50 106 L53 118 L64 118 L55 125 L58 137 L50 130 L42 137 L45 125 L36 118 L47 118Z" fill="' + GOLD + '"/>' +
      '</g>' +
      '<text x="100" y="194" text-anchor="middle" font-family="Georgia,serif" font-size="12" fill="' + INK + '" letter-spacing="2" opacity=".75">МЕЧНИК</text>'
    );
  };

  knight.maceman = function () {
    const id = nextId('km');
    return wrap(defs(id) + knightBase(id, GREEN,
      '<path d="M100 38 L106 18 L112 38 L124 24 L122 46Z" fill="#4f7a4a" stroke="' + INK + '" stroke-width="2"/>') +
      // булава
      '<g stroke="' + INK + '" stroke-width="2" stroke-linejoin="round">' +
        '<path d="M154 80 L164 154" stroke="#6b4a2a" stroke-width="5"/>' +
        '<circle cx="152" cy="72" r="17" fill="url(#' + id + '_steel)"/>' +
        '<path d="M152 50 V44 M152 94 V100 M130 72 H124 M174 72 H180 M137 57 L132 52 M167 87 L172 92 M167 57 L172 52 M137 87 L132 92" stroke-width="5"/>' +
        '<circle cx="152" cy="72" r="5" fill="' + GOLD + '"/>' +
      '</g>' +
      '<g stroke="' + INK + '" stroke-width="2.2">' +
        '<path d="M34 96 L66 96 L66 136 Q50 152 34 136Z" fill="#3c5c38"/>' +
        '<path d="M39 101 L61 101 L61 132 Q50 144 39 132Z" fill="#4f7a4a"/>' +
        '<path d="M50 106 L62 118 M62 106 L38 118 M50 106 V138" fill="none" stroke-width="3" stroke="' + PAPER + '"/>' +
      '</g>' +
      '<text x="100" y="194" text-anchor="middle" font-family="Georgia,serif" font-size="12" fill="' + INK + '" letter-spacing="2" opacity=".75">БУЛАВОНОСЕЦ</text>'
    );
  };

  knight.archer = function () {
    const id = nextId('ka');
    return wrap(defs(id) + knightBase(id, BLUE,
      '<path d="M80 52 Q100 34 120 52 L124 60 H76Z" fill="#3e5f86" stroke="' + INK + '" stroke-width="2"/>') +
      // арбалет
      '<g stroke="' + INK + '" stroke-width="2" stroke-linejoin="round" transform="rotate(-12 156 112)">' +
        '<path d="M130 112 H182" stroke="#6b4a2a" stroke-width="6"/>' +
        '<path d="M140 90 Q174 112 140 134" fill="none" stroke="' + STEEL_D + '" stroke-width="5"/>' +
        '<path d="M140 90 L140 134" fill="none" stroke="' + PAPER + '" stroke-width="1.6"/>' +
        '<path d="M170 106 L186 112 L170 118Z" fill="url(#' + id + '_steel)"/>' +
      '</g>' +
      '<g stroke="' + INK + '" stroke-width="2.2">' +
        '<path d="M34 96 L66 96 L66 136 Q50 152 34 136Z" fill="#28405c"/>' +
        '<path d="M39 101 L61 101 L61 132 Q50 144 39 132Z" fill="#3e5f86"/>' +
        '<path d="M44 112 H56 M50 104 V124 M44 124 L56 104" fill="none" stroke="' + PAPER + '" stroke-width="2.4"/>' +
      '</g>' +
      '<text x="100" y="194" text-anchor="middle" font-family="Georgia,serif" font-size="12" fill="' + INK + '" letter-spacing="2" opacity=".75">АРБАЛЕТЧИК</text>'
    );
  };

  knight.cook = function () {
    const id = nextId('kc');
    return wrap(defs(id) + bg(id) +
      '<g stroke="' + INK + '" stroke-width="2.2" stroke-linejoin="round">' +
        '<path d="M62 92 C48 118 46 154 54 176 L100 184 L146 176 C154 154 152 118 138 92Z" fill="#d8b56b"/>' +
        '<path d="M78 92 L122 92 L132 148 L68 148Z" fill="#f0e2c2"/>' +
        '<path d="M76 118 H124 M100 92 V148" fill="none" opacity=".35"/>' +
        '<path d="M78 148 L74 180 H90 L96 148Z" fill="#8d6d3f"/>' +
        '<path d="M122 148 L126 180 H110 L104 148Z" fill="#8d6d3f"/>' +
        // голова
        '<circle cx="100" cy="76" r="20" fill="#e7b98f"/>' +
        '<path d="M82 70 Q100 58 118 70" fill="none" stroke-width="3"/>' +
        '<circle cx="93" cy="76" r="2.4" fill="' + INK + '"/><circle cx="107" cy="76" r="2.4" fill="' + INK + '"/>' +
        '<path d="M92 86 Q100 92 108 86" fill="none" stroke-width="2"/>' +
        // колпак
        '<path d="M78 62 Q100 32 122 62 L118 70 Q100 60 82 70Z" fill="#f6efdd"/>' +
        '<path d="M86 50 Q100 24 114 50" fill="#f6efdd"/>' +
      '</g>' +
      // половник
      '<g stroke="' + INK + '" stroke-width="2">' +
        '<path d="M154 108 L166 168" stroke="#6b4a2a" stroke-width="4"/>' +
        '<ellipse cx="152" cy="104" rx="12" ry="9" fill="' + STEEL + '"/>' +
      '</g>' +
      // котёл
      '<g stroke="' + INK + '" stroke-width="2">' +
        '<path d="M30 140 Q50 130 70 140 L64 166 Q50 174 36 166Z" fill="#4b4b4b"/>' +
        '<path d="M34 140 Q50 132 66 140" fill="none" stroke="#f0a94a" stroke-width="4"/>' +
        '<path d="M38 132 C42 124 46 128 48 120 M56 132 C60 124 64 128 66 120" fill="none" stroke="#cfd6da" stroke-width="2"/>' +
      '</g>' +
      '<text x="100" y="194" text-anchor="middle" font-family="Georgia,serif" font-size="12" fill="' + INK + '" letter-spacing="2" opacity=".75">ПОВАР</text>'
    );
  };

  knight.mag = function () {
    const id = nextId('kg');
    return wrap(defs(id) + bg(id) +
      '<g stroke="' + INK + '" stroke-width="2.2" stroke-linejoin="round">' +
        '<path d="M64 88 C48 112 46 154 54 178 L100 186 L146 178 C154 154 152 112 136 88Z" fill="' + PURPLE + '"/>' +
        '<path d="M64 88 C54 114 52 150 58 174 L100 182 L142 174 C148 150 146 114 136 88Z" fill="none" opacity=".45"/>' +
        '<path d="M78 90 L122 90 L130 152 L70 152Z" fill="#7d5aa3"/>' +
        '<path d="M100 90 V152" fill="none" opacity=".4"/>' +
        // борода и лицо
        '<circle cx="100" cy="70" r="19" fill="#e7b98f"/>' +
        '<path d="M84 82 Q100 116 116 82 Q116 104 100 108 Q84 104 84 82Z" fill="#d9d4c8"/>' +
        '<circle cx="93" cy="69" r="2.2" fill="' + INK + '"/><circle cx="107" cy="69" r="2.2" fill="' + INK + '"/>' +
        // шляпа
        '<path d="M76 54 L100 18 L124 54Z" fill="#4a3266"/>' +
        '<path d="M70 54 H130" stroke-width="4"/>' +
        '<path d="M100 24 L104 38" stroke="' + GOLD + '" stroke-width="3"/>' +
      '</g>' +
      // посох
      '<g stroke="' + INK + '" stroke-width="2">' +
        '<path d="M160 84 L150 174" stroke="#6b4a2a" stroke-width="5"/>' +
        '<circle cx="161" cy="76" r="13" fill="#8b6cc4"/>' +
        '<circle cx="161" cy="76" r="6" fill="#d9b3ff"/>' +
        '<path d="M148 64 L156 70 M174 64 L166 70" stroke="' + GOLD + '" stroke-width="2"/>' +
      '</g>' +
      '<g font-family="Georgia,serif" fill="' + PAPER + '" font-size="14">' +
        '<text x="30" y="122">∧</text><text x="42" y="146">∨</text><text x="30" y="170">¬</text>' +
      '</g>' +
      '<text x="100" y="196" text-anchor="middle" font-family="Georgia,serif" font-size="12" fill="' + INK + '" letter-spacing="2" opacity=".75">МАГ</text>'
    );
  };

  /* ================================================================== */
  /*  СПЕЦКАРТЫ                                                         */
  /* ================================================================== */
  const special = {};

  special.greed = function () {
    const id = nextId('spg');
    return wrap(defs(id) + bg(id) +
      '<g stroke="' + INK + '" stroke-width="2.2" stroke-linejoin="round">' +
        '<path d="M46 92 L62 168 H138 L154 92Z" fill="#b58a3e"/>' +
        '<path d="M54 100 L68 160 H132 L146 100Z" fill="#d8a33f"/>' +
        '<path d="M46 92 L154 92 L146 112 L54 112Z" fill="#8f6828"/>' +
        '<path d="M100 112 V160" fill="none" opacity=".4"/>' +
      '</g>' +
      '<g fill="' + GOLD + '" stroke="' + INK + '" stroke-width="1.8">' +
        '<circle cx="64" cy="76" r="13"/><circle cx="88" cy="64" r="13"/><circle cx="114" cy="72" r="13"/><circle cx="136" cy="60" r="11"/>' +
        '<circle cx="76" cy="50" r="9"/><circle cx="104" cy="44" r="9"/>' +
      '</g>' +
      '<g font-family="Georgia,serif" font-size="13" fill="' + INK + '" text-anchor="middle">' +
        '<text x="64" y="81">✦</text><text x="88" y="69">✦</text><text x="114" y="77">✦</text><text x="136" y="64">✦</text>' +
      '</g>' +
      // рука
      '<path d="M150 186 C132 170 146 148 160 160 C166 150 182 152 182 168 C192 164 198 178 188 186Z" fill="#e7b98f" stroke="' + INK + '" stroke-width="2"/>' +
      '<text x="100" y="34" text-anchor="middle" font-family="Georgia,serif" font-size="17" fill="' + INK + '" letter-spacing="3">ЖАДНОСТЬ</text>'
    );
  };

  special.market = function () {
    const id = nextId('spm');
    return wrap(defs(id) + bg(id) +
      '<g stroke="' + INK + '" stroke-width="2.4" stroke-linejoin="round">' +
        '<path d="M100 44 V168" stroke="#6b4a2a" stroke-width="6"/>' +
        '<path d="M52 68 H148" stroke="#6b4a2a" stroke-width="5"/>' +
        '<path d="M46 96 L70 66 L94 96Z" fill="#c9a45c"/>' +
        '<path d="M106 96 L130 66 L154 96Z" fill="#c9a45c"/>' +
        '<path d="M46 92 H94 M106 92 H154" stroke-width="5"/>' +
        '<path d="M36 104 H104 M96 104 H164" fill="none" stroke-width="2"/>' +
        '<path d="M64 104 L58 130 M84 104 L90 130 M116 104 L110 130 M136 104 L142 130" fill="none"/>' +
        '<path d="M54 132 H98 L92 148 H60Z" fill="#b8893a"/>' +
        '<path d="M106 132 H150 L144 148 H112Z" fill="#b8893a"/>' +
      '</g>' +
      '<g fill="' + GOLD + '" stroke="' + INK + '" stroke-width="1.6">' +
        '<circle cx="70" cy="140" r="6"/><circle cx="84" cy="140" r="6"/><circle cx="122" cy="140" r="6"/><circle cx="136" cy="140" r="6"/>' +
      '</g>' +
      '<text x="100" y="34" text-anchor="middle" font-family="Georgia,serif" font-size="17" fill="' + INK + '" letter-spacing="3">РЫНОК</text>'
    );
  };

  special.thief = function () {
    const id = nextId('spt');
    return wrap(defs(id) + bg(id) +
      '<g stroke="' + INK + '" stroke-width="2.2" stroke-linejoin="round">' +
        // плащ
        '<path d="M62 92 C48 120 46 156 54 180 L100 188 L146 180 C154 156 152 120 138 92Z" fill="#3b3a3f"/>' +
        '<path d="M78 92 L122 92 L128 148 L72 148Z" fill="#5a585e"/>' +
        // маска
        '<path d="M74 66 Q100 44 126 66 L124 96 Q100 108 76 96Z" fill="#6f6d73"/>' +
        '<path d="M78 70 Q100 58 122 70 L120 78 Q100 70 80 78Z" fill="#2a2a2d"/>' +
        '<circle cx="90" cy="82" r="4" fill="#ffd36a"/><circle cx="110" cy="82" r="4" fill="#ffd36a"/>' +
        // уши-маска
        '<path d="M74 66 L64 52 L82 60Z M126 66 L136 52 L118 60Z" fill="#4a484d"/>' +
      '</g>' +
      // карта в руке
      '<g transform="rotate(-12 154 132)" stroke="' + INK + '" stroke-width="1.8">' +
        '<rect x="138" y="112" width="38" height="48" rx="3" fill="#f0e2c2"/>' +
        '<path d="M144 122 H170 M144 130 H166 M144 138 H170" stroke-width="1.4"/>' +
        '<circle cx="157" cy="150" r="6" fill="' + RED + '"/>' +
      '</g>' +
      '<text x="100" y="34" text-anchor="middle" font-family="Georgia,serif" font-size="17" fill="' + INK + '" letter-spacing="3">ВОР</text>'
    );
  };

  special.dragon = function () {
    const id = nextId('spd');
    return wrap(defs(id) + bg(id) +
      '<g stroke="' + INK + '" stroke-width="2.2" stroke-linejoin="round">' +
        // тело
        '<path d="M36 150 C50 110 80 108 104 122 C118 130 140 128 154 112 C166 126 160 148 142 158 C122 172 88 170 72 160Z" fill="#9c3b32"/>' +
        '<path d="M44 146 C58 120 80 118 100 130" fill="none" stroke="#d35a4a" stroke-width="4"/>' +
        // крыло
        '<path d="M90 116 C82 82 58 62 34 58 C48 82 54 100 62 122Z" fill="#7d2e29"/>' +
        '<path d="M62 100 L48 76 M74 108 L62 84 M82 114 L76 94" fill="none" stroke="#c04a40" stroke-width="2"/>' +
        // голова
        '<path d="M148 112 C148 90 164 78 182 82 L190 94 L182 106 L184 122 L164 128Z" fill="#9c3b32"/>' +
        '<path d="M178 84 L184 72 L190 86" fill="' + GOLD + '"/>' +
        '<path d="M184 96 L196 98" stroke-width="3"/>' +
        '<circle cx="172" cy="92" r="4" fill="#ffd36a"/>' +
        // хвост
        '<path d="M36 150 C20 158 16 174 30 180 C38 170 44 164 52 160Z" fill="#7d2e29"/>' +
      '</g>' +
      // огонь
      flame(id, 199, 106, 1.2) +
      '<text x="100" y="34" text-anchor="middle" font-family="Georgia,serif" font-size="17" fill="' + INK + '" letter-spacing="3">ДРАКОН</text>'
    );
  };

  special.mag = function () { return knight.mag(); };

  /* Клетка-ловушка: по правилам — карта, ловящая любого ПароБота. */
  special.cell = function () {
    const id = nextId('spc');
    return wrap(defs(id) + bg(id) +
      '<g stroke="' + INK + '" stroke-width="2.4" stroke-linejoin="round">' +
        // основание
        '<path d="M46 150 L154 150 L146 182 L54 182Z" fill="#6b5638"/>' +
        '<path d="M46 150 L154 150 L152 160 L48 160Z" fill="#8a6f45"/>' +
        // каркас
        '<path d="M52 150 V62 L148 62 V150" fill="none" stroke="#7d8a93" stroke-width="7"/>' +
        '<path d="M52 150 V62 L148 62 V150" fill="none" stroke="#aab6bd" stroke-width="3"/>' +
        // прутья
        '<g stroke="#9aa7b1" stroke-width="3.2">' +
          '<path d="M68 64 V150"/><path d="M84 64 V150"/><path d="M100 64 V150"/>' +
          '<path d="M116 64 V150"/><path d="M132 64 V150"/>' +
        '</g>' +
        // верхняя балка с крюком
        '<path d="M44 62 H156" stroke="#5c6a73" stroke-width="8" stroke-linecap="round"/>' +
        '<path d="M100 62 V44" stroke="#5c6a73" stroke-width="5"/>' +
        '<path d="M100 44 q-10 0 -10 10 q0 8 10 8" fill="none" stroke="#5c6a73" stroke-width="4"/>' +
        // приманка
        '<circle cx="100" cy="104" r="11" fill="#c9a45c" stroke="' + INK + '" stroke-width="2"/>' +
        '<path d="M100 96 V112 M93 104 H107" stroke="' + INK + '" stroke-width="2.4"/>' +
      '</g>' +
      '<text x="100" y="34" text-anchor="middle" font-family="Georgia,serif" font-size="17" fill="' + INK + '" letter-spacing="3">КЛЕТКА</text>'
    );
  };

  /* ================================================================== */
  /*  ЛОГИЧЕСКИЕ СХЕМЫ ДЛЯ КАРТ ПАРОБОТОВ                               */
  /* ================================================================== */
  const LOGIC_NAMES = { rock: 'КАМЕНЬ', scissors: 'НОЖНИЦЫ', paper: 'БУМАГА' };
  const LOGIC_LABELS = { and: 'И', or: 'ИЛИ', not: 'НЕ', xor: 'XOR' };

  function logicParts(condition) {
    const c = String(condition || '').trim();
    if (c.indexOf('&&') >= 0) {
      return { op: 'and', inputs: c.split('&&').map(function (x) { return x.trim().replace(/^!/, '').trim(); }) };
    }
    if (c.indexOf('^') >= 0) {
      return { op: 'xor', inputs: c.split('^').map(function (x) { return x.trim().replace(/^!/, '').trim(); }) };
    }
    if (c.charAt(0) === '!') {
      return { op: 'not', inputs: [c.slice(1).trim()] };
    }
    if (c.indexOf('||') >= 0) {
      return { op: 'or', inputs: c.split('||').map(function (x) { return x.trim().replace(/^!/, '').trim(); }) };
    }
    return { op: 'or', inputs: [] };
  }

  function logicIcon(kind, x, y) {
    const g = '<g transform="translate(' + x + ' ' + y + ')">';
    if (kind === 'rock') {
      return g + '<path d="M-5 3 L-4 -4 L1 -6 L6 -2 L5 4 L0 6 Z" fill="#9b907f" stroke="' + INK + '" stroke-width="1.2"/>' +
        '<path d="M-3 -2 L1 -4 M0 4 L4 1" stroke="#6d6357" stroke-width="1"/>' + '</g>';
    }
    if (kind === 'scissors') {
      return g +
        '<path d="M-5 -5 L5 5 M-5 5 L5 -5" stroke="' + STEEL_D + '" stroke-width="2.1" stroke-linecap="round"/>' +
        '<circle cx="-6" cy="-5" r="2.1" fill="none" stroke="' + INK + '" stroke-width="1.1"/>' +
        '<circle cx="-6" cy="5" r="2.1" fill="none" stroke="' + INK + '" stroke-width="1.1"/>' +
        '<circle cx="0" cy="0" r="1.2" fill="' + GOLD + '" stroke="' + INK + '" stroke-width=".7"/>' +
        '</g>';
    }
    if (kind === 'paper') {
      return g + '<path d="M-5 -6 H2 L6 -2 V6 H-5 Z" fill="#f7edd3" stroke="' + INK + '" stroke-width="1.2"/>' +
        '<path d="M2 -6 V-2 H6 M-2 -1 H3 M-2 2 H3 M-2 5 H1" fill="none" stroke="#8d7957" stroke-width=".9"/>' + '</g>';
    }
    return '';
  }

  function logicGate(op, x, y, h) {
    const mid = y + h / 2;
    if (op === 'and') {
      return '<path d="M' + x + ' ' + y + ' H' + (x + 20) + ' A' + (h / 2) + ' ' + (h / 2) + ' 0 0 1 ' + (x + 20) + ' ' + (y + h) +
        ' H' + x + ' Z" fill="#efe0bb" stroke="' + INK + '" stroke-width="1.8"/>';
    }
    if (op === 'not') {
      return '<path d="M' + x + ' ' + y + ' L' + (x + 35) + ' ' + mid + ' L' + x + ' ' + (y + h) + ' Z" fill="#efe0bb" stroke="' + INK + '" stroke-width="1.8"/>' +
        '<circle cx="' + (x + 39) + '" cy="' + mid + '" r="3.4" fill="#efe0bb" stroke="' + INK + '" stroke-width="1.6"/>';
    }
    const dx = op === 'xor' ? 5 : 0;
    const body = '<path d="M' + (x + dx) + ' ' + y + ' Q' + (x + 24 + dx) + ' ' + y + ' ' + (x + 40 + dx) + ' ' + mid +
      ' Q' + (x + 24 + dx) + ' ' + (y + h) + ' ' + (x + dx) + ' ' + (y + h) +
      ' Q' + (x + 12 + dx) + ' ' + mid + ' ' + (x + dx) + ' ' + y + ' Z" fill="#efe0bb" stroke="' + INK + '" stroke-width="1.8"/>';
    if (op === 'xor') {
      return '<path d="M' + (x - 7) + ' ' + y + ' Q' + (x + 5) + ' ' + mid + ' ' + (x - 7) + ' ' + (y + h) +
        '" fill="none" stroke="' + INK + '" stroke-width="1.6"/>' + body;
    }
    return body;
  }

  /** Большая схема для лицевой карты ПароБота: входы → логический вентиль → БОТ. */
  function logicSchematic(type) {
    const bot = KVP.BOTS && KVP.BOTS[type];
    if (!bot) return '';
    const p = logicParts(bot.condition);
    const label = LOGIC_LABELS[p.op] || '?';
    const inputs = p.inputs.slice(0, 2);
    const midY = 27;
    const rows = inputs.length > 1 ? [16, 38] : [midY];
    const gx = p.op === 'xor' ? 76 : 70;
    const gateEnd = p.op === 'not' ? gx + 44 : (p.op === 'xor' ? gx + 45 : gx + 40);
    let body = '';

    inputs.forEach(function (input, i) {
      const y = rows[i];
      body += '<path d="M56 ' + y + ' H' + (p.op === 'xor' ? gx - 7 : gx) + '" stroke="' + INK + '" stroke-width="1.4" fill="none"/>' +
        logicIcon(input, 14, y) +
        '<text x="24" y="' + (y + 2.6) + '" font-family="Georgia,serif" font-size="7.2" font-weight="700" fill="' + INK + '">' +
          (LOGIC_NAMES[input] || input.toUpperCase()) + '</text>';
    });

    body += logicGate(p.op, gx, 8, 38);
    body += '<text x="' + (gx + (p.op === 'not' ? 17 : p.op === 'xor' ? 28 : 25)) + '" y="' + (midY + 3.2) +
      '" text-anchor="middle" font-family="Georgia,serif" font-size="9" font-weight="700" fill="' + INK + '">' + label + '</text>';
    body += '<path d="M' + gateEnd + ' ' + midY + ' H136" stroke="' + INK + '" stroke-width="1.4" fill="none"/>' +
      '<path d="M132 ' + (midY - 4) + ' L138 ' + midY + ' L132 ' + (midY + 4) + '" fill="none" stroke="' + INK + '" stroke-width="1.5"/>' +
      '<text x="143" y="' + (midY + 3) + '" font-family="Georgia,serif" font-size="8" font-weight="700" fill="' + GREEN + '">ПРОБИТ</text>';

    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 190 54" role="img" class="logic-svg" aria-label="Логическая схема: ' +
      String(bot.conditionText || bot.condition || '').replace(/"/g, '&quot;') + '">' +
      '<rect x="1" y="1" width="188" height="52" rx="4" fill="#f6e9c8" stroke="#9b7b45" stroke-width="1.2"/>' +
      '<path d="M4 49 H186" stroke="#c9ab6a" stroke-width="1" opacity=".55"/>' +
      body + '</svg>';
  }

  /** Мини-вентиль для компактной карты: только форма и название операции. */
  function logicMini(type) {
    const bot = KVP.BOTS && KVP.BOTS[type];
    if (!bot) return '';
    const p = logicParts(bot.condition);
    let gate = '';
    if (p.op === 'and') {
      gate = '<path d="M4 2 H14 A7 7 0 0 1 14 16 H4 Z" fill="currentColor" fill-opacity=".16" stroke="currentColor" stroke-width="1.3"/>';
    } else if (p.op === 'not') {
      gate = '<path d="M4 2 L21 9 L4 16 Z" fill="currentColor" fill-opacity=".16" stroke="currentColor" stroke-width="1.3"/>' +
        '<circle cx="24" cy="9" r="2.2" fill="none" stroke="currentColor" stroke-width="1.2"/>';
    } else {
      gate = '<path d="M4 2 Q17 2 25 9 Q17 16 4 16 Q11 9 4 2 Z" fill="currentColor" fill-opacity=".16" stroke="currentColor" stroke-width="1.3"/>' +
        (p.op === 'xor' ? '<path d="M0 2 Q7 9 0 16" fill="none" stroke="currentColor" stroke-width="1.2"/>' : '');
    }
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 28 18" class="logic-mini-svg" aria-hidden="true" focusable="false">' +
      '<path d="M0 5 H4 M0 13 H4" stroke="currentColor" stroke-width="1.2"/>' + gate + '</svg>';
  }

  /* ================================================================== */
  /*  ГЕРОЙСКАЯ ИЛЛЮСТРАЦИЯ ДЛЯ МЕНЮ                                    */
  /* ================================================================== */
  KVP.SVG = {
    trophy: function (type) { return trophy[type] ? trophy[type]() : trophy.rock(); },
    bot: function (type) { return bot[type] ? bot[type]() : bot.normal(); },
    knight: function (type) { return knight[type] ? knight[type]() : knight.swordsman(); },
    logic: function (type) { return logicSchematic(type); },
    logicMini: function (type) { return logicMini(type); },
    special: function (type) { return special[type] ? special[type]() : special.greed(); },

    /** SVG-строка в data-URL для Three.js-текстур и <img>. */
    dataUrl: function (svg) {
      return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
    },

    /** Небольшая печать-иконка щита для HUD. */
    shield: function () {
      return '<svg viewBox="0 0 32 36" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
        '<path d="M16 2 L29 7 V18 Q29 29 16 34 Q3 29 3 18 V7Z" fill="#9aa7b1" stroke="#241a12" stroke-width="2"/>' +
        '<path d="M16 6 L25 9 V18 Q25 26 16 30 Q7 26 7 18 V9Z" fill="#c4ced4"/>' +
        '<path d="M16 10 V26 M10 16 H22" stroke="#56636b" stroke-width="2"/>' +
        '</svg>';
    },

    /** Иконка силы — меч, как на картах. */
    sword: function () {
      return '<svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
        '<path d="M22 3 L28 5 L26 11 L12 25 L7 26 L8 21Z" fill="#c4ced4" stroke="#241a12" stroke-width="2"/>' +
        '<path d="M8 21 L5 28 L12 25" fill="#d8a33f" stroke="#241a12" stroke-width="2"/>' +
        '<path d="M13 20 L17 24" stroke="#241a12" stroke-width="2"/>' +
        '</svg>';
    },

    /** Декоративный уголок карты. */
    corner: function () {
      return '<svg viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
        '<path d="M2 38 V10 Q2 2 10 2 H38" fill="none" stroke="#b38948" stroke-width="2"/>' +
        '<path d="M8 32 V14 Q8 8 14 8 H32" fill="none" stroke="#7a5a2c" stroke-width="1"/>' +
        '<circle cx="10" cy="10" r="3" fill="#b38948"/>' +
        '</svg>';
    },

    /** Крупная сцена для главного меню: рыцарь и ПароБот. */
    hero: function () {
      return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 360" preserveAspectRatio="xMidYMid meet">' +
        '<defs>' +
          '<radialGradient id="hero_glow" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#ffb24a" stop-opacity=".85"/><stop offset="1" stop-color="#ffb24a" stop-opacity="0"/></radialGradient>' +
          '<linearGradient id="hero_sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#161a2c"/><stop offset=".65" stop-color="#3a2b32"/><stop offset="1" stop-color="#120f14"/></linearGradient>' +
          '<pattern id="hero_brick" width="46" height="24" patternUnits="userSpaceOnUse"><path d="M0 0H46V24H0Z" fill="none" stroke="#2b2430" stroke-width="2"/><path d="M23 0V24" stroke="#2b2430" stroke-width="2"/></pattern>' +
        '</defs>' +
        '<rect width="800" height="360" fill="url(#hero_sky)"/>' +
        '<circle cx="560" cy="120" r="150" fill="url(#hero_glow)" opacity=".5"/>' +
        // арки
        '<g opacity=".7">' +
          '<path d="M80 360 V190 Q80 90 190 90 Q300 90 300 190 V360Z" fill="#1c1822" stroke="#3b3340" stroke-width="4"/>' +
          '<path d="M500 360 V210 Q500 120 600 120 Q700 120 700 210 V360Z" fill="#18151e" stroke="#3b3340" stroke-width="4"/>' +
        '</g>' +
        '<rect y="300" width="800" height="60" fill="#0d0b10"/>' +
        '<rect y="300" width="800" height="60" fill="url(#hero_brick)" opacity=".6"/>' +
        // факелы
        '<g><circle cx="180" cy="180" r="42" fill="url(#hero_glow)"/><path d="M180 200 C170 190 174 174 180 164 C186 174 190 190 180 200Z" fill="#ffb24a"/><path d="M178 198 C174 192 176 186 180 180 C184 186 184 192 178 198Z" fill="#ffe6a0"/></g>' +
        '<g><circle cx="640" cy="200" r="46" fill="url(#hero_glow)"/><path d="M640 224 C628 212 632 192 640 180 C648 192 652 212 640 224Z" fill="#ffb24a"/><path d="M638 220 C633 212 636 204 640 196 C644 204 644 212 638 220Z" fill="#ffe6a0"/></g>' +
        // пол
        '<path d="M0 360 L120 300 H680 L800 360Z" fill="#241c1c"/>' +
        '<path d="M120 300 H680 M80 330 H720" stroke="#3b2e2b" stroke-width="2" opacity=".7"/>' +
        // рыцарь (левая фигура, крупно)
        '<g transform="translate(200 118) scale(1.35)" stroke="#120e0c" stroke-width="4" stroke-linejoin="round">' +
          '<path d="M-52 120 C-72 150 -72 196 -62 220 L0 232 L62 220 C72 196 72 150 52 120Z" fill="#8f2f2a"/>' +
          '<path d="M-30 120 L30 120 L42 196 L-42 196Z" fill="#9aa7b1"/>' +
          '<path d="M-30 120 L30 120 L32 142 L-32 142Z" fill="#c4ced4"/>' +
          '<path d="M-24 86 Q0 58 24 86 L27 120 L-27 120Z" fill="#c4ced4"/>' +
          '<path d="M-20 94 H20 V108 H-20Z" fill="#24201e"/>' +
          '<path d="M-14 100 H-4 M4 100 H14" stroke="#7ee0ff" stroke-width="4"/>' +
          '<path d="M0 64 V88" stroke="#120e0c"/>' +
          '<path d="M0 58 C-8 28 16 24 18 42 C22 24 40 32 28 60" fill="#c94a40"/>' +
          // меч
          '<path d="M-72 30 L-58 18 L-52 24 L-66 36Z" fill="#d8a33f"/>' +
          '<path d="M-62 36 L-48 150 L-40 158 L-38 142 L-58 34Z" fill="#c4ced4"/>' +
          '<path d="M-52 144 L-34 150" stroke="#120e0c" stroke-width="7"/>' +
          // щит
          '<g><path d="M34 132 L78 132 L78 184 Q56 206 34 184Z" fill="#7d2e29"/><path d="M40 138 L72 138 L72 178 Q56 194 40 178Z" fill="#a8322d"/><path d="M56 146 L60 162 L76 162 L63 172 L67 190 L56 180 L45 190 L49 172 L36 162 L52 162Z" fill="#d8a33f"/></g>' +
        '</g>' +
        // паробот (правая фигура)
        '<g transform="translate(600 120) scale(1.35)" stroke="#120e0c" stroke-width="4" stroke-linejoin="round">' +
          '<path d="M-44 126 L-56 220 H-26 L-18 128Z" fill="#5a3326"/>' +
          '<path d="M44 126 L56 220 H26 L18 128Z" fill="#5a3326"/>' +
          '<path d="M-62 0 L62 0 L78 126 L-78 126Z" fill="#96513a"/>' +
          '<path d="M-62 0 L-30 0 L-38 126 L-78 126Z" fill="#6f362a"/>' +
          '<path d="M-30 -36 L-30 -78 H-6 L-6 -36Z" fill="#7d8b98"/>' +
          '<path d="M18 -32 L18 -86 H42 L42 -32Z" fill="#7d8b98"/>' +
          '<circle cx="-2" cy="-86" r="14" fill="#3a2a22"/><circle cx="30" cy="-92" r="14" fill="#3a2a22"/>' +
          '<circle cx="-2" cy="-96" r="7" fill="#ffb24a"/><circle cx="30" cy="-102" r="7" fill="#ffb24a"/>' +
          '<path d="M-40 16 L40 16 L48 44 L-48 44Z" fill="#2a2018"/>' +
          '<path d="M-36 24 H36 M-40 34 H40" stroke="#e2672f" stroke-width="6"/>' +
          '<path d="M-78 20 L-112 56 L-96 70 L-64 44Z" fill="#6f362a"/>' +
          '<path d="M78 20 L112 56 L96 70 L64 44Z" fill="#6f362a"/>' +
          '<circle cx="-112" cy="66" r="14" fill="#8d9aa3"/><circle cx="112" cy="66" r="14" fill="#8d9aa3"/>' +
        '</g>' +
        // логические символы в воздухе
        '<g font-family="Georgia,serif" fill="#d8a33f" opacity=".8" font-size="34">' +
          '<text x="350" y="100">∧</text><text x="410" y="150">∨</text><text x="330" y="180">¬</text>' +
        '</g>' +
        // пыль
        '<g fill="#ffcf7a" opacity=".5"><circle cx="120" cy="90" r="2"/><circle cx="260" cy="60" r="1.5"/><circle cx="380" cy="120" r="2"/><circle cx="500" cy="70" r="1.5"/><circle cx="730" cy="100" r="2"/><circle cx="680" cy="40" r="1.5"/></g>' +
      '</svg>';
    }
  };
})();
