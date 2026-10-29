import {escapeHtml as safe} from './contracts.js';
import {rarityNames,deliveryNames,rewardDate} from './rewards-view.js';
import {recipientName} from './roulette-operational.js';
export function rewardRecords(seasons=[],weekly=[]){return [
 ...seasons.filter(s=>s.draw).map(s=>({...s.draw,id:s.season_id,modality:'official',period:s.season_name})),
 ...weekly.map(d=>({...d,modality:'weekend',period:`Fim de semana · ${rewardDate(d.window_start)}`}))
].sort((a,b)=>Date.parse(b.drawn_at)-Date.parse(a.drawn_at));}
export function filterRewardHistory(records,{modality='all',participant='',prize='',from='',to='',delivery='all'}={}){
 const norm=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
 return records.filter(d=>{const day=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(d.drawn_at));
 return (modality==='all'||modality===d.modality)&&(delivery==='all'||delivery===d.delivery_state)
 &&norm(recipientName(d,d.modality)).includes(norm(participant))&&norm(d.reward_snapshot?.name).includes(norm(prize))
 &&(!from||day>=from)&&(!to||day<=to);});
}
export function historyMarkupV3(records,filters={}){
 const visible=filterRewardHistory(records,filters);
 return `<div class="reward-filters reward-history-filters"><label>Modalidade<select data-history-filter="modality">${[['all','Todas'],['weekend','Semanais'],['official','Oficiais']].map(([v,n])=>`<option value="${v}" ${filters.modality===v?'selected':''}>${n}</option>`).join('')}</select></label><label>Participante<input type="search" data-history-filter="participant" value="${safe(filters.participant||'')}"></label><label>Prêmio<input type="search" data-history-filter="prize" value="${safe(filters.prize||'')}"></label><label>De<input type="date" data-history-filter="from" value="${safe(filters.from||'')}"></label><label>Até<input type="date" data-history-filter="to" value="${safe(filters.to||'')}"></label><label>Entrega<select data-history-filter="delivery"><option value="all">Todas</option>${Object.entries(deliveryNames).map(([v,n])=>`<option value="${v}" ${filters.delivery===v?'selected':''}>${safe(n)}</option>`).join('')}</select></label></div><div data-history-results>${historyRowsV3(visible)}</div>`;
}
export function historyRowsV3(records){return `<div class="table-scroll" tabindex="0" role="region" aria-label="Histórico semanal e mensal"><table class="admin-table"><thead><tr><th>Modalidade / período</th><th>Participante</th><th>Prêmio</th><th>Data</th><th>Entrega</th><th>Registro</th></tr></thead><tbody>${records.map(d=>`<tr><td>${d.modality==='weekend'?'Semanal':'Oficial'}<br>${safe(d.period)}</td><td>${safe(recipientName(d,d.modality)||'Não informado')}</td><td>${safe(d.reward_snapshot?.name)} · ${safe(rarityNames[d.rarity])}</td><td>${safe(rewardDate(d.drawn_at))}</td><td>${safe(deliveryNames[d.delivery_state]||'Não consultada')}</td><td><button type="button" class="button button-ghost" data-history-open="${safe(d.id)}" data-history-modality="${d.modality}">ABRIR PRÊMIO</button></td></tr>`).join('')||'<tr><td colspan="6">Nenhuma premiação persistida corresponde à consulta.</td></tr>'}</tbody></table></div>`;}
export function pendingSeasonsMarkup(seasons=[]){const pending=seasons.filter(s=>!s.draw);return pending.length?`<details><summary>Temporadas sem premiação (${pending.length})</summary><ul>${pending.map(s=>`<li>${safe(s.season_name)} · ${s.eligibility?.reason==='season_open'?'Em andamento':'Certificação ou elegibilidade pendente'}</li>`).join('')}</ul></details>`:'';}
