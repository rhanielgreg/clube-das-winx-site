// ended_at é o encerramento já ocorrido; nunca é uma previsão.
function deadlineTimestamp(season) {
  const value=season?.scheduled_end_at;
  // Um horário sem offset dependeria do fuso do navegador.
  const parts=typeof value==='string'&&value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d{1,6})?)?(?:Z|[+-]\d{2}:\d{2})$/);
  if(season?.status!=='active'||season.schedule_verified!==true||!parts)return NaN;
  const [year,month,day,hour,minute,second]=parts.slice(1).map(value=>Number(value??0));
  if(month<1||month>12||day<1||day>new Date(Date.UTC(year,month,0)).getUTCDate()||hour>23||minute>59||second>59)return NaN;
  return Date.parse(value);
}
export function seasonDeadline(season) {
  const timestamp=deadlineTimestamp(season);
  if(!Number.isFinite(timestamp))return null;
  const at=new Date(timestamp);
  const date=new Intl.DateTimeFormat('pt-BR',{timeZone:'America/Sao_Paulo',day:'2-digit',month:'2-digit',year:'numeric'}).format(at);
  const time=new Intl.DateTimeFormat('pt-BR',{timeZone:'America/Sao_Paulo',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(at).replace(':','h');
  return season.deadline_exclusive===true
    ? `Virada automática em ${date} às ${time} (Brasília) — limite exclusivo`
    : `Encerra em ${date} às ${time}`;
}

// Apresentação somente: atingir zero nunca encerra a temporada nem certifica título.
export function seasonCountdown(season,now) {
  if(season?.status==='closed')return 'Temporada encerrada';
  if(season?.status!=='active')return null;
  const deadline=deadlineTimestamp(season);
  if(!Number.isFinite(deadline))return 'Prazo indisponível';
  if(!Number.isFinite(now))return 'Contagem indisponível';
  const seconds=Math.ceil((deadline-now)/1000);
  if(seconds<=0)return season.closure_mode==='manual'
    ? 'Prazo encerrado — aguardando encerramento oficial'
    : 'Prazo encerrado — aguardando confirmação';
  const days=Math.floor(seconds/86400);
  const hours=Math.floor(seconds%86400/3600);
  const minutes=Math.floor(seconds%3600/60);
  return `${days}d ${String(hours).padStart(2,'0')}h ${String(minutes).padStart(2,'0')}m ${String(seconds%60).padStart(2,'0')}s`;
}
