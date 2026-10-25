# Missão 05 — segurança, estatísticas e refinamentos locais

## Entrega

- **001 revisada:** assinatura de 11 argumentos conferida, revogação PUBLIC/anon/authenticated em todas as sobrecargas, grant necessário de service_role preservado, abortando integralmente se houver caminho herdado. Nenhuma alteração de corpo da ingestão, tabela ou dado. [Procedimento de validação e reversão segura](SECURITY-RUNBOOK.md).
- **002 revisada:** mantém um representante por jogador na temporada ativa, com vivo prioritário e mesma posição no perfil; não altera `close_ranking_season` nem sua população histórica. Seleciona até 90 snapshots recentes da temporada correta, devolvidos em ordem cronológica, com desempate por ID. Mortos sem pontuação podem abrir dossiê com métricas nulas, sem entrar no ranking. Sem temporada conhecida, a API não consulta histórico de outra temporada.
- **Estatísticas:** validação numérica compartilhada não transforma booleanos/arrays/strings vazias em contagens. Categorias, veículos, tempo registrado, limitações e proposta futura do coletor estão em [STATISTICS.md](STATISTICS.md). Nenhuma métrica foi inventada e nenhum arquivo do coletor foi alterado.
- **Identificação:** monogramas SVG locais por UUID, consistentes entre MVP, tabela, sobreviventes, dossiê e memorial. Homônimos com IDs diferentes continuam separados. Sem ID não há identidade inventada. Steam aceita somente associação explícita, prioriza UUID, rejeita domínio semelhante ao CDN e usa monograma se indisponível. Associação configurada não equivale a autenticação Steam. Nenhum perfil real foi consultado.
- **Memorial:** destaque discreto limitado aos mortos comparáveis da **mesma temporada no recorte retornado**, com empates; nunca recorde global. Campos ausentes são apresentados como ausentes; sem UUID não há link quebrado para dossiê. Morte registrada e última observação permanecem distintas. Um novo registro sintético incompleto exercita a apresentação sem preencher zeros ou criar histórico artificial.
- **Visual:** nenhuma alteração nesta missão em HTML da home/ranking/perfil/memorial, styles.css, identity.css, fontes ou imagens originais. A direção visual da Missão 04 permanece; os retratos individuais mudam somente por dados/apresentação JavaScript.

## Dependências — verificação em 25/10/2026

`npm audit` inicialmente retornou **5 entradas altas**, e não cinco vulnerabilidades independentes. Todas estavam na árvore de produção; nenhuma associada ao PGlite de desenvolvimento.

| Pacote instalado inicialmente | Uso/exposição identificada | Decisão local |
| --- | --- | --- |
| sharp 0.35.3, direto/produção | `lib/card.js` lê WebP local, desenha SVG interno e texto escapado, devolve PNG. Não foi encontrada entrada de upload ou imagem SVG/HEIF arbitrária no caminho usado | Atualizado para **0.35.5** (`^0.35.5` no manifesto, versão exata no lock), mesma série, Node >=20.9.0. Renderização PNG testada no Node 22 |
| @vercel/functions 3.8.0, direto/produção | App usa `waitUntil` em `api/interactions.js`. A raiz também carrega módulos de cache/OIDC | Mantido; nenhum downgrade automático |
| @vercel/oidc 3.8.2, transitivo/produção | Depende de cli-config; tokens e configuração da CLI são caminhos indiretos | Mantido |
| @vercel/cli-config 0.2.2, transitivo/produção | Fixa zod **4.1.11**. Schemas inspecionados são objetos/valores escalares de configuração, não coleções HTTP do dashboard | Mantido; a versão mais recente consultada, 0.3.3, ainda fixa o mesmo zod |
| zod 4.1.11, transitivo/produção | Alerta de exaustão de memória ao validar coleções grandes; não foi encontrado fluxo de requisição pública do app para essa validação de coleções | Risco potencial não eliminado, exploração em produção não comprovada |
| @electric-sql/pglite 0.5.11, desenvolvimento | PostgreSQL descartável usado nos testes | Mantido; sem alerta no inventário |

Depois da atualização, `npm audit` e `npm audit --omit=dev` retornaram **4 entradas altas**, todas propagadas da mesma cadeia `@vercel/functions → @vercel/oidc → @vercel/cli-config → zod`. Não há entrada restante de sharp. O advisory de zod indica correção em 4.6.6; não foi aplicado override à versão fixada pelo fornecedor. O npm propõe voltar functions para 3.6.1, marcado como mudança incompatível pelo auditor. Também foi consultado functions 3.10.3, que muda OIDC para 4.x: não foi adotado sem análise de compatibilidade. Alternativas futuras: atualização upstream que corrija o pin; ou ensaio isolado de override específico, com testes dos consumidores OIDC/config e revisão antes de adoção. Não foi usado `audit fix --force`.

Fontes primárias/revisadas consultadas: avisos publicados por sharp para [libheif](https://github.com/lovell/sharp/security/advisories/GHSA-rgj7-g3m4-5g8c) e [librsvg/0.35.5](https://github.com/lovell/sharp/security/advisories/GHSA-wq5f-xc86-pv6w); [advisory revisado de zod](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5) e manifests do registry npm. O relatório identifica presença e caminhos usados; não presume que um pacote instalado torne o serviço automaticamente explorável. A plataforma real não foi inspecionada ou alterada nesta missão.

## Validação local

- **38/38 testes** passaram no Node **22.23.4**, incluindo teste de renderização sharp, contratos das APIs, proibição de escrita na prévia, verificação de permissões no PostgreSQL, migrações idempotentes, ranking/perfis com múltiplos personagens, cenário de 120 snapshots, temporada diferente e timestamps iguais. Comparação das tabelas antes/depois e definição de fechamento preservadas. Temporada encerrada conserva a classificação anterior.
- `node --check public/site.js` passou no Node 22. A instalação padrão continua Node **24.15.0**; não foi alterado PATH ou runtime global. Para executar no 22, foi obtido ZIP de [nodejs.org](https://nodejs.org/dist/latest-v22.x/), com SHA-256 conferido contra SHASUMS256.txt oficial, e extraído em `node_modules/.local-node22/` (ignorado pelo Git). Essa ferramenta local é descartável e pode desaparecer num próximo npm ci.
- `npm.cmd run check` também passou com **38/38 testes** no Node 24.15.0; `git diff --check` passou e o índice do Git permaneceu vazio.
- O teste de ACL inicial e uma expectativa antiga da contagem de fixtures falharam durante o desenvolvimento. Foram corrigidos o índice da saída de consultas do PGlite e a expectativa de quatro para cinco registros sintéticos do memorial. A execução final completa passou, sem falhas ou testes ignorados.
- Revisão no navegador: memorial → dossiê; dossiê incompleto sem zeros artificiais; filtro Vivos com três registros; busca Lia; filtro Cemitério preservando o UUID distinto do homônimo morto; cenários vazio, falha e aviso de coleta atrasada. Inspeção visual desktop e viewport de 390 px para memorial/ranking. Não equivale a uma matriz completa de aparelhos/navegadores.
- Prévia em `http://127.0.0.1:4173/index.html`, processo local Node 22, usando frontend real e somente dados sintéticos identificados. O servidor não importa APIs reais, não carrega .env, não faz proxy e rejeita POST/PATCH/PUT/DELETE. CSP restringe conexões à própria origem. Nenhuma credencial administrativa real foi utilizada nos testes ou na prévia.

Comandos reproduzíveis (PowerShell na pasta do projeto):

```powershell
# Runtime instalado no computador:
npm.cmd run check
npm.cmd audit
npm.cmd audit --omit=dev

# Runtime Node 22 local conferido nesta missão:
& '.\node_modules\.local-node22\node-v22.23.4-win-x64\node.exe' --check public/site.js
& '.\node_modules\.local-node22\node-v22.23.4-win-x64\node.exe' --test --test-reporter=spec

# Prévia habitual (usa o runtime da sessão):
npm.cmd run preview
```

Se a porta já estiver ocupada pela prévia entregue, basta abrir o endereço existente. Os testes de SQL não utilizam conexão com Supabase: criam banco descartável em memória. A revisão no Node 22/Windows não substitui homologação Vercel/Linux e PostgREST.

## Arquivos desta missão

Modificados nesta missão, incluindo arquivos que já estavam sem commit desde etapas anteriores:

- `.env.example`, `package.json`, `package-lock.json`.
- `api/player.js`, `lib/steam-avatar.js`.
- `public/site.js`, `public/contracts.js`, `public/presentation.js`, `public/demo-data.js`.
- `migrations/001_restrict_ingestion.sql`, `migrations/002_public_read_contracts.sql`, `migrations/validate-readonly.sql`.
- `tests/api-contracts.test.js`, `tests/contracts.test.js`, `tests/preview.test.js`, `tests/sql.test.js`.

Criados nesta missão:

- `public/avatar.js`.
- `migrations/security-check-readonly.sql`.
- `tests/avatar.test.js`, `tests/security.test.js`.
- `docs/SECURITY-RUNBOOK.md`, `docs/STATISTICS.md`, `docs/MISSION05.md`.

O restante do trabalho local das Missões 03/04 foi preservado. Git permanece em `main`, remoto `https://github.com/rhanielgreg/clube-das-winx-site.git`, HEAD `31aa1675808a31f0c6785fe0a90c2e289599e3f5`. Há arquivos modificados e não rastreados acumulados; nenhum arquivo foi adicionado ao índice e não houve commit, push, pull, merge, reset, deploy ou limpeza destrutiva. Esta entrega não é uma versão publicada.

## Pendências e próximo passo

**A segurança de produção continua pendente:** preparar/testar arquivos localmente não remove a permissão PUBLIC do banco real. A identidade efetiva da credencial do coletor, memberships e inventário completo de produção ainda precisam ser conferidos em ambiente autorizado. 001 e 002 foram executadas **somente no PostgreSQL descartável local**. 001 pode ser avaliada separadamente, com prioridade, sem esperar mudanças de ranking ou avatar.

Dependem de investigação/autorização: aplicação de migrações, homologação com PostgREST e coletor real, decisão definitiva de campeão, SteamID/vida individual, novos campos de estatísticas e solução upstream de zod. Não houve alteração no Supabase, Railway, servidor Zomboid ou repositório do coletor. Nenhuma publicação foi realizada. Próxima ação recomendada: avaliar a prévia e o runbook; depois autorizar explicitamente um ensaio da migração de segurança em homologação, com inventário real e plano de recuperação.
