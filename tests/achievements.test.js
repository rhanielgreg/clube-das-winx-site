import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { achievementCatalog } from '../public/achievements-catalog.js';
import { evaluateAchievements } from '../lib/achievements.js';
import { metricUnits,archiveMetrics } from '../lib/life-metrics.js';
import { visibleAchievements,medalSvg } from '../public/achievement-view.js';
import { achievementPanel } from '../public/achievement-panel.js';
const world='f0000000-0000-4000-8000-000000000001',account='a'.repeat(64),life='b'.repeat(64);
const metric=(key,value,coverage='complete_life')=>({value,unit:metricUnits[key],validated:true,scope:'life',coverage,observed_at:'2026-10-26T00:00:00Z'});
const metrics=(values)=>Object.fromEntries(Object.entries(values).map(([k,v])=>[k,metric(k,v)]));
async function database(){
 const db=new PGlite();
 await db.exec(await readFile(new URL('./fixtures/schema-before.sql',import.meta.url),'utf8'));
 for(const file of ['001_restrict_ingestion','002_public_read_contracts','003_official_championship','004_life_achievements','006_dashboard_release','005_life_read_contracts','007_controlled_life_activation']) {
  const sql=await readFile(new URL('../migrations/'+file+'.sql',import.meta.url),'utf8');await db.exec(sql);await db.exec(sql);
 }
 await db.exec("insert into ranking_seasons(name,slug,status,started_at) values('Teste','teste','active',now()-interval '1 day')");
 await db.exec('update dashboard_rollout_state set life_enabled=true');
 return db;
}
async function ingest(db,values,{token=life,alive=true,at=new Date().toISOString(),hash='c'.repeat(64),name='Nome reutilizado'}={}) {
 return (await db.query('select ingest_life_observation_v1($1,$2,$3,$4,$5,$6,$7,$8,$9) id',[world,account,token,name,'Conta sintética',alive,at,hash,values])).rows[0].id;
}
test('exatamente 100 critérios estáveis: 30 progressões completas e 10 especiais',()=>{
 assert.equal(achievementCatalog.length,100);assert.equal(new Set(achievementCatalog.map(a=>a.id)).size,100);
 assert.equal(achievementCatalog.filter(a=>a.type==='special').length,10);
 const sequences=new Map();const known=new Set([...Object.keys(metricUnits),...archiveMetrics,'alive','categories_with_100_kills']);
 for(const a of achievementCatalog){
  for(const key of ['id','name','description','category','type','criteria','required_sources','retroactivity','presentation','insufficient_data']) assert.ok(a[key]);
  assert.ok(a.criteria.length>0);for(const c of a.criteria){assert.ok(known.has(c.metric));assert.ok(['gte','eq'].includes(c.op));assert.ok(Number.isFinite(c.value)&&c.value>=0);}
  if(a.sequence){const rows=sequences.get(a.sequence)||[];rows.push(a);sequences.set(a.sequence,rows);}
 }
 assert.equal(sequences.size,30);for(const rows of sequences.values())assert.deepEqual(rows.map(a=>a.level_rank),[1,2,3]);
});
test('três marcos de mil kills independem dos outros métodos e aceitam cobertura parcial comprovada',async()=>{
 const approved={ 'arsenal-fogo':'kills_firearm','arsenal-contato':'kills_melee','arsenal-rodas':'kills_vehicle' };
 for(const [id,key] of Object.entries(approved))assert.deepEqual(achievementCatalog.find(a=>a.id===id).criteria,[{metric:key,op:'gte',value:1000}]);
 assert.deepEqual(achievementCatalog.filter(a=>a.sequence==='linha-frente').map(a=>a.criteria[0].value),[100,2500,5000]);
 const db=await database();
 try {
  const at=Date.now()-2000;
  for(const [step,count] of [999,1000].entries()){
   const values=Object.fromEntries(Object.entries({kills_total:count*3+37,kills_firearm:count,kills_melee:count,kills_vehicle:count,kills_other:37})
    .map(([key,value])=>[key,metric(key,value,'observed_lower_bound')]));
   const calculated=evaluateAchievements({identity_status:'verified_source_life',alive:true,metrics:values});
   const profile=await ingest(db,values,{at:new Date(at+step*1000).toISOString()});
   const persisted=(await db.query('select get_public_life_achievements_v1($1) data',[profile])).rows[0].data.unlocks.map(a=>a.achievement_id);
   for(const id of Object.keys(approved)){
    assert.equal(calculated.includes(id),count===1000,id+' JS');
    assert.equal(persisted.includes(id),count===1000,id+' SQL');
   }
  }
 }finally{await db.close();}
});
test('cada um dos 100 critérios possui caso positivo e fronteira que não concede',()=>{
 const categoryKeys=['kills_axe','kills_blunt','kills_small_blunt','kills_long_blade','kills_small_blade','kills_spear','kills_unarmed','kills_firearm','kills_vehicle','kills_other'];
 for(const definition of achievementCatalog){
  const evidence={identity_status:'verified_source_life',alive:true,metrics:{},trusted_archive:{},last_observed_at:'2026-10-26T00:00:00Z'};
  const assign=(condition,value)=>{
   if(condition.metric==='alive')evidence.alive=value===1;
   else if(condition.metric==='categories_with_100_kills')categoryKeys.forEach((key,index)=>{evidence.metrics[key]=metric(key,index<value?100:0);});
   else if(archiveMetrics.includes(condition.metric))evidence.trusted_archive[condition.metric]=value;
   else evidence.metrics[condition.metric]=metric(condition.metric,value);
  };
  for(const condition of definition.criteria)assign(condition,condition.value);
  assert.ok(evaluateAchievements(evidence).includes(definition.id),definition.id);
  const first=definition.criteria[0];assign(first,first.op==='eq'?1:first.value-1);
  assert.ok(!evaluateAchievements(evidence).includes(definition.id),definition.id+' abaixo do critério');
 }
});
test('motor não concede sem identidade, unidade, escopo ou cobertura; UI conta todos os níveis',()=>{
 const evidence={identity_status:'verified_source_life',metrics:metrics({kills_total:10000}),alive:true};
 const unlocked=evaluateAchievements(evidence);
 assert.ok(unlocked.includes('exterminador.gold'));assert.equal(evaluateAchievements({...evidence,identity_status:'legacy_ambiguous'}).length,0);
 for(const bad of [{value:10000,unit:'meters',validated:true,scope:'life'},{value:'10000',unit:'count',validated:true,scope:'life'},{value:true,unit:'count',validated:true,scope:'life'}])assert.equal(evaluateAchievements({...evidence,metrics:{kills_total:bad}}).length,0);
 const view=visibleAchievements(unlocked,achievementCatalog);assert.equal(view.total,3);assert.deepEqual(view.visible.map(a=>a.id),['exterminador.gold']);
 assert.ok(medalSvg(view.visible[0]).includes('viewBox="0 0 64 72"'));
 const partial={identity_status:'verified_source_life',metrics:metrics({survival_world_days:30,kills_total:100,kills_firearm:0}),alive:true,last_observed_at:'2026-10-26T00:00:00Z'};
 assert.ok(evaluateAchievements(partial).includes('mes-sem-tiros'));
 partial.metrics.kills_firearm.coverage='observed_lower_bound';assert.ok(!evaluateAchievements(partial).includes('mes-sem-tiros'));
});
test('dossiê respeita ordem Bronze/Prata/Ouro mesmo com catálogo SQL ordenado por ID; especial não tem próximo nível',()=>{
 const catalog=[...achievementCatalog].sort((a,b)=>a.id.localeCompare(b.id));
 const panel=achievementPanel({catalog_count:100,catalog,identity_verified:true,unlocks:[{achievement_id:'atirador.bronze'},{achievement_id:'tres-frentes'}]});
 const progression=panel.match(/<h3>Atirador — Bronze<\/h3>[\s\S]*?<\/article>/)[0];
 assert.ok(progression.includes('Próximo nível: Kills por armas de fogo ≥ 500'));
 assert.ok(!progression.includes('2.500'));
 const special=panel.match(/<h3>Três frentes<\/h3>[\s\S]*?<\/article>/)[0];
 assert.ok(special.includes('Desbloqueada'));
 assert.ok(!special.includes('Próximo nível'));
});
test('PostgreSQL: persistência por vida, reprocessamento, morte, nome igual, temporada e permissões',async()=>{
 const db=await database();
 try {
  const input=metrics({kills_total:1200,kills_firearm:200,kills_melee:500,kills_vehicle:250,kills_other:250,
   kills_axe:200,kills_blunt:100,kills_small_blunt:50,kills_long_blade:70,kills_small_blade:30,kills_spear:40,kills_unarmed:10,
   played_seconds:200000,survival_world_days:45,distance_total_m:150000,distance_walked_m:60000,distance_vehicle_m:90000});
  const at=new Date().toISOString();const profile=await ingest(db,input,{at});
  const publicData=(await db.query('select get_public_life_achievements_v1($1) data',[profile])).rows[0].data;
  const panel=achievementPanel(publicData);
  assert.ok(panel.includes('CONQUISTAS DESTA VIDA'));assert.ok(!panel.includes('Exterminador — Bronze</h3>'),'somente nível mais alto');
  const expected=evaluateAchievements({identity_status:'verified_source_life',metrics:input,alive:true});
  assert.equal(publicData.catalog_count,100);assert.equal(publicData.identity_verified,true);
  assert.deepEqual(publicData.unlocks.map(a=>a.achievement_id).sort(),expected.sort(),'mesmas regras no JS de referência e PostgreSQL');
  assert.ok(publicData.unlocks.every(a=>a.occurred_at===null&&a.observed_at&&a.recognized_at));
  const before=(await db.query('select * from life_achievements order by achievement_id')).rows;
  await Promise.all([ingest(db,input,{at}),ingest(db,input,{at})]);
  assert.equal((await db.query('select count(*) n from life_observations')).rows[0].n,1);
  assert.deepEqual((await db.query('select * from life_achievements order by achievement_id')).rows,before);
  await assert.rejects(ingest(db,metrics({kills_total:1}),{at,hash:'d'.repeat(64)}),/regression/);
  assert.equal((await db.query('select kills_total from player_statistics_current where character_id=$1',[profile])).rows[0].kills_total,0,'erro reverte inclusive escrita legada');
  await ingest(db,input,{alive:false,at:new Date(Date.now()+10).toISOString(),hash:'e'.repeat(64)});
  assert.ok((await db.query('select get_public_life_achievements_v1($1) data',[profile])).rows[0].data.unlocks.some(a=>a.achievement_id==='legado-caido'));
  await assert.rejects(ingest(db,input,{at:new Date(Date.now()+20).toISOString(),hash:'f'.repeat(64)}),/new source life token/);
  const fresh=await ingest(db,metrics({kills_total:0}),{token:'d'.repeat(64)});
  assert.notEqual(fresh,profile);assert.equal((await db.query('select get_public_life_achievements_v1($1) data',[fresh])).rows[0].data.total_unlocked,0);
  await db.exec("update ranking_seasons set status='closed',ended_at=now();insert into ranking_seasons(name,slug) values('Nova','nova')");
  assert.equal((await db.query('select get_public_life_achievements_v1($1) data',[profile])).rows[0].data.total_unlocked,before.length+1);
  const lifeId=(await db.query('select id from life_identities where profile_id=$1',[profile])).rows[0].id;
  await db.exec('set role anon');
  assert.equal((await db.query('select get_public_life_achievements_v1($1) data',[profile])).rows[0].data.catalog_count,100);
  await assert.rejects(db.query('select * from life_observations'),e=>e.code==='42501');
  await assert.rejects(db.query('select evaluate_life_achievements_v1($1)',[lifeId]),e=>e.code==='42501');
  await db.exec('reset role');
 }finally{await db.close();}
});

test('homenagens exigem cobertura de todos os mortos e não trocam distância total por caminhada',async()=>{
 const db=await database();
 try {
  const profile=await ingest(db,metrics({kills_total:1000,survival_world_days:45,distance_total_m:20000}),{alive:false});
  let honors=(await db.query('select get_public_memorial_honors_v1() data')).rows[0].data;
  assert.ok(honors.every(h=>h.state==='ready'));assert.equal(honors.find(h=>h.category==='andarilho').unit,'meters');
  assert.equal(honors.find(h=>h.category==='exterminador').winners[0].profile_id,profile);
  const player=(await db.query('select player_id from game_characters where id=$1',[profile])).rows[0].player_id;
  await db.query("insert into game_characters(player_id,character_key,public_name,alive,first_seen_at,last_seen_at,source_blob_sha256) values($1,'legacy-unknown','Ambíguo',false,now(),now(),'x')",[player]);
  honors=(await db.query('select get_public_memorial_honors_v1() data')).rows[0].data;
  assert.ok(honors.every(h=>h.state==='pending_evidence'&&h.winners.length===0));
 }finally{await db.close();}
});

test('conquistas de temporada são derivadas do arquivo oficial e sobrevivem à morte',async()=>{
 const db=await database();
 try {
  const profile=await ingest(db,metrics({kills_total:100, kills_vehicle:10}));
  await ingest(db,metrics({kills_total:1500,kills_vehicle:110}),{at:new Date(Date.now()+10).toISOString(),hash:'e'.repeat(64)});
  await db.exec("insert into collector_runs(status,finished_at,records_seen) values('success',now(),1)");
  const season=(await db.query("select id from ranking_seasons where status='active'")).rows[0].id;
  await db.query('select close_ranking_season($1,null)',[season]);
  const lifeId=(await db.query('select id from life_identities where profile_id=$1',[profile])).rows[0].id;
  await db.query('select evaluate_life_achievements_v1($1)',[lifeId]);
  const data=(await db.query('select get_public_life_achievements_v1($1) data',[profile])).rows[0].data;
  assert.ok(data.unlocks.some(a=>a.achievement_id==='coroa-oficial'));
  assert.ok(data.unlocks.some(a=>a.achievement_id==='ultimo-vencedor'));
  assert.ok(data.unlocks.some(a=>a.achievement_id==='temporada-exterminio.silver'));
  assert.equal((await db.query('select kills_vehicle from season_classification where profile_id=$1',[profile])).rows[0].kills_vehicle,100);
  await ingest(db,metrics({kills_total:1500,kills_vehicle:110}),{alive:false,at:new Date(Date.now()+20).toISOString(),hash:'f'.repeat(64)});
  assert.ok((await db.query('select get_public_life_achievements_v1($1) data',[profile])).rows[0].data.unlocks.some(a=>a.achievement_id==='coroa-oficial'));
 }finally{await db.close();}
});

test('coorte certificada não mistura legado e estado desconhecido não encerra apocalipse',async()=>{
 const db=await database();
 try {
  await db.query('select ingest_player_observation($1,$2,$3,$4,$5,now(),9000,1000,8000,10000,$6)',['legacy-player','legacy-life','Legado ambíguo',true,'legacy-source','Conta antiga']);
  const profile=await ingest(db,metrics({kills_total:1000}),{alive:null});
  assert.deepEqual((await db.query('select get_public_ranking_life_v1() data')).rows[0].data,[]);
  await db.exec("insert into collector_runs(status,finished_at,records_seen) values('success',now(),1)");
  const season=(await db.query("select id from ranking_seasons where status='active'")).rows[0].id;
  await assert.rejects(db.query('select close_ranking_season($1,null)',[season]),/participante desconhecido/);
  await ingest(db,metrics({kills_total:1000}),{alive:true,at:new Date(Date.now()+10).toISOString()});
  assert.deepEqual((await db.query('select get_public_ranking_life_v1() data')).rows[0].data.map(r=>r.profile_id),[profile]);
  await ingest(db,metrics({kills_total:1000}),{alive:false,at:new Date(Date.now()+20).toISOString()});
  await db.query('select close_ranking_season($1,null)',[season]);
  assert.equal((await db.query('select outcome from season_results')).rows[0].outcome,'apocalypse');
  assert.equal((await db.query('select count(*) n from season_winners')).rows[0].n,0);
  assert.deepEqual((await db.query('select profile_id from season_classification')).rows.map(r=>r.profile_id),[profile]);
 }finally{await db.close();}
});
test('ativação preserva competição legada durante preparação e exige lote completo antes de trocar a coorte',async()=>{
 const db=await database();
 try{
  await db.exec('update dashboard_rollout_state set life_enabled=false');
  const legacy=(await db.query("select ingest_player_observation('legacy-player','legacy-character','Legado',true,'legacy',now(),1000,0,1000,100,'Conta') id")).rows[0].id;
  const before=(await db.query('select * from player_statistics_current where character_id=$1',[legacy])).rows;
  const run=(await db.query("insert into collector_runs(status) values('running') returning id")).rows[0].id;
  const profile=await ingest(db,metrics({kills_total:1000}));
  assert.deepEqual((await db.query('select * from get_public_ranking(100)')).rows.map(r=>r.profile_id),[legacy]);
  await assert.rejects(db.query('select activate_verified_cohort_v1($1,1)',[world]),/complete collector/);
  await db.query("update collector_runs set status='success',finished_at=clock_timestamp(),records_seen=1 where id=$1",[run]);
  await assert.rejects(db.query('select activate_verified_cohort_v1($1,2)',[world]),/complete collector/);
  await db.query('select activate_verified_cohort_v1($1,1)',[world]);
  assert.deepEqual((await db.query('select * from get_public_ranking(100)')).rows.map(r=>r.profile_id),[profile]);
  assert.deepEqual((await db.query('select * from player_statistics_current where character_id=$1',[legacy])).rows,before);
  assert.equal((await db.query('select get_public_dashboard_release_v1() r')).rows[0].r.life_contract_version,'life-v1');
  await db.exec('set role anon');
  await assert.rejects(db.query('select activate_verified_cohort_v1($1,1)',[world]),e=>e.code==='42501');
 }finally{await db.close();}
});

test('PostgreSQL avalia os 100 critérios: caso positivo e fronteira negativa em banco descartável',async()=>{
 const db=await database();
 try {
  const profile=await ingest(db,{});
  const lifeRow=(await db.query('select id,last_observed_at from life_identities where profile_id=$1',[profile])).rows[0];
  const categoryKeys=['kills_axe','kills_blunt','kills_small_blunt','kills_long_blade','kills_small_blade','kills_spear','kills_unarmed','kills_firearm','kills_vehicle','kills_other'];
  const prepare=async(definition,negative)=>{
   const values={},archives={};let alive=true;
   for(const [index,c] of definition.criteria.entries()){
    const value=negative&&index===0?(c.op==='eq'?1:c.value-1):c.value;
    if(c.metric==='alive')alive=value===1;
    else if(c.metric==='categories_with_100_kills')categoryKeys.forEach((key,i)=>values[key]=metric(key,i<value?100:0));
    else if(archiveMetrics.includes(c.metric))archives[c.metric]=value;
    else values[c.metric]=metric(c.metric,value);
   }
   // Manipulação restrita à fixture para isolar cada fronteira; em produção só ingestão/arquivo oficial alimentam o motor.
   await db.exec('delete from life_achievements;delete from season_classification;delete from season_results;delete from ranking_seasons where status=\'closed\';');
   await db.query("update life_identities li set metrics=(select coalesce(jsonb_object_agg(e.key,e.value||jsonb_build_object('observed_at',li.last_observed_at)),'{}') from jsonb_each($1::jsonb) e),alive=$2 where id=$3",[values,alive,lifeRow.id]);
   const n=Math.max(archives.official_wins||0,archives.solo_official_wins||0,archives.seasons_completed_alive||0,Object.keys(archives).some(k=>k.startsWith('best_season'))?1:0);
   for(let i=0;i<n;i++){
    const s=(await db.query("insert into ranking_seasons(name,slug,status,ended_at) values('Fronteira',$1,'closed',now()) returning id",['boundary-'+i])).rows[0].id;
    await db.query("insert into season_results(season_id,outcome,closed_at,source_success_at) values($1,'champion',now(),now())",[s]);
    await db.query(`insert into season_classification(season_id,profile_id,player_id,rank_position,character_name,alive_at_close,kills_total,kills_firearm,kills_melee,observed_at)
     select $1,c.id,c.player_id,$2,c.public_name,true,$3,$4,$5,now() from game_characters c where c.id=$6`,
     [s,i<Math.max(archives.official_wins||0,archives.solo_official_wins||0)?1:null,archives.best_season_kills_total??null,archives.best_season_kills_firearm??null,archives.best_season_kills_melee??null,profile]);
    // O teste de congelamento do arquivo é separado; aqui o campo é isolado para testar a regra.
    await db.query('update season_classification set kills_vehicle=$1 where season_id=$2',[archives.best_season_kills_vehicle??null,s]);
    if(archives.seasons_completed_alive)await db.query('update season_classification set rank_position=1 where season_id=$1',[s]);
   }
   await db.query('select evaluate_life_achievements_v1($1)',[lifeRow.id]);
   return(await db.query('select exists(select 1 from life_achievements where achievement_id=$1) won',[definition.id])).rows[0].won;
  };
  for(const definition of achievementCatalog){assert.equal(await prepare(definition,false),true,definition.id+' positivo');assert.equal(await prepare(definition,true),false,definition.id+' fronteira');}
 }finally{await db.close();}
});
