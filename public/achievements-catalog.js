// Catálogo ativo da Missão14. Legado preservado em legacy-achievements-catalog.js.
const rule=(metric,value,op='gte')=>({metric,op,value});
const rows=[
['exterminador','Exterminador','combate','kills_total',1000],['ceifador','Ceifador do Apocalipse','combate','kills_total',5000],
['mil-fogo','Mil no Fogo','combate','kills_firearm',1000],['mil-contato','Mil no Contato','combate','kills_melee',1000],
...[[10,'Primeira Vigília'],[50,'O Inquieto'],[100,'Sem Descanso'],[200,'Resistência Eterna'],[500,'O Incansável']].map(([hours,name])=>['tempo-'+hours,name,'tempo','played_seconds',hours*3600]),
...[[10,'Primeira Expedição'],[25,'Território Percorrido'],[100,'Além do Horizonte'],[500,'Andarilho'],[1000,'Sem Fronteiras']].map(([km,name])=>['distancia-'+km,name,'exploracao','distance_total_m',km*1000]),
['unico','O Único Sobrevivente','temporada','solo_official_wins',1],['presenca','Presença nas Temporadas','temporada','seasons_completed_alive',5],
['decada','Uma Década no Inferno','temporada','seasons_completed_alive',10],['coroa','Coroa Oficial','temporada','official_wins',1],
['coroa-persistente','Coroa Persistente','temporada','official_wins',3],['rosto','Rosto Conhecido','temporada','official_top3',3],
['reinado','Reinado Duplo','temporada','consecutive_official_wins',2],['rei-zero','Rei Sem Kills','temporada','zero_kill_official_wins',1],
['legado','Legado do Caído','legado','kills_total',1000,true],['sepultada','Lenda Sepultada','legado','kills_total',5000,true],
['ultima-vigilia','A Última Vigília','legado','played_seconds',720000,true],['ultima-jornada','A Última Jornada','legado','distance_total_m',500000,true],
['coroa-imortal','Coroa Imortal','legado','official_wins',1,true],['fim-era','O Fim de Uma Era','legado','seasons_completed_alive',5,true],
];
const names={kills_total:'kills totais',kills_firearm:'kills por arma de fogo',kills_melee:'kills corpo a corpo',played_seconds:'horas jogadas',distance_total_m:'km de distância total',solo_official_wins:'títulos como único vivo elegível em disputa com outros participantes',seasons_completed_alive:'temporadas oficiais concluídas vivo',official_wins:'títulos oficiais',official_top3:'temporadas oficiais entre os três primeiros',consecutive_official_wins:'títulos em temporadas oficiais consecutivas',zero_kill_official_wins:'título com zero kills, decidido por tempo'};
export const CATALOG_VERSION='medals-v2';
export const achievementCatalog=Object.freeze(rows.map(([id,name,category,metric,value,dead])=>{
 const amount=metric==='played_seconds'?value/3600:metric==='distance_total_m'?value/1000:value;
 const description=`${amount.toLocaleString('pt-BR')} ${names[metric]} elegíveis${dead?' e morte comprovada':''}. Progresso somente após ativação; sem herança entre vidas.`;
 return {id:'m14.'+id,version:2,catalog_version:CATALOG_VERSION,name,category,description,type:'unique',criteria:[rule(metric,value),...(dead?[rule('alive',0,'eq')]:[])],required_sources:[category==='temporada'||metric.includes('official')||metric==='seasons_completed_alive'?'official_archive':'verified_counter'],retroactivity:'none',presentation:'contextual'};
}));
if(achievementCatalog.length!==28||new Set(achievementCatalog.map(a=>a.id)).size!==28)throw Error('São necessárias 28 medalhas únicas.');
