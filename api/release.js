import { resolveDashboardContract } from '../lib/championship-contract.js';
export default async function handler(req,res){
 res.setHeader('cache-control','no-store');
 if(req.method!=='GET'){res.setHeader('allow','GET');return res.status(405).json({error:'Método não permitido.'});}
 const contract=await resolveDashboardContract();
 const revision=process.env.VERCEL_GIT_COMMIT_SHA;
 return res.status(200).json({release:'master16',commit:/^[a-f0-9]{40}$/i.test(revision||'')?revision:null,
  competition_contract:contract.official?(contract.version||'winx-v1'):null,life_contract:contract.life?'life-v1':null,
  ...(contract.release?.rewards_installed===true?{reward_contract:'season-rewards-v1'}:{})});
}
