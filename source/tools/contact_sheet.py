"""Лист с превью первых 12 фото места с Яндекс Карт, чтобы выбрать порядок фото.

python3 -I source/tools/contact_sheet.py ключ [ключ ...]
Печатает путь к картинке. Открой её через Read и выбери номера: сначала еда и зал,
без меню, QR-кодов, логотипов, листовок и портретов людей. Запиши порядок в data/photo_picks.json.
"""
import io
import json
import sys
import tempfile
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

DATA = Path(__file__).resolve().parent.parent / 'data'


def fetch(url):
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    try:
        return Image.open(io.BytesIO(urllib.request.urlopen(req, timeout=30).read())).convert('RGB')
    except Exception:  # noqa: BLE001
        return None


def main():
    keys = sys.argv[1:]
    if not keys:
        sys.exit(__doc__)
    raw = json.loads((DATA / 'yandex_raw.json').read_text(encoding='utf-8'))
    tw, th, lw = 170, 128, 150
    rows = []
    for k in keys:
        tpls = (raw.get(k) or {}).get('photos') or []
        with ThreadPoolExecutor(8) as ex:
            rows.append((k, list(ex.map(fetch, [t.replace('%s', 'M') for t in tpls[:12]]))))
    cols = max(1, max(len(r[1]) for r in rows))
    sheet = Image.new('RGB', (lw + cols * (tw + 4), len(rows) * (th + 6)), (30, 30, 30))
    dr = ImageDraw.Draw(sheet)
    try:
        font = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 15)
    except OSError:
        font = ImageFont.load_default()
    for r, (k, ims) in enumerate(rows):
        y = r * (th + 6)
        dr.text((6, y + th // 2 - 8), k, fill=(255, 255, 255), font=font)
        for i, im in enumerate(ims):
            x = lw + i * (tw + 4)
            if im:
                im.thumbnail((tw, th))
                sheet.paste(im, (x + (tw - im.width) // 2, y + (th - im.height) // 2))
            dr.text((x + 3, y + 2), str(i), fill=(255, 255, 0), font=font)
    out = Path(tempfile.gettempdir()) / ('photos_' + '_'.join(keys)[:60] + '.jpg')
    sheet.save(out, quality=85)
    print(out)


if __name__ == '__main__':
    main()
