import {UUID} from '../public/contracts.js';
export async function rewardOperations(rpc,drawId=null){try{
 const data=await rpc('get_service_reward_operations_v3',drawId?{p_draw:drawId}:{});
 if(data?.contract!=='reward-operations-v3')throw Error();return data;
}catch{return {contract:'reward-operations-v3',available:false,accounts:[],vehicles:[]};}}
export async function vehicleRecord(body,{rpc,user}){
 if(!['weekend','official'].includes(body.modality)||!UUID.test(body.draw_id||'')||!UUID.test(body.request_id||'')
  ||body.confirm_identity!==true||typeof body.evidence!=='string'||body.evidence.trim().length<20||body.evidence.length>2000
  ||!['begin','generated','key','repairs','received','uncertain','located','reconcile_received'].includes(body.stage))throw Error('Explicit vehicle evidence required');
 return rpc('record_vehicle_delivery_v3',{p_modality:body.modality,p_draw:body.draw_id,p_request:body.request_id,
  p_stage:body.stage,p_operator:user.id,p_confirm_identity:true,p_evidence:body.evidence.trim(),
  p_reference:typeof body.vehicle_reference==='string'?body.vehicle_reference.trim():null});
}
