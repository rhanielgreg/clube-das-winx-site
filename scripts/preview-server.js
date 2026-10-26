import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { demoRanking, demoPlayer, demoStatus } from '../public/demo-data.js';

const root = fileURLToPath(new URL('../public/', import.meta.url));
const types = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.webp': 'image/webp', '.ttf': 'font/ttf', '.svg': 'image/svg+xml' };
const pages = { '/': 'index.html', '/ranking': 'ranking.html', '/jogador': 'jogador.html', '/memorial': 'memorial.html', '/admin': 'admin.html', '/painel': 'admin.html' };
export function createPreviewServer({rankingFactory=demoRanking}={}) {
  let achievementDemo;
  const server = http.createServer(async (req, res) => {
    res.setHeader('cache-control', 'no-store');
    res.setHeader('x-content-type-options', 'nosniff');
    // Uma prévia isolada: sem proxy, credenciais, acesso à rede externa ou escrita.
    res.setHeader('content-security-policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https://avatars.steamstatic.com https://avatars.akamai.steamstatic.com https://avatars.fastly.steamstatic.com https://avatars.cloudflare.steamstatic.com; connect-src 'self'; font-src 'self'; base-uri 'none'; frame-ancestors 'self'");
    const json = (status, body) => { res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' }); res.end(JSON.stringify(body)); };
    if (!['GET', 'HEAD'].includes(req.method)) return json(405, { error: 'Prévia de demonstração: operações de escrita bloqueadas.' });
    if (!/^(localhost|127\.0\.0\.1)(:\d+)?$/.test(req.headers.host || '')) return json(403, { error: 'Acesso permitido apenas pelo endereço local.' });
    try {
      const url = new URL(req.url, 'http://127.0.0.1');
      if (url.pathname === '/preview/mobile') {
        const selected = ['/index.html', '/ranking', '/memorial', '/jogador?id=20000000-0000-4000-8000-000000000001'].includes(url.searchParams.get('page')) ? url.searchParams.get('page') : '/index.html';
        res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
        return res.end(`<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Prévia mobile · 390 px</title><style>body{margin:0;background:#242327;color:#f5e9f0;font:13px Arial}header{padding:18px;text-align:center}a{color:#ffb7d6;margin:10px;display:inline-block}iframe{display:block;width:390px;max-width:100%;height:844px;margin:auto;border:1px solid #765363;border-radius:12px;background:#101113}</style><header>MESMO FRONTEND · VIEWPORT DE 390 PX<br><a href="?page=/index.html">Início</a><a href="?page=/ranking">Ranking</a><a href="?page=/memorial">Memorial</a><a href="?page=/jogador%3Fid%3D20000000-0000-4000-8000-000000000001">Perfil</a><a href="/index.html">Voltar ao desktop</a></header><iframe title="Dashboard em viewport mobile de 390 pixels" src="${selected}"></iframe></html>`);
      }
      if (url.pathname.startsWith('/api/')) {
        if (url.searchParams.get('scenario') === 'offline' && ['/api/ranking', '/api/player'].includes(url.pathname)) return json(503, { error: 'Falha simulada de consulta. Nenhum serviço real foi acessado.' });
        if (url.pathname === '/api/config') return json(200, { demo: true, admin_enabled: false });
        if (url.pathname === '/api/ranking') return json(200, rankingFactory(url.searchParams.get('scenario')));
        if (url.pathname === '/api/player') {
          const player=demoPlayer(url.searchParams.get('id'),url.searchParams.get('scenario'));
          if(player && url.searchParams.get('scenario')==='achievements' && player.profile.profile_id.endsWith('000000000001')) {
            achievementDemo ||= import('./preview-achievements.js').then(module=>module.createAchievementDemo());
            player.achievements=await(await achievementDemo).get();player.achievements_state='ready';player.achievements_engine_demo=true;
          }
          return json(player?200:404,player||{error:'Perfil de demonstração não encontrado.'});
        }
        if (url.pathname === '/api/status') {
          if (url.searchParams.get('format') === 'image') {
            res.writeHead(200, { 'content-type': 'image/svg+xml; charset=utf-8' });
            return res.end('<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="430" viewBox="0 0 1000 430"><rect width="1000" height="430" fill="#17181b"/><rect x="40" y="40" width="5" height="350" fill="#f45ca5"/><g fill="#f4f0ed" font-family="Arial"><text x="80" y="100" font-size="16" fill="#ffb7d6">DEMONSTRAÇÃO LOCAL · NÚMEROS FICTÍCIOS</text><text x="80" y="175" font-size="54" font-weight="bold">CLUBE DAS WINX.</text><text x="80" y="245" font-size="30" fill="#94cbb1">ONLINE · DEMO</text><text x="80" y="310" font-size="25">3 / 32 jogadores fictícios · 24 ms simulados</text><text x="80" y="370" font-size="16" fill="#aaa5aa">Nenhuma conexão com o servidor de produção.</text></g></svg>');
          }
          return json(200, demoStatus(url.searchParams.get('scenario')));
        }
        if (url.pathname === '/api/admin') { const data = rankingFactory(url.searchParams.get('scenario')); return json(200, { ...data, activeSeason: data.seasons[0], admin: { email: 'Demonstração local', hasServiceKey: false } }); }
        if (url.pathname === '/api/connect') { res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); return res.end('<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><link rel="stylesheet" href="/styles.css"><main class="page-main"><p class="eyebrow">DEMONSTRAÇÃO LOCAL</p><h1>Nenhuma conexão real.</h1><p>Os botões de conexão foram preservados. Esta prévia não abre o servidor Zomboid.</p><a class="button button-pink" href="/index.html">Voltar ao dashboard</a></main></html>'); }
        return json(404, { error: 'API indisponível nesta prévia.' });
      }
      const requested = pages[url.pathname] || decodeURIComponent(url.pathname).replace(/^\/+/, '');
      const target = path.resolve(root, requested);
      if (!target.startsWith(root) || requested.split(/[\\/]/).some((part) => part.startsWith('.'))) return json(403, { error: 'Caminho não permitido.' });
      const bytes = await readFile(target);
      res.writeHead(200, { 'content-type': `${types[path.extname(target)] || 'application/octet-stream'}; charset=utf-8` });
      res.end(req.method === 'HEAD' ? undefined : bytes);
    } catch (error) { json(error.code === 'ENOENT' ? 404 : 400, { error: 'Arquivo local não encontrado.' }); }
  });
  server.on('close',()=>{if(achievementDemo)achievementDemo.then(demo=>demo.close()).catch(()=>{});});
  return server;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PREVIEW_PORT || 4173);
  createPreviewServer().listen(port, '127.0.0.1', () => console.log(`Prévia local: http://127.0.0.1:${port}/index.html — somente dados fictícios; escrita bloqueada.`));
}
