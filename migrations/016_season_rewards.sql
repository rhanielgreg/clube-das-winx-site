-- Additive seasonal rewards. No game commands, seeded draws, or auto delivery.
begin;
set local lock_timeout='5s';
create table if not exists public.reward_catalogs_v1(
 version text primary key,definition jsonb not null,active boolean not null default false,created_at timestamptz not null default now(),
 check(definition->>'version'=version)
);
create unique index if not exists reward_catalog_one_active on public.reward_catalogs_v1(active) where active;
create table if not exists public.season_reward_draws_v1(
 season_id uuid primary key references public.season_cycles_v2(season_id),life_id uuid not null references public.life_identities(id),
 profile_id uuid not null references public.game_characters(id),world_id uuid not null,account_token text not null,
 catalog_version text not null references public.reward_catalogs_v1(version),rarity text not null,
 reward_id text not null,reward_snapshot jsonb not null,presentation_snapshot jsonb not null,probabilities jsonb not null,
 certification_snapshot jsonb not null,drawn_at timestamptz not null default now(),operator_id uuid not null,request_id uuid not null unique
);
create table if not exists public.reward_delivery_state_v1(
 season_id uuid primary key references public.season_reward_draws_v1(season_id),
 state text not null default 'pending' check(state in('pending','awaiting_online','blocked_identity','delivering','sent_unconfirmed','uncertain','partial','confirmed_manual','forfeited','needs_intervention')),
 attempt_id uuid,updated_at timestamptz not null default now()
);
create table if not exists public.reward_delivery_components_v1(
 season_id uuid not null references public.season_reward_draws_v1(season_id),component integer not null check(component between 0 and 1),
 state text not null default 'pending' check(state in('pending','uncertain','confirmed_manual')),
 primary key(season_id,component)
);
create table if not exists public.reward_events_v1(
 id bigint generated always as identity primary key,season_id uuid not null references public.season_reward_draws_v1(season_id),
 request_id uuid not null unique,operator_id uuid,action text not null,previous_state text,new_state text not null,
 component integer,evidence text,created_at timestamptz not null default now()
);
do $$declare t text;begin
 foreach t in array array['reward_catalogs_v1','season_reward_draws_v1','reward_delivery_state_v1','reward_delivery_components_v1','reward_events_v1'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on public.%I from public,anon,authenticated,service_role',t);
 end loop;
end $$;

create or replace function public.valid_reward_catalog_v1(def jsonb) returns boolean
language plpgsql immutable set search_path='' as $$declare r jsonb;i jsonb;rarity text;seen text[]:='{}';begin
 if jsonb_typeof(def)<>'object' or coalesce(def->>'version','')='' or jsonb_typeof(def->'rewards')<>'array' then return false;end if;
 for r in select value from jsonb_array_elements(def->'rewards') loop
  if coalesce(r->>'id','')='' or coalesce(r->>'name','')='' or (r->>'id')=any(seen) or coalesce(r->>'rarity','') not in('common','uncommon','rare','epic','legendary')
   or coalesce(r->>'verified','false')<>'true' or coalesce(r->>'server_build','')!~'^\d+\.\d+\.\d+$'
   or coalesce(r->>'evidence_sha256','')!~'^[a-f0-9]{64}$' or r->>'delivery_method' is distinct from 'manual_verified'
   or coalesce(r->>'weight','')!~'^[1-9][0-9]{0,6}$' or (r->>'weight')::integer>1000000
   or jsonb_typeof(r->'items') is distinct from 'array' then return false;end if;
  seen:=array_append(seen,r->>'id');
  if jsonb_array_length(r->'items')<>(case when r->>'rarity'='rare' then 2 else 1 end) then return false;end if;
  for i in select value from jsonb_array_elements(r->'items') loop
   if i->>'kind' is distinct from 'item' or coalesce(i->>'script_id','')!~'^[A-Za-z][A-Za-z0-9_]*\.[A-Za-z][A-Za-z0-9_]*$'
    or coalesce(i->>'quantity','')!~'^[1-9][0-9]{0,2}$' or (i->>'quantity')::integer>100 then return false;end if;
   if r->>'rarity'='legendary' and (i->>'script_id'<>'Base.Katana' or (i->>'quantity')::integer<>1) then return false;end if;
   if r->>'rarity'='epic' and i->>'script_id' ilike '%sledgehammer%' then return false;end if;
  end loop;
 end loop;
 foreach rarity in array array['common','uncommon','rare','epic','legendary'] loop
  if not exists(select 1 from jsonb_array_elements(def->'rewards') x where x->>'rarity'=rarity)then return false;end if;
 end loop;
 return true;
exception when others then return false;end $$;
revoke all on function public.valid_reward_catalog_v1(jsonb) from public,anon,authenticated;
grant execute on function public.valid_reward_catalog_v1(jsonb) to service_role;

create or replace function public.guard_reward_immutable_v1() returns trigger
language plpgsql security definer set search_path='' as $$begin
 if tg_table_name='reward_catalogs_v1' then
  if tg_op='DELETE' then raise exception 'catalog history is preserved';end if;
  if new.active and not public.valid_reward_catalog_v1(new.definition)then raise exception 'all five rarities require verified rewards';end if;
  if tg_op='UPDATE' and new.definition is distinct from old.definition and exists(select 1 from public.season_reward_draws_v1 where catalog_version=old.version)then raise exception 'used catalog is immutable';end if;
  return new;
 end if;
 raise exception 'official reward history is append-only';
end $$;
revoke all on function public.guard_reward_immutable_v1() from public,anon,authenticated,service_role;
create trigger guard_reward_catalog_v1 before insert or update or delete on public.reward_catalogs_v1 for each row execute function public.guard_reward_immutable_v1();
create trigger guard_reward_draw_v1 before update or delete on public.season_reward_draws_v1 for each row execute function public.guard_reward_immutable_v1();
create trigger guard_reward_events_v1 before update or delete on public.reward_events_v1 for each row execute function public.guard_reward_immutable_v1();

create or replace function public.reward_eligibility_v1(p_season_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare c public.season_cycles_v2%rowtype;l public.life_identities%rowtype;result text;begin
 select * into c from public.season_cycles_v2 where season_id=p_season_id;
 if not found then return jsonb_build_object('eligible',false,'reason','season_not_found');end if;
 if c.certification<>'champion' or c.closed_at is null or c.ends_at>now() then
  return jsonb_build_object('eligible',false,'reason',case when c.certification='open' then 'season_open' else c.certification end);end if;
 select li.* into l from public.life_identities li join public.season_archive_v2 a on a.life_id=li.id
  where a.season_id=p_season_id and a.profile_id=c.winner_profile_id and a.certified and a.alive_at_close;
 result:=case when l.id is null or l.identity_status<>'verified_source_life' then 'identity_unverified'
  when not c.complete_population or not exists(select 1 from public.source_epochs_v2 where world_id=l.world_id)then 'world_unverified'
  when l.alive is false then 'forfeited'
  when l.alive is null then 'survival_unknown'
  when l.last_observed_at<now()-interval '6 minutes' or l.last_observed_at>now()+interval '1 minute' then 'stale_survival'
  when not exists(select 1 from public.dashboard_rollout_state where life_enabled and source_namespace=l.world_id) then 'cohort_inactive'
  else 'eligible' end;
 return jsonb_build_object('eligible',result='eligible','reason',result,'life_id',l.id,'profile_id',l.profile_id,
  'world_id',l.world_id,'account_token',l.account_token,'alive',l.alive,'last_observed_at',l.last_observed_at,
  'source_sha256',(select source_sha256 from public.life_observations where life_id=l.id order by observed_at desc,id desc limit 1));
end $$;
revoke all on function public.reward_eligibility_v1(uuid) from public,anon,authenticated,service_role;

create or replace function public.get_service_rewards_v1() returns jsonb
language sql stable security definer set search_path='' as $$
 select jsonb_build_object('contract','season-rewards-v1','probabilities','{"common":45,"uncommon":30,"rare":20,"epic":4,"legendary":1}'::jsonb,
  'catalog',(select definition||jsonb_build_object('active',active) from public.reward_catalogs_v1 order by active desc,created_at desc limit 1),
  'seasons',(select coalesce(jsonb_agg(to_jsonb(x) order by x.season_number desc),'[]') from(
   select c.season_id,c.season_number,s.name season_name,c.certification,g.public_name character_name,p.steam_username,
    public.reward_eligibility_v1(c.season_id) eligibility,
    (select to_jsonb(d)||jsonb_build_object('delivery_state',st.state,'attempt_id',st.attempt_id,
       'components',(select jsonb_agg(to_jsonb(co) order by component) from public.reward_delivery_components_v1 co where co.season_id=d.season_id),
       'events',(select coalesce(jsonb_agg(to_jsonb(ev) order by id),'[]') from public.reward_events_v1 ev where ev.season_id=d.season_id))
      from public.season_reward_draws_v1 d join public.reward_delivery_state_v1 st using(season_id) where d.season_id=c.season_id) draw
   from public.season_cycles_v2 c join public.ranking_seasons s on s.id=c.season_id
    left join public.game_characters g on g.id=c.winner_profile_id left join public.game_players p on p.id=g.player_id
   order by c.season_number desc limit 36)x));
$$;
revoke all on function public.get_service_rewards_v1() from public,anon,authenticated;
grant execute on function public.get_service_rewards_v1() to service_role;

create or replace function public.draw_season_reward_v1(p_season_id uuid,p_catalog_version text,p_rarity text,p_reward_id text,
 p_request_id uuid,p_operator_id uuid,p_life_id uuid,p_source_sha256 text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare entitlement jsonb;catalog public.reward_catalogs_v1%rowtype;reward jsonb;existing public.season_reward_draws_v1%rowtype;begin
 perform pg_advisory_xact_lock(hashtextextended('winx-reward-operator:'||p_operator_id,0));
 perform pg_advisory_xact_lock(hashtextextended('winx-reward:'||p_season_id,0));
 select * into existing from public.season_reward_draws_v1 where season_id=p_season_id;
 if found then return jsonb_build_object('season_id',p_season_id,'persisted',true,'existing',true);end if;
 if p_operator_id is null or p_request_id is null or p_season_id is null then raise exception 'authorized operator and request required';end if;
 if exists(select 1 from public.season_reward_draws_v1 where operator_id=p_operator_id and drawn_at>now()-interval '5 seconds')then raise exception 'operator rate limit';end if;
 -- The life row lock serializes this operation with native death ingestion.
 perform 1 from public.life_identities where id=p_life_id for update;
 entitlement:=public.reward_eligibility_v1(p_season_id);
 if (entitlement->>'eligible')::boolean is distinct from true or (entitlement->>'life_id')::uuid is distinct from p_life_id
  or entitlement->>'source_sha256' is distinct from p_source_sha256 then raise exception 'reward eligibility changed';end if;
 select * into catalog from public.reward_catalogs_v1 where version=p_catalog_version and active for share;
 if not found or not public.valid_reward_catalog_v1(catalog.definition)then raise exception 'verified complete catalog required';end if;
 select x into reward from jsonb_array_elements(catalog.definition->'rewards')x where x->>'id'=p_reward_id and x->>'rarity'=p_rarity;
 if reward is null then raise exception 'reward does not belong to active catalog';end if;
 insert into public.season_reward_draws_v1(season_id,life_id,profile_id,world_id,account_token,catalog_version,rarity,reward_id,reward_snapshot,presentation_snapshot,
  probabilities,certification_snapshot,operator_id,request_id)
 values(p_season_id,p_life_id,(entitlement->>'profile_id')::uuid,(entitlement->>'world_id')::uuid,entitlement->>'account_token',
  p_catalog_version,p_rarity,p_reward_id,reward,
  (select jsonb_build_object('season_name',s.name,'season_number',cy.season_number,'character_name',g.public_name,'steam_username',p.steam_username)
   from public.ranking_seasons s join public.season_cycles_v2 cy on cy.season_id=s.id join public.game_characters g on g.id=(entitlement->>'profile_id')::uuid
    join public.game_players p on p.id=g.player_id where s.id=p_season_id),
  '{"common":45,"uncommon":30,"rare":20,"epic":4,"legendary":1}',
  entitlement||jsonb_build_object('official_result',(select to_jsonb(cy) from public.season_cycles_v2 cy where season_id=p_season_id),
   'classification',(select to_jsonb(a) from public.season_archive_v2 a where a.season_id=p_season_id and a.life_id=p_life_id)),p_operator_id,p_request_id);
 insert into public.reward_delivery_state_v1(season_id) values(p_season_id);
 insert into public.reward_delivery_components_v1(season_id,component)select p_season_id,n-1 from generate_series(1,jsonb_array_length(reward->'items'))n;
 insert into public.reward_events_v1(season_id,request_id,operator_id,action,new_state)values(p_season_id,p_request_id,p_operator_id,'draw','pending');
 return jsonb_build_object('season_id',p_season_id,'persisted',true,'existing',false);
end $$;
revoke all on function public.draw_season_reward_v1(uuid,text,text,text,uuid,uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.draw_season_reward_v1(uuid,text,text,text,uuid,uuid,uuid,text) to service_role;

create or replace function public.record_reward_delivery_v1(p_season_id uuid,p_action text,p_request_id uuid,p_operator_id uuid,
 p_life_id uuid,p_component integer default null,p_evidence text default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare d public.season_reward_draws_v1%rowtype;st public.reward_delivery_state_v1%rowtype;entitlement jsonb;next_state text;begin
 perform pg_advisory_xact_lock(hashtextextended('winx-reward-operator:'||p_operator_id,0));
 -- The operator lock is shared with draws; ingestion never takes that lock.
 select * into d from public.season_reward_draws_v1 where season_id=p_season_id;
 if not found or p_life_id is distinct from d.life_id or p_operator_id is null or p_request_id is null then raise exception 'specific authorized life required';end if;
 perform 1 from public.life_identities where id=d.life_id for update;
 select * into st from public.reward_delivery_state_v1 where season_id=p_season_id for update;
 if exists(select 1 from public.reward_events_v1 where request_id=p_request_id and season_id=p_season_id)then return jsonb_build_object('state',st.state,'existing',true);end if;
 if st.state in('confirmed_manual','forfeited')then raise exception 'delivery is terminal';end if;
 entitlement:=public.reward_eligibility_v1(p_season_id);
 if entitlement->>'reason'='forfeited' then next_state:='forfeited';
 elsif p_action='offline' and st.state in('pending','awaiting_online','blocked_identity','needs_intervention')then next_state:='awaiting_online';
 elsif p_action='block' and st.state in('pending','awaiting_online','blocked_identity','needs_intervention')then next_state:='blocked_identity';
 elsif p_action in('uncertain','sent') and st.state in('delivering','partial') then
  next_state:=case when p_action='sent' then 'sent_unconfirmed' else 'uncertain' end;
 elsif p_action='begin_manual' and st.state in('pending','awaiting_online','blocked_identity','needs_intervention') then
  if (entitlement->>'eligible')::boolean is distinct from true then raise exception 'fresh exact life evidence required';end if;
  if exists(select 1 from public.reward_delivery_components_v1 where season_id=p_season_id and state='uncertain')then raise exception 'reconcile uncertain components before another attempt';end if;
  next_state:='delivering';
 elsif p_action in('confirm_component','not_delivered') and st.state in('delivering','sent_unconfirmed','uncertain','partial','needs_intervention') then
  if (entitlement->>'eligible')::boolean is distinct from true then raise exception 'fresh exact life evidence required';end if;
  if not exists(select 1 from public.reward_delivery_components_v1 where season_id=p_season_id and component=p_component)then raise exception 'unknown component';end if;
  if p_action='not_delivered' and exists(select 1 from public.reward_delivery_components_v1 where season_id=p_season_id and component=p_component and state='confirmed_manual')then raise exception 'confirmed component cannot be resent';end if;
  update public.reward_delivery_components_v1 set state=case when p_action='confirm_component' then 'confirmed_manual' else 'pending' end
   where season_id=p_season_id and component=p_component;
  next_state:=case when not exists(select 1 from public.reward_delivery_components_v1 where season_id=p_season_id and state<>'confirmed_manual')then 'confirmed_manual'
    when exists(select 1 from public.reward_delivery_components_v1 where season_id=p_season_id and state='confirmed_manual')then 'partial' else 'needs_intervention' end;
 else raise exception 'invalid delivery transition';end if;
 if length(trim(coalesce(p_evidence,''))) not between 20 and 2000 then raise exception 'explicit manual identity/delivery evidence required';end if;
 if (select count(*) from public.reward_events_v1 where operator_id=p_operator_id and created_at>now()-interval '1 minute')>=20 then raise exception 'operator rate limit';end if;
 if p_action in('sent','uncertain')then update public.reward_delivery_components_v1 set state='uncertain' where season_id=p_season_id and state='pending';end if;
 update public.reward_delivery_state_v1 set state=next_state,attempt_id=case when p_action='begin_manual' then p_request_id else attempt_id end,updated_at=now() where season_id=p_season_id;
 insert into public.reward_events_v1(season_id,request_id,operator_id,action,previous_state,new_state,component,evidence)
 values(p_season_id,p_request_id,p_operator_id,p_action,st.state,next_state,p_component,p_evidence);
 return jsonb_build_object('state',next_state,'existing',false,'manual_attestation',true);
end $$;
revoke all on function public.record_reward_delivery_v1(uuid,text,uuid,uuid,uuid,integer,text) from public,anon,authenticated;
grant execute on function public.record_reward_delivery_v1(uuid,text,uuid,uuid,uuid,integer,text) to service_role;

create or replace function public.cancel_reward_on_death_v1() returns trigger
language plpgsql security definer set search_path='' as $$declare st record;begin
 if new.alive is false then
  for st in select x.* from public.reward_delivery_state_v1 x join public.season_reward_draws_v1 d using(season_id)
   where d.life_id=new.id and x.state not in('confirmed_manual','forfeited') for update of x loop
   update public.reward_delivery_state_v1 set state='forfeited',updated_at=now() where season_id=st.season_id;
   insert into public.reward_events_v1(season_id,request_id,action,previous_state,new_state,evidence)
    values(st.season_id,gen_random_uuid(),'death',st.state,'forfeited','Native source confirmed death; no transfer to successor life.');
  end loop;
 end if;
 return new;
end $$;
revoke all on function public.cancel_reward_on_death_v1() from public,anon,authenticated,service_role;
create trigger cancel_reward_on_death_v1 after update of alive on public.life_identities for each row execute function public.cancel_reward_on_death_v1();

create or replace function public.get_public_rewards_v1() returns jsonb
language sql stable security definer set search_path='' as $$
 select jsonb_build_object('contract','season-rewards-v1','draws',(select coalesce(jsonb_agg(to_jsonb(x) order by drawn_at desc),'[]')from(
  select (d.presentation_snapshot->>'season_number')::integer season_number,d.presentation_snapshot->>'season_name' season_name,
   d.presentation_snapshot->>'character_name' character_name,d.presentation_snapshot->>'steam_username' steam_username,d.reward_snapshot->>'name' reward_name,
   d.rarity,d.drawn_at,st.state delivery_state
  from public.season_reward_draws_v1 d join public.ranking_seasons s on s.id=d.season_id join public.season_cycles_v2 c on c.season_id=d.season_id
   join public.game_characters g on g.id=d.profile_id join public.game_players p on p.id=g.player_id
   join public.reward_delivery_state_v1 st on st.season_id=d.season_id order by d.drawn_at desc limit 100)x));
$$;
revoke all on function public.get_public_rewards_v1() from public;
grant execute on function public.get_public_rewards_v1() to anon,authenticated,service_role;
-- REWARD_CATALOG_BEGIN
insert into public.reward_catalogs_v1(version,definition,active) values('season-prizes-v1-b42.21.0',$catalog${"version":"season-prizes-v1-b42.21.0","rewards":[{"id":"crowbar","name":"Pé de cabra","rarity":"common","weight":70,"items":[{"kind":"item","script_id":"Base.Crowbar","quantity":1,"condition":"standard_unverified_maximum"}],"verified":true,"verification":"installed_script_and_documented_manual_method","server_build":"42.21.0","evidence_sha256":"742414e701d360a9076099f9842bd9cc65c2d9ba9497af8b0ce470ee147467c5","delivery_method":"manual_verified"},{"id":"hammer","name":"Martelo","rarity":"common","weight":30,"items":[{"kind":"item","script_id":"Base.Hammer","quantity":1,"condition":"standard_unverified_maximum"}],"verified":true,"verification":"installed_script_and_documented_manual_method","server_build":"42.21.0","evidence_sha256":"742414e701d360a9076099f9842bd9cc65c2d9ba9497af8b0ce470ee147467c5","delivery_method":"manual_verified"},{"id":"army-pack","name":"Mochila militar","rarity":"uncommon","weight":100,"items":[{"kind":"item","script_id":"Base.Bag_ALICEpack_Army","quantity":1,"condition":"standard_unverified_maximum"}],"verified":true,"verification":"installed_script_and_documented_manual_method","server_build":"42.21.0","evidence_sha256":"4904a61c83411b4c41d196e517097f5981b2a76c300bc33abc78c86e721f65da","delivery_method":"manual_verified"},{"id":"workshop-kit","name":"Kit de oficina: martelo e machado","rarity":"rare","weight":100,"items":[{"kind":"item","script_id":"Base.Hammer","quantity":1,"condition":"standard_unverified_maximum"},{"kind":"item","script_id":"Base.Axe","quantity":1,"condition":"standard_unverified_maximum"}],"verified":true,"verification":"installed_script_and_documented_manual_method","server_build":"42.21.0","evidence_sha256":"742414e701d360a9076099f9842bd9cc65c2d9ba9497af8b0ce470ee147467c5","delivery_method":"manual_verified"},{"id":"machete","name":"Facão","rarity":"epic","weight":100,"items":[{"kind":"item","script_id":"Base.Machete","quantity":1,"condition":"standard_unverified_maximum"}],"verified":true,"verification":"installed_script_and_documented_manual_method","server_build":"42.21.0","evidence_sha256":"742414e701d360a9076099f9842bd9cc65c2d9ba9497af8b0ce470ee147467c5","delivery_method":"manual_verified"},{"id":"katana","name":"Katana","rarity":"legendary","weight":100,"items":[{"kind":"item","script_id":"Base.Katana","quantity":1,"condition":"standard_unverified_maximum"}],"verified":true,"verification":"installed_script_and_documented_manual_method","server_build":"42.21.0","evidence_sha256":"742414e701d360a9076099f9842bd9cc65c2d9ba9497af8b0ce470ee147467c5","delivery_method":"manual_verified"}]}$catalog$::jsonb,true) on conflict(version) do nothing;
-- REWARD_CATALOG_END
create or replace function public.get_public_dashboard_release_v1() returns jsonb
language sql stable security definer set search_path='' as $$
 select public.get_public_dashboard_release_legacy_v1()||jsonb_build_object('product14_installed',true,'rewards_installed',true);
$$;
revoke all on function public.get_public_dashboard_release_v1() from public;
grant execute on function public.get_public_dashboard_release_v1() to anon,authenticated,service_role;
notify pgrst,'reload schema';
commit;
