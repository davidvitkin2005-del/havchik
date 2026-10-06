const assert = require('node:assert/strict');
const T = require('../src/time.js');

let passed = 0;
function test(name, fn) {
  try { fn(); passed++; } catch (e) { console.error('FAIL:', name, '\n ', e.message); process.exitCode = 1; }
}
const at = (dow, hhmm) => { const [h, m] = hhmm.split(':').map(Number); return { dow, min: h * 60 + m }; };
const label = (sched, dow, hhmm) => T.statusLabel(T.statusAt(sched, at(dow, hhmm))).text;
const daily = (s) => Array(7).fill(s);

test('московское время из UTC', () => {
  assert.deepEqual(T.mskNow(new Date('2026-10-06T18:31:00Z')), { dow: 1, min: 21 * 60 + 31 });
  assert.deepEqual(T.mskNow(new Date('2026-10-04T22:10:00Z')), { dow: 0, min: 70 }); // вс 22:10 UTC = пн 01:10 МСК
});

test('обычный день 12–23', () => {
  const s = T.buildSchedule(daily('12:00-23:00'));
  assert.equal(label(s, 1, '10:00'), 'Закрыто, откроется в 12:00');
  assert.equal(label(s, 1, '11:00'), 'Откроется через 60 мин');
  assert.equal(label(s, 1, '12:00'), 'Открыто до 23:00');
  assert.equal(label(s, 1, '22:30'), 'Закроется через 30 мин');
  assert.equal(label(s, 1, '23:00'), 'Закрыто, откроется завтра в 12:00');
});

test('работа после полуночи и переход вс→пн', () => {
  const s = T.buildSchedule(['12:00-23:00', '12:00-23:00', '12:00-23:00', '12:00-23:00', '12:00-02:00', '12:00-02:00', '12:00-02:00']);
  assert.equal(label(s, 5, '01:00'), 'Закроется через 60 мин');   // сб 01:00 — хвост пятницы
  assert.equal(label(s, 5, '00:30'), 'Открыто до 02:00');
  assert.equal(label(s, 0, '01:30'), 'Закроется через 30 мин');   // пн 01:30 — хвост воскресенья
  assert.equal(label(s, 0, '02:00'), 'Закрыто, откроется в 12:00');
  assert.equal(label(s, 1, '01:00'), 'Закрыто, откроется в 12:00'); // вт 01:00 — в пн до 23
});

test('круглосуточно', () => {
  const s = T.buildSchedule(daily('00:00-24:00'));
  assert.equal(s.always, true);
  assert.equal(label(s, 3, '04:00'), 'Круглосуточно');
  assert.equal(T.dayText(s.days[0]), 'круглосуточно');
  const s2 = T.buildSchedule(daily('00:00-00:00'));
  assert.equal(s2.always, true);
});

test('выходной в понедельник', () => {
  const s = T.buildSchedule([null, '12:00-23:00', '12:00-23:00', '12:00-23:00', '12:00-23:00', '12:00-23:00', '12:00-23:00']);
  assert.equal(label(s, 6, '23:30'), 'Закрыто, откроется во вторник в 12:00');
  assert.equal(label(s, 0, '15:00'), 'Закрыто, откроется завтра в 12:00');
  assert.equal(T.dayText(s.days[0]), 'выходной');
});

test('перерыв днём', () => {
  const s = T.buildSchedule(daily('08:00-11:00,12:00-22:00'));
  assert.equal(label(s, 2, '11:30'), 'Откроется через 30 мин');
  assert.equal(label(s, 2, '09:00'), 'Открыто до 11:00');
  assert.equal(label(s, 2, '10:30'), 'Закроется через 30 мин');
});

test('ночь переходит в круглосуточные выходные', () => {
  const s = T.buildSchedule(['10:00-23:00', '10:00-23:00', '10:00-23:00', '10:00-02:00', '00:00-24:00', '00:00-24:00', '10:00-23:00']);
  const st = T.statusAt(s, at(3, '23:00'));
  assert.equal(st.open, true);
  assert.equal(T.hm(st.closeAt), '00:00'); // сб круглосуточно, закроется в полночь на вс
  assert.equal(Math.floor(st.closeAt / T.DAY) % 7, 6);
});

test('группировка дней', () => {
  const s = T.buildSchedule(['12:00-23:00', '12:00-23:00', '12:00-23:00', '12:00-23:00', '12:00-02:00', '12:00-02:00', '12:00-23:00']);
  assert.deepEqual(T.groupDays(s).map(g => g.label + ' ' + g.text), ['Пн–Чт 12:00–23:00', 'Пт, Сб 12:00–02:00', 'Вс 12:00–23:00']);
  assert.deepEqual(T.groupDays(T.buildSchedule(daily('09:00-21:00'))).map(g => g.label + ' ' + g.text), ['Ежедневно 09:00–21:00']);
});

test('проверка «открыто в» по абсолютному времени', () => {
  const s = T.buildSchedule(daily('11:00-23:00'));
  const now = at(1, '21:40');
  const t11tomorrow = T.absNow(now) - now.min + T.DAY + 11 * 60;
  assert.equal(T.isOpenAtAbs(s, t11tomorrow), true);
  assert.equal(T.isOpenAtAbs(s, t11tomorrow - 60), false);
});

test('ошибки в данных ловятся', () => {
  assert.throws(() => T.buildSchedule(daily('12-23')));
  assert.throws(() => T.buildSchedule(['12:00-23:00']));
});

console.log(`${passed} тестов прошло` + (process.exitCode ? ', есть падения' : ''));
