import { callPublicRpc, isStale } from '../lib/supabase-public.js';

const DEFAULT_ADMIN_EMAIL = 'rhaniellgreg@gmail.com';

function getAdminConfig(env = process.env) {
  const url = env.SUPABASE_URL?.trim().replace(/\/$/, '');
  const publishableKey = (env.SUPABASE_PUBLISHABLE_KEY || env.SUPABASE_ANON_KEY)?.trim();
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  const adminEmail = (env.ADMIN_EMAIL || DEFAULT_ADMIN_EMAIL).trim().toLowerCase();
  return { url, publishableKey, serviceKey, adminEmail };
}

function send(res, status, body) {
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.setHeader('cache-control', 'no-store, max-age=0');
  return res.status(status).json(body);
}

export async function verifyAdminToken(token, { env = process.env } = {}) {
  const config = getAdminConfig(env);
  if (!config.url || !config.publishableKey) {
    return { valid: false, error: 'Configuração do Supabase ausente.' };
  }
  if (!token) {
    return { valid: false, error: 'Token de autorização ausente.' };
  }

  try {
    const response = await fetch(`${config.url}/auth/v1/user`, {
      method: 'GET',
      headers: {
        apikey: config.publishableKey,
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      return { valid: false, error: 'Sessão inválida ou expirada.' };
    }

    const user = await response.json();
    const userEmail = (user?.email || '').trim().toLowerCase();
    if (!userEmail || userEmail !== config.adminEmail) {
      return {
        valid: false,
        error: `Acesso negado para o e-mail ${userEmail || 'desconhecido'}. Apenas ${config.adminEmail} tem permissão de administrador.`,
      };
    }

    return { valid: true, user };
  } catch (error) {
    return { valid: false, error: error.message || 'Falha ao autenticar usuário.' };
  }
}

async function callServiceRpc(name, params = {}, { env = process.env } = {}) {
  const config = getAdminConfig(env);
  if (!config.serviceKey) {
    throw new Error(
      'SUPABASE_SERVICE_ROLE_KEY não configurada na Vercel. Configure esta variável no painel da Vercel para habilitar alterações administrativas.'
    );
  }

  const response = await fetch(`${config.url}/rest/v1/rpc/${name}`, {
    method: 'POST',
    headers: {
      apikey: config.serviceKey,
      Authorization: `Bearer ${config.serviceKey}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify(params),
  });

  if (!response.ok) {
    const details = (await response.text()).slice(0, 500);
    throw new Error(`RPC ${name} falhou (HTTP ${response.status}): ${details}`);
  }
  return response.status === 204 ? null : response.json();
}

async function resetBaseline(seasonId, { env = process.env } = {}) {
  const config = getAdminConfig(env);
  if (!config.serviceKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY não configurada na Vercel.');
  }

  const query = seasonId ? `?season_id=eq.${encodeURIComponent(seasonId)}` : '';
  const response = await fetch(`${config.url}/rest/v1/player_statistics_current${query}`, {
    method: 'GET',
    headers: {
      apikey: config.serviceKey,
      Authorization: `Bearer ${config.serviceKey}`,
      accept: 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error('Falha ao listar estatísticas da temporada para zerar baseline.');
  }
  const records = await response.json();

  for (const record of records) {
    const updatePayload = {
      baseline_kills_total: 0,
      baseline_kills_firearm: 0,
      baseline_kills_melee: 0,
      baseline_survival_seconds: 0,
      kills_total: record.source_kills_total,
      kills_firearm: record.source_kills_firearm,
      kills_melee: record.source_kills_melee,
      survival_seconds: record.source_survival_seconds ?? record.survival_seconds,
    };
    await fetch(
      `${config.url}/rest/v1/player_statistics_current?season_id=eq.${record.season_id}&character_id=eq.${record.character_id}`,
      {
        method: 'PATCH',
        headers: {
          apikey: config.serviceKey,
          Authorization: `Bearer ${config.serviceKey}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify(updatePayload),
      }
    );
  }
  return { updated: records.length };
}

export default async function handler(req, res) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;

  const auth = await verifyAdminToken(token);
  if (!auth.valid) {
    return send(res, 403, { error: auth.error });
  }

  const config = getAdminConfig();

  if (req.method === 'GET') {
    try {
      const [rankingResult, seasonsResult, syncResult] = await Promise.all([
        callPublicRpc('get_public_ranking', { p_limit: 250 }),
        callPublicRpc('get_public_seasons', { p_limit: 50 }),
        callPublicRpc('get_public_ranking_status'),
      ]);

      const sync = Array.isArray(syncResult.data) ? syncResult.data[0] ?? null : syncResult.data;
      const activeSeason = seasonsResult.data?.find((s) => s.status === 'active') || null;

      return send(res, 200, {
        admin: {
          email: auth.user.email,
          hasServiceKey: Boolean(config.serviceKey),
        },
        activeSeason,
        seasons: seasonsResult.data ?? [],
        ranking: rankingResult.data ?? [],
        sync,
        stale: isStale(sync?.last_success_at),
      });
    } catch (error) {
      console.error('Falha ao carregar dados do admin:', error);
      return send(res, 500, { error: error.message || 'Erro ao carregar dados administrativos.' });
    }
  }

  if (req.method === 'POST') {
    const { action, payload = {} } = req.body || {};

    if (!config.serviceKey) {
      return send(res, 503, {
        error:
          'SUPABASE_SERVICE_ROLE_KEY não encontrada no ambiente da Vercel. Adicione a chave no painel da Vercel para autorizar ações de escrita.',
      });
    }

    try {
      if (action === 'start_season') {
        const { name, slug, reward_message } = payload;
        if (!name || !slug) {
          return send(res, 400, { error: 'Nome e slug são obrigatórios.' });
        }
        const seasonId = await callServiceRpc('start_ranking_season', {
          p_name: name.trim(),
          p_slug: slug.trim().toLowerCase(),
          p_reward_message: reward_message?.trim() || null,
        });
        return send(res, 200, { success: true, seasonId, message: 'Temporada iniciada com sucesso!' });
      }

      if (action === 'close_season') {
        const { season_id, winner_character_id } = payload;
        if (!season_id) {
          return send(res, 400, { error: 'ID da temporada é obrigatório.' });
        }
        const closedId = await callServiceRpc('close_ranking_season', {
          p_season_id: season_id,
          p_winner_character_id: winner_character_id || null,
        });
        return send(res, 200, {
          success: true,
          seasonId: closedId,
          message: 'Temporada encerrada e campeão gravado no arquivo!',
        });
      }

      if (action === 'reset_baseline') {
        const { season_id } = payload;
        const result = await resetBaseline(season_id);
        return send(res, 200, {
          success: true,
          message: `Linha de base redefinida para ${result.updated} personagens! As kills históricas agora contam no ranking.`,
        });
      }

      return send(res, 400, { error: `Ação desconhecida: ${action}` });
    } catch (error) {
      console.error('Falha na ação administrativa:', error);
      return send(res, 500, { error: error.message || 'Falha ao executar ação administrativa.' });
    }
  }

  res.setHeader('allow', 'GET, POST');
  return send(res, 405, { error: 'Método não permitido.' });
}
