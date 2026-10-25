import { escapeHtml as safe, formatNumber } from './contracts.js';
import { visibleAchievements,medalSvg } from './achievement-view.js';
const names={combate:'Combate',armas:'Armas',veiculos:'Veículos',tempo:'Tempo jogado',sobrevivencia:'Sobrevivência',exploracao:'Exploração',temporada:'Temporadas'};
function recognitionNote(unlock) {
 const date=value=>typeof value==='string'&&Number.isFinite(Date.parse(value))?safe(new Date(value).toLocaleString('pt-BR')):null;
 const observed=date(unlock?.observed_at),recognized=date(unlock?.recognized_at);
 return `${observed?'Evidência coletada em '+observed+'. ':''}${recognized?'Reconhecida em '+recognized+'. ':''}Data exata do feito desconhecida.`;
}
export function achievementPanel(data,selectedCategory='all') {
 if(!data||data.catalog_count!==100||!Array.isArray(data.catalog)||data.catalog.length!==100||!Array.isArray(data.unlocks)) return '<p class="dossier-note">Conquistas aguardando integração validada da vida. Nenhuma medalha é presumida.</p>';
 const earned=visibleAchievements(data.unlocks,data.catalog);
 const ids=new Set(data.unlocks.map(a=>a.achievement_id));
 const available=new Set(data.available_metrics||[]);
 if(data.alive_known)available.add('alive');
 if(data.archive_available)for(const key of ['best_season_kills_total','best_season_kills_firearm','best_season_kills_melee','best_season_kills_vehicle','seasons_completed_alive','official_wins','solo_official_wins'])available.add(key);
 const categories=['kills_axe','kills_blunt','kills_small_blunt','kills_long_blade','kills_small_blade','kills_spear','kills_unarmed','kills_firearm','kills_vehicle','kills_other'];
 if(categories.every(k=>available.has(k)))available.add('categories_with_100_kills');
 const complete=new Set(data.complete_metrics||[]);
 const missing=(a)=>!data.identity_verified||a.criteria.some(c=>!available.has(c.metric)||c.op==='eq'&&c.metric!=='alive'&&!complete.has(c.metric));
 // Sequências possuem 3 desbloqueios no total, mas uma única medalha visível.
 const cards=data.catalog.filter(a=>!a.sequence||a.level_rank===3).map(top=>{
  const won=earned.visible.find(a=>a.id===top.id||top.sequence&&a.sequence===top.sequence);
  const next=top.sequence?data.catalog.find(a=>a.sequence===top.sequence&&!ids.has(a.id)):top;
  return {shown:won||{...top,name:top.sequence?top.name.replace(/ — Ouro$/,''):top.name},target:next||top,won,recognition:won?recognitionNote(data.unlocks.find(row=>row.achievement_id===won.id)):null,waiting:!won&&missing(next||top),next:!!next&&!!won};
 }).filter(row=>selectedCategory==='all'||row.shown.category===selectedCategory);
 return `<details class="achievement-section" data-achievement-details><summary><span>CONQUISTAS DESTA VIDA</span><b>${formatNumber(earned.total)} / 100</b></summary><div class="achievement-content"><p class="dossier-note">${data.identity_verified?'Desbloqueios preservados nesta vida, inclusive após a morte.':'Identidade individual ainda não certificada: nenhum desbloqueio autorizado.'} Cada nível conta no total; a medalha mostra o maior nível obtido.</p><label class="achievement-filter">Categoria <select data-achievement-filter><option value="all" ${selectedCategory==='all'?'selected':''}>Todas</option>${Object.entries(names).map(([key,label])=>`<option value="${key}" ${selectedCategory===key?'selected':''}>${label}</option>`).join('')}</select></label><div class="achievement-grid">${cards.map(row=>`<article class="achievement-card ${row.won?'is-earned':'is-locked'}">${medalSvg(row.shown)}<div><small>${safe(names[row.shown.category])}</small><h3>${safe(row.shown.name)}</h3><p>${row.next?'Próximo nível: ':''}${safe(row.target.description)}</p><b>${row.won?'Desbloqueada':row.waiting?'Aguardando evidência':'Ainda não alcançada'}</b>${row.won?`<p class="achievement-date-note">${row.recognition}</p>`:''}</div></article>`).join('')}</div></div></details>`;
}
