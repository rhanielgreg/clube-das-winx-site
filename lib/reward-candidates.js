// Selection supplied by the administrator. Not an active catalog or spawn allowlist.
export const vehicleCandidates=Object.freeze([
 {name:'Mustang Boss 429 (1969)',workshop_id:'3756938756',mod_id:'69fordMustang',vehicle_script_id:'69fordMustangBoss429'},
 {name:'Countach LP400S (1978)',workshop_id:'3726526329',mod_id:'78lamboCountach',vehicle_script_id:'78lamboCountachLP400S'},
 {name:'Defender 110 (1989)',workshop_id:'3570973322',mod_id:'89defender',vehicle_script_id:'89defender110'},
 {name:'Hilux cabine extra (1988)',workshop_id:'3435796523',mod_id:'88toyotaHilux',vehicle_script_id:'88toyotaHiluxXC'},
 {name:'Humvee M998 (1992)',workshop_id:'2642541073',mod_id:'92amgeneralM998',vehicle_script_id:'92amgeneralM998'},
].map(v=>Object.freeze({...v,kind:'vehicle',quantity:1,delivery_method:'manual_vehicle',weight:null,rarity:null,
 selection_source:'administrator_report',server_build:'42.21.0',installation_evidence:'administrator_report',
 independently_verified:false,image_verified:false,activation_approved:false})));
export function expansionDraft(current){return {active_count:current?.rewards?.length??null,target:36,
 selected_vehicles:vehicleCandidates,conventional_rewards_missing:7,new_weights_approved:false,ready:false,
 external_poc:{source:'administrator_report',item:'Base.Hammer',quantity:3,received:true,
 condition:'maximum_observed_by_administrator',dashboard_connection_verified:false}};}
