export const MONTHLY_RULES = 'winx-v2';
const number=value=>typeof value==='number'&&Number.isFinite(value)&&value>=0;
// Janeiro pode começar às 02h UTC em anos históricos com horário de verão.
export function monthBoundary(year, month) {
  const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'});
  const target=Date.UTC(year,month-1,1);let guess=target;
  for(let attempt=0;attempt<4;attempt++){
    const values=Object.fromEntries(parts.formatToParts(guess).map(p=>[p.type,p.value]));
    const local=Date.UTC(+values.year,+values.month-1,+values.day,+values.hour,+values.minute,+values.second);
    if(local===target)return guess;
    guess+=target-local;
  }
  throw Error('Limite mensal não verificável.');
}
export function monthInterval(iso) {
  const date=new Date(iso);if(!Number.isFinite(date.getTime()))throw Error('Data inválida.');
  const parts=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'numeric'}).formatToParts(date).map(p=>[p.type,p.value]));
  const year=+parts.year,month=+parts.month;
  return {start:new Date(monthBoundary(year,month)).toISOString(),end:new Date(monthBoundary(month===12?year+1:year,month===12?1:month+1)).toISOString()};
}
export function belongsToSeason(at,season) {const t=Date.parse(at);return Number.isFinite(t)&&t>=Date.parse(season.started_at)&&t<Date.parse(season.logical_end_at);}
export function championshipOutcome(rows,{complete=false}={}) {
  if(!complete||!Array.isArray(rows)||rows.length===0||rows.some(r=>typeof r.alive!=='boolean'||r.certified!==true))return {outcome:'pending_certification',winner:null};
  const living=rows.filter(r=>r.alive===true);
  if(!living.length)return {outcome:'apocalypse',winner:null};
  if(living.some(r=>!number(r.kills_total)||!number(r.played_seconds)))return {outcome:'pending_certification',winner:null};
  living.sort((a,b)=>b.kills_total-a.kills_total||b.played_seconds-a.played_seconds);
  const first=living[0],second=living[1];
  if(second&&first.kills_total===second.kills_total&&first.played_seconds===second.played_seconds)return {outcome:'technical_tie',winner:null};
  return {outcome:'champion',winner:first.profile_id};
}
export const thematicSeasonName=(number,year,month)=>`Temporada ${number} — ${['O Despertar dos Mortos','A Última Resistência','Ecos da Quarentena','Horizonte em Cinzas','Depois do Silêncio','A Marcha dos Esquecidos'][(number-2)%6<0?0:(number-2)%6]} · ${String(month).padStart(2,'0')}/${year}`;

// Intervalos de incremento que cruzam a virada não recebem competência por suposição.
export function temporalDelta(previous,current,season) {
  if(!previous||!current||!number(previous.value)||!number(current.value)||current.value<previous.value)return {state:'invalid',value:null};
  const a=Date.parse(previous.observed_at),b=Date.parse(current.observed_at);
  if(!Number.isFinite(a)||!Number.isFinite(b)||a>=b)return {state:'invalid',value:null};
  const delta=current.value-previous.value;
  if(delta===0)return {state:'certified',value:0};
  return belongsToSeason(previous.observed_at,season)&&belongsToSeason(current.observed_at,season)
    ?{state:'certified',value:delta}:{state:'uncertain_interval',value:null,observed_delta:delta};
}
