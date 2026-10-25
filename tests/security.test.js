import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { PGlite } from '@electric-sql/pglite';

const signature = 'public.ingest_player_observation(text,text,text,boolean,text,timestamptz,integer,integer,integer,bigint,text)';
const migration = await readFile(new URL('../migrations/001_restrict_ingestion.sql', import.meta.url), 'utf8');
const check = await readFile(new URL('../migrations/security-check-readonly.sql', import.meta.url), 'utf8');
const invoke = "select public.ingest_player_observation('a','b','c',true,'d',now(),1,0,0,1,'x')";
async function database() {
  const db = new PGlite();
  await db.exec(`create role anon; create role authenticated; create role service_role;
    grant usage on schema public to anon,authenticated,service_role;
    create table local_writes(value integer);
    create function ${signature} returns integer language sql security definer set search_path='' as
      'insert into public.local_writes values (1) returning value';
    grant execute on function ${signature} to service_role;
    create function public.get_public_probe() returns integer language sql security definer as 'select 42';`);
  return db;
}

test('ACL de produção, grants explícitos e execução real: só coletor escreve; leitura permanece', async () => {
  const db = await database();
  try {
    assert.equal((await db.query(`select has_function_privilege('anon',$1,'EXECUTE') allowed`, [signature])).rows[0].allowed,true);
    const body = (await db.query('select pg_get_functiondef($1::regprocedure) definition',[signature])).rows[0].definition;
    await db.exec(`grant execute on function ${signature} to anon,authenticated`);
    const before = (await db.exec(check)).filter((result) => result.fields?.length);
    assert.ok(before[1].rows.length >= 2, 'pré-validação enxerga PUBLIC e grants diretos');
    await db.exec(migration);
    await db.exec(migration);
    const after = (await db.exec(check)).filter((result) => result.fields?.length);
    assert.equal(after[1].rows.length,0);
    assert.deepEqual(after[2].rows,before[2].rows,'leituras intactas');
    for (const role of ['anon','authenticated']) {
      await db.exec(`set role ${role}`);
      await assert.rejects(db.query(invoke), (error) => error.code === '42501');
      assert.equal((await db.query('select get_public_probe() value')).rows[0].value,42);
      await db.exec('reset role');
    }
    await db.exec('set role service_role');
    assert.equal((await db.query(invoke)).rows[0].ingest_player_observation,1);
    await db.exec('reset role');
    assert.equal((await db.query('select count(*) n from local_writes')).rows[0].n,1);
    assert.equal((await db.query('select pg_get_functiondef($1::regprocedure) definition',[signature])).rows[0].definition,body);
  } finally { await db.close(); }
});

for (const noinherit of [false,true]) {
  test(`ingestão aborta e reverte integralmente com herança transitiva${noinherit ? ' NOINHERIT/SET ROLE' : ''}`,async () => {
    const db = await database();
    try {
      await db.exec(`create role ingest_group; create role intermediate;
        grant execute on function ${signature} to ingest_group;
        grant ingest_group to intermediate; grant intermediate to anon;
        ${noinherit ? 'alter role anon noinherit;' : ''}`);
      await assert.rejects(db.exec(migration),/Acesso herdado/);
      await db.exec('rollback');
      const acl = (await db.query('select proacl::text acl from pg_proc where oid=$1::regprocedure',[signature])).rows[0].acl;
      assert.ok(acl.includes('=X/postgres'),'REVOKE parcial não é confirmado');
      assert.equal((await db.query('select count(*) n from local_writes')).rows[0].n,0);
    } finally { await db.close(); }
  });
}

test('membership do visitante em service_role bloqueia a migração sem revogar o coletor', async () => {
  const db = await database();
  try {
    await db.exec('grant service_role to authenticated');
    await assert.rejects(db.exec(migration),/Acesso herdado/);
    await db.exec('rollback');
    assert.equal((await db.query(`select has_function_privilege('service_role',$1,'EXECUTE') allowed`,[signature])).rows[0].allowed,true);
  } finally { await db.close(); }
});
