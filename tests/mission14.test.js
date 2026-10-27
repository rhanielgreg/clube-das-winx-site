import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {achievementCatalog} from '../public/achievements-catalog.js';
import {achievementCatalog as legacy} from '../public/legacy-achievements-catalog.js';
import {evaluateMedalsV2,medalProgress} from '../lib/achievements.js';
import {monthInterval,belongsToSeason,championshipOutcome,temporalDelta} from '../public/monthly-championship.js';
import {seasonDeadline,seasonCountdown} from '../public/season-schedule.js';
import {medalShowcase} from '../public/medal-showcase.js';
import {renderGlobalRanking} from '../public/ranking-modes.js';
import achievementsApi from '../api/achievements.js';
import globalApi from '../api/global-ranking.js';
import adminApi from '../api/admin.js';
const season='4ec32a87-fb16-4838-af57-f4cf85425a60',world='f0000000-0000-4000-8000-000000000001';
const metricUnits={kills_total:'count',kills_firearm:'count',kills_melee:'count',played_seconds:'seconds',distance_total_m:'meters'};
const metrics=values=>Object.fromEntries(Object.entries(values).map(([k,value])=>[k,{value,unit:metricUnits[k],validated:true,scope:'life',coverage:'observed_lower_bound',observed_at:'2026-10-27T12:00:00Z'}]));

test('28 medalhas únicas ativas no código, 100 definições legadas intactas e sem níveis novos',()=>{
 assert.equal(achievementCatalog.length,28);assert.equal(legacy.length,100);assert.equal(new Set(achievementCatalog.map(a=>a.id)).size,28);
 assert.ok(achievementCatalog.every(a=>a.version===2&&a.retroactivity==='none'&&!a.level&&!a.sequence&&a.criteria.every(r=>r.metric!=='survival_world_days')));
 assert.ok(!achievementCatalog.some(a=>legacy.some(old=>old.id===a.id)));
 for(const a of achievementCatalog){
  const active='2026-10-27T00:00:00Z',e={identity_status:'verified_source_life',catalog_version:'medals-v2',activation_at:active,alive:true,
   profile_id:'profile-fixture',metrics:{},baselines:{},official_events:[]};
  for(const r of a.criteria){
   if(r.metric==='alive'){e.alive=false;continue;}
   if(metricUnits[r.metric]){e.metrics[r.metric]=metrics({[r.metric]:r.value+10000})[r.metric];e.baselines[r.metric]={value:10000,valid:true,observed_at:active,source_sha256:'a'.repeat(64)};}
  }
  e.official_events=Array.from({length:10},(_,i)=>({rules_version:'winx-v2',certified:true,profile_id:e.profile_id,winner_profile_id:e.profile_id,
   outcome:'champion',ends_at:'2027-12-01T03:00:00Z',closed_at:'2027-12-01T03:05:00Z',alive_at_close:true,rank_position:1,
   living_count:i===9?1:2,participant_count:2,season_number:i+2,kills_total:0,won_on_played_time:i!==9}));
  assert.ok(evaluateMedalsV2(e).includes(a.id),a.id+' positivo');
  const first=a.criteria.find(r=>r.metric!=='alive');
  if(metricUnits[first.metric])e.metrics[first.metric].value=10000+first.value-1;
  else e.official_events=[];
  assert.ok(!evaluateMedalsV2(e).includes(a.id),a.id+' fronteira');
 }
});

test('calendário civil de Brasília: meses de 28/29/30/31 dias e viradas exatas [início,fim)',()=>{
 for(const [at,start,end] of [
  ['2026-10-31T23:00:00Z','2026-10-01T03:00:00.000Z','2026-11-01T03:00:00.000Z'],
  ['2026-11-20T12:00:00Z','2026-11-01T03:00:00.000Z','2026-12-01T03:00:00.000Z'],
  ['2027-02-15T12:00:00Z','2027-02-01T03:00:00.000Z','2027-03-01T03:00:00.000Z'],
  ['2028-02-20T12:00:00Z','2028-02-01T03:00:00.000Z','2028-03-01T03:00:00.000Z']])assert.deepEqual(monthInterval(at),{start,end});
 const period={started_at:'2026-10-20T01:05:18.930285Z',logical_end_at:'2026-11-01T03:00:00Z'};
 assert.equal(belongsToSeason('2026-11-01T02:59:59.999Z',period),true);
 assert.equal(belongsToSeason(period.logical_end_at,period),false);
 const schedule={status:'active',schedule_verified:true,deadline_exclusive:true,scheduled_end_at:period.logical_end_at,closure_mode:'automatic'};
 assert.equal(seasonDeadline(schedule),'Encerra em 31/10/2026 às 23h59');
 assert.equal(seasonCountdown(schedule,Date.parse('2026-11-01T02:59:30Z')),'0d 00h 00m 30s');
});

test('campeão usa só kills e tempo; igualdade completa, mortos e desconhecidos não produzem vencedor indevido',()=>{
 const a={profile_id:'z',alive:true,certified:true,kills_total:0,played_seconds:10},b={...a,profile_id:'a',played_seconds:5};
 assert.equal(championshipOutcome([a,b],{complete:true}).winner,'z');
 assert.equal(championshipOutcome([a,{...b,played_seconds:10}],{complete:true}).outcome,'technical_tie');
 assert.equal(championshipOutcome([{...a,alive:false},{...b,alive:false}],{complete:true}).outcome,'apocalypse');
 assert.equal(championshipOutcome([a,{...b,alive:null}],{complete:true}).outcome,'pending_certification');
 assert.equal(championshipOutcome([a,{...b,kills_total:100,alive:false}],{complete:true}).winner,'z');
 assert.equal(championshipOutcome([a],{complete:false}).outcome,'pending_certification');
});

test('incrementos cruzando meia-noite ficam incertos; zero observado não inventa eventos',()=>{
 const period={started_at:'2026-11-01T03:00:00Z',logical_end_at:'2026-12-01T03:00:00Z'};
 const before={observed_at:'2026-11-01T02:55:00Z',value:100},after={observed_at:'2026-11-01T03:05:00Z',value:110};
 assert.equal(temporalDelta(before,after,period).state,'uncertain_interval');
 assert.deepEqual(temporalDelta(before,{...after,value:100},period),{state:'certified',value:0});
 assert.equal(temporalDelta(after,{observed_at:'2026-11-01T03:10:00Z',value:130},period).value,20);
 assert.equal(temporalDelta(after,{...after,value:1},period).state,'invalid');
});

test('progresso novo por vida não herda passado; baselines ausentes/regressões e vitórias não consecutivas',()=>{
 const e={identity_status:'verified_source_life',catalog_version:'medals-v2',activation_at:'2026-10-27T00:00:00Z',alive:true,metrics:metrics({kills_total:3000}),
  baselines:{kills_total:{value:2000,valid:true,observed_at:'2026-10-27T01:00:00Z',source_sha256:'a'.repeat(64)}}};
 assert.equal(medalProgress(e).kills_total,1000);assert.ok(evaluateMedalsV2(e).includes('m14.exterminador'));
 assert.ok(!evaluateMedalsV2({...e,baselines:{}}).includes('m14.exterminador'));
 assert.ok(!evaluateMedalsV2({...e,baselines:{kills_total:{...e.baselines.kills_total,valid:false}}}).includes('m14.exterminador'));
 assert.equal(medalProgress({...e,metrics:metrics({kills_total:1000})}).kills_total,undefined);
 assert.ok(!evaluateMedalsV2({...e,identity_status:'ambiguous'}).length);
 assert.ok(!evaluateMedalsV2({...e,alive:false}).includes('m14.sepultada'));
});

test('vitrines compactas só mostram medalhas reais; Global vazio não fabrica totais nem atribuições',()=>{
 assert.match(medalShowcase({identity_verified:false}),/indisponíveis/);
 const earned=medalShowcase({identity_verified:true,catalog_version:'medals-v2',visible:[achievementCatalog[0]]});
 assert.match(earned,/Exterminador/);assert.ok(!earned.includes('Bronze'));assert.ok(!earned.includes('Prata'));
 assert.match(renderGlobalRanking({ranking:[]}),/aguarda vidas/);
 assert.ok(!renderGlobalRanking({ranking:[]}).includes('0 kills'));
 const body=renderGlobalRanking({ranking:[{account_id:'x',rank_position:1,steam_username:'<script>',kills_total:1700,lives_count:4}]});
 assert.ok(body.includes('&lt;script&gt;'));assert.match(body,/histórico parcial/);
});

test('APIs v2 usam catálogo ativo, toleram ordem JSONB, ocultam dados privados e bloqueiam comandos administrativos antigos',async t=>{
 const keys=['SUPABASE_URL','SUPABASE_PUBLISHABLE_KEY','SUPABASE_ANON_KEY','COMPETITION_RULES_VERSION','LIFE_CONTRACT_VERSION','ADMIN_EMAIL'];
 const before=Object.fromEntries(keys.map(k=>[k,process.env[k]]));
 const response=()=>({setHeader(){},status(code){this.code=code;return this;},json(body){this.body=body;return this;}});
 const profile='20000000-0000-4000-8000-000000000001';let verified=false;const calls=[];
 try{
  Object.assign(process.env,{SUPABASE_URL:'https://fixture.invalid',SUPABASE_PUBLISHABLE_KEY:'sb_publishable_fixture',ADMIN_EMAIL:'admin@fixture.invalid'});
  delete process.env.COMPETITION_RULES_VERSION;delete process.env.LIFE_CONTRACT_VERSION;
  t.mock.method(globalThis,'fetch',async(url,options)=>{
   calls.push(url);
   if(url.endsWith('/auth/v1/user'))return Response.json({email:'admin@fixture.invalid'});
   if(url.endsWith('get_public_dashboard_release_v1'))return Response.json({competition_rules_version:'winx-v1',life_contract_version:null,product14_installed:true});
   if(url.endsWith('get_public_product14_v2'))return Response.json({contract:'winx-v2',monthly_enabled:true,medals_enabled:true,seasons:[]});
   if(url.endsWith('get_public_medals_v2'))return Response.json({catalog_version:'medals-v2',catalog_count:28,identity_verified:verified,
    catalog:achievementCatalog.map(a=>({...a,criteria:a.criteria.map(r=>({op:r.op,value:r.value,metric:r.metric}))})),
    unlocks:verified?[{achievement_id:'m14.exterminador',recognized_at:'2026-10-27T12:00:00Z'}]:[],account_token:'private-fixture'});
   if(url.endsWith('get_public_global_ranking_v2'))return Response.json({contract:'global-accounts-v2',state:'partial_verified_history',ranking:[{account_id:profile,profile_id:profile,steam_username:'Conta verificada',kills_total:1700,lives_count:4,known_lives:4,rank_position:1,account_token:'private-fixture'}]});
   throw Error('Unexpected request');
  });
  const pending=response();await achievementsApi({method:'GET',query:{id:profile}},pending);assert.equal(pending.code,200);assert.equal(pending.body.catalog_count,28);assert.equal(pending.body.total_unlocked,null);
  verified=true;const ready=response();await achievementsApi({method:'GET',query:{id:profile}},ready);assert.equal(ready.body.total_unlocked,1);assert.equal(ready.body.visible[0].id,'m14.exterminador');
  assert.ok(!JSON.stringify(ready.body).includes('private-fixture'));
  const global=response();await globalApi({method:'GET'},global);assert.equal(global.code,200);assert.equal(global.body.ranking[0].kills_total,1700);assert.ok(!JSON.stringify(global.body).includes('private-fixture'));
  const denied=response();await adminApi({method:'POST',headers:{authorization:'Bearer fixture'},body:{action:'start_season',payload:{name:'Teste','slug':'teste'}}},denied);assert.equal(denied.code,409);
  assert.ok(!calls.some(url=>url.includes('start_ranking_season')));
 }finally{for(const k of keys)before[k]===undefined?delete process.env[k]:process.env[k]=before[k];}
});

async function database(){
 const db=new PGlite();await db.exec(await readFile(new URL('./fixtures/schema-before.sql',import.meta.url),'utf8'));
 for(const name of ['001_restrict_ingestion','002_public_read_contracts','003_official_championship','004_life_achievements','006_dashboard_release','005_life_read_contracts','007_controlled_life_activation'])await db.exec(await readFile(new URL('../migrations/'+name+'.sql',import.meta.url),'utf8'));
 await db.query("insert into ranking_seasons(id,name,slug,status,started_at)values($1,'Temporada 1','temporada-1','active','2026-10-20T01:05:18.930285Z')",[season]);
 for(const name of ['008_season_schedule','009_correct_season1_deadline','010_life_integrity_guards','011_readonly_operations','012_monthly_championship_v2','013_medals_v2','014_product14_contracts','015_complete_public_recovery'])await db.exec(await readFile(new URL('../migrations/'+name+'.sql',import.meta.url),'utf8'));
 return db;
}
const queryValue=async(db,sql,params=[])=>Object.values((await db.query(sql,params)).rows[0])[0];
async function activate(db){await db.query('select activate_product14_v2()');}
async function native(db,values,{token='b'.repeat(64),account='a'.repeat(64),alive=true,at=new Date(Date.now()+1000).toISOString(),hash='c'.repeat(64)}={}){
 return queryValue(db,'select ingest_life_observation_v1($1,$2,$3,$4,$5,$6,$7,$8,$9)',[world,account,token,'Vida sintética','Conta sintética',alive,at,hash,metrics(values)]);
}

test('PostgreSQL v2: migrações, ACLs, ativação, baselines, calendário e recuperação',async t=>{
 const db=await database();
 async function scenario(name,run){await t.test(name,async()=>{await db.exec('begin');try{await run();}finally{await db.exec('rollback');}});}
 try{
  await scenario('instalação preserva legado, T1 não encerra e novos RPCs privados recusam anon/authenticated',async()=>{
   assert.equal(await queryValue(db,'select count(*) from achievement_definitions'),100);
   assert.equal(await queryValue(db,'select count(*) from medal_definitions_v2'),28);
   assert.equal(await queryValue(db,'select monthly_enabled from product14_state'),false);
   const backup=JSON.parse(await queryValue(db,'select get_service_recovery_export_v1()'));
   assert.deepEqual(Object.keys(backup.data).sort(),backup.tables.map(t=>t.name).sort());
   assert.equal(await queryValue(db,'select status from ranking_seasons where id=$1',[season]),'active');
   for(const role of ['anon','authenticated'])for(const fn of ['reconcile_months_v2()','activate_product14_v2()','evaluate_medals_v2(uuid)','get_service_product14_readiness_v2()'])
    assert.equal(await queryValue(db,'select has_function_privilege($1,$2,\'EXECUTE\')',[role,'public.'+fn]),false);
   assert.equal(await queryValue(db,"select has_function_privilege('service_role','public.reconcile_months_at_v2(timestamptz)','EXECUTE')"),false);
  });
  await scenario('catálogo ativo 28 e namespace não presumido; nenhum desbloqueio e rollback seguro',async()=>{
   await activate(db);assert.equal(await queryValue(db,'select count(*) from medal_definitions_v2 where active'),28);
   assert.equal(await queryValue(db,'select count(*) from achievement_definitions where active'),0);
   assert.equal(await queryValue(db,'select count(*) from achievement_definitions'),100);
   assert.equal(await queryValue(db,'select count(*) from medal_unlocks_v2'),0);
   assert.equal((await queryValue(db,'select get_service_product14_readiness_v2()')).contract_ready,false);
   await db.query('select rollback_product14_activation_v2()');assert.equal(await queryValue(db,'select monthly_enabled from product14_state'),false);
  });
  await scenario('renomeação excepcional auditada preserva calendário e não reabre resultado',async()=>{
   await activate(db);const before=(await db.query('select started_at,scheduled_end_at from ranking_seasons where id=$1',[season])).rows[0];
   await db.query('select rename_monthly_season_v2($1,$2,$3,$4)',[season,'Nome excepcional','Justificativa administrativa explícita',world]);
   assert.equal(await queryValue(db,'select count(*) from season_admin_audit_v2'),1);
   assert.deepEqual((await db.query('select started_at,scheduled_end_at from ranking_seasons where id=$1',[season])).rows[0],before);
   assert.equal(await queryValue(db,"select has_function_privilege('authenticated','public.rename_monthly_season_v2(uuid,text,text,uuid)','EXECUTE')"),false);
  });
  await scenario('baseline persistente não retroativo, nova vida, morte e Global sem duplicar observações',async()=>{
   await activate(db);await db.query("insert into source_epochs_v2 values($1,$2,'source_generation_manifest',now(),'fixture')",[world,'e'.repeat(64)]);
   const p=await native(db,{kills_total:2000,played_seconds:72000,distance_total_m:50000});
   assert.equal(await queryValue(db,'select count(*) from medal_unlocks_v2'),0);
   await native(db,{kills_total:3000,played_seconds:108000,distance_total_m:60000},{at:new Date(Date.now()+2000).toISOString(),hash:'d'.repeat(64)});
   const ids=(await db.query('select achievement_id from medal_unlocks_v2')).rows.map(x=>x.achievement_id);
   assert.ok(ids.includes('m14.exterminador'));assert.ok(ids.includes('m14.tempo-10'));assert.ok(ids.includes('m14.distancia-10'));assert.ok(!ids.includes('m14.ceifador'));
   await native(db,{kills_total:3000,played_seconds:108000,distance_total_m:60000},{alive:false,at:new Date(Date.now()+3000).toISOString(),hash:'f'.repeat(64)});
   assert.equal(await queryValue(db,"select count(*) from medal_unlocks_v2 where achievement_id='m14.legado'"),1);
   await native(db,{kills_total:200,played_seconds:1000},{token:'9'.repeat(64),at:new Date(Date.now()+4000).toISOString()});
   const global=await queryValue(db,'select get_public_global_ranking_v2()');assert.equal(global.ranking.length,1);assert.equal(Number(global.ranking[0].kills_total),3200);
   assert.equal(Number(global.ranking[0].lives_count),2);
   const medals=await queryValue(db,'select get_public_medals_v2($1)',[p]);assert.equal(medals.catalog_count,28);
   assert.equal((await db.query('select * from life_achievements')).rows.length,0,'não converte medalhas legadas');
  });
  await scenario('virada, repetição/concorrência serializada e meses perdidos: calendário segue com certificação pendente',async()=>{
   await activate(db);const before=(await db.query('select * from ranking_seasons')).rows;
   assert.equal((await queryValue(db,"select reconcile_months_at_v2('2026-10-31T23:00:00Z')")).transitions,0);
   assert.equal((await db.query('select status from ranking_seasons where id=$1',[season])).rows[0].status,before[0].status);
   const values=await Promise.all([db.query("select reconcile_months_at_v2('2026-11-01T03:00:00Z') data"),db.query("select reconcile_months_at_v2('2026-11-01T03:00:00Z') data")]);
   assert.equal(values.reduce((sum,r)=>sum+r.rows[0].data.transitions,0),1);
   assert.equal(await queryValue(db,"select count(*) from ranking_seasons where status='active'"),1);
   assert.equal(await queryValue(db,'select certification from season_cycles_v2 where season_id=$1',[season]),'pending_certification');
   await db.query("select reconcile_months_at_v2('2027-03-01T03:00:00Z')");
   assert.equal(await queryValue(db,'select count(*) from season_cycles_v2'),6);
   assert.equal((await db.query("select started_at from ranking_seasons where status='active'")).rows[0].started_at.toISOString(),'2027-03-01T03:00:00.000Z');
  });
  for(const kind of ['technical_tie','champion','apocalypse','unknown','uncertain'])await scenario('certificação SQL com evidência de fronteira: '+kind,async()=>{
   const profiles=[];
   for(let i=0;i<2;i++)profiles.push(await native(db,{kills_total:100,played_seconds:1000},{account:String(i+1).repeat(64),token:String(i+3).repeat(64),at:'2026-10-20T00:00:00Z'}));
   await activate(db);await db.query("insert into source_epochs_v2 values($1,$2,'source_generation_manifest',now(),'fixture')",[world,'e'.repeat(64)]);
   for(let i=0;i<2;i++){
    const lifeId=await queryValue(db,'select id from life_identities where profile_id=$1',[profiles[i]]);
    const endKills=kind==='champion'?100:400,endTime=kind==='champion'&&i===1?4000:5000;
    const points=[['2026-10-20T01:05:18.930284Z',100,1000,true],['2026-10-20T01:05:18.930286Z',100,1000,true],
     ['2026-11-01T02:59:59Z',endKills,endTime,kind!=='apocalypse'],['2026-11-01T03:00:01Z',endKills+(kind==='uncertain'?10:0),endTime,kind!=='apocalypse'&&kind!=='unknown']];
    for(let n=0;n<points.length;n++){
     const [at,kills,played,alive]=points[n];await db.query('insert into life_observations(life_id,observed_at,source_sha256,payload_digest,metrics,alive)values($1,$2,$3,$4,$5,$6)',[lifeId,at,'a'.repeat(64),String(n),metrics({kills_total:kills,played_seconds:played}),alive]);
    }
    await db.query('update life_identities set last_observed_at=$1,alive=$2 where id=$3',['2026-11-01T03:00:01Z',kind!=='apocalypse'&&kind!=='unknown',lifeId]);
   }
   await db.query('update season_cycles_v2 set complete_population=true where season_id=$1',[season]);
   await db.query("select reconcile_months_at_v2('2026-11-01T03:00:02Z')");
   assert.equal(await queryValue(db,'select certification from season_cycles_v2 where season_id=$1',[season]),['unknown','uncertain'].includes(kind)?'pending_certification':kind);
   if(kind==='champion'){
    assert.equal(await queryValue(db,'select winner_profile_id from season_cycles_v2 where season_id=$1',[season]),profiles[0]);
    assert.equal(await queryValue(db,"select count(*) from medal_unlocks_v2 where achievement_id='m14.coroa'"),1);
    assert.equal(await queryValue(db,"select count(*) from medal_unlocks_v2 where achievement_id='m14.rei-zero'"),1);
   }else assert.equal(await queryValue(db,"select count(*) from medal_unlocks_v2 where achievement_id='m14.coroa'"),0);
   if(kind==='uncertain')assert.ok(Number(await queryValue(db,'select count(*) from season_uncertain_intervals_v2'))>0);
  });
 }finally{await db.close();}
});

