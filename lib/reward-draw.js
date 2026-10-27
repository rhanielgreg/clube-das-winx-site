import { randomInt } from 'node:crypto';

export const RARITY_WEIGHTS = Object.freeze({ common:45, uncommon:30, rare:20, epic:4, legendary:1 });
export function validateRewardCatalog(catalog,{requireVerified=true}={}) {
  if(!catalog||typeof catalog.version!=='string'||!Array.isArray(catalog.rewards)||!catalog.rewards.length)throw Error('Catálogo indisponível.');
  const ids=new Set();
  for(const reward of catalog.rewards){
    if(!reward||!Object.hasOwn(RARITY_WEIGHTS,reward.rarity)||typeof reward.id!=='string'||ids.has(reward.id)
      ||!Number.isSafeInteger(reward.weight)||reward.weight<1||reward.weight>1000000
      ||!Array.isArray(reward.items)||reward.items.length!==(reward.rarity==='rare'?2:1))throw Error('Catálogo inválido.');
    ids.add(reward.id);
    for(const item of reward.items)if(!/^[A-Za-z][\w]*\.[A-Za-z][\w]*$/.test(item.script_id||'')
      ||!Number.isSafeInteger(item.quantity)||item.quantity<1||item.quantity>100||item.kind!=='item')throw Error('Componente não permitido.');
    if(reward.rarity==='legendary'&&(reward.items[0].script_id!=='Base.Katana'||reward.items[0].quantity!==1))throw Error('Lendária exige uma katana.');
    if(reward.rarity==='epic'&&reward.items.some(item=>/sledgehammer/i.test(item.script_id)))throw Error('Marreta não é prêmio épico.');
    if(requireVerified&&(reward.verified!==true||!/^\d+\.\d+\.\d+$/.test(reward.server_build||'')
      ||!/^[a-f0-9]{64}$/.test(reward.evidence_sha256||'')||reward.delivery_method!=='manual_verified'))throw Error('Recompensa sem comprovação técnica.');
  }
  for(const rarity of Object.keys(RARITY_WEIGHTS))if(!catalog.rewards.some(reward=>reward.rarity===rarity&&(!requireVerified||reward.verified)))throw Error('Todas as cinco raridades precisam de recompensas válidas.');
  return catalog;
}
export function weightedChoice(rows,random=randomInt) {
  const total=rows.reduce((sum,row)=>sum+row.weight,0);
  if(!Number.isSafeInteger(total)||total<1||total>0x7fffffff)throw Error('Pesos inválidos.');
  let value=random(total);
  if(!Number.isSafeInteger(value)||value<0||value>=total)throw Error('Fonte aleatória inválida.');
  for(const row of rows){if(value<row.weight)return row;value-=row.weight;}
  throw Error('Seleção inválida.');
}
export function drawReward(catalog,random=randomInt) {
  validateRewardCatalog(catalog);
  const rarity=weightedChoice(Object.entries(RARITY_WEIGHTS).map(([id,weight])=>({id,weight})),random).id;
  const reward=weightedChoice(catalog.rewards.filter(row=>row.rarity===rarity),random);
  return {catalog_version:catalog.version,rarity,reward_id:reward.id};
}
