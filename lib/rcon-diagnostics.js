import {connectRcon,rconConfig,onlineUsernames} from './rcon-client.js';
// Read-only diagnostic: never claims an award, writes SQL, or accepts commands.
export async function probeRcon({env=process.env,connect=connectRcon,accounts=[]}={}){
 const checked_at=new Date().toISOString(),config=rconConfig(env);
 if(!config)return {state:'not_configured',checked_at,delivery_verified:false,
  missing:['WINX_RCON_HOST','WINX_RCON_PORT','WINX_RCON_PASSWORD'].filter(k=>!env[k]),participants:[]};
 let client;
 try{
  client=await connect(config);const names=onlineUsernames(await client.command('players'));
  return {state:'connected',checked_at,delivery_verified:false,online_count:names.length,
   participants:accounts.map(a=>({id:a.id,presence:names.filter(n=>n.toLowerCase()===a.game_username.toLowerCase()).length>1?'ambiguous':
    names.includes(a.game_username)?'online':'offline'}))};
 }catch{return {state:'unavailable',checked_at,delivery_verified:false,participants:[]};}
 finally{client?.close();}
}
