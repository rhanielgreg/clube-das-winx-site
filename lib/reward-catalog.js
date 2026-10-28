// IDs confirmed in the installed Build42.21.0 scripts, read-only on 27/10/2026.
// Hashes identify the protected source copies; no game command was executed.
const weapon='742414e701d360a9076099f9842bd9cc65c2d9ba9497af8b0ce470ee147467c5';
const container='4904a61c83411b4c41d196e517097f5981b2a76c300bc33abc78c86e721f65da';
const component=script_id=>({kind:'item',script_id,quantity:1,condition:'standard_unverified_maximum'});
const reward=(id,name,rarity,weight,ids,evidence_sha256=weapon)=>({id,name,rarity,weight,items:ids.map(component),
 verified:true,verification:'installed_script_and_documented_manual_method',server_build:'42.21.0',evidence_sha256,delivery_method:'manual_verified'});
export const rewardCatalog={version:'season-prizes-v2-b42.21.0',rewards:[
 reward('crowbar','Pé de cabra','common',25,['Base.Crowbar']),
 reward('hammer','Martelo','common',20,['Base.Hammer']),
 reward('screwdriver','Chave de fenda','common',20,['Base.Screwdriver']),
 reward('wrench','Chave inglesa','common',15,['Base.Wrench']),
 reward('pipe-wrench','Chave de grifo','common',10,['Base.PipeWrench']),
 reward('hand-shovel','Pá de mão','common',10,['Base.HandShovel']),
 reward('army-pack','Mochila militar','uncommon',15,['Base.Bag_ALICEpack_Army'],container),
 reward('alice-pack','Mochila ALICE','uncommon',15,['Base.Bag_ALICEpack'],container),
 reward('survivor-bag','Bolsa de sobrevivente','uncommon',10,['Base.Bag_SurvivorBag'],container),
 reward('big-hiking','Mochila grande de trilha','uncommon',20,['Base.Bag_BigHikingBag'],container),
 reward('hiking','Mochila de trilha','uncommon',25,['Base.Bag_NormalHikingBag'],container),
 reward('duffel','Bolsa de viagem','uncommon',15,['Base.Bag_DuffelBag'],container),
 reward('workshop-kit','Kit de oficina: martelo e machado','rare',20,['Base.Hammer','Base.Axe']),
 reward('repair-kit','Kit de reparo: chave de fenda e chave inglesa','rare',20,['Base.Screwdriver','Base.Wrench']),
 reward('garden-kit','Kit de jardim: pá de mão e forcado','rare',15,['Base.HandShovel','Base.GardenFork']),
 reward('heavy-tools','Kit de ferramentas: pé de cabra e chave de grifo','rare',15,['Base.Crowbar','Base.PipeWrench']),
 reward('camping-kit','Kit de campo: machadinha e faca de caça','rare',15,['Base.HandAxe','Base.HuntingKnife']),
 reward('hammer-kit','Kit de martelos: bola e marreta curta','rare',15,['Base.BallPeenHammer','Base.ClubHammer']),
 reward('machete','Facão','epic',45,['Base.Machete']),
 reward('fire-axe','Machado de bombeiro','epic',20,['Base.Axe']),
 reward('wood-axe','Machado de lenhador','epic',15,['Base.WoodAxe']),
 reward('shotgun','Espingarda — sem munição adicional','epic',12,['Base.Shotgun']),
 reward('varmint-rifle','Rifle de caça — sem munição adicional','epic',8,['Base.VarmintRifle']),
 reward('katana','Katana','legendary',100,['Base.Katana']),
]};
