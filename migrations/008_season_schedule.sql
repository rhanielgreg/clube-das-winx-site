-- Proposta da Missão 09. NÃO aplicada automaticamente em produção.
-- Prazo aprovado: 30/11/2026 23h59 America/Sao_Paulo. Encerramento continua manual.
begin;
alter table public.ranking_seasons add column if not exists scheduled_end_at timestamptz;
do $$ begin
 if not exists(select 1 from public.ranking_seasons where id='4ec32a87-fb16-4838-af57-f4cf85425a60' and name='Temporada 1' and status='active') then
   raise exception 'approved active season does not match; review schedule before applying';
 end if;
 if exists(select 1 from public.ranking_seasons where id='4ec32a87-fb16-4838-af57-f4cf85425a60' and scheduled_end_at is not null and scheduled_end_at<>'2026-12-01T02:59:00Z'::timestamptz) then
   raise exception 'existing planned deadline differs; manual review required';
 end if;
 update public.ranking_seasons set scheduled_end_at='2026-12-01T02:59:00Z' where id='4ec32a87-fb16-4838-af57-f4cf85425a60';
end $$;
create or replace function public.get_public_season_schedule_v1(p_season_id uuid)
returns table(season_id uuid,scheduled_end_at timestamptz,closure_mode text)
language sql stable security definer set search_path='' as $$
 select s.id,s.scheduled_end_at,'manual'::text from public.ranking_seasons s
 where s.id=p_season_id and s.status='active' and s.scheduled_end_at is not null;
$$;
revoke all on function public.get_public_season_schedule_v1(uuid) from public;
grant execute on function public.get_public_season_schedule_v1(uuid) to anon,authenticated,service_role;
-- Marcador verificável evita depender de alterações de segredos/env na Vercel.
create or replace function public.get_public_dashboard_release_v1()
returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('competition_rules_version','winx-v1','life_contract_version',case when rollout.life_enabled then 'life-v1' else null end,
   'cohort_started_at',rollout.cohort_started_at,
   'server_time',now(),'collector_interval_seconds',300,'collector_cron_utc','*/5 * * * *',
   'season_schedule_contract_version','season-schedule-v1','latest_attempt_at',a.started_at,'latest_attempt_status',a.status)
 from public.dashboard_rollout_state rollout left join lateral(select started_at,status from public.collector_runs order by started_at desc,id limit 1) a on true where rollout.id;
$$;
revoke all on function public.get_public_dashboard_release_v1() from public,anon,authenticated;
grant execute on function public.get_public_dashboard_release_v1() to anon,authenticated,service_role;
notify pgrst,'reload schema';
commit;
