import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp,rm } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { createRequire } from 'node:module';
const require=createRequire(import.meta.url);
test('override Zod 4.6.7 mantém leitura/escrita e validação do consumidor Vercel',async()=>{
 const config=require('@vercel/cli-config');
 const dir=await mkdtemp(path.join(os.tmpdir(),'winx-cli-fixture-'));
 try {
  const file=path.join(dir,'config.json');
  const input={currentTeam:'team_synthetic',credStorage:'file',telemetry:{enabled:false}};
  config.writeGlobalConfigFile(file,input);
  assert.deepEqual(config.readGlobalConfigFile(file),input);
  assert.throws(()=>config.writeGlobalConfigFile(file,{credStorage:'unrecognized'}));
  assert.equal(typeof (await import('@vercel/functions')).waitUntil,'function');
 } finally {
  // Apenas diretório temporário exato criado por este teste; não lê auth real.
  assert.ok(path.resolve(dir).startsWith(path.resolve(os.tmpdir())+path.sep));
  await rm(dir,{recursive:true});
 }
});
