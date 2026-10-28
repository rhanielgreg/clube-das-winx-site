// Loopback-only, restored real public schema, external network blocked.
// Read-only Admin preview. Synthetic champion testing uses a separate fixture.
import http from 'node:http';
import path from 'node:path';
import {readFile} from 'node:fs/promises';
import {rehearseRecovery,parseRecovery} from './rehearse-recovery.js';
import admin from '../api/admin.js';
import adminRewards from '../lib/admin-rewards.js';
import health from '../api/collection-health.js';
import rewards from '../api/rewards.js';
const source=process.argv[2];
if(!source)throw Error('Provide the protected recovery file path. Never a DSN.');
const backup=parseRecovery(await readFile(source,'utf8'));
const migrations=await Promise.all(['018_private_delivery_and_operations','019_reward_catalog_v2','020_admin_readonly_audit'].map(name=>readFile('migrations/'+name+'.sql','utf8')));
const root=path.resolve('public');
process.env.SUPABASE_URL='https://fixture.invalid';process.env.SUPABASE_PUBLISHABLE_KEY='fixture';process.env.SUPABASE_SERVICE_ROLE_KEY='fixture';process.env.ADMIN_EMAIL='admin@fixture.invalid';delete process.env.COMPETITION_RULES_VERSION;delete process.env.LIFE_CONTRACT_VERSION;
await rehearseRecovery(backup,{migrations,inspect:async db=>{
 const functions=new Set(backup.functions.map(f=>f.signature.replace(/^public\./,'').split('(')[0]));functions.add('get_service_operations_v1');functions.add('get_service_admin_audit_v1');
 globalThis.fetch=async(input,options={})=>{
  const url=new URL(input);if(url.host!=='fixture.invalid')throw Error('EXTERNAL NETWORK DISABLED');
  if(url.pathname==='/auth/v1/user')return Response.json({id:'f0000000-0000-4000-8000-000000000009',email:'admin@fixture.invalid'});
  const name=url.pathname.split('/').at(-1);if(!/^get_(public|service)_/.test(name)||!functions.has(name))throw Error('READ-ONLY RPC ALLOWLIST');
  const args=JSON.parse(options.body||'{}'),placeholders=Object.keys(args).map((k,i)=>k+' => $'+(i+1)).join(',');
  const meta=(await db.query("select proretset from pg_proc where oid=to_regproc($1)",[name])).rows[0];
  const result=await db.query(meta?.proretset?'select * from '+name+'('+placeholders+')':'select '+name+'('+placeholders+') data',Object.values(args));
  return Response.json(meta?.proretset?result.rows:result.rows[0].data);
 };
 const failureRequests=new Map();
 const server=http.createServer(async(req,res)=>{
  const json=(code,data)=>{res.writeHead(code,{'content-type':'application/json; charset=utf-8','cache-control':'no-store'});res.end(JSON.stringify(data));};
  try{
   if(!/^(127\.0\.0\.1|localhost)(:\d+)?$/.test(req.headers.host||''))return json(403,{});
   if(req.method!=='GET')return json(405,{error:'Read-only restored preview.'});
   const url=new URL(req.url,'http://127.0.0.1');
   // Explicit local failure rehearsal only; no external request or production flag.
   const scenario=url.searchParams.get('fixtureSignals');
   if(url.pathname==='/admin')failureRequests.set(url.searchParams.get('signals'),0);
   const repeated=url.pathname==='/api/admin'&&(failureRequests.set(scenario,(failureRequests.get(scenario)||0)+1),failureRequests.get(scenario)>1);
   if(repeated&&scenario==='unavailable')return json(503,{error:'ISOLATED FAILURE REHEARSAL'});
   if(repeated&&scenario==='timeout'){await new Promise(resolve=>setTimeout(resolve,8500));return json(503,{error:'ISOLATED TIMEOUT REHEARSAL'});}
   if(url.pathname==='/api/status'&&scenario==='partial')return json(503,{error:'ISOLATED PARTIAL FAILURE'});
   if(url.pathname==='/__viewport'){
    const width=Number(url.searchParams.get('width'));if(![320,360,390,768,1440,1600].includes(width))return json(400,{});
    const scale=Number(url.searchParams.get('scale')||1);if(![1,1.25,2].includes(scale))return json(400,{});
    res.writeHead(200,{'content-type':'text/html; charset=utf-8','cache-control':'no-store'});
    const view=url.searchParams.get('section');const section=['overview','roulette','catalog','championship','system','audit','memorial'].includes(view)?'#'+view:'';
    return res.end(`<!doctype html><html lang="pt-BR"><meta charset="utf-8"><title>Prévia local · ${width}px · escala/refluxo ${scale}× (não é zoom nativo)</title><style>html,body{margin:0;background:#09070a;width:${width}px;overflow:hidden}iframe{display:block;transform-origin:top left;transform:scale(${scale});width:${width/scale}px;height:${1000/scale}px;border:0}</style><iframe title="Admin em escala/refluxo controlado ${scale}× · cópia restaurada" src="/admin${section}"></iframe>`);
   }
   if(url.pathname==='/api/config')return json(200,{demo:true,demo_data_source:'restored',admin_enabled:false});
   if(url.pathname==='/api/status')return json(200,{checkedAt:null,serverTime:new Date().toISOString(),validUntil:null,online:null});
   const handler=({'/api/admin':admin,'/api/admin-rewards':adminRewards,'/api/rewards':rewards,'/api/collection-health':health})[url.pathname];
   if(handler){let status=200;return await handler({method:'GET',headers:{authorization:'Bearer fixture-only'},query:Object.fromEntries(url.searchParams)},
    {setHeader:(k,v)=>res.setHeader(k,v),status(n){status=n;return this;},json(data){json(status,data);}});}
   if(url.pathname.startsWith('/api/'))return json(404,{});
   const filename=({'/admin':'admin.html','/ranking':'ranking.html','/memorial':'memorial.html'})[url.pathname]||url.pathname.slice(1),file=path.resolve(root,filename);
   if(!file.startsWith(root+path.sep))return json(404,{});
   let bytes=await readFile(file);
   if(filename==='admin.html'&&['unavailable','timeout','partial'].includes(url.searchParams.get('signals'))){
    const scenario=url.searchParams.get('signals');
    // Author the test transport in the local response; production no-referrer stays intact.
    bytes=Buffer.from(bytes.toString().replace('<script src="/auth-return.js">',`<script>const fixtureFetch=window.fetch.bind(window);window.fetch=(input,options)=>{const u=new URL(input,location.href);if(u.origin===location.origin&&u.pathname.startsWith('/api/'))u.searchParams.set('fixtureSignals',${JSON.stringify(scenario)});return fixtureFetch(u,options);};</script><script src="/auth-return.js">`));
   }
   res.writeHead(200,{'content-type':({'.html':'text/html; charset=utf-8','.css':'text/css','.js':'application/javascript','.webp':'image/webp','.svg':'image/svg+xml','.woff2':'font/woff2'})[path.extname(file)]||'application/octet-stream','cache-control':'no-store'});res.end(bytes);
  }catch(error){console.error('Local preview:',error.message);json(500,{error:'Local restored preview unavailable.'});}
 });
 await new Promise(resolve=>server.listen(4179,'127.0.0.1',resolve));
 console.log('Restored read-only Admin: http://127.0.0.1:4179/admin');
 await new Promise(()=>{});
}});
