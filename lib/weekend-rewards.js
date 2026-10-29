import {UUID} from '../public/contracts.js';
import {drawReward,validateRewardCatalog} from './reward-draw.js';
import {publicPlan,executeRemoteReward} from './remote-rewards.js';
export const unavailableWeekend=()=>({contract:'weekend-rewards-v3',available:false,gate:{enabled:false,reasons:['schema_unavailable']},participants:[],draws:[]});
export async function weekendDashboard(rpc,drawId=null){try{
 const data=await rpc('get_service_weekend_v3',drawId?{p_draw:drawId}:{});if(data?.contract!=='weekend-rewards-v3')throw Error();return data;
}catch{return unavailableWeekend();}}
export async function weekendAction(body,{rpc,user,env=process.env}){
 const p=body;
 if(p.action==='weekly_receipt'){
  if(!UUID.test(p.draw_id||'')||!UUID.test(p.account_id||'')||!UUID.test(p.request_id||'')||p.confirm_account!==true
   ||!Number.isInteger(p.component)||p.component<0||p.component>1||typeof p.evidence!=='string'||p.evidence.trim().length<20||p.evidence.length>2000)throw Error('Specific manual receipt evidence required');
  return rpc('record_weekend_receipt_v3',{p_draw:p.draw_id,p_component:p.component,p_request:p.request_id,p_operator:user.id,
   p_account:p.account_id,p_confirm_account:true,p_evidence:p.evidence.trim()});
 }
 if(p.action==='weekly_register'){
  if(!/^7656119[0-9]{10}$/.test(p.steam_id||'')||typeof p.display_name!=='string'||p.display_name.trim().length<1||p.display_name.length>80
   ||/[\x00-\x1f\x7f]/.test(p.display_name)||!/^[A-Za-z0-9_ .-]{1,64}$/.test(p.game_username||''))throw Error('Invalid registration');
  await rpc('register_reward_account_v3',{p_steam_id:p.steam_id,p_name:p.display_name.trim(),p_username:p.game_username});return {registered:true,pending_verification:true};
 }
 if(p.action==='weekly_draw'){
  if(!UUID.test(p.account_id||'')||!UUID.test(p.request_id||'')||typeof p.window_start!=='string'||!Number.isFinite(Date.parse(p.window_start)))throw Error('Invalid ticket');
  const weekly=await rpc('get_service_weekend_v3');
  const existing=weekly.draws?.find(d=>d.account_id===p.account_id&&Date.parse(d.window_start)===Date.parse(p.window_start));
  if(existing)return {persisted:true,existing:true,draw:existing};
  if(weekly.gate?.enabled!==true||weekly.window?.open!==true||!weekly.participants?.some(a=>a.id===p.account_id&&a.verified===true))throw Error('Weekly disabled');
  const monthly=await rpc('get_service_rewards_v1'),catalog=validateRewardCatalog(monthly.catalog);
  if(catalog.active!==true||catalog.rewards.length!==36)throw Error('Approved catalog36 required');
  const choice=drawReward(catalog);
  return rpc('draw_weekend_reward_v3',{p_account:p.account_id,p_window:p.window_start,p_catalog:choice.catalog_version,
   p_rarity:choice.rarity,p_reward:choice.reward_id,p_request:p.request_id,p_operator:user.id});
 }
 if(['remote_prepare','remote_send'].includes(p.action)){
  if(!['official','weekend'].includes(p.modality)||!UUID.test(p.draw_id||''))throw Error('Invalid persisted reward');
  if(p.action==='remote_prepare')return {plan:publicPlan(await rpc('get_remote_reward_plan_v3',{p_modality:p.modality,p_draw:p.draw_id}),env)};
  if(!UUID.test(p.request_id||'')||p.confirm_delivery!==true||!/^[a-f0-9]{64}$/.test(p.plan_hash||''))throw Error('Explicit component confirmation required');
  return executeRemoteReward({rpc,modality:p.modality,drawId:p.draw_id,requestId:p.request_id,operatorId:user.id,confirmation:p.plan_hash,env});
 }
 throw Error('Unknown weekly operation');
}
