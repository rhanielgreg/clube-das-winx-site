export const RECOVERY_INVALID = 'Link de recuperação inválido ou expirado. Solicite um novo link e abra-o nesta aba.';

class RecoveryError extends Error {}
function failure(message = RECOVERY_INVALID) { return new RecoveryError(message); }

export function recoveryMessage(error, phase = 'return') {
  const code = error?.code;
  if (phase === 'password' && (code === 'weak_password' || error?.name === 'AuthWeakPasswordError'))
    return 'A senha não atende à política de segurança do Supabase. Use uma senha mais longa, com maiúsculas, minúsculas, números e símbolos, sem combinações comuns.';
  if (phase === 'password' && code === 'same_password') return 'Escolha uma senha diferente da senha atual.';
  if (phase === 'password' && code === 'reauthentication_needed') return 'A recuperação precisa ser confirmada novamente. Solicite um novo link.';
  if (error?.status === 429 || code === 'over_email_send_rate_limit' || code === 'over_request_rate_limit')
    return 'Limite de tentativas atingido. Aguarde alguns minutos e tente novamente.';
  if (error?.name === 'AuthRetryableFetchError' || error?.name === 'TypeError')
    return 'Não foi possível conectar ao serviço de autenticação. Verifique sua conexão e tente novamente.';
  return phase === 'request' ? 'Não foi possível enviar o link. Tente novamente mais tarde.' : RECOVERY_INVALID;
}

export function validateNewPassword(password, confirmation) {
  if (typeof password !== 'string' || [...password].length < 8) throw failure('Use uma senha com pelo menos 8 caracteres.');
  if (password !== confirmation) throw failure('A confirmação deve ser igual à nova senha.');
}

function claimsOf(token) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) throw failure();
    return JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
  } catch { throw failure(); }
}

// Claims só restringem o fluxo; a autenticidade é conferida por getUser(token), no Auth.
async function verifiedSession(auth, session, supabaseUrl, now, recovery = false) {
  if (!session?.access_token || !session?.user?.id) throw failure();
  const claims = claimsOf(session.access_token);
  if (claims.iss !== supabaseUrl.replace(/\/$/, '') + '/auth/v1' || claims.sub !== session.user.id
    || !Number.isFinite(claims.exp) || claims.exp * 1000 <= now()) throw failure();
  // O fluxo implícito do GoTrue emite AMR otp também para recovery; não exige amr=recovery.
  if (recovery && (!Array.isArray(claims.amr) || !claims.amr.some(entry => ['otp', 'recovery'].includes(entry.method)))) throw failure();
  const { data, error } = await auth.getUser(session.access_token);
  if (error || !data?.user?.id || data.user.id !== claims.sub) throw failure();
  return { userId: claims.sub, sessionId: claims.session_id, expiresAt: claims.exp * 1000 };
}

export function createPasswordRecovery({ auth, supabaseUrl, now = Date.now }) {
  let grant = null;
  let state = 'idle';
  let generation = 0;
  const revoke = () => { generation++; grant = null; state = 'invalid'; };
  const authorize = async session => {
    const attempt = generation;
    state = 'validating';
    const proof = await verifiedSession(auth, session, supabaseUrl, now, true);
    if (attempt !== generation || !proof.sessionId) throw failure();
    grant = proof;
    state = 'ready';
    return { kind: 'recovery' };
  };
  return {
    get state() { return state; }, revoke,
    async handleAuthEvent(event, session) {
      if (event === 'SIGNED_OUT') { revoke(); return null; }
      // INITIAL_SESSION/SIGNED_IN/getSession jamais concedem autorização de recuperação.
      if (event !== 'PASSWORD_RECOVERY') return null;
      try { return await authorize(session); } catch { revoke(); throw failure(); }
    },
    async consumeReturn(callback) {
      if (!callback) return { kind: 'none' };
      try {
        if (callback.kind === 'error') throw failure();
        let result;
        let recovery = callback.type === 'recovery';
        if (callback.kind === 'tokens') {
          if (!callback.access_token || !callback.refresh_token) throw failure();
          // Recusa token expirado antes que setSession possa renová-lo silenciosamente.
          const claims = claimsOf(callback.access_token);
          if (!Number.isFinite(claims.exp) || claims.exp * 1000 <= now()
            || claims.iss !== supabaseUrl.replace(/\/$/, '') + '/auth/v1') throw failure();
          result = await auth.setSession({ access_token: callback.access_token, refresh_token: callback.refresh_token });
          if (result?.data?.session?.access_token !== callback.access_token) throw failure();
        } else if (callback.kind === 'code') {
          result = await auth.exchangeCodeForSession(callback.code);
          // Metadado do verifier PKCE guardado pelo SDK, não um flag arbitrário na URL.
          recovery = ['recovery', 'PASSWORD_RECOVERY'].includes(result?.data?.redirectType);
          if (callback.type === 'recovery' && !recovery) throw failure();
        } else if (callback.kind === 'otp' && recovery) {
          result = await auth.verifyOtp({ token_hash: callback.token_hash, type: 'recovery' });
        } else throw failure();
        if (result?.error || !result?.data?.session) throw failure();
        if (recovery) return await authorize(result.data.session);
        await verifiedSession(auth, result.data.session, supabaseUrl, now);
        return { kind: 'login', session: result.data.session };
      } catch { revoke(); throw failure(); }
      finally {
        for (const key of ['access_token', 'refresh_token', 'code', 'token_hash']) delete callback[key];
      }
    },
    async save(password, confirmation) {
      if (state !== 'ready' || !grant || grant.expiresAt <= now()) throw failure();
      validateNewPassword(password, confirmation);
      state = 'saving';
      const attempt = generation;
      try {
        const { data, error } = await auth.getSession();
        if (error) throw failure();
        const proof = await verifiedSession(auth, data?.session, supabaseUrl, now, true);
        if (attempt !== generation || !grant || proof.userId !== grant.userId || proof.sessionId !== grant.sessionId) throw failure();
        const updated = await auth.updateUser({ password });
        if (updated.error) {
          if (['weak_password', 'same_password'].includes(updated.error.code) || updated.error.name === 'AuthWeakPasswordError') {
            state = 'ready';
            throw failure(recoveryMessage(updated.error, 'password'));
          }
          throw failure(recoveryMessage(updated.error, 'password'));
        }
        if (updated.data?.user?.id !== grant.userId) throw failure();
        grant = null;
        state = 'complete';
      } catch (error) {
        if (state !== 'ready') revoke();
        throw error instanceof RecoveryError ? error : failure(recoveryMessage(error, 'password'));
      }
      // Não abre o dashboard com a sessão de recovery: exige login com a nova senha.
      try { const result = await auth.signOut({ scope: 'local' }); return { signedOut: !result?.error }; }
      catch { return { signedOut: false }; }
    },
  };
}

export async function requestPasswordRecovery(auth, email, origin) {
  try {
    const { error } = await auth.resetPasswordForEmail(email, { redirectTo: new URL('/admin', origin).href });
    if (error) throw error;
  } catch (error) { throw failure(recoveryMessage(error, 'request')); }
}
