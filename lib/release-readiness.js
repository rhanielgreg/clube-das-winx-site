// Gate de leitura: não migra, não altera permissões, não inicia deploy.
export async function checkDatabaseReadiness({env=process.env,fetchImpl=fetch}={}) {
 const names=['SUPABASE_URL','SUPABASE_SERVICE_ROLE_KEY','EXPECTED_SUPABASE_PROJECT_REF'];
 const missing=names.filter(name=>!env[name]);
 if(missing.length)return{ready:false,reason:'missing_configuration',missing};
 let url;try{url=new URL(env.SUPABASE_URL);}catch{return{ready:false,reason:'invalid_target'};}
 if(url.protocol!=='https:'||url.hostname!==env.EXPECTED_SUPABASE_PROJECT_REF+'.supabase.co'||url.username||url.password||url.search||url.pathname!=='/')return{ready:false,reason:'target_mismatch'};
 try {
  const key=env.SUPABASE_SERVICE_ROLE_KEY;
  const response=await fetchImpl(url.origin+'/rest/v1/rpc/get_service_pipeline_readiness_v1',{
   method:'POST',headers:{apikey:key,...(!key.startsWith('sb_')?{Authorization:'Bearer '+key}:{}),'content-type':'application/json'},body:'{}',signal:AbortSignal.timeout(10000)});
  if(!response.ok)return{ready:false,reason:'readiness_rpc_unavailable',http_status:response.status};
  const data=await response.json();
  const fresh=value=>Number.isFinite(Date.parse(value))&&Date.now()-Date.parse(value)<900000&&Date.parse(value)<=Date.now()+60000;
  return{ready:data.contract_ready===true&&data.schema_version==='life-v1'&&data.catalog_count===100&&data.verified_life_count>0&&data.latest_attempt_status==='success'&&fresh(data.last_verified_observation_at)&&fresh(data.last_collector_success_at),
    contract_ready:data.contract_ready===true,catalog_count:data.catalog_count,
    verified_life_count:data.verified_life_count,latest_attempt_status:['success','running','failed','skipped'].includes(data.latest_attempt_status)?data.latest_attempt_status:null,observations_recent:fresh(data.last_verified_observation_at),collector_recent:fresh(data.last_collector_success_at),
    reason:'provider_deployments_and_source_still_require_separate_verification'};
 }catch{return{ready:false,reason:'readiness_request_failed'};}
}
