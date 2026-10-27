-- Mission 12. Additive guards only: no cohort activation, backfill or catalog edits.
-- Requires 001-009 installed, verified recovery and an unchanged legacy contract.
begin;
set local lock_timeout='3s';
set local statement_timeout='15s';
do $$ begin
 if to_regprocedure('public.ingest_life_observation_v1(uuid,text,text,text,text,boolean,timestamptz,text,jsonb)') is null
   or to_regprocedure('public.get_public_season_schedule_v1(uuid)') is null
   or (select count(*) from public.achievement_definitions)<>100 then
  raise exception 'installed life/schedule contracts and catalog required';
 end if;
 if exists(select 1 from public.life_identities group by world_id,life_token having count(*)>1) then
  raise exception 'source life collision requires investigation; no identities changed';
 end if;
end $$;
create unique index if not exists life_source_world_token_unique on public.life_identities(world_id,life_token);

create or replace function public.guard_life_identity_metrics_v1() returns trigger
language plpgsql security definer set search_path='' as $$
declare item record; keys text[]; sum_value numeric;
begin
 if tg_op='UPDATE' then
  if row(new.profile_id,new.world_id,new.account_token,new.life_token,new.identity_status)
    is distinct from row(old.profile_id,old.world_id,old.account_token,old.life_token,old.identity_status) then
   raise exception 'life identity is immutable; source changes require investigation';
  end if;
  if new.last_observed_at<old.last_observed_at then raise exception 'out of order life update'; end if;
  if old.alive=false then
   if new.alive is distinct from false then raise exception 'dead life is frozen'; end if;
   for item in select * from jsonb_each(new.metrics) loop
    if not old.metrics ? item.key or (item.value-'observed_at') is distinct from ((old.metrics->item.key)-'observed_at') then
     raise exception 'dead life metrics are frozen; no postmortem progress';
    end if;
   end loop;
   if not new.metrics ?& array(select jsonb_object_keys(old.metrics)) then raise exception 'dead life metrics cannot be removed'; end if;
  end if;
 end if;
 -- Missing categories stay unknown; only assert complete partitions, never
 -- add Melee to its component categories or Vehicle to an already inclusive total.
 keys:=array['kills_firearm','kills_melee','kills_vehicle','kills_other'];
 if new.metrics ? 'kills_total' and new.metrics ?& keys and
    (select count(distinct new.metrics->k->>'observed_at') from unnest(keys||array['kills_total']) k)=1 then
  select sum((new.metrics->k->>'value')::numeric) into sum_value from unnest(keys) k;
  if sum_value<>(new.metrics->'kills_total'->>'value')::numeric then raise exception 'kill category partition inconsistent'; end if;
 end if;
 keys:=array['kills_axe','kills_blunt','kills_small_blunt','kills_long_blade','kills_small_blade','kills_spear','kills_unarmed'];
 if new.metrics ? 'kills_melee' and new.metrics ?& keys and
    (select count(distinct new.metrics->k->>'observed_at') from unnest(keys||array['kills_melee']) k)=1 then
  select sum((new.metrics->k->>'value')::numeric) into sum_value from unnest(keys) k;
  if sum_value<>(new.metrics->'kills_melee'->>'value')::numeric then raise exception 'melee category partition inconsistent'; end if;
 end if;
 return new;
end $$;
revoke all on function public.guard_life_identity_metrics_v1() from public,anon,authenticated;
drop trigger if exists guard_life_identity_metrics_v1 on public.life_identities;
create trigger guard_life_identity_metrics_v1 before insert or update on public.life_identities
for each row execute function public.guard_life_identity_metrics_v1();
-- No calls to ingestion/evaluation/activation: existing data and medal count stay unchanged.
notify pgrst,'reload schema';
commit;
