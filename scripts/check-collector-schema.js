// Ensaio local da origem legítima do coletor; nunca utiliza conexão externa.
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { readFile } from 'node:fs/promises';
const source=new URL('../../clube-das-winx-collector/schema.sql',import.meta.url);
const db=new PGlite();
try {
 await db.exec('create role anon;create role authenticated;create role service_role;');
 const sql=await readFile(source,'utf8');await db.exec(sql);
 const signature='public.ingest_player_observation(text,text,text,boolean,text,timestamptz,integer,integer,integer,bigint,text)';
 assert.equal((await db.query("select has_function_privilege('anon',$1,'execute') allowed",[signature])).rows[0].allowed,false);
 assert.equal((await db.query("select has_function_privilege('service_role',$1,'execute') allowed",[signature])).rows[0].allowed,true);
 await assert.rejects(db.query('select close_ranking_season(gen_random_uuid(),null)'),/official championship migration required/);
 await assert.rejects(db.exec(sql),/empty database required/);await db.exec('rollback');
 assert.equal((await db.query('select count(*) n from game_players')).rows[0].n,0);
 for(const file of ['001_restrict_ingestion','002_public_read_contracts','003_official_championship','004_life_achievements','005_life_read_contracts'])await db.exec(await readFile(new URL('../migrations/'+file+'.sql',import.meta.url),'utf8'));
 assert.equal((await db.query('select get_service_pipeline_readiness_v1() data')).rows[0].data.contract_ready,true);
 await db.exec(await readFile(new URL('../migrations/life-validate-readonly.sql',import.meta.url),'utf8'));
 console.log('Bootstrap do coletor: compilação, assinatura de 11 argumentos, ACL e proteção contra reaplicação aprovadas.');
 console.log('Contrato entre schema do clone legítimo e migrações 001–005 aprovado no PostgreSQL descartável.');
}catch(error){console.error('Bootstrap SQL:',error.message,'SQLSTATE',error.code||'assertion');process.exitCode=1;}
finally{await db.close();}
