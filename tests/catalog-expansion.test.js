import test from 'node:test';
import assert from 'node:assert/strict';
import {prepareExpandedCatalog} from '../lib/reward-catalog-expansion.js';
import {rewardCatalog} from '../lib/reward-catalog.js';
import {itemAssets} from '../public/roulette-item-assets.js';
test('catalog36 preparation requires twelve explicit approvals, immutable24, verified assets and complete invariants',()=>{
 const current=structuredClone(rewardCatalog),before=structuredClone(current);
 const candidates=current.rewards.slice(0,12).map((r,n)=>({...structuredClone(r),id:'SYNTHETIC-ONLY-'+n}));
 const approvalHashes=Object.fromEntries(candidates.map(r=>[r.id,'a'.repeat(64)]));
 const args={current,candidates,version:'ISOLATED-EXPANSION-NOT-ACTIVE',approvalHashes,verifiedAssets:itemAssets};
 const draft=prepareExpandedCatalog(args);assert.equal(draft.rewards.length,36);assert.deepEqual(draft.rewards.slice(0,24),before.rewards);assert.deepEqual(current,before);
 assert.equal('active' in draft,false);
 for(const change of [a=>a.candidates.pop(),a=>delete a.approvalHashes[a.candidates[0].id],a=>a.candidates[0].id=a.current.rewards[0].id,
  a=>a.candidates[0].items[0].kind='vehicle',a=>a.candidates[0].weight=0,a=>a.verifiedAssets={},a=>a.version=a.current.version]){
  const bad=structuredClone(args);change(bad);assert.throws(()=>prepareExpandedCatalog(bad));
 }
});
