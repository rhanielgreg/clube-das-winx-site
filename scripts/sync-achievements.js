import { readFile,writeFile } from 'node:fs/promises';
import { achievementCatalog } from '../public/achievements-catalog.js';
const path=new URL('../migrations/004_life_achievements.sql',import.meta.url);
const start='-- BEGIN GENERATED CATALOG';const end='-- END GENERATED CATALOG';
const seed=`${start}\ndo $seed$\ndeclare catalog jsonb:=$catalog$${JSON.stringify(achievementCatalog)}$catalog$::jsonb;\nbegin\n if jsonb_array_length(catalog)<>100 then raise exception '100 definitions required'; end if;\n if exists(select 1 from jsonb_array_elements(catalog) item join public.achievement_definitions d on d.id=item->>'id' where d.definition is distinct from item) then raise exception 'immutable catalog version conflict'; end if;\n insert into public.achievement_definitions(id,definition) select item->>'id',item from jsonb_array_elements(catalog) item on conflict(id) do nothing;\n if (select count(*) from public.achievement_definitions)<>100 then raise exception 'unexpected catalog entries'; end if;\nend; $seed$;\n${end}`;
let source=await readFile(path,'utf8');
const a=source.indexOf(start),b=source.indexOf(end);
const updated=a<0?source.replace("notify pgrst,'reload schema';",seed+"\nnotify pgrst,'reload schema';"):source.slice(0,a)+seed+source.slice(b+end.length);
if(process.argv.includes('--check')) {if(source!==updated)throw new Error('SQL catalog differs from source');console.log('100 definições sincronizadas.');}
else {await writeFile(path,updated);console.log('Catálogo SQL sincronizado.');}
