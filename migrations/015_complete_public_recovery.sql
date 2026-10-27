-- Extend the private read-only export as new application tables are installed.
begin;
do $$declare source text;begin
 if to_regprocedure('public.get_service_recovery_export_base14()') is null then
  select pg_get_functiondef('public.get_service_recovery_export_v1()'::regprocedure) into source;
  execute replace(source,'public.get_service_recovery_export_v1()','public.get_service_recovery_export_base14()');
 end if;
end $$;
revoke all on function public.get_service_recovery_export_base14() from public,anon,authenticated,service_role;
create or replace function public.get_service_recovery_export_v1() returns text
language plpgsql stable security definer set search_path='' as $$
declare exported jsonb;table_name text;table_data jsonb;begin
 exported:=public.get_service_recovery_export_base14()::jsonb;
 for table_name in select c.relname from pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public' and c.relkind in('r','p') and not (exported->'data')?c.relname loop
  execute format('select coalesce(jsonb_agg(to_jsonb(t)),''[]''::jsonb) from public.%I t',table_name) into table_data;
  exported:=jsonb_set(exported,array['data',table_name],table_data,true);
 end loop;
 return exported::text;
end $$;
revoke all on function public.get_service_recovery_export_v1() from public,anon,authenticated;
grant execute on function public.get_service_recovery_export_v1() to service_role;
notify pgrst,'reload schema';
commit;
