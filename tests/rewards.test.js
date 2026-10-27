import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {drawReward,weightedChoice,validateRewardCatalog,RARITY_WEIGHTS} from '../lib/reward-draw.js';
import {publicRewards,rewardAnnouncement} from '../public/rewards-view.js';
import {rankingResidual} from '../public/kill-breakdown.js';
import {createMonthlyTestDb,firstSeason} from './fixtures/monthly-db.js';
import {createRewardWinner} from './fixtures/reward-winner.js';
import adminRewards from '../lib/admin-rewards.js';
import rewardsApi from '../api/rewards.js';

const operator='f0000000-0000-4000-8000-000000000009',world='f0000000-0000-4000-8000-000000000001';
const item=script_id=>({kind:'item',script_id,quantity:1});
const fixtureCatalog=()=>({version:'fixture-only-v1',rewards:Object.keys(RARITY_WEIGHTS).map((rarity,index)=>({
 id:'fixture-'+rarity,name:'Prêmio de teste '+rarity,rarity,weight:10,verified:true,server_build:'42.21.0',
 evidence_sha256:'a'.repeat(64),delivery_method:'manual_verified',items:rarity==='rare'?[item('Base.Hammer'),item('Base.Axe')]:[item(index===4?'Base.Katana':'Base.Crowbar')]}))});

test('RNG seguro em duas fases: distribuição exata 45/30/20/4/1 e pesos internos',()=>{
 const catalog=fixtureCatalog(),counts=Object.fromEntries(Object.keys(RARITY_WEIGHTS).map(k=>[k,0]));
 for(let ticket=0;ticket<100;ticket++){let call=0;const selected=drawReward(catalog,total=>call++===0?ticket:total-1);counts[selected.rarity]++;assert.ok(selected.reward_id);}
 assert.deepEqual(counts,RARITY_WEIGHTS);
 const rows=[{id:'a',weight:1},{id:'b',weight:3}];assert.equal(weightedChoice(rows,()=>0).id,'a');assert.equal(weightedChoice(rows,()=>1).id,'b');assert.equal(weightedChoice(rows,()=>3).id,'b');
 assert.throws(()=>weightedChoice(rows,()=>4));
});
test('catálogo bloqueia categoria ausente, veículo, marreta épica, raro incompleto e lendária diferente',()=>{
 const catalog=fixtureCatalog();assert.equal(validateRewardCatalog(catalog),catalog);
 for(const mutate of [c=>c.rewards.pop(),c=>c.rewards[0].verified=false,c=>c.rewards[0].items[0].kind='vehicle',
  c=>c.rewards[3].items[0].script_id='Base.Sledgehammer',c=>c.rewards[2].items.pop(),c=>c.rewards[4].items[0].script_id='Base.Axe',c=>c.rewards[0].weight=0]){
  const changed=structuredClone(catalog);mutate(changed);assert.throws(()=>validateRewardCatalog(changed));
 }
});
test('leitura pública não inventa sorteios; residual depende dos três contadores e não subtrai veículos',()=>{
 assert.match(publicRewards({draws:[]}),/Nenhuma premiação oficial/);
 assert.equal(rankingResidual({kills_total:100,kills_firearm:10,kills_melee:40,kills_vehicle:20,life_identity_verified:true}),50);
 assert.equal(rankingResidual({kills_total:100,kills_firearm:10}),null);
 assert.equal(rankingResidual({kills_total:20,kills_firearm:10,kills_melee:40}),null);
 assert.ok(!publicRewards({draws:[{season_name:'<script>',character_name:'x',rarity:'common'}]}).includes('<script>'));
 assert.match(rewardAnnouncement({season_name:'T1',character_name:'Vida A',steam_username:'Conta A',rarity:'rare',reward_name:'Kit'}),/Vida A \(Conta A\)/);
});

const value=async(db,sql,args=[])=>Object.values((await db.query(sql,args)).rows[0])[0];
async function setupWinner(db,options={}){return createRewardWinner(db,{...options,catalog:fixtureCatalog()});}
async function draw(db,winner,{reward='rare',request=randomUUID()}={}){
 return value(db,'select draw_season_reward_v1($1,$2,$3,$4,$5,$6,$7,$8)',[firstSeason,winner.catalog.version,reward,'fixture-'+reward,request,operator,winner.life,'a'.repeat(64)]);
}
async function delivery(db,winner,action,{component=null,request=randomUUID()}={}){
 return value(db,'select record_reward_delivery_v1($1,$2,$3,$4,$5,$6,$7)',[firstSeason,action,request,operator,winner.life,component,'EVIDÊNCIA SINTÉTICA: vida exata conferida e inventário verificado manualmente.']);
}

test('PostgreSQL: premiações imutáveis, idempotência, ACLs, elegibilidade e entrega manual',async t=>{
 const db=await createMonthlyTestDb({rewards:true});
 async function scenario(name,run){await t.test(name,async()=>{await db.exec('begin');try{await run();}finally{await db.exec('rollback');}});}
 try{
  await scenario('ACLs/RLS, export completo e bloqueio de temporada ainda aberta',async()=>{
   assert.equal((await value(db,'select reward_eligibility_v1($1)',[firstSeason])).reason,'season_open');
   assert.equal((await value(db,'select get_public_rewards_v1()')).draws.length,0);
   for(const role of ['anon','authenticated'])for(const fn of ['get_service_rewards_v1()','draw_season_reward_v1(uuid,text,text,text,uuid,uuid,uuid,text)','record_reward_delivery_v1(uuid,text,uuid,uuid,uuid,integer,text)'])
    assert.equal(await value(db,"select has_function_privilege($1,$2,'EXECUTE')",[role,'public.'+fn]),false);
   const backup=JSON.parse(await value(db,'select get_service_recovery_export_v1()'));assert.equal(backup.tables.length,Object.keys(backup.data).length);
   assert.ok(backup.tables.filter(t=>/^reward_|season_reward/.test(t.name)).every(t=>t.rls&&!t.grants.some(g=>['anon','authenticated','service_role','PUBLIC'].includes(g.role))));
  });
  await scenario('clique duplo, abas e timeout retornam o mesmo sorteio; resultado e catálogo imutáveis',async()=>{
   const winner=await setupWinner(db),request=randomUUID();const results=await Promise.all([draw(db,winner,{request}),draw(db,winner)]);
   assert.equal(results.filter(r=>r.existing===false).length,1);assert.equal(await value(db,'select count(*) from season_reward_draws_v1'),1);
   assert.equal((await draw(db,winner,{request,reward:'legendary'})).existing,true);
   assert.equal(await value(db,'select rarity from season_reward_draws_v1'),'rare');
   await assert.rejects(db.query("update season_reward_draws_v1 set rarity='legendary'"));
  });
  await scenario('catálogo usado não pode mudar e público não revela operador/conta privada',async()=>{
   const winner=await setupWinner(db);await draw(db,winner);
   await assert.rejects(db.query("update reward_catalogs_v1 set definition=jsonb_set(definition,'{version}','\"changed\"')"));
  });
  await scenario('morte antes do sorteio bloqueia; empate e Apocalipse nunca recebem prêmio',async()=>{
   const winner=await setupWinner(db);await db.query('update life_identities set alive=false where id=$1',[winner.life]);
   assert.equal((await value(db,'select reward_eligibility_v1($1)',[firstSeason])).reason,'forfeited');await assert.rejects(draw(db,winner));
  });
  for(const outcome of ['technical_tie','apocalypse','pending_certification'])await scenario('resultado '+outcome+' não permite sorteio',async()=>{
   const winner=await setupWinner(db);await db.query('update season_cycles_v2 set certification=$1,winner_profile_id=null where season_id=$2',[outcome,firstSeason]);
   assert.equal((await value(db,'select reward_eligibility_v1($1)',[firstSeason])).eligible,false);await assert.rejects(draw(db,winner));
  });
  await scenario('personagem offline/antigo, origem incerta e vida incorreta não autorizam efeitos',async()=>{
   const winner=await setupWinner(db);await draw(db,winner);assert.equal((await delivery(db,winner,'offline')).state,'awaiting_online');
   await db.query('update dashboard_rollout_state set life_enabled=false');
   assert.equal((await value(db,'select reward_eligibility_v1($1)',[firstSeason])).reason,'cohort_inactive');
   await assert.rejects(delivery(db,winner,'begin_manual'));
  });
  await scenario('entrega não aceita a vida sucessora nem outra conta',async()=>{
   const winner=await setupWinner(db);await draw(db,winner);
   await assert.rejects(delivery(db,{...winner,life:randomUUID()},'begin_manual'));
  });
  await scenario('sobrevivência defasada não permite sortear',async()=>{
   const winner=await setupWinner(db,{at:new Date(Date.now()-3600000).toISOString()});
   assert.equal((await value(db,'select reward_eligibility_v1($1)',[firstSeason])).reason,'stale_survival');await assert.rejects(draw(db,winner));
  });
  await scenario('pacote parcial, incerteza e reconciliação impedem reenvio cego',async()=>{
   const winner=await setupWinner(db);await draw(db,winner);const request=randomUUID();
   assert.equal((await delivery(db,winner,'begin_manual',{request})).state,'delivering');
   assert.equal((await delivery(db,winner,'begin_manual',{request})).existing,true);
   assert.equal((await delivery(db,winner,'confirm_component',{component:0})).state,'partial');
   assert.equal((await delivery(db,winner,'uncertain')).state,'uncertain');
   await assert.rejects(delivery(db,winner,'begin_manual'));
  });
  await scenario('confirmação individual é manual e morte cancela o material sem apagar o sorteio',async()=>{
   const winner=await setupWinner(db);await draw(db,winner);await delivery(db,winner,'begin_manual');
   await delivery(db,winner,'confirm_component',{component:0});
   assert.equal((await delivery(db,winner,'confirm_component',{component:1})).state,'confirmed_manual');
   const publicResult=await value(db,'select get_public_rewards_v1()');assert.equal(publicResult.draws[0].delivery_state,'confirmed_manual');
   assert.ok(!JSON.stringify(publicResult).includes('account_token'));assert.ok(!JSON.stringify(publicResult).includes(operator));
  });
  await scenario('reconciliação de componente nunca permite repetir o já confirmado',async()=>{
   const winner=await setupWinner(db);await draw(db,winner);await delivery(db,winner,'begin_manual');
   await delivery(db,winner,'confirm_component',{component:0});await delivery(db,winner,'sent');
   assert.equal((await delivery(db,winner,'not_delivered',{component:1})).state,'partial');
   await assert.rejects(delivery(db,winner,'not_delivered',{component:0}));
  });
  await scenario('F5 consulta registro, nomes históricos congelados e versão de catálogo preservada',async()=>{
   const winner=await setupWinner(db);await draw(db,winner);
   const before=await value(db,'select get_public_rewards_v1()');
   await db.query("update game_characters set public_name='Novo rótulo' where id=$1",[winner.profile]);
   const after=await value(db,'select get_public_rewards_v1()');assert.deepEqual(after,before);
   const admin=await value(db,'select get_service_rewards_v1()');assert.equal(admin.seasons[0].draw.reward_snapshot.items.length,2);
   assert.equal(admin.seasons[0].draw.certification_snapshot.official_result.certification,'champion');
  });
  await scenario('morte depois do sorteio cancela sem transferir para nova vida',async()=>{
   const winner=await setupWinner(db);await draw(db,winner);await db.query('update life_identities set alive=false where id=$1',[winner.life]);
   assert.equal(await value(db,'select state from reward_delivery_state_v1'),'forfeited');assert.equal(await value(db,'select count(*) from season_reward_draws_v1'),1);
   assert.equal((await draw(db,winner)).existing,true);await assert.rejects(delivery(db,winner,'begin_manual'));
  });
 }finally{await db.close();}
});

test('APIs: sem autorização não há RPC privilegiada; público responde somente leitura',async t=>{
 const keys=['SUPABASE_URL','SUPABASE_PUBLISHABLE_KEY','ADMIN_EMAIL'],prior=Object.fromEntries(keys.map(k=>[k,process.env[k]]));
 const response=()=>({setHeader(){},status(code){this.code=code;return this;},json(body){this.body=body;return this;}});
 try{Object.assign(process.env,{SUPABASE_URL:'https://fixture.invalid',SUPABASE_PUBLISHABLE_KEY:'fixture',ADMIN_EMAIL:'admin@fixture.invalid'});let privileged=0;
  t.mock.method(globalThis,'fetch',async url=>{if(url.endsWith('/auth/v1/user'))return Response.json({id:operator,email:'wrong@fixture.invalid'});privileged++;throw Error('unexpected RPC');});
  for(const headers of [{},{authorization:'Bearer fixture'}]){const res=response();await adminRewards({method:'POST',headers,body:{}},res);assert.equal(res.code,403);}
  const routed=response();await rewardsApi({method:'GET',headers:{},query:{view:'admin'}},routed);assert.equal(routed.code,403);
  assert.equal(privileged,0);const res=response();await rewardsApi({method:'POST'},res);assert.equal(res.code,405);
 }finally{for(const k of keys)prior[k]===undefined?delete process.env[k]:process.env[k]=prior[k];}
});

test('API administrativa recupera resultado persistido sem sortear novamente e sanitiza leitura pública',async t=>{
 const keys=['SUPABASE_URL','SUPABASE_PUBLISHABLE_KEY','SUPABASE_SERVICE_ROLE_KEY','ADMIN_EMAIL'];const prior=Object.fromEntries(keys.map(k=>[k,process.env[k]]));
 const res=()=>({setHeader(){},status(code){this.code=code;return this;},json(body){this.body=body;return this;}});
 try{Object.assign(process.env,{SUPABASE_URL:'https://fixture.invalid',SUPABASE_PUBLISHABLE_KEY:'fixture',SUPABASE_SERVICE_ROLE_KEY:'sb_secret_fixture',ADMIN_EMAIL:'admin@fixture.invalid'});let writes=0;
  t.mock.method(globalThis,'fetch',async url=>{
   if(url.endsWith('/auth/v1/user'))return Response.json({id:operator,email:'admin@fixture.invalid'});
   if(url.endsWith('get_service_rewards_v1'))return Response.json({seasons:[{season_id:firstSeason,draw:{reward_id:'persisted'}}]});
   if(url.endsWith('get_public_rewards_v1'))return Response.json({contract:'season-rewards-v1',draws:[{season_name:'T1',character_name:'Vida',reward_name:'Katana',rarity:'legendary',account_token:'PRIVATE',operator_id:operator}]});
   writes++;throw Error('unexpected write');
  });
  const existing=res();await adminRewards({method:'POST',headers:{authorization:'Bearer fixture'},body:{action:'draw',season_id:firstSeason,life_id:world,request_id:randomUUID()}},existing);
  assert.equal(existing.code,200);assert.equal(existing.body.existing,true);assert.equal(writes,0);
  const publicResponse=res();await rewardsApi({method:'GET'},publicResponse);assert.equal(publicResponse.code,200);assert.ok(!JSON.stringify(publicResponse.body).includes('PRIVATE'));assert.ok(!JSON.stringify(publicResponse.body).includes(operator));
 }finally{for(const k of keys)prior[k]===undefined?delete process.env[k]:process.env[k]=prior[k];}
});
