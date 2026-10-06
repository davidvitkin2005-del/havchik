(function () {
  'use strict';

  var T = window.HavTime;
  var RAW = window.__PLACES__ || [];
  var META = window.__META__ || { users: 0, channel: '' };
  var tg = window.Telegram && window.Telegram.WebApp;
  var inTG = !!(tg && tg.platform && tg.platform !== 'unknown');
  var reduceMotion = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  var PHOTO_BASE = 'https://avatars.mds.yandex.net/get-altay/';

  function $(sel, root) { return (root || document).querySelector(sel); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function norm(s) { return String(s || '').toLowerCase().replace(/ё/g, 'е'); }
  function plural(n, one, few, many) {
    var m10 = n % 10, m100 = n % 100;
    if (m10 === 1 && m100 !== 11) return one;
    if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
    return many;
  }
  function fmtRating(r) { return (Math.round(r * 10) / 10).toFixed(1).replace('.', ','); }

  function photoUrl(p, size) {
    if (!p) return '';
    if (/^(https?:|\.?\/|p\/)/.test(p)) return p.replace('%s', size);
    return PHOTO_BASE + p + '/' + size;
  }

  /* ---------- Иконки ---------- */
  var ICON = {
    search: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>',
    pin: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 21s-7-6.1-7-11.5A7 7 0 0 1 19 9.5C19 14.9 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/></svg>',
    clock: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
    wallet: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="6" width="18" height="13" rx="3"/><path d="M16 12.5h2"/><path d="M3 9h18"/></svg>',
    star: '<svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 2.8l2.8 5.9 6.4.8-4.7 4.5 1.2 6.4L12 17.3l-5.7 3.1 1.2-6.4-4.7-4.5 6.4-.8z"/></svg>',
    spark: '<svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 2l2.2 6.8L21 11l-6.8 2.2L12 20l-2.2-6.8L3 11l6.8-2.2z"/></svg>',
    close: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>',
    map: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 21s-7-6.1-7-11.5A7 7 0 0 1 19 9.5C19 14.9 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/></svg>',
    play: '<svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true"><rect x="2.5" y="2.5" width="19" height="19" rx="5.5" fill="none" stroke="currentColor" stroke-width="2"/><path fill="currentColor" d="M10 8.4v7.2l6-3.6z"/></svg>',
    people: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.6-3.6 3.3-5.5 6.5-5.5s5.9 1.9 6.5 5.5"/><path d="M16 4.6a3.5 3.5 0 0 1 0 6.8M18.5 14.8c1.7.7 2.8 2.5 3.1 5.2"/></svg>',
    chat: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 12a8 8 0 0 1-11.6 7.1L4 20l1-4.2A8 8 0 1 1 20 12z"/></svg>',
    dice: '<svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5" fill="none" stroke="currentColor" stroke-width="2"/><g fill="currentColor"><circle cx="8.5" cy="8.5" r="1.6"/><circle cx="15.5" cy="15.5" r="1.6"/><circle cx="12" cy="12" r="1.6"/></g></svg>'
  };

  /* ---------- Данные ---------- */
  var places = [];
  RAW.forEach(function (p) {
    try {
      var s = T.buildSchedule(p.hours);
      var metro = (p.metro || [])[0];
      places.push(Object.assign({}, p, {
        _s: s,
        _q: norm([p.name, p.address, metro && metro.name, (p.cuisine || []).join(' '), p.type].join(' '))
      }));
    } catch (e) {
      if (window.console) console.warn('Пропускаю место', p && p.name, e.message);
    }
  });
  places.sort(function (a, b) { return a.name.localeCompare(b.name, 'ru'); });
  var byId = {};
  places.forEach(function (p) { byId[p.id] = p; });

  var cuisineCount = {};
  places.forEach(function (p) { (p.cuisine || []).forEach(function (c) { cuisineCount[c] = (cuisineCount[c] || 0) + 1; }); });
  var cuisines = Object.keys(cuisineCount).sort(function (a, b) {
    return cuisineCount[b] - cuisineCount[a] || a.localeCompare(b, 'ru');
  });

  var state = { cuisines: {}, when: 'any', q: '' };
  var lastPick = null;
  var sheetPlace = null;
  var spinTimers = [];

  function selectedCuisines() { return Object.keys(state.cuisines); }
  function cuisineOk(p) {
    var sel = selectedCuisines();
    if (!sel.length) return true;
    return (p.cuisine || []).some(function (c) { return state.cuisines[c]; });
  }

  /* ---------- Telegram ---------- */
  function haptic(kind, arg) {
    try { if (inTG && tg.HapticFeedback) tg.HapticFeedback[kind](arg); } catch (e) { /* старый клиент */ }
  }
  function applyTelegramTheme() {
    if (!inTG) return;
    document.documentElement.setAttribute('data-theme', tg.colorScheme === 'dark' ? 'dark' : 'light');
    var css = getComputedStyle(document.documentElement);
    var night = css.getPropertyValue('--night').trim();
    var bg = css.getPropertyValue('--bg').trim();
    try { tg.setHeaderColor(night); } catch (e) { /* нет в старых версиях */ }
    try { tg.setBackgroundColor(night); } catch (e) { /* нет в старых версиях */ }
    try { if (tg.setBottomBarColor) tg.setBottomBarColor(bg); } catch (e) { /* нет в старых версиях */ }
  }
  if (inTG) {
    document.documentElement.setAttribute('data-tg', '');
    try { tg.ready(); } catch (e) { /* ок */ }
    try { tg.expand(); } catch (e) { /* ок */ }
    try { if (tg.isVersionAtLeast && tg.isVersionAtLeast('7.7')) tg.disableVerticalSwipes(); } catch (e) { /* ок */ }
    applyTelegramTheme();
    try { tg.onEvent('themeChanged', applyTelegramTheme); } catch (e) { /* ок */ }
    try { tg.BackButton.onClick(onBack); } catch (e) { /* ок */ }
  }

  /* ---------- Шапка и время ---------- */
  function renderClock(now) {
    $('#clock').innerHTML = 'Москва<b>' + T.hm(now.min) + '</b>';
  }

  function renderTagline() {
    var n = META.users || 0;
    $('#tagline').innerHTML = esc(places.length + ' ' + plural(places.length, 'место', 'места', 'мест') + ', где вкусно поесть') +
      '<span>из чата «Места Москва»</span>' +
      (n ? '<span class="users-line">' + ICON.people + esc(plural(n, 'Пользуется ', 'Пользуются ', 'Пользуются ') + n + ' ' + plural(n, 'человек', 'человека', 'человек')) + '</span>' : '');
  }

  function spinPool(tNow, ignoreCuisine) {
    var pool = places.filter(function (p) {
      return (ignoreCuisine || cuisineOk(p)) && T.statusAtAbs(p._s, tNow).open;
    });
    var comfy = pool.filter(function (p) {
      var st = T.statusAtAbs(p._s, tNow);
      return st.always || st.left >= 60;
    });
    return comfy.length ? comfy : pool;
  }

  function renderSpinSub(tNow) {
    var n = spinPool(tNow).length;
    var sel = selectedCuisines();
    var txt;
    if (!n) txt = sel.length ? 'Из выбранной кухни сейчас ничего не открыто' : 'Сейчас всё закрыто, покажу, что откроется раньше';
    else txt = 'Выберу из ' + n + ' ' + plural(n, 'открытого', 'открытых', 'открытых') + (sel.length ? ' · ' + sel.join(', ').toLowerCase() : '');
    $('#spinSub').textContent = txt;
  }

  /* ---------- Фильтры ---------- */
  function renderCuisineChips() {
    var html = '<button class="chip" type="button" data-cuisine="" aria-pressed="' + (selectedCuisines().length ? 'false' : 'true') + '">Все</button>';
    html += cuisines.map(function (c) {
      return '<button class="chip" type="button" data-cuisine="' + esc(c) + '" aria-pressed="' + (state.cuisines[c] ? 'true' : 'false') + '">' +
        esc(c) + '<span class="n">' + cuisineCount[c] + '</span></button>';
    }).join('');
    $('#cuisineChips').innerHTML = html;
  }

  function timeOptions(now) {
    var tNow = T.absNow(now);
    var first = tNow - (now.min % 60) + 60;
    var opts = [];
    for (var k = 0; k < 24; k++) {
      var t = first + k * 60;
      opts.push({ t: t, label: T.hm(t), nextDay: Math.floor(t / T.DAY) > Math.floor(tNow / T.DAY) });
    }
    return opts;
  }

  function renderTimeChips(now) {
    var html = '<button class="chip" type="button" data-when="any" aria-pressed="' + (state.when === 'any') + '">Когда угодно</button>' +
      '<button class="chip" type="button" data-when="now" aria-pressed="' + (state.when === 'now') + '">Сейчас</button>';
    var sepDone = false;
    timeOptions(now).forEach(function (o) {
      if (o.nextDay && !sepDone) { html += '<span class="chip-sep">завтра</span>'; sepDone = true; }
      html += '<button class="chip" type="button" data-when="' + o.t + '" aria-pressed="' + (state.when === o.t) + '">' + o.label + '</button>';
    });
    $('#timeChips').innerHTML = html;
  }

  /* ---------- Список ---------- */
  function matches(p, tNow) {
    if (!cuisineOk(p)) return false;
    if (state.q && p._q.indexOf(norm(state.q).trim()) === -1) return false;
    if (state.when === 'now') return T.statusAtAbs(p._s, tNow).open;
    if (typeof state.when === 'number') return T.isOpenAtAbs(p._s, state.when);
    return true;
  }

  function metroHTML(m) {
    if (!m) return '';
    var colors = m.colors || (m.color ? [m.color] : []);
    var dots = colors.map(function (c) { return '<i style="--c:' + esc(c) + '"></i>'; }).join('') || '<i></i>';
    return '<span class="metro">' + dots + esc(m.name) + '</span>';
  }

  function placeholderHTML(p) {
    return '<span class="ph" aria-hidden="true">' + esc((p.name || '?').charAt(0)) + '</span>';
  }

  function todayText(p, now) {
    return 'Сегодня ' + T.dayText(p._s.days[now.dow]);
  }

  function cardHTML(p, now, tNow) {
    var st = T.statusAtAbs(p._s, tNow);
    var lab = T.statusLabel(st);
    var photo = (p.photos || [])[0];
    var img = photo ? '<img src="' + esc(photoUrl(photo, 'XL')) + '" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer">' : '';
    var tags = (p.tags || []).slice(0, 2).map(function (t) { return '<span class="tag">' + esc(t) + '</span>'; }).join('');
    var meta = [];
    if (p.cuisine && p.cuisine.length) meta.push('<span>' + esc(p.cuisine.join(', ')) + '</span>');
    if (p.metro && p.metro[0]) meta.push(metroHTML(p.metro[0]));
    return '<button class="card' + (st.open ? '' : ' is-closed') + '" type="button" data-id="' + esc(p.id) + '">' +
      '<span class="media">' + placeholderHTML(p) + img +
        '<span class="pill tone-' + lab.tone + '" data-pill="' + esc(p.id) + '"><span class="dot"></span><span>' + esc(lab.text) + '</span></span>' +
        (p.rating ? '<span class="rating">★ ' + fmtRating(p.rating) + '</span>' : '') +
      '</span>' +
      '<span class="card-body">' +
        '<span class="card-name">' + esc(p.name) + '</span>' +
        '<span class="meta">' + meta.join('') + '</span>' +
        (p.short ? '<span class="desc">' + esc(p.short) + '</span>' : '') +
        '<span class="today" data-today="' + esc(p.id) + '">' + esc(todayText(p, now)) + '</span>' +
        (tags ? '<span class="tags">' + tags + '</span>' : '') +
      '</span>' +
    '</button>';
  }

  var lastListKey = '';
  function renderList(now) {
    var tNow = T.absNow(now);
    var list = places.filter(function (p) { return matches(p, tNow); });
    var groups;
    if (state.when === 'any') {
      var open = [], closed = [];
      list.forEach(function (p) { (T.statusAtAbs(p._s, tNow).open ? open : closed).push(p); });
      open.sort(function (a, b) {
        var la = T.statusAtAbs(a._s, tNow), lb = T.statusAtAbs(b._s, tNow);
        var sa = !la.always && la.left < 60 ? 1 : 0, sb = !lb.always && lb.left < 60 ? 1 : 0;
        return sa - sb || a.name.localeCompare(b.name, 'ru');
      });
      closed.sort(function (a, b) {
        var sa = T.statusAtAbs(a._s, tNow), sb = T.statusAtAbs(b._s, tNow);
        return (sa.until || 1e9) - (sb.until || 1e9);
      });
      groups = [];
      if (open.length) groups.push({ title: 'Открыто сейчас · ' + open.length, items: open });
      if (closed.length) groups.push({ title: 'Закрыто · ' + closed.length, items: closed });
    } else {
      var title = state.when === 'now' ? 'Открыто сейчас · ' + list.length
        : 'Открыто в ' + T.hm(state.when) + (Math.floor(state.when / T.DAY) > Math.floor(tNow / T.DAY) ? ' завтра' : '') + ' · ' + list.length;
      groups = list.length ? [{ title: title, items: list }] : [];
    }

    var key = JSON.stringify(groups.map(function (g) { return [g.title, g.items.map(function (p) { return p.id; })]; }));
    var filtered = selectedCuisines().length || state.q || state.when !== 'any';
    $('#reset').hidden = !filtered;
    $('#count').textContent = filtered
      ? 'Нашлось ' + list.length + ' из ' + places.length
      : places.length + ' ' + plural(places.length, 'место', 'места', 'мест');
    syncMap(list, tNow);

    if (key === lastListKey) {
      refreshStatuses(now, tNow);
      return;
    }
    lastListKey = key;

    if (!groups.length) {
      $('#list').innerHTML = '<div class="empty"><b>Под эти фильтры ничего нет</b>' +
        '<span>Попробуйте другое время или другую кухню.</span>' +
        '<button class="btn btn-secondary" type="button" data-action="reset">Сбросить фильтры</button></div>';
      return;
    }
    $('#list').innerHTML = groups.map(function (g) {
      return '<h2 class="group-title">' + esc(g.title) + '</h2>' + g.items.map(function (p) { return cardHTML(p, now, tNow); }).join('');
    }).join('');
  }

  function refreshStatuses(now, tNow) {
    places.forEach(function (p) {
      var pill = document.querySelector('[data-pill="' + p.id + '"]');
      if (pill) {
        var lab = T.statusLabel(T.statusAtAbs(p._s, tNow));
        pill.className = 'pill tone-' + lab.tone;
        pill.lastChild.textContent = lab.text;
      }
      var td = document.querySelector('[data-today="' + p.id + '"]');
      if (td) td.textContent = todayText(p, now);
    });
  }

  function render() {
    var now = T.mskNow();
    var tNow = T.absNow(now);
    if (typeof state.when === 'number' && state.when <= tNow) state.when = 'now';
    renderClock(now);
    renderSpinSub(tNow);
    renderCuisineChips();
    renderTimeChips(now);
    renderList(now);
  }

  /* ---------- Шторка ---------- */
  function galleryHTML(p) {
    var photos = (p.photos || []).slice(0, 8);
    if (!photos.length) return '<div class="gallery">' + placeholderHTML(p) + '</div>';
    var shots = photos.map(function (ph, i) {
      return '<div class="shot">' + placeholderHTML(p) + '<img src="' + esc(photoUrl(ph, 'XXL')) + '" alt="' + esc(p.name) + ', фото ' + (i + 1) + '"' +
        (i ? ' loading="lazy"' : '') + ' decoding="async" referrerpolicy="no-referrer"></div>';
    }).join('');
    var dots = photos.length > 1 ? '<div class="dots">' + photos.map(function (_, i) { return '<i' + (i ? '' : ' class="on"') + '></i>'; }).join('') + '</div>' : '';
    return '<div class="gallery"><div class="track" id="track">' + shots + '</div>' + dots + '</div>';
  }

  function hoursHTML(p, now) {
    return '<dl class="hours">' + T.groupDays(p._s).map(function (g) {
      var isToday = now.dow >= g.from && now.dow <= g.to;
      return '<dt' + (isToday ? ' class="is-today"' : '') + '>' + esc(g.label) + '</dt><dd' + (isToday ? ' class="is-today"' : '') + '>' + esc(g.text) + '</dd>';
    }).join('') + '</dl>';
  }

  function detailBodyHTML(p, now, opts) {
    var tNow = T.absNow(now);
    var st = T.statusAtAbs(p._s, tNow);
    var lab = T.statusLabel(st);
    var facts = [];
    facts.push('<div class="fact">' + ICON.pin + '<div>' + esc(p.address) +
      (p.metro && p.metro.length ? '<div class="meta" style="margin-top:4px">' + p.metro.slice(0, 2).map(function (m) {
        return metroHTML(m) + (m.distance ? '<span class="muted">' + esc(m.distance) + '</span>' : '');
      }).join('') + '</div>' : '') + '</div></div>');
    if (p.price) facts.push('<div class="fact">' + ICON.wallet + '<div>' + esc(p.price) + '</div></div>');
    var perks = (p.perks || []).map(function (t) { return '<li>' + ICON.spark + '<span>' + esc(t.text) + '</span></li>'; }).join('');
    return (opts.withTitle ? '<h2 class="title" id="sheetTitle">' + esc(p.name) + '</h2>' : '') +
      '<div class="meta">' + (p.cuisine || []).map(function (c) { return '<span class="tag">' + esc(c) + '</span>'; }).join('') +
        (p.type ? '<span>' + esc(p.type) + '</span>' : '') +
        (p.rating ? '<span>★ ' + fmtRating(p.rating) + ' на Яндексе</span>' : '') + '</div>' +
      '<div class="status-line tone-' + lab.tone + '"><span class="dot"></span><span>' + esc(lab.text) + '</span>' +
        '<span class="muted">· ' + esc(todayText(p, now).toLowerCase()) + '</span></div>' +
      '<div class="facts">' + facts.join('') + '</div>' +
      (p.description ? '<p class="lead">' + esc(p.description) + '</p>' : '') +
      (perks ? '<section><h3 class="section-h">Фишки</h3><ul class="perks">' + perks + '</ul><p class="note">Из рилсов в чате: акции и цены могли измениться.</p></section>' : '') +
      commentsHTML(p) +
      '<section><h3 class="section-h">Часы работы</h3>' + hoursHTML(p, now) + '</section>' +
      (p.reels && p.reels.length ? '<section><h3 class="section-h">Откуда это место</h3><div class="reels">' +
        p.reels.map(function (code, i) {
          return '<a class="reel-link" href="https://www.instagram.com/p/' + esc(code) + '/" target="_blank" rel="noopener" data-external>' +
            ICON.play + (p.reels.length > 1 ? 'Рилс ' + (i + 1) : 'Смотреть рилс') + '</a>';
        }).join('') + '</div><p class="note">Рилсы из чата «Места Москва», откроются в Instagram.</p></section>' : '');
  }

  /* ---------- Комментарии: пост о месте в Telegram-канале, комментарии под ним ---------- */
  function postUrl(p) { return 'https://t.me/' + META.channel + '/' + p.post; }
  function commentsHTML(p) {
    if (!META.channel || !p.post) return '';
    return '<section class="comments"><h3 class="section-h">Комментарии</h3>' +
      '<div class="tg-discussion" data-discussion="' + esc(META.channel + '/' + p.post) + '"></div>' +
      '<a class="btn btn-secondary btn-comment" href="' + esc(postUrl(p)) + '" target="_blank" rel="noopener" data-tglink>' + ICON.chat + 'Написать комментарий</a>' +
      '<p class="note">Комментарии живут в Telegram-канале @' + esc(META.channel) + ' и видны всем.</p></section>';
  }
  function isDark() {
    var t = document.documentElement.getAttribute('data-theme');
    if (t) return t === 'dark';
    return !!(window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
  }
  function mountDiscussion() {
    var box = document.querySelector('#sheet .tg-discussion');
    if (!box || box.childNodes.length) return;
    var s = document.createElement('script');
    s.async = true;
    s.src = 'https://telegram.org/js/telegram-widget.js?22';
    s.setAttribute('data-telegram-discussion', box.getAttribute('data-discussion'));
    s.setAttribute('data-comments-limit', '5');
    s.setAttribute('data-colorful', '1');
    s.setAttribute('data-color', isDark() ? 'FFC21A' : 'E5341D');
    if (isDark()) s.setAttribute('data-dark', '1');
    s.onerror = function () { box.remove(); };
    box.appendChild(s);
  }

  function actionsHTML(p, mode) {
    var maps = '<a class="btn btn-primary" href="' + esc(p.yandex) + '" target="_blank" rel="noopener" data-external>' + ICON.map + 'Яндекс Карты</a>';
    if (mode === 'random') {
      return '<div class="actions"><button class="btn btn-secondary" type="button" data-action="respin">' + ICON.dice + 'Ещё</button>' + maps + '</div>';
    }
    return '<div class="actions">' + maps + '</div>';
  }

  function openSheet(html) {
    var sheet = $('#sheet');
    $('#sheetContent').innerHTML = html;
    sheet.scrollTop = 0;
    if (!sheet.classList.contains('is-open')) {
      sheet.classList.add('is-open');
      document.documentElement.classList.add('is-locked');
      sheet.setAttribute('aria-hidden', 'false');
      syncBack();
    }
    try { sheet.focus({ preventScroll: true }); } catch (e) { sheet.focus(); }
    bindGallery();
    mountDiscussion();
  }

  function closeSheet() {
    var sheet = $('#sheet');
    if (!sheet.classList.contains('is-open')) return;
    spinTimers.forEach(clearTimeout);
    spinTimers = [];
    sheet.classList.remove('is-open');
    sheet.setAttribute('aria-hidden', 'true');
    if (!mapIsFull()) document.documentElement.classList.remove('is-locked');
    sheetPlace = null;
    syncBack();
  }

  function sheetIsOpen() { return $('#sheet').classList.contains('is-open'); }
  function syncBack() {
    if (!inTG) return;
    try { if (sheetIsOpen() || mapIsFull()) tg.BackButton.show(); else tg.BackButton.hide(); } catch (e) { /* ок */ }
  }
  function onBack() {
    if (sheetIsOpen()) closeSheet();
    else if (mapIsFull()) setMapFull(false);
  }

  function bindGallery() {
    var track = $('#track');
    if (!track) return;
    var dots = document.querySelectorAll('.dots i');
    track.addEventListener('scroll', function () {
      var i = Math.round(track.scrollLeft / Math.max(1, track.clientWidth));
      for (var k = 0; k < dots.length; k++) dots[k].classList.toggle('on', k === i);
    }, { passive: true });
  }

  function showPlace(id) {
    var p = byId[id];
    if (!p) return;
    sheetPlace = p;
    var now = T.mskNow();
    haptic('impactOccurred', 'light');
    openSheet('<div class="sheet-inner">' +
      '<div style="position:relative">' + galleryHTML(p) +
        '<button class="close" type="button" data-action="close" aria-label="Закрыть">' + ICON.close + '</button></div>' +
      '<div class="sheet-body">' + detailBodyHTML(p, now, { withTitle: true }) + '</div>' +
      actionsHTML(p, 'detail') + '</div>');
  }

  /* ---------- Рандомайзер ---------- */
  function spin(ignoreCuisine) {
    var now = T.mskNow();
    var tNow = T.absNow(now);
    var pool = spinPool(tNow, ignoreCuisine);
    var btn = $('#spin');
    btn.classList.remove('is-rolling');
    void btn.offsetWidth;
    btn.classList.add('is-rolling');
    haptic('impactOccurred', 'medium');

    if (!pool.length) {
      showNothingOpen(now, tNow, !ignoreCuisine && selectedCuisines().length > 0 && spinPool(tNow, true).length > 0);
      return;
    }
    var choices = pool.length > 1 && lastPick ? pool.filter(function (p) { return p.id !== lastPick; }) : pool;
    var pick = choices[Math.floor(Math.random() * choices.length)];
    lastPick = pick.id;
    sheetPlace = pick;

    openSheet('<div class="sheet-inner" id="randomSheet">' +
      '<div class="reveal is-spinning" id="reveal">' +
        '<button class="close" type="button" data-action="close" aria-label="Закрыть">' + ICON.close + '</button>' +
        '<div class="reveal-eyebrow">Следующая станция</div>' +
        '<div class="reveal-name" id="sheetTitle" aria-live="polite">' + esc(pool[Math.floor(Math.random() * pool.length)].name) + '</div>' +
        '<div class="reveal-sub" id="revealSub">Выбираю из ' + pool.length + ' ' + plural(pool.length, 'места', 'мест', 'мест') + '…</div>' +
      '</div>' +
      '<div class="is-hidden-until-reveal">' + galleryHTML(pick) + '</div>' +
      '<div class="sheet-body is-hidden-until-reveal">' + detailBodyHTML(pick, now, { withTitle: false }) + '</div>' +
      '<div class="is-hidden-until-reveal">' + actionsHTML(pick, 'random') + '</div>' +
    '</div>');

    var nameEl = $('#reveal .reveal-name');
    var finish = function () {
      nameEl.textContent = pick.name;
      $('#reveal').classList.remove('is-spinning');
      $('#revealSub').textContent = [pick.cuisine && pick.cuisine.join(', '), pick.metro && pick.metro[0] && ('м. ' + pick.metro[0].name)].filter(Boolean).join(' · ');
      $('#randomSheet').classList.add('is-revealed');
      haptic('notificationOccurred', 'success');
    };
    if (reduceMotion || pool.length === 1) { finish(); return; }
    var delays = [60, 60, 70, 80, 90, 110, 130, 160, 200, 250, 320];
    var acc = 0;
    var names = pool.map(function (p) { return p.name; });
    var prev = -1;
    delays.forEach(function (d) {
      acc += d;
      spinTimers.push(setTimeout(function () {
        var i;
        do { i = Math.floor(Math.random() * names.length); } while (names.length > 1 && i === prev);
        prev = i;
        nameEl.textContent = names[i];
        haptic('selectionChanged');
      }, acc));
    });
    spinTimers.push(setTimeout(finish, acc + 380));
  }

  function showNothingOpen(now, tNow, cuisineOnly) {
    var soon = places.filter(function (p) { return cuisineOnly ? cuisineOk(p) : true; })
      .map(function (p) { return { p: p, st: T.statusAtAbs(p._s, tNow) }; })
      .filter(function (x) { return !x.st.open && !x.st.never; })
      .sort(function (a, b) { return a.st.until - b.st.until; })
      .slice(0, 4);
    var list = soon.map(function (x) {
      var photo = (x.p.photos || [])[0];
      return '<button class="mini" type="button" data-id="' + esc(x.p.id) + '"><span class="thumb">' + placeholderHTML(x.p) +
        (photo ? '<img src="' + esc(photoUrl(photo, 'M')) + '" alt="" loading="lazy" referrerpolicy="no-referrer">' : '') + '</span>' +
        '<span><b>' + esc(x.p.name) + '</b><span>' + esc(T.statusLabel(x.st).text) + '</span></span></button>';
    }).join('');
    openSheet('<div class="sheet-inner is-revealed">' +
      '<div class="reveal"><button class="close" type="button" data-action="close" aria-label="Закрыть">' + ICON.close + '</button>' +
        '<div class="reveal-eyebrow">' + (cuisineOnly ? 'Эта кухня спит' : 'Москва спит') + '</div>' +
        '<div class="reveal-name" id="sheetTitle">' + (cuisineOnly ? 'Из выбранного сейчас всё закрыто' : 'Сейчас всё закрыто') + '</div>' +
        '<div class="reveal-sub">Раньше всех откроются эти места</div></div>' +
      '<div class="sheet-body"><div class="soonest">' + list + '</div>' +
        (cuisineOnly ? '<button class="btn btn-primary" type="button" data-action="spin-all">' + ICON.dice + 'Крутить среди всех</button>' : '') +
      '</div></div>');
  }

  /* ---------- События ---------- */
  document.addEventListener('click', function (e) {
    var t = e.target;
    var tgl = t.closest && t.closest('a[data-tglink]');
    if (tgl && inTG && tg.openTelegramLink) {
      e.preventDefault();
      try { tg.openTelegramLink(tgl.href); } catch (err) { window.open(tgl.href, '_blank'); }
      return;
    }
    var ext = t.closest && t.closest('a[data-external]');
    if (ext && inTG && tg.openLink) {
      e.preventDefault();
      try { tg.openLink(ext.href); } catch (err) { window.open(ext.href, '_blank'); }
      return;
    }
    var act = t.closest && t.closest('[data-action]');
    if (act) {
      var a = act.getAttribute('data-action');
      if (a === 'close') closeSheet();
      else if (a === 'respin') spin();
      else if (a === 'spin-all') spin(true);
      else if (a === 'reset') resetFilters();
      else if (a === 'map-full') setMapFull(!mapIsFull());
      else if (a === 'peek-close') closePeek();
      return;
    }
    var card = t.closest && t.closest('[data-id]');
    if (card) { showPlace(card.getAttribute('data-id')); return; }
    var chip = t.closest && t.closest('.chip');
    if (chip) {
      haptic('selectionChanged');
      if (chip.hasAttribute('data-cuisine')) {
        var c = chip.getAttribute('data-cuisine');
        if (!c) state.cuisines = {};
        else if (state.cuisines[c]) delete state.cuisines[c];
        else state.cuisines[c] = true;
      } else if (chip.hasAttribute('data-when')) {
        var w = chip.getAttribute('data-when');
        state.when = (w === 'any' || w === 'now') ? w : Number(w);
      }
      render();
    }
  });

  $('#spin').addEventListener('click', function () { spin(); });
  $('#reset').addEventListener('click', resetFilters);
  $('#q').addEventListener('input', function (e) { state.q = e.target.value; render(); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') onBack(); });
  document.addEventListener('error', function (e) {
    if (e.target && e.target.tagName === 'IMG') e.target.remove();
  }, true);

  function resetFilters() {
    state.cuisines = {};
    state.when = 'any';
    state.q = '';
    $('#q').value = '';
    render();
  }

  /* ---------- Обложка: параллакс при прокрутке и наклон телефона ---------- */
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  var hero = $('#hero');
  var heroMedia = $('#heroMedia');
  var heroGlare = $('#heroGlare');
  var heroTop = $('#heroTop');
  var motion = { tx: 0, ty: 0, cx: 0, cy: 0, scroll: 0, h: hero ? hero.offsetHeight : 600, raf: 0, b0: null, g0: null, tgOn: false };

  function heroFrame() {
    motion.raf = 0;
    motion.cx += (motion.tx - motion.cx) * 0.12;
    motion.cy += (motion.ty - motion.cy) * 0.12;
    var s = Math.min(motion.scroll, motion.h);
    var k = s / motion.h;
    // translateX(-51.5%) держит середину между лицами по центру экрана; scale(1.04) с опорой
    // на верхний край даёт запас по бокам для наклона, а верх снимка остаётся на месте
    heroMedia.style.transform =
      'translateX(-51.5%) translate3d(' + (motion.cx * 6).toFixed(2) + 'px,' + (s * 0.34 + motion.cy * 5).toFixed(2) + 'px,0)' +
      ' rotateX(' + (-motion.cy * 4).toFixed(2) + 'deg) rotateY(' + (motion.cx * 5).toFixed(2) + 'deg) scale(1.04)';
    heroGlare.style.setProperty('--gx', (50 + motion.cx * 34).toFixed(1) + '%');
    heroGlare.style.setProperty('--gy', (32 + motion.cy * 28).toFixed(1) + '%');
    heroGlare.style.setProperty('--go', (0.3 + Math.min(1, Math.sqrt(motion.cx * motion.cx + motion.cy * motion.cy)) * 0.7).toFixed(3));
    if (heroTop) {
      heroTop.style.transform = 'translate3d(' + (-motion.cx * 3).toFixed(2) + 'px,' + (s * 0.18).toFixed(2) + 'px,0)';
      heroTop.style.opacity = String(clamp(1 - k * 1.6, 0, 1).toFixed(3));
    }
    if (Math.abs(motion.tx - motion.cx) > 0.003 || Math.abs(motion.ty - motion.cy) > 0.003) heroSchedule();
  }
  function heroSchedule() { if (!motion.raf) motion.raf = requestAnimationFrame(heroFrame); }

  function heroTilt(betaDeg, gammaDeg) {
    if (motion.b0 === null) { motion.b0 = betaDeg; motion.g0 = gammaDeg; }
    motion.b0 += (betaDeg - motion.b0) * 0.004;   // медленно подстраиваемся под то, как держат телефон
    motion.g0 += (gammaDeg - motion.g0) * 0.004;
    motion.tx = clamp((gammaDeg - motion.g0) / 18, -1, 1);
    motion.ty = clamp((betaDeg - motion.b0) / 18, -1, 1);
    heroSchedule();
  }

  function tgOrientation(on) {
    if (!inTG || !tg.DeviceOrientation || !(tg.isVersionAtLeast && tg.isVersionAtLeast('8.0'))) return;
    if (on === motion.tgOn) return;
    motion.tgOn = on;
    try { if (on) tg.DeviceOrientation.start({ refresh_rate: 40 }); else tg.DeviceOrientation.stop(); } catch (e) { /* ок */ }
  }

  if (hero && heroMedia && !reduceMotion) {
    window.addEventListener('scroll', function () {
      motion.scroll = window.scrollY || window.pageYOffset || 0;
      tgOrientation(motion.scroll < motion.h);
      heroSchedule();
    }, { passive: true });
    window.addEventListener('resize', function () { motion.h = hero.offsetHeight || motion.h; heroSchedule(); });

    if (inTG && tg.DeviceOrientation && tg.isVersionAtLeast && tg.isVersionAtLeast('8.0')) {
      try {
        tg.onEvent('deviceOrientationChanged', function () {
          var d = tg.DeviceOrientation;
          heroTilt((d.beta || 0) * 57.2958, (d.gamma || 0) * 57.2958);
        });
      } catch (e) { /* ок */ }
      tgOrientation(true);
    } else if ('DeviceOrientationEvent' in window) {
      window.addEventListener('deviceorientation', function (e) {
        if (e.beta == null || e.gamma == null) return;
        heroTilt(e.beta, e.gamma);
      });
    }
    hero.addEventListener('pointermove', function (e) {
      if (e.pointerType !== 'mouse') return;
      var r = hero.getBoundingClientRect();
      motion.tx = clamp(((e.clientX - r.left) / r.width - 0.5) * 1.6, -1, 1);
      motion.ty = clamp(((e.clientY - r.top) / r.height - 0.5) * 1.6, -1, 1);
      heroSchedule();
    });
    hero.addEventListener('pointerleave', function () { motion.tx = 0; motion.ty = 0; heroSchedule(); });
    heroSchedule();
  }


  /* ---------- Карта Яндекса ----------
     Грузится, только когда до неё долистали. Метки с логотипами мест, в центре
     группируются в кружки с числом. Нажатие на метку раскрывает снизу карточку
     с описанием и кнопкой в Яндекс Карты. В обычном виде на телефоне карта не
     перехватывает прокрутку страницы: двигать её можно после «Развернуть». */
  var YMAPS_KEY = '';  // бесплатный ключ с developer.tech.yandex.ru, необязательно
  var MAP = { map: null, clusterer: null, marks: {}, key: '', list: [], active: null, margin: null, failed: false, loading: false };
  var mapCard = $('#mapCard');
  var mapPeek = $('#mapPeek');

  function mapIsFull() { return !!(mapCard && mapCard.classList.contains('is-full')); }

  function mapFail() {
    if (MAP.map || MAP.failed) return;
    MAP.failed = true;
    var fb = $('#mapFallback');
    if (fb) fb.hidden = false;
    var ld = $('#mapLoading');
    if (ld) ld.hidden = true;
  }

  function loadYmaps() {
    if (MAP.loading || MAP.map || !mapCard) return;
    MAP.loading = true;
    var s = document.createElement('script');
    s.src = 'https://api-maps.yandex.ru/2.1/?lang=ru_RU' + (YMAPS_KEY ? '&apikey=' + encodeURIComponent(YMAPS_KEY) : '');
    s.async = true;
    s.onload = function () {
      if (!window.ymaps) { mapFail(); return; }
      window.ymaps.ready(initMap, mapFail);
    };
    s.onerror = mapFail;
    document.head.appendChild(s);
    setTimeout(function () { if (!MAP.map) mapFail(); }, 20000);
  }

  function initMap() {
    var ym = window.ymaps;
    var el = $('#ymap');
    if (!ym || !el) { mapFail(); return; }
    MAP.map = new ym.Map(el, { center: [55.757, 37.62], zoom: 11, controls: [] },
      { suppressMapOpenBlock: true, yandexMapDisablePoiInteractivity: true });
    MAP.map.controls.add('zoomControl', { size: 'small', position: { right: 10, top: 56 } });
    MAP.PinLayout = ym.templateLayoutFactory.createClass(
      '<div class="pin tone-{{ properties.tone }}{% if properties.active %} is-active{% endif %}">' +
      '{% if properties.logo %}<img src="{{ properties.logo }}" alt="">{% else %}<span>{{ properties.letter }}</span>{% endif %}</div>');
    // В группе показываем два логотипа (сначала открытые сейчас) и число мест
    MAP.ClusterLayout = ym.templateLayoutFactory.createClass(
      '<div class="pin-cluster"><span class="cl-logos"></span><b class="cl-n">{{ properties.geoObjects.length }}</b></div>', {
        build: function () {
          MAP.ClusterLayout.superclass.build.call(this);
          var root = this.getParentElement();
          var box = root && root.querySelector('.cl-logos');
          if (!box) return;
          var objs = (this.getData().properties.get('geoObjects') || []).slice();
          var rank = { open: 0, soon: 1, closed: 2 };
          objs.sort(function (a, b) {
            return (rank[a.properties.get('tone')] || 0) - (rank[b.properties.get('tone')] || 0) ||
              (b.properties.get('logo') ? 1 : 0) - (a.properties.get('logo') ? 1 : 0);
          });
          box.innerHTML = objs.slice(0, 2).map(function (o) {
            var logo = o.properties.get('logo');
            return logo ? '<img src="' + esc(logo) + '" alt="">' : '<i>' + esc(o.properties.get('letter')) + '</i>';
          }).join('');
        }
      });
    MAP.clusterer = new ym.Clusterer({
      clusterIconLayout: MAP.ClusterLayout,
      clusterIconShape: { type: 'Rectangle', coordinates: [[-42, -19], [42, 19]] },
      gridSize: 128,
      maxZoom: 15,
      groupByCoordinates: false,
      clusterDisableClickZoom: false,
      clusterHasBalloon: false,
      clusterHasHint: false,
      zoomMargin: 70
    });
    MAP.map.geoObjects.add(MAP.clusterer);
    MAP.map.events.add('click', function () { closePeek(); });
    var ld = $('#mapLoading');
    if (ld) ld.hidden = true;
    applyMapBehaviors();
    MAP.key = '';
    syncMap(MAP.list, T.absNow(T.mskNow()));
  }

  function applyMapBehaviors() {
    if (!MAP.map) return;
    var full = mapIsFull();
    var touch = !!(window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
    var b = MAP.map.behaviors;
    try {
      if (full || !touch) b.enable('drag'); else b.disable('drag');
      if (full) b.enable('scrollZoom'); else b.disable('scrollZoom');
      b.enable(['multiTouch', 'dblClickZoom']);
    } catch (e) { /* ок */ }
  }

  function toneOf(p, tNow) { return T.statusLabel(T.statusAtAbs(p._s, tNow)).tone; }

  function makeMark(p, tNow) {
    var ym = window.ymaps;
    var pm = new ym.Placemark([p.coords[1], p.coords[0]], {
      pid: p.id,
      logo: p.logo ? photoUrl(p.logo, 'XS') : '',
      letter: (p.name || '?').charAt(0),
      tone: toneOf(p, tNow),
      active: MAP.active === p.id
    }, {
      iconLayout: MAP.PinLayout,
      iconShape: { type: 'Rectangle', coordinates: [[-23, -56], [23, 0]] },
      hasBalloon: false,
      hasHint: false,
      zIndex: MAP.active === p.id ? 900 : 100,
      zIndexHover: 800
    });
    pm.events.add('click', function (e) {
      try { e.stopPropagation(); } catch (err) { /* ок */ }
      openPeek(p.id);
    });
    return pm;
  }

  function syncMap(list, tNow) {
    MAP.list = list;
    var cnt = $('#mapCount');
    if (cnt) cnt.textContent = list.length + ' ' + plural(list.length, 'место', 'места', 'мест');
    if (!MAP.map) return;
    var withCoords = list.filter(function (p) { return p.coords && p.coords.length === 2; });
    var key = withCoords.map(function (p) { return p.id; }).join(',');
    if (key !== MAP.key) {
      MAP.key = key;
      MAP.clusterer.removeAll();
      MAP.marks = {};
      var marks = withCoords.map(function (p) { var m = makeMark(p, tNow); MAP.marks[p.id] = m; return m; });
      MAP.clusterer.add(marks);
      if (MAP.active && !MAP.marks[MAP.active]) closePeek();
      if (marks.length > 1) {
        try { MAP.map.setBounds(coreBounds(withCoords), { checkZoomRange: true, zoomMargin: [64, 30, 30, 30] }); } catch (e) { /* ок */ }
      } else if (marks.length === 1) {
        MAP.map.setCenter(marks[0].geometry.getCoordinates(), 15);
      }
    } else {
      withCoords.forEach(function (p) {
        var m = MAP.marks[p.id];
        if (m) m.properties.set('tone', toneOf(p, tNow));
      });
    }
  }

  /* Стартовый кадр: если мест много, показываем центр, где их большинство, а не всю Москву
     с Строгино и Раменками по краям: так метки не слипаются в кучу. Дальние видны при отдалении. */
  function coreBounds(ps) {
    function box(list) {
      var la = list.map(function (p) { return p.coords[1]; }), lo = list.map(function (p) { return p.coords[0]; });
      return [[Math.min.apply(null, la), Math.min.apply(null, lo)], [Math.max.apply(null, la), Math.max.apply(null, lo)]];
    }
    if (ps.length <= 8) return box(ps);
    var la = ps.map(function (p) { return p.coords[1]; }).sort(function (a, b) { return a - b; });
    var lo = ps.map(function (p) { return p.coords[0]; }).sort(function (a, b) { return a - b; });
    var mLat = la[la.length >> 1], mLon = lo[lo.length >> 1];
    var core = ps.filter(function (p) {
      var dx = (p.coords[0] - mLon) * 111.32 * Math.cos(mLat * Math.PI / 180);
      var dy = (p.coords[1] - mLat) * 110.57;
      return Math.sqrt(dx * dx + dy * dy) <= 4.5;
    });
    return box(core.length >= ps.length * 0.5 ? core : ps);
  }

  function setActive(id) {
    var prev = MAP.active;
    MAP.active = id;
    [prev, id].forEach(function (k) {
      var m = k && MAP.marks[k];
      if (!m) return;
      m.properties.set('active', k === id);
      m.options.set('zIndex', k === id ? 900 : 100);
    });
  }

  function peekHTML(p) {
    var now = T.mskNow();
    var lab = T.statusLabel(T.statusAtAbs(p._s, T.absNow(now)));
    var logo = p.logo ? '<img src="' + esc(photoUrl(p.logo, 'S')) + '" alt="" referrerpolicy="no-referrer">'
      : ((p.photos || [])[0] ? '<img src="' + esc(photoUrl(p.photos[0], 'M')) + '" alt="" referrerpolicy="no-referrer">' : placeholderHTML(p));
    var meta = [];
    if (p.cuisine && p.cuisine.length) meta.push(esc(p.cuisine.join(', ')));
    if (p.metro && p.metro[0]) meta.push('м. ' + esc(p.metro[0].name));
    return '<div class="peek-head">' +
        '<span class="peek-logo">' + logo + '</span>' +
        '<div class="peek-title"><b>' + esc(p.name) + '</b>' +
          '<span class="peek-status tone-' + lab.tone + '"><span class="dot"></span>' + esc(lab.text) + '</span>' +
          (meta.length ? '<span class="peek-meta">' + meta.join(' · ') + '</span>' : '') + '</div>' +
        '<button class="peek-close" type="button" data-action="peek-close" aria-label="Скрыть описание">' + ICON.close + '</button>' +
      '</div>' +
      (p.description ? '<p class="peek-desc">' + esc(p.description) + '</p>' : '') +
      '<div class="peek-actions">' +
        '<button class="btn btn-secondary" type="button" data-id="' + esc(p.id) + '">Подробнее</button>' +
        '<a class="btn btn-primary" href="' + esc(p.yandex) + '" target="_blank" rel="noopener" data-external>' + ICON.map + 'Яндекс Карты</a>' +
      '</div>';
  }

  function openPeek(id) {
    var p = byId[id];
    if (!p || !mapPeek) return;
    haptic('selectionChanged');
    mapPeek.innerHTML = peekHTML(p);
    mapPeek.hidden = false;
    mapCard.classList.add('has-peek');
    setActive(id);
    if (!MAP.map) return;
    try {
      if (MAP.margin) MAP.map.margin.removeArea(MAP.margin);
      MAP.margin = MAP.map.margin.addArea({ left: 0, bottom: 0, width: '100%', height: mapPeek.offsetHeight + 20 });
      MAP.map.panTo([p.coords[1], p.coords[0]], { useMapMargin: true, duration: 300 });
    } catch (e) { /* ок */ }
  }

  function closePeek() {
    if (!mapPeek || mapPeek.hidden) return;
    mapPeek.hidden = true;
    mapCard.classList.remove('has-peek');
    setActive(null);
    if (MAP.map && MAP.margin) { try { MAP.map.margin.removeArea(MAP.margin); } catch (e) { /* ок */ } MAP.margin = null; }
  }

  function setMapFull(on) {
    if (!mapCard) return;
    mapCard.classList.toggle('is-full', on);
    var btn = $('#mapFullBtn');
    if (btn) {
      btn.setAttribute('aria-label', on ? 'Свернуть карту' : 'Развернуть карту');
      btn.lastChild.textContent = on ? 'Свернуть' : 'Развернуть';
    }
    if (on) document.documentElement.classList.add('is-locked');
    else if (!sheetIsOpen()) document.documentElement.classList.remove('is-locked');
    haptic('impactOccurred', 'light');
    if (MAP.map) {
      try { MAP.map.container.fitToViewport(); } catch (e) { /* ок */ }
      applyMapBehaviors();
    }
    if (!on && mapCard.scrollIntoView) mapCard.scrollIntoView({ block: 'center' });
    syncBack();
  }

  if (mapCard) {
    if ('IntersectionObserver' in window) {
      var mapIO = new IntersectionObserver(function (entries) {
        if (entries.some(function (en) { return en.isIntersecting; })) { mapIO.disconnect(); loadYmaps(); }
      }, { rootMargin: '600px 0px' });
      mapIO.observe(mapCard);
    } else {
      loadYmaps();
    }
  }

  renderTagline();
  render();
  setInterval(function () {
    render();
    if (sheetPlace && $('#sheet').classList.contains('is-open') && !$('#reveal')) {
      var line = $('#sheet .status-line');
      if (line) {
        var now = T.mskNow();
        var lab = T.statusLabel(T.statusAtAbs(sheetPlace._s, T.absNow(now)));
        line.className = 'status-line tone-' + lab.tone;
        line.children[1].textContent = lab.text;
      }
    }
  }, 30000);
})();
