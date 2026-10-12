// Комментарии к рилсу из чата: помогают понять, что за место, если в подписи нет названия
// (авторы часто отвечают на «где это?»). Запускать в любой вкладке instagram.com с выполненным входом.
// Готовый текст: python3 -I source/tools/snippet.py comments КОД
// Обёрнуто в функцию, чтобы скрипт можно было запускать повторно в той же вкладке.
await (async () => {
  const CODE = '__CODE__';
  const H = { headers: { 'X-IG-App-ID': '936619743392459', 'X-Requested-With': 'XMLHttpRequest' }, credentials: 'include' };
  const ABC = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
  const pk = CODE.split('').reduce((n, c) => n * 64n + BigInt(ABC.indexOf(c)), 0n).toString();
  let text;
  try {
    const j = await (await fetch('/api/v1/media/' + pk + '/comments/?can_support_threading=true&permalink_enabled=false', H)).json();
    const line = c => (c.user && c.user.username) + ': ' + (c.text || '').replace(/\s+/g, ' ').slice(0, 200);
    text = (j.comments || []).slice(0, 25).map(c => line(c) + ((c.preview_child_comments || []).length
      ? '\n    ↳ ' + c.preview_child_comments.map(line).join('\n    ↳ ') : '')).join('\n') || 'комментариев нет';
  } catch (e) { text = 'ошибка: нет входа в Instagram или рилс недоступен'; }
  document.body.innerHTML = '<article><pre style="white-space:pre-wrap">' + text.replace(/&/g, '&amp;').replace(/</g, '&lt;') + '</pre></article>';
  return 'готово';
})();
