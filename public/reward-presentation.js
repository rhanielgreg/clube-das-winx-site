import {escapeHtml as safe} from './contracts.js';
import {rarityNames,rewardDate} from './rewards-view.js';
export const rarityChances=Object.freeze({common:45,uncommon:30,rare:20,epic:4,legendary:1});
export function rewardRotation(rarity){
 const centers={common:81,uncommon:216,rare:306,epic:349.2,legendary:358.2};
 return Object.hasOwn(centers,rarity)?360-centers[rarity]:null;
}
const icons={common:'⚒',uncommon:'🎒',rare:'🧰',epic:'✦',legendary:'⚔'};
export function wheelPreview(){return `<div class="reward-wheel-stage"><div class="reward-fixed-pointer" aria-hidden="true"></div><div class="reward-wheel" data-reward-wheel role="img" aria-label="Roda ilustrativa: comum 45%, incomum 30%, rara 20%, épica 4%, lendária 1%. O resultado oficial é decidido no backend."><span class="wheel-label wheel-common">COMUM<br>45%</span><span class="wheel-label wheel-uncommon">INCOMUM<br>30%</span><span class="wheel-label wheel-rare">RARA<br>20%</span></div><div class="reward-wheel-brand" aria-hidden="true"><img src="/assets/winx-zomboid-profile.webp" alt=""><span>CLUBE DAS<br><b>WINX</b></span></div></div>`;}
export function rewardProbability(catalog,reward){
 const peers=catalog?.rewards?.filter(r=>r.rarity===reward.rarity)||[];
 const sum=peers.reduce((total,r)=>total+r.weight,0);
 return sum>0&&Object.hasOwn(rarityChances,reward.rarity)?rarityChances[reward.rarity]*reward.weight/sum:null;
}
export function catalogMarkup(catalog){
 if(!catalog?.rewards?.length)return '<p>Catálogo indisponível nesta consulta. Sorteio bloqueado.</p>';
 return `<div class="reward-catalog-columns">${Object.entries(rarityChances).map(([rarity,chance])=>`<section class="reward-rarity rarity-${rarity}"><header><h3>${safe(rarityNames[rarity])}</h3><p>Chance da raridade: <strong>${chance}%</strong></p></header>${catalog.rewards.filter(r=>r.rarity===rarity).map(r=>`<article class="reward-item"><span class="reward-item-icon" aria-hidden="true">${icons[rarity]}</span><div><h4>${safe(r.name)}</h4><small>${r.verified?'Itens conferidos na fonte':'Verificação pendente'}${r.items.length===2?' · 2 componentes':''}</small><p>${new Intl.NumberFormat('pt-BR',{maximumFractionDigits:3}).format(rewardProbability(catalog,r))}% por sorteio</p><details><summary>Detalhes técnicos</summary><p>${r.items.map(i=>`${safe(i.quantity)} × ${safe(i.script_id)}`).join('<br>')}<br>Peso: ${safe(r.weight)} · Build ${safe(r.server_build)}<br>Condição padrão; máxima não comprovada.</p><code>${safe(r.evidence_sha256)}</code></details></div></article>`).join('')}</section>`).join('')}</div>`;
}
export function historyMarkup(seasons=[]){
 return `<div class="table-scroll"><table class="admin-table reward-history"><thead><tr><th>TEMPORADA</th><th>CAMPEÃO</th><th>PRÊMIO</th><th>RARIDADE</th><th>RESULTADO</th></tr></thead><tbody>${seasons.map(s=>`<tr><td>${safe(s.season_name)}</td><td>${safe(s.character_name||'—')}</td><td>${safe(s.draw?.reward_snapshot?.name||'—')}</td><td>${safe(rarityNames[s.draw?.rarity]||'—')}</td><td>${s.draw?`Sorteio persistido<br>${safe(rewardDate(s.draw.drawn_at))}`:s.eligibility?.reason==='eligible'?'Campeão certificado · aguardando sorteio':s.eligibility?.reason==='stale_survival'?'Campeão certificado · atualizar sobrevivência':s.eligibility?.reason==='season_open'?'Em andamento':s.eligibility?.reason==='technical_tie'?'Empate técnico':s.eligibility?.reason==='apocalypse'?'O Apocalipse Venceu':'Sem premiação · certificação/eligibilidade pendente'}</td></tr>`).join('')||'<tr><td colspan="5">Nenhuma temporada disponível nesta consulta.</td></tr>'}</tbody></table></div><p class="muted">Resultados exibidos somente após persistência. A liderança provisória não substitui o campeão certificado.</p>`;
}
