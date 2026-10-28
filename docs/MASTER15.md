# Master15 — calendário seguro e refinamento do Admin

Base preservada: site `119c517c778a3d53aca63bf0acf9e500906710fb`, coletor `8a376bc2c67bd2ba1855294b1d844da2f9a771a2`. Implementação na branch `codex/mission15`, sem alterações no coletor ou no servidor de jogo. A revisão produtiva deve ser comprovada por `/api/release`, GitHub/Vercel e comparação dos assets, não deduzida deste documento.

## P0 — virada e certificação

- T1 permanece ativa. Início exato preservado: `2026-10-20T01:05:18.930285Z`. Fim exclusivo: `2026-11-01T03:00:00Z`, meia-noite de Brasília. Não houve fechamento antecipado.
- Corrigida exclusivamente a apresentação de `seasonDeadline`: não subtrai mais um minuto. SQL de calendário e ingestão preservado. Countdown continua calculado pela fronteira real; zero não muda o banco.
- Nome oficial `Temporada 1 — O Início de Uma Jornada` registrado pelo formulário produtivo existente, backend `ADMIN_EMAIL` e RPC auditada `rename_monthly_season_v2`. Uma linha de auditoria confirmada; operador passado pelo backend a partir da sessão validada. Datas e estado ativo conferidos depois da operação.
- Liderança explicitamente provisória; tempo sazonal nulo aparece como não certificado. Nenhum tempo histórico foi usado como desempate. Controles legados de reset/encerramento/início retirados da UI; negativas409 continuam verificadas na API.
- PostgreSQL17 isolado, oito conexões independentes: uma única transição T1→T2, inclusive com certificação anterior pendente; fronteiras adjacentes, meses perdidos e fevereiro bissexto. Relógio injetável continua privado ao proprietário; `service_role`, `anon` e `authenticated` não podem usá-lo.

### Parecer de identidade: fontes e limites

| Fonte real | Evidência obtida | Limite |
|---|---|---|
| `players.db` baixado somente em leitura nesta missão | SQLite válido; cinco linhas; SteamIDs de17 dígitos, `TTFStatsMP.characterID` único serializado no blob da própria linha, username compatível. Cinco IDs/contas iguais à cópia anterior; três vivos e dois mortos. Sem regressão de contadores. | O arquivo inteiro é idêntico ao anterior, não uma nova observação de atividade. Demonstra persistência da amostra, não nascimento, presença online ou estabilidade sob reset. |
| Ponte TTF↔linha SQLite | Associação pelo campo serializado e conta; não por nome. SHA256 atual `c89d89f6868c365f61297435bd399181e4d2d5b04a0c27805745d5d718da82a9`. | Não autoriza ligar todos os UUIDs legados à mesma vida/geração. A guarda observacional do coletor continua sem promover identidade. |
| Arquivos TTF e WorldDictionary previamente preservados | ID completo de uma vida já correlacionado ao arquivo salvo; pasta global contém registros de vários períodos. WorldDictionary traz nome, versão e datas. | Registro salvo offline não comprova presença atual. Nome, worldVersion249 e datas não atestam geração única. |
| BisectHosting, Backups diários | Interface mostrou backups de24,25 e26/10; slots configuráveis vazios. Nenhum restore/configuração acionado. | Não apareceu cópia de criação/anterior à abertura da T1. Inventário não prova conteúdo nem ausência de backups externos. |
| BisectHosting, Registro de atividades→Reinstalar | Nenhum evento exibido no filtro consultado. | Ausência nessa consulta não prova que nunca houve reset, reinstalação ou substituição do save. |
| `map_worldgen.bin`, ResetID/ServerPlayerID | Não foram usados como certificado da geração. | Nenhum desses valores isolados resolve continuidade, população completa ou fronteira temporal. |
| Supabase e cron produtivos | `life_enabled=false`, zero source_epochs/vidas nativas/baselines/desbloqueios/sorteios; calendário habilitado. Coleta pública saudável, cinco registros por ciclo observado. | Sucesso da leitura SFTP não certifica frescor dos dados do personagem nem prova sobrevivência na fronteira. |

**Conclusão:** as fontes acessíveis não permitem certificar integralmente outubro. É possível comprovar a ponte de cinco linhas atuais; não a população completa da T1, sua geração do mundo ou os contadores exatos em19/10 e01/11. Amostras de cinco em cinco minutos com incremento atravessando a fronteira deixam intervalo incerto. T1 deve continuar `pending_certification` quando o reconciliador não conseguir prova suficiente; nunca substituir por campeão provisório.

Recurso histórico específico faltante: cópia íntegra do save e `players.db` anterior/na abertura de19/10, logs autoritativos de criação/reset daquela geração e trilha que vincule geração, conta, ID TTF e vidas arquivadas, incluindo participantes offline. Uma cópia posterior do mesmo arquivo não resolve a perda de cobertura. Nenhuma credencial nova é solicitada.

Caminho prospectivo mínimo, **não instalado**: manifesto atestado da geração ao criar/resetar mundo; ID por vida emitido/persistido no servidor com vínculo à conta e sem reaproveitamento; eventos de criação/morte/heartbeat com horário autoritativo e sequências monotônicas; população completa declarada; contador/baseline ou amostra certificada na fronteira mensal; persistência de gaps e reconciliação. Validar em ambiente de jogo isolado e só depois propor habilitar coorte. Não inserir namespace aleatório ou atestar o passado retroativamente.

## P1 — implementação

Admin reorganizado em navegação interna: visão geral, campeonato, roleta, catálogo/histórico, Memorial/medalhas, sistema e auditoria. Assets, Auth, ADMIN_EMAIL, footer e endpoints existentes preservados. Nome excepcional fica em Sistema→Operações avançadas. Foco/teclado, estados vazios e links internos com recarga preservados.

Roda permanente com cinco segmentos45/30/20/4/1, ponteiro fixo e marca existente. Prévia não chama POST, RNG nem gera request_id. Elegibilidade vem da API/banco. Resultado persistido precede a animação9,5s; som opt-out e redução de movimento preservados. Histórico e FSM privada de entrega por componente permanecem operacionais. A amostra visual mostra seis das recompensas atuais e remete ao catálogo completo; não limita a seleção do backend a essas seis.

Telemetria usa `/api/collection-health`, `/api/status` e prova privada do backend, com fonte/horário/expiração. Coleta não é presença online; SFTP é inferido do resultado registrado, não conexão direta atual. ACLs são consulta pontual de escopo explícito, não auditoria de todo o schema ou monitor contínuo. Falha/ausência de prova não vira indicador verde. Nenhuma função Vercel adicional.

### Migrações aditivas

**018 aplicada e verificada:** restringe DTO SQL público aos sete campos aprovados; remove operação de entrega da leitura pública. Novo `get_service_operations_v1` somente `service_role`, chamado pelo backend após autenticação Admin. UI e API públicas também filtram `delivery_state`. FSM, tabelas e eventos privados não foram alterados.

**019 aplicada e verificada:** adiciona catálogo `season-prizes-v2-b42.21.0`,24 recompensas/30 componentes/23 IDs únicos. Mantém v1 com seis recompensas, inativa, definição intacta. Ativação transacional com guarda contra versão ativa inesperada e divergência de definição; snapshots de prêmios anteriores intactos. Migrações001–017 não reescritas.

Raridades fixas45/30/20/4/1. Pesos internos totalizam100 em cada raridade. Chance individual = chance da raridade × peso / soma. Raras têm exatamente dois componentes; lendária só uma katana; nenhuma marreta épica, veículo ou executor automático. Armas de fogo somente épicas, uma unidade e sem munição adicional. Condição padrão; máxima não comprovada. Não houve criação de item ou ensaio físico no jogo produtivo.

Fontes instaladas relidas em27/10, pelo editor/clipboard, **sem salvar alterações**:

- `/media/scripts/generated/items/weapon.txt`: SHA256 `742414e701d360a9076099f9842bd9cc65c2d9ba9497af8b0ce470ee147467c5`.
- `/media/scripts/generated/items/container.txt`: SHA256 `4904a61c83411b4c41d196e517097f5981b2a76c300bc33abc78c86e721f65da`.
- Iguais às cópias protegidas da Build42.21.0, comprovada no log preservado. Somente IDs declarados no móduloBase entraram. `scripts/verify-reward-sources.js` valida hashes, Build e cada declaração. Entrega manual usa o procedimento administrativo existente com conferência da mesma vida e evidência por componente; nenhuma entrega física é declarada como testada.

## Recuperação e testes

- Backup inicial:29 tabelas,70 funções,10.403 observações; restauração e igualdade de dados/metadados/grants no PGlite. Também restaurado no PostgreSQL17 real isolado, com igualdade dos dados das29 tabelas.
- Backup imediatamente pré-migrações:10.448 observações,2.102 execuções e uma renomeação auditada; ensaio018/019 sobre ele aprovado. Comparação de dados do ensaio real preservou todas as10.403 observações da cópia inicial. O export cobre schema público da aplicação; não substitui backup integral de Auth/Storage.
- Node22.23.4 e Node24.15.0:193 testes por versão, sem falhas/ignorados na execução registrada. Python do coletor:39/39. Catálogos legados100/ativos28 preservados, sincronização JS/SQL conferida.
- `scripts/test-postgres-concurrency.py`: múltiplas conexões independentes em PostgreSQL17, container `winx-master15-postgres`, rede `none`, sem portas publicadas e sem DSN produtivo. Cobre sorteios concorrentes, idempotência, interrupção de transporte depois de commit, morte concorrente, entrega parcial/incerta/conclusão por componente, ACLs, calendário e namespace desconhecido. A saída final registra a contagem efetiva.
- Interface de cópia real restaurada: áreas overview/roulette/catalog em1440/1600,768 e390px, nove combinações sem overflow do documento após corrigir mínimo intrínseco da sidebar. Barras internas de navegação/tabela são intencionais. Fixture sintética separada para persistência→animação→F5→mesmo resultado; sem ligação externa. Capturas locais têm indicação de prévia; capturas produtivas são identificadas separadamente no relatório de entrega.

## Publicação e pendências reais

Publicar pelo `main` do repositório original, integração Vercel deGreg; não criar projeto/domínio nem contornar autorização. Confirmar depois: SHA de `/api/release`, check/deployment, bytes dos assets, Admin autenticado, API pública sanitizada, cron saudável e T1 ativa. Coletor permanece no SHA8a376bc e no deployment Railway existente; nenhuma necessidade de novo push/redeploy de coletor.

Não implementado por falta de prova: habilitação life-v1, Global/medalhas reais sem coorte certificada, recuperação integral do resultado da T1, entrega automática, veículos e comandos deBIKO. Nenhum sorteio oficial de teste, campeão artificial, exclusão histórica, mudança de senha/credencial ou alteração no servidor de jogo foi feita.
