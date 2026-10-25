// Contratos compartilhados pelo frontend, pelas APIs e pelos testes locais.
export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const hasNumber = (value) => (typeof value === 'number' || typeof value === 'string' && value.trim() !== '') && Number.isFinite(Number(value));
export const formatNumber = (value) => hasNumber(value) ? new Intl.NumberFormat('pt-BR').format(Number(value)) : '—';
export function lifeState(alive) {
  return alive === true ? { label: 'Vivo', className: 'alive' }
    : alive === false ? { label: 'Morto', className: 'dead' }
      : { label: 'Desconhecido', className: 'unknown' };
}
export function formatDuration(seconds) {
  if (!hasNumber(seconds) || Number(seconds) < 0) return '—';
  const value = Number(seconds);
  // Horas registradas, não dias sobrevividos no mundo do jogo.
  return `${Math.floor(value / 3600)}h ${Math.floor((value % 3600) / 60)}m`;
}
export function escapeHtml(value) {
  return String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');
}
export function csvField(value) {
  const text = String(value ?? '');
  const protectedText = /^[\s]*[=+@-]/.test(text) ? `'${text}` : text;
  return `"${protectedText.replaceAll('"', '""')}"`;
}
export function normalizeCharacter(row) {
  return { ...row, alive: typeof row.alive === 'boolean' ? row.alive : null };
}
export function filterRanking(ranking, graveyard, { filter = 'kills', search = '' } = {}) {
  const term = search.trim().toLocaleLowerCase('pt-BR');
  let rows = [...(filter === 'dead' ? graveyard : ranking)].filter((row) =>
    `${row.steam_username || ''} ${row.character_name || ''}`.toLocaleLowerCase('pt-BR').includes(term));
  if (filter === 'alive') rows = rows.filter((row) => row.alive === true);
  if (filter !== 'dead') rows = rows.filter((row) => row.alive === true);
  if (filter === 'dead') rows = rows.filter((row) => row.alive === false);
  if (filter === 'time') rows.sort((a, b) => (b.survival_seconds ?? -1) - (a.survival_seconds ?? -1));
  if (filter === 'kills') rows.sort((a, b) => (b.kills_total ?? -1) - (a.kills_total ?? -1));
  if (filter === 'dead') rows.sort((a, b) => Date.parse(b.died_at || 0) - Date.parse(a.died_at || 0));
  return rows;
}
export function recentHistory(points, seasonId, limit = 90) {
  return points.filter((point) => (!seasonId || point.season_id === seasonId) && Number.isFinite(Date.parse(point.observed_at)))
    .sort((a, b) => Date.parse(b.observed_at) - Date.parse(a.observed_at) || Number(b.id || 0) - Number(a.id || 0))
    .slice(0, limit).reverse();
}
