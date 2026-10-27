// Barreira local de interface, sem email, token, senha ou autorização armazenados.
export function createRecoveryRequest({ storage, key, send, lock, now = Date.now, notify = () => {} }) {
  let inFlight = false;
  let storageFailed = false;
  function read() {
    try {
      const value = storage.getItem(key);
      if (!value) return null;
      const record = JSON.parse(value);
      if (record?.version !== 1 || !['pending', 'sent', 'rate_limited', 'failed'].includes(record.phase)) throw Error();
      return record;
    } catch { storageFailed = true; return null; }
  }
  function write(record) {
    try { storage.setItem(key, JSON.stringify(record)); }
    catch { storageFailed = true; throw Error('local_storage_unavailable'); }
    notify();
  }
  function view() {
    const record = read();
    const waiting = Number.isFinite(record?.retryAt) && record.retryAt > now();
    return { phase: inFlight ? 'sending' : storageFailed ? 'storage_unavailable' : record?.phase || 'idle',
      blocked: inFlight || storageFailed || !!record, canRearm: !inFlight && !storageFailed && !!record && !waiting,
      retryAt: waiting ? record.retryAt : null };
  }
  async function exclusive(action) {
    // ifAvailable: nenhuma fila de envios é criada entre abas.
    if (typeof lock !== 'function') { storageFailed = true; notify(); return false; }
    return lock(action);
  }
  return {
    view,
    async request(email) {
      if (view().blocked) return false;
      inFlight = true; notify();
      try {
        return await exclusive(async () => {
          if (read() || storageFailed) return false;
          write({ version: 1, phase: 'pending' });
          try {
            await send(email);
            write({ version: 1, phase: 'sent' });
          } catch (error) {
            write({ version: 1, phase: error?.rateLimited === true ? 'rate_limited' : 'failed',
              ...(Number.isFinite(error?.retryAt) ? { retryAt: error.retryAt } : {}) });
          }
          return true;
        });
      } catch { return false; }
      finally { inFlight = false; notify(); }
    },
    async rearm() {
      if (!view().canRearm) return false;
      try {
        return await exclusive(async () => {
          if (!view().canRearm) return false;
          storage.removeItem(key);
          notify();
          return true;
        });
      } catch { storageFailed = true; notify(); return false; }
    },
  };
}
