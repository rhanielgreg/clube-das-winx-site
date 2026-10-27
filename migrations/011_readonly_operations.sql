-- Mission 13. Read-only operational RPCs; no data/identity/catalog changes.
begin;
set local lock_timeout='3s';
set local statement_timeout='20s';
do $$ begin
 if to_regprocedure('public.guard_life_identity_metrics_v1()') is null then raise exception '010 required'; end if;
end $$;
alter table public.collector_runs add column if not exists source_diagnostics jsonb;
do $$ begin
 if not exists(select 1 from pg_constraint where conrelid='public.collector_runs'::regclass and conname='collector_source_diagnostics_shape') then
  alter table public.collector_runs add constraint collector_source_diagnostics_shape
   check(source_diagnostics is null or (jsonb_typeof(source_diagnostics)='array' and length(source_diagnostics::text)<=65536));
 end if;
end $$;
create or replace function public.get_service_source_evidence_v1()
returns jsonb language sql stable security definer set search_path='' as $evidence$
 select jsonb_build_object('contract','observational-v1','items',coalesce(jsonb_object_agg(r.key,r.item),'{}'))
 from (select distinct on(e->>'source_scope',e->>'character_token')
  (e->>'source_scope')||':'||(e->>'character_token') key,e item
  from public.collector_runs c cross join lateral jsonb_array_elements(coalesce(c.source_diagnostics,'[]')) e
  where c.status='success' and c.source_diagnostics is not null and jsonb_typeof(e->'life_digest')='string'
  order by e->>'source_scope',e->>'character_token',c.started_at desc,c.id desc) r;
$evidence$;
revoke all on function public.get_service_source_evidence_v1() from public,anon,authenticated;
grant execute on function public.get_service_source_evidence_v1() to service_role;
create or replace function public.get_public_collection_health_v1()
returns jsonb language sql stable security definer set search_path='' as $health$
 with recent as (select status,started_at,finished_at,records_seen,error_code from public.collector_runs order by started_at desc,id desc limit 50),
 latest as (select * from recent order by started_at desc limit 1),
 success as (select max(finished_at) at,max(started_at) started from recent where status='success')
 select jsonb_build_object('contract','collection-health-v1','server_time',now(),'interval_seconds',300,
  'last_success_at',success.at,'latest_attempt_at',latest.started_at,'latest_attempt_finished_at',latest.finished_at,
  'latest_attempt_status',latest.status,'records_seen',latest.records_seen,
  'consecutive_failures',(select count(*) from recent where status='failed' and started_at>coalesce(success.started,'-infinity'::timestamptz)),
  'failure_family',case when latest.status<>'failed' then null
   when latest.error_code in ('source_auth_failed','AuthenticationException') then 'source_authentication'
   when latest.error_code='source_host_key_rejected' then 'source_host_key'
   when latest.error_code in ('source_connection_failed','SSHException','TimeoutError') then 'source_connection'
   when latest.error_code in ('snapshot_invalid','DatabaseError') then 'snapshot'
   when latest.error_code='parser_or_identity_invalid' then 'parser_or_identity'
   when latest.error_code in ('ingestion_failed','HTTPError') then 'ingestion'
   when latest.error_code='evidence_contract_unavailable' then 'contract'
   else 'unclassified' end)
 from success left join latest on true;
$health$;
revoke all on function public.get_public_collection_health_v1() from public;
grant execute on function public.get_public_collection_health_v1() to anon,authenticated,service_role;

-- One stable SQL statement gives a consistent application snapshot over REST.
-- No auth/storage export. Service-only; response is text to preserve bigint JSON.
create or replace function public.get_service_recovery_export_v1()
returns text language sql stable security definer set search_path='' as $recovery$
select jsonb_build_object(
 'exported_at',now(),'server_version',current_setting('server_version'),
 'database',current_database(),'schema','public',
 'schema_metadata',(select jsonb_build_object('owner',pg_get_userbyid(nspowner),'acl',nspacl,
   'grants',(select jsonb_agg(jsonb_build_object('role',case when grantee=0 then 'PUBLIC' else pg_get_userbyid(grantee) end,
      'privilege',privilege_type,'grantable',is_grantable)) from aclexplode(coalesce(nspacl,acldefault('n',nspowner))))) from pg_namespace where nspname='public'),
 'default_privileges',(select coalesce(jsonb_agg(jsonb_build_object('owner',pg_get_userbyid(d.defaclrole),'object_type',d.defaclobjtype,
   'grants',(select jsonb_agg(jsonb_build_object('role',case when grantee=0 then 'PUBLIC' else pg_get_userbyid(grantee) end,
     'privilege',privilege_type,'grantable',is_grantable)) from aclexplode(d.defaclacl)))),'[]') from pg_default_acl d
   where d.defaclnamespace=(select oid from pg_namespace where nspname='public')),
 'tables',(select jsonb_agg(jsonb_build_object('name',c.relname,'owner',pg_get_userbyid(c.relowner),
   'rls',c.relrowsecurity,'force_rls',c.relforcerowsecurity,'acl',c.relacl,
   'columns',(select jsonb_agg(jsonb_build_object('name',a.attname,'type',format_type(a.atttypid,a.atttypmod),
     'not_null',a.attnotnull,'identity',a.attidentity,'generated',a.attgenerated,
     'default',pg_get_expr(d.adbin,d.adrelid)) order by a.attnum)
    from pg_attribute a left join pg_attrdef d on d.adrelid=a.attrelid and d.adnum=a.attnum
    where a.attrelid=c.oid and a.attnum>0 and not a.attisdropped),
   'constraints',(select coalesce(jsonb_agg(jsonb_build_object('name',conname,'type',contype,
     'definition',pg_get_constraintdef(oid,true)) order by conname),'[]') from pg_constraint where conrelid=c.oid),
   'indexes',(select coalesce(jsonb_agg(pg_get_indexdef(i.indexrelid)),'[]') from pg_index i
     where i.indrelid=c.oid and not exists(select 1 from pg_constraint co where co.conindid=i.indexrelid)),
   'grants',(select coalesce(jsonb_agg(jsonb_build_object('role',case when grantee=0 then 'PUBLIC' else pg_get_userbyid(grantee) end,
     'privilege',privilege_type,'grantable',is_grantable)),'[]') from aclexplode(coalesce(c.relacl,acldefault('r',c.relowner)))),
   'policies',(select coalesce(jsonb_agg(jsonb_build_object('name',polname,'command',polcmd,'permissive',polpermissive,
      'roles',(select jsonb_agg(case when r=0 then 'PUBLIC' else pg_get_userbyid(r) end) from unnest(polroles) r),
      'using',pg_get_expr(polqual,polrelid),'check',pg_get_expr(polwithcheck,polrelid))),'[]') from pg_policy where polrelid=c.oid),
   'triggers',(select coalesce(jsonb_agg(pg_get_triggerdef(oid,true)),'[]') from pg_trigger where tgrelid=c.oid and not tgisinternal)
 ) order by c.relname) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind in ('r','p')),
 'functions',(select jsonb_agg(jsonb_build_object('signature',p.oid::regprocedure::text,'definition',pg_get_functiondef(p.oid),
   'owner',pg_get_userbyid(p.proowner),'acl',p.proacl,
   'grants',(select coalesce(jsonb_agg(jsonb_build_object('role',case when grantee=0 then 'PUBLIC' else pg_get_userbyid(grantee) end,
     'privilege',privilege_type,'grantable',is_grantable)),'[]') from aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))))) order by p.oid::regprocedure::text)
   from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.prokind='f'
   and not exists(select 1 from pg_depend d where d.objid=p.oid and d.classid='pg_proc'::regclass and d.deptype='e')),
 'sequences',(select coalesce(jsonb_agg(to_jsonb(s)||jsonb_build_object('grants',
   (select jsonb_agg(jsonb_build_object('role',case when grantee=0 then 'PUBLIC' else pg_get_userbyid(grantee) end,
     'privilege',privilege_type,'grantable',is_grantable)) from aclexplode(coalesce(c.relacl,acldefault('S',c.relowner)))))),'[]')
   from pg_sequences s join pg_namespace n on n.nspname=s.schemaname join pg_class c on c.relnamespace=n.oid and c.relname=s.sequencename where s.schemaname='public'),
 'other_relations',(select coalesce(jsonb_agg(jsonb_build_object('name',c.relname,'kind',c.relkind)),'[]')
   from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind in ('v','m','f')),
 'extensions',(select jsonb_agg(jsonb_build_object('name',e.extname,'version',e.extversion,'schema',n.nspname)) from pg_extension e join pg_namespace n on n.oid=e.extnamespace),
 'role_attributes',(select jsonb_agg(jsonb_build_object('name',rolname,'inherit',rolinherit,'bypassrls',rolbypassrls,'superuser',rolsuper)) from pg_roles where rolname in ('anon','authenticated','service_role','postgres')),
 'memberships',(select coalesce(jsonb_agg(jsonb_build_object('role',pg_get_userbyid(roleid),'member',pg_get_userbyid(member),'admin',admin_option)),'[]') from pg_auth_members where member in (select oid from pg_roles where rolname in ('anon','authenticated','service_role'))),
 'data',jsonb_build_object(
  'game_players',(select coalesce(jsonb_agg(to_jsonb(t) order by id),'[]') from public.game_players t),
  'game_characters',(select coalesce(jsonb_agg(to_jsonb(t) order by id),'[]') from public.game_characters t),
  'ranking_seasons',(select coalesce(jsonb_agg(to_jsonb(t) order by id),'[]') from public.ranking_seasons t),
  'player_statistics_current',(select coalesce(jsonb_agg(to_jsonb(t) order by character_id,season_id),'[]') from public.player_statistics_current t),
  'player_stat_snapshots',(select coalesce(jsonb_agg(to_jsonb(t) order by id),'[]') from public.player_stat_snapshots t),
  'season_winners',(select coalesce(jsonb_agg(to_jsonb(t) order by season_id),'[]') from public.season_winners t),
  'collector_runs',(select coalesce(jsonb_agg(to_jsonb(t) order by id),'[]') from public.collector_runs t),
  'collector_locks',(select coalesce(jsonb_agg(to_jsonb(t) order by lock_name),'[]') from public.collector_locks t),
  'season_results',(select coalesce(jsonb_agg(to_jsonb(t) order by season_id),'[]') from public.season_results t),
  'season_classification',(select coalesce(jsonb_agg(to_jsonb(t) order by season_id,profile_id),'[]') from public.season_classification t),
  'life_identities',(select coalesce(jsonb_agg(to_jsonb(t) order by id),'[]') from public.life_identities t),
  'life_observations',(select coalesce(jsonb_agg(to_jsonb(t) order by id),'[]') from public.life_observations t),
  'achievement_definitions',(select coalesce(jsonb_agg(to_jsonb(t) order by id),'[]') from public.achievement_definitions t),
  'life_achievements',(select coalesce(jsonb_agg(to_jsonb(t) order by life_id,achievement_id),'[]') from public.life_achievements t),
  'dashboard_rollout_state',(select coalesce(jsonb_agg(to_jsonb(t) order by id),'[]') from public.dashboard_rollout_state t)
 ))::text as recovery_export;
$recovery$;
revoke all on function public.get_service_recovery_export_v1() from public,anon,authenticated;
grant execute on function public.get_service_recovery_export_v1() to service_role;
do $$ begin
 if has_function_privilege('anon','public.get_service_recovery_export_v1()','execute')
  or has_function_privilege('authenticated','public.get_service_recovery_export_v1()','execute') then
  raise exception 'backup export must remain private';
 end if;
end $$;
notify pgrst,'reload schema';
commit;
