import { achievementCatalog } from '../public/achievements-catalog.js';
import { verifiedMetrics } from './life-metrics.js';
export function evaluateAchievements(evidence) {
 if(evidence?.identity_status!=='verified_source_life') return [];
 const values=verifiedMetrics(evidence.metrics);
 // Arquivos só entram por consulta de backend; nunca pelo corpo de um pedido público.
 Object.assign(values,evidence.trusted_archive||{});
 if(typeof evidence.alive==='boolean') values.alive=evidence.alive?1:0;
 const categories=['kills_axe','kills_blunt','kills_small_blunt','kills_long_blade','kills_small_blade','kills_spear','kills_unarmed','kills_firearm','kills_vehicle','kills_other'];
 if(categories.every(k=>Object.hasOwn(values,k))) values.categories_with_100_kills=categories.filter(k=>values[k]>=100).length;
 return achievementCatalog.filter(a=>a.criteria.every(r=>typeof values[r.metric]==='number'&&Number.isFinite(values[r.metric])&&(r.op==='eq'?
   values[r.metric]===r.value&&(r.metric==='alive'||evidence.metrics?.[r.metric]?.coverage==='complete_life')
   :values[r.metric]>=r.value))).map(a=>a.id);
}
