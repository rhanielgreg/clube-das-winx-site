// Explicit synthetic PostgreSQL/browser fixture. Loopback only; external IO denied.
// Default rejects ALL writes. --official-fixture permits the existing official
// handler against a separate synthetic winner, never a production connection.
import http from 'node:http';
import path from 'node:path';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createMonthlyTestDb} from '../tests/fixtures/monthly-db.js';
import {createRewardWinner} from '../tests/fixtures/reward-winner.js';
import adminRewards from '../lib/admin-rewards.js';
const official=process.argv.includes('--official-fixture');
const reduced=process.argv.includes('--reduced-motion');
// Explicit media-preference emulation for both JS and CSS in this test fixture.
const reducedPreference=reduced?'<style>.roulette-v2 *{animation:none!important;scroll-behavior:auto!important}.roulette-v2 .machine-victory h2{transform:none}</style><script>const nativeMatch=window.matchMedia.bind(window);window.matchMedia=q=>q==="(prefers-reduced-motion: reduce)"?{matches:true,media:q,addEventListener(){},removeEventListener(){}}:nativeMatch(q);</script>':'';
const missingKatana=process.argv.includes('--missing-katana-icon');
const adminLayout=process.argv.includes('--admin-layout');
const port=Number(process.argv.find(a=>a.startsWith('--port='))?.slice(7)||4180);
if(![4180,4181,4182].includes(port))throw Error('Only dedicated loopback fixture ports are permitted.');
const db=await createMonthlyTestDb({rewards:true});
if(official)await createRewardWinner(db);else await db.query('select activate_product14_v2()');
process.env.SUPABASE_URL='https://fixture.invalid';process.env.SUPABASE_PUBLISHABLE_KEY='fixture';process.env.SUPABASE_SERVICE_ROLE_KEY='fixture';process.env.ADMIN_EMAIL='admin@fixture.invalid';delete process.env.COMPETITION_RULES_VERSION;delete process.env.LIFE_CONTRACT_VERSION;
const statistics={postRequests:0,mutationRpcCalls:0,requests:[]};
globalThis.fetch=async(input,options={})=>{
 const url=new URL(input);if(url.host!=='fixture.invalid')throw Error('External IO denied in isolated fixture.');
 if(url.pathname==='/auth/v1/user')return options.headers.Authorization==='Bearer fixture-ui-token'?Response.json({id:'f0000000-0000-4000-8000-000000000009',email:'admin@fixture.invalid'}):Response.json({}, {status:401});
 const name=url.pathname.split('/').at(-1),read=/^get_(public|service)_/.test(name);
 if(!read){statistics.mutationRpcCalls++;if(!official||!['draw_season_reward_v1','record_reward_delivery_v1'].includes(name))throw Error('Write RPC denied.');}
 const args=JSON.parse(options.body||'{}'),parameters=Object.keys(args).map((key,i)=>key+' => $'+(i+1)).join(',');
 try{const result=await db.query('select public.'+name+'('+parameters+') result',Object.values(args));return Response.json(result.rows[0].result);}catch{return Response.json({error:'Isolated PostgreSQL rejected the operation.'},{status:409});}
};
async function dataHash(){
 const value=(await db.query('select get_service_recovery_export_v1() data')).rows[0].data;
 const data=(typeof value==='string'?JSON.parse(value):value).data;
 const canonical=v=>Array.isArray(v)?v.map(canonical).sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b))):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])])):v;
 return createHash('sha256').update(JSON.stringify(canonical(data))).digest('hex');
}
const baseline=await dataHash(),root=path.resolve('public');
// Optional layout uses the actual unchanged Admin shell, with synthetic data and
// no auth/site scripts. This makes viewport measurements comparable to production.
let layoutBody=null;
if(adminLayout){
 const html=await readFile(path.join(root,'admin.html'),'utf8');
 const header=html.match(/<header\b[\s\S]*?<\/header>/)[0].replace('ADMINISTRAÇÃO</span>','TESTE LOCAL · SINTÉTICO</span>').replace('data-admin-session style="display:none;"','data-admin-session').replace('Sessão de administrador',official?'Fixture oficial sintética':'Escritas bloqueadas');
 const sidebar=html.match(/<aside\b[\s\S]*?<\/aside>/)[0];
 const heading=html.slice(html.indexOf('<div class="admin-page-heading">'),html.indexOf('<div class="admin-alert alert-warning"'));
 layoutBody=`${header}<main class="admin-container"><div class="admin-dashboard"><div class="admin-workspace">${sidebar}<div class="admin-content">${heading}<section data-admin-view="overview" hidden><p>Fora da roleta. Fixture sintética; nenhuma alteração no campeonato.</p></section><div data-admin-rewards></div></div></div></div></main>`;
}
const server=http.createServer(async(req,res)=>{
 const json=(status,data)=>{res.writeHead(status,{'content-type':'application/json; charset=utf-8','cache-control':'no-store'});res.end(JSON.stringify(data));};
 try{
  if(!/^(127\.0\.0\.1|localhost)(:\d+)?$/.test(req.headers.host||''))return json(403,{});
  const url=new URL(req.url,'http://127.0.0.1');statistics.requests.push({method:req.method,path:url.pathname});if(statistics.requests.length>500)statistics.requests.shift();
  if(req.method==='POST')statistics.postRequests++;
  if(req.method!=='GET'&&!(official&&req.method==='POST'&&url.pathname==='/api/admin-rewards'))return json(405,{error:'Isolated demonstration server rejects all writes.'});
  if(url.pathname==='/__proof')return json(200,{fixture:true,officialFixture:official,reducedMotionFixture:reduced,missingKatanaIconFixture:missingKatana,adminLayoutFixture:adminLayout,...statistics,baselineDataHash:baseline,currentDataHash:await dataHash(),
   officialDraws:Number((await db.query('select count(*) n from season_reward_draws_v1')).rows[0].n),rewardEvents:Number((await db.query('select count(*) n from reward_events_v1')).rows[0].n)});
  if(url.pathname==='/api/admin-rewards'){
   let body='';for await(const part of req){body+=part;if(body.length>12000)return json(413,{});}let status=200;
   return await adminRewards({method:req.method,headers:req.headers,body:body?JSON.parse(body):undefined,query:{}},{setHeader:(k,v)=>res.setHeader(k,v),status(value){status=value;return this;},json(data){json(status,data);}});
  }
  if(url.pathname==='/'){
   res.writeHead(200,{'content-type':'text/html; charset=utf-8','cache-control':'no-store'});
   if(adminLayout)return res.end(`<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>TESTE ISOLADO · Admin / Roleta</title><link rel="stylesheet" href="/styles.css"><link rel="stylesheet" href="/admin.css"><link rel="stylesheet" href="/rewards.css"><body class="admin-body">${layoutBody}${reducedPreference}<script type="module">import{mountAdminRewards}from'/admin-rewards.js';import{setupAdminShell}from'/admin-shell.js';setupAdminShell();mountAdminRewards({token:()=> 'fixture-ui-token'});</script></body></html>`);
   return res.end(`<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>TESTE ISOLADO · Roleta 2.0</title><link rel="stylesheet" href="/styles.css"><link rel="stylesheet" href="/admin.css"><link rel="stylesheet" href="/rewards.css"><body class="admin-body"><p style="padding:15px;background:#4d102f;color:white;font-size:14px">TESTE LOCAL ISOLADO · DADOS SINTÉTICOS · ${official?'SORTEIO OFICIAL SOMENTE NESTA FIXTURE':'TODAS AS ESCRITAS BLOQUEADAS'} · sem conexão ao servidor real.</p><main class="admin-content" style="max-width:1260px;margin:auto"><nav data-admin-nav><button type="button" class="button button-ghost" data-admin-go="roulette">Roleta dos Campeões</button><button type="button" class="button button-ghost" data-admin-go="overview">Sair da tela (teste)</button></nav><h1 data-admin-heading tabindex="-1">Roleta dos Campeões</h1><section data-admin-view="overview" hidden><p>Fora da roleta. Nenhum dado do campeonato foi alterado.</p></section><div data-admin-rewards></div></main>${reducedPreference}<script type="module">import {mountAdminRewards} from '/admin-rewards.js';import{setupAdminShell}from'/admin-shell.js';setupAdminShell();mountAdminRewards({token:()=> 'fixture-ui-token'});</script></body></html>`);
  }
  if(url.pathname.startsWith('/api/'))return json(404,{});
  if(missingKatana&&url.pathname==='/assets/items-b42/Base.Katana.png')return json(404,{fixture:'Intentionally missing icon to verify the visual fallback.'});
  const file=path.resolve(root,url.pathname.slice(1));if(!file.startsWith(root+path.sep))return json(404,{});
  const bytes=await readFile(file);res.writeHead(200,{'content-type':({'.js':'application/javascript','.css':'text/css','.webp':'image/webp','.svg':'image/svg+xml','.ttf':'font/ttf'})[path.extname(file)]||'application/octet-stream','cache-control':'no-store'});res.end(bytes);
 }catch{json(500,{error:'Isolated fixture unavailable.'});}
});
server.listen(port,'127.0.0.1',()=>console.log(`Isolated roulette: http://127.0.0.1:${port}/#roulette · official fixture: ${official} · reduced motion: ${reduced}`));
