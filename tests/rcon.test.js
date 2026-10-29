import test from 'node:test';
import assert from 'node:assert/strict';
import net from 'node:net';
import {randomUUID} from 'node:crypto';
import {rconPacket,readRconFrames,connectRcon,addItemCommand,onlineUsernames,rconConfig} from '../lib/rcon-client.js';
import {executeRemoteReward,planHash,publicPlan,sanitizeRconReply} from '../lib/remote-rewards.js';

test('RCON framing: split/coalesced packets, auth rejection, malicious framing and command allowlist',()=>{
 const packet=rconPacket(42,2,'players');assert.equal(readRconFrames(packet.subarray(0,8)).frames.length,0);
 const all=readRconFrames(Buffer.concat([packet,rconPacket(43,0,'ok')]));assert.equal(all.frames.length,2);assert.equal(all.rest.length,0);
 for(const size of [-1,0,9,65537]){const bad=Buffer.alloc(4);bad.writeInt32LE(size);assert.throws(()=>readRconFrames(bad));}
 const bad=Buffer.from(packet);bad[bad.length-1]=1;assert.throws(()=>readRconFrames(bad));assert.throws(()=>rconPacket(1,2,'x\0y'));
 assert.equal(addItemCommand('Synthetic User',{kind:'item',script_id:'Base.Hammer',quantity:1}),'additem "Synthetic User" "Base.Hammer" 1');
 for(const username of ['bad" user','x\nquit','x;quit','x\\y'])assert.throws(()=>addItemCommand(username,{kind:'item',script_id:'Base.Hammer',quantity:1}));
 for(const item of [{kind:'vehicle',script_id:'Base.Car',quantity:1},{kind:'item',script_id:'Base.Hammer;quit',quantity:1},{kind:'item',script_id:'Base.Hammer',quantity:101}])assert.throws(()=>addItemCommand('user',item));
 assert.deepEqual(onlineUsernames('Players connected (2):\n-Alice\n-Bob'),['Alice','Bob']);
 assert.deepEqual(onlineUsernames('Players connected (1): <LINE>-Alice'),['Alice']);
 for(const text of ['Alice','Players connected (2):\n-Alice','Players connected (1):\n-Alice\n-Alice'])assert.throws(()=>onlineUsernames(text));
 assert.equal(rconConfig({}),null);
 const safe=sanitizeRconReply('password=private-value token=secret-value sb_secret_example Bearer eyJabc.e30.signature MY-PRIVATE-PASSWORD',['MY-PRIVATE-PASSWORD']);
 for(const secret of ['private-value','secret-value','sb_secret_example','eyJabc.e30.signature','MY-PRIVATE-PASSWORD'])assert.ok(!safe.includes(secret));
 assert.equal(Array.from(sanitizeRconReply('😀'.repeat(3000))).length,2000);
});

test('RCON actual loopback TCP: authenticate, fragmented response, read-only presence and timeout without retry',async()=>{
 const commands=[];let serverSocket;
 const server=net.createServer(socket=>{serverSocket=socket;let buffer=Buffer.alloc(0);socket.on('data',bytes=>{
  buffer=Buffer.concat([buffer,bytes]);const parsed=readRconFrames(buffer);buffer=parsed.rest;
  for(const f of parsed.frames){if(f.type===3){socket.write(rconPacket(f.id,0,''));socket.write(rconPacket(f.text==='SYNTHETIC-PASSWORD'?f.id:-1,2,''));}
   else{commands.push(f.text);if(f.text==='players'){const response=rconPacket(f.id,0,'Players connected (0):');socket.write(response.subarray(0,7));socket.write(response.subarray(7));}}
  }
 });});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const config={host:'127.0.0.1',port:server.address().port,password:'SYNTHETIC-PASSWORD',timeout:120};
 try{
  const client=await connectRcon(config);assert.equal(await client.command('players'),'Players connected (0):');
  await assert.rejects(client.command('UNANSWERED-SYNTHETIC-COMMAND'));client.close();
  assert.deepEqual(commands,['players','UNANSWERED-SYNTHETIC-COMMAND']);
  await assert.rejects(connectRcon({...config,password:'WRONG-SYNTHETIC'}),error=>!error.message.includes('SYNTHETIC'));
 }finally{serverSocket?.destroy();await new Promise(resolve=>server.close(resolve));}
});

test('RCON executor: launch flag, exact recipient, durable claim, partial delivery and no automatic resends',async()=>{
 const makePlan=()=>({modality:'weekend',draw_id:randomUUID(),enabled:true,delivery_state:'pending',attempts:[],
  recipient:{account_id:randomUUID(),steam_id:'76561190000000001',display_name:'Synthetic',game_username:'Synthetic User'},
  reward:{items:[{kind:'item',script_id:'Base.Hammer',quantity:1},{kind:'item',script_id:'Base.Axe',quantity:1}]}});
 const env={WINX_RCON_HOST:'127.0.0.1',WINX_RCON_PORT:'12345',WINX_RCON_PASSWORD:'SYNTHETIC-PRIVATE',WINX_REMOTE_DELIVERY_ENABLED:'true'};
 for(const condition of ['disabled','offline','uncertain','partial','success','claim-rejected','ambiguous']){
  const plan=makePlan(),log=[],states=[];let commands=0;
  const rpc=async(name,args)=>{log.push(name);
   if(name==='get_remote_reward_plan_v3')return plan;
   if(name==='claim_remote_reward_v3'){if(condition==='claim-rejected')throw Error('Already claimed');return {...plan,claimed:true};}
   if(name==='finish_remote_reply_v3'){states.push(args.p_state);assert.ok(!JSON.stringify(args).includes('SYNTHETIC-PRIVATE'));return;}
   throw Error('Unexpected RPC');
  };
  const connect=async()=>({command:async text=>{
   log.push(text);if(text==='players'&&condition==='ambiguous')return 'Players connected (2):\n-Synthetic User\n-synthetic user';if(text==='players')return condition==='offline'?'Players connected (0):':'Players connected (1):\n-Synthetic User';
   commands++;assert.ok(log.indexOf('claim_remote_reward_v3')<log.indexOf(text));
   if(condition==='uncertain'||condition==='partial'&&commands===2)throw Error('Socket lost after write');
   const id=commands===1?'Base.Hammer':'Base.Axe';return `Item ${id} Added in Synthetic User's inventory.`;
  },close(){log.push('close');}});
  const options={rpc,modality:'weekend',drawId:plan.draw_id,requestId:randomUUID(),operatorId:randomUUID(),confirmation:planHash(plan),env:condition==='disabled'?{}:env,connect};
  if(['disabled','claim-rejected','ambiguous'].includes(condition)){await assert.rejects(executeRemoteReward(options));assert.equal(commands,0);}
  else{const result=await executeRemoteReward(options);if(condition==='offline'){assert.equal(result.sent,false);assert.equal(log.includes('claim_remote_reward_v3'),false);}else{
   assert.equal(result.confirmed,false);assert.deepEqual(states,condition==='uncertain'?['uncertain','uncertain']:condition==='partial'?['sent_unconfirmed','uncertain']:['sent_unconfirmed','sent_unconfirmed']);
   assert.equal(commands,condition==='uncertain'?1:2);
  }}
  assert.equal('steam_id' in publicPlan(plan,env).recipient,false);
 }
});
