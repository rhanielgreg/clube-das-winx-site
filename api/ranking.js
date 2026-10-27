import { callPublicRpc, isStale } from '../lib/supabase-public.js';
import { enrichRankingWithAvatars } from '../lib/steam-avatar.js';
import { normalizeCharacter } from '../public/contracts.js';
import { livingRanking, OFFICIAL_RULES } from '../public/championship.js';
import { resolveDashboardContract, officialContractPending } from '../lib/championship-contract.js';
import { withSeasonSchedule } from '../lib/season-schedule.js';
import { killBreakdown } from '../public/kill-breakdown.js';
import { championshipOutcome } from '../public/monthly-championship.js';

function send(res, status, body) {
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.setHeader('cache-control', status === 200 ? 'no-store, max-age=0' : 'no-store');
  return res.status(status).json(body);
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('allow', 'GET');
    return send(res, 405, { error: 'Método não permitido.' });
  }

  const contract=await resolveDashboardContract();
  if (!contract.official && process.env.SUPABASE_URL && (process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY)) {
    return send(res, 503, { state: 'awaiting_official_contract', error: officialContractPending, ranking: [], seasons: [] });
  }
  try {
    const lifeEnabled=contract.life;
    const [rankingResult, seasonsResult, syncResult, graveyardResult,honorsResult] = await Promise.all([
      callPublicRpc(lifeEnabled?'get_public_ranking_life_v1':'get_public_ranking', { p_limit: 100 }),
      callPublicRpc('get_public_seasons_v2', { p_limit: 8 }),
      callPublicRpc(lifeEnabled?'get_public_pipeline_status_v1':'get_public_ranking_status'),
      callPublicRpc(lifeEnabled?'get_public_graveyard_life_v1':'get_public_graveyard_v2', { p_limit: 50 }).catch(() => ({ data: null, unavailable: true })),
      lifeEnabled?callPublicRpc('get_public_memorial_honors_v1').catch(()=>({data:null})):Promise.resolve({data:null}),
    ]);

    if (!rankingResult.configured) {
      return send(res, 200, {
        configured: false,
        state: 'awaiting_configuration',
        ranking: [],
        graveyard: [],
        graveyard_state: 'unavailable',
        seasons: [],
        sync: null,
        message: 'Ranking aguardando a conexão segura com o Supabase.',
      });
    }

    const ranking = livingRanking((rankingResult.data ?? []).map(normalizeCharacter));
    for (const row of ranking) row.kill_breakdown=killBreakdown(row);
    const graveyard = Array.isArray(graveyardResult.data) ? graveyardResult.data.map(normalizeCharacter) : null;
    await Promise.all([enrichRankingWithAvatars(ranking), enrichRankingWithAvatars(graveyard)]);

    const sync = Array.isArray(syncResult.data) ? syncResult.data[0] ?? null : syncResult.data;
    const monthly=contract.version==='winx-v2';
    if(contract.product14?.medals_enabled)for(const row of [...ranking,...(graveyard||[])])row.medal_catalog_active=true;
    if(monthly){
      for(const row of [...ranking,...(graveyard||[])])row.monthly_contract=true;
      for(const row of ranking){
        row.distance_total_m=null;
        row.time_scope=lifeEnabled?'season_observed_lower_bound':'unavailable_season';
        if(!lifeEnabled){row.life_played_seconds=row.survival_seconds;row.survival_seconds=null;}
      }
      ranking.sort((a,b)=>Number(b.kills_total)-Number(a.kills_total)
        ||(b.survival_seconds??-1)-(a.survival_seconds??-1)||a.profile_id.localeCompare(b.profile_id));
      ranking.forEach((row,index)=>{row.rank_position=index+1;});
    }
    const seasons=monthly?contract.product14.seasons:await withSeasonSchedule(seasonsResult.data ?? [],process.env,contract.release);
    return send(res, 200, {
      configured: true,
      competition_rules: contract.version||OFFICIAL_RULES,
      ...(monthly?{monthly_automation:contract.product14.monthly_enabled,certification_state:lifeEnabled?'pending_boundary_evidence':'pending_verified_lives',
        official_result:championshipOutcome(ranking.map(r=>({...r,played_seconds:r.survival_seconds,certified:false}))),
        catalog_version:contract.product14.medals_enabled?'medals-v2':'legacy-100-v1'}:{}),
      memorial_honors:Array.isArray(honorsResult.data)?honorsResult.data:null,
      state: ranking.length ? 'ready' : 'awaiting_validated_stats',
      ranking,
      graveyard,
      graveyard_state: Array.isArray(graveyardResult.data) ? 'ready' : 'unavailable',
      time_metric: 'played_seconds',
      life_identity_verified: lifeEnabled&&ranking.length>0&&ranking.every(row=>row.life_identity_verified===true),
      cohort_started_at:contract.release?.cohort_started_at||null,
      seasons,
      sync:sync?{...sync,...(contract.release?{latest_attempt_at:contract.release.latest_attempt_at,latest_attempt_status:contract.release.latest_attempt_status,
        collector_interval_seconds:contract.release.collector_interval_seconds,collector_cron_utc:contract.release.collector_cron_utc}: {})}:null,
      stale: isStale(sync?.last_success_at)||['failed','running'].includes(contract.release?.latest_attempt_status||sync?.latest_attempt_status),
      message: ranking.length
        ? null
        : 'Aguardando estatísticas validadas do servidor para abrir a disputa.',
      server_time:new Date().toISOString(),
    });
  } catch (error) {
    console.error('Falha ao carregar ranking:', error);
    return send(res, 503, {
      configured: true,
      state: 'temporarily_unavailable',
      ranking: [],
      graveyard: null,
      graveyard_state: 'unavailable',
      seasons: [],
      sync: null,
      message: 'O ranking está temporariamente indisponível. O status do servidor continua funcionando.',
    });
  }
}
