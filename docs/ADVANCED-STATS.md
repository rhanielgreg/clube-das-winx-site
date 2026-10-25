# Estatísticas avançadas — investigação da Missão 06

## Evidência examinada

Foram lidos `stats.py`, `probe_stats.py`, `collector.py`, schema e testes da cópia local `../Dashboard Zomboid - Clube das Winx`. As **cinco fixtures anonimizadas** contêm TTF_KillStats: todas têm as dez categorias esperadas, e `Vehicle == vehicleKills` em todas. Não contêm TTFStatsGameTimeSeconds. A consistência dessas cinco amostras não comprova comportamento de todos os jogadores, versões do mod ou ciclos de vida. Nenhum dado individual real foi publicado.

O README do coletor registra uma inspeção anterior do Lua instalado que confirmou segundos reais de jogo no contador TTF. Nesta missão não há arquivos Lua/mod.info na cópia local e na árvore de projetos examinada, nem identificação verificável da versão instalada. Portanto essa anotação histórica não foi tratada como nova inspeção do código do mod. As buscas pelos nomes exatos dos campos não localizaram uma fonte pública identificável do mod; não foi associado um mod de nome semelhante por suposição. Não foram acessados SFTP, BisectHosting, Railway ou saves do servidor real.

## Matriz de extração e limites

| Métrica | Fonte/campo real disponível | Unidade e extração | Histórico atual | Trabalho necessário e limite |
| --- | --- | --- | --- | --- |
| Kills totais | TTF_KillStats.categories, conferido contra soma de weapons | Contagem inteira; leitor existente | Estado atual e snapshots por temporada | Apresentação já implementada; base sazonal, não soma de vidas |
| Armas de fogo | categories.Firearm | Contagem inteira; leitor existente | Atual e snapshots | Já apresentada; identidade de vida ainda pendente |
| Corpo a corpo | Axe, LongBlade, SmallBlade, Spear, Blunt, SmallBlunt, Unarmed | Soma inteira validada | Atual e snapshots | Já apresentado; Unarmed participa |
| Veículos | categories.Vehicle e vehicleKills concordantes nas cinco amostras | Contagem inteira extraível nessas amostras | Sem coluna própria; só agregado no total | Versionar coletor/RPC e guardar coluna/baseline/snapshots; ampliar validação antes de afirmar cobertura geral |
| Outras categorias | categories.Other | Contagem inteira extraível nessas amostras | Só agregado no total | Campo próprio se aprovado; total − fogo − corpo a corpo inclui Vehicle **e** Other |
| Horas jogadas | TTFStatsGameTimeSeconds lido pelo coletor; nota anterior do Lua no README | Fonte tratada como segundos jogados; interface divide por 3600 para horas | survival_seconds em atual/snapshots, quando não nulo | Não revalidado por Lua nesta missão; confirmar reset e escopo por vida antes de conquistas temporais |
| Dias no mundo | Nenhum campo desse tipo no contrato atual | Não extraído; não derivar de TTF | Inexistente como métrica validada | A API oficial lista getHoursSurvived; é candidato a instrumentação na origem, não um offset binário validado nem prova da unidade/semântica no build instalado |
| Distância a pé | Nenhuma chave confirmada no material disponível | Unidade não confirmada | Inexistente | Exige fonte/mod instrumentado, unidade, exclusão de teleporte e validação; não somar distância entre snapshots esparsos |
| Distância dirigindo | Nenhuma chave confirmada no material disponível | Unidade não confirmada | Inexistente | Exige distinguir motorista/passageiro/veículo e reset; não usar duração A2S como distância |
| Histórico individual das vidas | Character UUID/key e snapshots existentes | Registro atual, não identidade de vida certificada | Pode haver fusão por nome na origem | source_account_id + source_world_id + source_life_id confiáveis; não dividir ou fundir arquivos antigos por heurística |
| Armas específicas | TTF_KillStats.weapons participa da validação | Contagens por chave TTF, nomenclatura dependente da versão | Não persistidas separadamente | Validar significado das chaves e cobertura de versões antes de novos gráficos/recordes |
| Estado e datas | alive, observed_at, first/last_seen_at, died_at | Estado observado e horários de leitura | Snapshots guardam estado observado | died_at é a primeira observação de morto no coletor, não instante exato da morte no jogo; primeira observação não é nascimento comprovado |

As APIs oficiais confirmam a existência de [IsoGameCharacter.getHoursSurvived](https://projectzomboid.com/modding/zombie/characters/IsoGameCharacter.html#getHoursSurvived()) e [IsoPlayer.getSteamID](https://projectzomboid.com/modding/zombie/characters/IsoPlayer.html#getSteamID()). Isso identifica pontos de investigação na origem, mas não valida sua disponibilidade offline no BLOB lido pelo Python, a versão do servidor, ou um identificador único de vida. SteamID identifica conta; OnlineID não deve ser usado como ID persistente de vida. Não foi implementado um novo parser por adivinhação.

## Contrato proposto, sem alterar coletor ou banco real

Separar observação versionada de métricas validadas:

```text
observation_version: 2
identity: {source_account_id, source_world_id, source_life_id, verification_state}
observed_at: UTC
alive: boolean | null
metrics:
  kills_total: {value: integer|null, unit: count, scope: life, source: TTF, validation_state}
  kills_firearm / kills_melee / kills_vehicle / kills_other: mesma estrutura
  played_seconds: {value: number|null, unit: seconds, scope: a confirmar na origem, validation_state}
  survival_world_days: {value: number|null, unit: world_days, scope: life, validation_state}
  distance_walked_m / distance_vehicle_m: {value: number|null, unit: meters, scope: life, validation_state}
source_version: versão comprovada do jogo/mod/leitor
```

Nomes são propostas de transporte, não chaves que afirmamos existir no save. O emissor deve autenticar a origem; um campo validation_state não é confiável só por chegar no JSON. Aplicar validação de unidade, faixa, categoria/soma, identidade e monotonicidade/reset. Não aceitar tempos ou distâncias fornecidos arbitrariamente por clientes sem verificação.

Persistência futura: campos próprios no atual e nos snapshots; bases sazonais para contadores cumulativos; proveniência/versionamento e NULL para indisponível. Manter snapshots legados sem preenchimento artificial. Alterações de ingestão deverão usar RPC v2 separada, ensaiada com o coletor; não mudar parâmetros da ingestão atual silenciosamente. A UI já possui apresentação condicional para campos adicionais marcados como validados, mas as APIs de produção deste repositório **não fabricam nem anunciam esses novos campos**.

Nenhuma sobrevivência foi calculada a partir de TTF e nenhum contador de veículos foi obtido pela diferença de categorias. Não foram criadas novas métricas reais, rotinas de escrita, tabelas de conquistas ou alterações no coletor.
