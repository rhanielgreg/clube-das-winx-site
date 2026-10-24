import { getConfig } from '../lib/config.js';

const escapeHtml = (value) => String(value)
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;');

export default {
  fetch(request) {
    if (request.method !== 'GET') return new Response('Método não permitido.', { status: 405 });
    const config = getConfig();
    const html = `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="theme-color" content="#ed2d91">
  <title>Conectar — Clube das Winx</title>
  <style>
    *{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;background:#08060a url('/assets/winx-zomboid-banner.webp') center/cover fixed;color:#fff;font-family:Inter,Arial,sans-serif}body:before{content:'';position:fixed;inset:0;background:rgba(4,2,6,.74);backdrop-filter:blur(4px)}main{position:relative;width:min(92vw,620px);padding:38px;border:1px solid rgba(255,73,166,.62);border-radius:24px;background:rgba(10,7,12,.9);box-shadow:0 0 55px rgba(237,45,145,.2);text-align:center}img{width:96px;height:96px;border-radius:22px;object-fit:cover;border:2px solid #ff4ca6}h1{margin:18px 0 8px;font-size:27px}p{color:#cdbbc5;line-height:1.6}.data{margin:24px 0;padding:17px;border-radius:14px;background:#130d13;text-align:left}.data strong{color:#ff83bd}.button{display:inline-block;margin-top:8px;padding:15px 24px;border-radius:999px;background:#ed2d91;color:#fff;text-decoration:none;font-weight:800;box-shadow:0 0 22px rgba(237,45,145,.35)}small{display:block;margin-top:18px;color:#8e7e87}
  </style>
</head>
<body>
  <main>
    <img src="/assets/winx-zomboid-profile.webp" alt="Clube das Winx">
    <h1>Clube das Winx</h1>
    <p>Abra o Project Zomboid pela Steam e conecte diretamente ao servidor.</p>
    <div class="data"><strong>IP</strong><br>${escapeHtml(`${config.host}:${config.port}`)}<br><br><strong>DDNS</strong><br>${escapeHtml(config.ddns)}</div>
    <a class="button" href="${escapeHtml(config.steamUrl)}">🎮 Abrir na Steam</a>
    <small>Se nada acontecer, confirme que a Steam está instalada e permita a abertura do aplicativo.</small>
  </main>
</body>
</html>`;
    return new Response(html, {
      headers: {
        'content-type': 'text/html; charset=utf-8',
        'cache-control': 'public, max-age=3600',
        'content-security-policy': "default-src 'self'; style-src 'unsafe-inline'; img-src 'self'; base-uri 'none'; frame-ancestors 'none'",
      },
    });
  },
};
