import { callPublicRpc, isStale } from '../lib/supabase-public.js';
import { enrichRankingWithAvatars } from '../lib/steam-avatar.js';
import { normalizeCharacter } from '../public/contracts.js';
import { livingRanking, OFFICIAL_RULES } from '../public/championship.js';
import { officialContractEnabled, officialContractPending, lifeContractEnabled } from '../lib/championship-contract.js';

function send(res, status, body) {
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.setHeader('cache-control', status === 200 ? 'public, s-maxage=120, stale-while-revalidate=300' : 'no-store');
  return res.status(status).json(body);
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('allow', 'GET');
    return send(res, 405, { error: 'Método não permitido.' });
  }

  if (!officialContractEnabled() && process.env.SUPABASE_URL && (process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY)) {
    return send(res, 503, { state: 'awaiting_official_contract', error: officialContractPending, ranking: [], seasons: [] });
  }
  try {
    const lifeEnabled=lifeContractEnabled();
    const [rankingResult, seasonsResult, syncResult, graveyardResult,honorsResult] = await Promise.all([
      callPublicRpc(lifeEnabled?'get_public_ranking_life_v1':'get_public_ranking', { p_limit: 100 }),
      callPublicRpc('get_public_seasons_v2', { p_limit: 8 }),
      callPublicRpc(lifeEnabled?'get_public_pipeline_status_v1':'get_public_ranking_status'),
      callPublicRpc(lifeEnabled?'get_public_graveyard_life_v1':'get_public_graveyard_v2', { p_limit: 50 }).catch(() => ({ data: null, unavailable: true })),
      lifeEnabled?callPublicRpc('get_public_memorial_honors_v1').catch(()=>({data:null})):Promise.resolve({data:null}),
    ]);

    if (!rankingResult.configured) {
      return send(res, 200, {
        configured: false,
        state: 'awaiting_configuration',
        ranking: [],
        graveyard: [],
        graveyard_state: 'unavailable',
        seasons: [],
        sync: null,
        message: 'Ranking aguardando a conexão segura com o Supabase.',
      });
    }

    const ranking = livingRanking((rankingResult.data ?? []).map(normalizeCharacter));
    const graveyard = Array.isArray(graveyardResult.data) ? graveyardResult.data.map(normalizeCharacter) : null;
    await Promise.all([enrichRankingWithAvatars(ranking), enrichRankingWithAvatars(graveyard)]);

    const sync = Array.isArray(syncResult.data) ? syncResult.data[0] ?? null : syncResult.data;
    return send(res, 200, {
      configured: true,
      competition_rules: OFFICIAL_RULES,
      memorial_honors:Array.isArray(honorsResult.data)?honorsResult.data:null,
      state: ranking.length ? 'ready' : 'awaiting_validated_stats',
      ranking,
      graveyard,
      graveyard_state: Array.isArray(graveyardResult.data) ? 'ready' : 'unavailable',
      time_metric: 'played_seconds',
      life_identity_verified: false,
      seasons: seasonsResult.data ?? [],
      sync,
      stale: isStale(sync?.last_success_at)||['failed','running'].includes(sync?.latest_attempt_status),
      message: ranking.length
        ? null
        : 'Aguardando estatísticas validadas do servidor para abrir a disputa.',
    });
  } catch (error) {
    console.error('Falha ao carregar ranking:', error);
    return send(res, 503, {
      configured: true,
      state: 'temporarily_unavailable',
      ranking: [],
      graveyard: null,
      graveyard_state: 'unavailable',
      seasons: [],
      sync: null,
      message: 'O ranking está temporariamente indisponível. O status do servidor continua funcionando.',
    });
  }
}
