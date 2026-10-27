// Habilitação explícita somente após inventário, migração 003 e validação.
// Não configura serviços nem executa migrações. Ausência/desvio mantém bloqueado.
export const officialContractEnabled = (env = process.env) => env.COMPETITION_RULES_VERSION === 'winx-v1';
export const officialContractPending = 'Campeonato oficial aguardando validação e habilitação da migração 003.';
export const lifeContractEnabled = (env = process.env) => env.LIFE_CONTRACT_VERSION === 'life-v1' && officialContractEnabled(env);
import { callPublicRpc } from './supabase-public.js';
// A publicação por GitHub não depende de modificar segredos da Vercel.
// Sem flag explícita, só o marcador instalado/ativado pelo banco libera RPCs novos.
export async function resolveDashboardContract(env=process.env) {
 if(env.COMPETITION_RULES_VERSION) return {official:officialContractEnabled(env),life:lifeContractEnabled(env),release:null};
 try {
  const {data}=await callPublicRpc('get_public_dashboard_release_v1',{}, {env,timeoutMs:3500});
  const official=data?.competition_rules_version==='winx-v1';
  let product14=null;
  if(official&&data?.product14_installed===true) {
   const result=await callPublicRpc('get_public_product14_v2',{}, {env,timeoutMs:3500});
   if(result.data?.contract==='winx-v2') product14=result.data;
  }
  return {official,life:official&&data?.life_contract_version==='life-v1',release:official?data:null,
   ...(product14?{product14,version:product14.monthly_enabled?'winx-v2':'winx-v1'}:{})};
 }catch{return {official:false,life:false,release:null};}
}
