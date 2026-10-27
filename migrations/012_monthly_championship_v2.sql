-- Additive winx-v2 calendar/archive. No early closure; service wrapper uses now().
begin;
set local lock_timeout='5s';
select pg_advisory_xact_lock(hashtextextended('winx-monthly-v2',0));
create table if not exists public.product14_state(
 id boolean primary key default true check(id),monthly_enabled boolean not null default false,
 medals_enabled boolean not null default false,medals_activated_at timestamptz,
 original_deadline timestamptz,installed_at timestamptz not null default now()
);
create table if not exists public.season_cycles_v2(
 season_id uuid primary key references public.ranking_seasons(id),season_number integer not null unique,
 starts_at timestamptz not null unique,ends_at timestamptz not null unique,
 rules_version text not null default 'winx-v2' check(rules_version='winx-v2'),
 certification text not null default 'open' check(certification in('open','pending_certification','champion','technical_tie','apocalypse')),
 complete_population boolean not null default false,closed_at timestamptz,winner_profile_id uuid references public.game_characters(id),
 reason text,check(starts_at<ends_at),check((certification='champion')=(winner_profile_id is not null))
);
create table if not exists public.season_archive_v2(
 season_id uuid not null references public.season_cycles_v2(season_id),profile_id uuid not null references public.game_characters(id),
 life_id uuid references public.life_identities(id),frozen_statistics jsonb not null,
 alive_at_close boolean,kills_total numeric,played_seconds numeric,certified boolean not null default false,
 rank_position bigint,primary key(season_id,profile_id)
);
create table if not exists public.season_uncertain_intervals_v2(
 season_id uuid not null references public.season_cycles_v2(season_id),life_id uuid not null references public.life_identities(id),
 metric text not null,from_at timestamptz not null,to_at timestamptz not null,observed_delta numeric,
 reason text not null,primary key(season_id,life_id,metric,from_at,to_at)
);
do $$ declare t text; begin
 foreach t in array array['product14_state','season_cycles_v2','season_archive_v2','season_uncertain_intervals_v2'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on public.%I from public,anon,authenticated,service_role',t);
 end loop;
end $$;
insert into public.product14_state(id,original_deadline)
 select true,scheduled_end_at from public.ranking_seasons where id='4ec32a87-fb16-4838-af57-f4cf85425a60' on conflict do nothing;
do $$ begin
 if not exists(select 1 from public.product14_state) then raise exception 'approved season missing'; end if;
 if not exists(select 1 from public.season_cycles_v2) then
  if not exists(select 1 from public.ranking_seasons where id='4ec32a87-fb16-4838-af57-f4cf85425a60'
   and status='active' and started_at='2026-10-20T01:05:18.930285Z' and scheduled_end_at='2026-11-01T02:59:00Z')
   then raise exception 'season preconditions changed'; end if;
  insert into public.season_cycles_v2(season_id,season_number,starts_at,ends_at)
   values('4ec32a87-fb16-4838-af57-f4cf85425a60',1,'2026-10-20T01:05:18.930285Z','2026-11-01T03:00:00Z');
  update public.ranking_seasons set scheduled_end_at='2026-11-01T03:00:00Z' where id='4ec32a87-fb16-4838-af57-f4cf85425a60';
 end if;
end $$;

create or replace function public.monthly_name_v2(n integer,at_time timestamptz) returns text
language sql immutable set search_path='' as $$
 select 'Temporada '||n||' — '||(array['O Despertar dos Mortos','A Última Resistência','Ecos da Quarentena','Horizonte em Cinzas','Depois do Silêncio','A Marcha dos Esquecidos'])[1+mod(greatest(0,n-2),6)]
 ||' · '||to_char(at_time at time zone 'America/Sao_Paulo','MM/YYYY'); $$;
revoke all on function public.monthly_name_v2(integer,timestamptz) from public,anon,authenticated;

create or replace function public.guard_monthly_mutation_v2() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 perform pg_advisory_xact_lock(hashtextextended('winx-monthly-v2',0));
 if exists(select 1 from public.product14_state where monthly_enabled) and current_setting('winx.monthly.operation',true) is distinct from 'reconcile' then
  if tg_table_name='ranking_seasons' then
   raise exception 'calendar managed by winx-v2; exceptional intervention requires dedicated audited operation';
  elsif exists(select 1 from public.season_cycles_v2 c where c.season_id=new.season_id) then
   if tg_table_name='season_results' or exists(select 1 from public.ranking_seasons s where s.id=new.season_id and s.status<>'active') then
    raise exception 'winx-v2 archive is immutable to legacy operations';
   end if;
   if tg_table_name='player_statistics_current' and exists(select 1 from public.season_cycles_v2 c
     where c.season_id=new.season_id and (new.observed_at<c.starts_at or new.observed_at>=c.ends_at)) then
    raise exception 'observation outside half-open monthly interval; reconcile calendar before ingestion';
   end if;
   if tg_table_name='player_statistics_current' and tg_op='UPDATE' then
    if (old.baseline_kills_total is not null and new.baseline_kills_total is distinct from old.baseline_kills_total)
     or (old.baseline_kills_firearm is not null and new.baseline_kills_firearm is distinct from old.baseline_kills_firearm)
     or (old.baseline_kills_melee is not null and new.baseline_kills_melee is distinct from old.baseline_kills_melee) then
     raise exception 'monthly baselines cannot be reset by legacy operations';
    end if;
   end if;
  end if;
 end if;
 return new;
end $$;
revoke all on function public.guard_monthly_mutation_v2() from public,anon,authenticated,service_role;
drop trigger if exists guard_monthly_calendar_v2 on public.ranking_seasons;
create trigger guard_monthly_calendar_v2 before insert or update on public.ranking_seasons for each row execute function public.guard_monthly_mutation_v2();
drop trigger if exists guard_monthly_results_v2 on public.season_results;
create trigger guard_monthly_results_v2 before insert or update on public.season_results for each row execute function public.guard_monthly_mutation_v2();
drop trigger if exists guard_monthly_scores_v2 on public.player_statistics_current;
create trigger guard_monthly_scores_v2 before insert or update on public.player_statistics_current for each row execute function public.guard_monthly_mutation_v2();

-- Boundary proof is possible only when a monotonic counter is equal on both sides.
create or replace function public.boundary_metric_v2(l uuid,k text,t timestamptz) returns numeric
language sql stable security definer set search_path='' as $$
 with before_value as(select (metrics->k->>'value')::numeric v from public.life_observations
  where life_id=l and observed_at<t and metrics->k->>'validated'='true' order by observed_at desc,id desc limit 1),
 after_value as(select (metrics->k->>'value')::numeric v from public.life_observations
  where life_id=l and observed_at>=t and metrics->k->>'validated'='true' order by observed_at,id limit 1)
 select b.v from before_value b cross join after_value a where b.v=a.v;
$$;
revoke all on function public.boundary_metric_v2(uuid,text,timestamptz) from public,anon,authenticated,service_role;

create or replace function public.certify_month_v2(p_id uuid) returns text
language plpgsql security definer set search_path='' as $$
declare c public.season_cycles_v2%rowtype;l record;metric text;previous_sample record;next_sample record;v numeric;start_v numeric;
 alive_close boolean;n integer;top_row record;second_row record;result text;winner uuid;
begin
 perform pg_advisory_xact_lock(hashtextextended('winx-monthly-v2',0));
 select * into c from public.season_cycles_v2 where season_id=p_id for update;
 if not found or c.certification<>'pending_certification' then return coalesce(c.certification,'missing'); end if;
 for l in select li.* from public.life_identities li where (li.last_observed_at>=c.starts_at or li.alive is distinct from false)
  and exists(select 1 from public.life_observations o where o.life_id=li.id and o.observed_at<c.ends_at) loop
  insert into public.season_archive_v2(season_id,profile_id,life_id,frozen_statistics)
   values(p_id,l.profile_id,l.id,'{}') on conflict(season_id,profile_id) do update set life_id=excluded.life_id;
  foreach metric in array array['kills_total','played_seconds','kills_firearm','kills_melee','distance_total_m'] loop
   select observed_at,(metrics->metric->>'value')::numeric value into previous_sample from public.life_observations where life_id=l.id and observed_at<c.ends_at and metrics?metric order by observed_at desc,id desc limit 1;
   select observed_at,(metrics->metric->>'value')::numeric value into next_sample from public.life_observations where life_id=l.id and observed_at>=c.ends_at and metrics?metric order by observed_at,id limit 1;
   if previous_sample.observed_at is not null and next_sample.observed_at is not null and previous_sample.value is distinct from next_sample.value then
    insert into public.season_uncertain_intervals_v2 values(p_id,l.id,metric,previous_sample.observed_at,next_sample.observed_at,next_sample.value-previous_sample.value,'cross_month_increment') on conflict do nothing;
   end if;
  end loop;
  select case when exists(select 1 from public.life_observations where life_id=l.id and observed_at>=c.ends_at and alive=true) then true
   when exists(select 1 from public.life_observations where life_id=l.id and observed_at<c.ends_at and alive=false) then false else null end into alive_close;
  start_v:=public.boundary_metric_v2(l.id,'kills_total',c.starts_at);v:=public.boundary_metric_v2(l.id,'kills_total',c.ends_at);
  update public.season_archive_v2 set alive_at_close=alive_close,kills_total=case when v>=start_v then v-start_v else null end,
   played_seconds=public.boundary_metric_v2(l.id,'played_seconds',c.ends_at)-public.boundary_metric_v2(l.id,'played_seconds',c.starts_at)
   where season_id=p_id and profile_id=l.profile_id;
  update public.season_archive_v2 set certified=coalesce(alive_at_close is false or (alive_at_close is true and kills_total>=0 and played_seconds>=0),false) where season_id=p_id and profile_id=l.profile_id;
 end loop;
 if not c.complete_population or not exists(select 1 from public.season_archive_v2 where season_id=p_id)
  or exists(select 1 from public.season_archive_v2 where season_id=p_id and certified is distinct from true) then
  update public.season_cycles_v2 set reason='identity_population_or_boundary_evidence_missing' where season_id=p_id;return 'pending_certification';
 end if;
 select count(*) into n from public.season_archive_v2 where season_id=p_id and alive_at_close;
 if n=0 then result:='apocalypse'; else
  select * into top_row from public.season_archive_v2 where season_id=p_id and alive_at_close order by kills_total desc,played_seconds desc,profile_id limit 1;
  select * into second_row from public.season_archive_v2 where season_id=p_id and alive_at_close order by kills_total desc,played_seconds desc,profile_id offset 1 limit 1;
  result:=case when n>1 and top_row.kills_total=second_row.kills_total and top_row.played_seconds=second_row.played_seconds then 'technical_tie' else 'champion' end;
  if result='champion' then winner:=top_row.profile_id;end if;
 end if;
 with ranked as(select profile_id,rank() over(order by kills_total desc,played_seconds desc) position from public.season_archive_v2 where season_id=p_id and alive_at_close)
 update public.season_archive_v2 a set rank_position=r.position from ranked r where a.season_id=p_id and a.profile_id=r.profile_id;
 update public.season_cycles_v2 set certification=result,winner_profile_id=winner,reason=null where season_id=p_id;
 return result;
end $$;
revoke all on function public.certify_month_v2(uuid) from public,anon,authenticated;
grant execute on function public.certify_month_v2(uuid) to service_role;

-- Internal clock-injected helper is NOT executable by API/service roles.
create or replace function public.reconcile_months_at_v2(p_at timestamptz) returns jsonb
language plpgsql security definer set search_path='' as $$
declare c public.season_cycles_v2%rowtype;next_id uuid;next_end timestamptz;i integer:=0;pending record;
begin
 perform pg_advisory_xact_lock(hashtextextended('winx-monthly-v2',0));
 if not exists(select 1 from public.product14_state where monthly_enabled) then return jsonb_build_object('enabled',false);end if;
 perform set_config('winx.monthly.operation','reconcile',true);
 loop
  select x.* into c from public.season_cycles_v2 x join public.ranking_seasons s on s.id=x.season_id where s.status='active' for update of s;
  exit when not found or c.ends_at>p_at or i>=120;
  insert into public.season_archive_v2(season_id,profile_id,frozen_statistics)
   select c.season_id,st.character_id,to_jsonb(st)||jsonb_build_object('alive_observed',gc.alive,'alive_observed_at',gc.last_seen_at)
   from public.player_statistics_current st join public.game_characters gc on gc.id=st.character_id where st.season_id=c.season_id on conflict do nothing;
  update public.season_cycles_v2 set certification='pending_certification',closed_at=p_at,reason='awaiting_boundary_evidence' where season_id=c.season_id;
  update public.ranking_seasons set status='closed',ended_at=c.ends_at,closed_at=p_at where id=c.season_id;
  next_end:=((date_trunc('month',c.ends_at at time zone 'America/Sao_Paulo')+interval '1 month') at time zone 'America/Sao_Paulo');
  insert into public.ranking_seasons(name,slug,status,started_at,scheduled_end_at)
   values(public.monthly_name_v2(c.season_number+1,c.ends_at),'mensal-'||to_char(c.ends_at at time zone 'America/Sao_Paulo','YYYY-MM'),'active',c.ends_at,next_end) returning id into next_id;
  insert into public.season_cycles_v2(season_id,season_number,starts_at,ends_at) values(next_id,c.season_number+1,c.ends_at,next_end);
  i:=i+1;
 end loop;
 for pending in select season_id from public.season_cycles_v2 where certification='pending_certification' loop perform public.certify_month_v2(pending.season_id);end loop;
 perform set_config('winx.monthly.operation','',true);
 return jsonb_build_object('enabled',true,'transitions',i,'pending',(select count(*) from public.season_cycles_v2 where certification='pending_certification'));
end $$;
revoke all on function public.reconcile_months_at_v2(timestamptz) from public,anon,authenticated,service_role;
create or replace function public.reconcile_months_v2() returns jsonb language sql security definer set search_path='' as $$select public.reconcile_months_at_v2(now());$$;
revoke all on function public.reconcile_months_v2() from public,anon,authenticated;
grant execute on function public.reconcile_months_v2() to service_role;

create or replace function public.get_public_product14_v2() returns jsonb
language sql stable security definer set search_path='' as $$
 select jsonb_build_object('contract','winx-v2','monthly_enabled',s.monthly_enabled,'medals_enabled',s.medals_enabled,
 'medals_activated_at',s.medals_activated_at,'server_time',now(),'catalog_count',case when s.medals_enabled then 28 else 100 end,
 'seasons',(select coalesce(jsonb_agg(to_jsonb(r) order by r.started_at desc),'[]') from
  (select rs.id season_id,rs.name,rs.status,rs.started_at,rs.ended_at,rs.scheduled_end_at,
    cy.ends_at logical_end_at,cy.certification outcome,cy.rules_version,'automatic'::text closure_mode,true schedule_verified,true deadline_exclusive,
    gc.public_name winner_name,cy.reason certification_reason from public.ranking_seasons rs join public.season_cycles_v2 cy on cy.season_id=rs.id
    left join public.game_characters gc on gc.id=cy.winner_profile_id order by rs.started_at desc limit 24)r))
 from public.product14_state s where id;
$$;
revoke all on function public.get_public_product14_v2() from public;
grant execute on function public.get_public_product14_v2() to anon,authenticated,service_role;
notify pgrst,'reload schema';
commit;
