// IDs confirmed in the installed Build42.21.0 scripts, read-only on 27/10/2026.
// Hashes identify the protected source copies; no game command was executed.
const weapon='742414e701d360a9076099f9842bd9cc65c2d9ba9497af8b0ce470ee147467c5';
const container='4904a61c83411b4c41d196e517097f5981b2a76c300bc33abc78c86e721f65da';
const component=script_id=>({kind:'item',script_id,quantity:1,condition:'standard_unverified_maximum'});
const reward=(id,name,rarity,weight,ids,evidence_sha256=weapon)=>({id,name,rarity,weight,items:ids.map(component),
 verified:true,verification:'installed_script_and_documented_manual_method',server_build:'42.21.0',evidence_sha256,delivery_method:'manual_verified'});
export const rewardCatalog={version:'season-prizes-v1-b42.21.0',rewards:[
 reward('crowbar','Pé de cabra','common',70,['Base.Crowbar']),
 reward('hammer','Martelo','common',30,['Base.Hammer']),
 reward('army-pack','Mochila militar','uncommon',100,['Base.Bag_ALICEpack_Army'],container),
 reward('workshop-kit','Kit de oficina: martelo e machado','rare',100,['Base.Hammer','Base.Axe']),
 reward('machete','Facão','epic',100,['Base.Machete']),
 reward('katana','Katana','legendary',100,['Base.Katana']),
]};
