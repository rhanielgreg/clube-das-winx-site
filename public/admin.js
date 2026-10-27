import { AUTH_UNAVAILABLE, requireAdminAuth, createAdminAuthClient, adminAuthStorageKey } from './admin-auth.js';
import { createPasswordRecovery, requestPasswordRecovery, RECOVERY_INVALID } from './password-recovery.js';
import { createAdminSession, forgetStoredAdminSession, retryAfterAt } from './admin-session.js';
import { createRecoveryRequest } from './recovery-request.js';
import { seasonDeadline } from './season-schedule.js';
import { mountFooter } from './footer.js';
mountFooter();
import { seasonResult } from './championship.js';
import { formatNumber, csvField, formatDuration } from './contracts.js';
const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

let supabaseClient = null;
let currentSession = null;
let currentDashboardData = null;
let demoMode = false;
let passwordRecovery = null;
let recoveryFlow = false;
let authBootstrapping = true;
let adminSession = null;
let recoveryRequest = null;
let recoveryResponse = null;
let recoveryWaitTimer = null;
const authReturn = window.takeAdminAuthReturn?.() || null;

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
  // Não solicita SDK/credenciais enquanto a configuração pública estiver incompleta.
  supabaseClient=await createAdminAuthClient(config,async()=>{
    if(!window.supabase) {
      await new Promise((resolve,reject)=>{
        const script=document.createElement('script');
        const timer=setTimeout(()=>reject(new Error('SDK de autenticação indisponível. Tente novamente mais tarde.')),10000);
        script.src='https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.48.1/dist/umd/supabase.js';
        script.onload=()=>{clearTimeout(timer);resolve();};
        script.onerror=()=>{clearTimeout(timer);reject(new Error('SDK de autenticação indisponível. Tente novamente mais tarde.'));};
        document.head.append(script);
      });
    }
    return window.supabase;
  },{onRecoveryResponse:response=>{recoveryResponse={status:response.status,retryAt:retryAfterAt(response.headers)};}});
  return config;
}

function setAuthControls(enabled) {
  $$('[data-pwd-login-btn], [data-magic-login-btn], [data-forgot-password], [data-recovery-request-btn]').forEach(button=>{button.disabled=!enabled;});
  renderRecoveryRequest();
}

function renderRecoveryRequest() {
  if (!recoveryRequest) return;
  const state = recoveryRequest.view();
  clearTimeout(recoveryWaitTimer);
  if (state.retryAt) recoveryWaitTimer = setTimeout(renderRecoveryRequest, Math.min(2147483647,Math.max(1,state.retryAt-Date.now())));
  const button = $('[data-recovery-request-btn]');
  button.disabled = !supabaseClient?.auth || state.blocked;
  button.textContent = ({sending:'ENVIANDO…', pending:'PEDIDO JÁ INICIADO', sent:'LINK SOLICITADO',
    rate_limited:'ENVIO BLOQUEADO', failed:'ENVIO A CONFERIR', storage_unavailable:'ENVIO INDISPONÍVEL'})[state.phase] || 'ENVIAR LINK DE RECUPERAÇÃO';
  const again = $('[data-recovery-request-again]');
  again.hidden = !state.blocked || state.phase === 'sending' || state.phase === 'storage_unavailable';
  again.disabled = !state.canRearm;
  let message = ({sending:'Solicitando o link. Aguarde, sem reenviar.',
    pending:'Um pedido já foi iniciado neste navegador. Confira sua caixa de entrada antes de preparar outra tentativa.',
    sent:'Solicitação enviada. Se houver uma conta com esse e-mail, você receberá o link. Confira a caixa de entrada e o spam; abra o e-mail mais recente.',
    rate_limited:'O Supabase informou limite de envios. Nenhuma tentativa automática será feita. Aguarde antes de preparar uma nova solicitação.',
    failed:'Não foi possível confirmar o envio. Confira sua caixa de entrada antes de tentar de novo. Nenhum reenvio automático será feito.',
    storage_unavailable:'Não foi possível ativar a proteção local contra envios duplicados. Use um navegador com armazenamento local e Web Locks disponíveis.'})[state.phase];
  if (state.retryAt) message += ` O servidor pediu aguardar até ${formatDate(new Date(state.retryAt).toISOString())}.`;
  const feedback = $('[data-recovery-request-feedback]');
  feedback.style.display = message ? 'block' : 'none';
  feedback.className = `auth-feedback ${state.phase === 'sent' ? 'success' : ''}`;
  feedback.textContent = message || '';
}

function authFeedback(message, success = false) {
  const feedback = $('[data-auth-feedback]');
  feedback.className = `auth-feedback ${success ? 'success' : 'error'}`;
  feedback.textContent = message;
  feedback.style.display = 'block';
}

function showRecovery(message = 'Validando seu link de recuperação…') {
  recoveryFlow = true;
  adminSession?.suspend();
  currentSession = null;
  $('[data-auth-card]').style.display = 'none';
  $('[data-admin-dashboard]').style.display = 'none';
  $('[data-admin-session]').style.display = 'none';
  $('[data-recovery-card]').style.display = 'grid';
  $('[data-recovery-fields]').disabled = passwordRecovery?.state !== 'ready';
  if (passwordRecovery?.state === 'invalid') $('[data-recovery-form]').reset();
  const busy = message.startsWith('Validando') || ['validating', 'saving'].includes(passwordRecovery?.state);
  $('[data-recovery-return]').disabled = busy;
  $('[data-recovery-new-link]').disabled = busy;
  const feedback = $('[data-recovery-feedback]');
  feedback.textContent = message;
  feedback.className = `auth-feedback ${passwordRecovery?.state === 'ready' ? 'success' : 'error'}`;
  $('#recovery-title').focus();
}

function showLogin(requestLink = false) {
  passwordRecovery?.revoke();
  recoveryFlow = false;
  adminSession?.resume();
  $('[data-recovery-card]').style.display = 'none';
  $('[data-recovery-form]').reset();
  $('[data-recovery-fields]').disabled = true;
  $('[data-auth-card]').style.display = 'grid';
  $('[data-admin-dashboard]').style.display = 'none';
  $('.auth-tabs').style.display = requestLink ? 'none' : 'flex';
  $('[data-password-form]').style.display = requestLink ? 'none' : 'grid';
  $('[data-magic-form]').style.display = 'none';
  $('[data-recovery-request-form]').style.display = requestLink ? 'grid' : 'none';
  $$('.auth-tab-btn').forEach(btn => btn.classList.toggle('is-active', btn.dataset.tab === 'password'));
  $('[data-auth-feedback]').style.display = 'none';
  if (requestLink) $('#admin-recovery-email').focus();
  renderRecoveryRequest();
}

function setupRecoveryHandlers() {
  $('[data-forgot-password]').addEventListener('click', () => {
    $('#admin-recovery-email').value = $('#admin-email-pwd').value;
    showLogin(true);
  });
  $('[data-request-return]').addEventListener('click', () => showLogin());
  $('[data-recovery-return]').addEventListener('click', () => showLogin());
  $('[data-recovery-new-link]').addEventListener('click', () => showLogin(true));
  $('[data-recovery-request-form]').addEventListener('submit', async event => {
    event.preventDefault();
    if ($('[data-recovery-request-btn]').disabled || !recoveryRequest) return;
    await recoveryRequest.request($('#admin-recovery-email').value.trim());
  });
  $('[data-recovery-request-again]').addEventListener('click', async () => { await recoveryRequest?.rearm(); });
  $('[data-recovery-form]').addEventListener('submit', async event => {
    event.preventDefault();
    if (passwordRecovery?.state !== 'ready') return;
    $('[data-recovery-fields]').disabled = true;
    $('[data-recovery-return]').disabled = true;
    $('[data-recovery-new-link]').disabled = true;
    try {
      const result = await passwordRecovery.save($('#admin-new-password').value, $('#admin-confirm-password').value);
      $('[data-recovery-form]').reset();
      if (result.signedOut) {
        showLogin();
        authFeedback('Senha atualizada com sucesso. Entre com seu e-mail e a nova senha.', true);
        $('#admin-email-pwd').focus();
      } else {
        showRecovery('Senha atualizada. Use “Voltar ao login” para entrar com a nova senha.');
      }
    } catch (error) { showRecovery(error.message); }
    finally { $('[data-recovery-fields]').disabled = passwordRecovery?.state !== 'ready'; }
  });
}

async function displaySession(session, options) {
  if (recoveryFlow || authBootstrapping) return false;
  return adminSession?.restore(session, options);
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

async function fetchDashboardData(session = currentSession) {
  if (!demoMode && !session?.access_token) return;

  const response = await fetch('/api/admin', {
    method: 'GET',
    headers: demoMode ? {} : { authorization: `Bearer ${session.access_token}` },
  });

  const data = await response.json();
  if (!response.ok) {
    throw Object.assign(new Error('Falha ao buscar dados administrativos.'), {
      authRejected: response.status === 401 || response.status === 403 &&
        ['Sessão inválida ou expirada.', 'Acesso administrativo não autorizado.', 'Token de autorização ausente.'].includes(data.error),
    });
  }
  return data;
}

function renderDashboard(data) {
  currentDashboardData = data;
  if(data.monthly_automation===true){
    $$('[data-action-open-close-modal], [data-start-season-btn], [data-modal-confirm-btn], [data-action-reset-baseline]').forEach(button=>{button.disabled=true;button.title='Calendário mensal automático; operação manual legada bloqueada.';});
    const legacy=$('[data-new-season-form]');if(legacy)legacy.closest('section').hidden=true;
    const rename=$('[data-rename-season-form]');if(rename)rename.hidden=!data.admin.hasServiceKey||!data.activeSeason;
  }
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
    $('[data-season-end]').textContent = seasonDeadline(activeSeason)||'Prazo não confirmado';
    $('[data-season-closure]').textContent = activeSeason.closure_mode==='automatic'?'Virada mensal automática · resultado sujeito à certificação':activeSeason.closure_mode==='manual'?'Encerramento manual':'Forma de encerramento não confirmada';
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
  $('[data-rename-season-form]')?.addEventListener('submit',async event=>{
    event.preventDefault();const form=event.currentTarget,button=form.querySelector('button'),feedback=$('[data-rename-feedback]');button.disabled=true;
    try{const values=new FormData(form);await requestAdminApi('rename_season',{season_id:currentDashboardData?.activeSeason?.season_id,name:values.get('name'),reason:values.get('reason')});
      form.reset();renderDashboard(await fetchDashboardData());feedback.textContent='Nome atualizado e intervenção registrada.';
    }catch{feedback.textContent='Não foi possível registrar a alteração. Atualize os dados antes de tentar novamente.';}finally{button.disabled=false;}
  });
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
      if (pwdBtn.disabled) return;
      const email = $('#admin-email-pwd').value.trim();
      const password = $('#admin-password-input').value;
      if (!email || !password) return;

      pwdBtn.disabled = true;
      pwdBtn.textContent = 'AUTENTICANDO...';
      feedback.style.display = 'none';

      try {
        const { data, error } = await requireAdminAuth(supabaseClient).signInWithPassword({
          email,
          password,
        });

        if (error) throw error;

        const authorized = await displaySession(data.session, { interactive: true });
        if (!authorized) authFeedback('Não foi possível autorizar o painel. Confira a conta administrativa e tente novamente.');
      } catch (err) {
        feedback.className = 'auth-feedback error';
        feedback.textContent = err.message || 'Credenciais inválidas. Verifique seu e-mail e senha no Supabase.';
        feedback.style.display = 'block';
      } finally {
        pwdBtn.disabled = !supabaseClient?.auth;
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
        const { error } = await requireAdminAuth(supabaseClient).signInWithOtp({
          email,
          options: {
            emailRedirectTo: window.location.origin + '/admin',
            shouldCreateUser: false,
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
        magicBtn.disabled = !supabaseClient?.auth;
        magicBtn.textContent = 'ENVIAR LINK MÁGICO ↗';
      }
    });
  }

  const logoutBtn = $('[data-action-logout]');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      if(!supabaseClient?.auth)return;
      await requireAdminAuth(supabaseClient).signOut({scope:'local'});
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

async function main() {
  // Captura submit antes de qualquer await; falhas de bootstrap não enviam formulários nativos.
  setupAuthHandlers();
  setupRecoveryHandlers();
  setupDashboardActions();
  setAuthControls(false);
  const publicConfig = await initSupabase();
  demoMode = publicConfig.demo === true;

  const resetButton = $('[data-action-reset-baseline]');
  if (resetButton) { resetButton.disabled = true; resetButton.title = 'Reset bloqueado até revisão transacional e autorização específica.'; }
  if (publicConfig.demo) {
    if (authReturn) { showRecovery('Recuperação indisponível nesta demonstração local.'); return; }
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
    setAuthControls(false);
    feedback.textContent = AUTH_UNAVAILABLE;
    feedback.style.display = 'block';
    return;
  }

  let localAuthStorage;
  try { localAuthStorage = window.localStorage; } catch { /* O envio falha de modo fechado se não puder persistir o controle. */ }
  const requestKey = `winx.admin.recovery-request:${new URL(publicConfig.supabase_url).host}`;
  recoveryRequest = createRecoveryRequest({ storage:localAuthStorage, key:requestKey,
    lock: navigator.locks?.request ? action => navigator.locks.request(requestKey,{ifAvailable:true},held=>held?action():false) : null,
    send: email => {
      recoveryResponse = null;
      return requestPasswordRecovery(requireAdminAuth(supabaseClient), email, window.location.origin, () => recoveryResponse);
    }, notify:renderRecoveryRequest });
  window.addEventListener('storage',event=>{if(event.key===requestKey)renderRecoveryRequest();});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)renderRecoveryRequest();});
  adminSession = createAdminSession({ auth:supabaseClient.auth, loadDashboard:fetchDashboardData,
    isRecoveryActive:()=>recoveryFlow || authBootstrapping,
    readStoredToken:()=>{try{return JSON.parse(localAuthStorage.getItem(adminAuthStorageKey(publicConfig.supabase_url)))?.access_token || null;}catch{return null;}},
    forgetStoredSession:token=>forgetStoredAdminSession(localAuthStorage,adminAuthStorageKey(publicConfig.supabase_url),token),
    onAuthorized:(session,data)=>{currentSession=session;renderDashboard(data);},
    onLogin:({reason,interactive})=>{
      currentSession=null;currentDashboardData=null;
      $('[data-auth-card]').style.display='grid';
      $('[data-admin-dashboard]').style.display='none';
      $('[data-admin-session]').style.display='none';
      if(interactive) authFeedback(reason==='rejected'?'Acesso administrativo não autorizado. Entre com a conta correta.':'Painel temporariamente indisponível. Tente novamente.');
    } });
  setAuthControls(true);
  passwordRecovery = createPasswordRecovery({ auth: supabaseClient.auth, supabaseUrl: publicConfig.supabase_url });
  // O callback é síncrono: chamadas ao SDK ocorrem fora do lock interno do Auth.
  supabaseClient.auth.onAuthStateChange((event, session) => {
    if (event === 'PASSWORD_RECOVERY') {
      showRecovery();
      setTimeout(() => passwordRecovery.handleAuthEvent(event, session)
        .then(() => showRecovery('Link validado. Cadastre e confirme sua nova senha.'))
        .catch(() => showRecovery(RECOVERY_INVALID)), 0);
      return;
    }
    if (event === 'SIGNED_OUT' && passwordRecovery.state !== 'complete') passwordRecovery.revoke();
    if (!authBootstrapping && !recoveryFlow) setTimeout(() => displaySession(session), 0);
  });
  if (authReturn) showRecovery();
  let returned;
  try { returned = await passwordRecovery.consumeReturn(authReturn); }
  catch { authBootstrapping = false; showRecovery(RECOVERY_INVALID); return; }
  authBootstrapping = false;
  if (returned.kind === 'recovery') { showRecovery('Link validado. Cadastre e confirme sua nova senha.'); return; }
  // Um retorno de login comum não mantém a tela de recuperação aberta.
  recoveryFlow = false;
  $('[data-recovery-card]').style.display = 'none';
  $('[data-auth-card]').style.display = 'grid';
  await adminSession.restoreInitial();
}

main().catch((error) => { setAuthControls(false); const feedback = $('[data-auth-feedback]'); if (feedback) { feedback.textContent = error.message; feedback.style.display = 'block'; } });
