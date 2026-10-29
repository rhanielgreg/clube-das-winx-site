import {validateRewardCatalog} from './reward-draw.js';
import {addItemCommand} from './rcon-client.js';
// Preparation only. No activation, writes, implicit weights or invented candidates.
export function prepareExpandedCatalog({current,version,candidates,approvalHashes,verifiedAssets}){
 validateRewardCatalog(current);
 if(current.rewards.length!==24||typeof version!=='string'||!version.trim()||version===current.version||candidates?.length!==12)throw Error('Twelve explicitly approved candidates and a new version are required');
 const ids=new Set(current.rewards.map(r=>r.id));
 for(const reward of candidates){
  if(ids.has(reward.id)||!/^[a-f0-9]{64}$/.test(approvalHashes?.[reward.id]||''))throw Error('Individual approval missing or duplicate reward');
  ids.add(reward.id);
  for(const item of reward.items||[]){
   if(verifiedAssets?.[item.script_id]?.verified!==true||verifiedAssets[item.script_id].build!==reward.server_build)throw Error('Exact item artwork/build evidence missing');
   addItemCommand('VALIDATION-ONLY',item);
  }
 }
 const result=structuredClone({version,rewards:[...current.rewards,...candidates]});
 validateRewardCatalog(result);return result;
}
