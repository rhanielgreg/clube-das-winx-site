import {escapeHtml as safe} from './contracts.js';
export const rarityNames={common:'Comum',uncommon:'Incomum',rare:'Rara',epic:'Épica',legendary:'Lendária'};
export function rewardDate(value){return Number.isFinite(Date.parse(value||''))?new Intl.DateTimeFormat('pt-BR',{dateStyle:'short',timeStyle:'short',timeZone:'America/Sao_Paulo'}).format(new Date(value)):'Horário indisponível';}
export const deliveryNames={pending:'Aguardando entrega',awaiting_online:'Aguardando a mesma vida voltar',blocked_identity:'Identidade pendente',delivering:'Entrega manual em andamento',sent_unconfirmed:'Enviada, sem comprovação',uncertain:'Entrega incerta — reconciliar',partial:'Entrega parcial',confirmed_manual:'Entrega confirmada manualmente',forfeited:'Direito material perdido por morte',needs_intervention:'Intervenção necessária'};
export function deliveryActions(state){
 if(['confirmed_manual','forfeited'].includes(state))return [];
 if(['pending','awaiting_online','blocked_identity','needs_intervention'].includes(state))return ['begin_manual','offline','block',...(state==='needs_intervention'?['confirm_component','not_delivered']:[])];
 if(['delivering','partial'].includes(state))return ['sent','uncertain','confirm_component','not_delivered'];
 if(['sent_unconfirmed','uncertain'].includes(state))return ['confirm_component','not_delivered'];
 return [];
}
export function rewardAnnouncement(draw){return `${draw.season_name} — ${draw.character_name} (${draw.steam_username||'Conta verificada'}) conquistou ${draw.reward_name} · ${rarityNames[draw.rarity]||draw.rarity}.`;}
export function publicRewards(data){
  if(!Array.isArray(data?.draws))return '<p>Premiações indisponíveis nesta consulta.</p>';
  if(!data.draws.length)return '<p>Nenhuma premiação oficial sorteada. O sorteio exige temporada encerrada e campeão individual certificado.</p>';
  return data.draws.map(draw=>`<article class="season-card"><small>PRÊMIO OFICIAL · ${safe(rarityNames[draw.rarity]||'')}</small><h3>${safe(draw.season_name)}</h3><p>${safe(draw.character_name)} · ${safe(draw.steam_username||'Conta verificada')}</p><p><strong>${safe(draw.reward_name)}</strong></p><p>${safe(rewardDate(draw.drawn_at))} · ${safe(deliveryNames[draw.delivery_state]||'Entrega pendente')}</p></article>`).join('');
}
export async function mountPublicRewards(){
  let root=document.querySelector('[data-public-rewards]');
  if(!root){const parent=document.querySelector('[data-season-ranking-panel]');if(!parent)return;const section=document.createElement('section');section.className='public-rewards';section.setAttribute('aria-label','Premiações oficiais');section.innerHTML='<h2>Premiações oficiais</h2><div data-public-rewards>Consultando premiações…</div>';parent.append(section);root=section.querySelector('[data-public-rewards]');}
  if(!document.querySelector('link[href="/rewards.css"]')){const style=document.createElement('link');style.rel='stylesheet';style.href='/rewards.css';document.head.append(style);}
  try{const response=await fetch('/api/rewards',{cache:'no-store'});if(!response.ok)throw Error();root.innerHTML=publicRewards(await response.json());}
  catch{root.textContent='Consulta de premiações temporariamente indisponível.';}
}
