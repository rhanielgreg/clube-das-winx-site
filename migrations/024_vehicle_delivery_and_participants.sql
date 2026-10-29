-- Additive private records only. Never seeds awards, candidates, catalogs or activation.
begin;
set local lock_timeout='5s';
create table public.reward_account_events_v3(
 id bigint generated always as identity primary key,account_id uuid not null references public.reward_accounts_v3(id),
 action text not null check(action='registered'),operator_id uuid not null,created_at timestamptz not null default now()
);
create table public.vehicle_deliveries_v3(
 modality text not null check(modality in('weekend','official')),draw_id uuid not null,
 state text not null check(state in('reserved','generated','key','repairs','uncertain','received')),
 vehicle_script_id text not null,vehicle_reference text,
 generated boolean not null default false,key_confirmed boolean not null default false,repairs_confirmed boolean not null default false,
 updated_at timestamptz not null default now(),primary key(modality,draw_id)
);
create table public.vehicle_delivery_events_v3(
 request_id uuid primary key,modality text not null,draw_id uuid not null,stage text not null,
 operator_id uuid not null,evidence text not null check(length(evidence) between 20 and 2000),
 vehicle_reference text,created_at timestamptz not null default now()
);
alter table public.reward_account_events_v3 enable row level security;
alter table public.vehicle_deliveries_v3 enable row level security;
alter table public.vehicle_delivery_events_v3 enable row level security;
revoke all on public.reward_account_events_v3,public.vehicle_deliveries_v3,public.vehicle_delivery_events_v3 from public,anon,authenticated,service_role;
revoke all on sequence public.reward_account_events_v3_id_seq from public,anon,authenticated,service_role;
create trigger reward_account_event_immutable before update or delete on public.reward_account_events_v3 for each row execute function public.guard_weekend_history_v3();
create trigger vehicle_event_immutable before update or delete on public.vehicle_delivery_events_v3 for each row execute function public.guard_weekend_history_v3();

create function public.register_reward_account_checked_v3(p_steam_id text,p_name text,p_username text,p_operator uuid) returns uuid
language plpgsql security definer set search_path='' as $$declare a public.reward_accounts_v3;begin
 if p_operator is null then raise exception 'authenticated operator required';end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('reward-account-registration',0));
 select * into a from public.reward_accounts_v3 where steam_id=p_steam_id for update;
 if a.id is not null then
  if (a.display_name,a.game_username) is distinct from(p_name,p_username)then raise exception 'existing identity differs; no rebind performed';end if;
  return a.id;
 end if;
 if exists(select 1 from public.reward_accounts_v3 where lower(game_username)=lower(p_username))then raise exception 'server username already registered';end if;
 insert into public.reward_accounts_v3(steam_id,display_name,game_username)values(p_steam_id,p_name,p_username) returning * into a;
 insert into public.reward_account_events_v3(account_id,action,operator_id)values(a.id,'registered',p_operator);
 return a.id;
end $$;

create function public.vehicle_entitlement_v3(p_modality text,p_draw uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$declare plan jsonb;i jsonb;begin
 plan:=public.get_remote_reward_plan_v3(p_modality,p_draw);
 if p_modality='official' and not coalesce((public.reward_eligibility_v1(p_draw)->>'eligible')::boolean,false)
 then raise exception 'monthly life is not eligible';end if;
 if plan->'recipient'->>'account_id' is null or plan->'recipient'->>'game_username' is null
 or plan->>'delivery_state' in('forfeited','blocked_identity')then raise exception 'verified recipient required';end if;
 if jsonb_array_length(plan->'reward'->'items')<>1 then raise exception 'one persisted vehicle required';end if;
 i:=plan->'reward'->'items'->0;
 if i->>'kind' is distinct from 'vehicle' or i->>'quantity' is distinct from '1'
 or plan->'reward'->>'delivery_method' is distinct from 'manual_vehicle'
 or not coalesce(i->>'script_id' in('69fordMustangBoss429','78lamboCountachLP400S','89defender110','88toyotaHiluxXC','92amgeneralM998'),false)
 then raise exception 'persisted selected vehicle required';end if;
 return plan;
end $$;

create function public.record_vehicle_delivery_v3(p_modality text,p_draw uuid,p_request uuid,p_stage text,p_operator uuid,
 p_confirm_identity boolean,p_evidence text,p_reference text default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare plan jsonb;v public.vehicle_deliveries_v3;e public.vehicle_delivery_events_v3;next_state text;begin
 if p_operator is null or p_request is null or p_confirm_identity is distinct from true or p_evidence is null
 or length(trim(p_evidence)) not between 20 and 2000 or p_stage is null
 or p_stage not in('begin','generated','key','repairs','received','uncertain','located','reconcile_received')
 then raise exception 'specific manual evidence required';end if;
 if p_reference is not null and (length(p_reference) not between 3 and 200 or p_reference ~ '[[:cntrl:]]')then raise exception 'bounded vehicle reference required';end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('vehicle-'||coalesce(p_modality,'')||coalesce(p_draw::text,''),0));
 if p_modality='official' then
  -- Same life -> delivery lock order as the existing monthly manual flow.
  perform 1 from public.life_identities where id=(select life_id from public.season_reward_draws_v1 where season_id=p_draw) for update;
  perform 1 from public.reward_delivery_state_v1 where season_id=p_draw for update;
 else
  perform 1 from public.reward_accounts_v3 where id=(select account_id from public.weekend_reward_draws_v3 where id=p_draw) for share;
  perform 1 from public.weekend_delivery_v3 where draw_id=p_draw for update;
 end if;
 select * into e from public.vehicle_delivery_events_v3 where request_id=p_request;
 if e.request_id is not null then
  if (e.modality,e.draw_id,e.stage,e.operator_id,e.evidence,e.vehicle_reference) is distinct from(p_modality,p_draw,p_stage,p_operator,trim(p_evidence),p_reference)
  then raise exception 'request belongs to a different record';end if;
  return jsonb_build_object('persisted',true,'existing',true,'game_commands',0);
 end if;
 plan:=public.vehicle_entitlement_v3(p_modality,p_draw);
 select * into v from public.vehicle_deliveries_v3 where modality=p_modality and draw_id=p_draw for update;
 if p_stage='begin' then
  if v.draw_id is not null or plan->>'delivery_state' not in('pending','awaiting_online')
   or exists(select 1 from public.remote_reward_components_v3 where modality=p_modality and draw_id=p_draw)
  then raise exception 'delivery already reserved';end if;
  insert into public.vehicle_deliveries_v3(modality,draw_id,state,vehicle_script_id)
  values(p_modality,p_draw,'reserved',plan->'reward'->'items'->0->>'script_id') returning * into v;
 else
  if v.draw_id is null or v.state='received' then raise exception 'active manual reservation required';end if;
  if v.vehicle_reference is not null and p_reference is distinct from v.vehicle_reference then raise exception 'same physical vehicle required';end if;
  if p_stage='generated' then
   if v.state<>'reserved' or v.generated or p_reference is null then raise exception 'one recorded generation required';end if;
   v.generated:=true;v.vehicle_reference:=p_reference;
  elsif p_stage='located' then
   if v.state<>'uncertain' or v.generated or p_reference is null then raise exception 'locate the existing vehicle; never respawn';end if;
   v.generated:=true;v.vehicle_reference:=p_reference;
  elsif p_stage='key' then
   if not v.generated or v.key_confirmed then raise exception 'generation before key';end if;v.key_confirmed:=true;
  elsif p_stage='repairs' then
   if not v.key_confirmed or v.repairs_confirmed then raise exception 'key before repairs';end if;v.repairs_confirmed:=true;
  elsif p_stage in('received','reconcile_received') then
   if not(v.generated and v.key_confirmed and v.repairs_confirmed) or (v.state='uncertain')<>(p_stage='reconcile_received')
   then raise exception 'generation, key, repairs and specific reconciliation required';end if;
  end if;
 end if;
 next_state:=case when p_stage='begin'then 'reserved' when p_stage in('received','reconcile_received')then 'received'
 when p_stage='uncertain' or v.state='uncertain' then 'uncertain' when p_stage='located'then 'uncertain' else p_stage end;
 update public.vehicle_deliveries_v3 set state=next_state,vehicle_reference=v.vehicle_reference,
 generated=v.generated,key_confirmed=v.key_confirmed,repairs_confirmed=v.repairs_confirmed,updated_at=now()
 where modality=p_modality and draw_id=p_draw;
 insert into public.vehicle_delivery_events_v3(request_id,modality,draw_id,stage,operator_id,evidence,vehicle_reference)
 values(p_request,p_modality,p_draw,p_stage,p_operator,trim(p_evidence),p_reference);
 if p_modality='official'then
  update public.reward_delivery_state_v1 set state=case when next_state='received'then 'confirmed_manual' when next_state='uncertain'then 'uncertain'else 'delivering'end,updated_at=now() where season_id=p_draw and state<>'forfeited';
  if next_state='received'then update public.reward_delivery_components_v1 set state='confirmed_manual' where season_id=p_draw;end if;
 else
  update public.weekend_delivery_v3 set state=case when next_state='received'then 'confirmed_manual' when next_state='uncertain'then 'uncertain'else 'delivering'end,updated_at=now() where draw_id=p_draw;
 end if;
 return jsonb_build_object('persisted',true,'existing',false,'state',next_state,'game_commands',0);
end $$;

create function public.get_service_reward_operations_v3(p_draw uuid default null) returns jsonb
language sql stable security definer set search_path='' as $$
 select jsonb_build_object('contract','reward-operations-v3','available',true,'checked_at',statement_timestamp(),
 'accounts',coalesce((select jsonb_agg(jsonb_build_object('id',a.id,'display_name',a.display_name,'game_username',a.game_username,
 'steam_hint','…'||right(a.steam_id,4),'status',a.status,'registered_at',a.registered_at,'verified_at',a.verified_at,
 'evidence_present',a.evidence_sha256 is not null,'registered_by',(select e.operator_id from public.reward_account_events_v3 e where e.account_id=a.id order by e.id limit 1))order by a.display_name)
 from public.reward_accounts_v3 a),'[]'::jsonb),
 'vehicles',coalesce((select jsonb_agg(to_jsonb(v)||jsonb_build_object('events',coalesce((select jsonb_agg(to_jsonb(e)order by e.created_at,e.request_id)
 from public.vehicle_delivery_events_v3 e where e.modality=v.modality and e.draw_id=v.draw_id),'[]'::jsonb)))
 from(select * from public.vehicle_deliveries_v3 where p_draw is null or draw_id=p_draw order by updated_at desc limit 200)v),'[]'::jsonb));
$$;
revoke all on function public.register_reward_account_checked_v3(text,text,text,uuid),public.vehicle_entitlement_v3(text,uuid),
 public.record_vehicle_delivery_v3(text,uuid,uuid,text,uuid,boolean,text,text),public.get_service_reward_operations_v3(uuid) from public,anon,authenticated,service_role;
grant execute on function public.register_reward_account_checked_v3(text,text,text,uuid),public.record_vehicle_delivery_v3(text,uuid,uuid,text,uuid,boolean,text,text),
 public.get_service_reward_operations_v3(uuid) to service_role;
notify pgrst,'reload schema';
commit;
