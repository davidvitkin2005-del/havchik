"""Избранное и «Хочу сходить» (облако Telegram), фильтры по особенностям и чеку, поделиться,
открытие места по ссылке, предложить место, время в пути пешком и на метро.
Telegram подменяется заглушкой с CloudStorage, LocationManager и openTelegramLink.
python3 source/tests/features_check.py ПАПКА_ДЛЯ_СКРИНШОТОВ"""
import json
import os
import subprocess
import sys
import time
from pathlib import Path

os.environ.setdefault('PLAYWRIGHT_BROWSERS_PATH', '/opt/pw-browsers')
from playwright.sync_api import sync_playwright  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
SITE = ROOT.parent if (ROOT.parent / '.git').exists() else ROOT / 'dist'
OUT = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / 'tests' / 'shots-features'
OUT.mkdir(parents=True, exist_ok=True)
PORT = 8771
PLACES = json.loads((ROOT / 'data' / 'places.json').read_text(encoding='utf-8'))

STUB = r"""
window.__cloud = window.__cloud || {};
window.__links = [];
window.Telegram = { WebApp: {
  platform: 'ios', version: '8.0', colorScheme: 'light', themeParams: {},
  initDataUnsafe: { start_param: window.__START || '' },
  isVersionAtLeast: function () { return true; },
  ready: function () {}, expand: function () {}, disableVerticalSwipes: function () {},
  setHeaderColor: function () {}, setBackgroundColor: function () {}, setBottomBarColor: function () {},
  onEvent: function () {}, offEvent: function () {},
  BackButton: { show: function () {}, hide: function () {}, onClick: function () {} },
  HapticFeedback: { impactOccurred: function () {}, notificationOccurred: function () {}, selectionChanged: function () {} },
  openTelegramLink: function (u) { window.__links.push(u); },
  openLink: function (u) { window.__links.push(u); },
  CloudStorage: {
    getItem: function (k, cb) { setTimeout(function () { cb(null, window.__cloud[k] || ''); }, 30); },
    setItem: function (k, v, cb) { window.__cloud[k] = v; try { sessionStorage.setItem('cloud', JSON.stringify(window.__cloud)); } catch (e) {} if (cb) cb(null, true); }
  },
  LocationManager: { isInited: true, isLocationAvailable: true, isAccessGranted: true, isAccessRequested: true,
    init: function (cb) { cb && cb(); },
    getLocation: function (cb) { setTimeout(function () { cb({ latitude: 55.7601, longitude: 37.6265, horizontal_accuracy: 20 }); }, 50); },
    openSettings: function () {} },
  DeviceOrientation: { start: function () {}, stop: function () {} }
} };
"""

srv = subprocess.Popen([sys.executable, '-m', 'http.server', str(PORT), '--directory', str(SITE)],
                       stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(1)
errors, fails = [], []


def check(cond, text):
    print(('ок   ' if cond else 'FAIL ') + text)
    if not cond:
        fails.append(text)


def new_page(b, start='', cloud=None):
    ctx = b.new_context(viewport={'width': 390, 'height': 800}, device_scale_factor=2, is_mobile=True, has_touch=True, locale='ru-RU')
    ctx.route('**/telegram-web-app.js*', lambda r: r.fulfill(status=200, content_type='application/javascript', body=''))
    ctx.route('**/api-maps.yandex.ru/**', lambda r: r.abort())
    ctx.add_init_script('window.__START=' + json.dumps(start) + ';window.__cloud=' + json.dumps(cloud or {}) + ';' + STUB)
    pg = ctx.new_page()
    pg.on('pageerror', lambda e: errors.append(str(e)))
    pg.goto(f'http://127.0.0.1:{PORT}/index.html', wait_until='domcontentloaded')
    pg.wait_for_selector('.card')
    return ctx, pg


try:
    with sync_playwright() as p:
        b = p.chromium.launch()
        ctx, pg = new_page(b)
        pg.wait_for_function("document.querySelector('#distChips [data-dist]')", timeout=10000)

        # особенности и чек
        feats = pg.eval_on_selector_all('#featChips .chip', 'e => e.map(x => x.innerText.replace(/\\s+/g, " "))')
        print('     особенности:', feats)
        check(len(feats) >= 8, f'кнопок особенностей: {len(feats)}')
        prices = pg.eval_on_selector_all('#priceChips .chip', 'e => e.map(x => x.innerText.replace(/\\s+/g, " "))')
        check(len(prices) == 4, f'кнопки чека: {prices}')
        dogs = sum(1 for x in PLACES if 'dogs' in (x.get('feat') or []))
        pg.click('#featChips [data-feat="dogs"]')
        n = pg.locator('.card').count()
        check(n == dogs, f'«С собакой»: карточек {n}, мест с собакой {dogs}')
        both = sum(1 for x in PLACES if 'dogs' in (x.get('feat') or []) and 'veranda' in (x.get('feat') or []))
        pg.click('#featChips [data-feat="veranda"]')
        n = pg.locator('.card').count()
        check(n == both or (both == 0 and pg.locator('.empty').count() == 1), f'собака И веранда: {n} (ожидали {both})')
        pg.click('#reset')
        lo = sum(1 for x in PLACES if x.get('priceB') == 'lo')
        pg.click('#priceChips [data-price="lo"]')
        check(pg.locator('.card').count() == lo, f'чек до 1000 ₽: {pg.locator(".card").count()} из {lo}')
        sub = pg.inner_text('#spinSub')
        check('до 1000' in sub, f'рандомайзер учитывает чек: «{sub}»')
        pg.click('#reset')
        check(pg.locator('#mineSection').is_hidden(), 'без отметок раздел «Мои места» скрыт')

        # время в пути в списке
        d0 = pg.locator('.card .dist').first.inner_text()
        check('мин' in d0, f'в карточке время в пути: «{d0}»')

        # карточка места: отметки, время на метро
        far = next(x for x in PLACES if x.get('coords') and abs(x['coords'][1] - 55.76) + abs(x['coords'][0] - 37.63) > 0.06)
        pg.evaluate("id => document.querySelector('[data-id=\"' + id + '\"]').click()", far['id'])
        pg.wait_for_selector('#sheet.is-open #marksRow')
        eta = pg.inner_text('#sheetDist')
        print('     ', far['name'], '|', eta.replace('\n', ' / ')[:300])
        check('на метро' in eta and 'пешком до' in eta, 'в шторке разбивка: пешком до метро → в метро → пешком')
        check(pg.locator('#carEta').is_hidden(), 'без ключа Яндекса время на машине не выдумываем')
        pg.screenshot(path=str(OUT / 'f1-sheet.png'))
        pg.locator('#sheetDist').screenshot(path=str(OUT / 'f2-eta.png'))
        pg.click('#marksRow [data-mark="fav"]')
        check('В избранном' in pg.inner_text('#marksRow'), 'кнопка «В избранное» переключилась')
        pg.click('#marksRow [data-mark="want"]')
        cloud = pg.evaluate('window.__cloud.marks')
        saved = json.loads(cloud or '{}')
        check(saved.get('fav') == [far['id']] and saved.get('want') == [far['id']], f'записано в облако Telegram: {cloud}')
        pg.click('#marksRow [data-action="share"]')
        links = pg.evaluate('window.__links')
        check(any('t.me/share/url' in u for u in links), f'«Поделиться» открывает выбор чата: {links[-1][:120] if links else "—"}')
        pg.click('#sheet [data-action="close"]')
        check(pg.locator('#mineSection').is_visible(), 'появился раздел «Мои места»')
        pg.click('#mineChips [data-mine="fav"]')
        check(pg.locator('.card').count() == 1, 'фильтр «Избранное» оставляет одно место')
        check(pg.locator('.card .mark-badges i').count() == 2, 'на карточке значки избранного и «хочу сходить»')
        pg.locator('.app-inner').screenshot(path=str(OUT / 'f3-mine.png'))

        # предложить место
        pg.click('#reset')
        pg.click('.suggest-card [data-action="suggest"]')
        pg.wait_for_selector('#sheet.is-open .suggest-cta')
        pg.screenshot(path=str(OUT / 'f4-suggest.png'))
        pg.click('.suggest-cta')
        check(pg.evaluate('window.__links')[-1].startswith('https://t.me/Havchik_MSK_bot'), 'кнопка «Написать боту» открывает бота')
        ctx.close()

        # избранное из облака на другом устройстве + открытие по ссылке
        target = PLACES[5]
        ctx, pg = new_page(b, start=target['id'], cloud={'marks': json.dumps({'fav': [target['id']], 'want': []})})
        pg.wait_for_selector('#sheet.is-open')
        title = pg.inner_text('#sheetTitle')
        check(title == target['name'], f'ссылка startapp открыла «{title}»')
        pg.wait_for_timeout(300)
        check('В избранном' in pg.inner_text('#marksRow'), 'избранное подтянулось из облака Telegram')
        ctx.close()
        b.close()
finally:
    srv.terminate()

for e in errors:
    print('ОШИБКА СТРАНИЦЫ:', e)
print('\nИтог:', 'всё в порядке' if not fails and not errors else f'проблем: {len(fails) + len(errors)}')
sys.exit(1 if fails or errors else 0)
