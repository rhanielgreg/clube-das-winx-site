const integer = (value, fallback, min = 0, max = Number.MAX_SAFE_INTEGER) => {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isFinite(parsed) && parsed >= min && parsed <= max ? parsed : fallback;
};

const trimTrailingSlash = (value) => String(value || '').replace(/\/+$/, '');

export function getConfig(env = process.env) {
  const host = env.SERVER_HOST || '169.155.127.74';
  const port = integer(env.SERVER_PORT, 9045, 1, 65535);
  const provider = ['auto', 'a2s', 'external'].includes(env.STATUS_PROVIDER)
    ? env.STATUS_PROVIDER
    : 'auto';

  return {
    serverName: env.SERVER_NAME || 'Clube das Winx | Project Zomboid',
    host,
    port,
    ddns: env.SERVER_DDNS || 'clubedaswinx.modded.fun:9045',
    maxPlayers: integer(env.SERVER_MAX_PLAYERS, 32, 1, 255),
    steamUrl: `steam://connect/${host}:${port}`,
    publicBaseUrl: trimTrailingSlash(env.PUBLIC_BASE_URL),
    provider,
    a2sHost: env.A2S_HOST || host,
    a2sPort: integer(env.A2S_QUERY_PORT, port, 1, 65535),
    a2sTimeoutMs: integer(env.A2S_TIMEOUT_MS, 1800, 200, 10000),
    externalApiUrl: env.STATUS_API_URL || '',
    externalApiToken: env.STATUS_API_TOKEN || '',
    externalApiTimeoutMs: integer(env.STATUS_API_TIMEOUT_MS, 3000, 200, 15000),
    cacheTtlMs: integer(env.STATUS_CACHE_TTL_MS, 15000, 0, 300000),
  };
}

export function resolvePublicBaseUrl(requestUrl, env = process.env) {
  const configured = trimTrailingSlash(env.PUBLIC_BASE_URL);
  if (configured) return configured;
  return new URL(requestUrl).origin;
}
