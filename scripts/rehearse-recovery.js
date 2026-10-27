// Restore only into a fresh, ephemeral PGlite instance. No DSN/network option.
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { PGlite } from '@electric-sql/pglite';
const ident=s=>'"'+s.replaceAll('"','""')+'"';
const literal=s=>"'"+s.replaceAll("'","''")+"'";
const role=s=>s==='PUBLIC'?'PUBLIC':ident(s);
// PostgreSQL bigint sequence bounds exceed JS Number's exact integer range.
export const parseRecovery=text=>JSON.parse(text,(key,value,context)=>
 typeof value==='number'&&Number.isInteger(value)&&!Number.isSafeInteger(value)?context.source:value);
const expected=['collector_locks','collector_runs','game_players','game_characters','ranking_seasons',
 'player_statistics_current','player_stat_snapshots','season_winners','season_results','season_classification',
 'life_identities','life_observations','achievement_definitions','life_achievements','dashboard_rollout_state'];
const extensions=['product14_state','season_cycles_v2','season_archive_v2','season_uncertain_intervals_v2',
 'medal_definitions_v2','medal_baselines_v2','medal_unlocks_v2','source_epochs_v2','season_admin_audit_v2',
 'reward_catalogs_v1','season_reward_draws_v1','reward_delivery_state_v1','reward_delivery_components_v1','reward_events_v1'];
function grants(kind,target,entries=[]) {
 return [`revoke all on ${kind} ${target} from public,anon,authenticated,service_role;`,
 ...entries.map(g=>`grant ${g.privilege} on ${kind} ${target} to ${role(g.role)}${g.grantable?' with grant option':''};`)];
}
export async function rehearseRecovery(backup,{migrations=[],inspect}={}) {
 const names=(backup.tables||[]).map(t=>t.name);
 if(backup.schema!=='public'||!expected.every(name=>names.includes(name))||backup.other_relations?.length||backup.memberships?.length
  ||JSON.stringify(Object.keys(backup.data).sort())!==JSON.stringify([...names].sort())
  ||backup.tables.some(t=>![...expected,...extensions].includes(t.name)||t.policies?.length||t.columns.some(c=>c.generated)))
  throw new Error('Unsupported backup scope; manual review required');
 const db=new PGlite();
 try {
  const roles=new Set(['anon','authenticated','service_role']);
  for(const t of backup.tables) for(const g of t.grants||[]) roles.add(g.role);
  for(const f of backup.functions) for(const g of f.grants||[]) roles.add(g.role);
  roles.add(backup.schema_metadata.owner);
  for(const g of backup.schema_metadata.grants||[])roles.add(g.role);
  for(const d of backup.default_privileges) { roles.add(d.owner); for(const g of d.grants||[]) roles.add(g.role); }
  for(const s of backup.sequences) for(const g of s.grants||[])roles.add(g.role);
  const sql=["begin;set timezone='UTC';set check_function_bodies=off;set standard_conforming_strings=on;"];
  for(const r of roles) if(!['PUBLIC','postgres','pg_database_owner'].includes(r)) sql.push(`create role ${ident(r)} nologin${r==='service_role'?' bypassrls':''};`);
  sql.push(...grants('schema','public',backup.schema_metadata.grants));
  for(const t of backup.tables) {
   const cols=t.columns.map(c=>ident(c.name)+' '+c.type+(c.identity?` generated ${c.identity==='a'?'always':'by default'} as identity`
    :c.default!==null?' default '+c.default:'')+(c.not_null?' not null':''));
   sql.push(`create table public.${ident(t.name)} (${cols.join(',')});`);
  }
  for(const t of backup.tables) for(const c of t.constraints) if(c.type!=='f') sql.push(`alter table public.${ident(t.name)} add constraint ${ident(c.name)} ${c.definition};`);
  for(const t of backup.tables) {
   const target='public.'+ident(t.name),cols=t.columns.map(c=>ident(c.name)).join(',');
   sql.push(`insert into ${target} (${cols}) overriding system value select ${cols} from jsonb_populate_recordset(null::${target},${literal(JSON.stringify(backup.data[t.name]))}::jsonb);`);
  }
  for(const t of backup.tables) {
   const target='public.'+ident(t.name);
   for(const c of t.constraints) if(c.type==='f') sql.push(`alter table ${target} add constraint ${ident(c.name)} ${c.definition};`);
   sql.push(...t.indexes.map(i=>i+';'));
   if(t.rls)sql.push(`alter table ${target} enable row level security;`);
   if(t.force_rls)sql.push(`alter table ${target} force row level security;`);
   sql.push(...grants('table',target,t.grants));
  }
  for(const f of backup.functions) sql.push(f.definition+';',...grants('function',f.signature.startsWith('public.')?f.signature:'public.'+f.signature,f.grants));
  for(const t of backup.tables)sql.push(...t.triggers.map(v=>v+';'));
  for(const s of backup.sequences) {
   const target='public.'+ident(s.sequencename);
   sql.push(`alter sequence ${target} as ${s.data_type} increment by ${s.increment_by} minvalue ${s.min_value} maxvalue ${s.max_value} start with ${s.start_value} cache ${s.cache_size} ${s.cycle?'cycle':'no cycle'};`);
   if(s.last_value!==null)sql.push(`select setval(${literal(target)},${s.last_value},true);`);
   sql.push(...grants('sequence',target,s.grants||[]));
  }
  const kinds={r:'tables',S:'sequences',f:'functions',T:'types'};
  for(const d of backup.default_privileges) {
   const prefix=`alter default privileges for role ${role(d.owner)} in schema public`;
   sql.push(`${prefix} revoke all on ${kinds[d.object_type]} from public,anon,authenticated,service_role;`);
   for(const g of d.grants||[])sql.push(`${prefix} grant ${g.privilege} on ${kinds[d.object_type]} to ${role(g.role)}${g.grantable?' with grant option':''};`);
  }
  sql.push('commit;'); await db.exec(sql.join('\n'));
  const counts={};
  for(const t of backup.tables) {
   const target='public.'+ident(t.name);
   const {rows}=await db.query(`with expected as (select to_jsonb(t) value from jsonb_populate_recordset(null::${target},$1::jsonb) t) select not exists((select to_jsonb(t) from ${target} t except all select value from expected) union all (select value from expected except all select to_jsonb(t) from ${target} t)) equal`,[JSON.stringify(backup.data[t.name])]);
   if(!rows[0].equal)throw new Error('Restored rows differ: '+t.name);
   counts[t.name]=backup.data[t.name].length;
  }
  // Replay the snapshot export to compare effective schema, functions and ACLs.
  const exported=await db.query('select public.get_service_recovery_export_v1() as recovery_export');
  const restored=parseRecovery(exported.rows[0].recovery_export);
  for(const key of ['tables','functions','schema_metadata','default_privileges','sequences']) {
   // Role OIDs in ACL strings differ locally; named grant lists are authoritative.
   // PG18 exposes NOT NULL as pg_constraint rows; PG17 exports it through
   // attnotnull only. Compare that column flag, not the redundant PG18 rows.
   const canonical=(v,key='',context='')=>Array.isArray(v)?(['grants','functions','tables','constraints','indexes','triggers','default_privileges','sequences'].includes(key)
    ?(key==='constraints'?v.filter(x=>x.type!=='n'):v).map(x=>canonical(x,'',key||context)).sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b)))
    :v.map(x=>canonical(x,'',key||context)))
    :v&&typeof v==='object'?Object.fromEntries(Object.keys(v).filter(k=>k!=='acl').sort().map(k=>[k,canonical(v[k],k,context)]))
    :typeof v==='string'&&key==='signature'?v.replace(/^public\./,'')
    :typeof v==='string'&&key==='definition'&&context==='constraints'?v.replace(/REFERENCES public\./g,'REFERENCES ')
    :typeof v==='string'&&context==='triggers'?v.replace(/EXECUTE FUNCTION public\./g,'EXECUTE FUNCTION ').replace(/ ON public\./,' ON '):v;
   const normalize=v=>JSON.stringify(canonical(v,key));
   if(normalize(restored[key])!==normalize(backup[key])) {
    const a=canonical(restored[key],key),b=canonical(backup[key],key);
    const difference=(x,y,path)=>{if(JSON.stringify(x)===JSON.stringify(y))return null;if(!x||!y||typeof x!=='object'||typeof y!=='object')return path;
     for(const k of new Set([...Object.keys(x),...Object.keys(y)])){const d=difference(x[k],y[k],path+'.'+k);if(d)return d;}return path;};
    const path=difference(a,b,key);
    const at=(v,p)=>p.split('.').slice(1).reduce((o,k)=>o?.[k],v);
    const actual=at(a,path),source=at(b,path);
    const offset=typeof actual==='string'&&typeof source==='string'?[...actual].findIndex((c,i)=>c!==source[i]):-1;
    throw new Error('Restored metadata differs: '+path+(path.endsWith('.definition')?' ['+String(actual).slice(Math.max(0,offset-30),offset+85)+' / '+String(source).slice(Math.max(0,offset-30),offset+85)+']':''));
   }
  }
  for(const migration of migrations) await db.exec(migration);
  const readiness=(await db.query('select get_service_pipeline_readiness_v1() data')).rows[0].data;
  if(!readiness.contract_ready)throw new Error('Restored pipeline readiness failed');
  const inspection=typeof inspect==='function'?await inspect(db):undefined;
  return {engine:'PGlite ephemeral PostgreSQL',network:'none',tables:counts,functions:backup.functions.length,
   ...(inspection===undefined?{}:{inspection}),
   exact_rows:true,metadata_and_named_grants:true,migrations_rehearsed:migrations.length,contract_ready:true,
   limitation:'Application public schema only; auth/storage and multi-session transport are outside this recovery proof.'};
 } finally { await db.close(); }
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href) {
 try {
  const backup=parseRecovery(await readFile(process.argv[2],'utf8'));
  const migrations=await Promise.all(process.argv.slice(3).map(p=>readFile(p,'utf8')));
  console.log(JSON.stringify(await rehearseRecovery(backup,{migrations})));
 } catch(error) { console.error('Recovery rehearsal failed:',error.message); process.exitCode=1; }
}
