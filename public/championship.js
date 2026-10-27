import { UUID, hasNumber } from './contracts.js';
export const OFFICIAL_RULES = 'winx-v1';
export function livingRanking(rows = []) {
  return rows.filter(row => row.alive === true && UUID.test(row.profile_id || '') && hasNumber(row.kills_total) && Number(row.kills_total) >= 0);
}
export function seasonResult(season) {
  if (season.status !== 'closed') return 'Disputa em andamento';
  if(season.rules_version==='winx-v2') {
    if(season.outcome==='pending_certification')return 'Pendente de certificação';
    if(season.outcome==='technical_tie')return 'Empate técnico — sem campeão individual';
    if(season.outcome==='apocalypse')return 'O Apocalipse Venceu';
    if(season.outcome==='champion'&&season.winner_name)return `Campeão: ${season.winner_name}`;
    return 'Resultado pendente de certificação';
  }
  if (season.outcome === 'apocalypse' && season.rules_version === OFFICIAL_RULES) return 'O Apocalipse Venceu';
  if (season.winner_name) return `Campeão: ${season.winner_name}`;
  return 'Resultado não certificado no contrato disponível.';
}
// Categorias preparadas, sem concessão automática sem métrica/identidade certificadas.
export const memorialCategories = [
  { title: 'O EXTERMINADOR', metric: 'kills_total', reason: 'Aguardando identidade de vida e consulta completa de kills.' },
  { title: 'A LENDA DA SOBREVIVÊNCIA', metric: 'survival_world_days', reason: 'Aguardando dias no mundo e identidade de vida comprovados.' },
  { title: 'O ANDARILHO', metric: 'distance_total_m', reason: 'Aguardando distância total e identidade de vida comprovadas.' },
];
