import assert from 'node:assert/strict';
import test from 'node:test';
import { getConfig } from '../lib/config.js';
import { normalizeExternalStatus } from '../lib/server-status.js';

test('normaliza formatos comuns de API externa', () => {
  const config = getConfig({ SERVER_MAX_PLAYERS: '32' });
  const status = normalizeExternalStatus({
    data: {
      status: 'online',
      hostname: 'Winx PZ',
      players: { online: 12, max: 48 },
      map: 'Muldraugh',
    },
  }, config);
  assert.deepEqual(status, {
    online: true,
    name: 'Winx PZ',
    players: 12,
    maxPlayers: 48,
    map: 'Muldraugh',
    latencyMs: 0,
  });
});
