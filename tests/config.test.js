import assert from 'node:assert/strict';
import test from 'node:test';
import { getConfig, resolvePublicBaseUrl } from '../lib/config.js';

test('usa os dados padrão do servidor', () => {
  const config = getConfig({});
  assert.equal(config.host, '169.155.127.74');
  assert.equal(config.port, 9045);
  assert.equal(config.ddns, 'clubedaswinx.modded.fun:9045');
  assert.equal(config.steamUrl, 'steam://connect/169.155.127.74:9045');
});

test('prioriza PUBLIC_BASE_URL', () => {
  assert.equal(
    resolvePublicBaseUrl('https://preview.vercel.app/api/interactions', { PUBLIC_BASE_URL: 'https://winx.example/' }),
    'https://winx.example',
  );
});
