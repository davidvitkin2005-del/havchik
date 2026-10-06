// Поиск мест на Яндекс Картах. Запускать через javascript_tool во вкладке https://yandex.ru/maps/213/moscow/
// Готовый текст: python3 -I source/tools/snippet.py ya "ключ=название и адрес" ["ключ2=..."]
// Для каждого запроса рисует на странице до 5 кандидатов: id | seoname | название | адрес | статус | рубрики.
// Читать результат через get_page_text. Нужен статус open; permanent-closed и temporary-closed не берём.
// Обёрнуто в функцию, чтобы скрипт можно было запускать повторно в той же вкладке.
await (async () => {
  const QUERIES = __QUERIES__;
  async function ysearch(q) {
    const html = await (await fetch('/maps/213/moscow/search/' + encodeURIComponent(q) + '/', { credentials: 'include' })).text();
    const m = html.match(/<script type="application\/json" class="state-view">([\s\S]*?)<\/script>/);
    if (!m) return [/captcha/i.test(html) ? 'КАПЧА: открой вкладку и попроси пользователя пройти проверку' : 'нет данных'];
    const st = JSON.parse(m[1]);
    const items = ((st.stack || [])[0] && ((st.stack[0].results || st.stack[0].response || {}).items)) || [];
    return items.filter(o => o.id).slice(0, 5).map(o =>
      [o.id, o.seoname, o.title, o.address, o.status, (o.categories || []).map(c => c.name).join('/'),
       (o.socialLinks || []).map(s => s.href || s.url).filter(Boolean).slice(0, 2).join(' ')].join(' | '));
  }
  const lines = [];
  for (const [key, q] of QUERIES) {
    try {
      const res = await ysearch(q);
      lines.push(key + ' («' + q + '»):\n  ' + (res.length ? res.join('\n  ') : 'ничего не найдено'));
    } catch (e) {
      lines.push(key + ': ОШИБКА ' + e);
    }
    await new Promise(r => setTimeout(r, 1200));
  }
  document.body.innerHTML = '<article><pre style="white-space:pre-wrap">' + lines.join('\n\n').replace(/&/g, '&amp;').replace(/</g, '&lt;') + '</pre></article>';
  return 'готово: ' + lines.length;
})();
