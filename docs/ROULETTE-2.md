# Roleta dos Campeões 2.0

Escopo: somente a tela da roleta. Base: Master 16 (`e2aee699e718e96a4284f58f6bc532b5edd679e4`). Nenhuma migração, nova permissão, mudança de catálogo, API de escrita ou regra de campeonato.

## Separação dos modos

- **Demonstração** usa exclusivamente `roulette-model.js`, `roulette-spin.js` e a apresentação `roulette-machine.js`. Não recebe função de transporte ou callback de escrita. Escolhe localmente, antes do giro, uma raridade e um prêmio do catálogo administrativo consultado. Usa Web Crypto com rejeição de viés e os pesos individuais já existentes. Resultados ficam apenas na memória e nunca são enviados ao backend.
- Seleção dirigida e IDs técnicos existem somente nos controles recolhíveis da demonstração. A identificação “TESTE DIRIGIDO” aparece no resultado. Não integram o corpo da operação oficial.
- **Sorteio oficial** continua em `admin-rewards.js` e no backend existente: autenticação, elegibilidade, confirmação da mesma vida, idempotência, validação do mundo/sobrevivência e persistência antecedem a animação. O backend continua sendo a única autoridade sobre o prêmio. A apresentação recebe o snapshot persistido.
- Recarregar consulta novamente o resultado oficial. “Rever apresentação” reproduz o snapshot e não envia POST. Encerrar uma animação não reverte nem repete uma escrita oficial já iniciada. Em caso de erro/timeout, atualizar antes de qualquer nova tentativa.
- Versão `season-prizes-v2-b42.21.0`, 24 prêmios, catálogo histórico, entrega manual, veículos e automação mantidos como estavam.

## Geometria única

O gradiente, as divisórias e a parada usam a mesma tabela, calculada em décimos inteiros de grau. O ponteiro é fixo no topo, em 0°. Não existe correção visual independente.

| Raridade | Chance | Intervalo horário | Amplitude | Centro | Rotação final normalizada |
|---|---:|---|---:|---:|---:|
| Comum | 45% | [0°, 162°) | 162° | 81° | 279° |
| Incomum | 30% | [162°, 270°) | 108° | 216° | 144° |
| Rara | 20% | [270°, 342°) | 72° | 306° | 54° |
| Épica | 4% | [342°, 356,4°) | 14,4° | 349,2° | 10,8° |
| Lendária | 1% | [356,4°, 360°) | 3,6° | 358,2° | 1,8° |

Para centro `c` e posição atual `a`: `alvo = (360-c) mod 360`; `parada = a + 7×360 + (alvo-a) mod 360`. O ângulo sob o ponteiro é `(-parada) mod 360`, sempre o centro do setor escolhido. As legendas de 4% e 1% ficam externas para não ampliar os setores pequenos.

## Cancelamento e acessibilidade

Uma geração identifica cada giro. `AbortController` cancela a Web Animation; conclusões atrasadas não revelam resultados de um giro antigo. Mudança de modo, saída da tela, atualização dos dados, ocultação do documento, `pagehide`, `beforeunload` e desmontagem cancelam efeitos, luzes e vozes de áudio. Observação dos ancestrais cobre o ocultamento do painel administrativo. Os listeners são removidos na desmontagem. Não existe timer de áudio ou escrita na demonstração.

Giro normal de 9,5 segundos, aceleração/desaceleração e lâmpadas sequenciais. Movimento reduzido pula a animação, preservando a coerência do resultado. Áudio discreto só na revelação; volume e mute persistem como preferências. Diálogo nativo contém o foco; Escape e fechamento devolvem o foco ao acionador. Abas suportam setas, Home e End. Imagens reais de itens não foram comprovadas: os cards usam um símbolo decorativo explicitamente identificado, com nome e quantidades reais do catálogo. A textura metálica SVG é decorativa, não é uma imagem de item do jogo.

## Validação reproduzível sem produção

```powershell
node --test tests/roulette.test.js tests/master15.test.js
npm test
npm run test:catalog
node scripts/preview-roulette.js --port=4180
# Outros processos independentes, bancos sintéticos separados:
node scripts/preview-roulette.js --port=4182 --reduced-motion
node scripts/preview-roulette.js --port=4181 --official-fixture
```

Cada servidor escuta somente loopback, bloqueia IO externo e usa PostgreSQL PGlite sintético. Por padrão rejeita todas as escritas. A opção `--official-fixture` permite o handler oficial existente exclusivamente nesse banco descartável; nunca utiliza DSN ou credenciais reais. Evidência de sobrevivência dessa fixture expira normalmente, exigindo reiniciar seu próprio processo para outro ensaio elegível. Não executar esse ensaio no Admin produtivo.

`GET /__proof` mostra contadores de POST/RPC de mutação, quantidade de sorteios/eventos e hashes SHA-256 canônicos de todas as tabelas exportadas, antes/depois. Giros, alternâncias, recargas e cancelamentos devem manter zero POST, zero mutações e hashes iguais nas fixtures de demonstração. Na fixture oficial, um único POST deve criar somente um sorteio/evento; reapresentar e recarregar não devem aumentar os contadores.

Os testes Node cobrem geometria, tickets determinísticos 45/30/20/4/1, pesos internos de todos os itens, catálogo imutável, exclusão mútua, conclusão atrasada, falha de início, movimento reduzido, isolamento de transporte e listeners reais de ciclo de vida com EventTargets isolados. A IAB mantém `document.hidden=false` mesmo com outra aba aberta: a ocultação do documento é ensaiada pelos listeners com EventTargets; navegação de tela, atualização e recarga também são verificadas interativamente no navegador.
