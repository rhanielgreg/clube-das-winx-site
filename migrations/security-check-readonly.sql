-- SOMENTE LEITURA; usar antes E depois de 001, sem depender da migração 002.
-- Rodar como administrador autorizado. Não contém nem solicita chaves.
begin read only;
select p.oid::regprocedure signature, pg_get_userbyid(p.proowner) owner,
  p.prosecdef security_definer, p.proacl,
  has_function_privilege('anon',p.oid,'EXECUTE') anon_execution,
  has_function_privilege('authenticated',p.oid,'EXECUTE') authenticated_execution,
  has_function_privilege('service_role',p.oid,'EXECUTE') collector_execution,
  pg_get_functiondef(p.oid) definition_for_backup
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and p.proname='ingest_player_observation';

-- Após 001: ZERO linhas. Inclui memberships transitivos e NOINHERIT;
-- é uma checagem conservadora de SET ROLE, não altera memberships globais.
select p.oid::regprocedure signature, visitor.name visitor,
  case when a.grantee=0 then 'PUBLIC' else pg_get_userbyid(a.grantee) end access_via
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
cross join (values ('anon'),('authenticated')) visitor(name)
cross join lateral aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a
where n.nspname='public' and p.proname='ingest_player_observation'
  and a.privilege_type='EXECUTE'
  and (a.grantee=0 or pg_has_role(visitor.name,a.grantee,'MEMBER'))
union all
select p.oid::regprocedure, visitor.name, 'OWNER: '||pg_get_userbyid(p.proowner)
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
cross join (values ('anon'),('authenticated')) visitor(name)
where n.nspname='public' and p.proname='ingest_player_observation'
  and pg_has_role(visitor.name,p.proowner,'MEMBER');

-- Comparar antes/depois: ACLs e EXECUTE das leituras devem permanecer iguais.
select p.oid::regprocedure signature, p.proacl,
  has_function_privilege('anon',p.oid,'EXECUTE') anon_read,
  has_function_privilege('authenticated',p.oid,'EXECUTE') authenticated_read
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and p.proname like 'get_public_%'
order by p.oid::regprocedure::text;
commit;
