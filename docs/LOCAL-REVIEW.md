# Missão 03 — implementação local em revisão

Nenhum commit, push, deploy, reset ou migração foi executado em produção. A prévia não carrega `.env`, não faz proxy de APIs, não executa o coletor e rejeita métodos de escrita. O frontend é o mesmo de `public/`; somente as respostas HTTP são fictícias.

## Abrir no Windows

Na pasta `C:\Pasta Emmanuel\Projetinhos Programação Emmanuel\Projetos\clube-das-winx-site`:

```powershell
npm.cmd run preview
```

Abra `http://127.0.0.1:4173/index.html`. Não use `file://`: os módulos JavaScript precisam de HTTP. Se a porta estiver ocupada, feche somente a prévia anterior ou use `$env:PREVIEW_PORT=4174` na sessão que a iniciará. Ctrl+C encerra o servidor.

Páginas: `/ranking`, `/memorial`, perfil pelos links do ranking/memorial e `/admin` em demonstração sem login. `/preview/mobile` contém a mesma aplicação em iframe com viewport de 390 px; não é uma segunda implementação. Cenários de revisão: `/ranking?scenario=empty`, `?scenario=offline` e `?scenario=stale`. A faixa de demonstração identifica números e pessoas fictícios em todas as páginas. A prévia escuta apenas `127.0.0.1`.

## Fontes e limites do coletor

Foi encontrada uma cópia em `..\Dashboard Zomboid - Clube das Winx`, contendo `collector.py`, `stats.py`, `probe_stats.py`, `schema.sql`, testes e fixtures. Essa pasta não expõe `.git` no inventário examinado: é uma fonte local identificada pelo conteúdo, sem comprovação de sincronismo com o Railway. Nenhum arquivo dela foi editado. Não se presume que corresponda à produção atual.

- `collector.py:94–104`: lê a variável `SUPABASE_SERVICE_ROLE_KEY`; envia `apikey` e, para o formato JWT legado, também Bearer. Não há necessidade de uma chave anônima para ingestão nesse código. Isso comprova a intenção do cliente, não a configuração secreta efetiva do Railway.
- `collector.py:72–90`: identifica jogador pela conta e personagem por conta+nome. Reutilizar o nome pode unir vidas na origem. Nenhuma heurística para separar vidas foi adicionada ao site. Memorial preserva cada UUID recebido e informa a pendência.
- `stats.py:6–55`: `Vehicle` já participa de `sum(categories.values())`; `vehicleKills` é uma validação da mesma contagem, não um segundo valor a somar. O total também deve coincidir com a soma das armas. Divergência invalida as estatísticas.
- Fluxo: total TTF → `p_kills_total` → `source_kills_total` → subtração do baseline sazonal → RPC pública → interface. `total - firearm - melee` inclui `Other` e não pode ser chamado de contador de veículos.
- `TTFStatsGameTimeSeconds` é armazenado no campo legado `survival_seconds`. O código examinado o trata como tempo jogado. O site agora o chama de **tempo registrado**, sem conversão para dias no mundo ou premiações de sobrevivência.

Nenhum bug de dupla contagem/omissão de veículos foi reproduzido nas amostras disponíveis. Uma divergência de atropelamento real exige nova amostra anonimizada, versão do mod e pontos antes/depois da mesma conta/personagem/temporada. Não foi criada coluna de veículos nem alterado o coletor.

## Migrações preparadas — NÃO aplicar automaticamente

Arquivos `migrations/001_restrict_ingestion.sql` e `002_public_read_contracts.sql` são propostas versionadas. Os testes as aplicam **somente ao PostgreSQL PGlite descartável em memória**, sem URL, credencial ou acesso a banco compartilhado. Não há comando de migração automática no projeto.

### Verificação prévia obrigatória

1. Confirmar projeto/ambiente, autorização humana e janela de revisão com o Greg. Inspecionar a configuração do coletor no painel autorizado sem copiar chaves. Confirmar que a credencial efetiva é de serviço e que a implantação usa o contrato de 11 argumentos.
2. Executar, por leitura autorizada, `migrations/preflight.sql`. Guardar definições SQL, assinaturas, proprietário e ACLs num registro de mudança protegido. Não guardar credenciais nesse registro.
3. Comparar definições e colunas com a proposta. **Parar se houver diferença de assinatura, estrutura, regra ou proprietário não revisada.** A função de cemitério da cópia local não está no schema antigo; o novo nome v2 evita alterar o contrato antigo de retorno.
4. Examinar heranças e concessões extras. `PUBLIC`, `anon` e `authenticated` não podem obter execução por outra associação. Nenhum usuário de aplicação deve ser proprietário das funções. Confirmar se há outras sobrecargas ou consumidores antes de prosseguir.
5. Preservar cópia dos dados/backup conforme o procedimento do ambiente. Registrar contagens/hashes de snapshots, pontuações e campeões e as definições administrativas. Validar primeiro em ambiente isolado autorizado. Sem prova do papel real do coletor, **não aplicar em ambiente compartilhado**.

### O que muda

**001**: exige a assinatura de 11 argumentos do coletor examinado; revoga execução de todas as sobrecargas de ingestão de `PUBLIC`, `anon` e `authenticated`; concede a `service_role`. Pode ser repetida. Não altera funções públicas de leitura nem dados. O schema antigo declarava 11 argumentos e tentava configurar permissões com uma assinatura de 10: provável motivo de privilégio público remanescente.

**002**: isola `ranking_representatives(uuid)` como função interna. Mantém a regra provisória do ranking: um representante por jogador, priorizando vivo e depois leitura recente. Desempates exatos ganham UUID determinístico. Perfil ativo usa essa mesma população; personagem não representante recebe posição nula, sem desaparecer do arquivo. A apresentação de temporadas fechadas mantém o cálculo legado. Nada grava ou recalcula campeões históricos.

Histórico v2 exige personagem e temporada; seleciona as amostras mais recentes com desempate por ID e depois as apresenta em ordem cronológica. Snapshots não são atualizados ou excluídos. Cemitério v2 retorna `alive=false` explicitamente e mantém UUID e temporada das estatísticas apresentadas. Não é uma certificação de identidade de vida.

As APIs locais já apontam para v2. Sem essa migração, perfil continua exibindo o resumo com aviso de histórico indisponível; cemitério/memorial exibem falha de integração em vez de uma lista falsamente vazia. A prévia demonstra os contratos com fixtures.

### Validação posterior

Após aprovação e aplicação no ambiente correto: executar `migrations/validate-readonly.sql`. Confirmar todas as sobrecargas sem execução anônima/autenticada e com execução pelo serviço; leitura pública preservada; nenhuma divergência ranking/perfil para representantes; cemitério somente com mortos; último histórico correspondente à última amostra da temporada. Comparar snapshots/pontuações/campeões com o inventário anterior.

Só com autorização específica observar uma coleta normal autorizada e seus logs sanitizados; não inserir observações artificiais em produção como teste. A missão atual não executou essa integração.

### Reversão segura

- As migrações não modificam dados: não restaurar snapshots nem recalcular pontuações para reverter funções de leitura.
- Antes de remover funções v2, devolver o consumidor à versão anterior em uma mudança separadamente aprovada; não fazer deploy nesta missão.
- Para 002, restaurar com `CREATE OR REPLACE` as definições e ACLs **efetivamente capturadas no preflight**, respeitando os proprietários. Depois verificar dependências e só então remover funções v2/helper sem `CASCADE`. Nunca usar o schema local inteiro como rollback de produção.
- Para 001, **não reabrir ingestão a PUBLIC/anon/authenticated**. Se o coletor usar papel diferente do previsto, interromper a mudança e revisar concessão apenas à identidade comprovada ou corrigir a configuração do serviço. Uma restauração ampla da ACL vulnerável não é uma reversão segura. A recuperação de permissões depende do inventário prévio e de autorização explícita.
- Falha dentro de cada arquivo causa rollback de sua transação. Aplicar arquivos separadamente permite preservar o endurecimento de ingestão caso a revisão de leitura precise ser adiada.

## Administração

O caminho antigo de PATCHes de reset foi removido. `reset_baseline` exige UUID de temporada e retorna 409 mesmo com sessão administrativa válida, antes de RPC/PATCH. A interface desativa o botão. Uma versão transacional futura depende da decisão de recalcular ou preservar históricos e da concorrência com ingestão. Não foi criada uma função de reset que pudesse reabrir esse risco.

Encerramento pela API exige vencedor explícito, evitando a escolha automática pelo conjunto SQL divergente. `close_ranking_season` e `season_winners` não foram alterados. A regra definitiva e uma eventual mudança do campeão automático aguardam autorização. A prévia bloqueia iniciar/encerrar, além do reset.

O painel busca URL/chave pública em `/api/config` em vez de fixá-las no JavaScript. Chaves de serviço são rejeitadas nessa resposta. O SDK de autenticação só é carregado quando há configuração explícita; a prévia não depende de CDN. A decisão de manter operações privilegiadas na Vercel ou movê-las para um serviço administrativo precisa alinhar a documentação/segregação com o Greg. Não foi configurada credencial alguma.

Avatares Steam agora dependem de associação explícita em `STEAM_PROFILE_MAP_JSON` (JSON de nome para URL de perfil verificada). Sem associação, usa-se a arte original. Nome de exibição não é convertido em identidade Steam automaticamente. Não publicar associações com Steam ID sem revisar a política de privacidade do dashboard.

## Testes e limitações de ambiente

```powershell
npm.cmd run check
python -B scripts/check-collector.py --source "..\Dashboard Zomboid - Clube das Winx"
python -B -m unittest discover -s "..\Dashboard Zomboid - Clube das Winx" -p "test_collector.py" -v
```

`-B` evita criar bytecode na cópia do coletor. Os testes do site usam respostas mockadas e HTTP loopback. PGlite é dependência de desenvolvimento; não integra o bundle do navegador nem o backend publicado.

O Node disponível na máquina é 24.15.0; o projeto declara 22.x. A validação nesta máquina não substitui a matriz Node 22 da futura publicação. A instalação original (`npm ci`) informou cinco entradas de vulnerabilidade alta na árvore existente, relacionadas a `sharp` e `zod` transitivo em `@vercel/functions`. Nenhum `npm audit fix --force` foi executado. Atualização de dependências e validação da cadeia de Discord/imagem permanecem uma revisão separada antes de publicação.

## Arquivos alterados e adicionados

- Frontend: `public/index.html`, `public/ranking.html`, `public/jogador.html`, `public/memorial.html`, `public/styles.css`, `public/site.js`, `public/contracts.js`, `public/demo-data.js`, `public/admin.html`, `public/admin.js`.
- APIs e bibliotecas: `api/ranking.js`, `api/player.js`, `api/admin.js`, `api/config.js`, `lib/admin-actions.js`, `lib/steam-avatar.js`.
- SQL preparado: `migrations/001_restrict_ingestion.sql`, `migrations/002_public_read_contracts.sql`, `migrations/preflight.sql`, `migrations/validate-readonly.sql`.
- Prévia/verificação offline: `scripts/preview-server.js`, `scripts/check-collector.py`.
- Testes: `tests/api-contracts.test.js`, `tests/contracts.test.js`, `tests/preview.test.js`, `tests/sql.test.js`, `tests/fixtures/schema-before.sql`.
- Configuração e documentação: `.env.example`, `package.json`, `package-lock.json`, `vercel.json`, `README.md`, `docs/LOCAL-REVIEW.md`.

A revisão do painel também removeu afirmações estáticas de RLS/SFTP/status sem evidência, protegeu campos textuais no CSV contra fórmulas e manteve a atualização da demonstração sem exigir sessão real. O admin real agora exige `ADMIN_EMAIL` explícito no backend, além da configuração pública; não usa um endereço pessoal como fallback. Essa configuração não foi aplicada a serviço algum.

## Resultado da validação nesta máquina

- `npm.cmd run check`: **25 testes passaram**, cobrindo regressão SQL em PostgreSQL em memória, ACLs e sobrecargas, idempotência, snapshots preservados, representantes por conta, 90 amostras recentes por temporada, estado desconhecido, contratos de APIs, falhas isoladas, reset bloqueado, campeão explícito, configuração pública, CSV e HTTP da prévia.
- `scripts/check-collector.py --source ...`: **4 testes passaram**, offline, inclusive a categoria Vehicle presente na fixture anonimizada. Os **6 testes existentes** da cópia do coletor também passaram com `python -B -m unittest`.
- Navegação manual no navegador: início → ranking → cemitério → perfil → memorial; busca preservada após atualizar; estados vazio, falha e desatualizado; administração demonstrativa com botões de escrita desativados e atualização funcional.
- Responsividade conferida visualmente no viewport desktop disponível e em iframe de **390 px**, incluindo menu mobile, ranking e cartões do memorial. Isso não substitui testes em todos os aparelhos.
- `git diff --check` sem erros de whitespace. Branch local mantida em `main`; alterações não foram preparadas para commit.
- O resultado não valida autenticação real, configuração de Railway/Vercel, migração aplicada ou dados de produção. Nenhum desses serviços foi alterado.
