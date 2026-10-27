# Conquistas — revisão individual e proposta da Missão 12

**Proposta para decisão de produto, não implementada no catálogo nem na interface pública.**

Exatamente 100 IDs/definições preservados. Os 100 casos positivos e de fronteira já existentes continuam na suíte. Na produção consultada: zero vidas nativas e zero desbloqueios; nenhuma das 100 está apta a concessão enquanto a identidade está bloqueada. “Fonte potencial” abaixo indica disponibilidade do contador no leitor, não ativação nem cobertura desde nascimento.

## Correção proposta, ainda sem aprovação

Somente **mes-sem-tiros — Um mês sem tiros registrados** contém a igualdade restritiva kills_firearm = 0. A outra igualdade é alive=0 em Legado do caído e significa morte observada; deve ser preservada. As três especiais de mil kills continuam independentes dos demais métodos. Linha de frente — Prata mantém 2.500.

Proposta recomendada: conservar o ID e os marcos survival_world_days ≥ 30 e kills_total ≥ 100, remover kills_firearm=0 e renomear para **Um mês de resistência**. A vida pode ter usado armas de fogo, sem exigir histórico impossível de ausência de tiros. Continua bloqueada até existir fonte válida de dias no mundo; não substituímos dias por tempo jogado. Mantém 100 definições. A versão de definição deve ser tratada em migração própria, mesmo sem desbloqueios existentes, pois o catálogo atual é imutável por versão.

Impacto: vidas com pelo menos 30 dias de mundo e 100 kills poderão qualificar mesmo com Firearm positivo. Nenhuma alteração proposta aos outros 99 critérios. Casos de aceite após aprovação: 30/100/Firearm positivo qualifica; menos de 30 dias ou 100 kills não qualifica; dias ausentes não qualificam; outra vida não herda; replay não duplica; fonte JS/SQL continua idêntica e 100 IDs únicos.

Alternativa, se for indispensável preservar o nome: janela comprovada de 30 dias do mundo sem incremento de Firearm, usando duas observações vinculadas à mesma vida e cobertura contínua. Isso exige novo contrato de eventos/janela; não há essa evidência atual. Não interpretar um Firearm vitalício positivo como impossibilidade de futuras janelas.

## Apresentação contextual proposta

![Proposta ilustrativa, sem dados produtivos](mission12-achievements-proposal.svg)

Um controle “Conquistas” na linha/card do sobrevivente abre um painel no próprio Ranking. O Memorial usa o mesmo painel em cada lápide. Sem nova página ou dossiê. Mostra o maior nível por sequência e mantém contagem de todos os níveis persistidos; especiais aparecem individualmente. Vida ainda não comprovada: “Conquistas indisponíveis — identidade desta vida pendente”, sem zero fictício. Métrica ausente aparece como indisponível, sem barra de progresso calculada. Mortos conservam as medalhas e mostram a informação de congelamento. No celular, painel ocupa a largura disponível, mantém foco/fechamento acessíveis e não abre outra rota.

O SVG usa exemplos explicitamente ilustrativos; não representa medalhas concedidas. API e infraestrutura podem ser publicadas independentemente. O controle e o painel definitivos dependem da aprovação desta proposta.

## Matriz das 100 definições atuais

| # | ID | Critério mantido | Dependência atual | Revisão |
|---|---|---|---|---|
| 1 | exterminador.bronze | kills_total ≥ 100 | Fonte potencial; falta identidade/coorte | Sem alteração |
| 2 | exterminador.silver | kills_total ≥ 1000 | Fonte potencial; falta identidade/coorte | Sem alteração |
| 3 | exterminador.gold | kills_total ≥ 10000 | Fonte potencial; falta identidade/coorte | Sem alteração |
| 4 | atirador.bronze | kills_firearm ≥ 100 | Fonte potencial; falta identidade/coorte | Sem alteração |
| 5 | atirador.silver | kills_firearm ≥ 500 | Fonte potencial; falta identidade/coorte | Sem alteração |
| 6 | atirador.gold | kills_firearm ≥ 2500 | Fonte potencial; falta identidade/coorte | Sem alteração |
| 7 | linha-frente.bronze | kills_melee ≥ 100 | Fonte potencial; falta identidade/coorte | Sem alteração |
| 8 | linha-frente.silver | kills_melee ≥ 2500 | Fonte potencial; falta identidade/coorte | Sem alteração |
| 9 | linha-frente.gold | kills_melee ≥ 5000 | Fonte potencial; falta identidade/coorte | Sem alteração |
| 10 | impacto-rodas.bronze | kills_vehicle ≥ 50 | Fonte potencial; falta identidade/coorte | Sem alteração |
| 11 | impacto-rodas.silver | kills_vehicle ≥ 500 | Fonte potencial; falta identidade/coorte | Sem alteração |
| 12 | impacto-rodas.gold | kills_vehicle ≥ 2500 | Fonte potencial; falta identidade/coorte | Sem alteração |
| 13 | lenhador.bronze | kills_axe ≥ 25 | Fonte potencial; falta identidade/coorte | Sem alteração |
| 14 | lenhador.silver | kills_axe ≥ 250 | Fonte potencial; falta identidade/coorte | Sem alteração |
| 15 | lenhador.gold | kills_axe ≥ 1000 | Fonte potencial; falta identidade/coorte | Sem alteração |
| 16 | contundente.bronze | kills_blunt ≥ 25 | Fonte potencial; falta identidade/coorte | Sem alteração |
| 17 | contundente.silver | kills_blunt ≥ 250 | Fonte potencial; falta identidade/coorte | Sem alteração |
| 18 | contundente.gold | kills_blunt ≥ 1000 | Fonte potencial; falta identidade/coorte | Sem alteração |
| 19 | impacto-curto.bronze | kills_small_blunt ≥ 25 | Fonte potencial; falta identidade/coorte | Sem alteração |
| 20 | impacto-curto.silver | kills_small_blunt ≥ 250 | Fonte potencial; falta identidade/coorte | Sem alteração |
| 21 | impacto-curto.gold | kills_small_blunt ≥ 1000 | Fonte potencial; falta identidade/coorte | Sem alteração |
| 22 | lamina-longa.bronze | kills_long_blade ≥ 25 | Fonte potencial; falta identidade/coorte | Sem alteração |
| 23 | lamina-longa.silver | kills_long_blade ≥ 250 | Fonte potencial; falta identidade/coorte | Sem alteração |
| 24 | lamina-longa.gold | kills_long_blade ≥ 1000 | Fonte potencial; falta identidade/coorte | Sem alteração |
| 25 | lamina-curta.bronze | kills_small_blade ≥ 25 | Fonte potencial; falta identidade/coorte | Sem alteração |
| 26 | lamina-curta.silver | kills_small_blade ≥ 250 | Fonte potencial; falta identidade/coorte | Sem alteração |
| 27 | lamina-curta.gold | kills_small_blade ≥ 1000 | Fonte potencial; falta identidade/coorte | Sem alteração |
| 28 | lanceiro.bronze | kills_spear ≥ 25 | Fonte potencial; falta identidade/coorte | Sem alteração |
| 29 | lanceiro.silver | kills_spear ≥ 250 | Fonte potencial; falta identidade/coorte | Sem alteração |
| 30 | lanceiro.gold | kills_spear ≥ 1000 | Fonte potencial; falta identidade/coorte | Sem alteração |
| 31 | desarmado.bronze | kills_unarmed ≥ 10 | Fonte potencial; falta identidade/coorte | Sem alteração |
| 32 | desarmado.silver | kills_unarmed ≥ 100 | Fonte potencial; falta identidade/coorte | Sem alteração |
| 33 | desarmado.gold | kills_unarmed ≥ 500 | Fonte potencial; falta identidade/coorte | Sem alteração |
| 34 | outros-meios.bronze | kills_other ≥ 25 | Fonte potencial; falta identidade/coorte | Sem alteração |
| 35 | outros-meios.silver | kills_other ≥ 100 | Fonte potencial; falta identidade/coorte | Sem alteração |
| 36 | outros-meios.gold | kills_other ≥ 500 | Fonte potencial; falta identidade/coorte | Sem alteração |
| 37 | tempo-ativo.bronze | played_seconds ≥ 36000 | Fonte potencial; falta identidade/coorte | Sem alteração |
| 38 | tempo-ativo.silver | played_seconds ≥ 180000 | Fonte potencial; falta identidade/coorte | Sem alteração |
| 39 | tempo-ativo.gold | played_seconds ≥ 720000 | Fonte potencial; falta identidade/coorte | Sem alteração |
| 40 | sobrevivente.bronze | survival_world_days ≥ 7 | Falta survival_world_days | Sem alteração |
| 41 | sobrevivente.silver | survival_world_days ≥ 30 | Falta survival_world_days | Sem alteração |
| 42 | sobrevivente.gold | survival_world_days ≥ 90 | Falta survival_world_days | Sem alteração |
| 43 | territorio.bronze | distance_total_m ≥ 25000 | Fonte potencial; falta identidade/coorte | Sem alteração |
| 44 | territorio.silver | distance_total_m ≥ 100000 | Fonte potencial; falta identidade/coorte | Sem alteração |
| 45 | territorio.gold | distance_total_m ≥ 500000 | Fonte potencial; falta identidade/coorte | Sem alteração |
| 46 | andarilho.bronze | distance_walked_m ≥ 10000 | Falta distance_walked_m | Sem alteração |
| 47 | andarilho.silver | distance_walked_m ≥ 50000 | Falta distance_walked_m | Sem alteração |
| 48 | andarilho.gold | distance_walked_m ≥ 150000 | Falta distance_walked_m | Sem alteração |
| 49 | estradeiro.bronze | distance_vehicle_m ≥ 50000 | Falta distance_vehicle_m | Sem alteração |
| 50 | estradeiro.silver | distance_vehicle_m ≥ 250000 | Falta distance_vehicle_m | Sem alteração |
| 51 | estradeiro.gold | distance_vehicle_m ≥ 1000000 | Falta distance_vehicle_m | Sem alteração |
| 52 | temporada-exterminio.bronze | best_season_kills_total ≥ 100 | Falta best_season_kills_total | Sem alteração |
| 53 | temporada-exterminio.silver | best_season_kills_total ≥ 1000 | Falta best_season_kills_total | Sem alteração |
| 54 | temporada-exterminio.gold | best_season_kills_total ≥ 5000 | Falta best_season_kills_total | Sem alteração |
| 55 | temporada-fogo.bronze | best_season_kills_firearm ≥ 50 | Falta best_season_kills_firearm | Sem alteração |
| 56 | temporada-fogo.silver | best_season_kills_firearm ≥ 500 | Falta best_season_kills_firearm | Sem alteração |
| 57 | temporada-fogo.gold | best_season_kills_firearm ≥ 2000 | Falta best_season_kills_firearm | Sem alteração |
| 58 | temporada-contato.bronze | best_season_kills_melee ≥ 50 | Falta best_season_kills_melee | Sem alteração |
| 59 | temporada-contato.silver | best_season_kills_melee ≥ 500 | Falta best_season_kills_melee | Sem alteração |
| 60 | temporada-contato.gold | best_season_kills_melee ≥ 2000 | Falta best_season_kills_melee | Sem alteração |
| 61 | temporada-rodas.bronze | best_season_kills_vehicle ≥ 25 | Falta best_season_kills_vehicle | Sem alteração |
| 62 | temporada-rodas.silver | best_season_kills_vehicle ≥ 250 | Falta best_season_kills_vehicle | Sem alteração |
| 63 | temporada-rodas.gold | best_season_kills_vehicle ≥ 1000 | Falta best_season_kills_vehicle | Sem alteração |
| 64 | combate-hibrido.bronze | kills_firearm ≥ 50; kills_melee ≥ 50 | Fonte potencial; falta identidade/coorte | Sem alteração |
| 65 | combate-hibrido.silver | kills_firearm ≥ 250; kills_melee ≥ 250 | Fonte potencial; falta identidade/coorte | Sem alteração |
| 66 | combate-hibrido.gold | kills_firearm ≥ 1000; kills_melee ≥ 1000 | Fonte potencial; falta identidade/coorte | Sem alteração |
| 67 | duas-laminas.bronze | kills_long_blade ≥ 25; kills_small_blade ≥ 25 | Fonte potencial; falta identidade/coorte | Sem alteração |
| 68 | duas-laminas.silver | kills_long_blade ≥ 100; kills_small_blade ≥ 100 | Fonte potencial; falta identidade/coorte | Sem alteração |
| 69 | duas-laminas.gold | kills_long_blade ≥ 500; kills_small_blade ≥ 500 | Fonte potencial; falta identidade/coorte | Sem alteração |
| 70 | dois-impactos.bronze | kills_blunt ≥ 25; kills_small_blunt ≥ 25 | Fonte potencial; falta identidade/coorte | Sem alteração |
| 71 | dois-impactos.silver | kills_blunt ≥ 100; kills_small_blunt ≥ 100 | Fonte potencial; falta identidade/coorte | Sem alteração |
| 72 | dois-impactos.gold | kills_blunt ≥ 500; kills_small_blunt ≥ 500 | Fonte potencial; falta identidade/coorte | Sem alteração |
| 73 | rodas-fogo.bronze | kills_vehicle ≥ 25; kills_firearm ≥ 25 | Fonte potencial; falta identidade/coorte | Sem alteração |
| 74 | rodas-fogo.silver | kills_vehicle ≥ 100; kills_firearm ≥ 100 | Fonte potencial; falta identidade/coorte | Sem alteração |
| 75 | rodas-fogo.gold | kills_vehicle ≥ 500; kills_firearm ≥ 500 | Fonte potencial; falta identidade/coorte | Sem alteração |
| 76 | arsenal-diverso.bronze | categories_with_100_kills ≥ 3 | Fonte potencial; falta identidade/coorte | Sem alteração |
| 77 | arsenal-diverso.silver | categories_with_100_kills ≥ 5 | Fonte potencial; falta identidade/coorte | Sem alteração |
| 78 | arsenal-diverso.gold | categories_with_100_kills ≥ 8 | Fonte potencial; falta identidade/coorte | Sem alteração |
| 79 | resistencia-combate.bronze | survival_world_days ≥ 7; kills_total ≥ 100 | Falta survival_world_days | Sem alteração |
| 80 | resistencia-combate.silver | survival_world_days ≥ 30; kills_total ≥ 1000 | Falta survival_world_days | Sem alteração |
| 81 | resistencia-combate.gold | survival_world_days ≥ 90; kills_total ≥ 5000 | Falta survival_world_days | Sem alteração |
| 82 | trilha-resistente.bronze | survival_world_days ≥ 7; distance_walked_m ≥ 10000 | Falta survival_world_days, distance_walked_m | Sem alteração |
| 83 | trilha-resistente.silver | survival_world_days ≥ 30; distance_walked_m ≥ 50000 | Falta survival_world_days, distance_walked_m | Sem alteração |
| 84 | trilha-resistente.gold | survival_world_days ≥ 90; distance_walked_m ≥ 150000 | Falta survival_world_days, distance_walked_m | Sem alteração |
| 85 | estrada-resistente.bronze | survival_world_days ≥ 7; distance_vehicle_m ≥ 50000 | Falta survival_world_days, distance_vehicle_m | Sem alteração |
| 86 | estrada-resistente.silver | survival_world_days ≥ 30; distance_vehicle_m ≥ 250000 | Falta survival_world_days, distance_vehicle_m | Sem alteração |
| 87 | estrada-resistente.gold | survival_world_days ≥ 90; distance_vehicle_m ≥ 1000000 | Falta survival_world_days, distance_vehicle_m | Sem alteração |
| 88 | participacao.bronze | seasons_completed_alive ≥ 1 | Falta seasons_completed_alive | Sem alteração |
| 89 | participacao.silver | seasons_completed_alive ≥ 3 | Falta seasons_completed_alive | Sem alteração |
| 90 | participacao.gold | seasons_completed_alive ≥ 5 | Falta seasons_completed_alive | Sem alteração |
| 91 | coroa-oficial | official_wins ≥ 1 | Falta official_wins | Sem alteração |
| 92 | ultimo-vencedor | solo_official_wins ≥ 1 | Falta solo_official_wins | Sem alteração |
| 93 | coroa-persistente | official_wins ≥ 2 | Falta official_wins | Sem alteração |
| 94 | arsenal-fogo | kills_firearm ≥ 1000 | Fonte potencial; falta identidade/coorte | Sem alteração |
| 95 | arsenal-contato | kills_melee ≥ 1000 | Fonte potencial; falta identidade/coorte | Sem alteração |
| 96 | arsenal-rodas | kills_vehicle ≥ 1000 | Fonte potencial; falta identidade/coorte | Sem alteração |
| 97 | tres-frentes | kills_firearm ≥ 100; kills_melee ≥ 100; kills_vehicle ≥ 100 | Fonte potencial; falta identidade/coorte | Sem alteração |
| 98 | mes-sem-tiros | survival_world_days ≥ 30; kills_total ≥ 100; kills_firearm = 0 | Falta survival_world_days | Proposta abaixo; critério atual preservado |
| 99 | duas-jornadas | distance_walked_m ≥ 10000; distance_vehicle_m ≥ 100000 | Falta distance_walked_m, distance_vehicle_m | Sem alteração |
| 100 | legado-caido | alive = 0; survival_world_days ≥ 30; kills_total ≥ 1000 | Falta survival_world_days | Sem alteração |
