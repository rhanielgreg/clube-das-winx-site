// Habilitação explícita somente após inventário, migração 003 e validação.
// Não configura serviços nem executa migrações. Ausência/desvio mantém bloqueado.
export const officialContractEnabled = (env = process.env) => env.COMPETITION_RULES_VERSION === 'winx-v1';
export const officialContractPending = 'Campeonato oficial aguardando validação e habilitação da migração 003.';
export const lifeContractEnabled = (env = process.env) => env.LIFE_CONTRACT_VERSION === 'life-v1' && officialContractEnabled(env);
