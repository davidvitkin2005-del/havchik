"""Геопозиция, расстояния, фильтр «рядом», маршрут и телефон в карточке.
Два прогона: геопозиция разрешена (точка у «Лубянки») и запрещена (точку выбирают на карте).
python3 source/tests/geo_check.py ПАПКА_ДЛЯ_СКРИНШОТОВ"""
import os
import subprocess
import sys
import time
from pathlib import Path

os.environ.setdefault('PLAYWRIGHT_BROWSERS_PATH', '/opt/pw-browsers')
from playwright.sync_api import sync_playwright  # noqa: E402
from PIL import Image  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
SITE = ROOT.parent if (ROOT.parent / '.git').exists() else ROOT / 'dist'
OUT = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / 'tests' / 'shots-geo'
OUT.mkdir(parents=True, exist_ok=True)
PORT = 8768
LUBYANKA = {'latitude': 55.7601, 'longitude': 37.6265}

srv = subprocess.Popen([sys.executable, '-m', 'http.server', str(PORT), '--directory', str(SITE)],
                       stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(1)
shots, errors, fails = [], [], []


def check(cond, text):
    print(('ок   ' if cond else 'FAIL ') + text)
    if not cond:
        fails.append(text)


def shot(page, name, el=None):
    f = OUT / name
    (el or page).screenshot(path=str(f))
    shots.append(f)


try:
    with sync_playwright() as p:
        b = p.chromium.launch()

        # ---------- 1. Геопозиция разрешена ----------
        ctx = b.new_context(viewport={'width': 390, 'height': 800}, device_scale_factor=2, is_mobile=True, has_touch=True,
                            locale='ru-RU', geolocation=LUBYANKA, permissions=['geolocation', 'clipboard-read', 'clipboard-write'])
        pg = ctx.new_page()
        pg.on('pageerror', lambda e: errors.append('1: ' + str(e)))
        pg.goto(f'http://127.0.0.1:{PORT}/index.html', wait_until='networkidle')
        pg.wait_for_function("document.querySelector('#distChips [data-dist]')", timeout=10000)
        check(True, 'при разрешённой геопозиции расстояния включаются сами, без нажатия')
        label = pg.inner_text('#distLabel')
        check('от вас' in label, f'подпись фильтра: «{label}»')
        chips = pg.eval_on_selector_all('#distChips [data-dist]', 'els => els.map(e => e.innerText.replace(/\\s+/g, " "))')
        print('     кнопки:', chips)
        first = pg.locator('.card').first
        d0 = first.locator('.dist').inner_text()
        check(bool(d0), f'у первой карточки расстояние: {d0}')
        count0 = pg.inner_text('#count')
        check('ближние выше' in count0, f'счётчик: «{count0}»')
        shot(pg, 'g1-filters.png', pg.locator('.app-inner'))

        # фильтр «до 1 км»
        pg.locator('#distChips [data-dist="1"]').click()
        pg.wait_for_timeout(400)
        n1 = pg.locator('.card').count()
        dists = pg.eval_on_selector_all('.card .dist', 'els => els.map(e => e.innerText)')
        check(n1 > 0 and all(('м' in x and 'км' not in x) or x.startswith('1,0') or x.startswith('0,') for x in dists),
              f'«до 1 км»: {n1} мест, расстояния {dists[:8]}')
        print('     счётчик:', pg.inner_text('#count'), '| рандомайзер:', pg.inner_text('#spinSub'))
        check('до 1 км' in pg.inner_text('#spinSub'), 'рандомайзер учитывает радиус')

        # карта: «я», круг радиуса
        pg.locator('#mapCard').scroll_into_view_if_needed()
        pg.wait_for_function("document.querySelector('.me-dot')", timeout=30000)
        pg.wait_for_timeout(1200)
        check(pg.locator('.me-dot').count() == 1, 'на карте есть точка «я»')
        shot(pg, 'g2-map-1km.png', pg.locator('#mapCard'))

        # рандомайзер в радиусе
        pg.evaluate('window.scrollTo(0, 0)')
        pg.locator('#spin').click()
        pg.wait_for_timeout(2600)
        sub = pg.inner_text('#revealSub')
        check('от вас' in sub, f'рандомайзер: «{pg.inner_text("#reveal .reveal-name")}», {sub}')
        pg.locator('#sheet [data-action="close"]').first.click()
        pg.wait_for_timeout(500)

        # карточка места с телефоном и онлайн-бронью
        pg.locator('#distChips [data-dist="0"]').click()
        pg.wait_for_timeout(300)
        pg.fill('#q', 'Апартмент')
        pg.wait_for_timeout(300)
        pg.locator('.card').first.click()
        pg.wait_for_timeout(700)
        dist_line = pg.inner_text('#sheetDist .dist-line')
        check('от вас' in dist_line, f'в карточке: «{dist_line}»')
        hrefs = pg.eval_on_selector_all('#sheetDist .route-btn', 'els => els.map(e => e.getAttribute("href"))')
        check(len(hrefs) == 4 and all('rtext=~' in h for h in hrefs), f'маршрут: {len(hrefs)} кнопки, своя геопозиция в ссылку не попадает')
        tel = pg.get_attribute('#sheet .phone-num', 'href')
        check(tel and tel.startswith('tel:+7'), f'телефон: {pg.inner_text("#sheet .phone-num")} ({tel})')
        check(pg.locator('#sheet .route-btn-strong').count() == 1, 'есть кнопка «Онлайн-бронь»')
        check(pg.locator('#sheet .actions a[href^="tel:"]').count() == 1, 'внизу кнопка «Позвонить»')
        pg.locator('#sheet [data-action="copy-phone"]').first.click()
        pg.wait_for_timeout(400)
        check('скопирован' in (pg.inner_text('#toast') if pg.is_visible('#toast') else ''), 'копирование номера показывает подсказку')
        shot(pg, 'g3-card.png')
        pg.locator('#sheet .sheet-body').evaluate('el => el.querySelector("#sheetDist").scrollIntoView({block: "start"})')
        pg.wait_for_timeout(300)
        shot(pg, 'g4-card-phone.png')
        ctx.close()

        # ---------- 2. Геопозиция запрещена: точка на карте ----------
        ctx = b.new_context(viewport={'width': 390, 'height': 800}, device_scale_factor=2, is_mobile=True, has_touch=True,
                            locale='ru-RU', color_scheme='dark')
        pg = ctx.new_page()
        pg.on('pageerror', lambda e: errors.append('2: ' + str(e)))
        pg.goto(f'http://127.0.0.1:{PORT}/index.html', wait_until='networkidle')
        pg.wait_for_timeout(800)
        check(pg.locator('#distChips [data-action="locate"]').count() == 1, 'без доступа видна кнопка «Показать, сколько до мест»')
        check('остаётся на телефоне' in pg.inner_text('#locMsg'), 'под кнопкой пояснение, что геопозиция никуда не уходит')
        pg.locator('#distChips [data-action="locate"]').click()
        pg.wait_for_timeout(1200)
        msg = pg.inner_text('#locMsg') if pg.is_visible('#locMsg') else ''
        check('запрещён' in msg or 'Не получилось' in msg, f'после отказа: «{msg}»')
        shot(pg, 'g5-denied.png', pg.locator('.app-inner'))
        pg.locator('#distChips [data-action="pick-on-map"]').click()
        pg.wait_for_function("document.querySelector('#mapCard.is-full') && !document.querySelector('#pickBanner').hidden", timeout=10000)
        pg.wait_for_function("document.querySelector('.pin, .pin-cluster')", timeout=30000)
        pg.wait_for_timeout(1200)
        shot(pg, 'g6-pick.png')
        box = pg.locator('#ymap').bounding_box()
        pg.mouse.click(box['x'] + box['width'] * 0.5, box['y'] + box['height'] * 0.42)
        pg.wait_for_timeout(1500)
        check(not pg.evaluate("document.querySelector('#mapCard').classList.contains('is-full')"), 'после выбора точки карта свернулась')
        label = pg.inner_text('#distLabel')
        check('от точки на карте' in label, f'подпись фильтра: «{label}»')
        pg.locator('.card').first.click()
        pg.wait_for_timeout(700)
        hrefs = pg.eval_on_selector_all('#sheetDist .route-btn', 'els => els.map(e => e.getAttribute("href"))')
        check(bool(hrefs) and 'rtext=55.' in hrefs[0], 'маршрут строится от выбранной точки')
        shot(pg, 'g7-card-dark.png')
        ctx.close()
        b.close()
finally:
    srv.terminate()

print('ошибки на странице:', errors or 'нет')
print('провалено проверок:', len(fails))
ims = [Image.open(s) for s in shots]
h = 900
ims = [i.resize((int(i.width * h / i.height), h)) for i in ims]
sheet = Image.new('RGB', (sum(i.width for i in ims) + 16 * len(ims), h), (80, 80, 80))
x = 0
for i in ims:
    sheet.paste(i, (x, 0))
    x += i.width + 16
sheet.save(OUT / 'geo-sheet.png')
print('склейка', OUT / 'geo-sheet.png')
sys.exit(1 if fails or errors else 0)
