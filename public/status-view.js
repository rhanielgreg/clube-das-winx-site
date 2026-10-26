export const STATUS_VALIDITY_MS = 120000;
export function statusState(payload,now) {
  if(payload?.demo===true)return typeof payload.online==='boolean'?payload.online:null;
  const checked=Date.parse(payload?.checkedAt||'');
  const until=Date.parse(payload?.validUntil||'');
  if(!Number.isFinite(now)||!Number.isFinite(checked)||!Number.isFinite(until)||checked>now+60000||until<=now||until-checked>STATUS_VALIDITY_MS)return null;
  return typeof payload.online==='boolean'?payload.online:null;
}
