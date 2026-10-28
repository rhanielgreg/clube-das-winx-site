import { withSeasonSchedule } from '../lib/season-schedule.js';
import { callPublicRpc, isStale } from '../lib/supabase-public.js';
import { validateAdminAction } from '../lib/admin-actions.js';
import { UUID } from '../public/contracts.js';
import { resolveDashboardContract, officialContractPending } from '../lib/championship-contract.js';

function getAdminConfig(env = process.env) {
  const url = env.SUPABASE_URL?.trim().replace(/\/$/, '');
  const publishableKey = (env.SUPABASE_PUBLISHABLE_KEY || env.SUPABASE_ANON_KEY)?.trim();
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  const adminEmail = (env.ADMIN_EMAIL || '').trim().toLowerCase();
  return { url, publishableKey, serviceKey, adminEmail };
}

function send(res, status, body) {
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.setHeader('cache-control', 'no-store, max-age=0');
  return res.status(status).json(body);
}

export async function verifyAdminToken(token, { env = process.env } = {}) {
  const config = getAdminConfig(env);
  if (!config.url || !config.publishableKey || !config.adminEmail) {
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
      signal: AbortSignal.timeout(6000),
    });

    if (!response.ok) {
      return { valid: false, error: 'Sessão inválida ou expirada.' };
    }

    const user = await response.json();
    const userEmail = (user?.email || '').trim().toLowerCase();
    if (!userEmail || userEmail !== config.adminEmail) {
      return {
        valid: false,
        error: 'Acesso administrativo não autorizado.',
      };
    }

    return { valid: true, user };
  } catch (error) {
    return { valid: false, error: error.message || 'Falha ao autenticar usuário.' };
  }
}

export async function callServiceRpc(name, params = {}, { env = process.env } = {}) {
  const config = getAdminConfig(env);
  if (!config.serviceKey) {
    throw new Error(
      'Operações administrativas indisponíveis neste ambiente.'
    );
  }

  const response = await fetch(`${config.url}/rest/v1/rpc/${name}`, {
    method: 'POST',
    headers: {
      apikey: config.serviceKey,
      ...(!config.serviceKey.startsWith('sb_') ? { Authorization: `Bearer ${config.serviceKey}` } : {}),
      'content-type': 'application/json',
    },
    body: JSON.stringify(params),
    signal: AbortSignal.timeout(6000),
  });

  if (!response.ok) {
    throw new Error(`RPC administrativa indisponível (HTTP ${response.status}).`);
  }
  return response.status === 204 ? null : response.json();
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
    if(req.query?.view==='audit'){
      const before=req.query.before,limit=req.query.limit??'20';
      if((before!=null&&(!/^[1-9][0-9]{0,18}$/.test(String(before))||BigInt(before)>9223372036854775807n))||!/^([1-9]|[1-4][0-9]|50)$/.test(String(limit)))
        return send(res,400,{error:'Paginação inválida.'});
      try{return send(res,200,await callServiceRpc('get_service_admin_audit_v1',{p_before:before??null,p_limit:Number(limit)}));}
      catch{return send(res,503,{error:'Trilha administrativa indisponível nesta consulta.'});}
    }
    const contract=await resolveDashboardContract();
    if (!contract.official) return send(res, 503, { error: officialContractPending });
    try {
      const [rankingResult, seasonsResult, syncResult, operations, audit] = await Promise.all([
        callPublicRpc(contract.life?'get_public_ranking_life_v1':'get_public_ranking', { p_limit: 100 }),
        callPublicRpc('get_public_seasons_v2', { p_limit: 50 }),
        callPublicRpc(contract.life?'get_public_pipeline_status_v1':'get_public_ranking_status'),
        config.serviceKey ? callServiceRpc('get_service_operations_v1').catch(()=>null) : null,
        config.serviceKey ? callServiceRpc('get_service_admin_audit_v1').catch(()=>null) : null,
      ]);

      const sync = Array.isArray(syncResult.data) ? syncResult.data[0] ?? null : syncResult.data;
      const seasons=contract.version==='winx-v2'?contract.product14.seasons:await withSeasonSchedule(seasonsResult.data ?? [],process.env,contract.release);
      const activeSeason = seasons.find((s) => s.status === 'active') || null;

      return send(res, 200, {
        admin: {
          email: auth.user.email,
          hasServiceKey: Boolean(config.serviceKey),
        },
        activeSeason,
        seasons,
        ranking: (rankingResult.data ?? []).map(row=>contract.version==='winx-v2'&&!contract.life
          ?{...row,life_played_seconds:row.survival_seconds,survival_seconds:null,time_scope:'unavailable_season'}:row),
        sync,
        operations,
        audit,
        checked_at:new Date().toISOString(),
        ...(contract.version==='winx-v2'?{monthly_automation:true,competition_rules:'winx-v2',
          pending_certifications:seasons.filter(s=>s.outcome==='pending_certification').length}:{}),
        stale: isStale(sync?.last_success_at),
      });
    } catch (error) {
      console.error('Falha ao carregar dados do admin:', error);
      return send(res, 500, { error: 'Erro ao carregar dados administrativos.' });
    }
  }

  if (req.method === 'POST') {
    const { action, payload = {} } = req.body || {};
    const invalid = validateAdminAction(action, payload);
    if (invalid) return send(res, invalid.status, { error: invalid.error });
    const contract=await resolveDashboardContract();
    if (!contract.official) return send(res, 503, { error: officialContractPending });
    if (contract.version==='winx-v2'&&action!=='rename_season')return send(res,409,{error:'Calendário automático ativo. Operações manuais legadas estão bloqueadas; intervenções excepcionais exigem procedimento auditado.'});

    if (!config.serviceKey) {
      return send(res, 503, {
        error:
          'Escrita administrativa não habilitada neste ambiente.',
      });
    }

    try {
      if(action==='rename_season'){
        if(contract.version!=='winx-v2'||!UUID.test(auth.user.id||''))return send(res,409,{error:'Intervenção excepcional indisponível.'});
        const result=await callServiceRpc('rename_monthly_season_v2',{p_season_id:payload.season_id,p_name:payload.name.trim(),p_reason:payload.reason.trim(),p_operator_id:auth.user.id});
        return send(res,200,{success:true,...result});
      }
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
        const closedResult = await callServiceRpc('close_ranking_season_v2', {
          p_season_id: season_id,
          p_winner_character_id: winner_character_id || null,
        });
        const result = Array.isArray(closedResult) ? closedResult[0] : null;
        if (!result || !['champion','apocalypse'].includes(result.outcome) || result.season_id !== season_id) throw new Error('Resultado oficial não confirmado');
        if (result.outcome==='champion' && (!UUID.test(result.winner_profile_id || '') || typeof result.winner_name!=='string' || !result.winner_name.trim())
          || result.outcome==='apocalypse' && (result.winner_profile_id!=null || result.winner_name!=null)) throw new Error('Resultado oficial inconsistente');
        return send(res, 200, {
          success: true,
          seasonId: result.season_id,
          outcome: result.outcome,
          message: result.outcome === 'apocalypse' ? 'Temporada encerrada. O Apocalipse Venceu.' : `Temporada encerrada. Campeão: ${result.winner_name}.`,
        });
      }

      return send(res, 400, { error: `Ação desconhecida: ${action}` });
    } catch (error) {
      console.error('Falha na ação administrativa:', error);
      return send(res, 500, { error: 'Falha ao executar ação administrativa.' });
    }
  }

  res.setHeader('allow', 'GET, POST');
  return send(res, 405, { error: 'Método não permitido.' });
}
