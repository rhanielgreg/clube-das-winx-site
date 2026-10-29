import {verifyAdminToken,callServiceRpc} from '../api/admin.js';
import {UUID} from '../public/contracts.js';
import {drawReward,validateRewardCatalog} from './reward-draw.js';
import {weekendDashboard,weekendAction} from './weekend-rewards.js';
import {rconConfig} from './rcon-client.js';
const actions=['begin_manual','offline','block','sent','uncertain','confirm_component','not_delivered'];
export default async function handler(req,res){
 res.setHeader('cache-control','no-store');
 if(!['GET','POST'].includes(req.method)){res.setHeader('allow','GET, POST');return res.status(405).json({error:'Método não permitido.'});}
 const token=String(req.headers.authorization||'').startsWith('Bearer ')?req.headers.authorization.slice(7).trim():null;
 const auth=await verifyAdminToken(token);
 if(!auth.valid||!UUID.test(auth.user?.id||''))return res.status(403).json({error:'Acesso administrativo não autorizado.'});
 try{
  if(req.method==='GET'){
   const drawId=req.query?.weekend_draw;if(drawId!=null&&!UUID.test(drawId))return res.status(400).json({error:'Registro inválido.'});
   const [dashboard,weekly]=await Promise.all([callServiceRpc('get_service_rewards_v1'),weekendDashboard(callServiceRpc,drawId)]);
   return res.status(200).json({...dashboard,weekly,remote:{configured:process.env.WINX_REMOTE_DELIVERY_ENABLED==='true'&&Boolean(rconConfig())}});
  }
  const p=req.body||{};
  if(['weekly_draw','weekly_register','weekly_receipt','remote_prepare','remote_send'].includes(p.action)){
   const result=await weekendAction(p,{rpc:callServiceRpc,user:auth.user});
   return res.status(200).json(result);
  }
  if(!UUID.test(p.season_id||'')||!UUID.test(p.request_id||'')||!UUID.test(p.life_id||'')||typeof p.action!=='string')return res.status(400).json({error:'Operação específica inválida.'});
  if(p.action==='draw'){
   const dashboard=await callServiceRpc('get_service_rewards_v1');
   const season=dashboard.seasons?.find(s=>s.season_id===p.season_id);
   // A refreshed page or a timeout returns the persisted draw before using RNG.
   if(season?.draw)return res.status(200).json({persisted:true,existing:true,dashboard});
   if(!season?.eligibility?.eligible||season.eligibility.life_id!==p.life_id||p.confirm_identity!==true)return res.status(409).json({error:'Campeão e vida exigem comprovação atual.'});
   const catalog=validateRewardCatalog(dashboard.catalog);
   if(catalog.active!==true)return res.status(409).json({error:'Catálogo ainda não ativado.'});
   const choice=drawReward(catalog);
   await callServiceRpc('draw_season_reward_v1',{p_season_id:p.season_id,p_catalog_version:choice.catalog_version,p_rarity:choice.rarity,p_reward_id:choice.reward_id,
    p_request_id:p.request_id,p_operator_id:auth.user.id,p_life_id:p.life_id,p_source_sha256:season.eligibility.source_sha256});
  }else{
   if(!actions.includes(p.action)||typeof p.evidence!=='string'||p.evidence.trim().length<20||p.evidence.length>2000||p.confirm_identity!==true
    ||p.component!=null&&(!Number.isInteger(p.component)||p.component<0||p.component>1))return res.status(400).json({error:'Confirme a mesma vida e registre evidência de 20 a 2.000 caracteres.'});
   await callServiceRpc('record_reward_delivery_v1',{p_season_id:p.season_id,p_action:p.action,p_request_id:p.request_id,p_operator_id:auth.user.id,
    p_life_id:p.life_id,p_component:p.component??null,p_evidence:p.evidence.trim()});
  }
  return res.status(200).json({persisted:true,dashboard:await callServiceRpc('get_service_rewards_v1')});
 }catch{return res.status(409).json({error:'Operação não confirmada nesta resposta. Atualize as premiações para consultar o registro persistido antes de tentar novamente.'});}
}
