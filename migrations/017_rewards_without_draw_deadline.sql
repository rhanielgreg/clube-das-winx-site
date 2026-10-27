-- A living certified champion never loses draw eligibility through pagination.
begin;
set local lock_timeout='5s';
do $$declare source text;begin
 select pg_get_functiondef('public.get_service_rewards_v1()'::regprocedure) into source;
 -- Preserve the existing shape/security settings; remove only the UI window.
 execute replace(source,' limit 36','');
end $$;
revoke all on function public.get_service_rewards_v1() from public,anon,authenticated;
grant execute on function public.get_service_rewards_v1() to service_role;
notify pgrst,'reload schema';
commit;
