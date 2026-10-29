import {randomUUID} from 'node:crypto';
import {createMonthlyTestDb} from './monthly-db.js';
import {rewardCatalog} from '../../lib/reward-catalog.js';
export const operator='f0000000-0000-4000-8000-000000000009';
export const saturday='2026-11-07T03:00:00Z';
export const scalar=async(db,sql,args=[])=>Object.values((await db.query(sql,args)).rows[0])[0];
export function synthetic36(){const c=structuredClone(rewardCatalog);c.version='ISOLATED-36-NOT-A-PRODUCTION-CATALOG';
 for(let n=0;n<12;n++)c.rewards.push({...structuredClone(c.rewards[n]),id:'SYNTHETIC-UNRELEASED-'+n,name:'Synthetic reward '+n});return c;}
export async function setupWeekend({unlock=true}={}){
 const db=await createMonthlyTestDb({rewardsV3:true});
 const account=await scalar(db,'select register_reward_account_v3($1,$2,$3)',['76561190000000001','Synthetic account','Synthetic User']);
 if(unlock){
  const catalog=synthetic36();await db.query('select activate_product14_v2()');
  await db.query("select reconcile_months_at_v2('2026-11-01T03:00:00Z')");
  await db.query('update reward_catalogs_v1 set active=false');await db.query('insert into reward_catalogs_v1 values($1,$2,true,now())',[catalog.version,catalog]);
  await db.query('select attest_reward_account_v3($1,$2,$3,$4)',[account,'a'.repeat(64),'b'.repeat(64),operator]);
  await db.query('update roulette_release_v3 set weekly_enabled=true,remote_enabled=true,rollover_evidence=$1,rcon_evidence=$1,activation_approval=$1,catalog_approval=$1,approved_catalog=$2',['c'.repeat(64),catalog]);
 }
 return {db,account,catalog:synthetic36()};
}
export function weeklyDraw(db,account,{at=saturday,window=saturday,request=randomUUID(),reward='workshop-kit',rarity='rare'}={}){
 return scalar(db,'select draw_weekend_at_v3($1,$2,$3,$4,$5,$6,$7,$8)',[account,window,synthetic36().version,rarity,reward,request,operator,at]);
}
