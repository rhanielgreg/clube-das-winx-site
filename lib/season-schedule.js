import { callPublicRpc } from './supabase-public.js';
import { UUID } from '../public/contracts.js';
// Opt-in somente depois da migração 008 e conferência do prazo operacional.
export async function withSeasonSchedule(seasons,env=process.env) {
  const active=seasons.find(season=>season.status==='active');
  if(env.SEASON_SCHEDULE_CONTRACT_VERSION!=='season-schedule-v1'||!UUID.test(active?.season_id||''))return seasons;
  try {
    const {data}=await callPublicRpc('get_public_season_schedule_v1',{p_season_id:active.season_id},{env,timeoutMs:2500});
    const record=Array.isArray(data)&&data.length===1?data[0]:null;
    if(record?.season_id!==active.season_id||record.closure_mode!=='manual'||!Number.isFinite(Date.parse(record.scheduled_end_at||'')))return seasons;
    return seasons.map(season=>season===active?{...season,scheduled_end_at:record.scheduled_end_at,schedule_verified:true,closure_mode:record.closure_mode}:season);
  }catch{return seasons;}
}
