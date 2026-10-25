-- PREPARADA. Somente executar futuramente em ambiente autorizado, após 001 e 002.
-- Não reclassifica temporadas antigas nem altera ingestão/identidade das vidas.
begin;
create table if not exists public.season_results (
  season_id uuid primary key references public.ranking_seasons(id) on delete restrict,
  outcome text not null check(outcome in ('champion','apocalypse')),
  rules_version text not null default 'winx-v1' check(rules_version='winx-v1'),
  closed_at timestamptz not null,
  source_success_at timestamptz not null
);
create table if not exists public.season_classification (
  season_id uuid not null references public.season_results(season_id) on delete restrict,
  profile_id uuid not null references public.game_characters(id) on delete restrict,
  player_id uuid not null references public.game_players(id) on delete restrict,
  rank_position bigint,
  character_name text not null, steam_username text, alive_at_close boolean not null,
  kills_total integer, kills_firearm integer, kills_melee integer, survival_seconds bigint,
  observed_at timestamptz not null,
  primary key(season_id,profile_id)
);
create unique index if not exists season_classification_one_representative
  on public.season_classification(season_id,player_id) where rank_position is not null;
alter table public.season_results enable row level security;
alter table public.season_classification enable row level security;
revoke all on public.season_results,public.season_classification from public,anon,authenticated;

-- Representante vivo mais recentemente observado; desempate de pontuação:
-- kills DESC, tempo registrado DESC NULLS LAST, UUID ASC (jamais estado online).
create or replace function public.ranking_legacy_representatives_v1(p_season_id uuid)
returns table(profile_id uuid,season_id uuid,season_name text,rank_position bigint,
  character_name text,steam_username text,alive boolean,kills_total integer,
  kills_firearm integer,kills_melee integer,survival_seconds bigint,last_updated_at timestamptz)
language sql stable security definer set search_path='' as $$
  with representatives as (
    select distinct on(c.player_id) c.id profile_id,s.id season_id,s.name season_name,
      c.public_name character_name,p.steam_username,c.alive,st.kills_total,st.kills_firearm,
      st.kills_melee,st.survival_seconds,st.observed_at last_updated_at
    from public.ranking_seasons s join public.player_statistics_current st on st.season_id=s.id
    join public.game_characters c on c.id=st.character_id
    join public.game_players p on p.id=c.player_id
    where s.id=p_season_id and s.status='active' and c.alive is true and st.kills_total is not null
      and c.character_key not like 'life-v1:%'
      and c.last_seen_at=(select max(latest.last_seen_at) from public.game_characters latest where latest.player_id=c.player_id)
    order by c.player_id,c.last_seen_at desc,st.observed_at desc,c.id
  ) select r.profile_id,r.season_id,r.season_name,
    row_number() over(order by r.kills_total desc,r.survival_seconds desc nulls last,r.profile_id),
    r.character_name,r.steam_username,r.alive,r.kills_total,r.kills_firearm,
    r.kills_melee,r.survival_seconds,r.last_updated_at from representatives r;
$$;
revoke all on function public.ranking_legacy_representatives_v1(uuid) from public,anon,authenticated;
grant execute on function public.ranking_legacy_representatives_v1(uuid) to service_role;
create or replace function public.ranking_representatives(p_season_id uuid)
returns table(profile_id uuid,season_id uuid,season_name text,rank_position bigint,
 character_name text,steam_username text,alive boolean,kills_total integer,kills_firearm integer,kills_melee integer,survival_seconds bigint,last_updated_at timestamptz)
language sql stable security definer set search_path='' as $$ select * from public.ranking_legacy_representatives_v1(p_season_id); $$;
revoke all on function public.ranking_representatives(uuid) from public,anon,authenticated;
grant execute on function public.ranking_representatives(uuid) to service_role;

-- Perfil: classificação nova encerrada vem do arquivo, nunca do estado vivo futuro.
-- Temporadas legadas mantêm a população e a pontuação anteriores sem backfill.
create or replace function public.get_public_player(p_profile_id uuid)
returns table(profile_id uuid,season_id uuid,season_name text,rank_position bigint,
  character_name text,steam_username text,alive boolean,kills_total integer,
  kills_firearm integer,kills_melee integer,survival_seconds bigint,last_updated_at timestamptz)
language sql stable security definer set search_path='' as $$
  with legacy as (
    select c.id profile_id,s.id season_id,s.name season_name,
      row_number() over(partition by s.id order by st.kills_total desc nulls last,
        st.survival_seconds desc nulls last,coalesce(p.steam_username,c.public_name)) old_rank,
      c.public_name character_name,p.steam_username,c.alive,st.kills_total,st.kills_firearm,
      st.kills_melee,st.survival_seconds,st.observed_at last_updated_at,s.status,s.started_at
    from public.ranking_seasons s join public.player_statistics_current st on st.season_id=s.id
    join public.game_characters c on c.id=st.character_id join public.game_players p on p.id=c.player_id
    where s.status in ('active','closed') and st.kills_total is not null
      and not exists(select 1 from public.season_results result where result.season_id=s.id)
  ), candidates as (
    select p.profile_id,p.season_id,p.season_name,
      case when p.status='active' then r.rank_position else p.old_rank end rank_position,
      p.character_name,p.steam_username,p.alive,p.kills_total,p.kills_firearm,p.kills_melee,
      p.survival_seconds,p.last_updated_at,p.status,p.started_at
    from legacy p left join lateral public.ranking_representatives(p.season_id) r on r.profile_id=p.profile_id
    where p.profile_id=p_profile_id
    union all
    select a.profile_id,a.season_id,s.name,a.rank_position,a.character_name,a.steam_username,
      c.alive,a.kills_total,a.kills_firearm,a.kills_melee,a.survival_seconds,a.observed_at,s.status,s.started_at
    from public.season_classification a join public.ranking_seasons s on s.id=a.season_id
    join public.game_characters c on c.id=a.profile_id where a.profile_id=p_profile_id
  ), selected as (
    select * from candidates order by case when status='active' then 0 else 1 end,started_at desc,season_id limit 1
  ) select p.profile_id,p.season_id,p.season_name,p.rank_position,p.character_name,p.steam_username,
      p.alive,p.kills_total,p.kills_firearm,p.kills_melee,p.survival_seconds,p.last_updated_at from selected p
  union all
  select c.id,st.season_id,st.season_name,null::bigint,c.public_name,p.steam_username,c.alive,
    st.kills_total,st.kills_firearm,st.kills_melee,st.survival_seconds,coalesce(st.observed_at,c.last_seen_at)
  from public.game_characters c join public.game_players p on p.id=c.player_id
  left join lateral (
    select stats.*,s.name season_name from public.player_statistics_current stats
    join public.ranking_seasons s on s.id=stats.season_id
    where stats.character_id=c.id and s.status in ('active','closed')
    order by case when s.status='active' then 0 else 1 end,s.started_at desc,s.id limit 1
  ) st on true where c.id=p_profile_id and c.alive=false and not exists(select 1 from selected);
$$;

create or replace function public.championship_legacy_participant_ids_v1(p_season_id uuid)
returns setof uuid language sql stable security definer set search_path='' as $$
 select c.id from public.game_characters c join public.ranking_seasons s on s.id=p_season_id
 where c.character_key not like 'life-v1:%' and (c.last_seen_at>=s.started_at or exists(select 1 from public.player_statistics_current st where st.season_id=s.id and st.character_id=c.id));
$$;
revoke all on function public.championship_legacy_participant_ids_v1(uuid) from public,anon,authenticated;
grant execute on function public.championship_legacy_participant_ids_v1(uuid) to service_role;
create or replace function public.championship_participant_ids_v1(p_season_id uuid)
returns setof uuid language sql stable security definer set search_path='' as $$ select * from public.championship_legacy_participant_ids_v1(p_season_id); $$;
revoke all on function public.championship_participant_ids_v1(uuid) from public,anon,authenticated;
grant execute on function public.championship_participant_ids_v1(uuid) to service_role;

create or replace function public.close_ranking_season(p_season_id uuid,p_winner_character_id uuid default null)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_season public.ranking_seasons%rowtype; v_winner record; v_success timestamptz;
begin
  -- Ordem comum de locks: jogadores -> personagens -> temporadas -> estatísticas.
  -- Serializa com a ingestão, que escreve nessas tabelas nessa ordem.
  lock table public.game_players,public.game_characters,public.ranking_seasons,
    public.player_statistics_current,public.collector_runs in share row exclusive mode;
  select * into v_season from public.ranking_seasons where id=p_season_id for update;
  if not found or v_season.status<>'active' then raise exception 'active season not found'; end if;
  if exists(select 1 from public.season_winners where season_id=p_season_id)
    or exists(select 1 from public.season_results where season_id=p_season_id) then
    raise exception 'resultado existente; encerramento requer revisão';
  end if;
  select max(finished_at) into v_success from public.collector_runs where status='success';
  if v_success is null or v_success < now()-interval '15 minutes' or v_success > now()+interval '1 minute'
    or exists(select 1 from public.collector_runs where status='running')
    or exists(select 1 from public.collector_runs where status='failed' and coalesce(finished_at,started_at)>=v_success) then
    raise exception 'evidência insuficiente: coleta ausente, antiga, futura, falhou ou está em andamento';
  end if;
  if not exists(select 1 from public.player_statistics_current where season_id=p_season_id and kills_total is not null
    and character_id in(select public.championship_participant_ids_v1(p_season_id))) then
    raise exception 'evidência insuficiente: nenhum participante com pontuação validada';
  end if;
  -- Participantes com estatística sazonal, ou personagens observados desde o início.
  -- Vida desconhecida, leitura antiga e vivo sem métricas impedem certificação.
  if exists(
    select 1 from public.game_characters c left join public.player_statistics_current st
      on st.character_id=c.id and st.season_id=p_season_id
    where c.id in(select public.championship_participant_ids_v1(p_season_id))
      and (c.alive is null or c.last_seen_at<now()-interval '15 minutes' or c.last_seen_at>now()+interval '1 minute'
        or c.alive is true and (st.kills_total is null or st.observed_at<now()-interval '15 minutes'
          or st.observed_at>now()+interval '1 minute'))
  ) then raise exception 'evidência insuficiente: participante desconhecido, desatualizado ou vivo sem pontuação'; end if;

  select * into v_winner from public.ranking_representatives(p_season_id) order by rank_position limit 1;
  if p_winner_character_id is not null and p_winner_character_id is distinct from v_winner.profile_id then
    raise exception 'vencedor informado diverge do primeiro representante vivo';
  end if;
  if v_winner.profile_id is null and exists(
    select 1 from public.game_characters c left join public.player_statistics_current st
      on st.character_id=c.id and st.season_id=p_season_id
    where c.id in(select public.championship_participant_ids_v1(p_season_id)) and c.alive is distinct from false
  ) then raise exception 'evidência insuficiente para declarar O Apocalipse Venceu'; end if;

  insert into public.season_results(season_id,outcome,closed_at,source_success_at)
    values(p_season_id,case when v_winner.profile_id is null then 'apocalypse' else 'champion' end,now(),v_success);
  insert into public.season_classification
    (season_id,profile_id,player_id,rank_position,character_name,steam_username,alive_at_close,
      kills_total,kills_firearm,kills_melee,survival_seconds,observed_at)
    select st.season_id,c.id,c.player_id,r.rank_position,c.public_name,p.steam_username,c.alive,
      st.kills_total,st.kills_firearm,st.kills_melee,st.survival_seconds,st.observed_at
    from public.player_statistics_current st join public.game_characters c on c.id=st.character_id
    join public.game_players p on p.id=c.player_id
    left join public.ranking_representatives(p_season_id) r on r.profile_id=c.id
    where st.season_id=p_season_id and c.id in(select public.championship_participant_ids_v1(p_season_id));
  if v_winner.profile_id is not null then
    insert into public.season_winners(season_id,character_id,winner_name,final_kills_total,final_survival_seconds,reward_message)
      values(p_season_id,v_winner.profile_id,v_winner.character_name,v_winner.kills_total,
        v_winner.survival_seconds,v_season.reward_message);
  end if;
  update public.ranking_seasons set status='closed',ended_at=now(),closed_at=now() where id=p_season_id;
  return p_season_id;
end; $$;
revoke all on function public.close_ranking_season(uuid,uuid) from public,anon,authenticated;
grant execute on function public.close_ranking_season(uuid,uuid) to service_role;

create or replace function public.close_ranking_season_v2(p_season_id uuid,p_winner_character_id uuid default null)
returns table(season_id uuid,outcome text,winner_profile_id uuid,winner_name text)
language plpgsql security definer set search_path='' as $$
begin
  perform public.close_ranking_season(p_season_id,p_winner_character_id);
  return query select r.season_id,r.outcome,w.character_id,w.winner_name
    from public.season_results r left join public.season_winners w on w.season_id=r.season_id where r.season_id=p_season_id;
end; $$;
revoke all on function public.close_ranking_season_v2(uuid,uuid) from public,anon,authenticated;
grant execute on function public.close_ranking_season_v2(uuid,uuid) to service_role;

create or replace function public.get_public_seasons_v2(p_limit integer default 8)
returns table(season_id uuid,name text,slug text,status text,started_at timestamptz,ended_at timestamptz,
  winner_name text,winner_kills integer,reward_message text,outcome text,rules_version text)
language sql stable security definer set search_path='' as $$
  select s.id,s.name,s.slug,s.status,s.started_at,s.ended_at,w.winner_name,w.final_kills_total,s.reward_message,
    coalesce(r.outcome,case when s.status='closed' and w.character_id is not null then 'legacy_champion'
      when s.status='closed' then 'legacy_unverified' else 'in_progress' end),r.rules_version
  from public.ranking_seasons s left join public.season_winners w on w.season_id=s.id
  left join public.season_results r on r.season_id=s.id where s.status in ('active','closed')
  order by case when s.status='active' then 0 else 1 end,s.started_at desc,s.id
  limit least(greatest(coalesce(p_limit,8),1),50);
$$;
create or replace function public.get_public_seasons(p_limit integer default 8)
returns table(season_id uuid,name text,slug text,status text,started_at timestamptz,ended_at timestamptz,
  winner_name text,winner_kills integer,reward_message text)
language sql stable security definer set search_path='' as $$
  select r.season_id,r.name,r.slug,r.status,r.started_at,r.ended_at,r.winner_name,r.winner_kills,r.reward_message
  from public.get_public_seasons_v2(p_limit) r;
$$;
create or replace function public.get_public_player_titles(p_profile_id uuid)
returns table(season_id uuid,season_name text,ended_at timestamptz,winner_name text,final_kills_total integer,rules_version text)
language sql stable security definer set search_path='' as $$
  select s.id,s.name,s.ended_at,w.winner_name,w.final_kills_total,r.rules_version
  from public.season_winners w join public.ranking_seasons s on s.id=w.season_id
  left join public.season_results r on r.season_id=s.id
  where s.status='closed' and w.character_id=p_profile_id order by s.ended_at desc,s.id;
$$;
create or replace function public.get_public_ranking_status()
returns table(last_success_at timestamptz,records_seen integer,active_season_name text,ranked_players bigint)
language sql stable security definer set search_path='' as $$
  select r.finished_at,coalesce(r.records_seen,0),s.name,
    (select count(*) from public.ranking_representatives(s.id))
  from public.ranking_seasons s left join lateral (
    select finished_at,records_seen from public.collector_runs where status='success'
    order by finished_at desc nulls last limit 1
  ) r on true where s.status='active';
$$;
revoke all on function public.get_public_seasons_v2(integer),public.get_public_player_titles(uuid) from public;
grant execute on function public.get_public_seasons_v2(integer),public.get_public_player_titles(uuid) to anon,authenticated,service_role;
-- Reafirma somente os contratos públicos já existentes.
grant execute on function public.get_public_player(uuid),public.get_public_seasons(integer),public.get_public_ranking_status() to anon,authenticated,service_role;
do $guard$
declare f record; visitor text;
begin
  for f in select p.oid,p.proowner,p.proacl from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname in ('close_ranking_season','close_ranking_season_v2') loop
    foreach visitor in array array['anon','authenticated'] loop
      if has_function_privilege(visitor,f.oid,'EXECUTE') or pg_has_role(visitor,f.proowner,'MEMBER') or exists(
        select 1 from aclexplode(coalesce(f.proacl,acldefault('f',f.proowner))) a
        where a.grantee<>0 and a.privilege_type='EXECUTE' and pg_has_role(visitor,a.grantee,'MEMBER')
      ) then raise exception 'encerramento ainda acessível por papel público/herdado: %',visitor; end if;
    end loop;
  end loop;
end; $guard$;
notify pgrst,'reload schema';
commit;
