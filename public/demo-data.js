// Exclusivamente demonstração: pessoas, contas, pontuações e datas fictícias.
import { recentHistory, hasNumber } from './contracts.js';
import { livingRanking, OFFICIAL_RULES } from './championship.js';
export const demoSeasonId = '10000000-0000-4000-8000-000000000001';
const identity = (n) => `20000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const observed = '2026-10-24T16:20:00.000Z';
export const demoCharacters = [
  ['Lia Moretti', 'violeta', true, 1248, 182, 766, 28740, null],
  ['Otávio Vale', 'radiofantasma', true, 987, 340, 547, 20400, null],
  ['Íris Navarro', 'ultimoabrigo', true, 846, 56, 580, 32100, null],
  ['Cora Almeida', 'neblina', null, 624, 124, 380, null, null],
  ['Noah Silveira', 'estaca', false, 403, 63, 240, 18900, '2026-10-23T21:30:00Z'],
  ['Helena Costa', 'sentinela', false, 1820, 420, 980, 45600, '2026-10-22T19:40:00Z'],
  ['Dante Reis', 'cinzas', false, 1365, 215, 890, 37800, '2026-10-21T22:10:00Z'],
  ['Lia Moretti', 'violeta', false, 732, 112, 420, 16500, '2026-10-20T18:00:00Z'],
  [null, null, false, null, null, null, null, null], // Exercita campos ausentes, sem preencher zeros.
].map(([character_name, steam_username, alive, kills_total, kills_firearm, kills_melee, survival_seconds, died_at], index) => ({
  profile_id: identity(index + 1), character_name, steam_username, alive, kills_total, kills_firearm,
  kills_melee, survival_seconds, died_at, season_id: demoSeasonId, season_name: 'Temporada das Cinzas',
  rank_position: index < 3 ? index + 1 : null, last_updated_at: kills_total === null ? null : observed, avatar_url: null,
  life_identity_verified: false, demo: true,
}));
export function demoRanking(scenario = '') {
  const ranking = ['empty','no-champion'].includes(scenario) ? [] : livingRanking(demoCharacters);
  return { demo: true, configured: true, state: ranking.length ? 'ready' : 'awaiting_validated_stats',
    competition_rules: OFFICIAL_RULES,
    ranking, graveyard: scenario === 'empty' ? [] : scenario === 'no-champion' ? demoCharacters.map(row=>({...row,alive:false,rank_position:null,died_at:observed})) : demoCharacters.filter((row) => row.alive === false),
    graveyard_state: 'ready', time_metric: 'played_seconds', life_identity_verified: false,
    seasons: [{ season_id: demoSeasonId, name: 'Temporada das Cinzas', status: scenario === 'no-champion' ? 'closed' : 'active', started_at: '2026-10-20T15:00:00Z', ended_at: scenario === 'no-champion' ? observed : null, winner_name: null, outcome: scenario === 'no-champion' ? 'apocalypse' : 'in_progress', rules_version: OFFICIAL_RULES, reward_message: 'Recompensa ilustrativa da demonstração.' },
      { season_id: '10000000-0000-4000-8000-000000000002', name: 'O primeiro inverno', status: 'closed', ended_at: '2026-10-19T22:00:00Z', winner_name: 'Aurora Lopes (fictícia)', outcome: 'legacy_champion' }],
    sync: { last_success_at: scenario === 'stale' ? '2026-10-19T16:00:00Z' : observed },
    stale: scenario === 'stale', message: ranking.length ? null : 'Nenhuma estatística validada disponível nesta demonstração.' };
}
export function demoPlayer(id,scenario='') {
  const found = demoCharacters.find((row) => row.profile_id === id);
  const profile = found && (scenario==='no-champion' ? {...found,alive:false,rank_position:null,died_at:observed} : scenario==='advanced' && found.profile_id===identity(1) ? {...found,
    kills_vehicle:250,kills_other:50,survival_world_days:9.5,distance_walked_m:15320,distance_vehicle_m:80650,
    validated_metrics:['kills_vehicle','kills_other','survival_world_days','distance_walked_m','distance_vehicle_m']} : found);
  if (!profile) return null;
  const start = Date.parse(profile.died_at || observed) - 119 * 300000;
  const points = Array.from({ length: hasNumber(profile.kills_total) ? 120 : 0 }, (_, i) => ({ id: i + 1, season_id: demoSeasonId,
    observed_at: new Date(start + i * 300000).toISOString(),
    kills_total: Math.round(profile.kills_total * (i + 1) / 120),
    survival_seconds: profile.survival_seconds === null ? null : Math.round(profile.survival_seconds * (i + 1) / 120), alive: profile.alive }));
  return { demo: true, future_metrics_demo:scenario==='advanced' && profile.profile_id===identity(1), profile, history: recentHistory(points, profile.season_id), history_state: 'ready', titles: profile.profile_id===identity(6) ? [{season_id:'10000000-0000-4000-8000-000000000003',season_name:'Vitória ilustrativa anterior',ended_at:'2026-10-15T18:00:00Z',final_kills_total:1450,rules_version:OFFICIAL_RULES}] : [], titles_state:'ready',
    time_metric: 'played_seconds', life_identity_verified: false };
}

export function demoStatus(scenario='') {
  const online=scenario==='server-offline' ? false : scenario==='server-unknown' ? null : true;
  const checkedAt=new Date().toISOString();
  return {demo:true,online,players:online===true?3:online===false?0:null,maxPlayers:online===null?null:32,
    latencyMs:online===null?null:24,playerListVerified:online===true,
    playerList:online===true?[{name:'violeta'},{name:'radiofantasma'},{name:'ultimoabrigo'}]:[],
    source:'demo',checkedAt,lastValidAt:online===null?null:checkedAt};
}
