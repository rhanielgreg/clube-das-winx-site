# Missão Master consolidada — 27/10/2026

## 1. Diagnóstico inicial e preservação

Site: `main/origin/main=1f1c7f38b147dce2c40c7c2b16dadc2e82468b09`. Coletor: `master/origin/master=4c1e1fc410219eeb48d23a1cf676fa4397aeeab4`. Um checkout por repositório, sem worktrees adicionais. Branches de trabalho `codex/mission14`; alterações locais da Master14 preservadas, inspecionadas e integradas por fast-forward. Nenhum reset, clean, force-push ou alteração de credenciais.

Estado inicial real: migrações001–011; T1 ativa, 100 definições antigas, zero vidas nativas e zero medalhas. Backup pré-alteração com 15 tabelas/10.123 snapshots. Coletor legado operacional; site publicado no SHA1f1c7f3.

| Componente | Estado reconciliado |
|---|---|
| Calendário e resultado winx-v2 | Implementação local reaproveitada e concluída; publicada na primeira etapa |
| Ranking Temporada/Global | Publicados; Global aguarda vidas verificadas |
| Identidade prospectiva | Protegida; falta evidência de geração do mundo e vínculo histórico inequívoco |
| Medalhas | 28 ativas; 100 legadas preservadas/inativas; nenhum desbloqueio real |
| Memorial | Vitrines publicadas; recordistas dependem de métricas/candidatos comparáveis |
| Admin/Auth | Login existente preservado; calendário manual bloqueado; renomeação excepcional auditada |
| Roleta | Ausente no início; implementada e testada nesta continuação; publicação verificada no checkpoint |
| Entrega automática | Bloqueada por identidade online/inventário/idempotência externa não comprovados |

## 2. Implementação

Reaproveitados os arquivos012–014, testes, catálogo28, leitores, frontend e coletor. Concluídos: distinção de tempo sazonal/histórico, desempate sem UUID, deduplicação de eventos de medalhas e renomeação excepcional com justificativa/operador. A ordenação legada permanece observacional, explicitamente sem certificação; não transforma IDs antigos em vidas.

A API `/api/rewards` oferece somente histórico público sanitizado. `/api/admin-rewards` reutiliza a mesma função Vercel por rewrite protegido e um módulo separado de backend, mantendo 12 funções no projeto. Todos os pedidos administrativos validam o usuário no Supabase Auth e o `ADMIN_EMAIL` existente; o cliente não escolhe prêmio, pesos ou operador.

O backend usa `crypto.randomInt()` em duas seleções ponderadas e persiste antes da animação. Constraints/locks garantem um resultado por temporada. Repetição retorna o registro existente, inclusive depois de cancelamento. Catálogo utilizado e resultados são imutáveis. Nomes públicos e classificação oficial são congelados no sorteio; IDs de conta/vida/mundo são referências privadas distintas.

Admin recebe elegibilidade, catálogo, probabilidades, resultado, histórico, cópia de divulgação e entrega manual por componente. Animação9,5s, som opt-out iniciado pelo gesto do usuário e redução de movimento respeitada. F5 recupera o resultado, sem nova rodada. Histórico público fica integrado ao Ranking, sem sorteios demonstrativos em produção.

## 3. Banco e recuperação

- 012: calendário mensal `[início,fim)` em Brasília, arquivos e intervalos incertos, reconciliação com lock comum.
- 013: 28 definições independentes, baselines prospectivos, concessões únicas e Global consolidado por vida/conta.
- 014: contratos antigos serializados/bloqueados, prova de geração e renomeação auditada.
- 015: exportação privada completa. Corrigida omissão dos dados das tabelas novas pelo exportador antigo; nenhuma edição retroativa de migração aplicada.
- 016: catálogo de prêmios, sorteios imutáveis, componentes, máquina de entrega e eventos append-only. Sem chamadas ao jogo.
- 017: consulta administrativa sem janela de36 temporadas; remove prazo indireto para sorteio antigo, preservando integralmente o contrato e os dados.

012–015 foram aplicadas com flags inicialmente desligadas. Backup pós-instalação24 tabelas foi restaurado com equivalência de dados, metadados e grants; depois foram publicados os consumidores e ativados calendário/medalhas em **27/10/2026 17h18m22 BRT**. T1 preserva nome/início real e permanece ativa até01/11/2026 00h00 BRT.

Antes de016: novo backup protegido, 24 tabelas/10.158 snapshots, 28 medalhas ativas e zero vidas/desbloqueios. A restauração e016 foram ensaiadas novamente sobre essa cópia real. Todas as tabelas novas têm RLS e acesso direto revogado para PUBLIC/anon/authenticated/service_role. RPCs privilegiadas são exclusivas de backend/owner; o relógio injetável não é concedido à service_role. O exportador015 inclui automaticamente as tabelas016.

016 aplicada e conferida: backup29 tabelas/70 funções/10.168 snapshots restaurado com equivalência exata. Todos os10.158 snapshots anteriores permanecem byte a byte equivalentes na representação JSON;100 definições históricas preservadas, T1 com nome/início/estado/prazo inalterados nesta etapa, RPCs de premiação inacessíveis a anon/authenticated. Catálogo de prêmios ativo, zero sorteios/vidas/medalhas reais. Relatório privado de preservação salvo fora do Git.

Backups e fontes estão no diretório privado protegido já existente, fora do Git. Ensaio usa PGlite sem DSN externo: cobre schema public, não Auth/Storage. CLI Docker disponível sem daemon/Desktop; não houve teste real com múltiplas sessões PostgreSQL. As chamadas concorrentes em PGlite são serializadas; locks, unicidade e reentrância foram exercitados, sem alegar equivalência de transporte.

## 4. Testes

188/188 na suíte completa Node22.23.4 e188/188 Node24.15.0; 39/39 Python. Comandos: `node --test`, Node22 existente com `--test`, `python -B -m unittest discover -s ../clube-das-winx-collector -p test*.py`, `npm run test:catalog`, `git diff --check` e ensaios `scripts/rehearse-recovery.js`.

Calendário civil, fronteiras, repetição, indisponibilidade, empate, Apocalipse/pendência, baseline, vidas sucessivas, Global e ACLs cobertos. Roleta: distribuição determinística45/30/20/4/1, pesos internos, catálogo incompleto, prêmio inválido, duplo clique/abas/timeout, persistência, imutabilidade, morte, identidade errada, coleta defasada, pacote parcial e reconciliação. APIs rejeitam acesso sem autorização e ocultam referências privadas da leitura pública.

Navegador isolado executou a API real e PostgreSQL com campeão sintético, identificado por banner, sem rede externa: animação, recarga, apresentação390px, início de tentativa e confirmação manual. Isso não é um sorteio nem entrega produtivos. Prévia sobre backup real também preservou Ranking/Memorial sem inventar medalhas ou recordistas.

## 5. Publicação

Primeira etapa confirmada: site `f1c5919e3770df66f5e2bb76e1553f1df7773070`, Vercel `2qtEbHWzzQUHSNcFdYLwGZMmvzMx`; coletor `8a376bc2c67bd2ba1855294b1d844da2f9a771a2`, Railway `a1757f34-0832-4ba9-8383-4787f1eb4a47`, master/cron5min. Logs17h25 e17h30: autenticação SFTP normal e cinco personagens sincronizados após ativação.

A etapa de premiações foi publicada em `ff0a481813ffa3e80f4180f02907d57083fc23b9`, Vercel `CfBw1PQx9Dfm7sSSHmHJYWAR1vuQ`, e validada no domínio original: páginas200, APIs atuais, saúde healthy, rota administrativa403 anônima, SQL/backup/backend/fixtures404 e seis assets equivalentes ao Git. Admin autenticado validado somente em leitura: catálogo ativo, sorteio de T1 e encerramento legado desabilitados, sem erros de console. 017 aplicada depois e confirmada por consulta/ACL; teste com38 temporadas aprovado. O checkpoint registra essa revisão sucessora. O SHA corrente é exposto em `/api/release`; um push/build sozinho não é usado como prova de produção.

## 6. Catálogo e entrega

Versão `season-prizes-v1-b42.21.0`. Probabilidades fixas por raridade; pesos condicionais abaixo:

| Raridade | Prêmio | Peso interno | Probabilidade total |
|---|---|---:|---:|
| Comum45% | 1×Base.Crowbar | 70 | 31,5% |
| Comum45% | 1×Base.Hammer | 30 | 13,5% |
| Incomum30% | 1×Base.Bag_ALICEpack_Army | 100 | 30% |
| Rara20% | 1×Base.Hammer +1×Base.Axe | 100 | 20% |
| Épica4% | 1×Base.Machete | 100 | 4% |
| Lendária1% | 1×Base.Katana | 100 | 1% |

Build42.21.0 comprovada no server-console.txt. Seis IDs comprovados nos scripts instalados `media/scripts/generated/items/weapon.txt` e `container.txt`, com hashes registrados no catálogo e cópias privadas. `scripts/verify-reward-sources.js` confronta build, hashes e declarações. Pesos e SQL sincronizados automaticamente. Usar nova versão para mudar catálogo já utilizado; rever compatibilidade se a build mudar. Nenhum mod de itens/veículo é necessário. Condição padrão: máxima não comprovada.

O log real mostra RCON escutando em27015. O provedor documenta [additem e console](https://help.bisecthosting.com/hc/en-us/articles/41062340050843-Project-Zomboid-Console-Commands), mas isso não comprova identidade exata online, inventário ou execução exatamente uma vez. Nenhuma credencial RCON foi solicitada/configurada, nenhum comando de criação enviado. BIKO não participa.

Entrega manual: conferir conta Steam e vida nativa exata diretamente na origem, viva/online; atualizar dados; iniciar tentativa no Admin; executar o procedimento administrativo autorizado fora do site; registrar evidência de cada componente. O painel não executa o comando. Um retorno sem erro não comprova inventário. Se houver incerteza, registrar como tal e reconciliar cada componente antes de outra tentativa; componente confirmado não pode ser reaberto. Morte comprovada cancela direito material pendente, preserva sorteio e impede transferência.

A unicidade no banco protege o sorteio/registro, não promete exactly-once para ações humanas ou comandos externos. Confirmação manual é identificada explicitamente. Veículos e entrega automática permanecem desabilitados; não foi criado executor inseguro.

## 7. Pendências reais

Falta namespace inequívoco da geração do mundo e ponte verificável dos históricos: `life-v1` continua desligado. Bruce preserva o mesmo ID/conteúdo TTF em duas leituras; o registro é histórico, não prova de presença online agora. Pasta TTF reúne registros anteriores. Nome do mundo, worldVersion249 e timestamps não certificam geração única. Nada foi alterado no jogo.

Sem coorte verificada, Global não fabrica totais, medalhas não recebem progresso real e reconhecimentos do Memorial não proclamam recordistas. O motor não retroativo está implantado, mas nenhum baseline/desbloqueio produtivo existe. A virada calendárica está ativa; um resultado poderá permanecer pendente se a fonte não certificar população, sobrevivência e competência temporal. A roleta respeita esse bloqueio.

Não há campeão oficial a sortear enquanto T1 está aberta. Nenhum sorteio/entrega real foi produzido só para teste. A sessão Admin disponível foi validada, sem solicitar senha nem alterar autenticação.

## 8. Veredito por componente

Calendário, contrato de resultado, abas, catálogo28, vitrines e guardas: implementados/publicados na primeira etapa. Certificação oficial/Global com totais/medalhas reais/recordistas: aguardam evidência, não são apresentados como operacionais com dados inexistentes. Roleta e registro manual: implementados/testados/publicados; o primeiro uso real depende de campeão/vida certificados. Entrega automática e veículos: não habilitados por ausência dos controles necessários; não há efeitos externos executados.
