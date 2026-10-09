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
    nav: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3.5 10.5 20 4l-6.5 16.5-2.4-7.2z"/></svg>',
    navSm: '<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M3.5 10.5 20 4l-6.5 16.5-2.4-7.2z"/></svg>',
    target: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="2.2" fill="currentColor" stroke="none"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/></svg>',
    phone: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6.6 3.5h3l1.6 4.2-2.1 1.4a11.5 11.5 0 0 0 5.8 5.8l1.4-2.1 4.2 1.6v3a2 2 0 0 1-2.2 2A16.8 16.8 0 0 1 4.6 5.7a2 2 0 0 1 2-2.2z"/></svg>',
    copy: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="8" y="8" width="12" height="12" rx="2.5"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/></svg>',
    calendar: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3.5" y="5" width="17" height="15" rx="3"/><path d="M8 3v4M16 3v4M3.5 10h17"/></svg>',
    globe: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3z"/></svg>',
    route: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="6" cy="18" r="2.5"/><circle cx="18" cy="6" r="2.5"/><path d="M8.5 18H15a3 3 0 0 0 0-6H9a3 3 0 0 1 0-6h6.5"/></svg>',
    bookmark: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" aria-hidden="true"><path d="M6.5 3.5h11v17L12 16.6l-5.5 3.9z"/></svg>',
    share: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 15V3.5M7.5 8 12 3.5 16.5 8"/><path d="M5 12.5v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6"/></svg>',
    car: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 16.5h14v-4l-1.8-5a2 2 0 0 0-1.9-1.3H7.7a2 2 0 0 0-1.9 1.3L4 12.5v4z"/><path d="M4 12.5h16"/><circle cx="7.5" cy="16.5" r="1.8"/><circle cx="16.5" cy="16.5" r="1.8"/></svg>',
    walk: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="13" cy="4.5" r="2"/><path d="M9 21l2.5-6.5L14 17v4M8 12l2-4.5 3.5 1 2 3.5 2.5 1"/></svg>',
    metroM: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 19h18M5 19 9 6l3 7 3-7 4 13"/></svg>',
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

  var state = { cuisines: {}, when: 'any', q: '', dist: 0, feats: {}, price: '', mine: '' };
  var lastPick = null;
  var sheetPlace = null;
  var spinTimers = [];

  /* ---------- Где я: геопозиция и расстояния ----------
     Геопозиция нужна только чтобы посчитать расстояния: остаётся на телефоне и нигде не сохраняется.
     Сначала спрашиваем через Telegram (LocationManager, Bot API 8.0+), иначе через браузер.
     Если доступа нет, точку можно выбрать на карте. */
  var LOC = { pos: null, src: '', acc: 0, busy: false, err: '', picking: false, label: '' };
  var DIST_STEPS = [1, 2, 5, 10];

  function haversineKm(a, b) {
    var toR = Math.PI / 180;
    var dLat = (b[0] - a[0]) * toR, dLon = (b[1] - a[1]) * toR;
    var h = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(a[0] * toR) * Math.cos(b[0] * toR) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(h)));
  }
  function hasCoords(p) { return !!(p.coords && p.coords.length === 2); }
  function distOf(p) { return LOC.pos && hasCoords(p) ? haversineKm(LOC.pos, [p.coords[1], p.coords[0]]) : null; }
  function distOn() { return !!(state.dist && LOC.pos); }
  function distOk(p) {
    if (!distOn()) return true;
    var d = distOf(p);
    return d !== null && d <= state.dist;
  }
  // Ближе — значит быстрее добраться: пешком или на метро; без схемы метро — по прямой
  function etaSortKey(p) {
    var e = etaOf(p);
    if (!e) return 1e9;
    return e.best !== null ? e.best : 60 + e.d * 4;
  }
  function byDist(a, b) {
    if (!LOC.pos) return 0;
    return etaSortKey(a) - etaSortKey(b);
  }
  function fmtKm(km) {
    if (km < 1) return Math.max(10, Math.round(km * 100) * 10) + ' м';
    if (km < 10) return km.toFixed(1).replace('.', ',') + ' км';
    return Math.round(km) + ' км';
  }
  // Пешком: расстояние по прямой × 1,3 на изгибы улиц, скорость 4,8 км/ч; дальше 2,5 км пешком не считаем
  function walkText(km) {
    if (km > 2.5) return '';
    var m = Math.max(1, Math.round(km * 1.3 / 4.8 * 60));
    if (m >= 20) m = Math.round(m / 5) * 5;
    return '≈ ' + m + ' мин пешком';
  }
  function isManual() { return LOC.src === 'map' || LOC.src === 'addr'; }
  function fromWhom() {
    if (LOC.src === 'addr') return 'от ' + (LOC.label.length > 34 ? LOC.label.slice(0, 33) + '…' : LOC.label);
    return LOC.src === 'map' ? 'от точки на карте' : 'от вас';
  }
  // Маршрут в Яндекс Картах. Своё местоположение в ссылку не кладём: Яндекс возьмёт его с телефона сам.
  // Точку, выбранную на карте, передаём, иначе маршрут построится не оттуда.
  function routeUrl(p, mode) {
    var to = p.coords[1].toFixed(6) + ',' + p.coords[0].toFixed(6);
    var from = LOC.pos && isManual() ? LOC.pos[0].toFixed(6) + ',' + LOC.pos[1].toFixed(6) : '';
    return 'https://yandex.ru/maps/?rtext=' + from + '~' + to + '&rtt=' + mode;
  }

  function tgLocationManager() {
    return inTG && tg.LocationManager && tg.isVersionAtLeast && tg.isVersionAtLeast('8.0') ? tg.LocationManager : null;
  }

  function locate(silent) {
    if (LOC.busy) return;
    if (!silent) LOC.err = '';
    var lm = tgLocationManager();
    if (!lm) { browserLocate(silent); return; }
    var go = function () {
      if (!lm.isLocationAvailable) { browserLocate(silent); return; }
      if (!lm.isAccessGranted && (silent || lm.isAccessRequested)) {
        if (!silent) { LOC.err = 'tg-denied'; renderDist(); }
        return;
      }
      LOC.busy = true;
      renderDist();
      lm.getLocation(function (d) {
        LOC.busy = false;
        if (d && typeof d.latitude === 'number') setLoc([d.latitude, d.longitude], 'gps', d.horizontal_accuracy);
        else { LOC.err = 'tg-denied'; renderDist(); }
      });
    };
    try { if (lm.isInited) go(); else lm.init(go); } catch (e) { browserLocate(silent); }
  }

  function browserLocate(silent) {
    var geo = navigator.geolocation;
    if (!geo) { if (!silent) { LOC.err = 'unsupported'; renderDist(); } return; }
    var run = function () {
      LOC.busy = true;
      renderDist();
      geo.getCurrentPosition(function (pos) {
        LOC.busy = false;
        setLoc([pos.coords.latitude, pos.coords.longitude], 'gps', pos.coords.accuracy);
      }, function (err) {
        LOC.busy = false;
        if (!silent) LOC.err = err && err.code === 1 ? 'denied' : 'failed';
        renderDist();
      }, { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 });
    };
    if (!silent) { run(); return; }
    // При запуске спрашиваем молча, только если доступ уже дали раньше
    try {
      navigator.permissions.query({ name: 'geolocation' }).then(function (r) { if (r.state === 'granted') run(); }, function () {});
    } catch (e) { /* нет Permissions API */ }
  }

  function setLoc(pos, src, acc, label) {
    LOC.pos = [pos[0], pos[1]];
    LOC.src = src;
    LOC.label = label || '';
    LOC.acc = acc || 0;
    LOC.err = '';
    haptic('notificationOccurred', 'success');
    lastListKey = '';
    render();
    syncUserOnMap(true);
    refreshSheetDistance();
  }

  function renderDist() {
    var chips = $('#distChips'), label = $('#distLabel'), msg = $('#locMsg');
    if (!chips) return;
    var html;
    if (!LOC.pos) {
      label.innerHTML = 'Расстояние';
      html = '<button class="chip chip-loc" type="button" data-action="locate"' + (LOC.busy ? ' aria-busy="true" disabled' : '') + '>' +
          ICON.nav + (LOC.busy ? 'Определяю, где вы…' : 'Показать, сколько до мест') + '</button>' +
        '<button class="chip" type="button" data-action="addr">' + ICON.search + 'Ввести адрес</button>' +
        '<button class="chip" type="button" data-action="pick-on-map">' + ICON.target + 'Точка на карте</button>';
    } else {
      label.innerHTML = 'Расстояние <span class="filter-sub">' + esc(fromWhom()) + '</span>';
      html = '<button class="chip" type="button" data-dist="0" aria-pressed="' + (!state.dist) + '">Любое</button>';
      DIST_STEPS.forEach(function (km) {
        var n = places.filter(function (p) { var d = distOf(p); return d !== null && d <= km; }).length;
        html += '<button class="chip" type="button" data-dist="' + km + '" aria-pressed="' + (state.dist === km) + '">до ' + km + ' км<span class="n">' + n + '</span></button>';
      });
      html += '<button class="chip chip-ghost" type="button" data-action="locate"' + (LOC.busy ? ' aria-busy="true" disabled' : '') + '>' +
          ICON.nav + (LOC.busy ? 'Обновляю…' : (isManual() ? 'Где я' : 'Обновить')) + '</button>' +
        '<button class="chip chip-ghost" type="button" data-action="addr">' + ICON.search + (LOC.src === 'addr' ? 'Другой адрес' : 'Ввести адрес') + '</button>' +
        '<button class="chip chip-ghost" type="button" data-action="pick-on-map">' + ICON.target + (LOC.src === 'map' ? 'Другая точка' : 'Точка на карте') + '</button>';
    }
    chips.innerHTML = html;
    var text = '';
    if (LOC.err === 'tg-denied') text = 'Telegram не дал доступ к геопозиции. Разрешите его в настройках бота или выберите точку на карте.';
    else if (LOC.err === 'denied') text = 'Доступ к геопозиции запрещён. Разрешите его в настройках браузера или выберите точку на карте.';
    else if (LOC.err === 'failed') text = 'Не получилось определить, где вы. Попробуйте ещё раз или выберите точку на карте.';
    else if (LOC.err === 'unsupported') text = 'Здесь геопозиция недоступна. Выберите точку на карте.';
    else if (!LOC.pos) text = 'Геопозиция нужна только чтобы посчитать расстояния: она остаётся на телефоне и нигде не сохраняется.';
    msg.innerHTML = esc(text) + (LOC.err === 'tg-denied' && tgLocationManager() ? ' <button class="link-btn" type="button" data-action="loc-settings">Открыть настройки</button>' : '');
    msg.hidden = !text;
  }

  var toastTimer = 0;
  function toast(text) {
    var el = $('#toast');
    if (!el) return;
    el.textContent = text;
    el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.hidden = true; }, 2600);
  }

  function copyText(text, msg) {
    var done = function () { toast(msg || 'Номер скопирован'); haptic('notificationOccurred', 'success'); };
    var fallback = function () {
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      var ok = false;
      try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
      ta.remove();
      if (ok) done(); else toast('Не получилось скопировать: ' + text);
    };
    try { navigator.clipboard.writeText(text).then(done, fallback); } catch (e) { fallback(); }
  }


  function selectedCuisines() { return Object.keys(state.cuisines); }
  function cuisineOk(p) {
    var sel = selectedCuisines();
    if (!sel.length) return true;
    return (p.cuisine || []).some(function (c) { return state.cuisines[c]; });
  }

  /* ---------- Особенности, чек, мои места ---------- */
  var FEATURES = [
    ['veranda', 'Веранда'], ['breakfast', 'Завтраки'], ['lunch', 'Бизнес-ланч'], ['h24', 'Круглосуточно'],
    ['dogs', 'С собакой'], ['halal', 'Халяль'], ['music', 'Живая музыка'], ['hookah', 'Кальян'],
    ['kids', 'С детьми'], ['view', 'С видом'], ['dance', 'Танцы'], ['sport', 'Спорт на экране'], ['laptop', 'С ноутбуком']
  ];
  var PRICES = [['lo', 'до 1000 ₽'], ['mid', '1000–2500 ₽'], ['hi', 'от 2500 ₽']];
  function featOk(p) {
    var sel = Object.keys(state.feats);
    if (!sel.length) return true;
    var f = p.feat || [];
    return sel.every(function (k) { return f.indexOf(k) !== -1; });
  }
  function priceOk(p) { return !state.price || p.priceB === state.price; }
  function mineOk(p) { return !state.mine || !!MARKS[state.mine][p.id]; }

  /* Избранное и «Хочу сходить»: в Telegram хранятся в облаке Telegram (видно на всех ваших устройствах),
     в браузере — на этом устройстве */
  var MARKS = { fav: {}, want: {} };
  var cloud = inTG && tg.CloudStorage && tg.isVersionAtLeast && tg.isVersionAtLeast('6.9') ? tg.CloudStorage : null;
  function localGet(k) { try { return window.localStorage.getItem(k); } catch (e) { return null; } }
  function localSet(k, v) { try { window.localStorage.setItem(k, v); } catch (e) { /* хранилище недоступно */ } }
  function applyMarks(raw) {
    try {
      var o = JSON.parse(raw || '{}');
      MARKS.fav = {}; MARKS.want = {};
      (o.fav || []).forEach(function (id) { if (byId[id]) MARKS.fav[id] = 1; });
      (o.want || []).forEach(function (id) { if (byId[id]) MARKS.want[id] = 1; });
    } catch (e) { /* испорченная запись: начинаем с пустых списков */ }
    var row = document.getElementById('marksRow');
    if (row && sheetPlace) row.outerHTML = marksRowHTML(sheetPlace);
    lastListKey = '';
    render();
  }
  function loadMarks() {
    var local = localGet('havchik-marks');
    if (local) applyMarks(local);
    if (cloud) {
      try { cloud.getItem('marks', function (err, val) { if (!err && val) applyMarks(val); }); } catch (e) { /* ок */ }
    }
  }
  function saveMarks() {
    var raw = JSON.stringify({ fav: Object.keys(MARKS.fav), want: Object.keys(MARKS.want) });
    localSet('havchik-marks', raw);
    if (cloud) { try { cloud.setItem('marks', raw); } catch (e) { /* ок */ } }
  }
  function toggleMark(kind, id) {
    if (!byId[id]) return;
    var on = !MARKS[kind][id];
    if (on) MARKS[kind][id] = 1; else delete MARKS[kind][id];
    saveMarks();
    haptic('impactOccurred', 'light');
    toast(on ? (kind === 'fav' ? 'Добавлено в избранное' : 'Добавлено в «Хочу сходить»') : (kind === 'fav' ? 'Убрано из избранного' : 'Убрано из «Хочу сходить»'));
    var row = document.getElementById('marksRow');
    if (row && sheetPlace && sheetPlace.id === id) row.outerHTML = marksRowHTML(sheetPlace);
    if (state.mine && !Object.keys(MARKS[state.mine]).length) state.mine = '';
    lastListKey = '';
    render();
  }
  function marksRowHTML(p) {
    var fav = !!MARKS.fav[p.id], want = !!MARKS.want[p.id];
    return '<div class="marks" id="marksRow">' +
      '<button class="mark-btn' + (fav ? ' is-on' : '') + '" type="button" data-action="mark" data-mark="fav" data-id-mark="' + esc(p.id) + '" aria-pressed="' + fav + '">' +
        ICON.star + (fav ? 'В избранном' : 'В избранное') + '</button>' +
      '<button class="mark-btn' + (want ? ' is-on' : '') + '" type="button" data-action="mark" data-mark="want" data-id-mark="' + esc(p.id) + '" aria-pressed="' + want + '">' +
        ICON.bookmark + (want ? 'Хочу сходить ✓' : 'Хочу сходить') + '</button>' +
      '<button class="mark-btn mark-share" type="button" data-action="share" data-id-mark="' + esc(p.id) + '" aria-label="Поделиться местом" title="Поделиться">' + ICON.share + '</button>' +
    '</div>';
  }

  function renderMoreFilters() {
    var fc = {};
    places.forEach(function (p) { (p.feat || []).forEach(function (f) { fc[f] = (fc[f] || 0) + 1; }); });
    var fh = FEATURES.filter(function (f) { return fc[f[0]]; }).map(function (f) {
      return '<button class="chip" type="button" data-feat="' + f[0] + '" aria-pressed="' + !!state.feats[f[0]] + '">' + esc(f[1]) + '<span class="n">' + fc[f[0]] + '</span></button>';
    }).join('');
    $('#featChips').innerHTML = fh;
    var pc = {};
    places.forEach(function (p) { if (p.priceB) pc[p.priceB] = (pc[p.priceB] || 0) + 1; });
    $('#priceChips').innerHTML = '<button class="chip" type="button" data-price="" aria-pressed="' + !state.price + '">Любой</button>' +
      PRICES.map(function (pr) {
        return '<button class="chip" type="button" data-price="' + pr[0] + '" aria-pressed="' + (state.price === pr[0]) + '">' + pr[1] + '<span class="n">' + (pc[pr[0]] || 0) + '</span></button>';
      }).join('');
    var nf = Object.keys(MARKS.fav).length, nw = Object.keys(MARKS.want).length;
    $('#mineSection').hidden = !(nf || nw);
    $('#mineChips').innerHTML =
      '<button class="chip" type="button" data-mine="fav" aria-pressed="' + (state.mine === 'fav') + '">' + ICON.star + 'Избранное<span class="n">' + nf + '</span></button>' +
      '<button class="chip" type="button" data-mine="want" aria-pressed="' + (state.mine === 'want') + '">' + ICON.bookmark + 'Хочу сходить<span class="n">' + nw + '</span></button>';
  }

  /* ---------- Поделиться и открыть место по ссылке ---------- */
  function siteUrl() { return location.origin + location.pathname; }
  function placeLink(p) {
    return META.startapp ? 'https://t.me/' + META.bot + '?startapp=' + encodeURIComponent(p.id) : siteUrl() + '#' + encodeURIComponent(p.id);
  }
  function sharePlace(id) {
    var p = byId[id];
    if (!p) return;
    var link = placeLink(p);
    var text = p.name + (p.short ? ' — ' + p.short : '');
    if (inTG && tg.openTelegramLink) {
      try { tg.openTelegramLink('https://t.me/share/url?url=' + encodeURIComponent(link) + '&text=' + encodeURIComponent(text)); return; } catch (e) { /* ниже запасной вариант */ }
    }
    if (navigator.share) {
      navigator.share({ title: p.name, text: text, url: link }).catch(function () { /* пользователь передумал */ });
      return;
    }
    copyText(link, 'Ссылка на место скопирована');
  }
  function openFromLink() {
    var id = '';
    try { id = (inTG && tg.initDataUnsafe && tg.initDataUnsafe.start_param) || ''; } catch (e) { id = ''; }
    if (!id && location.hash.length > 1) { try { id = decodeURIComponent(location.hash.slice(1)); } catch (e) { id = ''; } }
    if (id && byId[id]) showPlace(id);
  }

  /* ---------- Свой адрес ----------
     Если геопозиция определилась неверно или нужно посчитать от другого места. Станции метро ищем сами,
     адреса — геокодером Яндекса (с ключом), запасной вариант — OpenStreetMap. Уходит только введённый текст. */
  var ADDR = { items: [], timer: 0, seq: 0 };
  var MSK_BOX = [[55.13, 36.80], [56.03, 38.10]];
  function inMsk(lat, lon) { return lat > MSK_BOX[0][0] && lat < MSK_BOX[1][0] && lon > MSK_BOX[0][1] && lon < MSK_BOX[1][1]; }
  function showAddr() {
    openSheet('<div class="sheet-inner is-revealed">' +
      '<div class="reveal"><button class="close" type="button" data-action="close" aria-label="Закрыть">' + ICON.close + '</button>' +
        '<div class="reveal-eyebrow">Откуда считать</div>' +
        '<div class="reveal-name" id="sheetTitle">Ваш адрес</div>' +
        '<div class="reveal-sub">Улица и дом, станция метро или место</div></div>' +
      '<div class="sheet-body">' +
        '<label class="search addr-search">' + ICON.search +
          '<input id="addrQ" type="search" placeholder="Например, Тверская 7 или м. Курская" autocomplete="off" enterkeyhint="search" aria-label="Адрес"></label>' +
        '<div class="addr-list" id="addrList" role="list"></div>' +
        '<p class="note">Адрес нужен только чтобы посчитать расстояния и время в пути, приложение его не сохраняет. Для поиска введённый текст уходит в поиск Яндекс Карт или OpenStreetMap.</p>' +
      '</div></div>');
    var q = $('#addrQ');
    q.addEventListener('input', function () { clearTimeout(ADDR.timer); ADDR.timer = setTimeout(function () { addrSearch(q.value); }, 350); });
    q.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); if (ADDR.items.length) pickAddr(0); else addrSearch(q.value); } });
    setTimeout(function () { try { q.focus(); } catch (e) { /* ок */ } }, 250);
    if (!YMAPS_KEY || !window.ymaps) loadYmaps();
  }
  function addrRender(state) {
    var box = $('#addrList');
    if (!box) return;
    if (state === 'busy' && !ADDR.items.length) { box.innerHTML = '<div class="addr-state">Ищу…</div>'; return; }
    if (!ADDR.items.length) { box.innerHTML = state === 'none' ? '<div class="addr-state">Ничего не нашлось в Москве. Попробуйте написать иначе или выберите точку на карте.</div>' : ''; return; }
    box.innerHTML = ADDR.items.map(function (it, i) {
      return '<button class="addr-item" type="button" role="listitem" data-action="addr-pick" data-i="' + i + '">' +
        (it.metro ? '<span class="metro"><i style="--c:' + esc(it.color) + '"></i></span>' : ICON.pin) +
        '<span><b>' + esc(it.title) + '</b>' + (it.sub ? '<span>' + esc(it.sub) + '</span>' : '') + '</span></button>';
    }).join('');
  }
  function metroMatches(q) {
    if (!METRO) return [];
    var n = norm(q).replace(/^(м\.?|метро|станция)\s+/, '').trim();
    if (n.length < 2) return [];
    var seen = {}, out = [];
    METRO.stations.forEach(function (st, i) {
      var name = norm(st[0]);
      if (name.indexOf(n) !== 0 && name.indexOf(' ' + n) === -1) return;
      var line = lineOf(i), key = st[0] + '|' + line[0];
      if (seen[key]) return;
      seen[key] = 1;
      out.push({ title: 'м. ' + st[0], sub: line[0], pos: [st[1], st[2]], metro: true, color: line[1], exact: name === n });
    });
    out.sort(function (a, b) { return b.exact - a.exact; });
    return out.slice(0, 4);
  }
  function addrSearch(q) {
    q = (q || '').trim();
    var seq = ++ADDR.seq;
    ADDR.items = metroMatches(q);
    if (q.length < 3) { addrRender(); return; }
    addrRender('busy');
    var done = function (list) {
      if (seq !== ADDR.seq) return;
      ADDR.items = ADDR.items.concat(list.filter(function (it) { return inMsk(it.pos[0], it.pos[1]); })).slice(0, 8);
      addrRender(ADDR.items.length ? '' : 'none');
    };
    var osm = function () {
      var url = 'https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&limit=6&accept-language=ru&countrycodes=ru&bounded=1' +
        '&viewbox=' + MSK_BOX[0][1] + ',' + MSK_BOX[1][0] + ',' + MSK_BOX[1][1] + ',' + MSK_BOX[0][0] + '&q=' + encodeURIComponent(q + ', Москва');
      fetch(url).then(function (r) { return r.json(); }).then(function (arr) {
        done((arr || []).map(function (x) {
          var ad = x.address || {}, parts = String(x.display_name || '').split(', ');
          var street = ad.road || ad.pedestrian || ad.square || '';
          var title = street ? street + (ad.house_number ? ', ' + ad.house_number : '') : parts.slice(0, 2).join(', ');
          var sub = [x.name && x.name !== street && title.indexOf(x.name) === -1 ? x.name : '', ad.suburb || ad.city_district || ''].filter(Boolean).join(' · ');
          return { title: title, sub: sub, pos: [Number(x.lat), Number(x.lon)] };
        }));
      }, function () { done([]); });
    };
    if (YMAPS_KEY && window.ymaps && window.ymaps.geocode) {
      try {
        window.ymaps.geocode(q, { boundedBy: MSK_BOX, strictBounds: true, results: 6 }).then(function (res) {
          var list = [];
          res.geoObjects.each(function (o) {
            var c = o.geometry.getCoordinates();
            list.push({ title: o.getAddressLine ? o.getAddressLine().replace(/^Россия, Москва, /, '') : o.properties.get('name'), sub: o.properties.get('description') || '', pos: c });
          });
          if (list.length) done(list); else osm();
        }, osm);
        return;
      } catch (e) { /* ниже запасной вариант */ }
    }
    osm();
  }
  function pickAddr(i) {
    var it = ADDR.items[i];
    if (!it) return;
    closeSheet();
    setLoc(it.pos, 'addr', 0, it.title);
    toast('Считаю расстояния от: ' + it.title);
  }

  /* ---------- Предложить место ---------- */
  function showSuggest() {
    var bot = 'https://t.me/' + META.bot;
    openSheet('<div class="sheet-inner is-revealed">' +
      '<div class="reveal"><button class="close" type="button" data-action="close" aria-label="Закрыть">' + ICON.close + '</button>' +
        '<div class="reveal-eyebrow">Предложить место</div>' +
        '<div class="reveal-name" id="sheetTitle">Знаете, где вкусно?</div>' +
        '<div class="reveal-sub">Расскажите боту, мы проверим и добавим</div></div>' +
      '<div class="sheet-body">' +
        '<p class="lead">Пришлите боту @' + esc(META.bot) + ' одно из трёх:</p>' +
        '<ul class="perks">' +
          '<li>' + ICON.play + '<span>ссылку на рилс или пост в Instagram;</span></li>' +
          '<li>' + ICON.map + '<span>ссылку на место в Яндекс Картах;</span></li>' +
          '<li>' + ICON.spark + '<span>просто название и адрес.</span></li>' +
        '</ul>' +
        '<p class="note">Бот ответит, что получил. Место появится в приложении после проверки.</p>' +
        '<a class="btn btn-primary suggest-cta" href="' + esc(bot) + '" target="_blank" rel="noopener" data-tglink>' + ICON.chat + 'Написать боту</a>' +
      '</div></div>');
  }

  /* ---------- Время в пути: пешком и на метро ----------
     Своя оценка по схеме метро: пешком до ближайших станций, поезд по перегонам с ожиданием и пересадками,
     пешком от станции до места. Точное время по расписанию покажут Яндекс Карты. */
  var METRO = window.__METRO__ || null;
  var TR = { key: '', cost: null, src: null, trs: null, walkIn: null };
  var WALK_MIN_PER_KM = 1.25 / 4.8 * 60;
  function stationPos(i) { var s = METRO.stations[i]; return [s[1], s[2]]; }
  function lineOf(i) { return METRO.lines[METRO.stations[i][3]]; }
  function waitOf(i) { return METRO.wait[lineOf(i)[2]] || 2; }
  function nearStations(pos, maxKm, limit) {
    var out = [];
    for (var i = 0; i < METRO.stations.length; i++) {
      var d = haversineKm(pos, stationPos(i));
      if (d <= maxKm) out.push([i, d]);
    }
    out.sort(function (a, b) { return a[1] - b[1]; });
    return out.slice(0, limit);
  }
  function transitPrep() {
    if (!METRO || !LOC.pos) return false;
    var key = LOC.pos.join(',');
    if (TR.key === key) return !!TR.cost;
    TR.key = key;
    var n = METRO.stations.length;
    if (!METRO.adj) {
      METRO.adj = [];
      for (var i = 0; i < n; i++) METRO.adj.push([]);
      METRO.edges.forEach(function (e) { METRO.adj[e[0]].push([e[1], e[2], e[3]]); METRO.adj[e[1]].push([e[0], e[2], e[3]]); });
    }
    var start = nearStations(LOC.pos, 3, 6);
    if (!start.length) { TR.cost = null; return false; }
    var cost = new Array(n), src = new Array(n), trs = new Array(n), done = new Array(n);
    for (var k = 0; k < n; k++) { cost[k] = Infinity; src[k] = -1; trs[k] = 0; done[k] = false; }
    TR.walkIn = {};
    start.forEach(function (s) {
      var w = s[1] * WALK_MIN_PER_KM;
      TR.walkIn[s[0]] = w;
      var c = w + 2 + waitOf(s[0]);           // 2 мин на вход и спуск
      if (c < cost[s[0]]) { cost[s[0]] = c; src[s[0]] = s[0]; }
    });
    for (;;) {                                  // Дейкстра на ~450 станциях: быстро и без кучи
      var x = -1, best = Infinity;
      for (var j = 0; j < n; j++) if (!done[j] && cost[j] < best) { best = cost[j]; x = j; }
      if (x < 0) break;
      done[x] = true;
      METRO.adj[x].forEach(function (e) {
        var y = e[0], c = cost[x] + e[1] + (e[2] ? waitOf(y) : 0);
        if (c < cost[y]) { cost[y] = c; src[y] = src[x]; trs[y] = trs[x] + e[2]; }
      });
    }
    TR.cost = cost; TR.src = src; TR.trs = trs;
    return true;
  }
  function walkMinutes(km) { return km * 1.3 / 4.8 * 60; }
  // Лучший путь на метро до места: { total, walkIn, from, ride, transfers, to, walkOut } или null
  function transitTo(p) {
    if (!hasCoords(p) || !transitPrep()) return null;
    if (!p._st) p._st = nearStations([p.coords[1], p.coords[0]], 2, 4);
    var best = null;
    p._st.forEach(function (s) {
      var c = TR.cost[s[0]];
      if (!isFinite(c)) return;
      var out = 1.5 + s[1] * WALK_MIN_PER_KM;  // 1,5 мин на выход
      if (!best || c + out < best.total) {
        var from = TR.src[s[0]];
        best = { total: c + out, from: from, to: s[0], walkIn: TR.walkIn[from], walkOut: out, transfers: TR.trs[s[0]] };
        best.ride = best.total - best.walkIn - best.walkOut;
      }
    });
    if (best && best.from === best.to) return null;   // одна и та же станция: метро не нужно
    return best;
  }
  // Сколько идти пешком (если не дальше 4 км) и быстрее ли метро
  function etaOf(p) {
    var d = distOf(p);
    if (d === null) return null;
    var walk = d <= 4 ? walkMinutes(d) : null;
    var metro = transitTo(p);
    var useMetro = metro && (walk === null || metro.total < walk - 3);
    return { d: d, walk: walk, metro: metro, best: useMetro ? metro.total : walk, mode: useMetro ? 'metro' : (walk !== null ? 'walk' : '') };
  }
  function mins(m) { m = Math.max(1, Math.round(m)); return m + ' мин'; }
  function stationHTML(i) {
    return '<span class="metro"><i style="--c:' + esc(lineOf(i)[1]) + '"></i>' + esc(METRO.stations[i][0]) + '</span>';
  }

  /* Время на машине с пробками — только с ключом API Яндекс Карт: без ключа Яндекс маршруты не строит */
  function carTimeInto(p, el) {
    if (!YMAPS_KEY || !LOC.pos || !el) return;
    var go = function () {
      try {
        window.ymaps.route([LOC.pos, [p.coords[1], p.coords[0]]], { routingMode: 'auto' }).then(function (r) {
          var sec = r.getJamsTime ? r.getJamsTime() : r.getTime();
          if (sec && document.body.contains(el)) {
            el.innerHTML = ICON.car + '<span><b>' + mins(sec / 60) + '</b> на машине сейчас, с пробками</span>';
            el.hidden = false;
          }
        }, function () { /* маршрут не построился */ });
      } catch (e) { /* нет модуля маршрутов */ }
    };
    if (window.ymaps && window.ymaps.route) go();
    else { loadYmaps(); var tries = 0; var t = setInterval(function () { if (window.ymaps && window.ymaps.route) { clearInterval(t); go(); } else if (++tries > 40) clearInterval(t); }, 500); }
  }

  function etaShort(p) {
    var e = etaOf(p);
    if (!e || e.best === null) return '';
    return ' · ' + mins(e.best) + (e.mode === 'metro' ? ' на метро' : ' пешком');
  }
  function featTagsHTML(p) {
    var lab = {};
    FEATURES.forEach(function (f) { lab[f[0]] = f[1]; });
    var t = (p.feat || []).filter(function (f) { return lab[f]; }).map(function (f) { return '<span class="tag tag-feat">' + esc(lab[f]) + '</span>'; }).join('');
    return t ? '<div class="feat-tags">' + t + '</div>' : '';
  }
  function otherFilterNames() {
    var out = [];
    FEATURES.forEach(function (f) { if (state.feats[f[0]]) out.push(f[1]); });
    PRICES.forEach(function (pr) { if (state.price === pr[0]) out.push('чек ' + pr[1]); });
    if (state.mine) out.push(state.mine === 'fav' ? 'избранное' : 'хочу сходить');
    return out;
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

  function spinPool(tNow, opts) {
    opts = opts || {};
    var pool = places.filter(function (p) {
      return (opts.anyCuisine || cuisineOk(p)) && (opts.anyDist || distOk(p)) &&
        (opts.anyFilter || (featOk(p) && priceOk(p) && mineOk(p))) && T.statusAtAbs(p._s, tNow).open;
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
    var parts = [];
    if (distOn()) parts.push('до ' + state.dist + ' км');
    if (sel.length) parts.push(sel.join(', ').toLowerCase());
    var extra = otherFilterNames();
    if (extra.length) parts.push(extra.join(', ').toLowerCase());
    var txt;
    if (!n) txt = distOn() ? 'Рядом сейчас всё закрыто' : (sel.length || extra.length ? 'Под выбранное сейчас ничего не открыто' : 'Сейчас всё закрыто, покажу, что откроется раньше');
    else txt = 'Выберу из ' + n + ' ' + plural(n, 'открытого', 'открытых', 'открытых') + (parts.length ? ' · ' + parts.join(' · ') : '');
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
    if (!distOk(p)) return false;
    if (!featOk(p) || !priceOk(p) || !mineOk(p)) return false;
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
    var d = distOf(p);
    if (d !== null) meta.push('<span class="dist">' + ICON.navSm + esc(fmtKm(d) + etaShort(p)) + '</span>');
    if (p.cuisine && p.cuisine.length) meta.push('<span>' + esc(p.cuisine.join(', ')) + '</span>');
    if (p.metro && p.metro[0]) meta.push(metroHTML(p.metro[0]));
    var badges = (MARKS.fav[p.id] ? '<i title="В избранном">' + ICON.star + '</i>' : '') + (MARKS.want[p.id] ? '<i title="Хочу сходить">' + ICON.bookmark + '</i>' : '');
    return '<button class="card' + (st.open ? '' : ' is-closed') + '" type="button" data-id="' + esc(p.id) + '">' +
      '<span class="media">' + placeholderHTML(p) + img + (badges ? '<span class="mark-badges">' + badges + '</span>' : '') +
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
        return sa - sb || byDist(a, b) || a.name.localeCompare(b.name, 'ru');
      });
      closed.sort(function (a, b) {
        var sa = T.statusAtAbs(a._s, tNow), sb = T.statusAtAbs(b._s, tNow);
        return byDist(a, b) || (sa.until || 1e9) - (sb.until || 1e9);
      });
      groups = [];
      if (open.length) groups.push({ title: 'Открыто сейчас · ' + open.length, items: open });
      if (closed.length) groups.push({ title: 'Закрыто · ' + closed.length, items: closed });
    } else {
      var title = state.when === 'now' ? 'Открыто сейчас · ' + list.length
        : 'Открыто в ' + T.hm(state.when) + (Math.floor(state.when / T.DAY) > Math.floor(tNow / T.DAY) ? ' завтра' : '') + ' · ' + list.length;
      groups = list.length ? [{ title: title, items: LOC.pos ? list.slice().sort(byDist) : list }] : [];
    }

    var key = JSON.stringify(groups.map(function (g) { return [g.title, g.items.map(function (p) { return p.id + (MARKS.fav[p.id] ? '*' : '') + (MARKS.want[p.id] ? '+' : ''); })]; })) + (LOC.pos || '');
    var filtered = selectedCuisines().length || state.q || state.when !== 'any' || distOn() || otherFilterNames().length;
    $('#reset').hidden = !filtered;
    $('#count').textContent = (filtered
      ? 'Нашлось ' + list.length + ' из ' + places.length
      : places.length + ' ' + plural(places.length, 'место', 'места', 'мест')) +
      (distOn() ? ' · до ' + state.dist + ' км ' + fromWhom() : (LOC.pos ? ' · ближние выше' : ''));
    syncMap(list, tNow);

    if (key === lastListKey) {
      refreshStatuses(now, tNow);
      return;
    }
    lastListKey = key;

    if (!groups.length) {
      $('#list').innerHTML = '<div class="empty"><b>Под эти фильтры ничего нет</b>' +
        '<span>' + (distOn() ? 'Попробуйте радиус побольше, другое время или другую кухню.' : 'Попробуйте другое время, кухню или особенности.') + '</span>' +
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
    renderMoreFilters();
    renderDist();
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
    if (hasCoords(p)) facts.push(distFactHTML(p));
    if ((p.phones && p.phones.length) || p.booking || p.site) facts.push(phoneFactHTML(p));
    if (p.price) facts.push('<div class="fact">' + ICON.wallet + '<div>' + esc(p.price) + '</div></div>');
    var perks = (p.perks || []).map(function (t) { return '<li>' + ICON.spark + '<span>' + esc(t.text) + '</span></li>'; }).join('');
    return (opts.withTitle ? '<h2 class="title" id="sheetTitle">' + esc(p.name) + '</h2>' : '') +
      '<div class="meta">' + (p.cuisine || []).map(function (c) { return '<span class="tag">' + esc(c) + '</span>'; }).join('') +
        (p.type ? '<span>' + esc(p.type) + '</span>' : '') +
        (p.rating ? '<span>★ ' + fmtRating(p.rating) + ' на Яндексе</span>' : '') + '</div>' +
      '<div class="status-line tone-' + lab.tone + '"><span class="dot"></span><span>' + esc(lab.text) + '</span>' +
        '<span class="muted">· ' + esc(todayText(p, now).toLowerCase()) + '</span></div>' +
      marksRowHTML(p) +
      featTagsHTML(p) +
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

  /* ---------- Карточка места: расстояние, маршрут, телефон для брони ---------- */
  function distFactHTML(p) {
    var d = distOf(p);
    var line = d === null
      ? '<span>Сколько ехать?</span><button class="link-btn" type="button" data-action="locate">Показать расстояние</button>'
      : '<b>' + esc(fmtKm(d)) + '</b><span class="muted">' + esc(fromWhom()) + ' по прямой</span>';
    var trip = d === null ? '' : tripHTML(p);
    var modes = [['pd', 'Пешком'], ['mt', 'Транспорт'], ['taxi', 'Такси'], ['auto', 'Авто']];
    return '<div class="fact" id="sheetDist">' + ICON.route + '<div><div class="dist-line">' + line + '</div>' + trip +
      '<div class="route-btns modes">' + modes.map(function (m) {
        return '<a class="route-btn" href="' + esc(routeUrl(p, m[0])) + '" target="_blank" rel="noopener" data-external>' + m[1] + '</a>';
      }).join('') + '</div><p class="hint">' + (d === null ? 'Маршрут откроется в Яндекс Картах.'
        : 'Время на метро — наша оценка по схеме, с ожиданием поезда и пересадками. ' + (YMAPS_KEY ? 'Точный маршрут' : 'Время на машине с пробками и точный маршрут') + ' — по кнопкам выше, в Яндекс Картах.') + '</p></div></div>';
  }

  function tripHTML(p) {
    var e = etaOf(p);
    if (!e) return '';
    var rows = '';
    if (e.walk !== null) rows += '<div class="eta-row' + (e.mode === 'walk' ? ' is-best' : '') + '">' + ICON.walk + '<span><b>' + mins(e.walk) + '</b> пешком</span></div>';
    var m = e.metro;
    if (m && (e.walk === null || m.total < e.walk)) {
      rows += '<div class="eta-row' + (e.mode === 'metro' ? ' is-best' : '') + '">' + ICON.metroM + '<span><b>' + mins(m.total) + '</b> на метро' +
        '<span class="eta-steps">' + mins(m.walkIn) + ' пешком до ' + stationHTML(m.from) + ' → ' + mins(m.ride) + ' в метро' +
        (m.transfers ? ', ' + m.transfers + ' ' + plural(m.transfers, 'пересадка', 'пересадки', 'пересадок') : ', без пересадок') +
        ' → ' + mins(m.walkOut) + ' пешком от ' + stationHTML(m.to) + '</span></span></div>';
    }
    rows += '<div class="eta-row" id="carEta" hidden></div>';
    return '<div class="eta">' + rows + '</div>';
  }

  function refreshSheetDistance() {
    var el = document.getElementById('sheetDist');
    if (el && sheetPlace) { el.outerHTML = distFactHTML(sheetPlace); carTimeInto(sheetPlace, document.getElementById('carEta')); }
  }

  function phoneFactHTML(p) {
    var rows = (p.phones || []).slice(0, 2).map(function (ph) {
      return '<div class="phone-row"><a class="phone-num" href="tel:' + esc(ph.v || ph.n) + '">' + esc(ph.n) + '</a>' +
        '<button class="icon-btn" type="button" data-action="copy-phone" data-phone="' + esc(ph.n) + '" aria-label="Скопировать номер ' + esc(ph.n) + '">' + ICON.copy + '</button>' +
        (ph.i ? '<span class="phone-info">' + esc(ph.i) + '</span>' : '') + '</div>';
    }).join('');
    var links = '';
    if (p.booking) links += '<a class="route-btn route-btn-strong" href="' + esc(p.booking) + '" target="_blank" rel="noopener" data-external>' + ICON.calendar + 'Онлайн-бронь</a>';
    if (p.site) links += '<a class="route-btn" href="' + esc(p.site) + '" target="_blank" rel="noopener" data-external>' + ICON.globe + 'Сайт</a>';
    return '<div class="fact">' + ICON.phone + '<div><div class="fact-h">' + (rows ? 'Забронировать столик' : 'Бронь и сайт') + '</div>' + rows +
      (links ? '<div class="route-btns">' + links + '</div>' : '') + '</div></div>';
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
    var ph = (p.phones || [])[0];
    var call = ph ? '<a class="btn btn-secondary' + (mode === 'random' ? ' btn-icon' : '') + '" href="tel:' + esc(ph.v || ph.n) + '" aria-label="Позвонить ' + esc(ph.n) + '">' +
      ICON.phone + (mode === 'random' ? '' : 'Позвонить') + '</a>' : '';
    if (mode === 'random') {
      return '<div class="actions"><button class="btn btn-secondary" type="button" data-action="respin">' + ICON.dice + 'Ещё</button>' + call + maps + '</div>';
    }
    return '<div class="actions">' + call + maps + '</div>';
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
    if (sheetPlace) carTimeInto(sheetPlace, document.getElementById('carEta'));
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
    else if (LOC.picking) stopPick();
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
  var lastSpin = {};
  function spin(opts) {
    opts = opts || {};
    lastSpin = opts;
    var now = T.mskNow();
    var tNow = T.absNow(now);
    var pool = spinPool(tNow, opts);
    var btn = $('#spin');
    btn.classList.remove('is-rolling');
    void btn.offsetWidth;
    btn.classList.add('is-rolling');
    haptic('impactOccurred', 'medium');

    if (!pool.length) {
      var why = 'all';
      if (!opts.anyDist && distOn() && spinPool(tNow, { anyCuisine: opts.anyCuisine, anyFilter: opts.anyFilter, anyDist: true }).length) why = 'dist';
      else if (!opts.anyCuisine && selectedCuisines().length && spinPool(tNow, { anyCuisine: true, anyFilter: opts.anyFilter, anyDist: opts.anyDist }).length) why = 'cuisine';
      else if (!opts.anyFilter && otherFilterNames().length && spinPool(tNow, { anyCuisine: true, anyFilter: true, anyDist: opts.anyDist }).length) why = 'filters';
      showNothingOpen(now, tNow, why, opts);
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
      var pd = distOf(pick);
      $('#revealSub').textContent = [pd !== null ? fmtKm(pd) + etaShort(pick) : '', pick.cuisine && pick.cuisine.join(', '),
        pick.metro && pick.metro[0] && ('м. ' + pick.metro[0].name)].filter(Boolean).join(' · ');
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

  function showNothingOpen(now, tNow, why, opts) {
    opts = opts || {};
    var soonest = function (filterFn) {
      return places.filter(filterFn)
        .map(function (p) { return { p: p, st: T.statusAtAbs(p._s, tNow) }; })
        .filter(function (x) { return !x.st.open && !x.st.never; })
        .sort(function (a, b) { return a.st.until - b.st.until; })
        .slice(0, 4);
    };
    var soon = soonest(function (p) {
      return (opts.anyCuisine || cuisineOk(p)) && (opts.anyDist || distOk(p)) && (opts.anyFilter || (featOk(p) && priceOk(p) && mineOk(p)));
    });
    if (!soon.length) soon = soonest(function () { return true; });
    var list = soon.map(function (x) {
      var photo = (x.p.photos || [])[0];
      return '<button class="mini" type="button" data-id="' + esc(x.p.id) + '"><span class="thumb">' + placeholderHTML(x.p) +
        (photo ? '<img src="' + esc(photoUrl(photo, 'M')) + '" alt="" loading="lazy" referrerpolicy="no-referrer">' : '') + '</span>' +
        '<span><b>' + esc(x.p.name) + '</b><span>' + esc(T.statusLabel(x.st).text) +
        (distOf(x.p) !== null ? ' · ' + esc(fmtKm(distOf(x.p))) : '') + '</span></span></button>';
    }).join('');
    var head = {
      dist: ['Рядом всё спит', 'В радиусе ' + state.dist + ' км сейчас всё закрыто'],
      cuisine: ['Эта кухня спит', 'Из выбранного сейчас всё закрыто'],
      filters: ['Всё спит', 'Под выбранные фильтры сейчас всё закрыто'],
      all: ['Москва спит', 'Сейчас всё закрыто']
    }[why] || ['Москва спит', 'Сейчас всё закрыто'];
    var more = why === 'dist' ? '<button class="btn btn-primary" type="button" data-action="spin-anydist">' + ICON.dice + 'Крутить по всей Москве</button>'
      : why === 'cuisine' || why === 'filters' ? '<button class="btn btn-primary" type="button" data-action="spin-all">' + ICON.dice + 'Крутить без фильтров</button>' : '';
    openSheet('<div class="sheet-inner is-revealed">' +
      '<div class="reveal"><button class="close" type="button" data-action="close" aria-label="Закрыть">' + ICON.close + '</button>' +
        '<div class="reveal-eyebrow">' + head[0] + '</div>' +
        '<div class="reveal-name" id="sheetTitle">' + esc(head[1]) + '</div>' +
        '<div class="reveal-sub">Раньше всех откроются эти места</div></div>' +
      '<div class="sheet-body"><div class="soonest">' + list + '</div>' + more + '</div></div>');
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
      else if (a === 'respin') spin(lastSpin);
      else if (a === 'spin-all') spin({ anyCuisine: true, anyFilter: true, anyDist: lastSpin.anyDist });
      else if (a === 'spin-anydist') spin({ anyDist: true, anyCuisine: lastSpin.anyCuisine, anyFilter: lastSpin.anyFilter });
      else if (a === 'mark') toggleMark(act.getAttribute('data-mark'), act.getAttribute('data-id-mark'));
      else if (a === 'share') sharePlace(act.getAttribute('data-id-mark'));
      else if (a === 'suggest') showSuggest();
      else if (a === 'addr') showAddr();
      else if (a === 'addr-pick') pickAddr(Number(act.getAttribute('data-i')));
      else if (a === 'reset') resetFilters();
      else if (a === 'map-full') setMapFull(!mapIsFull());
      else if (a === 'peek-close') closePeek();
      else if (a === 'locate') locate(false);
      else if (a === 'pick-on-map') startPick();
      else if (a === 'pick-cancel') { stopPick(); if (mapIsFull()) setMapFull(false); }
      else if (a === 'map-me') mapMe();
      else if (a === 'loc-settings') { try { tg.LocationManager.openSettings(); } catch (err) { /* ок */ } }
      else if (a === 'copy-phone') copyText(act.getAttribute('data-phone'));
      else if (a === 'map-retry') { MAP.attempt = 0; MAP.failed = false; loadYmaps(); }
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
      } else if (chip.hasAttribute('data-dist')) {
        state.dist = Number(chip.getAttribute('data-dist')) || 0;
      } else if (chip.hasAttribute('data-feat')) {
        var f = chip.getAttribute('data-feat');
        if (state.feats[f]) delete state.feats[f]; else state.feats[f] = true;
      } else if (chip.hasAttribute('data-price')) {
        state.price = chip.getAttribute('data-price');
      } else if (chip.hasAttribute('data-mine')) {
        var mk = chip.getAttribute('data-mine');
        state.mine = state.mine === mk ? '' : mk;
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
    state.dist = 0;
    state.feats = {};
    state.price = '';
    state.mine = '';
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
  var YMAPS_KEY = '';  // ключ JavaScript API 2.1 с правом на маршруты (платный тариф Яндекса); бесплатный ключ v3 маршруты не строит
  var MAP = { map: null, clusterer: null, marks: {}, key: '', list: [], active: null, margin: null, failed: false, loading: false, me: null, circle: null };
  var mapCard = $('#mapCard');
  var mapPeek = $('#mapPeek');

  function mapIsFull() { return !!(mapCard && mapCard.classList.contains('is-full')); }

  // Карта без ключа API иногда не грузится с первого раза: одна тихая повторная попытка,
  // потом кнопка «Попробовать ещё раз»
  function mapFail() {
    if (MAP.map || MAP.failed) return;
    MAP.loading = false;
    if ((MAP.attempt || 0) < 2) { setTimeout(loadYmaps, 1200); return; }
    MAP.failed = true;
    var fb = $('#mapFallback');
    if (fb) fb.hidden = false;
    var ld = $('#mapLoading');
    if (ld) ld.hidden = true;
  }

  function loadYmaps() {
    if (MAP.loading || MAP.map || !mapCard) return;
    MAP.loading = true;
    MAP.failed = false;
    var attempt = (MAP.attempt || 0) + 1;
    MAP.attempt = attempt;
    var ld = $('#mapLoading'), fb = $('#mapFallback');
    if (ld) ld.hidden = false;
    if (fb) fb.hidden = true;
    if (MAP.script) { MAP.script.remove(); MAP.script = null; }
    if (attempt > 1) { try { delete window.ymaps; } catch (e) { window.ymaps = undefined; } }
    var fail = function () { if (MAP.attempt === attempt) mapFail(); };
    var s = document.createElement('script');
    s.src = 'https://api-maps.yandex.ru/2.1/?lang=ru_RU' + (YMAPS_KEY ? '&apikey=' + encodeURIComponent(YMAPS_KEY) : '') +
      (attempt > 1 ? '&retry=' + Date.now() : '');
    s.async = true;
    s.onload = function () {
      if (!window.ymaps) { fail(); return; }
      window.ymaps.ready(function () { if (MAP.attempt === attempt && !MAP.map) initMap(); }, fail);
    };
    s.onerror = fail;
    MAP.script = s;
    document.head.appendChild(s);
    setTimeout(function () { if (!MAP.map) fail(); }, 20000);
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
    MAP.map.events.add('click', function (e) {
      if (LOC.picking) { finishPick(e.get('coords')); return; }
      closePeek();
    });
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
    var withCoords = list.filter(hasCoords);
    var key = withCoords.map(function (p) { return p.id; }).join(',') + '|' + state.dist + '|' + (LOC.pos ? LOC.pos.join(',') : '');
    if (key !== MAP.key) {
      MAP.key = key;
      MAP.clusterer.removeAll();
      MAP.marks = {};
      var marks = withCoords.map(function (p) { var m = makeMark(p, tNow); MAP.marks[p.id] = m; return m; });
      MAP.clusterer.add(marks);
      if (MAP.active && !MAP.marks[MAP.active]) closePeek();
      syncUserOnMap(false);
      frameMap(withCoords);
    } else {
      withCoords.forEach(function (p) {
        var m = MAP.marks[p.id];
        if (m) m.properties.set('tone', toneOf(p, tNow));
      });
    }
  }

  function boundsOf(points) {
    var la = points.map(function (q) { return q[0]; }), lo = points.map(function (q) { return q[1]; });
    var b = [[Math.min.apply(null, la), Math.min.apply(null, lo)], [Math.max.apply(null, la), Math.max.apply(null, lo)]];
    if (b[1][0] - b[0][0] < 0.004) { b[0][0] -= 0.004; b[1][0] += 0.004; }
    if (b[1][1] - b[0][1] < 0.007) { b[0][1] -= 0.007; b[1][1] += 0.007; }
    return b;
  }
  function radiusBounds(pos, km) {
    var dLat = km / 110.57, dLon = km / (111.32 * Math.cos(pos[0] * Math.PI / 180));
    return [[pos[0] - dLat, pos[1] - dLon], [pos[0] + dLat, pos[1] + dLon]];
  }
  // Кадр карты: круг радиуса, если он выбран; иначе «я» и шесть ближайших мест; иначе центр, где больше всего мест
  function frameMap(ps) {
    if (!MAP.map) return;
    var opt = { checkZoomRange: true, zoomMargin: [64, 30, 30, 30] };
    try {
      if (distOn()) { MAP.map.setBounds(radiusBounds(LOC.pos, state.dist), opt); return; }
      if (LOC.pos) {
        var near = ps.filter(function (p) { var d = distOf(p); return d !== null && d <= 30; }).sort(byDist).slice(0, 6);
        if (near.length) {
          MAP.map.setBounds(boundsOf(near.map(function (p) { return [p.coords[1], p.coords[0]]; }).concat([LOC.pos])), opt);
          return;
        }
      }
      if (ps.length > 1) MAP.map.setBounds(coreBounds(ps), opt);
      else if (ps.length === 1) MAP.map.setCenter([ps[0].coords[1], ps[0].coords[0]], 15);
    } catch (e) { /* ок */ }
  }

  function cssVar(name, fallback) {
    var v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return v || fallback;
  }

  // «Я» на карте: синяя точка (или красная, если точку выбрали на карте) и круг выбранного радиуса
  function syncUserOnMap(recenter) {
    if (!MAP.map || !window.ymaps || !LOC.pos) return;
    var ym = window.ymaps;
    var me = cssVar('--me', '#2F7BF5');
    if (!MAP.MeLayout) MAP.MeLayout = ym.templateLayoutFactory.createClass('<div class="me-dot{% if properties.manual %} is-manual{% endif %}"></div>');
    if (!MAP.me) {
      MAP.me = new ym.Placemark(LOC.pos, { manual: isManual() }, {
        iconLayout: MAP.MeLayout,
        iconShape: { type: 'Circle', coordinates: [0, 0], radius: 14 },
        zIndex: 1200,
        hasBalloon: false,
        hasHint: false
      });
      MAP.map.geoObjects.add(MAP.me);
    } else {
      MAP.me.geometry.setCoordinates(LOC.pos);
      MAP.me.properties.set('manual', isManual());
    }
    if (state.dist) {
      if (!MAP.circle) {
        MAP.circle = new ym.Circle([LOC.pos, state.dist * 1000], {}, {
          fillColor: me + '1F', strokeColor: me, strokeOpacity: 0.8, strokeWidth: 2, interactivityModel: 'default#transparent'
        });
        MAP.map.geoObjects.add(MAP.circle);
      } else {
        MAP.circle.geometry.setCoordinates(LOC.pos);
        MAP.circle.geometry.setRadius(state.dist * 1000);
      }
    } else if (MAP.circle) {
      MAP.map.geoObjects.remove(MAP.circle);
      MAP.circle = null;
    }
    if (recenter) frameMap(MAP.list.filter(hasCoords));
  }

  function mapMe() {
    if (LOC.pos && MAP.map) {
      try { MAP.map.setCenter(LOC.pos, Math.max(MAP.map.getZoom(), 14), { duration: 300 }); } catch (e) { /* ок */ }
    } else {
      locate(false);
    }
  }

  // Точка на карте: карта раскрывается на весь экран, следующее нажатие на неё ставит точку
  function startPick() {
    if (MAP.failed) { toast('Карта не загрузилась, выбрать точку не получится'); return; }
    if (sheetIsOpen()) closeSheet();
    closePeek();
    LOC.picking = true;
    loadYmaps();
    var b = $('#pickBanner');
    if (b) b.hidden = false;
    if (mapCard) mapCard.classList.add('is-picking');
    if (!mapIsFull()) setMapFull(true);
  }
  function stopPick() {
    LOC.picking = false;
    var b = $('#pickBanner');
    if (b) b.hidden = true;
    if (mapCard) mapCard.classList.remove('is-picking');
  }
  function finishPick(coords) {
    stopPick();
    setLoc([coords[0], coords[1]], 'map', 0);
    if (mapIsFull()) setMapFull(false);
    toast('Считаю расстояния от выбранной точки');
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
    var d = distOf(p);
    if (d !== null) meta.push(esc(fmtKm(d) + etaShort(p)));
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
    if (!on) stopPick();
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
  loadMarks();
  openFromLink();
  locate(true);
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
