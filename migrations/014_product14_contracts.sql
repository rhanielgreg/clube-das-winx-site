begin;
create table if not exists public.season_admin_audit_v2(
 id bigint generated always as identity primary key,season_id uuid not null references public.ranking_seasons(id),
 operator_id uuid not null,action text not null check(action='rename'),reason text not null,
 previous_name text not null,new_name text not null,occurred_at timestamptz not null default now()
);
alter table public.season_admin_audit_v2 enable row level security;
revoke all on public.season_admin_audit_v2 from public,anon,authenticated,service_role;
create or replace function public.rename_monthly_season_v2(p_season_id uuid,p_name text,p_reason text,p_operator_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$declare previous text;begin
 perform pg_advisory_xact_lock(hashtextextended('winx-monthly-v2',0));
 if p_operator_id is null or p_name is null or length(trim(p_name)) not between 3 and 80
  or p_reason is null or length(trim(p_reason)) not between 10 and 500 then raise exception 'invalid exceptional intervention';end if;
 if not exists(select 1 from public.product14_state where monthly_enabled) then raise exception 'monthly calendar inactive';end if;
 select name into previous from public.ranking_seasons where id=p_season_id and status='active' for update;
 if previous is null then raise exception 'only the active season name may be changed';end if;
 perform set_config('winx.monthly.operation','reconcile',true);
 update public.ranking_seasons set name=trim(p_name) where id=p_season_id;
 perform set_config('winx.monthly.operation','',true);
 insert into public.season_admin_audit_v2(season_id,operator_id,action,reason,previous_name,new_name)
  values(p_season_id,p_operator_id,'rename',trim(p_reason),previous,trim(p_name));
 return jsonb_build_object('season_id',p_season_id,'name',trim(p_name),'audited',true);
end $$;
revoke all on function public.rename_monthly_season_v2(uuid,text,text,uuid) from public,anon,authenticated;
grant execute on function public.rename_monthly_season_v2(uuid,text,text,uuid) to service_role;
-- One lock order for old/new ingestion and monthly transitions: calendar first.
do $$declare signature text;old_name text;new_name text;src text;begin
 for signature,old_name,new_name in select * from(values
  ('public.ingest_player_observation(text,text,text,boolean,text,timestamptz,integer,integer,integer,bigint,text)','ingest_player_observation','ingest_observation_legacy14'),
  ('public.close_ranking_season(uuid,uuid)','close_ranking_season','close_season_legacy14'),
  ('public.start_ranking_season(text,text,text)','start_ranking_season','start_season_legacy14'))f(signature,old_name,new_name) loop
  if not exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname=new_name) then
   select pg_get_functiondef(signature::regprocedure) into src;
   execute replace(src,'public.'||old_name||'(','public.'||new_name||'(');
  end if;
 end loop;
end $$;
revoke all on function public.ingest_observation_legacy14(text,text,text,boolean,text,timestamptz,integer,integer,integer,bigint,text),
 public.close_season_legacy14(uuid,uuid),public.start_season_legacy14(text,text,text) from public,anon,authenticated,service_role;
create or replace function public.ingest_player_observation(p_player_key text,p_character_key text,p_character_name text,p_alive boolean,p_blob_sha256 text,p_observed_at timestamptz,
 p_kills_total integer default null,p_kills_firearm integer default null,p_kills_melee integer default null,p_survival_seconds bigint default null,p_steam_username text default null)
returns uuid language plpgsql security definer set search_path='' as $$begin
 perform pg_advisory_xact_lock(hashtextextended('winx-monthly-v2',0));
 return public.ingest_observation_legacy14(p_player_key,p_character_key,p_character_name,p_alive,p_blob_sha256,p_observed_at,p_kills_total,p_kills_firearm,p_kills_melee,p_survival_seconds,p_steam_username);
end $$;
revoke all on function public.ingest_player_observation(text,text,text,boolean,text,timestamptz,integer,integer,integer,bigint,text) from public,anon,authenticated;
grant execute on function public.ingest_player_observation(text,text,text,boolean,text,timestamptz,integer,integer,integer,bigint,text) to service_role;
create or replace function public.close_ranking_season(p_season_id uuid,p_winner_character_id uuid default null) returns uuid
language plpgsql security definer set search_path='' as $$begin
 perform pg_advisory_xact_lock(hashtextextended('winx-monthly-v2',0));
 if exists(select 1 from public.product14_state where monthly_enabled) then raise exception 'winx-v2 automatic calendar: legacy closure disabled';end if;
 return public.close_season_legacy14(p_season_id,p_winner_character_id);
end $$;
create or replace function public.start_ranking_season(p_name text,p_slug text,p_reward_message text default null) returns uuid
language plpgsql security definer set search_path='' as $$begin
 perform pg_advisory_xact_lock(hashtextextended('winx-monthly-v2',0));
 if exists(select 1 from public.product14_state where monthly_enabled) then raise exception 'winx-v2 automatic calendar: legacy creation disabled';end if;
 return public.start_season_legacy14(p_name,p_slug,p_reward_message);
end $$;
revoke all on function public.close_ranking_season(uuid,uuid),public.start_ranking_season(text,text,text) from public,anon,authenticated;
grant execute on function public.close_ranking_season(uuid,uuid),public.start_ranking_season(text,text,text) to service_role;
create table if not exists public.source_epochs_v2(
 world_id uuid primary key,generation_evidence_sha256 text not null check(generation_evidence_sha256~'^[a-f0-9]{64}$'),
 evidence_kind text not null check(evidence_kind='source_generation_manifest'),verified_at timestamptz not null,attested_by text not null
);
alter table public.source_epochs_v2 enable row level security;
revoke all on public.source_epochs_v2 from public,anon,authenticated,service_role;
create or replace function public.guard_source_epoch_v2() returns trigger
language plpgsql security definer set search_path='' as $$begin
 if exists(select 1 from public.product14_state where monthly_enabled)
  and not exists(select 1 from public.source_epochs_v2 where world_id=new.world_id) then
  raise exception 'source world generation requires independent evidence before cohort activation';
 end if;
 return new;
end $$;
revoke all on function public.guard_source_epoch_v2() from public,anon,authenticated,service_role;
drop trigger if exists guard_source_epoch_v2 on public.life_identities;
create trigger guard_source_epoch_v2 before insert or update on public.life_identities for each row execute function public.guard_source_epoch_v2();

do $$declare src text;begin
 if to_regprocedure('public.get_public_dashboard_release_legacy_v1()') is null then
  select pg_get_functiondef('public.get_public_dashboard_release_v1()'::regprocedure) into src;
  execute replace(src,'public.get_public_dashboard_release_v1()','public.get_public_dashboard_release_legacy_v1()');
 end if;
end $$;
revoke all on function public.get_public_dashboard_release_legacy_v1() from public;
grant execute on function public.get_public_dashboard_release_legacy_v1() to anon,authenticated,service_role;
create or replace function public.get_public_dashboard_release_v1() returns jsonb
language sql stable security definer set search_path='' as $$
 select public.get_public_dashboard_release_legacy_v1()||jsonb_build_object('product14_installed',true);
$$;
revoke all on function public.get_public_dashboard_release_v1() from public;
grant execute on function public.get_public_dashboard_release_v1() to anon,authenticated,service_role;

create or replace function public.get_service_product14_readiness_v2() returns jsonb
language sql stable security definer set search_path='' as $$
 select jsonb_build_object('schema_version','product14-v2','catalog_count',(select count(*) from public.medal_definitions_v2),
 'world_epoch_count',(select count(*) from public.source_epochs_v2),
 'contract_ready',(public.get_service_pipeline_readiness_v1()->>'contract_ready')::boolean and
  (select count(*)=28 from public.medal_definitions_v2) and exists(select 1 from public.source_epochs_v2),
 'life_enabled',(select life_enabled from public.dashboard_rollout_state),
 'monthly_enabled',(select monthly_enabled from public.product14_state));
$$;
revoke all on function public.get_service_product14_readiness_v2() from public,anon,authenticated;
grant execute on function public.get_service_product14_readiness_v2() to service_role;

create or replace function public.rollback_product14_activation_v2() returns void
language plpgsql security definer set search_path='' as $$begin
 perform pg_advisory_xact_lock(hashtextextended('winx-monthly-v2',0));
 if exists(select 1 from public.medal_unlocks_v2) or exists(select 1 from public.medal_baselines_v2) or exists(select 1 from public.season_cycles_v2 where certification<>'open')
  then raise exception 'certified history exists; controlled forward recovery required';end if;
 update public.product14_state set monthly_enabled=false,medals_enabled=false;
 update public.medal_definitions_v2 set active=false;
 update public.achievement_definitions set active=true;
 update public.ranking_seasons set scheduled_end_at=(select original_deadline from public.product14_state)
  where id='4ec32a87-fb16-4838-af57-f4cf85425a60';
end $$;
revoke all on function public.rollback_product14_activation_v2() from public,anon,authenticated;
grant execute on function public.rollback_product14_activation_v2() to service_role;
notify pgrst,'reload schema';
commit;
