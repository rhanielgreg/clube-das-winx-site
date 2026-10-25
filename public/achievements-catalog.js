// Catálogo versionado. Definição não significa desbloqueio: exige evidência da vida.
const tiers=['bronze','silver','gold'];
const labels=['Bronze','Prata','Ouro'];
const rule=(metric,value,op='gte')=>({metric,op,value});
const readable={kills_total:'Kills na vida',kills_firearm:'Kills por armas de fogo',kills_melee:'Kills corpo a corpo',kills_vehicle:'Kills por veículos',kills_axe:'Kills com machado',kills_blunt:'Kills com arma contundente',kills_small_blunt:'Kills com arma contundente curta',kills_long_blade:'Kills com lâmina longa',kills_small_blade:'Kills com lâmina curta',kills_spear:'Kills com lança',kills_unarmed:'Kills desarmado',kills_other:'Kills na categoria Other',played_seconds:'Tempo jogado',survival_world_days:'Dias no mundo',distance_total_m:'Distância total',distance_walked_m:'Distância a pé',distance_vehicle_m:'Distância dirigida',best_season_kills_total:'Melhor pontuação de temporada',best_season_kills_firearm:'Melhor contagem de fogo em temporada',best_season_kills_melee:'Melhor contagem corpo a corpo em temporada',best_season_kills_vehicle:'Melhor contagem de veículo em temporada',categories_with_100_kills:'Categorias com ao menos 100 kills',seasons_completed_alive:'Temporadas oficiais concluídas vivo',official_wins:'Vitórias oficiais',solo_official_wins:'Vitórias como único vivo classificado',alive:'Estado morto confirmado'};
const describe=(r)=>{
 const value=r.metric==='played_seconds'?`${r.value/3600} h`:r.metric.startsWith('distance_')?`${r.value/1000} km`:r.value.toLocaleString('pt-BR');
 return r.metric==='alive'?'Morte observada':`${readable[r.metric]} ${r.op==='eq'?'=':'≥'} ${value}`;
};
const groups=[
 ['exterminador','Exterminador','combate','kills_total',[100,1000,10000]],
 ['atirador','Atirador','combate','kills_firearm',[100,500,2500]],
 ['linha-frente','Linha de frente','combate','kills_melee',[100,1000,5000]],
 ['impacto-rodas','Impacto sobre rodas','veiculos','kills_vehicle',[50,500,2500]],
 ['lenhador','Fio do machado','armas','kills_axe',[25,250,1000]],
 ['contundente','Força contundente','armas','kills_blunt',[25,250,1000]],
 ['impacto-curto','Impacto curto','armas','kills_small_blunt',[25,250,1000]],
 ['lamina-longa','Lâmina longa','armas','kills_long_blade',[25,250,1000]],
 ['lamina-curta','Lâmina curta','armas','kills_small_blade',[25,250,1000]],
 ['lanceiro','Lanceiro','armas','kills_spear',[25,250,1000]],
 ['desarmado','Último recurso','armas','kills_unarmed',[10,100,500]],
 ['outros-meios','Outros meios registrados','armas','kills_other',[25,100,500]],
 ['tempo-ativo','Tempo em resistência','tempo','played_seconds',[36000,180000,720000]],
 ['sobrevivente','Sobrevivente do mundo','sobrevivencia','survival_world_days',[7,30,90]],
 ['territorio','Território percorrido','exploracao','distance_total_m',[25000,100000,500000]],
 ['andarilho','Andarilho','exploracao','distance_walked_m',[10000,50000,150000]],
 ['estradeiro','Estradeiro','exploracao','distance_vehicle_m',[50000,250000,1000000]],
 ['temporada-exterminio','Marca de temporada','temporada','best_season_kills_total',[100,1000,5000]],
 ['temporada-fogo','Fogo na temporada','temporada','best_season_kills_firearm',[50,500,2000]],
 ['temporada-contato','Contato na temporada','temporada','best_season_kills_melee',[50,500,2000]],
 ['temporada-rodas','Rodas na temporada','temporada','best_season_kills_vehicle',[25,250,1000]],
 ['combate-hibrido','Combate híbrido','combate',['kills_firearm','kills_melee'],[50,250,1000]],
 ['duas-laminas','Duas lâminas','armas',['kills_long_blade','kills_small_blade'],[25,100,500]],
 ['dois-impactos','Dois impactos','armas',['kills_blunt','kills_small_blunt'],[25,100,500]],
 ['rodas-fogo','Rodas e fogo','veiculos',['kills_vehicle','kills_firearm'],[25,100,500]],
 ['arsenal-diverso','Arsenal diverso','armas','categories_with_100_kills',[3,5,8]],
 ['resistencia-combate','Resistência em combate','sobrevivencia',['survival_world_days','kills_total'],[[7,100],[30,1000],[90,5000]]],
 ['trilha-resistente','Trilha resistente','exploracao',['survival_world_days','distance_walked_m'],[[7,10000],[30,50000],[90,150000]]],
 ['estrada-resistente','Estrada resistente','exploracao',['survival_world_days','distance_vehicle_m'],[[7,50000],[30,250000],[90,1000000]]],
 ['participacao','Presença nas temporadas','temporada','seasons_completed_alive',[1,3,5]],
];
const definition=(id,name,category,type,criteria,extra={})=>({
 id,name,description:criteria.map(describe).join(' e '),
 category,type,level:null,sequence:null,level_rank:null,criteria,
 required_sources:[...new Set(criteria.map(r=>r.metric.startsWith('best_season_')||['official_wins','solo_official_wins','seasons_completed_alive'].includes(r.metric)?'official_archive':'verified_life_observation'))],
 retroactivity:'Somente contador/arquivo comprovado desta vida; data do feito permanece desconhecida sem evento certificado.',
 presentation:'Maior nível da sequência; especiais individualmente.',
 insufficient_data:'Não conceder; informar identidade ou métrica pendente.',version:1,...extra,
});
export const achievementCatalog=Object.freeze([
 ...groups.flatMap(([id,name,category,metrics,thresholds])=>tiers.map((tier,i)=>{
   const fields=Array.isArray(metrics)?metrics:[metrics];
   const values=Array.isArray(thresholds[i])?thresholds[i]:fields.map(()=>thresholds[i]);
   return definition(`${id}.${tier}`,`${name} — ${labels[i]}`,category,'progressive',fields.map((m,j)=>rule(m,values[j])),{sequence:id,level:tier,level_rank:i+1});
 })),
 definition('coroa-oficial','Coroa oficial','temporada','special',[rule('official_wins',1)]),
 definition('ultimo-vencedor','Último vencedor vivo','temporada','special',[rule('solo_official_wins',1)]),
 definition('coroa-persistente','Coroa persistente','temporada','special',[rule('official_wins',2)]),
 definition('arsenal-fogo','Mil no fogo','combate','special',[rule('kills_firearm',1000),rule('kills_melee',0,'eq'),rule('kills_vehicle',0,'eq'),rule('kills_other',0,'eq')]),
 definition('arsenal-contato','Mil no contato','combate','special',[rule('kills_melee',1000),rule('kills_firearm',0,'eq'),rule('kills_vehicle',0,'eq'),rule('kills_other',0,'eq')]),
 definition('arsenal-rodas','Mil sobre rodas','veiculos','special',[rule('kills_vehicle',1000),rule('kills_firearm',0,'eq'),rule('kills_melee',0,'eq'),rule('kills_other',0,'eq')]),
 definition('tres-frentes','Três frentes','combate','special',[rule('kills_firearm',100),rule('kills_melee',100),rule('kills_vehicle',100)]),
 definition('mes-sem-tiros','Um mês sem tiros registrados','sobrevivencia','special',[rule('survival_world_days',30),rule('kills_total',100),rule('kills_firearm',0,'eq')]),
 definition('duas-jornadas','Duas jornadas','exploracao','special',[rule('distance_walked_m',10000),rule('distance_vehicle_m',100000)]),
 definition('legado-caido','Legado do caído','sobrevivencia','special',[rule('alive',0,'eq'),rule('survival_world_days',30),rule('kills_total',1000)]),
]);
if(achievementCatalog.length!==100 || new Set(achievementCatalog.map(a=>a.id)).size!==100) throw new Error('Catálogo deve conter exatamente 100 IDs únicos');
