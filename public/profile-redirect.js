import { UUID } from './contracts.js';

// Somente o perfil exato retornado pelo contrato existente pode confirmar a morte.
// Destinos fixos: parâmetros de origem/returnTo jamais controlam a navegação.
export async function legacyProfileDestination(id,fetchImpl=fetch) {
  if(!UUID.test(id||''))return '/ranking';
  try {
    const response=await fetchImpl(`/api/player?id=${encodeURIComponent(id)}`,{signal:AbortSignal.timeout(8000),cache:'no-store',redirect:'error'});
    if(!response.ok)return '/ranking';
    const {profile}=await response.json();
    return typeof profile?.profile_id==='string'&&profile.profile_id.toLowerCase()===id.toLowerCase()&&profile.alive===false?'/memorial':'/ranking';
  }catch{return '/ranking';}
}

if(typeof document!=='undefined'&&document.body.dataset.page==='profile-redirect') {
  legacyProfileDestination(new URLSearchParams(location.search).get('id')).then(destination=>location.replace(destination));
}
