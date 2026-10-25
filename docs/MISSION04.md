# Missão 04 — recuperação visual local

## Comparação e recuperação seletiva

Antes da edição, foram examinados o diff local da Missão 03, os arquivos originais de `HEAD` (`31aa167`) e a referência publicada. As respostas GET de `/`, `/site.js` e `/styles.css` coincidiram com os respectivos arquivos originais do Git após normalizar CRLF/LF. Home e ranking publicados também foram inspecionados visualmente, somente por leitura.

As diferenças foram separadas em duas áreas:

- **Apresentação:** paleta, título e composição da home, tamanho/posição do MVP, cenários, tipografia, espaçamento, navegação e agrupamento das estatísticas. Essa é a área recuperada nesta missão.
- **Funcionalidade preservada:** RPCs/APIs, classificação, histórico recente, estados explícitos, atualização dos perfis, filtros persistentes, Memorial por UUID, proteção administrativa, scripts de demonstração, configuração e migrações preparadas. Não foram restauradas versões antigas dessas funções.

`public/identity.css` aplica a direção original sobre a base de `public/styles.css`, que foi mantida intacta nesta missão. Foram recuperados o título **CLUBE DAS WINX**, o contorno rosa, as imagens originais, a combinação escura/rosa/dourada e o MVP integrado ao cenário. Não foram restauradas animações contínuas, o contador de cron presumido ou rótulos incorretos de sobrevivência.

## O que mudou

- Home com imagem original mais visível, título marcante, MVP com retrato/coroa e status integrado. Texto reduzido a informações úteis e à frase original de abertura.
- Ranking com fundo cinematográfico, MVP grande, números e nomes com quebra de linha; tabela com hierarquia mais clara, busca/filtros e rolagem interna em telas menores.
- Navegação **Início / Servidor / Ranking / Sobreviventes / Memorial**. Sobreviventes é uma seção funcional de `/ranking#sobreviventes`, ligada aos dossiês existentes; não há nova página vazia nem mudança de arquitetura.
- Dossiês separados em combate, sobrevivência e histórico. Zero validado continua sendo zero; números ausentes, booleanos e valores inválidos não são convertidos em métricas. Exploração, veículos separados, outras categorias e dias no mundo só podem aparecer com valor e marcação explícita de validação; o contrato atual não fornece essas métricas adicionais.
- Memorial integrado à mesma identidade, com jogador/personagem, números disponíveis, link para o dossiê e distinção entre **morte registrada** e **última observação**. Não há associação automática de vidas por nome nem declaração de recordista histórico.
- Faixa de demonstração menor, sempre identificada; cenários de falha/vazio/desatualizado ficam em um menu de testes.
- O salto inicial às seções aguarda a carga dos dados para não parar no lugar errado. O histórico expandido permanece aberto ao atualizar. Erro de status remove a indicação verde anterior e mostra estado desconhecido.

## Proteção do trabalho anterior

Foram comparados os hashes SHA-256 de **39 arquivos preexistentes** entre o início e o fim da implementação: APIs, bibliotecas, migrações, testes existentes, contratos compartilhados, dados demo, administração, scripts de prévia/coletor e configuração. **Nenhuma diferença nesses arquivos.**

O coletor Python não foi modificado nem iniciado. Não foram alteradas as regras de representação, pontuação, campeão ou identidade de vida. As migrações permanecem preparadas e sem execução em serviços compartilhados. Não foi usado reset, clean, checkout de descarte ou sobrescrita indiscriminada.

## Arquivos desta missão

Modificados:

- `public/index.html`
- `public/ranking.html`
- `public/jogador.html`
- `public/memorial.html`
- `public/site.js`

Adicionados:

- `public/identity.css`
- `public/presentation.js`
- `tests/presentation.test.js`
- `docs/MISSION04.md`

As demais alterações visíveis no Git pertencem à Missão 03 e foram preservadas.

## Validação

- `npm.cmd run check`: **29 testes passaram**. Inclui os 25 testes existentes e quatro novos testes de apresentação, validação de métricas, datas e caminhos públicos sem dependência de fixtures demo.
- `node --check public/site.js` e `git diff --check`: sem erros.
- Browser local: navegação, MVP, cemitério, busca preservada após atualizar, histórico expandido após atualização, seção Sobreviventes, Memorial e estados de demonstração.
- Responsividade visual: desktop disponível e iframe com viewport de **390 px**. Nomes longos foram exercitados com respostas fictícias temporárias, usando o mesmo frontend e sem modificar o dataset ou acessar serviços reais. Isso não substitui uma matriz de aparelhos reais.
- Os testes SQL usaram somente PostgreSQL descartável em memória. Não houve teste de escrita em produção.

## Abrir a prévia

O ambiente da Missão 03 foi reutilizado, sem instalar dependências novas:

```powershell
cd "C:\Pasta Emmanuel\Projetinhos Programação Emmanuel\Projetos\clube-das-winx-site"
npm.cmd run preview
```

Abrir `http://127.0.0.1:4173/index.html`. Mobile: `http://127.0.0.1:4173/preview/mobile`. O servidor bloqueia escrita e não depende de credenciais de produção. Se já estiver ativo, basta atualizar a página.

## Pendências e limites

Avaliação visual do usuário; origem de distâncias/dias no mundo/recordes; identidade de cada vida; revisão e autorização das migrações; integração real e validação em Node 22. Os alertas de dependências registrados na Missão 03 não foram tratados nesta missão visual. Nenhum commit, push, merge, deploy ou alteração de produção foi realizado.
