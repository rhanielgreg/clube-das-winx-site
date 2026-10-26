import { achievementPanel } from './achievement-panel.js';
import { collectionCountdown } from './collection-countdown.js';
import { formatNumber, formatDuration, hasNumber, lifeState, escapeHtml as safe, filterRanking, UUID } from './contracts.js';
import { profileMetrics, memorialDate, profileReturn } from './presentation.js';
import { characterAvatar } from './avatar.js';
import { livingRanking, seasonResult } from './championship.js';
import { mountFooter } from './footer.js';
import { historyTable } from './history-view.js';
import { memorialCard, memorialHonors } from './memorial-view.js';
import { seasonDeadline } from './season-schedule.js';
import { statusState } from './status-view.js';

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const filters = { filter: 'kills', search: '' };
let rankingPayload = null;
let memorialSearch = '';
let isDemo = false;
let historyContext = {key:null,page:1};
let statusPayload = null;
let statusLoading = false;
const scenario = new URLSearchParams(location.search).get('scenario');
const date = (value, withTime = true) => {
  if (!value || !Number.isFinite(Date.parse(value))) return 'Não informado';
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', ...(withTime ? { timeStyle: 'short' } : {}), timeZone: 'America/Sao_Paulo' }).format(new Date(value));
};
const setText = (selector, value) => $$(selector).forEach((node) => { node.textContent = value; });
const profileLink = (row) => `/jogador?id=${encodeURIComponent(row.profile_id)}&from=${document.body.dataset.page==='home'?'home':document.body.dataset.page==='memorial'?'memorial':'ranking'}`;
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
  const response = await fetch(url, { signal: AbortSignal.timeout(15000) });
  const data = await response.json();
  if(url.pathname==='/api/ranking'&&Number.isFinite(Date.parse(data.server_time||''))){
    const age=Number(response.headers.get('age')||0);
    data.collection_clock={server:Date.parse(data.server_time)+(Number.isFinite(age)&&age>=0?age*1000:0),received:performance.now()};
  }
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
  $$('[data-leader-profile]').forEach((link) => { link.href = row ? profileLink(row) : '/ranking'; link.setAttribute('aria-disabled', String(!row)); });
}

function rankingRow(row, showDistance = false) {
  const position = hasNumber(row.rank_position) ? row.rank_position : '—';
  const observed = memorialDate(row);
  return `<tr><td><span class="rank-no ${Number(position) <= 3 ? 'top' : ''}">${safe(position === '—' ? position : String(position).padStart(2, '0'))}</span></td>
    <td><div class="player-cell"><img class="player-avatar" ${avatarAttributes(row)} alt="" loading="lazy"><span><a href="${profileLink(row)}">${safe(row.character_name || 'Nome não informado')}</a><small>Jogador / ${safe(row.steam_username || 'Não informado')}</small></span></div></td>
    <td><b>${formatNumber(row.kills_total)}</b></td><td>${formatNumber(row.kills_firearm)}</td><td>${formatNumber(row.kills_melee)}</td><td>${formatDuration(row.survival_seconds)}</td>${showDistance ? `<td>${row.life_identity_verified === true && row.distance_unit === "meters" && hasNumber(row.distance_total_m) ? `${formatNumber(Number(row.distance_total_m)/1000)} km` : "—"}</td>` : ""}<td>${stateBadge(row.alive)}</td><td class="record-date"><small>${observed.label}</small><time>${safe(date(observed.value))}</time></td></tr>`;
}

function renderTable() {
  const body = $('[data-ranking-body]');
  if (!body || !rankingPayload) return;
  const unavailable = filters.filter === 'dead' && rankingPayload.graveyard_state !== 'ready';
  const rows = filterRanking(rankingPayload.ranking || [], rankingPayload.graveyard || [], filters);
  const hasDistance = rows.some(row=>row.life_identity_verified === true && row.distance_unit === 'meters' && hasNumber(row.distance_total_m));
  const distanceHeading = $('[data-distance-heading]'); if (distanceHeading) distanceHeading.hidden=!hasDistance;
  body.closest('.ranking-board')?.classList.toggle('has-distance',hasDistance);
  body.innerHTML = unavailable ? '<tr><td colspan="8" class="table-empty">O cemitério não pôde ser consultado. A integração SQL v2 pode estar pendente. Nenhuma morte foi inferida.</td></tr>'
    : rows.length ? rows.map(row=>rankingRow(row,hasDistance)).join('')
      : `<tr><td colspan="8" class="table-empty">${safe(rankingPayload.message || 'Nenhum registro para os critérios selecionados.')}</td></tr>`;
  setText('[data-ranking-count]', unavailable ? ' / indisponível' : ` / ${rows.length} ${rows.length === 1 ? 'registro' : 'registros'}`);
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
}

function renderSurvivors() {
  const grid = $('[data-survivor-grid]');
  if (!grid || !rankingPayload) return;
  const rows = rankingPayload.ranking || [];
  grid.innerHTML = rows.length ? rows.map((row) => `<a class="survivor-card dossier-shortcut" href="${profileLink(row)}"><img ${avatarAttributes(row)} alt="" loading="lazy"><div><small>DOSSIÊ INDIVIDUAL</small><h3>${safe(row.character_name)}</h3><p>Combate · tempo jogado · evolução</p></div><span aria-hidden="true">↗</span></a>`).join('') : '<p class="page-intro">Nenhum personagem vivo classificado disponível nesta consulta.</p>';
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
    const side = $('[data-ranking-list]');
    if (side) side.innerHTML = payload.ranking.slice(1, 5).map((row) => `<li><span class="place">${safe(String(row.rank_position).padStart(2, '0'))}</span><img class="player-avatar" ${avatarAttributes(row)} alt="" loading="lazy"><a class="player-meta" href="${profileLink(row)}"><strong>${safe(row.character_name)}</strong><small>${safe(row.steam_username)} · ${lifeState(row.alive).label}</small></a><span class="kill-count">${formatNumber(row.kills_total)}<small>KILLS</small></span></li>`).join('') || '<li class="skeleton">Nenhum outro classificado nesta temporada.</li>';
    const season = payload.seasons.find((entry) => entry.status === 'active');
    setText('[data-season-name]', season?.name || 'Nenhuma temporada ativa');
    setText('[data-season-state]', season ? 'Disputa em andamento' : 'Aguardando próxima temporada');
    const deadline=$('[data-season-deadline]');if(deadline){const label=seasonDeadline(season);deadline.hidden=!label;deadline.textContent=label||'';if(label)deadline.dateTime=season.scheduled_end_at;else deadline.removeAttribute('datetime');}
    setText('[data-ranking-sync]', payload.sync?.last_success_at ? `${payload.demo ? 'Leitura fictícia' : 'Última coleta'} / ${date(payload.sync.last_success_at)}` : 'Coleta ainda não sincronizada');
    setText('[data-ranking-refreshed]', `Dados recebidos pela página / ${date(new Date().toISOString())}`);
    updateCollectionCountdown();
    const cohortNote=$('[data-cohort-note]');
    if(cohortNote){cohortNote.hidden=!payload.cohort_started_at;cohortNote.textContent=payload.cohort_started_at?`Coorte validada em ${date(payload.cohort_started_at)}. Cada vida conta pontos a partir de sua primeira leitura validada; registros anteriores permanecem preservados.`:'';}
    const warning = $('[data-sync-warning]');
    if (warning) { warning.hidden = !payload.stale; warning.textContent = payload.sync?.latest_attempt_status === "failed" ? `A última tentativa de coleta falhou. Último sucesso: ${date(payload.sync?.last_success_at)}.` : payload.sync?.latest_attempt_status === "running" ? `Coleta em andamento. Exibindo o último sucesso: ${date(payload.sync?.last_success_at)}.` : `A fonte informa dados desatualizados. Última coleta: ${date(payload.sync?.last_success_at)}.`; }
    $$('[data-ranking-sync]').forEach((node) => node.classList.toggle('is-stale', Boolean(payload.stale)));
    renderTable(); renderSurvivors(); renderSeasons(payload.seasons); renderMemorial(); decorateLinks();
  } catch (error) {
    rankingPayload = null;
    setText('[data-ranking-count]', ' / indisponível');
    if ($('[data-distance-heading]')) $('[data-distance-heading]').hidden=true;
    setText('[data-memorial-count]', ' / indisponível');
    updateLeader(null, true);
    setText('[data-ranking-sync]', 'Consulta indisponível. Não foi possível verificar a última coleta.');
    setText('[data-ranking-refreshed]', 'Atualização dos dados indisponível');
    updateCollectionCountdown();
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

function renderPlayer(payload) {
  const { profile, history = [] } = payload;
  const lifeHistory = payload.achievements?.identity_verified === true && payload.achievements.life_history?.length ? payload.achievements.life_history : null;
  const root = $('[data-player-root]');
  const detailsOpen = $('[data-history-details]', root)?.open === true;
  const achievementsOpen = $('[data-achievement-details]', root)?.open === true;
  const achievementCategory = $('[data-achievement-filter]', root)?.value || 'all';
  const achievementFilterFocused = document.activeElement?.matches('[data-achievement-filter]');
  const refreshFocused = document.activeElement?.matches('[data-player-refresh]');
  const contextKey=`${profile.profile_id}:${lifeHistory?'life':profile.season_id||'none'}`;
  if(historyContext.key!==contextKey)historyContext={key:contextKey,page:1};
  const historyFocus=document.activeElement?.dataset?.historyDirection;
  const back=profileReturn(profile,new URLSearchParams(location.search).get('from'));
  const related=(payload.achievements?.related_lives||[]).filter(row=>UUID.test(row.profile_id||''));
  const state = lifeState(profile.alive);
  const badge = hasNumber(profile.kills_total) && profile.kills_total >= 1000 ? 'Mil eliminações na temporada' : hasNumber(profile.kills_total) && profile.kills_total >= 100 ? 'Mais de cem eliminações na temporada' : null;
  const lifeMetrics = payload.achievements?.identity_verified === true ? payload.achievements.life_metrics : null;
  const values = {};
  if (lifeMetrics) for (const [key, record] of Object.entries(lifeMetrics)) {
    if (record && hasNumber(record.value) && Number(record.value)>=0) values[key]=Number(record.value);
  }
  const metrics = lifeMetrics ? profileMetrics({...values,survival_seconds:values.played_seconds},Object.keys(values)) : profileMetrics(profile, profile.validated_metrics || payload.validated_metrics);
  if (lifeMetrics) metrics.combat = metrics.combat.map(row=>row.key==='kills_total'?{...row,label:'Kills na vida'}:row);

  const metric = ({ label, value, unit = '' }) => `<div class="dossier-metric"><strong>${formatNumber(value)}${unit ? ` ${safe(unit)}` : ''}</strong><small>${safe(label)}</small></div>`;
  const dateProfile = lifeMetrics ? {...profile,last_updated_at:payload.achievements.last_observed_at} : profile;
  const dates = [['last_updated_at', 'Última leitura'], ['died_at', 'Morte registrada'], ['first_seen_at', 'Primeira observação']]
    .filter(([key]) => dateProfile[key] && Number.isFinite(Date.parse(dateProfile[key])))
    .map(([key, label]) => `<div><dt>${label}</dt><dd>${safe(date(dateProfile[key]))}</dd></div>`).join('');
  root.innerHTML = `<a class="back-link" href="${back.href}">← ${back.label}</a>
    <section class="profile-header"><div class="profile-avatar"><img ${avatarAttributes(profile)} alt=""></div><div><p class="eyebrow">DOSSIÊ DO SOBREVIVENTE / ${safe(profile.season_name || 'TEMPORADA NÃO INFORMADA')}</p><h1>${safe(profile.character_name || "Nome não informado")}</h1><p>Jogador: <b>${safe(profile.steam_username || 'Não informado')}</b></p>${profile.rank_position ? `<span class="profile-position">POSIÇÃO NESTA TEMPORADA / #${safe(profile.rank_position)}</span>` : '<span class="profile-position">SEM POSIÇÃO NESTA TEMPORADA</span>'}</div><button class="refresh-button" data-player-refresh>↻ Atualizar registro</button></section>
    <div class="profile-badges">${stateBadge(profile.alive)}${badge ? `<span class="profile-badge">✦ ${badge}</span>` : ''}${payload.demo ? '<span class="profile-badge">Demonstração · personagem fictício</span>' : ''}</div>
    ${Array.isArray(payload.titles) && payload.titles.length ? `<section class="official-titles" aria-label="Títulos preservados"><h2>TÍTULOS PRESERVADOS</h2>${payload.titles.map(title => `<p><b>${safe(title.season_name)}</b> · ${safe(title.rules_version === 'winx-v1' ? 'Campeão oficial' : 'Campeão registrado nas regras anteriores')} · ${formatNumber(title.final_kills_total)} kills · ${safe(date(title.ended_at, false))}</p>`).join('')}<small>Conquistas de temporadas encerradas não dependem do estado de vida atual.</small></section>` : ''}
    ${payload.demo && payload.future_metrics_demo ? '<p class="sync-warning">SIMULAÇÃO DE MÉTRICAS FUTURAS · Valores inteiramente fictícios para revisar a apresentação. Não extraídos do servidor.</p>' : ''}
    ${lifeMetrics ? `<p class="dossier-note">Pontuação na temporada exibida: <b>${formatNumber(profile.kills_total)} kills</b>. Os contadores abaixo foram observados nesta vida. A cobertura desde o nascimento não foi comprovada.</p>` : ''}
    ${lifeMetrics && payload.achievements.season_history?.length ? `<details class="history-panel"><summary class="text-link">Participação e marcas em temporadas encerradas</summary><p class="dossier-note">Melhor pontuação oficial desta vida: ${formatNumber(payload.achievements.season_records?.best_season_kills_total)} kills. Arquivo congelado no encerramento.</p><div class="table-scroll"><table class="ranking-table"><thead><tr><th>Temporada</th><th>Posição final</th><th>Kills válidas</th><th>Estado ao encerrar</th></tr></thead><tbody>${payload.achievements.season_history.map(row=>`<tr><td>${safe(row.season_name)}</td><td>${row.rank_position ? '#'+formatNumber(row.rank_position) : 'Sem classificação'}</td><td>${formatNumber(row.kills_total)}</td><td>${row.alive_at_close ? 'Vivo' : 'Morto'}${row.outcome==='apocalypse' ? ' · O Apocalipse Venceu' : ''}</td></tr>`).join('')}</tbody></table></div></details>` : ''}
    <div data-achievements-root>${achievementPanel(payload.achievements,achievementCategory)}</div>
    ${payload.demo && payload.achievements_engine_demo ? '<p class="sync-warning">MOTOR POSTGRESQL LOCAL · Vida e dados fictícios. Desbloqueios calculados pelo SQL, sem conexão com produção.</p>' : ''}
    <div class="dossier-grid">
      ${metrics.combat.length ? `<section class="dossier-group" aria-label="Combate"><h2>COMBATE ${lifeMetrics ? "DA VIDA" : "DA TEMPORADA"}</h2><div class="dossier-metrics">${metrics.combat.map(metric).join('')}</div>${metrics.combat.some(item=>item.label==="Veículos")?'<p class="dossier-note">Veículos já incluídos no total.</p>':''}</section>` : '<p class="error-box">Estatísticas de combate indisponíveis nesta consulta.</p>'}
      <section class="dossier-group" aria-label="Sobrevivência"><h2>SOBREVIVÊNCIA</h2><div class="dossier-metrics"><div class="dossier-metric"><strong class="metric-state ${state.className}">${state.label}</strong><small>Estado do personagem</small></div>${metrics.recordedSeconds !== null ? `<div class="dossier-metric"><strong>${formatDuration(metrics.recordedSeconds)}</strong><small>TEMPO JOGADO</small></div>` : ''}${metrics.worldDays !== null ? metric({ label: 'Dias sobrevividos no mundo', value: metrics.worldDays }) : ''}</div>${dates ? `<dl class="dossier-dates">${dates}</dl>` : ''}</section>
    </div>
    ${metrics.exploration.length ? `<section class="dossier-group exploration-group" aria-label="Exploração"><h2>EXPLORAÇÃO</h2><div class="dossier-metrics">${metrics.exploration.map(metric).join('')}</div></section>` : ''}
    <div class="profile-layout ${related.length?'':'is-single'}"><section class="history-panel"><p class="eyebrow">${lifeHistory ? "HISTÓRICO / COLETAS DESTA VIDA" : "HISTÓRICO / COLETAS DA TEMPORADA"}</p><h2>Evolução registrada</h2><p class="page-intro">Até 90 coletas recentes. Mais novas primeiro na tabela.</p><div data-history-root></div></section>
      ${related.length ? `<aside class="profile-record"><h3>Histórico do personagem</h3><details><summary class="text-link">Outras vidas confirmadas</summary>${related.map(row=>`<p><a class="text-link" href="${profileLink(row)}">${safe(row.character_name)} · ${safe(lifeState(row.alive).label)}</a></p>`).join('')}</details><a class="text-link" href="${back.href}">${back.label} ↗</a></aside>`:''}</div>`;
  const achievementRoot = $('[data-achievements-root]', root);
  const setupAchievementFilter = () => {
    const select = $('[data-achievement-filter]', achievementRoot);
    if (select) select.onchange = () => { achievementRoot.innerHTML = achievementPanel(payload.achievements,select.value); $('[data-achievement-details]',achievementRoot).open=true; setupAchievementFilter(); $('[data-achievement-filter]',achievementRoot)?.focus(); };
  };
  if (achievementsOpen && $('[data-achievement-details]',achievementRoot)) $('[data-achievement-details]',achievementRoot).open=true;
  setupAchievementFilter();
  if (achievementFilterFocused) $('[data-achievement-filter]',achievementRoot)?.focus();
  const historyRoot = $('[data-history-root]');
  const samples=(lifeHistory||history).filter(point=>(!point.profile_id||point.profile_id===profile.profile_id)&&(!point.character_id||point.character_id===profile.profile_id)&&(lifeHistory||!point.season_id||point.season_id===profile.season_id)&&Number.isFinite(Date.parse(point.observed_at))).sort((a,b)=>Date.parse(a.observed_at)-Date.parse(b.observed_at)).slice(-90);
  const points=samples.filter(point=>hasNumber(point.kills_total));
  if (!lifeHistory && payload.history_state !== 'ready') historyRoot.innerHTML = '<p class="error-box">Histórico indisponível nesta consulta.</p>';
  else if (!samples.length) historyRoot.innerHTML = '<p class="page-intro">Nenhuma coleta disponível neste registro.</p>';
  else {
    const max=Math.max(...points.map(point=>Number(point.kills_total)),1);
    const graph=points.length?`<div class="chart" role="img" aria-label="${points.length} coletas com kills: de ${formatNumber(points[0].kills_total)} a ${formatNumber(points.at(-1).kills_total)}. Consulte a tabela abaixo.">${points.map(point=>`<i class="chart-bar" aria-hidden="true" style="height:${Math.max(2,Number(point.kills_total)/max*100)}%" title="${safe(date(point.observed_at))}: ${formatNumber(point.kills_total)} kills"></i>`).join('')}</div><div class="chart-axis"><span>${safe(date(points[0].observed_at))}</span><span>${safe(date(points.at(-1).observed_at))}</span></div>`:'<p class="page-intro">Kills indisponíveis nas coletas consultadas.</p>';
    historyRoot.innerHTML=`${graph}<div class="history-summary"><span><b>${samples.length}</b> coletas disponíveis</span><span>Última amostra: <b>${formatNumber(samples.at(-1).kills_total)}</b> kills</span></div><details data-history-details><summary class="text-link">Consultar valores das coletas</summary><div data-history-table></div></details>`;
    const tableRoot=$('[data-history-table]',historyRoot);
    const renderHistoryPage=(focusDirection)=>{
      const page=historyTable(samples,historyContext.page,date);historyContext.page=page.page;tableRoot.innerHTML=page.html;
      $$('[data-history-page]',tableRoot).forEach(button=>{button.onclick=()=>{historyContext.page=Number(button.dataset.historyPage);renderHistoryPage(button.dataset.historyDirection);};});
      if(focusDirection){const target=$(`[data-history-direction="${focusDirection}"]`,tableRoot);(target&&!target.disabled?target:$('[data-history-page]:not(:disabled)',tableRoot))?.focus();}
    };
    renderHistoryPage(historyFocus);
  }
  $('[data-player-refresh]').onclick = () => refreshAll(true);
  if (detailsOpen && $('[data-history-details]', root)) $('[data-history-details]', root).open = true;
  if (refreshFocused) $('[data-player-refresh]').focus();
  decorateLinks();
}

async function loadPlayer() {
  const root = $('[data-player-root]');
  if (!root) return;
  const id = new URLSearchParams(location.search).get('id');
  try {
    if (!id || !UUID.test(id)) throw new Error('Informe um perfil válido pelo ranking ou memorial.');
    renderPlayer(await request(`/api/player?id=${encodeURIComponent(id)}`));
  } catch (error) {
    root.innerHTML = `<section class="profile-error"><p class="eyebrow">CONSULTA INDISPONÍVEL</p><h1>Não foi possível abrir o registro.</h1><p>${safe(error.message)}</p><button class="button button-ghost" data-player-refresh>Tentar novamente</button> <a class="button button-pink" href="/ranking">Voltar ao ranking</a></section>`;
    $('[data-player-refresh]').onclick = () => refreshAll(true);
    decorateLinks();
  }
}

function updateCollectionCountdown(){
 const clock=rankingPayload?.collection_clock;
 setText('[data-collection-countdown]',collectionCountdown(rankingPayload?.sync,clock?clock.server+performance.now()-clock.received:NaN));
}
setInterval(()=>{updateCollectionCountdown();if(statusPayload)updateStatusState();},1000);
let refreshing = false;
let initialAnchorResolved = false;
async function refreshAll(manual = false) {
  if (refreshing) return;
  refreshing = true;
  try {
    await Promise.all([loadStatus(), loadRanking(), loadPlayer()]);
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
$$('[data-filter]').forEach((button) => { button.onclick = () => { filters.filter = button.dataset.filter; renderTable(); }; });
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
