import { callPublicRpc, isStale } from '../lib/supabase-public.js';
import { enrichRankingWithAvatars } from '../lib/steam-avatar.js';

function send(res, status, body) {
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.setHeader('cache-control', 'public, s-maxage=120, stale-while-revalidate=300');
  return res.status(status).json(body);
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('allow', 'GET');
    return send(res, 405, { error: 'Método não permitido.' });
  }

  try {
    const [rankingResult, seasonsResult, syncResult, graveyardResult] = await Promise.all([
      callPublicRpc('get_public_ranking', { p_limit: 100 }),
      callPublicRpc('get_public_seasons', { p_limit: 8 }),
      callPublicRpc('get_public_ranking_status'),
      callPublicRpc('get_public_graveyard', { p_limit: 50 }).catch(() => ({ data: [] })),
    ]);

    if (!rankingResult.configured) {
      return send(res, 200, {
        configured: false,
        state: 'awaiting_configuration',
        ranking: [],
        graveyard: [],
        seasons: [],
        sync: null,
        message: 'Ranking aguardando a conexão segura com o Supabase.',
      });
    }

    const ranking = rankingResult.data ?? [];
    const graveyard = graveyardResult.data ?? [];
    if (ranking.length) {
      await enrichRankingWithAvatars(ranking);
    }
    if (graveyard.length) {
      await enrichRankingWithAvatars(graveyard);
    }

    const sync = Array.isArray(syncResult.data) ? syncResult.data[0] ?? null : syncResult.data;
    return send(res, 200, {
      configured: true,
      state: ranking.length ? 'ready' : 'awaiting_validated_stats',
      ranking,
      graveyard,
      seasons: seasonsResult.data ?? [],
      sync,
      stale: isStale(sync?.last_success_at),
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
      seasons: [],
      sync: null,
      message: 'O ranking está temporariamente indisponível. O status do servidor continua funcionando.',
    });
  }
}
