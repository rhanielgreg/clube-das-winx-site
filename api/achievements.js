import { UUID } from '../public/contracts.js';
import { callPublicRpc } from '../lib/supabase-public.js';
import { resolveDashboardContract } from '../lib/championship-contract.js';
import { validatedLifeResult } from '../lib/life-public-contract.js';
import { visibleAchievements } from '../public/achievement-view.js';
import { achievementCatalog } from '../public/achievements-catalog.js';

// Contextual read API only. It does not restore a public dossier or award medals.
export default async function handler(req,res) {
  res.setHeader('cache-control','no-store');
  const send=(status,body)=>res.status(status).json(body);
  if(req.method!=='GET') { res.setHeader('allow','GET'); return send(405,{error:'Método não permitido.'}); }
  const id=req.query?.id;
  if(typeof id!=='string'||!UUID.test(id)) return send(400,{error:'Vida inválida.'});
  const contract=await resolveDashboardContract();
  if(contract.product14?.medals_enabled){
    try{
      const {data}=await callPublicRpc('get_public_medals_v2',{p_profile_id:id});
      if(data?.catalog_count!==28||data.catalog_version!=='medals-v2'||!Array.isArray(data.catalog)||data.catalog.length!==28)throw Error();
      const expected=new Map(achievementCatalog.map(a=>[a.id,a]));
      if(new Set(data.catalog.map(a=>a.id)).size!==28||data.catalog.some(a=>{
        const definition=expected.get(a.id);return !definition||!Array.isArray(a.criteria)||a.criteria.length!==definition.criteria.length
          ||a.criteria.some((r,i)=>r.metric!==definition.criteria[i].metric||r.op!==definition.criteria[i].op||r.value!==definition.criteria[i].value);
      }))throw Error();
      if(data.identity_verified!==true)return send(200,{state:'awaiting_verified_life',catalog_version:'medals-v2',catalog_count:28,identity_verified:false,total_unlocked:null,visible:[],unlocks:[]});
      const unlocks=(data.unlocks||[]).filter(u=>expected.has(u.achievement_id)).map(u=>({achievement_id:u.achievement_id,recognized_at:u.recognized_at,observed_at:u.observed_at}));
      if(new Set(unlocks.map(u=>u.achievement_id)).size!==unlocks.length)throw Error();
      return send(200,{state:'ready',catalog_version:'medals-v2',catalog_count:28,identity_verified:true,total_unlocked:unlocks.length,catalog:achievementCatalog,unlocks,
        visible:achievementCatalog.filter(a=>unlocks.some(u=>u.achievement_id===a.id))});
    }catch{return send(503,{state:'unavailable',error:'Evidência de medalhas indisponível.'});}
  }
  if(!contract.life) return send(200,{state:'awaiting_verified_life',catalog_count:100,
    identity_verified:false,total_unlocked:null,visible:[],unlocks:[]});
  try {
    const {data}=await callPublicRpc('get_public_life_achievements_v1',{p_profile_id:id});
    const life=validatedLifeResult(data);
    if(!life) return send(503,{state:'unavailable',error:'Evidência de conquistas indisponível.'});
    if(!life.identity_verified) return send(200,{state:'awaiting_verified_life',catalog_count:100,
      identity_verified:false,total_unlocked:null,visible:[],unlocks:[]});
    const presentation=visibleAchievements(life.unlocks,life.catalog);
    return send(200,{state:'ready',profile_id:id,...life,visible:presentation.visible});
  } catch { return send(503,{state:'unavailable',error:'Evidência de conquistas indisponível.'}); }
}
