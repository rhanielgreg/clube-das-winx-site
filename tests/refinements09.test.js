import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { historyPage, historyTable } from '../public/history-view.js';
import { memorialCard, memorialHonors, verifiedDistance } from '../public/memorial-view.js';
import { seasonDeadline } from '../public/season-schedule.js';
import { withSeasonSchedule } from '../lib/season-schedule.js';
import { statusState, STATUS_VALIDITY_MS } from '../public/status-view.js';
import { profileReturn } from '../public/presentation.js';
import { footerHtml } from '../public/footer.js';
import { getSteamAvatar } from '../lib/steam-avatar.js';
import { verifiedSteamAvatars } from '../lib/verified-steam-avatars.js';
import { createPublicPreviewServer } from '../scripts/preview-public.js';

const id='20000000-0000-4000-8000-000000000001';
const season='4ec32a87-fb16-4838-af57-f4cf85425a60';
const displayDate=value=>new Intl.DateTimeFormat('pt-BR',{timeZone:'America/Sao_Paulo'}).format(new Date(value));

test('histórico pagina dez coletas recentes primeiro, mantém ausentes e não altera amostras',()=>{
 const rows=Array.from({length:23},(_,i)=>({observed_at:new Date(1800000000000+i*300000).toISOString(),kills_total:i===22?null:i,alive:i<20}));
 const before=JSON.stringify(rows);
 assert.equal(historyPage(rows).rows.length,10);assert.equal(historyPage(rows).rows[0].kills_total,null);
 assert.equal(historyPage(rows,2).rows[0].kills_total,12);assert.equal(historyPage(rows,3).rows.length,3);
 assert.equal(historyPage(rows,999).page,3);assert.equal(historyPage(rows.slice(0,2),3).page,1);
 assert.equal(historyPage([]).total,0);
 const table=historyTable(rows,1,displayDate).html;
 assert.equal((table.match(/<tbody>([\s\S]*?)<\/tbody>/)?.[1].match(/<tr>/g)||[]).length,10);
 assert.ok(table.includes('Página 1 de 3'));assert.ok(table.includes('<td>—</td>'));
 assert.equal(JSON.stringify(rows),before);
});

test('lápide usa morte registrada, nunca última observação; sem rota de dossiê e distância validada',()=>{
 const row={profile_id:id,character_name:'Nome completo muito comprido <script>',steam_username:'Conta',alive:false,kills_total:0,survival_seconds:0,last_updated_at:'2026-10-26T15:00:00Z'};
 const unknown=memorialCard(row,displayDate);
 assert.ok(unknown.includes('Data de morte não informada'));assert.ok(!unknown.includes('26/10/2026'));
 assert.ok(unknown.includes('Nome completo muito comprido &lt;script&gt;'));assert.ok(!unknown.includes('<script>'));
 assert.ok(!unknown.replace(/<[^>]*>/g,'').includes(id));assert.ok(!unknown.includes('/jogador'));assert.ok(!unknown.includes(id));
 assert.equal(verifiedDistance({...row,distance_total_m:1234,distance_unit:'meters'}),null);
 const known=memorialCard({...row,died_at:'2026-10-24T18:00:00Z',life_identity_verified:true,distance_total_m:1234,distance_unit:'meters'},displayDate);
 assert.ok(known.includes('24/10/2026'));assert.ok(known.includes('DISTÂNCIA TOTAL PERCORRIDA'));assert.ok(known.includes('1,234 km'));
 assert.equal(verifiedDistance({...row,life_identity_verified:true,distance_total_m:null,distance_unit:'meters'}),null);
});

test('homenagens independentes: só vencedores certificados com unidade correta são exibidos',()=>{
 const kill={metric:'kills_total',state:'ready',unit:'count',value:1000,winners:[{profile_id:id,character_name:'Nome completo'}]};
 assert.equal(memorialHonors(null),'');
 const one=memorialHonors([kill,{metric:'distance_total_m',state:'pending_evidence'}]);
 assert.ok(one.includes('O EXTERMINADOR'));assert.ok(!one.includes('O ANDARILHO'));assert.ok(!one.includes('PENDENTE'));
 assert.equal(memorialHonors([{...kill,unit:'world_days'}]),'');
 assert.equal(memorialHonors([{...kill,winners:[{profile_id:'invalid',character_name:'Nome'}]}]),'');
 assert.equal(memorialHonors([{...kill,state:'pending_evidence'}]),'');
 assert.ok(memorialHonors([{metric:'distance_total_m',state:'ready',unit:'meters',value:2000,winners:kill.winners}]).includes('2 km'));
});

test('retorno usa estado real, preserva origem válida e nunca manda vivo ao Memorial',()=>{
 assert.deepEqual(profileReturn({alive:false},'ranking'),{href:'/memorial',label:'Voltar ao Memorial'});
 assert.equal(profileReturn({alive:true},'memorial').href,'/ranking#sobreviventes');
 assert.equal(profileReturn({alive:true},'home').href,'/index.html');
 assert.equal(profileReturn({alive:null},'https://evil.invalid').href,'/ranking');
});

test('status expira para desconhecido, sem transformar falha/ausência em Offline ou zero',()=>{
 const checked=Date.parse('2026-10-26T12:00:00Z');
 const payload={online:true,players:0,checkedAt:new Date(checked).toISOString(),validUntil:new Date(checked+STATUS_VALIDITY_MS).toISOString()};
 assert.equal(statusState(payload,checked),true);assert.equal(statusState(payload,checked+STATUS_VALIDITY_MS),null);
 assert.equal(statusState({...payload,online:false},checked),false);
 assert.equal(statusState({...payload,checkedAt:null},checked),null);
 assert.equal(statusState({...payload,validUntil:null},checked),null);
 assert.equal(statusState({...payload,validUntil:new Date(checked+STATUS_VALIDITY_MS+1).toISOString()},checked),null);
});

test('prazo exige contrato confirmado e usa Brasília; ended_at não vira previsão',async(t)=>{
 const active={season_id:season,status:'active',ended_at:'2026-11-30T23:59:00Z'};
 assert.equal(seasonDeadline(active),null);
 const verified={...active,schedule_verified:true,scheduled_end_at:'2026-12-01T02:59:00Z'};
 assert.equal(seasonDeadline(verified),'Encerra em 30/11/2026 às 23h59');
 assert.equal(seasonDeadline({...verified,status:'closed'}),null);
 let calls=0,missing=false;
 t.mock.method(globalThis,'fetch',async()=>{calls++;return missing?new Response('{}',{status:404}):Response.json([{season_id:season,scheduled_end_at:verified.scheduled_end_at,closure_mode:'manual'}]);});
 const env={SUPABASE_URL:'https://fixture.invalid',SUPABASE_PUBLISHABLE_KEY:'sb_publishable_fixture'};
 assert.deepEqual(await withSeasonSchedule([active],env),[active]);assert.equal(calls,0);
 const result=await withSeasonSchedule([active],{...env,SEASON_SCHEDULE_CONTRACT_VERSION:'season-schedule-v1'});
 assert.equal(result[0].schedule_verified,true);assert.equal(calls,1);
 const automatic=await withSeasonSchedule([active],env,{season_schedule_contract_version:'season-schedule-v1'});assert.equal(automatic[0].schedule_verified,true);assert.equal(calls,2);
 missing=true;
 assert.deepEqual(await withSeasonSchedule([active],{...env,SEASON_SCHEDULE_CONTRACT_VERSION:'season-schedule-v1'}),[active]);
});

test('proposta 008 guarda prazo sem encerrar temporada, preserva linhas e recusa divergência',async()=>{
 const db=new PGlite();
 try {
  await db.exec(`create role anon;create role authenticated;create role service_role;create table dashboard_rollout_state(id boolean primary key,life_enabled boolean,cohort_started_at timestamptz);insert into dashboard_rollout_state values(true,false,null);create table collector_runs(id uuid,started_at timestamptz,status text);create table ranking_seasons(id uuid primary key,name text,status text,ended_at timestamptz);insert into ranking_seasons values('${season}','Temporada 1','active',null),('${id}','Outra','closed','2026-10-20T00:00:00Z');`);
  const sql=await readFile(new URL('../migrations/008_season_schedule.sql',import.meta.url),'utf8');await db.exec(sql);
  const data=(await db.query('select * from get_public_season_schedule_v1($1)',[season])).rows[0];
  assert.equal(new Date(data.scheduled_end_at).toISOString(),'2026-12-01T02:59:00.000Z');assert.equal(data.closure_mode,'manual');
  assert.equal((await db.query('select get_public_dashboard_release_v1() data')).rows[0].data.season_schedule_contract_version,'season-schedule-v1');
  assert.equal((await db.query('select status from ranking_seasons where id=$1',[season])).rows[0].status,'active');
  assert.equal((await db.query('select count(*) n from ranking_seasons')).rows[0].n,2);
  await db.exec(sql);
  await db.query("update ranking_seasons set scheduled_end_at='2027-01-01' where id=$1",[season]);
  await assert.rejects(db.exec(sql),/existing planned deadline differs/);await db.exec('rollback');
  assert.equal((await db.query("select has_function_privilege('anon','get_public_season_schedule_v1(uuid)','execute') allowed")).rows[0].allowed,true);
 }finally{await db.close();}
});

test('quatro avatares comprovados são compartilhados por UUID/conta; nomes não viram busca Steam',async()=>{
 assert.equal(Object.keys(verifiedSteamAvatars).length,4);
 const noNetwork=async()=>{throw Error('unexpected network');};
 for(const [profileId,record] of Object.entries(verifiedSteamAvatars)) {
  assert.equal(await getSteamAvatar(record.username,{profileId,env:{},fetchImpl:noNetwork}),record.avatar_url);
  assert.equal(await getSteamAvatar('Outra conta',{profileId,env:{},fetchImpl:noNetwork}),null);
 }
 assert.equal(await getSteamAvatar('Nome',{env:{STEAM_PROFILE_MAP_JSON:JSON.stringify({Nome:'https://steamcommunity.com/id/Nome'})},fetchImpl:noNetwork}),null);
 assert.equal(await getSteamAvatar(undefined,{profileId:id,env:{},fetchImpl:noNetwork}),null);
 const avatar=await getSteamAvatar('Nome',{profileId:id,env:{STEAM_PROFILE_MAP_JSON:JSON.stringify({[id]:'https://steamcommunity.com/profiles/76561198000000099'})},fetchImpl:async()=>new Response('<steamID64>76561198000000098</steamID64><avatarFull>https://avatars.steamstatic.com/a.jpg</avatarFull>')});
 assert.equal(avatar,null);
});

test('008 é compatível com 001–007: ingestão legada, pontos, snapshots e ACL permanecem',async()=>{
 const db=new PGlite();
 try {
  await db.exec(await readFile(new URL('./fixtures/schema-before.sql',import.meta.url),'utf8'));
  for(const name of ['001_restrict_ingestion','002_public_read_contracts','003_official_championship','004_life_achievements','006_dashboard_release','005_life_read_contracts','007_controlled_life_activation'])await db.exec(await readFile(new URL(`../migrations/${name}.sql`,import.meta.url),'utf8'));
  await db.query("insert into ranking_seasons(id,name,slug,status,started_at) values($1,'Temporada 1','temporada-1','active',now()-interval '1 day')",[season]);
  const signature='ingest_player_observation(text,text,text,boolean,text,timestamptz,integer,integer,integer,bigint,text)';
  const before=(await db.query('select md5(pg_get_functiondef($1::regprocedure)) hash',[signature])).rows[0].hash;
  await db.query("select ingest_player_observation('p','c','Personagem',true,$1,now()-interval '1 minute',100,10,90,600,'Conta')",['a'.repeat(64)]);
  const score=(await db.query('select kills_total from get_public_ranking(100)')).rows[0].kills_total;
  await db.exec(await readFile(new URL('../migrations/008_season_schedule.sql',import.meta.url),'utf8'));
  await db.query("select ingest_player_observation('p','c','Personagem',true,$1,now(),120,20,100,900,'Conta')",['b'.repeat(64)]);
  assert.equal((await db.query('select kills_total from get_public_ranking(100)')).rows[0].kills_total,score+20);
  assert.equal((await db.query('select count(*) n from player_stat_snapshots')).rows[0].n,2);
  assert.equal((await db.query('select md5(pg_get_functiondef($1::regprocedure)) hash',[signature])).rows[0].hash,before);
  assert.equal((await db.query("select has_function_privilege('anon',$1,'execute') allowed",[signature])).rows[0].allowed,false);
  assert.equal((await db.query('select count(*) n from achievement_definitions')).rows[0].n,100);
 }finally{await db.close();}
});

test('rodapé único nas telas públicas vigentes e limpeza não remove rotas, contador ou conexões',async()=>{
 assert.ok(footerHtml().includes('© 2026 Clube das Winx · Desenvolvido por Greg e Emmanuel / Galera Nerd'));
 assert.ok(!footerHtml().includes('Sobreviva à temporada'));
 for(const file of ['index','ranking','memorial','admin']) {
  const html=await readFile(new URL(`../public/${file}.html`,import.meta.url),'utf8');
  assert.ok(html.includes('data-site-footer'));
  assert.doesNotMatch(html,/>0[123] \/|hero-hud|hero-description|hero-memorial-link|Latência da consulta|data-server-latency|memorial-disclaimer/);
 }
 const ranking=await readFile(new URL('../public/ranking.html',import.meta.url),'utf8');
 assert.ok(ranking.includes('data-collection-countdown'));assert.ok(ranking.includes('id="sobreviventes"'));
 const home=await readFile(new URL('../public/index.html',import.meta.url),'utf8');
 assert.ok(home.includes('data-copy-source="ip"'));assert.ok(home.includes('href="/api/connect"'));
 assert.ok(!home.includes('data-ranking-sync'));
});

test('prévia pública fixa a origem e bloqueia escrita/admin sem conectar aos serviços privados',async()=>{
 const calls=[];
 const server=createPublicPreviewServer({fetchImpl:async(url)=>{calls.push(url);return Response.json({ranking:[],graveyard:[],seasons:[]});}});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const base=`http://127.0.0.1:${server.address().port}`;
 try {
  const payload=await(await fetch(base+'/api/ranking?origin=https://evil.invalid')).json();
  assert.equal(payload.preview,true);assert.deepEqual(calls,['https://clubedaswinx-delta.vercel.app/api/ranking']);
  assert.equal((await fetch(base+'/api/ranking',{method:'POST'})).status,405);
  assert.equal((await fetch(base+'/api/admin')).status,403);
  assert.equal((await fetch(base+'/api/player?id=invalid')).status,400);
  assert.equal((await fetch(base+'/api/unknown')).status,404);assert.equal(calls.length,1);
 }finally{await new Promise(resolve=>server.close(resolve));}
});
