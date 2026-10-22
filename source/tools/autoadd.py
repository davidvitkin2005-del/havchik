"""Автодобавление мест: из рилса Instagram, ссылки на Яндекс Карты или просто названия.

Вызывается из bot_sync.py для каждого сообщения боту (кроме команд и комментариев) и отвечает,
что получилось. Можно запустить и вручную для проверки (ничего не записывает с --dry):
  python3 source/tools/autoadd.py --dry "https://www.instagram.com/reel/КОД/"
  python3 source/tools/autoadd.py --dry "Культ про Донер"

Как работает:
1. Рилс: подпись берём со страницы рилса так, как её видят превью ссылок (og:description).
   Из подписи достаём кандидатов: строки после 📍 и пунктов списка (название + адрес), @аккаунты,
   «названия в кавычках».
2. Каждого кандидата ищем в Яндекс Картах (Москва). Берём только открытые заведения в Москве
   из «едовых» рубрик (рестораны, кафе, бары, кофейни, фастфуд, кальянные и т. п.) и только если
   название из Яндекса действительно есть в подписи или запросе: так бот не добавит случайное место.
3. Карточку качаем как yafetch.py, описание собираем по шаблону из данных Яндекса
   (тип, кухня, метро, рейтинг). В curated.json у таких мест стоит "auto": true — Claude может
   потом переписать описание своими словами.
"""
import html as htmlmod
import json
import re
import sys
import time
import urllib.parse
import urllib.request
from datetime import datetime, timedelta, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import yafetch  # noqa: E402

DATA = Path(__file__).resolve().parent.parent / 'data'
MAX_PLACES_PER_MESSAGE = 15
BBOX = (55.13, 56.03, 36.80, 38.10)          # Москва с ближними районами за МКАД
FOOD = ('ресторан', 'кафе', 'бар', 'быстрое питание', 'кофейня', 'кондитерская', 'пекарня', 'пиццерия',
        'суши', 'кальян', 'паб', 'столовая', 'бистро', 'гриль', 'стейк', 'бургер', 'шаурм', 'чайхана',
        'рюмочная', 'ночной клуб', 'фудкорт', 'фуд-корт', 'гастро', 'винотека', 'чайная', 'блинная',
        'пельменная', 'хинкальная', 'кулинария', 'доставка еды')
NOT_FOOD = ('магазин', 'супермаркет', 'гипермаркет', 'торговый центр', 'бизнес-центр', 'баня', 'сауна',
            'кинотеатр', 'гостиница', 'отель')
ADDR_RE = re.compile(r'(ул\.|улица|пер\.|переулок|просп|проспект|наб\.|набережная|ш\.|шоссе|бул\.|бульвар|'
                     r'пл\.|площадь|проезд|тупик|аллея|МКАД|\bд\.\s*\d|\d+\s*(к|с|стр)\.?\s*\d)', re.I)
GENERIC = {'ресторан', 'кафе', 'бар', 'москва', 'кофейня', 'пиццерия', 'шаурма', 'бистро', 'restaurant', 'cafe',
           'bar', 'moscow', 'coffee', 'кальянная', 'hookah', 'place', 'the', 'and', 'гастробар', 'паб', 'pub'}
UAS = ('facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)',
       'Googlebot/2.1 (+http://www.google.com/bot.html)')

TR = dict(zip('абвгдеёжзийклмнопрстуфхцчшщъыьэюя',
              ['a', 'b', 'v', 'g', 'd', 'e', 'e', 'zh', 'z', 'i', 'i', 'k', 'l', 'm', 'n', 'o', 'p', 'r', 's', 't',
               'u', 'f', 'h', 'ts', 'ch', 'sh', 'sch', '', 'y', '', 'e', 'yu', 'ya']))


def msk_today():
    return (datetime.now(timezone.utc) + timedelta(hours=3)).strftime('%Y-%m-%d')


def norm(s):
    s = (s or '').lower().replace('ё', 'е')
    return re.sub(r'[^0-9a-zа-я]+', ' ', s).strip()


def translit(s):
    return ''.join(TR.get(ch, ch) for ch in norm(s))


def loose(s):
    """Сравнение без учёта алфавита: «Культ» ~ «kult», «Нуур» ~ «noor» не всегда, но часто."""
    t = translit(s)
    t = re.sub(r'(.)\1+', r'\1', t)                      # двойные буквы
    return t.replace('w', 'v').replace('ph', 'f').replace('ks', 'x').replace('ck', 'k').replace('c', 'k')


def title_words(title):
    return [w for w in norm(title).split() if len(w) >= 3 and w not in GENERIC]


STOP = {'как', 'где', 'это', 'для', 'при', 'что', 'кто', 'тут', 'там', 'вот', 'мне', 'вам', 'нам', 'есть', 'был',
        'еще', 'ещё', 'дела', 'привет', 'спасибо', 'пожалуйста', 'добавь', 'добавьте', 'место', 'метро', 'москва',
        'москве', 'улица', 'ресторан', 'кафе', 'бар'}


SMALLTALK = {'привет', 'здравствуйте', 'добрый день', 'добрый вечер', 'hi', 'hello', 'спасибо', 'ок', 'ok', 'да', 'нет',
             'start', 'хай', 'спс', 'круто', 'класс', 'тест'}


def query_covered(query, o):
    """Свободный запрос: большинство слов запроса должно быть в названии или адресе заведения."""
    words = [w for w in norm(query).split() if len(w) >= 3 and w not in STOP]
    if not words:                                   # «Жи есть», «Lea»: короткие названия целиком
        words = [w for w in norm(query).split() if len(w) >= 2]
    if not words or len(norm(query)) < 3:
        return False
    hay = norm((o.get('title') or '') + ' ' + (o.get('address') or '') + ' ' + (o.get('fullAddress') or ''))
    lhay = ' ' + loose(hay) + ' '
    hits = sum(1 for w in words if w in hay or loose(w) in lhay)
    return hits / len(words) >= 0.6


def title_in(title, text):
    """Есть ли главное слово названия из Яндекса в тексте (подписи, запросе)."""
    words = title_words(title)
    if not words:
        return False
    hay = ' ' + loose(text) + ' '
    plain = ' ' + norm(text) + ' '
    hits = sum(1 for w in words if (' ' + w) in plain or (' ' + loose(w)) in hay)
    return hits >= max(1, (len(words) + 1) // 2)


# ---------- Instagram ----------

def ig_codes(text):
    return list(dict.fromkeys(re.findall(r'instagram\.com/(?:[\w.]+/)?(?:reel|reels|p|tv)/([A-Za-z0-9_-]{5,})', text)))


def ig_caption(code):
    """(автор, подпись) рилса без входа в Instagram или None."""
    for path in ('p', 'reel'):
        for ua in UAS:
            req = urllib.request.Request('https://www.instagram.com/%s/%s/' % (path, code),
                                         headers={'User-Agent': ua, 'Accept-Language': 'ru-RU,ru;q=0.9'})
            try:
                with urllib.request.urlopen(req, timeout=25) as r:
                    page = r.read().decode('utf-8', 'replace')
            except Exception:  # noqa: BLE001
                continue
            m = re.search(r'<meta property="og:description" content="([^"]*)"', page)
            if not m:
                continue
            d = htmlmod.unescape(m.group(1))
            mm = re.match(r'.*? - ([\w.]+) on [^:]+: "(.*)"\.?\s*$', d, re.S)
            if mm:
                return mm.group(1), mm.group(2)
            mt = re.search(r'<meta property="og:title" content="([^"]*)"', page)
            return None, htmlmod.unescape(mt.group(1)) if mt else d
    return None


def caption_queries(caption, author):
    """Кандидаты в названия мест из подписи: (запрос, «кусок подписи», который должен совпасть с названием)."""
    out = []
    lines = [ln.strip() for ln in caption.split('\n')]
    marker = re.compile(r'^(?:[•▪▫◾◽\-–—*·]|\d{1,2}[.)]|📍|📌|🔸|🔹|✅|⭐️?|🍽|🍔|🥙|🍕|☕️?)\s*')
    for i, ln in enumerate(lines):
        if not ln:
            continue
        has_mark = bool(marker.match(ln))
        name = marker.sub('', ln).strip(' :—-«»"')
        if not name or len(name) > 60 or re.match(r'(больше|подпис|адрес|часы|время|цена|сохран|ставь|пиши|ссылк)', name, re.I):
            continue
        nxt = lines[i + 1] if i + 1 < len(lines) else ''
        if ADDR_RE.search(name):                       # «📍Новоухтомское ш., 2А» — сам адрес
            if '📍' in ln:
                out.append((name, None))
            continue
        if has_mark and nxt and ADDR_RE.search(nxt) and len(nxt) < 80:
            out.append((name + ' ' + marker.sub('', nxt), name))
        elif has_mark:
            out.append((name, name))
    for q in re.findall(r'📍\s*([^\n📍]{3,80})', caption):
        q = q.strip(' .,')
        out.append((q, None if ADDR_RE.search(q) else q))
    for h in re.findall(r'@([\w.]{3,30})', caption):
        if h.lower() != (author or '').lower():
            out.append((re.sub(r'[._]+', ' ', h), h))
    for q in re.findall(r'[«"]([^«»"\n]{2,40})[»"]', caption):
        out.append((q, q))
    seen, res = set(), []
    for q, need in out:
        k = norm(q)
        if k and k not in seen:
            seen.add(k)
            res.append((q, need))
    return res[:25]


# ---------- Яндекс Карты ----------

def ya_search(q):
    """Поиск заведений. Яндекс иногда понимает запрос как адрес или страну («Азербайджан …» → Баку),
    тогда пробуем ещё раз с рубрикой впереди."""
    for pref in ('', 'ресторан ', 'кафе ', 'бар '):
        items = ya_search_raw(pref + q)
        if items:
            return items
        time.sleep(0.7)
    return []


def ya_search_raw(q):
    url = 'https://yandex.ru/maps/213/moscow/search/' + urllib.parse.quote(q) + '/'
    page = yafetch.get(url)
    m = yafetch.STATE_RE.search(page)
    if not m:
        return []
    st = json.loads(m.group(1))
    items = (((st.get('stack') or [{}])[0].get('results') or {}).get('items')) or []
    return [o for o in items if o.get('id') and o.get('type', 'business') == 'business'][:5]


def is_food(o):
    cats = ' '.join((c.get('name') if isinstance(c, dict) else c) or '' for c in o.get('categories') or []).lower()
    if not cats:
        return False
    first = ((o.get('categories') or [{}])[0])
    first = (first.get('name') if isinstance(first, dict) else first or '').lower()
    if any(w in first for w in NOT_FOOD):
        return False
    return any(w in cats for w in FOOD)


def in_moscow(o):
    c = o.get('coordinates') or o.get('coords')
    return bool(c) and BBOX[0] < c[1] < BBOX[1] and BBOX[2] < c[0] < BBOX[3]


def org_from_link(text):
    m = re.search(r'yandex\.(?:ru|com)/maps/(?:\d+/[\w-]+/)?org/([\w-]+)/(\d+)', text)
    if m:
        return m.group(2), m.group(1)
    m = re.search(r'https?://yandex\.(?:ru|com)/maps/-/[\w-]+', text)
    if m:
        try:
            req = urllib.request.Request(m.group(0), headers={'User-Agent': yafetch.UA})
            with urllib.request.urlopen(req, timeout=25) as r:
                return org_from_link(r.geturl())
        except Exception:  # noqa: BLE001
            return None
    return None


def fetch_card(oid, seo, fallback=None):
    try:
        page = yafetch.get('https://yandex.ru/maps/org/%s/%s/' % (seo, oid))
        m = yafetch.STATE_RE.search(page)
        org = m and yafetch.find_org(json.loads(m.group(1)), oid)
        if org:
            return yafetch.compact(org)
    except Exception:  # noqa: BLE001
        pass
    return yafetch.compact(fallback) if fallback else None


# ---------- Описание по шаблону ----------

CUISINE_MAP = [
    (('грузин', 'кавказ', 'армян', 'азербайдж', 'узбек', 'восточн', 'турец', 'ливан', 'арабск', 'средиземн'), 'Кавказ и Восток'),
    (('японск', 'китайск', 'корейск', 'вьетнам', 'тайск', 'азиатск', 'паназиат', 'суши', 'рамен'), 'Азия'),
    (('итальян', 'европей', 'француз', 'испан', 'авторск'), 'Европейская'),
    (('русск', 'славян', 'советск'), 'Русская кухня'),
    (('мексикан', 'латиноамерикан', 'перуан'), 'Латинская Америка'),
    (('рыбн', 'морск', 'морепродукт'), 'Рыба и морепродукты'),
    (('мясн', 'стейк', 'гриль'), 'Мясо и гриль'),
    (('бургер', 'американ'), 'Бургеры'),
    (('пицц',), 'Пицца'),
    (('шаурм', 'шаверм', 'донер', 'кебаб'), 'Шаурма и кебаб'),
    (('кофе', 'кондитер', 'пекарн', 'десерт'), 'Кофе и десерты'),
    (('бар', 'паб', 'кальян', 'ночной клуб', 'рюмочн'), 'Бары'),
    (('быстрое питание', 'стритфуд', 'фастфуд'), 'Стритфуд'),
]


def cuisine_of(card, hint=''):
    cats = ' '.join(card.get('categories') or []).lower()
    kitchen = ' '.join(f for f in card.get('features') or [] if f and f.startswith('кухня')).lower()
    text = ' '.join([card.get('title') or '', hint]).lower()
    out = []
    for keys, name in CUISINE_MAP:            # сначала по кухне и названию, потом по рубрикам
        if any(k in kitchen or k in text for k in keys) and name not in out:
            out.append(name)
    for keys, name in CUISINE_MAP:
        if any(k in cats for k in keys) and name not in out:
            out.append(name)
    return out[:2] or ['Европейская']


TYPE_MAP = {'быстрое питание': 'Кафе', 'доставка еды и обедов': 'Кафе', 'ночной клуб': 'Бар-клуб'}


def type_of(card):
    c = ((card.get('categories') or ['Кафе'])[0] or 'Кафе').lower()
    t = TYPE_MAP.get(c, c)
    return t[:1].upper() + t[1:]


def street_of(address):
    a = re.sub(r'^Москва,\s*', '', address or '')
    return a


def template(card, source):
    """Тип, короткая строка, описание и фишки по данным Яндекса (без склонения адресов)."""
    t = type_of(card)
    metro = (card.get('metro') or [{}])[0].get('name')
    addr = street_of(card.get('address'))
    short = '%s у метро «%s»' % (t, metro) if metro else '%s, %s' % (t, addr)
    if len(short) > 70:
        short = short[:69] + '…'
    feats = [f.lower() for f in card.get('features') or [] if f and ':' not in f]
    extra = [w for w in ('веранда', 'завтраки', 'бизнес-ланч', 'живая музыка', 'кальян', 'можно с собакой')
             if any(w in f for f in feats)]
    parts = ['%s%s, адрес: %s.' % (t, ' у метро «%s»' % metro if metro else '', addr)]
    if extra:
        parts.append('Есть ' + ', '.join(extra) + '.')
    if card.get('rating'):
        parts.append('Рейтинг на Яндекс Картах — %s.' % str(card['rating']).replace('.', ','))
    parts.append('Место прислали в бот' + (' рилсом @%s' % source if source else '') + '.')
    perks = []
    hours = [d for d in card.get('hours') or [] if d]
    if len(hours) == 7 and all(d in ('00:00-00:00', '00:00-24:00') for d in hours):
        perks.append('Работает круглосуточно')
    return t, short, ' '.join(parts), perks


# ---------- Добавление ----------

def load(name, default):
    p = DATA / name
    return json.loads(p.read_text(encoding='utf-8')) if p.exists() else default


def save(name, obj):
    (DATA / name).write_text(json.dumps(obj, ensure_ascii=False, indent=1) + '\n', encoding='utf-8')


def save_ids(ids):
    (DATA / 'yandex_ids.json').write_text(
        '{\n' + ',\n'.join(' %s: %s' % (json.dumps(k, ensure_ascii=False), json.dumps(v, ensure_ascii=False))
                           for k, v in ids.items()) + '\n}\n', encoding='utf-8')


def new_key(seo, ids):
    base = re.sub(r'[^a-z0-9]', '', (seo or 'place').lower())[:18] or 'place'
    k, i = base, 2
    while k in ids:
        k, i = base + str(i), i + 1
    return k


class Store:
    def __init__(self, dry=False):
        self.dry = dry
        self.ids = load('yandex_ids.json', {})
        self.raw = load('yandex_raw.json', {})
        self.cur = load('curated.json', {})
        self.picks = load('photo_picks.json', {})
        self.seen = load('seen_reels.json', {'reels': {}})
        self.blocked = set(load('blocked.json', {'ids': []}).get('ids', []))
        self.by_id = {str(v[0]): k for k, v in self.ids.items()}
        self.changed = False

    def known(self, oid):
        return self.by_id.get(str(oid))

    def add(self, card, source, reel, hint):
        key = new_key(card.get('seoname'), self.ids)
        t, short, desc, perks = template(card, source)
        self.ids[key] = [card['id'], card.get('seoname') or key]
        self.by_id[str(card['id'])] = key
        self.raw[key] = card
        self.cur[key] = {'cuisine': cuisine_of(card, hint), 'type': t, 'tags': [], 'short': short,
                         'description': desc, 'perks': perks, 'reels': [reel] if reel else [],
                         'auto': True, 'added': msk_today()}
        self.picks[key] = list(range(min(6, len(card.get('photos') or []))))
        self.changed = True
        return key

    def mark_reel(self, code, keys, skip=None):
        if code in self.seen['reels']:
            return
        self.seen['reels'][code] = {'places': keys} if keys else {'skip': skip or 'место не найдено'}
        self.changed = True

    def add_reel_to(self, key, code):
        c = self.cur.get(key)
        if c is not None and code and code not in c.setdefault('reels', []):
            c['reels'].append(code)
            self.changed = True

    def flush(self):
        if self.dry or not self.changed:
            return
        save_ids(self.ids)
        save('yandex_raw.json', self.raw)
        save('curated.json', self.cur)
        save('photo_picks.json', self.picks)
        self.seen['checked_at'] = msk_today()
        save('seen_reels.json', self.seen)


def consider(store, o, need, source, reel, hint, results):
    """Проверяет найденное заведение и добавляет его. Возвращает True, если место подошло."""
    oid = str(o.get('id'))
    title = o.get('title') or ''
    if need is not None and not title_in(title, need) and not title_in(need, title):
        return False
    if oid in store.blocked or not in_moscow(o) or not is_food(o):
        return False
    have = store.known(oid)
    if have:
        store.add_reel_to(have, reel)
        results.append({'status': 'exists', 'key': have, 'name': store.raw.get(have, {}).get('title') or title})
        return True
    if o.get('status') not in (None, 'open'):
        results.append({'status': 'closed', 'name': title})
        return True
    card = fetch_card(oid, o.get('seoname') or 'org', fallback=o)
    if not card or card.get('status') != 'open' or not card.get('hours') or not card.get('coords'):
        results.append({'status': 'closed', 'name': title})
        return True
    key = store.add(card, source, reel, hint)
    results.append({'status': 'added', 'key': key, 'name': card.get('title'), 'address': street_of(card.get('address'))})
    return True


def process(text, store):
    """Разбирает одно сообщение. Возвращает список результатов по найденным местам."""
    results = []
    link = org_from_link(text)
    if link:
        oid, seo = link
        card = fetch_card(oid, seo)
        if card:
            card.setdefault('seoname', seo)
            consider(store, dict(card, coordinates=card.get('coords'),
                                 categories=[{'name': c} for c in card.get('categories') or []]),
                     None, None, None, '', results)
        return results or [{'status': 'notfound', 'reason': 'по ссылке не открылась карточка или это не кафе, ресторан или бар в Москве'}]

    codes = ig_codes(text)
    for code in codes[:3]:
        cap = ig_caption(code)
        if not cap:
            results.append({'status': 'noreel', 'code': code})
            continue
        author, caption = cap
        found = []
        for q, need in caption_queries(caption, author):
            if len([r for r in found if r['status'] in ('added', 'exists')]) >= MAX_PLACES_PER_MESSAGE:
                break
            try:
                cands = ya_search(q)
            except Exception:  # noqa: BLE001
                continue
            for o in cands[:3]:
                if need is None and not any(title_in(o.get('title') or '', x) for x in (caption,)):
                    continue                            # адрес без названия: название должно быть в подписи
                if consider(store, o, need, author, code, caption, found):
                    break
            time.sleep(1.0)
        keys = [r['key'] for r in found if r.get('key')]
        store.mark_reel(code, keys, None if keys else 'бот не нашёл место по подписи')
        results.extend(found or [{'status': 'notfound', 'code': code,
                                  'reason': 'в подписи рилса нет названия места'}])
    if codes:
        return results

    q = re.sub(r'https?://\S+', ' ', text).strip()
    if norm(q) in SMALLTALK:
        return [{'status': 'hello'}]
    if len(q) < 3:
        return [{'status': 'notfound', 'reason': 'слишком короткий запрос'}]
    cands = ya_search(q)
    for o in cands[:3]:
        if query_covered(q, o) and consider(store, o, q, None, None, q, results):
            break
    if not results:
        names = [o.get('title') + (' (' + o.get('address') + ')' if o.get('address') else '') for o in cands[:3] if is_food(o)]
        results.append({'status': 'notfound', 'reason': 'не нашёл такое заведение в Москве',
                        'options': names})
    return results


HELP = ('Пришлите мне место, и я добавлю его в «Хавчик»:\n'
        '• ссылку на рилс или пост в Instagram;\n'
        '• название заведения (можно с улицей или метро);\n'
        '• ссылку на место в Яндекс Картах.\n'
        'Я проверяю сообщения раз в 15–60 минут и отвечу, что получилось.')


def reply_text(results):
    lines = []
    for r in results:
        s = r['status']
        if s == 'added':
            lines.append('✅ Добавил «%s» (%s). Через пару минут место будет в приложении.' % (r['name'], r['address']))
        elif s == 'exists':
            lines.append('👌 «%s» уже есть в приложении.' % r['name'])
        elif s == 'closed':
            lines.append('🚫 «%s» сейчас закрыто по данным Яндекс Карт, не добавляю.' % r['name'])
        elif s == 'hello':
            lines.append(HELP)
        elif s == 'noreel':
            lines.append('😕 Не получилось открыть рилс. Он может быть удалён или из закрытого аккаунта. Пришлите название и адрес места.')
        else:
            t = '🤔 Не нашёл место: %s.' % r.get('reason', 'не получилось')
            if r.get('options'):
                t += ' Может, одно из этих? ' + '; '.join(r['options']) + '. Пришлите точное название или ссылку на Яндекс Карты.'
            else:
                t += ' Пришлите название и адрес или ссылку на место в Яндекс Картах.'
            lines.append(t)
    return '\n'.join(lines[:20]) or 'Не получилось разобрать сообщение. Пришлите рилс, название места или ссылку на Яндекс Карты.'


def main():
    dry = '--dry' in sys.argv
    args = [a for a in sys.argv[1:] if a != '--dry']
    store = Store(dry=dry)
    for text in args:
        res = process(text, store)
        print(json.dumps(res, ensure_ascii=False, indent=1))
        print(reply_text(res))
    store.flush()


if __name__ == '__main__':
    main()
