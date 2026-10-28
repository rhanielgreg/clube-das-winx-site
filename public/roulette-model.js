// Presentation and local demonstration only. No transport, identity or persistence.
export const RARITY_CHANCES=Object.freeze({common:45,uncommon:30,rare:20,epic:4,legendary:1});
const colors={common:'#a6a2a6',uncommon:'#16866a',rare:'#286fbc',epic:'#9d40d7',legendary:'#eebd38'};
let boundary=0;
export const WHEEL_SECTORS=Object.freeze(Object.entries(RARITY_CHANCES).map(([rarity,percent])=>{
 const start=boundary;boundary+=percent*36; // integer tenths of one degree
 return Object.freeze({rarity,percent,start:start/10,end:boundary/10,center:(start+boundary)/20,color:colors[rarity]});
}));
export const normalizedAngle=angle=>((angle%360)+360)%360;
export function rewardRotation(rarity){const sector=WHEEL_SECTORS.find(s=>s.rarity===rarity);return sector?normalizedAngle(360-sector.center):null;}
export function stopRotation(rarity,from=0,turns=7){
 const target=rewardRotation(rarity);
 if(target===null||!Number.isFinite(from)||!Number.isSafeInteger(turns)||turns<1||turns>20)throw Error('Geometria de giro inválida.');
 return from+turns*360+normalizedAngle(target-normalizedAngle(from));
}
export function rarityAtPointer(rotation){
 if(!Number.isFinite(rotation))return null;
 const angle=normalizedAngle(-rotation);
 return WHEEL_SECTORS.find(s=>angle>=s.start&&angle<s.end)?.rarity??null;
}
export const wheelGradient=()=>`conic-gradient(from 0deg,${WHEEL_SECTORS.map(s=>`${s.color} ${s.start}deg ${s.end}deg`).join(',')})`;
export function localRandomInt(limit){
 if(!Number.isSafeInteger(limit)||limit<1||limit>0x7fffffff)throw Error('Peso local inválido.');
 const cutoff=Math.floor(0x100000000/limit)*limit,buffer=new Uint32Array(1);
 let value;do{globalThis.crypto.getRandomValues(buffer);value=buffer[0];}while(value>=cutoff);
 return value%limit;
}
function weighted(rows,random){
 const sum=rows.reduce((n,r)=>n+r.weight,0);
 if(!Number.isSafeInteger(sum)||sum<1||sum>0x7fffffff)throw Error('Catálogo demonstrativo inválido.');
 let value=random(sum);
 if(!Number.isSafeInteger(value)||value<0||value>=sum)throw Error('Resultado local inválido.');
 for(const row of rows){if(value<row.weight)return row;value-=row.weight;}
 throw Error('Nenhum prêmio demonstrativo disponível.');
}
export function demoCatalogReady(catalog){
 return typeof catalog?.version==='string'&&Array.isArray(catalog.rewards)&&catalog.rewards.length>0&&
  new Set(catalog.rewards.map(r=>r.id)).size===catalog.rewards.length&&
  catalog.rewards.every(r=>r.verified===true&&Object.hasOwn(RARITY_CHANCES,r.rarity)&&Number.isSafeInteger(r.weight)&&r.weight>0&&r.weight<=1000000&&
   typeof r.id==='string'&&typeof r.name==='string'&&Array.isArray(r.items)&&r.items.length>0&&r.items.every(i=>i.kind==='item'&&Number.isSafeInteger(i.quantity)&&i.quantity>0&&typeof i.script_id==='string'))&&
  Object.keys(RARITY_CHANCES).every(rarity=>catalog.rewards.some(r=>r.rarity===rarity));
}
export function chooseDemonstration(catalog,{forced=null,random=localRandomInt}={}){
 if(!demoCatalogReady(catalog)||forced!==null&&!Object.hasOwn(RARITY_CHANCES,forced))throw Error('Catálogo ou raridade de demonstração indisponível.');
 const rarity=forced??weighted(Object.entries(RARITY_CHANCES).map(([id,weight])=>({id,weight})),random).id;
 const reward=weighted(catalog.rewards.filter(r=>r.rarity===rarity),random);
 return {source:'demo',directed:forced!==null,rarity,catalog_version:catalog.version,reward:structuredClone(reward)};
}
