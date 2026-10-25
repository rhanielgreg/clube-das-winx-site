# Missão Master 07 — checkpoint consolidado

## Missão 08 — go-live em execução (25/10/2026)

Este bloco substitui os impedimentos e estados históricos da Missão 07 abaixo.

- Autorização expressa de integração/deploy confirmada. Publicação do site será pelo GitHub/main do Greg, sem procurar/criar projeto na Vercel pessoal do usuário.
- Backup lógico protegido fora do Git, com recuperação ensaiada em PostgreSQL 17 isolado sem rede. Dados, funções, ACLs, tabelas, defaults e sequências conferidos; precisão de bigint preservada por export como texto. Auth/storage não são escopo dessas migrações.
- Migrações aplicadas/confirmadas: 002, 003, 004, 006, 005 e 007, nessa ordem. A 001 já estava aplicada. A 007 preparou a ativação, ainda sem habilitar a coorte; ranking legado produtivo continua com quatro vivos. Evidências de cada transação foram salvas fora do Git.
- 003 exclui registros antigos marcados vivos quando a conta tem observação mais recente morta/desconhecida. Resultado produtivo conferido: quatro vivos. Dados legados não foram apagados.
- Expansão antes da troca: novos perfis life-v1 ficam fora da competição legada até um lote nativo completo ser confirmado. A ativação privada exige sucesso recente, quantidade esperada e identidade/métricas da mesma execução. Não há associação de histórico por nome.
- Pontos de cada perfil novo começam na primeira leitura validada; totais TTF observados são mostrados separadamente. Registros, pontos e temporadas legados permanecem intactos, sem atribuição retroativa incerta.
- Marcador público 006 permite ao frontend comprovar contratos instalados/ativados usando as credenciais públicas existentes. Nenhum RPC v2 é liberado pela mera existência de um commit. Nenhum segredo Vercel foi alterado.
- Catálogo continua com 100 definições. Mil no contato/fogo/rodas conservam 1.000 sem zeros obrigatórios. Somente Linha de frente — Prata foi ajustada para 2.500 para remover a coincidência com Mil no contato, conforme instrução 08.
- Contador do ranking usa tentativa real, cron UTC confirmado e relógio do servidor com Age do cache. Ao chegar a zero, espera confirmação; não simula coleta nem reinicia por refresh. Fixtures/dados demo, backups e SQL internos excluídos do pacote Vercel.
- Ensaios: 70/70 Node 22 e 70/70 Node 24, incluindo o marcador público; 22 testes Python também na imagem Docker 3.12.15; quatro offline TTF. PostgreSQL 17 + PostgREST reais em rede isolada processaram cinco registros da cópia real: quatro vivos, vinte desbloqueios somente no ensaio, replay sem duplicação. Valores de todos os registros legados preservados.
- Coletor integrado por fast-forward a master e enviado: **5054f307b9594b09eb858d54cb3c9144f67aba62**. Railway comprovou o SHA/branch, build Docker e duas execuções posteriores com SFTP normal e cinco sincronizações, ainda em modo legado. Não foi alterada credencial, salt, servidor, save ou mod.
- Site ainda em preparação para push/main; estado público anterior registrado: home/ranking/APIs 200, Memorial e /api/release 404. Resultado da publicação será registrado após a tentativa real.

---

Atualizado em 25/10/2026. Continuação do trabalho existente, com as Missões 03–06 preservadas. Este documento registra o estado atual; os checkpoints anteriores permanecem históricos.

## Produção confirmada e preservada

- Supabase: projeto `clube-das-winx`, referência `nykhcytysswjdynjosib`, organização de Greg, branch main/PRODUCTION. Sessão administrativa utilizada legitimamente pelo SQL Editor; nenhuma credencial foi copiada para o chat ou Git.
- **001 aplicada manualmente em 25/10, às 15:55 BRT**, após inventário de ACL, definição e papéis. Ingestão tem 11 argumentos; estatísticas de execução mostraram chamadas legítimas como service_role. PUBLIC/anon/authenticated perderam EXECUTE; service_role conservou. A definição da função e as permissões das leituras públicas permaneceram iguais. Contagens de linhas antes/depois não mudaram. Essa aplicação manual não equivale a registrar automaticamente a migração no histórico Supabase.
- SHA256 normalizado do SQL 001 executado: `c8b1f0a49c1c0f02cd85e0c2496d5bf10c56319933509aedd7b9fab608558144`. MD5 da definição de ingestão antes/depois: `8354bb28b0def62d2a214381f4e12d6c`; fingerprint dos ACLs get_public: `aadf424f5b583b019d27c5ccc07209c2`.
- Railway: projeto `heartfelt-surprise`, serviço `winx-ranking-collector`, ambiente production. Repositório legítimo do coletor, branch **master**, Dockerfile/Python 3.12, comando `python collector.py`, cron `*/5 * * * *`, política Never. A feature branch codex/mission07 não é a branch conectada ao autodeploy. Configuração observada no provedor prevalece sobre suposições baseadas em railway.json.
- A falha SFTP por senha antecedia a correção de ACL. **O usuário corrigiu a credencial e concluiu o deploy produtivo. O agente não alterou credenciais.** Sucesso às 16:20:14 BRT: cinco personagens, quatro vivos e um morto. Comparação somente leitura confirmou counters, hashes dos blobs, cálculo sazonal e concordância de snapshots/current.
- Nova consulta em 25/10 às 17:44 BRT confirmou **cinco execuções consecutivas bem-sucedidas**, todas com cinco registros; última observação às 17:40:43.947 BRT, quatro vivos, um morto, nenhum desconhecido. anon continua sem ingestão; service_role autorizado. A tabela life_identities ainda não existe.
- Verificação final somente leitura às **18:06 BRT**: últimas cinco execuções ainda bem-sucedidas, cinco registros em cada; última coleta finalizada às **18:05:13.557 BRT**, snapshot às 18:05:11.318, quatro vivos/um morto/zero desconhecidos. Permissões seguem anon=false e service_role=true; life_identities permanece ausente.
- Nenhuma migração estrutural 002–005 foi aplicada. Nenhum novo leitor foi ativado, nenhuma conquista real foi concedida e nenhum novo código de frontend/coletor foi implantado pelo agente. Nesta retomada, as operações externas foram exclusivamente leitura/download. Servidor do jogo, credenciais e cadência da coleta foram preservados.

## Git e preservação

- Site: `rhanielgreg/clube-das-winx-site`, base `main@31aa1675808a31f0c6785fe0a90c2e289599e3f5`. Commits anteriores da missão `3c5b711` e `8caeefd` enviados a origin/codex/mission07. main remota não foi alterada.
- Coletor: clone legítimo irmão `clube-das-winx-collector`, remoto `rhanielgreg/clube-das-winx-collector`, base `master@07dde5c07a89e5f48b05bf45aa5a2700b5b86093`. Commit local anterior `556e9e9`, preservado. A antiga extração Dashboard Zomboid - Clube das Winx continua intacta.
- Correções desta retomada versionadas e enviadas: site **ce9466bc41dbc656c351abec9c3e3eed85a74144**; coletor **5f6ca271c4f222af52816745bd654239c922d3dc**, incluindo o commit 556e9e9 anterior. Hashes remotos conferidos. Ambas as árvores ficaram limpas e passaram a acompanhar origin/codex/mission07. O registro final de documentação é um commit posterior do site.
- Branch dos dois: **codex/mission07**. Alterações locais retomadas sem reset/stash destrutivo, acrescidas apenas das correções e verificações autorizadas. Os hashes finais de versionamento são apresentados na entrega.
- Site possui `git.deploymentEnabled: {"codex/mission07":false}` em vercel.json. Push da feature branch não é promoção para produção. Sem merge, main/master push, PR, promoção de domínio ou comando de deploy nesta retomada.
- Identidade visual, imagens originais e funcionalidades das Missões 03–06 preservadas. Snapshot local anterior à 07 em node_modules/.mission07-before.zip, ignorado pelo Git; não é backup do banco real.

## Identidade das vidas — evidência e limite

A variante habilitada inspecionada é **twistonfirestatsmpstable**, diretório 42.19. A origem existente fornece TTFStatsMP.characterID; não foi instalado emissor/mod novo. Fonte instalada lida somente por download:

- TTF_StatsMP_Server.lua, linhas 673–715: lê o ID do modData; somente se ausente gera ID com nomes sanitizados, timestamp e aleatório; guarda/transmite. Se o ID muda, carrega/cria outro registro persistente. O nome não é a chave usada pelo leitor novo.
- Mesmo arquivo, linhas 1182–1207: desconexão salva o registro da vida; morte marca/salva o mesmo ID. O código não apaga o ID na morte.
- TTF_StatsMP_Client.lua, linhas 91–110: o snapshot do servidor grava ID/usuário no modData; restaura contadores e distância. OnCreatePlayer solicita inicialização/snapshot. Isso é evidência do código instalado, não ensaio de eventos no jogo.
- SQLite networkPlayers contém steamid/world além do blob. SteamID de 17 dígitos é preservado como inteiro/string; float é rejeitado para evitar arredondamento. Nome/rowid não substituem identidade.
- Duas cópias de players.db baixadas em momentos distintos: cinco linhas, cinco IDs distintos, cinco associações conta/mundo preservadas, cinco leituras nativas válidas, cinco distâncias presentes. SHA256 de ambas: `6f4899e1051eab9ce946b3b6a87fbf6add4448ca02611c8e02c6b4b6e6787f68`. SQLite íntegro, sem WAL/SHM na listagem e journal vazio.
- **As cópias são idênticas. Portanto não comprovam um ciclo novo de nascimento/morte/reconexão/renomeação.** A validação definitiva dessas transições continua pendente de observação natural ou homologação controlada autorizada. Não se matou/criou personagem, reiniciou ou alterou o jogo para produzir evidência.

O leitor opt-in **ttf-mp-v1** reutiliza o SFTP existente e valida três fontes Lua por SHA256 antes de aceitar dados. Hashes completos em ttf_saved_life.py; mudança de fonte bloqueia o modo até revisão. Exige namespace UUID estável e explícito da origem/geração do mundo. Deriva mundo por UUIDv5 e anonimiza conta/vida com HMAC e salt privado. Não gera namespace por execução. ID ausente/incompatível, conta inexata, duplicação ou contador inválido falham sem fallback por nome. Morte revertida ou regressão são rejeitadas na ingestão SQL.

WinxLifeV1 continua como contrato assinado alternativo, também desativado. Não se deve trocar entre os dois modos depois da ativação sem um mapeamento de identidades comprovado; seus tokens não são intercambiáveis. Nenhum emissor futuro foi instalado. A preparação dos dois modos não certifica automaticamente vidas reais no banco.

## Métricas e correções desta retomada

- Fonte TTF comprovada: categorias de kills, veículos incluídos uma única vez, tempo jogado em segundos e distanceTracker em metros de deslocamento agregado. Lua instalado faz acumulação e conversão metros/km; não diferencia caminhada/direção. Não converter tempo jogado em dias do mundo.
- Cobertura desde o nascimento não foi demonstrada: o mod pode ter sido instalado no meio da vida. Métricas nativas recebem observed_lower_bound; nenhum zero prova ausência de ações por toda a vida. Homenagens globais que exigem cobertura completa continuam protegidas.
- Campos ausentes, eventos entre observações e datas exatas de feitos não são inventados. Não houve backfill por coincidência de nome.
- **Corrigido baseline de tempo em 004:** a função real antiga converte tempo ausente em zero e difere da fixture original. Colunas próprias baseline_played_seconds/source_played_seconds evitam usar esse zero como dado da temporada; snapshot sem tempo fica nulo, último tempo vitalício conhecido é preservado. Primeiro valor conhecido estabelece baseline, sem crédito retroativo. Correção ainda não aplicada em produção.
- Fixture sanitizada da função real em tests/fixtures/ingest-production-20261025.sql, sem linhas/contas/segredos. Teste executa esse corpo com 001–005 e verifica cálculos e ausência de tempo.
- **Corrigido Dockerfile do coletor:** inclui verified_life.py e ttf_saved_life.py, importados por collector.py. Sem isso um deploy futuro falharia por módulo ausente. Teste confere empacotamento. Não houve rebuild/deploy produtivo novo.
- Leitura SQLite nativa retorna seis colunas; modos anteriores conservam quatro. Testes verificam ambas e a preservação exata do SteamID. IDs desconhecidos não viram vivos/mortos por inferência.
- Corrigida a apresentação do próximo nível: ordenação por level_rank impede saltar Prata quando o SQL ordena IDs alfabeticamente; especiais concluídas não anunciam próximo nível. Teste cobre os dois casos. Ajustados também dois textos do dossiê: monograma não afirma que a identidade está pendente quando a vida já está validada; explicação de veículos acompanha a existência da categoria, sem prometer uma separação que já está exibida.

## Catálogo de 100 — aprovação e aplicação

A revisão de **todas as 100 definições** está em ACHIEVEMENTS-REVIEW07.md: 30 sequências × 3 níveis e 10 especiais. O catálogo não foi recriado.

Após aprovação expressa do usuário em 25/10, somente três critérios foram corrigidos, na fonte, no seed SQL e nos testes:

- Mil no fogo: 1.000 kills de fogo, independentemente dos demais métodos.
- Mil no contato: 1.000 kills corpo a corpo, independentemente dos demais métodos.
- Mil sobre rodas: 1.000 kills por veículos, independentemente dos demais métodos.

As exigências de zero nas outras categorias foram removidas. Os demais 97 critérios permanecem iguais. O marco aprovado de 1.000 em Mil no contato coincide com Linha de frente — Prata. **Proposta adicional ainda não aplicada:** especial Dois mil no contato, com 2.000, conservando a progressão 100/1.000/5.000. Nenhum limiar diferente foi introduzido sem aprovação.

Não há conquistas reais antigas a migrar; nenhum mecanismo adicional de preservação de desbloqueios inexistentes foi criado. Catálogo versão 1 ainda não foi implantado no banco real.

- **100 regras implementadas/testadas localmente; 0 desbloqueios reais.** Depois da correção, 21 definições dependem de dias no mundo/distâncias separadas ainda não comprovados; outras 79 aguardam ativação segura de identidade/observações e, em 18 casos, arquivo oficial. Os grupos 21/79 são disjuntos. Um mês sem tiros conserva o zero intencional, cobertura completa e dias no mundo: continua bloqueado com fonte parcial.
- Maior nível de cada sequência é exibido, todos contam no total. Medalhas pertencem à mesma vida após morte/troca de temporada e não são herdadas. Dossiê recolhido, filtros e SVG locais; sem página global /conquistas.

## Contratos e transição ainda não liberada

- Regras oficiais, APIs e SQL implementados: só vivos confirmados competem, pontuação sazonal, desempate determinístico, possibilidade de O Apocalipse Venceu, histórico congelado. Estado desconhecido/antigo ou coleta falha bloqueia encerramento; nenhuma chamada usa encerramento legado como fallback.
- RPCs oficiais exigem COMPETITION_RULES_VERSION=winx-v1 após 003; vida exige também LIFE_CONTRACT_VERSION=life-v1 após 004/005. Coletor novo consulta get_service_pipeline_readiness_v1 antes de coletar/gravar. Nenhuma dessas habilitações foi aplicada em produção.
- 002–005 continuam pendentes. 004 é aditiva, mas exige comparação integral do schema real e recuperação. **005 muda a população oficial** e pode excluir participantes legados: não aplicar sem namespace/origem validados, coorte reconciliada e janela coordenada com encerramento bloqueado. Não apagar registros antigos para resolver ambiguidades.
- O painel Supabase indicou No backups e No repository connected. Não presumir aplicação SQL por Git push. Inventário da ACL/definição permite recuperar a mudança limitada de permissões; **não é backup completo do banco**. Antes de mudanças estruturais, obter export consistente de schema/dados/permissões e testar restauração isolada.
- Ensaios locais usam PGlite. PostgREST real, cache de schema e concorrência entre conexões PostgreSQL reais ainda precisam de homologação. O bootstrap schema.sql do coletor é só para banco vazio, recusa reaplicação e não substitui migrações.
- Recuperação: falha transacional reverte a unidade. Após COMMIT, desabilitar clientes novos, preservar tabelas/arquivo e aplicar correção compatível ensaiada. Não reabrir PUBLIC, não fazer fallback por nome, não apagar histórico e não reaplicar bootstrap em banco existente.
- Vercel: ainda falta comprovar o projeto/equipe que atende clubedaswinx-delta, a branch, as variáveis por ambiente e a correspondência de versão/domínio. O conector anterior não localizou o destino. Não se declarou que a feature branch já corresponde ao site publicado.

## Testes e limites

- Suíte final desta correção: **65/65 testes aprovados em Node 22.23.4 e 65/65 em Node 24.15.0**, sem ignorados, incluindo as 100 fronteiras positivas/negativas JS/SQL, três marcos com métodos mistos e cobertura parcial, fixture do corpo SQL real e integração dos leitores Python → SQL real → API real → dossiê (somente transporte PostgREST simulado). Auditoria npm sem vulnerabilidades; catálogo com 100 definições sincronizadas e comparação confirmou 97 critérios intactos.
- Coletor: **21 testes Python aprovados**, mais quatro offline de composição TTF. Execução local Python 3.14.5; Docker produtivo usa 3.12. Build real da imagem ainda não ensaiado nesta máquina.
- Compatibilidade bootstrap/001–005 e catálogo conferidas. Reaplicação das migrações/idempotência, morte/regressão/replay/ACL e gate de liberação são testados em banco descartável. Não são testes de carga/concorrência distribuída.
- Revisão no navegador: dossiê desktop e viewport de 390 px, expansão/filtro de combate e próximo nível Prata conferidos; sem overflow horizontal detectado e sem erros de console na sessão local. Tamanho de teste removido; prévia nova aberta em 1280 px.
- Prévia local isolada sem env/proxy/serviços reais. Cenário achievements usa PostgreSQL em memória com 100 definições e 29 medalhas fictícias em duas observações. Nada dessa demonstração foi enviado ao Supabase.
- O primeiro teste novo de SQLite no Windows detectou uma conexão aberta no próprio teste; fechamento explícito corrigido, suíte final verde. Uma expectativa antiga que exigia zero nas especiais foi substituída pelo caso intencional de Um mês sem tiros, preservando a proteção de cobertura. Nenhuma falha final permanece.
- Evidências agregadas e cópias SQLite estão fora do Git. Arquivos de mundo/mod/configuração nunca são versionados pelo projeto. Inventário limitado de recuperação e screenshots são preservados em artefatos locais, sem segredos.

## Visualização e operações restantes

`npm.cmd run preview`, usando Node 22, abre somente loopback: http://127.0.0.1:4173/.
Dossiê de demonstração: http://127.0.0.1:4173/jogador?id=20000000-0000-4000-8000-000000000001&scenario=achievements.

Próximas operações concretas: observar transições reais de IDs sem interferir no jogo; confirmar namespace/geração do mundo; garantir recuperação/restauração e homologar contratos reais; coordenar 002–005/coorte e ativação; comprovar destino Vercel e só então publicar componentes compatíveis. A proposta adicional de marco 2.000 permanece separada das três correções já autorizadas.

Não solicitar senhas/tokens no chat. Reutilizar sessões legítimas ou secret stores; SFTP funcional não deve ser reconfigurado. As sessões BisectHosting e Supabase foram usadas legitimamente nesta retomada, sem escritas na origem ou no banco real.
