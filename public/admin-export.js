import {csvField} from './contracts.js';
// Preserve the original first nine columns; append explicit snapshot metadata.
export function rankingCsv(data){
 const header=['Posicao','Usuario_Steam','Personagem','Kills_Total','Kills_Arma','Kills_Melee','Tempo_Segundos','Estado','Ultima_Atualizacao','Temporada','Consulta_Em','Escopo_Tempo','Referencia_Estado'];
 const rows=(data?.ranking||[]).map((p,i)=>[i+1,p.steam_username,p.character_name,p.kills_total,p.kills_firearm,p.kills_melee,p.survival_seconds,
  p.alive===true?'VIVO':p.alive===false?'MORTO':'DESCONHECIDO',p.last_updated_at,
  data.activeSeason?.name,data.checked_at,p.survival_seconds==null?'NAO_CERTIFICADO':'SAZONAL','ULTIMA_OBSERVACAO']);
 return '\ufeff'+[header,...rows].map(row=>row.map(csvField).join(';')).join('\r\n');
}
