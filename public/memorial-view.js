import { escapeHtml as safe, formatNumber, formatDuration, hasNumber, UUID } from './contracts.js';
import { memorialCategories } from './championship.js';

export function verifiedDistance(row) {
  return row.life_identity_verified===true && row.distance_unit==='meters' && hasNumber(row.distance_total_m) && Number(row.distance_total_m)>=0
    ? Number(row.distance_total_m)/1000 : null;
}
export function memorialHonors(results) {
  if(!Array.isArray(results))return '';
  return memorialCategories.flatMap(category=>{
    const row=results?.find(value=>value.metric===category.metric);
    const unit={kills_total:'count',survival_world_days:'world_days',distance_total_m:'meters'}[category.metric];
    if(row?.state!=='ready'||row.unit!==unit||!hasNumber(row.value)||Number(row.value)<0||!Array.isArray(row.winners)||!row.winners.length||
      !row.winners.every(winner=>UUID.test(winner.profile_id||'')&&typeof winner.character_name==='string'&&winner.character_name.trim()))return [];
    const metric=unit==='meters'?`${formatNumber(Number(row.value)/1000)} km`:unit==='world_days'?`${formatNumber(row.value)} dias no mundo`:`${formatNumber(row.value)} kills na vida`;
    return [`<article><small>HOMENAGEM COMPROVADA</small><h2>${safe(category.title)}</h2><p>${row.winners.length>1?'Empate · ':''}${row.winners.map(winner=>`<span>${safe(winner.character_name)}</span>`).join(' · ')}</p><b>${safe(metric)}</b></article>`];
  }).join('');
}
export function memorialCard(row,formatDate,demo=false) {
  const named=row.character_name||'Nome não informado';
  const death=typeof row.died_at==='string'&&Number.isFinite(Date.parse(row.died_at))?row.died_at:null;
  const distance=verifiedDistance(row);
  return `<article class="memorial-card"><div class="memorial-card-top"><div class="memorial-stone"><small>EM MEMÓRIA DE</small><h3>${safe(named)}</h3>${death?`<time datetime="${safe(death)}">✝ ${safe(formatDate(death,false))}</time>`:'<span class="stone-date-unknown">Data de morte não informada</span>'}</div></div><div class="memorial-card-body"><h3 class="sr-only">${safe(named)}</h3><p class="memorial-account">Jogador / ${safe(row.steam_username||'Não informado')}</p><div class="memorial-numbers"><div><b>${formatNumber(row.kills_total)}</b><small>KILLS / ${safe(row.season_name||'TEMPORADA NÃO INFORMADA')}</small></div><div><b>${formatDuration(row.survival_seconds)}</b><small>TEMPO JOGADO</small></div>${distance!==null?`<div class="memorial-distance"><b>${formatNumber(distance)} km</b><small>DISTÂNCIA TOTAL PERCORRIDA</small></div>`:''}</div><div class="memorial-foot">${death?`<span class="memorial-date"><small>Morte registrada</small><time datetime="${safe(death)}">${safe(formatDate(death,false))}</time></span>`:''}</div>${demo?'<span class="memorial-demo">PERSONAGEM E ESTATÍSTICAS FICTÍCIOS</span>':''}</div></article>`;
}
