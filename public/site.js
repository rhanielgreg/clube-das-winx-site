const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const hasNumber = (value) => value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value));
const formatNumber = (value) => hasNumber(value) ? new Intl.NumberFormat('pt-BR').format(Number(value)) : '—';

function formatDuration(seconds) {
  const value = Number(seconds);
  if (!hasNumber(seconds)) return '—';
  const days = Math.floor(value / 86400);
  const hours = Math.floor((value % 86400) / 3600);
  if (days) return `${days}d ${hours}h`;
  const minutes = Math.floor((value % 3600) / 60);
  return `${hours}h ${minutes}m`;
}

function formatDate(value, withTime = false) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return 'não registrada';
  return new Intl.DateTimeFormat('pt-BR', withTime
    ? { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Sao_Paulo' }
    : { dateStyle: 'medium', timeZone: 'America/Sao_Paulo' }).format(date);
}

function safe(value) {
  const node = document.createElement('span');
  node.textContent = String(value ?? '');
  return node.innerHTML;
}

function animateNumber(element, target) {
  if (!element || !hasNumber(target)) return;
  const end = Number(target);
  const started = performance.now();
  const duration = Math.min(1400, 650 + Math.log10(Math.max(10, end)) * 200);
  const frame = (now) => {
    const progress = Math.min(1, (now - started) / duration);
    const eased = 1 - Math.pow(1 - progress, 4);
    element.textContent = formatNumber(Math.round(end * eased));
    if (progress < 1) requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}

function setupNavigation() {
  const header = $('[data-header]');
  const menu = $('[data-menu]');
  const open = $('[data-menu-open]');
  const close = $('[data-menu-close]');
  if (header) addEventListener('scroll', () => header.classList.toggle('is-scrolled', scrollY > 18), { passive: true });
  if (!menu || !open || !close) return;
  let previousFocus = null;
  const focusable = () => $$('a,button:not([disabled])', menu);
  const toggle = (visible) => {
    menu.classList.toggle('is-open', visible);
    menu.setAttribute('aria-hidden', String(!visible));
    open.setAttribute('aria-expanded', String(visible));
    document.body.classList.toggle('menu-open', visible);
    if (visible) {
      previousFocus = document.activeElement;
      setTimeout(() => close.focus(), 60);
    } else previousFocus?.focus?.();
  };
  open.addEventListener('click', () => toggle(true));
  close.addEventListener('click', () => toggle(false));
  $$('a', menu).forEach((link) => link.addEventListener('click', () => toggle(false)));
  addEventListener('keydown', (event) => {
    if (!menu.classList.contains('is-open')) return;
    if (event.key === 'Escape') toggle(false);
    if (event.key !== 'Tab') return;
    const items = focusable();
    const first = items[0];
    const last = items.at(-1);
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  });
}

function setupMotion() {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) entry.target.classList.add('is-visible');
    });
  }, { threshold: .14 });
  $$('[data-reveal]').forEach((element) => observer.observe(element));

  $$('[data-parallax-stage]').forEach((stage) => {
    const targets = $$('[data-parallax]', stage);
    stage.addEventListener('pointermove', (event) => {
      const rect = stage.getBoundingClientRect();
      const x = event.clientX - rect.left - rect.width / 2;
      const y = event.clientY - rect.top - rect.height / 2;
      targets.forEach((target) => {
        const amount = Number(target.dataset.parallax || .02);
        target.style.translate = `${x * amount}px ${y * amount}px`;
      });
    });
    stage.addEventListener('pointerleave', () => targets.forEach((target) => { target.style.translate = '0 0'; }));
  });

  $$('[data-tilt]').forEach((element) => {
    element.addEventListener('pointermove', (event) => {
      const rect = element.getBoundingClientRect();
      const rx = ((event.clientY - rect.top) / rect.height - .5) * -5;
      const ry = ((event.clientX - rect.left) / rect.width - .5) * 7;
      element.style.transform = `perspective(900px) rotateX(${rx}deg) rotateY(${ry}deg)`;
    });
    element.addEventListener('pointerleave', () => { element.style.transform = ''; });
  });
}

function showToast(message) {
  const toast = $('[data-toast]');
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add('is-visible');
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove('is-visible'), 2200);
}

function setupCopies() {
  $$('[data-copy]').forEach((button) => button.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(button.dataset.copy);
      showToast('Endereço copiado. Boa sorte lá fora.');
    } catch {
      showToast(`Copie: ${button.dataset.copy}`);
    }
  }));
}

async function loadServerStatus() {
  try {
    const response = await fetch('/api/status');
    if (!response.ok) throw new Error('Status indisponível');
    const data = await response.json();
    $$('[data-server-state]').forEach((element) => {
      element.textContent = data.online ? 'ONLINE' : 'OFFLINE';
      element.classList.toggle('alive', data.online);
      element.classList.toggle('dead', !data.online);
    });
    $$('[data-server-players]').forEach((element) => { element.textContent = `${data.players} / ${data.maxPlayers}`; });
    $$('[data-server-latency]').forEach((element) => { element.textContent = data.latencyMs ? `${data.latencyMs} ms` : '—'; });
    $$('[data-status-orb]').forEach((element) => element.classList.add(data.online ? 'is-online' : 'is-offline'));

    // Exibir quem está online agora
    const onlineBox = $('[data-online-players-box]');
    const onlineList = $('[data-online-players-list]');
    if (onlineBox && onlineList) {
      if (Array.isArray(data.playerList) && data.playerList.length) {
        onlineBox.style.display = 'block';
        onlineList.innerHTML = data.playerList.map((p) => {
          const avatar = p.avatar_url || '/assets/winx-zomboid-profile.webp';
          const cleanName = p.name ? p.name.trim().replace(/\s+/g, '') : '';
          const steamLink = cleanName ? `https://steamcommunity.com/id/${encodeURIComponent(cleanName)}` : '#';
          return `
            <a href="${safe(steamLink)}" target="_blank" rel="noopener noreferrer" style="display:inline-flex;align-items:center;gap:7px;padding:6px 10px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);border-radius:4px;text-decoration:none;font-size:10px" title="Conectado há ${formatDuration(p.durationSec)}">
              <img src="${safe(avatar)}" alt="" onerror="this.src='/assets/winx-zomboid-profile.webp'" style="width:20px;height:20px;border-radius:50%;object-fit:cover;border:1px solid var(--pink)">
              <b>${safe(p.name)}</b>
              <span style="width:6px;height:6px;border-radius:50%;background:var(--green);box-shadow:0 0 6px var(--green)"></span>
            </a>
          `;
        }).join('');
      } else {
        onlineBox.style.display = 'none';
      }
    }
  } catch {
    $$('[data-server-state]').forEach((element) => { element.textContent = 'INDISPONÍVEL'; });
    $$('[data-status-orb]').forEach((element) => element.classList.add('is-offline'));
  }
}

function updateLeader(leader, root = document) {
  if (!leader) return;
  const name = $('[data-leader-name]', root);
  const kills = $('[data-leader-kills]', root);
  const time = $('[data-leader-time]', root);
  if (name) name.textContent = leader.steam_username || leader.character_name;
  if (kills) animateNumber(kills, leader.kills_total);
  if (time) time.textContent = formatDuration(leader.survival_seconds);
  const link = $('[data-leader-profile]', root);
  if (link) link.href = `/jogador?id=${encodeURIComponent(leader.profile_id)}`;

  // Atualizar foto de perfil do Líder
  const leaderImg = $('.leader-portrait img', root);
  if (leaderImg) {
    leaderImg.src = leader.avatar_url || '/assets/winx-zomboid-profile.webp';
    leaderImg.onerror = () => { leaderImg.src = '/assets/winx-zomboid-profile.webp'; };
  }
}

function renderSideRanking(payload) {
  const list = $('[data-ranking-list]');
  const sync = $('[data-ranking-sync]');
  if (!list || !sync) return;
  const ranking = payload.ranking || [];
  if (ranking.length) {
    updateLeader(ranking[0]);
    list.innerHTML = ranking.slice(1, 5).map((player, index) => {
      const displayName = player.steam_username || player.character_name;
      const subText = player.steam_username && player.character_name !== player.steam_username
        ? `${player.character_name} · ${player.alive === false ? 'MORTO' : 'VIVO'}`
        : (player.alive === false ? 'PERSONAGEM MORTO' : 'SOBREVIVENDO');
      const avatarSrc = player.avatar_url || '/assets/winx-zomboid-profile.webp';
      return `
      <li>
        <span class="place"><b>${index + 2}</b></span>
        <span class="player-meta"><strong style="display:flex;align-items:center;gap:6px"><img src="${safe(avatarSrc)}" alt="" onerror="this.src='/assets/winx-zomboid-profile.webp'" style="width:16px;height:16px;border-radius:2px;object-fit:cover">${safe(displayName)}</strong><small>${safe(subText)}</small></span>
        <span class="kill-count"><b>${formatNumber(player.kills_total)}</b><small>KILLS</small></span>
      </li>`;
    }).join('') || '<li class="ranking-message">Ainda não há outros classificados nesta temporada.</li>';
  } else {
    list.innerHTML = `<li class="ranking-message">${safe(payload.message || 'Nenhuma estatística validada disponível.')}</li>`;
  }
  if (payload.sync?.last_success_at) {
    sync.innerHTML = `<span class="sync-dot"></span>ATUALIZADO EM ${safe(formatDate(payload.sync.last_success_at, true))}`;
  } else {
    sync.innerHTML = '<span class="sync-dot"></span>COLETA AINDA NÃO SINCRONIZADA';
  }
  sync.classList.toggle('is-stale', Boolean(payload.stale));
}

async function getRanking() {
  const response = await fetch('/api/ranking');
  if (!response.ok) throw new Error('ranking unavailable');
  return response.json();
}

async function loadSideRanking() {
  if (!$('[data-ranking-list]')) return;
  try { renderSideRanking(await getRanking()); }
  catch { renderSideRanking({ ranking: [], message: 'Não foi possível consultar o ranking agora.' }); }
}

function rankingRow(player, index) {
  const displayName = player.steam_username || player.character_name;
  const subText = player.steam_username && player.character_name !== player.steam_username
    ? `${player.character_name} · ${player.alive === false ? 'MORTO' : 'VIVO'}`
    : (player.alive === false ? 'PERSONAGEM MORTO' : 'SOBREVIVENDO');

  const avatarSrc = player.avatar_url || '/assets/winx-zomboid-profile.webp';
  const rankNumber = player.rank_position || (typeof index === 'number' ? index + 1 : '—');
  const dateStr = player.died_at ? `Morte: ${formatDate(player.died_at, true)}` : formatDate(player.last_updated_at, true);

  return `<tr>
    <td><span class="rank-no ${Number(rankNumber) <= 3 ? 'top' : ''}">${String(rankNumber).padStart(2, '0')}</span></td>
    <td><div class="player-cell"><img class="player-avatar" src="${safe(avatarSrc)}" alt="" onerror="this.src='/assets/winx-zomboid-profile.webp'"><span><a href="/jogador?id=${encodeURIComponent(player.profile_id)}">${safe(displayName)}</a><small>${safe(subText)}</small></span></div></td>
    <td>${formatNumber(player.kills_total)}</td>
    <td>${formatNumber(player.kills_firearm)}</td>
    <td>${formatNumber(player.kills_melee)}</td>
    <td>${formatDuration(player.survival_seconds)}</td>
    <td class="${player.alive === false ? 'dead' : 'alive'}">${player.alive === false ? 'MORTO' : 'VIVO'}</td>
    <td>${safe(dateStr)}</td>
  </tr>`;
}

function renderFullRanking(payload) {
  const body = $('[data-ranking-body]');
  if (!body) return;
  const ranking = payload.ranking || [];
  body.innerHTML = ranking.length
    ? ranking.map(rankingRow).join('')
    : `<tr class="table-empty"><td colspan="8">${safe(payload.message || 'Nenhuma estatística validada disponível.')}<br>O site não cria números fictícios enquanto o extrator não confirmar os dados.</td></tr>`;
  updateLeader(ranking[0]);
  $('[data-season-name]').textContent = ranking[0]?.season_name || 'Temporada aguardando início';
  $('[data-season-state]').textContent = payload.state === 'ready' ? 'DISPUTA EM ANDAMENTO' : 'RANKING EM PREPARAÇÃO';
  const warning = $('[data-sync-warning]');
  if (warning && payload.stale) {
    warning.textContent = `A última sincronização foi em ${formatDate(payload.sync?.last_success_at, true)}. Os dados podem estar desatualizados.`;
    warning.classList.add('is-visible');
  }
  $$('[data-needs-kills]').forEach((button) => { button.disabled = !ranking.some((item) => hasNumber(item.kills_total)); });
  $$('[data-needs-time]').forEach((button) => { button.disabled = !ranking.some((item) => hasNumber(item.survival_seconds)); });
  renderSeasons(payload.seasons || []);
  setupRankingFilters(ranking, payload.graveyard || [], body);
}

function setupRankingFilters(ranking, graveyard, body) {
  let currentFilter = 'kills';
  let searchTerm = '';

  const searchInput = $('[data-ranking-search]');
  if (searchInput) {
    searchInput.oninput = (e) => {
      searchTerm = (e.target.value || '').trim().toLowerCase();
      applyFilters();
    };
  }

  function applyFilters() {
    let result = currentFilter === 'dead' ? [...graveyard] : [...ranking];

    if (searchTerm) {
      result = result.filter((p) => {
        const steam = (p.steam_username || '').toLowerCase();
        const char = (p.character_name || '').toLowerCase();
        return steam.includes(searchTerm) || char.includes(searchTerm);
      });
    }

    if (currentFilter === 'time') {
      result.sort((a, b) => (b.survival_seconds ?? -1) - (a.survival_seconds ?? -1));
    } else if (currentFilter === 'alive') {
      result = result.filter((item) => item.alive !== false);
    } else if (currentFilter === 'dead') {
      result.sort((a, b) => new Date(b.died_at || 0) - new Date(a.died_at || 0));
    } else {
      result.sort((a, b) => (b.kills_total ?? -1) - (a.kills_total ?? -1));
    }

    body.innerHTML = result.length
      ? result.map(rankingRow).join('')
      : '<tr class="table-empty"><td colspan="8">Nenhum jogador encontrado para os critérios selecionados.</td></tr>';
  }

  $$('[data-filter]').forEach((button) => {
    button.onclick = () => {
      if (button.disabled) return;
      $$('[data-filter]').forEach((item) => item.classList.toggle('is-active', item === button));
      currentFilter = button.dataset.filter;
      applyFilters();
    };
  });
}

function renderSeasons(seasons) {
  const container = $('[data-season-history]');
  if (!container) return;
  container.innerHTML = seasons.length ? seasons.map((season) => `
    <article class="season-card">
      <small>${safe(season.status === 'closed' ? 'TEMPORADA ENCERRADA' : 'TEMPORADA ATUAL')}</small>
      <h3>${safe(season.name)}</h3>
      <p>${season.winner_name ? `Campeão: <b>${safe(season.winner_name)}</b>` : 'Campeão ainda não definido.'}</p>
      <p>${season.ended_at ? `Encerrada em ${safe(formatDate(season.ended_at))}` : 'Em andamento.'}</p>
    </article>`).join('') : '<article class="season-card"><small>ARQUIVO</small><h3>Nenhuma temporada encerrada</h3><p>Os futuros campeões aparecerão aqui sem apagar as temporadas anteriores.</p></article>';
}

async function loadFullRanking() {
  if (!$('[data-ranking-body]')) return;
  try { renderFullRanking(await getRanking()); }
  catch { renderFullRanking({ ranking: [], seasons: [], message: 'O ranking está temporariamente indisponível.' }); }
}

async function loadPlayer() {
  const root = $('[data-player-root]');
  if (!root) return;
  const id = new URLSearchParams(location.search).get('id');
  if (!id) return showProfileError(root, 'Perfil não informado.');
  try {
    const response = await fetch(`/api/player?id=${encodeURIComponent(id)}`);
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || 'Perfil indisponível.');
    renderPlayer(root, payload);
  } catch (error) { showProfileError(root, error.message); }
}

function showProfileError(root, message) {
  root.innerHTML = `<div class="profile-error"><h1>Sobrevivente não encontrado</h1><p>${safe(message)}</p><a href="/ranking">Voltar ao ranking</a></div>`;
}

function computeBadges(profile) {
  const badges = [];
  const kills = Number(profile.kills_total || 0);
  const firearms = Number(profile.kills_firearm || 0);
  const melee = Number(profile.kills_melee || 0);
  const time = Number(profile.survival_seconds || 0);

  if (profile.alive) {
    badges.push({ icon: '🛡️', title: 'Sobrevivendo', desc: 'Atualmente vivo no servidor' });
  } else {
    badges.push({ icon: '💀', title: 'Caído em Batalha', desc: 'Personagem sucumbiu aos zumbis' });
  }

  if (kills >= 50) {
    badges.push({ icon: '🔥', title: 'Veterano do Apocalipse', desc: 'Mais de 50 zumbis eliminados' });
  } else if (kills >= 10) {
    badges.push({ icon: '⚔️', title: 'Exterminador', desc: 'Mais de 10 zumbis eliminados' });
  }

  if (firearms > 0 && firearms >= melee) {
    badges.push({ icon: '🎯', title: 'Atirador de Elite', desc: 'Especialista em armas de fogo' });
  } else if (melee > 0) {
    badges.push({ icon: '🪓', title: 'Açougueiro Brutal', desc: 'Predomínio em combate corpo a corpo' });
  }

  if (time >= 7200) {
    badges.push({ icon: '⏳', title: 'Lenda Viva', desc: 'Mais de 2 horas de sobrevivência confirmada' });
  } else if (time >= 1800) {
    badges.push({ icon: '🏕️', title: 'Resiliente', desc: 'Mais de 30 minutos em Knox Country' });
  }

  return badges;
}

function renderPlayer(root, { profile, history }) {
  const displayName = profile.steam_username || profile.character_name;
  const subCharacter = profile.steam_username && profile.character_name !== profile.steam_username
    ? `Personagem: ${profile.character_name} · `
    : '';

  const avatarSrc = profile.avatar_url || '/assets/winx-zomboid-profile.webp';
  const cleanSteam = profile.steam_username ? profile.steam_username.trim().replace(/\s+/g, '') : '';
  const steamProfileUrl = cleanSteam ? `https://steamcommunity.com/id/${encodeURIComponent(cleanSteam)}` : null;

  const badges = computeBadges(profile);
  const badgesHtml = badges.map((b) => `
    <div style="display:inline-flex;align-items:center;gap:6px;padding:6px 12px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.1);border-radius:4px;font-size:9px" title="${safe(b.desc)}">
      <span style="font-size:14px">${b.icon}</span>
      <b>${safe(b.title)}</b>
    </div>
  `).join('');

  const steamLinkHtml = steamProfileUrl
    ? `<a href="${safe(steamProfileUrl)}" target="_blank" rel="noopener noreferrer" style="display:inline-flex;align-items:center;gap:5px;margin-top:8px;font-size:9px;color:var(--pink-soft);text-decoration:none;border-bottom:1px dashed var(--pink-soft)">🔗 ABRIR PERFIL NA STEAM ↗</a>`
    : '';

  root.innerHTML = `
    <a class="back-link" href="/ranking">← VOLTAR AO RANKING</a>
    <section class="profile-header reveal-up">
      <div class="profile-avatar"><img src="${safe(avatarSrc)}" alt="" onerror="this.src='/assets/winx-zomboid-profile.webp'" style="width:100%;height:100%;object-fit:cover"></div>
      <div>
        <small>REGISTRO DE SOBREVIVENTE (STEAM)</small>
        <h1>${safe(displayName)}</h1>
        <p>${safe(subCharacter)}Temporada: ${safe(profile.season_name || 'não informada')} · última leitura ${safe(formatDate(profile.last_updated_at, true))}</p>
        ${steamLinkHtml}
      </div>
    </section>
    <section style="margin-top:14px;display:flex;gap:8px;flex-wrap:wrap">
      ${badgesHtml}
    </section>
    <section class="profile-stats">
      <div class="profile-stat"><small>KILLS TOTAIS</small><strong>${formatNumber(profile.kills_total)}</strong></div>
      <div class="profile-stat"><small>TEMPO VIVO</small><strong>${formatDuration(profile.survival_seconds)}</strong></div>
      <div class="profile-stat"><small>POSIÇÃO</small><strong>${profile.rank_position ? `#${profile.rank_position}` : '—'}</strong></div>
      <div class="profile-stat"><small>ESTADO</small><strong class="${profile.alive === false ? 'dead' : 'alive'}">${profile.alive === false ? 'MORTO' : 'VIVO'}</strong></div>
    </section>
    <section class="history-panel"><h2>Evolução registrada</h2><p class="page-intro">Cada barra representa uma coleta validada. Lacunas significam que o dado ainda não estava disponível — não são preenchidas artificialmente.</p><div class="chart" data-history-chart></div></section>`;
  const chart = $('[data-history-chart]', root);
  const valid = history.filter((point) => hasNumber(point.kills_total));
  if (!valid.length) {
    chart.innerHTML = '<p class="page-intro">Histórico de kills ainda indisponível.</p>';
    return;
  }
  const max = Math.max(...valid.map((point) => Number(point.kills_total)), 1);
  chart.innerHTML = valid.map((point, index) => `<i class="chart-bar" style="height:${Math.max(3, Number(point.kills_total) / max * 100)}%;animation-delay:${index * 22}ms" title="${safe(formatDate(point.observed_at, true))}: ${formatNumber(point.kills_total)} kills"></i>`).join('');
}

function startCronCountdown() {
  const INTERVAL = 300; // 5 minutos do ciclo cron Railway

  function update() {
    const nowSec = Math.floor(Date.now() / 1000);
    const elapsed = nowSec % INTERVAL;
    const remaining = INTERVAL - elapsed;
    const isCollecting = elapsed < 15; // primeiros 15s indicam momento exato de disparo da coleta

    const mins = Math.floor(remaining / 60);
    const secs = remaining % 60;
    const timeFormatted = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    const displayLabel = isCollecting ? 'COLETANDO...' : timeFormatted;

    $$('[data-cron-timer]').forEach((node) => {
      node.classList.toggle('is-syncing', isCollecting);
      const textNode = $('[data-cron-timer-text]', node) || node;
      textNode.textContent = displayLabel;
      node.setAttribute(
        'title',
        isCollecting
          ? 'Coletor Railway disparado neste momento via cron!'
          : `Próxima sincronização do cron Railway em ${timeFormatted}`
      );
    });
  }

  update();
  setInterval(update, 1000);
}

setupNavigation();
setupMotion();
setupCopies();
loadServerStatus();
loadSideRanking();
loadFullRanking();
loadPlayer();
startCronCountdown();
$$('[data-year]').forEach((node) => { node.textContent = new Date().getFullYear(); });

setInterval(() => {
  loadServerStatus();
  if ($('[data-ranking-list]')) loadSideRanking();
  if ($('[data-ranking-body]')) loadFullRanking();
}, 120_000);
