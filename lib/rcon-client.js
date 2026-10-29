import net from 'node:net';
import {randomInt} from 'node:crypto';

// Source RCON framing. One bounded request at a time, no reconnect or retry.
export function rconPacket(id,type,text){
 if(typeof text!=='string'||text.includes('\0')||Buffer.byteLength(text)>4096)throw Error('Invalid RCON payload');
 const body=Buffer.from(text,'utf8'),packet=Buffer.alloc(body.length+14);
 packet.writeInt32LE(body.length+10);packet.writeInt32LE(id,4);packet.writeInt32LE(type,8);body.copy(packet,12);return packet;
}
export function readRconFrames(buffer){
 const frames=[];let offset=0;
 while(buffer.length-offset>=4){
  const size=buffer.readInt32LE(offset);if(size<10||size>65536)throw Error('Invalid RCON frame');
  if(buffer.length-offset<size+4)break;
  const end=offset+size+4;if(buffer[end-1]!==0||buffer[end-2]!==0)throw Error('Invalid RCON terminator');
  frames.push({id:buffer.readInt32LE(offset+4),type:buffer.readInt32LE(offset+8),text:buffer.subarray(offset+12,end-2).toString('utf8')});offset=end;
 }return {frames,rest:buffer.subarray(offset)};
}
export function rconConfig(env=process.env){
 const host=env.WINX_RCON_HOST,port=Number(env.WINX_RCON_PORT),password=env.WINX_RCON_PASSWORD;
 if(!host||!Number.isInteger(port)||port<1||port>65535||!password)return null;
 return {host,port,password,timeout:1800};
}
export function connectRcon(config){
 return new Promise((resolve,reject)=>{
  const socket=net.createConnection({host:config.host,port:config.port});let buffer=Buffer.alloc(0),pending=null,authenticated=false,closed=false;
  let connectTimer;
  const fail=()=>{closed=true;clearTimeout(connectTimer);clearTimeout(pending?.timer);pending?.reject(Error('RCON response unavailable'));pending=null;socket.destroy();};
  // Socket inactivity alone does not bound DNS/connect. Include them in the deadline.
  connectTimer=setTimeout(fail,config.timeout??1800);
  socket.setTimeout(config.timeout??1800,fail);socket.on('error',fail);socket.on('end',fail);
  socket.on('data',bytes=>{try{
   buffer=Buffer.concat([buffer,bytes]);if(buffer.length>65540)throw Error();
   const parsed=readRconFrames(buffer);buffer=parsed.rest;
   for(const frame of parsed.frames){
    if(!pending)continue;
    if(frame.id===-1){fail();continue;}
    if(frame.id!==pending.id)throw Error('Unexpected RCON response');
    if(pending.type===3&&frame.type===0)continue;
    if(frame.type!==(pending.type===3?2:0))throw Error('Unexpected RCON type');
    // Large/multipart replies are not accepted as proof of a complete response.
    if(Buffer.byteLength(frame.text)>=4096)throw Error('Multipart response unverified');
    const task=pending;clearTimeout(task.timer);pending=null;task.resolve(frame.text);
   }
  }catch{fail();}});
  function request(type,text){return new Promise((ok,no)=>{
   if(closed||pending)return no(Error('RCON unavailable'));
   const id=randomInt(1,0x7fffffff);pending={id,type,resolve:ok,reject:no,timer:setTimeout(fail,config.timeout??1800)};socket.write(rconPacket(id,type,text));
  });}
  socket.once('connect',async()=>{try{await request(3,config.password);clearTimeout(connectTimer);authenticated=true;resolve({
   command(text){if(!authenticated||closed)throw Error('RCON unavailable');return request(2,text);},
   close(){authenticated=false;fail();}
  });}catch{fail();reject(Error('RCON authentication unavailable'));}});
  // Connection/auth failure before the public client exists must settle the caller too.
  socket.once('close',()=>{if(!authenticated)reject(Error('RCON connection unavailable'));});
 });
}
export function addItemCommand(username,item){
 if(!/^[A-Za-z0-9_ .-]{1,64}$/.test(username||'')||!/^Base\.[A-Za-z][\w]*$/.test(item?.script_id||'')
 ||item?.kind!=='item'||!Number.isSafeInteger(item.quantity)||item.quantity<1||item.quantity>100)throw Error('Invalid delivery component');
 return `additem "${username}" "${item.script_id}" ${item.quantity}`;
}
export function onlineUsernames(text){
 const lines=String(text).replaceAll(' <LINE>','\n').trim().split(/\r?\n/),header=lines.shift()?.match(/^Players connected \((\d+)\):$/);
 if(!header)throw Error('Player response not verified');
 const names=lines.filter(x=>x.trim()).map(line=>{if(!line.startsWith('-'))throw Error('Player response not verified');return line.slice(1).trim();});
 if(Number(header[1])!==names.length||new Set(names).size!==names.length||names.some(n=>!/^[A-Za-z0-9_ .-]{1,64}$/.test(n)))throw Error('Player response incomplete');
 return names;
}
