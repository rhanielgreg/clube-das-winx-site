import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {setupWeekend,scalar,operator} from './fixtures/weekend-db.js';
import {createMonthlyTestDb,firstSeason} from './fixtures/monthly-db.js';
import {createRewardWinner} from './fixtures/reward-winner.js';
import {probeRcon} from '../lib/rcon-diagnostics.js';
import {vehicleCandidates,expansionDraft} from '../lib/reward-candidates.js';
import {rewardCatalog} from '../lib/reward-catalog.js';
import {vehicleRecord} from '../lib/reward-operations.js';
import {executeRemoteReward,planHash,publicPlan} from '../lib/remote-rewards.js';
import {nextVehicleStages,expansionMarkup,readinessMarkup,vehicleDeliveryMarkup} from '../public/reward-operations-view.js';
const evidence='SYNTHETIC ONLY: same account and physical vehicle independently checked.';
import {seedVehicle} from './fixtures/vehicle-reward.js';

const record=(db,id,stage,{reference=null,request=randomUUID()}={})=>scalar(db,'select record_vehicle_delivery_v3($1,$2,$3,$4,$5,$6,$7,$8)',['weekend',id,request,stage,operator,true,evidence,reference]);

test('RCON backend diagnostic is read-only, bounded and never verifies delivery or leaks connection credentials',async()=>{
 let calls=0;assert.equal((await probeRcon({env:{},connect:()=>{calls++;}})).state,'not_configured');assert.equal(calls,0);
 const env={WINX_RCON_HOST:'private-host.invalid',WINX_RCON_PORT:'1234',WINX_RCON_PASSWORD:'PRIVATE-SYNTHETIC'};
 const commands=[];const result=await probeRcon({env,accounts:[{id:'one',game_username:'Alice'},{id:'two',game_username:'Bob'}],connect:async()=>({command:async c=>{commands.push(c);return 'Players connected (1):\n-Alice';},close(){commands.push('CLOSE');}})});
 assert.deepEqual(commands,['players','CLOSE']);assert.equal(result.delivery_verified,false);assert.deepEqual(result.participants,[{id:'one',presence:'online'},{id:'two',presence:'offline'}]);
 assert.ok(!JSON.stringify(result).includes(env.WINX_RCON_PASSWORD));assert.ok(!JSON.stringify(result).includes(env.WINX_RCON_HOST));
 const failed=await probeRcon({env,connect:async()=>{throw Error(env.WINX_RCON_PASSWORD);}});assert.equal(failed.state,'unavailable');assert.ok(!JSON.stringify(failed).includes('PRIVATE-SYNTHETIC'));
});
test('five KI5 candidates remain separate from active24: no weights, rarities, invented seven rewards, assets or activation',async()=>{
 assert.deepEqual(vehicleCandidates.map(v=>v.vehicle_script_id),['69fordMustangBoss429','78lamboCountachLP400S','89defender110','88toyotaHiluxXC','92amgeneralM998']);
 const prior=JSON.stringify(rewardCatalog),draft=expansionDraft(rewardCatalog);assert.equal(draft.target,36);assert.equal(draft.active_count,24);assert.equal(draft.conventional_rewards_missing,7);assert.equal(draft.ready,false);
 for(const v of draft.selected_vehicles){assert.equal(v.weight,null);assert.equal(v.rarity,null);assert.equal(v.activation_approved,false);assert.equal(v.independently_verified,false);}
 assert.equal(JSON.stringify(rewardCatalog),prior);assert.match(expansionMarkup(draft),/candidatos não participam/i);
 const sql=await readFile(new URL('../migrations/024_vehicle_delivery_and_participants.sql',import.meta.url),'utf8');for(const v of vehicleCandidates)assert.ok(sql.includes("'"+v.vehicle_script_id+"'"));
});
test('vehicles never reach RCON even with global release enabled; payload does not control script, recipient or operator',async()=>{
 let connected=false;const plan={enabled:true,modality:'weekend',draw_id:randomUUID(),reward:{items:[{kind:'vehicle',script_id:'69fordMustangBoss429',quantity:1}]},recipient:{game_username:'Synthetic User'},attempts:[],delivery_state:'pending'};
 const env={WINX_RCON_HOST:'127.0.0.1',WINX_RCON_PORT:'1234',WINX_RCON_PASSWORD:'SYNTHETIC',WINX_REMOTE_DELIVERY_ENABLED:'true'};
 assert.equal(publicPlan(plan,env).enabled,false);await assert.rejects(executeRemoteReward({rpc:async()=>plan,modality:'weekend',drawId:plan.draw_id,confirmation:planHash(plan),env,connect:()=>{connected=true;}}));assert.equal(connected,false);
 let args;await vehicleRecord({modality:'weekend',draw_id:plan.draw_id,request_id:randomUUID(),confirm_identity:true,evidence,stage:'begin',script_id:'CLIENT-INJECTED',operator_id:randomUUID()}, {user:{id:operator},rpc:async(_,a)=>{args=a;}});
 assert.equal(args.p_operator,operator);assert.ok(!JSON.stringify(args).includes('CLIENT-INJECTED'));assert.equal('script_id'in args,false);
});
test('participant and vehicle records: verified identity, ordered checklist, uncertainty, idempotency, RLS and immutable history',async t=>{
 const {db,account}=await setupWeekend();
 try{
  await t.test('registration is audited once, duplicate identity conflict and username ambiguity rejected',async()=>{
   const args=['76561190000000002','Pending synthetic','Pending User',operator];
   const id=await scalar(db,'select register_reward_account_checked_v3($1,$2,$3,$4)',args);assert.equal(await scalar(db,'select register_reward_account_checked_v3($1,$2,$3,$4)',args),id);
   assert.equal(await scalar(db,'select count(*) from reward_account_events_v3'),1);
   await assert.rejects(scalar(db,'select register_reward_account_checked_v3($1,$2,$3,$4)',[args[0],'Changed',args[2],operator]));
   await assert.rejects(scalar(db,'select register_reward_account_checked_v3($1,$2,$3,$4)',['76561190000000003','Other','pending user',operator]));
   const dto=await scalar(db,'select get_service_reward_operations_v3()');assert.equal(dto.accounts.find(a=>a.id===id).status,'pending');assert.ok(!JSON.stringify(dto).includes('76561190000000002'));assert.ok(!JSON.stringify(dto).includes('account_token'));
  });
  const {id}=await seedVehicle(db,account);
  await t.test('cannot skip generation/key/repairs or record a different physical instance',async()=>{
   await assert.rejects(record(db,id,'received'));const request=randomUUID();await record(db,id,'begin',{request});assert.equal((await record(db,id,'begin',{request})).existing,true);
   await assert.rejects(record(db,id,'begin'));await assert.rejects(record(db,id,'key'));
   await record(db,id,'generated',{reference:'SYNTHETIC INSTANCE A'});await assert.rejects(record(db,id,'generated',{reference:'SYNTHETIC INSTANCE B'}));
   await assert.rejects(record(db,id,'received',{reference:'SYNTHETIC INSTANCE A'}));
   await record(db,id,'key',{reference:'SYNTHETIC INSTANCE A'});await record(db,id,'repairs',{reference:'SYNTHETIC INSTANCE A'});
   assert.equal((await record(db,id,'received',{reference:'SYNTHETIC INSTANCE A'})).state,'received');await assert.rejects(record(db,id,'begin'));
   assert.equal(await scalar(db,'select state from weekend_delivery_v3 where draw_id=$1',[id]),'confirmed_manual');
  });
  await t.test('uncertainty never reopens generation; only locate, key, repairs and explicit reconciliation',async()=>{
   const {id:uncertain}=await seedVehicle(db,account,{window:'2026-12-12T03:00:00Z'});await record(db,uncertain,'begin');await record(db,uncertain,'uncertain');
   await assert.rejects(record(db,uncertain,'generated',{reference:'SYNTHETIC INSTANCE U'}));
   await record(db,uncertain,'located',{reference:'SYNTHETIC INSTANCE U'});await record(db,uncertain,'key',{reference:'SYNTHETIC INSTANCE U'});await record(db,uncertain,'repairs',{reference:'SYNTHETIC INSTANCE U'});
   await assert.rejects(record(db,uncertain,'received',{reference:'SYNTHETIC INSTANCE U'}));assert.equal((await record(db,uncertain,'reconcile_received',{reference:'SYNTHETIC INSTANCE U'})).state,'received');
   assert.equal(await scalar(db,'select count(*) from remote_reward_components_v3'),0);
  });
  await t.test('unknown vehicles, revoked accounts, fake monthly awards and public roles fail closed',async()=>{
   const wrong=await seedVehicle(db,account,{script:'UNAPPROVED-VEHICLE',window:'2026-12-19T03:00:00Z'});await assert.rejects(record(db,wrong.id,'begin'));
   await assert.rejects(scalar(db,'select vehicle_entitlement_v3($1,$2)',['official',randomUUID()]));
   const revoked=await seedVehicle(db,account,{window:'2026-12-26T03:00:00Z'});await db.query("update reward_accounts_v3 set status='revoked' where id=$1",[account]);await assert.rejects(record(db,revoked.id,'begin'));
   for(const role of ['anon','authenticated','service_role']){
    await db.exec('set role '+role);await assert.rejects(db.query('select * from vehicle_deliveries_v3'));await assert.rejects(db.query('update roulette_release_v3 set weekly_enabled=true'));await db.exec('reset role');
   }
   await assert.rejects(db.query('delete from vehicle_delivery_events_v3'));let exported=await scalar(db,'select get_service_recovery_export_v1()');if(typeof exported==='string')exported=JSON.parse(exported);assert.ok(exported.data.vehicle_delivery_events_v3.length>0);
  });
 }finally{await db.close();}
});
test('manual vehicle UI and diagnostic keep honest states and no embedded command capability',()=>{
 assert.deepEqual(nextVehicleStages({state:'uncertain',generated:false}),['located']);assert.deepEqual(nextVehicleStages({state:'received'}),[]);
 assert.match(readinessMarkup({accounts:[]},null),/Não consultada/);assert.match(readinessMarkup({accounts:[]},{checked_at:'2000-01-01',state:'connected'}),/expirada/);
 const markup=vehicleDeliveryMarkup([{id:'fixture',modality:'weekend',reward_snapshot:{name:'Synthetic',items:[{kind:'vehicle'}]}}],{available:true,vehicles:[]});assert.match(markup,/REGISTRAR ETAPA PRESENCIAL/);assert.ok(!markup.includes('addvehicle'));assert.ok(!markup.includes('data-remote-send'));
});
test('monthly manual vehicle audit preserves exact certified life and forfeiture guard',async()=>{
 const db=await createMonthlyTestDb({rewardsV3:true});try{
  await createRewardWinner(db);const e=await scalar(db,'select reward_eligibility_v1($1)',[firstSeason]);assert.equal(e.eligible,true);
  const account=await scalar(db,'select register_reward_account_checked_v3($1,$2,$3,$4)',['76561190000000004','Synthetic monthly','Conta de teste',operator]);
  await db.query('select attest_reward_account_v3($1,$2,$3,$4)',[account,e.account_token,'e'.repeat(64),operator]);
  const reward={id:'SYNTHETIC-MONTHLY-VEHICLE',name:'Synthetic vehicle',delivery_method:'manual_vehicle',items:[{kind:'vehicle',script_id:'89defender110',quantity:1}]};
  await db.query(`insert into season_reward_draws_v1(season_id,life_id,profile_id,world_id,account_token,catalog_version,rarity,reward_id,reward_snapshot,presentation_snapshot,probabilities,certification_snapshot,operator_id,request_id)
  values($1,$2,$3,$4,$5,(select version from reward_catalogs_v1 where active),'epic',$6,$7,'{}','{}','{}',$8,$9)`,[firstSeason,e.life_id,e.profile_id,e.world_id,e.account_token,reward.id,reward,operator,randomUUID()]);
  await db.query('insert into reward_delivery_state_v1(season_id)values($1)',[firstSeason]);await db.query('insert into reward_delivery_components_v1(season_id,component)values($1,0)',[firstSeason]);
  const stage=s=>scalar(db,'select record_vehicle_delivery_v3($1,$2,$3,$4,$5,$6,$7,$8)',['official',firstSeason,randomUUID(),s,operator,true,evidence,s==='begin'?null:'SYNTHETIC MONTHLY INSTANCE']);
  for(const s of ['begin','generated','key','repairs'])await stage(s);
  await db.exec('begin;savepoint before_receipt');assert.equal((await stage('received')).state,'received');await db.exec('rollback to savepoint before_receipt;commit');
  await db.query('update life_identities set alive=false where id=$1',[e.life_id]);await assert.rejects(stage('received'));
  assert.notEqual(await scalar(db,'select state from reward_delivery_state_v1 where season_id=$1',[firstSeason]),'confirmed_manual');
 }finally{await db.close();}
});
