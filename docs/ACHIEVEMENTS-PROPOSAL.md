# Catálogo inicial de conquistas — proposta, sem distribuição automática

Nenhuma persistência, migração de medalhas, concessão automática ou coleção de cem ícones foi implementada. Os marcos informativos de contagem já existentes no dossiê não constituem um sistema de conquistas. Títulos de campeão são resultados oficiais aprovados, tratados separadamente no arquivo de temporadas.

## Fontes e critérios candidatos

Contadores atuais confiáveis no contrato: kills sazonais totais, fogo e corpo a corpo; tempo jogado da fonte. A validação do **valor** não certifica a identidade da **vida**. Toda conquista abaixo exige uma fonte validada e atribuição inequívoca antes de ser concedida. Não somar vidas ou temporadas para atingir um limiar de personagem.

| Nº | Nome proposto | Escopo | Critério verificável após validação da identidade |
| --- | --- | --- | --- |
| 1 | Primeiro centenário | Personagem/temporada | kills_total >= 100 |
| 2 | Resistência armada | Personagem/temporada | kills_total >= 500 |
| 3 | Mil contra um | Personagem/temporada | kills_total >= 1.000 |
| 4 | Zona limpa | Personagem/temporada | kills_total >= 5.000 |
| 5 | Dez mil ecos | Personagem/temporada | kills_total >= 10.000 |
| 6 | Mira firme | Personagem/temporada | kills_firearm >= 50 |
| 7 | Fogo contínuo | Personagem/temporada | kills_firearm >= 250 |
| 8 | Arsenal | Personagem/temporada | kills_firearm >= 1.000 |
| 9 | Linha de frente | Personagem/temporada | kills_melee >= 100 |
| 10 | Aço e fôlego | Personagem/temporada | kills_melee >= 500 |
| 11 | Combate próximo | Personagem/temporada | kills_melee >= 2.000 |
| 12 | Turno de resistência | Personagem/vida | played_seconds >= 36.000, origem e reset por vida confirmados |
| 13 | Presença persistente | Personagem/vida | played_seconds >= 180.000, mesma validação; não dias no mundo |
| 14 | Nome no arquivo | Jogador/permanente | Uma vitória oficial vinculada à conta confirmada |
| 15 | Legado de campeões | Jogador/permanente | Três temporadas distintas vencidas oficialmente pela mesma conta confirmada |

As conquistas 1–11 dispõem de colunas e snapshots, mas a atribuição por vida ainda pode ser ambígua. 12–13 dependem também de confirmar que o contador TTF é acumulado por vida e de confirmar o comportamento de reset. 14–15 podem usar resultados oficiais futuros, mas o vínculo permanente de conta ainda não pode depender só de username. Não são conquistas já desbloqueadas pelos jogadores reais.

## Preservação e retroatividade propostas

Modelo futuro: catálogo versionado; livro de concessões imutável com conquista/versão, sujeito (vida ou conta), temporada, valor, unidade, fonte/snapshot, observed_at e awarded_at. Restrição única impede duplicidade. A morte não apaga concessões; uma conta só agrega as conquistas cujas regras sejam explicitamente permanentes. Revogação por dado inválido exige evento de auditoria, não exclusão silenciosa. Isso é desenho de contrato, não SQL executável nem migração preparada nesta missão.

Retroativamente, um snapshot válido que atinge um limiar pode provar **que o limiar já tinha sido alcançado naquela coleta**, se identidade e temporada forem certificadas. Não prova a hora exata do evento; uma primeira coleta já acima do limiar não autoriza inventar o instante do desbloqueio. Pontuação sazonal não prova kills de toda a vida e ausência de snapshot não prova que o feito não ocorreu. Não conceder medalhas retroativas quando houve fusão possível de vidas ou vínculo incerto de conta.

Para expansão até cem, primeiro validar veículos separados, dias no mundo, distâncias e eventos emitidos pela fonte. Cada nova conquista precisa de unidade, escopo, prova, regra de reset, comportamento após morte e estratégia de backfill. Não criar conquistas de morte, ressurreição, exploração ou recorde global a partir de diferenças entre snapshots. Veículos não podem ser calculados como total menos fogo e corpo a corpo, pois sobra também Other. Ranking online não é uma métrica de sobrevivência.
