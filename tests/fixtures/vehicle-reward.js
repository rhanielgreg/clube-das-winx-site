// Future vehicle award seeded by the owner only in isolated tests. No production catalog activation.
import {randomUUID} from 'node:crypto';
import {operator} from './weekend-db.js';
export async function seedVehicle(db,account,{script='69fordMustangBoss429',window='2026-12-05T03:00:00Z'}={}){
 const id=randomUUID(),reward={id:'SYNTHETIC-VEHICLE',name:'Synthetic vehicle',delivery_method:'manual_vehicle',server_build:'42.21.0',items:[{kind:'vehicle',quantity:1,script_id:script}]};
 await db.query(`insert into weekend_reward_draws_v3(id,account_id,window_start,window_end,catalog_version,rarity,reward_id,reward_snapshot,recipient_snapshot,probabilities,operator_id,request_id)
 select $1,$2,$3::timestamptz,$3::timestamptz+interval '2 days',(select version from reward_catalogs_v1 where active),'epic',$4,$5,
 jsonb_build_object('account_id',a.id,'game_username',a.game_username,'display_name',a.display_name),'{}',$6,$7 from reward_accounts_v3 a where a.id=$2`,[id,account,window,reward.id,reward,operator,randomUUID()]);
 await db.query('insert into weekend_delivery_v3(draw_id)values($1)',[id]);return {id,reward};
}
