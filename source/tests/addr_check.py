"""Свой адрес: поиск станции метро и адреса, расстояния считаются от выбранного.
python3 source/tests/addr_check.py ПАПКА_ДЛЯ_СКРИНШОТОВ"""
import os, subprocess, sys, time
from pathlib import Path
os.environ.setdefault('PLAYWRIGHT_BROWSERS_PATH', '/opt/pw-browsers')
from playwright.sync_api import sync_playwright  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
SITE = ROOT.parent if (ROOT.parent / '.git').exists() else ROOT / 'dist'
OUT = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / 'tests' / 'shots-addr'
OUT.mkdir(parents=True, exist_ok=True)
PORT = 8772
srv = subprocess.Popen([sys.executable, '-m', 'http.server', str(PORT), '--directory', str(SITE)], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(1)
fails, errors = [], []


def check(c, t):
    print(('ок   ' if c else 'FAIL ') + t)
    if not c:
        fails.append(t)


try:
    with sync_playwright() as p:
        b = p.chromium.launch()
        ctx = b.new_context(viewport={'width': 390, 'height': 800}, device_scale_factor=2, is_mobile=True, has_touch=True, locale='ru-RU')
        pg = ctx.new_page()
        pg.on('pageerror', lambda e: errors.append(str(e)))
        pg.goto(f'http://127.0.0.1:{PORT}/index.html')
        pg.wait_for_selector('.card')
        pg.click('#distChips [data-action="addr"]')
        pg.wait_for_selector('#addrQ')
        pg.fill('#addrQ', 'Курская')
        pg.wait_for_selector('.addr-item')
        items = pg.eval_on_selector_all('.addr-item', 'e => e.map(x => x.innerText.replace(/\\s+/g, " "))')
        print('     ', items)
        check(any('м. Курская' in i for i in items), 'находит станцию метро')
        pg.screenshot(path=str(OUT / 'a1-search.png'))
        pg.click('.addr-item >> nth=0')
        pg.wait_for_function("document.querySelector('#distChips [data-dist]')")
        label = pg.inner_text('#distLabel')
        check('Курская' in label, f'подпись: «{label}»')
        check('мин' in pg.locator('.card .dist').first.inner_text(), 'время в пути от выбранного адреса')
        # адрес улицы через геокодер
        pg.click('#distChips [data-action="addr"]')
        pg.fill('#addrQ', 'Тверская улица 7')
        try:
            pg.wait_for_function("[...document.querySelectorAll('.addr-item')].some(x => /Тверская/.test(x.innerText)) || /Ничего/.test(document.querySelector('#addrList').innerText)", timeout=20000)
        except Exception:
            pass
        items = pg.eval_on_selector_all('.addr-item', 'e => e.map(x => x.innerText.replace(/\\s+/g, " "))')
        print('      адрес:', items[:4])
        check(any('Тверская' in i for i in items), 'находит адрес улицы')
        pg.screenshot(path=str(OUT / 'a2-street.png'))
        if items:
            pg.click('.addr-item >> nth=0')
            pg.wait_for_timeout(300)
            print('      подпись:', pg.inner_text('#distLabel'))
        b.close()
finally:
    srv.terminate()
for e in errors:
    print('ОШИБКА СТРАНИЦЫ:', e)
print('Итог:', 'всё в порядке' if not fails and not errors else 'проблем: %d' % (len(fails) + len(errors)))
sys.exit(1 if fails or errors else 0)
