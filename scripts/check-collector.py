"""Verificação offline do coletor identificado. Não executa coleta nem lê .env."""
import argparse
import hashlib
import importlib.util
import json
from pathlib import Path
import sys
import unittest
from unittest.mock import patch

sys.dont_write_bytecode = True
parser = argparse.ArgumentParser()
parser.add_argument('--source', required=True, help='Pasta explícita contendo collector.py, stats.py e probe_stats.py')
args = parser.parse_args()
source = Path(args.source).resolve(strict=True)
required = ['collector.py', 'stats.py', 'probe_stats.py', 'schema.sql', 'test_collector.py']
if not all((source / name).is_file() for name in required):
    raise SystemExit('Pasta não corresponde à cópia de coletor esperada. Nenhuma alteração efetuada.')
before = {name: hashlib.sha256((source / name).read_bytes()).hexdigest() for name in required}
sys.path.insert(0, str(source))
import stats  # noqa: E402 — importação local explícita, sem executar collector.main


class VehicleContractTests(unittest.TestCase):
    def decode(self, vehicle=3, vehicle_total=3, weapons_total=11):
        categories = dict.fromkeys(stats.CATEGORIES, 0)
        categories.update(Vehicle=vehicle, Firearm=2, Unarmed=5, Other=1)
        data = {'categories': categories, 'weapons': {'synthetic': weapons_total}, 'vehicleKills': vehicle_total}
        with patch.object(stats, 'anchored_value', side_effect=lambda blob, name: data if name == 'TTF_KillStats' else 1234):
            return stats.confirmed_stats(b'synthetic-offline')

    def test_vehicles_already_belong_to_total_once(self):
        result = self.decode()
        self.assertEqual(result['p_kills_total'], 11)
        self.assertEqual(result['p_kills_firearm'], 2)
        self.assertEqual(result['p_kills_melee'], 5)
        self.assertEqual(result['p_kills_total'] - result['p_kills_firearm'] - result['p_kills_melee'], 4)
        # A diferença inclui Vehicle + Other; não pode ser chamada de "veículos".

    def test_vehicle_inconsistency_rejects_observation(self):
        self.assertIsNone(self.decode(vehicle_total=2)['p_kills_total'])

    def test_weapon_inconsistency_rejects_observation(self):
        self.assertIsNone(self.decode(weapons_total=12)['p_kills_total'])

    def test_anonymized_fixture_contains_vehicle_in_total(self):
        samples = json.loads((source / 'fixtures' / 'ttf_only.json').read_text())
        found = False
        for sample in samples:
            blob = bytes.fromhex(sample['ttf_only_hex'])
            data = stats.anchored_value(blob, 'TTF_KillStats')
            result = stats.confirmed_stats(blob)
            self.assertEqual(result['p_kills_total'], sample['expected_total'])
            if data['vehicleKills'] > 0:
                found = True
                self.assertEqual(result['p_kills_total'], sum(data['categories'].values()))
                self.assertGreater(result['p_kills_total'], result['p_kills_firearm'] + result['p_kills_melee'])
        self.assertTrue(found, 'a amostra anonimizada precisa exercitar veículos')


suite = unittest.defaultTestLoader.loadTestsFromTestCase(VehicleContractTests)
result = unittest.TextTestRunner(verbosity=2).run(suite)
after = {name: hashlib.sha256((source / name).read_bytes()).hexdigest() for name in required}
if before != after:
    raise SystemExit('Os arquivos do coletor mudaram durante a verificação; revisar origem.')
print('Fonte examinada por leitura; arquivos do coletor preservados. Nenhuma rede ou coleta executada.')
raise SystemExit(0 if result.wasSuccessful() else 1)
