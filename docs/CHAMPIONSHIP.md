# Campeonato oficial — implementação local da Missão 06

## Contrato aprovado

Somente `alive IS TRUE` compete. Mortos vão ao Memorial; `NULL` é desconhecido e não compete. Uma conta tem um representante: dentre seus personagens vivos com kills válidas, escolher o registro mais recentemente observado (`last_seen_at DESC`, `observed_at DESC`, UUID crescente). Não somar vidas. Essa escolha conserva o conceito anterior de representante; não escolhe automaticamente a vida de maior pontuação da conta.

A ordem dos representantes é **kills sazonais decrescentes → tempo jogado registrado decrescente, nulos por último → UUID crescente**. O tempo serve apenas como desempate; não equivale a sobrevivência no mundo. UUID é um último critério estável para desfazer empate exato, não uma pontuação ou certificação de vida. Online não participa de nenhuma consulta de elegibilidade ou encerramento.

`003_official_championship.sql` preserva a assinatura de `close_ranking_season(uuid,uuid)`. Vencedor omitido significa calcular o primeiro representante vivo. Se um UUID for informado, deve coincidir com esse primeiro lugar; não permite forçar outro personagem ou um morto. A API administrativa usa exclusivamente `close_ranking_season_v2`: uma implantação sem o novo contrato não pode cair silenciosamente na função antiga, que aceitava mortos. A função v2 devolve o resultado efetivamente gravado, e a mensagem da API usa esse resultado.

## Certificação do encerramento

Antes de gravar qualquer resultado, o SQL verifica:

- Temporada ativa, sem resultado anterior; locks das tabelas relevantes serializam o encerramento com ingestão e mudanças de temporada.
- Uma coleta concluída com sucesso nos últimos **15 minutos**, não situada mais de um minuto no futuro; nenhuma coleta marcada como running.
- Ao menos uma estatística sazonal com kills válidas. Temporada vazia não prova extinção.
- Para personagens com estatística da temporada **ou** observados desde seu início: estado conhecido, observação recente e não futura; vivos também precisam de kills válidas e estatística recente. Um vivo com dado faltante impede certificar quem lidera.

Essa janela de 15 minutos acompanha o limiar de stale já usado pelo site. É uma tolerância operacional explícita, não um agendamento de coleta confirmado nem prova de um evento no exato segundo do fechamento. Precisa ser ensaiada com a origem real antes de homologação. A existência de um registro running abandonado, personagem antigo ainda marcado vivo, ou morto que deixou de ser observado pode bloquear legitimamente o fechamento até investigação; o sistema não transforma ausência de informação em morte. Não limpe registros ou altere estados apenas para contornar o bloqueio.

Com evidência suficiente, há duas saídas:

1. **champion:** primeiro representante vivo. Escreve `season_winners` com nome, kills e tempo de fechamento.
2. **apocalypse:** nenhum vivo e todos os participantes examinados comprovadamente mortos. Não escreve campeão em `season_winners`; grava resultado explícito para exibir **O Apocalipse Venceu**.

Qualquer evidência insuficiente gera exceção e conserva a temporada ativa sem resultado parcial. Estar desconectado não cria essa insuficiência se o coletor continua lendo e validando o salvamento desse personagem. O SQL não consulta a lista A2S.

## Arquivo e compatibilidade

As novas tabelas `season_results` e `season_classification` guardam somente os novos encerramentos oficiais: resultado, versão de regras, momento de fechamento, coleta de referência, representantes, estados no fechamento, nomes e estatísticas daquela temporada. RLS habilitado, sem leitura/escrita direta para anon/authenticated; exposição apenas por RPCs públicas de leitura. Não são tabelas de conquistas genéricas.

As funções públicas de perfil usam o arquivo para posições e números das temporadas novas encerradas. O estado de vida atual continua sendo lido separadamente do personagem; a morte futura não muda o título, nome ou posição arquivados. `get_public_player_titles` lê os títulos já registrados, não concede medalhas. As temporadas antigas não são recalculadas ou preenchidas por inferência: vencedor legado é preservado, e ausência de vencedor legado aparece como resultado não certificado, nunca como apocalipse.

`get_public_seasons` mantém seu retorno anterior; o novo `get_public_seasons_v2` acrescenta outcome e rules_version. APIs de ranking/admin usam v2. O site exige a aplicação coordenada dos contratos antes de uma futura publicação. Sem v2, a consulta exibe indisponibilidade; não presume que o backend antigo já siga a regra oficial.

Há também uma trava local de contrato: `COMPETITION_RULES_VERSION` precisa ser exatamente `winx-v1`. O exemplo de ambiente deixa esse campo vazio. Sem habilitação, ranking configurado e administração do campeonato respondem 503 antes de chamar os novos RPCs; perfis conservam os contratos anteriores e não consultam os novos títulos. A prévia sintética não depende dessa variável. Nenhuma variável real foi criada ou alterada na Vercel. Depois de uma futura migração autorizada e validada, a habilitação explícita ainda será necessária. Habilitar a variável sem aplicar 003 não faz fallback para encerramento legado: o RPC v2 ausente falha sem chamar a função antiga.

## Limite de identidade: regra 4 ainda depende da origem

O coletor examinado gera character_key a partir de username + nome do personagem. A função de ingestão faz upsert dessa chave, portanto duas vidas com o mesmo nome podem já compartilhar um registro. Não há evidência suficiente para separar ou corrigir retroativamente esses dados. Nenhuma divisão, fusão, migração de pontuação ou heurística de queda de contador foi implementada.

O banco atual **já isola** personagens com chaves distintas: novo UUID e baseline sazonal independente, snapshots antigos preservados. Os testes demonstram isso com duas chaves sintéticas explicitamente distintas, incluindo nomes iguais; não comprovam que o coletor atual gere uma chave nova numa recriação real. Campeonatos novos ainda usam o registro recebido, com essa limitação visível e sem declarar `life_identity_verified=true`.

Contrato futuro proposto, sem implementação ou migração adicional:

```text
source_schema_version
source_world_id       # namespace estável do mundo, não caminho privado
source_account_id     # identificador confirmado da conta, não display name
source_life_id        # gerado/confirmado na origem por nascimento, persistente nos saves
observed_at
alive: true | false | null
metrics: { value, unit, scope, source_version, validation_state }
```

Propor ingestão versionada separada; chave de vida baseada nesses identificadores, nunca no nome. Receber a mesma vida deve ser idempotente; vida nova recebe UUID e baseline novos, ainda que o nome se repita. Vínculo com dados antigos só com prova, sem reatribuir histórias por semelhança. Antes de habilitar, verificar ciclo nascimento/morte/recriação, reinício de mundo, save restaurado e ordem de observações.

## Aplicação futura e reversão

**Não aplicada em serviços reais.** Ordem preparada: 001 (segurança) → 002 (contratos de leitura) → 003 (regras oficiais). 001 permanece independente e prioritária. As migrações e os scripts de auditoria só foram executados no PGlite descartável local nesta missão.

Antes de qualquer aplicação autorizada:

1. Guardar definições/ACLs e cópia dos dados relevantes; executar `championship-preflight.sql` e o inventário de segurança já preparado. Conferir schema, proprietário postgres das funções/tabelas, papéis, ausência de colisões e novas tabelas esperadas. `IF NOT EXISTS` facilita repetir o ensaio, mas não certifica uma tabela preexistente de outra origem.
2. Ensaiar em PostgreSQL/PostgREST de homologação, com autenticação real do coletor, concorrência e cadência de salvamento. Testes PGlite de sessão única não comprovam comportamento concorrente da hospedagem.
3. Aplicar 003 como uma transação inteira. Após erro, ROLLBACK, sem confirmar trechos isolados. Conferir as consultas de divergência de `championship-validate-readonly.sql`: zero linhas; comparar snapshots, temporadas e campeões anteriores com o inventário.
4. Nenhum script de validação chama fechamento ou ingestão real. Testar encerramentos somente em temporadas/observações sintéticas de homologação explicitamente autorizadas.

Antes do primeiro fechamento sob v1, uma reversão autorizada pode restaurar as definições/ACLs anteriores capturadas e a versão compatível das APIs, **mantendo 001**. Deixar as novas tabelas sem uso evita destruição desnecessária; não executar DROP CASCADE. A reversão reabilitaria a regra antiga de classificação, portanto não deve continuar anunciando campeonato oficial.

Depois de existir resultado v1, não remover arquivos ou substituir suas leituras por cálculos dinâmicos antigos. Suspender novos encerramentos e corrigir adiante ou preparar uma camada compatível que preserve integralmente o resultado certificado. Não há rollback genérico seguro que descarte resultados oficiais. Se uma requisição falhar após possível COMMIT, consultar resultado/estado antes de repetir: a função rejeita nova gravação para temporada já encerrada.

Os testes cobrem vivo offline, mortos excluídos, campeão vivo, todos mortos, desconhecidos, dados antigos/futuros/ausentes, coleta em andamento, vazio, empates, vários personagens, nova chave sem herança de kills, título após morte futura e ACLs. O esquema real e o código do mod/servidor permanecem dependências externas não verificadas nesta missão.
