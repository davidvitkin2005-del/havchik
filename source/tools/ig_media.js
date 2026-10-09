// Подписи и данные рилсов по их кодам (для мест, которые прислали боту). Запускать через javascript_tool
// во вкладке https://www.instagram.com/ с выполненным входом. Готовый текст: python3 -I source/tools/snippet.py media КОД [КОД ...]
// Вывод в том же виде, что у ig_thread.js; читать через get_page_text.
await (async () => {
  const CODES = __CODES__;
  const H = { headers: { 'X-IG-App-ID': '936619743392459', 'X-Requested-With': 'XMLHttpRequest' }, credentials: 'include' };
  const ABC = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
  const idOf = code => code.split('').reduce((n, c) => n * 64n + BigInt(ABC.indexOf(c)), 0n).toString();
  const clean = s => (s || '').replace(/#[^\s#]+/g, '').replace(/\s+/g, ' ').trim();
  const out = [];
  for (const code of CODES) {
    try {
      const r = await fetch('/api/v1/media/' + idOf(code) + '/info/', H);
      const j = JSON.parse(await r.text());
      const m = (j.items || [])[0];
      if (!m) { out.push('CODE ' + code + ' | не найден (удалён или закрытый аккаунт)'); continue; }
      const ut = [];
      const tags = u => ((u && u.in) || []).forEach(x => x.user && ut.push(x.user.username));
      tags(m.usertags); (m.carousel_media || []).forEach(c => tags(c.usertags));
      const L = m.location;
      out.push(['CODE ' + code + ' | @' + (m.user && m.user.username) + ' | ' + m.product_type,
        '  соавторы: ' + ((m.coauthor_producers || []).map(u => u.username).join(', ') || '—') +
          '; отметки: ' + ([...new Set(ut)].join(', ') || '—') +
          '; геометка: ' + (L ? [L.name, L.address, L.city].filter(Boolean).join(', ') : '—'),
        '  подпись: ' + clean(m.caption && m.caption.text).slice(0, 1500)].join('\n'));
    } catch (e) {
      out.push('CODE ' + code + ' | ошибка: нет входа в Instagram или рилс недоступен');
    }
    await new Promise(r => setTimeout(r, 700));
  }
  document.body.innerHTML = '<article><pre style="white-space:pre-wrap">' + out.join('\n\n').replace(/&/g, '&amp;').replace(/</g, '&lt;') + '</pre></article>';
  return 'готово: ' + out.length;
})();
