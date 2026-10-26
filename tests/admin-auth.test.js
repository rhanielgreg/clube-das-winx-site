import assert from 'node:assert/strict';
import test from 'node:test';
import { createAdminAuthClient, requireAdminAuth, AUTH_UNAVAILABLE } from '../public/admin-auth.js';
import configApi from '../api/config.js';

const config={admin_enabled:true,supabase_url:'https://fixture.invalid',supabase_public_key:'sb_publishable_fixture'};
test('auth desativada não carrega SDK; submit sem cliente falha claramente, nunca com null.auth',async()=>{
  let loads=0;
  assert.equal(await createAdminAuthClient({admin_enabled:false},async()=>{loads++;}),null);
  assert.equal(loads,0);
  assert.throws(()=>requireAdminAuth(null),{message:AUTH_UNAVAILABLE});
  assert.throws(()=>requireAdminAuth({}),{message:AUTH_UNAVAILABLE});
});

test('configuração pública incompleta é recusada antes de carregar dependências',async()=>{
  for(const incomplete of [{...config,supabase_url:''},{...config,supabase_public_key:null}]) {
    await assert.rejects(createAdminAuthClient(incomplete,async()=>{throw Error('Não deve carregar SDK');}),{message:AUTH_UNAVAILABLE});
  }
});

test('falha do CDN/SDK ou cliente inválido não se converte em erro de senha ou acesso',async()=>{
  await assert.rejects(createAdminAuthClient(config,async()=>{throw Error('SDK indisponível');}),/SDK indisponível/);
  await assert.rejects(createAdminAuthClient(config,async()=>({})),/SDK de autenticação indisponível/);
  await assert.rejects(createAdminAuthClient(config,async()=>({createClient:()=>null})),{message:AUTH_UNAVAILABLE});
});

test('cliente válido mantém sessão, refresh e detecção do link, sem alterar autorização',async()=>{
  const auth={signInWithPassword:async()=>({data:{session:null}})};
  const client=await createAdminAuthClient(config,async()=>({createClient:(url,key,options)=>{
    assert.equal(url,config.supabase_url);assert.equal(key,config.supabase_public_key);
    assert.deepEqual(options,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
    return {auth};
  }}));
  assert.equal(requireAdminAuth(client),auth);
});

test('diagnóstico público informa só variáveis ausentes; não divulga email ou chave secreta',()=>{
  const keys=['SUPABASE_URL','SUPABASE_PUBLISHABLE_KEY','SUPABASE_ANON_KEY','ADMIN_EMAIL'];
  const before=Object.fromEntries(keys.map(key=>[key,process.env[key]]));
  const response=()=>({setHeader(){},status(code){this.code=code;return this;},json(body){this.body=body;return this;}});
  try {
    Object.assign(process.env,{SUPABASE_URL:config.supabase_url,SUPABASE_PUBLISHABLE_KEY:config.supabase_public_key});
    delete process.env.ADMIN_EMAIL;delete process.env.SUPABASE_ANON_KEY;
    let res=response();configApi({method:'GET'},res);
    assert.deepEqual(res.body,{admin_enabled:false,configuration_issues:['ADMIN_EMAIL']});
    process.env.ADMIN_EMAIL='private-admin@example.invalid';process.env.SUPABASE_PUBLISHABLE_KEY='sb_secret_must_not_be_public';
    res=response();configApi({method:'GET'},res);
    assert.deepEqual(res.body,{admin_enabled:false,configuration_issues:['SUPABASE_PUBLISHABLE_KEY_OR_ANON_KEY']});
    assert.ok(!JSON.stringify(res.body).includes(process.env.ADMIN_EMAIL));
    assert.ok(!JSON.stringify(res.body).includes('sb_secret_'));
    process.env.SUPABASE_PUBLISHABLE_KEY=config.supabase_public_key;res=response();configApi({method:'GET'},res);
    assert.equal(res.body.admin_enabled,true);assert.equal(res.body.supabase_public_key,config.supabase_public_key);
    assert.equal(res.body.admin_email,undefined);
  }finally{for(const key of keys)before[key]===undefined?delete process.env[key]:process.env[key]=before[key];}
});
