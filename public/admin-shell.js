import {escapeHtml as safe} from './contracts.js';
import {seasonDeadline} from './season-schedule.js';
import {rewardDate} from './rewards-view.js';
import {memorialCategories} from './championship.js';
import {statusState} from './status-view.js';
const pages={
 overview:['VISÃO GERAL / CONTROLE OPERACIONAL','O apocalipse sob controle.','Campeonato mensal, sobreviventes e infraestrutura em um só lugar.'],
 championship:['CAMPEONATO OFICIAL','Cada vida conta.','Classificação observada, calendário e certificação dos resultados.'],
 roulette:['SORTEIO SAZONAL / PAINEL ADMINISTRATIVO','Roleta dos Campeões','Uma recompensa oficial por temporada com campeão individual certificado.'],
 catalog:['PREMIAÇÕES / CATÁLOGO E HISTÓRICO','Catálogo e gerenciamento','Itens por raridade, resultados persistidos e entrega manual auditada.'],
 memorial:['HISTÓRIA / PROGRESSÃO','Memorial e medalhas','Registros preservados e conquistas vinculadas a vidas verificadas.'],
 system:['ADMINISTRAÇÃO / INFRAESTRUTURA','Sistema e telemetria','Sinais consultados com fonte, validade e limites explícitos.'],
 audit:['ADMINISTRAÇÃO / AUDITORIA','O que foi comprovado.','Verificações pontuais e rastreabilidade das operações administrativas.'],
};
let page='overview',dashboard=null,health=null,server=null,received=0,adminReceived=0,pending=false,started=false;
let callbacks={},generation=0,audit=null,auditPending=false,failedPrivate=false;
const $=selector=>document.querySelector(selector);
function navigate(next,focus=false){
 if(!Object.hasOwn(pages,next))return;page=next;
 document.querySelectorAll('[data-admin-view]').forEach(node=>{node.hidden=!node.dataset.adminView.split(' ').includes(page);});
 document.querySelectorAll('[data-admin-nav] button').forEach(node=>{if(node.dataset.adminGo===page)node.setAttribute('aria-current','page');else node.removeAttribute('aria-current');});
 ['eyebrow','heading','intro'].forEach((key,i)=>{const el=$(`[data-admin-${key}]`);if(el)el.textContent=pages[page][i];});
 if(focus){
  if(location.hash!=='#'+page)history.pushState(null,'',location.pathname+location.search+'#'+page);
  window.scrollTo({top:0,behavior:'instant'});
  $('[data-admin-heading]')?.focus({preventScroll:true});
 }
}
export function telemetryCards({health,server,operations,elapsed=0,operationsElapsed=0,checkedAt=operations?.checked_at}={}){
 const labels={healthy:'Coleta atualizada',collecting:'Coleta em andamento',stalled:'Execução sem conclusão',repeated_failures:'Falhas consecutivas',delayed:'Coleta atrasada',retry_needed:'Última tentativa falhou',awaiting_first_success:'Aguardando primeira coleta',unknown:'Não verificado nesta consulta'};
 const fresh=health?.contract==='collection-health-v1'&&elapsed>=0&&elapsed<=90000;
 const state=fresh?health.state:'unknown';
 const at=health?.server_time;
 const current=Date.parse(server?.serverTime||'')+elapsed;
 const online=statusState(server,current);
 const proofAge=Date.parse(checkedAt||'')-Date.parse(operations?.checked_at||'')+operationsElapsed;
 const security=operations?.contract==='admin-operations-v1'&&Number.isFinite(proofAge)&&proofAge>=-60000&&proofAge<=90000;
 const secure=security&&['private_tables_rls','private_tables_denied','private_rpcs_denied','clock_private'].every(k=>operations[k]===true);
 return [
  {name:'Coleta Railway',tone:state==='healthy'?'good':state==='unknown'?'neutral':'warning',title:labels[state]||labels.unknown,
   detail:fresh?`Último sucesso: ${rewardDate(health.last_success_at)}. Tentativa: ${health.latest_attempt_status||'desconhecida'} · ${rewardDate(health.latest_attempt_at)}. Falhas consecutivas: ${health.consecutive_failures}.`:'Consulta ausente ou expirada; atualize os sinais.',source:'Histórico do coletor · get_public_collection_health_v1',at},
  {name:'SFTP / origem',tone:'neutral',title:fresh&&health.latest_attempt_status==='failed'&&health.failure_family?.startsWith('source_')?'Falha de origem registrada':health?.last_success_at?'Última sincronização comprovada':'Sem leitura comprovada',
   detail:`${health?.failure_family?'Categoria: '+health.failure_family+'. ':''}Último sucesso: ${rewardDate(health?.last_success_at)}. Não é teste de conexão SFTP atual.`,source:'Inferência limitada ao resultado da coleta',at:health?.last_success_at},
  {name:'Servidor Project Zomboid',tone:online===true?'good':online===false?'warning':'neutral',title:online===true?'Respondeu à consulta pública':online===false?'Não respondeu à consulta pública':'Não verificado nesta consulta',
   detail:online===null?'Sem resposta válida dentro da janela de 2 minutos.':`Jogadores reportados: ${Number.isInteger(server?.players)?server.players:'não informado'}. Não certifica identidades.`,source:'Consulta pública do servidor · /api/status',at:server?.checkedAt},
  {name:'RLS e ACLs',tone:security?(secure?'good':'warning'):'neutral',title:security?(secure?'Verificação pontual aprovada':'Verificação requer atenção'):'Não verificado nesta consulta',
   detail:security?'Prova válida por 90 segundos. Consulte a matriz em Sistema e telemetria. Não é monitoramento contínuo nem auditoria de todo o schema.':'Prova ausente ou expirada. Use Reconsultar prova; não foi presumida aprovação.',scope:'Tabelas de vidas, gerações, arquivo e premiações; RPCs de premiação, backup, nome e relógio. A matriz resume RLS, acesso direto público, execução pública e relógio privado.',source:'Backend Admin · catálogos PostgreSQL',at:operations?.checked_at},
 ];
}
function renderSignals(){
 const cards=telemetryCards({health,server,operations:failedPrivate?null:dashboard?.operations,elapsed:performance.now()-received,operationsElapsed:performance.now()-adminReceived,checkedAt:dashboard?.checked_at});
 for(const selector of ['[data-admin-health-summary]','[data-admin-health-detail]']){
  const node=$(selector);if(!node)continue;const compact=selector.includes('summary');
  const markup=cards.map(c=>`<article class="admin-health-card"><small>${safe(c.name)}</small><strong class="signal-${c.tone}">${safe(c.title)}</strong><p>${compact?safe(rewardDate(c.at))+' · Brasília':safe(c.detail)}</p><details><summary>Fonte e limites</summary><p>${compact?safe(c.detail)+'<br>':''}${safe(c.source)}<br>${safe(rewardDate(c.at))} · Brasília</p></details></article>`).join('');
  if(node.dataset.markup!==markup){const open=[...node.querySelectorAll('details')].map(d=>d.open);node.innerHTML=markup;node.querySelectorAll('details').forEach((d,i)=>{d.open=open[i]===true;});node.dataset.markup=markup;}
 }
 const proof=$('[data-admin-acl]');if(proof){const c=cards[3],known=c.tone!=='neutral';const keys={private_tables_rls:'RLS nas tabelas privadas',private_tables_denied:'Acesso direto público negado',private_rpcs_denied:'Execução pública de RPCs negada',clock_private:'Relógio de ensaio privado'};
  const proofMarkup=`<h3>Prova de permissões</h3><p class="signal-${c.tone}">${safe(c.title)} · ${safe(rewardDate(c.at))} BRT</p><dl class="admin-acl-matrix">${Object.entries(keys).map(([key,label])=>`<div><dt>${label}</dt><dd>${known?(dashboard.operations[key]===true?'Confirmado':'Requer atenção'):'Não verificado'}</dd></div>`).join('')}</dl><details><summary>Escopo desta prova</summary><p>${safe(c.scope||c.detail)}</p><p>${safe(c.source)}. Validade: 90 segundos. Não cobre todo o schema.</p></details>`;
  if(proof.dataset.markup!==proofMarkup){const open=proof.querySelector('details')?.open;proof.innerHTML=proofMarkup;const details=proof.querySelector('details');if(details)details.open=open===true;proof.dataset.markup=proofMarkup;}
 }
}
async function refreshSignals(){
 if(pending||!dashboard)return;pending=true;const turn=generation;
 document.querySelectorAll('[data-telemetry-refresh], [data-admin-proof-refresh]').forEach(b=>b.disabled=true);
 const read=async url=>{try{const r=await fetch(url,{cache:'no-store',signal:AbortSignal.timeout(6000)});return r.ok?await r.json():null;}catch{return null;}};
 try{
  const [h,s,result]=await Promise.all([read('/api/collection-health'),read('/api/status'),
   callbacks.refreshAdmin?.().then(data=>({data})).catch(()=>({failed:true}))]);
  if(turn!==generation)return;
  health=h;server=s;received=performance.now();failedPrivate=result?.failed===true||!result?.data;
  if(failedPrivate)audit=null;
  renderSignals();renderAudit();
  const feedback=$('[data-admin-refresh-status]');if(feedback)feedback.textContent=failedPrivate?'Consulta administrativa indisponível. Provas privadas não verificadas; dados anteriores mantidos para consulta.':'Consulta concluída. Cada sinal conserva sua própria fonte e horário.';
 }finally{pending=false;document.querySelectorAll('[data-telemetry-refresh], [data-admin-proof-refresh]').forEach(b=>b.disabled=false);}
}
function renderAudit(){
 const node=$('[data-admin-audit-events]');if(!node)return;
 if(!audit){node.innerHTML='<p>Trilha indisponível nesta consulta. Reconsulte a prova autenticada.</p>';return;}
 node.innerHTML=`<p>Consulta da trilha: ${safe(rewardDate(audit.checked_at))} BRT · somente leitura.</p>${audit.events?.length?`<ol class="admin-audit-list">${audit.events.map(e=>`<li><time>${safe(rewardDate(e.occurred_at))} BRT</time><h3>Nome da temporada alterado</h3><p>${safe(e.actor)} · ${safe(e.result)}</p><p>${safe(e.previous_name)} → <strong>${safe(e.new_name)}</strong></p><p>Justificativa: ${safe(e.reason)}</p></li>`).join('')}</ol>`:'<p>Nenhum evento nesta página. Ausência de eventos não substitui uma auditoria completa.</p>'}${audit.next_cursor?'<button type="button" class="button button-ghost" data-audit-next>Eventos anteriores</button>':''}`;
}
async function nextAudit(){
 if(auditPending||!audit?.next_cursor||!dashboard)return;auditPending=true;const turn=generation;
 try{const value=await callbacks.readAudit?.(audit.next_cursor);if(turn===generation){audit=value;renderAudit();}}
 catch{if(turn===generation){audit=null;renderAudit();}}finally{auditPending=false;}
}
export function clearAdminOverview(){generation++;dashboard=null;audit=null;health=null;server=null;failedPrivate=true;}
export function renderAdminOverview(data){
 const initial=!dashboard;dashboard=data;adminReceived=performance.now();failedPrivate=false;audit=data.audit?.contract==='admin-audit-v1'?data.audit:null;
 const checked=$('[data-admin-checked]');if(checked)checked.textContent=`Painel consultado: ${rewardDate(data.checked_at)}`;
 const next=$('[data-next-turn]');if(next)next.textContent=seasonDeadline(data.activeSeason)||'Prazo não confirmado';
 const strip=$('[data-championship-current]');if(strip)strip.textContent=`${data.activeSeason?.name||'Temporada não confirmada'} · ${seasonDeadline(data.activeSeason)||'Prazo não confirmado'}`;
 const ops=data.operations;
 const summary=$('[data-admin-life-summary]');
 const counts=data.audit?.summary;
 if(summary)summary.innerHTML=`<div class="admin-memorial-grid"><article><h3>Certificação das vidas</h3><p>${ops?.life_enabled===true?'Pipeline habilitada':'Certificação pendente'}</p><strong>${counts?.native_lives??'—'}</strong><p>Vidas certificadas no pipeline. Não é a população observada do servidor.</p></article><article><h3>Conquistas vigentes</h3><strong>${counts?.active_medals??'—'}</strong><p>Critérios ativos na versão consultada · ${counts?.medal_unlocks??'—'} medalhas concedidas.</p><a href="/ranking#medalhas">Consultar critérios</a></article><article><h3>Registros preservados</h3><strong>${counts?.legacy_characters??'—'}</strong><p>Personagens no acervo legado. ${counts?.legacy_definitions??'—'} definições históricas preservadas.</p><a href="/memorial">Consultar Memorial</a></article></div><h3>Reconhecimentos especiais</h3><div class="admin-memorial-grid">${memorialCategories.map(c=>`<article><h4>${safe(c.title)}</h4><p>Resultado não certificado nesta consulta. Sem vida e métricas comprovadas, nenhum nome é atribuído.</p></article>`).join('')}</div>`;
 const auditNode=$('[data-admin-audit]');if(auditNode)auditNode.innerHTML=ops?`<p>Consulta PostgreSQL: ${safe(rewardDate(ops.checked_at))} · Brasília.</p><p>Calendário mensal: ${ops.monthly_enabled===true?'habilitado':'não habilitado'}. Gerações atestadas: ${safe(ops.source_epochs)}. Vidas nativas: ${safe(ops.native_lives)}. Sorteios oficiais: ${safe(ops.official_draws)}.</p><p>Esta leitura não executa reconciliação, sorteio ou entrega.</p>`:'<p>Verificação administrativa não disponível nesta consulta. Não foi presumida aprovação das permissões.</p>';
 navigate(page);renderSignals();renderAudit();if(initial&&started)refreshSignals();
}
export function setupAdminShell(options={}){
 callbacks=options;
 if(started)return;started=true;
 document.addEventListener('click',event=>{const button=event.target.closest('[data-admin-go]');if(button){navigate(button.dataset.adminGo,true);if(['audit','system'].includes(page)&&performance.now()-adminReceived>90000)refreshSignals();}if(event.target.closest('[data-telemetry-refresh], [data-admin-proof-refresh]'))refreshSignals();if(event.target.closest('[data-audit-next]'))nextAudit();});
 const restore=()=>navigate(Object.hasOwn(pages,location.hash.slice(1))?location.hash.slice(1):'overview');
 window.addEventListener('popstate',restore);window.addEventListener('hashchange',restore);
 document.addEventListener('admin-content-ready',()=>navigate(page));
 document.addEventListener('visibilitychange',()=>{if(!document.hidden&&dashboard)refreshSignals();});
 setInterval(()=>{if(dashboard&&!document.hidden)refreshSignals();},60000);
 setInterval(()=>{if(dashboard)renderSignals();},10000);
 navigate(Object.hasOwn(pages,location.hash.slice(1))?location.hash.slice(1):page);
}
