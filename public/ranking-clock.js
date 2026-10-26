// O relógio de parede do visitante nunca define a hora oficial.
export function clockNow(clock,monotonicNow) {
  return Number.isFinite(clock?.server)&&Number.isFinite(clock?.received)&&Number.isFinite(monotonicNow)&&monotonicNow>=clock.received
    ? clock.server+monotonicNow-clock.received : NaN;
}

export function rankingClock(payload,headers,received,previous=null) {
  if(!Number.isFinite(received))return null;
  const generated=Date.parse(payload?.server_time||'');
  const responseDate=Date.parse(headers.get('date')||'');
  const age=Number(headers.get('age')||0);
  const aged=Number.isFinite(generated)?generated+(Number.isFinite(age)&&age>=0?age*1000:0):NaN;
  // Date também cobre proxies que renovam o cabeçalho mas omitem/resetam Age.
  const candidates=[aged,responseDate].filter(Number.isFinite);
  if(!candidates.length)return null;
  let server=Math.max(...candidates);
  const previousNow=clockNow(previous,received);
  // Absorve a precisão de segundos do HTTP sem recuar a cada atualização.
  if(Number.isFinite(previousNow)&&previousNow>server&&previousNow-server<=2000)server=previousNow;
  return {server,received};
}
