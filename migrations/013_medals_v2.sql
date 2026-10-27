-- Versioned, non-retroactive catalog. Activation is a separate controlled operation.
begin;
set local lock_timeout='5s';
alter table public.achievement_definitions add column if not exists active boolean not null default true;
create table if not exists public.medal_definitions_v2(
 id text primary key,definition jsonb not null,active boolean not null default false,
 check(definition->>'id'=id and definition->>'version'='2')
);
create table if not exists public.medal_baselines_v2(
 life_id uuid not null references public.life_identities(id),metric text not null,
 value numeric not null check(value>=0),last_value numeric not null,
 observed_at timestamptz not null,last_observed_at timestamptz not null,source_sha256 text not null,
 valid boolean not null default true,primary key(life_id,metric)
);
create table if not exists public.medal_unlocks_v2(
 life_id uuid not null references public.life_identities(id),achievement_id text not null references public.medal_definitions_v2(id),
 observed_at timestamptz not null,recognized_at timestamptz not null default now(),evidence jsonb not null,
 primary key(life_id,achievement_id)
);
do $$ declare t text;begin
 foreach t in array array['medal_definitions_v2','medal_baselines_v2','medal_unlocks_v2'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on public.%I from public,anon,authenticated,service_role',t);
 end loop;
end $$;

create or replace function public.medal_values_v2(p_life uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare l public.life_identities%rowtype;v jsonb;cutoff timestamptz;stats jsonb;streak integer;
begin
 select medals_activated_at into cutoff from public.product14_state where medals_enabled;
 if cutoff is null then return '{}';end if;
 select * into l from public.life_identities where id=p_life and identity_status='verified_source_life';
 if not found then return '{}';end if;
 select coalesce(jsonb_object_agg(b.metric,b.last_value-b.value),'{}') into v from public.medal_baselines_v2 b
  where b.life_id=p_life and b.valid and b.observed_at>=cutoff and b.last_value>=b.value;
 if l.alive is not null and l.last_observed_at>=cutoff then v:=v||jsonb_build_object('alive',case when l.alive then 1 else 0 end);end if;
 select jsonb_build_object(
  'seasons_completed_alive',count(*) filter(where a.alive_at_close and a.rank_position is not null),
  'official_top3',count(*) filter(where a.alive_at_close and a.rank_position<=3),
  'official_wins',count(*) filter(where c.certification='champion' and c.winner_profile_id=l.profile_id),
  'solo_official_wins',count(*) filter(where c.certification='champion' and c.winner_profile_id=l.profile_id
    and (select count(*) from public.season_archive_v2 p where p.season_id=a.season_id and p.alive_at_close)=1
    and (select count(*) from public.season_archive_v2 p where p.season_id=a.season_id)>1),
  'zero_kill_official_wins',count(*) filter(where c.certification='champion' and c.winner_profile_id=l.profile_id and a.kills_total=0
    and exists(select 1 from public.season_archive_v2 p where p.season_id=a.season_id and p.alive_at_close and p.profile_id<>l.profile_id and p.kills_total=0 and p.played_seconds<a.played_seconds))
 ) into stats from public.season_archive_v2 a join public.season_cycles_v2 c on c.season_id=a.season_id
 where a.life_id=l.id and a.certified and c.certification in('champion','technical_tie','apocalypse') and c.ends_at>cutoff and c.closed_at>=cutoff;
 select coalesce(max(n),0) into streak from (select count(*) n from
  (select c.season_number-row_number() over(order by c.season_number) island
   from public.season_cycles_v2 c where c.certification='champion' and c.winner_profile_id=l.profile_id and c.ends_at>cutoff and c.closed_at>=cutoff) w group by island) groups;
 return v||stats||jsonb_build_object('consecutive_official_wins',streak);
end $$;
revoke all on function public.medal_values_v2(uuid) from public,anon,authenticated;
grant execute on function public.medal_values_v2(uuid) to service_role;

create or replace function public.evaluate_medals_v2(p_life uuid) returns integer
language plpgsql security definer set search_path='' as $$
declare vals jsonb;d record;r jsonb;ok boolean;n integer:=0;added integer;observed timestamptz;
begin
 perform 1 from public.life_identities where id=p_life for update;
 vals:=public.medal_values_v2(p_life);
 if vals='{}'::jsonb then return 0;end if;
 select last_observed_at into observed from public.life_identities where id=p_life;
 for d in select * from public.medal_definitions_v2 where active loop
  ok:=true;
  for r in select value from jsonb_array_elements(d.definition->'criteria') loop
   if not vals?(r->>'metric') then ok:=false;exit;end if;
   if r->>'op'='gte' then ok:=(vals->>(r->>'metric'))::numeric >= (r->>'value')::numeric;
   elsif r->>'op'='eq' then ok:=(vals->>(r->>'metric'))::numeric = (r->>'value')::numeric;
   else ok:=false;end if;
   exit when not ok;
  end loop;
  if ok then
   insert into public.medal_unlocks_v2(life_id,achievement_id,observed_at,evidence)
    values(p_life,d.id,observed,jsonb_build_object('catalog_version','medals-v2','values',vals,'baseline_origin','first_verified_observation_after_activation')) on conflict do nothing;
   get diagnostics added=row_count;n:=n+added;
  end if;
 end loop;
 return n;
end $$;
revoke all on function public.evaluate_medals_v2(uuid) from public,anon,authenticated;
grant execute on function public.evaluate_medals_v2(uuid) to service_role;

create or replace function public.award_archive_medals_v2() returns trigger
language plpgsql security definer set search_path='' as $$declare l record;begin
 if new.certification in('champion','technical_tie','apocalypse') and old.certification='pending_certification' then
  for l in select distinct life_id from public.season_archive_v2 where season_id=new.season_id and life_id is not null loop
   perform public.evaluate_medals_v2(l.life_id);
  end loop;
 end if;
 return new;
end $$;
revoke all on function public.award_archive_medals_v2() from public,anon,authenticated,service_role;
drop trigger if exists award_archive_medals_v2 on public.season_cycles_v2;
create trigger award_archive_medals_v2 after update on public.season_cycles_v2 for each row execute function public.award_archive_medals_v2();

create or replace function public.observe_medal_baselines_v2() returns trigger
language plpgsql security definer set search_path='' as $$
declare field record;unit text;cutoff timestamptz;
begin
 select medals_activated_at into cutoff from public.product14_state where medals_enabled;
 if cutoff is null or new.observed_at<cutoff then return new;end if;
 for field in select * from jsonb_each(new.metrics) where key in('kills_total','kills_firearm','kills_melee','played_seconds','distance_total_m') loop
  unit:=case when field.key='played_seconds' then 'seconds' when field.key='distance_total_m' then 'meters' else 'count' end;
  if field.value->>'validated' is distinct from 'true' or field.value->>'scope' is distinct from 'life' or field.value->>'unit' is distinct from unit then continue;end if;
  if jsonb_typeof(field.value->'value') is distinct from 'number' or (field.value->>'value')::numeric<0 then continue;end if;
  insert into public.medal_baselines_v2(life_id,metric,value,last_value,observed_at,last_observed_at,source_sha256)
   values(new.life_id,field.key,(field.value->>'value')::numeric,(field.value->>'value')::numeric,new.observed_at,new.observed_at,new.source_sha256)
   on conflict(life_id,metric) do update set
    valid=public.medal_baselines_v2.valid and excluded.last_value>=public.medal_baselines_v2.last_value and excluded.last_observed_at>=public.medal_baselines_v2.last_observed_at,
    last_value=excluded.last_value,last_observed_at=excluded.last_observed_at;
 end loop;
 perform public.evaluate_medals_v2(new.life_id);
 return new;
end $$;
revoke all on function public.observe_medal_baselines_v2() from public,anon,authenticated,service_role;
drop trigger if exists observe_medal_baselines_v2 on public.life_observations;
create trigger observe_medal_baselines_v2 after insert on public.life_observations for each row execute function public.observe_medal_baselines_v2();

-- Preserve the old engine exactly for unactivated/historical environments.
do $$declare src text;begin
 if to_regprocedure('public.evaluate_legacy_achievements_v1(uuid)') is null then
  select pg_get_functiondef('public.evaluate_life_achievements_v1(uuid)'::regprocedure) into src;
  execute replace(src,'public.evaluate_life_achievements_v1(','public.evaluate_legacy_achievements_v1(');
 end if;
end $$;
revoke all on function public.evaluate_legacy_achievements_v1(uuid) from public,anon,authenticated;
grant execute on function public.evaluate_legacy_achievements_v1(uuid) to service_role;
create or replace function public.evaluate_life_achievements_v1(p_life_id uuid) returns integer
language plpgsql security definer set search_path='' as $$begin
 if exists(select 1 from public.product14_state where medals_enabled) then return public.evaluate_medals_v2(p_life_id);end if;
 return public.evaluate_legacy_achievements_v1(p_life_id);
end $$;
revoke all on function public.evaluate_life_achievements_v1(uuid) from public,anon,authenticated;
grant execute on function public.evaluate_life_achievements_v1(uuid) to service_role;

create or replace function public.get_public_medals_v2(p_profile_id uuid) returns jsonb
language sql stable security definer set search_path='' as $$
 select jsonb_build_object('catalog_version','medals-v2','catalog_count',(select count(*) from public.medal_definitions_v2 where active),
 'identity_verified',exists(select 1 from public.life_identities where profile_id=p_profile_id),
 'state',case when exists(select 1 from public.life_identities where profile_id=p_profile_id) then 'ready' else 'awaiting_verified_life' end,
 'catalog',(select coalesce(jsonb_agg(definition order by id),'[]') from public.medal_definitions_v2 where active),
 'unlocks',(select coalesce(jsonb_agg(jsonb_build_object('achievement_id',u.achievement_id,'observed_at',u.observed_at,'recognized_at',u.recognized_at) order by u.recognized_at,u.achievement_id),'[]')
  from public.medal_unlocks_v2 u join public.life_identities l on l.id=u.life_id where l.profile_id=p_profile_id));
$$;
revoke all on function public.get_public_medals_v2(uuid) from public;
grant execute on function public.get_public_medals_v2(uuid) to anon,authenticated,service_role;

create or replace function public.get_public_global_ranking_v2(p_limit integer default 100) returns jsonb
language sql stable security definer set search_path='' as $$
 with accounts as(select l.account_token,sum((l.metrics->'kills_total'->>'value')::numeric) filter(where l.metrics->'kills_total'->>'validated'='true') kills_total,
  count(*) lives_count,count(*) filter(where l.metrics->'kills_total'->>'validated'='true') known_lives
  from public.life_identities l where l.identity_status='verified_source_life' group by l.account_token),
 rows as(select md5(a.account_token)::uuid account_id,last.profile_id,last.steam_username,a.kills_total,a.lives_count,a.known_lives,
  'partial_verified_history'::text coverage,row_number() over(order by a.kills_total desc nulls last,md5(a.account_token)) rank_position
  from accounts a join lateral(select l.profile_id,p.steam_username from public.life_identities l join public.game_characters c on c.id=l.profile_id join public.game_players p on p.id=c.player_id
   where l.account_token=a.account_token order by l.last_observed_at desc,l.id limit 1) last on true)
 select jsonb_build_object('contract','global-accounts-v2','state',case when exists(select 1 from rows) then 'partial_verified_history' else 'awaiting_verified_lives' end,
  'coverage','partial_verified_history','ranking',(select coalesce(jsonb_agg(to_jsonb(r) order by rank_position),'[]') from(select * from rows order by rank_position limit greatest(1,least(100,p_limit))) r));
$$;
revoke all on function public.get_public_global_ranking_v2(integer) from public;
grant execute on function public.get_public_global_ranking_v2(integer) to anon,authenticated,service_role;

create or replace function public.activate_product14_v2() returns jsonb
language plpgsql security definer set search_path='' as $$begin
 perform pg_advisory_xact_lock(hashtextextended('winx-monthly-v2',0));
 if (select count(*) from public.medal_definitions_v2)<>28 then raise exception '28 definitions required';end if;
 if not exists(select 1 from public.product14_state where medals_enabled) then
  update public.product14_state set monthly_enabled=true,medals_enabled=true,medals_activated_at=clock_timestamp();
  update public.achievement_definitions set active=false;
  update public.medal_definitions_v2 set active=true;
 end if;
 return public.get_public_product14_v2();
end $$;
revoke all on function public.activate_product14_v2() from public,anon,authenticated;
grant execute on function public.activate_product14_v2() to service_role;

-- CATALOG28_BEGIN
do $catalog28$ declare defs jsonb:=$json$[{"id":"m14.exterminador","version":2,"catalog_version":"medals-v2","name":"Exterminador","category":"combate","description":"1.000 kills totais elegíveis. Progresso somente após ativação; sem herança entre vidas.","type":"unique","criteria":[{"metric":"kills_total","op":"gte","value":1000}],"required_sources":["verified_counter"],"retroactivity":"none","presentation":"contextual"},{"id":"m14.ceifador","version":2,"catalog_version":"medals-v2","name":"Ceifador do Apocalipse","category":"combate","description":"5.000 kills totais elegíveis. Progresso somente após ativação; sem herança entre vidas.","type":"unique","criteria":[{"metric":"kills_total","op":"gte","value":5000}],"required_sources":["verified_counter"],"retroactivity":"none","presentation":"contextual"},{"id":"m14.mil-fogo","version":2,"catalog_version":"medals-v2","name":"Mil no Fogo","category":"combate","description":"1.000 kills por arma de fogo elegíveis. Progresso somente após ativação; sem herança entre vidas.","type":"unique","criteria":[{"metric":"kills_firearm","op":"gte","value":1000}],"required_sources":["verified_counter"],"retroactivity":"none","presentation":"contextual"},{"id":"m14.mil-contato","version":2,"catalog_version":"medals-v2","name":"Mil no Contato","category":"combate","description":"1.000 kills corpo a corpo elegíveis. Progresso somente após ativação; sem herança entre vidas.","type":"unique","criteria":[{"metric":"kills_melee","op":"gte","value":1000}],"required_sources":["verified_counter"],"retroactivity":"none","presentation":"contextual"},{"id":"m14.tempo-10","version":2,"catalog_version":"medals-v2","name":"Primeira Vigília","category":"tempo","description":"10 horas jogadas elegíveis. Progresso somente após ativação; sem herança entre vidas.","type":"unique","criteria":[{"metric":"played_seconds","op":"gte","value":36000}],"required_sources":["verified_counter"],"retroactivity":"none","presentation":"contextual"},{"id":"m14.tempo-50","version":2,"catalog_version":"medals-v2","name":"O Inquieto","category":"tempo","description":"50 horas jogadas elegíveis. Progresso somente após ativação; sem herança entre vidas.","type":"unique","criteria":[{"metric":"played_seconds","op":"gte","value":180000}],"required_sources":["verified_counter"],"retroactivity":"none","presentation":"contextual"},{"id":"m14.tempo-100","version":2,"catalog_version":"medals-v2","name":"Sem Descanso","category":"tempo","description":"100 horas jogadas elegíveis. Progresso somente após ativação; sem herança entre vidas.","type":"unique","criteria":[{"metric":"played_seconds","op":"gte","value":360000}],"required_sources":["verified_counter"],"retroactivity":"none","presentation":"contextual"},{"id":"m14.tempo-200","version":2,"catalog_version":"medals-v2","name":"Resistência Eterna","category":"tempo","description":"200 horas jogadas elegíveis. Progresso somente após ativação; sem herança entre vidas.","type":"unique","criteria":[{"metric":"played_seconds","op":"gte","value":720000}],"required_sources":["verified_counter"],"retroactivity":"none","presentation":"contextual"},{"id":"m14.tempo-500","version":2,"catalog_version":"medals-v2","name":"O Incansável","category":"tempo","description":"500 horas jogadas elegíveis. Progresso somente após ativação; sem herança entre vidas.","type":"unique","criteria":[{"metric":"played_seconds","op":"gte","value":1800000}],"required_sources":["verified_counter"],"retroactivity":"none","presentation":"contextual"},{"id":"m14.distancia-10","version":2,"catalog_version":"medals-v2","name":"Primeira Expedição","category":"exploracao","description":"10 km de distância total elegíveis. Progresso somente após ativação; sem herança entre vidas.","type":"unique","criteria":[{"metric":"distance_total_m","op":"gte","value":10000}],"required_sources":["verified_counter"],"retroactivity":"none","presentation":"contextual"},{"id":"m14.distancia-25","version":2,"catalog_version":"medals-v2","name":"Território Percorrido","category":"exploracao","description":"25 km de distância total elegíveis. Progresso somente após ativação; sem herança entre vidas.","type":"unique","criteria":[{"metric":"distance_total_m","op":"gte","value":25000}],"required_sources":["verified_counter"],"retroactivity":"none","presentation":"contextual"},{"id":"m14.distancia-100","version":2,"catalog_version":"medals-v2","name":"Além do Horizonte","category":"exploracao","description":"100 km de distância total elegíveis. Progresso somente após ativação; sem herança entre vidas.","type":"unique","criteria":[{"metric":"distance_total_m","op":"gte","value":100000}],"required_sources":["verified_counter"],"retroactivity":"none","presentation":"contextual"},{"id":"m14.distancia-500","version":2,"catalog_version":"medals-v2","name":"Andarilho","category":"exploracao","description":"500 km de distância total elegíveis. Progresso somente após ativação; sem herança entre vidas.","type":"unique","criteria":[{"metric":"distance_total_m","op":"gte","value":500000}],"required_sources":["verified_counter"],"retroactivity":"none","presentation":"contextual"},{"id":"m14.distancia-1000","version":2,"catalog_version":"medals-v2","name":"Sem Fronteiras","category":"exploracao","description":"1.000 km de distância total elegíveis. Progresso somente após ativação; sem herança entre vidas.","type":"unique","criteria":[{"metric":"distance_total_m","op":"gte","value":1000000}],"required_sources":["verified_counter"],"retroactivity":"none","presentation":"contextual"},{"id":"m14.unico","version":2,"catalog_version":"medals-v2","name":"O Único Sobrevivente","category":"temporada","description":"1 títulos como único vivo elegível em disputa com outros participantes elegíveis. Progresso somente após ativação; sem herança entre vidas.","type":"unique","criteria":[{"metric":"solo_official_wins","op":"gte","value":1}],"required_sources":["official_archive"],"retroactivity":"none","presentation":"contextual"},{"id":"m14.presenca","version":2,"catalog_version":"medals-v2","name":"Presença nas Temporadas","category":"temporada","description":"5 temporadas oficiais concluídas vivo elegíveis. Progresso somente após ativação; sem herança entre vidas.","type":"unique","criteria":[{"metric":"seasons_completed_alive","op":"gte","value":5}],"required_sources":["official_archive"],"retroactivity":"none","presentation":"contextual"},{"id":"m14.decada","version":2,"catalog_version":"medals-v2","name":"Uma Década no Inferno","category":"temporada","description":"10 temporadas oficiais concluídas vivo elegíveis. Progresso somente após ativação; sem herança entre vidas.","type":"unique","criteria":[{"metric":"seasons_completed_alive","op":"gte","value":10}],"required_sources":["official_archive"],"retroactivity":"none","presentation":"contextual"},{"id":"m14.coroa","version":2,"catalog_version":"medals-v2","name":"Coroa Oficial","category":"temporada","description":"1 títulos oficiais elegíveis. Progresso somente após ativação; sem herança entre vidas.","type":"unique","criteria":[{"metric":"official_wins","op":"gte","value":1}],"required_sources":["official_archive"],"retroactivity":"none","presentation":"contextual"},{"id":"m14.coroa-persistente","version":2,"catalog_version":"medals-v2","name":"Coroa Persistente","category":"temporada","description":"3 títulos oficiais elegíveis. Progresso somente após ativação; sem herança entre vidas.","type":"unique","criteria":[{"metric":"official_wins","op":"gte","value":3}],"required_sources":["official_archive"],"retroactivity":"none","presentation":"contextual"},{"id":"m14.rosto","version":2,"catalog_version":"medals-v2","name":"Rosto Conhecido","category":"temporada","description":"3 temporadas oficiais entre os três primeiros elegíveis. Progresso somente após ativação; sem herança entre vidas.","type":"unique","criteria":[{"metric":"official_top3","op":"gte","value":3}],"required_sources":["official_archive"],"retroactivity":"none","presentation":"contextual"},{"id":"m14.reinado","version":2,"catalog_version":"medals-v2","name":"Reinado Duplo","category":"temporada","description":"2 títulos em temporadas oficiais consecutivas elegíveis. Progresso somente após ativação; sem herança entre vidas.","type":"unique","criteria":[{"metric":"consecutive_official_wins","op":"gte","value":2}],"required_sources":["official_archive"],"retroactivity":"none","presentation":"contextual"},{"id":"m14.rei-zero","version":2,"catalog_version":"medals-v2","name":"Rei Sem Kills","category":"temporada","description":"1 título com zero kills, decidido por tempo elegíveis. Progresso somente após ativação; sem herança entre vidas.","type":"unique","criteria":[{"metric":"zero_kill_official_wins","op":"gte","value":1}],"required_sources":["official_archive"],"retroactivity":"none","presentation":"contextual"},{"id":"m14.legado","version":2,"catalog_version":"medals-v2","name":"Legado do Caído","category":"legado","description":"1.000 kills totais elegíveis e morte comprovada. Progresso somente após ativação; sem herança entre vidas.","type":"unique","criteria":[{"metric":"kills_total","op":"gte","value":1000},{"metric":"alive","op":"eq","value":0}],"required_sources":["verified_counter"],"retroactivity":"none","presentation":"contextual"},{"id":"m14.sepultada","version":2,"catalog_version":"medals-v2","name":"Lenda Sepultada","category":"legado","description":"5.000 kills totais elegíveis e morte comprovada. Progresso somente após ativação; sem herança entre vidas.","type":"unique","criteria":[{"metric":"kills_total","op":"gte","value":5000},{"metric":"alive","op":"eq","value":0}],"required_sources":["verified_counter"],"retroactivity":"none","presentation":"contextual"},{"id":"m14.ultima-vigilia","version":2,"catalog_version":"medals-v2","name":"A Última Vigília","category":"legado","description":"200 horas jogadas elegíveis e morte comprovada. Progresso somente após ativação; sem herança entre vidas.","type":"unique","criteria":[{"metric":"played_seconds","op":"gte","value":720000},{"metric":"alive","op":"eq","value":0}],"required_sources":["verified_counter"],"retroactivity":"none","presentation":"contextual"},{"id":"m14.ultima-jornada","version":2,"catalog_version":"medals-v2","name":"A Última Jornada","category":"legado","description":"500 km de distância total elegíveis e morte comprovada. Progresso somente após ativação; sem herança entre vidas.","type":"unique","criteria":[{"metric":"distance_total_m","op":"gte","value":500000},{"metric":"alive","op":"eq","value":0}],"required_sources":["verified_counter"],"retroactivity":"none","presentation":"contextual"},{"id":"m14.coroa-imortal","version":2,"catalog_version":"medals-v2","name":"Coroa Imortal","category":"legado","description":"1 títulos oficiais elegíveis e morte comprovada. Progresso somente após ativação; sem herança entre vidas.","type":"unique","criteria":[{"metric":"official_wins","op":"gte","value":1},{"metric":"alive","op":"eq","value":0}],"required_sources":["official_archive"],"retroactivity":"none","presentation":"contextual"},{"id":"m14.fim-era","version":2,"catalog_version":"medals-v2","name":"O Fim de Uma Era","category":"legado","description":"5 temporadas oficiais concluídas vivo elegíveis e morte comprovada. Progresso somente após ativação; sem herança entre vidas.","type":"unique","criteria":[{"metric":"seasons_completed_alive","op":"gte","value":5},{"metric":"alive","op":"eq","value":0}],"required_sources":["official_archive"],"retroactivity":"none","presentation":"contextual"}]$json$::jsonb;begin
 if jsonb_array_length(defs)<>28 then raise exception '28 required';end if;
 if exists(select 1 from jsonb_array_elements(defs) e join public.medal_definitions_v2 d on d.id=e->>'id' where d.definition is distinct from e) then raise exception 'immutable medal definitions';end if;
 insert into public.medal_definitions_v2(id,definition) select e->>'id',e from jsonb_array_elements(defs) e on conflict do nothing;
end $catalog28$;
-- CATALOG28_END
notify pgrst,'reload schema';
commit;
