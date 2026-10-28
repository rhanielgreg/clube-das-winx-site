import {escapeHtml as safe} from './contracts.js';
import {rarityNames,rewardDate} from './rewards-view.js';
import {WHEEL_SECTORS,RARITY_CHANCES,wheelGradient,rewardRotation,chooseDemonstration,demoCatalogReady} from './roulette-model.js';
import {createSpinSession,bindSpinLifecycle} from './roulette-spin.js';
import {itemArtwork,itemQuantities,itemImageNote,itemAttribution} from './roulette-item-view.js';

const itemCard=(reward,{debug=false}={})=>`<article class="machine-prize rarity-${safe(reward.rarity)}"><div class="machine-prize-art machine-item-art">${itemArtwork(reward.items,reward.server_build??null)}</div><div><small>${safe(rarityNames[reward.rarity])}</small><h3>${safe(reward.name)}</h3><p>${itemQuantities(reward.items,reward.server_build??null)}</p>${debug?`<code>${reward.items.map(i=>safe(i.script_id)).join(' + ')}</code>`:''}<span class="machine-image-note">${safe(itemImageNote(reward.items,reward.server_build??null))}</span></div></article>`;
function mechanicalWheel(){
 const lines=WHEEL_SECTORS.map(s=>{const r=s.start*Math.PI/180;return `<line x1="500" y1="500" x2="${500+480*Math.sin(r)}" y2="${500-480*Math.cos(r)}"/>`;}).join('');
 return `<div class="machine-stage"><div class="machine-pointer" aria-hidden="true"></div><div class="machine-rim" aria-hidden="true">${Array.from({length:24},(_,i)=>`<i class="machine-bulb" style="--lamp:${i};left:${50+47*Math.sin(i*Math.PI/12)}%;top:${50-47*Math.cos(i*Math.PI/12)}%"></i>`).join('')}</div><button type="button" class="machine-wheel-trigger" data-demo-spin aria-label="Girar demonstração; sem valor oficial"><span class="machine-rotor" data-reward-wheel style="background:${wheelGradient()}"><svg class="machine-plate-lines" viewBox="0 0 1000 1000" aria-hidden="true"><circle cx="500" cy="500" r="474"/><circle cx="500" cy="500" r="445"/>${lines}</svg>${WHEEL_SECTORS.filter(s=>s.percent>=20).map(s=>{const r=s.center*Math.PI/180;return `<span class="machine-sector-label rarity-${s.rarity}" style="left:${50+33*Math.sin(r)}%;top:${50-33*Math.cos(r)}%">${safe(rarityNames[s.rarity])}<b>${s.percent}%</b></span>`;}).join('')}<span class="machine-patina" aria-hidden="true"></span></span><span class="machine-hub" aria-hidden="true"><img src="/assets/winx-zomboid-profile.webp" alt=""><b>WINX</b></span></button><span class="machine-rivet rivet-nw" aria-hidden="true"></span><span class="machine-rivet rivet-ne" aria-hidden="true"></span><span class="machine-rivet rivet-sw" aria-hidden="true"></span><span class="machine-rivet rivet-se" aria-hidden="true"></span></div>`;
}
export function rouletteMarkup({catalog,current,seasons=[],eligible=false,reason,mode='demo'}={}){
 const ready=demoCatalogReady(catalog);
 const identity=current?.eligibility?.life_id?`<details class="machine-identity"><summary>Conferir identidade e evidência da vida</summary><p>${safe(current.character_name||'Personagem certificado')}${current.steam_username?` · ${safe(current.steam_username)}`:''}</p><p>Vida: <code>${safe(current.eligibility.life_id)}</code><br>Última observação: ${safe(rewardDate(current.eligibility.last_observed_at))}</p></details>`:'';
 const preview=Object.keys(RARITY_CHANCES).flatMap(rarity=>(catalog?.rewards||[]).filter(r=>r.rarity===rarity).slice(0,rarity==='common'?2:1));
 return `<div class="roulette-v2" data-admin-view="roulette" data-roulette-machine>
  <div class="machine-console"><div class="machine-tabs" role="tablist" aria-label="Modo da Roleta dos Campeões"><button type="button" role="tab" id="roulette-demo-tab" aria-controls="roulette-demo-panel" aria-selected="${mode==='demo'}" tabindex="${mode==='demo'?0:-1}" data-roulette-mode="demo">⚗ Demonstração</button><button type="button" role="tab" id="roulette-official-tab" aria-controls="roulette-official-panel" aria-selected="${mode==='official'}" tabindex="${mode==='official'?0:-1}" data-roulette-mode="official">♜ Sorteio oficial</button></div><div class="machine-audio"><label><input type="checkbox" data-roulette-audio> Áudio do resultado</label><label>Volume<input type="range" min="0" max="100" value="25" data-roulette-volume aria-label="Volume do resultado"></label></div></div>
  <section class="machine-chamber" aria-label="Máquina de premiação"><div class="machine-plate"><span>CLUBE DAS WINX</span><b>FORTUNA DOS SOBREVIVENTES</b><span>RODA MECÂNICA · 45 / 30 / 20 / 4 / 1</span></div><p class="machine-mode-note" data-machine-mode-note>DEMONSTRAÇÃO — SEM VALOR OFICIAL</p><div class="machine-graffiti" aria-hidden="true">SOBREVIVER<br>É SÓ O COMEÇO.</div>${mechanicalWheel()}<div class="machine-minor-sectors" aria-label="Setores menores, sem ampliação visual"><span class="rarity-epic">ÉPICA <b>4%</b><small>14,4°</small></span><span class="rarity-legendary">LENDÁRIA <b>1%</b><small>3,6°</small></span></div>
   <div role="tabpanel" id="roulette-demo-panel" aria-labelledby="roulette-demo-tab" ${mode==='demo'?'':'hidden'}><button type="button" class="machine-spin-button" data-demo-spin ${ready?'':'disabled'}>↻ GIRAR DEMONSTRAÇÃO</button><p class="machine-hint">Ou clique diretamente na roda. Giro local · nenhum prêmio é concedido.</p><details class="machine-advanced"><summary>⚗ Testes avançados da demonstração</summary><label>Raridade a testar<select data-demo-rarity><option value="">Aleatório · probabilidades oficiais</option>${WHEEL_SECTORS.map(s=>`<option value="${s.rarity}">${safe(rarityNames[s.rarity])}</option>`).join('')}</select></label><p>Escolher uma raridade força apenas este teste visual. Pesos, catálogo e sorteios oficiais não são alterados.</p><label><input type="checkbox" data-demo-debug> Exibir IDs dos componentes neste teste</label></details></div>
   <div role="tabpanel" id="roulette-official-panel" aria-labelledby="roulette-official-tab" ${mode==='official'?'':'hidden'}><div data-reward-season="${safe(current?.season_id||'')}">${current?.draw?`<div class="machine-persisted"><small>RESULTADO OFICIAL PERSISTIDO</small><h3>${safe(current.draw.reward_snapshot.name)}</h3><p>${safe(rarityNames[current.draw.rarity])} · ${safe(rewardDate(current.draw.drawn_at))}</p><button type="button" class="button button-ghost" data-official-replay>Rever apresentação</button><button type="button" class="button button-ghost" data-reward-copy>Copiar divulgação</button></div>`:`<p class="machine-lock">${eligible?'Campeão e vida elegíveis na consulta':'🔒 Sorteio oficial indisponível no momento'}</p><p>${safe(reason||'Elegibilidade não verificada.')}</p>${identity}<label class="machine-confirm"><input type="checkbox" data-draw-identity ${eligible?'':'disabled'}> Conferi o campeão e a mesma vida indicada</label><button type="button" class="machine-spin-button" data-reward-draw ${eligible?'':'disabled'}>${eligible?'SORTEAR PRÊMIO OFICIAL':'SORTEIO OFICIAL BLOQUEADO'}</button>`}</div><p class="machine-hint">O backend valida e persiste antes da revelação. A animação não escolhe o prêmio.</p></div>
   <p class="machine-status" data-machine-status role="status" aria-live="polite">${ready?'Máquina pronta.':'Catálogo verificado indisponível; demonstração bloqueada.'}</p>
  </section>
  <div class="machine-information"><section class="admin-panel"><h2>Probabilidades oficiais</h2><ul class="machine-odds">${WHEEL_SECTORS.map(s=>`<li class="rarity-${s.rarity}"><i aria-hidden="true"></i><span>${safe(rarityNames[s.rarity])}</span><b>${s.percent}%</b><small>${new Intl.NumberFormat('pt-BR').format(s.end-s.start)}°</small></li>`).join('')}</ul><p>Demonstração aleatória respeita também os pesos dos itens dentro de cada raridade.</p></section><section class="admin-panel"><h2>Temporada e campeão</h2><label>Temporada <select data-reward-season-select aria-label="Temporada da roleta">${seasons.map(s=>`<option value="${safe(s.season_id)}" ${s===current?'selected':''}>${safe(s.season_name)}</option>`).join('')}</select></label><h3>${safe(current?.season_name||'Temporada não disponível')}</h3><p>${safe(current?.character_name||'Campeão ainda não definido')}</p><p>${safe(reason||'Elegibilidade não verificada.')}</p><p>Liderança provisória não concede título. Encerramento → certificação → sorteio → entrega manual.</p><button type="button" class="button button-ghost" data-rewards-refresh>Atualizar premiações</button></section></div>
  <section class="admin-panel machine-prize-preview">${itemAttribution()}<div class="panel-header"><h2>Espólios do apocalipse</h2><span>${preview.length} de ${catalog?.rewards?.length??'—'} recompensas</span></div><div class="machine-prize-grid">${preview.map(r=>itemCard(r)).join('')||'<p>Sem catálogo verificado nesta consulta.</p>'}</div><p>Versão ${safe(catalog?.version||'não confirmada')} · os 24 prêmios e seus pesos permanecem no catálogo. Entrega automática e veículos desabilitados.</p><button type="button" class="button button-ghost" data-admin-go="catalog">Ver catálogo e histórico</button></section>
  <dialog class="machine-victory" aria-labelledby="roulette-result-title"><div class="machine-victory-content"><button type="button" class="machine-modal-close" data-result-close aria-label="Fechar resultado">×</button><div class="machine-sparks" aria-hidden="true">${Array.from({length:16},(_,i)=>`<i style="--spark:${i}"></i>`).join('')}</div><p class="machine-result-source" data-result-source></p><h2 id="roulette-result-title">VOCÊ GANHOU!</h2><p class="machine-result-rarity" data-result-rarity></p><div data-result-prize></div><p data-result-note></p>${itemAttribution()}<div class="machine-result-actions"><button type="button" data-result-close class="button button-pink">INCRÍVEL!</button><button type="button" data-demo-again class="button button-ghost">Girar demonstração novamente</button></div></div></dialog>
 </div>`;
}

// Receives data and presentation callbacks only: no fetch or official-write callback.
export function mountRouletteMachine(root,{catalog,current,mode='demo',audioContext=null,onMode=()=>{}}={}){
 const $=selector=>root.querySelector(selector),lifetime=new AbortController();
 let destroyed=false,audio=audioContext,voices=[],effect=null,forced=null,debug=false,muted=false,volume=25,activity=0,writing=false,returnFocus=null;
 const dialog=$('dialog'),rotor=$('[data-reward-wheel]');
 try{muted=localStorage.getItem('winx.rewards.sound')==='muted';const stored=localStorage.getItem('winx.roulette.volume');if(stored!==null&&Number.isFinite(Number(stored)))volume=Math.max(0,Math.min(100,Number(stored)));}catch{}
 $('[data-roulette-audio]').checked=!muted;$('[data-roulette-volume]').value=String(volume);
 const status=text=>{$('[data-machine-status]').textContent=text;};
 function stopAudio(){for(const voice of voices){try{voice.stop();voice.disconnect();}catch{}}voices=[];}
 function primeAudio(){if(muted||volume===0)return;try{audio??=new(window.AudioContext||window.webkitAudioContext)();audio.resume().catch(()=>{});}catch{audio=null;}}
 function resultSound(){if(muted||!audio||volume===0)return;stopAudio();try{for(const [i,frequency] of [660,990].entries()){const osc=audio.createOscillator(),gain=audio.createGain(),at=audio.currentTime+i*.14;osc.type='sine';osc.frequency.value=frequency;gain.gain.setValueAtTime(0,at);gain.gain.linearRampToValueAtTime(.045*volume/100,at+.02);gain.gain.exponentialRampToValueAtTime(.0001,at+.28);osc.connect(gain);gain.connect(audio.destination);voices.push(osc);osc.start(at);osc.stop(at+.3);osc.onended=()=>{osc.disconnect();gain.disconnect();voices=voices.filter(v=>v!==osc);};}}catch{stopAudio();}}
 function closeResult(restore=true){const wasOpen=dialog.open;if(wasOpen)dialog.close();root.classList.remove('is-celebrating');stopAudio();if(wasOpen&&restore&&active()){const target=returnFocus?.isConnected&&!returnFocus.disabled?returnFocus:$(mode==='demo'?'#roulette-demo-panel [data-demo-spin]':'[data-official-replay]');target?.focus();}}
 function paint(){const saved=mode==='official'&&current?.draw?rewardRotation(current.draw.rarity):0;rotor.style.transform=`rotate(${saved??0}deg)`;}
 function buttons(){const disabled=writing||mode!=='demo'||spin.running||!demoCatalogReady(catalog);root.querySelectorAll('[data-demo-spin]').forEach(b=>b.disabled=disabled);$('[data-demo-rarity]').disabled=spin.running||writing;root.querySelectorAll('[data-roulette-mode]').forEach(b=>b.disabled=writing);}
 const spin=createSpinSession({
  animate:({from,to,duration,signal})=>new Promise((resolve,reject)=>{
   effect=rotor.animate([{transform:`rotate(${from}deg)`},{transform:`rotate(${to}deg)`}],{duration,easing:'cubic-bezier(.14,0,.1,1)',fill:'forwards'});
   const active=effect;
   const abort=()=>{active.cancel();reject(new DOMException('Giro interrompido','AbortError'));};
   signal.addEventListener('abort',abort,{once:true});
   active.finished.then(()=>{signal.removeEventListener('abort',abort);resolve();},error=>{signal.removeEventListener('abort',abort);reject(error);});
  }),
  onStart:(_,source)=>{closeResult(false);root.classList.add('is-spinning');$('.machine-stage').scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'center'});status(source==='demo'?'Girando demonstração… nenhum sorteio oficial é executado.':'Resultado já persistido. Revelando premiação oficial…');buttons();},
  onFinish:(result,source,angle)=>{
   rotor.style.transform=`rotate(${angle}deg)`;effect?.cancel();effect=null;root.classList.remove('is-spinning');buttons();
   if(!active())return;
   const reward=source==='demo'?result.reward:result.reward_snapshot;
   dialog.className=`machine-victory rarity-${result.rarity}`;
   $('[data-result-source]').textContent=source==='demo'?'DEMONSTRAÇÃO — SEM VALOR OFICIAL':'RESULTADO OFICIAL JÁ PERSISTIDO';
   $('#roulette-result-title').textContent=source==='demo'?'VOCÊ GANHOU!':'PREMIAÇÃO REVELADA!';
   $('[data-result-rarity]').textContent=(source==='demo'&&result.directed?'TESTE DIRIGIDO · ':'')+rarityNames[result.rarity];
   $('[data-result-prize]').innerHTML=itemCard({...reward,rarity:result.rarity},{debug:source==='demo'&&debug});
   $('[data-result-note]').textContent=source==='demo'?'Prêmio ilustrativo do catálogo. Nenhum item foi concedido e nenhum resultado oficial foi alterado.':`Sorteio gravado em ${rewardDate(result.drawn_at)}. Entrega continua sujeita à verificação manual da mesma vida.`;
   $('[data-demo-again]').hidden=source!=='demo';root.classList.add('is-celebrating');dialog.showModal();status(source==='demo'?'Demonstração concluída, sem valor oficial.':'Resultado oficial persistido confirmado.');resultSound();
  },
  onCancel:reason=>{effect?.cancel();effect=null;root.classList.remove('is-spinning');closeResult(false);paint();buttons();if(!destroyed&&reason!=='mode')status('Apresentação interrompida com segurança. Você pode iniciar outra demonstração.');},
  onError:()=>{root.classList.remove('is-spinning');paint();buttons();status('Não foi possível apresentar a animação. Resultados oficiais permanecem recuperáveis em Sorteio oficial.');},
 });
 function active(){return !destroyed&&root.isConnected&&!root.hidden&&!document.hidden&&root.getClientRects().length>0;}
 function cancel(reason){activity++;spin.cancel(reason);}
 function setMode(next){
  if(writing||!['demo','official'].includes(next))return;cancel('mode');mode=next;onMode(mode);
  const identity=$('[data-draw-identity]');if(identity)identity.checked=false;
  root.querySelectorAll('[data-roulette-mode]').forEach(b=>{b.setAttribute('aria-selected',String(b.dataset.rouletteMode===mode));b.tabIndex=b.dataset.rouletteMode===mode?0:-1;});
  $('#roulette-demo-panel').hidden=mode!=='demo';$('#roulette-official-panel').hidden=mode!=='official';
  $('[data-machine-mode-note]').textContent=mode==='demo'?'DEMONSTRAÇÃO — SEM VALOR OFICIAL':'SORTEIO OFICIAL · VALIDAÇÃO E PERSISTÊNCIA NO BACKEND';
  root.dataset.mode=mode;paint();buttons();status(mode==='demo'?'Máquina pronta para demonstração local.':current?.draw?'Resultado oficial recuperado do banco.':'Sorteio oficial sujeito à elegibilidade real.');
 }
 async function demonstrate(){
  if(writing||mode!=='demo'||spin.running||!active()||dialog.open)return;
  try{const result=chooseDemonstration(catalog,{forced});primeAudio();await spin.play(result,{source:'demo',reduced:matchMedia('(prefers-reduced-motion: reduce)').matches});}catch{status('Catálogo verificado indisponível para demonstração.');}
 }
 root.addEventListener('click',event=>{
  const button=event.target.closest('button');if(!button)return;
  if(button.matches('[data-roulette-mode]'))setMode(button.dataset.rouletteMode);
  else if(button.matches('[data-demo-spin]')){returnFocus=button;demonstrate();}
  else if(button.matches('[data-result-close]'))closeResult();
  else if(button.matches('[data-demo-again]')){closeResult(false);returnFocus=$('#roulette-demo-panel [data-demo-spin]');demonstrate();}
  else if(button.matches('[data-official-replay]')&&current?.draw){returnFocus=button;primeAudio();spin.play(current.draw,{source:'official',reduced:matchMedia('(prefers-reduced-motion: reduce)').matches});}
 },{signal:lifetime.signal});
 root.addEventListener('keydown',event=>{const tab=event.target.closest('[data-roulette-mode]');if(tab&&['ArrowLeft','ArrowRight','Home','End'].includes(event.key)){event.preventDefault();const next=event.key==='Home'?'demo':event.key==='End'?'official':mode==='demo'?'official':'demo';setMode(next);$(`[data-roulette-mode="${next}"]`).focus();}},{signal:lifetime.signal});
 root.addEventListener('change',event=>{if(event.target.matches('[data-demo-rarity]')){forced=event.target.value||null;status(forced?`Teste dirigido: ${rarityNames[forced]}. Sem alteração das chances oficiais.`:'Demonstração aleatória: probabilidades oficiais.');}if(event.target.matches('[data-demo-debug]'))debug=event.target.checked;if(event.target.matches('[data-roulette-audio]')){muted=!event.target.checked;if(muted)stopAudio();try{localStorage.setItem('winx.rewards.sound',muted?'muted':'on');}catch{}}},{signal:lifetime.signal});
 root.addEventListener('input',event=>{if(event.target.matches('[data-roulette-volume]')){volume=Number(event.target.value);if(volume===0)stopAudio();try{localStorage.setItem('winx.roulette.volume',String(volume));}catch{}}},{signal:lifetime.signal});
 root.addEventListener('error',event=>{if(event.target.matches?.('[data-verified-item-icon]')){event.target.hidden=true;event.target.closest('[data-item-icon]').classList.add('is-missing');const note=event.target.closest('.machine-prize').querySelector('.machine-image-note');if(note)note.textContent='Imagem indisponível para um componente. Fallback visual mantido; IDs e quantidades não mudam.';}},{capture:true,signal:lifetime.signal});
 dialog.addEventListener('cancel',event=>{event.preventDefault();closeResult();},{signal:lifetime.signal});
 dialog.addEventListener('keydown',event=>{
  if(event.key!=='Tab')return;
  const controls=[...dialog.querySelectorAll('button:not(:disabled)')].filter(b=>!b.hidden&&b.getClientRects().length),first=controls[0],last=controls.at(-1);
  if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}
  else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}
 },{signal:lifetime.signal});
 bindSpinLifecycle({document,window,signal:lifetime.signal,cancel});
 const visibility=new MutationObserver(()=>{if(!active())cancel('navigation');});
 for(let ancestor=root;ancestor&&ancestor!==document.body;ancestor=ancestor.parentElement)visibility.observe(ancestor,{attributes:true,attributeFilter:['hidden','style']});
 setMode(mode);
 return {get mode(){return mode;},get activity(){return activity;},get running(){return spin.running;},cancel,isActive:ticket=>active()&&mode==='official'&&ticket===activity,primeAudio,
  releaseAudio(){stopAudio();const context=audio;audio=null;return context;},
  setWriting(value){writing=value===true;buttons();},
  async revealOfficial(draw){if(!active()||mode!=='official')return false;return spin.play(draw,{source:'official',reduced:matchMedia('(prefers-reduced-motion: reduce)').matches});},
  destroy(){destroyed=true;cancel('destroy');visibility.disconnect();lifetime.abort();audio?.close().catch(()=>{});},
 };
}
