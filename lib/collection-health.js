export function collectionHealth(data) {
 const time=value=>typeof value==='string'&&Number.isFinite(Date.parse(value))?Date.parse(value):NaN;
 const now=time(data?.server_time),last=time(data?.last_success_at),attempt=time(data?.latest_attempt_at);
 if(data?.contract!=='collection-health-v1'||!Number.isFinite(now)||data.interval_seconds!==300
  ||!Number.isInteger(data.consecutive_failures)||data.consecutive_failures<0||data.consecutive_failures>50
  ||![null,'running','success','failed','skipped'].includes(data.latest_attempt_status)
  ||Number.isFinite(last)&&last>now+60000||Number.isFinite(attempt)&&attempt>now+60000)
  return {state:'unknown',reason:'unverified_health_contract'};
 const age=Number.isFinite(last)?Math.max(0,Math.floor((now-last)/1000)):null;
 const runningAge=Number.isFinite(attempt)?Math.max(0,(now-attempt)/1000):null;
 const state=data.latest_attempt_status==='running'&&runningAge!==null&&runningAge<=600?'collecting'
  :data.latest_attempt_status==='running'&&runningAge!==null&&runningAge>600?'stalled'
  :data.consecutive_failures>=3?'repeated_failures'
  :age===null?'awaiting_first_success':age>900?'delayed'
  :data.latest_attempt_status==='failed'?'retry_needed':'healthy';
 const families=['source_authentication','source_host_key','source_connection','snapshot','parser_or_identity','ingestion','contract','unclassified'];
 return {state,last_success_at:Number.isFinite(last)?data.last_success_at:null,
  latest_attempt_at:Number.isFinite(attempt)?data.latest_attempt_at:null,
  latest_attempt_status:data.latest_attempt_status,age_seconds:age,
  consecutive_failures:data.consecutive_failures,
  failure_family:data.latest_attempt_status==='failed'&&families.includes(data.failure_family)?data.failure_family:null,
  game_server_state:'not_assessed',contract:'collection-health-v1',server_time:data.server_time};
}
