import { UUID } from '../public/contracts.js';
import { callPublicRpc } from '../lib/supabase-public.js';
import { resolveDashboardContract } from '../lib/championship-contract.js';
import { validatedLifeResult } from '../lib/life-public-contract.js';
import { visibleAchievements } from '../public/achievement-view.js';

// Contextual read API only. It does not restore a public dossier or award medals.
export default async function handler(req,res) {
  res.setHeader('cache-control','no-store');
  const send=(status,body)=>res.status(status).json(body);
  if(req.method!=='GET') { res.setHeader('allow','GET'); return send(405,{error:'Método não permitido.'}); }
  const id=req.query?.id;
  if(typeof id!=='string'||!UUID.test(id)) return send(400,{error:'Vida inválida.'});
  const contract=await resolveDashboardContract();
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
