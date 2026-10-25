-- Habilitação verificável do frontend sem alterar segredos/configuração da Vercel.
-- Não ativa a coorte de vidas; 005 permanece uma transição separada.
begin;
do $$ begin
 if to_regprocedure('public.close_ranking_season_v2(uuid,uuid)') is null
   or to_regprocedure('public.get_public_player_history_v2(uuid,uuid,integer)') is null
   or to_regclass('public.season_results') is null then raise exception '003 official contract required'; end if;
end $$;
create table if not exists public.dashboard_rollout_state(
 id boolean primary key default true check(id),life_enabled boolean not null default false,
 source_namespace uuid,cohort_started_at timestamptz
);
alter table public.dashboard_rollout_state enable row level security;
revoke all on public.dashboard_rollout_state from public,anon,authenticated;
insert into public.dashboard_rollout_state(id) values(true) on conflict do nothing;
revoke all on public.game_players,public.game_characters,public.ranking_seasons,
 public.player_statistics_current,public.player_stat_snapshots,public.season_winners,
 public.collector_runs,public.collector_locks from public,anon,authenticated;
create or replace function public.get_public_dashboard_release_v1()
returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('competition_rules_version','winx-v1','life_contract_version',case when rollout.life_enabled then 'life-v1' else null end,
   'cohort_started_at',rollout.cohort_started_at,
   'server_time',now(),'collector_interval_seconds',300,'collector_cron_utc','*/5 * * * *',
   'latest_attempt_at',a.started_at,'latest_attempt_status',a.status)
 from public.dashboard_rollout_state rollout left join lateral(select started_at,status from public.collector_runs order by started_at desc,id limit 1) a on true where rollout.id;
$$;
revoke all on function public.get_public_dashboard_release_v1() from public,anon,authenticated;
grant execute on function public.get_public_dashboard_release_v1() to anon,authenticated,service_role;
-- Visitantes não precisam consultar/alterar sequências de tabelas protegidas por RLS.
revoke all on sequence public.player_stat_snapshots_id_seq from public,anon,authenticated;
do $$ begin
 if to_regclass('public.life_observations_id_seq') is not null then
  execute 'revoke all on sequence public.life_observations_id_seq from public,anon,authenticated';
 end if;
end $$;
notify pgrst,'reload schema';
commit;
