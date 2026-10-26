# Clube das Winx — portal, Discord e ranking Project Zomboid

Portal gamer hospedável na Vercel, com status real A2S, comandos Discord via Interactions HTTP e base segura para ranking sazonal coletado no Railway.

Este repositório contém o site e as APIs da Vercel. O coletor/backend Railway é mantido separadamente em [clube-das-winx-collector](https://github.com/rhanielgreg/clube-das-winx-collector). A pasta local `collector/` não faz parte deste repositório.

## Integração e publicação — Missão 08

Versão publicada e validada no [domínio original](https://clubedaswinx-delta.vercel.app/), commit `323d965`. O marcador `/api/release` comprova a revisão. Leitor TTF/coorte seguem desativados e não há medalhas reais concedidas; detalhes e pendências no checkpoint.

Estado atual, testes, contratos de vida/conquistas e transição pendente: [checkpoint consolidado](docs/MASTER07-CHECKPOINT.md). A correção limitada de permissões 001 foi aplicada e verificada; as migrações 002–004/006/005 foram aplicadas na Missão 08 após recuperação ensaiada. A ativação da coorte e a publicação do site têm seu estado registrado no checkpoint. A coleta produtiva voltou a funcionar após a correção SFTP feita pelo usuário. Os checkpoints anteriores permanecem históricos.

O catálogo tem exatamente 100 definições e motor SQL persistente por vida; isso não significa 100 conquistas disponíveis em produção. As três especiais de mil kills foram corrigidas após a [revisão das 100 definições e aprovação específica](docs/ACHIEVEMENTS-REVIEW07.md). A origem existente fornece `TTFStatsMP.characterID` e distância total, mas seu ciclo completo de vida ainda exige validação. `LIFE_CONTRACT_VERSION` permanece desabilitado até a transição segura de 004/005 e da coleta legítima.

Início, ranking, perfil e Memorial usam o mesmo frontend de `public/`. Para avaliar sem credenciais ou serviços reais:

```powershell
npm.cmd run preview
```

Abra **http://127.0.0.1:4173/index.html**. Todas as pessoas e estatísticas dessa prévia são fictícias; o servidor local bloqueia escrita. Há também `/preview/mobile` para avaliar viewport de 390 px.

Veja [o registro da revisão local anterior](docs/LOCAL-REVIEW.md) para o histórico da auditoria. As migrações em `migrations/` têm ordem e estado efetivo registrados no checkpoint; a preparação da coorte não equivale à sua ativação. A autorização condicional da Missão 07 não dispensa os critérios de recuperação e compatibilidade do checkpoint atual.

O histórico da [Missão 06](docs/MISSION06.md) registra decisões e testes anteriores. A [proposta original de conquistas](docs/ACHIEVEMENTS-PROPOSAL.md) foi implementada e detalhada no checkpoint 07. RPCs oficiais exigem `COMPETITION_RULES_VERSION=winx-v1` após 003; vida/conquistas também exigem `LIFE_CONTRACT_VERSION=life-v1` após 004/005 e validação da origem. A prévia não depende dessas variáveis e não carrega credenciais reais.

## Colaboração

Clone o repositório, use Node.js 22 e execute `npm ci`. Copie `.env.example` para `.env` e preencha somente as variáveis necessárias ao seu trabalho. Nunca compartilhe nem faça commit de `.env`, tokens, credenciais SFTP ou chaves secretas do Supabase.

Crie uma branch para cada alteração e abra um Pull Request para `main`. Execute `npm run check` antes de enviar. O deploy em produção continua separado; subir código aqui não conecta automaticamente o projeto à Vercel.

## O que está implementado

- Portal responsivo com motion contínuo, painel lateral de ranking e identidade rosa/pós-apocalíptica.
- `/ranking` com “O Sobrevivente Supremo”, filtros condicionais e histórico de temporadas.
- `/jogador?id=UUID` com perfil e evolução pública, sem Steam ID, IP ou coordenadas.
- `/server` e `/status` no Discord, assinatura Ed25519 e card PNG dinâmico.
- `/api/status`, `/api/connect`, `/api/ranking` e `/api/player` na Vercel.
- Coletor Python mantido em repositório separado; agendamento depende do ambiente Railway.
- SQL aditivo com jogadores, personagens, snapshots, temporadas, vencedores, execuções e lock.
- CLI do Admin para abrir e encerrar temporadas manualmente.

O ranking **não inventa números**. Enquanto a decodificação das estatísticas do BLOB de `players.db` não for validada com uma amostra real anonimizada, o site mostra um estado de espera.

## Arquitetura

```text
Discord ────────────────┐
                       ├─> Vercel Functions + portal
Project Zomboid ─A2S───┘

BisectHosting ─SFTP─> Railway Cron ─> Supabase ─RPC pública segura─> Vercel
```

## Estrutura

```text
api/                  Interactions, status, ranking e perfil
lib/                  A2S, Discord, card e cliente Supabase público
public/               Portal, ranking, perfil, motion e imagens
migrations/           Propostas SQL para revisão, sem aplicação automática
docs/                 Procedimentos e pendências da revisão local
scripts/              Registro dos comandos e prévia do card
tests/                Testes Node
vercel.json           Funções e rotas
```

## Executar localmente

Requer Node.js 22, Python 3.11+ para o coletor e Vercel CLI.

```powershell
npm install
Copy-Item .env.example .env
npm run check
npm run dev
```

Rotas principais:

- `http://localhost:3000/`
- `http://localhost:3000/ranking`
- `http://localhost:3000/api/status`
- `http://localhost:3000/api/status?format=image`
- `http://localhost:3000/api/ranking`

## Discord

Configure no `.env` local:

```dotenv
DISCORD_PUBLIC_KEY=
DISCORD_APPLICATION_ID=
DISCORD_BOT_TOKEN=
DISCORD_GUILD_ID=
```

Registre os comandos:

```powershell
npm run register-commands
```

No Discord Developer Portal, use como Interactions Endpoint URL:

```text
https://SEU-DOMINIO.vercel.app/api/interactions
```

Na Vercel, `DISCORD_PUBLIC_KEY` é obrigatória. Token do bot e Application ID só são usados localmente para registrar os comandos.

## Supabase e ranking

1. Crie um projeto Supabase dedicado.
2. Execute [schema.sql do backend](https://github.com/rhanielgreg/clube-das-winx-collector/blob/master/schema.sql) no SQL Editor somente ao configurar um banco novo; não reaplique no banco existente sem revisar.
3. Copie a URL e a chave **publishable** do projeto para a Vercel:

```dotenv
SUPABASE_URL=https://SEU-PROJETO.supabase.co
SUPABASE_PUBLISHABLE_KEY=
```

As APIs públicas usam somente chave pública e RPCs com saída restrita. Nunca envie `SUPABASE_SERVICE_ROLE_KEY` ao navegador. O painel administrativo existente depende dessa chave no backend para iniciar/encerrar temporadas; sua segregação na Vercel precisa de revisão antes de habilitar escrita. Não configure credenciais automaticamente. RLS, ACLs e assinaturas precisam ser verificados no ambiente conforme o preflight; este repositório não comprova a configuração de produção.

## Railway

O Railway usa o [repositório separado do coletor](https://github.com/rhanielgreg/clube-das-winx-collector). Configure as variáveis de seu `.env.example`, comece com `DRY_RUN=true` e siga o README daquele repositório.

O agendamento é configurado no painel Railway:

```text
*/5 * * * *
```

## Temporadas

No repositório separado do coletor, e somente com autorização específica para ações administrativas:

```powershell
python season_admin.py list
python season_admin.py start --name "Temporada 1" --slug "temporada-1"
python season_admin.py close --id "UUID_DA_TEMPORADA" --yes
python season_admin.py close --id "UUID_DA_TEMPORADA" --winner-id "UUID_DO_JOGADOR" --yes
```

Encerrar preserva o vencedor, a premiação informativa e toda a classificação da temporada. A nova temporada começa com uma linha de base própria.

## Deploy seguro

O projeto já pode ser vinculado com `vercel link`. Para mudanças de produção, faça uma implantação sem mover o domínio, valide a URL gerada e só então promova:

```powershell
npm run check
vercel deploy --prod --skip-domain
vercel promote URL_VALIDADA
```

## Limitações conhecidas

- Kills TTF incluem veículos no total validado. O campo legado `survival_seconds` da cópia de coletor examinada recebe tempo jogado TTF: a interface o chama de tempo registrado. Sobrevivência em dias no mundo permanece sem uma fonte validada.
- A coleta acompanha salvamentos do Project Zomboid, não eventos instantâneos.
- Sem um identificador de vida confirmado, reutilizar o mesmo nome de personagem na mesma conta pode unir duas vidas no histórico.
- Railway e Supabase exigem criação/configuração nos projetos corretos; nenhuma conta externa é presumida pelo código.
