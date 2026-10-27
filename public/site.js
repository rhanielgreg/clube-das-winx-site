import { rankingClock, clockNow } from './ranking-clock.js';
import { killBreakdown, killBreakdownText, rankingResidual } from './kill-breakdown.js';
import { collectionCountdown } from './collection-countdown.js';
import { formatNumber, formatDuration, hasNumber, lifeState, escapeHtml as safe, filterRanking, normalizeRankingFilter } from './contracts.js';
import { memorialDate } from './presentation.js';
import { characterAvatar } from './avatar.js';
import { livingRanking, seasonResult } from './championship.js';
import { mountFooter } from './footer.js';
import { memorialCard, memorialHonors } from './memorial-view.js';
import { seasonDeadline, seasonCountdown } from './season-schedule.js';
import { statusState } from './status-view.js';
import { mountRankingModes } from './ranking-modes.js';
import { mountMedals } from './medal-showcase.js';
import { mountPublicRewards } from './rewards-view.js';
mountRankingModes();
mountPublicRewards();

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const filters = { filter: normalizeRankingFilter(new URLSearchParams(location.search).get('filter')), search: '' };
let rankingPayload = null;
let memorialSearch = '';
let isDemo = false;
let statusPayload = null;
let statusLoading = false;
const scenario = new URLSearchParams(location.search).get('scenario');
const date = (value, withTime = true) => {
  if (!value || !Number.isFinite(Date.parse(value))) return 'Não informado';
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', ...(withTime ? { timeStyle: 'short' } : {}), timeZone: 'America/Sao_Paulo' }).format(new Date(value));
};
const setText = (selector, value) => $$(selector).forEach((node) => { node.textContent = value; });
const publicDestination = (row) => row?.alive===false?'/memorial':'/ranking';
const stateBadge = (value) => { const state = lifeState(value); return `<span class="state-pill ${state.className}">${state.label}</span>`; };
const avatarAttributes = (row) => { const avatar = characterAvatar(row); return `src="${safe(avatar.src)}" data-avatar-fallback="${safe(avatar.fallback)}" title="${safe(avatar.label)}"`; };

function decorateLinks() {
  if (!['offline', 'empty', 'stale', 'no-champion', 'server-offline', 'server-unknown', 'advanced', 'achievements'].includes(scenario)) return;
  $$('a[href]').forEach((link) => {
    if (link.closest('.demo-banner')) return;
    const url = new URL(link.href, location.href);
    if (url.origin === location.origin && !url.pathname.startsWith('/api/')) {
      url.searchParams.set('scenario', scenario);
      link.href = url.pathname + url.search + url.hash;
    }
  });
}

function showDemo() {
  if (isDemo) return;
  isDemo = true;
  const banner = document.createElement('div');
  banner.className = 'demo-banner';
  banner.setAttribute('role', 'note');
  banner.innerHTML = '<b>DEMONSTRAÇÃO LOCAL</b><span>Personagens e estatísticas fictícios.</span><details><summary>Cenários de teste</summary><div><a href="/index.html">Normal</a><a href="/ranking?scenario=empty">Sem dados</a><a href="/ranking?scenario=offline">Falha de consulta</a><a href="/ranking?scenario=stale">Desatualizado</a><a href="/ranking?scenario=no-champion">Sem campeão</a><a href="/index.html?scenario=server-offline#servidor">Servidor offline</a><a href="/index.html?scenario=server-unknown#servidor">Status indisponível</a><a href="/ranking?scenario=advanced#sobreviventes">Métricas futuras fictícias</a><a href="/ranking?scenario=achievements#sobreviventes">Motor de conquistas local</a></div></details>';
  document.body.prepend(banner);
  document.body.classList.add('is-demo');
  const updateHeight = () => document.documentElement.style.setProperty('--demo-height', `${banner.getBoundingClientRect().height}px`);
  updateHeight();
  new ResizeObserver(updateHeight).observe(banner);
}

function showPublicPreview() {
  if($('[data-public-preview]'))return;
  const banner=document.createElement('div');banner.className='demo-banner';banner.dataset.publicPreview='true';banner.setAttribute('role','note');
  banner.innerHTML='<b>PRÉVIA LOCAL</b><span>Dados públicos reais · somente leitura · alterações ainda não publicadas</span>';
  document.body.prepend(banner);document.body.classList.add('is-preview');
  const resize=()=>document.documentElement.style.setProperty('--demo-height',`${banner.getBoundingClientRect().height}px`);
  resize();new ResizeObserver(resize).observe(banner);
}

async function request(path) {
  const url = new URL(path, location.origin);
  if (['offline', 'empty', 'stale', 'no-champion', 'server-offline', 'server-unknown', 'advanced', 'achievements'].includes(scenario)) url.searchParams.set('scenario', scenario);
  const response = await fetch(url, { signal: AbortSignal.timeout(15000), ...(url.pathname==='/api/ranking'?{cache:'no-store'}:{}) });
  const data = await response.json();
  if(url.pathname==='/api/ranking')data.collection_clock=rankingClock(data,response.headers,performance.now(),rankingPayload?.collection_clock);
  if(url.pathname==='/api/status') {
    const server=Date.parse(data.serverTime||response.headers.get('date')||data.checkedAt||'');
    data.status_clock={server,received:performance.now()};
  }
  if (data.demo) showDemo();
  if (data.preview) showPublicPreview();
  if (!response.ok) throw new Error(data.error || data.message || 'Não foi possível consultar os registros.');
  return data;
}

function showToast(message) {
  const toast = $('[data-toast]');
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add('is-visible');
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove('is-visible'), 3500);
}

function setupNavigation() {
  const updateActive = () => $$('[data-nav]').forEach((link) => {
    const page = location.hash === '#sobreviventes' ? 'survivors' : location.hash === '#servidor' ? 'server' : document.body.dataset.page;
    const active = link.dataset.nav === page;
    link.classList.toggle('is-active', active);
    if (active) link.setAttribute('aria-current', 'page'); else link.removeAttribute('aria-current');
  });
  updateActive();
  addEventListener('hashchange', updateActive);
  const menu = $('[data-menu]');
  const open = $('[data-menu-open]');
  if (!menu || !open) return;
  const toggle = (visible) => {
    menu.classList.toggle('is-open', visible);
    menu.setAttribute('aria-hidden', String(!visible));
    open.setAttribute('aria-expanded', String(visible));
    document.body.classList.toggle('menu-open', visible);
    (visible ? $('[data-menu-close]') : open)?.focus();
  };
  open.addEventListener('click', () => toggle(true));
  $('[data-menu-close]').addEventListener('click', () => toggle(false));
  $$('a', menu).forEach((link) => link.addEventListener('click', () => toggle(false)));
  addEventListener('keydown', (event) => {
    if (!menu.classList.contains('is-open')) return;
    if (event.key === 'Escape') toggle(false);
    if (event.key === 'Tab') {
      const items = $$('a,button', menu); const first = items[0]; const last = items.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
  });
}

async function loadStatus() {
  if (!$('[data-server-state]') || statusLoading) return;
  statusLoading=true;
  try {
    const payload = await request('/api/status');
    statusPayload=payload;
    updateStatusState();
    setText('[data-server-latency]', hasNumber(payload.latencyMs) ? `${formatNumber(payload.latencyMs)} ms` : '—');
    setText('[data-server-last-valid]', payload.lastValidAt ? date(payload.lastValidAt) : 'Não disponível');
    setText('[data-server-checked]', payload.checkedAt ? date(payload.checkedAt) : 'Não disponível');
    setText('[data-server-ip]', payload.demo ? 'Endereço desativado na prévia' : payload.ip || 'Não informado');
    setText('[data-server-ddns]', payload.demo ? 'Demonstração sem conexão' : payload.ddns || 'Não informado');
    $$('[data-copy-source]').forEach((button) => {
      const value = payload[button.dataset.copySource];
      button.disabled = payload.demo || !value;
      button.onclick = async () => { try { await navigator.clipboard.writeText(value); showToast('Endereço copiado. Nos vemos do outro lado.'); } catch { showToast(`Copie: ${value}`); } };
    });
    const box = $('[data-online-players-box]');
    if (box) {
      const players = currentStatusState()===true && payload.playerListVerified === true && Array.isArray(payload.playerList) ? payload.playerList : [];
      box.hidden = !players.length;
      $('[data-online-players-list]').innerHTML = players.map((p) => `<span class="online-pill">● ${safe(p.name)}</span>`).join('');
    }
  } catch {
    statusPayload=null;
    $$('[data-status-orb]').forEach((orb) => { orb.classList.remove('is-online', 'is-offline'); orb.classList.add('is-unknown'); });
    setText('[data-server-state]', 'Indisponível');
    setText('[data-server-players]', '— / —');
    setText('[data-server-latency]', '—');
    setText('[data-server-checked]', 'Consulta indisponível');
    setText('[data-server-ip]', 'Não foi possível consultar');
    setText('[data-server-ddns]', 'Não foi possível consultar');
    if ($('[data-online-players-box]')) $('[data-online-players-box]').hidden = true;
    $$('[data-copy-source]').forEach((button) => { button.disabled = true; });
  } finally {statusLoading=false;}
}

function currentStatusState() {
  const clock=statusPayload?.status_clock;
  return statusState(statusPayload,clock?clock.server+performance.now()-clock.received:NaN);
}
function updateStatusState() {
  const online=currentStatusState();
  setText('[data-server-state]', online===true?(statusPayload.demo?'Online · demo':'Online'):online===false?(statusPayload.demo?'Offline · demo':'Offline'):'Indisponível');
  setText('[data-server-players]', online===null?'— / —':`${formatNumber(statusPayload.players)} / ${formatNumber(statusPayload.maxPlayers)}`);
  $$('[data-status-orb]').forEach(orb=>{orb.classList.toggle('is-online',online===true);orb.classList.toggle('is-offline',online===false);orb.classList.toggle('is-unknown',online===null);});
  if(online!==true&&$('[data-online-players-box]'))$('[data-online-players-box]').hidden=true;
}

function updateLeader(row, unavailable = false) {
  setText('[data-leader-name]', row?.steam_username || row?.character_name || (unavailable ? 'Consulta indisponível' : 'Aguardando desafiante'));
  setText('[data-leader-account]', row?.character_name ? `PERSONAGEM / ${row.character_name}` : unavailable ? 'Não foi possível consultar o líder' : 'Nenhuma estatística validada disponível');
  setText('[data-leader-position]', row?.rank_position || '—');
  $$('.leader-portrait img, [data-leader-avatar]').forEach((image) => {
    if (row) { const avatar = characterAvatar(row); image.dataset.avatarFallback = avatar.fallback; image.title = avatar.label; image.src = avatar.src; }
    else { delete image.dataset.avatarFallback; image.removeAttribute('title'); image.src = '/assets/winx-zomboid-profile.webp'; }
  });
  setText('[data-leader-kills]', formatNumber(row?.kills_total));
  setText('[data-leader-time]', formatDuration(row?.survival_seconds));
  $$('[data-leader-profile]').forEach((link) => { link.href = row ? publicDestination(row) : '/ranking'; link.setAttribute('aria-disabled', String(!row)); });
}

function rankingRow(row, showDistance = false, visualPosition = null) {
  const position = visualPosition;
  const observed = memorialDate(row);
  return `<tr><td class="col-position" data-label="Ordem"><span class="rank-no ${row.alive===true&&Number(position) <= 3 ? 'top' : ''}">${safe(position === '—' ? position : String(position).padStart(2, '0'))}</span></td>
    <td class="col-player" data-label="Sobrevivente / jogador"><div class="player-cell"><img class="player-avatar" ${avatarAttributes(row)} alt="" loading="lazy"><span><strong class="player-name">${safe(row.character_name || 'Nome não informado')}</strong><small>Jogador / ${safe(row.steam_username || 'Não informado')}</small></span></div></td>
    <td class="col-kills" data-label="Kills" title="${safe(killBreakdownText(killBreakdown(row)))}"><b>${formatNumber(row.kills_total)}</b></td><td class="col-firearm" data-label="Arma">${formatNumber(row.kills_firearm)}</td><td class="col-melee" data-label="Corpo a corpo">${formatNumber(row.kills_melee)}</td>${row.monthly_contract?`<td class="col-other" data-label="Outros / não discriminados">${formatNumber(rankingResidual(row))}</td>`:""}<td class="col-time" data-label="Tempo jogado">${formatDuration(row.survival_seconds)}</td>${showDistance ? `<td class="col-distance" data-label="Distância">${row.life_identity_verified === true && row.distance_unit === "meters" && hasNumber(row.distance_total_m) ? `${formatNumber(Number(row.distance_total_m)/1000)} km` : "—"}</td>` : ""}<td class="col-state" data-label="Estado">${stateBadge(row.alive)}</td><td class="record-date col-record" data-label="Registro"><small>${observed.label}</small><time>${safe(date(observed.value))}</time></td></tr>`;
}

function renderTable() {
  const body = $('[data-ranking-body]');
  if (!body || !rankingPayload) return;
  const unavailable = filters.filter === 'dead' && rankingPayload.graveyard_state !== 'ready';
  const rows = filterRanking(rankingPayload.ranking || [], rankingPayload.graveyard || [], filters);
  const otherHeading=$('[data-other-heading]');if(otherHeading)otherHeading.hidden=rankingPayload.competition_rules!=='winx-v2';
  setText('[data-ranking-position-heading]',filters.filter==='dead'?'Ordem':'Pos.');
  const hasDistance = rows.some(row=>row.life_identity_verified === true && row.distance_unit === 'meters' && hasNumber(row.distance_total_m));
  const distanceHeading = $('[data-distance-heading]'); if (distanceHeading) distanceHeading.hidden=!hasDistance;
  body.closest('.ranking-board')?.classList.toggle('has-distance',hasDistance);
  body.innerHTML = unavailable ? '<tr><td colspan="8" class="table-empty">O cemitério não pôde ser consultado. A integração SQL v2 pode estar pendente. Nenhuma morte foi inferida.</td></tr>'
    : rows.length ? rows.map((row,index)=>rankingRow(row,hasDistance,index+1)).join('')
      : `<tr><td colspan="8" class="table-empty">${safe(rankingPayload.message || 'Nenhum registro para os critérios selecionados.')}</td></tr>`;
  $$('[data-filter]').forEach((button) => { const active = filters.filter === button.dataset.filter; button.classList.toggle('is-active', active); button.setAttribute('aria-pressed', String(active)); });
  decorateLinks();
}

function renderSeasons(seasons) {
  const container = $('[data-season-history]');
  if (!container) return;
  const closed = seasons.filter((season) => season.status === 'closed');
  const section=$('[data-season-section]');if(section)section.hidden=!closed.length;
  container.innerHTML = closed.length ? closed.map((season) => `<article class="season-card"><small>TEMPORADA ENCERRADA${season.outcome === 'apocalypse' ? ' · SEM CAMPEÃO' : ''}</small><h3>${safe(season.name)}</h3><p class="winner">${safe(seasonResult(season))}</p><p>Encerrada em ${safe(date(season.ended_at, false))}</p></article>`).join('')
    : '';
}

function renderMemorial() {
  const grid = $('[data-memorial-grid]');
  if (!grid || !rankingPayload) return;
  if (rankingPayload.graveyard_state !== 'ready') {
    const honors=$('[data-memorial-categories]');if(honors){honors.hidden=true;honors.innerHTML='';}
    grid.innerHTML = '<p class="error-box">Não foi possível consultar o memorial. A integração SQL v2 pode estar pendente. Tente novamente mais tarde.</p>';
    return;
  }
  const all = (rankingPayload.graveyard || []).filter((row) => row.alive === false);
  const categories = $('[data-memorial-categories]');
  if (categories) {categories.innerHTML=memorialHonors(rankingPayload.memorial_honors);categories.hidden=!categories.innerHTML;}
  const rows = all.filter((row) => `${row.character_name} ${row.steam_username}`.toLocaleLowerCase('pt-BR').includes(memorialSearch.toLocaleLowerCase('pt-BR')));
  grid.innerHTML = rows.length ? rows.map(row=>memorialCard(row,date,isDemo)).join('')
    : '<p class="error-box">Nenhum registro de personagem morto encontrado para esta consulta.</p>';
  decorateLinks();
  mountMedals(grid,rows);
}

function renderSurvivors() {
  const grid = $('[data-survivor-grid]');
  if (!grid || !rankingPayload) return;
  const rows = rankingPayload.ranking || [];
  grid.innerHTML = rows.length ? rows.map((row) => `<article class="survivor-card survivor-summary"><img ${avatarAttributes(row)} alt="" loading="lazy"><div><small>SOBREVIVENTE</small><h3>${safe(row.character_name)}</h3><p>Jogador / ${safe(row.steam_username || "Não informado")}</p><p><b class="survivor-kills">${formatNumber(row.kills_total)}</b> kills · ${formatDuration(row.survival_seconds)}</p></div></article>`).join('') : '<p class="page-intro">Nenhum personagem vivo classificado disponível nesta consulta.</p>';
  mountMedals(grid,rows);
}

let rankingLoading = false;
async function loadRanking() {
  if (!$('[data-ranking-list]') && !$('[data-ranking-body]') && !$('[data-memorial-grid]')) return;
  if (rankingLoading) return;
  rankingLoading = true;
  try {
    const payload = await request('/api/ranking');
    if (!Array.isArray(payload.ranking) || !Array.isArray(payload.seasons)) throw new Error('Resposta de classificação inválida.');
    payload.ranking = livingRanking(payload.ranking);
    rankingPayload = payload;
    updateLeader(payload.ranking[0]);
    if(payload.competition_rules==='winx-v2') {
      setText('.supreme-showcase .fine-print','Liderança observada · certificação oficial pendente');
      $('.supreme-showcase')?.setAttribute('aria-label','Liderança observada da temporada');
      const [a,b]=payload.ranking;
      if(a&&b&&hasNumber(a.kills_total)&&hasNumber(a.survival_seconds)&&Number(a.kills_total)===Number(b.kills_total)&&Number(a.survival_seconds)===Number(b.survival_seconds)){
        updateLeader(null);setText('[data-leader-name]','Empate na liderança');setText('[data-leader-account]','Kills e tempo iguais · sem terceiro desempate');
      }
      setText('[data-cohort-note]','Classificação observada. O resultado oficial depende da identidade das vidas e das evidências da virada mensal.');
      const note=$('[data-cohort-note]');if(note)note.hidden=false;
    }
    const side = $('[data-ranking-list]');
    if (side) side.innerHTML = payload.ranking.slice(1, 5).map((row) => `<li><span class="place">${safe(String(row.rank_position).padStart(2, '0'))}</span><img class="player-avatar" ${avatarAttributes(row)} alt="" loading="lazy"><a class="player-meta" href="${publicDestination(row)}"><strong>${safe(row.character_name)}</strong><small>${safe(row.steam_username)} · ${lifeState(row.alive).label}</small></a><span class="kill-count">${formatNumber(row.kills_total)}<small>KILLS</small></span></li>`).join('') || '<li class="skeleton">Nenhum outro classificado nesta temporada.</li>';
    const season = payload.seasons.find((entry) => entry.status === 'active');
    setText('[data-season-name]', season?.name || 'Nenhuma temporada ativa');
    setText('[data-season-state]', season ? 'Disputa em andamento' : payload.seasons.some(row=>row.status==='closed')?'Temporada encerrada':'Aguardando próxima temporada');
    const deadline=$('[data-season-deadline]');if(deadline){const label=seasonDeadline(season);deadline.hidden=!label;deadline.textContent=label||'';if(label)deadline.dateTime=season.scheduled_end_at;else deadline.removeAttribute('datetime');}
    setText('[data-ranking-sync]', payload.sync?.last_success_at ? `${payload.demo ? 'Leitura fictícia' : 'Última coleta'} / ${date(payload.sync.last_success_at)}` : 'Coleta ainda não sincronizada');
    setText('[data-ranking-refreshed]', `Dados recebidos pela página / ${date(new Date().toISOString())}`);
    updateCollectionCountdown(); updateSeasonCountdown();
    const cohortNote=$('[data-cohort-note]');
    if(cohortNote){cohortNote.hidden=payload.competition_rules!=='winx-v2'&&!payload.cohort_started_at;cohortNote.textContent=payload.competition_rules==='winx-v2'
      ?'Classificação observada, ainda sem certificação oficial. Tempo sazonal e distância só aparecem quando comprovados; o tempo histórico da vida não desempata a temporada. O resultado depende da identidade das vidas e das evidências da virada mensal.'
      :payload.cohort_started_at?`Coorte validada em ${date(payload.cohort_started_at)}. Cada vida conta pontos a partir de sua primeira leitura validada; registros anteriores permanecem preservados.`:'';}
    const warning = $('[data-sync-warning]');
    if (warning) { warning.hidden = !payload.stale; warning.textContent = payload.sync?.latest_attempt_status === "failed" ? `A última tentativa de coleta falhou. Último sucesso: ${date(payload.sync?.last_success_at)}.` : payload.sync?.latest_attempt_status === "running" ? `Coleta em andamento. Exibindo o último sucesso: ${date(payload.sync?.last_success_at)}.` : `A fonte informa dados desatualizados. Última coleta: ${date(payload.sync?.last_success_at)}.`; }
    $$('[data-ranking-sync]').forEach((node) => node.classList.toggle('is-stale', Boolean(payload.stale)));
    renderTable(); renderSurvivors(); renderSeasons(payload.seasons); renderMemorial(); decorateLinks();
  } catch (error) {
    rankingPayload = null;
    if ($('[data-distance-heading]')) $('[data-distance-heading]').hidden=true;
    setText('[data-memorial-count]', ' / indisponível');
    updateLeader(null, true);
    setText('[data-ranking-sync]', 'Consulta indisponível. Não foi possível verificar a última coleta.');
    setText('[data-ranking-refreshed]', 'Atualização dos dados indisponível');
    updateCollectionCountdown(); updateSeasonCountdown();
    if ($('[data-survivor-grid]')) $('[data-survivor-grid]').innerHTML = `<p class="error-box">${safe(error.message)}</p>`;
    if ($('[data-ranking-list]')) $('[data-ranking-list]').innerHTML = `<li class="skeleton">${safe(error.message)}</li>`;
    if ($('[data-ranking-body]')) $('[data-ranking-body]').innerHTML = `<tr><td colspan="8" class="table-empty">${safe(error.message)} Use “Atualizar” para tentar novamente.</td></tr>`;
    if ($('[data-memorial-categories]')) {$('[data-memorial-categories]').innerHTML='';$('[data-memorial-categories]').hidden=true;}
    if ($('[data-memorial-grid]')) $('[data-memorial-grid]').innerHTML = `<p class="error-box">${safe(error.message)}</p>`;
    setText('[data-season-name]', 'Consulta indisponível'); setText('[data-season-state]', 'Tente novamente');
    if ($('[data-season-section]')) $('[data-season-section]').hidden=true;
    if ($('[data-season-deadline]')) $('[data-season-deadline]').hidden=true;
  } finally { rankingLoading = false; }
}

function updateSeasonCountdown(){
 const node=$('[data-season-countdown]');if(!node)return;
 const season=rankingPayload?.seasons?.find(row=>row.status==='active');
 const clock=rankingPayload?.collection_clock;
 const text=seasonCountdown(season,clockNow(clock,performance.now()));
 node.hidden=!text;node.textContent=text||'';
}
function updateCollectionCountdown(){
 const clock=rankingPayload?.collection_clock;
 setText('[data-collection-countdown]',collectionCountdown(rankingPayload?.sync,clockNow(clock,performance.now())));
}
setInterval(()=>{updateCollectionCountdown();updateSeasonCountdown();if(statusPayload)updateStatusState();},1000);
let refreshing = false;
let initialAnchorResolved = false;
async function refreshAll(manual = false) {
  if (refreshing) return;
  refreshing = true;
  try {
    await Promise.all([loadStatus(), loadRanking()]);
    if (!initialAnchorResolved) {
      initialAnchorResolved = true;
      // A primeira resposta pode aumentar a altura do ranking e deslocar a âncora.
      if (['#sobreviventes', '#servidor'].includes(location.hash)) {
        await document.fonts?.ready;
        await new Promise((resolve) => requestAnimationFrame(resolve));
        document.getElementById(location.hash.slice(1))?.scrollIntoView({ block: 'start' });
      }
    }
    if (manual) showToast('Consulta concluída. Confira o estado e a data informados em cada seção.');
  } finally { refreshing = false; }
}

mountFooter();
setupNavigation();
$$('[data-year]').forEach((node) => { node.textContent = new Date().getFullYear(); });
$$('[data-filter]').forEach((button) => { button.onclick = () => { filters.filter = normalizeRankingFilter(button.dataset.filter); renderTable(); }; });
if ($('[data-ranking-search]')) $('[data-ranking-search]').oninput = (event) => { filters.search = event.target.value; renderTable(); };
if ($('[data-memorial-search]')) $('[data-memorial-search]').oninput = (event) => { memorialSearch = event.target.value; renderMemorial(); };
$$('[data-refresh]').forEach((button) => { button.onclick = () => refreshAll(true); });
// Fallback de avatar sem handlers inline; compatível com CSP da prévia.
document.addEventListener('error', (event) => {
  if (!(event.target instanceof HTMLImageElement)) return;
  const image = event.target;
  const fallback = image.dataset.avatarFallback || '/assets/winx-zomboid-profile.webp';
  if (image.getAttribute('src') !== fallback) image.src = fallback;
}, true);
request('/api/config').catch(() => {});
decorateLinks();
refreshAll();
setInterval(() => { if (!document.hidden) refreshAll(); }, 120000);
// Somente a classificação: no máximo duas consultas por minuto em página visível.
// O contador por segundo é local; uma previsão vencida nunca confirma ingestão.
setInterval(() => { if (!document.hidden && !refreshing) loadRanking(); }, 30000);

setInterval(()=>{if(!document.hidden&&!refreshing)loadStatus();},60000);
