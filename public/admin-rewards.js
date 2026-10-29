import {escapeHtml as safe,UUID} from './contracts.js';
import {rarityNames,deliveryNames,rewardAnnouncement,deliveryActions,rewardDate} from './rewards-view.js';
import {catalogMarkup,rarityChances} from './reward-presentation.js';
import {rouletteMarkup,mountRouletteMachine} from './roulette-machine.js';
import {rewardRecords,historyMarkupV3,filterRewardHistory,historyRowsV3,pendingSeasonsMarkup} from './reward-history-v3.js';
import {weekendDeliveryMarkup} from './weekend-delivery-view.js';
import {itemQuantities} from './roulette-item-view.js';
const reasons={season_open:'Temporada em andamento',pending_certification:'Resultado pendente de certificação',technical_tie:'Empate técnico — sem campeão individual',apocalypse:'O Apocalipse Venceu',identity_unverified:'Identidade da vida não comprovada',world_unverified:'Geração do mundo não comprovada',forfeited:'Vida campeã morta — direito material perdido',survival_unknown:'Sobrevivência desconhecida',stale_survival:'Atualize a evidência de sobrevivência',cohort_inactive:'Coorte certificada ainda inativa',eligible:'Campeão individual e vida verificados'};
const controllers=new WeakMap();
export function mountAdminRewards({token,demonstrationFixture=false}){
 const root=document.querySelector('[data-admin-rewards]');if(!root)return;
 if(controllers.has(root)){controllers.get(root).refresh();return;}
 let dashboard=null,busy=false,selected=null,machine=null,mode=demonstrationFixture?'demo':'weekend',participantId=null,weeklyDrawId=null,pendingPlan=null;
 const bookmarked=new URLSearchParams(location.search).get('weekend_reward');if(UUID.test(bookmarked||''))weeklyDrawId=bookmarked;
 const rememberWeekly=()=>{const url=new URL(location.href);if(weeklyDrawId)url.searchParams.set('weekend_reward',weeklyDrawId);else url.searchParams.delete('weekend_reward');history.replaceState(null,'',url.pathname+url.search+url.hash);};
 if(!document.querySelector('link[data-roulette-style]')){const style=document.createElement('link');style.rel='stylesheet';style.href='/roulette.css';style.dataset.rouletteStyle='true';document.head.append(style);}
 const filters={rarity:'all',search:''};
 const historyFilters={modality:'all',participant:'',prize:'',from:'',to:'',delivery:'all'};
 const records=()=>rewardRecords(dashboard?.seasons||[],dashboard?.weekly?.draws||[]);
 const selectedWeekly=()=>dashboard?.weekly?.draws?.find(d=>d.id===weeklyDrawId)||dashboard?.weekly?.draws?.find(d=>d.account_id===participantId&&Date.parse(d.window_start)===Date.parse(dashboard?.weekly?.window?.starts_at));
 const selectedDraw=()=>mode==='official'?dashboard?.seasons?.find(s=>s.season_id===selected)?.draw:selectedWeekly();
 const authHeaders=()=>({'content-type':'application/json',authorization:`Bearer ${token()||''}`});
 async function request(body,readDrawId=null){const response=await fetch('/api/admin-rewards'+(readDrawId?'?weekend_draw='+encodeURIComponent(readDrawId):''),{method:body?'POST':'GET',headers:authHeaders(),cache:'no-store',signal:AbortSignal.timeout(body?.action==='remote_send'?55000:body?15000:8000),...(body?{body:JSON.stringify(body)}:{})});const data=await response.json();if(!response.ok)throw Error(data.error||'Premiações indisponíveis.');return data;}
 function render(){
  let audioContext=null;
  if(machine){mode=machine.mode;audioContext=machine.releaseAudio();machine.destroy();machine=null;}
  const seasons=dashboard?.seasons||[];
  const current=seasons.find(s=>s.season_id===selected)||seasons[0];selected=current?.season_id||null;
  const catalog=dashboard?.catalog,eligible=current?.eligibility?.eligible===true&&catalog?.active===true;
  root.innerHTML=`${rouletteMarkup({catalog,current,seasons,eligible,reason:reasons[current?.eligibility?.reason],mode,demonstrationFixture,weekly:dashboard?.weekly,participantId,weeklyDrawId,remoteReady:dashboard?.remote?.configured===true&&dashboard?.weekly?.remote_release_ready===true})}
   <div data-admin-view="catalog"><div class="reward-catalog-summary"><section class="kpi-tile"><small>CATÁLOGO ATUAL</small><strong>${catalog?.rewards?.length||0}</strong><span class="kpi-sub">Recompensas na versão consultada</span></section><section class="kpi-tile"><small>RARIDADES</small><strong>5</strong><span class="kpi-sub">45 / 30 / 20 / 4 / 1</span></section><section class="kpi-tile"><small>SORTEIOS PERSISTIDOS</small><strong>${records().length}</strong><span class="kpi-sub">Na consulta administrativa</span></section></div><div class="admin-panel"><p>Versão: <strong>${safe(catalog?.version||'Indisponível')}</strong> · ${catalog?.active?'Ativa':'Não ativa'}. Histórico preservado por versão; cada sorteio conserva seu catálogo e prêmio.</p><p class="muted">As chances individuais abaixo incluem o peso de cada recompensa dentro de sua raridade. Condição padrão, sem promessa de condição máxima.</p></div><div class="admin-panel reward-filters"><label>Buscar prêmio<input type="search" data-catalog-search value="${safe(filters.search)}" placeholder="Nome do prêmio"></label><label>Raridade<select data-catalog-rarity><option value="all">Todas as raridades</option>${Object.keys(rarityChances).map(r=>`<option value="${r}" ${filters.rarity===r?'selected':''}>${safe(rarityNames[r])}</option>`).join('')}</select></label><button type="button" class="button button-ghost" data-catalog-clear>Limpar filtros</button><p>Itens do catálogo ativo conferidos na fonte. A chance da raridade é distribuída pelos pesos individuais.</p></div><div data-catalog-results>${catalogMarkup(catalog,filters)}</div>
   <section class="admin-panel"><div class="panel-header"><h2>🏆 Histórico de campeões e premiações</h2><button type="button" class="button button-ghost button-small" data-rewards-refresh>ATUALIZAR DADOS</button></div>${historyMarkupV3(records(),historyFilters)}${pendingSeasonsMarkup(seasons)}</section>
   <section class="admin-panel"><h2>📦 Entrega e reconciliação</h2>${weekendDeliveryMarkup(dashboard?.weekly?.draws||[])}${seasons.filter(s=>s.draw).map(s=>{const d=s.draw;return `<article class="reward-season" data-reward-season="${safe(s.season_id)}"><h3>${safe(s.season_name)}</h3><p>${safe(s.character_name||d.presentation_snapshot?.character_name||'Campeão certificado')} · <strong>${safe(d.reward_snapshot.name)}</strong></p><span class="status-badge warning">${safe(deliveryNames[d.delivery_state]||'Estado não informado')}</span><ul>${d.reward_snapshot.items.map((i,index)=>`<li>Componente ${index+1} · ${safe(i.quantity)} × ${safe(i.script_id)} · ${safe(deliveryNames[d.components?.find(c=>c.component===index)?.state||'pending'])}</li>`).join('')}</ul><button type="button" class="button button-ghost button-small" data-reward-copy>Copiar divulgação</button>
     <details><summary>Entrega manual e reconciliação por componente</summary><p>Confira no servidor a conta e esta vida exata, viva e online. Registre evidência verificável. Confirmação manual não é prova automatizada do inventário.</p><label><input type="checkbox" data-delivery-identity> Conferi a conta e a mesma vida premiada</label><label>Evidência de identidade/entrega<textarea data-delivery-evidence minlength="20" maxlength="2000" rows="3"></textarea></label><label>Componente <select data-delivery-component>${d.reward_snapshot.items.map((i,index)=>`<option value="${index}">${index+1}: ${safe(i.script_id)}</option>`).join('')}</select></label><div class="reward-actions">${[['begin_manual','Iniciar registro manual'],['offline','Registrar offline'],['block','Bloquear por identidade'],['sent','Registrar envio não comprovado'],['uncertain','Registrar resultado incerto'],['confirm_component','Confirmar este componente manualmente'],['not_delivered','Comprovar que este componente não foi entregue']].map(([action,label])=>`<button type="button" class="button button-ghost button-small" data-delivery-action="${action}" ${deliveryActions(d.delivery_state).includes(action)?'':'disabled'}>${label}</button>`).join('')}</div><p>Após incerteza, reconciliar cada componente antes de qualquer nova tentativa. Nunca repetir componente confirmado.</p><details><summary>Identidade e trilha de auditoria</summary><p>Vida premiada: <code>${safe(d.life_id)}</code> · Versão: ${safe(d.catalog_version)}</p><ol>${(d.events||[]).map(e=>`<li>${safe(rewardDate(e.created_at))} · ${safe(e.action)} → ${safe(e.new_state)} · operador ${safe(e.operator_id||'origem nativa')}<p>${safe(e.evidence||'')}</p></li>`).join('')}</ol></details></details></article>`;}).join('')||'<div class="reward-empty"><h3>Aguardando premiação oficial</h3><p>Quando houver sorteio persistido, a identidade e cada componente entregue poderão ser auditados aqui.</p><p>Gerenciamento disponível após sorteio oficial.</p></div>'}</section></div>
   <p class="reward-feedback" data-reward-feedback role="status" aria-live="polite"></p>`;
  machine=mountRouletteMachine(root.querySelector('[data-roulette-machine]'),{catalog,current,mode,audioContext,selectedDraw:selectedDraw(),onMode:next=>{mode=next;if(!demonstrationFixture){render();root.querySelector(`[data-roulette-mode="${next}"]`)?.focus();}}});
  document.dispatchEvent(new Event('admin-content-ready'));
 }
 async function refresh(){if(busy)return;pendingPlan=null;root.querySelector('[data-remote-confirm]')?.remove();machine?.cancel('refresh');try{const data=await request();if(weeklyDrawId&&!data.weekly?.draws?.some(d=>d.id===weeklyDrawId)){const extra=await request(null,weeklyDrawId);if(extra.weekly?.draws?.length)data.weekly={...data.weekly,draws:[...(data.weekly?.draws||[]),...extra.weekly.draws]};}dashboard=data;if(weeklyDrawId&&mode==='weekend')participantId=dashboard.weekly?.draws?.find(d=>d.id===weeklyDrawId)?.account_id||participantId;render();}catch(error){dashboard=null;render();root.querySelector('[data-reward-feedback]').textContent=error.message;}}
 const filterHistory=()=>{root.querySelector('[data-history-results]').innerHTML=historyRowsV3(filterRewardHistory(records(),historyFilters));};
 const filterCatalog=()=>{root.querySelector('[data-catalog-results]').innerHTML=catalogMarkup(dashboard?.catalog,filters);};
 root.addEventListener('submit',async event=>{
  if(!event.target.matches('[data-weekend-registration]'))return;event.preventDefault();if(busy)return;
  const form=event.target,button=form.querySelector('button'),fields=new FormData(form);busy=true;button.disabled=true;
  try{await request({action:'weekly_register',steam_id:fields.get('steam_id'),display_name:fields.get('display_name'),game_username:fields.get('game_username')});
   dashboard=await request();render();root.querySelector('[data-reward-feedback]').textContent='Conta cadastrada como pendente. Identidade ainda não verificada.';
  }catch{root.querySelector('[data-reward-feedback]').textContent='Cadastro não confirmado. Atualize os dados antes de tentar novamente.';}
  finally{busy=false;}
 });
 root.addEventListener('input',event=>{if(event.target.matches('[data-history-filter]')){historyFilters[event.target.dataset.historyFilter]=event.target.value;filterHistory();return;}if(event.target.matches('[data-catalog-search]')){filters.search=event.target.value;filterCatalog();}});
 root.addEventListener('change',event=>{if(event.target.matches('[data-weekend-account]')&&!busy){participantId=event.target.value;weeklyDrawId=null;rememberWeekly();render();return;}if(event.target.matches('[data-history-filter]')){historyFilters[event.target.dataset.historyFilter]=event.target.value;filterHistory();return;}if(event.target.matches('[data-catalog-rarity]')){filters.rarity=event.target.value;filterCatalog();return;}});
 root.addEventListener('change',event=>{if(event.target.matches('[data-reward-season-select]')&&!busy){selected=event.target.value;render();}});
 root.addEventListener('click',async event=>{
  const button=event.target.closest('button');if(!button||busy)return;
  if(button.matches('[data-catalog-clear]')){filters.search='';filters.rarity='all';root.querySelector('[data-catalog-search]').value='';root.querySelector('[data-catalog-rarity]').value='all';filterCatalog();return;}
  if(button.matches('[data-rewards-refresh]'))return refresh();
  if(button.matches('[data-weekend-result]')){
   const id=button.dataset.weekendResult;let draw=dashboard?.weekly?.draws?.find(d=>d.id===id);busy=true;
   try{if(!draw){const data=await request(null,id);draw=data.weekly?.draws?.find(d=>d.id===id);if(!draw)throw Error();dashboard.weekly={...data.weekly,draws:[...(dashboard.weekly?.draws||[]),draw]};}
    participantId=draw.account_id;weeklyDrawId=id;mode='weekend';rememberWeekly();machine?.destroy();machine=null;render();document.querySelector('[data-admin-go="roulette"]')?.click();
   }catch{root.querySelector('[data-reward-feedback]').textContent='Resultado persistido indisponível nesta consulta. Nenhum novo sorteio foi solicitado.';}
   finally{busy=false;}return;
  }
  if(button.matches('[data-weekend-receipt]')){
   const card=button.closest('[data-weekend-delivery]'),draw=dashboard?.weekly?.draws?.find(d=>d.id===card?.dataset.weekendDelivery);
   if(!draw||!card.querySelector('[data-weekend-account-confirm]').checked){root.querySelector('[data-reward-feedback]').textContent='Confirme a mesma conta destinatária e a evidência independente.';return;}
   busy=true;button.disabled=true;
   try{await request({action:'weekly_receipt',draw_id:draw.id,account_id:draw.account_id,component:Number(card.querySelector('[data-weekend-receipt-component]').value),
    evidence:card.querySelector('[data-weekend-receipt-evidence]').value,confirm_account:true,request_id:crypto.randomUUID()});
    const data=await request(null,draw.id);dashboard.weekly={...data.weekly,draws:[...(dashboard.weekly.draws||[]).filter(d=>d.id!==draw.id),...data.weekly.draws]};render();
    root.querySelector('[data-reward-feedback]').textContent='Recebimento confirmado manualmente. Nenhum comando de envio foi executado.';
   }catch{root.querySelector('[data-reward-feedback]').textContent='Confirmação não concluída. Atualize os dados para conferir o registro antes de tentar novamente.';}
   finally{busy=false;}return;
  }
  if(button.matches('[data-history-open]')){
   const entry=records().find(d=>d.id===button.dataset.historyOpen&&d.modality===button.dataset.historyModality);if(!entry)return;
   mode=entry.modality;if(mode==='official')selected=entry.id;else{participantId=entry.account_id;weeklyDrawId=entry.id;rememberWeekly();}
   // Stop the previous presentation before changing the selected persisted record.
   machine?.cancel('history');machine?.destroy();machine=null;render();root.querySelector('[data-admin-view="roulette"]').hidden=false;
   root.querySelector('[data-admin-view="catalog"]').hidden=true;
   document.querySelector('[data-admin-go="roulette"]')?.click();return;
  }
  if(button.matches('[data-weekend-draw]')){
   const participant=dashboard?.weekly?.participants?.find(a=>a.id===participantId);
   if(mode!=='weekend'||!participant?.verified||!dashboard?.weekly?.gate?.enabled||!dashboard?.weekly?.window?.open)return;
   const visual=machine,ticket=visual?.activity;busy=true;visual?.primeAudio();visual?.setWriting(true);button.disabled=true;
   try{
    const data=await request({action:'weekly_draw',account_id:participantId,window_start:dashboard.weekly.window.starts_at,request_id:crypto.randomUUID()});
    if(!data.persisted||!data.draw?.id)throw Error('Resultado não confirmado.');
    const reveal=!data.existing&&visual?.isActive(ticket);weeklyDrawId=data.draw.id;dashboard=await request();render();
    if(reveal)await machine.revealOfficial(data.draw);
   }catch{root.querySelector('[data-reward-feedback]').textContent='Resposta não confirmada. Use ATUALIZAR DADOS para recuperar a ficha antes de tentar novamente.';}
   finally{busy=false;machine?.setWriting(false);}return;
  }
  if(button.matches('[data-remote-prepare]')){
   const draw=selectedDraw(),id=mode==='official'?selected:draw?.id;if(!id)return;
   busy=true;machine?.cancel('delivery-plan');machine?.setWriting(true);
   try{
    const data=await request({action:'remote_prepare',modality:mode,draw_id:id});pendingPlan=data.plan;if(!pendingPlan)throw Error();
    pendingPlan.request_id=crypto.randomUUID();
    const dialog=document.createElement('dialog');dialog.dataset.remoteConfirm='true';dialog.className='remote-confirm-dialog';
    dialog.setAttribute('aria-labelledby','remote-confirm-title');
    dialog.innerHTML=`<h2 id="remote-confirm-title">Confirmar envio do presente</h2><p>Destinatário: <strong>${safe(pendingPlan.recipient.display_name)}</strong></p><p>Usuário no servidor: ${safe(pendingPlan.recipient.game_username)}</p><p>${itemQuantities(pendingPlan.reward.items,pendingPlan.reward.server_build)}</p><p>${safe(pendingPlan.enabled?'Confira conta e componentes antes do envio real.':pendingPlan.reason)}</p><label><input type="checkbox" data-remote-agree ${pendingPlan.enabled?'':'disabled'}> Confirmei a conta destinatária e cada item acima</label><div class="reward-actions"><button type="button" class="button button-pink" data-remote-send ${pendingPlan.enabled?'':'disabled'}>CONFIRMAR ENVIO REAL</button><button type="button" class="button button-ghost" data-remote-close>CANCELAR</button></div><p data-remote-feedback role="status"></p>`;
    root.querySelector('[data-remote-confirm]')?.remove();root.append(dialog);dialog.showModal();
    dialog.addEventListener('cancel',()=>{pendingPlan=null;button.isConnected&&button.focus();},{once:true});
   }catch{root.querySelector('[data-reward-feedback]').textContent='Plano de entrega indisponível. Nenhum envio foi iniciado.';}
   finally{busy=false;machine?.setWriting(false);}return;
  }
  if(button.matches('[data-remote-close]')){button.closest('dialog').close();pendingPlan=null;return;}
  if(button.matches('[data-remote-send]')){
   const dialog=button.closest('dialog');if(!pendingPlan?.enabled||!dialog.querySelector('[data-remote-agree]').checked)return;
   busy=true;button.disabled=true;dialog.querySelector('[data-remote-close]').disabled=true;
   try{
    const outcome=await request({action:'remote_send',modality:pendingPlan.modality,draw_id:pendingPlan.draw_id,plan_hash:pendingPlan.plan_hash,request_id:pendingPlan.request_id,confirm_delivery:true});
    dialog.querySelector('[data-remote-feedback]').textContent=outcome.reason==='offline'?'Conta offline. Nenhum envio foi iniciado.':'Tentativa registrada. Consulte o estado de cada componente; recebimento não foi presumido.';
   }catch{dialog.querySelector('[data-remote-feedback]').textContent='Resposta incerta. Não repetir o envio. Atualize os dados e reconcilie os componentes.';}
   finally{pendingPlan=null;busy=false;dialog.querySelector('[data-remote-close]').disabled=false;}return;
  }
  const card=button.closest('[data-reward-season]'),season=dashboard?.seasons?.find(s=>s.season_id===card?.dataset.rewardSeason);if(!season)return;
  if(button.matches('[data-reward-copy]')){try{await navigator.clipboard.writeText(rewardAnnouncement({...season,...season.draw.presentation_snapshot,reward_name:season.draw.reward_snapshot.name,rarity:season.draw.rarity}));root.querySelector('[data-reward-feedback]').textContent='Texto copiado.';}catch{root.querySelector('[data-reward-feedback]').textContent='Não foi possível copiar neste navegador.';}return;}
  const draw=button.matches('[data-reward-draw]'),action=draw?'draw':button.dataset.deliveryAction;if(!action)return;
  if(draw&&machine?.mode!=='official')return;
  const confirmed=card.querySelector(draw?'[data-draw-identity]':'[data-delivery-identity]')?.checked;
  if(!confirmed){root.querySelector('[data-reward-feedback]').textContent='Confira e confirme a mesma vida antes de continuar.';return;}
  const visual=machine,ticket=visual?.activity;if(draw){visual?.primeAudio();visual?.setWriting(true);}busy=true;button.disabled=true;
  try{
   const data=await request({action,season_id:season.season_id,life_id:season.draw?.life_id||season.eligibility.life_id,request_id:crypto.randomUUID(),confirm_identity:true,
    ...(draw?{}:{evidence:card.querySelector('[data-delivery-evidence]').value,component:Number(card.querySelector('[data-delivery-component]').value)})});
   const previous=dashboard;dashboard=data.dashboard;if(dashboard)dashboard={...previous,...dashboard};if(!dashboard)throw Error('Atualize para consultar o resultado.');
   const reveal=draw&&!data.existing&&visual?.isActive(ticket);
   const persisted=draw?dashboard.seasons.find(s=>s.season_id===season.season_id)?.draw:null;
   if(draw&&!persisted)throw Error('Consulte o registro persistido.');
   render();
   if(reveal)await machine.revealOfficial(persisted);
   root.querySelector('[data-reward-feedback]').textContent='Registro persistido confirmado.';
  }catch(error){root.querySelector('[data-reward-feedback]').textContent=error.message+' Use Atualizar premiações antes de qualquer nova tentativa.';}
  finally{busy=false;machine?.setWriting(false);}
 });
 controllers.set(root,{refresh});refresh();
}
