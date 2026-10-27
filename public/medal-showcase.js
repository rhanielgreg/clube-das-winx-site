import {escapeHtml as safe,UUID} from './contracts.js';
import {medalSvg} from './achievement-view.js';
export function medalShowcase(data){
 if(data?.identity_verified!==true)return '<p class="medal-state">Medalhas indisponíveis para esta vida.</p>';
 if(data.catalog_version!=='medals-v2'||!Array.isArray(data.visible))return '<p class="medal-state">Medalhas indisponíveis nesta consulta.</p>';
 if(!data.visible.length)return '<p class="medal-state">Nenhuma medalha confirmada nesta consulta.</p>';
 const render=rows=>rows.map(a=>`<details class="medal-item"><summary>${medalSvg(a)}<span>${safe(a.name)}</span></summary><p>${safe(a.description)}</p></details>`).join('');
 return `<div class="medal-items">${render(data.visible.slice(0,6))}</div>${data.visible.length>6?`<details><summary>Ver todas as ${data.visible.length} medalhas</summary><div class="medal-items">${render(data.visible.slice(6))}</div></details>`:''}`;
}
export function mountMedals(grid,rows){
 if(!grid||!rows.some(r=>r.medal_catalog_active))return;
 if(!document.querySelector('link[data-medals-style]')){const link=document.createElement('link');link.rel='stylesheet';link.href='/medals-v2.css';link.dataset.medalsStyle='true';document.head.append(link);}
 [...grid.querySelectorAll('article')].forEach((card,index)=>{
  const row=rows[index];if(!row?.medal_catalog_active||!UUID.test(row.profile_id||''))return;
  const host=document.createElement('div');host.className='medal-showcase';
  const target=card.querySelector('.memorial-card-body')||card;
  if(row.life_identity_verified!==true){host.innerHTML=medalShowcase({identity_verified:false});target.append(host);return;}
  const details=document.createElement('details');details.innerHTML='<summary>Medalhas desta vida</summary><div class="medal-content" role="status">Abra para consultar.</div>';
  let loaded=false,busy=false;
  details.addEventListener('toggle',async()=>{
   if(!details.open||loaded||busy)return;busy=true;
   const body=details.querySelector('.medal-content');body.textContent='Consultando…';
   try{const response=await fetch('/api/achievements?id='+encodeURIComponent(row.profile_id),{cache:'no-store'});if(!response.ok)throw Error();body.innerHTML=medalShowcase(await response.json());loaded=true;}
   catch{body.textContent='Não foi possível consultar. Feche e abra para tentar novamente.';}finally{busy=false;}
  });host.append(details);target.append(host);
 });
}
