/*
 * main.js — запуск игры, главное меню, справка и настройки.
 */
(function () {
  'use strict';
  const KVP = (window.KVP = window.KVP || {});
  const UI = KVP.UI;
  const Menu = (KVP.Menu = {});

  let helpReturn = 'menu';
  let settingsReturn = 'menu';

  function el(id) { return document.getElementById(id); }
  function show(id) { const e = el(id); if (e) e.classList.remove('hidden'); }
  function hide(id) { const e = el(id); if (e) e.classList.add('hidden'); }

  Menu.init = function () {
    // декоративные карты на обложке
    const showcase = el('menu-cards');
    if (showcase) {
      showcase.innerHTML =
        '<div class="showcase-card">' + UI.bot('armored') + '</div>' +
        '<div class="showcase-card mid">' + UI.knight('cook') + '</div>' +
        '<div class="showcase-card">' + UI.trophy('rock') + '</div>';
    }
    const hero = el('menu-hero');
    if (hero) hero.innerHTML = KVP.SVG.hero();

    const helpBeast = el('help-beasts');
    if (helpBeast) {
      helpBeast.innerHTML = ['normal', 'armored', 'spearman', 'giant', 'titan'].map(function (t) {
        return '<div class="help-card">' + UI.bot(t) + '</div>';
      }).join('');
    }
    const helpCards = el('help-cards');
    if (helpCards) {
      helpCards.innerHTML = KVP.TROPHY_LIST.map(function (t) {
        return '<div class="help-card">' + UI.trophy(t) + '</div>';
      }).join('') +
        '<div class="help-card">' + UI.knight('mag') + '</div>' +
        '<div class="help-card">' + UI.special('dragon') + '</div>';
    }

    bindMenu();
    bindHelp();
    bindSettings();
    Menu.refresh();

    // Звук можно включить только после действия пользователя.
    const unlock = function () {
      KVP.Audio.init();
      KVP.Audio.resume();
      document.removeEventListener('pointerdown', unlock);
      document.removeEventListener('keydown', unlock);
    };
    document.addEventListener('pointerdown', unlock);
    document.addEventListener('keydown', unlock);

    // Escape закрывает справку/настройки поверх игры.
    document.addEventListener('keydown', function (e) {
      if (e.code !== 'Escape') return;
      if (!el('screen-help').classList.contains('hidden')) {
        e.stopPropagation(); e.preventDefault(); closeHelp();
      } else if (!el('screen-settings').classList.contains('hidden')) {
        e.stopPropagation(); e.preventDefault(); closeSettings();
      }
    }, true);
  };

  /* ------------------------------------------------------------------ */
  /*  МЕНЮ                                                              */
  /* ------------------------------------------------------------------ */
  function bindMenu() {
    const on = function (id, fn) {
      const e = el(id);
      if (e) e.addEventListener('click', function (ev) { ev.preventDefault(); fn(ev); });
    };
    on('btn-new-game', function () {
      KVP.Audio.init();
      KVP.Audio.resume();
      hide('screen-menu');
      Menu.newGame();
    });
    on('btn-continue', function () {
      KVP.Audio.init();
      KVP.Audio.resume();
      hide('screen-menu');
      if (!KVP.Game.continueGame()) {
        show('screen-menu');
        Menu.refresh();
      }
    });
    const diffs = el('menu-difficulty');
    if (diffs) {
      diffs.addEventListener('click', function (e) {
        const b = e.target.closest('[data-diff]');
        if (!b) return;
        KVP.Game.saveSettings({ difficulty: b.getAttribute('data-diff') });
        refreshDifficulty();
        KVP.Audio.play('card');
      });
    }
    on('btn-menu-help', function () { Menu.openHelp('menu'); });
    on('btn-menu-settings', function () { Menu.openSettings('menu'); });
    on('btn-menu-about', function () {
      const a = el('about-block');
      if (a) a.classList.toggle('hidden');
    });
  }

  Menu.newGame = function () {
    const s = KVP.Game.getSettings();
    KVP.Game.newGame(s.difficulty || 'normal');
  };

  function refreshDifficulty() {
    const s = KVP.Game.getSettings();
    const host = el('menu-difficulty');
    if (host) {
      host.querySelectorAll('[data-diff]').forEach(function (b) {
        b.classList.toggle('active', b.getAttribute('data-diff') === s.difficulty);
      });
    }
    const desc = el('difficulty-desc');
    if (desc) {
      const d = KVP.DIFFICULTY[s.difficulty] || KVP.DIFFICULTY.normal;
      desc.textContent = d.name + ' — ' + d.desc;
    }
  }

  Menu.refresh = function () {
    const save = KVP.Game.getSaveInfo();
    refreshDifficulty();
    const cont = el('btn-continue');
    if (cont) {
      if (save) {
        cont.disabled = false;
        cont.innerHTML = '▶ Продолжить';
      } else {
        cont.disabled = true;
        cont.innerHTML = '▶ Продолжить';
      }
    }
    const best = KVP.storage.get('best', 0);
    const stats = el('menu-stats');
    if (stats) {
      stats.innerHTML =
        '<span class="menu-stat">🏆 Лучший счёт: <b>' + (best || '—') + '</b></span>' +
        '<span class="menu-stat">🃏 3 этажа · 9 комнат · логика И/ИЛИ/НЕ</span>' +
        '<span class="menu-stat">🧙 Маг · 🐉 Дракон · 🪤 Клетки · 💰 Сундуки</span>';
    }
  };

  /* ------------------------------------------------------------------ */
  /*  СПРАВКА                                                           */
  /* ------------------------------------------------------------------ */
  function bindHelp() {
    const tabs = el('help-tabs');
    if (tabs) {
      tabs.addEventListener('click', function (e) {
        const b = e.target.closest('[data-tab]');
        if (!b) return;
        const name = b.getAttribute('data-tab');
        tabs.querySelectorAll('[data-tab]').forEach(function (x) {
          x.classList.toggle('active', x === b);
        });
        document.querySelectorAll('.help-panel').forEach(function (p) {
          p.classList.toggle('active', p.getAttribute('data-panel') === name);
        });
        KVP.Audio.play('card');
      });
    }
    const close = el('btn-help-close');
    if (close) close.addEventListener('click', closeHelp);
    const close2 = el('btn-help-close-2');
    if (close2) close2.addEventListener('click', closeHelp);

    const resume = el('btn-help-resume');
    if (resume) resume.addEventListener('click', function () {
      closeHelp();
      if (helpReturn === 'paused') KVP.Game.resume();
    });
  }

  Menu.openHelp = function (from) {
    helpReturn = from || 'menu';
    show('screen-help');
  };

  function closeHelp() {
    hide('screen-help');
    if (helpReturn === 'paused') {
      // Экран паузы остаётся под справкой.
      show('screen-pause');
    } else if (helpReturn === 'menu') {
      show('screen-menu');
    }
  }
  Menu.closeHelp = closeHelp;

  /* ------------------------------------------------------------------ */
  /*  НАСТРОЙКИ                                                         */
  /* ------------------------------------------------------------------ */
  function bindSettings() {
    const close = el('btn-settings-close');
    if (close) close.addEventListener('click', closeSettings);
    const close2 = el('btn-settings-close-2');
    if (close2) close2.addEventListener('click', closeSettings);

    const vol = el('set-volume');
    if (vol) {
      vol.addEventListener('input', function () {
        const v = parseInt(vol.value, 10) / 100;
        KVP.Game.saveSettings({ volume: v, muted: false });
        updateSettingsLabels();
      });
      vol.addEventListener('change', function () { KVP.Audio.play('coin'); });
    }
    const sens = el('set-sensitivity');
    if (sens) {
      sens.addEventListener('input', function () {
        KVP.Game.saveSettings({ sensitivity: parseInt(sens.value, 10) / 1000 });
        updateSettingsLabels();
      });
    }
    const quality = el('set-quality');
    if (quality) {
      quality.addEventListener('change', function () {
        KVP.Game.saveSettings({ quality: quality.value });
      });
    }
    const analyzer = el('set-analyzer');
    if (analyzer) {
      analyzer.addEventListener('change', function () {
        KVP.Game.saveSettings({ showAnalyzer: analyzer.checked });
      });
    }
    const diff = el('set-difficulty');
    if (diff) {
      diff.addEventListener('change', function () {
        KVP.Game.saveSettings({ difficulty: diff.value });
      });
    }
  }

  Menu.openSettings = function (from) {
    settingsReturn = from || 'menu';
    const s = KVP.Game.getSettings();
    const vol = el('set-volume');
    if (vol) vol.value = Math.round((s.volume || 0) * 100);
    const sens = el('set-sensitivity');
    if (sens) sens.value = Math.round((s.sensitivity || 0.0022) * 1000);
    const q = el('set-quality');
    if (q) q.value = s.quality || 'normal';
    const a = el('set-analyzer');
    if (a) a.checked = s.showAnalyzer !== false;
    const d = el('set-difficulty');
    if (d) d.value = s.difficulty || 'normal';
    updateSettingsLabels();
    show('screen-settings');
  };

  function closeSettings() {
    hide('screen-settings');
    if (settingsReturn === 'menu') show('screen-menu');
  }

  function updateSettingsLabels() {
    const s = KVP.Game.getSettings();
    const v = el('val-volume');
    if (v) v.textContent = Math.round((s.volume || 0) * 100) + '%' + (s.muted ? ' · выкл' : '');
    const sens = el('val-sensitivity');
    if (sens) sens.textContent = (s.sensitivity * 1000).toFixed(1);
  }

  /* ------------------------------------------------------------------ */
  /*  СТАРТ                                                             */
  /* ------------------------------------------------------------------ */
  window.addEventListener('DOMContentLoaded', function () {
    KVP.Game.init();
    Menu.init();
    /* Перезагрузка страницы не должна выбрасывать игрока в меню:
       если он не нажимал «Завершить игру», продолжаем сохранённый забег. */
    KVP.Game.autoResume();
  });
})();
