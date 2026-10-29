import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import adminRewards from '../lib/admin-rewards.js';
import {weekendAction} from '../lib/weekend-rewards.js';
import {synthetic36,operator,saturday} from './fixtures/weekend-db.js';
const response=()=>({setHeader(){},status(code){this.code=code;return this;},json(body){this.body=body;return this;}});
test('weekly/remote HTTP operations preserve ADMIN_EMAIL, reject unauthorized requests before RPC and degrade missing schema safely',async t=>{
 const names=['SUPABASE_URL','SUPABASE_PUBLISHABLE_KEY','SUPABASE_SERVICE_ROLE_KEY','ADMIN_EMAIL'],prior=Object.fromEntries(names.map(k=>[k,process.env[k]]));
 try{
  Object.assign(process.env,{SUPABASE_URL:'https://fixture.invalid',SUPABASE_PUBLISHABLE_KEY:'fixture',SUPABASE_SERVICE_ROLE_KEY:'sb_secret_fixture',ADMIN_EMAIL:'admin@fixture.invalid'});
  let rpcCalls=0,authorized=false;
  t.mock.method(globalThis,'fetch',async url=>{
   if(url.endsWith('/auth/v1/user'))return Response.json({id:operator,email:authorized?'admin@fixture.invalid':'other@fixture.invalid'});
   rpcCalls++;
   if(url.endsWith('get_service_rewards_v1'))return Response.json({contract:'season-rewards-v1',seasons:[],catalog:{version:'unchanged-24'}});
   if(url.endsWith('get_service_weekend_v3'))return Response.json({message:'SCHEMA MISSING PRIVATE DETAIL'},{status:404});
   throw Error('Unexpected mutation');
  });
  for(const action of ['weekly_register','weekly_draw','weekly_receipt','remote_prepare','remote_send','vehicle_record']){
   const res=response();await adminRewards({method:'POST',headers:{authorization:'Bearer fixture'},body:{action,command:'quit'}},res);assert.equal(res.code,403);
  }
  const diagnostic=response();await adminRewards({method:'GET',headers:{authorization:'Bearer fixture'},query:{probe:'rcon'}},diagnostic);assert.equal(diagnostic.code,403);
  assert.equal(rpcCalls,0);authorized=true;
  const get=response();await adminRewards({method:'GET',headers:{authorization:'Bearer fixture'},query:{}},get);
  assert.equal(get.code,200);assert.equal(get.body.contract,'season-rewards-v1');assert.equal(get.body.weekly.available,false);
  assert.equal(get.body.weekly.gate.enabled,false);assert.ok(!JSON.stringify(get.body).includes('PRIVATE DETAIL'));
 }finally{for(const key of names)prior[key]===undefined?delete process.env[key]:process.env[key]=prior[key];}
});
test('weekly HTTP payload cannot select reward, quantity, rarity or operator: backend uses its approved catalog and authenticated actor',async()=>{
 let persisted;
 const catalog={...synthetic36(),active:true};
 const rpc=async(name,args)=>{
  if(name==='get_service_weekend_v3')return {gate:{enabled:true},window:{open:true},participants:[{id:operator,verified:true}],draws:[]};
  if(name==='get_service_rewards_v1')return {catalog};
  if(name==='draw_weekend_reward_v3'){persisted=args;return {persisted:true};}throw Error('Unexpected RPC');
 };
 await weekendAction({action:'weekly_draw',account_id:operator,window_start:saturday,request_id:randomUUID(),reward_id:'CLIENT-INJECTED',rarity:'CLIENT-INJECTED',quantity:99999,operator_id:randomUUID()}, {rpc,user:{id:operator}});
 assert.equal(persisted.p_operator,operator);assert.ok(catalog.rewards.some(r=>r.id===persisted.p_reward&&r.rarity===persisted.p_rarity));
 assert.equal('quantity' in persisted,false);assert.ok(!JSON.stringify(persisted).includes('CLIENT-INJECTED'));
});
