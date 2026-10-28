import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import sharp from 'sharp';
import {rewardCatalog} from '../lib/reward-catalog.js';
import {itemAssets,itemAssetSource} from '../public/roulette-item-assets.js';
import {verifiedItemAsset,itemArtwork,itemQuantities,itemImageNote,itemAttribution} from '../public/roulette-item-view.js';

test('roulette icons: all 24 prizes and 30 components resolve by their 23 exact IDs, with source hashes',async()=>{
 const ids=[...new Set(rewardCatalog.rewards.flatMap(r=>r.items.map(i=>i.script_id)))].sort();
 assert.equal(ids.length,23);assert.equal(rewardCatalog.rewards.flatMap(r=>r.items).length,30);
 assert.deepEqual(Object.keys(itemAssets).sort(),ids);
 assert.equal(itemAssetSource.build,'42.21.0');assert.equal(itemAssetSource.covered_script_ids,23);
 assert.equal(itemAssetSource.catalog_version,rewardCatalog.version);assert.equal(itemAssetSource.steam_build_id,'25485521');
 for(const id of ids){
  const asset=verifiedItemAsset(id);assert.ok(asset);assert.equal(asset.build,'42.21.0');
  assert.equal(asset.src,`/assets/items-b42/${id}.png`);
  const bytes=await readFile(new URL('../public'+asset.src,import.meta.url));
  assert.equal(createHash('sha256').update(bytes).digest('hex'),asset.sha256);
  const meta=await sharp(bytes).metadata();assert.equal(meta.format,'png');assert.equal(meta.width,asset.width);assert.equal(meta.height,asset.height);assert.ok(meta.hasAlpha);
  assert.match(asset.script_sha256,/^[a-f0-9]{64}$/);assert.match(asset.pack_sha256,/^[a-f0-9]{64}$/);assert.ok(asset.script_line>0);
  assert.ok(asset.variants.includes(asset.texture.slice(5)));assert.notEqual(asset.local_backup_agrees,false);
 }
 assert.equal(itemAssets['Base.Bag_ALICEpack_Army'].texture,'Item_AliceBag_Camo');
 assert.equal(itemAssets['Base.Bag_ALICEpack'].texture,'Item_AliceBag');
 assert.equal(itemAssets['Base.Machete'].texture,'Item_Machete_Forged');
 assert.equal(itemAssets['Base.HandShovel'].page,'ThuztorInventory1');
 assert.match(itemAssets['Base.HandShovel'].duplicate_resolution,/last_page_wins/);
});

test('roulette icons: kits show both individual icons, quantities and variant limitations without changing rewards',()=>{
 const snapshot=structuredClone(rewardCatalog);
 for(const reward of rewardCatalog.rewards){
  const html=itemArtwork(reward.items);assert.equal((html.match(/data-verified-item-icon/g)||[]).length,reward.items.length);
  assert.doesNotMatch(html,/<img[^>]+src="https?:/);
  for(const item of reward.items){assert.ok(html.includes(itemAssets[item.script_id].src));assert.ok(itemQuantities(reward.items).includes(`${item.quantity} ×`));}
  if(reward.rarity==='rare')assert.equal((html.match(/<img/g)||[]).length,2);
 }
 assert.deepEqual(rewardCatalog,snapshot);
 assert.match(itemImageNote([{script_id:'Base.Bag_SurvivorBag'}]),/variantes do mesmo ID/);
 assert.match(itemAttribution(),/Thanks to The Indie Stone/);assert.match(itemAttribution(),/non-commercial/);assert.match(itemAttribution(),/https:\/\/projectzomboid.com\/blog\/support\/terms-conditions\//);
});

test('roulette icons: unverified IDs and broken images retain an explicit, local fallback',async()=>{
 for(const id of ['Base.Katana_Broken','Base.Katana/../../secret','__proto__','Base.Invented'])assert.equal(verifiedItemAsset(id),null);
 assert.equal(verifiedItemAsset('Base.Katana','42.22.0'),null);assert.equal(verifiedItemAsset('Base.Katana',null),null);
 assert.doesNotMatch(itemArtwork([{script_id:'Base.Katana'}],'42.22.0'),/<img/);
 const html=itemArtwork([{script_id:'<script>bad</script>',quantity:1}]);
 assert.doesNotMatch(html,/<img|<script>/);assert.match(html,/is-missing/);assert.match(html,/Ícone não verificado ou indisponível/);
 assert.match(itemImageNote([{script_id:'Base.Invented'}]),/sem imagem verificada/);
 const machine=await readFile(new URL('../public/roulette-machine.js',import.meta.url),'utf8');
 assert.match(machine,/addEventListener\('error'/);assert.match(machine,/event.target.hidden=true/);assert.match(machine,/classList.add\('is-missing'\)/);
});
