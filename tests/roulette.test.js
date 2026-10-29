import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {WHEEL_SECTORS,RARITY_CHANCES,rewardRotation,stopRotation,rarityAtPointer,wheelGradient,chooseDemonstration,demoCatalogReady} from '../public/roulette-model.js';
import {createSpinSession,bindSpinLifecycle,SPIN_DURATION} from '../public/roulette-spin.js';
import {rouletteMarkup} from '../public/roulette-machine.js';
import {rewardCatalog} from '../lib/reward-catalog.js';
import {RARITY_WEIGHTS} from '../lib/reward-draw.js';

test('roulette: exact cumulative geometry, including 14.4 and 3.6 degree sectors',()=>{
 assert.deepEqual(RARITY_CHANCES,RARITY_WEIGHTS);
 assert.deepEqual(WHEEL_SECTORS.map(s=>[s.start,s.end,s.center]),[[0,162,81],[162,270,216],[270,342,306],[342,356.4,349.2],[356.4,360,358.2]]);
 assert.equal(WHEEL_SECTORS.reduce((n,s)=>n+s.percent,0),100);
 assert.match(wheelGradient(),/#9d40d7 342deg 356.4deg,#eebd38 356.4deg 360deg/);
 for(const s of WHEEL_SECTORS){
  assert.ok(Math.abs((s.end-s.start)-s.percent*3.6)<1e-12);
  for(let from=-720;from<100000;from+=137.123){
   const angle=stopRotation(s.rarity,from);
   assert.equal(rarityAtPointer(angle),s.rarity);
   assert.ok(angle>from+6*360);
   const pointer=(((-angle%360)+360)%360);assert.ok(pointer>s.start&&pointer<s.end);
   assert.ok(Math.abs(pointer-s.center)<1e-9);
  }
 }
 assert.equal(rewardRotation('common'),279);assert.equal(rewardRotation('unknown'),null);
 assert.throws(()=>stopRotation('invalid'));assert.throws(()=>stopRotation('epic',NaN));
});

test('roulette: deterministic rarity tickets reproduce official45/30/20/4/1 and internal item weights',()=>{
 const original=structuredClone(rewardCatalog),totals=Object.fromEntries(Object.keys(RARITY_CHANCES).map(r=>[r,0]));
 for(let ticket=0;ticket<100;ticket++){let call=0;const result=chooseDemonstration(rewardCatalog,{random:total=>call++===0?ticket:total-1});totals[result.rarity]++;assert.equal(result.source,'demo');assert.equal(result.directed,false);assert.ok(result.reward.verified);assert.equal(result.reward.rarity,result.rarity);}
 assert.deepEqual(totals,RARITY_WEIGHTS);
 for(const rarity of Object.keys(RARITY_CHANCES)){
  const rewards=rewardCatalog.rewards.filter(r=>r.rarity===rarity),count={};
  for(let ticket=0;ticket<100;ticket++){const result=chooseDemonstration(rewardCatalog,{forced:rarity,random:()=>ticket});assert.equal(result.directed,true);assert.equal(result.rarity,rarity);count[result.reward.id]=(count[result.reward.id]||0)+1;}
  for(const reward of rewards)assert.equal(count[reward.id],reward.weight);
 }
 assert.deepEqual(rewardCatalog,original);
 assert.equal(demoCatalogReady(null),false);assert.throws(()=>chooseDemonstration(rewardCatalog,{forced:'invented'}));
 const bad=structuredClone(rewardCatalog);bad.rewards[0].verified=false;assert.equal(demoCatalogReady(bad),false);
 assert.throws(()=>chooseDemonstration(rewardCatalog,{random:()=>-1}));
});

test('roulette: one spin at a time, cancel never reveals, late completion cannot overwrite next spin',async()=>{
 const pending=[],finished=[],cancelled=[];
 const spin=createSpinSession({animate:options=>new Promise(resolve=>pending.push({...options,resolve})),onFinish:r=>finished.push(r.rarity),onCancel:r=>cancelled.push(r)});
 const first=spin.play({rarity:'epic'});assert.equal(spin.running,true);assert.equal(pending[0].duration,SPIN_DURATION);
 assert.equal(await spin.play({rarity:'legendary'}),false);assert.equal(pending.length,1);
 spin.cancel('tab_hidden');assert.equal(pending[0].signal.aborted,true);assert.equal(spin.running,false);
 const second=spin.play({rarity:'legendary'});pending[0].resolve();assert.equal(await first,false);assert.equal(spin.running,true);assert.deepEqual(finished,[]);
 pending[1].resolve();assert.equal(await second,true);assert.deepEqual(finished,['legendary']);assert.equal(rarityAtPointer(spin.angle),'legendary');assert.deepEqual(cancelled,['tab_hidden']);
});

test('roulette: repeated visibility/navigation/reload cancellation has no transport capability or leftover reveal',async()=>{
 let reveals=0,animations=0,writes=0;
 const original=globalThis.fetch;globalThis.fetch=async()=>{writes++;throw Error('Transport forbidden');};
 try{
  const spin=createSpinSession({animate:({signal})=>{animations++;return new Promise(resolve=>signal.addEventListener('abort',resolve,{once:true}));},onFinish:()=>reveals++});
  for(const reason of ['visibility','navigation','mode','pagehide','unload','refresh','destroy']){
   const task=spin.play(chooseDemonstration(rewardCatalog,{forced:'epic',random:()=>0}));spin.cancel(reason);assert.equal(await task,false);assert.equal(spin.running,false);assert.equal(spin.angle,0);
  }
  assert.equal(animations,7);assert.equal(reveals,0);assert.equal(writes,0);
 }finally{globalThis.fetch=original;}
});

test('roulette: reduced motion presents every rarity immediately, with correct result and no animation',async()=>{
 const results=[];const spin=createSpinSession({animate:()=>{throw Error('Animation forbidden');},onFinish:(r,source)=>results.push([r.rarity,source])});
 for(const rarity of Object.keys(RARITY_CHANCES))assert.equal(await spin.play({rarity},{reduced:true}),true);
 assert.deepEqual(results,Object.keys(RARITY_CHANCES).map(r=>[r,'demo']));
 assert.equal(await spin.play({rarity:'legendary'},{source:'official',reduced:true}),true);
 assert.equal(results.at(-1)[1],'official');
});

test('roulette: markup separates official actions, labels directed demonstration and uses honest artwork fallback',async()=>{
 const html=rouletteMarkup({demonstrationFixture:true,catalog:rewardCatalog,current:{season_id:'fixture',season_name:'T1'},reason:'Temporada em andamento'});
 assert.match(html,/role="tablist"/);assert.match(html,/DEMONSTRAÇÃO — SEM VALOR OFICIAL/);assert.match(html,/14,4°/);assert.match(html,/3,6°/);assert.match(html,/data-reward-draw disabled/);assert.match(html,/data-verified-item-icon/);assert.match(html,/Ícone não verificado ou indisponível/);
 const model=await readFile(new URL('../public/roulette-model.js',import.meta.url),'utf8'),machine=await readFile(new URL('../public/roulette-machine.js',import.meta.url),'utf8');
 assert.doesNotMatch(model,/fetch\s*\(|XMLHttpRequest|sendBeacon|localStorage/);assert.doesNotMatch(machine,/fetch\s*\(|XMLHttpRequest|sendBeacon|request_id|randomUUID/);
 assert.match(machine,/bindSpinLifecycle/);assert.match(machine,/MutationObserver/);assert.match(machine,/lifetime.abort\(\)/);
 const controller=await readFile(new URL('../public/admin-rewards.js',import.meta.url),'utf8');
 assert.match(controller,/if\(draw&&machine\?\.mode!=='official'\)return/);
 assert.ok(controller.indexOf('audioContext=machine.releaseAudio()')<controller.indexOf('machine.destroy()'));
 assert.match(controller,/catalog,current,mode,audioContext/);assert.match(machine,/audio=audioContext/);
 assert.ok(controller.indexOf('const data=await request({action,season_id:')<controller.indexOf('await machine.revealOfficial(persisted)'));
 assert.doesNotMatch(controller,/setInterval\(tick/);
 const officialBody=controller.slice(controller.indexOf('const data=await request({action,season_id:'),controller.indexOf('dashboard=data.dashboard'));
 assert.doesNotMatch(officialBody,/forced|rarity|reward_id|reward_snapshot|demo/);
 assert.match(rouletteMarkup({demonstrationFixture:true,catalog:rewardCatalog,current:{eligibility:{life_id:'verified-life',last_observed_at:'2026-10-28T12:00:00Z'}}}),/Conferir identidade e evidência da vida/);
 const bad=structuredClone(rewardCatalog);bad.rewards[0].name='<script>attack</script>';assert.doesNotMatch(rouletteMarkup({demonstrationFixture:true,catalog:bad}),/<script>attack/);
});

test('roulette: real lifecycle listeners abort the animation, never reveal or write, and are disposed',async()=>{
 const document=new EventTarget(),window=new EventTarget(),lifetime=new AbortController();
 let reveals=0,cancellations=0,transports=0;const original=globalThis.fetch;
 globalThis.fetch=async()=>{transports++;throw Error('No transport');};
 try{
  const spin=createSpinSession({animate:({signal})=>new Promise(resolve=>signal.addEventListener('abort',resolve,{once:true})),onFinish:()=>reveals++});
  bindSpinLifecycle({document,window,signal:lifetime.signal,cancel:reason=>{cancellations++;spin.cancel(reason);}});
  for(let i=0;i<3;i++)for(const type of ['visibilitychange','pagehide','beforeunload']){
   const task=spin.play(chooseDemonstration(rewardCatalog,{forced:'legendary',random:()=>0}));
   if(type==='visibilitychange'){
    document.hidden=false;document.dispatchEvent(new Event(type));assert.equal(spin.running,true);
    document.hidden=true;document.dispatchEvent(new Event(type));
   }else window.dispatchEvent(new Event(type));
   assert.equal(await task,false);assert.equal(spin.running,false);
  }
  assert.equal(reveals,0);assert.equal(transports,0);assert.equal(cancellations,9);
  lifetime.abort();document.dispatchEvent(new Event('visibilitychange'));window.dispatchEvent(new Event('pagehide'));
  assert.equal(cancellations,9);
 }finally{globalThis.fetch=original;}
});

test('roulette: animation startup failure releases state for another spin',async()=>{
 let failing=true,errors=0;
 const spin=createSpinSession({animate:async()=>{},onStart:()=>{if(failing)throw Error('Presentation failed');},onError:()=>errors++});
 assert.equal(await spin.play({rarity:'epic'}),false);assert.equal(spin.running,false);assert.equal(errors,1);
 failing=false;assert.equal(await spin.play({rarity:'legendary'}),true);
});
