import { UUID } from '../public/contracts.js';

export function validateAdminAction(action, payload = {}) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return { status: 400, error: 'Parâmetros administrativos inválidos.' };
  if (!['reset_baseline', 'start_season', 'close_season','rename_season'].includes(action)) return { status: 400, error: 'Ação administrativa inválida.' };
  if (['reset_baseline', 'close_season','rename_season'].includes(action) && !UUID.test(payload.season_id || '')) {
    return { status: 400, error: 'Informe uma temporada específica com UUID válido.' };
  }
  if(action==='rename_season'&&(typeof payload.name!=='string'||payload.name.trim().length<3||payload.name.trim().length>80
    ||typeof payload.reason!=='string'||payload.reason.trim().length<10||payload.reason.trim().length>500))
    return {status:400,error:'Informe nome de 3 a 80 caracteres e justificativa de 10 a 500 caracteres.'};
  if (action === 'reset_baseline') {
    // Não há operação segura sem decidir a semântica de reprocessamento histórico.
    // Nenhum PATCH ou RPC deve ser iniciado por este caminho.
    return { status: 409, error: 'Reset bloqueado: requer revisão da regra, migração transacional e autorização específica. Nenhum dado foi alterado.' };
  }
  if (action === 'close_season' && payload.winner_character_id != null && !UUID.test(payload.winner_character_id)) {
    return { status: 400, error: 'Identificador do vencedor inválido. O banco certifica o resultado pelas regras oficiais.' };
  }
  if (action === 'start_season' && (typeof payload.name !== 'string' || !payload.name.trim() || payload.name.trim().length > 80 ||
    typeof payload.slug !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(payload.slug.trim()))) {
    return { status: 400, error: 'Nome e slug válidos são obrigatórios.' };
  }
  return null;
}
