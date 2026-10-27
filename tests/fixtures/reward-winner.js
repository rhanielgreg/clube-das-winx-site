// Synthetic owner-only evidence for local PostgreSQL/browser tests. No DSN.
import {firstSeason} from './monthly-db.js';
import {rewardCatalog} from '../../lib/reward-catalog.js';
const world='f0000000-0000-4000-8000-000000000001';
const value=async(db,sql,args=[])=>Object.values((await db.query(sql,args)).rows[0])[0];
export async function createRewardWinner(db,{at=new Date().toISOString(),catalog=rewardCatalog}={}){
 await db.query('select activate_product14_v2()');
 await db.query("insert into source_epochs_v2 values($1,$2,'source_generation_manifest',now(),'ISOLATED FIXTURE')",[world,'a'.repeat(64)]);
 const metrics={kills_total:{value:100,unit:'count',scope:'life',coverage:'observed_lower_bound',validated:true,observed_at:at},played_seconds:{value:3600,unit:'seconds',scope:'life',coverage:'observed_lower_bound',validated:true,observed_at:at}};
 const profile=await value(db,'select ingest_life_observation_v1($1,$2,$3,$4,$5,$6,$7,$8,$9)',[world,'a'.repeat(64),'b'.repeat(64),'Vida de teste','Conta de teste',true,at,'a'.repeat(64),metrics]);
 const life=await value(db,'select id from life_identities where profile_id=$1',[profile]);
 await db.query("select set_config('winx.monthly.operation','reconcile',false)");
 await db.query("update season_cycles_v2 set ends_at=now()-interval '1 minute',closed_at=now(),certification='champion',winner_profile_id=$1,complete_population=true where season_id=$2",[profile,firstSeason]);
 await db.query("update ranking_seasons set status='closed',ended_at=now()-interval '1 minute' where id=$1",[firstSeason]);
 await db.query("insert into season_archive_v2(season_id,profile_id,life_id,frozen_statistics,alive_at_close,kills_total,played_seconds,certified,rank_position)values($1,$2,$3,'{}',true,100,3600,true,1)",[firstSeason,profile,life]);
 await db.query('update dashboard_rollout_state set life_enabled=true,source_namespace=$1,cohort_started_at=now()',[world]);
 await db.query('update reward_catalogs_v1 set active=false');
 await db.query('insert into reward_catalogs_v1(version,definition,active)values($1,$2,true) on conflict(version) do update set active=true',[catalog.version,catalog]);
 await db.query("select set_config('winx.monthly.operation','',false)");
 return {life,profile,catalog};
}
