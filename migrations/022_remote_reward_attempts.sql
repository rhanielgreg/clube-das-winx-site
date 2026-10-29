-- Private outbox/at-most-once claims. No RCON configuration or activation.
begin;
set local lock_timeout='5s';
create table public.remote_reward_components_v3(
 modality text not null check(modality in('weekend','official')), draw_id uuid not null,
 component integer not null check(component between 0 and 1), attempt_id uuid not null,
 operator_id uuid not null, state text not null check(state in('started','sent_unconfirmed','uncertain')),
 started_at timestamptz not null default now(), finished_at timestamptz,
 response_sha256 text, response_bytes integer, primary key(modality,draw_id,component)
);
create table public.remote_reward_events_v3(
 id bigint generated always as identity primary key, modality text not null,draw_id uuid not null,
 component integer not null,attempt_id uuid not null,operator_id uuid not null,state text not null,
 response_sha256 text,response_bytes integer,created_at timestamptz not null default now()
);
create trigger remote_event_immutable before update or delete on public.remote_reward_events_v3 for each row execute function public.guard_weekend_history_v3();
create or replace function public.weekend_draw_dto_v3(p_draw uuid) returns jsonb
language sql stable security definer set search_path='' as $$
 select to_jsonb(d)-'operator_id'-'request_id'-'recipient_snapshot'||jsonb_build_object(
 'modality','weekend','recipient_snapshot',d.recipient_snapshot-'steam_id'-'account_token','delivery_state',s.state,
 'components',coalesce((select jsonb_agg(jsonb_build_object('component',c.component,'state',c.state,'attempt_id',c.attempt_id,
 'started_at',c.started_at,'finished_at',c.finished_at,'response_sha256',c.response_sha256) order by c.component)
 from public.remote_reward_components_v3 c where c.modality='weekend' and c.draw_id=d.id),'[]'::jsonb),
 'events',coalesce((select jsonb_agg(jsonb_build_object('action',e.action,'created_at',e.created_at) order by e.id)
 from public.weekend_reward_events_v3 e where e.draw_id=d.id),'[]'::jsonb))
 from public.weekend_reward_draws_v3 d join public.weekend_delivery_v3 s on s.draw_id=d.id where d.id=p_draw;
$$;

create function public.get_remote_reward_plan_v3(p_modality text,p_draw uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare recipient jsonb;reward jsonb;entitlement jsonb;delivery text;s public.roulette_release_v3;
 a public.reward_accounts_v3;d public.season_reward_draws_v1;w public.weekend_reward_draws_v3;allowed boolean;begin
 select * into s from public.roulette_release_v3 where id;
 if p_modality='official' then
  select * into d from public.season_reward_draws_v1 where season_id=p_draw;
  if d.season_id is null then raise exception 'unknown draw';end if;
  entitlement:=public.reward_eligibility_v1(p_draw);
  select * into a from public.reward_accounts_v3 where account_token=d.account_token and status='verified';
  reward:=d.reward_snapshot;
  select state into delivery from public.reward_delivery_state_v1 where season_id=p_draw;
  -- players/additem identify usernames, not the native life currently online.
  -- Do not turn account verification into proof of the exact monthly champion life.
  -- A future adapter with independent live-life evidence is required here.
  allowed:=false;
 elsif p_modality='weekend' then
  select * into w from public.weekend_reward_draws_v3 where id=p_draw;
  if w.id is null then raise exception 'unknown draw';end if;
  select * into a from public.reward_accounts_v3 where id=w.account_id and status='verified';
  reward:=w.reward_snapshot;
  select state into delivery from public.weekend_delivery_v3 where draw_id=p_draw;
  -- A persisted account prize survives death, character replacement and the window closing.
  allowed:=true;
 else raise exception 'unknown modality';end if;
 recipient:=jsonb_build_object('account_id',a.id,'steam_id',a.steam_id,'game_username',a.game_username,'display_name',a.display_name);
 return jsonb_build_object('modality',p_modality,'draw_id',p_draw,'reward',reward,'recipient',recipient,'delivery_state',delivery,
 'enabled',coalesce(allowed,false) and a.id is not null and coalesce(s.remote_enabled,false) and s.rcon_evidence is not null and s.activation_approval is not null
 and delivery in('pending','awaiting_online') and not exists(select 1 from public.remote_reward_components_v3 where modality=p_modality and draw_id=p_draw),
 'attempts',coalesce((select jsonb_agg(jsonb_build_object('component',c.component,'attempt_id',c.attempt_id,'state',c.state,
 'started_at',c.started_at,'finished_at',c.finished_at,'response_sha256',c.response_sha256,'response_bytes',c.response_bytes) order by c.component)
 from public.remote_reward_components_v3 c where c.modality=p_modality and c.draw_id=p_draw),'[]'::jsonb));
end $$;

create function public.claim_remote_reward_v3(p_modality text,p_draw uuid,p_attempt uuid,p_operator uuid) returns jsonb
language plpgsql security definer set search_path='' as $$declare plan jsonb;i jsonb;n integer:=0;begin
 if p_attempt is null or p_operator is null then raise exception 'invalid operation';end if;
 perform 1 from public.roulette_release_v3 where id for share;
 -- Serialize against the existing monthly manual delivery/death guard; no resends after uncertain state.
 if p_modality='official' then
  perform 1 from public.reward_delivery_state_v1 where season_id=p_draw for update;
 else perform 1 from public.weekend_delivery_v3 where draw_id=p_draw for update;end if;
 plan:=public.get_remote_reward_plan_v3(p_modality,p_draw);
 if not coalesce((plan->>'enabled')::boolean,false) then raise exception 'remote release blocked or already claimed';end if;
 for i in select value from jsonb_array_elements(plan->'reward'->'items') loop
  insert into public.remote_reward_components_v3(modality,draw_id,component,attempt_id,operator_id,state)values(p_modality,p_draw,n,p_attempt,p_operator,'started');
  insert into public.remote_reward_events_v3(modality,draw_id,component,attempt_id,operator_id,state)values(p_modality,p_draw,n,p_attempt,p_operator,'started');n:=n+1;
 end loop;
 if p_modality='official' then update public.reward_delivery_state_v1 set state='delivering',updated_at=now() where season_id=p_draw;
 else update public.weekend_delivery_v3 set state='delivering',updated_at=now() where draw_id=p_draw;end if;
 return plan||jsonb_build_object('claimed',true,'attempt_id',p_attempt);
end $$;

create function public.finish_remote_component_v3(p_modality text,p_draw uuid,p_attempt uuid,p_component integer,
 p_state text,p_hash text,p_bytes integer,p_operator uuid) returns void
language plpgsql security definer set search_path='' as $$declare next_state text;begin
 if p_state not in('sent_unconfirmed','uncertain') or p_hash !~ '^[a-f0-9]{64}$' or p_hash is null or p_bytes<0 or p_bytes>65536 or p_bytes is null
 then raise exception 'invalid outcome';end if;
 if p_modality='official' then perform 1 from public.reward_delivery_state_v1 where season_id=p_draw for update;
 else perform 1 from public.weekend_delivery_v3 where draw_id=p_draw for update;end if;
 update public.remote_reward_components_v3 set state=p_state,response_sha256=p_hash,response_bytes=p_bytes,finished_at=now()
 where modality=p_modality and draw_id=p_draw and component=p_component and attempt_id=p_attempt and operator_id=p_operator and state='started';
 if not found then raise exception 'component not owned or already finished';end if;
 insert into public.remote_reward_events_v3(modality,draw_id,component,attempt_id,operator_id,state,response_sha256,response_bytes)
 values(p_modality,p_draw,p_component,p_attempt,p_operator,p_state,p_hash,p_bytes);
 select case when bool_and(state='sent_unconfirmed')then 'sent_unconfirmed'
 when bool_or(state='sent_unconfirmed')then 'partial' else 'uncertain' end into next_state
 from public.remote_reward_components_v3 where modality=p_modality and draw_id=p_draw;
 if p_modality='official' then
  update public.reward_delivery_state_v1 set state=next_state,updated_at=now() where season_id=p_draw and state<>'forfeited';
  update public.reward_delivery_components_v1 set state='uncertain' where season_id=p_draw and component=p_component and state<>'confirmed_manual';
 else update public.weekend_delivery_v3 set state=next_state,updated_at=now() where draw_id=p_draw;end if;
end $$;

do $$declare t text;f record;begin
 foreach t in array array['remote_reward_components_v3','remote_reward_events_v3']loop
 execute format('alter table public.%I enable row level security',t);
 execute format('revoke all on public.%I from public,anon,authenticated,service_role',t);end loop;
 for f in select p.oid::regprocedure signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname='public' and p.proname in('get_remote_reward_plan_v3','claim_remote_reward_v3','finish_remote_component_v3')loop
 execute format('revoke all on function %s from public,anon,authenticated,service_role',f.signature);end loop;
end $$;
grant execute on function public.get_remote_reward_plan_v3(text,uuid), public.claim_remote_reward_v3(text,uuid,uuid,uuid),
 public.finish_remote_component_v3(text,uuid,uuid,integer,text,text,integer,uuid) to service_role;
revoke all on sequence public.remote_reward_events_v3_id_seq from public,anon,authenticated,service_role;
notify pgrst,'reload schema';
commit;
