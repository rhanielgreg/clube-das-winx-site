# Missão Master 12 — execução e limites comprovados

## Escopo preservado

Continuação de main@8bb97f5 e coletor master@5054f30 em branches codex/mission12. Sem redesenho, dossiês, domínio ou serviços novos. Temporada 1 mantém início `2026-10-20T01:05:18.930285Z`, prazo `2026-11-01T02:59:00Z`, estado ativo e encerramento manual. Nenhum encerramento, campeão ou nova temporada foi executado.

## Identidade e origem

- Nova cópia de `players.db` baixada pelo painel BisectHosting, sem escrever no servidor. SQLite íntegro, cinco linhas, três vivos e dois mortos. SHA256 `c89d89f6868c365f61297435bd399181e4d2d5b04a0c27805745d5d718da82a9`.
- Comparada à amostra original `6f4899e1…`: cinco IDs preservados na mesma conta/mundo, uma morte natural, nenhum nascimento/renomeação ou regressão. Comparada à amostra privada de 25/10 às 23h: bytes idênticos, portanto não constitui um novo ciclo do jogo.
- Investigada também a cópia remota `players copy.db` de 19/10, baixada sem alteração: SHA256 `67f0d03b0dfabea94704b1324dd8d644c5a76947b5d23da32d8c4628c9bc4f33`, cinco linhas. Quatro IDs persistem; um antigo está ausente e há um novo. O par pertence à mesma conta/usuário, tem nomes diferentes e ambos foram vistos vivos em suas respectivas cópias. Sem o evento intermediário, isso não distingue morte/renascimento de reidentificação; não é prova de reutilização de nome ou renomeação estável. Cópias e comparação preservadas fora do Git, sem vinculação ao ranking ou concessão retroativa.
- Fontes instaladas conferidas novamente: `TTF_StatsMP_Server.lua` gera ID apenas se ausente (673–715), persiste/carrega por ID e conserva-o ao mudar nomes. Cliente grava o snapshot em modData (91–110). Os três pins SHA256 originais coincidem; bytes originais devem ser baixados para hash — copiar texto do editor pode normalizar as quebras de linha.
- Nova ferramenta **offline** `identity_evidence.py` compara cópias destacadas, rejeita sidecars, não imprime contas/IDs e não autoriza ativação. Não é outro coletor.
- Colisão do mesmo ID em contas distintas agora é rejeitada no leitor e no banco. Nome repetido com ID diferente não herda métricas; renomeação com ID preservado não cria outra vida. Casos testados são sintéticos isolados, não eventos alegadamente observados no servidor.
- **Coorte continua desativada:** falta demonstrar nascimento/reutilização de nome e renomeação reais, além de confirmar um namespace estável da geração do mundo. O rótulo `ProjectZomboidServer` não prova geração após reset. Não foram escolhidos UUIDs operacionais arbitrários, associados registros legados ou redefinidos pontos.

## Leitura SQLite e integridade

Coletor reutiliza conexão, credenciais, pin SSH e agenda existentes. Além do manifesto DB/WAL/SHM/journal antes/depois, compara SHA256 de uma segunda leitura de cada arquivo para detectar reescrita com tamanho/mtime iguais. Rejeita mudança ou journal ativo, repete a coleta e remove somente cópias temporárias locais. Origem permanece estritamente somente leitura. Testes preservam o payload legado de quatro colunas.

010 adiciona índice único mundo/ID de vida e trigger de integridade, sem modificar a ingestão legada, catálogo, ACLs existentes ou habilitação. Rejeita mudança de identidade, progresso após morte e partições completas inconsistentes de kills. A primeira observação da morte aceita o último progresso; leituras seguintes conservam os valores, permitindo somente atualização do horário observado. Recusa reverte também as alterações legadas feitas dentro da mesma transação.

## Métricas

- Fonte TTF reconcilia dez categorias com armas e vehicleKills em cinco linhas. Melee é agregação de sete métodos; Vehicle participa uma vez do total. Não somar agregados a seus componentes.
- API pública adiciona `kill_breakdown`: total preservado, partes comprovadas e residual explicitamente não discriminado. Exemplo público: 342 − 39 − 183 = **120 sem categoria discriminada**, sem chamá-las atropelamentos. Valores ausentes não viram zero; divergência oculta a decomposição. Tooltip no total do Ranking preserva colunas, ordem, MVP e visual.
- Veículos/Other só são apresentados como categorias se a linha possui identidade de vida validada. Escopo sazonal não é misturado com contador vitalício.
- `distanceTracker`: metros de deslocamento agregado, com continuidade na amostra. Código instalado acumula deslocamento e converte metros em km; não separa caminhada/direção. Não publicado enquanto a vida/coorte está bloqueada.
- Cliente TTF usa `getHoursSurvived()/24` em DailySnapshot (220–226), mas o servidor registra uma série diária e um baseline que é atualizado, não um nascimento certificado. Não há valor de idade vitalícia diretamente validado no BLOB pelo leitor atual. Não preencher `survival_world_days` com tempo jogado, diferença de datas civis ou o último dia de uma série esparsa.

## Conquistas e Memorial

Exatamente 100 definições intactas. O motor SQL/persistência existente continua separado da apresentação. Nova API GET `/api/achievements?id=UUID` reutiliza RPC já instalada e só a consulta após `life-v1`; conta todos os níveis e fornece apenas o maior por sequência na coleção visual. Sem identidade comprovada retorna `total_unlocked: null`, lista vazia e estado explícito, não “zero conquistado”. Não concede nada e não reintroduz página de perfil.

A revisão individual e a proposta de apresentação contextual estão em [MISSION12-ACHIEVEMENTS.md](MISSION12-ACHIEVEMENTS.md). Nenhum critério foi alterado. Somente `mes-sem-tiros` contém igualdade numérica a zero; `alive=0` em `legado-caido` representa morte, não proibição de categorias. A proposta de substituição exige decisão de produto.

61 definições dependem apenas de contadores/estado potencialmente presentes na fonte e derivados deles, **condicionadas à identidade e cobertura**. As demais dependem de dias no mundo, distâncias por modalidade ou arquivo oficial. Grupos se sobrepõem: 14 usam dias, 13 distâncias por modo, 18 arquivo oficial. Nenhuma concessão produtiva; Memorial mantém os três reconhecimentos sem vencedor enquanto as provas exigidas forem insuficientes.

## Administração e operação

`ADMIN_EMAIL` permanece ausente em Production; conector do projeto original retorna **403 no escopo greg-s-projects**. Supabase continua com duas contas Auth confirmadas, sem escolha automática de administrador. Greg deve configurar **ADMIN_EMAIL / Production**, com o e-mail da conta que ele legitimamente escolher, e republicar. Nenhuma senha, chave, papel ou whitelist foi alterada.

Testes rejeitam sessão Supabase comum no GET e POST administrativo, antes de qualquer RPC de escrita. GET administrativo passa a consultar a mesma coorte que o Ranking quando life-v1 estiver habilitado; antes usava sempre a legada. Escritas continuam exclusivamente no backend e exigem service_role, sessão autorizada e contrato oficial. Fechamento, ausência de campeão, baselines e arquivo são testados isoladamente nas suítes existentes; não foi executado teste administrativo mutante em produção. Concorrência real entre sessões/PostgREST não foi reensaiada nesta rodada.

## Recuperação

Export consistente repeatable-read do domínio public salvo em pasta privada com ACL já restrita, fora do Git: 15 tabelas, 34 funções, 9.043 snapshots, 1.822 execuções, 100 definições, zero identidades/medalhas. Novo `scripts/rehearse-recovery.js` restaura em PGlite descartável, sem DSN ou rede, compara todas as linhas tipadas, schema, funções e grants por nome, e ensaia 010. Preserva bigint sem arredondar os limites das sequências e normaliza apenas a representação adicional de NOT NULL no PostgreSQL 18 e a ordem de catálogos. Não é backup de auth/storage nem comprova PITR.

Docker local não estava disponível; não se declara ensaio novo em PostgreSQL/PostgREST externos. Backups periódicos externos com retenção continuam dependentes de destino seguro/credencial operacional e teste de restauração completo. Nenhum job fictício ou promessa de monitoramento futuro foi criado.

## Publicação e evidências

Implementação funcional do site **c27635f37f65adba9b1584cbb797b6dbd87e5f08** enviada à main e codex/mission12, por fast-forward, e comprovada em `/api/release` no domínio original. Check Vercel success no projeto greg-s-projects/clubedaswinx: [BqTL6hFVZCfU82Cq13fPS1Yz3JEW](https://vercel.com/greg-s-projects/clubedaswinx/BqTL6hFVZCfU82Cq13fPS1Yz3JEW). Dezenove arquivos públicos coincidem byte a byte com Git; novas APIs e respostas/configuração/rotas conferidas. Três classificados vivos, três históricos mortos; residual120 explícito, calendário manual correto e nenhuma página de medalhas/dossiê reintroduzida. Console público sem erros, sem overflow a1280px. SQL, scripts de recuperação, demonstrações e proposta continuam404 no site.

Coletor **f4221c9e8bab76b34c577801bbcb817654348173** em master/codex/mission12, deployment Railway **1b2358e6-1b67-414a-87bf-2d489f632fe2** successful. Detalhes confirmam repositório correto/master, Dockerfile, python collector.py, cron */5 e Never. Execução agendada real iniciou **26/10/2026 23h35m53 BRT**; logs autenticaram SFTP, abriram/fecharam sessão e sincronizaram cinco personagens às **23h36m02**. O banco confirmou success/records_seen5/erro nulo no mesmo intervalo. Nenhuma credencial, variável ou configuração produtiva foi alterada.

Estado final do banco consultado: 9.073 snapshots, nove personagens históricos/cinco contas internas, zero identidades nativas/observações/medalhas, catálogo100, readinesstrue e life_contractnull. Todos os 9.043 snapshots anteriores foram comparados e permanecem iguais. Não transformar esses históricos legados em vidas comprovadas.

Consultas, cópias, logs de testes e evidências produtivas permanecem fora do pacote público. Atualizações documentais posteriores não mudam o código funcional; o SHA de cada publicação acompanha o marcador público. Não ativar TTF/life-v1 só porque010 foi instalada; seus critérios operacionais continuam obrigatórios.
