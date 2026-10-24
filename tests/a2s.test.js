import assert from 'node:assert/strict';
import test from 'node:test';
import { parseA2SInfo } from '../lib/a2s.js';

const cstring = (value) => Buffer.concat([Buffer.from(value, 'utf8'), Buffer.from([0])]);

test('interpreta uma resposta A2S_INFO', () => {
  const fixed = Buffer.alloc(11);
  fixed.writeUInt16LE(108600 & 0xffff, 0); // app id no campo uint16 do protocolo
  fixed[2] = 7;
  fixed[3] = 32;
  fixed[4] = 0;
  fixed[5] = 'd'.charCodeAt(0);
  fixed[6] = 'l'.charCodeAt(0);
  fixed[7] = 0;
  fixed[8] = 1;

  const packet = Buffer.concat([
    Buffer.from([0xff, 0xff, 0xff, 0xff, 0x49, 0x11]),
    cstring('Clube das Winx'),
    cstring('Muldraugh, KY'),
    cstring('zomboid'),
    cstring('Project Zomboid'),
    fixed.subarray(0, 9),
    cstring('42.0.2'),
  ]);
  const status = parseA2SInfo(packet);
  assert.equal(status.name, 'Clube das Winx');
  assert.equal(status.map, 'Muldraugh, KY');
  assert.equal(status.players, 7);
  assert.equal(status.maxPlayers, 32);
  assert.equal(status.vacEnabled, true);
});
