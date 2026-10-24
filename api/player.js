import { callPublicRpc } from '../lib/supabase-public.js';
import { getSteamAvatar } from '../lib/steam-avatar.js';

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

  const profileId = Array.isArray(req.query?.id) ? req.query.id[0] : req.query?.id;
  if (!profileId || !/^[0-9a-f-]{36}$/i.test(profileId)) {
    return send(res, 400, { error: 'Perfil inválido.' });
  }

  try {
    const [profileResult, historyResult] = await Promise.all([
      callPublicRpc('get_public_player', { p_profile_id: profileId }),
      callPublicRpc('get_public_player_history', { p_profile_id: profileId, p_limit: 90 }),
    ]);
    if (!profileResult.configured) return send(res, 503, { error: 'Ranking ainda não configurado.' });

    const profile = Array.isArray(profileResult.data) ? profileResult.data[0] ?? null : profileResult.data;
    if (!profile) return send(res, 404, { error: 'Perfil não encontrado.' });
    profile.avatar_url = await getSteamAvatar(profile.steam_username);
    return send(res, 200, { profile, history: historyResult.data ?? [] });
  } catch (error) {
    console.error('Falha ao carregar perfil público:', error);
    return send(res, 503, { error: 'Perfil temporariamente indisponível.' });
  }
}
