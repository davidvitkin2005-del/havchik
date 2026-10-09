"""Собирает data/places.json из карточек Яндекс Карт (data/yandex_raw.json)
и ручных описаний (data/curated.json)."""
import json
import re
from pathlib import Path

DATA = Path(__file__).resolve().parent.parent / 'data'

RAW = json.load(open(DATA / 'yandex_raw.json', encoding='utf-8'))
CUR = json.load(open(DATA / 'curated.json', encoding='utf-8'))
PICKS = json.load(open(DATA / 'photo_picks.json', encoding='utf-8'))
TG = json.load(open(DATA / 'telegram.json', encoding='utf-8')) if (DATA / 'telegram.json').exists() else {'posts': {}}

NAMES = {
    'dreamfish': 'Рыба Мечты · Dream Fish',
    'myasoryba': 'Мясо & Рыба',
    'lars': 'Ларс · Lars',
    'bobbyq': 'Бобби-Кю · Bobby Q',
    'lafferia': 'Лаффериа · Lafferia',
    'kiez': 'Киц · Kiez',
    'munch': 'Манч · Munch',
    'shaurmacity': 'Шаурма Сити',
    'beeffish': 'Биф & Фиш',
    'burgeravenue': 'Бургер Авеню',
    'penta': 'Penta',
    'erwin': 'Erwin. Павильон',
}
PHOTO_PREFIX = 'https://avatars.mds.yandex.net/get-altay/'
TIME_RE = re.compile(r'^\d{2}:\d{2}-\d{2}:\d{2}$')


def price_of(features):
    for f in features:
        if f and f.startswith('средний счёт:'):
            v = f.split(':', 1)[1].strip()
            m = re.match(r'^(\d+)–(\d+) ₽$', v)
            if m and m.group(1) == m.group(2):
                v = m.group(1) + ' ₽'
            return 'Средний чек ' + v
    return None


def metro_of(stations):
    """Ближайшая станция и вторая, если до неё не больше 1,2 км.
    Одноимённые станции разных линий склеиваем: одно название, несколько цветов."""
    out = []
    for i, m in enumerate(stations[:3]):
        if i > 0 and (m.get('meters') or 9e9) > 1200:
            continue
        same = next((o for o in out if o['name'] == m['name']), None)
        if same:
            if m['color'] not in same['colors']:
                same['colors'].append(m['color'])
            continue
        if len(out) < 2:
            out.append({'name': m['name'], 'colors': [m['color']], 'distance': m['distance']})
    return out


def photo_key(tpl):
    if tpl.startswith(PHOTO_PREFIX) and tpl.endswith('/%s'):
        return tpl[len(PHOTO_PREFIX):-3]
    return tpl


# Особенности для фильтра: id → как узнать по карточке Яндекса (флаги, «особенности заведения», тип, рубрики)
FEATURE_RULES = {
    'veranda': ('летняя веранда', 'зимняя веранда', 'ресторан с летней верандой'),
    'breakfast': ('завтрак', 'кофейня с завтраками'),
    'lunch': ('бизнес-ланч',),
    'dogs': ('можно с собакой', 'можно с животными', 'разрешено со всеми животными'),
    'halal': ('халяль', 'халяльный ресторан'),
    'music': ('живая музыка', 'ресторан с живой музыкой'),
    'hookah': ('аренда кальяна', 'кальян-бар'),
    'kids': ('детская комната', 'для детей', 'детское меню', 'детская анимация', 'ресторан с детской комнатой', 'семейный ресторан'),
    'view': ('ресторан с панорамным видом', 'местоположение у воды', 'ресторан на воде'),
    'dance': ('танцпол', 'dj', 'диджей', 'танцевальный бар'),
    'sport': ('спортивные трансляции',),
    'laptop': ('можно с ноутбуком',),
}


def feature_words(y):
    words = set()
    for f in y.get('features') or []:
        if not f:
            continue
        for part in re.split(r':\s*|,\s*', f):
            if part:
                words.add(part.strip().lower())
    for c in y.get('categories') or []:
        words.add(c.lower())
    return words


def earliest_open(hours):
    starts = []
    for day in hours:
        if not day:
            continue
        first = day.split(',')[0].split('-')[0]
        h, mnt = map(int, first.split(':'))
        starts.append(h * 60 + mnt)
    return min(starts) if starts else 24 * 60


def features_of(y, cur, hours):
    words = feature_words(y)
    out = [fid for fid, keys in FEATURE_RULES.items() if any(k in words for k in keys)]
    if 'Завтраки' in (cur.get('cuisine') or []) and 'breakfast' not in out:
        out.append('breakfast')
    # «Завтраки» — только если место открывается до 11:00 хотя бы в один день
    if 'breakfast' in out and earliest_open(hours) > 11 * 60:
        out.remove('breakfast')
    if hours and all(d == '00:00-00:00' for d in hours):
        out.append('h24')
    return out


def price_value(features):
    """Средний чек одним числом: середина диапазона; «от N» — чуть выше N; «до N» — ниже N."""
    for f in features:
        if f and f.startswith('средний счёт:'):
            v = f.split(':', 1)[1].replace(' ', '').replace('₽', '')
            m = re.match(r'^(\d+)[–-](\d+)$', v)
            if m:
                return (int(m.group(1)) + int(m.group(2))) / 2
            m = re.match(r'^от(\d+)$', v)
            if m:
                return int(m.group(1)) * 1.25
            m = re.match(r'^до(\d+)$', v)
            if m:
                return int(m.group(1)) * 0.7
    return None


def price_bucket(v):
    if v is None:
        return None
    return 'lo' if v < 1000 else ('mid' if v <= 2500 else 'hi')


def main():
    out = []
    problems = []
    for key, c in CUR.items():
        y = RAW[key]
        if y.get('error') or y.get('status') != 'open':
            problems.append(f'{key}: {y.get("error") or y.get("status")}')
            continue
        h = y['hours']
        if not h or len(h) != 7:
            problems.append(f'{key}: нет часов')
            continue
        # У Яндекса неделя начинается с воскресенья, у нас — с понедельника
        hours = h[1:] + h[:1]
        for day in hours:
            if day is None:
                continue
            for iv in day.split(','):
                if not TIME_RE.match(iv):
                    problems.append(f'{key}: странный интервал {iv}')
        addr = re.sub(r'^Москва,\s*', '', y['address'] or '')
        place = {
            'id': key,
            'name': c.get('name') or NAMES.get(key, y['title']),
            'type': c.get('type'),
            'cuisine': [x for x in c['cuisine'] if x != 'Завтраки'] or c['cuisine'],
            'short': c['short'],
            'description': c['description'],
            'perks': [{'text': t} for t in c['perks'] if not t.startswith('Средний чек')],
            'tags': c.get('tags', []),
            'address': addr,
            'metro': metro_of(y['metro']),
            'hours': hours,
            'price': price_of(y['features']),
            'priceB': price_bucket(price_value(y['features'])),
            'feat': features_of(y, c, hours),
            'rating': y['rating'],
            'ratingCount': y['ratingCount'],
            'photos': [photo_key(y['photos'][i]) for i in PICKS.get(key, range(6)) if i < len(y['photos'])],
            'yandex': f'https://yandex.ru/maps/org/{y["seoname"]}/{y["id"]}/',
            'coords': y['coords'],
            'logo': photo_key(y['logo']) if y.get('logo') else None,
            'phones': y.get('phones') or [],
            'booking': y.get('booking'),
            'site': y.get('site'),
            'reels': c.get('reels', []),
            'post': TG.get('posts', {}).get(key),
        }
        out.append(place)
    json.dump(out, open(DATA / 'places.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print(len(out), 'мест записано')
    for p in problems:
        print('  !', p)


if __name__ == '__main__':
    main()
