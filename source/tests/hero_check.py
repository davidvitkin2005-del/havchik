"""Первый экран на разных размерах: проверяем, что верх фото и лица не срезаны."""
import os, subprocess, sys, time
from pathlib import Path
os.environ.setdefault('PLAYWRIGHT_BROWSERS_PATH', '/opt/pw-browsers')
from playwright.sync_api import sync_playwright
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
OUT = Path(sys.argv[1]); OUT.mkdir(parents=True, exist_ok=True)
PORT = 8766
srv = subprocess.Popen([sys.executable, '-m', 'http.server', str(PORT), '--directory', str(ROOT.parent if (ROOT.parent / '.git').exists() else ROOT / 'dist')],
                       stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(1)
sizes = [(360, 640, 'light'), (390, 780, 'dark'), (430, 880, 'light'), (1280, 800, 'dark')]
shots = []
try:
    with sync_playwright() as p:
        b = p.chromium.launch()
        for w, h, scheme in sizes:
            ctx = b.new_context(viewport={'width': w, 'height': h}, device_scale_factor=1, color_scheme=scheme,
                                is_mobile=w < 700, has_touch=w < 700, locale='ru-RU')
            pg = ctx.new_page()
            errs = []
            pg.on('pageerror', lambda e: errs.append(str(e)))
            pg.goto(f'http://127.0.0.1:{PORT}/index.html', wait_until='networkidle')
            pg.wait_for_timeout(1700)
            geo = pg.evaluate('''() => { const m = document.querySelector('#heroMedia img').getBoundingClientRect();
              const hero = document.querySelector('#hero').getBoundingClientRect();
              const sign = document.querySelector('#spin').getBoundingClientRect();
              return {img: [m.left, m.top, m.width, m.height].map(Math.round), hero: Math.round(hero.height),
                      sign: [Math.round(sign.top), Math.round(sign.bottom)], vw: innerWidth}; }''')
            # видимое окно снимка по ширине в долях: лица ~0.14..0.90 должны попасть внутрь
            l, t, iw, ih = geo['img']
            vis = (max(0, -l) / iw, min(iw, geo['vw'] - l) / iw)
            print(f'{w}x{h}: img top {t}px, visible width {vis[0]:.3f}..{vis[1]:.3f}, img height {ih}, hero {geo["hero"]}, sign {geo["sign"]}, errors {errs}')
            f = OUT / f'hero-{w}x{h}.png'; pg.screenshot(path=str(f)); shots.append(f)
            ctx.close()
        b.close()
finally:
    srv.terminate()
ims = [Image.open(s) for s in shots]
scale = 640 / max(i.height for i in ims)
ims = [i.resize((int(i.width * scale * (0.5 if i.width > 700 else 1)), int(i.height * scale * (0.5 if i.width > 700 else 1)))) for i in ims]
W = sum(i.width for i in ims) + 10 * len(ims); H = max(i.height for i in ims)
sheet = Image.new('RGB', (W, H), (90, 90, 90)); x = 0
for i in ims:
    sheet.paste(i, (x, 0)); x += i.width + 10
sheet.save(OUT / 'hero-sheet.png'); print('sheet', OUT / 'hero-sheet.png')
