"""Собирает мини-приложение: index.html + картинки обложки.
В репозитории сайт лежит в корне (его раздаёт GitHub Pages), исходники в source/."""
import json
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / 'src'
DIST = ROOT.parent if (ROOT.parent / '.git').exists() else ROOT / 'dist'

FONTS = ('https://fonts.googleapis.com/css2?family=Golos+Text:wght@400;500;600;700'
         '&family=Unbounded:wght@600;700;800&display=swap')


def read(name):
    return (SRC / name).read_text(encoding='utf-8')


def main():
    DIST.mkdir(exist_ok=True)
    places = json.loads((ROOT / 'data' / 'places.json').read_text(encoding='utf-8'))
    data_js = 'window.__PLACES__=' + json.dumps(places, ensure_ascii=False, separators=(',', ':')).replace('</', '<\\/') + ';'
    html = f"""<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover">
<meta name="color-scheme" content="light dark">
<meta name="theme-color" content="#161618">
<title>Хавчик</title>
<meta name="description" content="{len(places)} мест в Москве, где вкусно поесть: фильтры по кухне и времени, рандомайзер из открытых сейчас.">
<meta property="og:title" content="Хавчик">
<meta property="og:description" content="Куда пойти поесть в Москве прямо сейчас">
<meta property="og:image" content="cover-1080.jpg">
<script src="https://telegram.org/js/telegram-web-app.js"></script>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="preconnect" href="https://avatars.mds.yandex.net">
<link rel="stylesheet" href="{FONTS}">
<style>
{read('app.css')}
</style>
</head>
<body>
{read('body.html')}
<script>{data_js}</script>
<script>
{read('time.js')}
</script>
<script>
{read('app.js')}
</script>
</body>
</html>
"""
    (DIST / 'index.html').write_text(html, encoding='utf-8')
    for f in (ROOT / 'assets').glob('cover-*'):
        shutil.copy(f, DIST / f.name)
    (DIST / '.nojekyll').write_text('', encoding='utf-8')
    print('dist/index.html', len(html.encode('utf-8')) // 1024, 'KB,', len(places), 'мест')


if __name__ == '__main__':
    main()
