"""Real PostgreSQL, independent sessions, synthetic data only, no DSN option.

Requires the explicitly disposable winx-master15-postgres container. It must
have winx.mission=15, no network and no published host ports. No production IO.
"""
from concurrent.futures import ThreadPoolExecutor
import json
import os
from pathlib import Path
import shutil
import subprocess
from threading import Barrier
import uuid

ROOT = Path(__file__).resolve().parent.parent
DOCKER = shutil.which('docker') or str(Path(os.environ['LOCALAPPDATA']) / 'Programs/DockerDesktop/resources/bin/docker.exe')
CONTAINER = 'winx-master15-postgres'
RUN = 'winx15_'+uuid.uuid4().hex[:8]
SEASON = '4ec32a87-fb16-4838-af57-f4cf85425a60'
WORLD = 'f0000000-0000-4000-8000-000000000001'
OPERATOR = 'f0000000-0000-4000-8000-000000000009'
checks = []

def run(sql, db='postgres', fail=True):
    result = subprocess.run([DOCKER, 'exec', '-i', CONTAINER, 'psql', '-X', '-qAt', '-v', 'ON_ERROR_STOP=1', '-U', 'postgres', '-d', db],
                            input=("set statement_timeout='15s';set lock_timeout='10s';\n"+sql).encode(), capture_output=True)
    if fail and result.returncode:
        raise RuntimeError(result.stderr.decode(errors='replace')[:700])
    return result.stdout.decode().strip() if fail else (result.returncode, result.stdout.decode().strip(), result.stderr.decode(errors='replace'))

def scalar(sql, db):
    return json.loads(run(sql, db).splitlines()[-1])

def check(name, condition):
    assert condition, name
    checks.append(name)
    print('PASS '+name, flush=True)

def parallel(sqls, db):
    barrier = Barrier(len(sqls))
    def session(sql):
        barrier.wait()
        return run(sql, db, fail=False)
    with ThreadPoolExecutor(max_workers=len(sqls)) as pool:
        return list(pool.map(session, sqls))

def database(name):
    # Reject existing targets instead of dropping anything from an earlier run.
    run(f'create database {RUN}_{name} template {RUN}_template;')
    return RUN+'_'+name

def winner(db):
    metrics={k:{'value':v,'unit':u,'scope':'life','coverage':'observed_lower_bound','validated':True,'observed_at':'2026-10-27T12:00:00Z'}
             for k,v,u in [('kills_total',100,'count'),('played_seconds',3600,'seconds')]}
    run(f"""select activate_product14_v2();
    insert into source_epochs_v2 values('{WORLD}','{'a'*64}','source_generation_manifest',now(),'ISOLATED MASTER15 FIXTURE');
    select ingest_life_observation_v1('{WORLD}','{'a'*64}','{'b'*64}','Synthetic life','Synthetic account',true,now(),'{'a'*64}','{json.dumps(metrics)}');
    select set_config('winx.monthly.operation','reconcile',false);
    update season_cycles_v2 set ends_at=now()-interval '1 minute',closed_at=now(),certification='champion',
      winner_profile_id=(select profile_id from life_identities limit 1),complete_population=true where season_id='{SEASON}';
    update ranking_seasons set status='closed',ended_at=now()-interval '1 minute' where id='{SEASON}';
    insert into season_archive_v2(season_id,profile_id,life_id,frozen_statistics,alive_at_close,kills_total,played_seconds,certified,rank_position)
      select '{SEASON}',profile_id,id,'{{}}',true,100,3600,true,1 from life_identities;
    update dashboard_rollout_state set life_enabled=true,source_namespace='{WORLD}',cohort_started_at=now();
    select set_config('winx.monthly.operation','',false);""", db)
    return run('select id from life_identities',db)

def draw(life, rarity='rare', reward='workshop-kit', operator=OPERATOR, request=None):
    return f"select draw_season_reward_v1('{SEASON}','season-prizes-v2-b42.21.0','{rarity}','{reward}','{request or uuid.uuid4()}','{operator}','{life}','{'a'*64}');"

def deliver(life, action, component='null', request=None, operator=OPERATOR):
    return f"select record_reward_delivery_v1('{SEASON}','{action}','{request or uuid.uuid4()}','{operator}','{life}',{component},'SYNTHETIC ISOLATED EVIDENCE: exact life and inventory manually checked.');"

def main():
    inspection=json.loads(subprocess.check_output([DOCKER,'inspect',CONTAINER],text=True))[0]
    assert inspection['Config']['Labels'].get('winx.mission')=='15'
    assert inspection['HostConfig']['NetworkMode']=='none' and not inspection['HostConfig']['PortBindings']
    run(f'create database {RUN}_template;')
    db=RUN+'_template'
    schema=(ROOT/'tests/fixtures/schema-before.sql').read_text(encoding='utf8')
    for role in ['anon','authenticated','service_role']:
        schema=schema.replace('create role '+role+';',"do $$begin if not exists(select 1 from pg_roles where rolname='"+role+"') then create role "+role+";end if;end $$;")
    run(schema,db)
    order=['001_restrict_ingestion','002_public_read_contracts','003_official_championship','004_life_achievements',
           '006_dashboard_release','005_life_read_contracts','007_controlled_life_activation']
    for name in order:run((ROOT/('migrations/'+name+'.sql')).read_text(encoding='utf8'),db)
    run(f"insert into ranking_seasons(id,name,slug,status,started_at)values('{SEASON}','Temporada 1','temporada-1','active','2026-10-20T01:05:18.930285Z');",db)
    for number in range(8,20):
        matches=list((ROOT/'migrations').glob(f'{number:03d}_*.sql'))
        assert len(matches)==1
        run(matches[0].read_text(encoding='utf8'),db)
    check('PostgreSQL17 real: 001–019 installed on synthetic template', True)

    db=database('draws');life=winner(db)
    results=parallel([draw(life) for _ in range(8)],db)
    values=[json.loads(r[1]) for r in results if r[0]==0]
    check('8 simultaneous sessions: one draw, seven persisted responses',len(values)==8 and sum(not v['existing'] for v in values)==1)
    check('unique official draw and one draw event',scalar("select to_jsonb((select count(*) from season_reward_draws_v1)=1 and (select count(*) from reward_events_v1 where action='draw')=1)",db))
    request=str(uuid.uuid4());run(draw(life,request=request),db)
    check('F5/new request/same request/different selected reward cannot redraw',all(json.loads(run(draw(life,rarity='legendary',reward='katana',request=r),db))['existing'] for r in [request,str(uuid.uuid4())]))
    check('public SQL DTO hides every delivery/identity/operator field',set(scalar('select get_public_rewards_v1()',db)['draws'][0])=={'season_number','season_name','character_name','steam_username','reward_name','rarity','drawn_at'})

    results=parallel([deliver(life,'begin_manual') for _ in range(2)],db)
    check('concurrent delivery starts: exactly one valid transition',sum(r[0]==0 for r in results)==1)
    results=parallel([deliver(life,'confirm_component',str(n),operator=str(uuid.uuid4())) for n in range(2)],db)
    check('different operators/components serialize and confirm kit once',all(r[0]==0 for r in results) and run('select state from reward_delivery_state_v1',db)=='confirmed_manual')
    check('confirmed component cannot be resent',run(deliver(life,'not_delivered','0'),db,fail=False)[0]!=0)

    timeout_db=database('timeout');timeout_life=winner(timeout_db);request=str(uuid.uuid4())
    client=subprocess.Popen([DOCKER,'exec','-i',CONTAINER,'psql','-XqAt','-v','ON_ERROR_STOP=1','-U','postgres','-d',timeout_db],stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.PIPE)
    client.stdin.write((draw(timeout_life,request=request)+'\nselect pg_sleep(5);\n').encode());client.stdin.close()
    persisted=json.loads(client.stdout.readline().decode())
    # A separate session sees the row only after the first transaction commits.
    committed=run('select count(*) from season_reward_draws_v1',timeout_db)=='1'
    client.terminate();client.wait(timeout=5)
    check('transport interrupted after commit: same request recovers one result',committed and persisted['persisted'] and json.loads(run(draw(timeout_life,rarity='legendary',reward='katana',request=request),timeout_db))['existing'] and run('select count(*) from season_reward_draws_v1',timeout_db)=='1')

    db=database('uncertain');life=winner(db);run(draw(life),db);run(deliver(life,'begin_manual'),db);run(deliver(life,'sent'),db)
    check('uncertain delivery blocks concurrent new attempts',all(r[0]!=0 for r in parallel([deliver(life,'begin_manual'),deliver(life,'offline')],db)))
    run(deliver(life,'confirm_component','0'),db)
    check('partial kit retains uncertain second component',run('select state from reward_delivery_state_v1',db)=='partial' and run('select state from reward_delivery_components_v1 where component=1',db)=='uncertain')
    request=str(uuid.uuid4());run(deliver(life,'not_delivered','1',request=request),db)
    check('timeout retry is idempotent for same delivery request',json.loads(run(deliver(life,'not_delivered','1',request=request),db))['existing'])

    db=database('death');life=winner(db)
    results=parallel(["begin; update life_identities set alive=false; select pg_sleep(0.2); commit;",draw(life)],db)
    check('draw/death race has no deadlock and leaves no deliverable dead life',all('deadlock' not in r[2].lower() for r in results) and run("select count(*) from reward_delivery_state_v1 where state<>'forfeited'",db)=='0')
    if run('select count(*) from season_reward_draws_v1',db)=='1':
        check('death after draw preserves historic award and forfeits delivery',run('select state from reward_delivery_state_v1',db)=='forfeited')
    else:check('death before draw prevents material award',results[1][0]!=0)

    db=database('calendar');run('select activate_product14_v2()',db)
    check('T1 preserved before exclusive boundary',scalar("select reconcile_months_at_v2('2026-11-01T02:59:59.999999Z')",db)['transitions']==0)
    results=parallel(["select reconcile_months_at_v2('2026-11-01T03:00:00Z');" for _ in range(8)],db)
    check('8 concurrent calendar runs create exactly one T2',all(r[0]==0 for r in results) and sum(json.loads(r[1])['transitions'] for r in results)==1 and run('select count(*) from season_cycles_v2 where season_number=2',db)=='1')
    check('pending T1 does not prevent active T2 at same half-open boundary',scalar(f"select to_jsonb((select certification='pending_certification' and ends_at='2026-11-01T03:00:00Z' from season_cycles_v2 where season_id='{SEASON}') and (select starts_at='2026-11-01T03:00:00Z' and closed_at is null from season_cycles_v2 where season_number=2))",db))
    run("select reconcile_months_at_v2('2028-03-01T03:00:00Z')",db)
    check('missed months and leap February: one active month, adjacent boundaries',scalar("select to_jsonb((select count(*) from ranking_seasons where status='active')=1 and not exists(select 1 from (select ends_at,lead(starts_at)over(order by season_number) next_start from season_cycles_v2)s where next_start is not null and ends_at<>next_start) and exists(select 1 from season_cycles_v2 where starts_at='2028-02-01T03:00:00Z' and ends_at='2028-03-01T03:00:00Z'))",db))
    for role in ['anon','authenticated']:
        for fn in ['get_service_rewards_v1()','get_service_operations_v1()','reconcile_months_v2()',"reconcile_months_at_v2('2026-11-01T03:00:00Z')"]:
            check(role+' denied '+fn,run('set role '+role+'; select '+fn,db,fail=False)[0]!=0)
        check(role+' cannot access private table',run('set role '+role+';select * from season_reward_draws_v1',db,fail=False)[0]!=0)
    check('service_role cannot inject production clock',run("set role service_role;select reconcile_months_at_v2('2026-11-01T03:00:00Z')",db,fail=False)[0]!=0)
    check('unknown world cannot create certified native life',run(f"select ingest_life_observation_v1('{uuid.uuid4()}','{'a'*64}','{'b'*64}','Fixture','Fixture',true,now(),'{'a'*64}','{{}}')",db,fail=False)[0]!=0)
    print(json.dumps({'engine':run('select version()',db),'network':'none','host_ports':0,'separate_sessions':True,'checks':len(checks),'passed':len(checks),'official_production_writes':0}))

if __name__=='__main__':main()
