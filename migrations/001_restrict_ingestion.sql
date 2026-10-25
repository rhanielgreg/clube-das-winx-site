-- PREPARADA, NÃO APLICADA. Aprovação e inventário prévio: docs/LOCAL-REVIEW.md.
-- Corrige inclusive sobrecargas esquecidas pelo GRANT/REVOKE de 10 argumentos.
begin;
do $migration$
declare f record; target regprocedure; visitor text;
begin
  if to_regrole('service_role') is null then
    raise exception 'Papel service_role ausente; confirme a autenticação do coletor antes de continuar';
  end if;
  target := to_regprocedure('public.ingest_player_observation(text,text,text,boolean,text,timestamptz,integer,integer,integer,bigint,text)');
  if target is null then
    raise exception 'Contrato de 11 argumentos do coletor não encontrado. Revisão obrigatória.';
  end if;
  if not exists (select 1 from pg_proc where oid = target and prosecdef
                 and proowner = to_regrole('postgres')) then
    raise exception 'Proprietário ou SECURITY DEFINER diverge da auditoria; revisão obrigatória';
  end if;
  for f in select p.oid::regprocedure as signature from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'ingest_player_observation' and p.prokind = 'f'
  loop
    execute format('revoke execute on function %s from public, anon, authenticated', f.signature);
    -- Não ampliar service_role para sobrecargas que o coletor não utiliza.
    if f.signature = target then
      execute format('grant execute on function %s to service_role', f.signature);
    end if;
    foreach visitor in array array['anon', 'authenticated'] loop
      -- has_function_privilege inclui PUBLIC e herança efetiva. MEMBER também
      -- detecta caminhos via SET ROLE, inclusive quando NOINHERIT está presente.
      if has_function_privilege(visitor, f.signature, 'EXECUTE') or exists (
        select 1 from pg_proc p
        cross join lateral aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
        where p.oid = f.signature and a.privilege_type = 'EXECUTE' and a.grantee <> 0
          and pg_has_role(visitor, a.grantee, 'MEMBER')
      ) or exists (
        select 1 from pg_proc p where p.oid = f.signature
          and pg_has_role(visitor, p.proowner, 'MEMBER')
      ) then
        raise exception 'Acesso herdado à ingestão para %. Nenhuma alteração confirmada; revisar memberships/ACL', visitor;
      end if;
    end loop;
  end loop;
  if not has_function_privilege('service_role', target, 'EXECUTE') then
    raise exception 'Permissão necessária ao coletor não preservada';
  end if;
end;
$migration$;
commit;
