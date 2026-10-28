# Master16 — Admin, rastreabilidade e prontidão da virada

Base: site `463f45b846eec956c8c806be2a475d8b4b880e21`, branch `codex/mission16`; coletor `8a376bc2c67bd2ba1855294b1d844da2f9a771a2`, sem alterações. A versão publicada deve ser confirmada em `/api/release` e pelos assets; este documento não substitui essa comprovação.

## Escopo preservado e P0

T1: início `2026-10-20T01:05:18.930285Z`; fim **exclusivo** `2026-11-01T03:00:00Z` (01/11, 00h00 BRT). Nenhuma alteração no SQL do calendário, no cron, nos critérios das medalhas, no catálogo de recompensas ou no coletor. Sem antecipação, campeão inventado, concessão, sorteio produtivo de teste, ativação de `life-v1`, entrega automática ou veículos.

PostgreSQL17.11 real, container descartável `winx-master15-postgres`, rede `none`, nenhuma porta publicada: **38 verificações**, conexões independentes. Oito sessões criam uma única T2; retries não duplicam a temporada; resultado pendente não impede o mês seguinte; primeira leitura exatamente na fronteira pertence à T2 e inicia seu baseline; leitura seguinte acumula somente o incremento posterior. Pontuação e snapshots da T1 e seu arquivo congelado permanecem intactos. Leitura atrasada anterior à fronteira é rejeitada; não é silenciosamente atribuída à T2. Também foram testados meses perdidos, fevereiro bissexto, ACLs e transporte interrompido após commit. Relógio injetável segue privado ao proprietário, inacessível a `service_role`/visitantes.

**Isto é ensaio isolado. A virada produtiva de 01/11 ainda é futura.** O zero do contador no navegador não realiza escrita. O ciclo Railway continua responsável pela reconciliação antes/depois da coleta.

## Banco e recuperação

Única migração nova: `020_admin_readonly_audit.sql`, RPC `get_service_admin_audit_v1(bigint,integer)`, estável, somente leitura, `search_path` vazio, execução exclusiva de `service_role`. A rota existente `/api/admin` verifica o token e `ADMIN_EMAIL` antes da projeção. Não há nova função Vercel, tabela, acesso direto a dados privados, alteração de Auth ou reescrita das migrações001–019.

Paginação limitada a50, cursor validado como bigint positivo, projeção explícita: horário, tipo, temporada, nomes anterior/novo, resultado, papel genérico do operador e justificativa sanitizada. UUID/email do operador e payload bruto não saem. Justificativas com padrões de credenciais, e-mail, SteamID ou identificadores longos são omitidas integralmente. Valores de apresentação continuam escapados no HTML. A mesma consulta retorna contagens reais para o resumo Memorial; ausência de resposta vira desconhecido, nunca zero presumido.

Backup consistente anterior: **29 tabelas, 71 funções, 10.653 snapshots e 2.143 execuções**. Restaurado em PostgreSQL17 e PGlite, com equivalência de linhas, funções e permissões nominais. Migração020 ensaiada antes de aplicação. Cópia imediatamente posterior: **72 funções, 10.668 snapshots**. Comparação: todas as71 funções anteriores e metadados/ACLs das29 tabelas intactos; todos os10.653 snapshots anteriores iguais; datas/estado da T1, catálogo v1/v2, definições100/28, flags, auditoria anterior e históricos competitivos preservados. Crescimento dos snapshots decorre das coletas normais. Backups ficam fora do Git em área privada; abrangem o schema aplicativo `public`, não Auth/Storage.

API pública de premiações continua com sete campos permitidos; nenhum `delivery_state`, componentes, evidência, UUID de vida ou operador. A entrega privada e sua FSM permanecem atrás da verificação administrativa.

## Matriz integral dos29 itens

Classes da auditoria: DC=defeito confirmado; PV=problema visual/usabilidade; SF=sem prova funcional; BI=bloqueio intencional; MO=melhoria opcional. “Corrigido” abaixo descreve código e ensaio; SHA, deploy, capturas e resultados produtivos são registrados na entrega após publicação.

| ID | Tela / classe | Resposta e evidência verificável |
|---|---|---|
| 01 | Visão geral · PV | KPI usa número curto; nome completo fica no cartão; calendário detalhado recolhido. `admin.html`, `admin.js`; conferência responsiva. |
| 02 | Visão geral · DC | Removida mensagem enganosa “Sem recompensa descrita”; explicada premiação condicionada à certificação. Nota legada opcional separada. |
| 03 | Visão geral · PV | Miniroleta com altura natural; grid alinhado ao início. `admin.css`; sem card vazio esticado. |
| 04 | Visão geral · PV | Infraestrutura separada da certificação competitiva; SFTP com último sucesso, sem afirmar conexão ao vivo. |
| 05 | Campeonato · PV | Faixa compacta de calendário/regras e tabela priorizada; histórico com texto legível. |
| 06 | Campeonato · PV | Cabeçalho “Posição observada”, sem apresentação como título oficial. |
| 07 | Campeonato · PV | “Vivo/Morto na última observação”, com horário da leitura e legenda distinguindo presença online. |
| 08 | Campeonato · BI/P0 | NULL sazonal preservado, célula `—`, legenda única, CSV vazio. Sem uso de tempo histórico no desempate. Testes de contrato/CSV. |
| 09 | Campeonato · SF | CSV UTF8+BOM, ponto e vírgula, aspas/fórmulas protegidas em todas as células; mantém primeiras9 colunas e acrescenta temporada/consulta/escopo. Ordem do snapshot preservada. |
| 10 | Roleta · DC | Legenda externa explícita para4% e1%; geometria45/30/20/4/1 intacta. `reward-presentation.js`; testes de probabilidades. |
| 11 | Roleta · PV/MO | Identidade rosa/preto, ponteiro fixo, marca central e fallback por categoria preservados; sem ícones de itens não verificados. |
| 12 | Roleta · SF | Sem reprodução sem seleção: fundo do rótulo transparente; `::selection` rosa (`rgb(241,43,145)`) confirmado no navegador. Nenhuma mudança indevida por artefato de seleção. |
| 13 | Roleta · BI/P0 | Prévia permanece disponível; sorteio da T1 bloqueado no backend. Renderização não emite POST nem escolhe resultado. |
| 14 | Roleta · SF | Fixture local valida persistência antes da animação, F5 e resultado recuperável; PostgreSQL testa interrupção pós-commit e concorrência. Timeout da requisição limitado; atualização obrigatória antes de nova tentativa. Movimento reduzido emulado em fixture: resultado em346ms, sem animação longa; som alternado/mudo preservado. Sem sorteio produtivo. |
| 15 | Catálogo · PV | Até3 grupos legíveis no desktop,2 em larguras intermediárias,1 no celular; tipografia maior. |
| 16 | Catálogo · DC/PV | Busca sem distinção de acentos, filtro de raridade, contagem, limpar e vazio; ordem e chances calculadas sobre o catálogo completo. |
| 17 | Catálogo · PV | Verificação geral por versão, sem24 linhas verdes repetidas; tipo individual/kit e detalhes recolhidos. |
| 18 | Catálogo · PV | Histórico contém apenas sorteios persistidos; temporadas sem sorteio ficam em bloco separado. |
| 19 | Catálogo · PV | Estado vazio explica disponibilidade após sorteio; removido botão de entrega inativo sem objeto real. FSM privada preservada. |
| 20 | Memorial · PV | Três cartões: certificação, catálogo/concessões, acervo legado. Reconhecimentos especiais sem nomes fictícios. Título interno sem duplicar H1. |
| 21 | Memorial · PV/BI | “Vidas certificadas no pipeline” com contagem real; não equivale a população do servidor. Desconhecido aparece como `—`. |
| 22 | Memorial · SF | `/memorial` preservado; criado destino real `#medalhas` no ranking com referência dos critérios existentes, sem criar desbloqueios. |
| 23 | Telemetria · DC | Atualizar sinais consulta novamente `/api/admin` autenticado, além das duas fontes públicas. Atualização de60s/retorno à aba não recria formulários de entrega. |
| 24 | Telemetria · PV | Matriz legível de4 verificações, escopo, origem e horário próprios. Não afirma auditoria integral do schema. |
| 25 | Telemetria · SF | Prova privada expira em90s; timestamp ausente/futuro/antigo é neutro; falha parcial não conserva verde por omissão. Unitários e UI com503/timeout local: matriz privada fica neutra; fonte pública parcial não atesta servidor. |
| 26 | Auditoria · DC | Eventos existentes sanitizados e paginados, incluindo renomeação anterior da T1; RPC020 e GET privado sem escrita. |
| 27 | Auditoria · SF | “Reconsultar prova” autenticado e horário atualizado; visibilidade/periodicidade reconsultam sem executar reconciliação. |
| 28 | Todas · PV/SF | Texto operacional14px, metadados12–13px, alvos44px, foco, hashes, back/forward e larguras320/390/768/1440/1600. 35 combinações sem overflow e com foco correto. Zoom nativo por atalhos não teve efeito no IAB; ensaiar escala/refluxo equivalente125/200% separadamente e registrar esta limitação, sem alegar zoom nativo. |
| 29 | Todas · BI/P0 + SF futuro | Ensaiado; evento real ainda não observável. Identidade/campeão permanecem bloqueados até evidência. Checklist de01/11 abaixo. |

## Identidade — amostra por vida e limites históricos

Novo download somente leitura de `players.db` na BisectHosting, sem alterar arquivos/serviço: SHA256 `c89d89f6868c365f61297435bd399181e4d2d5b04a0c27805745d5d718da82a9`, idêntico ao da Master15. Cinco linhas válidas, cinco IDs TTF únicos ancorados no blob da própria linha e contas de17 dígitos; sem regressões, troca de conta, renomeação ou IDs novos. Identidade da amostra é **parcial**, não certificação retroativa.

| Amostra anonimizada | Conta17↔TTF no blob | Persistência na cópia | Estado observado | Geração | Abertura T1 | População completa/offline | Baseline/fronteira |
|---|---|---|---|---|---|---|---|
| A | Comprovada | Comprovada | Vivo | Ausente | Ausente | Ausente | Ausente |
| B | Comprovada | Comprovada | Vivo | Ausente | Ausente | Ausente | Ausente |
| C | Comprovada | Comprovada | Morto | Ausente | Ausente | Ausente | Ausente |
| D | Comprovada | Comprovada | Vivo | Ausente | Ausente | Ausente | Ausente |
| E | Comprovada | Comprovada | Morto | Ausente | Ausente | Ausente | Ausente |

Total da amostra:3 vivos e2 mortos. A matriz privada registra os cinco estados sem publicar SteamID/TTF. Arquivo idêntico não prova nova atividade nem presença online. TTF salvo global, nome do mundo, datas do save, worldVersion, `map_worldgen.bin` isolado e lista de backups não demonstram continuidade de geração, população inteira e contadores na abertura/fronteira da T1. Nenhum UUID legado foi associado por nome. Nenhuma estatística incerta foi promovida a sazonal.

Para certificação retroativa faltam cópias consistentes autenticáveis na abertura da T1 e nas fronteiras, população abrangente e prova independente de continuidade/reset da geração. Se essas fontes não existirem, não é possível reconstruir o campeonato com os dados atuais. Não falta uma “permissão genérica”: falta evidência histórica específica.

Projeto prospectivo **somente documentado, não instalado**: identificador de geração persistente criado em ponto de inicialização comprovado, registro explícito de reset, vínculo Steam↔ID de vida no evento real de nascimento/morte, contadores/unidades/versão e timestamp confiáveis, cobertura offline e manifesto de integridade; validação de reinício, respawn e reset em servidor isolado antes de qualquer autorização para instalação. Não usar nomes ou mtime como certificado, nem rebatizar arquivo antigo como geração nova.

## Verificação futura da virada real

1. **31/10,23h50–23h59 BRT:** GET de release, ranking/temporadas e saúde da coleta; leitura privada de ciclos/flags. Confirmar T1 ainda ativa, prazo exclusivo03h00Z, cron*/5 e último sucesso. Guardar horários e cópia consistente privada.
2. **01/11,00h00 BRT:** observar a fronteira. Zero no browser pode anteceder a conclusão do próximo cron; não clicar em encerramento manual nem alterar relógio.
3. **Após o primeiro cron concluído,00h00–00h06:** verificar exatamente uma T2 ativa com início03h00Z e T1 logicamente encerrada na mesma fronteira; T1 pode legitimamente continuar `pending_certification`.
4. Conferir primeira leitura da T2, baseline e incremento seguinte; nenhum snapshot anterior transferido de mês; arquivo e totais da T1 preservados. Confirmar segundo ciclo,00h05–00h11, e idempotência da rotina.
5. Caso falhe: preservar execução/erro e consultar intervalos/estado, sem edições destrutivas. Reexecução normal só usa relógio real da RPC produtiva; nunca expor `reconcile_months_at_v2` ou usar T1 como fixture.
6. Só atribuir campeão após população, vida viva, geração e fronteiras certificadas. Sem prova, manter pendente; sem vivo elegível comprovado, resultado pode não ter campeão. Sorteio/entrega continuam subordinados às guardas existentes.

## Evidências e validação

Artefatos privados `master16-*` fora do Git: backups anterior/posterior, equivalência, restauraçãoPG17/PGlite, testesNode22/24, Python,38 testesPG17, matriz de vidas anonimizada, medidas responsivas e capturas reais. Comandos principais:

```text
node --test                           # Node24:198; Node22:198
python -B -m unittest discover -s ../clube-das-winx-collector -p test*.py  #39
python -B scripts/test-postgres-concurrency.py                         #38
npm run test:catalog
npm run check:collector-schema
node scripts/rehearse-recovery.js <backup-privado> migrations/020_admin_readonly_audit.sql
git diff --check
```

Falhas intermediárias preservadas: teste antigo de prova ACL sem timestamp corrigido para exigir horário real; descrição de temporada pendente separada do histórico sem perder elegibilidade; aspas erradas no script novo de concorrência corrigidas; teste de catálogo inicialmente sem ativação passou após ativação **somente da fixture**. Nenhuma dessas falhas foi tratada como sucesso produtivo.

Prévia navegável, somente leitura, baseada em cópia real restaurada: `node scripts/preview-master15.js <backup-privado>` em `http://127.0.0.1:4179/admin`. O nome do script foi preservado por compatibilidade. Ela informa claramente que datas do backup não são produção. Sorteios, testes de entrega e cenários sintéticos usam outro processo/banco isolado, sem rede externa.

Rollback do site: voltar a servir a revisão anterior pelo projeto Vercel original se houver regressão comprovada. A RPC020 é aditiva, não exige desfazer dados ou migrações para o frontend antigo funcionar. Não executar rollback destrutivo do banco; Auth, históricos e coleta permanecem preservados.

### Limites da conferência de zoom

Os atalhos de zoom enviados ao navegador embutido não alteraram sua escala (pixelRatio e largura CSS iguais). As larguras320–1600px e o foco foram testados realmente. O harness local `/__viewport?width=1440&scale=1.25&section=overview` (ou `scale=2`) permite ensaio explícito de escala/refluxo equivalente, sem modificar CSS ou preferências produtivas. Esse ensaio não deve ser rotulado como zoom nativo do navegador. A conferência nativa125/200% permanece distinguida no relatório.

Conferência visual produtiva identificou um ajuste adicional de acessibilidade: contêineres das tabelas agora recebem foco para rolagem horizontal por teclado. O resumo RLS foi encurtado; o escopo completo fica recolhido junto à matriz, sem parágrafo duplicado. Nenhuma migração adicional.
