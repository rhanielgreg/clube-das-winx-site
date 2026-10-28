// Reads detached, private source copies; no server connection or game command.
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {rewardCatalog} from '../lib/reward-catalog.js';
const [weaponPath,containerPath,logPath]=process.argv.slice(2);
if(!weaponPath||!containerPath||!logPath)throw Error('Informe as três cópias locais protegidas: weapon, container e server-console.');
const [weapon,container,log]=await Promise.all([weaponPath,containerPath,logPath].map(p=>readFile(p,'utf8')));
for(const reward of rewardCatalog.rewards){
 if(!log.includes('version='+reward.server_build+' '))throw Error('Build não comprovada no log.');
 const source=reward.items.every(item=>item.script_id.startsWith('Base.Bag_'))?container:weapon;
 if(createHash('sha256').update(source).digest('hex')!==reward.evidence_sha256||!/^\s*module\s+Base\b/m.test(source))throw Error('Fonte não corresponde à evidência registrada.');
 for(const item of reward.items){const name=item.script_id.split('.')[1];if(!new RegExp('\\bitem\\s+'+name+'\\s*\\{').test(source))throw Error('ID não comprovado no script instalado.');}
}
console.log(`Build42.21.0: ${rewardCatalog.rewards.length} recompensas, ${new Set(rewardCatalog.rewards.flatMap(r=>r.items.map(i=>i.script_id))).size} IDs comprovados nas cópias instaladas. Entrega física não executada neste teste.`);
