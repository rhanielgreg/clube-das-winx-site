# Ingestão — revisão da Missão 05, preparada, não aplicada

## Escopo e evidência

A auditoria de produção fornecida pelo responsável identificou `SECURITY DEFINER`, proprietário `postgres` e ACL `{=X/postgres,postgres=X/postgres,service_role=X/postgres}`. A permissão de PUBLIC alcança anon/authenticated mesmo sem grants de tabela e com RLS. Não foi acessado o Supabase nesta missão.

Contrato conferido com a cópia local do coletor e a definição SQL disponível:

```sql
public.ingest_player_observation(text,text,text,boolean,text,timestamptz,integer,integer,integer,bigint,text)
```

São 11 argumentos: p_player_key, p_character_key, p_character_name, p_alive, p_blob_sha256, p_observed_at, p_kills_total, p_kills_firearm, p_kills_melee, p_survival_seconds e p_steam_username (o último texto). A cópia do coletor usa `SUPABASE_SERVICE_ROLE_KEY`; isso não comprova que a credencial atualmente configurada no Railway assume o mesmo papel. Não foram lidas credenciais.

`001_restrict_ingestion.sql` altera somente ACLs dessa família de funções. Não substitui corpo, proprietário, SECURITY DEFINER, search_path, tabelas, RLS, registros ou funções de leitura. Revoga PUBLIC e grants diretos de anon/authenticated em todas as sobrecargas; concede EXECUTE a service_role **apenas no contrato necessário de 11 argumentos**. Grants service_role já existentes nas demais sobrecargas não são removidos nem ampliados.

Depois dos REVOKEs, verifica permissão efetiva e memberships transitivos em papéis com EXECUTE, além do proprietário. Inclui caminhos potencialmente utilizáveis por SET ROLE mesmo com NOINHERIT. Se encontrar um, gera exceção: a transação inteira deve ser revertida. A análise MEMBER é conservadora e pode bloquear memberships que tenham SET desativado; resolver essa divergência exige revisão, não alteração automática de papéis compartilhados. Concessões delegadas com dependentes também podem impedir o REVOKE: nesse caso, parar e revisar; não usar CASCADE indiscriminado.

## Sequência proposta para um ambiente posteriormente autorizado

1. Confirmar projeto/ambiente e papel de execução administrativa, janela de manutenção e acesso de recuperação. Salvar, em local privado, saída de `preflight.sql` e `security-check-readonly.sql`: definições, ACLs, proprietário e leituras. Esses scripts apenas consultam catálogos. Não anexar tokens às saídas.
2. Conferir a assinatura acima, proprietário postgres e SECURITY DEFINER. Inventariar sobrecargas e grants/memberships inesperados. Comparar definições reais de leitura com a fixture antes de considerar 002. Não presumir que toda a estrutura em produção coincide com a cópia local.
3. Conferir por meios administrativos que a identidade efetiva do coletor é service_role e que sua credencial funciona. Não publicar a chave nem transferir privilégios de serviço para o navegador. Primeiro ensaiar em homologação com estrutura e papéis equivalentes.
4. Aplicar **somente 001** como unidade transacional. Executar o arquivo completo. Se houver erro, executar ROLLBACK na sessão abortada e investigar. Não confirmar parcialmente comandos retirados do bloco.
5. Repetir `security-check-readonly.sql`. anon/authenticated devem ser false em todas as sobrecargas; service_role deve ser true na assinatura de 11 argumentos; a consulta de caminhos herdados deve retornar zero linhas. ACLs e EXECUTE das leituras devem ser idênticos ao inventário anterior. Um grant antigo de service_role em sobrecarga legada pode continuar true legitimamente.
6. Em homologação, executar consultas como anon/authenticated e tentativa de ingestão sintética (esperado SQLSTATE 42501); conferir ingestão autorizada do coletor. Em produção, acompanhar a próxima coleta normal, sem injetar observações artificiais em dados reais. Os scripts de validação preparados não chamam a ingestão.
7. Tratar **002 separadamente**, após conferência do schema e aprovação. Depois, `validate-readonly.sql` verifica representantes/perfis, somente mortos e última coleta da mesma temporada. Comparar pontuações, snapshots, temporadas e campeões com a cópia de segurança. A definição de `close_ranking_season` não é alterada.

## Reversão segura

Se 001 falhar antes do COMMIT, ROLLBACK restaura integralmente as ACLs anteriores. Uma falha desse tipo mantém o risco antigo de PUBLIC: registrar e corrigir a dependência antes de nova tentativa.

Se o coletor parar após 001 confirmada, **não restaurar a ACL antiga nem conceder PUBLIC/anon/authenticated**. A revogação de acesso anônimo não pode ser desfeita mantendo a mesma proteção. A recuperação segura é conferir URL, credencial e papel do coletor; se um grant necessário tiver sido perdido, restaurar somente o acesso autorizado da assinatura comprovada. Exemplo para revisão e execução futura pelo administrador:

```sql
begin;
grant execute on function public.ingest_player_observation(
  text,text,text,boolean,text,timestamptz,integer,integer,integer,bigint,text
) to service_role;
-- Validar permissão efetiva e caminhos herdados antes de confirmar.
-- Se anon/authenticated alcançarem a função: ROLLBACK e investigar.
commit;
```

Esse GRANT é idempotente e já consta em 001; não corrige uma credencial configurada com papel errado. Qualquer papel de ingestão alternativo exige confirmação de identidade e revisão da sua cadeia de membros. Não executar um GRANT para um papel adivinhado. Restaurar PUBLIC para recuperar disponibilidade reabre a vulnerabilidade e não é uma reversão segura.

Para reverter **002**, guardar previamente as definições e ACLs exatas dos RPCs de leitura. Em mudança coordenada do site e do banco, restaurar somente esses contratos anteriores, mantendo 001 aplicada. Conservar v2 enquanto houver consumidores que dependam dela; não remover auxiliares com CASCADE. Não recalcular pontuação, apagar snapshots, reabrir temporadas ou alterar campeões. Uma reversão exata depende do inventário real, portanto não há script genérico que sobrescreva produção.

## Limite dos testes

Os testes executam PostgreSQL descartável em memória (PGlite), incluindo a ACL comunicada, grants diretos, herança transitiva, NOINHERIT, membership em service_role, idempotência, negação real de execução, escrita sintética com service_role, leituras preservadas e corpo inalterado. Não simulam PostgREST, autenticação Supabase, configuração Railway ou todos os papéis/extensões do banco real.
