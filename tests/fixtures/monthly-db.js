import {PGlite} from '@electric-sql/pglite';
import {readFile} from 'node:fs/promises';
export const firstSeason='4ec32a87-fb16-4838-af57-f4cf85425a60';
export async function createMonthlyTestDb({rewards=false,rewardsV3=false}={}){
 const db=new PGlite();await db.exec(await readFile(new URL('./schema-before.sql',import.meta.url),'utf8'));
 const base=['001_restrict_ingestion','002_public_read_contracts','003_official_championship','004_life_achievements','006_dashboard_release','005_life_read_contracts','007_controlled_life_activation'];
 for(const name of base)await db.exec(await readFile(new URL('../../migrations/'+name+'.sql',import.meta.url),'utf8'));
 await db.query("insert into ranking_seasons(id,name,slug,status,started_at)values($1,'Temporada 1','temporada-1','active','2026-10-20T01:05:18.930285Z')",[firstSeason]);
 const later=['008_season_schedule','009_correct_season1_deadline','010_life_integrity_guards','011_readonly_operations','012_monthly_championship_v2','013_medals_v2','014_product14_contracts','015_complete_public_recovery'];
 if(rewards||rewardsV3)later.push('016_season_rewards','017_rewards_without_draw_deadline','018_private_delivery_and_operations','019_reward_catalog_v2','020_admin_readonly_audit');
 if(rewardsV3)later.push('021_weekend_rewards','022_remote_reward_attempts','023_reward_receipts');
 for(const name of later)await db.exec(await readFile(new URL('../../migrations/'+name+'.sql',import.meta.url),'utf8'));
 return db;
}
