// Read-only game source -> a small, explicit allowlist of roulette item icons.
// Does not start the game, edit its files, contact services or change the catalog.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import sharp from 'sharp';
import {rewardCatalog} from '../lib/reward-catalog.js';

const hash=value=>createHash('sha256').update(value).digest('hex');
const labels={Crowbar:'Pé de cabra',Hammer:'Martelo',Screwdriver:'Chave de fenda',Wrench:'Chave inglesa',PipeWrench:'Chave de grifo',HandShovel:'Pá de mão',Bag_ALICEpack_Army:'Mochila militar',Bag_ALICEpack:'Mochila ALICE',Bag_SurvivorBag:'Bolsa de sobrevivente',Bag_BigHikingBag:'Mochila grande de trilha',Bag_NormalHikingBag:'Mochila de trilha',Bag_DuffelBag:'Bolsa de viagem',Axe:'Machado de bombeiro',GardenFork:'Forcado',HandAxe:'Machadinha',HuntingKnife:'Faca de caça',BallPeenHammer:'Martelo de bola',ClubHammer:'Marreta curta',Machete:'Facão',WoodAxe:'Machado de lenhador',Shotgun:'Espingarda',VarmintRifle:'Rifle de caça',Katana:'Katana'};
const ids=[...new Set(rewardCatalog.rewards.flatMap(r=>r.items.map(i=>i.script_id)))].sort();
const argument=name=>process.argv.find(a=>a.startsWith(`--${name}=`))?.slice(name.length+3);
const gameRoot=argument('game-dir');if(!gameRoot)throw Error('Provide --game-dir= with your licensed Steam installation. Default is audit only; --write exports allowlisted PNGs.');
const jar=path.join(gameRoot,'projectzomboid.jar');
const description=execFileSync('javap',['-classpath',jar,'-constants','-c','-private','zombie.core.Core'],{encoding:'utf8',maxBuffer:8*1024*1024});
const init=description.slice(description.indexOf('static {};'));
const version=init.match(/bipush\s+(\d+)[\s\S]*?bipush\s+(\d+)/);
const patch=description.match(/buildVersion = (\d+);/);
if(!version||!patch)throw Error('Cannot independently establish the installed game version.');
const build=`${version[1]}.${version[2]}.${patch[1]}`;
if(rewardCatalog.rewards.some(r=>r.server_build!==build))throw Error(`Installed build ${build} differs from the verified catalog. No export.`);
const loader=execFileSync('javap',['-classpath',jar,'-c','-private','zombie.fileSystem.TexturePackDevice'],{encoding:'utf8',maxBuffer:4*1024*1024});
if(!/readPage:[\s\S]*?Field submap:[\s\S]*?java\/util\/HashMap.put:/.test(loader))throw Error('Cannot verify the game loader last-page-wins rule.');
const definitions={};
for(const name of ['container','weapon']){
 const file=`media/scripts/generated/items/${name}.txt`,bytes=await readFile(path.join(gameRoot,file)),text=bytes.toString('utf8');
 if(!/module\s+Base\b/.test(text))throw Error('Unexpected item module.');
 for(const id of ids){
  const short=id.slice(5),match=text.match(new RegExp(`\\bitem\\s+${short}\\s*\\{([\\s\\S]*?)\\n    \\}`));if(!match)continue;
  if(definitions[id])throw Error(`Ambiguous definition ${id}`);
  const fields=Object.fromEntries([...match[1].matchAll(/^\s*(Icon|IconsForTexture)\s*=\s*([^,\r\n]+)/gm)].map(m=>[m[1],m[2].trim()]));
  const variants=[...new Set((fields.IconsForTexture||fields.Icon||'').split(';').filter(Boolean))];
  const icon=fields.Icon||variants[0];if(!icon)throw Error(`No source icon ${id}`);
  definitions[id]={script_file:file,script_line:text.slice(0,match.index).split('\n').length,script_sha256:hash(bytes),definition_sha256:hash(match[0]),icon,variants,label:labels[short]};
 }
}
if(ids.some(id=>!definitions[id]?.label))throw Error('Incomplete exact-ID definitions or presentation labels.');
const wanted=new Set(Object.values(definitions).map(d=>'Item_'+d.icon));
const signature=Buffer.from('89504e470d0a1a0a','hex');
function readPack(bytes,name){
 let offset=0;
 const int=()=>{if(offset+4>bytes.length)throw Error('Truncated pack');const n=bytes.readInt32LE(offset);offset+=4;return n;};
 const string=()=>{const size=int();if(size<1||size>10000||offset+size>bytes.length)throw Error('Invalid texture name');const value=bytes.toString('utf8',offset,offset+size);offset+=size;return value;};
 const modern=bytes.subarray(0,4).toString()==='PZPK';
 if(modern){offset=4;if(int()!==1)throw Error('Unknown PZPK version.');}
 const count=int(),selected=new Map();if(count<1||count>10000)throw Error('Invalid page count.');
 for(let page=0;page<count;page++){
  const pageName=string(),entries=int();int();const found=[];
  if(entries<0||entries>100000)throw Error('Invalid atlas entry count.');
  for(let i=0;i<entries;i++){const key=string(),rect=Array.from({length:8},int);if(wanted.has(key))found.push({key,rect});}
  const start=modern?offset+4:offset;let end;
  if(modern){const size=int();if(size<8||offset+size>bytes.length)throw Error('Invalid PNG size.');end=offset+size;}
  else{
   let cursor=start+8;
   do{if(cursor+12>bytes.length)throw Error('Truncated PNG');const size=bytes.readUInt32BE(cursor),type=bytes.toString('ascii',cursor+4,cursor+8);cursor+=size+12;if(type==='IEND')break;}while(true);
   end=cursor;
  }
  if(!bytes.subarray(start,start+8).equals(signature))throw Error('Atlas boundary is not a PNG.');
  const png=bytes.subarray(start,end);offset=end;
  if(!modern){if(bytes.readUInt32LE(offset)!==0xdeadbeef)throw Error('Missing legacy PNG terminator.');offset+=4;}
  for(const entry of found){const value={...entry,png,page:pageName,pack:name,pack_sha256:hash(bytes),duplicates:[]};const previous=selected.get(entry.key);if(previous)value.duplicates=[...previous.duplicates,{...previous,duplicates:[]}];selected.set(entry.key,value);}
 }
 if(offset!==bytes.length)throw Error('Unexpected trailing pack bytes.');
 return selected;
}
const sprites=new Map(),backupSprites=new Map();
for(const name of ['UI.pack','UI2.pack']){
 const bytes=await readFile(path.join(gameRoot,'media/texturepacks',name));
 for(const [key,value] of readPack(bytes,name)){if(sprites.has(key))throw Error(`Cross-pack precedence requires review: ${key}`);sprites.set(key,value);}
}
try{for(const [key,value] of readPack(await readFile(path.join(gameRoot,'media/texturepacks/UI2.pack.backup')),'UI2.pack.backup'))backupSprites.set(key,value);}catch(error){if(error.code!=='ENOENT')throw error;}
async function iconPng(sprite){
 const [left,top,width,height,ox,oy,fw,fh]=sprite.rect;
 if([left,top,ox,oy].some(n=>n<0)||width<1||height<1||fw<width+ox||fh<height+oy||fw>256||fh>256)throw Error('Invalid icon rectangle.');
 return sharp(sprite.png).extract({left,top,width,height}).extend({left:ox,top:oy,right:fw-width-ox,bottom:fh-height-oy,background:{r:0,g:0,b:0,alpha:0}}).png().toBuffer();
}
const output=path.resolve('public/assets/items-b42'),assets={},pending=[];
for(const id of ids){
 const d=definitions[id],texture='Item_'+d.icon,sprite=sprites.get(texture);
 if(!sprite)throw Error(`No exact texture ${id}: ${texture}. Keep fallback; do not substitute.`);
 const png=await iconPng(sprite),meta=await sharp(png).metadata(),backup=backupSprites.get(texture);
 const shadowed=[];
 for(const other of sprite.duplicates){const equal=hash(await iconPng(other))===hash(png);if(!equal&&!(id==='Base.HandShovel'&&sprite.pack==='UI.pack'&&sprite.page==='ThuztorInventory1'))throw Error(`Different pixels for duplicate ${id}: ${sprite.page} / ${other.page}. Requires independent review.`);shadowed.push({page:other.page,pixels_agree:equal});}
 const backupEqual=backup?hash(await iconPng(backup))===hash(png):null;
 if(backupEqual===false)throw Error(`Installed texture differs from its local backup: ${id}. Requires independent review.`);
 assets[id]={src:`/assets/items-b42/${id}.png`,label:d.label,verified:true,build,texture,variant_count:d.variants.length,variants:d.variants,width:meta.width,height:meta.height,sha256:hash(png),script_file:d.script_file,script_line:d.script_line,script_sha256:d.script_sha256,definition_sha256:d.definition_sha256,pack:`media/texturepacks/${sprite.pack}`,pack_sha256:sprite.pack_sha256,page:sprite.page,rect:sprite.rect,local_backup_agrees:backupEqual,shadowed,duplicate_resolution:shadowed.length?'last_page_wins_TexturePackDevice.initMetaData':null};
 pending.push([path.join(output,id+'.png'),png]);
}
const steamManifest=await readFile(path.resolve(gameRoot,'../..','appmanifest_108600.acf'),'utf8');
const source={build,steam_build_id:steamManifest.match(/"buildid"\s+"(\d+)"/)?.[1]||null,catalog_version:rewardCatalog.version,rewards:rewardCatalog.rewards.length,unique_script_ids:ids.length,covered_script_ids:Object.keys(assets).length,origin:'Licensed local Steam installation; read-only extraction',game_jar_sha256:hash(await readFile(jar)),loader_inspection_sha256:hash(loader),terms_url:'https://projectzomboid.com/blog/support/terms-conditions/',terms_section:'2.2',copyright:'The Indie Stone Ltd.',use:'Non-commercial unofficial fan production with prominent attribution',web_reference:'https://projectzomboidmap.com/pt/items/',web_reference_role:'Cross-reference only; no third-party image files redistributed'};
if(process.argv.includes('--write')){
 await mkdir(output,{recursive:true});
 for(const [file,bytes] of pending)await writeFile(file,bytes,{flag:'wx'});
 await writeFile('public/roulette-item-assets.js',`// Generated by scripts/extract-roulette-icons.js. Catalog data is not modified.\nexport const itemAssetSource=Object.freeze(${JSON.stringify(source,null,2)});\nexport const itemAssets=Object.freeze(${JSON.stringify(assets,null,2)});\n`,{flag:'wx'});
}
console.log(JSON.stringify({source,items:Object.fromEntries(Object.entries(assets).map(([id,v])=>[id,{texture:v.texture,variants:v.variant_count,pack:v.pack,backup_agrees:v.local_backup_agrees}]))},null,2));
