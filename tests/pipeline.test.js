import assert from 'node:assert/strict';
import test from 'node:test';
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import player from '../api/player.js';
import { achievementPanel } from '../public/achievement-panel.js';

const collector=fileURLToPath(new URL('../../clube-das-winx-collector/',import.meta.url));
test('integração local: coletor Python real → ingestão SQL → API → medalhas do dossiê',{
 skip:!existsSync(collector+'verified_life.py')?'clone legítimo irmão do coletor necessário para esta integração':false,
},async(t)=>{
 const source=String.raw`
import json,hashlib
from pathlib import Path
from test_verified_life import signed,KEY
from verified_life import extract_verified
from stats import ttf_observation_counters
sample=json.loads(Path('fixtures/ttf_only.json').read_text())[0]
blob=bytes.fromhex(sample['ttf_only_hex'])
counters=ttf_observation_counters(blob)
digest=hashlib.sha256(json.dumps(counters,sort_keys=True,separators=(',',':')).encode()).hexdigest()
envelope=signed(metrics={},ttf_counters_are_lifetime=True,ttf_metrics_digest=digest,ttf_coverage='complete_life')
print(json.dumps(extract_verified([('Conta','Nome',0,blob)],'local-fixture-salt',KEY,read_envelope=lambda _:envelope)[0]))
`;
 const observation=JSON.parse(execFileSync('python',['-B','-c',source],{cwd:collector,encoding:'utf8'}));
 const db=new PGlite();
 const env={SUPABASE_URL:'https://local-test.invalid',SUPABASE_PUBLISHABLE_KEY:'sb_publishable_fixture',COMPETITION_RULES_VERSION:'winx-v1',LIFE_CONTRACT_VERSION:'life-v1',STEAM_PROFILE_MAP_JSON:'{}'};
 const previous=Object.fromEntries(Object.keys(env).map(key=>[key,process.env[key]]));
 Object.assign(process.env,env);
 try {
  await db.exec(await readFile(new URL('./fixtures/schema-before.sql',import.meta.url),'utf8'));
  for(const file of ['001_restrict_ingestion','002_public_read_contracts','003_official_championship','004_life_achievements','005_life_read_contracts']) await db.exec(await readFile(new URL('../migrations/'+file+'.sql',import.meta.url),'utf8'));
  await db.exec("insert into ranking_seasons(name,slug) values('Integração','integracao')");
  const args=['p_world_id','p_account_token','p_life_token','p_character_name','p_steam_username','p_alive','p_observed_at','p_source_sha256','p_metrics'].map(key=>observation[key]);
  const profile=(await db.query('select ingest_life_observation_v1($1,$2,$3,$4,$5,$6,$7,$8,$9) id',args)).rows[0].id;
  assert.equal((await db.query('select get_public_ranking_life_v1() data')).rows[0].data[0].profile_id,profile);
  t.mock.method(globalThis,'fetch',async(url,options)=>{
   const name=new URL(url).pathname.split('/').at(-1),body=JSON.parse(options.body);
   // Simula somente o transporte PostgREST; funções e papéis são executados pelo PostgreSQL local.
   const calls={get_public_player:['select * from get_public_player($1)',[body.p_profile_id]],get_public_player_history_v2:['select * from get_public_player_history_v2($1,$2,$3)',[body.p_profile_id,body.p_season_id,body.p_limit]],get_public_player_titles:['select * from get_public_player_titles($1)',[body.p_profile_id]],get_public_life_achievements_v1:['select get_public_life_achievements_v1($1) data',[body.p_profile_id]]};
   assert.ok(calls[name],name);
   const [sql,params]=calls[name];await db.exec('set role anon');
   try {const rows=(await db.query(sql,params)).rows;return Response.json(name==='get_public_life_achievements_v1'?rows[0].data:rows);}finally{await db.exec('reset role');}
  });
  const res={setHeader(){},status(code){this.code=code;return this;},json(body){this.body=body;return this;}};
  await player({method:'GET',query:{id:profile}},res);
  assert.equal(res.code,200);assert.equal(res.body.life_identity_verified,true);assert.ok(res.body.achievements.total_unlocked>0);
  assert.equal(res.body.profile.kills_total,0,'primeira leitura é baseline sazonal, não soma vitalícia');
  assert.equal(res.body.achievements.life_metrics.kills_total.value,observation.p_metrics.kills_total.value);
  assert.equal(res.body.achievements.life_metrics.kills_vehicle.value,observation.p_metrics.kills_vehicle.value);
  assert.equal(res.body.achievements.life_history.length,1);
  const html=achievementPanel(res.body.achievements);
  assert.ok(html.includes('Desbloqueada'));assert.ok(html.includes('Evidência coletada em'));assert.ok(html.includes('Data exata do feito desconhecida'));
  assert.ok(!JSON.stringify(res.body).includes(observation.p_account_token));
 }finally{
  for(const [key,value] of Object.entries(previous))if(value===undefined)delete process.env[key];else process.env[key]=value;
  await db.close();
 }
});
