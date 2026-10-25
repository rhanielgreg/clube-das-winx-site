# Estatísticas e identidade — evidência disponível na Missão 05

Fonte conferida por leitura: `../Dashboard Zomboid - Clube das Winx/stats.py` e `collector.py`, mais schema disponível em `tests/fixtures/schema-before.sql`. A cópia local não comprova o código em execução no servidor. Nenhum arquivo do coletor foi modificado ou iniciado nesta missão.

| Informação | Evidência atual | O que a interface pode afirmar |
| --- | --- | --- |
| Kills totais | `confirmed_stats`: soma das dez categorias TTF; persistência atual e snapshots por temporada | Kills registradas na temporada, quando não nulas |
| Armas de fogo | Categoria `Firearm`, campo próprio no contrato | Contagem registrada de armas de fogo |
| Corpo a corpo | Soma de Axe, LongBlade, SmallBlade, Spear, Blunt, SmallBlunt, Unarmed | Contagem registrada corpo a corpo |
| Veículos | `Vehicle` conferido contra `vehicleKills`, já participa do total | Não somar novamente nem mostrar contagem separada: não é transmitida no contrato atual |
| Outras categorias | `Other`, já participa do total | Não deduzir veículos de total − fogo − corpo a corpo: a diferença inclui Other |
| Tempo registrado | `TTFStatsGameTimeSeconds` validado, transmitido no legado `survival_seconds` | Horas/minutos da fonte de tempo jogado; não dias do mundo nem prova da duração de uma vida |
| Dias sobrevividos no mundo | Nenhum campo validado neste contrato | Não exibir |
| Distância a pé / dirigida | Não transmitidas nem persistidas separadamente | Não exibir |
| Evolução na temporada | Snapshots por character_id e season_id; v2 seleciona os últimos 90 e reordena cronologicamente | Histórico das coletas desse registro e temporada; não interpolar dados ausentes |
| Personagens anteriores da conta | Chaves existem, mas vida individual não é certificada | Não montar biografia nem unir vidas por nome |
| Recorde individual/histórico | Sem contrato público que certifique máximo completo por vida/conta | Não declarar recordista global; somente maior valor **da mesma temporada no recorte consultado**, com empates e escopo explícito |

O conjunto integral das categorias é `Axe`, `LongBlade`, `SmallBlade`, `Spear`, `Blunt`, `SmallBlunt`, `Firearm`, `Vehicle`, `Unarmed`, `Other`. O coletor também confere soma das categorias contra soma dos contadores de armas. Divergências tornam as métricas indisponíveis, não zero. A escrita SQL trabalha com bases sazonais: valores de origem acumulados e pontuação da temporada não são intercambiáveis.

O frontend preserva zeros numéricos válidos e rejeita null, booleanos, arrays, objetos e strings vazias como números. Não cria métricas pela diferença entre contadores. As métricas futuras opcionais exigem campo próprio e validação explícita; os RPCs atuais não as fornecem.

## Proposta técnica para uma missão futura, sem implementação no coletor

1. Obter amostras autorizadas em que seja possível comparar veículo, fogo, corpo a corpo, Other, relógio do mundo, tempo jogado, distâncias e troca de personagem com a tela do jogo/mod. Confirmar unidade, origem, versão do mod, reset e comportamento offline. Não adivinhar chaves binárias nem converter tempo TTF em dias do mundo.
2. Certificar identificador imutável da conta e **da vida**, distinguindo reset de contador, recriação com mesmo nome e nova temporada. Hoje player_key deriva de username e character_key deriva de username + nome; reutilização pode fundir vidas. UUID do registro serve para navegação e monograma, não certifica essa separação.
3. Se houver fonte confiável, propor ingestão versionada, sem alterar a assinatura atual de surpresa. Campos candidatos: kills_vehicle, kills_other, played_seconds, survival_world_days, distance_walked_m, distance_vehicle_m, source/schema version e evidência de identidade. Usar NULL para indisponível; contadores sazonais precisam de bases próprias. Não preencher retrospectivamente veículos com a diferença entre totais.
4. Persistir campos aprovados em estado atual **e snapshots**, com unidade explícita e proveniência; manter histórico anterior intacto. Testar categorias inconsistentes, queda/reset de contadores, morte/recriação, nome repetido, temporada nova e coletas fora de ordem antes de publicar novos RPCs.
5. Recordes e histórico entre personagens exigem consulta com escopo completo e identidade comprovada. O endpoint do memorial retorna até 50 registros e escolhe estatística de temporada disponível, portanto seu destaque não é recorde histórico global. A migração 002 revisada permite dossiê com métricas nulas para mortos já publicados no memorial, evitando o 404 causado pela ausência de pontuação. Não publica novos perfis de vivos sem métricas. Sem temporada conhecida, a API não consulta um histórico arbitrário.

## Avatares

O nome recebido em `steam_username` vem do username do Project Zomboid; não é SteamID64 nem prova de URL vanity da Steam. Nenhuma busca por nome é executada. `STEAM_PROFILE_MAP_JSON` aceita associação manual conferida para uma URL Steam permitida; chave por UUID tem precedência, e chave por nome permanece apenas por compatibilidade. Recomenda-se retirar associações legadas ambíguas após revisão humana. O mapa não foi configurado com identidades reais nesta missão.

A API consulta o XML público somente de URLs explicitamente permitidas, sem redirecionamento, com timeout e cache. Valida também o domínio exato do CDN; sufixos como `evilsteamstatic.com` são rejeitados. A interface exige a marca `steam_configured`. Ela indica configuração administrativa, **não autenticação da conta Steam**. Falta de mapa, perfil indisponível, mudança da URL vanity, timeout, formato XML/CDN novo ou imagem indisponível produzem monograma local individual do registro. Sem UUID há monograma genérico, sem inventar vínculo. Não houve consulta a perfis de jogadores reais.

Uma alternativa futura é validar SteamID64 por associação autenticada e consultar dados no servidor. O método oficial [GetPlayerSummaries](https://partner.steamgames.com/doc/webapi/ISteamUser#GetPlayerSummaries) exige SteamIDs e chave de API; não resolve identidade por nome. Nenhuma chave Steam foi solicitada, criada ou exposta.
