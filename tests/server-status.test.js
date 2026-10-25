import assert from 'node:assert/strict';
import test from 'node:test';
import { getConfig } from '../lib/config.js';
import { normalizeExternalStatus, getServerStatus, clearStatusCache } from '../lib/server-status.js';
import { parseA2SPlayers } from '../lib/a2s.js';

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
    latencyMs: null,
  });
});

test('estado ausente, contagem ausente e manutenção não viram offline ou zero',()=>{
  const missing=normalizeExternalStatus({status:'maintenance',players:true},getConfig({}));
  assert.equal(missing.online,null);assert.equal(missing.players,null);assert.equal(missing.maxPlayers,null);
  assert.equal(normalizeExternalStatus({online:false,players:0},getConfig({})).online,false);
});
test('A2S_PLAYER rejeita truncamentos, pacotes fragmentados e duração inválida',()=>{
  const packet=Buffer.concat([Buffer.from([255,255,255,255,0x44,1,0]),Buffer.from('Jogador\0'),Buffer.alloc(8)]);
  packet.writeInt32LE(5,packet.length-8); packet.writeFloatLE(12,packet.length-4);
  assert.deepEqual(parseA2SPlayers(packet),[{name:'Jogador',score:5,durationSec:12}]);
  for(let n=0;n<packet.length;n++) assert.throws(()=>parseA2SPlayers(packet.subarray(0,n)));
  const split=Buffer.from(packet);split.writeInt32LE(-2);assert.throws(()=>parseA2SPlayers(split));
  packet.writeFloatLE(NaN,packet.length-4);assert.throws(()=>parseA2SPlayers(packet));
});
test('A2S_INFO pode confirmar quantidade sem lista; falha total é desconhecida e guarda última informação válida',async()=>{
  clearStatusCache();
  const env={STATUS_PROVIDER:'a2s'};
  const status=await getServerStatus({env,force:true,dependencies:{queryInfo:async()=>({players:2,maxPlayers:32,latencyMs:10}),queryPlayers:async()=>[{name:'Um'}]}});
  assert.equal(status.online,true);assert.equal(status.players,2);assert.equal(status.playerListVerified,false);assert.deepEqual(status.playerList,[]);
  const failed=await getServerStatus({env,force:true,dependencies:{queryInfo:async()=>{throw new Error('timeout sintético');},queryPlayers:async()=>[]}});
  assert.equal(failed.online,null);assert.equal(failed.players,null);assert.equal(failed.lastValidAt,status.lastValidAt);
  clearStatusCache();
  const names=await getServerStatus({env,force:true,dependencies:{queryInfo:async()=>({players:1,maxPlayers:32}),queryPlayers:async()=>[{name:'Confirmado'}]}});
  assert.equal(names.playerListVerified,true);assert.equal(names.playerList[0].name,'Confirmado');
  clearStatusCache();
});
