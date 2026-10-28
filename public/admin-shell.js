import {escapeHtml as safe} from './contracts.js';
import {seasonDeadline} from './season-schedule.js';
import {rewardDate} from './rewards-view.js';
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
let page='overview',dashboard=null,health=null,server=null,received=0,pending=false,started=false;
const $=selector=>document.querySelector(selector);
function navigate(next,focus=false){
 if(!Object.hasOwn(pages,next))return;page=next;
 document.querySelectorAll('[data-admin-view]').forEach(node=>{node.hidden=!node.dataset.adminView.split(' ').includes(page);});
 document.querySelectorAll('[data-admin-nav] button').forEach(node=>{if(node.dataset.adminGo===page)node.setAttribute('aria-current','page');else node.removeAttribute('aria-current');});
 ['eyebrow','heading','intro'].forEach((key,i)=>{const el=$(`[data-admin-${key}]`);if(el)el.textContent=pages[page][i];});
 if(focus){
  history.replaceState(null,'',location.pathname+location.search+'#'+page);
  window.scrollTo({top:0,behavior:'instant'});
  $('[data-admin-heading]')?.focus({preventScroll:true});
 }
}
export function telemetryCards({health,server,operations,elapsed=0}={}){
 const labels={healthy:'Coleta atualizada',collecting:'Coleta em andamento',stalled:'Execução sem conclusão',repeated_failures:'Falhas consecutivas',delayed:'Coleta atrasada',retry_needed:'Última tentativa falhou',awaiting_first_success:'Aguardando primeira coleta',unknown:'Não verificado nesta consulta'};
 const fresh=health?.contract==='collection-health-v1'&&elapsed>=0&&elapsed<=90000;
 const state=fresh?health.state:'unknown';
 const at=health?.server_time;
 const current=Date.parse(server?.serverTime||'')+elapsed;
 const online=statusState(server,current);
 const security=operations?.contract==='admin-operations-v1';
 const secure=security&&['private_tables_rls','private_tables_denied','private_rpcs_denied','clock_private'].every(k=>operations[k]===true);
 return [
  {name:'Coleta Railway',tone:state==='healthy'?'good':state==='unknown'?'neutral':'warning',title:labels[state]||labels.unknown,
   detail:fresh?`Último sucesso: ${rewardDate(health.last_success_at)}. Tentativa: ${health.latest_attempt_status||'desconhecida'} · ${rewardDate(health.latest_attempt_at)}. Falhas consecutivas: ${health.consecutive_failures}.`:'Consulta ausente ou expirada; atualize os sinais.',source:'Histórico do coletor · get_public_collection_health_v1',at},
  {name:'SFTP / origem',tone:'neutral',title:fresh&&health.latest_attempt_status==='failed'&&health.failure_family?.startsWith('source_')?'Falha de origem registrada':health?.last_success_at?'Última sincronização comprovada':'Sem leitura comprovada',
   detail:`${health?.failure_family?'Categoria: '+health.failure_family+'. ':''}Último sucesso: ${rewardDate(health?.last_success_at)}. Não é teste de conexão SFTP atual.`,source:'Inferência limitada ao resultado da coleta',at},
  {name:'Servidor Project Zomboid',tone:online===true?'good':online===false?'warning':'neutral',title:online===true?'Respondeu à consulta pública':online===false?'Não respondeu à consulta pública':'Não verificado nesta consulta',
   detail:online===null?'Sem resposta válida dentro da janela de 2 minutos.':`Jogadores reportados: ${Number.isInteger(server?.players)?server.players:'não informado'}. Não certifica identidades.`,source:'Consulta pública do servidor · /api/status',at:server?.checkedAt},
  {name:'RLS e ACLs',tone:security?(secure?'good':'warning'):'neutral',title:security?(secure?'Verificação pontual aprovada':'Verificação requer atenção'):'Não verificado nesta consulta',
   detail:security?`Escopo: tabelas de vidas, gerações, arquivo e premiações; RPCs de premiação, backup, nome e relógio. RLS: ${operations.private_tables_rls===true?'sim':'não'}. Acesso direto/RPCs negados: ${operations.private_tables_denied===true&&operations.private_rpcs_denied===true?'sim':'não'}. Relógio privado: ${operations.clock_private===true?'sim':'não'}. Não é monitoramento contínuo nem auditoria de todo o schema.`:'O backend não retornou a prova de permissões.',source:'Backend Admin · catálogos PostgreSQL',at:operations?.checked_at},
 ];
}
function renderSignals(){
 const cards=telemetryCards({health,server,operations:dashboard?.operations,elapsed:performance.now()-received});
 for(const selector of ['[data-admin-health-summary]','[data-admin-health-detail]']){
  const node=$(selector);if(!node)continue;const compact=selector.includes('summary');
  node.innerHTML=cards.map(c=>`<article class="admin-health-card"><small>${safe(c.name)}</small><strong class="signal-${c.tone}">${safe(c.title)}</strong><p>${compact?safe(rewardDate(c.at))+' · Brasília':safe(c.detail)}</p><details><summary>Fonte e limites</summary><p>${compact?safe(c.detail)+'<br>':''}${safe(c.source)}<br>${safe(rewardDate(c.at))} · Brasília</p></details></article>`).join('');
 }
}
async function refreshSignals(){
 if(pending)return;pending=true;
 const read=async url=>{try{const response=await fetch(url,{cache:'no-store',signal:AbortSignal.timeout(6000)});return response.ok?await response.json():null;}catch{return null;}};
 try{[health,server]=await Promise.all([read('/api/collection-health'),read('/api/status')]);received=performance.now();renderSignals();}
 finally{pending=false;}
}
export function renderAdminOverview(data){
 dashboard=data;
 const checked=$('[data-admin-checked]');if(checked)checked.textContent=`Painel consultado: ${rewardDate(data.checked_at)}`;
 const next=$('[data-next-turn]');if(next)next.textContent=seasonDeadline(data.activeSeason)||'Prazo não confirmado';
 const ops=data.operations;
 const life=ops?.life_enabled===true?'Pipeline de vidas habilitada':'Certificação das vidas pendente';
 const summary=$('[data-admin-life-summary]');if(summary)summary.innerHTML=`<p class="status-badge warning">${safe(life)}</p><p>${ops?`${safe(ops.native_lives)} vidas nativas · ${safe(ops.medal_unlocks)} medalhas concedidas`:'Contagem não verificada nesta consulta.'}</p>`;
 const audit=$('[data-admin-audit]');if(audit)audit.innerHTML=ops?`<p>Consulta PostgreSQL: ${safe(rewardDate(ops.checked_at))} · Brasília.</p><p>Calendário mensal: ${ops.monthly_enabled===true?'habilitado':'não habilitado'}. Gerações atestadas: ${safe(ops.source_epochs)}. Vidas nativas: ${safe(ops.native_lives)}. Sorteios oficiais: ${safe(ops.official_draws)}.</p><p>Esta leitura não executa reconciliação, sorteio ou entrega.</p>`:'<p>Verificação administrativa não disponível nesta consulta. Não foi presumida aprovação das permissões.</p>';
 navigate(page);renderSignals();if(started)refreshSignals();
}
export function setupAdminShell(){
 if(started)return;started=true;
 document.addEventListener('click',event=>{const button=event.target.closest('[data-admin-go]');if(button)navigate(button.dataset.adminGo,true);if(event.target.closest('[data-telemetry-refresh]'))refreshSignals();});
 document.addEventListener('admin-content-ready',()=>navigate(page));
 document.addEventListener('visibilitychange',()=>{if(!document.hidden&&dashboard)refreshSignals();});
 setInterval(()=>{if(dashboard&&!document.hidden)refreshSignals();},60000);
 setInterval(()=>{if(dashboard)renderSignals();},10000);
 navigate(Object.hasOwn(pages,location.hash.slice(1))?location.hash.slice(1):page);
}
