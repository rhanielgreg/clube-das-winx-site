// Only compare categories with the same scope and observation. A residual is not
// evidence of Vehicle or Other, and Melee already contains its weapon subtypes.
export function killBreakdown(row, { scope = 'season' } = {}) {
  const count = n => typeof n === 'number' && Number.isSafeInteger(n) && n >= 0 && n <= 2_000_000_000;
  const total = count(row?.kills_total) ? row.kills_total : null;
  const firearm = count(row?.kills_firearm) ? row.kills_firearm : null;
  const melee = count(row?.kills_melee) ? row.kills_melee : null;
  const verified = row?.life_identity_verified === true;
  const vehicle = verified && count(row?.kills_vehicle) ? row.kills_vehicle : null;
  const other = verified && count(row?.kills_other) ? row.kills_other : null;
  const parts = { firearm, melee, vehicle, other };
  const known = Object.values(parts).filter(n => n !== null);
  const sum = known.reduce((a,b) => a+b,0);
  const inconsistent = total !== null && (sum > total || known.length === 4 && sum !== total);
  return { scope, state: total === null ? 'unavailable' : inconsistent ? 'inconsistent'
    : known.length === 4 ? 'reconciled' : 'partial', total,
    categories: inconsistent ? { firearm:null, melee:null, vehicle:null, other:null } : parts,
    undiscriminated: total === null || inconsistent ? null : total-sum };
}

export function killBreakdownText(breakdown) {
  if (!breakdown || breakdown.total === null) return 'Categorias indisponíveis.';
  if (breakdown.state === 'inconsistent') return 'Total preservado; categorias aguardando reconciliação.';
  const names = { firearm:'armas de fogo', melee:'corpo a corpo', vehicle:'veículos', other:'outros métodos' };
  const parts = Object.entries(breakdown.categories).filter(([,v]) => v !== null)
    .map(([key,value]) => `${value} ${names[key]}`);
  if (breakdown.state === 'partial') parts.push(`${breakdown.undiscriminated} sem categoria discriminada`);
  return parts.join(' · ');
}
