import assert from 'node:assert/strict';
import test from 'node:test';
import { createAdminSession, forgetStoredAdminSession, retryAfterAt } from '../public/admin-session.js';
import { createRecoveryRequest } from '../public/recovery-request.js';
import { createAdminAuthClient, adminAuthStorageKey } from '../public/admin-auth.js';
import { requestPasswordRecovery } from '../public/password-recovery.js';

const tick = () => new Promise(resolve => setImmediate(resolve));
const at = Date.parse('2026-10-27T15:00:00Z');
const valid = { access_token:'fixture-valid-token', expires_at:at/1000+3600 };
const rejectedError = () => Object.assign(new Error('fixture rejection'),{authRejected:true});
function sessions(overrides={}) {
  let current=valid, time=at;
  const calls={load:0,out:0,allowed:0,login:[],forgot:[]};
  const auth={getSession:async()=>({data:{session:current}}),signOut:async options=>{
    assert.deepEqual(options,{scope:'local'});calls.out++;current=null;return {};
  },...overrides.auth};
  const options={auth,now:()=>time,loadDashboard:async()=>{calls.load++;return {fixture:true};},
    onAuthorized:()=>{calls.allowed++;},onLogin:value=>calls.login.push(value),
    forgetStoredSession:token=>calls.forgot.push(token),...overrides,auth};
  return {calls,options,control:createAdminSession(options),current:value=>{current=value;},advance:ms=>{time+=ms;}};
}

test('sessão autorizada restaura; eventos repetidos/foco compartilham a mesma consulta e F5 continua legítimo',async()=>{
  const f=sessions();
  await Promise.all([f.control.restoreInitial(),f.control.restore({...valid}),f.control.restore({...valid})]);
  assert.equal(f.calls.load,1);assert.equal(f.calls.allowed,1);
  await f.control.restore({...valid});assert.equal(f.calls.load,1);
  f.advance(60001);await f.control.restore({...valid});assert.equal(f.calls.load,2);
  await createAdminSession(f.options).restoreInitial();assert.equal(f.calls.load,3);
  assert.equal(f.calls.out,0);
});

test('usuário comum rejeitado volta ao login silenciosamente, sai só desta sessão e não é repetido',async()=>{
  const f=sessions({loadDashboard:async()=>{f.calls.load++;throw rejectedError();}});
  assert.equal(await f.control.restoreInitial(),false);
  assert.equal(f.calls.out,1);assert.deepEqual(f.calls.login,[{reason:'rejected',interactive:false}]);
  await f.control.restore({...valid});await f.control.restore({...valid});
  assert.equal(f.calls.load,1);
  await createAdminSession(f.options).restoreInitial();assert.equal(f.calls.load,1,'F5 não restaura token removido');
});

test('sessão expirada não consulta painel e limpa somente a sessão local comprovadamente antiga',async()=>{
  const f=sessions();const expired={...valid,expires_at:at/1000-1};f.current(expired);
  assert.equal(await f.control.restore(expired),false);assert.equal(f.calls.load,0);assert.equal(f.calls.out,1);
});

test('falhas de rede/servidor não apagam sessão; foco repetido não cria tempestade de consultas',async()=>{
  const f=sessions({loadDashboard:async()=>{f.calls.load++;throw new TypeError('fixture network');}});
  await f.control.restoreInitial();await f.control.restore({...valid});
  assert.equal(f.calls.load,1);assert.equal(f.calls.out,0);assert.equal(f.calls.forgot.length,0);
  await f.control.restore(valid,{interactive:true});assert.equal(f.calls.load,2);
});

test('retorno de recuperação durante uma consulta antiga impede logout e resultados atrasados',async()=>{
  let finish,recovery=false;
  const f=sessions({isRecoveryActive:()=>recovery,loadDashboard:()=>new Promise((resolve,reject)=>{finish=reject;})});
  const restoring=f.control.restore(valid);recovery=true;f.control.suspend();finish(rejectedError());await restoring;
  assert.equal(f.calls.out,0);assert.equal(f.calls.forgot.length,0);assert.equal(f.calls.login.length,0);
  assert.equal(await f.control.restoreInitial(),false);
});

test('resposta antiga não derruba nova sessão válida e SIGNED_OUT não permite renderização atrasada',async()=>{
  let finish;
  const newer={...valid,access_token:'fixture-new-token'};
  const f=sessions({loadDashboard:session=>session.access_token===valid.access_token
    ?new Promise((resolve,reject)=>{finish=reject;}):Promise.resolve({fixture:true})});
  const old=f.control.restore(valid);f.current(newer);await f.control.restore(newer);finish(rejectedError());await old;
  assert.equal(f.calls.out,0);assert.equal(f.calls.allowed,1);
  let release;
  const g=sessions({loadDashboard:()=>new Promise(resolve=>{release=resolve;})});
  const pending=g.control.restore(valid);await g.control.restore(null);release({fixture:true});await pending;
  assert.equal(g.calls.allowed,0);
});

test('cleanup nunca encerra token já substituído e erro local remove apenas a chave correspondente',async()=>{
  const f=sessions({loadDashboard:async()=>{f.current({...valid,access_token:'newer'});throw rejectedError();}});
  await f.control.restore(valid);assert.equal(f.calls.out,0);
  const g=sessions({loadDashboard:async()=>{throw rejectedError();},auth:{signOut:async()=>({error:{status:503}})}});
  await g.control.restore(valid);assert.deepEqual(g.calls.forgot,[valid.access_token]);
  const storage=memory();const key=adminAuthStorageKey('https://fixture.supabase.co');
  storage.setItem(key,JSON.stringify(valid));storage.setItem(key+'-code-verifier','private-fixture');storage.setItem('other-app','preserve');
  forgetStoredAdminSession(storage,key,'different');assert.ok(storage.getItem(key));
  forgetStoredAdminSession(storage,key,valid.access_token);assert.equal(storage.getItem(key),null);
  assert.equal(storage.getItem(key+'-code-verifier'),'private-fixture');assert.equal(storage.getItem('other-app'),'preserve');
});

test('getSession rejeitado não desabilita login e só remove token local em erro de autenticação comprovado',async()=>{
  const f=sessions({auth:{getSession:async()=>({error:{code:'refresh_token_not_found'}})},readStoredToken:()=>valid.access_token});
  await f.control.restoreInitial();assert.deepEqual(f.calls.forgot,[valid.access_token]);assert.equal(f.calls.out,0);
  const g=sessions({auth:{getSession:async()=>({error:{status:503}})},readStoredToken:()=>valid.access_token});
  await g.control.restoreInitial();assert.equal(g.calls.forgot.length,0);
});

function memory() {const values=new Map();return {getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value),removeItem:key=>values.delete(key)};}
function mutex(){let busy=false;return async action=>{if(busy)return false;busy=true;try{return await action();}finally{busy=false;}};}
const key='winx.admin.recovery-request:fixture.supabase.co';
function requests(overrides={}) {
  const storage=overrides.storage||memory(),lock=overrides.lock||mutex();let sent=0;
  const options={storage,key,lock,now:()=>at,send:async()=>{sent++;},...overrides};
  return {storage,options,control:createRecoveryRequest(options),count:()=>sent};
}

test('clique duplo/Enter simultâneo: uma solicitação pendente; sucesso permanece bloqueado após F5 e foco',async()=>{
  let finish,sent=0;
  const f=requests({send:()=>{sent++;return new Promise(resolve=>{finish=resolve;});}});
  const first=f.control.request('fixture@example.invalid');
  assert.equal(f.control.view().phase,'sending');
  await Promise.all(Array.from({length:6},()=>f.control.request('fixture@example.invalid')));
  assert.equal(sent,1);
  const reloaded=createRecoveryRequest(f.options);assert.equal(reloaded.view().phase,'pending');
  assert.equal(await reloaded.request('fixture@example.invalid'),false);
  assert.equal(await reloaded.rearm(),false,'não libera envio enquanto outra aba segura o lock');
  finish();await first;assert.equal(f.control.view().phase,'sent');
  const focused=createRecoveryRequest(f.options);assert.equal(focused.view().blocked,true);
  assert.equal(await focused.request('fixture@example.invalid'),false);assert.equal(sent,1);
  assert.deepEqual(JSON.parse(f.storage.getItem(key)),{version:1,phase:'sent'});
});

test('abas concorrentes não criam fila; nova tentativa requer liberar e clicar novamente, sem autoenvio',async()=>{
  let finish,sent=0;const shared=memory(),lock=mutex();
  const options={storage:shared,key,lock,send:()=>{sent++;return new Promise(resolve=>{finish=resolve;});}};
  const a=createRecoveryRequest(options),b=createRecoveryRequest(options);
  const pending=a.request('fixture@example.invalid');await b.request('other@example.invalid');assert.equal(sent,1);
  finish();await pending;await b.rearm();assert.equal(sent,1);assert.equal(b.view().phase,'idle');
  const next=b.request('fixture@example.invalid');assert.equal(sent,2);finish();await next;
});

test('429 sem Retry-After não inventa desbloqueio, timer ou reenvio e sobrevive ao recarregamento',async()=>{
  let sent=0;const f=requests({send:async()=>{sent++;throw {rateLimited:true};}});
  await f.control.request('fixture@example.invalid');assert.equal(f.control.view().phase,'rate_limited');
  assert.equal(f.control.view().retryAt,null);
  const future=createRecoveryRequest({...f.options,now:()=>at+86400000});assert.equal(future.view().blocked,true);
  await future.request('fixture@example.invalid');assert.equal(sent,1);
  assert.equal(await future.rearm(),true);assert.equal(sent,1);
});

test('Retry-After confiável é respeitado; decorrido o prazo, ainda exige nova ação do usuário',async()=>{
  let time=at,sent=0;
  const f=requests({now:()=>time,send:async()=>{sent++;throw {rateLimited:true,retryAt:at+120000};}});
  await f.control.request('fixture@example.invalid');assert.equal(await f.control.rearm(),false);
  time+=120001;assert.equal(f.control.view().canRearm,true);assert.equal(f.control.view().blocked,true);
  assert.equal(sent,1);await f.control.rearm();assert.equal(sent,1);
  assert.equal(retryAfterAt(new Headers({'retry-after':'120'}),at),at+120000);
  assert.equal(retryAfterAt(new Headers({'retry-after':'Tue, 27 Oct 2026 15:02:00 GMT','date':'Tue, 27 Oct 2026 15:00:00 GMT'}),at+900000),at+1020000);
  for(const value of [null,'invalid','-1','Infinity','999999999999999999999999'])
    assert.equal(retryAfterAt(new Headers(value?{'retry-after':value}:{}),at),null);
});

test('armazenamento indisponível/corrompido e ausência de Web Locks bloqueiam envio sem afetar Auth',async()=>{
  for(const storage of [{getItem(){throw Error();}}, {getItem:()=>'{invalid'}]) {
    const f=requests({storage});await f.control.request('fixture@example.invalid');assert.equal(f.count(),0);
    assert.equal(f.control.view().phase,'storage_unavailable');
  }
  const f=requests({lock:null});await f.control.request('fixture@example.invalid');assert.equal(f.count(),0);
  assert.equal(f.control.view().phase,'storage_unavailable');
});

test('erros ambíguos de rede ficam para conferência manual, sem liberar automaticamente envio repetido',async()=>{
  let sent=0;const f=requests({send:async()=>{sent++;throw new TypeError('fixture network');}});
  await f.control.request('fixture@example.invalid');assert.equal(f.control.view().phase,'failed');
  await f.control.request('fixture@example.invalid');assert.equal(sent,1);
});

test('SDK mantém resposta original; só captura cabeçalhos de /recover e não lê credenciais',async()=>{
  let customFetch,info=null;
  const response=new Response('{}',{status:429,headers:{'retry-after':'120'}});
  await createAdminAuthClient({admin_enabled:true,supabase_url:'https://fixture.supabase.co',supabase_public_key:'sb_publishable_fixture'},async()=>({createClient:(url,key,options)=>{
    customFetch=options.global.fetch;return {auth:{}};
  }}),{fetchImpl:async()=>response,onRecoveryResponse:r=>{info={status:r.status,retryAt:retryAfterAt(r.headers,at)};}});
  assert.equal(await customFetch('https://fixture.supabase.co/auth/v1/user',{}),response);assert.equal(info,null);
  await customFetch('https://fixture.supabase.co/auth/v1/recover?redirect_to=fixture',{});
  assert.deepEqual(info,{status:429,retryAt:at+120000});
  await assert.rejects(requestPasswordRecovery({resetPasswordForEmail:async()=>({error:{status:429}})},'fixture@example.invalid','https://fixture.invalid',()=>info),error=>error.rateLimited===true&&error.retryAt===at+120000);
});
