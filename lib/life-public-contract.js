import { achievementCatalog } from '../public/legacy-achievements-catalog.js';
import { metricUnits } from './life-metrics.js';
import { UUID } from '../public/contracts.js';
const definitions=new Map(achievementCatalog.map(a=>[a.id,a]));
export function validatedLifeResult(data) {
 if(!data||data.catalog_count!==100||typeof data.identity_verified!=='boolean'||!Array.isArray(data.catalog)||data.catalog.length!==100
   ||new Set(data.catalog.map(a=>a?.id)).size!==100||!Array.isArray(data.unlocks)||data.total_unlocked!==data.unlocks.length)return null;
 for(const item of data.catalog){
  const expected=definitions.get(item?.id);
  if(!expected||item.version!==1||!Array.isArray(item.criteria)||item.criteria.length!==expected.criteria.length)return null;
  if(item.criteria.some((r,i)=>r.metric!==expected.criteria[i].metric||r.op!==expected.criteria[i].op||r.value!==expected.criteria[i].value))return null;
 }
 const unlocks=data.unlocks.map(a=>({achievement_id:a?.achievement_id,observed_at:a?.observed_at,recognized_at:a?.recognized_at,occurred_at:a?.occurred_at??null,recognition_kind:a?.recognition_kind}));
 if(new Set(unlocks.map(a=>a.achievement_id)).size!==unlocks.length||unlocks.some(a=>!definitions.has(a.achievement_id))||!data.identity_verified&&unlocks.length)return null;
 const life_metrics={};
 for(const [key,record] of Object.entries(data.life_metrics||{})){
  if(Object.hasOwn(metricUnits,key)&&record?.unit===metricUnits[key]&&typeof record.value==='number'&&Number.isFinite(record.value)&&record.value>=0)life_metrics[key]={value:record.value,unit:record.unit};
 }
 const season_records={};
 for(const key of ['best_season_kills_total','best_season_kills_firearm','best_season_kills_melee','best_season_kills_vehicle'])if(typeof data.season_records?.[key]==='number'&&Number.isFinite(data.season_records[key])&&data.season_records[key]>=0)season_records[key]=data.season_records[key];
 return {catalog_count:100,identity_verified:data.identity_verified,total_unlocked:unlocks.length,catalog:achievementCatalog,unlocks,life_metrics,season_records,
   last_observed_at:typeof data.last_observed_at==='string'&&Number.isFinite(Date.parse(data.last_observed_at))?data.last_observed_at:null,
   season_history:Array.isArray(data.season_history)?data.season_history.filter(r=>r&&['champion','apocalypse'].includes(r.outcome)).map(r=>({season_name:typeof r.season_name==='string'?r.season_name:'Temporada',outcome:r.outcome,rank_position:Number.isInteger(r.rank_position)&&r.rank_position>0?r.rank_position:null,kills_total:typeof r.kills_total==='number'&&Number.isFinite(r.kills_total)&&r.kills_total>=0?r.kills_total:null,alive_at_close:r.alive_at_close===true,closed_at:typeof r.closed_at==='string'&&Number.isFinite(Date.parse(r.closed_at))?r.closed_at:null})):[],
   available_metrics:Array.isArray(data.available_metrics)?data.available_metrics.filter(k=>Object.hasOwn(metricUnits,k)):[],
   complete_metrics:Array.isArray(data.complete_metrics)?data.complete_metrics.filter(k=>Object.hasOwn(metricUnits,k)):[],
   alive_known:data.alive_known===true,archive_available:data.archive_available===true,
   life_history:Array.isArray(data.life_history)?data.life_history.filter(p=>p&&typeof p.observed_at==='string'&&Number.isFinite(Date.parse(p.observed_at))).slice(-90).map(p=>({observed_at:p.observed_at,kills_total:typeof p.kills_total==='number'&&Number.isFinite(p.kills_total)&&p.kills_total>=0?p.kills_total:null,survival_seconds:typeof p.survival_seconds==='number'&&Number.isFinite(p.survival_seconds)&&p.survival_seconds>=0?p.survival_seconds:null,alive:typeof p.alive==='boolean'?p.alive:null})):[],
   related_lives:Array.isArray(data.related_lives)?data.related_lives.filter(r=>UUID.test(r?.profile_id||'')).map(r=>({profile_id:r.profile_id,character_name:typeof r.character_name==='string'?r.character_name:'Nome não informado',alive:typeof r.alive==='boolean'?r.alive:null})):[]};
}
