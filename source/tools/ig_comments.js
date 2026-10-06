// Комментарии к рилсу из чата: помогают понять, что за место, если в подписи нет названия
// (авторы часто отвечают на «где это?»). Запускать в той же вкладке Instagram после ig_thread.js.
// Готовый текст: python3 -I source/tools/snippet.py comments КОД
// Обёрнуто в функцию, чтобы скрипт можно было запускать повторно в той же вкладке.
await (async () => {
  const CODE = '__CODE__';
  const H = { headers: { 'X-IG-App-ID': '936619743392459', 'X-Requested-With': 'XMLHttpRequest' }, credentials: 'include' };
  const it = (window.__hvItems || []).find(i => {
    const m = (i.direct_media_share && i.direct_media_share.media) || i.media_share || (i.clip && i.clip.clip);
    return m && m.code === CODE;
  });
  const m = it && ((it.direct_media_share && it.direct_media_share.media) || it.media_share || (it.clip && it.clip.clip));
  let text;
  if (!m) {
    text = 'Рилса ' + CODE + ' нет среди загруженных: сначала запусти ig_thread.js в этой вкладке';
  } else {
    const j = await (await fetch('/api/v1/media/' + m.pk + '/comments/?can_support_threading=true&permalink_enabled=false', H)).json();
    text = (j.comments || []).slice(0, 20)
      .map(c => (c.user && c.user.username) + ': ' + (c.text || '').replace(/\s+/g, ' ').slice(0, 160)).join('\n') || 'комментариев нет';
  }
  document.body.innerHTML = '<article><pre style="white-space:pre-wrap">' + text.replace(/&/g, '&amp;').replace(/</g, '&lt;') + '</pre></article>';
  return 'готово';
})();
