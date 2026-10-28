import {callPublicRpc} from '../lib/supabase-public.js';
import adminRewards from '../lib/admin-rewards.js';
export default async function handler(req,res){
 if(req.query?.view==='admin')return adminRewards(req,res);
 res.setHeader('cache-control','no-store');
 if(req.method!=='GET'){res.setHeader('allow','GET');return res.status(405).json({error:'Método não permitido.'});}
 try{
  const {data}=await callPublicRpc('get_public_rewards_v1');
  if(data?.contract!=='season-rewards-v1'||!Array.isArray(data.draws))throw Error();
  const draws=data.draws.map(d=>({season_number:d.season_number,season_name:d.season_name,character_name:d.character_name,
   steam_username:d.steam_username,reward_name:d.reward_name,rarity:d.rarity,drawn_at:d.drawn_at}));
  return res.status(200).json({contract:'season-rewards-v1',draws});
 }catch{return res.status(503).json({error:'Consulta de premiações indisponível.'});}
}
