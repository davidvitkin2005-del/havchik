/* Расписание и «открыто ли сейчас» по московскому времени (UTC+3, без перехода на летнее время).
   Часы в данных: массив из 7 строк, Пн..Вс. Строка: "12:00-23:00", несколько интервалов через запятую,
   "12:00-02:00" — работа после полуночи, "00:00-24:00" — круглосуточно, null или "" — выходной. */
(function (root) {
  'use strict';

  var DAY = 1440;
  var WEEK = 7 * DAY;
  var DAYS_SHORT = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
  var DAYS_ACC = ['в понедельник', 'во вторник', 'в среду', 'в четверг', 'в пятницу', 'в субботу', 'в воскресенье'];

  function mskNow(date) {
    var d = date || new Date();
    var t = new Date(d.getTime() + 3 * 3600 * 1000);
    return { dow: (t.getUTCDay() + 6) % 7, min: t.getUTCHours() * 60 + t.getUTCMinutes() };
  }

  function pad(n) { return (n < 10 ? '0' : '') + n; }

  function hm(min) {
    var m = ((min % DAY) + DAY) % DAY;
    return pad(Math.floor(m / 60)) + ':' + pad(m % 60);
  }

  function parseHM(s) {
    var m = /^\s*(\d{1,2}):(\d{2})\s*$/.exec(s);
    if (!m) throw new Error('Неверное время: ' + s);
    var v = Number(m[1]) * 60 + Number(m[2]);
    if (v > DAY) throw new Error('Неверное время: ' + s);
    return v;
  }

  function parseDay(str) {
    if (!str) return [];
    return String(str).split(',').map(function (part) {
      var bits = part.split(/[-–—]/);
      if (bits.length !== 2) throw new Error('Неверный интервал: ' + part);
      var s = parseHM(bits[0]);
      var e = parseHM(bits[1]);
      if (e <= s) e += DAY; // после полуночи; "00:00-00:00" тоже круглосуточно
      return [s, e];
    });
  }

  /* Строим непрерывную шкалу из трёх недель подряд, чтобы честно обработать
     ночные смены и переход с воскресенья на понедельник. Текущий момент
     всегда ищем в средней неделе. */
  function buildSchedule(hours) {
    if (!hours || hours.length !== 7) throw new Error('Нужно 7 дней расписания');
    var days = hours.map(parseDay);
    var base = [];
    days.forEach(function (ivs, d) {
      ivs.forEach(function (iv) { base.push([d * DAY + iv[0], d * DAY + iv[1]]); });
    });
    var all = [];
    for (var w = 0; w < 3; w++) {
      base.forEach(function (iv) { all.push([iv[0] + w * WEEK, iv[1] + w * WEEK]); });
    }
    all.sort(function (a, b) { return a[0] - b[0]; });
    var merged = [];
    all.forEach(function (iv) {
      var last = merged[merged.length - 1];
      if (last && iv[0] <= last[1]) last[1] = Math.max(last[1], iv[1]);
      else merged.push([iv[0], iv[1]]);
    });
    var always = merged.some(function (iv) { return iv[0] <= WEEK && iv[1] >= 2 * WEEK; });
    return { days: days, merged: merged, always: always };
  }

  function absNow(now) { return WEEK + now.dow * DAY + now.min; }

  function statusAtAbs(sched, t) {
    if (sched.always) return { open: true, always: true, t: t };
    for (var i = 0; i < sched.merged.length; i++) {
      var iv = sched.merged[i];
      if (iv[0] <= t && t < iv[1]) return { open: true, closeAt: iv[1], left: iv[1] - t, t: t };
      if (iv[0] > t) return { open: false, openAt: iv[0], until: iv[0] - t, t: t };
    }
    return { open: false, never: true, t: t };
  }

  function statusAt(sched, now) { return statusAtAbs(sched, absNow(now)); }

  function isOpenAtAbs(sched, t) { return statusAtAbs(sched, t).open; }

  function dayText(ivs) {
    if (!ivs.length) return 'выходной';
    if (ivs.length === 1 && ivs[0][0] === 0 && ivs[0][1] === DAY) return 'круглосуточно';
    return ivs.map(function (iv) { return hm(iv[0]) + '–' + hm(iv[1]); }).join(', ');
  }

  /* «Пн–Чт 12:00–23:00», «Пт, Сб 12:00–02:00»… Соседние дни с одинаковыми часами склеиваем. */
  function groupDays(sched) {
    var texts = sched.days.map(dayText);
    if (texts.every(function (t) { return t === texts[0]; })) {
      return [{ label: 'Ежедневно', text: texts[0], from: 0, to: 6 }];
    }
    var groups = [];
    var start = 0;
    for (var i = 1; i <= 7; i++) {
      if (i === 7 || texts[i] !== texts[start]) {
        var label = start === i - 1 ? DAYS_SHORT[start]
          : (i - 1 - start === 1 ? DAYS_SHORT[start] + ', ' + DAYS_SHORT[i - 1] : DAYS_SHORT[start] + '–' + DAYS_SHORT[i - 1]);
        groups.push({ label: label, text: texts[start], from: start, to: i - 1 });
        start = i;
      }
    }
    return groups;
  }

  function statusLabel(st) {
    if (st.always) return { tone: 'open', text: 'Круглосуточно' };
    if (st.never) return { tone: 'closed', text: 'Часы не указаны' };
    if (st.open) {
      if (st.left <= 60) return { tone: 'soon', text: 'Закроется через ' + st.left + ' мин' };
      return { tone: 'open', text: 'Открыто до ' + hm(st.closeAt) };
    }
    if (st.until <= 60) return { tone: 'soon', text: 'Откроется через ' + st.until + ' мин' };
    var diff = Math.floor(st.openAt / DAY) - Math.floor(st.t / DAY);
    var when;
    if (diff === 0) when = 'в ' + hm(st.openAt);
    else if (diff === 1) when = 'завтра в ' + hm(st.openAt);
    else when = DAYS_ACC[Math.floor(st.openAt / DAY) % 7] + ' в ' + hm(st.openAt);
    return { tone: 'closed', text: 'Закрыто, откроется ' + when };
  }

  var api = {
    DAY: DAY, WEEK: WEEK, DAYS_SHORT: DAYS_SHORT,
    mskNow: mskNow, hm: hm, parseDay: parseDay, buildSchedule: buildSchedule,
    absNow: absNow, statusAt: statusAt, statusAtAbs: statusAtAbs, isOpenAtAbs: isOpenAtAbs,
    dayText: dayText, groupDays: groupDays, statusLabel: statusLabel
  };
  root.HavTime = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
