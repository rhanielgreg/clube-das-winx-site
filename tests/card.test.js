import assert from 'node:assert/strict';
import test from 'node:test';
import sharp from 'sharp';
import { CARD_HEIGHT, CARD_WIDTH, renderStatusCard } from '../lib/card.js';

test('gera o card PNG no tamanho esperado', async () => {
  const image = await renderStatusCard({
    name: 'Clube das Winx | Project Zomboid',
    online: true,
    players: 7,
    maxPlayers: 32,
    ip: '169.155.127.74:9045',
    ddns: 'clubedaswinx.modded.fun:9045',
    steamUrl: 'steam://connect/169.155.127.74:9045',
    source: 'a2s',
    checkedAt: '2026-08-06T20:00:00.000Z',
  });
  const metadata = await sharp(image).metadata();
  assert.equal(metadata.format, 'png');
  assert.equal(metadata.width, CARD_WIDTH);
  assert.equal(metadata.height, CARD_HEIGHT);
  assert.ok(image.length < 4_500_000, 'o card deve caber no limite da Vercel');
});
