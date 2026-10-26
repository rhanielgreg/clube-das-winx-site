import { callPublicRpc } from './supabase-public.js';
import { UUID } from '../public/contracts.js';
// Flag opcional ou marcador instalado pela 008; ausência mantém a data oculta.
export async function withSeasonSchedule(seasons,env=process.env,release=null) {
  const active=seasons.find(season=>season.status==='active');
  if((env.SEASON_SCHEDULE_CONTRACT_VERSION!=='season-schedule-v1'&&release?.season_schedule_contract_version!=='season-schedule-v1')||!UUID.test(active?.season_id||''))return seasons;
  try {
    const {data}=await callPublicRpc('get_public_season_schedule_v1',{p_season_id:active.season_id},{env,timeoutMs:2500});
    const record=Array.isArray(data)&&data.length===1?data[0]:null;
    if(record?.season_id!==active.season_id||record.closure_mode!=='manual'||!Number.isFinite(Date.parse(record.scheduled_end_at||'')))return seasons;
    return seasons.map(season=>season===active?{...season,scheduled_end_at:record.scheduled_end_at,schedule_verified:true,closure_mode:record.closure_mode}:season);
  }catch{return seasons;}
}
