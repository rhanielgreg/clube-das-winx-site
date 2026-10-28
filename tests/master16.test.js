import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createMonthlyTestDb,firstSeason} from './fixtures/monthly-db.js';
import {rewardCatalog} from '../lib/reward-catalog.js';
import {filterRewards,catalogMarkup,wheelPreview,historyMarkup} from '../public/reward-presentation.js';
import {rankingCsv} from '../public/admin-export.js';
import {telemetryCards} from '../public/admin-shell.js';

test('Master16: CSV preserves snapshot order, nine legacy columns, nulls, accents and formula safety',()=>{
 const data={activeSeason:{name:'Temporada 1'},checked_at:'2026-10-28T04:00:00Z',ranking:[
  {steam_username:'=HYPERLINK("x")',character_name:'João; "A"',kills_total:42,survival_seconds:null,alive:true},
  {steam_username:' +SUM(1)',character_name:'Ana',survival_seconds:0,alive:null}]};
 const before=structuredClone(data),csv=rankingCsv(data),rows=csv.split('\r\n');
 assert.equal(csv.charCodeAt(0),0xfeff);assert.equal(rows.length,3);
 assert.match(rows[0],/^\ufeff"Posicao";"Usuario_Steam";"Personagem";"Kills_Total";"Kills_Arma";"Kills_Melee";"Tempo_Segundos";"Estado";"Ultima_Atualizacao";/);
 assert.match(rows[1],/"'=HYPERLINK\(""x""\)"/);assert.match(rows[1],/João; ""A""/);
 assert.match(rows[1],/"42";"";"";"";"VIVO"/);assert.match(rows[1],/"ULTIMA_OBSERVACAO"$/);
 assert.match(rows[2],/"' \+SUM\(1\)"/);assert.match(rows[2],/"0";"DESCONHECIDO"/);assert.deepEqual(data,before);
});

test('Master16: catalog filters use accent-insensitive search and stable original order without changing odds',()=>{
 const before=structuredClone(rewardCatalog);
 assert.equal(filterRewards(rewardCatalog).length,24);
 assert.equal(filterRewards(rewardCatalog,{rarity:'epic'}).length,5);
 assert.equal(filterRewards(rewardCatalog,{search:'FACAO'})[0].name,'Facão');
 assert.equal(filterRewards(rewardCatalog,{rarity:'common',search:'katana'}).length,0);
 assert.match(catalogMarkup(rewardCatalog,{search:'no-such-item'}),/Nenhum prêmio/);
 assert.equal((catalogMarkup(rewardCatalog,{rarity:'common'}).match(/class="reward-item"/g)||[]).length,6);
 assert.match(wheelPreview(),/Épica <strong>4%/);assert.match(wheelPreview(),/Lendária <strong>1%/);
 const history=historyMarkup([{season_name:'T1',eligibility:{reason:'season_open'}}]);
 assert.match(history,/Nenhum sorteio oficial persistido/);assert.match(history,/Temporadas sem sorteio/);
 assert.deepEqual(rewardCatalog,before);
});

test('Master16: private ACL proof expires independently, rejects missing and future timestamps',()=>{
 const operations={contract:'admin-operations-v1',checked_at:'2026-10-28T04:00:00Z',private_tables_rls:true,private_tables_denied:true,private_rpcs_denied:true,clock_private:true};
 const card=options=>telemetryCards({operations,...options})[3];
 assert.equal(card({}).tone,'good');assert.equal(card({operationsElapsed:90001}).tone,'neutral');
 assert.equal(card({checkedAt:'2026-10-28T04:02:00Z'}).tone,'neutral');
 assert.equal(card({checkedAt:'2026-10-28T03:58:00Z'}).tone,'neutral');
 assert.equal(card({operations:{...operations,checked_at:null}}).tone,'neutral');
 assert.equal(card({operations:{...operations,clock_private:false}}).tone,'warning');
});

test('Master16 SQL: audit RPC is bounded, private, sanitized, paginated and strictly read-only',async()=>{
 const db=await createMonthlyTestDb({rewards:true});
 try{
  await db.query('select activate_product14_v2()');
  const operator='f0000000-0000-4000-8000-000000000009';
  for(const reason of ['Justificativa operacional verificada.','senha PRIVATE-SECRET','Contato private@example.invalid','76561198000000000']){
   await db.query('insert into season_admin_audit_v2(season_id,operator_id,action,reason,previous_name,new_name) values($1,$2,\'rename\',$3,\'Anterior\',\'Atual\')',[firstSeason,operator,reason]);
  }
  const before=(await db.query('select count(*) n from season_admin_audit_v2')).rows[0].n;
  const read=async(before=null,limit=2)=>(await db.query('select get_service_admin_audit_v1($1,$2) data',[before,limit])).rows[0].data;
  const page1=await read();assert.equal(page1.contract,'admin-audit-v1');assert.equal(page1.events.length,2);assert.ok(page1.next_cursor);
  const page2=await read(page1.next_cursor);assert.equal(page2.events.length,2);assert.equal(page2.next_cursor,null);
  assert.equal(new Set([...page1.events,...page2.events].map(e=>e.cursor)).size,4);
  assert.doesNotMatch(JSON.stringify([page1,page2]),/PRIVATE-SECRET|private@example|76561198000000000|f0000000-/);
  assert.equal(page2.events[1].reason,'Justificativa operacional verificada.');
  assert.equal(page1.summary.active_medals,28);assert.equal(page1.summary.native_lives,0);assert.equal(page1.summary.medal_unlocks,0);
  for(const role of ['anon','authenticated']){
   await assert.rejects(db.exec('set role '+role+';select get_service_admin_audit_v1()'));await db.exec('reset role');
   await assert.rejects(db.exec('set role '+role+';select * from season_admin_audit_v2'));await db.exec('reset role');
  }
  await db.exec('set role service_role;begin read only;select get_service_admin_audit_v1();commit;reset role');
  assert.equal((await db.query('select count(*) n from season_admin_audit_v2')).rows[0].n,before);
 }finally{await db.close();}
});

test('Master16: authenticated refresh, history navigation and safe links are wired to actual controls',async()=>{
 const source=path=>readFile(new URL('../'+path,import.meta.url),'utf8');
 const shell=await source('public/admin-shell.js'),admin=await source('public/admin.js');
 assert.match(shell,/history.pushState/);assert.match(shell,/addEventListener\('popstate'/);assert.match(shell,/addEventListener\('hashchange'/);
 assert.match(shell,/callbacks.refreshAdmin/);assert.match(admin,/refreshRewards:false/);assert.match(admin,/clearAdminOverview\(\)/);
 assert.match(await source('public/ranking.html'),/id="medalhas"/);
 assert.doesNotMatch(await source('public/admin.html'),/Sem recompensa descrita|<th>#<\/th>/);
});
