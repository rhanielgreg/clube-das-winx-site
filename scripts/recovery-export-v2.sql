-- Private, read-only, complete public schema export after migration015.
-- Save raw textContent to the existing protected backup directory, outside Git.
begin isolation level repeatable read read only;
set local role service_role;
select public.get_service_recovery_export_v1() as recovery_export;
commit;
