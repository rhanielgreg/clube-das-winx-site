// Restores the approved private export into ephemeral PostgreSQL, never a DSN.
import {readFile} from 'node:fs/promises';
import {parseRecovery,rehearseRecovery} from './rehearse-recovery.js';
import assert from 'node:assert/strict';
const backup=parseRecovery(await readFile(process.argv[2],'utf8'));
const cutoff=Math.max(...backup.data.player_stat_snapshots.map(r=>Number(r.id)));
if(!Number.isSafeInteger(cutoff))throw Error('Unsafe snapshot cutoff');
const migrations=await Promise.all(['021_weekend_rewards','022_remote_reward_attempts','023_reward_receipts'].map(n=>readFile(new URL('../migrations/'+n+'.sql',import.meta.url),'utf8')));
const proof=await rehearseRecovery(backup,{migrations,inspect:async db=>{
 const value=async sql=>Object.values((await db.query(sql)).rows[0])[0];
 const release=await value('select to_jsonb(s) from roulette_release_v3 s');
 assert.equal(release.weekly_enabled,false);assert.equal(release.remote_enabled,false);
 assert.equal(await value('select count(*) from weekend_reward_draws_v3'),0);
 assert.equal(await value('select count(*) from reward_accounts_v3'),0);
 const snapshots=await value(`select count(*) from player_stat_snapshots where id<=${cutoff}`);
 assert.equal(snapshots,backup.data.player_stat_snapshots.length);
 const catalog=await value("select jsonb_build_object('version',version,'count',jsonb_array_length(definition->'rewards'),'hash',md5(definition::text)) from reward_catalogs_v1 where active");
 assert.equal(catalog.count,24);
 return {snapshotCutoff:cutoff,snapshots,snapshotHash:await value(`select md5(string_agg(md5(to_jsonb(t)::text),'' order by id)) from player_stat_snapshots t where id<=${cutoff}`),
  officialDraws:await value('select count(*) from season_reward_draws_v1'),catalog,release,
  gate:(await value('select get_service_weekend_v3()')).gate};
}});
console.log(JSON.stringify(proof));
