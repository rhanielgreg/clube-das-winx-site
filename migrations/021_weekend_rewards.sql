-- Roleta 3: additive, private account rewards. No participants, awards or activation seeded.
begin;
set local lock_timeout='5s';
create table public.roulette_release_v3(
 id boolean primary key default true check(id), weekly_enabled boolean not null default false,
 remote_enabled boolean not null default false, rollover_evidence text, rcon_evidence text, activation_approval text,
 approved_catalog jsonb, catalog_approval text,
 check(rollover_evidence is null or rollover_evidence ~ '^[a-f0-9]{64}$'),
 check(rcon_evidence is null or rcon_evidence ~ '^[a-f0-9]{64}$'),
 check(activation_approval is null or activation_approval ~ '^[a-f0-9]{64}$'),
 check(catalog_approval is null or catalog_approval ~ '^[a-f0-9]{64}$')
);
insert into public.roulette_release_v3(id) values(true);
create table public.reward_accounts_v3(
 id uuid primary key default gen_random_uuid(), steam_id text not null unique check(steam_id ~ '^7656119[0-9]{10}$'),
 display_name text not null check(length(display_name) between 1 and 80 and display_name !~ '[[:cntrl:]]'),
 game_username text not null unique check(game_username ~ '^[A-Za-z0-9_ .-]{1,64}$'),
 account_token text unique, status text not null default 'pending' check(status in('pending','verified','revoked')),
 evidence_sha256 text, verified_at timestamptz, verified_by uuid, registered_at timestamptz not null default now(),
 check(status<>'verified' or (evidence_sha256 is not null and evidence_sha256 ~ '^[a-f0-9]{64}$' and verified_at is not null and verified_by is not null))
);
create table public.weekend_reward_draws_v3(
 id uuid primary key default gen_random_uuid(), account_id uuid not null references public.reward_accounts_v3(id),
 window_start timestamptz not null, window_end timestamptz not null,
 catalog_version text not null references public.reward_catalogs_v1(version), rarity text not null,
 reward_id text not null, reward_snapshot jsonb not null, recipient_snapshot jsonb not null,
 probabilities jsonb not null, drawn_at timestamptz not null default now(), operator_id uuid not null,
 request_id uuid not null unique, unique(account_id,window_start), check(window_end>window_start)
);
create table public.weekend_delivery_v3(
 draw_id uuid primary key references public.weekend_reward_draws_v3(id), state text not null default 'pending'
 check(state in('pending','awaiting_online','delivering','sent_unconfirmed','uncertain','partial','confirmed_manual','blocked_identity')),
 updated_at timestamptz not null default now()
);
create table public.weekend_reward_events_v3(
 id bigint generated always as identity primary key, draw_id uuid not null references public.weekend_reward_draws_v3(id),
 action text not null, operator_id uuid not null, created_at timestamptz not null default now()
);
create function public.weekend_window_v3(p_at timestamptz) returns jsonb
language sql immutable set search_path='' as $$
 with local as (select p_at at time zone 'America/Sao_Paulo' t), dates as (
 select (date_trunc('week',t)+interval '5 days')::date saturday,t from local)
 select jsonb_build_object('timezone','America/Sao_Paulo',
 'starts_at',saturday::timestamp at time zone 'America/Sao_Paulo',
 'ends_at',(saturday+2)::timestamp at time zone 'America/Sao_Paulo',
 'open',t>=saturday::timestamp and t<(saturday+2)::timestamp) from dates;
$$;
create function public.weekend_gate_v3(p_at timestamptz) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare s public.roulette_release_v3;c public.reward_catalogs_v1;reasons jsonb:='[]';begin
 select * into s from public.roulette_release_v3 where id;
 select * into c from public.reward_catalogs_v1 where active;
 if not coalesce(s.weekly_enabled,false)then reasons:=reasons||'"activation_disabled"'::jsonb;end if;
 if s.rollover_evidence is null or not exists(select 1 from public.season_cycles_v2 a
 join public.season_cycles_v2 b on b.season_number=2 and b.starts_at=a.ends_at
 where a.season_number=1 and a.closed_at is not null and a.certification<>'open' and b.starts_at<=p_at)
 then reasons:=reasons||'"first_rollover_unverified"'::jsonb;end if;
 if s.catalog_approval is null or s.approved_catalog is distinct from c.definition
 or not coalesce(public.valid_reward_catalog_v1(c.definition),false)
 or coalesce(jsonb_array_length(c.definition->'rewards'),0)<>36
 then reasons:=reasons||'"catalog36_unapproved"'::jsonb;end if;
 if not coalesce(s.remote_enabled,false) or s.rcon_evidence is null then reasons:=reasons||'"rcon_unvalidated"'::jsonb;end if;
 if s.activation_approval is null then reasons:=reasons||'"final_approval_missing"'::jsonb;end if;
 return jsonb_build_object('enabled',reasons='[]'::jsonb,'reasons',reasons);
end $$;

create function public.guard_weekend_history_v3() returns trigger
language plpgsql security definer set search_path='' as $$begin
 if tg_table_name='reward_catalogs_v1' then
  if tg_op='UPDATE' and new.definition is not distinct from old.definition then return new;end if;
  if not exists(select 1 from public.weekend_reward_draws_v3 where catalog_version=old.version)then return coalesce(new,old);end if;
 end if;
 raise exception 'reward history is immutable';
end $$;
create trigger weekend_draw_immutable before update or delete on public.weekend_reward_draws_v3 for each row execute function public.guard_weekend_history_v3();
create trigger weekend_event_immutable before update or delete on public.weekend_reward_events_v3 for each row execute function public.guard_weekend_history_v3();
create trigger weekend_catalog_immutable before update or delete on public.reward_catalogs_v1 for each row execute function public.guard_weekend_history_v3();
create function public.guard_verified_account_v3() returns trigger language plpgsql set search_path='' as $$begin
 if old.status in('verified','revoked') and (new.steam_id,new.game_username,new.account_token,new.display_name,new.evidence_sha256,new.verified_at,new.verified_by)
 is distinct from (old.steam_id,old.game_username,old.account_token,old.display_name,old.evidence_sha256,old.verified_at,old.verified_by)
 then raise exception 'verified identity cannot be rebound';end if;return new;
end $$;
create trigger verified_account_immutable before update on public.reward_accounts_v3 for each row execute function public.guard_verified_account_v3();

-- Registration never certifies ownership or its connection to the server account.
create function public.register_reward_account_v3(p_steam_id text,p_name text,p_username text) returns uuid
language plpgsql security definer set search_path='' as $$declare result uuid;begin
 insert into public.reward_accounts_v3(steam_id,display_name,game_username) values(p_steam_id,p_name,p_username)
 on conflict(steam_id) do nothing returning id into result;
 return coalesce(result,(select id from public.reward_accounts_v3 where steam_id=p_steam_id));
end $$;
-- Owner-only attestation: no service_role/HTTP permission. Requires independently reviewed evidence.
create function public.attest_reward_account_v3(p_account uuid,p_token text,p_evidence text,p_operator uuid) returns void
language plpgsql security definer set search_path='' as $$begin
 if p_evidence !~ '^[a-f0-9]{64}$' or p_evidence is null or p_operator is null or p_token !~ '^[a-f0-9]{64}$' or p_token is null then raise exception 'independent identity evidence required';end if;
 update public.reward_accounts_v3 set status='verified',account_token=p_token,evidence_sha256=p_evidence,verified_by=p_operator,verified_at=now() where id=p_account and status='pending';
 if not found then raise exception 'pending account not found';end if;
end $$;
create function public.weekend_draw_dto_v3(p_draw uuid) returns jsonb
language sql stable security definer set search_path='' as $$
 select to_jsonb(d)-'operator_id'-'request_id'-'recipient_snapshot'||jsonb_build_object(
 'modality','weekend','recipient_snapshot',d.recipient_snapshot-'steam_id'-'account_token',
 'delivery_state',s.state,'events',coalesce((select jsonb_agg(jsonb_build_object('action',e.action,'created_at',e.created_at) order by e.id)
 from public.weekend_reward_events_v3 e where e.draw_id=d.id),'[]'::jsonb))
 from public.weekend_reward_draws_v3 d join public.weekend_delivery_v3 s on s.draw_id=d.id where d.id=p_draw;
$$;
create function public.get_service_weekend_v3(p_draw uuid default null) returns jsonb
language sql stable security definer set search_path='' as $$
 select jsonb_build_object('contract','weekend-rewards-v3','available',true,'checked_at',statement_timestamp(),
 'window',public.weekend_window_v3(statement_timestamp()),'gate',public.weekend_gate_v3(statement_timestamp()),
 'remote_release_ready',coalesce((select remote_enabled and rcon_evidence is not null and activation_approval is not null from public.roulette_release_v3 where id),false),
 'participants',coalesce((select jsonb_agg(jsonb_build_object('id',a.id,'display_name',a.display_name,
 'status',a.status,'verified',a.status='verified','draw_id',d.id) order by a.display_name)
 from public.reward_accounts_v3 a left join public.weekend_reward_draws_v3 d on d.account_id=a.id
 and d.window_start=(public.weekend_window_v3(statement_timestamp())->>'starts_at')::timestamptz),'[]'::jsonb),
 'draws',coalesce((select jsonb_agg(public.weekend_draw_dto_v3(x.id) order by x.drawn_at desc) from
 (select d.id,d.drawn_at from public.weekend_reward_draws_v3 d where p_draw is null or d.id=p_draw order by d.drawn_at desc limit 200)x),'[]'::jsonb));
$$;
-- Explicit clock is owner-only for isolated boundary/concurrency tests. HTTP uses the wrapper below.
create function public.draw_weekend_at_v3(p_account uuid,p_window timestamptz,p_catalog text,p_rarity text,p_reward text,
 p_request uuid,p_operator uuid,p_at timestamptz) returns jsonb
language plpgsql security definer set search_path='' as $$
declare a public.reward_accounts_v3;d public.weekend_reward_draws_v3;c public.reward_catalogs_v1;
 w jsonb;r jsonb;begin
 if p_request is null or p_operator is null or p_at is null then raise exception 'invalid operation';end if;
 -- Lock order is release -> account -> catalog. No game life locks, death does not consume a second ticket.
 perform 1 from public.roulette_release_v3 where id for share;
 select * into a from public.reward_accounts_v3 where id=p_account for update;
 if a.id is null then raise exception 'unknown participant';end if;
 select * into d from public.weekend_reward_draws_v3 where account_id=a.id and window_start=p_window;
 if d.id is not null then return jsonb_build_object('persisted',true,'existing',true,'draw',public.weekend_draw_dto_v3(d.id));end if;
 w:=public.weekend_window_v3(p_at);
 if a.status<>'verified' or not (w->>'open')::boolean or p_window is distinct from (w->>'starts_at')::timestamptz
 or not (public.weekend_gate_v3(p_at)->>'enabled')::boolean then raise exception 'weekly release blocked';end if;
 select * into c from public.reward_catalogs_v1 where active and version=p_catalog for share;
 if c.version is null then raise exception 'catalog changed';end if;
 select x into r from jsonb_array_elements(c.definition->'rewards')x where x->>'id'=p_reward and x->>'rarity'=p_rarity;
 if r is null then raise exception 'reward not in approved catalog';end if;
 insert into public.weekend_reward_draws_v3(account_id,window_start,window_end,catalog_version,rarity,reward_id,reward_snapshot,
 recipient_snapshot,probabilities,operator_id,request_id,drawn_at)values(a.id,p_window,(w->>'ends_at')::timestamptz,c.version,p_rarity,p_reward,r,
 jsonb_build_object('account_id',a.id,'display_name',a.display_name,'game_username',a.game_username,'steam_id',a.steam_id,'account_token',a.account_token),
 '{"common":45,"uncommon":30,"rare":20,"epic":4,"legendary":1}',p_operator,p_request,p_at) returning * into d;
 insert into public.weekend_delivery_v3(draw_id)values(d.id);
 insert into public.weekend_reward_events_v3(draw_id,action,operator_id)values(d.id,'draw',p_operator);
 return jsonb_build_object('persisted',true,'existing',false,'draw',public.weekend_draw_dto_v3(d.id));
end $$;
create function public.draw_weekend_reward_v3(p_account uuid,p_window timestamptz,p_catalog text,p_rarity text,p_reward text,p_request uuid,p_operator uuid) returns jsonb
language sql security definer set search_path='' as $$
 select public.draw_weekend_at_v3(p_account,p_window,p_catalog,p_rarity,p_reward,p_request,p_operator,statement_timestamp());
$$;

do $$declare t text;f record;begin
 foreach t in array array['roulette_release_v3','reward_accounts_v3','weekend_reward_draws_v3','weekend_delivery_v3','weekend_reward_events_v3'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('revoke all on public.%I from public,anon,authenticated,service_role',t);end loop;
 for f in select p.oid::regprocedure signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname='public' and p.proname in('weekend_window_v3','weekend_gate_v3','guard_weekend_history_v3','guard_verified_account_v3',
 'register_reward_account_v3','attest_reward_account_v3','weekend_draw_dto_v3','get_service_weekend_v3','draw_weekend_at_v3','draw_weekend_reward_v3')loop
 execute format('revoke all on function %s from public,anon,authenticated,service_role',f.signature);end loop;
end $$;
grant execute on function public.register_reward_account_v3(text,text,text),public.get_service_weekend_v3(uuid),
 public.draw_weekend_reward_v3(uuid,timestamptz,text,text,text,uuid,uuid) to service_role;
revoke all on sequence public.weekend_reward_events_v3_id_seq from public,anon,authenticated,service_role;
notify pgrst,'reload schema';
commit;
