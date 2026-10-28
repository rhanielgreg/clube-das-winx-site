import {normalizedAngle,stopRotation} from './roulette-model.js';
export const SPIN_DURATION=9500;
// The same lifecycle binding is exercised with isolated EventTargets in tests.
export function bindSpinLifecycle({document,window,signal,cancel}){
 document.addEventListener('visibilitychange',()=>{if(document.hidden)cancel('visibility');},{signal});
 window.addEventListener('pagehide',()=>cancel('pagehide'),{signal});
 window.addEventListener('beforeunload',()=>cancel('unload'),{signal});
}
// A cancelable visual transaction. The adapter has no transport capability.
export function createSpinSession({animate,onStart=()=>{},onFinish=()=>{},onCancel=()=>{},onError=()=>{}}){
 let epoch=0,running=false,angle=0,control=null;
 return {
  get running(){return running;},get angle(){return angle;},get epoch(){return epoch;},
  cancel(reason='interrupted'){
   epoch++;control?.abort();control=null;running=false;angle=0;onCancel(reason);
  },
  async play(result,{source='demo',reduced=false}={}){
   if(running)return false;
   if(!['demo','official'].includes(source)||!result?.rarity)throw Error('Resultado visual inválido.');
   const from=angle,to=stopRotation(result.rarity,from),ticket=++epoch;
   const signal=(control=new AbortController()).signal;running=true;
   try{
    onStart(result,source);
    if(!reduced)await animate({from,to,duration:SPIN_DURATION,signal});
    if(signal.aborted||ticket!==epoch)return false;
    angle=normalizedAngle(to);running=false;control=null;onFinish(result,source,angle);return true;
   }catch(error){
    if(ticket!==epoch||signal.aborted)return false;
    running=false;control=null;angle=0;onError(error);return false;
   }
  },
 };
}
