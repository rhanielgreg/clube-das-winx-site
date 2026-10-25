import { escapeHtml } from './contracts.js';
export function visibleAchievements(unlocks,catalog) {
 const ids=new Set(unlocks.map(row=>typeof row==='string'?row:row.achievement_id));
 const earned=catalog.filter(a=>ids.has(a.id));
 return {total:earned.length,visible:earned.filter(a=>!a.sequence||!earned.some(b=>b.sequence===a.sequence&&b.level_rank>a.level_rank))};
}
export function medalSvg(achievement) {
 const colors={bronze:'#c49473',silver:'#d0d8e4',gold:'#eed18b'};
 const color=colors[achievement.level]||'#eb98c6';
 const symbols={combate:'✦',armas:'†',veiculos:'◇',tempo:'◷',sobrevivencia:'✧',exploracao:'⌖',temporada:'♛'};
 return `<svg viewBox="0 0 64 72" role="img" aria-label="${escapeHtml(achievement.name)}" xmlns="http://www.w3.org/2000/svg"><path d="M17 2h12l3 18L20 28Z M35 2h12l-3 26-12-8Z" fill="#8d295f"/><path d="m32 17 23 13v26L32 69 9 56V30Z" fill="#18121e" stroke="${color}" stroke-width="2"/><circle cx="32" cy="43" r="17" fill="none" stroke="${color}" opacity=".5"/><text x="32" y="51" fill="${color}" text-anchor="middle" font-family="Georgia,serif" font-size="25">${symbols[achievement.category]||'✦'}</text></svg>`;
}
