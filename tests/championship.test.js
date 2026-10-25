import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { PGlite } from '@electric-sql/pglite';
const season='10000000-0000-4000-8000-000000000001';
const id=(n)=>`20000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
async function setup() {
  const db=new PGlite();
  await db.exec(await readFile(new URL('./fixtures/schema-before.sql',import.meta.url),'utf8'));
  await db.exec(await readFile(new URL('../migrations/championship-preflight.sql',import.meta.url),'utf8'));
  for (const name of ['001_restrict_ingestion.sql','002_public_read_contracts.sql','003_official_championship.sql']) {
    const sql=await readFile(new URL('../migrations/'+name,import.meta.url),'utf8');
    await db.exec(sql); await db.exec(sql);
  }
  await db.exec(`insert into game_players(id,player_key,steam_username) values
    ('00000000-0000-4000-8000-000000000001','a','A'),('00000000-0000-4000-8000-000000000002','b','B');
    insert into ranking_seasons(id,name,slug,status,started_at) values('${season}','Oficial','oficial','active',now()-interval '1 day');
    insert into collector_runs(status,finished_at,records_seen) values('success',now(),4);
    insert into game_characters(id,player_id,character_key,public_name,alive,first_seen_at,last_seen_at,source_blob_sha256) values
    ('${id(1)}','00000000-0000-4000-8000-000000000001','old-a','Mesmo nome',false,now()-interval '1 day',now(),'x'),
    ('${id(2)}','00000000-0000-4000-8000-000000000001','new-a','Mesmo nome',true,now()-interval '2 hours',now(),'x'),
    ('${id(3)}','00000000-0000-4000-8000-000000000002','b','B',true,now()-interval '1 day',now(),'x');
    insert into player_statistics_current(season_id,character_id,kills_total,survival_seconds,observed_at,source_blob_sha256) values
    ('${season}','${id(1)}',9000,99999,now(),'x'),('${season}','${id(2)}',100,200,now(),'x'),('${season}','${id(3)}',500,100,now(),'x');`);
  await db.exec(`insert into player_stat_snapshots(season_id,character_id,kills_total,alive,observed_at,source_blob_sha256)
    select season_id,character_id,kills_total,c.alive,st.observed_at,st.source_blob_sha256
    from player_statistics_current st join game_characters c on c.id=st.character_id;`);
  return db;
}
test('campeão vivo, mesmo offline; ranking/perfil/arquivo consistentes e título imutável',async()=>{
  const db=await setup();
  try {
    const ranked=(await db.query('select * from get_public_ranking(100)')).rows;
    const snapshotsBefore=(await db.query('select * from player_stat_snapshots order by id')).rows;
    assert.deepEqual(ranked.map(r=>r.profile_id),[id(3),id(2)]);
    assert.ok(ranked.every(r=>r.alive===true));
    assert.equal((await db.query('select * from get_public_player($1)',[id(1)])).rows[0].rank_position,null);
    for(const row of ranked) assert.equal((await db.query('select * from get_public_player($1)',[row.profile_id])).rows[0].rank_position,row.rank_position);
    await assert.rejects(db.query('select close_ranking_season($1,$2)',[season,id(1)]),/vencedor informado/);
    assert.equal((await db.query('select count(*) n from season_results')).rows[0].n,0);
    await db.exec('set role service_role');
    const closed=(await db.query('select * from close_ranking_season_v2($1,null)',[season])).rows[0];
    await db.exec('reset role');
    assert.equal(closed.outcome,'champion'); assert.equal(closed.winner_profile_id,id(3));
    // Nenhuma tabela ou condição online: o estado vivo é independente de conexão.
    const archive=await db.query('select * from season_classification order by profile_id');
    assert.equal(archive.rows.length,3);
    await db.exec(`update game_characters set alive=false,public_name='Nome futuro' where id='${id(3)}'`);
    const profile=(await db.query('select * from get_public_player($1)',[id(3)])).rows[0];
    assert.equal(profile.alive,false); assert.equal(Number(profile.rank_position),1); assert.equal(profile.character_name,'B');
    assert.equal((await db.query('select * from get_public_player_titles($1)',[id(3)])).rows[0].winner_name,'B');
    assert.equal((await db.query('select * from get_public_seasons_v2(8)')).rows[0].outcome,'champion');
    await db.exec(await readFile(new URL('../migrations/championship-validate-readonly.sql',import.meta.url),'utf8'));
    assert.deepEqual((await db.query('select * from season_classification order by profile_id')).rows,archive.rows);
    assert.deepEqual((await db.query('select * from player_stat_snapshots order by id')).rows,snapshotsBefore);
    await assert.rejects(db.query('select close_ranking_season($1,null)',[season]),/active season/);
    await db.exec('set role anon');
    assert.equal((await db.query('select * from get_public_seasons_v2(8)')).rows[0].winner_name,'B');
    await assert.rejects(db.query('select * from season_classification'),e=>e.code==='42501');
    await assert.rejects(db.query('select close_ranking_season($1,null)',[season]),e=>e.code==='42501');
  } finally {await db.close();}
});
test('todos mortos encerra sem campeão, preserva pontos e diferencia legado sem resultado',async()=>{
  const db=await setup();
  try {
    await db.exec('update game_characters set alive=false');
    const before=(await db.query('select * from player_statistics_current order by character_id')).rows;
    const closed=(await db.query('select * from close_ranking_season_v2($1,null)',[season])).rows[0];
    assert.equal(closed.outcome,'apocalypse'); assert.equal(closed.winner_profile_id,null);
    assert.equal((await db.query('select count(*) n from season_winners')).rows[0].n,0);
    assert.equal((await db.query('select * from get_public_seasons_v2(8)')).rows[0].outcome,'apocalypse');
    assert.deepEqual((await db.query('select * from player_statistics_current order by character_id')).rows,before);
    await db.exec(`insert into ranking_seasons(name,slug,status,started_at,ended_at) values('Legado','legado','closed',now()-interval '30 days',now()-interval '20 days')`);
    assert.equal((await db.query("select * from get_public_seasons_v2(8) where slug='legado'")).rows[0].outcome,'legacy_unverified');
  }finally{await db.close();}
});
test('morte ou estado desconhecido mais recente não recupera outro registro antigo marcado vivo',async()=>{
 const db=await setup();
 try{
  await db.query("update game_characters set alive=true,last_seen_at=now()-interval '1 hour' where id=$1",[id(1)]);
  for(const state of [false,null]){
   await db.query('update game_characters set alive=$1 where id=$2',[state,id(2)]);
   assert.deepEqual((await db.query('select * from get_public_ranking(100)')).rows.map(r=>r.profile_id),[id(3)]);
  }
 }finally{await db.close();}
});
test('desconhecido, stale, vazio ou vivo sem dados impedem encerramento e falso apocalipse',async()=>{
  const db=await setup();
  try {
    for(const mutation of [
      `update game_characters set alive=null where id='${id(2)}'`,
      "update collector_runs set finished_at=now()-interval '1 hour'",
      "update game_characters set last_seen_at=now()-interval '1 hour'",
      `update player_statistics_current set kills_total=null where character_id='${id(2)}'`,
      'delete from player_statistics_current',
      "insert into collector_runs(status) values('running')",
      "insert into collector_runs(status,finished_at) values('failed',now())",
      "update collector_runs set finished_at=now()+interval '1 hour'",
    ]) {
      await db.exec('begin'); await db.exec(mutation);
      await assert.rejects(db.query('select close_ranking_season($1,null)',[season]),/evidência insuficiente/);
      await db.exec('rollback');
      assert.equal((await db.query('select count(*) n from season_results')).rows[0].n,0);
      assert.equal((await db.query('select status from ranking_seasons where id=$1',[season])).rows[0].status,'active');
    }
    await db.exec(`update game_characters set alive=false; update game_characters set alive=null where id='${id(1)}'`);
    await assert.rejects(db.query('select close_ranking_season($1,null)',[season]),/evidência insuficiente/);
  }finally{await db.close();}
});
test('empates, representantes e vida com chave distinta não herdam pontos do homônimo morto',async()=>{
  const db=await setup();
  try {
    await db.exec(`update player_statistics_current set kills_total=100,survival_seconds=200 where character_id='${id(3)}'`);
    assert.deepEqual((await db.query('select * from get_public_ranking(100)')).rows.map(r=>r.profile_id),[id(2),id(3)]);
    const before=(await db.query('select * from player_statistics_current where character_id=$1',[id(1)])).rows[0];
    const fresh=(await db.query("select ingest_player_observation('a','verified-new-life','Mesmo nome',true,'new',now(),300,10,20,100,'A') id")).rows[0].id;
    const newRow=(await db.query('select * from player_statistics_current where character_id=$1',[fresh])).rows[0];
    assert.equal(newRow.kills_total,0); assert.equal(newRow.baseline_kills_total,300);
    assert.deepEqual((await db.query('select * from player_statistics_current where character_id=$1',[id(1)])).rows[0],before);
    assert.equal((await db.query('select * from get_public_ranking(100)')).rows.filter(r=>r.steam_username==='A').length,1);
    assert.equal((await db.query('select * from get_public_graveyard_v2(50)')).rows.some(r=>r.profile_id===id(1)),true);
    // A origem atual NÃO fornece verified-new-life; teste comprova o contrato,
    // não uma capacidade de separar reutilizações de nome no coletor existente.
  }finally{await db.close();}
});

test('migração oficial aborta se execução administrativa continuar herdada por anon',async()=>{
  const db=await setup();
  try {
    await db.exec(`create role closing_group; grant execute on function close_ranking_season(uuid,uuid) to closing_group; grant closing_group to anon; alter role anon noinherit;`);
    await assert.rejects(db.exec(await readFile(new URL('../migrations/003_official_championship.sql',import.meta.url),'utf8')),/papel público\/herdado/);
    await db.exec('rollback');
    assert.equal((await db.query('select count(*) n from season_results')).rows[0].n,0);
  }finally{await db.close();}
});
