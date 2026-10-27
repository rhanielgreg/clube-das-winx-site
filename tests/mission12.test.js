import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { killBreakdown,killBreakdownText } from '../public/kill-breakdown.js';
import achievements from '../api/achievements.js';
import admin from '../api/admin.js';
import { achievementCatalog } from '../public/achievements-catalog.js';
import { parseRecovery,rehearseRecovery } from '../scripts/rehearse-recovery.js';
const world='f0000000-0000-4000-8000-000000000001',account='a'.repeat(64),life='b'.repeat(64);
const metric=(value)=>({value,unit:'count',scope:'life',validated:true,coverage:'observed_lower_bound'});
const input=(total=100)=>({kills_total:metric(total),kills_firearm:metric(10),kills_melee:metric(total-30),kills_vehicle:metric(15),kills_other:metric(5)});
const response=()=>({headers:{},setHeader(k,v){this.headers[k]=v;},status(c){this.code=c;return this;},json(b){this.body=b;return this;}});
async function database() {
 const db=new PGlite();
 await db.exec(await readFile(new URL('./fixtures/schema-before.sql',import.meta.url),'utf8'));
 await db.exec(await readFile(new URL('./fixtures/ingest-production-20261025.sql',import.meta.url),'utf8'));
 for(const name of ['001_restrict_ingestion','002_public_read_contracts','003_official_championship','004_life_achievements','006_dashboard_release','005_life_read_contracts','007_controlled_life_activation'])
  await db.exec(await readFile(new URL('../migrations/'+name+'.sql',import.meta.url),'utf8'));
 await db.exec("insert into ranking_seasons(id,name,slug,started_at) values('4ec32a87-fb16-4838-af57-f4cf85425a60','Temporada 1','temporada-1','2026-10-20T01:05:18.930285Z')");
 for(const name of ['008_season_schedule','009_correct_season1_deadline'])await db.exec(await readFile(new URL('../migrations/'+name+'.sql',import.meta.url),'utf8'));
 const before=(await db.query('select get_public_dashboard_release_v1() data')).rows[0].data;
 const migration=await readFile(new URL('../migrations/010_life_integrity_guards.sql',import.meta.url),'utf8');
 await db.exec(migration);await db.exec(migration);
 assert.equal((await db.query('select get_public_dashboard_release_v1() data')).rows[0].data.life_contract_version,before.life_contract_version);
 return db;
}
async function ingest(db,metrics=input(),options={}) {
 return (await db.query('select ingest_life_observation_v1($1,$2,$3,$4,$5,$6,$7,$8,$9) id',[
  world,options.account||account,options.life||life,options.name||'Mesmo nome','Conta de teste',options.alive??true,
  new Date(Date.now()-10000+(options.step||0)*1000).toISOString(),(options.hash||'c').repeat(64),metrics])).rows[0].id;
}
test('reconciliação: residual não é Vehicle, Melee não é duplicado e ausência não vira zero',()=>{
 const original={kills_total:342,kills_firearm:39,kills_melee:183,kills_vehicle:120};
 const row=killBreakdown(original);assert.equal(row.state,'partial');assert.equal(row.undiscriminated,120);
 assert.equal(row.categories.vehicle,null);assert.match(killBreakdownText(row),/120 sem categoria discriminada/);
 const verified=killBreakdown({...original,life_identity_verified:true,kills_other:0});
 assert.equal(verified.state,'reconciled');assert.equal(verified.categories.vehicle,120);
 assert.equal(killBreakdown({...original,kills_melee:500}).state,'inconsistent');
 assert.equal(killBreakdown({...original,kills_total:null}).total,null);
 assert.equal(killBreakdown({...original,kills_firearm:null}).categories.firearm,null);
 assert.equal(killBreakdown({...original,kills_total:'342'}).state,'unavailable');
 assert.equal(killBreakdown({...original,life_identity_verified:true,kills_other:1}).state,'inconsistent');
});
test('010: morte congela métricas e identidade; replay e renomeação não transferem medalhas',async()=>{
 const db=await database();try {
  const profile=await ingest(db,input(),{step:0});
  await ingest(db,input(110),{step:1,name:'Renomeado'});
  assert.equal((await db.query('select count(*) n from life_identities')).rows[0].n,1);
  await ingest(db,input(120),{step:2,alive:false});
  const saved=(await db.query('select * from life_achievements order by achievement_id')).rows;
  await ingest(db,input(120),{step:3,alive:false});
  await assert.rejects(ingest(db,input(1000),{step:4,alive:false}),/frozen/);
  await assert.rejects(ingest(db,input(120),{step:4,alive:true}),/new source life token|frozen/);
  const li=(await db.query('select * from life_identities')).rows[0];
  await assert.rejects(db.query("update life_identities set account_token=$1 where id=$2",['d'.repeat(64),li.id]),/immutable/);
  assert.deepEqual((await db.query('select * from life_achievements order by achievement_id')).rows,saved);
  const fresh=await ingest(db,{kills_total:metric(0)},{step:4,life:'e'.repeat(64)});
  assert.notEqual(fresh,profile);
  assert.equal((await db.query('select get_public_life_achievements_v1($1) data',[fresh])).rows[0].data.total_unlocked,0);
 }finally{await db.close();}
});
test('010: categorias inconsistentes e colisão de ID entre contas revertem inclusive ingestão legada',async()=>{
 const db=await database();try {
  await assert.rejects(ingest(db,{...input(),kills_other:metric(300)}),/partition inconsistent/);
  assert.equal((await db.query('select count(*) n from game_characters')).rows[0].n,0);
  await ingest(db);
  await assert.rejects(ingest(db,input(),{account:'d'.repeat(64),step:1}),/unique/);
  assert.equal((await db.query('select count(*) n from game_characters')).rows[0].n,1);
  await assert.rejects(ingest(db,{...input(),kills_axe:metric(100),kills_blunt:metric(0),kills_small_blunt:metric(0),kills_long_blade:metric(0),kills_small_blade:metric(0),kills_spear:metric(0),kills_unarmed:metric(0)},{step:1}),/melee category partition/);
  assert.equal((await db.query('select get_service_pipeline_readiness_v1() data')).rows[0].data.contract_ready,true);
  for(const role of ['anon','authenticated']) {
   await db.exec('set role '+role);
   await assert.rejects(ingest(db),e=>e.code==='42501');
   await assert.rejects(db.query('select * from life_identities'),e=>e.code==='42501');
   await db.exec('reset role');
  }
 }finally{await db.close();}
});
test('API contextual mantém desconhecido sem life-v1; métodos e IDs inválidos não escrevem',async t=>{
 const before=process.env.COMPETITION_RULES_VERSION,oldLife=process.env.LIFE_CONTRACT_VERSION;
 process.env.COMPETITION_RULES_VERSION='winx-v1';delete process.env.LIFE_CONTRACT_VERSION;
 t.mock.method(globalThis,'fetch',()=>{throw new Error('No calls before activation');});
 try {
  const res=response();await achievements({method:'GET',query:{id:world}},res);
  assert.equal(res.code,200);assert.equal(res.body.state,'awaiting_verified_life');assert.equal(res.body.total_unlocked,null);
  for(const req of [{method:'POST'},{method:'GET',query:{id:'invalid'}},{method:'GET',query:{id:[world]}}]){
   const denied=response();await achievements(req,denied);assert.ok([400,405].includes(denied.code));
  }
 }finally{before===undefined?delete process.env.COMPETITION_RULES_VERSION:process.env.COMPETITION_RULES_VERSION=before;oldLife===undefined?delete process.env.LIFE_CONTRACT_VERSION:process.env.LIFE_CONTRACT_VERSION=oldLife;}
});
test('sessão Supabase comum não autoriza administração nem inicia RPC de escrita',async t=>{
 const keys=['SUPABASE_URL','SUPABASE_PUBLISHABLE_KEY','ADMIN_EMAIL','SUPABASE_SERVICE_ROLE_KEY'];
 const old=Object.fromEntries(keys.map(k=>[k,process.env[k]]));
 Object.assign(process.env,{SUPABASE_URL:'https://test.invalid',SUPABASE_PUBLISHABLE_KEY:'sb_publishable_fixture',ADMIN_EMAIL:'chosen@example.invalid',SUPABASE_SERVICE_ROLE_KEY:'sb_secret_fixture'});
 const calls=[];t.mock.method(globalThis,'fetch',async(url,options)=>{calls.push({url,options});return Response.json({id:world,email:'ordinary@example.invalid',role:'authenticated'});});
 try{for(const method of ['GET','POST']){const res=response();await admin({method,headers:{authorization:'Bearer fixture-only'},body:{action:'start_season',payload:{name:'Forbidden',slug:'forbidden'}}},res);assert.equal(res.code,403);}
 assert.equal(calls.length,2);assert.ok(calls.every(c=>c.url.endsWith('/auth/v1/user')&&c.options.method==='GET'));}
 finally{for(const k of keys)old[k]===undefined?delete process.env[k]:process.env[k]=old[k];}
});
test('API contextual usa catálogo real, conta níveis e apresenta só o maior; falha de contrato fica indisponível',async t=>{
 const keys=['COMPETITION_RULES_VERSION','LIFE_CONTRACT_VERSION','SUPABASE_URL','SUPABASE_PUBLISHABLE_KEY'];
 const old=Object.fromEntries(keys.map(k=>[k,process.env[k]]));
 Object.assign(process.env,{COMPETITION_RULES_VERSION:'winx-v1',LIFE_CONTRACT_VERSION:'life-v1',SUPABASE_URL:'https://fixture.invalid',SUPABASE_PUBLISHABLE_KEY:'sb_publishable_fixture'});
 const evidence={catalog_count:100,identity_verified:true,catalog:achievementCatalog,total_unlocked:3,
  unlocks:['exterminador.bronze','exterminador.silver','exterminador.gold'].map(achievement_id=>({achievement_id,observed_at:'2026-10-26T20:00:00Z',recognized_at:'2026-10-26T20:00:01Z',occurred_at:null,recognition_kind:'observed_counter'}))};
 let corrupt=false;
 t.mock.method(globalThis,'fetch',async(url,options)=>{
  assert.ok(url.endsWith('get_public_life_achievements_v1'));assert.deepEqual(JSON.parse(options.body),{p_profile_id:world});
  return Response.json(corrupt?{...evidence,catalog_count:99}:evidence);
 });
 try {
  const ready=response();await achievements({method:'GET',query:{id:world}},ready);
  assert.equal(ready.code,200);assert.equal(ready.body.total_unlocked,3);
  assert.deepEqual(ready.body.visible.map(a=>a.id),['exterminador.gold']);
  assert.ok(ready.body.unlocks.every(a=>a.occurred_at===null));
  corrupt=true;const denied=response();await achievements({method:'GET',query:{id:world}},denied);
  assert.equal(denied.code,503);assert.equal(denied.body.state,'unavailable');
 }finally{for(const k of keys)old[k]===undefined?delete process.env[k]:process.env[k]=old[k];}
});
test('recuperação recusa escopo estranho; bigint e 100 critérios aprovados preservados',async()=>{
 assert.equal(parseRecovery('{"max":9223372036854775807}').max,'9223372036854775807');
 await assert.rejects(rehearseRecovery({schema:'auth'}),/Unsupported/);
 assert.equal(achievementCatalog.length,100);
 assert.deepEqual(achievementCatalog.find(a=>a.id==='mes-sem-tiros').criteria,[{metric:'survival_world_days',op:'gte',value:30},{metric:'kills_total',op:'gte',value:100},{metric:'kills_firearm',op:'eq',value:0}]);
});
