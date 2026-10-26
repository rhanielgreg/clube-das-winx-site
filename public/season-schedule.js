// ended_at é o encerramento já ocorrido; nunca é uma previsão.
export function seasonDeadline(season) {
  if(season?.status!=='active'||season.schedule_verified!==true||!Number.isFinite(Date.parse(season.scheduled_end_at||'')))return null;
  const at=new Date(season.scheduled_end_at);
  const date=new Intl.DateTimeFormat('pt-BR',{timeZone:'America/Sao_Paulo',day:'2-digit',month:'2-digit',year:'numeric'}).format(at);
  const time=new Intl.DateTimeFormat('pt-BR',{timeZone:'America/Sao_Paulo',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(at).replace(':','h');
  return `Encerra em ${date} às ${time}`;
}
