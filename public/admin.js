import { seasonResult } from './championship.js';
import { formatNumber, csvField, formatDuration } from './contracts.js';
const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

let supabaseClient = null;
let currentSession = null;
let currentDashboardData = null;
let demoMode = false;

function showToast(message, duration = 3500) {
  const toast = $('[data-toast]');
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add('is-visible');
  setTimeout(() => toast.classList.remove('is-visible'), duration);
}

function formatDate(isoString) {
  if (!isoString) return '—';
  const date = new Date(isoString);
  if (isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: 'America/Sao_Paulo',
  }).format(date);
}

async function initSupabase() {
  const response = await fetch('/api/config');
  if (!response.ok) throw new Error('Configuração administrativa indisponível.');
  const config = await response.json();
  if (config.demo || !config.admin_enabled) return config;
  // O SDK de autenticação só é carregado quando há configuração explícita.
  if (!window.supabase) {
    await new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.48.1/dist/umd/supabase.js';
      script.onload = resolve; script.onerror = () => reject(new Error('SDK de autenticação indisponível.'));
      document.head.append(script);
    });
  }
  supabaseClient = window.supabase.createClient(config.supabase_url, config.supabase_public_key, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
  });
  return config;
}

async function requestAdminApi(action, payload = {}) {
  if (!currentSession?.access_token) {
    throw new Error('Sessão expirada. Faça login novamente.');
  }

  const response = await fetch('/api/admin', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${currentSession.access_token}`,
    },
    body: JSON.stringify({ action, payload }),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || `Erro HTTP ${response.status}`);
  }
  return data;
}

async function fetchDashboardData() {
  if (!demoMode && !currentSession?.access_token) return;

  const response = await fetch('/api/admin', {
    method: 'GET',
    headers: demoMode ? {} : { authorization: `Bearer ${currentSession.access_token}` },
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || 'Falha ao buscar dados administrativos.');
  }
  return data;
}

function renderDashboard(data) {
  currentDashboardData = data;
  const { activeSeason, ranking, seasons, sync, admin } = data;

  // Header
  $('[data-admin-email]').textContent = admin.email;
  $('[data-admin-session]').style.display = 'flex';
  $('[data-auth-card]').style.display = 'none';
  $('[data-admin-dashboard]').style.display = 'block';

  // Aviso de service_role
  const keyWarn = $('[data-service-key-warning]');
  if (keyWarn) keyWarn.style.display = admin.hasServiceKey ? 'none' : 'flex';

  // KPIs
  $('[data-kpi-season]').textContent = activeSeason ? activeSeason.name : 'Nenhuma';
  $('[data-kpi-season-sub]').textContent = activeSeason ? 'Disputa ativa' : 'Ranking congelado';
  $('[data-kpi-players]').textContent = ranking.length;
  $('[data-kpi-leader]').textContent = ranking[0]?.character_name || 'Nenhum';
  $('[data-kpi-leader-kills]').textContent = ranking[0] ? `${formatNumber(ranking[0].kills_total)} kills` : 'Sem pontuação';
  $('[data-kpi-sync]').textContent = sync?.last_success_at ? formatDate(sync.last_success_at) : 'Aguardando';

  // Active Season
  const activeContent = $('[data-active-season-content]');
  const noSeasonContent = $('[data-no-season-content]');
  const badge = $('[data-season-status-badge]');

  if (activeSeason) {
    activeContent.style.display = 'block';
    noSeasonContent.style.display = 'none';
    badge.textContent = 'DISPUTA ATIVA';
    badge.classList.remove('closed');

    $('[data-season-title]').textContent = activeSeason.name;
    $('[data-season-reward]').textContent = activeSeason.reward_message || 'Sem recompensa descrita.';
    $('[data-season-id]').textContent = activeSeason.season_id;
    $('[data-season-start]').textContent = formatDate(activeSeason.started_at);
  } else {
    activeContent.style.display = 'none';
    noSeasonContent.style.display = 'block';
    badge.textContent = 'CONGELADA';
    badge.classList.add('closed');
  }

  // Tabela
  const tbody = $('[data-admin-ranking-body]');
  if (tbody) {
    tbody.innerHTML = ranking.length
      ? ranking.map((p, idx) => {
        const displayName = p.steam_username || p.character_name;
        const sub = p.steam_username && p.character_name !== p.steam_username ? `<br><small style="color:#8a7b84">${escapeHtml(p.character_name)}</small>` : '';
        return `
        <tr>
          <td><strong>#${idx + 1}</strong></td>
          <td><b>${escapeHtml(displayName)}</b>${sub}</td>
          <td><b style="color:var(--pink-soft)">${formatNumber(p.kills_total)}</b></td>
          <td>${formatNumber(p.kills_firearm)}</td>
          <td>${formatNumber(p.kills_melee)}</td>
          <td>${formatDuration(p.survival_seconds)}</td>
          <td><span class="${p.alive === false ? 'dead' : p.alive === true ? 'alive' : 'unknown'}">${p.alive === false ? 'MORTO' : p.alive === true ? 'VIVO' : 'DESCONHECIDO'}</span></td>
          <td>${formatDate(p.last_updated_at)}</td>
        </tr>`;
      }).join('')
      : '<tr><td colspan="8" class="table-loading">Nenhum sobrevivente pontuou nesta temporada ainda.</td></tr>';
  }

  // Histórico
  const historyList = $('[data-admin-seasons-list]');
  if (historyList) {
    historyList.innerHTML = seasons.length
      ? seasons.map((s) => `
        <div class="history-card">
          <small>${s.status === 'active' ? 'EM ANDAMENTO' : 'ENCERRADA'}</small>
          <h4>${escapeHtml(s.name)}</h4>
          <p>${s.winner_name ? `Campeão: <b>${escapeHtml(s.winner_name)}</b> (${formatNumber(s.winner_kills)} kills)` : escapeHtml(seasonResult(s))}</p>
          <p style="margin-top:4px;font-size:9px;color:#85777f">Início: ${formatDate(s.started_at)}</p>
        </div>
      `).join('')
      : '<div class="history-empty">Nenhuma temporada registrada no banco.</div>';
  }
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text || '';
  return div.innerHTML;
}

function setupAuthHandlers() {
  const feedback = $('[data-auth-feedback]');
  const pwdForm = $('[data-password-form]');
  const magicForm = $('[data-magic-form]');
  const pwdBtn = $('[data-pwd-login-btn]');
  const magicBtn = $('[data-magic-login-btn]');
  const tabBtns = $$('.auth-tab-btn');

  // Alternar abas (Senha vs Link Mágico)
  tabBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      const tab = btn.getAttribute('data-tab');
      tabBtns.forEach((b) => b.classList.toggle('is-active', b === btn));
      if (tab === 'password') {
        pwdForm.style.display = 'grid';
        magicForm.style.display = 'none';
      } else {
        pwdForm.style.display = 'none';
        magicForm.style.display = 'grid';
      }
      feedback.style.display = 'none';
    });
  });

  // 1. LOGIN COM E-MAIL E SENHA (SEM LIMITES DE ENVIO)
  if (pwdForm) {
    pwdForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = $('#admin-email-pwd').value.trim();
      const password = $('#admin-password-input').value;
      if (!email || !password) return;

      pwdBtn.disabled = true;
      pwdBtn.textContent = 'AUTENTICANDO...';
      feedback.style.display = 'none';

      try {
        const { data, error } = await supabaseClient.auth.signInWithPassword({
          email,
          password,
        });

        if (error) throw error;

        currentSession = data.session;
        feedback.className = 'auth-feedback success';
        feedback.textContent = 'Autenticado com sucesso! Carregando painel...';
        feedback.style.display = 'block';

        const dashboardData = await fetchDashboardData();
        renderDashboard(dashboardData);
      } catch (err) {
        feedback.className = 'auth-feedback error';
        feedback.textContent = err.message || 'Credenciais inválidas. Verifique seu e-mail e senha no Supabase.';
        feedback.style.display = 'block';
      } finally {
        pwdBtn.disabled = false;
        pwdBtn.textContent = 'ENTRAR COM SENHA ➔';
      }
    });
  }

  // 3. LOGIN COM LINK MÁGICO (OTP)
  if (magicForm) {
    magicForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = $('#admin-email-magic').value.trim();
      if (!email) return;

      magicBtn.disabled = true;
      magicBtn.textContent = 'ENVIANDO LINK...';
      feedback.style.display = 'none';

      try {
        const { error } = await supabaseClient.auth.signInWithOtp({
          email,
          options: {
            emailRedirectTo: window.location.origin + '/admin',
          },
        });

        if (error) throw error;

        feedback.className = 'auth-feedback success';
        feedback.textContent = `Link mágico enviado para ${email}! Verifique sua caixa de entrada e clique no link para acessar.`;
        feedback.style.display = 'block';
      } catch (err) {
        feedback.className = 'auth-feedback error';
        feedback.textContent = err.message || 'Falha ao enviar e-mail com link mágico.';
        feedback.style.display = 'block';
      } finally {
        magicBtn.disabled = false;
        magicBtn.textContent = 'ENVIAR LINK MÁGICO ↗';
      }
    });
  }

  const logoutBtn = $('[data-action-logout]');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      await supabaseClient.auth.signOut();
      window.location.reload();
    });
  }
}

function setupDashboardActions() {
  // Exportar CSV
  $('[data-action-export-csv]')?.addEventListener('click', () => {
    if (!currentDashboardData?.ranking?.length) {
      alert('Nenhum sobrevivente no ranking para exportar.');
      return;
    }

    const seasonName = (currentDashboardData.activeSeason?.name || 'temporada').replace(/\s+/g, '_');
    const rows = [
      ['Posicao', 'Usuario_Steam', 'Personagem', 'Kills_Total', 'Kills_Arma', 'Kills_Melee', 'Tempo_Segundos', 'Estado', 'Ultima_Atualizacao'],
      ...currentDashboardData.ranking.map((p, idx) => [
        idx + 1,
        csvField(p.steam_username),
        csvField(p.character_name),
        p.kills_total ?? '',
        p.kills_firearm ?? '',
        p.kills_melee ?? '',
        p.survival_seconds ?? '',
        p.alive === false ? 'MORTO' : p.alive === true ? 'VIVO' : 'DESCONHECIDO',
        csvField(p.last_updated_at),
      ]),
    ];

    const csvContent = '\ufeff' + rows.map((e) => e.join(';')).join('\n');
    const encodedUri = URL.createObjectURL(new Blob([csvContent], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `ranking_${seasonName}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(encodedUri), 1000);
    showToast('Planilha CSV gerada com sucesso!');
  });

  // Atualizar
  $('[data-action-refresh]')?.addEventListener('click', async () => {
    try {
      showToast('Atualizando dados...');
      const data = await fetchDashboardData();
      renderDashboard(data);
      showToast('Painel atualizado!');
    } catch (e) {
      showToast(`Erro: ${e.message}`);
    }
  });

  // Zerar linha de base
  $('[data-action-reset-baseline]')?.addEventListener('click', async () => {
    if (!currentDashboardData?.activeSeason) {
      alert('Nenhuma temporada ativa para zerar a linha de base.');
      return;
    }
    const ok = confirm(
      'Deseja zerar a linha de base para todos os personagens da Temporada Ativa?\n\n' +
      'Isso fará com que TODAS as kills acumuladas anteriormente na história do servidor passem a contar na pontuação da Temporada 1.'
    );
    if (!ok) return;

    try {
      showToast('Redefinindo baseline...');
      const res = await requestAdminApi('reset_baseline', {
        season_id: currentDashboardData.activeSeason.season_id,
      });
      showToast(res.message);
      const updated = await fetchDashboardData();
      renderDashboard(updated);
    } catch (err) {
      alert(`Falha: ${err.message}`);
    }
  });

  // Modal Encerramento
  const modal = $('[data-close-modal]');
  $('[data-action-open-close-modal]')?.addEventListener('click', () => {
    if (!currentDashboardData?.activeSeason) return;
    const leader = currentDashboardData.ranking[0];
    $('[data-modal-season-name]').textContent = currentDashboardData.activeSeason.name;
    $('[data-modal-winner-name]').textContent = leader ? leader.character_name : 'Resultado depende da validação final do banco';
    $('[data-modal-winner-kills]').textContent = leader ? leader.kills_total : '—';
    modal.style.display = 'grid';
  });

  $$('[data-modal-cancel]').forEach((btn) => {
    btn.addEventListener('click', () => {
      modal.style.display = 'none';
    });
  });

  $('[data-modal-confirm-btn]')?.addEventListener('click', async () => {
    if (!currentDashboardData?.activeSeason) return;
    const btn = $('[data-modal-confirm-btn]');
    btn.disabled = true;
    btn.textContent = 'ENCERRANDO...';

    try {
      const leader = currentDashboardData.ranking[0];
      const res = await requestAdminApi('close_season', {
        season_id: currentDashboardData.activeSeason.season_id,
        winner_character_id: leader?.profile_id || null,
      });
      modal.style.display = 'none';
      showToast(res.message);
      const updated = await fetchDashboardData();
      renderDashboard(updated);
    } catch (err) {
      alert(`Falha ao encerrar: ${err.message}`);
    } finally {
      btn.disabled = false;
      btn.textContent = 'SIM, ENCERRAR AGORA';
    }
  });

  // Formulário Nova Temporada
  $('[data-new-season-form]')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = e.target;
    const name = form.name.value.trim();
    const slug = form.slug.value.trim().toLowerCase();
    const reward = form.reward.value.trim();

    if (!name || !slug) return;

    if (currentDashboardData?.activeSeason) {
      alert(
        `Já existe a "${currentDashboardData.activeSeason.name}" ativa!\n\n` +
        'Você precisa encerrar a temporada atual antes de abrir uma nova.'
      );
      return;
    }

    const btn = $('[data-start-season-btn]');
    btn.disabled = true;
    btn.textContent = 'INICIANDO...';

    try {
      const res = await requestAdminApi('start_season', {
        name,
        slug,
        reward_message: reward,
      });
      showToast(res.message);
      form.reset();
      const updated = await fetchDashboardData();
      renderDashboard(updated);
    } catch (err) {
      alert(`Erro: ${err.message}`);
    } finally {
      btn.disabled = false;
      btn.textContent = 'INICIAR TEMPORADA 🚀';
    }
  });
}

function parseHashParams() {
  const hash = window.location.hash.substring(1);
  if (!hash) return null;
  const params = new URLSearchParams(hash);
  const accessToken = params.get('access_token');
  const refreshToken = params.get('refresh_token');
  if (accessToken) {
    return { accessToken, refreshToken };
  }
  return null;
}

async function main() {
  const publicConfig = await initSupabase();
  demoMode = publicConfig.demo === true;
  setupAuthHandlers();
  setupDashboardActions();

  const resetButton = $('[data-action-reset-baseline]');
  if (resetButton) { resetButton.disabled = true; resetButton.title = 'Reset bloqueado até revisão transacional e autorização específica.'; }
  if (publicConfig.demo) {
    const response = await fetch('/api/admin');
    if (!response.ok) throw new Error('Dados administrativos de demonstração indisponíveis.');
    renderDashboard(await response.json());
    const banner = document.createElement('div');
    banner.className = 'demo-banner';
    banner.textContent = 'PRÉVIA LOCAL · Dados fictícios. Iniciar, encerrar e resetar estão bloqueados. Exportação CSV apenas da demonstração.';
    document.querySelector('main').prepend(banner);
    $$('[data-action-reset-baseline], [data-action-open-close-modal], [data-start-season-btn], [data-modal-confirm-btn], [data-action-logout]').forEach((button) => { button.disabled = true; });
    const warning = $('[data-service-key-warning]');
    if (warning) warning.innerHTML = '<p>Operações de escrita desativadas na prévia. Nenhuma credencial é necessária.</p>';
    return;
  }
  if (!supabaseClient) {
    const feedback = $('[data-auth-feedback]');
    feedback.textContent = 'Autenticação não configurada neste ambiente.';
    feedback.style.display = 'block';
    return;
  }

  // Trata tokens que chegam no hash da URL (Magic Link redirecionado)
  const hashTokens = parseHashParams();
  if (hashTokens?.accessToken) {
    try {
      const { data, error } = await supabaseClient.auth.setSession({
        access_token: hashTokens.accessToken,
        refresh_token: hashTokens.refreshToken || '',
      });
      if (!error && data?.session) {
        currentSession = data.session;
        // Limpa o hash da URL para manter a barra limpa
        window.history.replaceState(null, '', window.location.pathname);
      }
    } catch (e) {
      console.warn('Erro ao processar tokens da URL:', e);
    }
  }

  const { data: { session } } = await supabaseClient.auth.getSession();
  if (session) {
    currentSession = session;
    try {
      const dashboardData = await fetchDashboardData();
      renderDashboard(dashboardData);
    } catch (err) {
      console.warn('Sessão não autorizada ou erro:', err);
      $('[data-auth-card]').style.display = 'grid';
      $('[data-admin-dashboard]').style.display = 'none';
      const fb = $('[data-auth-feedback]');
      if (fb) {
        fb.className = 'auth-feedback error';
        fb.textContent = err.message;
        fb.style.display = 'block';
      }
    }
  } else {
    $('[data-auth-card]').style.display = 'grid';
    $('[data-admin-dashboard]').style.display = 'none';
  }

  supabaseClient.auth.onAuthStateChange(async (event, session) => {
    if (session) {
      currentSession = session;
      try {
        const dashboardData = await fetchDashboardData();
        renderDashboard(dashboardData);
      } catch (err) {
        showToast(err.message);
      }
    } else {
      currentSession = null;
      $('[data-auth-card]').style.display = 'grid';
      $('[data-admin-dashboard]').style.display = 'none';
      $('[data-admin-session]').style.display = 'none';
    }
  });
}

main().catch((error) => { const feedback = $('[data-auth-feedback]'); if (feedback) { feedback.textContent = error.message; feedback.style.display = 'block'; } });
