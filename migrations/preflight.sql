-- SOMENTE LEITURA. Não executado em serviços compartilhados nesta missão.
begin read only;
select p.oid::regprocedure as signature, p.prosecdef as security_definer,
  pg_get_userbyid(p.proowner) as owner, p.proacl,
  pg_get_functiondef(p.oid) as definition
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname in (
  'ingest_player_observation','get_public_ranking','get_public_player',
  'get_public_player_history','get_public_graveyard','close_ranking_season',
  'ranking_representatives','get_public_player_history_v2','get_public_graveyard_v2'
) order by p.proname, p.oid;

select p.oid::regprocedure as signature,
  case when a.grantee = 0 then 'PUBLIC' else pg_get_userbyid(a.grantee) end as grantee,
  a.privilege_type, a.is_grantable
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
cross join lateral aclexplode(coalesce(p.proacl, acldefault('f',p.proowner))) a
where n.nspname = 'public' and p.proname = 'ingest_player_observation';

select table_name, column_name, data_type from information_schema.columns
where table_schema = 'public' and table_name in (
  'game_players','game_characters','ranking_seasons','player_statistics_current','player_stat_snapshots'
) order by table_name, ordinal_position;

select member.rolname as member, parent.rolname as inherits_role
from pg_auth_members m join pg_roles member on member.oid = m.member
join pg_roles parent on parent.oid = m.roleid
where member.rolname in ('anon','authenticated','service_role') or parent.rolname = 'service_role';
commit;
