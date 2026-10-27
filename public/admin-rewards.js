import {escapeHtml as safe} from './contracts.js';
import {rarityNames,deliveryNames,rewardAnnouncement,deliveryActions,rewardDate} from './rewards-view.js';
const reasons={season_open:'Temporada em andamento',pending_certification:'Resultado pendente de certificação',technical_tie:'Empate técnico — sem campeão individual',apocalypse:'O Apocalipse Venceu',identity_unverified:'Identidade da vida não comprovada',world_unverified:'Geração do mundo não comprovada',forfeited:'Vida campeã morta — direito material perdido',survival_unknown:'Sobrevivência desconhecida',stale_survival:'Atualize a evidência de sobrevivência',cohort_inactive:'Coorte certificada ainda inativa',eligible:'Campeão individual e vida verificados'};
const controllers=new WeakMap();
export function mountAdminRewards({token}){
 const root=document.querySelector('[data-admin-rewards]');if(!root)return;
 if(controllers.has(root)){controllers.get(root).refresh();return;}
 let dashboard=null,busy=false,audio=null;
 const soundKey='winx.rewards.sound';let sound=true;try{sound=localStorage.getItem(soundKey)!=='muted';}catch{}
 const authHeaders=()=>({'content-type':'application/json',authorization:`Bearer ${token()||''}`});
 async function request(body){const response=await fetch('/api/admin-rewards',{method:body?'POST':'GET',headers:authHeaders(),cache:'no-store',...(body?{body:JSON.stringify(body)}:{})});const data=await response.json();if(!response.ok)throw Error(data.error||'Premiações indisponíveis.');return data;}
 function render(){
  root.innerHTML=`<p>Probabilidades oficiais: Comum 45% · Incomum 30% · Rara 20% · Épica 4% · Lendária 1%.</p><p>O backend grava o resultado antes da animação. Entrega manual auditada; nenhum comando é enviado ao jogo por este painel.</p>
   <label><input type="checkbox" data-reward-sound ${sound?'checked':''}> Som da roleta</label> <button type="button" class="button button-ghost button-small" data-rewards-refresh>Atualizar premiações</button>
   <p data-reward-feedback role="status" aria-live="polite"></p>
   <details><summary>Catálogo, pesos e comprovação técnica</summary>${dashboard?.catalog?`<p>Versão: ${safe(dashboard.catalog.version)} · ${dashboard.catalog.active?'Ativo':'Inativo'}</p><ul>${dashboard.catalog.rewards.map(r=>`<li>${safe(rarityNames[r.rarity])} · ${safe(r.name)} · peso ${safe(r.weight)} · ${r.verified?'IDs verificados':'Validação técnica pendente'}<br>${r.items.map(i=>`${safe(i.quantity)} × ${safe(i.script_id)}`).join(' + ')} · condição padrão, sem promessa de condição máxima.</li>`).join('')}</ul>`:'<p>Catálogo técnico ainda não ativado. Nenhum sorteio pode ocorrer sem as cinco raridades válidas.</p>'}</details>
   <div data-reward-seasons>${(dashboard?.seasons||[]).map(s=>{
    const d=s.draw,eligible=s.eligibility?.eligible===true&&dashboard.catalog?.active===true;
    return `<article class="reward-season" data-reward-season="${safe(s.season_id)}"><h3>${safe(s.season_name)}</h3><p>${safe(s.character_name||'Sem campeão individual certificado')}${s.steam_username?' · '+safe(s.steam_username):''}</p><p>${safe(reasons[s.eligibility?.reason]||'Certificação indisponível')}</p>
     ${s.eligibility?.life_id?`<p>Vida: <code>${safe(s.eligibility.life_id)}</code> · última observação: ${safe(rewardDate(s.eligibility.last_observed_at))}</p>`:''}
     ${d?`<div class="reward-result"><small>RESULTADO OFICIAL PERSISTIDO</small><h4>${safe(d.reward_snapshot.name)}</h4><p>${safe(rarityNames[d.rarity])} · ${safe(rewardDate(d.drawn_at))}</p><p>${safe(deliveryNames[d.delivery_state])}</p><ul>${d.reward_snapshot.items.map((i,index)=>`<li>${safe(i.quantity)} × ${safe(i.script_id)} · ${safe(deliveryNames[d.components?.find(c=>c.component===index)?.state||'pending'])}</li>`).join('')}</ul><button type="button" class="button button-ghost button-small" data-reward-copy>Copiar divulgação</button></div>
      <details><summary>Entrega manual e reconciliação</summary><p>Confira diretamente no servidor a conta e esta vida exata, viva e online. Registre evidência verificável. Confirmação manual não é prova automatizada de inventário.</p>
       <label><input type="checkbox" data-delivery-identity> Conferi a conta e a mesma vida premiada</label><label>Evidência de identidade/entrega<textarea data-delivery-evidence minlength="20" maxlength="2000" rows="3"></textarea></label>
       <label>Componente <select data-delivery-component>${d.reward_snapshot.items.map((i,index)=>`<option value="${index}">${index+1}: ${safe(i.script_id)}</option>`).join('')}</select></label>
       <div class="reward-actions">${[['begin_manual','Iniciar registro manual'],['offline','Registrar offline'],['block','Bloquear por identidade'],['sent','Registrar envio não comprovado'],['uncertain','Registrar resultado incerto'],['confirm_component','Confirmar este componente manualmente'],['not_delivered','Comprovar que este componente não foi entregue']].map(([action,label])=>`<button type="button" class="button button-ghost button-small" data-delivery-action="${action}" ${deliveryActions(d.delivery_state).includes(action)?'':'disabled'}>${label}</button>`).join('')}</div><p>Após incerteza, reconciliar cada componente antes de qualquer nova tentativa. Nunca repetir um componente já confirmado.</p>
       <details><summary>Trilha de auditoria</summary><ol>${(d.events||[]).map(e=>`<li>${safe(e.created_at)} · ${safe(e.action)} → ${safe(e.new_state)} · operador ${safe(e.operator_id||'origem nativa')}<p>${safe(e.evidence||'')}</p></li>`).join('')}</ol></details></details>`
     :`<label><input type="checkbox" data-draw-identity ${eligible?'':'disabled'}> Conferi o campeão e a vida indicada</label><button type="button" class="button button-pink" data-reward-draw ${eligible?'':'disabled'}>Sortear prêmio oficial</button>`}</article>`;
   }).join('')||'<p>Nenhuma temporada disponível nesta consulta.</p>'}</div>`;
 }
 async function refresh(){if(busy)return;try{dashboard=await request();render();}catch(error){root.textContent=error.message;const button=document.createElement('button');button.textContent='Consultar novamente';button.type='button';button.addEventListener('click',refresh);root.append(button);}}
 function primeSound(){if(!sound)return;try{audio??=new(window.AudioContext||window.webkitAudioContext)();audio.resume().catch(()=>{});}catch{audio=null;}}
 function tick(){if(!sound||!audio)return;try{const oscillator=audio.createOscillator(),gain=audio.createGain();gain.gain.value=.025;oscillator.frequency.value=700;oscillator.connect(gain);gain.connect(audio.destination);oscillator.start();oscillator.stop(audio.currentTime+.035);}catch{}}
 async function animate(draw){
  const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
  const region=document.createElement('div');region.className='reward-animation';region.innerHTML='<div class="reward-pointer" aria-hidden="true">▼</div><div class="reward-wheel" aria-hidden="true"></div><p role="status">Resultado já gravado. Revelando a premiação…</p>';root.prepend(region);
  region.scrollIntoView({behavior:reduced?'instant':'smooth',block:'center'});
  if(!reduced){const centers={common:81,uncommon:216,rare:306,epic:349.2,legendary:358.2};const rotation=2160+360-centers[draw.rarity];const wheel=region.querySelector('.reward-wheel');const effect=wheel.animate([{transform:'rotate(0deg)'},{transform:`rotate(${rotation}deg)`}],{duration:9500,easing:'cubic-bezier(.12,.75,.18,1)',fill:'forwards'});const timer=setInterval(tick,360);try{await effect.finished;}finally{clearInterval(timer);}}
  region.remove();
 }
 root.addEventListener('change',event=>{if(event.target.matches('[data-reward-sound]')){sound=event.target.checked;try{localStorage.setItem(soundKey,sound?'on':'muted');}catch{}}});
 root.addEventListener('click',async event=>{
  const button=event.target.closest('button');if(!button||busy)return;
  if(button.matches('[data-rewards-refresh]'))return refresh();
  const card=button.closest('[data-reward-season]'),season=dashboard?.seasons?.find(s=>s.season_id===card?.dataset.rewardSeason);if(!season)return;
  if(button.matches('[data-reward-copy]')){try{await navigator.clipboard.writeText(rewardAnnouncement({...season,...season.draw.presentation_snapshot,reward_name:season.draw.reward_snapshot.name,rarity:season.draw.rarity}));root.querySelector('[data-reward-feedback]').textContent='Texto copiado.';}catch{root.querySelector('[data-reward-feedback]').textContent='Não foi possível copiar neste navegador.';}return;}
  const draw=button.matches('[data-reward-draw]'),action=draw?'draw':button.dataset.deliveryAction;if(!action)return;
  const confirmed=card.querySelector(draw?'[data-draw-identity]':'[data-delivery-identity]')?.checked;
  if(!confirmed){root.querySelector('[data-reward-feedback]').textContent='Confira e confirme a mesma vida antes de continuar.';return;}
  if(draw)primeSound();busy=true;button.disabled=true;
  try{
   const data=await request({action,season_id:season.season_id,life_id:season.draw?.life_id||season.eligibility.life_id,request_id:crypto.randomUUID(),confirm_identity:true,
    ...(draw?{}:{evidence:card.querySelector('[data-delivery-evidence]').value,component:Number(card.querySelector('[data-delivery-component]').value)})});
   dashboard=data.dashboard;if(!dashboard)throw Error('Atualize para consultar o resultado.');
   if(draw&&!data.existing){const persisted=dashboard.seasons.find(s=>s.season_id===season.season_id)?.draw;if(!persisted)throw Error('Consulte o registro persistido.');await animate(persisted);}
   render();root.querySelector('[data-reward-feedback]').textContent='Registro persistido confirmado.';
  }catch(error){root.querySelector('[data-reward-feedback]').textContent=error.message+' Use Atualizar premiações antes de qualquer nova tentativa.';}
  finally{busy=false;}
 });
 controllers.set(root,{refresh});refresh();
}
