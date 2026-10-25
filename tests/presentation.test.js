import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { profileMetrics, memorialDate } from '../public/presentation.js';
import { createPreviewServer } from '../scripts/preview-server.js';

test('dossiê não deduz veículos, distâncias ou dias a partir do total/tempo', () => {
  const result = profileMetrics({ kills_total: 100, kills_firearm: 20, kills_melee: 30,
    survival_seconds: 172800, kills_vehicle: 50, distance_walked_m: 10000, survival_world_days: 30 });
  assert.deepEqual(result.combat.map((m) => m.key), ['kills_total', 'kills_firearm', 'kills_melee']);
  assert.deepEqual(result.exploration, []);
  assert.equal(result.recordedSeconds, 172800);
  assert.equal(result.worldDays, null);
  const absent = profileMetrics({ kills_total: null, survival_seconds: null });
  assert.deepEqual(absent.combat, []);
  assert.equal(absent.recordedSeconds, null);
  const malformed = profileMetrics({ kills_total: true, kills_firearm: [], kills_melee: '  ', survival_seconds: {} });
  assert.deepEqual(malformed.combat, []);
  assert.equal(malformed.recordedSeconds, null);
});

test('métricas adicionais exigem confirmação explícita e valores válidos', () => {
  const result = profileMetrics({ kills_total: 0, kills_vehicle: 0, kills_other: -1,
    distance_walked_m: 12500, distance_vehicle_m: null, survival_world_days: 5 },
  ['kills_vehicle', 'kills_other', 'distance_walked_m', 'distance_vehicle_m', 'survival_world_days']);
  assert.deepEqual(result.combat.map((m) => m.value), [0, 0]);
  assert.deepEqual(result.exploration, [{ key: 'distance_walked_m', label: 'Distância a pé', value: 12.5, unit: 'km' }]);
  assert.equal(result.worldDays, 5);
});

test('memorial distingue morte registrada, observação e data ausente', () => {
  assert.deepEqual(memorialDate({ died_at: '2026-10-23', last_updated_at: '2026-10-24' }), { label: 'Morte registrada', value: '2026-10-23' });
  assert.deepEqual(memorialDate({ died_at: 'inválida', last_updated_at: '2026-10-24' }), { label: 'Última observação', value: '2026-10-24' });
  assert.deepEqual(memorialDate({}), { label: 'Data não informada', value: null });
});

test('recuperação visual usa os mesmos caminhos e mantém dados demo fora dos módulos de produção', async () => {
  const server = createPreviewServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    for (const file of ['/identity.css', '/presentation.js']) {
      assert.equal((await fetch(base + file)).status, 200);
    }
    const ranking = await (await fetch(base + '/ranking')).text();
    assert.ok(ranking.includes('id="sobreviventes"'));
    for (const page of ['/index.html', '/ranking', '/jogador', '/memorial']) {
      const html = await (await fetch(base + page)).text();
      for (const href of ['/index.html#servidor', '/ranking#sobreviventes', '/memorial']) assert.ok(html.includes(`href="${href}"`));
    }
    const entries = ['../public/site.js', '../public/presentation.js', '../api/ranking.js', '../api/player.js'];
    for (const file of entries) {
      const source = await readFile(new URL(file, import.meta.url), 'utf8');
      assert.doesNotMatch(source, /(?:import|from)\s*['"][^'"]*demo-data/);
      assert.doesNotMatch(source, /Temporada das Cinzas|Helena Costa|Lia Moretti/);
    }
  } finally { await new Promise((resolve) => server.close(resolve)); }
});
