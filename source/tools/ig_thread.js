// Запускать через javascript_tool во вкладке https://www.instagram.com/direct/inbox/ (вход в Instagram выполнен).
// Готовый к вставке текст печатает: python3 -I source/tools/snippet.py ig  (подставляет уже разобранные коды).
// Достаёт все сообщения чата «Места Москва» и рисует новые прямо на странице, чтобы прочитать их
// через get_page_text: ответ javascript_tool обрезается примерно на полутора тысячах символов.
// Обёрнуто в функцию, чтобы скрипт можно было запускать повторно в той же вкладке.
await (async () => {
  const SEEN = new Set(__SEEN_CODES__);
  const THREAD = 'Места Москва';
  const H = { headers: { 'X-IG-App-ID': '936619743392459', 'X-Requested-With': 'XMLHttpRequest' }, credentials: 'include' };
  const clean = s => (s || '').replace(/#[^\s#]+/g, '').replace(/\s+/g, ' ').trim();
  const out = [];
  let total = 0;
  try {
    const getJson = async url => {
      const r = await fetch(url, H);
      const txt = await r.text();
      try { return JSON.parse(txt); } catch (e) {
        throw new Error('нет входа в Instagram: Chrome показывает страницу входа. Пользователю нужно войти в Instagram в Chrome');
      }
    };
    const inbox = await getJson('/api/v1/direct_v2/inbox/?persistentBadging=true&folder=&limit=40&thread_message_limit=1');
    const th = ((inbox.inbox && inbox.inbox.threads) || []).find(t => t.thread_title === THREAD);
    if (!th) throw new Error('чат «' + THREAD + '» не найден во входящих: проверь, что вход в Instagram выполнен');
    // Постраничная загрузка у этого чата сбоит (у пачки пересланных рилсов одна метка времени),
    // поэтому берём всё одним большим запросом
    const t = (await getJson('/api/v1/direct_v2/threads/' + th.thread_id + '/?limit=500')).thread;
    window.__hvItems = t.items || [];
    total = window.__hvItems.length;
    for (const it of window.__hvItems) {
      const m = (it.direct_media_share && it.direct_media_share.media) || it.media_share || (it.clip && it.clip.clip) || null;
      let code = m && m.code;
      const xma = (it.xma_media_share || it.xma_clip || it.xma_reel_share || [])[0];
      if (!code && xma && xma.target_url) {
        const mm = /\/(?:reel|reels|p)\/([^/?#]+)/.exec(xma.target_url);
        if (mm) code = mm[1];
      }
      if (!code && it.item_type === 'text') {
        const mm = /instagram\.com\/(?:reel|reels|p)\/([^/?#\s]+)/.exec(it.text || '');
        if (mm) code = mm[1];
      }
      if (code ? SEEN.has(code) : SEEN.has('text:' + it.item_id)) continue;
      if (!code) {
        if (it.item_type === 'text' && clean(it.text)) out.push('TEXT text:' + it.item_id + ' | ' + clean(it.text).slice(0, 600));
        continue;
      }
      const ut = [];
      const tags = u => ((u && u.in) || []).forEach(x => x.user && ut.push(x.user.username));
      if (m) { tags(m.usertags); (m.carousel_media || []).forEach(c => tags(c.usertags)); }
      const L = m && m.location;
      out.push([
        'CODE ' + code + ' | ' + new Date(Number(it.timestamp) / 1000).toISOString().slice(0, 10) + ' | ' +
          (m ? '@' + (m.user && m.user.username) + ' | ' + m.product_type : 'ссылка без данных, открой https://www.instagram.com/p/' + code + '/'),
        '  соавторы: ' + ((m && (m.coauthor_producers || []).map(u => u.username).join(', ')) || '—') +
          '; отметки: ' + ([...new Set(ut)].join(', ') || '—') +
          '; геометка: ' + (L ? [L.name, L.address, L.city].filter(Boolean).join(', ') : '—'),
        '  подпись: ' + (m ? clean(m.caption && m.caption.text).slice(0, 1500) : clean(xma && (xma.title_text || xma.header_title_text)))
      ].join('\n'));
    }
    out.unshift('ВСЕГО В ЧАТЕ ' + total + ', НОВЫХ ' + out.length);
  } catch (e) {
    out.unshift('ОШИБКА: ' + e.message);
  }
  document.body.innerHTML = '<article><pre style="white-space:pre-wrap">' +
    out.join('\n\n').replace(/&/g, '&amp;').replace(/</g, '&lt;') + '</pre></article>';
  return out[0];
})();
