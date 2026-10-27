import{escapeHtml as safe,formatNumber}from'./contracts.js';
import{characterAvatar}from'./avatar.js';
export function renderGlobalRanking(data,search=''){
 if(!Array.isArray(data?.ranking))return '<p class="error-box">Ranking Global indisponível nesta consulta.</p>';
 if(!data.ranking.length)return '<p class="page-intro">O Ranking Global aguarda vidas vinculadas a contas Steam verificadas. O histórico ambíguo foi preservado.</p>';
 const rows=data.ranking.filter(r=>String(r.steam_username||'').toLocaleLowerCase('pt-BR').includes(search.toLocaleLowerCase('pt-BR')));
 return rows.map(r=>`<article class="global-account"><b>${safe(r.rank_position)}</b><img src="${safe(characterAvatar({...r,character_name:r.steam_username}).src)}" alt="" loading="lazy"><div><h3>${safe(r.steam_username||'Conta Steam verificada')}</h3><p>${formatNumber(r.lives_count)} vidas verificadas · histórico parcial</p></div><strong>${formatNumber(r.kills_total)}<small> KILLS HISTÓRICAS</small></strong></article>`).join('')||'<p>Nenhuma conta encontrada nesta consulta.</p>';
}
export function mountRankingModes(){
 const root=document.querySelector('[data-ranking-modes]');if(!root)return;
 const buttons=[...root.querySelectorAll('[role=tab]')];let data=null,busy=false;
 const content=document.querySelector('[data-global-rows]'),search=document.querySelector('[data-global-search]');
 async function load(){if(busy)return;busy=true;content.textContent='Consultando contas verificadas…';try{
  const response=await fetch('/api/global-ranking',{cache:'no-store'});if(!response.ok)throw Error();data=await response.json();content.innerHTML=renderGlobalRanking(data,search.value);
 }catch{content.innerHTML='<p class="error-box">Não foi possível consultar o Ranking Global. Use Atualizar para tentar novamente.</p>';}finally{busy=false;}}
 function select(index){buttons.forEach((b,i)=>{b.setAttribute('aria-selected',String(i===index));b.tabIndex=i===index?0:-1;});document.querySelector('[data-season-ranking-panel]').hidden=index!==0;document.querySelector('[data-global-ranking-panel]').hidden=index!==1;
  const title=document.querySelector('.page-hero h1'),chip=document.querySelector('.season-chip');
  if(title)title.innerHTML=index===0?'RANKING DA<br><em>TEMPORADA</em>':'RANKING<br><em>GLOBAL</em>';if(chip)chip.hidden=index===1;
  if(index===1&&!data)load();}
 buttons.forEach((b,i)=>{b.addEventListener('click',()=>select(i));b.addEventListener('keydown',event=>{const next=event.key==='ArrowRight'?(i+1)%2:event.key==='ArrowLeft'?(i+1)%2:event.key==='Home'?0:event.key==='End'?1:null;if(next!==null){event.preventDefault();select(next);buttons[next].focus();}});});
 search.addEventListener('input',()=>{if(data)content.innerHTML=renderGlobalRanking(data,search.value);});
 document.querySelector('[data-global-refresh]').addEventListener('click',load);
}
