"""Схема метро Москвы для расчёта времени в пути: станции, перегоны и пересадки.

Источник станций и координат — открытый API hh.ru (api.hh.ru/metro/1): метро, МЦК, МЦД.
Время на перегоне = расстояние по прямой × 1,05 / эксплуатационная скорость (с учётом стоянок); пересадка = пешком между
станциями (до 750 м) + ожидание поезда. Это оценка, а не расписание.

python3 -I source/tools/make_metro.py   →  source/data/metro.json
"""
import json
import math
import urllib.request
from pathlib import Path

DATA = Path(__file__).resolve().parent.parent / 'data'
URL = 'https://api.hh.ru/metro/1'
SKIP_LINES = {'171'}          # Рублёво-Архангельская: строится, поездов нет
TRANSFER_M = 750               # дальше пересадку не считаем
WALK_KMH = 4.8
WALK_DETOUR = 1.25


def kind_of(line):
    name = line['name']
    if name.startswith('МЦД'):
        return 'mcd'
    if name == 'МЦК':
        return 'mcc'
    return 'metro'


SPEED = {'metro': 41.0, 'mcc': 42.0, 'mcd': 45.0}      # км/ч с учётом стоянок (эксплуатационная скорость)
DWELL = {'metro': 0.0, 'mcc': 0.0, 'mcd': 0.0}         # стоянки уже в скорости
WAIT = {'metro': 1.5, 'mcc': 3.0, 'mcd': 5.0}          # среднее ожидание поезда, мин


def km(a, b):
    la1, lo1, la2, lo2 = map(math.radians, (a[0], a[1], b[0], b[1]))
    h = math.sin((la2 - la1) / 2) ** 2 + math.cos(la1) * math.cos(la2) * math.sin((lo2 - lo1) / 2) ** 2
    return 2 * 6371 * math.asin(min(1, math.sqrt(h)))


def vec(a, b):
    return ((b[0] - a[0]) * 110.57, (b[1] - a[1]) * 111.32 * math.cos(math.radians(a[0])))


def dot(u, v):
    return u[0] * v[0] + u[1] * v[1]


def components(nodes, links):
    adj = {n: set() for n in nodes}
    for a, b in links:
        if a in adj and b in adj:
            adj[a].add(b)
            adj[b].add(a)
    seen, out = set(), []
    for n in nodes:
        if n in seen:
            continue
        stack, part = [n], []
        while stack:
            x = stack.pop()
            if x in seen:
                continue
            seen.add(x)
            part.append(x)
            stack.extend(adj[x] - seen)
        out.append(part)
    return out


def main():
    req = urllib.request.Request(URL, headers={'User-Agent': 'havchik-metro/1.0'})
    src = json.loads(urllib.request.urlopen(req, timeout=30).read().decode('utf-8'))
    lines, stations, edges = [], [], []
    for line in src['lines']:
        if str(line['id']) in SKIP_LINES:
            continue
        li = len(lines)
        k = kind_of(line)
        lines.append({'name': line['name'], 'color': '#' + line['hex_color'].upper(), 'kind': k})
        # Станции с битыми координатами в источнике (бывают у МЦД) пропускаем
        sts = [st for st in line['stations'] if st.get('lat') and st.get('lng') and 55.0 < st['lat'] < 56.6 and 36.4 < st['lng'] < 38.9]
        idx = []
        for st in sts:
            idx.append(len(stations))
            stations.append({'name': st['name'], 'lat': round(st['lat'], 5), 'lon': round(st['lng'], 5), 'line': li})
        pos = [(stations[i]['lat'], stations[i]['lon']) for i in idx]
        # Порядок станций в источнике бывает перепутан, поэтому линию строим по географии:
        # у каждой станции ближайший сосед и ближайший с другой стороны (у конечных его нет).
        # Так получаются и кольца, и ответвления (Киевская — Выставочная).
        linked = set()
        for i in range(len(pos)):
            others = sorted((km(pos[i], pos[j]), j) for j in range(len(pos)) if j != i)
            if not others:
                continue
            d1, j1 = others[0]
            linked.add(tuple(sorted((idx[i], idx[j1]))))
            v1 = vec(pos[i], pos[j1])
            for d, j in others[1:]:
                if d > max(2.5 * d1, 3.5):
                    break
                v = vec(pos[i], pos[j])
                if dot(v1, v) < -0.2 * math.hypot(*v1) * math.hypot(*v):
                    linked.add(tuple(sorted((idx[i], idx[j]))))
                    break
        # Если линия распалась на куски (длинный перегон на окраине), сшиваем куски ближайшей парой станций
        while True:
            parts = components(idx, linked)
            if len(parts) < 2:
                break
            best = min(((km((stations[a]['lat'], stations[a]['lon']), (stations[b]['lat'], stations[b]['lon'])), a, b)
                        for a in parts[0] for p in parts[1:] for b in p))
            linked.add(tuple(sorted((best[1], best[2]))))
        for a, b in linked:
            d = km((stations[a]['lat'], stations[a]['lon']), (stations[b]['lat'], stations[b]['lon']))
            t = d * 1.05 / SPEED[k] * 60 + DWELL[k]
            edges.append([a, b, round(t, 1), 0])
    # Пересадки между линиями: станции ближе 750 м
    for a in range(len(stations)):
        for b in range(a + 1, len(stations)):
            sa, sb = stations[a], stations[b]
            if sa['line'] == sb['line']:
                continue
            d = km((sa['lat'], sa['lon']), (sb['lat'], sb['lon']))
            if d * 1000 <= TRANSFER_M:
                walk = max(1.5, d * WALK_DETOUR / WALK_KMH * 60)
                edges.append([a, b, round(walk, 1), 1])
    # Связность
    adj = {i: set() for i in range(len(stations))}
    for a, b, _, _ in edges:
        adj[a].add(b)
        adj[b].add(a)
    seen, comps = set(), 0
    for s in range(len(stations)):
        if s in seen:
            continue
        comps += 1
        stack = [s]
        while stack:
            x = stack.pop()
            if x in seen:
                continue
            seen.add(x)
            stack.extend(adj[x] - seen)
    longest = sorted((e for e in edges if e[3] == 0), key=lambda e: -e[2])[:5]
    out = {
        'source': URL,
        'note': 'Оценка времени в пути: перегоны по скорости, пересадки пешком до 750 м и ожидание поезда',
        'wait': WAIT,
        'lines': [[l['name'], l['color'], l['kind']] for l in lines],
        'stations': [[s['name'], s['lat'], s['lon'], s['line']] for s in stations],
        'edges': edges,
    }
    (DATA / 'metro.json').write_text(json.dumps(out, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
    print(f'линий {len(lines)}, станций {len(stations)}, перегонов {sum(1 for e in edges if not e[3])}, '
          f'пересадок {sum(1 for e in edges if e[3])}, компонент связности {comps}')
    for a, b, t, _ in longest:
        print(f'  долгий перегон: {stations[a]["name"]} — {stations[b]["name"]} ({lines[stations[a]["line"]]["name"]}) {t} мин')


if __name__ == '__main__':
    main()
