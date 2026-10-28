import {readFile,writeFile} from 'node:fs/promises';
import {rewardCatalog} from '../lib/reward-catalog.js';
import {rewardCatalog as originalCatalog} from '../lib/reward-catalog-v1.js';
import {validateRewardCatalog} from '../lib/reward-draw.js';
validateRewardCatalog(rewardCatalog);
const original=await readFile(new URL('../migrations/016_season_rewards.sql',import.meta.url),'utf8');
if(!original.includes(`$catalog$${JSON.stringify(originalCatalog)}$catalog$`))throw Error('Historical catalog differs; never rewrite migration016.');
const target=new URL('../migrations/019_reward_catalog_v2.sql',import.meta.url),source=await readFile(target,'utf8');
const begin='-- REWARD_CATALOG_BEGIN',end='-- REWARD_CATALOG_END';
const definition=`$catalog$${JSON.stringify(rewardCatalog)}$catalog$::jsonb`;
const sql=`${begin}\ninsert into public.reward_catalogs_v1(version,definition,active) values('${rewardCatalog.version}',${definition},false) on conflict(version) do nothing;\ndo $validate_catalog$ begin\n if (select definition from public.reward_catalogs_v1 where version='${rewardCatalog.version}') is distinct from ${definition} then\n  raise exception 'Existing version differs from reviewed catalog; transition refused';\n end if;\nend $validate_catalog$;\n${end}`;
const next=source.includes(begin)?source.replace(new RegExp(begin+'[\\s\\S]*?'+end),()=>sql):source.replace("notify pgrst,'reload schema';",sql+"\nnotify pgrst,'reload schema';");
if(process.argv.includes('--check')){if(next.replaceAll('\r\n','\n')!==source.replaceAll('\r\n','\n'))throw Error('Reward catalog SQL differs from validated source.');console.log('Catálogos v1 histórico e v2 sincronizados: 5 raridades, 24 recompensas atuais.');}
else if(process.argv.includes('--write')){
 if(source.includes('insert into public.reward_catalogs_v1')&&next.replaceAll('\r\n','\n')!==source.replaceAll('\r\n','\n'))
  throw Error('Existing migration is immutable. Create a new version and additive migration; never rewrite019.');
 if(next!==source)await writeFile(target,next);
}else throw Error('Use --check or --write.');
