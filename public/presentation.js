// Somente apresentação: nenhum contador é derivado de categorias ou nomes.
import { hasNumber, UUID } from './contracts.js';

const validNumber = (value) => (typeof value === 'number' || typeof value === 'string' && value.trim() !== '') && hasNumber(value) && Number(value) >= 0;
export function profileMetrics(profile, validatedMetrics = []) {
  const confirmed = new Set(Array.isArray(validatedMetrics) ? validatedMetrics : []);
  const available = (key) => confirmed.has(key) && validNumber(profile[key]);
  const combat = [
    ['kills_total', 'Kills na temporada'],
    ['kills_firearm', 'Armas de fogo'],
    ['kills_melee', 'Corpo a corpo'],
  ].filter(([key]) => validNumber(profile[key])).map(([key, label]) => ({ key, label, value: Number(profile[key]) }));
  for (const [key, label] of [['kills_vehicle', 'Veículos'], ['kills_other', 'Outras categorias']]) {
    if (available(key)) combat.push({ key, label, value: Number(profile[key]) });
  }
  const exploration = [['distance_total_m', 'Distância total'], ['distance_walked_m', 'Distância a pé'], ['distance_vehicle_m', 'Distância de veículo']]
    .filter(([key]) => available(key)).map(([key, label]) => ({ key, label, value: Number(profile[key]) / 1000, unit: 'km' }));
  return { combat, exploration,
    recordedSeconds: validNumber(profile.survival_seconds) ? Number(profile.survival_seconds) : null,
    worldDays: available('survival_world_days') ? Number(profile.survival_world_days) : null };
}

export function memorialDate(row) {
  if (row.died_at && Number.isFinite(Date.parse(row.died_at))) return { label: 'Morte registrada', value: row.died_at };
  if (row.last_updated_at && Number.isFinite(Date.parse(row.last_updated_at))) return { label: 'Última observação', value: row.last_updated_at };
  return { label: 'Data não informada', value: null };
}

// Comparar somente o mesmo contador e a mesma temporada, com identidade válida.
// O recorte da API é limitado: isto não certifica um recorde histórico global.
export function memorialHighlights(rows) {
  const groups = new Map();
  for (const row of rows) {
    if (row.alive !== false || !UUID.test(row.profile_id || '') || !UUID.test(row.season_id || '') || !validNumber(row.kills_total) || Number(row.kills_total) <= 0) continue;
    const group = groups.get(row.season_id) || [];
    group.push(row);
    groups.set(row.season_id, group);
  }
  const highlighted = new Set();
  for (const group of groups.values()) {
    if (new Set(group.map((row) => row.profile_id)).size < 2) continue;
    const maximum = Math.max(...group.map((row) => Number(row.kills_total)));
    for (const row of group) if (Number(row.kills_total) === maximum) highlighted.add(row.profile_id);
  }
  return highlighted;
}
