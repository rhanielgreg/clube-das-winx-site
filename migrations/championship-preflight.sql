-- SOMENTE LEITURA. Não executado em infraestrutura real nesta missão.
begin read only;
select p.oid::regprocedure signature,pg_get_userbyid(p.proowner) owner,p.proacl,
  pg_get_functiondef(p.oid) definition_for_private_backup
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and p.proname in ('ranking_representatives','get_public_ranking','get_public_player',
  'get_public_seasons','get_public_ranking_status','close_ranking_season','close_ranking_season_v2',
  'get_public_seasons_v2','get_public_player_titles','ingest_player_observation') order by p.proname,p.oid;
select table_name,column_name,data_type,is_nullable from information_schema.columns
where table_schema='public' and table_name in ('game_players','game_characters','ranking_seasons',
 'player_statistics_current','player_stat_snapshots','collector_runs','season_winners','season_results','season_classification')
order by table_name,ordinal_position;
-- Novas tabelas devem estar ausentes na primeira aplicação; se já existem,
-- confirmar proprietário, forma exata e proveniência antes de continuar.
select c.relname,c.relrowsecurity,pg_get_userbyid(c.relowner) owner,c.relacl
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relname in ('season_results','season_classification');
select status,count(*) seasons from public.ranking_seasons group by status;
select count(*) snapshots from public.player_stat_snapshots;
select count(*) winners from public.season_winners;
select max(finished_at) last_success from public.collector_runs where status='success';
commit;
