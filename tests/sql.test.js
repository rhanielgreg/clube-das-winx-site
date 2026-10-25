import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { PGlite } from '@electric-sql/pglite';

test('PostgreSQL em memória: regressões de ACL, representantes, histórico e cemitério', async () => {
  const db = new PGlite();
  try {
    await db.exec(await readFile(new URL('./fixtures/schema-before.sql', import.meta.url), 'utf8'));
    await db.exec(`
      insert into game_players(id,player_key,steam_username) values
      ('00000000-0000-4000-8000-000000000001','a','Conta A'),('00000000-0000-4000-8000-000000000002','b','Conta B');
      insert into ranking_seasons(id,name,slug,status,started_at,ended_at) values
      ('10000000-0000-4000-8000-000000000001','Atual','atual','active','2026-10-20',null),
      ('10000000-0000-4000-8000-000000000002','Anterior','anterior','closed','2026-09-20','2026-10-19');
      insert into game_characters(id,player_id,character_key,public_name,alive,first_seen_at,last_seen_at,died_at,source_blob_sha256) values
      ('20000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000001','a1','Mesmo nome',false,'2026-10-20','2026-10-23','2026-10-23','x'),
      ('20000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000001','a2','Mesmo nome',true,'2026-10-20','2026-10-24',null,'x'),
      ('20000000-0000-4000-8000-000000000003','00000000-0000-4000-8000-000000000002','b1','Terceiro',true,'2026-10-20','2026-10-24',null,'x');
      insert into player_statistics_current(season_id,character_id,kills_total,survival_seconds,observed_at,source_blob_sha256)
      select '10000000-0000-4000-8000-000000000001',id,case character_key when 'a1' then 900 when 'a2' then 100 else 500 end,100,'2026-10-24','x' from game_characters;
      insert into player_stat_snapshots(season_id,character_id,kills_total,observed_at,source_blob_sha256)
      select '10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000002',i,'2026-10-20'::timestamptz+i*interval '5 minutes','x' from generate_series(1,120) i;
      insert into player_stat_snapshots(season_id,character_id,kills_total,observed_at,source_blob_sha256)
      values ('10000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000002',9999,'2026-10-25','old-season');
    `);
    const char = '20000000-0000-4000-8000-000000000002';
    const season = '10000000-0000-4000-8000-000000000001';
    const oldHistory = (await db.query('select * from get_public_player_history($1,90)', [char])).rows;
    assert.equal(oldHistory.length, 90);
    assert.equal(oldHistory.at(-1).kills_total, 90, 'reproduz o truncamento dos registros recentes');
    const oldRanking = (await db.query('select * from get_public_ranking(100)')).rows;
    const oldProfile = (await db.query('select * from get_public_player($1)', [char])).rows[0];
    assert.equal(Number(oldRanking.find((p) => p.profile_id === char).rank_position), 2);
    assert.equal(Number(oldProfile.rank_position), 3, 'reproduz a divergência de população');
    const functionName = 'public.ingest_player_observation(text,text,text,boolean,text,timestamp with time zone,integer,integer,integer,bigint,text)';
    await db.exec(`create function public.ingest_player_observation(text,text,text,boolean,text,timestamptz,integer,integer,integer,bigint)
      returns uuid language sql security definer as 'select null::uuid';`);
    const legacyFunction = 'public.ingest_player_observation(text,text,text,boolean,text,timestamptz,integer,integer,integer,bigint)';
    assert.equal((await db.query('select has_function_privilege(\'anon\',$1,\'execute\') allowed', [functionName])).rows[0].allowed, true);
    const before = await db.query('select * from player_stat_snapshots order by id');
    const scoresBefore = await db.query('select * from player_statistics_current order by character_id');
    const closeBefore = (await db.query("select pg_get_functiondef('public.close_ranking_season(uuid,uuid)'::regprocedure) definition")).rows[0].definition;
    await db.exec(await readFile(new URL('../migrations/preflight.sql',import.meta.url),'utf8'));
    for (const name of ['001_restrict_ingestion.sql', '002_public_read_contracts.sql']) {
      const sql = await readFile(new URL(`../migrations/${name}`, import.meta.url), 'utf8');
      await db.exec(sql);
      await db.exec(sql); // idempotência
    }
    await db.exec(await readFile(new URL('../migrations/validate-readonly.sql',import.meta.url),'utf8'));
    for (const role of ['anon', 'authenticated']) {
      assert.equal((await db.query(`select has_function_privilege('${role}',$1,'execute') allowed`, [functionName])).rows[0].allowed, false);
      assert.equal((await db.query(`select has_function_privilege('${role}',$1,'execute') allowed`, [legacyFunction])).rows[0].allowed, false);
    }
    assert.equal((await db.query("select has_function_privilege('service_role',$1,'execute') allowed", [functionName])).rows[0].allowed, true);
    assert.equal((await db.query("select has_function_privilege('service_role',$1,'execute') allowed", [legacyFunction])).rows[0].allowed, false, 'não amplia permissão para sobrecarga legada');
    const rows = (await db.query('select * from get_public_ranking(100)')).rows;
    assert.equal(rows.length, 2, 'somente um representante por conta');
    assert.equal(rows[1].profile_id, char, 'vivo tem prioridade mesmo com menos kills');
    const profile = (await db.query('select * from get_public_player($1)', [char])).rows[0];
    assert.equal(profile.rank_position, rows[1].rank_position);
    const archived = (await db.query("select * from get_public_player('20000000-0000-4000-8000-000000000001')")).rows[0];
    assert.equal(archived.rank_position, null, 'personagem não representante não recebe posição da disputa atual');
    const history = (await db.query('select * from get_public_player_history_v2($1,$2,90)', [char, season])).rows;
    assert.equal(history.length, 90);
    assert.equal(history[0].kills_total, 31);
    assert.equal(history.at(-1).kills_total, 120);
    assert.ok(history.every((p, i) => i === 0 || p.observed_at >= history[i - 1].observed_at));
    const dead = (await db.query('select * from get_public_graveyard_v2(50)')).rows;
    assert.equal(dead.length, 1);
    assert.equal(dead[0].alive, false);
    assert.equal(dead[0].character_name, 'Mesmo nome');
    await db.exec(`begin; update game_characters set last_seen_at='2026-10-26' where character_key='a1';`);
    assert.equal((await db.query('select * from get_public_ranking(100)')).rows[1].profile_id,char,'vivo prevalece mesmo com morto mais recente');
    await db.exec("update game_characters set alive=false where character_key='a2'");
    assert.equal((await db.query('select * from get_public_ranking(100)')).rows[0].profile_id,'20000000-0000-4000-8000-000000000001','se todos mortos, escolhe mais recente da conta');
    await db.exec('rollback');
    await db.exec(`begin; insert into player_stat_snapshots(season_id,character_id,kills_total,observed_at,source_blob_sha256)
      select season_id, character_id, 121, observed_at, 'tie' from player_stat_snapshots where kills_total=120;`);
    assert.equal((await db.query('select * from get_public_player_history_v2($1,$2,1)',[char,season])).rows[0].kills_total,121,'ID desempata coletas simultâneas');
    await db.exec('rollback');
    await db.exec(`begin; insert into game_characters(id,player_id,character_key,public_name,alive,first_seen_at,last_seen_at,source_blob_sha256)
      values ('20000000-0000-4000-8000-000000000009','00000000-0000-4000-8000-000000000001','no-stats','Sem estatísticas',false,'2026-10-20','2026-10-24','x');`);
    const incomplete = (await db.query("select * from get_public_player('20000000-0000-4000-8000-000000000009')")).rows[0];
    assert.equal(incomplete.alive,false);
    assert.equal(incomplete.kills_total,null);
    assert.equal(incomplete.season_id,null);
    assert.equal(incomplete.rank_position,null);
    assert.equal((await db.query('select * from get_public_ranking(100)')).rows.length,2);
    await db.exec("update game_characters set alive=true where character_key='no-stats'");
    assert.equal((await db.query("select * from get_public_player('20000000-0000-4000-8000-000000000009')")).rows.length,0,'não amplia perfil sem métricas de vivos');
    await db.exec('rollback');
    await db.exec(`begin; update ranking_seasons set status='closed',ended_at='2026-10-25' where id='${season}';`);
    assert.equal((await db.query('select * from get_public_ranking(100)')).rows.length,0);
    assert.equal(Number((await db.query('select * from get_public_player($1)',[char])).rows[0].rank_position),3,'classificação arquivada mantém população anterior; regra de campeão não muda');
    await db.exec('rollback');
    await db.exec('set role anon');
    assert.equal((await db.query('select * from get_public_ranking(100)')).rows.length, 2, 'leitura pública preservada');
    assert.equal((await db.query('select * from get_public_player_history_v2($1,$2,90)', [char,season])).rows.length, 90);
    await assert.rejects(db.query('select * from ranking_representatives($1)', [season]), /permission denied/);
    await db.exec('reset role');
    assert.deepEqual((await db.query('select * from player_stat_snapshots order by id')).rows, before.rows);
    assert.deepEqual((await db.query('select * from player_statistics_current order by character_id')).rows, scoresBefore.rows);
    assert.equal((await db.query("select pg_get_functiondef('public.close_ranking_season(uuid,uuid)'::regprocedure) definition")).rows[0].definition, closeBefore);
  } finally { await db.close(); }
});

test('migração de ingestão falha sem contrato comprovado e não concede acesso', async () => {
  const db = new PGlite();
  try {
    await db.exec('create role anon; create role authenticated; create role service_role;');
    await assert.rejects(db.exec(await readFile(new URL('../migrations/001_restrict_ingestion.sql',import.meta.url),'utf8')), /11 argumentos/);
    await db.exec('rollback');
    assert.equal((await db.query("select count(*) from pg_proc where proname='ingest_player_observation'")).rows[0].count,0);
  } finally { await db.close(); }
});
