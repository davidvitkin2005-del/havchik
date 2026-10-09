"""Тянет карточки организаций с Яндекс Карт по id и сохраняет компактный JSON.

Использование: python3 -I tools/yafetch.py ids.json out.json [--refresh]
ids.json: {"ключ": [id, seoname], ...}
Уже скачанные карточки пропускаются; --refresh скачивает все заново (фото тоже, их номера
в photo_picks.json могут съехать); --update у уже скачанных обновляет только телефоны, бронь,
сайт, часы, статус и рейтинг, а фото не трогает.
"""
import json
import re
import sys
import time
import urllib.request

UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/126.0 Safari/537.36")
UPDATE_FIELDS = ("phones", "booking", "site", "hours", "hoursText", "status", "rating", "ratingCount")
STATE_RE = re.compile(r'<script type="application/json" class="state-view">(.*?)</script>', re.S)


def get(url):
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept-Language": "ru-RU,ru;q=0.9"})
    with urllib.request.urlopen(req, timeout=30) as r:
        return r.read().decode("utf-8", "replace")


def find_org(st, oid):
    """Ищем объект организации с нужным id в любом месте состояния страницы."""
    seen = set()
    stack = [st]
    while stack:
        o = stack.pop()
        if id(o) in seen:
            continue
        seen.add(id(o))
        if isinstance(o, dict):
            if str(o.get("id")) == str(oid) and "workingTime" in o or (str(o.get("id")) == str(oid) and "title" in o and "address" in o):
                return o
            stack.extend(o.values())
        elif isinstance(o, list):
            stack.extend(o)
    return None


def clean_url(u):
    if not u:
        return None
    base, _, query = u.partition("?")
    keep = [q for q in query.split("&") if q and not q.lower().startswith("utm_")]
    return base + ("?" + "&".join(keep) if keep else "")


def hhmm(t):
    return "%02d:%02d" % (t.get("hours", 0), t.get("minutes", 0))


def compact(o):
    wt = o.get("workingTime")
    days = None
    if isinstance(wt, list) and len(wt) == 7:
        days = [",".join(hhmm(iv["from"]) + "-" + hhmm(iv["to"]) for iv in (d or [])) or None for d in wt]
    photos = o.get("photos") or {}
    feats = []
    for f in o.get("features") or []:
        v = f.get("value")
        if f.get("type") == "bool":
            if v:
                feats.append(f.get("name"))
        elif f.get("type") == "text":
            feats.append("%s: %s" % (f.get("name"), v))
        elif isinstance(v, list):
            feats.append("%s: %s" % (f.get("name"), ", ".join(x.get("name", "") for x in v)))
    rating = o.get("ratingData") or {}
    return {
        "id": str(o.get("id")),
        "seoname": o.get("seoname"),
        "title": o.get("title"),
        "address": o.get("address"),
        "coords": o.get("coordinates"),
        "status": o.get("status"),
        "categories": [c.get("name") for c in o.get("categories") or []],
        "hours": days,
        "hoursText": o.get("workingTimeText"),
        "metro": [{"name": m.get("name"), "color": m.get("color"), "distance": m.get("distance"),
                   "meters": m.get("distanceValue")} for m in (o.get("metro") or [])[:3]],
        "photoCount": photos.get("count"),
        "photos": [p.get("urlTemplate") for p in photos.get("items") or []][:12],
        "rating": round(rating.get("ratingValue"), 1) if rating.get("ratingValue") else None,
        "ratingCount": rating.get("ratingCount"),
        "features": feats,
        "social": [s.get("href") or s.get("url") for s in o.get("socialLinks") or []],
        "links": [b.get("href") or b.get("url") for b in o.get("businessLinks") or []] if isinstance(o.get("businessLinks"), list) else o.get("businessLinks"),
        "chain": (o.get("chain") or {}).get("name"),
        "logo": ((o.get("businessImages") or {}).get("logo") or {}).get("urlTemplate"),
        "phones": [{"n": ph.get("number"), "v": ph.get("value"), "i": ph.get("info")}
                   for ph in (o.get("phones") or []) if isinstance(ph, dict) and ph.get("number")],
        "booking": next((b.get("href") for b in (o.get("businessLinks") or [])
                         if isinstance(b, dict) and b.get("type") == "booking" and b.get("href")), None),
        "site": clean_url((o.get("urls") or [None])[0]),
    }


def main():
    ids = json.load(open(sys.argv[1], encoding="utf-8"))
    out_path = sys.argv[2]
    try:
        out = json.load(open(out_path, encoding="utf-8"))
    except FileNotFoundError:
        out = {}
    for key, (oid, seo) in ids.items():
        update = "--update" in sys.argv and key in out and out[key].get("id") == str(oid) and not out[key].get("error")
        if not update and "--refresh" not in sys.argv and key in out and out[key].get("id") == str(oid) and not out[key].get("error"):
            continue
        url = "https://yandex.ru/maps/org/%s/%s/" % (seo, oid)
        try:
            html = get(url)
            m = STATE_RE.search(html)
            if not m:
                err = "captcha" if "captcha" in html.lower()[:5000] else "no state"
                if update:
                    print("  НЕ ОБНОВИЛОСЬ", key, ":", err, flush=True)
                else:
                    out[key] = {"id": str(oid), "error": err}
            else:
                org = find_org(json.loads(m.group(1)), oid)
                if not org:
                    if not update:
                        out[key] = {"id": str(oid), "error": "org not found"}
                elif update:
                    fresh = compact(org)
                    for fld in UPDATE_FIELDS:
                        if fld in ("hours", "status") and fresh.get(fld) != out[key].get(fld):
                            print("  ИЗМЕНИЛОСЬ", key, fld, ":", out[key].get(fld), "->", fresh.get(fld), flush=True)
                        if fresh.get(fld) is not None or fld in ("booking", "site"):
                            out[key][fld] = fresh.get(fld)
                else:
                    out[key] = compact(org)
        except Exception as e:  # noqa: BLE001
            if update:
                print("  НЕ ОБНОВИЛОСЬ", key, ":", e, flush=True)
            else:
                out[key] = {"id": str(oid), "error": str(e)}
        print(key, "->", (out.get(key) or {}).get("title") or (out.get(key) or {}).get("error"), flush=True)
        json.dump(out, open(out_path, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
        time.sleep(1.5)


if __name__ == "__main__":
    main()
