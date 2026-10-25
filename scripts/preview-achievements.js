// Banco descartável EXCLUSIVO da demonstração. Não lê env, não chama serviços.
import { PGlite } from '@electric-sql/pglite';
import { readFile } from 'node:fs/promises';
import { metricUnits } from '../lib/life-metrics.js';
export async function createAchievementDemo() {
 const db=new PGlite();
 try {
  await db.exec(await readFile(new URL('../tests/fixtures/schema-before.sql',import.meta.url),'utf8'));
  for(const name of ['001_restrict_ingestion','002_public_read_contracts','003_official_championship','004_life_achievements','005_life_read_contracts']) await db.exec(await readFile(new URL('../migrations/'+name+'.sql',import.meta.url),'utf8'));
  await db.exec("insert into ranking_seasons(name,slug,started_at) values('Demonstração local','demo',now()-interval '1 day')");
  const numbers={kills_total:1248,kills_firearm:182,kills_melee:766,kills_vehicle:250,kills_other:50,
   kills_axe:300,kills_blunt:150,kills_small_blunt:50,kills_long_blade:100,kills_small_blade:66,kills_spear:70,kills_unarmed:30,
   played_seconds:28740,survival_world_days:9.5,distance_total_m:95970,distance_walked_m:15320,distance_vehicle_m:80650};
  let profile;
  for(const zero of [true,false]){
   const metrics=Object.fromEntries(Object.entries(numbers).map(([key,value])=>[key,{value:zero?0:value,unit:metricUnits[key],validated:true,scope:'life',coverage:'complete_life'}]));
   profile=(await db.query('select ingest_life_observation_v1($1,$2,$3,$4,$5,$6,$7,$8,$9) id',[
    'f0000000-0000-4000-8000-000000000001','a'.repeat(64),'b'.repeat(64),'Lia Moretti','violeta',true,
    new Date(Date.now()-(zero?60000:0)).toISOString(),'c'.repeat(64),metrics])).rows[0].id;
  }
  return {async get(){return(await db.query('select get_public_life_achievements_v1($1) data',[profile])).rows[0].data;},close:()=>db.close()};
 }catch(error){await db.close();throw error;}
}
