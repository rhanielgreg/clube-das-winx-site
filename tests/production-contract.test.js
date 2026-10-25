import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

test('contrato SQL observado em produção: baselines de tempo independentes e ausência não vira zero',async()=>{
 const db=new PGlite();
 try {
  await db.exec(await readFile(new URL('./fixtures/schema-before.sql',import.meta.url),'utf8'));
  await db.exec(await readFile(new URL('./fixtures/ingest-production-20261025.sql',import.meta.url),'utf8'));
  for(const name of ['001_restrict_ingestion','002_public_read_contracts','003_official_championship','004_life_achievements','006_dashboard_release','005_life_read_contracts','007_controlled_life_activation'])await db.exec(await readFile(new URL('../migrations/'+name+'.sql',import.meta.url),'utf8'));
  await db.exec("insert into ranking_seasons(name,slug) values('Teste de contrato','teste-contrato')");
  let profile;
  const ingest=async(kills,seconds,token='b')=>{
   const metrics={kills_total:{value:kills,unit:'count',validated:true,scope:'life'}};
   if(seconds!==null)metrics.played_seconds={value:seconds,unit:'seconds',validated:true,scope:'life'};
   profile=(await db.query('select ingest_life_observation_v1($1,$2,$3,$4,$5,true,$6,$7,$8) id',[
    'f0000000-0000-4000-8000-000000000001','a'.repeat(64),token.repeat(64),'Fixture','Conta sintética',new Date().toISOString(),'c'.repeat(64),metrics])).rows[0].id;
   return(await db.query('select kills_total,survival_seconds from player_statistics_current where character_id=$1',[profile])).rows[0];
  };
  assert.deepEqual(await ingest(100,1000),{kills_total:0,survival_seconds:0});
  assert.deepEqual(await ingest(220,2800),{kills_total:120,survival_seconds:1800});
  assert.deepEqual(await ingest(300,null),{kills_total:200,survival_seconds:null});
  const life=(await db.query('select get_public_life_achievements_v1($1) data',[profile])).rows[0].data;
  assert.equal(life.life_metrics.played_seconds.value,2800,'último valor vitalício conhecido preservado');
  assert.equal(life.life_history.at(-1).survival_seconds,null,'snapshot ausente não vira zero');
  assert.deepEqual(await ingest(350,3500),{kills_total:250,survival_seconds:2500});
  assert.deepEqual(await ingest(10,null,'d'),{kills_total:0,survival_seconds:null});
  assert.deepEqual(await ingest(30,5000,'d'),{kills_total:20,survival_seconds:0},'primeiro tempo conhecido é baseline, sem crédito retroativo');
 }finally{await db.close();}
});
