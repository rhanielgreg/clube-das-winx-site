import { trustedSteamAvatar } from '../public/avatar.js';
// Cache em memória para avatares públicos da Steam
const avatarCache = new Map();
const CACHE_TTL_MS = 3600_000; // 1 hora de cache em memória

export async function getSteamAvatar(username, { env = process.env, profileId, fetchImpl = fetch } = {}) {
  // Nome de exibição não é um identificador Steam. Só usar associação explícita.
  let profiles;
  try { profiles = JSON.parse(env.STEAM_PROFILE_MAP_JSON || '{}'); } catch { return null; }
  if (!profiles || typeof profiles !== 'object' || Array.isArray(profiles)) return null;
  // UUID do registro tem precedência. A chave por nome é compatibilidade manual;
  // não é descoberta automática de identidade e exige conferência do operador.
  const profileUrl = profileId && Object.hasOwn(profiles, profileId) ? profiles[profileId]
    : typeof username === 'string' && Object.hasOwn(profiles, username) ? profiles[username] : null;
  if (typeof profileUrl !== 'string' || !/^https:\/\/steamcommunity\.com\/(?:id\/[a-zA-Z0-9_-]+|profiles\/[0-9]{17})\/?$/.test(profileUrl)) return null;
  const key = profileUrl;
  const cached = avatarCache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.url;
  }

  try {
    const res = await fetchImpl(`${profileUrl.replace(/\/$/, '')}/?xml=1`, {
      redirect: 'error',
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
      signal: AbortSignal.timeout(2500),
    });

    if (!res.ok) {
      avatarCache.set(key, { url: null, timestamp: Date.now() });
      return null;
    }

    const text = await res.text();
    if (text.includes('The specified profile could not be found')) {
      avatarCache.set(key, { url: null, timestamp: Date.now() });
      return null;
    }

    const match = text.match(/<avatarFull><!\[CDATA\[(.*?)\]\]><\/avatarFull>/) || text.match(/<avatarFull>(.*?)<\/avatarFull>/);
    const candidate = match ? match[1] : null;
    const url = trustedSteamAvatar(candidate) ? candidate : null;
    avatarCache.set(key, { url, timestamp: Date.now() });
    return url;
  } catch {
    avatarCache.set(key, { url: null, timestamp: Date.now() });
    return null;
  }
}

export async function enrichRankingWithAvatars(ranking) {
  if (!Array.isArray(ranking) || !ranking.length) return ranking;
  await Promise.all(
    ranking.map(async (player) => {
      player.avatar_url = await getSteamAvatar(player.steam_username, { profileId: player.profile_id });
      player.avatar_source = player.avatar_url ? 'steam_configured' : null;
    })
  );
  return ranking;
}
