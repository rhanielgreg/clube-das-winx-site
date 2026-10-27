import {callPublicRpc} from '../lib/supabase-public.js';
import {resolveDashboardContract} from '../lib/championship-contract.js';
import {enrichRankingWithAvatars} from '../lib/steam-avatar.js';
export default async function handler(req,res){
 res.setHeader('cache-control','no-store');
 if(req.method!=='GET'){res.setHeader('allow','GET');return res.status(405).json({error:'Método não permitido.'});}
 try{
  const contract=await resolveDashboardContract();
  if(contract.version!=='winx-v2')return res.status(200).json({state:'awaiting_contract',ranking:[]});
  const {data}=await callPublicRpc('get_public_global_ranking_v2',{p_limit:100});
  if(data?.contract!=='global-accounts-v2'||!Array.isArray(data.ranking))throw Error();
  const ranking=data.ranking.map(r=>({account_id:r.account_id,profile_id:r.profile_id,steam_username:r.steam_username,
    kills_total:r.kills_total===null?null:Number(r.kills_total),lives_count:Number(r.lives_count),known_lives:Number(r.known_lives),rank_position:Number(r.rank_position),coverage:'partial_verified_history'}));
  await enrichRankingWithAvatars(ranking);
  return res.status(200).json({state:data.state,coverage:'partial_verified_history',ranking});
 }catch{return res.status(503).json({state:'temporarily_unavailable',ranking:[]});}
}
