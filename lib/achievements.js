import { achievementCatalog } from '../public/legacy-achievements-catalog.js';
import { verifiedMetrics,archiveMetrics } from './life-metrics.js';
import { achievementCatalog as medals } from '../public/achievements-catalog.js';
export function medalProgress(evidence) {
 if(evidence?.identity_status!=='verified_source_life'||evidence.catalog_version!=='medals-v2')return {};
 const active=Date.parse(evidence.activation_at||'');if(!Number.isFinite(active))return {};
 const current=verifiedMetrics(evidence.metrics),values={};
 for(const [key,baseline] of Object.entries(evidence.baselines||{})){
  if(!['kills_total','kills_firearm','kills_melee','played_seconds','distance_total_m'].includes(key)||!Object.hasOwn(current,key))continue;
  if(baseline.valid!==true||typeof baseline.value!=='number'||!Number.isFinite(baseline.value)||baseline.value<0||current[key]<baseline.value
   ||Date.parse(baseline.observed_at||'')<active||!Number.isFinite(Date.parse(baseline.observed_at||'')))continue;
  if(!/^[a-f0-9]{64}$/.test(baseline.source_sha256||''))continue;
  if(!Number.isFinite(Date.parse(evidence.metrics[key].observed_at||''))||Date.parse(evidence.metrics[key].observed_at)<Date.parse(baseline.observed_at))continue;
  values[key]=current[key]-baseline.value;
 }
 if(typeof evidence.alive==='boolean')values.alive=evidence.alive?1:0;
 const candidates=(evidence.official_events||[]).filter(r=>r.rules_version==='winx-v2'&&r.certified===true&&r.profile_id===evidence.profile_id
  &&Number.isSafeInteger(r.season_number)&&r.season_number>0&&Date.parse(r.ends_at)>active&&Date.parse(r.closed_at)>=active);
 // Repeated representations cannot count as two official seasons.
 const rows=candidates.filter((r,i)=>candidates.findIndex(other=>other.season_number===r.season_number)===i);
 values.seasons_completed_alive=rows.filter(r=>r.alive_at_close===true).length;
 values.official_top3=rows.filter(r=>r.alive_at_close===true&&r.rank_position>0&&r.rank_position<=3).length;
 const wins=rows.filter(r=>r.outcome==='champion'&&r.winner_profile_id===evidence.profile_id);
 values.official_wins=wins.length;
 values.solo_official_wins=wins.filter(r=>r.living_count===1&&r.participant_count>1).length;
 values.zero_kill_official_wins=wins.filter(r=>r.kills_total===0&&r.living_count>1&&r.won_on_played_time===true).length;
 let streak=0,best=0,previous=-Infinity;
 for(const r of wins.sort((a,b)=>a.season_number-b.season_number)){streak=r.season_number===previous+1?streak+1:1;previous=r.season_number;best=Math.max(best,streak);}
 values.consecutive_official_wins=best;
 return values;
}
export function evaluateMedalsV2(evidence){
 const values=medalProgress(evidence);
 return medals.filter(a=>a.criteria.every(r=>Object.hasOwn(values,r.metric)&&(r.op==='eq'?values[r.metric]===r.value:values[r.metric]>=r.value))).map(a=>a.id);
}
export function evaluateAchievements(evidence) {
 if(evidence?.catalog_version==='medals-v2')return evaluateMedalsV2(evidence);
 if(evidence?.identity_status!=='verified_source_life') return [];
 const values=verifiedMetrics(evidence.metrics);
 // Arquivos só entram por consulta de backend; nunca pelo corpo de um pedido público.
 for(const key of archiveMetrics) {
  const value=evidence.trusted_archive?.[key];
  if(Number.isSafeInteger(value)&&value>=0)values[key]=value;
 }
 if(typeof evidence.alive==='boolean') values.alive=evidence.alive?1:0;
 const categories=['kills_axe','kills_blunt','kills_small_blunt','kills_long_blade','kills_small_blade','kills_spear','kills_unarmed','kills_firearm','kills_vehicle','kills_other'];
 if(categories.every(k=>Object.hasOwn(values,k))) values.categories_with_100_kills=categories.filter(k=>values[k]>=100).length;
 return achievementCatalog.filter(a=>{
  if(a.criteria.some(r=>r.op==='eq'&&r.metric!=='alive')) {
   const at=Date.parse(evidence.last_observed_at||'');
   if(!Number.isFinite(at)||!a.criteria.every(r=>Date.parse(evidence.metrics?.[r.metric]?.observed_at||'')===at))return false;
  }
  return a.criteria.every(r=>typeof values[r.metric]==='number'&&Number.isFinite(values[r.metric])&&(r.op==='eq'?
   values[r.metric]===r.value&&(r.metric==='alive'||evidence.metrics?.[r.metric]?.coverage==='complete_life')
   :values[r.metric]>=r.value));
 }).map(a=>a.id);
}
