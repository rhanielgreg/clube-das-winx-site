-- Master15: additive public DTO restriction and authenticated read-only proof.
-- No season/life/collector data, dates or flags are changed.
begin;
create or replace function public.get_public_rewards_v1() returns jsonb
language sql stable security definer set search_path='' as $$
 select jsonb_build_object('contract','season-rewards-v1','draws',(
  select coalesce(jsonb_agg(to_jsonb(x) order by drawn_at desc),'[]') from (
   select (d.presentation_snapshot->>'season_number')::integer season_number,
    d.presentation_snapshot->>'season_name' season_name,
    d.presentation_snapshot->>'character_name' character_name,
    d.presentation_snapshot->>'steam_username' steam_username,
    d.reward_snapshot->>'name' reward_name,d.rarity,d.drawn_at
   from public.season_reward_draws_v1 d order by d.drawn_at desc limit 100
  ) x));
$$;
revoke all on function public.get_public_rewards_v1() from public;
grant execute on function public.get_public_rewards_v1() to anon,authenticated,service_role;

create or replace function public.get_service_operations_v1() returns jsonb
language sql stable security definer set search_path='' as $$
 select jsonb_build_object('contract','admin-operations-v1','checked_at',statement_timestamp(),
  'source','PostgreSQL catalogs and rollout state; point-in-time read',
  'private_tables_rls',(select bool_and(c.relrowsecurity) from pg_class c join pg_namespace n on n.oid=c.relnamespace
   where n.nspname='public' and c.relname in ('life_identities','life_observations','source_epochs_v2',
    'season_archive_v2','season_reward_draws_v1','reward_delivery_state_v1','reward_delivery_components_v1','reward_events_v1')),
  'private_tables_denied',(select not exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
   cross join (values('anon'),('authenticated')) roles(role_name)
   where n.nspname='public' and c.relname in ('life_identities','life_observations','source_epochs_v2',
    'season_archive_v2','season_reward_draws_v1','reward_delivery_state_v1','reward_delivery_components_v1','reward_events_v1')
    and has_table_privilege(roles.role_name,c.oid,'SELECT,INSERT,UPDATE,DELETE'))),
  'private_rpcs_denied',(select not exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
   cross join (values('anon'),('authenticated')) roles(role_name)
   where n.nspname='public' and p.proname in ('draw_season_reward_v1','record_reward_delivery_v1',
    'get_service_rewards_v1','get_service_recovery_export_v1','get_service_operations_v1','rename_monthly_season_v2','reconcile_months_at_v2')
    and has_function_privilege(roles.role_name,p.oid,'EXECUTE'))),
  'clock_private',not has_function_privilege('service_role','public.reconcile_months_at_v2(timestamptz)','EXECUTE'),
  'monthly_enabled',(select monthly_enabled from public.product14_state where id=true),
  'life_enabled',(select life_enabled from public.dashboard_rollout_state where id=true),
  'source_epochs',(select count(*) from public.source_epochs_v2),
  'native_lives',(select count(*) from public.life_identities),
  'medal_unlocks',(select count(*) from public.medal_unlocks_v2),
  'official_draws',(select count(*) from public.season_reward_draws_v1));
$$;
revoke all on function public.get_service_operations_v1() from public,anon,authenticated;
grant execute on function public.get_service_operations_v1() to service_role;
notify pgrst,'reload schema';
commit;
