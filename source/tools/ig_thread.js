// Запускать через javascript_tool во вкладке чата https://www.instagram.com/direct/t/2784776261906807/
// (чат «Места Москва», вход в Instagram выполнен). Готовый текст: python3 -I source/tools/snippet.py ig
// Старый способ через /api/v1/direct_v2/ Instagram отключил (404 с октября 2026), поэтому коды рилсов
// берём из открытого на странице чата: у каждого пересланного рилса в данных React есть shortCode.
// Новые сообщения видны сразу; если нужно глубже, сначала прокрути чат вверх колесом мыши.
// Потом по каждому новому коду берём подпись, соавторов, отметки и геометку через /api/v1/media/{id}/info/.
// Результат рисуется на странице, читать через get_page_text.
await (async () => {
  const SEEN = new Set(__SEEN_CODES__);
  const H = { headers: { 'X-IG-App-ID': '936619743392459', 'X-Requested-With': 'XMLHttpRequest' }, credentials: 'include' };
  const ABC = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
  const idOf = code => code.split('').reduce((n, c) => n * 64n + BigInt(ABC.indexOf(c)), 0n).toString();
  const clean = s => (s || '').replace(/#[^\s#]+/g, '').replace(/\s+/g, ' ').trim();
  const fiberOf = el => { const k = Object.keys(el).find(k => k.startsWith('__reactFiber')); return k && el[k]; };
  const codeOf = btn => {
    let f = fiberOf(btn), i = 0;
    while (f && i < 25) {
      const p = f.memoizedProps;
      if (p && typeof p === 'object') {
        for (const k of Object.keys(p)) {
          const v = p[k];
          if (k === 'shortCode' && typeof v === 'string') return v;
          if (v && typeof v === 'object' && !Array.isArray(v)) {
            if (typeof v.shortCode === 'string') return v.shortCode;
            for (const kk of Object.keys(v)) { const vv = v[kk]; if (vv && typeof vv === 'object' && typeof vv.shortCode === 'string') return vv.shortCode; }
          }
        }
      }
      f = f.return; i++;
    }
    return null;
  };
  const out = [];
  try {
    if (!/\/direct\/t\//.test(location.pathname)) throw new Error('открой чат «Места Москва»: https://www.instagram.com/direct/t/2784776261906807/');
    if (/accounts\/login/.test(location.href) || !document.querySelector('[role="article"]')) throw new Error('нет входа в Instagram или чат ещё не загрузился');
    const codes = [];
    document.querySelectorAll('[role="article"] [role="button"]').forEach(b => { const c = codeOf(b); if (c && !codes.includes(c)) codes.push(c); });
    const fresh = codes.filter(c => !SEEN.has(c));
    for (const code of fresh) {
      try {
        const m = ((await (await fetch('/api/v1/media/' + idOf(code) + '/info/', H)).json()).items || [])[0];
        if (!m) { out.push('CODE ' + code + ' | не найден (удалён или закрытый аккаунт)'); continue; }
        const ut = []; const tags = u => ((u && u.in) || []).forEach(x => x.user && ut.push(x.user.username));
        tags(m.usertags); (m.carousel_media || []).forEach(c => tags(c.usertags));
        const L = m.location;
        const alt = [m.accessibility_caption].concat((m.carousel_media || []).map(c => c.accessibility_caption)).filter(Boolean)
          .map(s => s.replace(/^Photo by .*? text that says /, '')).join(' / ');
        out.push(['CODE ' + code + ' | @' + (m.user && m.user.username) + ' | ' + new Date(m.taken_at * 1000).toISOString().slice(0, 10),
          '  соавторы: ' + ((m.coauthor_producers || []).map(u => u.username).join(', ') || '—') +
            '; отметки: ' + ([...new Set(ut)].join(', ') || '—') +
            '; геометка: ' + (L ? [L.name, L.address, L.city].filter(Boolean).join(', ') : '—'),
          '  подпись: ' + clean(m.caption && m.caption.text).slice(0, 1500),
          alt ? '  текст на картинках: ' + alt.slice(0, 1500) : ''].filter(Boolean).join('\n'));
      } catch (e) { out.push('CODE ' + code + ' | ошибка: ' + e.message); }
      await new Promise(r => setTimeout(r, 700));
    }
    out.unshift('ВИДНО В ЧАТЕ ' + codes.length + ', НОВЫХ ' + fresh.length);
  } catch (e) {
    out.unshift('ОШИБКА: ' + e.message);
  }
  document.body.innerHTML = '<article><pre style="white-space:pre-wrap">' + out.join('\n\n').replace(/&/g, '&amp;').replace(/</g, '&lt;') + '</pre></article>';
  return out[0];
})();
