import assert from 'node:assert/strict';
import test from 'node:test';
import {collectionCountdown} from '../public/collection-countdown.js';
import {resolveDashboardContract} from '../lib/championship-contract.js';
import release from '../api/release.js';
test('marcador público confirma revisão sem divulgar configurações ou aceitar escrita',async()=>{
 const old=process.env.COMPETITION_RULES_VERSION,revision=process.env.VERCEL_GIT_COMMIT_SHA;
 const response=()=>({setHeader(){},status(code){this.code=code;return this;},json(body){this.body=body;return this;}});
 try{
  process.env.COMPETITION_RULES_VERSION='disabled';process.env.VERCEL_GIT_COMMIT_SHA='a'.repeat(40);
  const read=response();await release({method:'GET'},read);
  assert.deepEqual(read.body,{release:'mission11',commit:'a'.repeat(40),competition_contract:null,life_contract:null});
  process.env.VERCEL_GIT_COMMIT_SHA='invalid';const invalid=response();await release({method:'GET'},invalid);assert.equal(invalid.body.commit,null);
  const write=response();await release({method:'POST'},write);assert.equal(write.code,405);
 }finally{if(old===undefined)delete process.env.COMPETITION_RULES_VERSION;else process.env.COMPETITION_RULES_VERSION=old;if(revision===undefined)delete process.env.VERCEL_GIT_COMMIT_SHA;else process.env.VERCEL_GIT_COMMIT_SHA=revision;}
});
test('contador usa cron e tentativa reais; chegar a zero não reinicia nem simula conclusão',()=>{
 const at=Date.parse('2026-10-25T18:05:12Z');
 const sync={collector_interval_seconds:300,collector_cron_utc:'*/5 * * * *',latest_attempt_at:new Date(at).toISOString(),latest_attempt_status:'success'};
 assert.equal(collectionCountdown(sync,Date.parse('2026-10-25T18:09:50Z')),'Próxima atualização em 00:10');
 const onSchedule={...sync,latest_attempt_at:'2026-10-25T18:05:00Z'};
 assert.equal(collectionCountdown(onSchedule,Date.parse('2026-10-25T18:05:01Z')),'Próxima atualização em 04:59');
 assert.equal(collectionCountdown(onSchedule,Date.parse('2026-10-25T18:05:02Z')),'Próxima atualização em 04:58');
 assert.equal(collectionCountdown(sync,Date.parse('2026-10-25T18:07:35Z')),'Próxima atualização em 02:25');
 assert.equal(collectionCountdown(sync,Date.parse('2026-10-25T18:10:00Z')),'Aguardando confirmação da próxima coleta');
 assert.equal(collectionCountdown(sync,Date.parse('2026-10-25T18:15:00Z')),'Aguardando confirmação da próxima coleta');
 assert.equal(collectionCountdown({...sync,latest_attempt_status:'running'},at+1000),'Coleta em andamento');
 assert.equal(collectionCountdown({...sync,latest_attempt_status:'failed'},at+1000),'Última tentativa de coleta falhou');
 assert.equal(collectionCountdown(null,at),'Agenda de coleta indisponível');
});
test('deploy GitHub habilita só contratos comprovados pelo marcador público do banco',async(t)=>{
 const env={SUPABASE_URL:'https://fixture.invalid',SUPABASE_ANON_KEY:'publishable-fixture'};
 let data={competition_rules_version:'winx-v1',life_contract_version:null};
 t.mock.method(globalThis,'fetch',async(url)=>{assert.ok(url.endsWith('/get_public_dashboard_release_v1'));return Response.json(data);});
 assert.equal((await resolveDashboardContract(env)).official,true);assert.equal((await resolveDashboardContract(env)).life,false);
 data.life_contract_version='life-v1';assert.equal((await resolveDashboardContract(env)).life,true);
 data={};assert.equal((await resolveDashboardContract(env)).official,false);
 t.mock.method(globalThis,'fetch',async()=>new Response('{}',{status:404}));
 assert.equal((await resolveDashboardContract(env)).official,false);
 assert.equal((await resolveDashboardContract({...env,COMPETITION_RULES_VERSION:'disabled'})).official,false);
});
