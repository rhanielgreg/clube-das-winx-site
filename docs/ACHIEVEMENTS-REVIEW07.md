# Revisão das 100 conquistas — três correções aprovadas

Revisão de 25/10/2026, extraída do catálogo existente. A revisão inicial foi apresentada antes de qualquer alteração. O usuário aprovou expressamente as três correções em 25/10/2026; elas foram aplicadas na fonte, no seed SQL e nos testes. Os outros 97 critérios foram preservados. São 100 IDs: 90 níveis de 30 sequências e 10 especiais. Cada linha abaixo corresponde a uma definição, inclusive os níveis que ficam ocultos no dossiê quando o nível superior é conquistado.

## Correções aprovadas e aplicadas

1. **Mil no fogo** (arsenal-fogo): exigir somente 1.000 kills por armas de fogo. Remover as três exigências de zero nas outras categorias.
2. **Mil no contato** (arsenal-contato): exigir somente 1.000 kills corpo a corpo. Remover as três exigências de zero nas outras categorias.
3. **Mil sobre rodas** (arsenal-rodas): aplicar a mesma lógica: somente 1.000 kills por veículos. Esta terceira alteração também foi aprovada expressamente.

**Duplicidade identificada:** Mil no contato e Linha de frente — Prata continuam com o marco aprovado de 1.000 kills corpo a corpo. O usuário pediu uma proposta para evitar duas medalhas pelo mesmo feito, preservando a progressão existente. **Proposta adicional, ainda não aplicada:** manter Linha de frente em 100/1.000/5.000 e transformar apenas a especial arsenal-contato em “Dois mil no contato”, com 2.000 kills corpo a corpo. O ID e as 100 posições seriam preservados. O limiar aprovado de 1.000 não foi substituído silenciosamente.

As outras 97 definições ficam como estão. Não proponho reduzir limiares, substituir métricas ausentes, criar ou remover medalhas. **Um mês sem tiros registrados** conserva o zero de armas de fogo porque a ausência de tiros é o próprio feito; exige prova de cobertura completa da vida, além de 30 dias reais no mundo e 100 kills. A implementação atual permanece impedida de concedê-la com dados parciais.

Nenhuma conquista real foi concedida. As três regras foram corrigidas em conjunto com testes de fronteira, antes da primeira ativação. Não será criado mecanismo de preservação de desbloqueios antigos inexistentes.

## Como interpretar os critérios

- Os valores de combate/tempo/distância são da mesma vida. Trocar temporada não reinicia medalhas; outra vida não herda nada.
- “Melhor ... temporada” é a melhor marca em uma temporada oficialmente encerrada desta vida, e não soma de vidas ou pontuação de uma temporada em andamento.
- Tempo em resistência mede **10/50/200 horas jogadas**, não dias de sobrevivência no mundo.
- Território percorrido mede **distância total agregada**. A fonte comprovada não separa caminhada de direção.
- Arsenal diverso conta 10 categorias: machado, contundente, contundente curto, lâmina longa, lâmina curta, lança, desarmado, fogo, veículos e Other. Bronze/Prata/Ouro exigem respectivamente 3/5/8 dessas categorias com ao menos 100 kills cada. Não somar agregados corpo a corpo/total como categorias extras.
- Critérios compostos usam “e”: os dois ou três limiares devem ser atendidos pela mesma vida. Dados ausentes nunca viram zero.
- Presença nas temporadas conta temporadas encerradas vivo; não basta aparecer no ranking. Coroa oficial exige vitória oficial; Último vencedor vivo exige vitória como único classificado vivo; Coroa persistente exige duas vitórias da mesma vida.
- Legado do caído exige morte confirmada; desconexão/offline não satisfaz a condição.

## Revisão individual — 100 definições

| Nº | ID | Medalha | Critério anterior à aprovação | Correção aprovada / decisão | Dependência atual |
|---:|---|---|---|---|---|
| 1 | exterminador.bronze | Exterminador — Bronze | Kills na vida ≥ 100 | Manter. | Origem TTF; ativação segura pendente |
| 2 | exterminador.silver | Exterminador — Prata | Kills na vida ≥ 1.000 | Manter. | Origem TTF; ativação segura pendente |
| 3 | exterminador.gold | Exterminador — Ouro | Kills na vida ≥ 10.000 | Manter. | Origem TTF; ativação segura pendente |
| 4 | atirador.bronze | Atirador — Bronze | Kills por armas de fogo ≥ 100 | Manter. | Origem TTF; ativação segura pendente |
| 5 | atirador.silver | Atirador — Prata | Kills por armas de fogo ≥ 500 | Manter. | Origem TTF; ativação segura pendente |
| 6 | atirador.gold | Atirador — Ouro | Kills por armas de fogo ≥ 2.500 | Manter. | Origem TTF; ativação segura pendente |
| 7 | linha-frente.bronze | Linha de frente — Bronze | Kills corpo a corpo ≥ 100 | Manter. | Origem TTF; ativação segura pendente |
| 8 | linha-frente.silver | Linha de frente — Prata | Kills corpo a corpo ≥ 1.000 | Manter. | Origem TTF; ativação segura pendente |
| 9 | linha-frente.gold | Linha de frente — Ouro | Kills corpo a corpo ≥ 5.000 | Manter. | Origem TTF; ativação segura pendente |
| 10 | impacto-rodas.bronze | Impacto sobre rodas — Bronze | Kills por veículos ≥ 50 | Manter. | Origem TTF; ativação segura pendente |
| 11 | impacto-rodas.silver | Impacto sobre rodas — Prata | Kills por veículos ≥ 500 | Manter. | Origem TTF; ativação segura pendente |
| 12 | impacto-rodas.gold | Impacto sobre rodas — Ouro | Kills por veículos ≥ 2.500 | Manter. | Origem TTF; ativação segura pendente |
| 13 | lenhador.bronze | Fio do machado — Bronze | Kills com machado ≥ 25 | Manter. | Origem TTF; ativação segura pendente |
| 14 | lenhador.silver | Fio do machado — Prata | Kills com machado ≥ 250 | Manter. | Origem TTF; ativação segura pendente |
| 15 | lenhador.gold | Fio do machado — Ouro | Kills com machado ≥ 1.000 | Manter. | Origem TTF; ativação segura pendente |
| 16 | contundente.bronze | Força contundente — Bronze | Kills com arma contundente ≥ 25 | Manter. | Origem TTF; ativação segura pendente |
| 17 | contundente.silver | Força contundente — Prata | Kills com arma contundente ≥ 250 | Manter. | Origem TTF; ativação segura pendente |
| 18 | contundente.gold | Força contundente — Ouro | Kills com arma contundente ≥ 1.000 | Manter. | Origem TTF; ativação segura pendente |
| 19 | impacto-curto.bronze | Impacto curto — Bronze | Kills com arma contundente curta ≥ 25 | Manter. | Origem TTF; ativação segura pendente |
| 20 | impacto-curto.silver | Impacto curto — Prata | Kills com arma contundente curta ≥ 250 | Manter. | Origem TTF; ativação segura pendente |
| 21 | impacto-curto.gold | Impacto curto — Ouro | Kills com arma contundente curta ≥ 1.000 | Manter. | Origem TTF; ativação segura pendente |
| 22 | lamina-longa.bronze | Lâmina longa — Bronze | Kills com lâmina longa ≥ 25 | Manter. | Origem TTF; ativação segura pendente |
| 23 | lamina-longa.silver | Lâmina longa — Prata | Kills com lâmina longa ≥ 250 | Manter. | Origem TTF; ativação segura pendente |
| 24 | lamina-longa.gold | Lâmina longa — Ouro | Kills com lâmina longa ≥ 1.000 | Manter. | Origem TTF; ativação segura pendente |
| 25 | lamina-curta.bronze | Lâmina curta — Bronze | Kills com lâmina curta ≥ 25 | Manter. | Origem TTF; ativação segura pendente |
| 26 | lamina-curta.silver | Lâmina curta — Prata | Kills com lâmina curta ≥ 250 | Manter. | Origem TTF; ativação segura pendente |
| 27 | lamina-curta.gold | Lâmina curta — Ouro | Kills com lâmina curta ≥ 1.000 | Manter. | Origem TTF; ativação segura pendente |
| 28 | lanceiro.bronze | Lanceiro — Bronze | Kills com lança ≥ 25 | Manter. | Origem TTF; ativação segura pendente |
| 29 | lanceiro.silver | Lanceiro — Prata | Kills com lança ≥ 250 | Manter. | Origem TTF; ativação segura pendente |
| 30 | lanceiro.gold | Lanceiro — Ouro | Kills com lança ≥ 1.000 | Manter. | Origem TTF; ativação segura pendente |
| 31 | desarmado.bronze | Último recurso — Bronze | Kills desarmado ≥ 10 | Manter. | Origem TTF; ativação segura pendente |
| 32 | desarmado.silver | Último recurso — Prata | Kills desarmado ≥ 100 | Manter. | Origem TTF; ativação segura pendente |
| 33 | desarmado.gold | Último recurso — Ouro | Kills desarmado ≥ 500 | Manter. | Origem TTF; ativação segura pendente |
| 34 | outros-meios.bronze | Outros meios registrados — Bronze | Kills na categoria Other ≥ 25 | Manter. | Origem TTF; ativação segura pendente |
| 35 | outros-meios.silver | Outros meios registrados — Prata | Kills na categoria Other ≥ 100 | Manter. | Origem TTF; ativação segura pendente |
| 36 | outros-meios.gold | Outros meios registrados — Ouro | Kills na categoria Other ≥ 500 | Manter. | Origem TTF; ativação segura pendente |
| 37 | tempo-ativo.bronze | Tempo em resistência — Bronze | Tempo jogado ≥ 10 h | Manter. | Origem TTF; ativação segura pendente |
| 38 | tempo-ativo.silver | Tempo em resistência — Prata | Tempo jogado ≥ 50 h | Manter. | Origem TTF; ativação segura pendente |
| 39 | tempo-ativo.gold | Tempo em resistência — Ouro | Tempo jogado ≥ 200 h | Manter. | Origem TTF; ativação segura pendente |
| 40 | sobrevivente.bronze | Sobrevivente do mundo — Bronze | Dias no mundo ≥ 7 | Manter. | Métrica ainda não comprovada |
| 41 | sobrevivente.silver | Sobrevivente do mundo — Prata | Dias no mundo ≥ 30 | Manter. | Métrica ainda não comprovada |
| 42 | sobrevivente.gold | Sobrevivente do mundo — Ouro | Dias no mundo ≥ 90 | Manter. | Métrica ainda não comprovada |
| 43 | territorio.bronze | Território percorrido — Bronze | Distância total ≥ 25 km | Manter. | Origem TTF; ativação segura pendente |
| 44 | territorio.silver | Território percorrido — Prata | Distância total ≥ 100 km | Manter. | Origem TTF; ativação segura pendente |
| 45 | territorio.gold | Território percorrido — Ouro | Distância total ≥ 500 km | Manter. | Origem TTF; ativação segura pendente |
| 46 | andarilho.bronze | Andarilho — Bronze | Distância a pé ≥ 10 km | Manter. | Métrica ainda não comprovada |
| 47 | andarilho.silver | Andarilho — Prata | Distância a pé ≥ 50 km | Manter. | Métrica ainda não comprovada |
| 48 | andarilho.gold | Andarilho — Ouro | Distância a pé ≥ 150 km | Manter. | Métrica ainda não comprovada |
| 49 | estradeiro.bronze | Estradeiro — Bronze | Distância dirigida ≥ 50 km | Manter. | Métrica ainda não comprovada |
| 50 | estradeiro.silver | Estradeiro — Prata | Distância dirigida ≥ 250 km | Manter. | Métrica ainda não comprovada |
| 51 | estradeiro.gold | Estradeiro — Ouro | Distância dirigida ≥ 1000 km | Manter. | Métrica ainda não comprovada |
| 52 | temporada-exterminio.bronze | Marca de temporada — Bronze | Melhor pontuação de temporada ≥ 100 | Manter. | Arquivo oficial da vida |
| 53 | temporada-exterminio.silver | Marca de temporada — Prata | Melhor pontuação de temporada ≥ 1.000 | Manter. | Arquivo oficial da vida |
| 54 | temporada-exterminio.gold | Marca de temporada — Ouro | Melhor pontuação de temporada ≥ 5.000 | Manter. | Arquivo oficial da vida |
| 55 | temporada-fogo.bronze | Fogo na temporada — Bronze | Melhor contagem de fogo em temporada ≥ 50 | Manter. | Arquivo oficial da vida |
| 56 | temporada-fogo.silver | Fogo na temporada — Prata | Melhor contagem de fogo em temporada ≥ 500 | Manter. | Arquivo oficial da vida |
| 57 | temporada-fogo.gold | Fogo na temporada — Ouro | Melhor contagem de fogo em temporada ≥ 2.000 | Manter. | Arquivo oficial da vida |
| 58 | temporada-contato.bronze | Contato na temporada — Bronze | Melhor contagem corpo a corpo em temporada ≥ 50 | Manter. | Arquivo oficial da vida |
| 59 | temporada-contato.silver | Contato na temporada — Prata | Melhor contagem corpo a corpo em temporada ≥ 500 | Manter. | Arquivo oficial da vida |
| 60 | temporada-contato.gold | Contato na temporada — Ouro | Melhor contagem corpo a corpo em temporada ≥ 2.000 | Manter. | Arquivo oficial da vida |
| 61 | temporada-rodas.bronze | Rodas na temporada — Bronze | Melhor contagem de veículo em temporada ≥ 25 | Manter. | Arquivo oficial da vida |
| 62 | temporada-rodas.silver | Rodas na temporada — Prata | Melhor contagem de veículo em temporada ≥ 250 | Manter. | Arquivo oficial da vida |
| 63 | temporada-rodas.gold | Rodas na temporada — Ouro | Melhor contagem de veículo em temporada ≥ 1.000 | Manter. | Arquivo oficial da vida |
| 64 | combate-hibrido.bronze | Combate híbrido — Bronze | Kills por armas de fogo ≥ 50 e Kills corpo a corpo ≥ 50 | Manter. | Origem TTF; ativação segura pendente |
| 65 | combate-hibrido.silver | Combate híbrido — Prata | Kills por armas de fogo ≥ 250 e Kills corpo a corpo ≥ 250 | Manter. | Origem TTF; ativação segura pendente |
| 66 | combate-hibrido.gold | Combate híbrido — Ouro | Kills por armas de fogo ≥ 1.000 e Kills corpo a corpo ≥ 1.000 | Manter. | Origem TTF; ativação segura pendente |
| 67 | duas-laminas.bronze | Duas lâminas — Bronze | Kills com lâmina longa ≥ 25 e Kills com lâmina curta ≥ 25 | Manter. | Origem TTF; ativação segura pendente |
| 68 | duas-laminas.silver | Duas lâminas — Prata | Kills com lâmina longa ≥ 100 e Kills com lâmina curta ≥ 100 | Manter. | Origem TTF; ativação segura pendente |
| 69 | duas-laminas.gold | Duas lâminas — Ouro | Kills com lâmina longa ≥ 500 e Kills com lâmina curta ≥ 500 | Manter. | Origem TTF; ativação segura pendente |
| 70 | dois-impactos.bronze | Dois impactos — Bronze | Kills com arma contundente ≥ 25 e Kills com arma contundente curta ≥ 25 | Manter. | Origem TTF; ativação segura pendente |
| 71 | dois-impactos.silver | Dois impactos — Prata | Kills com arma contundente ≥ 100 e Kills com arma contundente curta ≥ 100 | Manter. | Origem TTF; ativação segura pendente |
| 72 | dois-impactos.gold | Dois impactos — Ouro | Kills com arma contundente ≥ 500 e Kills com arma contundente curta ≥ 500 | Manter. | Origem TTF; ativação segura pendente |
| 73 | rodas-fogo.bronze | Rodas e fogo — Bronze | Kills por veículos ≥ 25 e Kills por armas de fogo ≥ 25 | Manter. | Origem TTF; ativação segura pendente |
| 74 | rodas-fogo.silver | Rodas e fogo — Prata | Kills por veículos ≥ 100 e Kills por armas de fogo ≥ 100 | Manter. | Origem TTF; ativação segura pendente |
| 75 | rodas-fogo.gold | Rodas e fogo — Ouro | Kills por veículos ≥ 500 e Kills por armas de fogo ≥ 500 | Manter. | Origem TTF; ativação segura pendente |
| 76 | arsenal-diverso.bronze | Arsenal diverso — Bronze | Categorias com ao menos 100 kills ≥ 3 | Manter. | Origem TTF; ativação segura pendente |
| 77 | arsenal-diverso.silver | Arsenal diverso — Prata | Categorias com ao menos 100 kills ≥ 5 | Manter. | Origem TTF; ativação segura pendente |
| 78 | arsenal-diverso.gold | Arsenal diverso — Ouro | Categorias com ao menos 100 kills ≥ 8 | Manter. | Origem TTF; ativação segura pendente |
| 79 | resistencia-combate.bronze | Resistência em combate — Bronze | Dias no mundo ≥ 7 e Kills na vida ≥ 100 | Manter. | Métrica ainda não comprovada |
| 80 | resistencia-combate.silver | Resistência em combate — Prata | Dias no mundo ≥ 30 e Kills na vida ≥ 1.000 | Manter. | Métrica ainda não comprovada |
| 81 | resistencia-combate.gold | Resistência em combate — Ouro | Dias no mundo ≥ 90 e Kills na vida ≥ 5.000 | Manter. | Métrica ainda não comprovada |
| 82 | trilha-resistente.bronze | Trilha resistente — Bronze | Dias no mundo ≥ 7 e Distância a pé ≥ 10 km | Manter. | Métrica ainda não comprovada |
| 83 | trilha-resistente.silver | Trilha resistente — Prata | Dias no mundo ≥ 30 e Distância a pé ≥ 50 km | Manter. | Métrica ainda não comprovada |
| 84 | trilha-resistente.gold | Trilha resistente — Ouro | Dias no mundo ≥ 90 e Distância a pé ≥ 150 km | Manter. | Métrica ainda não comprovada |
| 85 | estrada-resistente.bronze | Estrada resistente — Bronze | Dias no mundo ≥ 7 e Distância dirigida ≥ 50 km | Manter. | Métrica ainda não comprovada |
| 86 | estrada-resistente.silver | Estrada resistente — Prata | Dias no mundo ≥ 30 e Distância dirigida ≥ 250 km | Manter. | Métrica ainda não comprovada |
| 87 | estrada-resistente.gold | Estrada resistente — Ouro | Dias no mundo ≥ 90 e Distância dirigida ≥ 1000 km | Manter. | Métrica ainda não comprovada |
| 88 | participacao.bronze | Presença nas temporadas — Bronze | Temporadas oficiais concluídas vivo ≥ 1 | Manter. | Arquivo oficial da vida |
| 89 | participacao.silver | Presença nas temporadas — Prata | Temporadas oficiais concluídas vivo ≥ 3 | Manter. | Arquivo oficial da vida |
| 90 | participacao.gold | Presença nas temporadas — Ouro | Temporadas oficiais concluídas vivo ≥ 5 | Manter. | Arquivo oficial da vida |
| 91 | coroa-oficial | Coroa oficial | Vitórias oficiais ≥ 1 | Manter. | Arquivo oficial da vida |
| 92 | ultimo-vencedor | Último vencedor vivo | Vitórias como único vivo classificado ≥ 1 | Manter. | Arquivo oficial da vida |
| 93 | coroa-persistente | Coroa persistente | Vitórias oficiais ≥ 2 | Manter. | Arquivo oficial da vida |
| 94 | arsenal-fogo | Mil no fogo | Kills por armas de fogo ≥ 1.000 e Kills corpo a corpo = 0 e Kills por veículos = 0 e Kills na categoria Other = 0 | Kills por armas de fogo ≥ 1.000; sem restrição nas demais categorias. | Exige cobertura completa da vida |
| 95 | arsenal-contato | Mil no contato | Kills corpo a corpo ≥ 1.000 e Kills por armas de fogo = 0 e Kills por veículos = 0 e Kills na categoria Other = 0 | Kills corpo a corpo ≥ 1.000; sem restrição nas demais categorias. | Exige cobertura completa da vida |
| 96 | arsenal-rodas | Mil sobre rodas | Kills por veículos ≥ 1.000 e Kills por armas de fogo = 0 e Kills corpo a corpo = 0 e Kills na categoria Other = 0 | Kills por veículos ≥ 1.000; sem restrição nas demais categorias. | Exige cobertura completa da vida |
| 97 | tres-frentes | Três frentes | Kills por armas de fogo ≥ 100 e Kills corpo a corpo ≥ 100 e Kills por veículos ≥ 100 | Manter. | Origem TTF; ativação segura pendente |
| 98 | mes-sem-tiros | Um mês sem tiros registrados | Dias no mundo ≥ 30 e Kills na vida ≥ 100 e Kills por armas de fogo = 0 | Manter. | Métrica ainda não comprovada |
| 99 | duas-jornadas | Duas jornadas | Distância a pé ≥ 10 km e Distância dirigida ≥ 100 km | Manter. | Métrica ainda não comprovada |
| 100 | legado-caido | Legado do caído | Morte observada e Dias no mundo ≥ 30 e Kills na vida ≥ 1.000 | Manter. | Métrica ainda não comprovada |

## Disponibilidade e validação

No catálogo apresentado antes da aprovação, 21 definições dependem de dias no mundo ou distâncias separadas ainda não comprovados; 3 especiais exigem cobertura completa por seus zeros; as outras 76 dependem da ativação segura da identidade/coleta e, em 18 casos, do arquivo oficial. São grupos disjuntos. Após as três correções, a divisão passa a 21 definições com métricas ausentes e 79 dependentes da ativação segura/arquivo; não há mais as três especiais bloqueadas por zeros. A regra intencional de zero de Um mês sem tiros permanece entre as 21, também dependente de dias no mundo.

As 100 regras atuais já têm casos positivo e negativo em JavaScript e PostgreSQL descartável. Testar uma regra demonstra que o motor cumpre a definição; não demonstra que a definição é a desejada pelo jogador. Esta revisão trata justamente dessa diferença. A fonte TTF parcial não permite afirmar ausência de ações durante toda a vida nem inventar datas exatas dos feitos.

SHA256 da fonte apresentada na revisão inicial, antes das três correções: 11ef8ef74ca2840f402d3981366ec6835126197ba0c91cf5e9fa4e42b5782db0. Este hash documenta a revisão anterior. O diff aprovado muda somente as três definições indicadas; a proposta de 2.000 ainda não integra o catálogo.
