-- Prepara a ativação, mas NÃO muda a coorte automaticamente.
-- Ordem: 001–004, 006, 005, 007. Ativar só após lote nativo completo.
begin;
create or replace function public.ranking_representatives(p_season_id uuid)
returns table(profile_id uuid,season_id uuid,season_name text,rank_position bigint,
 character_name text,steam_username text,alive boolean,kills_total integer,kills_firearm integer,kills_melee integer,survival_seconds bigint,last_updated_at timestamptz)
language plpgsql stable security definer set search_path='' as $$ begin
 if exists(select 1 from public.dashboard_rollout_state where id and life_enabled) then
  return query select * from public.ranking_life_representatives_v1(p_season_id);
 else return query select * from public.ranking_legacy_representatives_v1(p_season_id); end if;
end; $$;
create or replace function public.championship_participant_ids_v1(p_season_id uuid)
returns setof uuid language plpgsql stable security definer set search_path='' as $$ begin
 if exists(select 1 from public.dashboard_rollout_state where id and life_enabled) then
  return query select * from public.championship_life_participant_ids_v1(p_season_id);
 else return query select * from public.championship_legacy_participant_ids_v1(p_season_id); end if;
end; $$;
revoke all on function public.ranking_representatives(uuid),public.championship_participant_ids_v1(uuid) from public,anon,authenticated;
grant execute on function public.ranking_representatives(uuid),public.championship_participant_ids_v1(uuid) to service_role;
create or replace function public.activate_verified_cohort_v1(p_source_world_id uuid,p_expected_records integer)
returns jsonb language plpgsql security definer set search_path='' as $$
declare latest public.collector_runs%rowtype; received integer; first_read timestamptz;
begin
 if p_source_world_id is null or p_expected_records is null or p_expected_records<1 then raise exception 'expected source cohort required'; end if;
 if (public.get_service_pipeline_readiness_v1()->>'contract_ready')::boolean is distinct from true then raise exception 'pipeline not ready'; end if;
 select * into latest from public.collector_runs order by started_at desc,id limit 1;
 if latest.status is distinct from 'success' or latest.finished_at<now()-interval '10 minutes' or latest.finished_at>now()+interval '1 minute'
   or latest.records_seen<>p_expected_records then raise exception 'recent complete collector success required'; end if;
 select count(distinct li.id),min(o.observed_at) into received,first_read from public.life_identities li
 join public.life_observations o on o.life_id=li.id and o.observed_at between latest.started_at and latest.finished_at
 where li.world_id=p_source_world_id and li.alive is not null and li.last_observed_at=o.observed_at and li.metrics ? 'kills_total';
 if received<>p_expected_records then raise exception 'native cohort incomplete; legacy competition preserved'; end if;
 update public.dashboard_rollout_state set life_enabled=true,source_namespace=p_source_world_id,
  cohort_started_at=coalesce(cohort_started_at,first_read) where id returning cohort_started_at into first_read;
 return jsonb_build_object('life_contract_version','life-v1','records_verified',received,'cohort_started_at',first_read);
end; $$;
revoke all on function public.activate_verified_cohort_v1(uuid,integer) from public,anon,authenticated;
grant execute on function public.activate_verified_cohort_v1(uuid,integer) to service_role;
notify pgrst,'reload schema';
commit;
