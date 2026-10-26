import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { seasonDeadline, seasonCountdown } from '../public/season-schedule.js';
import { collectionCountdown } from '../public/collection-countdown.js';
import { legacyProfileDestination } from '../public/profile-redirect.js';
import { memorialCard, memorialHonors } from '../public/memorial-view.js';
import { profileMetrics } from '../public/presentation.js';

const id='20000000-0000-4000-8000-000000000001';
const active={status:'active',schedule_verified:true,scheduled_end_at:'2026-12-01T02:59:00Z',closure_mode:'manual'};
const deadline=Date.parse(active.scheduled_end_at);
const source=async path=>(await readFile(new URL('../'+path,import.meta.url),'utf8')).replaceAll('\r\n','\n');
const prior=path=>execFileSync('git',['show','c35e1ce:'+path],{encoding:'utf8'}).replaceAll('\r\n','\n');

test('prazo futuro usa dias/horas/minutos/segundos e não muda os dados da temporada',()=>{
  const before=JSON.stringify(active);
  assert.equal(seasonCountdown(active,deadline-((35*24+12)*3600+24*60+8)*1000),'35d 12h 24m 08s');
  assert.equal(seasonCountdown(active,deadline-1),'0d 00h 00m 01s');
  assert.equal(JSON.stringify(active),before);
});

test('zero e vencimento aguardam encerramento manual sem declarar campeão',()=>{
  for(const now of [deadline,deadline+86400000]) {
    assert.equal(seasonCountdown(active,now),'Prazo encerrado — aguardando encerramento oficial');
    assert.equal(active.status,'active');
  }
  assert.equal(seasonCountdown({...active,status:'closed'},deadline-1000),'Temporada encerrada');
  assert.equal(seasonDeadline({...active,status:'closed'}),null);
  assert.equal(seasonCountdown({...active,closure_mode:null},deadline),'Prazo encerrado — aguardando confirmação');
});

test('prazo e relógio ausentes/inválidos não geram números nem dependem do fuso local',()=>{
  for(const date of [null,'', 'inválido','2026-12-01T02:59:00','2026-02-30T00:00:00Z','2026-13-01T00:00:00Z','2026-12-01T24:00:00Z']) {
    assert.equal(seasonCountdown({...active,scheduled_end_at:date},deadline),'Prazo indisponível');
    assert.equal(seasonDeadline({...active,scheduled_end_at:date}),null);
  }
  assert.equal(seasonCountdown({...active,schedule_verified:false},deadline),'Prazo indisponível');
  assert.equal(seasonCountdown(active,NaN),'Contagem indisponível');
  assert.equal(seasonCountdown(null,deadline),null);
  assert.equal(seasonCountdown({status:'pending'},deadline),null);
});

test('Brasília e contagem são idênticas em processos com fusos de navegador diferentes',()=>{
  const module=new URL('../public/season-schedule.js',import.meta.url).href;
  const code=`import {seasonDeadline,seasonCountdown} from ${JSON.stringify(module)};const s=${JSON.stringify(active)};console.log(JSON.stringify([seasonDeadline(s),seasonCountdown(s,${deadline-100000})]));`;
  for(const TZ of ['UTC','America/Sao_Paulo','America/Los_Angeles','Asia/Tokyo']) {
    const result=JSON.parse(execFileSync(process.execPath,['--input-type=module','-e',code],{env:{...process.env,TZ},encoding:'utf8'}));
    assert.deepEqual(result,['Encerra em 30/11/2026 às 23h59','0d 00h 01m 40s']);
  }
});

test('contador sazonal não altera nem reinicia o cron da coleta',()=>{
  const sync={latest_attempt_at:'2026-10-26T12:00:25Z',latest_attempt_status:'success',collector_interval_seconds:300,collector_cron_utc:'*/5 * * * *'};
  assert.equal(collectionCountdown(sync,Date.parse('2026-10-26T12:02:00Z')),'Próxima atualização em 03:00');
  seasonCountdown(active,deadline);
  assert.equal(collectionCountdown(sync,Date.parse('2026-10-26T12:05:00Z')),'Aguardando confirmação da próxima coleta');
});

test('compatibilidade de URLs antigas usa apenas estado booleano do perfil exato',async()=>{
  for(const [alive,destination] of [[false,'/memorial'],[true,'/ranking'],[null,'/ranking'],['false','/ranking']]) {
    const result=await legacyProfileDestination(id,async(url,options)=>{
      assert.equal(url,'/api/player?id='+id);assert.equal(options.redirect,'error');
      return Response.json({profile:{profile_id:id,alive}});
    });
    assert.equal(result,destination);
  }
  assert.equal(await legacyProfileDestination(id,async()=>Response.json({profile:{profile_id:'outro',alive:false}})),'/ranking');
});

test('redirect inválido/desconhecido/falha sempre volta ao Ranking sem consultas inseguras',async()=>{
  for(const invalid of [null,'','https://evil.invalid','../memorial',id+'&returnTo=https://evil.invalid']) {
    assert.equal(await legacyProfileDestination(invalid,()=>{throw Error('Não deve consultar');}),'/ranking');
  }
  for(const fetchImpl of [async()=>new Response('',{status:404}),async()=>new Response('não JSON'),async()=>{throw Error('offline');},async()=>Response.json({profile:null})]) {
    assert.equal(await legacyProfileDestination(id,fetchImpl),'/ranking');
  }
});

test('Memorial conserva pessoa/conta/data/estatísticas, sem links individuais ou IDs visíveis',()=>{
  const html=memorialCard({profile_id:id,character_name:'Nome completo & longo',steam_username:'Conta real',alive:false,died_at:'2026-10-25T12:00:00Z',kills_total:342,survival_seconds:7200},()=> '25/10/2026');
  for(const value of ['Nome completo &amp; longo','Jogador / Conta real','25/10/2026','342','2h 0m'])assert.ok(html.includes(value));
  assert.doesNotMatch(html,/\/jogador|dossiê|20000000-/i);
  const honors=memorialHonors([{metric:'kills_total',state:'ready',unit:'count',value:342,winners:[{profile_id:id,character_name:'Nome real'}]}]);
  assert.ok(honors.includes('Nome real'));assert.ok(!honors.includes('/jogador'));
});

test('categorias atuais não inventam os 120 restantes, veículos ou distâncias por diferença',()=>{
  const profile={profile_id:id,kills_total:342,kills_firearm:39,kills_melee:183};
  const metrics=profileMetrics(profile);
  assert.deepEqual(metrics.combat.map(row=>row.value),[342,39,183]);
  assert.ok(!metrics.combat.some(row=>row.key==='kills_vehicle'||row.key==='kills_other'));
  assert.deepEqual(metrics.exploration,[]);
});

test('fluxo público sem dossiês, texto aprovado e título sem contagem dinâmica',async()=>{
  const [ranking,memorial,script,redirect]=await Promise.all(['public/ranking.html','public/memorial.html','public/site.js','public/jogador.html'].map(source));
  assert.match(ranking,/<h2>Classificação geral<\/h2>/);
  assert.doesNotMatch(ranking+script,/data-ranking-count|href=["'`]\/jogador|Abrir dossiê|DOSSIÊ INDIVIDUAL/);
  assert.ok(ranking.includes('Cada sobrevivente tem sua história. Cada batalha pode mudar o topo.'));
  assert.ok(ranking.includes('<p class="fine-print">Líder atual</p>'));
  assert.ok(ranking.includes('data-season-countdown'));assert.ok(ranking.includes('data-collection-countdown'));
  assert.ok(memorial.includes('Alguns tombaram cedo. Outros desafiaram o apocalipse por muito tempo. Todos fizeram parte da nossa história — e nenhum será esquecido.'));
  assert.ok(redirect.includes('/profile-redirect.js'));assert.ok(!redirect.includes('data-player-root'));
  assert.ok(!script.includes('function renderPlayer'));
});

test('Início, status, APIs, catálogo e SQL preservados salvo destino/legenda do CTA obsoleto',async()=>{
  const home=(await source('public/index.html')).replaceAll('\r\n','\n');
  assert.equal(home,prior('public/index.html').replace('Ver dossiê do MVP ↗','Ver ranking ↗'));
  for(const file of ['public/styles.css','api/player.js','api/status.js','public/status-view.js','public/achievements-catalog.js','migrations/008_season_schedule.sql'])assert.equal((await source(file)).replaceAll('\r\n','\n'),prior(file));
  const css=(await source('public/identity.css')).replaceAll('\r\n','\n');assert.ok(css.startsWith(prior('public/identity.css')));
  const script=await source('public/site.js');
  for(const [start,end] of [['function setupNavigation()','async function loadStatus()'],['async function loadStatus()','function updateLeader(']]) {
    const block=s=>s.slice(s.indexOf(start),s.indexOf(end));
    assert.equal(block(script),block(prior('public/site.js')));
  }
});
