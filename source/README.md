# Хавчик

Мини-приложение Telegram @Havchik_MSK_bot: места Москвы, где поесть, из чата «Места Москва».
Фильтры по кухне и времени работы, рандомайзер из открытых сейчас, карта Яндекса с логотипами мест.

- Сайт — файлы в корне репозитория (`index.html`, обложка), их раздаёт GitHub Pages.
- `source/src` — вёрстка, стили и скрипты приложения; `source/src/time.js` — расписание по московскому времени.
- `source/data` — карточки Яндекс Карт (`yandex_raw.json`), описания (`curated.json`), порядок фото,
  разобранные рилсы (`seen_reels.json`); `places.json` собирается из них.
- `source/tools` — сборка (`make_places.py`, `build.py`), загрузка карточек Яндекса, скрипты для чата и поиска.
- `source/UPDATE.md` — как добавлять новые места из чата.

Пересобрать сайт: `python3 -I source/tools/make_places.py && python3 -I source/tools/build.py`.
