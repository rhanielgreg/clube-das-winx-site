import { queryA2SInfo, queryA2SPlayers } from './a2s.js';
import { getConfig } from './config.js';

let cache = null;

const firstDefined = (...values) => values.find((value) => value !== undefined && value !== null);

function asNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function asOnline(value) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value > 0;
  if (typeof value === 'string') {
    return ['online', 'up', 'running', 'ok', 'true', '1'].includes(value.toLowerCase());
  }
  return false;
}

export function normalizeExternalStatus(payload, config = getConfig()) {
  const root = payload?.data ?? payload?.server ?? payload ?? {};
  const playersValue = firstDefined(
    root.players?.online,
    root.players?.current,
    root.numPlayers,
    root.numplayers,
    Array.isArray(root.players) ? root.players.length : root.players,
    root.clients,
  );
  const maxPlayersValue = firstDefined(
    root.players?.max,
    root.players?.maximum,
    root.maxPlayers,
    root.maxplayers,
    root.max_clients,
    config.maxPlayers,
  );
  const statusValue = firstDefined(root.online, root.isOnline, root.status, root.state);

  return {
    online: asOnline(statusValue),
    name: firstDefined(root.name, root.hostname, root.serverName, config.serverName),
    players: asNumber(playersValue, 0),
    maxPlayers: asNumber(maxPlayersValue, config.maxPlayers),
    map: firstDefined(root.map, root.mapName, null),
    latencyMs: asNumber(firstDefined(root.latency, root.ping), 0),
  };
}

async function queryExternal(config) {
  if (!config.externalApiUrl) throw new Error('STATUS_API_URL não configurada.');

  const url = config.externalApiUrl
    .replaceAll('{host}', encodeURIComponent(config.host))
    .replaceAll('{port}', encodeURIComponent(String(config.port)));
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.externalApiTimeoutMs);
  const startedAt = Date.now();

  try {
    const headers = { accept: 'application/json' };
    if (config.externalApiToken) headers.authorization = `Bearer ${config.externalApiToken}`;

    const response = await fetch(url, { headers, signal: controller.signal });
    if (!response.ok) throw new Error(`API externa respondeu HTTP ${response.status}.`);
    const normalized = normalizeExternalStatus(await response.json(), config);
    return {
      ...normalized,
      latencyMs: normalized.latencyMs || Date.now() - startedAt,
    };
  } finally {
    clearTimeout(timer);
  }
}

function publicStatus(dynamic, config, source, errors = []) {
  return {
    name: dynamic.name || config.serverName,
    online: Boolean(dynamic.online),
    players: asNumber(dynamic.players, 0),
    maxPlayers: asNumber(dynamic.maxPlayers, config.maxPlayers),
    playerList: Array.isArray(dynamic.playerList) ? dynamic.playerList : [],
    map: dynamic.map || null,
    latencyMs: asNumber(dynamic.latencyMs, 0),
    ip: `${config.host}:${config.port}`,
    ddns: config.ddns,
    steamUrl: config.steamUrl,
    source,
    checkedAt: new Date().toISOString(),
    diagnostics: errors,
  };
}

async function fetchFreshStatus(config) {
  const errors = [];

  if (config.provider === 'auto' || config.provider === 'a2s') {
    try {
      const [result, playerList] = await Promise.all([
        queryA2SInfo({
          host: config.a2sHost,
          port: config.a2sPort,
          timeoutMs: config.a2sTimeoutMs,
        }),
        queryA2SPlayers({
          host: config.a2sHost,
          port: config.a2sPort,
          timeoutMs: config.a2sTimeoutMs,
        }),
      ]);
      return publicStatus({ ...result, playerList, online: true }, config, 'a2s');
    } catch (error) {
      errors.push(`a2s: ${error.message}`);
    }
  }

  if (config.provider === 'auto' || config.provider === 'external') {
    try {
      const result = await queryExternal(config);
      return publicStatus(result, config, 'external-api', errors);
    } catch (error) {
      errors.push(`external-api: ${error.message}`);
    }
  }

  return publicStatus(
    { online: false, players: 0, maxPlayers: config.maxPlayers },
    config,
    'fallback-offline',
    errors,
  );
}

export async function getServerStatus({ force = false, env = process.env } = {}) {
  const config = getConfig(env);
  const now = Date.now();
  if (!force && cache && cache.expiresAt > now) return cache.value;

  const value = await fetchFreshStatus(config);
  cache = { value, expiresAt: now + config.cacheTtlMs };
  return value;
}

export function clearStatusCache() {
  cache = null;
}
