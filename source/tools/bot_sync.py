"""Работа с ботом без сервера: запускается по расписанию в GitHub Actions (и вручную).

1. Пользователи. Забирает у Telegram новые обновления бота (getUpdates) и добавляет в список
   каждого человека, который хоть раз написал боту или нажал «Старт». В репозиторий пишется только
   число и солёные хэши id (по ним нельзя узнать, кто это), чтобы каждый считался один раз.
   Telegram хранит обновления сутки, поэтому запускать нужно чаще раза в сутки.
2. Предложения мест: любое сообщение боту (кроме команд) попадает в data/suggestions.json —
   текст и ссылки, без имени и id отправителя; бот отвечает «Спасибо, проверим».
3. Канал с комментариями. Для каждого места без поста публикует пост с фото в канале из
   data/telegram.json. Комментарии под постом — это комментарии к месту в приложении.

Нужны переменные окружения TG_BOT_TOKEN и HASH_SALT (в GitHub — секреты репозитория).
Без них скрипт ничего не делает и не падает.
"""
import hashlib
import hmac
import html
import json
import os
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timedelta, timezone
from pathlib import Path

DATA = Path(__file__).resolve().parent.parent / 'data'
PHOTO_BASE = 'https://avatars.mds.yandex.net/get-altay/'
USER_KEYS = ('message', 'edited_message', 'callback_query', 'my_chat_member', 'inline_query',
             'chosen_inline_result', 'pre_checkout_query', 'shipping_query', 'chat_join_request', 'poll_answer')


def msk_today():
    return (datetime.now(timezone.utc) + timedelta(hours=3)).strftime('%Y-%m-%d')


def load(name, default):
    p = DATA / name
    return json.loads(p.read_text(encoding='utf-8')) if p.exists() else default


def save(name, obj):
    (DATA / name).write_text(json.dumps(obj, ensure_ascii=False, indent=1) + '\n', encoding='utf-8')


def api(token, method, payload=None, tries=4):
    url = f'https://api.telegram.org/bot{token}/{method}'
    data = json.dumps(payload or {}).encode()
    for _ in range(tries):
        req = urllib.request.Request(url, data=data, headers={'Content-Type': 'application/json'})
        try:
            with urllib.request.urlopen(req, timeout=40) as r:
                return json.loads(r.read())
        except urllib.error.HTTPError as e:
            body = json.loads(e.read() or b'{}')
            wait = (body.get('parameters') or {}).get('retry_after')
            if e.code == 429 and wait:
                time.sleep(int(wait) + 1)
                continue
            return body
        except urllib.error.URLError:
            time.sleep(3)
    return {'ok': False, 'description': 'нет связи с Telegram'}


def sync_users(token, salt):
    st = load('users.json', {'count': 0, 'since': msk_today(), 'offset': 0, 'users': {}})
    res = api(token, 'getUpdates', {'offset': st['offset'] + 1 if st['offset'] else 0, 'timeout': 0, 'limit': 100})
    if not res.get('ok'):
        print('getUpdates:', res.get('description'))
        return False
    changed = False
    sugg = load('suggestions.json', {'items': []})
    known = {it.get('update') for it in sugg['items']}
    sugg_changed = False
    for upd in res['result']:
        st['offset'] = max(st['offset'], upd['update_id'])
        changed = True
        msg = upd.get('message')
        text = msg and (msg.get('text') or msg.get('caption') or '').strip()
        # Предложение места: любое сообщение боту, кроме команд. Кто прислал, не сохраняем.
        if text and not text.startswith('/') and upd['update_id'] not in known:
            urls = re.findall(r'https?://\S+', text)
            sugg['items'].append({'update': upd['update_id'], 'date': msk_today(), 'text': text[:500],
                                  'urls': urls[:5], 'status': 'new'})
            sugg_changed = True
            api(token, 'sendMessage', {'chat_id': msg['chat']['id'],
                                       'text': 'Спасибо! Получили, проверим. Если место подойдёт, оно появится в приложении.',
                                       'reply_to_message_id': msg.get('message_id')})
        for k in USER_KEYS:
            obj = upd.get(k)
            who = obj and (obj.get('from') or obj.get('user'))
            if who and not who.get('is_bot'):
                h = hmac.new(salt.encode(), str(who['id']).encode(), hashlib.sha256).hexdigest()[:20]
                if h not in st['users']:
                    st['users'][h] = msk_today()
    if sugg_changed:
        save('suggestions.json', sugg)
    st['count'] = len(st['users'])
    if changed:
        save('users.json', st)
    print('пользователей:', st['count'], '| новых обновлений:', len(res['result']))
    # Если обновлений ровно лимит, за один запуск забрали не всё: следующий запуск доберёт
    return changed


def caption_of(p, channel_link):
    metro = (p.get('metro') or [{}])[0].get('name')
    lines = [f'<b>{html.escape(p["name"])}</b>']
    sub = ' · '.join(x for x in [', '.join(p.get('cuisine') or []), metro and f'м. {metro}'] if x)
    if sub:
        lines.append(html.escape(sub))
    lines.append('')
    lines.append(html.escape(p.get('description') or p.get('short') or ''))
    lines.append('')
    lines.append(f'📍 {html.escape(p.get("address") or "")}')
    lines.append(f'<a href="{html.escape(p["yandex"])}">Открыть в Яндекс Картах</a>')
    lines.append('')
    lines.append('Делитесь впечатлениями в комментариях 👇')
    text = '\n'.join(lines)
    return text[:1020]


def sync_posts(token):
    tg = load('telegram.json', {'channel': '', 'posts': {}})
    if not tg.get('channel'):
        print('канал не задан, посты пропускаю')
        return False
    places = load('places.json', [])
    chat = '@' + tg['channel'].lstrip('@')
    changed = False
    for p in places:
        if str(p['id']) in tg['posts']:
            continue
        cap = caption_of(p, chat)
        photo = (p.get('photos') or [None])[0]
        res = None
        if photo:
            res = api(token, 'sendPhoto', {'chat_id': chat, 'photo': PHOTO_BASE + photo + '/XXL',
                                           'caption': cap, 'parse_mode': 'HTML'})
        if not res or not res.get('ok'):
            res = api(token, 'sendMessage', {'chat_id': chat, 'text': cap, 'parse_mode': 'HTML',
                                             'link_preview_options': {'is_disabled': True}})
        if not res.get('ok'):
            print('не удалось опубликовать', p['id'], ':', res.get('description'))
            if 'not enough rights' in (res.get('description') or '') or 'chat not found' in (res.get('description') or ''):
                break
            continue
        tg['posts'][str(p['id'])] = res['result']['message_id']
        changed = True
        save('telegram.json', tg)
        print('пост', p['id'], '→', res['result']['message_id'])
        time.sleep(3.2)
    return changed


def main():
    token = os.environ.get('TG_BOT_TOKEN', '').strip()
    salt = os.environ.get('HASH_SALT', '').strip()
    if not token or not salt:
        print('Секреты TG_BOT_TOKEN и HASH_SALT не заданы: пропускаю.')
        return 0
    only = sys.argv[1] if len(sys.argv) > 1 else 'all'
    # Настроено ли в BotFather главное мини-приложение: от этого зависит, куда ведут ссылки «Поделиться»
    me = api(token, 'getMe')
    if me.get('ok'):
        tg = load('telegram.json', {'channel': '', 'posts': {}})
        flag, name = bool(me['result'].get('has_main_web_app')), me['result'].get('username')
        if tg.get('startapp') != flag or tg.get('bot') != name:
            tg['startapp'], tg['bot'] = flag, name
            save('telegram.json', tg)
    if only in ('all', 'users'):
        sync_users(token, salt)
    if only in ('all', 'posts'):
        sync_posts(token)
    return 0


if __name__ == '__main__':
    sys.exit(main())
