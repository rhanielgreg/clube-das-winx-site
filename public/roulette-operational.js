import {escapeHtml as safe} from './contracts.js';
import {rarityNames,deliveryNames,rewardDate} from './rewards-view.js';
import {WHEEL_SECTORS} from './roulette-model.js';
import {createSpinSession,bindSpinLifecycle} from './roulette-spin.js';
import {itemArtwork,itemQuantities,itemAttribution} from './roulette-item-view.js';

export const weeklyReasons={schema_unavailable:'Estrutura semanal ainda indisponível neste ambiente.',activation_disabled:'Modalidade semanal ainda não ativada.',
 first_rollover_unverified:'A primeira virada mensal precisa ser validada.',catalog36_unapproved:'Os 36 prêmios precisam de aprovação e verificação.',
 rcon_unvalidated:'Entrega RCON ainda não validada.',final_approval_missing:'Ativação final ainda não aprovada.'};
export function participantRows(weekly){return (weekly?.participants||[]).map(a=>{
 const draw=weekly.draws?.find(d=>d.id===a.draw_id);
 const eligible=a.verified&&weekly.gate?.enabled&&weekly.window?.open&&!a.draw_id;
 return `<tr><td>${safe(a.display_name)}</td><td>${a.verified?'Verificada':'Pendente'}</td><td>${a.draw_id?'Utilizada':a.verified?'Não utilizada':'Indisponível'}</td><td>${a.draw_id?'Ficha utilizada':eligible?'Elegível':a.verified?'Bloqueada':'Identidade pendente'}</td><td>${a.draw_id?`<button type="button" class="button button-ghost" data-weekend-result="${safe(a.draw_id)}">${safe(draw?.reward_snapshot?.name||'Abrir resultado persistido')}</button>`:'Sem resultado'}</td><td>${draw?safe(deliveryNames[draw.delivery_state]||'Não consultada'):a.draw_id?'Consultar registro':'Sem prêmio'}</td></tr>`;
 }).join('')||'<tr><td colspan="6">Nenhum cadastro nesta consulta.</td></tr>';}
export function recipientName(draw,mode){return mode==='weekend'?draw?.recipient_snapshot?.display_name:
 draw?.presentation_snapshot?.character_name||draw?.presentation_snapshot?.steam_username;}
export function persistedPrizeCard(draw,mode){
 if(!draw?.reward_snapshot)return '<div class="reward-empty"><p>Nenhum prêmio selecionado.</p></div>';
 const r=draw.reward_snapshot;return `<article class="machine-prize machine-persisted-prize rarity-${safe(draw.rarity)}"><div class="machine-prize-art machine-item-art">${itemArtwork(r.items,r.server_build)}</div><small>${safe(rarityNames[draw.rarity])}</small><h3>${safe(r.name)}</h3><p>${itemQuantities(r.items,r.server_build)}</p><p>Destinatário: <strong>${safe(recipientName(draw,mode)||'Não informado no registro')}</strong></p><p>${safe(deliveryNames[draw.delivery_state]||'Situação não disponível')}</p></article>`;
}
export function deliveryTraceMarkup(draw){return draw?.reward_snapshot?`<details class="machine-delivery-trace"><summary>Entrega por componente</summary><ol>${draw.reward_snapshot.items.map((item,index)=>{
 const component=draw.components?.find(c=>c.component===index);return `<li>${itemQuantities([item],draw.reward_snapshot.server_build)} · ${safe(deliveryNames[component?.state]|| (component?.state==='started'?'Tentativa reservada — não reenviar':'Aguardando entrega'))}${component?.started_at?` · ${safe(rewardDate(component.started_at))}`:''}</li>`;
 }).join('')}</ol></details>`:'';}
export function operationalMarkup({wheelMarkup,current,seasons=[],eligible=false,reason,mode='weekend',weekly,participantId,weeklyDrawId,remoteReady=false}={}){
 const participants=weekly?.participants||[],participant=participants.find(a=>a.id===participantId);
 const draw=mode==='official'?current?.draw:(weekly?.draws||[]).find(d=>d.id===weeklyDrawId)||
 (weekly?.draws||[]).find(d=>d.account_id===participantId&&Date.parse(d.window_start)===Date.parse(weekly?.window?.starts_at));
 const weeklyEligible=weekly?.gate?.enabled===true&&weekly?.window?.open===true&&participant?.verified===true&&!draw;
 const period=draw&&mode==='weekend'?{starts_at:draw.window_start,ends_at:draw.window_end}:weekly?.window;
 const periodOpen=period&&Date.parse(weekly?.checked_at)>=Date.parse(period.starts_at)&&Date.parse(weekly?.checked_at)<Date.parse(period.ends_at);
 const identity=current?.eligibility?.life_id?`<details class="machine-identity"><summary>Conferir identidade e evidência da vida</summary><p>${safe(current.character_name||'Vida certificada')}</p><p>Vida: <code>${safe(current.eligibility.life_id)}</code> · ${safe(rewardDate(current.eligibility.last_observed_at))}</p></details>`:'';
 return `<div class="roulette-v2 roulette-v3" data-admin-view="roulette" data-roulette-machine data-operational="true" data-mode="${mode}">
 <div class="machine-console"><div class="machine-tabs" role="tablist" aria-label="Modalidade da premiação">${[['weekend','Sorteio de fim de semana'],['official','Sorteio oficial']].map(([key,label])=>`<button type="button" role="tab" id="roulette-${key}-tab" aria-controls="roulette-${key}-panel" aria-selected="${mode===key}" tabindex="${mode===key?0:-1}" data-roulette-mode="${key}">${label}</button>`).join('')}</div><div class="machine-audio"><label><input type="checkbox" data-roulette-audio> Áudio do resultado</label><label>Volume<input type="range" min="0" max="100" value="25" data-roulette-volume aria-label="Volume do resultado"></label></div></div>
 <section class="machine-chamber" aria-label="Máquina de premiação"><div class="machine-plate"><span>CLUBE DAS WINX</span><b>FORTUNA DOS SOBREVIVENTES</b></div>${wheelMarkup}
 <div role="tabpanel" id="roulette-weekend-panel" aria-labelledby="roulette-weekend-tab" ${mode==='weekend'?'':'hidden'}>
 <div class="machine-participants"><label>Participante cadastrado<select data-weekend-account><option value="">Selecione uma conta</option>${participants.map(a=>`<option value="${safe(a.id)}" ${participantId===a.id?'selected':''}>${safe(a.display_name)} · ${a.verified?'Verificada':'Verificação pendente'}${a.draw_id?' · Ficha utilizada':''}</option>`).join('')}</select></label>
 <p>${participant?`${safe(participant.display_name)} · ${participant.verified?'Conta verificada':'Não elegível: identidade pendente'}`:'Nenhum participante selecionado.'}</p>
 ${draw?'<button type="button" class="machine-spin-button" data-reward-replay>REVELAR PRÊMIO PERSISTIDO</button>':`<button type="button" class="machine-spin-button" data-weekend-draw ${weeklyEligible?'':'disabled'}>${weeklyEligible?'SORTEAR PRÊMIO DO FIM DE SEMANA':'SORTEIO SEMANAL BLOQUEADO'}</button>`}
 <ul class="machine-release-reasons">${(weekly?.gate?.reasons||['schema_unavailable']).map(r=>`<li>${safe(weeklyReasons[r]||'Verificação de lançamento pendente.')}</li>`).join('')}</ul>
 <details><summary>Contas cadastradas e fichas</summary><div class="table-scroll" tabindex="0" role="region" aria-label="Participantes e fichas"><table class="admin-table"><thead><tr><th>Jogador</th><th>Verificação</th><th>Ficha deste período</th><th>Elegibilidade</th><th>Resultado</th><th>Entrega</th></tr></thead><tbody>${participantRows(weekly)}</tbody></table></div></details>
 <details><summary>Cadastrar conta para verificação</summary><p>O cadastro não comprova identidade. A ligação entre Steam e conta do servidor exige evidência independente revisada.</p><form data-weekend-registration><label>Jogador<input name="display_name" required maxlength="80" autocomplete="off"></label><label>SteamID64<input name="steam_id" required pattern="7656119[0-9]{10}" inputmode="numeric" autocomplete="off"></label><label>Usuário exato no servidor<input name="game_username" required maxlength="64" pattern="[A-Za-z0-9_ .-]+" autocomplete="off"></label><button type="submit" class="button button-ghost" ${weekly?.available===true?'':'disabled'}>CADASTRAR COMO PENDENTE</button></form></details></div></div>
 <div role="tabpanel" id="roulette-official-panel" aria-labelledby="roulette-official-tab" ${mode==='official'?'':'hidden'}><div data-reward-season="${safe(current?.season_id||'')}">${current?.draw?'<button type="button" class="machine-spin-button" data-reward-replay>REVELAR PRÊMIO PERSISTIDO</button>':`<p>${safe(reason||'Elegibilidade não verificada.')}</p>${identity}<label class="machine-confirm"><input type="checkbox" data-draw-identity ${eligible?'':'disabled'}> Conferi o campeão e a mesma vida indicada</label><button type="button" class="machine-spin-button" data-reward-draw ${eligible?'':'disabled'}>${eligible?'SORTEAR PRÊMIO OFICIAL':'SORTEIO OFICIAL BLOQUEADO'}</button>`}</div></div>
 <p class="machine-status" data-machine-status role="status" aria-live="polite">${draw?'Resultado persistido disponível.':'Aguardando premiação elegível.'}</p></section>
 <div class="machine-information"><section class="admin-panel"><h2>Probabilidades oficiais</h2><ul class="machine-odds">${WHEEL_SECTORS.map(s=>`<li class="rarity-${s.rarity}"><i aria-hidden="true"></i><span>${safe(rarityNames[s.rarity])}</span><b>${s.percent}%</b></li>`).join('')}</ul></section><section class="admin-panel"><h2>Situação da premiação</h2>${mode==='weekend'?`
 <dl class="machine-situation"><dt>Período</dt><dd>${period?`${safe(rewardDate(period.starts_at))} a ${safe(rewardDate(period.ends_at))} · Brasília`:'Período indisponível'}</dd><dt>Janela</dt><dd>${periodOpen?'Aberta':period?'Fechada':'Não consultada'} · sábado 00h até segunda 00h, limite exclusivo</dd><dt>Participante</dt><dd>${safe(participant?.display_name||recipientName(draw,mode)||'Não selecionado')}</dd><dt>Ficha</dt><dd>${draw?'Utilizada neste período':participant?.draw_id?'Utilizada':participant?.verified?'Não utilizada':'Indisponível'}</dd></dl>`:`<label>Temporada<select data-reward-season-select aria-label="Temporada da roleta">${seasons.map(s=>`<option value="${safe(s.season_id)}" ${s===current?'selected':''}>${safe(s.season_name)}</option>`).join('')}</select></label><dl class="machine-situation"><dt>Estado</dt><dd>${safe(reason||'Não consultado')}</dd><dt>Campeão certificado</dt><dd>${safe(recipientName(draw,mode)|| (current?.eligibility?.eligible?current?.character_name:null)||'Ainda não definido')}</dd><dt>Elegibilidade</dt><dd>${eligible?'Confirmada na consulta':'Bloqueada nesta consulta'}</dd></dl>`}
 <dl class="machine-situation"><dt>Prêmio</dt><dd>${safe(draw?.reward_snapshot?.name||'Ainda não sorteado')}</dd><dt>Entrega</dt><dd>${safe(deliveryNames[draw?.delivery_state]||'Sem premiação selecionada')}</dd></dl><button type="button" class="button button-ghost" data-rewards-refresh>ATUALIZAR DADOS</button></section></div>
 <section class="admin-panel machine-prize-preview"><h2>Espólios do apocalipse</h2>${persistedPrizeCard(draw,mode)}${deliveryTraceMarkup(draw)}${draw?`<button type="button" class="button button-pink" data-remote-prepare ${remoteReady?'':'disabled'}>ENVIAR PRESENTE</button>${remoteReady?'':'<p>Entrega remota bloqueada até validação e aprovação.</p>'}`:''}${itemAttribution()}</section>
 <dialog class="machine-victory" aria-labelledby="roulette-result-title"><div class="machine-victory-content"><button type="button" class="machine-modal-close" data-result-close aria-label="Fechar resultado">×</button><div class="machine-sparks" aria-hidden="true">${Array.from({length:16},(_,i)=>`<i style="--spark:${i}"></i>`).join('')}</div><p class="machine-result-source" data-result-source></p><h2 id="roulette-result-title"></h2><p class="machine-result-rarity" data-result-rarity></p><div data-result-prize></div><p data-result-note></p><div class="machine-result-actions"><button type="button" data-remote-prepare class="button button-pink" ${remoteReady?'':'disabled'}>ENVIAR PRESENTE</button><button type="button" data-result-close class="button button-ghost">FECHAR RESULTADO</button></div>${itemAttribution()}</div></dialog></div>`;
}

// Presentation of persisted rewards only. No RNG, network or delivery capability.
export function mountOperationalRoulette(root,{mode='weekend',draw,audioContext=null,onMode=()=>{}}={}){
 const $=s=>root.querySelector(s),lifetime=new AbortController();let destroyed=false,writing=false,activity=0,returnFocus=null,effect=null;
 let audio=audioContext,voices=[],muted=false,volume=25;
 try{muted=localStorage.getItem('winx.rewards.sound')==='muted';const v=localStorage.getItem('winx.roulette.volume');if(v!==null&&Number.isFinite(+v))volume=Math.max(0,Math.min(100,+v));}catch{}
 $('[data-roulette-audio]').checked=!muted;$('[data-roulette-volume]').value=volume;
 const dialog=$('dialog'),rotor=$('[data-reward-wheel]'),status=text=>$('[data-machine-status]').textContent=text;
 const active=()=>!destroyed&&root.isConnected&&!root.hidden&&!document.hidden&&root.getClientRects().length>0;
 const stopAudio=()=>{for(const voice of voices){try{voice.stop();voice.disconnect();}catch{}}voices=[];};
 const primeAudio=()=>{if(muted||volume===0)return;try{audio??=new(window.AudioContext||window.webkitAudioContext)();audio.resume().catch(()=>{});}catch{audio=null;}};
 function resultSound(){if(!audio||muted||volume===0)return;stopAudio();try{for(const [i,f] of [660,990].entries()){
  const osc=audio.createOscillator(),gain=audio.createGain(),at=audio.currentTime+i*.14;osc.type='sine';osc.frequency.value=f;gain.gain.setValueAtTime(0,at);gain.gain.linearRampToValueAtTime(.045*volume/100,at+.02);gain.gain.exponentialRampToValueAtTime(.0001,at+.28);osc.connect(gain);gain.connect(audio.destination);voices.push(osc);osc.start(at);osc.stop(at+.3);osc.onended=()=>{osc.disconnect();gain.disconnect();};
 }}catch{stopAudio();}}
 function close(restore=true){const open=dialog.open;if(open)dialog.close();root.classList.remove('is-celebrating');stopAudio();if(open&&restore&&active()){
  const target=returnFocus?.isConnected&&!returnFocus.disabled?returnFocus:$('[data-reward-replay]');target?.focus();
 }}
 function buttons(){root.querySelectorAll('[data-roulette-mode]').forEach(b=>b.disabled=writing);root.querySelectorAll('[data-reward-replay]').forEach(b=>b.disabled=writing||spin.running);}
 const spin=createSpinSession({animate:({from,to,duration,signal})=>new Promise((resolve,reject)=>{
  effect=rotor.animate([{transform:`rotate(${from}deg)`},{transform:`rotate(${to}deg)`}],{duration,easing:'cubic-bezier(.14,0,.1,1)',fill:'forwards'});const animation=effect;
  const abort=()=>{animation.cancel();reject(new DOMException('Cancelled','AbortError'));};signal.addEventListener('abort',abort,{once:true});
  animation.finished.then(()=>{signal.removeEventListener('abort',abort);resolve();},error=>{signal.removeEventListener('abort',abort);reject(error);});
 }),onStart:()=>{close(false);root.classList.add('is-spinning');buttons();$('.machine-stage').scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'center'});status('Revelando o resultado persistido…');},
 onFinish:(result,source,angle)=>{
  rotor.style.transform=`rotate(${angle}deg)`;effect?.cancel();effect=null;root.classList.remove('is-spinning');buttons();if(!active())return;
  draw=result;dialog.className=`machine-victory rarity-${result.rarity}`;$('[data-result-source]').textContent=mode==='weekend'?'PRÊMIO DO FIM DE SEMANA':'PRÊMIO DO CAMPEÃO';
  $('#roulette-result-title').textContent=`${recipientName(result,mode)||'Destinatário não informado'} GANHOU!`;
  $('[data-result-rarity]').textContent=rarityNames[result.rarity];$('[data-result-prize]').innerHTML=persistedPrizeCard(result,mode);
  $('[data-result-note]').textContent=deliveryNames[result.delivery_state]||'Situação da entrega indisponível';
  dialog.showModal();root.classList.add('is-celebrating');status('Resultado persistido revelado.');resultSound();
 },onCancel:()=>{effect?.cancel();effect=null;root.classList.remove('is-spinning');close(false);rotor.style.transform='rotate(0deg)';buttons();},
 onError:()=>{effect?.cancel();effect=null;root.classList.remove('is-spinning');buttons();status('Apresentação indisponível. O resultado persistido permanece recuperável.');}});
 function cancel(reason){activity++;spin.cancel(reason);}
 function setMode(next){if(writing||!['weekend','official'].includes(next))return;cancel('mode');mode=next;onMode(next);}
 root.addEventListener('click',event=>{const b=event.target.closest('button');if(!b)return;
  if(b.matches('[data-roulette-mode]'))setMode(b.dataset.rouletteMode);
  else if(b.matches('[data-result-close]'))close();
  else if(b.matches('[data-reward-replay]')&&draw&&!writing){returnFocus=b;primeAudio();spin.play(draw,{source:'official',reduced:matchMedia('(prefers-reduced-motion: reduce)').matches});}
 },{signal:lifetime.signal});
 root.addEventListener('keydown',event=>{if(event.target.matches('[data-roulette-mode]')&&['ArrowLeft','ArrowRight','Home','End'].includes(event.key)){
  event.preventDefault();setMode(event.key==='Home'?'weekend':event.key==='End'?'official':mode==='weekend'?'official':'weekend');
 }},{signal:lifetime.signal});
 root.addEventListener('change',event=>{if(event.target.matches('[data-roulette-audio]')){muted=!event.target.checked;if(muted)stopAudio();try{localStorage.setItem('winx.rewards.sound',muted?'muted':'on');}catch{}}},{signal:lifetime.signal});
 root.addEventListener('input',event=>{if(event.target.matches('[data-roulette-volume]')){volume=Number(event.target.value);if(!volume)stopAudio();try{localStorage.setItem('winx.roulette.volume',String(volume));}catch{}}},{signal:lifetime.signal});
 root.addEventListener('error',event=>{if(event.target.matches?.('[data-verified-item-icon]')){event.target.hidden=true;event.target.closest('[data-item-icon]').classList.add('is-missing');}},{capture:true,signal:lifetime.signal});
 dialog.addEventListener('cancel',event=>{event.preventDefault();close();},{signal:lifetime.signal});
 // Native dialog contains focus, including required attribution links.
 bindSpinLifecycle({document,window,signal:lifetime.signal,cancel});
 const visibility=new MutationObserver(()=>{if(!active())cancel('navigation');});
 for(let ancestor=root;ancestor&&ancestor!==document.body;ancestor=ancestor.parentElement)visibility.observe(ancestor,{attributes:true,attributeFilter:['hidden','style']});
 rotor.style.transform='rotate(0deg)';
 return {get mode(){return mode;},get activity(){return activity;},get running(){return spin.running;},cancel,primeAudio,isActive:ticket=>active()&&ticket===activity,
  setWriting(value){writing=value===true;buttons();},releaseAudio(){stopAudio();const prior=audio;audio=null;return prior;},
  async revealOfficial(result){if(!active())return false;return spin.play(result,{source:'official',reduced:matchMedia('(prefers-reduced-motion: reduce)').matches});},
  destroy(){destroyed=true;cancel('destroy');visibility.disconnect();lifetime.abort();audio?.close().catch(()=>{});}
 };
}
