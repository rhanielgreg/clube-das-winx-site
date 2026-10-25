-- SOMENTE LEITURA. Após 001–005, na sessão privada autorizada do projeto correto.
-- Não chamar ingestão com observações sintéticas na produção.
begin transaction read only;
select public.get_service_pipeline_readiness_v1() as readiness;
select count(*) as definitions, count(distinct id) as unique_definitions
from public.achievement_definitions;
select count(*) as orphaned_awards from public.life_achievements a
left join public.life_identities l on l.id=a.life_id
left join public.achievement_definitions d on d.id=a.achievement_id
where l.id is null or d.id is null;
select count(*) as invented_event_dates from public.life_achievements where occurred_at is not null;
select count(*) as inconsistent_identity_state from public.life_identities l
join public.game_characters c on c.id=l.profile_id where l.alive is distinct from c.alive;
select count(*) as observations, count(distinct life_id) as observed_lives from public.life_observations;
select public.get_public_pipeline_status_v1() as public_sync;
select p.oid::regprocedure as signature,
 has_function_privilege('anon',p.oid,'EXECUTE') as anon_execute,
 has_function_privilege('authenticated',p.oid,'EXECUTE') as authenticated_execute,
 has_function_privilege('service_role',p.oid,'EXECUTE') as collector_execute
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and p.proname in
 ('ingest_player_observation','ingest_life_observation_v1','evaluate_life_achievements_v1','get_service_pipeline_readiness_v1')
order by p.oid::regprocedure::text;
commit;
