"""Ensaio HTTP real em Docker isolado. Nunca acessa Supabase/Railway ou o jogo."""
import argparse
import importlib.util
import json
from pathlib import Path
import secrets
import subprocess

CLIENT=r'''
import base64,hashlib,hmac,json,os,sqlite3,time,uuid
from datetime import datetime,timezone
from pathlib import Path
import requests
from ttf_saved_life import extract_saved_lives
secret=os.environ['LOCAL_JWT_SECRET']
def b64(value):return base64.urlsafe_b64encode(value).rstrip(b'=')
header=b64(b'{"alg":"HS256","typ":"JWT"}')
body=b64(json.dumps({'role':'service_role','exp':int(time.time())+3600}).encode())
message=header+b'.'+body
token=(message+b'.'+b64(hmac.new(secret.encode(),message,hashlib.sha256).digest())).decode()
service={'Authorization':'Bearer '+token,'Content-Type':'application/json'}
base='http://127.0.0.1:3000'
def rpc(name,args=None,private=False,expected=200):
 response=requests.post(base+'/rpc/'+name,json=args or {},headers=service if private else {},timeout=15)
 if response.status_code!=expected:raise RuntimeError(name+' HTTP '+str(response.status_code))
 return response.json()
for attempt in range(30):
 try:
  if requests.get(base+'/',timeout=2).ok:break
 except requests.RequestException:pass
 time.sleep(.25)
else:raise RuntimeError('Local PostgREST not ready')
assert rpc('get_public_dashboard_release_v1')['life_contract_version'] is None
assert rpc('get_service_pipeline_readiness_v1',private=True)['contract_ready'] is True
denied=requests.post(base+'/rpc/get_service_pipeline_readiness_v1',json={},timeout=10)
assert denied.status_code in (401,403,404)
before=rpc('get_public_ranking',{'p_limit':100})
with sqlite3.connect('file:/inputs/players.db?mode=ro&immutable=1',uri=True) as db:
 rows=db.execute('select username,name,isDead,data,steamid,world from networkPlayers').fetchall()
run=requests.post(base+'/collector_runs',json={'status':'running'},headers={**service,'Prefer':'return=representation'},timeout=10)
assert run.status_code==201
run_id=run.json()[0]['id']
observations=extract_saved_lives(rows,'isolated-local-test-salt',str(uuid.uuid4()))
profiles=[rpc('ingest_life_observation_v1',o,True) for o in observations]
shadow=rpc('get_public_ranking',{'p_limit':100})
assert shadow==before,'Preparation changed the legacy competition'
def records(table):
 r=requests.get(base+'/'+table+'?select=*',headers=service,timeout=10)
 if not r.ok:raise RuntimeError(table+' HTTP '+str(r.status_code))
 return r.json()
first_observations=records('life_observations');first_awards=records('life_achievements')
for o in observations:rpc('ingest_life_observation_v1',o,True)
assert records('life_observations')==first_observations
assert records('life_achievements')==first_awards
done=requests.patch(base+'/collector_runs?id=eq.'+run_id,json={'status':'success','records_seen':len(rows),'finished_at':datetime.now(timezone.utc).isoformat()},headers=service,timeout=10)
assert done.status_code==204
activation=rpc('activate_verified_cohort_v1',{'p_source_world_id':observations[0]['p_world_id'],'p_expected_records':len(rows)},True)
assert activation['records_verified']==len(rows)
release=rpc('get_public_dashboard_release_v1');assert release['life_contract_version']=='life-v1'
ranking=rpc('get_public_ranking_life_v1',{'p_limit':100})
assert len(ranking)==sum(o['p_alive'] is True for o in observations)
assert all(r['alive'] is True and r['life_identity_verified'] is True for r in ranking)
for profile,o in zip(profiles,observations):
 dossier=rpc('get_public_life_achievements_v1',{'p_profile_id':profile})
 assert dossier['catalog_count']==100 and dossier['identity_verified'] is True
 assert dossier['life_metrics']['kills_total']['value']==o['p_metrics']['kills_total']['value']
 assert len(dossier['life_history'])==1
honors=rpc('get_public_memorial_honors_v1')
assert all(h['state']=='pending_evidence' for h in honors)
print(json.dumps({'http':'real PostgREST','source_rows':len(rows),'alive_ranked':len(ranking),'legacy_rank_unchanged_during_preparation':True,
 'observations_after_replay':len(first_observations),'unlocks_after_replay':len(first_awards),'identity_isolated':True,
 'cohort_activation_verified':True,'catalog_count':100,'unsupported_honors_blocked':True}))
'''

def main(source,output):
    spec=importlib.util.spec_from_file_location('recovery',Path(__file__).with_name('restore-recovery.py'))
    recovery=importlib.util.module_from_spec(spec);spec.loader.exec_module(recovery)
    inspected=json.loads(subprocess.check_output(['docker','inspect',recovery.CONTAINER],text=True))[0]
    assert inspected['Config']['Labels']['winx.mission']=='08' and inspected['HostConfig']['NetworkMode']=='none'
    for name in ['003_official_championship','004_life_achievements','006_dashboard_release','005_life_read_contracts','007_controlled_life_activation']:
        recovery.execute((Path(__file__).parent.parent/'migrations'/(name+'.sql')).read_text(encoding='utf-8'))
    target=Path(output);target.parent.mkdir(parents=True,exist_ok=True)
    secret=secrets.token_urlsafe(36)
    server_env=target.parent/'postgrest-local-only.env'
    server_env.write_text('PGRST_DB_URI=postgresql://postgres@127.0.0.1:5432/postgres\nPGRST_DB_ANON_ROLE=anon\nPGRST_DB_SCHEMAS=public\nPGRST_JWT_SECRET='+secret+'\n',encoding='utf-8')
    client_env=target.parent/'client-local-only.env';client_env.write_text('LOCAL_JWT_SECRET='+secret+'\n',encoding='utf-8')
    server='winx-mission08-postgrest-20261025'
    created=subprocess.run(['docker','run','-d','--name',server,'--label','winx.mission=08','--network','container:'+recovery.CONTAINER,
                           '--env-file',str(server_env),'postgrest/postgrest:latest'],capture_output=True)
    if created.returncode:raise RuntimeError('Unable to start isolated PostgREST: '+created.stderr.decode(errors='replace')[:250])
    try:
        result=subprocess.run(['docker','run','--rm','--network','container:'+recovery.CONTAINER,'--env-file',str(client_env),
                               '-v',str(Path(source).resolve())+':/inputs/players.db:ro','winx-collector:mission08','python','-B','-c',CLIENT],capture_output=True)
        if result.returncode:
            raise RuntimeError('Isolated HTTP rehearsal failed: '+result.stderr.decode(errors='replace')[-1000:])
        evidence=json.loads(result.stdout);target.write_text(json.dumps(evidence,indent=2),encoding='utf-8');print(json.dumps(evidence))
    finally:
        subprocess.run(['docker','stop',server],capture_output=True)

if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--source',required=True);p.add_argument('--output',required=True);a=p.parse_args();main(a.source,a.output)
