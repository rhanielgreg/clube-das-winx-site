import assert from 'node:assert/strict';
import test from 'node:test';
import ranking from '../api/ranking.js';
import player from '../api/player.js';
import admin from '../api/admin.js';
import config from '../api/config.js';
import { getSteamAvatar } from '../lib/steam-avatar.js';
import { achievementCatalog } from '../public/legacy-achievements-catalog.js';

const profileId = '20000000-0000-4000-8000-000000000001';
const seasonId = '10000000-0000-4000-8000-000000000001';
function response() { return { headers: {}, setHeader(k,v) { this.headers[k]=v; }, status(code) { this.code=code; return this; }, json(body) { this.body=body; return this; } }; }
async function isolated(t, run) {
  const keys = ['SUPABASE_URL','SUPABASE_PUBLISHABLE_KEY','SUPABASE_ANON_KEY','SUPABASE_SERVICE_ROLE_KEY','ADMIN_EMAIL','STEAM_PROFILE_MAP_JSON','COMPETITION_RULES_VERSION','LIFE_CONTRACT_VERSION'];
  const previous = Object.fromEntries(keys.map((key) => [key,process.env[key]]));
  Object.assign(process.env, { SUPABASE_URL: 'https://database.invalid', SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_local_test', SUPABASE_SERVICE_ROLE_KEY: 'sb_secret_local_test', ADMIN_EMAIL: 'admin@example.invalid', STEAM_PROFILE_MAP_JSON: '{}' });
  process.env.COMPETITION_RULES_VERSION='winx-v1';
  process.env.LIFE_CONTRACT_VERSION='';
  const calls = [];
  t.mock.method(globalThis, 'fetch', async (url, options) => { calls.push({ url, options }); return run.mock(url, options); });
  try { await run.check(calls); } finally { for (const key of keys) { if (previous[key] === undefined) delete process.env[key]; else process.env[key] = previous[key]; } }
}
test('ranking distingue cemitério indisponível de vazio e não inventa alive', async (t) => {
  await isolated(t, {
    mock: async (url) => {
      if (url.endsWith('get_public_graveyard_v2')) return new Response('{}', { status: 500 });
      if (url.endsWith('get_public_ranking')) return Response.json([{ profile_id: profileId, kills_total: 5 }]);
      return Response.json([]);
    },
    check: async () => { const res=response(); await ranking({method:'GET'},res); assert.equal(res.code,200); assert.equal(res.body.graveyard,null); assert.equal(res.body.graveyard_state,'unavailable'); assert.deepEqual(res.body.ranking,[],'estado ausente não compete'); },
  });
});
test('perfil consulta histórico da temporada selecionada e tolera falha isolada', async (t) => {
  await isolated(t, {
    mock: async (url, options) => {
      if (url.endsWith('get_public_player')) return Response.json([{ profile_id:profileId, season_id:seasonId, alive:false }]);
      if (url.endsWith('get_public_player_titles')) return Response.json([]);
      assert.ok(url.endsWith('get_public_player_history_v2'));
      assert.deepEqual(JSON.parse(options.body), { p_profile_id:profileId, p_season_id:seasonId, p_limit:90 });
      return new Response('{}', { status:503 });
    },
    check: async (calls) => { const res=response(); await player({method:'GET',query:{id:profileId}},res); assert.equal(res.code,200); assert.equal(res.body.profile.alive,false); assert.equal(res.body.history_state,'unavailable'); assert.equal(calls.length,3); },
  });
});

test('ranking informa tentativa falha do marcador mesmo com último sucesso legado recente', async (t) => {
  const now = new Date().toISOString();
  await isolated(t, {
    mock: async (url) => {
      if (url.endsWith('get_public_dashboard_release_v1')) return Response.json({ competition_rules_version:'winx-v1', life_contract_version:null, server_time:now,
        latest_attempt_at:now, latest_attempt_status:'failed', collector_interval_seconds:300, collector_cron_utc:'*/5 * * * *' });
      if (url.endsWith('get_public_ranking_status')) return Response.json([{last_success_at:now}]);
      return Response.json([]);
    },
    check: async () => {
      delete process.env.COMPETITION_RULES_VERSION;
      const res=response(); await ranking({method:'GET'},res);
      assert.equal(res.code,200); assert.equal(res.body.stale,true);
      assert.equal(res.body.sync.latest_attempt_status,'failed');
      assert.equal(res.body.sync.last_success_at,now);
      assert.equal(res.headers['cache-control'],'no-store, max-age=0');
    },
  });
});
test('perfil inválido e método incorreto são rejeitados sem rede', async (t) => {
  await isolated(t, { mock: async () => { throw new Error('Rede não deveria ser chamada'); }, check: async (calls) => {
    const invalid=response(); await player({method:'GET',query:{id:'-'.repeat(36)}},invalid); assert.equal(invalid.code,400); assert.equal(invalid.headers['cache-control'],'no-store');
    const method=response(); await ranking({method:'POST'},method); assert.equal(method.code,405); assert.equal(calls.length,0);
  }});
});

test('dossiê de morto sem temporada não consulta histórico arbitrário nem preenche métricas', async (t) => {
  await isolated(t, {mock: async (url) => {
    if (url.endsWith('get_public_player_titles')) return Response.json([]);
    assert.ok(url.endsWith('get_public_player'));
    return Response.json([{profile_id:profileId,season_id:null,alive:false,kills_total:null,survival_seconds:null}]);
  },check: async (calls) => {
    const res=response(); await player({method:'GET',query:{id:profileId}},res);
    assert.equal(res.code,200); assert.equal(res.body.profile.kills_total,null);
    assert.equal(res.body.profile.rank_position,undefined); assert.deepEqual(res.body.history,[]);
    assert.equal(res.body.history_state,'unavailable'); assert.equal(calls.length,2); assert.ok(calls.every(call=>!call.url.endsWith('get_public_player_history_v2')));
  }});
});
test('reset autenticado não inicia PATCH nem RPC, com ou sem temporada', async (t) => {
  await isolated(t, { mock: async (url) => { assert.ok(url.endsWith('/auth/v1/user')); return Response.json({email:'admin@example.invalid'}); }, check: async (calls) => {
    for (const [payload, expected] of [[{},400],[{season_id:seasonId},409]]) {
      const res=response(); await admin({method:'POST',headers:{authorization:'Bearer fake-test-session'},body:{action:'reset_baseline',payload}},res); assert.equal(res.code,expected);
    }
    assert.equal(calls.length,2); assert.ok(calls.every((call)=>call.options.method==='GET'));
  }});
});
test('admin sem sessão é rejeitado sem rede e configuração nunca expõe service_role', async (t) => {
  await isolated(t, { mock: async () => { throw new Error('Rede não deveria ser chamada'); }, check: async (calls) => {
    const denied=response(); await admin({method:'GET',headers:{}},denied); assert.equal(denied.code,403); assert.equal(calls.length,0);
    process.env.SUPABASE_PUBLISHABLE_KEY='sb_secret_wrong_configuration';
    const res=response(); config({method:'GET'},res); assert.equal(res.body.admin_enabled,false);assert.ok(res.body.configuration_issues.includes('SUPABASE_PUBLISHABLE_KEY_OR_ANON_KEY'));
    assert.ok(!JSON.stringify(res.body).includes('sb_secret'));
  }});
});
for (const outcome of ['champion','apocalypse']) {
  test(`encerramento oficial ${outcome} usa v2 e chave moderna sem Bearer indevido`, async (t) => {
    await isolated(t,{mock:async(url,options)=>{
      if(url.endsWith('/auth/v1/user')) return Response.json({email:'admin@example.invalid'});
      assert.ok(url.endsWith('/rpc/close_ranking_season_v2'));
      assert.deepEqual(JSON.parse(options.body),{p_season_id:seasonId,p_winner_character_id:null});
      assert.equal(options.headers.Authorization,undefined);
      return Response.json([{season_id:seasonId,outcome,winner_profile_id:outcome==='champion'?profileId:null,winner_name:outcome==='champion'?'Campeão sintético':null}]);
    },check:async(calls)=>{
      const invalid=response(); await admin({method:'POST',headers:{authorization:'Bearer fake'},body:{action:'close_season',payload:{season_id:seasonId,winner_character_id:'invalid'}}},invalid);
      assert.equal(invalid.code,400); assert.equal(calls.length,1);
      const res=response();await admin({method:'POST',headers:{authorization:'Bearer fake'},body:{action:'close_season',payload:{season_id:seasonId}}},res);
      assert.equal(res.code,200);assert.equal(res.body.seasonId,seasonId);assert.equal(res.body.outcome,outcome);
      if(outcome==='apocalypse')assert.ok(res.body.message.includes('O Apocalipse Venceu'));
    }});
  });
}

test('contrato oficial desabilitado bloqueia novos RPCs e encerramento sem fallback legado', async (t) => {
  await isolated(t,{mock:async(url)=>{
    if(url.endsWith('/auth/v1/user')) return Response.json({email:'admin@example.invalid'});
    if(url.endsWith('get_public_dashboard_release_v1'))return new Response('{}',{status:404});
    if(url.endsWith('get_public_player')) return Response.json([{profile_id:profileId,season_id:seasonId,alive:true}]);
    assert.ok(url.endsWith('get_public_player_history_v2'),'somente histórico já existente na migração 002');
    return Response.json([]);
  },check:async(calls)=>{
    delete process.env.COMPETITION_RULES_VERSION;
    const ranks=response();await ranking({method:'GET'},ranks);assert.equal(ranks.code,503);assert.equal(calls.length,1,'somente descoberta de contrato, sem RPC v2');
    const closed=response();await admin({method:'POST',headers:{authorization:'Bearer fake'},body:{action:'close_season',payload:{season_id:seasonId}}},closed);
    assert.equal(closed.code,503);assert.equal(calls.length,3,'autenticação e descoberta; nenhum RPC de escrita');
    const profile=response();await player({method:'GET',query:{id:profileId}},profile);
    assert.equal(profile.code,200);assert.equal(profile.body.titles_state,'unavailable');
    assert.ok(calls.every(call=>!call.url.endsWith('get_public_player_titles')&&!call.url.endsWith('get_public_seasons_v2')&&!call.url.includes('close_ranking_season')));
  }});
});

test('habilitação sem RPCs novos falha sem usar encerramento legado', async (t) => {
  t.mock.method(console,'error',()=>{});
  await isolated(t,{mock:async(url)=>{
    if(url.endsWith('/auth/v1/user')) return Response.json({email:'admin@example.invalid'});
    if(url.endsWith('get_public_seasons_v2')||url.endsWith('close_ranking_season_v2')) return new Response('{}',{status:404});
    return Response.json([]);
  },check:async(calls)=>{
    const ranks=response();await ranking({method:'GET'},ranks);assert.equal(ranks.code,503);
    const closed=response();await admin({method:'POST',headers:{authorization:'Bearer fake'},body:{action:'close_season',payload:{season_id:seasonId}}},closed);
    assert.equal(closed.code,500);assert.equal(closed.body.success,undefined);
    assert.ok(calls.some(call=>call.url.endsWith('/close_ranking_season_v2')));
    assert.ok(calls.every(call=>!call.url.endsWith('/close_ranking_season')));
  }});
});

test('contrato de vida é opt-in, valida catálogo e não expõe identificadores privados',async(t)=>{
 await isolated(t,{mock:async(url)=>{
  if(url.endsWith('get_public_player'))return Response.json([{profile_id:profileId,season_id:seasonId,alive:true}]);
  if(url.endsWith('get_public_life_achievements_v1'))return Response.json({catalog_count:100,catalog:achievementCatalog,identity_verified:true,total_unlocked:0,unlocks:[],available_metrics:['kills_total'],life_metrics:{kills_total:{value:1248,unit:'count'}},account_token:'never-publish-this-field'});
  return Response.json([]);
 },check:async(calls)=>{
  let res=response();await player({method:'GET',query:{id:profileId}},res);
  assert.equal(res.body.achievements_state,'unavailable');assert.ok(!calls.some(c=>c.url.endsWith('get_public_life_achievements_v1')));
  process.env.LIFE_CONTRACT_VERSION='life-v1';res=response();await player({method:'GET',query:{id:profileId}},res);
  assert.equal(res.body.achievements_state,'ready');assert.equal(res.body.life_identity_verified,true);assert.equal(res.body.achievements.catalog.length,100);
  assert.ok(!JSON.stringify(res.body).includes('never-publish-this-field'));
 }});
});

test('nome Steam não provoca consulta a um perfil presumido', async (t) => {
  const mock=t.mock.method(globalThis,'fetch',async()=>{throw new Error('Não consultar nomes sem associação verificada');});
  assert.equal(await getSteamAvatar('Nome qualquer',{env:{}}),null);
  assert.equal(await getSteamAvatar('Nome qualquer',{env:{STEAM_PROFILE_MAP_JSON:'{"Nome qualquer":"https://evil.invalid/"}'}}),null);
  assert.equal(mock.mock.callCount(),0);
});
