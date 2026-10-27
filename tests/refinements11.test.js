import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { PGlite } from '@electric-sql/pglite';
import { filterRanking, normalizeRankingFilter } from '../public/contracts.js';
import { rankingClock, clockNow } from '../public/ranking-clock.js';
import { seasonCountdown, seasonDeadline } from '../public/season-schedule.js';
import rankingApi from '../api/ranking.js';
import adminApi from '../api/admin.js';

const seasonId='4ec32a87-fb16-4838-af57-f4cf85425a60';
const start='2026-10-20T01:05:18.930285Z';
const deadline='2026-11-01T02:59:00Z';
const active={season_id:seasonId,status:'active',schedule_verified:true,scheduled_end_at:deadline,closure_mode:'manual'};
const row=(id,kills,time,extra={})=>({profile_id:id,character_name:'Mesmo nome',steam_username:id,alive:true,kills_total:kills,survival_seconds:time,...extra});
const rows=[row('a',342,34980,{rank_position:1}),row('b',306,43620,{rank_position:2}),row('c',188,16140,{rank_position:3})];
const source=async file=>(await readFile(new URL('../'+file,import.meta.url),'utf8')).replaceAll('\r\n','\n');

test('Kills/Tempo reordenam sem alterar posição oficial ou o MVP de origem',()=>{
  const before=JSON.stringify(rows);
  const time=filterRanking(rows,[],{filter:'time'});
  assert.deepEqual(time.map(r=>r.profile_id),['b','a','c']);
  assert.deepEqual(time.map((r,i)=>String(i+1).padStart(2,'0')),['01','02','03']);
  assert.equal(time[0].rank_position,2);
  assert.deepEqual(filterRanking(rows,[],{filter:'kills'}).map(r=>r.profile_id),['a','b','c']);
  assert.equal(rows[0].profile_id,'a');assert.equal(JSON.stringify(rows),before);
});

test('desempates usam métrica alternativa e UUID, independentemente da ordem de chegada',()=>{
  const tied=[row('c',100,60),row('b',100,60),row('a',100,120),row('z',0,null)];
  for(const filter of ['kills','time']) {
    assert.deepEqual(filterRanking(tied,[],{filter}).map(r=>r.profile_id),['a','b','c','z']);
    assert.deepEqual(filterRanking(tied.toReversed(),[],{filter}).map(r=>r.profile_id),['a','b','c','z']);
  }
  assert.equal(filterRanking([row('a',100,null),row('b',100,0)],[],{filter:'time'})[0].profile_id,'b');
});

test('busca/atualização/alias Vivos preservam elegibilidade e Cemitério tem ordem própria',()=>{
  const dead=[row('x',999,999,{alive:false,died_at:'2026-10-24'}),row('y',10,50,{alive:false,died_at:'2026-10-25'}),row('n',1000,1000,{alive:null})];
  assert.equal(normalizeRankingFilter('alive'),'kills');assert.equal(normalizeRankingFilter('unknown'),'kills');
  assert.deepEqual(filterRanking([...rows,...dead],dead,{filter:'alive'}).map(r=>r.profile_id),['a','b','c']);
  assert.deepEqual(filterRanking(rows,dead,{filter:'dead'}).map(r=>r.profile_id),['y','x']);
  assert.deepEqual(filterRanking(rows,dead,{filter:'time',search:'b'}).map(r=>r.profile_id),['b']);
  const refreshed=rows.map(r=>r.profile_id==='a'?{...r,survival_seconds:50000}:r);
  assert.deepEqual(filterRanking(refreshed,dead,{filter:'time'}).map(r=>r.profile_id),['a','b','c']);
});

test('relógio absoluto corrige Age e mantém coerência entre componente recriado/F5',()=>{
  const at=Date.parse('2026-10-26T19:00:00Z');
  const first=rankingClock({server_time:new Date(at).toISOString()},new Headers({age:'0',date:new Date(at).toUTCString()}),100);
  assert.equal(clockNow(first,20100),at+20000);
  const reload=rankingClock({server_time:new Date(at).toISOString()},new Headers({age:'20'}),0);
  assert.equal(seasonCountdown(active,clockNow(first,20100)),seasonCountdown(active,clockNow(reload,0)));
  // Um proxy atualiza Date, mas devolve corpo antigo e Age ausente/zerado.
  const delayed=rankingClock({server_time:new Date(at).toISOString()},new Headers({date:new Date(at+20000).toUTCString(),age:'0'}),0);
  assert.equal(clockNow(delayed,0),at+20000);
});

test('relógio usa servidor/tempo monotônico, sem hora local e sem recuo por precisão HTTP',t=>{
  t.mock.method(Date,'now',()=>0);
  const clock=rankingClock({server_time:'2026-10-26T19:00:00Z'},new Headers(),10);
  assert.equal(clockNow(clock,1010),Date.parse('2026-10-26T19:00:01Z'));
  const next=rankingClock({server_time:'2026-10-26T19:00:00Z'},new Headers(),1010,clock);
  assert.equal(next.server,clockNow(clock,1010));
  assert.equal(rankingClock({},new Headers(),0),null);
  assert.equal(clockNow(clock,0),NaN);
  assert.equal(rankingClock({server_time:'inválido'},new Headers({age:'20'}),0),null);
});

test('transições 10→09, 09→08 e viradas de minuto/hora/dia preservam data absoluta',()=>{
  const end=Date.parse(deadline);
  const cases=[[10000,'0d 00h 00m 10s'],[9000,'0d 00h 00m 09s'],[8000,'0d 00h 00m 08s'],[60000,'0d 00h 01m 00s'],[59000,'0d 00h 00m 59s'],[3600000,'0d 01h 00m 00s'],[3599000,'0d 00h 59m 59s'],[86400000,'1d 00h 00m 00s'],[86399000,'0d 23h 59m 59s']];
  for(const [remaining,label] of cases)assert.equal(seasonCountdown(active,end-remaining),label);
  assert.equal(seasonDeadline(active),'Encerra em 31/10/2026 às 23h59');
  assert.equal(seasonCountdown(active,end),'Prazo encerrado — aguardando encerramento oficial');
  assert.equal(seasonCountdown({...active,status:'closed'},end),'Temporada encerrada');
});

async function seasonDatabase() {
  const db=new PGlite();
  await db.exec(`create table ranking_seasons(id uuid primary key,name text,slug text,status text,started_at timestamptz,ended_at timestamptz,closed_at timestamptz,scheduled_end_at timestamptz,reward_message text);
   insert into ranking_seasons values('${seasonId}','Temporada 1','temporada-1','active','${start}',null,null,'2026-12-01T02:59:00Z','Preservar recompensa'),('10000000-0000-4000-8000-000000000001','Anterior','anterior','closed','2025-01-01Z','2025-02-01Z','2025-02-01Z',null,'Histórico');`);
  return db;
}

test('009 altera somente o prazo alvo, conserva início/estado/outros registros e é idempotente',async()=>{
  const db=await seasonDatabase();
  try {
    const before=(await db.query('select to_jsonb(s) data from ranking_seasons s order by id')).rows.map(r=>r.data);
    const migration=await source('migrations/009_correct_season1_deadline.sql');
    await db.exec(migration);await db.exec(migration);
    const after=(await db.query('select to_jsonb(s) data from ranking_seasons s order by id')).rows.map(r=>r.data);
    assert.deepEqual(after[0],before[0]);
    assert.equal(Date.parse(after[1].scheduled_end_at),Date.parse(deadline));
    const withoutDeadline=object=>Object.fromEntries(Object.entries(object).filter(([key])=>key!=='scheduled_end_at'));
    assert.deepEqual(withoutDeadline(after[1]),withoutDeadline(before[1]));
    assert.equal(after[1].status,'active');assert.equal(after[1].ended_at,null);
  }finally{await db.close();}
});

test('009 recusa início, prazo ou estado divergente sem gravar parcialmente',async()=>{
  const migration=await source('migrations/009_correct_season1_deadline.sql');
  for(const assignment of ["started_at='2026-10-21Z'","scheduled_end_at='2026-12-10Z'","status='closed'"]) {
    const db=await seasonDatabase();
    try {
      await db.exec(`update ranking_seasons set ${assignment} where id='${seasonId}'`);
      const before=(await db.query('select to_jsonb(s) data from ranking_seasons s order by id')).rows;
      await assert.rejects(db.exec(migration));await db.exec('rollback');
      assert.deepEqual((await db.query('select to_jsonb(s) data from ranking_seasons s order by id')).rows,before);
    }finally{await db.close();}
  }
});

const response=()=>({headers:{},setHeader(k,v){this.headers[k]=v;},status(code){this.code=code;return this;},json(body){this.body=body;return this;}});
test('APIs pública/admin compartilham prazo do banco; início/autenticação/encerramento mantidos',async t=>{
  const keys=['SUPABASE_URL','SUPABASE_PUBLISHABLE_KEY','SUPABASE_SERVICE_ROLE_KEY','ADMIN_EMAIL','COMPETITION_RULES_VERSION','LIFE_CONTRACT_VERSION','SEASON_SCHEDULE_CONTRACT_VERSION'];
  const old=Object.fromEntries(keys.map(key=>[key,process.env[key]]));
  Object.assign(process.env,{SUPABASE_URL:'https://fixture.invalid',SUPABASE_PUBLISHABLE_KEY:'sb_publishable_fixture',SUPABASE_SERVICE_ROLE_KEY:'sb_secret_fixture',ADMIN_EMAIL:'admin@example.invalid'});
  for(const key of ['COMPETITION_RULES_VERSION','LIFE_CONTRACT_VERSION','SEASON_SCHEDULE_CONTRACT_VERSION'])delete process.env[key];
  const calls=[];
  t.mock.method(globalThis,'fetch',async(url,options)=>{
    calls.push(url);
    if(url.endsWith('/auth/v1/user'))return Response.json({email:'admin@example.invalid'});
    if(url.endsWith('get_public_dashboard_release_v1'))return Response.json({competition_rules_version:'winx-v1',season_schedule_contract_version:'season-schedule-v1',server_time:'2020-01-01T00:00:00Z'});
    if(url.endsWith('get_public_seasons_v2'))return Response.json([{season_id:seasonId,status:'active',started_at:start,ended_at:null}]);
    if(url.endsWith('get_public_season_schedule_v1'))return Response.json([{season_id:seasonId,scheduled_end_at:deadline,closure_mode:'manual'}]);
    return Response.json([]);
  });
  try {
    const before=Date.now();const publicResult=response();await rankingApi({method:'GET'},publicResult);
    assert.equal(publicResult.code,200);assert.equal(publicResult.headers['cache-control'],'no-store, max-age=0');
    assert.ok(Date.parse(publicResult.body.server_time)>=before,'timestamp nasce no fim da resposta, não no marcador antigo');
    const admin=response();await adminApi({method:'GET',headers:{authorization:'Bearer fixture-only'}},admin);
    assert.equal(admin.code,200);assert.deepEqual(admin.body.activeSeason,publicResult.body.seasons[0]);
    assert.equal(admin.body.activeSeason.started_at,start);assert.equal(admin.body.activeSeason.closure_mode,'manual');
    assert.equal(admin.body.activeSeason.scheduled_end_at,deadline);assert.equal(admin.body.activeSeason.ended_at,null);
    assert.ok(!calls.some(call=>call.includes('close_ranking_season')));
  }finally{for(const key of keys)old[key]===undefined?delete process.env[key]:process.env[key]=old[key];}
});

test('tela usa numeração visual, elimina Vivos, mantém MVP oficial e CSS restrita',async()=>{
  const [html,script,css]=await Promise.all(['public/ranking.html','public/site.js','public/ranking.css'].map(source));
  assert.ok(html.includes('/ranking.css'));assert.ok(!html.includes('data-filter="alive"'));
  assert.ok(script.includes('rankingRow(row,hasDistance,index+1)'));
  assert.ok(script.includes('updateLeader(payload.ranking[0])'));
  assert.ok(css.includes('position: relative; top: auto; align-self: start; transform: none; transition: none;'));
  for(const file of ['public/index.html','public/memorial.html','public/memorial-view.js','public/identity.css','public/styles.css','api/status.js','public/achievements-catalog.js','migrations/008_season_schedule.sql']) {
    const before=execFileSync('git',['show','0b003fb:'+file],{encoding:'utf8'}).replaceAll('\r\n','\n');
    let current = await source(file);
    if (file === 'public/index.html') current = current.replace('<meta name="referrer" content="no-referrer"><script src="/auth-return.js"></script>', '');
    assert.equal(current,before,file+' permanece congelado, salvo bootstrap de recuperação autorizado');
  }
});
