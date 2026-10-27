import {readFile,writeFile} from 'node:fs/promises';
import {rewardCatalog} from '../lib/reward-catalog.js';
import {validateRewardCatalog} from '../lib/reward-draw.js';
validateRewardCatalog(rewardCatalog);
const target=new URL('../migrations/016_season_rewards.sql',import.meta.url),source=await readFile(target,'utf8');
const begin='-- REWARD_CATALOG_BEGIN',end='-- REWARD_CATALOG_END';
const sql=`${begin}\ninsert into public.reward_catalogs_v1(version,definition,active) values('${rewardCatalog.version}',$catalog$${JSON.stringify(rewardCatalog)}$catalog$::jsonb,true) on conflict(version) do nothing;\n${end}`;
const next=source.includes(begin)?source.replace(new RegExp(begin+'[\\s\\S]*?'+end),()=>sql):source.replace("notify pgrst,'reload schema';",sql+"\nnotify pgrst,'reload schema';");
if(process.argv.includes('--check')){if(next.replaceAll('\r\n','\n')!==source.replaceAll('\r\n','\n'))throw Error('Reward catalog SQL differs from validated source.');console.log('Catálogo de premiações sincronizado: 5 raridades, 6 recompensas, 7 componentes.');}
else if(process.argv.includes('--write'))await writeFile(target,next);else throw Error('Use --check or --write.');
