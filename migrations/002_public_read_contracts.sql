-- Apenas funções de leitura. Não atualiza pontos, snapshots ou campeões.
-- Regra provisória: um representante por jogador; vivo primeiro, depois mais recente.
begin;

create or replace function public.ranking_representatives(p_season_id uuid)
returns table (
  profile_id uuid, season_id uuid, season_name text, rank_position bigint,
  character_name text, steam_username text, alive boolean, kills_total integer,
  kills_firearm integer, kills_melee integer, survival_seconds bigint, last_updated_at timestamptz
)
language sql stable security definer set search_path = '' as $$
  with representatives as (
    select distinct on (c.player_id) c.id profile_id, s.id season_id, s.name season_name,
      c.public_name character_name, p.steam_username, c.alive, st.kills_total,
      st.kills_firearm, st.kills_melee, st.survival_seconds, st.observed_at last_updated_at
    from public.ranking_seasons s
    join public.player_statistics_current st on st.season_id = s.id
    join public.game_characters c on c.id = st.character_id
    join public.game_players p on p.id = c.player_id
    where s.id = p_season_id and st.kills_total is not null
    order by c.player_id, case when c.alive = true then 0 else 1 end,
      c.last_seen_at desc, st.observed_at desc, c.id
  )
  select r.profile_id, r.season_id, r.season_name,
    row_number() over (order by r.kills_total desc nulls last, r.survival_seconds desc nulls last,
      coalesce(r.steam_username, r.character_name), r.profile_id),
    r.character_name, r.steam_username, r.alive, r.kills_total, r.kills_firearm,
    r.kills_melee, r.survival_seconds, r.last_updated_at
  from representatives r;
$$;
revoke all on function public.ranking_representatives(uuid) from public, anon, authenticated;
grant execute on function public.ranking_representatives(uuid) to service_role;

create or replace function public.get_public_ranking(p_limit integer default 100)
returns table (
  profile_id uuid, season_id uuid, season_name text, rank_position bigint,
  character_name text, steam_username text, alive boolean, kills_total integer,
  kills_firearm integer, kills_melee integer, survival_seconds bigint, last_updated_at timestamptz
)
language sql stable security definer set search_path = '' as $$
  select r.* from public.ranking_seasons s
  cross join lateral public.ranking_representatives(s.id) r
  where s.status = 'active' order by r.rank_position
  limit least(greatest(coalesce(p_limit, 100), 1), 250);
$$;

create or replace function public.get_public_player(p_profile_id uuid)
returns table (
  profile_id uuid, season_id uuid, season_name text, rank_position bigint,
  character_name text, steam_username text, alive boolean, kills_total integer,
  kills_firearm integer, kills_melee integer, survival_seconds bigint, last_updated_at timestamptz
)
language sql stable security definer set search_path = '' as $$
  with previous_contract as (
    select c.id profile_id, s.id season_id, s.name season_name,
      row_number() over (partition by s.id order by st.kills_total desc nulls last,
        st.survival_seconds desc nulls last, coalesce(p.steam_username, c.public_name)) old_rank,
      c.public_name character_name, p.steam_username, c.alive, st.kills_total, st.kills_firearm,
      st.kills_melee, st.survival_seconds, st.observed_at last_updated_at, s.status, s.started_at
    from public.ranking_seasons s
    join public.player_statistics_current st on st.season_id = s.id
    join public.game_characters c on c.id = st.character_id
    join public.game_players p on p.id = c.player_id
    where s.status in ('active', 'closed') and st.kills_total is not null
  ), selected as (
    select * from previous_contract where profile_id = p_profile_id
    order by case when status = 'active' then 0 else 1 end, started_at desc, season_id limit 1
  )
  select p.profile_id, p.season_id, p.season_name,
    case when p.status = 'active' then r.rank_position else p.old_rank end,
    p.character_name, p.steam_username, p.alive, p.kills_total, p.kills_firearm,
    p.kills_melee, p.survival_seconds, p.last_updated_at
  from selected p left join lateral public.ranking_representatives(p.season_id) r
    on r.profile_id = p.profile_id
  union all
  -- Mortos já expostos pelo memorial continuam navegáveis sem inventar pontos.
  -- Não amplia a publicação de personagens vivos ainda sem estatísticas.
  select c.id, st.season_id, st.season_name, null::bigint,
    c.public_name, p.steam_username, c.alive, st.kills_total, st.kills_firearm,
    st.kills_melee, st.survival_seconds, coalesce(st.observed_at,c.last_seen_at)
  from public.game_characters c join public.game_players p on p.id=c.player_id
  left join lateral (
    select stats.*, s.name season_name from public.player_statistics_current stats
    join public.ranking_seasons s on s.id=stats.season_id
    where stats.character_id=c.id and s.status in ('active','closed')
    order by case when s.status='active' then 0 else 1 end, s.started_at desc, s.id limit 1
  ) st on true
  where c.id=p_profile_id and c.alive=false and not exists(select 1 from selected);
$$;

-- Novo nome evita ambiguidade de sobrecargas no PostgREST. Função antiga preservada.
create or replace function public.get_public_player_history_v2(
  p_profile_id uuid, p_season_id uuid, p_limit integer default 90
)
returns table (observed_at timestamptz, kills_total integer, survival_seconds bigint, alive boolean)
language sql stable security definer set search_path = '' as $$
  select recent.observed_at, recent.kills_total, recent.survival_seconds, recent.alive
  from (
    select p.id, p.observed_at, p.kills_total, p.survival_seconds, p.alive
    from public.player_stat_snapshots p
    join public.ranking_seasons s on s.id = p.season_id
    where p.character_id = p_profile_id and p.season_id = p_season_id
      and s.status in ('active', 'closed')
    order by p.observed_at desc, p.id desc
    limit least(greatest(coalesce(p_limit, 90), 1), 365)
  ) recent order by recent.observed_at asc, recent.id asc;
$$;

create or replace function public.get_public_graveyard_v2(p_limit integer default 50)
returns table (
  profile_id uuid, season_id uuid, season_name text, character_name text,
  steam_username text, died_at timestamptz, alive boolean, kills_total integer,
  kills_firearm integer, kills_melee integer, survival_seconds bigint, last_updated_at timestamptz
)
language sql stable security definer set search_path = '' as $$
  select c.id, st.season_id, st.season_name, c.public_name, p.steam_username, c.died_at,
    c.alive, st.kills_total, st.kills_firearm, st.kills_melee, st.survival_seconds, st.observed_at
  from public.game_characters c
  join public.game_players p on p.id = c.player_id
  left join lateral (
    select stats.*, s.name season_name from public.player_statistics_current stats
    join public.ranking_seasons s on s.id = stats.season_id
    where stats.character_id = c.id and s.status in ('active', 'closed')
    order by case when s.status = 'active' then 0 else 1 end, s.started_at desc, s.id limit 1
  ) st on true
  where c.alive = false
  order by c.died_at desc nulls last, c.id
  limit least(greatest(coalesce(p_limit, 50), 1), 250);
$$;

revoke all on function public.get_public_ranking(integer), public.get_public_player(uuid),
  public.get_public_player_history_v2(uuid, uuid, integer), public.get_public_graveyard_v2(integer) from public;
grant execute on function public.get_public_ranking(integer), public.get_public_player(uuid),
  public.get_public_player_history_v2(uuid, uuid, integer), public.get_public_graveyard_v2(integer)
  to anon, authenticated, service_role;
notify pgrst, 'reload schema';
commit;
