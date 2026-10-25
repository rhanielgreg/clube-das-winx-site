import { queryA2SInfo, queryA2SPlayers } from './a2s.js';
import { getConfig } from './config.js';

let cache = null;
let lastValid = null;

const firstDefined = (...values) => values.find((value) => value !== undefined && value !== null);

function asNumber(value, fallback = null) {
  if (!['number','string'].includes(typeof value) || String(value).trim()==='') return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function asOnline(value) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value===1 ? true : value===0 ? false : null;
  if (typeof value === 'string') {
    const state=value.toLowerCase();
    if (['online','up','running','ok','true','1'].includes(state)) return true;
    if (['offline','down','stopped','false','0'].includes(state)) return false;
  }
  return null;
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
    null,
  );
  const statusValue = firstDefined(root.online, root.isOnline, root.status, root.state);

  return {
    online: asOnline(statusValue),
    name: firstDefined(root.name, root.hostname, root.serverName, config.serverName),
    players: asNumber(playersValue),
    maxPlayers: asNumber(maxPlayersValue),
    map: firstDefined(root.map, root.mapName, null),
    latencyMs: asNumber(firstDefined(root.latency, root.ping)),
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
    online: typeof dynamic.online === 'boolean' ? dynamic.online : null,
    players: asNumber(dynamic.players),
    maxPlayers: asNumber(dynamic.maxPlayers),
    playerList: dynamic.playerListVerified === true && Array.isArray(dynamic.playerList) ? dynamic.playerList : [],
    playerListVerified: dynamic.playerListVerified === true,
    map: dynamic.map || null,
    latencyMs: asNumber(dynamic.latencyMs),
    ip: `${config.host}:${config.port}`,
    ddns: config.ddns,
    steamUrl: config.steamUrl,
    source,
    checkedAt: new Date().toISOString(),
    diagnostics: errors,
  };
}

async function fetchFreshStatus(config, { queryInfo=queryA2SInfo, queryPlayers=queryA2SPlayers, externalQuery=queryExternal } = {}) {
  const errors = [];

  if (config.provider === 'auto' || config.provider === 'a2s') {
    try {
      const [result, playerList] = await Promise.all([
        queryInfo({
          host: config.a2sHost,
          port: config.a2sPort,
          timeoutMs: config.a2sTimeoutMs,
        }),
        queryPlayers({
          host: config.a2sHost,
          port: config.a2sPort,
          timeoutMs: config.a2sTimeoutMs,
        }).catch(()=>[]),
      ]);
      const verified=Array.isArray(playerList) && playerList.length===result.players
        && new Set(playerList.map(p=>p.name)).size===playerList.length
        && playerList.every(p=>typeof p.name==='string' && p.name.trim() && p.name.length<=80);
      return publicStatus({ ...result, playerList, playerListVerified:verified, online: true }, config, 'a2s');
    } catch (error) {
      errors.push(`a2s: ${error.message}`);
    }
  }

  if (config.provider === 'auto' || config.provider === 'external') {
    try {
      const result = await externalQuery(config);
      return publicStatus(result, config, 'external-api', errors);
    } catch (error) {
      errors.push(`external-api: ${error.message}`);
    }
  }

  return publicStatus(
    { online: null, players: null, maxPlayers: null },
    config,
    'unavailable',
    errors,
  );
}

export async function getServerStatus({ force = false, env = process.env, dependencies } = {}) {
  const config = getConfig(env);
  const now = Date.now();
  const key=JSON.stringify([config.host,config.port,config.a2sHost,config.a2sPort,config.provider,config.externalApiUrl]);
  if (!force && cache?.key===key && cache.expiresAt > now) return cache.value;

  const value = await fetchFreshStatus(config,dependencies);
  if (typeof value.online==='boolean') lastValid={key,at:value.checkedAt};
  value.lastValidAt=lastValid?.key===key ? lastValid.at : null;
  cache = { key, value, expiresAt: now + config.cacheTtlMs };
  return value;
}

export function clearStatusCache() {
  cache = null;
  lastValid = null;
}
