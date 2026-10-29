"""Disposable PostgreSQL17 only; no DSN, public network, host ports or game IO."""
import importlib.util
import json
import subprocess
import uuid
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
spec = importlib.util.spec_from_file_location('isolated_pg', ROOT/'scripts/test-postgres-concurrency.py')
pg = importlib.util.module_from_spec(spec)
spec.loader.exec_module(pg)
pg.RUN = 'winx3_'+uuid.uuid4().hex[:8]
DB = pg.RUN+'_weekend'
OP = pg.OPERATOR
AT = '2026-11-07T03:00:00Z'

def main():
    inspection = json.loads(subprocess.check_output([pg.DOCKER,'inspect',pg.CONTAINER],text=True))[0]
    assert inspection['Config']['Labels'].get('winx.mission') == '15'
    assert inspection['HostConfig']['NetworkMode'] == 'none' and not inspection['HostConfig']['PortBindings']
    pg.run(f'create database {DB};')
    schema = (ROOT/'tests/fixtures/schema-before.sql').read_text(encoding='utf8')
    for role in ['anon','authenticated','service_role']:
        schema = schema.replace('create role '+role+';',f"do $$begin if not exists(select 1 from pg_roles where rolname='{role}')then create role {role};end if;end $$;")
    pg.run(schema,DB)
    order = ['001_restrict_ingestion','002_public_read_contracts','003_official_championship','004_life_achievements',
             '006_dashboard_release','005_life_read_contracts','007_controlled_life_activation']
    for name in order: pg.run((ROOT/('migrations/'+name+'.sql')).read_text(encoding='utf8'),DB)
    pg.run(f"insert into ranking_seasons(id,name,slug,status,started_at)values('{pg.SEASON}','Temporada 1','temporada-1','active','2026-10-20T01:05:18.930285Z');",DB)
    for number in range(8,25):
        matches = list((ROOT/'migrations').glob(f'{number:03d}_*.sql'))
        assert len(matches) == 1
        pg.run(matches[0].read_text(encoding='utf8'),DB)
    pg.check('001–024 applied on isolated PostgreSQL17, private network and no host ports',True)
    before = pg.run('select md5(get_service_recovery_export_v1()::text)',DB)
    pg.check('fresh install disabled, zero weekly accounts/awards',pg.run("select (select not weekly_enabled and not remote_enabled from roulette_release_v3) and (select count(*)=0 from reward_accounts_v3) and (select count(*)=0 from weekend_reward_draws_v3)",DB)=='t')
    pg.run('select activate_product14_v2();',DB)
    results = pg.parallel(["select reconcile_months_at_v2('2026-11-01T03:00:00Z');"]*8,DB)
    pg.check('monthly regression: eight sessions still create only one T2',all(r[0]==0 for r in results) and sum(json.loads(r[1])['transitions'] for r in results)==1)
    pg.check('pending T1 does not prevent T2 and never fabricates winner',pg.run("select (select certification='pending_certification' from season_cycles_v2 where season_number=1) and (select count(*)=1 from season_cycles_v2 where season_number=2) and (select count(*)=0 from season_reward_draws_v1)",DB)=='t')
    catalog = json.loads(pg.run('select definition from reward_catalogs_v1 where active',DB))
    catalog['version'] = 'SYNTHETIC-36-NOT-PRODUCTION'
    for n in range(12):
        reward = dict(catalog['rewards'][n]);reward['id']='SYNTHETIC-'+str(n);reward['name']='Synthetic reward '+str(n);catalog['rewards'].append(reward)
    definition = json.dumps(catalog,ensure_ascii=True).replace("'","''")
    pg.run(f"update reward_catalogs_v1 set active=false;insert into reward_catalogs_v1 values('{catalog['version']}','{definition}',true,now());update roulette_release_v3 set weekly_enabled=true,remote_enabled=true,rollover_evidence='{'c'*64}',rcon_evidence='{'c'*64}',activation_approval='{'c'*64}',catalog_approval='{'c'*64}',approved_catalog='{definition}';",DB)
    account = pg.run("select register_reward_account_v3('76561190000000001','Synthetic account','Synthetic User')",DB)
    pg.run(f"select attest_reward_account_v3('{account}','{'a'*64}','{'b'*64}','{OP}');",DB)
    def draw(request=None,at=AT,window=AT):
        return f"select draw_weekend_at_v3('{account}','{window}','{catalog['version']}','rare','workshop-kit','{request or uuid.uuid4()}','{OP}','{at}');"
    results = pg.parallel([draw() for _ in range(8)],DB)
    values = [json.loads(r[1]) for r in results if r[0]==0]
    pg.check('8 independent draw sessions: exactly one new award and seven persisted recoveries',len(values)==8 and sum(not x['existing'] for x in values)==1)
    pg.check('unique account/window and one immutable draw event',pg.run('select (select count(*)=1 from weekend_reward_draws_v3) and (select count(*)=1 from weekend_reward_events_v3)',DB)=='t')
    draw_id = values[0]['draw']['id']
    pg.check('Monday cannot create new award but old window result remains recoverable',json.loads(pg.run(draw(at='2026-11-09T03:00:00Z'),DB))['existing'] and pg.run(draw(at='2026-11-09T03:00:00Z',window='2026-11-14T03:00:00Z'),DB,fail=False)[0]!=0)
    request = str(uuid.uuid4())
    pg.check('timeout-style new request recovers same persisted award',json.loads(pg.run(draw(request=request),DB))['draw']['id']==draw_id)
    claims = [f"select claim_remote_reward_v3('weekend','{draw_id}','{uuid.uuid4()}','{OP}');" for _ in range(8)]
    results = pg.parallel(claims,DB)
    pg.check('8 independent remote claims: exactly one winner, no resend window',sum(r[0]==0 for r in results)==1)
    attempt = pg.run('select attempt_id from remote_reward_components_v3 limit 1',DB)
    pg.check('kit atomically reserves both components before external IO',pg.run("select count(*)=2 and bool_and(state='started') from remote_reward_components_v3",DB)=='t')
    results = pg.parallel([f"select finish_remote_component_v3('weekend','{draw_id}','{attempt}',{i},'{state}','{'d'*64}',20,'{OP}');" for i,state in [(0,'sent_unconfirmed'),(1,'uncertain')]],DB)
    pg.check('concurrent component outcomes preserve partial/uncertain kit',all(r[0]==0 for r in results) and pg.run('select state from weekend_delivery_v3',DB)=='partial')
    pg.check('uncertain/partial attempt cannot be automatically retried',all(r[0]!=0 for r in pg.parallel(claims,DB)))
    receipts = [f"select record_weekend_receipt_v3('{draw_id}',{i},'{uuid.uuid4()}','{OP}','{account}',true,'SYNTHETIC ISOLATED RECEIPT: exact account and inventory independently checked.');" for i in [0,1]]
    reconciled = pg.parallel(receipts,DB)
    pg.check('concurrent receipts close both kit components without new send claims',all(r[0]==0 for r in reconciled) and pg.run('select state from weekend_delivery_v3',DB)=='confirmed_manual' and pg.run('select count(*) from weekend_reward_receipts_v3',DB)=='2' and all(r[0]!=0 for r in pg.parallel(claims,DB)))
    for role in ['anon','authenticated','service_role']:
        pg.check(role+' cannot enable release or forge verification/clock',pg.run(f"set role {role};update roulette_release_v3 set weekly_enabled=true",DB,fail=False)[0]!=0 and pg.run(f"set role {role};select attest_reward_account_v3('{account}','{'a'*64}','{'b'*64}','{OP}')",DB,fail=False)[0]!=0 and pg.run(f'set role {role};'+draw(),DB,fail=False)[0]!=0)
    pg.check('used weekly catalog and award snapshots immutable',pg.run("update weekend_reward_draws_v3 set rarity='legendary'",DB,fail=False)[0]!=0 and pg.run("update reward_catalogs_v1 set definition=jsonb_set(definition,'{rewards,0,name}','\"changed\"') where active",DB,fail=False)[0]!=0)
    registrations=pg.parallel([f"select register_reward_account_checked_v3('76561190000000002','Pending synthetic','Pending User','{OP}');"]*8,DB)
    pg.check('8 checked registrations create one pending account and one audit event',all(r[0]==0 for r in registrations) and len({r[1] for r in registrations})==1 and pg.run('select count(*) from reward_account_events_v3',DB)=='1')
    pg.check('checked registration never rebinds Steam or case-colliding usernames',pg.run(f"select register_reward_account_checked_v3('76561190000000002','Changed','Other','{OP}')",DB,fail=False)[0]!=0 and pg.run(f"select register_reward_account_checked_v3('76561190000000003','Other','pending user','{OP}')",DB,fail=False)[0]!=0)
    # Owner-only synthetic future award. Not an approved/active vehicle catalog.
    vehicle_id=str(uuid.uuid4())
    reward=json.dumps({'id':'SYNTHETIC-VEHICLE','name':'Synthetic vehicle','delivery_method':'manual_vehicle','items':[{'kind':'vehicle','script_id':'69fordMustangBoss429','quantity':1}]}).replace("'","''")
    pg.run(f"insert into weekend_reward_draws_v3(id,account_id,window_start,window_end,catalog_version,rarity,reward_id,reward_snapshot,recipient_snapshot,probabilities,operator_id,request_id)values('{vehicle_id}','{account}','2026-11-14T03:00:00Z','2026-11-16T03:00:00Z','{catalog['version']}','epic','SYNTHETIC-VEHICLE','{reward}','{{}}','{{}}','{OP}','{uuid.uuid4()}');insert into weekend_delivery_v3(draw_id)values('{vehicle_id}');",DB)
    def vehicle(stage,request=None,reference='null'):
        return f"select record_vehicle_delivery_v3('weekend','{vehicle_id}','{request or uuid.uuid4()}','{stage}','{OP}',true,'SYNTHETIC ONLY: same physical instance and recipient independently checked.',{reference});"
    starts=[(str(uuid.uuid4()))for _ in range(8)]
    reservations=pg.parallel([vehicle('begin',r)for r in starts],DB)
    pg.check('8 manual vehicle reservations produce one audit reservation and no duplicate generation',sum(r[0]==0 for r in reservations)==1 and pg.run('select count(*) from vehicle_delivery_events_v3',DB)=='1')
    winner=starts[next(i for i,r in enumerate(reservations)if r[0]==0)]
    pg.check('manual reservation timeout recovery is idempotent across 8 sessions',all(r[0]==0 and json.loads(r[1])['existing']for r in pg.parallel([vehicle('begin',winner)]*8,DB)))
    for stage in ['generated','key','repairs']:pg.run(vehicle(stage,reference="'SYNTHETIC INSTANCE PG'"),DB)
    receipts=pg.parallel([vehicle('received',reference="'SYNTHETIC INSTANCE PG'")for _ in range(8)],DB)
    pg.check('8 vehicle receipts record one completion, preserve instance and never create RCON claims',sum(r[0]==0 for r in receipts)==1 and pg.run('select count(*) from vehicle_delivery_events_v3',DB)=='5' and pg.run('select count(*) from remote_reward_components_v3',DB)=='2')
    exported = json.loads(pg.run('select get_service_recovery_export_v1()',DB))
    pg.check('new private tables included in recovery export',all(t in exported['data'] for t in ['reward_accounts_v3','weekend_reward_draws_v3','remote_reward_components_v3','remote_reward_events_v3','roulette_release_v3','vehicle_deliveries_v3','vehicle_delivery_events_v3','reward_account_events_v3']))
    print(json.dumps({'engine':pg.run('select version()',DB),'database':DB,'checks':len(pg.checks),'passed':len(pg.checks),'network':'none','production_writes':0,'game_commands':0}))

if __name__=='__main__':main()
