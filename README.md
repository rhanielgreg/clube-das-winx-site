# Clube das Winx — portal, Discord e ranking Project Zomboid

Portal gamer hospedável na Vercel, com status real A2S, comandos Discord via Interactions HTTP e base segura para ranking sazonal coletado no Railway.

Este repositório contém o site e as APIs da Vercel. O coletor/backend Railway é mantido separadamente em [clube-das-winx-collector](https://github.com/rhanielgreg/clube-das-winx-collector). A pasta local `collector/` não faz parte deste repositório.

## Colaboração

Clone o repositório, use Node.js 22 e execute `npm ci`. Copie `.env.example` para `.env` e preencha somente as variáveis necessárias ao seu trabalho. Nunca compartilhe nem faça commit de `.env`, tokens, credenciais SFTP ou chaves secretas do Supabase.

Crie uma branch para cada alteração e abra um Pull Request para `main`. Execute `npm run check` antes de enviar. O deploy em produção continua separado; subir código aqui não conecta automaticamente o projeto à Vercel.

## O que está implementado

- Portal responsivo com motion contínuo, painel lateral de ranking e identidade rosa/pós-apocalíptica.
- `/ranking` com “O Sobrevivente Supremo”, filtros condicionais e histórico de temporadas.
- `/jogador?id=UUID` com perfil e evolução pública, sem Steam ID, IP ou coordenadas.
- `/server` e `/status` no Discord, assinatura Ed25519 e card PNG dinâmico.
- `/api/status`, `/api/connect`, `/api/ranking` e `/api/player` na Vercel.
- Coletor Python em `collector/`, agendado no Railway a cada cinco minutos.
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
collector/            Job Railway, SQL, CLI de temporadas e testes
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

Não configure `SUPABASE_SERVICE_ROLE_KEY` na Vercel ou no navegador. As APIs públicas consultam somente RPCs com campos aprovados. Todas as tabelas têm RLS ativo e acesso público direto revogado.

## Railway

O Railway usa o [repositório separado do coletor](https://github.com/rhanielgreg/clube-das-winx-collector). Configure as variáveis de seu `.env.example`, comece com `DRY_RUN=true` e siga o README daquele repositório.

O agendamento é configurado no painel Railway:

```text
*/5 * * * *
```

## Temporadas

Com as variáveis privadas do Supabase disponíveis localmente ou em um job administrativo:

```powershell
python collector/season_admin.py list
python collector/season_admin.py start --name "Temporada 1" --slug "temporada-1"
python collector/season_admin.py close --id "UUID_DA_TEMPORADA" --yes
python collector/season_admin.py close --id "UUID_DA_TEMPORADA" --winner-id "UUID_DO_JOGADOR" --yes
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

- Kills TTF foram validadas com fragmentos anonimizados de cinco registros reais. Sobrevivência permanece `NULL`: o campo de tempo TTF mede tempo real jogado, não sobrevivência no mundo.
- A coleta acompanha salvamentos do Project Zomboid, não eventos instantâneos.
- Sem um identificador de vida confirmado, reutilizar o mesmo nome de personagem na mesma conta pode unir duas vidas no histórico.
- Railway e Supabase exigem criação/configuração nos projetos corretos; nenhuma conta externa é presumida pelo código.
