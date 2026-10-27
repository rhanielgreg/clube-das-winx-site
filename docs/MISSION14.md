# Master 14 e missão consolidada — implementação em continuidade

Base preservada: site `1f1c7f3`, coletor `4c1e1fc`, branches de trabalho `codex/mission14`. Nenhum arquivo anterior restaurado ou descartado. A missão consolidada acrescenta premiações ao escopo existente; a publicação da virada mensal tem prioridade.

## Contratos e implantação

012 cria calendário/arquivo winx-v2, fronteiras exclusivas, reconciliação transacional idempotente e certificação conservadora. Corrige somente o prazo lógico da T1 para 01/11/2026 03:00Z; início real, nome e estado ativo são preservados. Helpers com relógio injetável são privados e indisponíveis à service_role; produção usa somente now(). O cron Railway existente chama reconciliação antes da origem, antes e depois da ingestão.

013 mantém as 100 definições antigas e suas referências; introduz 28 IDs independentes. Ativação explícita torna 100 inativas/28 ativas. Baselines persistem por vida/métrica, com hash e timestamp da primeira leitura posterior à ativação. Ausência, regressão e leitura fora de ordem não criam progresso. Medalhas de campeonato usam apenas arquivos oficiais posteriores à ativação; empate não concede coroa. Nunca converter medalhas antigas automaticamente.

014 serializa a entrada dos RPCs legados com o mesmo lock do calendário, bloqueia comandos manuais concorrentes e exige evidência de geração do mundo para novas identidades. Renomeação excepcional exige backend autorizado, justificativa e auditoria; não muda datas nem reabre resultados.

Ordem segura: backup/restauração → 012–014 com flags desligadas → coletor compatível → frontend/API compatíveis → ativação explícita mensal/medalhas → consultas e coleta reais. Não habilitar life-v1 sem evidência. Uma temporada pode encerrar logicamente e permanecer pendente de certificação; a próxima continua pelo calendário.

## Apresentação e limites

Abas Temporada/Global e vitrines compactas preservam a identidade visual. Global soma uma vez cada vida verificada por conta, sem snapshots/temporadas duplicados e sempre informa cobertura parcial. Sem vidas verificadas, informa indisponibilidade sem fabricar totais. Tempo legado histórico não é tempo competitivo e não desempata a temporada; distância sazonal permanece ausente sem prova. Reconhecimentos históricos do Memorial são independentes do baseline das medalhas e exigem candidatos comparáveis completos.

Leitura autenticada da BisectHosting em 27/10 confirmou o mesmo ID completo e conteúdo do registro TTF de Bruce preservado na Missão13, com isDead=false. A pasta TTF global contém registros de mundos/períodos anteriores. WorldDictionaryLog informa nome do mundo, worldVersion249 e timestamps, sem identificador certificado da geração. map_worldgen.bin existe, mas seu conteúdo/semântica de geração ainda não foram comprovados. Nenhum arquivo do servidor alterado; nenhuma instrumentação instalada. A unidade metros de distanceTracker está comprovada no código instalado do mod; não certifica por si só a associação da vida.

## Verificação

166/166 Node22.23.4 e 166/166 Node24.15.0; 39/39 Python; catálogos100/28 sincronizados. Calendário civil, limites, desempate, pendências, baselines, Global, arquivo, ACLs e intervenção auditada cobertos. PGlite executa PostgreSQL isolado, mas suas chamadas simultâneas são serializadas: não equivale a teste de transporte com múltiplas sessões PostgreSQL. Docker existe, daemon indisponível; não alterado.

Backup público consistente protegido fora do Git: 15 tabelas, 10.123 snapshots, 2.037 execuções, 100 definições, zero vidas/medalhas nativas. Restauração ensaiada com equivalência de dados/metadados/ACLs e migrações012–014. O ensaio cobre schema public, não Auth/Storage. Prévia em cópia real restaurada, sem rede de escrita, conferida em desktop e largura390px; estado de indisponibilidade é explícito.

Migrações012–015 instaladas no projeto correto em 27/10, flags inicialmente desligadas. 015 corrige o exportador legado, cuja estrutura incluía tabelas novas mas os dados eram uma lista fixa: agora todas as tabelas public são exportadas na mesma consulta consistente. `scripts/recovery-export-v2.sql` é a entrada completa. Backup pós-instalação: 24 tabelas/24 conjuntos de dados, 10.128 snapshots, RLS nas tabelas novas. Verificação de publicação e ativação deve ser registrada no checkpoint após evidência efetiva, sem substituir testes simulados por alegação produtiva.
