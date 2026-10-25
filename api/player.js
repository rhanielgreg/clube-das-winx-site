import { callPublicRpc } from '../lib/supabase-public.js';
import { getSteamAvatar } from '../lib/steam-avatar.js';
import { UUID, normalizeCharacter } from '../public/contracts.js';
import { resolveDashboardContract } from '../lib/championship-contract.js';
import { validatedLifeResult } from '../lib/life-public-contract.js';

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

  const profileId = Array.isArray(req.query?.id) ? req.query.id[0] : req.query?.id;
  if (!profileId || !UUID.test(profileId)) {
    return send(res, 400, { error: 'Perfil inválido.' });
  }

  try {
    const contract=await resolveDashboardContract();
    const profileResult = await callPublicRpc('get_public_player', { p_profile_id: profileId }, { timeoutMs: 3500 });
    if (!profileResult.configured) return send(res, 503, { error: 'Ranking ainda não configurado.' });

    const profile = Array.isArray(profileResult.data) ? profileResult.data[0] ?? null : profileResult.data;
    if (!profile) return send(res, 404, { error: 'Perfil não encontrado.' });
    const [historyResult, avatar, titlesResult, achievementsResult] = await Promise.all([
      contract.official&&profile.season_id ? callPublicRpc('get_public_player_history_v2', { p_profile_id: profileId, p_season_id: profile.season_id, p_limit: 90 }, { timeoutMs: 3500 })
        .catch(() => ({ data: null, unavailable: true })) : Promise.resolve({ data: null, unavailable: true }),
      getSteamAvatar(profile.steam_username, { profileId: profile.profile_id }),
      contract.official ? callPublicRpc('get_public_player_titles', { p_profile_id: profileId }, { timeoutMs: 3500 }).catch(() => ({ data: null })) : Promise.resolve({ data: null }),
      contract.life ? callPublicRpc('get_public_life_achievements_v1', { p_profile_id: profileId }, { timeoutMs: 3500 }).catch(() => ({ data: null })) : Promise.resolve({ data: null }),
    ]);
    profile.avatar_url = avatar;
    profile.avatar_source = avatar ? 'steam_configured' : null;
    const achievements=validatedLifeResult(achievementsResult.data);
    return send(res, 200, { profile: normalizeCharacter(profile), history: Array.isArray(historyResult.data) ? historyResult.data : [],
      titles: Array.isArray(titlesResult.data) ? titlesResult.data : [], titles_state: Array.isArray(titlesResult.data) ? 'ready' : 'unavailable',
      achievements,
      achievements_state: achievements ? 'ready' : 'unavailable',
      history_state: Array.isArray(historyResult.data) ? 'ready' : 'unavailable', time_metric: 'played_seconds', life_identity_verified: achievements?.identity_verified===true });
  } catch (error) {
    console.error('Falha ao carregar perfil público:', error);
    return send(res, 503, { error: 'Perfil temporariamente indisponível.' });
  }
}
