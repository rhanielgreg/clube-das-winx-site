import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {setupWeekend,scalar,weeklyDraw,saturday,operator} from './fixtures/weekend-db.js';
import {weekendAction} from '../lib/weekend-rewards.js';
import {rouletteMarkup} from '../public/roulette-machine.js';
import {rewardRecords,filterRewardHistory} from '../public/reward-history-v3.js';
import {rewardCatalog} from '../lib/reward-catalog.js';
import {createRewardWinner} from './fixtures/reward-winner.js';

test('Roleta3 PostgreSQL: private accounts, boundaries, account tickets, release gates and snapshots',async t=>{
 const {db,account}=await setupWeekend();
 const rejects=async task=>{await db.exec('savepoint expected_failure');try{await assert.rejects(task);}finally{await db.exec('rollback to expected_failure');}};
 // setupWeekend rehearses a future T2. Restore a current-clock T1 ONLY inside
 // these rolled-back synthetic scenarios before using the existing life fixture.
 const lifeFixtureClock=()=>db.exec("select set_config('winx.monthly.operation','reconcile',false);update ranking_seasons set status='closed',ended_at=scheduled_end_at where status='active';update season_cycles_v2 set closed_at=ends_at,certification='pending_certification' where season_number=2;update ranking_seasons set status='active',ended_at=null where id=(select season_id from season_cycles_v2 where season_number=1);update season_cycles_v2 set closed_at=null,certification='open' where season_number=1;select set_config('winx.monthly.operation','',false);");
 const scenario=(name,run)=>t.test(name,async()=>{await db.exec('begin');try{await run();}finally{await db.exec('rollback');}});
 try{
  await scenario('half-open Brasília weekend, UTC conversion, Monday excluded',async()=>{
   for(const [at,open] of [['2026-11-07T02:59:59.999999Z',false],[saturday,true],['2026-11-09T02:59:59.999999Z',true],['2026-11-09T03:00:00Z',false]])
    assert.equal((await scalar(db,'select weekend_window_v3($1)',[at])).open,open);
   const w=await scalar(db,'select weekend_window_v3($1)',[saturday]);assert.equal(Date.parse(w.starts_at),Date.parse(saturday));assert.equal(Date.parse(w.ends_at),Date.parse('2026-11-09T03:00:00Z'));
   await rejects(()=>weeklyDraw(db,account,{at:'2026-11-09T03:00:00Z'}));
   await rejects(()=>weeklyDraw(db,account,{window:'2026-11-14T03:00:00Z'}));
  });
  await scenario('every launch proof is mandatory, including actual calendar rows and exact approved36',async()=>{
   assert.equal((await scalar(db,'select weekend_gate_v3($1)',[saturday])).enabled,true);
   for(const field of ['weekly_enabled','remote_enabled','rollover_evidence','rcon_evidence','activation_approval','catalog_approval','approved_catalog']){
    await db.exec('savepoint gate');await db.exec(`update roulette_release_v3 set ${field}=${field.endsWith('enabled')?'false':'null'}`);
    await rejects(()=>weeklyDraw(db,account));await db.exec('rollback to gate');
   }
   assert.equal((await scalar(db,"select weekend_gate_v3('2026-10-31T12:00:00Z')")).enabled,false);
  });
  await scenario('pending/revoked/unknown cannot draw; registration does not verify or rebind account',async()=>{
   await db.query("update reward_accounts_v3 set status='revoked' where id=$1",[account]);await rejects(()=>weeklyDraw(db,account));
   const again=await scalar(db,'select register_reward_account_v3($1,$2,$3)',['76561190000000001','Other name','Other user']);assert.equal(again,account);
   assert.equal(await scalar(db,'select display_name from reward_accounts_v3'),'Synthetic account');
   await rejects(()=>db.query("update reward_accounts_v3 set game_username='Other'"));
   await rejects(()=>weeklyDraw(db,randomUUID()));
  });
  await scenario('double click, new request, retry after timeout, changed character or selected item recover exactly once',async()=>{
   const request=randomUUID(),first=await weeklyDraw(db,account,{request});assert.equal(first.existing,false);
   for(const id of [request,randomUUID()])assert.equal((await weeklyDraw(db,account,{request:id,reward:'katana',rarity:'legendary'})).existing,true);
   assert.equal(await scalar(db,'select count(*) from weekend_reward_draws_v3'),1);
   assert.equal(await scalar(db,'select count(*) from weekend_reward_events_v3'),1);
   assert.equal(first.draw.recipient_snapshot.display_name,'Synthetic account');
   assert.equal('steam_id' in first.draw.recipient_snapshot,false);assert.equal('life_id' in first.draw,false);
   const later=await weeklyDraw(db,account,{at:'2026-11-09T12:00:00Z'});assert.equal(later.existing,true);assert.equal(later.draw.id,first.draw.id);
   const next=await weeklyDraw(db,account,{at:'2026-11-14T03:00:00Z',window:'2026-11-14T03:00:00Z'});assert.notEqual(next.draw.id,first.draw.id);
   await rejects(()=>db.query("update weekend_reward_draws_v3 set reward_id='katana'"));
   await rejects(()=>db.query("delete from weekend_reward_events_v3"));
   await rejects(()=>db.query("update reward_catalogs_v1 set definition=jsonb_set(definition,'{rewards,0,name}','\"changed\"') where active"));
  });
  await scenario('delivery claims serialize and uncertain/partial components cannot be resent',async()=>{
   const draw=(await weeklyDraw(db,account)).draw,request=randomUUID();
   const plan=await scalar(db,'select get_remote_reward_plan_v3($1,$2)',['weekend',draw.id]);assert.equal(plan.enabled,true);
   await scalar(db,'select claim_remote_reward_v3($1,$2,$3,$4)',['weekend',draw.id,request,operator]);
   await rejects(()=>db.query('select claim_remote_reward_v3($1,$2,$3,$4)',['weekend',draw.id,randomUUID(),operator]));
   await db.query('select finish_remote_component_v3($1,$2,$3,$4,$5,$6,$7,$8)',['weekend',draw.id,request,0,'sent_unconfirmed','d'.repeat(64),20,operator]);
   assert.equal(await scalar(db,'select state from weekend_delivery_v3'),'partial');
   await db.query('select finish_remote_component_v3($1,$2,$3,$4,$5,$6,$7,$8)',['weekend',draw.id,request,1,'uncertain','d'.repeat(64),0,operator]);
   assert.equal((await scalar(db,'select get_remote_reward_plan_v3($1,$2)',['weekend',draw.id])).enabled,false);
   await rejects(()=>db.query('select finish_remote_component_v3($1,$2,$3,$4,$5,$6,$7,$8)',['weekend',draw.id,request,0,'sent_unconfirmed','d'.repeat(64),20,operator]));
  });
  await scenario('sanitized replies and manual receipts are atomic, private, idempotent and never enable resending',async()=>{
   const draw=(await weeklyDraw(db,account)).draw,attempt=randomUUID();
   await scalar(db,'select claim_remote_reward_v3($1,$2,$3,$4)',['weekend',draw.id,attempt,operator]);
   const receiptArgs=[draw.id,0,randomUUID(),operator,account,true,'SYNTHETIC INDEPENDENT INVENTORY RECEIPT: exact Steam account and component checked.'];
   await rejects(()=>db.query('select record_weekend_receipt_v3($1,$2,$3,$4,$5,$6,$7)',receiptArgs));
   for(const component of [0,1])await db.query('select finish_remote_reply_v3($1,$2,$3,$4,$5,$6,$7,$8,$9)',
    ['weekend',draw.id,attempt,component,'uncertain','a'.repeat(64),16,operator,'Synthetic redacted response']);
   assert.equal((await scalar(db,'select weekend_draw_dto_v3($1)',[draw.id])).components[0].response,'Synthetic redacted response');
   await rejects(()=>db.query('select record_weekend_receipt_v3($1,$2,$3,$4,$5,$6,$7)',[...receiptArgs.slice(0,4),randomUUID(),true,receiptArgs[6]]));
   assert.equal((await scalar(db,'select record_weekend_receipt_v3($1,$2,$3,$4,$5,$6,$7)',receiptArgs)).state,'partial');
   assert.equal((await scalar(db,'select record_weekend_receipt_v3($1,$2,$3,$4,$5,$6,$7)',receiptArgs)).existing,true);
   assert.equal((await scalar(db,'select record_weekend_receipt_v3($1,$2,$3,$4,$5,$6,$7)',[draw.id,1,randomUUID(),operator,account,true,receiptArgs[6]])).state,'confirmed_manual');
   assert.equal((await scalar(db,'select weekend_draw_dto_v3($1)',[draw.id])).receipts.length,2);
   await rejects(()=>db.query('select claim_remote_reward_v3($1,$2,$3,$4)',['weekend',draw.id,randomUUID(),operator]));
   await rejects(()=>db.query('delete from weekend_reward_receipts_v3'));
  });
  await scenario('a real synthetic life death leaves the account prize pending and recoverable',async()=>{
   const first=await weeklyDraw(db,account);await lifeFixtureClock();const life=await createRewardWinner(db,{catalog:(await scalar(db,'select definition from reward_catalogs_v1 where active'))});
   await db.query('update life_identities set alive=false where id=$1',[life.life]);
   const recovered=await weeklyDraw(db,account);assert.equal(recovered.draw.id,first.draw.id);assert.equal(recovered.draw.delivery_state,'pending');
   assert.equal(await scalar(db,'select count(*) from weekend_reward_draws_v3'),1);
  });
  await scenario('monthly remote remains blocked without exact online life proof even when global remote release is configured',async()=>{
   await lifeFixtureClock();const winner=await createRewardWinner(db,{catalog:(await scalar(db,'select definition from reward_catalogs_v1 where active'))});
   await db.query('select draw_season_reward_v1($1,$2,$3,$4,$5,$6,$7,$8)',[(await scalar(db,'select season_id from season_cycles_v2 where season_number=1')),winner.catalog.version,'rare','workshop-kit',randomUUID(),operator,winner.life,'a'.repeat(64)]);
   const season=await scalar(db,'select season_id from season_cycles_v2 where season_number=1');
   assert.equal((await scalar(db,'select get_remote_reward_plan_v3($1,$2)',['official',season])).enabled,false);
  });
  await scenario('anonymous and authenticated cannot access registry, history, claims, clock or release flags',async()=>{
   for(const role of ['anon','authenticated','service_role']){
    assert.equal(await scalar(db,"select has_table_privilege($1,'public.roulette_release_v3','UPDATE')",[role]),false);
    assert.equal(await scalar(db,"select has_function_privilege($1,'public.draw_weekend_at_v3(uuid,timestamptz,text,text,text,uuid,uuid,timestamptz)','EXECUTE')",[role]),false);
    assert.equal(await scalar(db,"select has_function_privilege($1,'public.attest_reward_account_v3(uuid,text,text,uuid)','EXECUTE')",[role]),false);
    for(const seq of ['weekend_reward_events_v3_id_seq','remote_reward_events_v3_id_seq'])assert.equal(await scalar(db,"select has_sequence_privilege($1,$2,'USAGE,SELECT,UPDATE')",[role,'public.'+seq]),false);
   }
   for(const role of ['anon','authenticated'])for(const fn of ['get_service_weekend_v3(uuid)','claim_remote_reward_v3(text,uuid,uuid,uuid)'])assert.equal(await scalar(db,"select has_function_privilege($1,$2,'EXECUTE')",[role,'public.'+fn]),false);
   assert.equal((await scalar(db,'select get_public_rewards_v1()')).draws.length,0);
  });
 }finally{await db.close();}
});

test('Roleta3 API: client cannot choose reward or bypass launch gates; preexisting result never uses RNG',async()=>{
 let writes=0;
 const user={id:operator},body={action:'weekly_draw',account_id:operator,request_id:randomUUID(),window_start:saturday,rarity:'legendary',reward_id:'katana'};
 await assert.rejects(weekendAction(body,{user,rpc:async()=>({gate:{enabled:false},participants:[]})}));
 const result=await weekendAction(body,{user,rpc:async name=>{if(name==='get_service_weekend_v3')return {draws:[{id:'persisted',account_id:operator,window_start:saturday}]};writes++;throw Error();}});
 assert.equal(result.existing,true);assert.equal(writes,0);
 let registered;
 await weekendAction({action:'weekly_register',steam_id:'76561190000000001',display_name:'Synthetic',game_username:'Synthetic',verified:true},{user,rpc:async(name,args)=>{registered=args;}});
 assert.equal('verified' in registered,false);
});

test('Roleta3 UI: operational modes have no demonstration, RNG, graffiti, degrees or fixed showcase',()=>{
 const html=rouletteMarkup({catalog:rewardCatalog,weekly:{participants:[],gate:{enabled:false,reasons:['catalog36_unapproved']}}});
 for(const forbidden of ['data-demo-spin','data-demo-rarity','Demonstração','SOBREVIVER','14,4°','3,6°','6 de 24','Sobre a imagem'])assert.ok(!html.includes(forbidden),forbidden);
 assert.match(html,/Sorteio de fim de semana/);assert.match(html,/SORTEIO SEMANAL BLOQUEADO/);assert.match(html,/ÉPICA <b>4%/);assert.match(html,/LENDÁRIA <b>1%/);
 assert.match(html,/Nenhum prêmio selecionado/);assert.match(html,/The Indie Stone/);
 const records=rewardRecords([],[{id:'one',rarity:'common',drawn_at:'2026-11-08T02:00:00Z',window_start:saturday,recipient_snapshot:{display_name:'<script>Ana'},reward_snapshot:{name:'Martelo'},delivery_state:'pending'}]);
 assert.equal(filterRewardHistory(records,{participant:'Ana',from:'2026-11-07',to:'2026-11-07'}).length,1);
 assert.equal(filterRewardHistory(records,{modality:'official'}).length,0);
});
