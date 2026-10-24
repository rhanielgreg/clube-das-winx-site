import assert from 'node:assert/strict';
import { generateKeyPairSync, sign } from 'node:crypto';
import test from 'node:test';
import { verifyDiscordSignature } from '../lib/discord.js';

test('aceita assinatura Ed25519 válida e rejeita corpo alterado', async () => {
  const { privateKey, publicKey } = generateKeyPairSync('ed25519');
  const timestamp = '1786051200';
  const body = '{"type":1}';
  const signature = sign(null, Buffer.from(timestamp + body), privateKey).toString('hex');
  const rawPublicKey = publicKey
    .export({ type: 'spki', format: 'der' })
    .subarray(-32)
    .toString('hex');

  assert.equal(await verifyDiscordSignature({ body, signature, timestamp, publicKey: rawPublicKey }), true);
  assert.equal(await verifyDiscordSignature({ body: '{"type":2}', signature, timestamp, publicKey: rawPublicKey }), false);
});
