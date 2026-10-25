# Status do servidor — consulta e limites

O código usa UDP A2S_INFO para consultar estado/quantidade e A2S_PLAYER separadamente para nomes. INFO não contém a lista nominal. A consulta PLAYER usa challenge e pode não ser suportada, ser filtrada pela hospedagem/firewall, devolver nomes ocultos ou ficar inconsistente com INFO por entradas/saídas entre as respostas. O protocolo UDP não autentica a identidade civil/Steam dos nomes. Não associar esses nomes automaticamente aos personagens do ranking.

Melhorias locais desta missão:

- Parser A2S_PLAYER valida cabeçalho, limites de cada campo, nome publicável e duração finita; pacote truncado/fragmentado/inválido não lança exceção fora do handler de socket. Timeout/erro devolve lista indisponível, não inventa jogadores.
- Só expõe lista com marcador playerListVerified quando quantidade de nomes únicos corresponde à contagem INFO e todas as entradas são válidas. A interface exige esse marcador. Uma divergência pode ser apenas uma corrida de entrada/saída; nesse caso preserva a contagem INFO e omite nomes até próxima consulta consistente.
- Falha A2S e de fallback externo resulta online=null, contagem/latência ausentes e estado “Indisponível”. Timeout não comprova servidor offline. Um estado offline só é apresentado quando a fonte externa o declara explicitamente; A2S bem-sucedido comprova resposta online naquele instante.
- HTTP de API externa sem estado reconhecido também é desconhecido. Booleanos, valores ausentes e objetos não viram zero jogadores ou latência zero. Nenhuma lista de nomes arbitrária da API externa foi promovida a verificada.
- checkedAt informa a hora da consulta; lastValidAt é a última resposta com estado conhecido recebida por esta instância. Numa falha, preserva somente esse horário anterior; não apresenta contagem antiga como atual. O cache de 15 segundos é por instância/configuração, não armazenamento durável. Reinício/cold start pode perder a última informação válida.

A seção Servidor agora usa HTML legível, com estado, conectados, latência da consulta e horários; os links públicos “Consultar JSON” e “Ver card” foram removidos. As APIs e a geração de card PNG permanecem disponíveis para os consumidores existentes. Card sem resposta também mostra estado indefinido e contagens ausentes.

O frontend consulta novamente a cada dois minutos quando visível; isso não dispara nem confirma coleta Python. A última coleta confirmada vem de collector_runs pelo RPC; o horário de recebimento dos dados pela página é separado. Não foi mostrado horário da próxima coleta, pois não foi verificado um agendamento real. O cron mencionado no README do coletor não comprova configuração ativa no Railway.

Testes são locais, com pacotes sintéticos e provedores substituídos: INFO com lista parcial, lista consistente, pacote PLAYER truncado, cabeçalho fragmentado, duração inválida, resposta externa desconhecida e falha com último horário válido. Não foram enviados comandos administrativos ou alteradas configurações da BisectHosting. Não foi confirmada uma resposta atual do servidor real a partir deste ambiente. Suporte UDP e lista nominal devem ser conferidos futuramente na hospedagem autorizada.
