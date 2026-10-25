-- SOMENTE LEITURA, após 003, em ambiente posteriormente autorizado.
begin read only;
-- Todas as consultas de divergência abaixo devem retornar ZERO linhas.
select * from public.get_public_ranking(250) where alive is distinct from true;
select r.profile_id,r.rank_position ranking,p.rank_position profile
from public.get_public_ranking(250) r cross join lateral public.get_public_player(r.profile_id) p
where r.rank_position is distinct from p.rank_position or p.alive is distinct from true;
select r.season_id,r.outcome from public.season_results r
left join public.season_winners w on w.season_id=r.season_id
left join public.season_classification a on a.season_id=r.season_id and a.profile_id=w.character_id
where r.outcome='champion' and (w.character_id is null or a.alive_at_close is distinct from true or a.rank_position is distinct from 1);
select r.season_id from public.season_results r where r.outcome='apocalypse' and (
  exists(select 1 from public.season_winners w where w.season_id=r.season_id)
  or not exists(select 1 from public.season_classification a where a.season_id=r.season_id)
  or exists(select 1 from public.season_classification a where a.season_id=r.season_id and (a.alive_at_close is distinct from false or a.rank_position is not null))
);
select season_id,profile_id from public.season_classification where rank_position is not null and alive_at_close is distinct from true;
select a.season_id,a.profile_id,a.rank_position archived,p.rank_position displayed
from public.season_classification a cross join lateral public.get_public_player(a.profile_id) p
where p.season_id=a.season_id and p.rank_position is distinct from a.rank_position;
select p.oid::regprocedure signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and p.proname in ('close_ranking_season','close_ranking_season_v2')
  and (has_function_privilege('anon',p.oid,'execute') or has_function_privilege('authenticated',p.oid,'execute'));
-- Resumos para comparar com o inventário anterior, sem divulgar jogadores.
select count(*) snapshots from public.player_stat_snapshots;
select status,count(*) seasons from public.ranking_seasons group by status;
select outcome,count(*) results from public.season_results group by outcome;
commit;
