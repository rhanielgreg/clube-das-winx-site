import assert from 'node:assert/strict';
import test from 'node:test';
import { checkDatabaseReadiness } from '../lib/release-readiness.js';

test('gate de liberação exige destino exato, contrato, coleta recente e último sucesso',async()=>{
 const env={SUPABASE_URL:'https://fixture.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'sb_secret_local_fixture',EXPECTED_SUPABASE_PROJECT_REF:'fixture'};
 let requests=0;
 const data={contract_ready:true,schema_version:'life-v1',catalog_count:100,verified_life_count:1,latest_attempt_status:'success',last_verified_observation_at:new Date().toISOString(),last_collector_success_at:new Date().toISOString()};
 const fetchImpl=async(url,options)=>{requests++;assert.equal(url,env.SUPABASE_URL+'/rest/v1/rpc/get_service_pipeline_readiness_v1');assert.equal(options.headers.Authorization,undefined);assert.equal(options.body,'{}');return Response.json(data);};
 assert.equal((await checkDatabaseReadiness({env,fetchImpl})).ready,true);
 for(const patch of [{latest_attempt_status:'failed'},{latest_attempt_status:'running'},{contract_ready:false},{catalog_count:99},{verified_life_count:0},{last_verified_observation_at:'2000-01-01'},{last_collector_success_at:'invalid'}]) {
  const result=await checkDatabaseReadiness({env,fetchImpl:async()=>Response.json({...data,...patch})});assert.equal(result.ready,false,JSON.stringify(patch));
 }
 assert.equal((await checkDatabaseReadiness({env:{...env,EXPECTED_SUPABASE_PROJECT_REF:'wrong'},fetchImpl})).reason,'target_mismatch');
 assert.equal((await checkDatabaseReadiness({env:{},fetchImpl})).reason,'missing_configuration');
 assert.equal(requests,1,'configuração inválida não inicia consulta');
 assert.equal((await checkDatabaseReadiness({env,fetchImpl:async()=>new Response('{}',{status:403})})).http_status,403);
 assert.equal((await checkDatabaseReadiness({env,fetchImpl:async()=>{throw Error('secret internal error');}})).reason,'readiness_request_failed');
});
