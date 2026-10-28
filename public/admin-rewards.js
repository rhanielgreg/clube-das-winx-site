import {escapeHtml as safe} from './contracts.js';
import {rarityNames,deliveryNames,rewardAnnouncement,deliveryActions,rewardDate} from './rewards-view.js';
import {catalogMarkup,historyMarkup,rarityChances} from './reward-presentation.js';
import {rouletteMarkup,mountRouletteMachine} from './roulette-machine.js';
const reasons={season_open:'Temporada em andamento',pending_certification:'Resultado pendente de certificação',technical_tie:'Empate técnico — sem campeão individual',apocalypse:'O Apocalipse Venceu',identity_unverified:'Identidade da vida não comprovada',world_unverified:'Geração do mundo não comprovada',forfeited:'Vida campeã morta — direito material perdido',survival_unknown:'Sobrevivência desconhecida',stale_survival:'Atualize a evidência de sobrevivência',cohort_inactive:'Coorte certificada ainda inativa',eligible:'Campeão individual e vida verificados'};
const controllers=new WeakMap();
export function mountAdminRewards({token}){
 const root=document.querySelector('[data-admin-rewards]');if(!root)return;
 if(controllers.has(root)){controllers.get(root).refresh();return;}
 let dashboard=null,busy=false,selected=null,machine=null,mode='demo';
 if(!document.querySelector('link[data-roulette-style]')){const style=document.createElement('link');style.rel='stylesheet';style.href='/roulette.css';style.dataset.rouletteStyle='true';document.head.append(style);}
 const filters={rarity:'all',search:''};
 const authHeaders=()=>({'content-type':'application/json',authorization:`Bearer ${token()||''}`});
 async function request(body){const response=await fetch('/api/admin-rewards',{method:body?'POST':'GET',headers:authHeaders(),cache:'no-store',signal:AbortSignal.timeout(body?15000:8000),...(body?{body:JSON.stringify(body)}:{})});const data=await response.json();if(!response.ok)throw Error(data.error||'Premiações indisponíveis.');return data;}
 function render(){
  let audioContext=null;
  if(machine){mode=machine.mode;audioContext=machine.releaseAudio();machine.destroy();machine=null;}
  const seasons=dashboard?.seasons||[];
  const current=seasons.find(s=>s.season_id===selected)||seasons[0];selected=current?.season_id||null;
  const catalog=dashboard?.catalog,eligible=current?.eligibility?.eligible===true&&catalog?.active===true;
  root.innerHTML=`${rouletteMarkup({catalog,current,seasons,eligible,reason:reasons[current?.eligibility?.reason],mode})}
   <div data-admin-view="catalog"><div class="reward-catalog-summary"><section class="kpi-tile"><small>CATÁLOGO ATUAL</small><strong>${catalog?.rewards?.length||0}</strong><span class="kpi-sub">Recompensas na versão consultada</span></section><section class="kpi-tile"><small>RARIDADES</small><strong>5</strong><span class="kpi-sub">45 / 30 / 20 / 4 / 1</span></section><section class="kpi-tile"><small>SORTEIOS PERSISTIDOS</small><strong>${seasons.filter(s=>s.draw).length}</strong><span class="kpi-sub">Na consulta administrativa</span></section></div><div class="admin-panel"><p>Versão: <strong>${safe(catalog?.version||'Indisponível')}</strong> · ${catalog?.active?'Ativa':'Não ativa'}. Histórico preservado por versão; cada sorteio conserva seu catálogo e prêmio.</p><p class="muted">As chances individuais abaixo incluem o peso de cada recompensa dentro de sua raridade. Condição padrão, sem promessa de condição máxima.</p></div><div class="admin-panel reward-filters"><label>Buscar prêmio<input type="search" data-catalog-search value="${safe(filters.search)}" placeholder="Nome do prêmio"></label><label>Raridade<select data-catalog-rarity><option value="all">Todas as raridades</option>${Object.keys(rarityChances).map(r=>`<option value="${r}" ${filters.rarity===r?'selected':''}>${safe(rarityNames[r])}</option>`).join('')}</select></label><button type="button" class="button button-ghost" data-catalog-clear>Limpar filtros</button><p>Itens do catálogo ativo conferidos na fonte. A chance da raridade é distribuída pelos pesos individuais.</p></div><div data-catalog-results>${catalogMarkup(catalog,filters)}</div>
   <section class="admin-panel"><div class="panel-header"><h2>🏆 Histórico de campeões e premiações</h2><button type="button" class="button button-ghost button-small" data-rewards-refresh>Atualizar premiações</button></div>${historyMarkup(seasons)}</section>
   <section class="admin-panel"><h2>📦 Gerenciamento da entrega manual</h2>${seasons.filter(s=>s.draw).map(s=>{const d=s.draw;return `<article class="reward-season" data-reward-season="${safe(s.season_id)}"><h3>${safe(s.season_name)}</h3><p>${safe(s.character_name||d.presentation_snapshot?.character_name||'Campeão certificado')} · <strong>${safe(d.reward_snapshot.name)}</strong></p><span class="status-badge warning">${safe(deliveryNames[d.delivery_state]||'Estado não informado')}</span><ul>${d.reward_snapshot.items.map((i,index)=>`<li>Componente ${index+1} · ${safe(i.quantity)} × ${safe(i.script_id)} · ${safe(deliveryNames[d.components?.find(c=>c.component===index)?.state||'pending'])}</li>`).join('')}</ul><button type="button" class="button button-ghost button-small" data-reward-copy>Copiar divulgação</button>
     <details><summary>Entrega manual e reconciliação por componente</summary><p>Confira no servidor a conta e esta vida exata, viva e online. Registre evidência verificável. Confirmação manual não é prova automatizada do inventário.</p><label><input type="checkbox" data-delivery-identity> Conferi a conta e a mesma vida premiada</label><label>Evidência de identidade/entrega<textarea data-delivery-evidence minlength="20" maxlength="2000" rows="3"></textarea></label><label>Componente <select data-delivery-component>${d.reward_snapshot.items.map((i,index)=>`<option value="${index}">${index+1}: ${safe(i.script_id)}</option>`).join('')}</select></label><div class="reward-actions">${[['begin_manual','Iniciar registro manual'],['offline','Registrar offline'],['block','Bloquear por identidade'],['sent','Registrar envio não comprovado'],['uncertain','Registrar resultado incerto'],['confirm_component','Confirmar este componente manualmente'],['not_delivered','Comprovar que este componente não foi entregue']].map(([action,label])=>`<button type="button" class="button button-ghost button-small" data-delivery-action="${action}" ${deliveryActions(d.delivery_state).includes(action)?'':'disabled'}>${label}</button>`).join('')}</div><p>Após incerteza, reconciliar cada componente antes de qualquer nova tentativa. Nunca repetir componente confirmado.</p><details><summary>Identidade e trilha de auditoria</summary><p>Vida premiada: <code>${safe(d.life_id)}</code> · Versão: ${safe(d.catalog_version)}</p><ol>${(d.events||[]).map(e=>`<li>${safe(rewardDate(e.created_at))} · ${safe(e.action)} → ${safe(e.new_state)} · operador ${safe(e.operator_id||'origem nativa')}<p>${safe(e.evidence||'')}</p></li>`).join('')}</ol></details></details></article>`;}).join('')||'<div class="reward-empty"><h3>Aguardando premiação oficial</h3><p>Quando houver sorteio persistido, a identidade e cada componente entregue poderão ser auditados aqui.</p><p>Gerenciamento disponível após sorteio oficial.</p></div>'}</section></div>
   <p class="reward-feedback" data-reward-feedback role="status" aria-live="polite"></p>`;
  machine=mountRouletteMachine(root.querySelector('[data-roulette-machine]'),{catalog,current,mode,audioContext,onMode:next=>{mode=next;}});
  document.dispatchEvent(new Event('admin-content-ready'));
 }
 async function refresh(){if(busy)return;machine?.cancel('refresh');try{dashboard=await request();render();}catch(error){dashboard=null;render();root.querySelector('[data-reward-feedback]').textContent=error.message;}}
 const filterCatalog=()=>{root.querySelector('[data-catalog-results]').innerHTML=catalogMarkup(dashboard?.catalog,filters);};
 root.addEventListener('input',event=>{if(event.target.matches('[data-catalog-search]')){filters.search=event.target.value;filterCatalog();}});
 root.addEventListener('change',event=>{if(event.target.matches('[data-catalog-rarity]')){filters.rarity=event.target.value;filterCatalog();return;}});
 root.addEventListener('change',event=>{if(event.target.matches('[data-reward-season-select]')&&!busy){selected=event.target.value;render();}});
 root.addEventListener('click',async event=>{
  const button=event.target.closest('button');if(!button||busy)return;
  if(button.matches('[data-catalog-clear]')){filters.search='';filters.rarity='all';root.querySelector('[data-catalog-search]').value='';root.querySelector('[data-catalog-rarity]').value='all';filterCatalog();return;}
  if(button.matches('[data-rewards-refresh]'))return refresh();
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
   dashboard=data.dashboard;if(!dashboard)throw Error('Atualize para consultar o resultado.');
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
