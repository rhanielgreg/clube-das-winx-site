-- Export lógico SOMENTE LEITURA do domínio public da aplicação.
-- Compatível com as migrações 001–008. Salvar fora do Git com ACL local restrita.
-- Preservar o texto bruto do resultado (textContent/export), não innerText:
-- a renderização visual pode colapsar espaços de definições e dados.
-- Não é backup de auth/storage. O commit inicial da 08 contém o export pré-expansão.
begin isolation level repeatable read read only;
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
commit;
