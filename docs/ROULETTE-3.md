# Roleta 3.0 — lançamento sob bloqueios independentes

O sorteio mensal continua em season-rewards-v1 e preserva sua vida campeã, regras de morte, certificação e prêmio único. A modalidade semanal usa weekend-rewards-v3: conta Steam cadastrada/verificada, uma premiação por início de fim de semana, sem vínculo a personagem ou morte. O registro persistido consome a ficha; não existe carteira de créditos.

## Estruturas e lançamento

021 cria cadastro privado, flags desligadas, ficha/resultado imutável por conta/janela, snapshots e histórico. 022 acrescenta reservas de entrega por componente e eventos privados. 023 registra respostas redigidas e recebimentos atestados manualmente, sem liberar reenvios. Não cria participantes, campeões, sorteios, itens, catálogos ou certificações produtivas. Os exports existentes incluem automaticamente as tabelas novas; os restauradores offline também reconhecem essas tabelas. Não há rollback que apague históricos: a reversão operacional é manter/desligar as flags e voltar ao frontend anterior, preservando os dados aditivos.

As flags e atestações só podem ser alteradas pelo proprietário do banco; service_role, anon e authenticated não têm acesso direto. Não há endpoint de ativação nem relógio fornecido pelo cliente. O procedimento futuro exige evidências independentes registradas por hash, não valores fictícios para desbloquear:

1. Transição real T1 → T2, com fronteiras adjacentes e evidência revisada. Certificação pendente da T1 não impede calendário nem força campeão.
2. Catálogo ativo de 36, definição exata aprovada e hash da aprovação individual dos novos itens. A aprovação do número 36 não equivale a aprovar os 12 candidatos.
3. RCON com prova controlada de identidade, comando, recebimento e conectividade a partir do ambiente executor real.
4. Testes de integridade e concorrência aprovados.
5. Aprovação final do usuário para ativar operação. Flags SQL e WINX_REMOTE_DELIVERY_ENABLED permanecem desligadas até esse ponto.

## Identidade das contas

Cadastro é uma operação administrativa autenticada que grava estado pending. Não verifica por nome, avatar ou existência de perfil público na Steam. Não concede ficha utilizável. A atestação owner-only exige SteamID64, vínculo exato ao usuário do servidor e account_token com evidência independente revisada e operador identificado. A função de atestação não é acessível pela API/service_role. A SteamID e o token não entram nos DTOs de histórico, logs ou páginas públicas. Uma conta já verificada não pode ser reatribuída a outro nome/usuário/token. Revogação impede novos sorteios/entregas; nunca apaga premiações anteriores.

## Janela e recuperação

Backend PostgreSQL usa America/Sao_Paulo: [sábado 00h, segunda 00h). Segunda à meia-noite está fora. Unicidade account_id + window_start e trava transacional de conta impedem duplicação por request diferente, timeout, personagem ou nova aba. Repetição de uma janela já persistida recupera o mesmo snapshot, inclusive fora da janela ou após desativar novos sorteios. Histórico administrativo reúne modalidades com filtros de modalidade, participante, prêmio, datas e entrega; a lista semanal é limitada a 200 registros por consulta. Consulta específica por ID deve ser utilizada para registros fora da página; não há expiração do prêmio persistido.

## RCON privado

Implementado em Node.js, por conexão TCP curta no backend existente, sem serviço novo ou credenciais no navegador. A documentação da Vercel confirma suporte às APIs Node: https://vercel.com/docs/functions/runtimes/node-js . Isso não comprova roteamento/firewall da Vercel até o servidor BisectHosting.

Configuração futura segura: WINX_RCON_HOST, WINX_RCON_PORT, WINX_RCON_PASSWORD e WINX_REMOTE_DELIVERY_ENABLED. Não copiar valores para chat, código, relatório ou logs. O protocolo RCON nativo usa TCP sem TLS; a validação produtiva também deve comprovar uma rota restrita/protegida para o segredo. Não expor uma senha em rota pública desprotegida. Não alterar configuração/credenciais do servidor para contornar impedimentos. Nenhum segredo é solicitado ao frontend. A região existente permanece gru1.

`players` e a sintaxe `additem "USUARIO_EXATO" "Base.ID" QUANTIDADE` foram conferidos somente no bytecode da instalação licenciada local Build42.21.0, classes PlayersCommand e AddItemCommand. A resposta de players comprova presença por nome, não SteamID nem inventário. O vínculo Steam ↔ usuário e a semântica no servidor instalado ainda precisam de prova real. O BIKO não participa.

A entrega mensal remota permanece bloqueada mesmo com a flag global: players não comprova a vida nativa exata do campeão. Essa associação online exige um adaptador/evidência independente antes de habilitar envios mensais. A entrega manual mensal existente permanece preservada.

Fluxo: prêmio persistido → plano privado → lista de itens/quantidades/destinatário → confirmação com hash do plano → presença exata → reserva transacional de todos os componentes → envio único por componente → registro da resposta redigida (até 2.000 caracteres), hash e tamanho. A chave RCON e padrões comuns de credenciais são removidos antes da persistência; o hash é do conteúdo redigido. Não aceita comando, item, quantidade, raridade ou destinatário definidos livremente pelo cliente. A confirmação de plano vencido é rejeitada.

Mesmo resposta positiva de additem significa sent_unconfirmed, nunca recebimento comprovado. Timeout/erro/resposta desconhecida significa uncertain. Kits são rastreados por componente, param no primeiro envio incerto e nunca são reenviados automaticamente. Uma reserva started sobrevivente a uma interrupção também bloqueia repetição e exige reconciliação. Não há garantia de exatamente uma entrega externa sem protocolo de idempotência do próprio jogo; o projeto oferece reserva durável e comportamento conservador de no máximo uma tentativa automática.

Antes de qualquer prova real de additem, apresentar ao usuário o comando exato, conta destinatária e componente/quantidade; pedir autorização específica e comprovar recebimento. A autorização de implementação/deploy não autoriza essa escrita no jogo. Enquanto faltar a prova, ENVIAR PRESENTE fica desabilitado, com motivo verdadeiro.

## Expansão de catálogo

O catálogo ativo de 24 e seus pesos/IDs/imagens não são modificados. `prepareExpandedCatalog` exige 12 candidatos explícitos, IDs novos únicos, pesos e quantidades informados, provas de aprovação individual, imagens/build exatos e invariantes existentes: kit Raro com dois componentes e uma Katana Lendária. Não ativa catálogo nem fabrica candidatos para completar quantidade. As definições dos 12 novos prêmios e suas aprovações individuais permanecem pendentes. Não há lista preenchida por inferência ou pesos gerados automaticamente. Nenhum veículo foi incluído.

## Migração e publicação

Ensaie 021–023 em banco isolado antes da aplicação. Confira export consistente/restauração, flags e permissões, contagens históricas e definições das funções existentes. Publique com flags desligadas. Se o schema ainda não estiver aplicado, a API mensal continua respondendo e devolve weekly.available=false; qualquer operação semanal/remota falha fechada. Recibos semanais exigem confirmação explícita da mesma conta e evidência independente por componente; reservas ainda em andamento aguardam no mínimo dois minutos. O registro é manual, append-only e idempotente, e não libera novos comandos.

Nunca declarar estrutura aplicada ou RCON validado com base somente em código ou simulação.

## Aplicação verificada em 29/10/2026

Migrações 021, 022 e 023 aplicadas após restauração isolada da cópia real do schema public (29 tabelas, 72 funções anteriores e 12.003 snapshots). Os 12.003 registros originais foram comparados por hash com corte id 12005; o coletor pode continuar acrescentando observações. O catálogo ativo permaneceu season-prizes-v2-b42.21.0, com 24 recompensas. Flags weekly_enabled e remote_enabled continuam false; nenhuma conta, premiação, envio ou certificação real foi criada. A virada real de 01/11/2026 ainda é futura. O relatório externo da entrega registra as consultas, os testes e o SHA efetivamente publicado.
