// lib/steam-avatar.js
// Cache em memória para avatares públicos da Steam
const avatarCache = new Map();
const CACHE_TTL_MS = 3600_000; // 1 hora de cache em memória

export async function getSteamAvatar(username) {
  if (!username) return null;
  const key = username.trim().toLowerCase();
  const cached = avatarCache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.url;
  }

  const clean = username.trim().replace(/\s+/g, '');
  try {
    const res = await fetch(`https://steamcommunity.com/id/${encodeURIComponent(clean)}/?xml=1`, {
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
    const url = match ? match[1] : null;
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
      player.avatar_url = await getSteamAvatar(player.steam_username);
    })
  );
  return ranking;
}
