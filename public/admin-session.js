// Revalidação da sessão do aplicativo; a autorização continua exclusivamente na API.
export function createAdminSession({ auth, loadDashboard, onAuthorized, onLogin,
  forgetStoredSession = () => {}, readStoredToken = () => null, isRecoveryActive = () => false, now = Date.now }) {
  let generation = 0;
  let suspended = false;
  let accepted = null;
  let acceptedUntil = 0;
  let transient = null;
  let transientUntil = 0;
  let pending = null;
  const rejected = new Set();
  const blocked = () => suspended || isRecoveryActive();
  const login = (reason, interactive) => onLogin({ reason, interactive });
  async function discard(session, epoch) {
    if (blocked() || epoch !== generation) return;
    let stored;
    try { const result = await auth.getSession(); if (result.error) throw result.error; stored = result.data?.session; }
    catch {
      // A rejeição já foi comprovada pela API; só remove o token antigo se ainda for o mesmo.
      if (!blocked() && epoch === generation) forgetStoredSession(session.access_token);
      return;
    }
    if (blocked() || epoch !== generation || stored?.access_token !== session.access_token) return;
    try {
      const result = await auth.signOut({ scope: 'local' });
      if (result?.error && !blocked() && epoch === generation) forgetStoredSession(session.access_token);
    } catch {
      if (!blocked() && epoch === generation) forgetStoredSession(session.access_token);
    }
  }
  return {
    suspend() { suspended = true; generation++; accepted = null; acceptedUntil = 0; pending = null; },
    resume() { suspended = false; },
    async restoreInitial() {
      if (blocked()) return false;
      const previous = readStoredToken();
      try {
        const { data, error } = await auth.getSession();
        if (blocked()) return false;
        if (error) {
          if (error.status === 401 || error.status === 403 ||
            ['refresh_token_not_found', 'refresh_token_already_used', 'session_not_found', 'bad_jwt', 'invalid_refresh_token'].includes(error.code))
            forgetStoredSession(previous);
          login('unavailable', false); return false;
        }
        return await this.restore(data?.session);
      } catch { if (!blocked()) login('unavailable', false); return false; }
    },
    async restore(session, { interactive = false } = {}) {
      if (blocked()) return false;
      if (!session?.access_token) {
        generation++; accepted = null; acceptedUntil = 0; pending = null;
        login('signed_out', false); return false;
      }
      const token = session.access_token;
      if (pending?.token === token) return pending.promise;
      if (!interactive && rejected.has(token)) return false;
      if (!interactive && accepted === token && acceptedUntil > now()) return true;
      if (!interactive && transient === token && transientUntil > now()) return false;
      const epoch = ++generation;
      accepted = null;
      const promise = (async () => {
        try {
          if (Number.isFinite(session.expires_at) && session.expires_at * 1000 <= now())
            throw Object.assign(new Error('expired'), { authRejected: true });
          const dashboard = await loadDashboard(session);
          if (blocked() || epoch !== generation) return false;
          accepted = token;
          acceptedUntil = Math.min(now() + 60000, Number.isFinite(session.expires_at) ? session.expires_at * 1000 : Infinity);
          rejected.delete(token);
          transient = null;
          onAuthorized(session, dashboard);
          return true;
        } catch (error) {
          if (blocked() || epoch !== generation) return false;
          if (error?.authRejected === true) {
            rejected.add(token);
            login('rejected', interactive);
            await discard(session, epoch);
          } else {
            // Falha transitória não remove credenciais válidas e não cria retentativa automática.
            transient = token;
            transientUntil = now() + 60000;
            login('unavailable', interactive);
          }
          return false;
        } finally { if (pending?.token === token && pending.epoch === epoch) pending = null; }
      })();
      pending = { token, epoch, promise };
      return promise;
    },
  };
}

export function forgetStoredAdminSession(storage, key, expectedToken) {
  try {
    const stored = JSON.parse(storage.getItem(key));
    if (expectedToken && stored?.access_token === expectedToken) storage.removeItem(key);
  } catch { /* Nunca limpa todo o storage nem o verifier de recuperação. */ }
}

export function retryAfterAt(headers, now = Date.now()) {
  const value = headers.get('retry-after');
  if (!value) return null;
  if (/^\d+$/.test(value.trim())) {
    const deadline = now + Number(value) * 1000;
    return Number.isSafeInteger(deadline) && deadline >= now ? deadline : null;
  }
  const until = Date.parse(value), server = Date.parse(headers.get('date') || '');
  const deadline = Number.isFinite(server) ? now + Math.max(0, until - server) : until;
  return Number.isSafeInteger(deadline) && deadline >= now ? deadline : null;
}
