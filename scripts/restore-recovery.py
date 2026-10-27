"""Ensaiar backup público apenas em container descartável sem rede/portas.

Nunca recebe DSN, senha ou destino produtivo. Dados e SQL gerados não são logados.
"""
import argparse
import hashlib
import json
from pathlib import Path
import subprocess

EXPECTED={'collector_locks','collector_runs','game_characters','game_players',
          'player_stat_snapshots','player_statistics_current','ranking_seasons','season_winners'}
EXPANDED=EXPECTED|{'season_results','season_classification','life_identities','life_observations',
                  'achievement_definitions','life_achievements','dashboard_rollout_state',
                  'product14_state','season_cycles_v2','season_archive_v2','season_uncertain_intervals_v2',
                  'medal_definitions_v2','medal_baselines_v2','medal_unlocks_v2','source_epochs_v2','season_admin_audit_v2',
                  'reward_catalogs_v1','season_reward_draws_v1','reward_delivery_state_v1','reward_delivery_components_v1','reward_events_v1'}
CONTAINER='winx-mission08-restore-20261025'

def execute(sql, database='postgres'):
    run=subprocess.run(['docker','exec','-i',CONTAINER,'psql','-X','-q','-v','ON_ERROR_STOP=1','-U','postgres','-d',database],
                       input=sql.encode('utf-8'),capture_output=True)
    if run.returncode:
        # Não divulgar CONTEXT/linhas de produção presentes em mensagens PostgreSQL.
        summary='\n'.join(line for line in run.stderr.decode('utf-8',errors='replace').splitlines() if 'ERROR:' in line or 'LINE ' in line)
        raise RuntimeError('Local restore/rehearsal failed: '+summary[:350])
    return run.stdout.decode('utf-8')

def ident(value):return '"'+value.replace('"','""')+'"'
def literal(value):return "'"+value.replace("'","''")+"'"
def role(value):return 'PUBLIC' if value=='PUBLIC' else ident(value)
def grants(kind,target,entries):
    sql=[f'REVOKE ALL ON {kind} {target} FROM PUBLIC,anon,authenticated,service_role;']
    for grant in entries or []:
        sql.append(f'GRANT {grant["privilege"]} ON {kind} {target} TO {role(grant["role"])}'+
                   (' WITH GRANT OPTION' if grant['grantable'] else '')+';')
    return sql

def restore(source,database='postgres'):
    inspection=json.loads(subprocess.check_output(['docker','inspect',CONTAINER],text=True))[0]
    if inspection['Config']['Labels'].get('winx.mission')!='08' or inspection['HostConfig']['NetworkMode']!='none' or inspection['HostConfig']['PortBindings']:
        raise RuntimeError('Refusing target without disposable mission label, network isolation and no host ports')
    raw=Path(source).read_bytes();b=json.loads(raw)
    names=set(b['data'])
    if not EXPECTED<=names<=EXPANDED or {t['name'] for t in b['tables']}!=names or b['other_relations'] or b['memberships']:
        raise RuntimeError('Unexpected application scope; export requires manual review')
    if any(t['policies'] or any(c['generated'] for c in t['columns']) for t in b['tables']):
        raise RuntimeError('Unexpected policies or generated columns: extend restore before using')
    sql=['BEGIN; SET check_function_bodies=off; SET standard_conforming_strings=on;',
         "DO $$ BEGIN IF EXISTS(SELECT 1 FROM pg_tables WHERE schemaname='public') THEN RAISE EXCEPTION 'target must be empty'; END IF; END $$;"]
    roles={g['role'] for t in b['tables'] for g in t['grants']}|{g['role'] for f in b['functions'] for g in f['grants']}
    roles|={b['schema_metadata']['owner']}|{g['role'] for g in b['schema_metadata']['grants']}
    roles|={g['role'] for s in b['sequences'] for g in s['grants'] or []}
    roles|={d['owner'] for d in b['default_privileges']}|{g['role'] for d in b['default_privileges'] for g in d['grants'] or []}
    for r in sorted(roles-{'PUBLIC','postgres','pg_database_owner'}):
        sql.append('DO $$ BEGIN IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='+literal(r)+') THEN CREATE ROLE '+ident(r)+' NOLOGIN'+(' BYPASSRLS' if r=='service_role' else '')+'; END IF; END $$;')
    sql+=grants('SCHEMA','public',b['schema_metadata']['grants'])
    for t in b['tables']:
        columns=[]
        for c in t['columns']:
            column=ident(c['name'])+' '+c['type']
            if c['identity']:column+=' GENERATED '+('ALWAYS' if c['identity']=='a' else 'BY DEFAULT')+' AS IDENTITY'
            elif c['default'] is not None:column+=' DEFAULT '+c['default']
            if c['not_null']:column+=' NOT NULL'
            columns.append(column)
        sql.append('CREATE TABLE public.'+ident(t['name'])+' ('+','.join(columns)+');')
    for t in b['tables']:
        for con in t['constraints']:
            if con['type']!='f':sql.append('ALTER TABLE public.'+ident(t['name'])+' ADD CONSTRAINT '+ident(con['name'])+' '+con['definition']+';')
    for t in b['tables']:
        name='public.'+ident(t['name']);columns=','.join(ident(c['name']) for c in t['columns'])
        sql.append(f'INSERT INTO {name} ({columns}) OVERRIDING SYSTEM VALUE SELECT {columns} FROM jsonb_populate_recordset(NULL::{name},'+
                   literal(json.dumps(b['data'][t['name']],ensure_ascii=False,separators=(',',':')))+'::jsonb);')
    for t in b['tables']:
        name='public.'+ident(t['name'])
        for con in t['constraints']:
            if con['type']=='f':sql.append('ALTER TABLE '+name+' ADD CONSTRAINT '+ident(con['name'])+' '+con['definition']+';')
        sql+= [index+';' for index in t['indexes']]
        if t['rls']:sql.append('ALTER TABLE '+name+' ENABLE ROW LEVEL SECURITY;')
        if t['force_rls']:sql.append('ALTER TABLE '+name+' FORCE ROW LEVEL SECURITY;')
        sql+=grants('TABLE',name,t['grants'])
    for f in b['functions']:
        sql.append(f['definition']+';')
        sql+=grants('FUNCTION','public.'+f['signature'],f['grants'])
    for t in b['tables']:
        sql+=[trigger+';' for trigger in t['triggers']]
    for seq in b['sequences']:
        target='public.'+ident(seq['sequencename'])
        sql.append(f'ALTER SEQUENCE {target} AS {seq["data_type"]} INCREMENT BY {seq["increment_by"]} MINVALUE {seq["min_value"]} MAXVALUE {seq["max_value"]} START WITH {seq["start_value"]} CACHE {seq["cache_size"]} '+('CYCLE;' if seq['cycle'] else 'NO CYCLE;'))
        if seq['last_value'] is not None:sql.append('SELECT setval('+literal(target)+','+str(seq['last_value'])+',true);')
        sql+=grants('SEQUENCE',target,seq['grants'])
    kinds={'r':'TABLES','S':'SEQUENCES','f':'FUNCTIONS','T':'TYPES'}
    for d in b['default_privileges']:
        kind=kinds[d['object_type']]
        sql.append('ALTER DEFAULT PRIVILEGES FOR ROLE '+role(d['owner'])+' IN SCHEMA public REVOKE ALL ON '+kind+' FROM PUBLIC,anon,authenticated,service_role;')
        for g in d['grants'] or []:
            sql.append('ALTER DEFAULT PRIVILEGES FOR ROLE '+role(d['owner'])+' IN SCHEMA public GRANT '+g['privilege']+
                       ' ON '+kind+' TO '+role(g['role'])+(' WITH GRANT OPTION' if g['grantable'] else '')+';')
    sql.append('COMMIT;')
    execute('\n'.join(sql),database)
    checks=[]
    for t in b['tables']:
        name=t['name'];target='public.'+ident(name)
        expected=json.dumps(b['data'][name],ensure_ascii=False,separators=(',',':'))
        checks.append('SELECT '+literal(name)+" || ':' || (SELECT count(*) FROM "+target+") || ':' || (NOT EXISTS((SELECT to_jsonb(t) v FROM "+target+
                      ' t EXCEPT ALL SELECT value FROM jsonb_array_elements('+literal(expected)+'::jsonb)) UNION ALL (SELECT value FROM jsonb_array_elements('+literal(expected)+
                      '::jsonb) EXCEPT ALL SELECT to_jsonb(t) FROM '+target+' t)));')
    checked=execute('\n'.join(checks),database)
    if ':false' in checked or ':f\n' in checked:raise RuntimeError('Restored row values differ')
    print(json.dumps({'container':CONTAINER,'network':'none','source_sha256':hashlib.sha256(raw).hexdigest(),
       'tables':{k:len(v) for k,v in b['data'].items()},'functions':len(b['functions']),
       'row_comparison':checked.strip(),'owner_runtime_limit':'container postgres is superuser; visitor/service attributes preserved'}))

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('source');parser.add_argument('--database',default='postgres');args=parser.parse_args()
    import re
    if not re.fullmatch(r'postgres|winx_recovery_[a-z0-9_]+',args.database):raise SystemExit('Refusing unexpected local database name')
    restore(args.source,args.database)
