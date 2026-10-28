-- Master16: bounded, private, read-only projection. No calendar or data mutation.
begin;
set local lock_timeout='5s';
create or replace function public.get_service_admin_audit_v1(p_before bigint default null,p_limit integer default 20) returns jsonb
language sql stable security definer set search_path='' as $$
 with page as (
  select a.id,a.occurred_at,a.action,a.reason,a.previous_name,a.new_name,s.name season_name
  from public.season_admin_audit_v2 a join public.ranking_seasons s on s.id=a.season_id
  where (p_before is null or a.id<p_before) and (p_before is null or p_before>0)
  order by a.id desc limit greatest(1,least(coalesce(p_limit,20),50))+1
 ), visible as (select * from page order by id desc limit greatest(1,least(coalesce(p_limit,20),50)))
 select jsonb_build_object('contract','admin-audit-v1','checked_at',statement_timestamp(),
  'summary',jsonb_build_object(
   'active_medals',(select count(*) from public.medal_definitions_v2 where active),
   'legacy_definitions',(select count(*) from public.achievement_definitions where not active),
   'legacy_characters',(select count(*) from public.game_characters),
   'native_lives',(select count(*) from public.life_identities),
   'medal_unlocks',(select count(*) from public.medal_unlocks_v2)),
  'events',coalesce((select jsonb_agg(jsonb_build_object(
   'cursor',id::text,'occurred_at',occurred_at,'action',action,'actor','Administrador autenticado',
   'season_name',season_name,'previous_name',previous_name,'new_name',new_name,'result','Registrado',
   -- Omit the entire justification if it could contain credentials or private identifiers.
   'reason',case when reason ~* '(password|senha|token|secret|bearer|api.?key|https?://|[[:alnum:]_.+-]+@[[:alnum:].-]+|[0-9]{17}|[a-f0-9]{24,}|[a-f0-9]{8}-[a-f0-9-]{27,})'
    then 'Justificativa omitida por proteção de dados.' else left(regexp_replace(reason,'[[:cntrl:]]',' ','g'),500) end
  ) order by id desc) from visible),'[]'::jsonb),
  'next_cursor',case when (select count(*) from page)>greatest(1,least(coalesce(p_limit,20),50))
   then (select min(id)::text from visible) else null end);
$$;
revoke all on function public.get_service_admin_audit_v1(bigint,integer) from public,anon,authenticated;
grant execute on function public.get_service_admin_audit_v1(bigint,integer) to service_role;
notify pgrst,'reload schema';
commit;
