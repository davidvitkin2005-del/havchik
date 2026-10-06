"""Карта: грузится, рисует метки с логотипами, по нажатию на метку раскрывается карточка,
«Подробнее» открывает шторку, «Развернуть» даёт карту на весь экран."""
import os, subprocess, sys, time
from pathlib import Path
os.environ.setdefault('PLAYWRIGHT_BROWSERS_PATH', '/opt/pw-browsers')
from playwright.sync_api import sync_playwright
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SITE = ROOT.parent if (ROOT.parent / '.git').exists() else ROOT / 'dist'
OUT = Path(sys.argv[1]); OUT.mkdir(parents=True, exist_ok=True)
PORT = 8767
srv = subprocess.Popen([sys.executable, '-m', 'http.server', str(PORT), '--directory', str(SITE)],
                       stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(1)
shots, errs = [], []
try:
    with sync_playwright() as p:
        b = p.chromium.launch()
        ctx = b.new_context(viewport={'width': 390, 'height': 780}, device_scale_factor=2, is_mobile=True, has_touch=True, locale='ru-RU')
        pg = ctx.new_page()
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.goto(f'http://127.0.0.1:{PORT}/index.html', wait_until='networkidle')
        pg.locator('#mapCard').scroll_into_view_if_needed()
        pg.wait_for_function('document.querySelectorAll(".pin, .pin-cluster").length > 0', timeout=30000)
        pg.wait_for_timeout(1500)
        n_pins = pg.locator('.pin').count(); n_cl = pg.locator('.pin-cluster').count()
        print('метки:', n_pins, 'кружков-групп:', n_cl, '| счётчик:', pg.inner_text('#mapCount'))
        card = pg.locator('#mapCard')
        f = OUT / 'map-1.png'; card.screenshot(path=str(f)); shots.append(f)
        # нажимаем на первую видимую метку
        # над метками лежит прозрачный слой событий Яндекса, поэтому жмём в точку, как палец.
        # Если отдельных меток не видно, нажимаем на самую крупную группу: карта приближается
        cr = card.bounding_box()
        def in_frame(sel):
            out = []
            for i in range(pg.locator(sel).count()):
                bx = pg.locator(sel).nth(i).bounding_box()
                if bx and cr['x'] + 10 < bx['x'] + bx['width'] / 2 < cr['x'] + cr['width'] - 60 \
                        and cr['y'] + 60 < bx['y'] + bx['height'] / 2 < cr['y'] + cr['height'] - 40:
                    out.append((i, bx))
            return out
        for _ in range(6):
            if in_frame('.pin'):
                break
            cls = in_frame('.pin-cluster')
            if not cls:
                break
            sizes = [int(pg.locator('.pin-cluster').nth(i).locator('.cl-n').inner_text()) for i, _ in cls]
            i, cb = cls[sizes.index(max(sizes))]
            pg.touchscreen.tap(cb['x'] + cb['width'] / 2, cb['y'] + cb['height'] / 2); pg.wait_for_timeout(1500)
        f2 = OUT / 'map-1b-zoomed.png'; card.screenshot(path=str(f2)); shots.append(f2)
        inside = [bx for _, bx in in_frame('.pin')]
        print('меток в кадре после приближения:', len(inside), '| групп в кадре:', len(in_frame('.pin-cluster')))
        box = inside[0]
        pg.touchscreen.tap(box['x'] + box['width'] / 2, box['y'] + box['height'] / 2); pg.wait_for_timeout(900)
        if not pg.is_visible('#mapPeek'):
            pg.mouse.click(box['x'] + box['width'] / 2, box['y'] + box['height'] / 2); pg.wait_for_timeout(900)
        print('карточка открыта:', pg.is_visible('#mapPeek'), '|', pg.inner_text('#mapPeek .peek-title b'))
        f = OUT / 'map-2-peek.png'; card.screenshot(path=str(f)); shots.append(f)
        # «Подробнее» → шторка
        pg.locator('#mapPeek [data-id]').click(); pg.wait_for_timeout(600)
        print('шторка открыта:', pg.evaluate("document.querySelector('#sheet').classList.contains('is-open')"))
        pg.locator('#sheet [data-action="close"]').first.click(); pg.wait_for_timeout(500)
        # на весь экран
        pg.locator('#mapFullBtn').click(); pg.wait_for_timeout(900)
        print('на весь экран:', pg.evaluate("document.querySelector('#mapCard').classList.contains('is-full')"))
        f = OUT / 'map-3-full.png'; pg.screenshot(path=str(f)); shots.append(f)
        pg.locator('#mapFullBtn').click(); pg.wait_for_timeout(500)
        print('свернули:', not pg.evaluate("document.querySelector('#mapCard').classList.contains('is-full')"))
        # фильтр по кухне меняет метки
        pg.locator('.chip', has_text='Бургеры').first.click(); pg.wait_for_timeout(1200)
        print('после фильтра «Бургеры»:', pg.inner_text('#mapCount'), '| меток:', pg.locator('.pin').count(), 'групп:', pg.locator('.pin-cluster').count())
        b.close()
finally:
    srv.terminate()
print('ошибки:', errs or 'нет')
ims = [Image.open(s) for s in shots]
h = 900
ims = [i.resize((int(i.width * h / i.height), h)) for i in ims]
sheet = Image.new('RGB', (sum(i.width for i in ims) + 20 * len(ims), h), (80, 80, 80)); x = 0
for i in ims:
    sheet.paste(i, (x, 0)); x += i.width + 20
sheet.save(OUT / 'map-sheet.png'); print('склейка', OUT / 'map-sheet.png')
