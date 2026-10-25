-- PREPARADA: requer 004. Apenas leituras públicas, sem backfill de identidade.
begin;
-- Ativação da coorte de vidas certificadas: legados ambíguos ficam preservados,
-- mas não entram na nova competição. Implantar só com a origem v1 pronta.
create or replace function public.championship_participant_ids_v1(p_season_id uuid)
returns setof uuid language sql stable security definer set search_path='' as $$
 select c.id from public.game_characters c join public.life_identities li on li.profile_id=c.id
 join public.ranking_seasons s on s.id=p_season_id
 where c.last_seen_at>=s.started_at or exists(select 1 from public.player_statistics_current st where st.season_id=s.id and st.character_id=c.id);
$$;
revoke all on function public.championship_participant_ids_v1(uuid) from public,anon,authenticated;
grant execute on function public.championship_participant_ids_v1(uuid) to service_role;
create or replace function public.ranking_representatives(p_season_id uuid)
returns table(profile_id uuid,season_id uuid,season_name text,rank_position bigint,
 character_name text,steam_username text,alive boolean,kills_total integer,kills_firearm integer,kills_melee integer,survival_seconds bigint,last_updated_at timestamptz)
language sql stable security definer set search_path='' as $$
 with representatives as (
  select distinct on(c.player_id) c.id profile_id,s.id season_id,s.name season_name,c.public_name character_name,
   p.steam_username,c.alive,st.kills_total,st.kills_firearm,st.kills_melee,st.survival_seconds,st.observed_at last_updated_at
  from public.ranking_seasons s join public.player_statistics_current st on st.season_id=s.id
  join public.game_characters c on c.id=st.character_id join public.game_players p on p.id=c.player_id
  join public.life_identities li on li.profile_id=c.id
  where s.id=p_season_id and s.status='active' and c.alive is true and st.kills_total is not null
  order by c.player_id,c.last_seen_at desc,st.observed_at desc,c.id
 ) select r.profile_id,r.season_id,r.season_name,row_number() over(order by r.kills_total desc,r.survival_seconds desc nulls last,r.profile_id),
  r.character_name,r.steam_username,r.alive,r.kills_total,r.kills_firearm,r.kills_melee,r.survival_seconds,r.last_updated_at from representatives r;
$$;
create or replace function public.get_public_ranking_life_v1(p_limit integer default 100)
returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(to_jsonb(r)||jsonb_build_object('life_identity_verified',li.id is not null,
  'distance_total_m',case when li.metrics->'distance_total_m'->>'unit'='meters' then li.metrics->'distance_total_m'->'value' else null end,
  'distance_unit','meters','kills_vehicle',st.kills_vehicle,'kills_other',st.kills_other) order by r.rank_position),'[]')
 from public.get_public_ranking(p_limit) r
 left join public.life_identities li on li.profile_id=r.profile_id
 left join public.player_statistics_current st on st.season_id=r.season_id and st.character_id=r.profile_id;
$$;
create or replace function public.get_public_graveyard_life_v1(p_limit integer default 50)
returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(to_jsonb(r)||jsonb_build_object('life_identity_verified',li.id is not null,
  'distance_total_m',case when li.metrics->'distance_total_m'->>'unit'='meters' then li.metrics->'distance_total_m'->'value' else null end,
  'distance_unit','meters') order by r.died_at desc nulls last,r.profile_id),'[]')
 from public.get_public_graveyard_v2(p_limit) r left join public.life_identities li on li.profile_id=r.profile_id;
$$;
create or replace function public.get_public_memorial_honors_v1()
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare category record; result jsonb:='[]'; top_value numeric; winners jsonb; incomplete boolean;
begin
 for category in select * from (values
  ('exterminador','kills_total','count'),('lenda','survival_world_days','world_days'),('andarilho','distance_total_m','meters')
 ) categories(id,metric,unit) loop
  select exists(select 1 from public.game_characters c left join public.life_identities li on li.profile_id=c.id
   where c.alive=false and (li.id is null or li.alive is distinct from false or li.metrics->category.metric->>'coverage' is distinct from 'complete_life'
    or li.metrics->category.metric->>'unit' is distinct from category.unit
    or li.metrics->category.metric->'observed_at' is distinct from to_jsonb(li.last_observed_at))) into incomplete;
  top_value:=null; winners:='[]';
  if not incomplete then
   select max((li.metrics->category.metric->>'value')::numeric) into top_value
   from public.game_characters c join public.life_identities li on li.profile_id=c.id where c.alive=false;
   if top_value is not null then
    select jsonb_agg(jsonb_build_object('profile_id',c.id,'character_name',c.public_name) order by c.id) into winners
    from public.game_characters c join public.life_identities li on li.profile_id=c.id
    where c.alive=false and (li.metrics->category.metric->>'value')::numeric=top_value;
   end if;
  end if;
  result:=result||jsonb_build_array(jsonb_build_object('category',category.id,'state',case when incomplete then 'pending_evidence' when top_value is null then 'no_records' else 'ready' end,
   'metric',category.metric,'unit',category.unit,'value',top_value,'winners',winners));
 end loop;
 return result;
end; $$;
revoke all on function public.get_public_ranking_life_v1(integer),public.get_public_graveyard_life_v1(integer),public.get_public_memorial_honors_v1() from public;
grant execute on function public.get_public_ranking_life_v1(integer),public.get_public_graveyard_life_v1(integer),public.get_public_memorial_honors_v1() to anon,authenticated,service_role;

-- Mantém as operações mutantes identificadas restritas, inclusive em bootstrap.
do $permissions$
declare f record;
begin
 for f in select p.oid::regprocedure signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname='public' and p.proname in ('start_ranking_season','acquire_collector_lock','release_collector_lock') loop
  execute format('revoke all on function %s from public,anon,authenticated',f.signature);
  execute format('grant execute on function %s to service_role',f.signature);
 end loop;
end; $permissions$;

create or replace function public.get_service_pipeline_readiness_v1()
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare unsafe boolean; rls_ok boolean; catalog_count integer; paths_ok boolean;
begin
 select exists(
  select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  cross join (values('anon'),('authenticated')) visitor(name)
  where n.nspname='public' and p.proname in ('ingest_player_observation','ingest_life_observation_v1','evaluate_life_achievements_v1',
   'start_ranking_season','close_ranking_season','close_ranking_season_v2','acquire_collector_lock','release_collector_lock')
  and (has_function_privilege(visitor.name,p.oid,'execute') or pg_has_role(visitor.name,p.proowner,'MEMBER') or exists(
   select 1 from aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a where a.grantee<>0 and a.privilege_type='EXECUTE' and pg_has_role(visitor.name,a.grantee,'MEMBER')
  ))
 ) into unsafe;
 select count(*)=14 and bool_and(c.relrowsecurity) and bool_and(not has_table_privilege('anon',c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') and not has_table_privilege('authenticated',c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')) into rls_ok
 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname in (
 'game_players','game_characters','ranking_seasons','player_statistics_current','player_stat_snapshots','season_winners','collector_runs','collector_locks',
 'life_identities','life_observations','achievement_definitions','life_achievements','season_results','season_classification');
 select not exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.prosecdef and p.proname in ('ingest_player_observation','ingest_life_observation_v1','evaluate_life_achievements_v1','close_ranking_season','close_ranking_season_v2','get_public_life_achievements_v1')
  and (p.proowner<>to_regrole('postgres') or not exists(select 1 from unnest(coalesce(p.proconfig,'{}')) setting where setting in ('search_path=""','search_path=')))) into paths_ok;
 select count(*) into catalog_count from public.achievement_definitions;
 return jsonb_build_object('schema_version','life-v1','catalog_count',catalog_count,
  'contract_ready',not unsafe and rls_ok and paths_ok and catalog_count=100,
  'public_write_access',unsafe,'rls_and_grants_ok',rls_ok,'definer_owner_and_path_ok',paths_ok,
  'verified_life_count',(select count(*) from public.life_identities),
  'last_verified_observation_at',(select max(last_observed_at) from public.life_identities),
  'latest_attempt_status',(select status from public.collector_runs order by started_at desc,id limit 1),
  'last_collector_success_at',(select max(finished_at) from public.collector_runs where status='success'));
end; $$;
revoke all on function public.get_service_pipeline_readiness_v1() from public,anon,authenticated;
grant execute on function public.get_service_pipeline_readiness_v1() to service_role;
do $guard$
begin
 if (public.get_service_pipeline_readiness_v1()->>'contract_ready')::boolean is distinct from true then
  raise exception 'pipeline permissions, ownership, search_path or catalog require review';
 end if;
end; $guard$;

create or replace function public.get_public_pipeline_status_v1()
returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('last_success_at',r.last_success_at,'latest_attempt_status',a.status,'latest_attempt_at',a.started_at)
 from (select max(finished_at) last_success_at from public.collector_runs where status='success') r
 left join lateral(select status,started_at from public.collector_runs order by started_at desc,id limit 1) a on true;
$$;
revoke all on function public.get_public_pipeline_status_v1() from public;
grant execute on function public.get_public_pipeline_status_v1() to anon,authenticated,service_role;
notify pgrst,'reload schema';
commit;
