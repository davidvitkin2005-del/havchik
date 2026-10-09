"""Печатает готовый к вставке в javascript_tool текст скриптов из source/tools.

python3 -I source/tools/snippet.py ig                         рилсы чата, кроме уже разобранных
python3 -I source/tools/snippet.py comments КОД               комментарии к рилсу
python3 -I source/tools/snippet.py media КОД [КОД ...]       рилсы по ссылкам, присланным боту
python3 -I source/tools/snippet.py ya "ключ=запрос" [...]     поиск на Яндекс Картах
"""
import json
import sys
from pathlib import Path

TOOLS = Path(__file__).resolve().parent
DATA = TOOLS.parent / 'data'


def main():
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    kind = sys.argv[1]
    if kind == 'ig':
        seen = json.loads((DATA / 'seen_reels.json').read_text(encoding='utf-8'))['reels']
        js = (TOOLS / 'ig_thread.js').read_text(encoding='utf-8')
        print(js.replace('__SEEN_CODES__', json.dumps(sorted(seen), ensure_ascii=False)))
    elif kind == 'comments' and len(sys.argv) == 3:
        js = (TOOLS / 'ig_comments.js').read_text(encoding='utf-8')
        print(js.replace('__CODE__', sys.argv[2].replace("'", '')))
    elif kind == 'media' and len(sys.argv) >= 3:
        js = (TOOLS / 'ig_media.js').read_text(encoding='utf-8')
        print(js.replace('__CODES__', json.dumps([c.strip() for c in sys.argv[2:]], ensure_ascii=False)))
    elif kind == 'ya' and len(sys.argv) >= 3:
        queries = []
        for arg in sys.argv[2:]:
            key, _, q = arg.partition('=')
            if not q:
                sys.exit('Запрос должен быть в виде ключ=название и адрес: ' + arg)
            queries.append([key.strip(), q.strip()])
        js = (TOOLS / 'ya_search.js').read_text(encoding='utf-8')
        print(js.replace('__QUERIES__', json.dumps(queries, ensure_ascii=False)))
    else:
        sys.exit(__doc__)


if __name__ == '__main__':
    main()
