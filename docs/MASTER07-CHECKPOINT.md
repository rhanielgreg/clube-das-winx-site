# Missão Master 07 — checkpoint consolidado

Atualizado em 25/10/2026. Implementação local; integração e publicação reais **bloqueadas por acesso**. Este documento atualiza o estado dos checkpoints 03–06, que ficam preservados como histórico.

## Repositórios e preservação

- Site: `rhanielgreg/clube-das-winx-site`, base `main@31aa1675808a31f0c6785fe0a90c2e289599e3f5`.
- Coletor: clone legítimo irmão `clube-das-winx-collector`, remoto `rhanielgreg/clube-das-winx-collector`, base `master@07dde5c07a89e5f48b05bf45aa5a2700b5b86093`.
- Branch de trabalho nos dois: `codex/mission07`. A extração antiga `Dashboard Zomboid - Clube das Winx` permanece intacta.
- Missões 03–06 preservadas, inclusive mudanças ainda não versionadas antes desta missão. Snapshot local anterior à 07 em `node_modules/.mission07-before.zip` (ignorado; não é backup do banco real).
- `git ls-remote` confirmou bases remotas inalteradas antes do versionamento. Permissão Git de escrita verificada por dry-run. O conector GitHub retorna 404 para estes repositórios; a autenticação Git local tem acesso.
- Vercel: branch `codex/mission07` com `git.deploymentEnabled=false` no código. Nenhuma promoção de domínio autorizada por esta configuração. O destino real ainda não está acessível pelo conector.
- Railway: vínculo/branch efetivamente implantados desconhecidos. Push do coletor deve aguardar comprovação de que esta branch não dispara implantação. Não confiar em `[skip ci]` como bloqueio universal de deploy.
- Site implementado no commit `3c5b71129ad00b4eab3c4d474a2301ac5a94ec7b`, enviado para `origin/codex/mission07`; hash remoto conferido. Este checkpoint recebe registro complementar em commit de documentação. `main` não foi alterada e não foi aberto PR.
- Coletor salvo no commit local `556e9e9340c66740738921acc98358814d4931a3`; árvore limpa, ainda sem push pela restrição de autodeploy não verificado. `master` remoto permanece na base examinada.
- Nenhum comando de deploy, promoção ou migração produtiva foi executado. Configurações reais de Vercel, Railway, Supabase e BisectHosting não foram alteradas. Sem acesso ao projeto Vercel correto, não é possível inspecionar eventos automáticos no provedor; o bloqueio por branch está versionado e a publicação real continua não declarada.

## O que está implementado

- Regras oficiais: só vivos confirmados competem; offline não altera elegibilidade. Um representante por conta/vida certificada. Pontuação usa diferença sazonal, não total vitalício. Desempate: kills DESC, tempo jogado registrado DESC NULLS LAST, UUID ASC. O tempo de desempate não é chamado de sobrevivência no mundo.
- Encerramento trava durante coleta, após falha não recuperada, observação desconhecida/antiga ou ausência de pontuação. Todos os participantes certificados mortos com evidência suficiente: **O Apocalipse Venceu**, sem campeão. Arquivo de temporadas anteriores não é recalculado.
- `004`: identidade de vida, observações, catálogo, desbloqueios, veículo/Other sazonal e congelamento das novas categorias. Sem backfill por nome.
- `005`: ranking somente da coorte certificada; Memorial preserva mortos legados sem conceder identidade falsa; homenagens globais exigem cobertura de todos os mortos para a métrica. Empates preservados; métrica incompleta bloqueia o destaque correspondente.
- APIs de vida apenas com `COMPETITION_RULES_VERSION=winx-v1` e `LIFE_CONTRACT_VERSION=life-v1`. DTO valida catálogo, métricas/unidades e remove dados privados. Falha no contrato não chama lógica antiga de encerramento.
- Dossiê distingue kills na vida e na temporada, mostra até 90 observações vitalícias cronológicas, categorias, distâncias, dias no mundo, arquivo de participação e melhor pontuação oficial quando comprovados. Links discretos entre vidas exigem a mesma identidade certificada. Nada é associado por nome.
- Conquistas recolhidas, filtro por categoria, medalhas SVG locais bronze/prata/ouro e especiais. Maior nível de cada sequência é exibido, todos os níveis contam no total. Datas de evidência e reconhecimento separadas da data desconhecida do feito. Sem página global de conquistas.
- Identidade visual cinematográfica, fundos e imagens anteriores preservados. Refinamentos aprovados 03–06 mantidos. Não houve nova reformulação.
- Zod da cadeia Vercel corrigido com override restrito a `@vercel/cli-config`, versão 4.6.7; consumidor testado. Auditoria npm atual sem alertas.

## Identidade e limites da origem

`WinxLifeV1` é um **contrato futuro opt-in**, não um campo alegadamente existente no TTF. Não foi instalado emissor/mod, nem alterado arquivo do servidor do jogo.

O emissor autorizado deverá fornecer UUID do mundo e da vida, conta Steam, vínculo assinado ao nome/usuário/estado da linha SQLite, timestamp e métricas tipadas. HMAC-SHA256 cobre os bytes UTF-8 exatos de `payload_json`; envelope com assinatura e tamanho limitado. O coletor verifica antes de usar e anonimiza conta/vida com salt privado. Renomear conserva vida; nome reutilizado com novo UUID cria outra vida. Valores/unidades inválidos, morte revertida na mesma vida e regressão de contador são rejeitados.

Para reutilizar contadores TTF, a declaração assinada precisa atestar escopo vitalício e SHA256 da representação canônica dos contadores (`json.dumps(...,sort_keys=True,separators=(',',':'))`). Sem essa declaração não se presume escopo. Igualdade a zero exige cobertura completa da vida e métricas da mesma observação. Mortos legados sem envelope permanecem no histórico antigo; vivo/desconhecido sem envelope faz a coleta nova falhar antes do envio.

**O emissor real e seu ciclo nascimento/morte/reinício precisam ser investigados e validados.** Instalar ou modificar mod/save exige autorização adicional expressa. O contrato preparado não resolve a ausência dessa fonte.

## Estatísticas e catálogo de 100

- Cinco fragmentos reais anonimizados do TTF comprovam composição das kills e inclusão dos veículos uma única vez. As fixtures não comprovam identidade vitalícia, unidade de distância ou dias no mundo da instalação atual.
- Tempo jogado em segundos permanece separado de dias sobrevividos no mundo. Não há conversão entre eles.
- Contadores vitalícios verificáveis, quando disponíveis, ficam em `life_identities.metrics`; snapshots esparsos ficam em `life_observations`. Os últimos valores conhecidos não são convertidos em eventos narrativos. Pontos históricos sem métrica não recebem zero artificial.
- Veículos e Other possuem baseline próprio na temporada; colunas novas de temporadas encerradas ficam nulas, sem diferença inventada. Reconhecimento de medalhas ocorre na ingestão válida seguinte ou pela avaliação privada explícita após o encerramento. Nenhum pedido público grava medalhas.
- Catálogo: **100 IDs únicos = 30 sequências × 3 níveis + 10 especiais**. JSON SQL gerado de `public/achievements-catalog.js`, conferido por `npm.cmd run test:catalog`.
- **100 regras implementadas e verificadas localmente** com casos positivo/negativo, no avaliador JS e no PostgreSQL.
- **0 conquistas comprovadamente avaliáveis em produção** nesta missão; 0 vidas reais certificadas com acesso à origem.
- Classificação disjunta: **24** definições aguardam dias/distâncias de fonte futura; **76** não dependem dessas métricas, mas aguardam identidade, acesso e observações/arquivo real. Entre estas, 18 usam arquivo oficial e 3 usam tempo jogado. Esses subconjuntos não devem ser somados novamente.
- Medalhas persistem por vida após morte/troca de temporada. Nova vida começa sem medalhas. PK `(life_id,achievement_id)` impede duplicação; observações repetidas preservam datas. `occurred_at` fica nulo: contador alto não informa a data exata do feito.

## Migrações e sequência segura pendente

Nenhuma migração executada no Supabase real. Antes de qualquer aplicação: confirmar projeto, versão PostgreSQL, schema/catálogo efetivos, privilégios, credencial legítima do coletor e procedimento de recuperação testável. Não há backup produtivo confirmado.

1. Inventário com scripts existentes `preflight.sql`, `security-check-readonly.sql`, preflight de campeonato e definições reais. Conferir a assinatura **11 argumentos** da ingestão; não presumir que o schema do clone é o aplicado.
2. Ensaiar cópia sanitizada em PostgreSQL/PostgREST com papéis equivalentes, inclusive concorrência entre sessões reais. PGlite local não comprova concorrência distribuída, limites ou cache PostgREST.
3. Corrigir ACL por `001`, conferir ingestão legítima seguinte; não restaurar acesso PUBLIC para recuperar o coletor. `002/003` somente após comparação de contratos e recuperação. Arquivos históricos não são reclassificados.
4. `004` é aditiva e pode ser ensaiada sem ativar clientes. Não converter nomes antigos em identidades.
5. **005 muda a população oficial**: aplicar apenas com emissor validado e migração de coorte coordenada, coletor pausado em janela controlada e impossibilidade de encerrar a temporada durante a transição. Sem isso o ranking certificado pode ficar vazio ou excluir participantes legítimos. Isso permanece bloqueado.
6. Liberar coletor `life-v1` apenas com 004/005 validadas; começar `DRY_RUN=true`, verificar todas as linhas vivas/desconhecidas e permissões. Só então liberar gravação normal e acompanhar coleta legítima. Frequência proposta no repositório continua 5 minutos; frequência real não comprovada.
7. `life-validate-readonly.sql` faz pós-verificação sem escrever. `npm.cmd run check:readiness` consulta RPC privada somente leitura; exige URL, chave privada e `EXPECTED_SUPABASE_PROJECT_REF` fornecidos por configuração segura. Sem eles sai com `ready=false`; resultado não comprova deploy ou confiança da fonte.
8. Após sucesso recente de coleta/identidade, habilitar contratos no ambiente correto e publicar site de forma controlada. Validar provedor, versão, domínio, rotas e dados; só então declarar integração real.

Recuperação: falhas dentro das transações revertem a unidade. Após COMMIT, desabilitar clientes novos, preservar tabelas/medalhas/arquivo, pausar a operação afetada e aplicar correção compatível ensaiada. Não voltar automaticamente à ingestão por nome, não remover colunas/dados, não reaplicar bootstrap e não restaurar ACL pública. Restaurar definições anteriores somente de inventário privado revisado; a recuperação do mundo/backup do banco precisa ser confirmada externamente.

O `schema.sql` do coletor é exclusivamente bootstrap de banco vazio. Agora recusa reaplicação e encerra temporadas apenas após a migração oficial. Corrigida ACL que referenciava 10 argumentos quando a função possui 11. Testada compatibilidade do bootstrap com 001–005 em banco descartável.

## Verificação executada

- Suíte Node atual: **61/61 em Node 22.23.4 e 61/61 em Node 24.15.0**, sem falhas ou testes ignorados. Inclui as 100 fronteiras positivas/negativas SQL e JS dentro dos casos de catálogo; integração usa o coletor Python legítimo, dados TTF anonimizados, ingestão SQL real, transporte PostgREST simulado, API real e apresentação do dossiê.
- Python do clone legítimo: 13 testes; cobre fluxo principal, fingerprint novo, falhas de fonte, seleção de RPC, renomeação, nome reutilizado, unidades e veículos sem dupla contagem.
- Mais 4 testes offline de composição TTF: `npm.cmd run test:collector -- --source ../clube-das-winx-collector`. O argumento de origem é obrigatório; executado com o clone legítimo. Nenhuma rede/coleta ocorre nesses testes.
- SQL 001–005 reaplicadas em PGlite para conferir idempotência; bootstrap separado conferido. Replay e fila concorrente numa única conexão testados; múltiplas sessões PostgreSQL reais permanecem pendentes.
- Prévia HTTP: home, ranking, Memorial, dossiê e mobile retornam 200. Cenário de conquistas: 100 definições, **29 desbloqueios fictícios** persistentes em PostgreSQL em memória, 2 observações. Repetir GET conserva datas. POST administrativo 405, `/conquistas` 404. Banco de demo desaparece ao encerrar o processo; persistência durável produtiva depende do Supabase.
- Auditoria npm sem alertas; gate de liberação corretamente bloqueado por configuração ausente.
- Scan dos arquivos visíveis ao Git nos dois repositórios não encontrou padrões de credenciais privadas nem `.env` inesperado. Verificação de whitespace sem erros. Isso complementa, sem substituir, o uso obrigatório do secret store.
- Automação visual desta missão interrompida pela ferramenta: não foi possível confirmar a URL atual do navegador Windows. Não houve tentativa de contorno. Revisão visual desktop/mobile desta implementação fica pendente; validações visuais da 06 são históricas.
- Consulta pública somente leitura em 25/10: domínio conhecido, `/api/ranking` e `/api/status` responderam 200; ranking configurado, 5 vivos no recorte, 2 mortos no recorte e coleta recente informada pela API. Isso **não comprova** vínculo com estes commits, identidade forte, grants, acesso Railway ou código implantado.

## Prévia e manutenção

`npm.cmd run preview` em `clube-das-winx-site`, Node 22. Abrir `http://127.0.0.1:4173/`. Dossiê com motor real local: `http://127.0.0.1:4173/jogador?id=20000000-0000-4000-8000-000000000001&scenario=achievements`.

Servidor apenas loopback, sem leitura de `.env`, proxy ou acesso aos serviços reais. Fixtures/demonstrações não são importadas pelas APIs de produção. Para alterar catálogo: editar fonte, executar `node scripts/sync-achievements.js`, conferir diff e testes; versão 1 persistida é imutável, não substituir critérios já reconhecidos.

## Checklist de acessos seguros

- **Vercel:** conectar conta/equipe com o projeto `clubedaswinx-delta`, permitindo ler configurações, repo/branch, env por ambiente e deployments. Conector atual: projeto/deployment alvo 404 e apenas projetos sem relação. Necessário para confirmar destino, rollback, configuração e publicar/validar quando banco/coletor estiverem prontos.
- **Supabase:** projeto correto e papel administrativo por conexão segura ou painel; chave privada do coletor no secret store e configuração local privada se necessária. Necessário para inventariar grants/schema, verificar recuperação, ensaiar e aplicar migrações aprovadas e confirmar ingestão. Nunca entregar chave de serviço ao frontend/chat.
- **Railway:** acesso ao projeto/serviço correto, fonte Git, branch, agendamento, env seguro e logs sanitizados. Necessário para comprovar proveniência, bloquear autodeploy indevido, publicar coletor validado e acompanhar execuções. Não foi confirmado que o clone é o código atualmente ativo.
- **SFTP/BisectHosting:** conta com leitura de `players.db`, WAL/SHM e fontes Lua/mod pertinentes, caminho real e fingerprint SSH confirmada por canal confiável. Necessário para validar IDs de vida, métricas/unidades/escopo e estado do emissor. Nenhuma escrita no mundo/mod/save; instalar emissor exige autorização adicional.

Não colar credenciais no chat. Usar conectores autenticados, painel dos provedores ou secret store/configuração local privada. A falta desses acessos bloqueia somente as operações correspondentes, não o desenvolvimento local.
