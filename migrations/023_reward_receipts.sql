-- Additive private response audit and explicit manual receipt reconciliation.
-- No retries, game commands, accounts, awards, rollout flags or season mutations.
begin;
set local lock_timeout='5s';
create table public.remote_reward_replies_v3(
 modality text not null,draw_id uuid not null,component integer not null,attempt_id uuid not null,
 response_text text not null check(length(response_text)<=2000),response_sha256 text not null,
 response_bytes integer not null,created_at timestamptz not null default now(),
 primary key(modality,draw_id,component,attempt_id)
);
create table public.weekend_reward_receipts_v3(
 request_id uuid primary key,draw_id uuid not null references public.weekend_reward_draws_v3(id),component integer not null,
 account_id uuid not null references public.reward_accounts_v3(id),operator_id uuid not null,
 evidence text not null check(length(evidence) between 20 and 2000),confirmed_at timestamptz not null default now(),
 unique(draw_id,component)
);
alter table public.remote_reward_replies_v3 enable row level security;
alter table public.weekend_reward_receipts_v3 enable row level security;
revoke all on public.remote_reward_replies_v3,public.weekend_reward_receipts_v3 from public,anon,authenticated,service_role;
create trigger remote_reply_immutable before update or delete on public.remote_reward_replies_v3 for each row execute function public.guard_weekend_history_v3();
create trigger weekend_receipt_immutable before update or delete on public.weekend_reward_receipts_v3 for each row execute function public.guard_weekend_history_v3();

-- Widen a vocabulary, preserving every existing state and row. No data discarded.
alter table public.remote_reward_components_v3 drop constraint remote_reward_components_v3_state_check;
alter table public.remote_reward_components_v3 add constraint remote_reward_components_v3_state_check
 check(state in('started','sent_unconfirmed','uncertain','confirmed_manual'));

create function public.finish_remote_reply_v3(p_modality text,p_draw uuid,p_attempt uuid,p_component integer,
 p_state text,p_hash text,p_bytes integer,p_operator uuid,p_response text) returns void
language plpgsql security definer set search_path='' as $$begin
 if p_response is null or length(p_response)>2000 then raise exception 'bounded sanitized reply required';end if;
 perform public.finish_remote_component_v3(p_modality,p_draw,p_attempt,p_component,p_state,p_hash,p_bytes,p_operator);
 insert into public.remote_reward_replies_v3(modality,draw_id,component,attempt_id,response_text,response_sha256,response_bytes)
 values(p_modality,p_draw,p_component,p_attempt,p_response,p_hash,p_bytes);
end $$;

create function public.record_weekend_receipt_v3(p_draw uuid,p_component integer,p_request uuid,p_operator uuid,
 p_account uuid,p_confirm_account boolean,p_evidence text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare d public.weekend_reward_draws_v3;c public.remote_reward_components_v3;r public.weekend_reward_receipts_v3;next_state text;begin
 if p_request is null or p_operator is null or p_confirm_account is distinct from true or p_evidence is null or length(trim(p_evidence)) not between 20 and 2000
 then raise exception 'account confirmation and independent receipt evidence required';end if;
 select * into d from public.weekend_reward_draws_v3 where id=p_draw;
 if d.id is null or p_account is distinct from d.account_id or p_component is null or p_component<0 or p_component>=jsonb_array_length(d.reward_snapshot->'items')
 then raise exception 'persisted recipient and component required';end if;
 perform 1 from public.weekend_delivery_v3 where draw_id=p_draw for update;
 select * into r from public.weekend_reward_receipts_v3 where request_id=p_request;
 if r.request_id is not null then
  if (r.draw_id,r.component,r.account_id,r.operator_id) is distinct from(p_draw,p_component,p_account,p_operator)then raise exception 'request belongs to another receipt';end if;
  return jsonb_build_object('persisted',true,'existing',true,'manual_attestation',true);
 end if;
 if not exists(select 1 from public.reward_accounts_v3 where id=p_account and status='verified')then raise exception 'account verification missing';end if;
 select * into c from public.remote_reward_components_v3 where modality='weekend' and draw_id=p_draw and component=p_component for update;
 if c.attempt_id is null or c.state='confirmed_manual' or (c.state='started' and c.started_at>now()-interval '2 minutes')
 then raise exception 'wait for executor completion or reconcile the stale reserved attempt';end if;
 insert into public.weekend_reward_receipts_v3(request_id,draw_id,component,account_id,operator_id,evidence)
 values(p_request,p_draw,p_component,p_account,p_operator,trim(p_evidence));
 update public.remote_reward_components_v3 set state='confirmed_manual',finished_at=coalesce(finished_at,now()) where modality='weekend' and draw_id=p_draw and component=p_component;
 insert into public.remote_reward_events_v3(modality,draw_id,component,attempt_id,operator_id,state)
 values('weekend',p_draw,p_component,c.attempt_id,p_operator,'confirmed_manual');
 select case when count(*)=jsonb_array_length(d.reward_snapshot->'items') and bool_and(state='confirmed_manual')then 'confirmed_manual'else 'partial'end into next_state
 from public.remote_reward_components_v3 where modality='weekend' and draw_id=p_draw;
 update public.weekend_delivery_v3 set state=next_state,updated_at=now() where draw_id=p_draw;
 return jsonb_build_object('persisted',true,'existing',false,'state',next_state,'manual_attestation',true);
end $$;

create or replace function public.weekend_draw_dto_v3(p_draw uuid) returns jsonb
language sql stable security definer set search_path='' as $$
 select to_jsonb(d)-'operator_id'-'request_id'-'recipient_snapshot'||jsonb_build_object(
 'modality','weekend','recipient_snapshot',d.recipient_snapshot-'steam_id'-'account_token','delivery_state',s.state,
 'components',coalesce((select jsonb_agg(jsonb_build_object('component',c.component,'state',c.state,'attempt_id',c.attempt_id,
 'started_at',c.started_at,'finished_at',c.finished_at,'response_sha256',c.response_sha256,
 'response',(select response_text from public.remote_reward_replies_v3 r where r.modality=c.modality and r.draw_id=c.draw_id and r.component=c.component and r.attempt_id=c.attempt_id)) order by c.component)
 from public.remote_reward_components_v3 c where c.modality='weekend' and c.draw_id=d.id),'[]'::jsonb),
 'receipts',coalesce((select jsonb_agg(jsonb_build_object('component',r.component,'confirmed_at',r.confirmed_at,'kind','manual_attestation') order by r.component)
 from public.weekend_reward_receipts_v3 r where r.draw_id=d.id),'[]'::jsonb),
 'events',coalesce((select jsonb_agg(jsonb_build_object('action',e.action,'created_at',e.created_at) order by e.id)
 from public.weekend_reward_events_v3 e where e.draw_id=d.id),'[]'::jsonb))
 from public.weekend_reward_draws_v3 d join public.weekend_delivery_v3 s on s.draw_id=d.id where d.id=p_draw;
$$;
revoke all on function public.finish_remote_reply_v3(text,uuid,uuid,integer,text,text,integer,uuid,text),
 public.record_weekend_receipt_v3(uuid,integer,uuid,uuid,uuid,boolean,text) from public,anon,authenticated,service_role;
grant execute on function public.finish_remote_reply_v3(text,uuid,uuid,integer,text,text,integer,uuid,text),
 public.record_weekend_receipt_v3(uuid,integer,uuid,uuid,uuid,boolean,text) to service_role;
notify pgrst,'reload schema';
commit;
