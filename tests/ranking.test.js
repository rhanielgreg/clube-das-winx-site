import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { callPublicRpc, isStale } from '../lib/supabase-public.js';

test('ranking permanece não configurado sem expor ou inventar dados', async () => {
  const result = await callPublicRpc('get_public_ranking', {}, { env: {} });
  assert.deepEqual(result, { configured: false, data: null });
});

test('detecta sincronização desatualizada', () => {
  assert.equal(isStale(new Date(Date.now() - 16 * 60_000).toISOString()), true);
  assert.equal(isStale(new Date().toISOString()), false);
  assert.equal(isStale(null), true);
});

test('portal contém rotas e destaque sazonal sem estatísticas fictícias', async () => {
  const [home, ranking, script] = await Promise.all([
    readFile(new URL('../public/index.html', import.meta.url), 'utf8'),
    readFile(new URL('../public/ranking.html', import.meta.url), 'utf8'),
    readFile(new URL('../public/site.js', import.meta.url), 'utf8'),
  ]);
  assert.match(home, /O SOBREVIVENTE SUPREMO/);
  assert.match(ranking, /TEMPORADAS ANTERIORES/);
  assert.match(script, /Nenhuma estatística validada/);
  assert.doesNotMatch(home + ranking, /\b(?:1234|9999)\s+kills\b/i);
});
