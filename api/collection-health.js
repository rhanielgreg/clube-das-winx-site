import {callPublicRpc} from '../lib/supabase-public.js';
import {collectionHealth} from '../lib/collection-health.js';
export default async function handler(req,res) {
 res.setHeader('cache-control','no-store');
 if(req.method!=='GET'){res.setHeader('allow','GET');return res.status(405).json({error:'Método não permitido.'});}
 try {
  const {data}=await callPublicRpc('get_public_collection_health_v1');
  const result=collectionHealth(data);
  return res.status(result.state==='unknown'?503:200).json(result);
 }catch{return res.status(503).json({state:'unknown',reason:'health_temporarily_unavailable',game_server_state:'not_assessed'});}
}
