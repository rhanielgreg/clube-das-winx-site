import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { createPreviewServer } from '../scripts/preview-server.js';

test('prévia usa o frontend real, oferece cenários e rejeita toda escrita', async () => {
  const server=createPreviewServer();
  await new Promise((resolve)=>server.listen(0,'127.0.0.1',resolve));
  const base=`http://127.0.0.1:${server.address().port}`;
  try {
    for (const page of ['/index.html','/ranking','/memorial','/jogador','/admin','/preview/mobile']) assert.equal((await fetch(base+page)).status,200,page);
    const local=await readFile(new URL('../public/index.html',import.meta.url),'utf8');
    assert.equal(await (await fetch(base+'/index.html')).text(),local);
    const ranking=await (await fetch(base+'/api/ranking')).json();
    assert.equal(ranking.demo,true); assert.equal(ranking.ranking.length,3); assert.ok(ranking.graveyard.every((row)=>row.alive===false));
    assert.ok(ranking.ranking.every(row=>row.alive===true));
    const apocalypse=await(await fetch(base+'/api/ranking?scenario=no-champion')).json();
    assert.deepEqual(apocalypse.ranking,[]);assert.equal(apocalypse.seasons[0].outcome,'apocalypse');
    assert.equal(apocalypse.seasons[0].winner_name,null);assert.ok(apocalypse.graveyard.every(row=>row.alive===false));
    const profile=await (await fetch(base+'/api/player?id='+ranking.ranking[0].profile_id)).json();
    assert.equal(profile.history.length,90); assert.equal(profile.history.at(-1).kills_total,profile.profile.kills_total);
    const incomplete = await (await fetch(base+'/api/player?id=20000000-0000-4000-8000-000000000009')).json();
    assert.equal(incomplete.profile.kills_total,null);
    assert.equal(incomplete.profile.survival_seconds,null);
    assert.deepEqual(incomplete.history,[],'ausência de dados não gera coletas artificiais com zero');
    const advanced=await(await fetch(base+'/api/player?id='+ranking.ranking[0].profile_id+'&scenario=advanced')).json();
    assert.equal(advanced.demo,true);assert.equal(advanced.future_metrics_demo,true);
    assert.equal(advanced.profile.kills_vehicle,250);assert.equal(profile.profile.kills_vehicle,undefined);
    assert.equal((await(await fetch(base+'/api/status?scenario=server-offline')).json()).online,false);
    assert.equal((await(await fetch(base+'/api/status?scenario=server-unknown')).json()).online,null);
    const engine=await(await fetch(base+'/api/player?id='+ranking.ranking[0].profile_id+'&scenario=achievements')).json();
    assert.equal(engine.demo,true);assert.equal(engine.achievements_engine_demo,true);
    assert.equal(engine.achievements.catalog_count,100);assert.ok(engine.achievements.total_unlocked>0);
    const repeated=await(await fetch(base+'/api/player?id='+ranking.ranking[0].profile_id+'&scenario=achievements')).json();
    assert.deepEqual(repeated.achievements.unlocks,engine.achievements.unlocks,'persistência PostgreSQL local, sem regenerar datas ou duplicar medalhas');
    assert.equal((await fetch(base+'/conquistas')).status,404,'não existe página global de conquistas');
    assert.equal((await fetch(base+'/api/ranking?scenario=offline')).status,503);
    assert.deepEqual((await (await fetch(base+'/api/ranking?scenario=empty')).json()).ranking,[]);
    assert.equal((await (await fetch(base+'/api/ranking?scenario=stale')).json()).stale,true);
    for (const method of ['POST','PATCH','PUT','DELETE']) assert.equal((await fetch(base+'/api/admin',{method,body:'{}'})).status,405);
    assert.equal((await fetch(base+'/.env')).status,403);
    assert.equal((await fetch(base+'/api/unknown')).status,404);
    assert.equal((await fetch(base+'/api/status?format=image')).headers.get('content-type'),'image/svg+xml; charset=utf-8');
    assert.equal((await (await fetch(base+'/api/config')).json()).admin_enabled,false);
    const adminJs=await (await fetch(base+'/admin.js')).text(); assert.ok(!adminJs.includes('sb_publishable_'));
  } finally { await new Promise((resolve)=>server.close(resolve)); }
});
