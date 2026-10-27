/* Executado antes de assets/SDK: credenciais do retorno ficam só em memória. */
(() => {
  const url = new URL(window.location.href);
  const query = url.searchParams;
  const fragment = new URLSearchParams(url.hash.slice(1));
  const keys = ['access_token', 'refresh_token', 'expires_in', 'expires_at', 'token_type',
    'type', 'code', 'token_hash', 'error', 'error_code', 'error_description',
    'provider_token', 'provider_refresh_token'];
  const hasReturn = keys.some(key => query.has(key) || fragment.has(key));
  if (!hasReturn) return;
  const originalSuffix = url.search + url.hash;
  const value = key => fragment.get(key) ?? query.get(key);
  const ambiguous = keys.some(key => query.getAll(key).length + fragment.getAll(key).length > 1)
    || [value('access_token') || value('refresh_token'), value('code'), value('token_hash')].filter(Boolean).length > 1;
  let callback = {
    kind: ambiguous || value('error') || value('error_code') ? 'error'
      : value('code') ? 'code' : value('token_hash') ? 'otp' : 'tokens',
    type: value('type'), access_token: value('access_token'), refresh_token: value('refresh_token'),
    code: value('code'), token_hash: value('token_hash'),
  };
  for (const key of keys) { query.delete(key); fragment.delete(key); }
  url.search = query.toString();
  url.hash = fragment.toString();
  window.history.replaceState(null, '', url.pathname + url.search + url.hash);
  if (url.pathname === '/' || url.pathname === '/index.html') {
    // Destino fixo, mesma origem; não aceita next/redirect_to fornecido pelo visitante.
    window.location.replace('/admin' + originalSuffix);
    return;
  }
  Object.defineProperty(window, 'takeAdminAuthReturn', { value: () => {
    const result = callback;
    callback = null;
    return result;
  } });
})();
