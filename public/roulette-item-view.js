import {escapeHtml as safe} from './contracts.js';
import {itemAssets,itemAssetSource} from './roulette-item-assets.js';

export function verifiedItemAsset(scriptId,build=itemAssetSource.build){
 const asset=Object.hasOwn(itemAssets,scriptId)?itemAssets[scriptId]:null;
 return asset?.verified===true&&asset.build===build&&build===itemAssetSource.build&&/^\/assets\/items-b42\/Base\.[\w]+\.png$/.test(asset.src)?asset:null;
}
export function itemArtwork(items,build=itemAssetSource.build){
 return items.map((item,index)=>{
  const asset=verifiedItemAsset(item.script_id,build),label=asset?.label||`Componente ${index+1}`;
  return `<span class="machine-component ${asset?'':'is-missing'}" data-item-icon><span class="machine-component-fallback" role="img" aria-label="Ícone não verificado ou indisponível">◇</span>${asset?`<img src="${safe(asset.src)}" alt="${safe(label)} — ícone da Build ${safe(asset.build)}" width="${asset.width}" height="${asset.height}" decoding="async" data-verified-item-icon>`:''}</span>`;
 }).join('');
}
export function itemQuantities(items,build=itemAssetSource.build){return items.map((item,index)=>`${safe(item.quantity)} × ${safe(verifiedItemAsset(item.script_id,build)?.label||`componente ${index+1}`)}`).join(' · ');}
export function itemImageNote(items,build=itemAssetSource.build){
 if(items.some(i=>!verifiedItemAsset(i.script_id,build)))return 'Símbolo ilustrativo para componente sem imagem verificada.';
 return items.some(i=>verifiedItemAsset(i.script_id,build).variant_count>1)?'Ícones representativos de variantes do mesmo ID. Aparência e condição da entrega não são certificadas pela imagem.':`Ícones do jogo · Build ${itemAssetSource.build}. A imagem não certifica a condição da entrega.`;
}
export function itemAttribution(){return `<p class="machine-asset-credit">Thanks to The Indie Stone for creating <a href="https://projectzomboid.com/" target="_blank" rel="noopener noreferrer">Project Zomboid</a>, which made this possible. This is an unofficial fan production for non-commercial purposes made under the <a href="${itemAssetSource.terms_url}" target="_blank" rel="noopener noreferrer">Indie Stone Terms</a>.</p>`;}
