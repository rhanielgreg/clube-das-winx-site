// Prévia local do frontend atual sobre consultas públicas, exclusivamente GET.
// Não lê .env, não usa service_role e não oferece operações de escrita.
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createPreviewServer } from './preview-server.js';
import { enrichRankingWithAvatars, getSteamAvatar } from '../lib/steam-avatar.js';
import { UUID } from '../public/contracts.js';
import { STATUS_VALIDITY_MS } from '../public/status-view.js';

const origin='https://clubedaswinx-delta.vercel.app';
export function createPublicPreviewServer({fetchImpl=fetch}={}) {
  const files=createPreviewServer();
  return http.createServer(async(req,res)=>{
    const json=(status,data)=>{res.writeHead(status,{'content-type':'application/json; charset=utf-8','cache-control':'no-store'});res.end(JSON.stringify(data));};
    if(!/^(127\.0\.0\.1|localhost)(:\d+)?$/.test(req.headers.host||''))return json(403,{error:'Somente loopback.'});
    if(!['GET','HEAD'].includes(req.method))return json(405,{error:'Prévia somente leitura.'});
    const url=new URL(req.url,'http://127.0.0.1');
    if(url.pathname==='/api/config')return json(200,{preview:true,admin_enabled:false});
    if(url.pathname==='/api/admin')return json(403,{error:'Administração não disponível na prévia.'});
    if(url.pathname==='/api/connect'){res.writeHead(200,{'content-type':'text/html; charset=utf-8'});return res.end('<!doctype html><html lang="pt-BR"><meta charset="utf-8"><title>Prévia somente leitura</title><h1>Conexão preservada.</h1><p>Esta prévia não abre o jogo.</p><a href="/index.html#servidor">Voltar ao servidor</a></html>');}
    if(!url.pathname.startsWith('/api/'))return files.emit('request',req,res);
    if(!['/api/ranking','/api/status','/api/player'].includes(url.pathname))return json(404,{error:'Rota não disponível.'});
    if(url.pathname==='/api/player'&&!UUID.test(url.searchParams.get('id')||''))return json(400,{error:'Perfil inválido.'});
    try {
      const target=origin+url.pathname+(url.pathname==='/api/player'?'?id='+encodeURIComponent(url.searchParams.get('id')):'');
      const response=await fetchImpl(target,{signal:AbortSignal.timeout(15000),redirect:'error'});
      const data=await response.json();
      if(!response.ok)return json(response.status,data);
      if(url.pathname==='/api/ranking')await Promise.all([enrichRankingWithAvatars(data.ranking),enrichRankingWithAvatars(data.graveyard)]);
      if(url.pathname==='/api/player'&&data.profile){data.profile.avatar_url=await getSteamAvatar(data.profile.steam_username,{profileId:data.profile.profile_id,env:{}});data.profile.avatar_source=data.profile.avatar_url?'steam_configured':null;}
      if(url.pathname==='/api/status') {
        const checked=Date.parse(data.checkedAt||'');
        data.serverTime=response.headers.get('date')||new Date().toISOString();
        data.validUntil=Number.isFinite(checked)?new Date(checked+STATUS_VALIDITY_MS).toISOString():null;
      }
      const age=response.headers.get('age');if(age)res.setHeader('age',age);
      return json(200,{...data,preview:true});
    }catch{return json(503,{error:'A consulta pública está indisponível.'});}
  });
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))createPublicPreviewServer().listen(4174,'127.0.0.1',()=>console.log('Prévia local somente leitura, com dados públicos: http://127.0.0.1:4174/'));
