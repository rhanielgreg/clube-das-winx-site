-- Executar apenas após autorização e aplicação das migrações no ambiente aprovado.
begin read only;
select p.oid::regprocedure as signature,
  has_function_privilege('anon',p.oid,'EXECUTE') as anon_must_be_false,
  has_function_privilege('authenticated',p.oid,'EXECUTE') as authenticated_must_be_false,
  -- Obrigatório na assinatura de 11 argumentos; não ampliar grants de legadas.
  has_function_privilege('service_role',p.oid,'EXECUTE') as collector_execution
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname = 'ingest_player_observation';

-- Deve retornar ZERO divergências entre representantes e seus perfis.
select r.profile_id, r.rank_position ranking_position, p.rank_position profile_position
from public.get_public_ranking(250) r
cross join lateral public.get_public_player(r.profile_id) p
where r.rank_position is distinct from p.rank_position;

-- Deve retornar ZERO estados diferentes de morto.
select * from public.get_public_graveyard_v2(250) where alive is distinct from false;

-- Última amostra da RPC deve coincidir com a última amostra disponível na mesma temporada.
-- Resumo atual pode ser mais recente por razões distintas de ingestão; não comparar só kills.
select r.profile_id, r.season_id,
  (select max(h.observed_at) from public.get_public_player_history_v2(r.profile_id,r.season_id,90) h) last_returned,
  (select max(s.observed_at) from public.player_stat_snapshots s
    where s.character_id = r.profile_id and s.season_id = r.season_id) last_stored
from public.get_public_ranking(250) r;
commit;
