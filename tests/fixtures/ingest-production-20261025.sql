-- Definição observada por leitura em 25/10/2026. Sem linhas, contas ou segredos de produção.
-- Colunas adicionais existentes no banco real, ausentes no bootstrap antigo da fixture.
alter table public.player_statistics_current add column baseline_survival_seconds bigint;
alter table public.player_statistics_current add column source_survival_seconds bigint;
CREATE OR REPLACE FUNCTION public.ingest_player_observation(p_player_key text, p_character_key text, p_character_name text, p_alive boolean, p_blob_sha256 text, p_observed_at timestamp with time zone, p_kills_total integer DEFAULT NULL::integer, p_kills_firearm integer DEFAULT NULL::integer, p_kills_melee integer DEFAULT NULL::integer, p_survival_seconds bigint DEFAULT NULL::bigint, p_steam_username text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
 v_player_id uuid;
 v_character_id uuid;
 v_season_id uuid;
 v_current public.player_statistics_current%rowtype;
begin
 if p_kills_total < 0 or p_kills_firearm < 0 or p_kills_melee < 0 or p_survival_seconds < 0 then
 raise exception 'negative statistics are invalid';
 end if;

 insert into public.game_players(player_key, steam_username, last_seen_at)
 values (p_player_key, p_steam_username, p_observed_at)
 on conflict (player_key) do update set
 steam_username = coalesce(excluded.steam_username, public.game_players.steam_username),
 last_seen_at = greatest(public.game_players.last_seen_at, excluded.last_seen_at)
 returning id into v_player_id;

 insert into public.game_characters(player_id, character_key, public_name, alive, first_seen_at, last_seen_at, died_at, source_blob_sha256)
 values (v_player_id, p_character_key, p_character_name, p_alive, p_observed_at, p_observed_at,
 case when p_alive = false then p_observed_at else null end, p_blob_sha256)
 on conflict (character_key) do update set
 public_name = excluded.public_name,
 alive = excluded.alive,
 last_seen_at = greatest(public.game_characters.last_seen_at, excluded.last_seen_at),
 died_at = case when excluded.alive = false then coalesce(public.game_characters.died_at, excluded.last_seen_at) else public.game_characters.died_at end,
 source_blob_sha256 = excluded.source_blob_sha256
 returning id into v_character_id;

 select id into v_season_id from public.ranking_seasons where status = 'active' limit 1;
 if v_season_id is null or p_kills_total is null then return v_character_id; end if;

 insert into public.player_statistics_current(
 season_id, character_id,
 baseline_kills_total, baseline_kills_firearm, baseline_kills_melee, baseline_survival_seconds,
 source_kills_total, source_kills_firearm, source_kills_melee, source_survival_seconds,
 kills_total, kills_firearm, kills_melee, survival_seconds,
 observed_at, source_blob_sha256)
 values (
 v_season_id, v_character_id,
 p_kills_total, p_kills_firearm, p_kills_melee, coalesce(p_survival_seconds, 0),
 p_kills_total, p_kills_firearm, p_kills_melee, coalesce(p_survival_seconds, 0),
 0,
 case when p_kills_firearm is null then null else 0 end,
 case when p_kills_melee is null then null else 0 end,
 0,
 p_observed_at, p_blob_sha256)
 on conflict (season_id, character_id) do update set
 source_kills_total = excluded.source_kills_total,
 source_kills_firearm = excluded.source_kills_firearm,
 source_kills_melee = excluded.source_kills_melee,
 source_survival_seconds = excluded.source_survival_seconds,
 kills_total = greatest(0, excluded.source_kills_total - public.player_statistics_current.baseline_kills_total),
 kills_firearm = case
 when excluded.source_kills_firearm is null or public.player_statistics_current.baseline_kills_firearm is null then null
 else greatest(0, excluded.source_kills_firearm - public.player_statistics_current.baseline_kills_firearm)
 end,
 kills_melee = case
 when excluded.source_kills_melee is null or public.player_statistics_current.baseline_kills_melee is null then null
 else greatest(0, excluded.source_kills_melee - public.player_statistics_current.baseline_kills_melee)
 end,
 survival_seconds = case
 when excluded.source_survival_seconds is null then null
 else greatest(0, excluded.source_survival_seconds - coalesce(public.player_statistics_current.baseline_survival_seconds, 0))
 end,
 observed_at = excluded.observed_at,
 source_blob_sha256 = excluded.source_blob_sha256
 returning * into v_current;

 insert into public.player_stat_snapshots(season_id, character_id, kills_total, kills_firearm, kills_melee,
 survival_seconds, alive, observed_at, source_blob_sha256)
 values (v_season_id, v_character_id, v_current.kills_total, v_current.kills_firearm, v_current.kills_melee,
 v_current.survival_seconds, p_alive, p_observed_at, p_blob_sha256)
 on conflict do nothing;
 return v_character_id;
end;
$function$
