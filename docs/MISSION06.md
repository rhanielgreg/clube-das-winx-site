# Missão 06 — entrega local para avaliação

## Estado retomado e preservado

A retomada releu a missão e examinou arquivos/Git. As implementações anteriores estavam salvas; o teste pendente terminou com 47/47 aprovados. Não houve reconstrução ou descarte do trabalho. A conclusão acrescentou as travas de contrato, dois testes de compatibilidade, correção da âncora após carregar fontes e esta documentação. Execução final: **49/49 aprovados**.

Repositório: `C:\Pasta Emmanuel\Projetinhos Programação Emmanuel\Projetos\clube-das-winx-site`; remoto `https://github.com/rhanielgreg/clube-das-winx-site.git`; branch `main`; HEAD `31aa1675808a31f0c6785fe0a90c2e289599e3f5`. Há modificações e arquivos não rastreados acumulados das Missões 03–06; índice vazio. Nenhum commit, push, pull, merge, reset, limpeza destrutiva ou deploy foi executado.

## Concluído e validado localmente

- **Campeonato:** vivos estritos, um representante por jogador, morto/desconhecido fora da disputa. Ranking, perfil e encerramento usam a mesma representação. Desempate: kills sazonais, tempo jogado registrado e UUID. Online não é critério. Novo encerramento certifica campeão vivo ou resultado explícito sem campeão; vazio, desconhecidos, dados antigos/futuros e coleta em andamento não viram apocalipse.
- **Arquivo:** resultado e classificação dos novos encerramentos ficam congelados; morte posterior não remove título ou muda posição arquivada. Temporadas legadas não são reclassificadas nem convertidas em apocalipse pela falta de vencedor. Snapshots e estatísticas existentes permanecem preservados.
- **Contratos:** nova migração 003 e RPCs de temporadas/encerramento `_v2`, mais leitura de títulos. APIs do campeonato exigem habilitação explícita `COMPETITION_RULES_VERSION=winx-v1`; o exemplo deixa vazio. Sem habilitação não chamam os novos RPCs. Habilitação sem RPC disponível falha sem executar encerramento legado. Perfis mantêm leitura anterior e omitem novos títulos quando desabilitados. Nenhuma variável real da Vercel foi alterada.
- **Home/ranking:** enquadramento sem rotação/corte do avatar, posição separada da imagem, nomes/números maiores, coroa/moldura preservadas, remoção dos links técnicos públicos e rodapé reorganizado. Imagens originais e identidade cinematográfica escura/rosa preservadas. Cards de sobreviventes viraram atalhos compactos para dossiês.
- **Servidor:** estado desconhecido não vira offline, nem ausência de contagem vira zero; parser A2S_PLAYER suporta falhas sem exceção fora do handler. Nomes só aparecem com lista consistente/validada; horários de consulta e última informação válida são distintos. APIs JSON/card permanecem. Nenhum comando administrativo ou consulta de escrita ao servidor real.
- **Atualização:** última coleta confirmada separada do recebimento dos dados pela página; consulta automática não é anunciada como coleta. Não há próxima coleta inventada. Busca e filtro permanecem após atualização. Âncoras aguardam dados e fontes.
- **Memorial:** lápides estilizadas e identidade por registro, sem retrato humano fingindo ser personagem real. Datas distinguem observação e morte registrada. Dossiês permanecem navegáveis, inclusive incompletos. As três categorias — O EXTERMINADOR, A LENDA DA SOBREVIVÊNCIA e O ANDARILHO — ficam explicitamente pendentes de métricas/identidade completas; nenhum recorde ou medalha foi concedido automaticamente.
- **Dossiês:** combate, tempo jogado, histórico recente e títulos registrados; exploração/dias/veículos separados só aparecem quando houver contrato validado. A demonstração avançada possui aviso adicional de que os números futuros são inteiramente fictícios. A apresentação normal não recebe esses campos inventados.

Detalhamento de regras, janela operacional de atualização, locks, limites de identidade e reversão: [CHAMPIONSHIP.md](CHAMPIONSHIP.md). Mecanismo de status e limites A2S: [SERVER-STATUS.md](SERVER-STATUS.md).

## Estatísticas e conquistas

Foram examinados por leitura o coletor, schema, testes e cinco fixtures TTF anonimizadas. Vehicle/vehicleKills concordam nessas amostras; não são contagem extra a somar ao total e não comprovam cobertura geral. O campo de tempo não está nessas fixtures. O Lua do mod não está na cópia local examinada; a nota histórica do README sobre segundos jogados não foi apresentada como nova inspeção do mod instalado. Dias do mundo, distâncias e identidade individual de vida continuam sem fonte validada suficiente. Não houve alteração ou execução do coletor para coletar dados reais.

A [matriz de estatísticas](ADVANCED-STATS.md) lista fonte, campo, unidade, extração, histórico, alterações necessárias e limitações. Inclui contrato futuro versionado, sem nova migração de métricas. Reutilização de username + nome pode fundir vidas na origem atual. Os testes com chave nova demonstram isolamento de registros distintos; não simulam que o coletor atual resolva a recriação com mesmo nome. Essa parte da regra 4 permanece dependente da origem.

O [catálogo proposto de 15 conquistas](ACHIEVEMENTS-PROPOSAL.md) contém 13 critérios por personagem/temporada ou vida e dois permanentes de jogador. Cada um define limiar, prova e dependências. Inclui preservação após morte, limites da retroatividade e expansão futura. Nenhuma tabela de conquistas, distribuição automática ou backfill foi implementado.

## Testes e inspeção

- Node **22.23.4**: `node --check` em site/admin e suíte completa: **49 testes aprovados, zero falhas/ignorados**.
- Node padrão **24.15.0**: `npm.cmd run check` também passou com **49/49**.
- PostgreSQL descartável em memória: migrações idempotentes; ACLs da ingestão preservadas; bloqueio de permissões herdadas no encerramento; vivos/mortos/desconhecidos; campeão vivo mesmo sem conexão online; apocalipse válido; vazio/dado antigo/futuro/coleta running bloqueados; empates; múltiplos personagens; nova chave sem herdar kills do homônimo; títulos após morte; snapshots e arquivo preservados.
- APIs com transporte substituído: chave sintética, contratos novos, contrato desligado sem RPCs novos, RPC v2 ausente sem fallback para escrita legada. Isso não é teste de PostgREST ou credenciais reais.
- Navegador: ranking de três vivos, temporada sem campeão, dossiê de morto com título anterior preservado, métricas futuras com aviso fictício, filtro Tempo + busca Lia conservados após atualizar; inspeção de ranking e lápides em viewport de 390 px. A matriz completa de aparelhos e concorrência real ainda não foi executada.
- `git diff --check` passou; comparação SHA-256 de sete arquivos protegidos encontrou zero diferenças: migração 001, seus testes de segurança, Vercel, manifesto/lock e duas imagens originais. Nenhuma dependência foi atualizada nesta missão. `npm audit` continua com **quatro entradas altas** na cadeia Vercel → zod, já documentadas na Missão 05.

Falhas intermediárias de expectativas dos testes antigos (seleção obrigatória de campeão, contagem com mortos/desconhecidos e latência ausente) e mocks dos novos RPCs foram corrigidas para verificar as regras agora aprovadas. Não há teste final falhando. Os testes de migração são locais; nenhuma migração foi executada no Supabase real.

## Arquivos desta missão

Modificados, preservando o restante das Missões 03–05:

- `.env.example`, `README.md`.
- `api/admin.js`, `api/player.js`, `api/ranking.js`, `api/status.js`.
- `lib/admin-actions.js`, `lib/a2s.js`, `lib/card.js`, `lib/server-status.js`.
- `public/admin.html`, `public/admin.js`, `public/index.html`, `public/jogador.html`, `public/ranking.html`, `public/memorial.html`, `public/site.js`, `public/contracts.js`, `public/demo-data.js`, `public/identity.css`.
- `scripts/preview-server.js`.
- `tests/api-contracts.test.js`, `tests/contracts.test.js`, `tests/preview.test.js`, `tests/server-status.test.js`.

Criados:

- `lib/championship-contract.js`, `public/championship.js`.
- `migrations/003_official_championship.sql`, `migrations/championship-preflight.sql`, `migrations/championship-validate-readonly.sql`.
- `tests/championship.test.js`.
- `docs/CHAMPIONSHIP.md`, `docs/ADVANCED-STATS.md`, `docs/ACHIEVEMENTS-PROPOSAL.md`, `docs/SERVER-STATUS.md`, `docs/MISSION06.md`.

001 e 002 permanecem preservadas; 003 altera os contratos após elas, sem reescrever as missões anteriores. `vercel.json`, dependências e imagens originais permanecem intactos nesta missão. Não foram criados arquivos de credenciais ou modificadas configurações de implantação reais.

## Abrir e avaliar

```powershell
cd 'C:\Pasta Emmanuel\Projetinhos Programação Emmanuel\Projetos\clube-das-winx-site'
npm.cmd run preview
```

Se a prévia entregue já estiver ocupando a porta, basta abrir [a página inicial](http://127.0.0.1:4173/index.html). Ela escuta somente no loopback, usa o frontend real com dados sintéticos claramente marcados, não carrega .env, não faz proxy de APIs reais e rejeita métodos de escrita. A consulta local confirmou `demo=true`, `admin_enabled=false`. Nenhuma credencial administrativa real é necessária.

Atalhos:

- [Ranking](http://127.0.0.1:4173/ranking) e [Memorial](http://127.0.0.1:4173/memorial).
- [Sem campeão](http://127.0.0.1:4173/ranking?scenario=no-champion).
- [Servidor offline fictício](http://127.0.0.1:4173/index.html?scenario=server-offline#servidor) e [status indisponível fictício](http://127.0.0.1:4173/index.html?scenario=server-unknown#servidor).
- [Vazio](http://127.0.0.1:4173/ranking?scenario=empty), [falha de consulta](http://127.0.0.1:4173/ranking?scenario=offline), [coleta atrasada fictícia](http://127.0.0.1:4173/ranking?scenario=stale).
- [Métricas futuras fictícias](http://127.0.0.1:4173/jogador?id=20000000-0000-4000-8000-000000000001&scenario=advanced), [morto com título ilustrativo](http://127.0.0.1:4173/jogador?id=20000000-0000-4000-8000-000000000006), [mobile](http://127.0.0.1:4173/preview/mobile).

## Pendências reais

A vulnerabilidade de ingestão informada pelo responsável continua no banco real: preparar/testar 001 não a corrige em produção. Aplicação de 001/002/003, habilitação do contrato, homologação PostgreSQL/PostgREST concorrente e verificação da cadência da origem exigem autorização posterior. Não foi confirmado o estado atual do servidor real, suporte nominal A2S na hospedagem ou código/versão do Lua instalado. Métricas avançadas, identidade das vidas, recordes completos e conquistas permanecem propostas nas partes sem fonte suficiente.

Nenhuma alteração foi publicada. Supabase, Railway, Vercel, BisectHosting e repositório do coletor não foram modificados. Próxima ação: avaliar pessoalmente esta prévia e os documentos; nenhuma publicação ou migração real é consequência automática dessa avaliação.
