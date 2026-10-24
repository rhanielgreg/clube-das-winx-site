const DEFAULT_TIMEOUT_MS = 6_000;

function getSupabaseConfig(env = process.env) {
  const url = env.SUPABASE_URL?.trim().replace(/\/$/, '');
  const key = (env.SUPABASE_PUBLISHABLE_KEY || env.SUPABASE_ANON_KEY)?.trim();
  return { url, key, configured: Boolean(url && key) };
}

export async function callPublicRpc(name, params = {}, { env = process.env, timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
  const config = getSupabaseConfig(env);
  if (!config.configured) return { configured: false, data: null };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${config.url}/rest/v1/rpc/${name}`, {
      method: 'POST',
      headers: {
        apikey: config.key,
        accept: 'application/json',
        'content-type': 'application/json',
      },
      body: JSON.stringify(params),
      signal: controller.signal,
    });

    if (!response.ok) {
      const details = (await response.text()).slice(0, 500);
      throw new Error(`Supabase RPC ${name} respondeu HTTP ${response.status}: ${details}`);
    }
    return { configured: true, data: await response.json() };
  } finally {
    clearTimeout(timer);
  }
}

export function isStale(isoDate, maxAgeMinutes = 15) {
  const timestamp = Date.parse(isoDate || '');
  return !Number.isFinite(timestamp) || Date.now() - timestamp > maxAgeMinutes * 60_000;
}
