import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { createPasswordRecovery, requestPasswordRecovery, RECOVERY_INVALID, recoveryMessage } from '../public/password-recovery.js';

const origin = 'https://fixture.supabase.co';
const at = Date.parse('2026-10-27T12:00:00Z');
const user = { id: 'user-fixture' };
function session(overrides = {}) {
  const claims = { iss: origin + '/auth/v1', sub: user.id, session_id: 'recovery-session',
    exp: at / 1000 + 3600, amr: [{ method: 'otp', timestamp: at / 1000 }], ...overrides };
  return { access_token: 'e30.' + Buffer.from(JSON.stringify(claims)).toString('base64url') + '.fixture',
    refresh_token: 'refresh-fixture', user };
}
function fixture(overrides = {}) {
  let current = session();
  const calls = { update: 0, set: 0, signOut: 0, user: 0 };
  const auth = {
    setSession: async tokens => { calls.set++; current = { ...current, ...tokens }; return { data: { session: current } }; },
    getUser: async token => { calls.user++; assert.ok(token); return { data: { user } }; },
    getSession: async () => ({ data: { session: current } }),
    updateUser: async payload => { calls.update++; assert.deepEqual(payload, { password: 'New-password-fixture!' }); return { data: { user } }; },
    signOut: async options => { calls.signOut++; assert.deepEqual(options, { scope: 'local' }); return {}; },
    ...overrides,
  };
  const recovery = createPasswordRecovery({ auth, supabaseUrl: origin, now: () => at });
  return { auth, calls, recovery, changeSession: value => { current = value; } };
}
const callback = value => ({ kind: 'tokens', type: 'recovery', access_token: value.access_token, refresh_token: value.refresh_token });

test('retorno implícito validado autoriza uma única troca; depois exige login novamente', async () => {
  const f = fixture();
  const incoming = callback(session());
  assert.equal((await f.recovery.consumeReturn(incoming)).kind, 'recovery');
  assert.equal(incoming.access_token, undefined);
  assert.equal(incoming.refresh_token, undefined);
  assert.equal(f.recovery.state, 'ready');
  assert.deepEqual(await f.recovery.save('New-password-fixture!', 'New-password-fixture!'), { signedOut: true });
  assert.equal(f.calls.update, 1); assert.equal(f.calls.signOut, 1);
  assert.equal(f.recovery.state, 'complete');
  await assert.rejects(f.recovery.save('New-password-fixture!', 'New-password-fixture!'), { message: RECOVERY_INVALID });
});

test('sessão existente, INITIAL_SESSION e SIGNED_IN não habilitam recuperação', async () => {
  const f = fixture();
  assert.equal((await f.recovery.consumeReturn(null)).kind, 'none');
  for (const event of ['INITIAL_SESSION', 'SIGNED_IN', 'TOKEN_REFRESHED', 'USER_UPDATED'])
    assert.equal(await f.recovery.handleAuthEvent(event, session()), null);
  await assert.rejects(f.recovery.save('New-password-fixture!', 'New-password-fixture!'), { message: RECOVERY_INVALID });
  assert.equal(f.calls.update, 0);
});

test('PASSWORD_RECOVERY exige usuário validado pelo Auth, expiração e contexto de OTP/recovery', async () => {
  for (const value of [null, session({ amr: [{ method: 'password' }] }), session({ exp: at / 1000 - 1 }), session({ iss: 'https://wrong.invalid/auth/v1' })]) {
    const f = fixture();
    await assert.rejects(f.recovery.handleAuthEvent('PASSWORD_RECOVERY', value), { message: RECOVERY_INVALID });
    assert.equal(f.calls.update, 0);
  }
  const rejected = fixture({ getUser: async () => ({ error: { message: 'private auth error' } }) });
  await assert.rejects(rejected.recovery.handleAuthEvent('PASSWORD_RECOVERY', session()), { message: RECOVERY_INVALID });
  const valid = fixture();
  await valid.recovery.handleAuthEvent('PASSWORD_RECOVERY', session());
  assert.equal(valid.recovery.state, 'ready');
});

test('link expirado/incompleto e erro OAuth não renovam tokens nem usam sessão anterior como fallback', async () => {
  for (const value of [callback(session({ exp: at / 1000 - 1 })), callback(session({ exp: null })),
    callback(session({ iss: 'https://wrong.invalid/auth/v1' })), { kind: 'tokens', type: 'recovery' }, { kind: 'error' }]) {
    const f = fixture();
    await assert.rejects(f.recovery.consumeReturn(value), { message: RECOVERY_INVALID });
    assert.equal(f.calls.set, 0); assert.equal(f.calls.update, 0);
    assert.equal(f.recovery.state, 'invalid');
  }
});

test('PKCE só é recuperação com marcador do verifier do SDK; code comum não basta', async () => {
  for (const redirectType of ['PASSWORD_RECOVERY', 'recovery']) {
    const f = fixture({ exchangeCodeForSession: async code => {
      assert.equal(code, 'code-fixture'); return { data: { session: session(), redirectType } };
    } });
    assert.equal((await f.recovery.consumeReturn({ kind: 'code', code: 'code-fixture' })).kind, 'recovery');
  }
  const normal = fixture({ exchangeCodeForSession: async () => ({ data: { session: session({ amr: [{ method: 'password' }] }), redirectType: null } }) });
  assert.equal((await normal.recovery.consumeReturn({ kind: 'code', code: 'code-fixture' })).kind, 'login');
  await assert.rejects(normal.recovery.save('New-password-fixture!', 'New-password-fixture!'));
  await assert.rejects(normal.recovery.consumeReturn({ kind: 'code', type: 'recovery', code: 'code-fixture' }));
  const missingVerifier = fixture({ exchangeCodeForSession: async () => ({ error: { message: 'private verifier details' } }) });
  await assert.rejects(missingVerifier.recovery.consumeReturn({ kind: 'code', code: 'code-fixture' }), { message: RECOVERY_INVALID });
});

test('template token_hash só usa verifyOtp recovery e não outra modalidade', async () => {
  const f = fixture({ verifyOtp: async input => {
    assert.deepEqual(input, { token_hash: 'hash-fixture', type: 'recovery' }); return { data: { session: session() } };
  } });
  await f.recovery.consumeReturn({ kind: 'otp', type: 'recovery', token_hash: 'hash-fixture' });
  assert.equal(f.recovery.state, 'ready');
  await assert.rejects(f.recovery.consumeReturn({ kind: 'otp', type: 'invite', token_hash: 'hash-fixture' }));
});

test('senha curta/divergente e política Supabase não executam troca indevida; senha fraca permite corrigir', async () => {
  const f = fixture();
  await f.recovery.consumeReturn(callback(session()));
  await assert.rejects(f.recovery.save('short', 'short'), /8 caracteres/);
  await assert.rejects(f.recovery.save('New-password-fixture!', 'different'), /confirmação/);
  assert.equal(f.calls.update, 0); assert.equal(f.recovery.state, 'ready');
  const weak = fixture({ updateUser: async () => ({ error: { code: 'weak_password', message: 'private policy details' } }) });
  await weak.recovery.consumeReturn(callback(session()));
  await assert.rejects(weak.recovery.save('New-password-fixture!', 'New-password-fixture!'), /política de segurança/);
  assert.equal(weak.recovery.state, 'ready');
  assert.match(recoveryMessage({ code: 'same_password' }, 'password'), /diferente/);
});

test('troca de usuário/sessão, revogação e logout invalidam a autorização antes de updateUser', async () => {
  for (const other of [session({ session_id: 'different-session' }), session({ exp: at / 1000 - 1 }), session({ sub: 'different-user' })]) {
    const f = fixture();
    await f.recovery.consumeReturn(callback(session()));
    f.changeSession(other);
    await assert.rejects(f.recovery.save('New-password-fixture!', 'New-password-fixture!'));
    assert.equal(f.calls.update, 0); assert.equal(f.recovery.state, 'invalid');
  }
  const f = fixture();
  await f.recovery.consumeReturn(callback(session()));
  await f.recovery.handleAuthEvent('SIGNED_OUT', null);
  await assert.rejects(f.recovery.save('New-password-fixture!', 'New-password-fixture!'));
  assert.equal(f.calls.update, 0);
});

test('envio duplicado não duplica update; erro de logout após sucesso não oferece nova troca', async () => {
  let finish;
  let updates = 0;
  const f = fixture({ updateUser: () => { updates++; return new Promise(resolve => { finish = resolve; }); }, signOut: async () => ({ error: { message: 'private logout error' } }) });
  await f.recovery.consumeReturn(callback(session()));
  const saving = f.recovery.save('New-password-fixture!', 'New-password-fixture!');
  await assert.rejects(f.recovery.save('New-password-fixture!', 'New-password-fixture!'));
  await new Promise(resolve => setImmediate(resolve));
  finish({ data: { user } });
  assert.deepEqual(await saving, { signedOut: false });
  assert.equal(updates, 1); assert.equal(f.recovery.state, 'complete');
});

test('erro inesperado não exibe mensagens internas, tokens ou senha', async () => {
  const f = fixture({ updateUser: async () => { throw new Error('sensitive-fixture-token'); } });
  await f.recovery.consumeReturn(callback(session()));
  await assert.rejects(f.recovery.save('New-password-fixture!', 'New-password-fixture!'), { message: RECOVERY_INVALID });
  assert.equal(f.recovery.state, 'invalid');
});

test('solicitação usa redirect fixo /admin, não cria conta e trata rate limit sem detalhes privados', async () => {
  await requestPasswordRecovery({ resetPasswordForEmail: async (email, options) => {
    assert.equal(email, 'admin@example.invalid');
    assert.deepEqual(options, { redirectTo: 'https://clubedaswinx-delta.vercel.app/admin' }); return {};
  } }, 'admin@example.invalid', 'https://clubedaswinx-delta.vercel.app');
  await assert.rejects(requestPasswordRecovery({ resetPasswordForEmail: async () => ({ error: { status: 429, message: 'private' } }) }, 'admin@example.invalid', origin), /Limite de tentativas/);
});

const returnScript = await readFile(new URL('../public/auth-return.js', import.meta.url), 'utf8');
function landing(href) {
  const calls = [];
  const window = { location: { href, replace: value => calls.push(['navigate', value]) },
    history: { replaceState: (state, title, value) => calls.push(['clean', value]) } };
  vm.runInNewContext(returnScript, { window, URL, URLSearchParams });
  return { window, calls };
}

test('entrada limpa tokens/códigos/erros antes do SDK, entrega em memória uma vez e preserva navegação comum', () => {
  const f = landing('https://clubedaswinx-delta.vercel.app/admin#type=recovery&access_token=fixture&refresh_token=fixture');
  assert.deepEqual(f.calls, [['clean', '/admin']]);
  assert.equal(f.window.takeAdminAuthReturn().kind, 'tokens');
  assert.equal(f.window.takeAdminAuthReturn(), null);
  const code = landing('https://clubedaswinx-delta.vercel.app/admin?code=fixture&filter=keep');
  assert.deepEqual(code.calls, [['clean', '/admin?filter=keep']]);
  const error = landing('https://clubedaswinx-delta.vercel.app/admin#error=access_denied&error_description=secret-fixture');
  assert.equal(error.window.takeAdminAuthReturn().kind, 'error');
  assert.deepEqual(error.calls, [['clean', '/admin']]);
  assert.deepEqual(landing('https://clubedaswinx-delta.vercel.app/#servidor').calls, []);
});

test('Home encaminha retorno para /admin na mesma origem; duplicatas e formatos misturados são recusados', () => {
  const f = landing('https://clubedaswinx-delta.vercel.app/#type=recovery&access_token=fixture&refresh_token=fixture');
  assert.equal(f.calls[0][0], 'clean');
  assert.equal(f.calls[1][1], '/admin#type=recovery&access_token=fixture&refresh_token=fixture');
  for (const url of ['/admin?code=one#code=two', '/admin?code=one#access_token=two', '/admin#type=recovery&type=magiclink'])
    assert.equal(landing('https://clubedaswinx-delta.vercel.app' + url).window.takeAdminAuthReturn().kind, 'error');
});
