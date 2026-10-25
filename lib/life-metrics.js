export const metricUnits={
 kills_total:'count',kills_firearm:'count',kills_melee:'count',kills_vehicle:'count',kills_axe:'count',
 kills_blunt:'count',kills_small_blunt:'count',kills_long_blade:'count',kills_small_blade:'count',
 kills_spear:'count',kills_unarmed:'count',kills_other:'count',played_seconds:'seconds',
 survival_world_days:'world_days',distance_total_m:'meters',distance_walked_m:'meters',distance_vehicle_m:'meters',
};
export const archiveMetrics=['best_season_kills_total','best_season_kills_firearm','best_season_kills_melee','best_season_kills_vehicle','seasons_completed_alive','official_wins','solo_official_wins'];
export function verifiedMetrics(metrics={}) {
 const result={};
 for(const [key,record] of Object.entries(metrics)) {
   if(!Object.hasOwn(metricUnits,key)||!record||record.validated!==true||record.scope!=='life'||record.unit!==metricUnits[key]) continue;
   if(typeof record.value!=='number'||!Number.isFinite(record.value)||record.value<0||record.value>31536000000) continue;
   if(metricUnits[key]==='count'&&(!Number.isInteger(record.value)||record.value>2000000000)) continue;
   result[key]=record.value;
 }
 return result;
}
