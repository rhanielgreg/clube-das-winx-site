import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile,mkdtemp,readdir,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {PGlite} from '@electric-sql/pglite';
import {collectionHealth} from '../lib/collection-health.js';
import {backupApplication,protectedBackupDirectory} from '../scripts/backup-application.js';
import {evaluateAchievements} from '../lib/achievements.js';
import healthApi from '../api/collection-health.js';
const at='2026-10-27T04:00:00Z';
const base={contract:'collection-health-v1',server_time:at,interval_seconds:300,
 last_success_at:'2026-10-27T03:55:00Z',latest_attempt_at:'2026-10-27T03:55:00Z',latest_attempt_status:'success',consecutive_failures:0};
test('saúde distingue coleta, atraso, repetição e desconhecido sem declarar servidor offline',()=>{
 assert.equal(collectionHealth(base).state,'healthy');
 assert.equal(collectionHealth({...base,latest_attempt_status:'failed',consecutive_failures:1}).state,'retry_needed');
 assert.equal(collectionHealth({...base,latest_attempt_status:'failed',consecutive_failures:3}).state,'repeated_failures');
 assert.equal(collectionHealth({...base,last_success_at:'2026-10-27T03:40:00Z'}).state,'delayed');
 assert.equal(collectionHealth({...base,latest_attempt_status:'running',latest_attempt_at:'2026-10-27T03:59:00Z'}).state,'collecting');
 assert.equal(collectionHealth({...base,latest_attempt_status:'running',latest_attempt_at:'2026-10-27T03:40:00Z'}).state,'stalled');
 assert.equal(collectionHealth({...base,last_success_at:null,latest_attempt_status:null}).state,'awaiting_first_success');
 for(const value of [null,{}, {...base,server_time:null},{...base,interval_seconds:3},{...base,last_success_at:'2026-10-28T00:00:00Z'}])assert.equal(collectionHealth(value).state,'unknown');
 assert.equal(collectionHealth(base).game_server_state,'not_assessed');
 assert.equal(collectionHealth({...base,failure_family:'private-value'}).failure_family,null);
});
test('011: backup é RPC privada, saúde é agregada, nenhuma linha/contrato é ativado',async()=>{
 const db=new PGlite();try {
  await db.exec(await readFile(new URL('./fixtures/schema-before.sql',import.meta.url),'utf8'));
  for(const name of ['001_restrict_ingestion','002_public_read_contracts','003_official_championship','004_life_achievements','006_dashboard_release','005_life_read_contracts','007_controlled_life_activation'])await db.exec(await readFile(new URL('../migrations/'+name+'.sql',import.meta.url),'utf8'));
  await db.exec("insert into ranking_seasons(id,name,slug,started_at) values('4ec32a87-fb16-4838-af57-f4cf85425a60','Temporada 1','temporada-1','2026-10-20T01:05:18.930285Z')");
  for(const name of ['008_season_schedule','009_correct_season1_deadline','010_life_integrity_guards','011_readonly_operations'])await db.exec(await readFile(new URL('../migrations/'+name+'.sql',import.meta.url),'utf8'));
  const sql=await readFile(new URL('../migrations/011_readonly_operations.sql',import.meta.url),'utf8');await db.exec(sql);
  await db.exec("insert into collector_runs(status,started_at,finished_at,records_seen) values('success',now()-interval '10 minutes',now()-interval '9 minutes',5);insert into collector_runs(status,started_at,finished_at,error_code) select 'failed',now()-i*interval '1 minute',now()-i*interval '1 minute','source_auth_failed' from generate_series(1,3)i;");
  const result=(await db.query('select get_public_collection_health_v1() data')).rows[0].data;
  assert.equal(result.consecutive_failures,3);assert.equal(result.failure_family,'source_authentication');
  assert.ok(!JSON.stringify(result).includes('error_code'));assert.equal(collectionHealth(result).state,'repeated_failures');
  for(const role of ['anon','authenticated']) {
   await db.exec('set role '+role);
   await assert.rejects(db.query('select get_service_recovery_export_v1()'),e=>e.code==='42501');
   await assert.rejects(db.query('select get_service_source_evidence_v1()'),e=>e.code==='42501');
   assert.equal((await db.query('select get_public_collection_health_v1() data')).rows[0].data.consecutive_failures,3);
   await db.exec('reset role');
  }
  await db.exec('reset role');
  const diagnostics=[{source_scope:'a'.repeat(64),character_token:'b'.repeat(64),life_digest:'c'.repeat(64),blob_sha256:'d'.repeat(64)}];
  await db.query("insert into collector_runs(status,started_at,finished_at,records_seen,source_diagnostics) values('success',now(),now(),1,$1)",[diagnostics]);
  await db.exec('set role service_role');
  const observed=(await db.query('select get_service_source_evidence_v1() data')).rows[0].data;
  assert.equal(observed.contract,'observational-v1');assert.equal(Object.keys(observed.items).length,1);
  assert.equal(observed.items['a'.repeat(64)+':'+ 'b'.repeat(64)].life_digest,'c'.repeat(64));
  const raw=(await db.query('select get_service_recovery_export_v1() data')).rows[0].data;
  const backup=JSON.parse(raw);assert.equal(backup.tables.length,15);assert.equal(backup.data.achievement_definitions.length,100);
  assert.equal(backup.data.life_achievements.length,0);assert.equal(backup.data.dashboard_rollout_state[0].life_enabled,false);
  assert.ok(!Object.hasOwn(backup.data,'users'));await db.exec('reset role');
 }finally{await db.close();}
});
test('backup exige destino protegido, preserva texto/bigint e só publica arquivo após verificação',async()=>{
 await assert.rejects(protectedBackupDirectory(process.cwd()),/outside the repository/);
 const folder=await mkdtemp(path.join(os.tmpdir(),'winx-backup-test-'));
 const raw='{"schema":"public","exported_at":"2026-10-27T04:00:00Z","sequence_bound":9223372036854775807}';
 const env={SUPABASE_URL:'https://nykhcytysswjdynjosib.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'sb_secret_test_only'};
 let called=0;
 const options={directory:folder,env,checkDirectory:async d=>d,fetchImpl:async(url,init)=>{
  called++;assert.ok(url.endsWith('/rpc/get_service_recovery_export_v1'));assert.equal(init.method,'POST');assert.equal(init.body,'{}');
  return Response.json(raw);
 },verify:async b=>{assert.equal(b.sequence_bound,'9223372036854775807');return {exact_rows:true,metadata_and_named_grants:true};}};
 try {
  await assert.rejects(backupApplication({...options,env:{...env,SUPABASE_URL:'https://wrong.invalid'}}),/Correct project/);
  assert.equal(called,0);
  await assert.rejects(backupApplication({...options,verify:async()=>{throw Error('restore failed');}}),/restore failed/);
  assert.equal((await readdir(folder)).length,0);
  const output=await backupApplication(options);
  assert.equal(await readFile(path.join(folder,output.file),'utf8'),raw);
  assert.equal(output.periodic,false);assert.equal(output.retention_recommendation.automatic_deletion,false);
  assert.ok(!JSON.stringify(output).includes('sb_secret'));
 }finally{assert.equal(path.dirname(folder),os.tmpdir());await rm(folder,{recursive:true,force:true});}
});
test('motor JS acompanha SQL: igualdade exige leituras simultâneas e arquivo não substitui contador vitalício',()=>{
 const metric=(value,unit='count')=>({value,unit,scope:'life',validated:true,coverage:'complete_life',observed_at:at});
 const evidence={identity_status:'verified_source_life',alive:true,last_observed_at:at,metrics:{survival_world_days:metric(30,'world_days'),kills_total:metric(100),kills_firearm:metric(0)}};
 assert.ok(evaluateAchievements(evidence).includes('mes-sem-tiros'));
 const mixed=structuredClone(evidence);mixed.metrics.kills_total.observed_at='2026-10-26T04:00:00Z';assert.ok(!evaluateAchievements(mixed).includes('mes-sem-tiros'));
 assert.ok(!evaluateAchievements({...evidence,last_observed_at:null}).includes('mes-sem-tiros'));
 assert.ok(!evaluateAchievements({...evidence,metrics:{},trusted_archive:{kills_total:100000}}).includes('exterminador.gold'));
});
test('endpoint de saúde falha como desconhecido, não divulga erro bruto e rejeita escrita',async t=>{
 const old={url:process.env.SUPABASE_URL,key:process.env.SUPABASE_PUBLISHABLE_KEY};
 Object.assign(process.env,{SUPABASE_URL:'https://test.invalid',SUPABASE_PUBLISHABLE_KEY:'sb_publishable_test'});
 t.mock.method(globalThis,'fetch',async()=>{throw Error('private connection diagnostic');});
 const res=()=>({headers:{},setHeader(k,v){this.headers[k]=v;},status(code){this.code=code;return this;},json(body){this.body=body;return this;}});
 try{const result=res();await healthApi({method:'GET'},result);assert.equal(result.code,503);assert.equal(result.body.state,'unknown');assert.ok(!JSON.stringify(result.body).includes('private'));
 const denied=res();await healthApi({method:'POST'},denied);assert.equal(denied.code,405);}
 finally{old.url===undefined?delete process.env.SUPABASE_URL:process.env.SUPABASE_URL=old.url;old.key===undefined?delete process.env.SUPABASE_PUBLISHABLE_KEY:process.env.SUPABASE_PUBLISHABLE_KEY=old.key;}
});
