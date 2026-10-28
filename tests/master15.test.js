import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {rewardCatalog} from '../lib/reward-catalog.js';
import {rewardCatalog as original} from '../lib/reward-catalog-v1.js';
import {validateRewardCatalog,drawReward,RARITY_WEIGHTS} from '../lib/reward-draw.js';
import {rarityChances,rewardProbability,wheelPreview,catalogMarkup,historyMarkup,rewardRotation} from '../public/reward-presentation.js';
import {telemetryCards} from '../public/admin-shell.js';
import {seasonDeadline,seasonCountdown} from '../public/season-schedule.js';
import {publicRewards} from '../public/rewards-view.js';
import {createMonthlyTestDb,firstSeason} from './fixtures/monthly-db.js';
import {createRewardWinner} from './fixtures/reward-winner.js';
import adminApi from '../api/admin.js';
import rewardsApi from '../api/rewards.js';
const source=path=>readFile(new URL('../'+path,import.meta.url),'utf8');
const response=()=>({setHeader(){},status(code){this.code=code;return this;},json(body){this.body=body;return this;}});

test('Master15: exclusive boundary keeps exact second and civil month across process timezones',()=>{
 const module=new URL('../public/season-schedule.js',import.meta.url).href;
 for(const [at,label] of [['2026-11-01T03:00:00Z','01/11/2026 às 00h00'],['2028-03-01T03:00:00Z','01/03/2028 às 00h00']]){
  const s={status:'active',schedule_verified:true,deadline_exclusive:true,scheduled_end_at:at};
  const expected=`Virada automática em ${label} (Brasília) — limite exclusivo`;
  const code=`import{seasonDeadline}from ${JSON.stringify(module)};console.log(seasonDeadline(${JSON.stringify(s)}));`;
  for(const TZ of ['UTC','Asia/Tokyo','America/Sao_Paulo'])assert.equal(execFileSync(process.execPath,['--input-type=module','-e',code],{env:{...process.env,TZ},encoding:'utf8'}).trim(),expected);
  assert.equal(seasonCountdown(s,Date.parse(at)-1),'0d 00h 00m 01s');
  assert.equal(seasonCountdown(s,Date.parse(at)),'Prazo encerrado — aguardando confirmação');
  assert.equal(s.status,'active');
 }
 assert.equal(seasonDeadline({status:'active',schedule_verified:true,scheduled_end_at:'2026-11-01T03:00:30Z',deadline_exclusive:true}),'Virada automática em 01/11/2026 às 00h00 (Brasília) — limite exclusivo');
});

test('Master15: catalog24 preserves historical6; probabilities, two-item kits and verified IDs',()=>{
 assert.equal(original.rewards.length,6);assert.equal(rewardCatalog.rewards.length,24);
 assert.deepEqual(rarityChances,RARITY_WEIGHTS);validateRewardCatalog(rewardCatalog);
 assert.notEqual(rewardCatalog.version,original.version);
 const sizes={common:6,uncommon:6,rare:6,epic:5,legendary:1};
 for(const [rarity,size] of Object.entries(sizes)){
  const rows=rewardCatalog.rewards.filter(r=>r.rarity===rarity);assert.equal(rows.length,size);
  assert.ok(Math.abs(rows.reduce((n,r)=>n+rewardProbability(rewardCatalog,r),0)-rarityChances[rarity])<1e-10);
 }
 assert.equal(rewardCatalog.rewards.find(r=>r.id==='crowbar').weight,25);
 assert.equal(rewardProbability(rewardCatalog,rewardCatalog.rewards.find(r=>r.id==='crowbar')),11.25);
 const seen={common:0,uncommon:0,rare:0,epic:0,legendary:0};
 for(let i=0;i<100;i++){let n=0;const result=drawReward(rewardCatalog,total=>n++===0?i:total-1);seen[result.rarity]++;assert.ok(result.reward_id);}
 assert.deepEqual(seen,RARITY_WEIGHTS);
 const bad=structuredClone(rewardCatalog);bad.rewards[1].id=bad.rewards[0].id;assert.throws(()=>validateRewardCatalog(bad));
});

test('Master15: permanent wheel and catalogue are presentation only, escaped and accessible',async()=>{
 const wheel=wheelPreview();assert.match(wheel,/data-reward-wheel/);assert.match(wheel,/aria-label/);assert.match(wheel,/45%/);
 assert.equal(rewardRotation('common'),279);assert.ok(Math.abs(rewardRotation('epic')-10.8)<1e-10);assert.equal(rewardRotation('unknown'),null);
 assert.doesNotMatch(wheel,/random|request_id|fetch|onclick/);
 const css=await source('public/rewards.css');assert.match(css,/#827b87 0 45%,#237b61 45% 75%,#316bb4 75% 95%,#8d43c1 95% 99%,#d6ac45 99% 100%/);
 const html=catalogMarkup(rewardCatalog);assert.equal((html.match(/class="reward-item"/g)||[]).length,24);assert.match(html,/11,25%/);
 const malicious=structuredClone(rewardCatalog);malicious.rewards[0].name='<script>alert(1)</script>';assert.doesNotMatch(catalogMarkup(malicious),/<script>/);
 assert.match(historyMarkup([{season_name:'T1',eligibility:{reason:'season_open'}}]),/Em andamento/);
 assert.match(historyMarkup([{season_name:'T1',eligibility:{reason:'eligible'}}]),/Campeão certificado · aguardando sorteio/);
 assert.doesNotMatch(publicRewards({draws:[{season_name:'T1',character_name:'Vida',rarity:'rare',delivery_state:'uncertain',operator_id:'PRIVATE-OPERATOR'}]}),/incerta|PRIVATE-OPERATOR|Entrega pendente/);
 const admin=await source('public/admin.html');for(const action of ['data-action-reset-baseline','data-action-open-close-modal','data-new-season-form','data-close-modal'])assert.ok(!admin.includes(action));
 assert.match(admin,/data-rename-season-form/);assert.match(admin,/LÍDER PROVISÓRIO/);
 const js=await source('public/admin-rewards.js');assert.match(js,/duration:9500/);assert.match(js,/prefers-reduced-motion/);assert.match(js,/await animate\(persisted\)/);
});

test('Master15: telemetry separates fresh collection, inferred SFTP, public server and point-in-time ACL proof',()=>{
 const health={contract:'collection-health-v1',state:'healthy',last_success_at:'2026-10-27T12:00:00Z',server_time:'2026-10-27T12:01:00Z',latest_attempt_status:'success',consecutive_failures:0};
 const server={online:true,players:2,checkedAt:'2026-10-27T12:00:00Z',serverTime:'2026-10-27T12:01:00Z',validUntil:'2026-10-27T12:02:00Z'};
 const ops={contract:'admin-operations-v1',checked_at:'2026-10-27T12:01:00Z',private_tables_rls:true,private_tables_denied:true,private_rpcs_denied:true,clock_private:true};
 let cards=telemetryCards({health,server,operations:ops});assert.equal(cards[0].tone,'good');assert.equal(cards[1].tone,'neutral');assert.match(cards[1].detail,/Não é teste/);assert.equal(cards[2].tone,'good');assert.match(cards[3].detail,/Não é monitoramento contínuo/);
 cards=telemetryCards({health,server,elapsed:121000});assert.equal(cards[0].tone,'neutral');assert.equal(cards[2].tone,'neutral');assert.equal(cards[3].tone,'neutral');
 assert.equal(telemetryCards({health,operations:{...ops,private_rpcs_denied:false}})[3].tone,'warning');
 assert.equal(telemetryCards()[0].title,'Não verificado nesta consulta');
});

test('Master15 SQL/API: private delivery remains behind Admin; anonymous DTO has exact allowlist',async()=>{
 const db=await createMonthlyTestDb({rewards:true}),originalFetch=globalThis.fetch;
 const keys=['SUPABASE_URL','SUPABASE_PUBLISHABLE_KEY','SUPABASE_SERVICE_ROLE_KEY','ADMIN_EMAIL','COMPETITION_RULES_VERSION','LIFE_CONTRACT_VERSION'];
 const before=Object.fromEntries(keys.map(k=>[k,process.env[k]]));
 try{
  Object.assign(process.env,{SUPABASE_URL:'https://fixture.invalid',SUPABASE_PUBLISHABLE_KEY:'fixture',SUPABASE_SERVICE_ROLE_KEY:'fixture',ADMIN_EMAIL:'admin@fixture.invalid'});delete process.env.COMPETITION_RULES_VERSION;delete process.env.LIFE_CONTRACT_VERSION;
  globalThis.fetch=async(input,options={})=>{
   const url=new URL(input);assert.equal(url.host,'fixture.invalid');
   if(url.pathname==='/auth/v1/user')return options.headers.Authorization==='Bearer valid-admin'?Response.json({id:'f0000000-0000-4000-8000-000000000009',email:'admin@fixture.invalid'}):options.headers.Authorization==='Bearer common'?Response.json({id:'f0000000-0000-4000-8000-000000000008',email:'common@fixture.invalid'}):Response.json({}, {status:401});
   const name=url.pathname.split('/').at(-1);assert.match(name,/^get_(public|service)_/);
   const args=JSON.parse(options.body||'{}'),placeholders=Object.keys(args).map((k,i)=>k+' => $'+(i+1)).join(',');
   const set=(await db.query('select proretset from pg_proc where oid=to_regproc($1)',[name])).rows[0].proretset;
   const result=await db.query(set?'select * from '+name+'('+placeholders+')':'select '+name+'('+placeholders+') data',Object.values(args));
   return Response.json(set?result.rows:result.rows[0].data);
  };
  for(const token of [null,'invalid','common']){
   for(const handler of [adminApi,rewardsApi]){const res=response();await handler({method:'GET',query:{view:'admin'},headers:token?{authorization:'Bearer '+token}:{}},res);assert.equal(res.code,403);}
  }
  await db.query('select activate_product14_v2()');
  const res=response();await adminApi({method:'GET',headers:{authorization:'Bearer valid-admin'}},res);assert.equal(res.code,200);assert.equal(res.body.operations.private_rpcs_denied,true);assert.equal(res.body.operations.life_enabled,false);
  const auditRead=response();await adminApi({method:'GET',query:{view:'audit',limit:'1'},headers:{authorization:'Bearer valid-admin'}},auditRead);assert.equal(auditRead.code,200);assert.equal(auditRead.body.contract,'admin-audit-v1');
  for(const before of ['0','-1','1;select 1','9223372036854775808']){const invalid=response();await adminApi({method:'GET',query:{view:'audit',before},headers:{authorization:'Bearer valid-admin'}},invalid);assert.equal(invalid.code,400);}
  for(const token of ['invalid','common']){const denied=response();await adminApi({method:'GET',query:{view:'audit'},headers:{authorization:'Bearer '+token}},denied);assert.equal(denied.code,403);}
  for(const action of ['reset_baseline','close_season','start_season']){
   const res=response();await adminApi({method:'POST',headers:{authorization:'Bearer valid-admin'},body:{action,payload:{season_id:firstSeason,name:'Nome válido',slug:'nome-valido'}}},res);assert.equal(res.code,409);
  }
  const catalogs=(await db.query('select version,definition,active from reward_catalogs_v1 order by version')).rows;assert.deepEqual(catalogs[0].definition,original);assert.equal(catalogs[0].active,false);assert.deepEqual(catalogs[1].definition,rewardCatalog);
  const winner=await createRewardWinner(db);await db.query('select draw_season_reward_v1($1,$2,$3,$4,$5,$6,$7,$8)',[firstSeason,rewardCatalog.version,'rare','workshop-kit','f0000000-0000-4000-8000-000000000010','f0000000-0000-4000-8000-000000000009',winner.life,'a'.repeat(64)]);
  const anonymous=response();await rewardsApi({method:'GET',headers:{},query:{}},anonymous);assert.equal(anonymous.code,200);assert.deepEqual(Object.keys(anonymous.body.draws[0]).sort(),['season_number','season_name','character_name','steam_username','reward_name','rarity','drawn_at'].sort());
  const privateRead=response();await rewardsApi({method:'GET',query:{view:'admin'},headers:{authorization:'Bearer valid-admin'}},privateRead);assert.equal(privateRead.code,200);assert.equal(privateRead.body.seasons.find(s=>s.draw)?.draw.delivery_state,'pending');
 }finally{globalThis.fetch=originalFetch;for(const key of keys){if(before[key]===undefined)delete process.env[key];else process.env[key]=before[key];}await db.close();}
});
