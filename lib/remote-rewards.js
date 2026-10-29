import {createHash} from 'node:crypto';
import {rconConfig,connectRcon,addItemCommand,onlineUsernames} from './rcon-client.js';
const hash=text=>createHash('sha256').update(text).digest('hex');
export function sanitizeRconReply(text,secrets=[]){
 let result=String(text).replace(/[\x00-\x1f\x7f]/g,' ');
 for(const secret of secrets.filter(Boolean))result=result.split(secret).join('[redacted]');
 result=result.replace(/\b(?:sb_secret_[A-Za-z0-9_-]+|gh[pousr]_[A-Za-z0-9]+|eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)\b/g,'[redacted]')
 .replace(/(?:password|senha|token|secret|api[_ -]?key)\s*[:=]\s*\S+/gi,'[redacted credential]');
 return Array.from(result).slice(0,2000).join('');
}
export function planHash(plan){return hash(JSON.stringify([plan.modality,plan.draw_id,plan.reward,plan.recipient,plan.delivery_state,plan.attempts]));}
export function publicPlan(plan,env=process.env){return {
 enabled:plan.enabled===true&&plan.reward?.items?.every(i=>i.kind==='item')&&env.WINX_REMOTE_DELIVERY_ENABLED==='true'&&Boolean(rconConfig(env)),
 plan_hash:planHash(plan),modality:plan.modality,draw_id:plan.draw_id,reward:plan.reward,
 recipient:{display_name:plan.recipient?.display_name,game_username:plan.recipient?.game_username},
 delivery_state:plan.delivery_state,attempts:plan.attempts,
 reason:plan.reward?.items?.some(i=>i.kind==='vehicle')?'Veículo exige geração presencial, chave, reparos e recibo auditado. Não há spawn por RCON.':plan.modality==='official'?'Entrega mensal remota bloqueada: identidade online da mesma vida ainda não comprovada.':
 plan.enabled===true?'Executor privado ainda não habilitado ou configurado.':'Entrega bloqueada: requisitos de identidade, integração ou aprovação pendentes.'
};}
export async function executeRemoteReward({rpc,modality,drawId,requestId,operatorId,confirmation,env=process.env,connect=connectRcon}){
 const plan=await rpc('get_remote_reward_plan_v3',{p_modality:modality,p_draw:drawId});
 if(!publicPlan(plan,env).enabled||confirmation!==planHash(plan))throw Error('Delivery disabled or confirmation outdated');
 const commands=plan.reward.items.map(item=>addItemCommand(plan.recipient.game_username,item));
 const client=await connect(rconConfig(env));
 try{
  const names=onlineUsernames(await client.command('players'));
  const target=plan.recipient.game_username;
  if(!names.includes(target))return {sent:false,reason:'offline'};
  // The game command may resolve names without case sensitivity. Refuse ambiguity.
  if(names.filter(n=>n.toLowerCase()===target.toLowerCase()).length!==1)throw Error('Ambiguous online recipient');
  // Atomic durable claim is committed BEFORE any command capable of changing the game.
  const claim=await rpc('claim_remote_reward_v3',{p_modality:modality,p_draw:drawId,p_attempt:requestId,p_operator:operatorId});
  if(claim.claimed!==true||planHash(claim)!==confirmation)throw Error('Claim does not match confirmed plan');
  let halted=false;
  for(let component=0;component<commands.length;component++){
   let response='',state='uncertain';
   if(!halted){try{
    response=await client.command(commands[component]);
    const item=plan.reward.items[component];
    // A server acknowledgment is NOT an inventory/receipt proof.
    if(response===`Item ${item.script_id} Added in ${plan.recipient.game_username}'s inventory.`)state='sent_unconfirmed';
    else halted=true;
   }catch{halted=true;response='transport_uncertain';}}
   else response='not_sent_after_uncertain_component';
   const safeResponse=sanitizeRconReply(response,[env.WINX_RCON_PASSWORD]);
   await rpc('finish_remote_reply_v3',{p_modality:modality,p_draw:drawId,p_attempt:requestId,p_component:component,
    p_state:state,p_hash:hash(safeResponse),p_bytes:Buffer.byteLength(response),p_operator:operatorId,p_response:safeResponse});
  }
  return {sent:true,confirmed:false,reason:halted?'uncertain':'sent_unconfirmed'};
 }finally{client.close();}
}
