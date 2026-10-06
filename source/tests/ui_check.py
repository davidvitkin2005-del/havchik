"""Прогон интерфейса в headless Chromium: ошибки в консоли, фильтры, рандомайзер, карточка.
Склеивает скриншоты в один файл для просмотра."""
import os
import sys
import subprocess
import time
from pathlib import Path

os.environ.setdefault('PLAYWRIGHT_BROWSERS_PATH', '/opt/pw-browsers')
from playwright.sync_api import sync_playwright  # noqa: E402
from PIL import Image  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
OUT = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / 'tests' / 'shots'
OUT.mkdir(parents=True, exist_ok=True)
PORT = 8765

server = subprocess.Popen([sys.executable, '-m', 'http.server', str(PORT), '--directory', str(ROOT.parent if (ROOT.parent / '.git').exists() else ROOT / 'dist')],
                          stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(1)
errors = []
shots = []
try:
    with sync_playwright() as p:
        browser = p.chromium.launch()
        for scheme in ('light', 'dark'):
            ctx = browser.new_context(viewport={'width': 390, 'height': 780}, device_scale_factor=2,
                                      is_mobile=True, has_touch=True, color_scheme=scheme, locale='ru-RU')
            page = ctx.new_page()
            page.on('console', lambda m: m.type in ('error', 'warning') and errors.append(f'{scheme} {m.type}: {m.text}'))
            page.on('pageerror', lambda e: errors.append(f'{scheme} pageerror: {e}'))
            page.goto(f'http://127.0.0.1:{PORT}/index.html', wait_until='networkidle', timeout=60000)
            page.wait_for_timeout(1600)
            f = OUT / f'{scheme}-1-top.png'; page.screenshot(path=str(f)); shots.append(f)

            if scheme == 'light':
                total = page.locator('.card').count()
                page.mouse.wheel(0, 700); page.wait_for_timeout(600)
                f = OUT / f'{scheme}-2-scrolled.png'; page.screenshot(path=str(f)); shots.append(f)
                page.evaluate('window.scrollTo(0,0)'); page.wait_for_timeout(300)
                # фильтр по кухне
                page.locator('.chip', has_text='Шаурма и кебаб').first.click(); page.wait_for_timeout(300)
                shaurma = page.locator('.card').count()
                page.locator('.chip[data-when="now"]').click(); page.wait_for_timeout(300)
                shaurma_now = page.locator('.card').count()
                page.locator('#reset').click(); page.wait_for_timeout(300)
                # первый час из ленты времени
                first_hour = page.locator('.chip[data-when]:not([data-when="any"]):not([data-when="now"])').first
                hour_label = first_hour.inner_text()
                first_hour.click(); page.wait_for_timeout(300)
                at_hour = page.locator('.card').count()
                page.locator('#reset').click(); page.wait_for_timeout(300)
                page.fill('#q', 'шаурма'); page.wait_for_timeout(300)
                search = page.locator('.card').count()
                page.fill('#q', ''); page.wait_for_timeout(300)
                print(f'карточек всего {total}; шаурма {shaurma}; шаурма открыта сейчас {shaurma_now}; '
                      f'открыто в {hour_label}: {at_hour}; поиск «шаурма»: {search}')

            # рандомайзер
            page.locator('#spin').click()
            page.wait_for_timeout(2600)
            f = OUT / f'{scheme}-3-random.png'; page.screenshot(path=str(f)); shots.append(f)
            picked = page.locator('#sheetTitle').inner_text()
            page.locator('.sheet [data-action="close"]').first.click(); page.wait_for_timeout(500)
            # карточка места
            page.locator('.card').nth(2).click(); page.wait_for_timeout(1500)
            f = OUT / f'{scheme}-4-detail.png'; page.screenshot(path=str(f)); shots.append(f)
            page.locator('.sheet').evaluate('el => el.scrollTo(0, 500)'); page.wait_for_timeout(500)
            f = OUT / f'{scheme}-5-detail-scrolled.png'; page.screenshot(path=str(f)); shots.append(f)
            print(f'{scheme}: рандомайзер выбрал «{picked}»')
            overflow = page.evaluate('document.documentElement.scrollWidth > window.innerWidth')
            print(f'{scheme}: горизонтальный скролл: {overflow}')
            ctx.close()
        browser.close()
finally:
    server.terminate()

# склейка
imgs = [Image.open(s) for s in shots]
w = 390
thumbs = [im.resize((w, int(im.height * w / im.width))) for im in imgs]
cols = 5
rows = (len(thumbs) + cols - 1) // cols
H = max(t.height for t in thumbs)
sheet = Image.new('RGB', (cols * (w + 10), rows * (H + 10)), 'white')
for i, t in enumerate(thumbs):
    sheet.paste(t, ((i % cols) * (w + 10), (i // cols) * (H + 10)))
sheet.save(OUT / 'contact.png')
print('ошибки:', errors if errors else 'нет')
print('склейка:', OUT / 'contact.png')
