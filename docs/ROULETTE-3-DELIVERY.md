# Roleta 3.0 — conexão, participantes e veículos presenciais

Continuação sobre c4f3f24, preservando 021–023, o catálogo ativo de 24 e os bloqueios de lançamento. Não ativa premiações nem executa comandos de jogo durante migração ou publicação.

## Evidências recebidas em 29/10/2026

O administrador informou instalação e funcionamento dos cinco mods KI5 na Build 42.21.0 e uma POC externa: autenticação RCON, players, additem e recebimento de três Base.Hammer, condição máxima observada e posterior descarte. Não repetimos essa POC. Ela não comprova conexão a partir do backend Vercel, SteamID, vida nativa ou condição de todos os outros itens.

| Modelo selecionado | Workshop | Mod ID | Vehicle Script ID informado |
| --- | --- | --- | --- |
| Mustang Boss 429 (1969) | 3756938756 | 69fordMustang | 69fordMustangBoss429 |
| Countach LP400S (1978) | 3726526329 | 78lamboCountach | 78lamboCountachLP400S |
| Defender 110 (1989) | 3570973322 | 89defender | 89defender110 |
| Hilux cabine extra (1988) | 3435796523 | 88toyotaHilux | 88toyotaHiluxXC |
| Humvee M998 (1992) | 2642541073 | 92amgeneralM998 | 92amgeneralM998 |

Mantidos literalmente os IDs fornecidos, sem inferir namespace Base, variantes ou imagens. Seleção não significa aprovação de peso, raridade ou ativação. Nenhum asset de veículo foi fabricado.

## Backend RCON

GET administrativo ?probe=rcon executa exclusivamente players, sem SQL de escrita, sem reserva de prêmio e sem comando fornecido pelo cliente. Exige a mesma autenticação ADMIN_EMAIL antes de ler configuração ou abrir conexão. Retorna horário, resultado e presença por ID cadastrado; não retorna host, porta, senha, SteamID completo ou nomes de jogadores não cadastrados. Resultado tem validade visual de 90 segundos e não certifica identidade ou entrega.

Variáveis privadas necessárias: WINX_RCON_HOST, WINX_RCON_PORT, WINX_RCON_PASSWORD. WINX_REMOTE_DELIVERY_ENABLED controla envio, não a consulta. Não inserir valores no chat, código, logs ou navegador. O diagnóstico funciona com a flag de envio desligada. Proteção da rota é requisito separado: RCON TCP nativo não oferece TLS. Acesso externo da POC não comprova firewall/rota do executor Vercel.

Prazo absoluto cobre conexão/DNS/autenticação; fechamento cancela a solicitação pendente. Nenhum retry. Entregas convencionais continuam com confirmação do plano, reserva durável por componente e estado conservador após falha. Veículos são recusados antes de conectar, mesmo com flags globais habilitadas.

## Cadastro

024 acrescenta wrapper de cadastro com operador e evento imutável. Repetição idêntica recupera o cadastro; mesma SteamID com dados diferentes e username colidindo por maiúsculas/minúsculas são rejeitados. Não reatribui identidades. O cadastro continua pending; verificação segue owner-only com evidência independente. A interface privada mostra Steam mascarada, usuário do servidor, estado e presença pontual. Presença por username não verifica a conta Steam.

## Entrega presencial

024 adiciona vehicle_deliveries_v3 e vehicle_delivery_events_v3, privadas com RLS, trilha append-only e UUID idempotente por registro. Não inclui executor de spawn.

Somente um prêmio já persistido com um componente kind=vehicle, quantity=1, delivery_method=manual_vehicle e um dos cinco scripts selecionados pode abrir registro. A conta deve estar verificada; para o mensal, a vida campeã exata precisa continuar elegível e viva. Travas respeitam a ordem vida → entrega usada pelo fluxo mensal anterior e impedem confirmação concorrente à morte.

Etapas: reserva → geração presencial já realizada → chave → reparos → recebimento confirmado manualmente. Cada etapa exige confirmação de identidade, evidência e operador autenticado; a partir da geração, a referência da instância física fica fixa. Duplo clique, timeout e concorrência não criam uma segunda reserva. Chave/reparos/recebimento não podem pular etapas.

Incerteza bloqueia nova geração. Pode-se localizar a instância existente, documentar chave e reparos faltantes e reconciliar seu recebimento; nunca executar novo spawn automaticamente. O Dashboard apenas registra atestações humanas; não transforma resposta RCON em prova de inventário, chave, condição ou veículo.

Nenhum prêmio de veículo existe no catálogo produtivo atual. Os testes semeiam prêmios futuros somente como owner em banco isolado. Não são sorteios produtivos, aprovação do catálogo ou validação física no servidor.

## Catálogo 36

Rascunho administrativo separado: 24 atuais preservadas + cinco veículos selecionados sem pesos/raridades + sete recompensas convencionais indefinidas. Os validadores ativos continuam rejeitando veículos; não se publicou um catálogo misto incompleto. Antes da futura ativação, será necessário aprovar todos os pesos/raridades, sete itens e provas, fechar a versão e ensaiar a compatibilidade dos validadores JS/SQL do catálogo misto. O rascunho e o checklist não burlam essa proteção.

As probabilidades gerais 45/30/20/4/1, os kits Raros e a Katana Lendária permanecem intactos. Seleção, geometria e duração da roleta não foram alteradas.

## Aplicação

024 é aditiva; não substitui funções de temporadas, catálogo, sorteio ou certificação. As três tabelas entram no export público privado existente e foram incluídas nos restauradores offline. Sem 024, leitura mensal/semanal anterior permanece disponível e operations.available=false; as novas escritas falham fechadas. Não existe endpoint novo de verificação de conta ou ativação de flags.

O relatório externo da entrega deve registrar resultado do ensaio, situação real da migração, testes, commit, deployment e diagnóstico produtivo. Não confundir esta documentação de contrato com prova de aplicação ou de RCON real.

## Aplicação verificada

Em 29/10/2026, 024 foi aplicada no projeto nykhcytysswjdynjosib após restauração de uma cópia atual com 38 tabelas, 87 funções e 12.113 observações, e ensaio da migração nessa cópia. Os dados até id 12115 e as 87 funções anteriores permaneceram idênticos por hash. As três tabelas novas ficaram vazias com RLS e acesso direto negado aos papéis públicos e service_role; as RPCs novas ficaram privadas. T1 permaneceu aberta, catálogo ativo 24 intacto e flags weekly_enabled/remote_enabled false. PostgreSQL real isolado aprovou 23 verificações; Node 22/24 aprovou 238 testes em cada versão. Nada disso comprova conexão RCON produtiva ou entrega física de veículo.
