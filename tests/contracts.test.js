import assert from 'node:assert/strict';
import test from 'node:test';
import { lifeState, normalizeCharacter, filterRanking, recentHistory, formatDuration, escapeHtml, csvField } from '../public/contracts.js';
import { demoCharacters } from '../public/demo-data.js';
import { validateAdminAction } from '../lib/admin-actions.js';

test('estado ausente não vira vivo e desconhecidos não passam no filtro Vivos', () => {
  assert.equal(lifeState(undefined).label, 'Desconhecido');
  assert.equal(lifeState(null).label, 'Desconhecido');
  assert.equal(lifeState(false).label, 'Morto');
  assert.equal(lifeState(true).label, 'Vivo');
  assert.equal(normalizeCharacter({ died_at: '2026-01-01' }).alive, null);
  const alive = filterRanking(demoCharacters, [], { filter: 'alive' });
  assert.ok(alive.every((row) => row.alive === true));
});
test('cemitério não infere mortes e preserva registros homônimos', () => {
  const dead = filterRanking([], [...demoCharacters, { character_name: 'Sem informação', died_at: '2026-01-01' }], { filter: 'dead' });
  assert.equal(dead.length, 5, 'inclui morto sem estatísticas, sem inferir pontuação');
  assert.ok(dead.every((row) => row.alive === false));
  const homonyms = demoCharacters.filter((row) => row.character_name === 'Lia Moretti');
  assert.equal(homonyms.length, 2);
  assert.notEqual(homonyms[0].profile_id, homonyms[1].profile_id);
});
test('histórico recente filtra temporada antes de limitar e mantém ordem cronológica', () => {
  const points = Array.from({ length: 120 }, (_, i) => ({ id: i, season_id: 'current', observed_at: new Date(1700000000000 + i * 300000).toISOString(), kills_total: i }));
  const result = recentHistory([...points, { season_id: 'other', observed_at: '2030-01-01', kills_total: 999 }], 'current');
  assert.equal(result.length, 90);
  assert.equal(result[0].kills_total, 30);
  assert.equal(result.at(-1).kills_total, 119);
  assert.equal(points[0].kills_total, 0, 'não modifica snapshots de entrada');
});
test('tempo desconhecido não vira zero ou dias no mundo; atributos são escapados', () => {
  assert.equal(formatDuration(null), '—');
  assert.equal(formatDuration(-1), '—');
  assert.equal(formatDuration(19020), '5h 17m');
  assert.equal(formatDuration(172800), '48h 0m');
  assert.equal(escapeHtml('"<&'), '&quot;&lt;&amp;');
});
test('reset exige temporada, permanece bloqueado e encerramento valida parâmetros sem impor campeão', () => {
  assert.equal(validateAdminAction('reset_baseline', {}).status, 400);
  const season_id = '10000000-0000-4000-8000-000000000001';
  assert.equal(validateAdminAction('reset_baseline', { season_id }).status, 409);
  assert.equal(validateAdminAction('close_season', { season_id }), null);
  assert.equal(validateAdminAction('close_season', { season_id, winner_character_id: 'invalid' }).status, 400);
  assert.equal(validateAdminAction('start_season', { name: {}, slug: 'a' }).status, 400);
  assert.equal(validateAdminAction('reset_baseline', null).status, 400);
});
test('CSV mantém campos completos e neutraliza fórmulas em nomes', () => {
  assert.equal(csvField('=1+1'), '"\'=1+1"');
  assert.equal(csvField('Nome; com "aspas" #1'), '"Nome; com ""aspas"" #1"');
  assert.equal(csvField(null), '""');
});
