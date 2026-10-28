# Imagens dos itens — Roleta 2.0

Verificação: 28/10/2026. Catálogo season-prizes-v2-b42.21.0, sem alterações em IDs, pesos, probabilidades ou dados persistidos.

## Fonte, versão e condições

O banco [Project Zomboid Map](https://projectzomboidmap.com/pt/items/) anuncia Build 42 e apresenta IDs exatos e grupos de variantes. Nas páginas e na política de privacidade examinadas não foi encontrada uma licença explícita para redistribuir os arquivos hospedados. O identificador exibido é `251662243b69`, não uma comprovação de patch 42.21.0. A consulta HTTP direta foi recusada com 403; nenhuma proteção foi contornada e nenhum PNG desse site foi incorporado.

A origem efetivamente utilizada é a instalação Steam local, em leitura. A versão foi verificada pelo bytecode de `zombie.core.Core`: `GameVersion(42,21,"")` e `buildVersion=0`, resultando em **42.21.0**. Steam build ID: **25485521**. Não houve atualização, execução ou modificação do jogo nem acesso ao servidor.

Os [termos oficiais da The Indie Stone](https://projectzomboid.com/blog/support/terms-conditions/), seção 2.2, permitem uso criativo de assets para promoção do jogo em produções não comerciais, com a atribuição indicada. O aviso completo com links está junto dos cards e no modal. Essa permissão não transfere a propriedade das imagens, não declara o dashboard oficial e não autoriza uso comercial sem acordo adicional. A licença de bibliotecas ou do visualizador do site de referência não foi tratada como licença da arte do jogo.

## Cobertura efetiva

- **24/24 prêmios**, **30/30 componentes**, **23/23 script_id distintos**.
- 23 PNGs transparentes locais: **10.559 bytes** ao todo. Sem hotlinking.
- Cada imagem foi obtida pelo campo `Icon` ou `IconsForTexture` da definição exata `Base.*`, não por similaridade de nomes. Cada componente de kit tem sua própria imagem e quantidade.
- O [mapeamento completo](../public/roulette-item-assets.js) registra nome de textura, pack/página/retângulo, linha e hashes do script, definição, pack e PNG. Os hashes são verificados nos testes.
- Variantes do mesmo ID são declaradas; uma variante representativa é exibida. A imagem não afirma a cor/condição do item que venha a ser entregue. O tipo, quantidade e resultado oficial continuam vindos do catálogo/snapshot.
- `Base.Machete` usa `Item_Machete_Forged` nesta versão; `Base.HandShovel` usa `Item_TZ_GardenTrowel`. Não foram substituídos por ícones de nomes parecidos.
- `Item_TZ_GardenTrowel` aparece duas vezes no pack legado com pixels diferentes. Foi conferido o carregador `TexturePackDevice.initMetaData`: percorre as páginas em ordem e usa `submap.put`, portanto a última definição prevalece. A origem selecionada é `ThuztorInventory1`; a definição antiga sombreada fica registrada no mapeamento. Nenhuma correção visual aproximada foi aplicada.
- Há um `UI2.pack.backup` local. Todos os ícones selecionados também encontrados nele têm os mesmos pixels; isso não é uma certificação de integridade de toda a instalação. Ícones novos sem ocorrência no backup são identificados por `local_backup_agrees: null`.

| script_id exato | Textura verificada | Variantes declaradas | Arquivo local |
|---|---|---:|---|
| `Base.Axe` | `Item_Axe` | 1 | [PNG](../public/assets/items-b42/Base.Axe.png) |
| `Base.Bag_ALICEpack` | `Item_AliceBag` | 1 | [PNG](../public/assets/items-b42/Base.Bag_ALICEpack.png) |
| `Base.Bag_ALICEpack_Army` | `Item_AliceBag_Camo` | 1 | [PNG](../public/assets/items-b42/Base.Bag_ALICEpack_Army.png) |
| `Base.Bag_BigHikingBag` | `Item_BigHiking_Blue` | 3 | [PNG](../public/assets/items-b42/Base.Bag_BigHikingBag.png) |
| `Base.Bag_DuffelBag` | `Item_Duffelbag` | 7 | [PNG](../public/assets/items-b42/Base.Bag_DuffelBag.png) |
| `Base.Bag_NormalHikingBag` | `Item_Hiking_Blue` | 3 | [PNG](../public/assets/items-b42/Base.Bag_NormalHikingBag.png) |
| `Base.Bag_SurvivorBag` | `Item_AliceBag` | 3 | [PNG](../public/assets/items-b42/Base.Bag_SurvivorBag.png) |
| `Base.BallPeenHammer` | `Item_BallPeenHammer` | 2 | [PNG](../public/assets/items-b42/Base.BallPeenHammer.png) |
| `Base.ClubHammer` | `Item_ClubHammer` | 2 | [PNG](../public/assets/items-b42/Base.ClubHammer.png) |
| `Base.Crowbar` | `Item_Crowbar` | 2 | [PNG](../public/assets/items-b42/Base.Crowbar.png) |
| `Base.GardenFork` | `Item_Pitchfork2` | 1 | [PNG](../public/assets/items-b42/Base.GardenFork.png) |
| `Base.Hammer` | `Item_Hammer` | 2 | [PNG](../public/assets/items-b42/Base.Hammer.png) |
| `Base.HandAxe` | `Item_AxeHand` | 2 | [PNG](../public/assets/items-b42/Base.HandAxe.png) |
| `Base.HandShovel` | `Item_TZ_GardenTrowel` | 1 | [PNG](../public/assets/items-b42/Base.HandShovel.png) |
| `Base.HuntingKnife` | `Item_HuntingKnife` | 2 | [PNG](../public/assets/items-b42/Base.HuntingKnife.png) |
| `Base.Katana` | `Item_Katana` | 1 | [PNG](../public/assets/items-b42/Base.Katana.png) |
| `Base.Machete` | `Item_Machete_Forged` | 1 | [PNG](../public/assets/items-b42/Base.Machete.png) |
| `Base.PipeWrench` | `Item_PipeWrench` | 1 | [PNG](../public/assets/items-b42/Base.PipeWrench.png) |
| `Base.Screwdriver` | `Item_Screwdriver_Blue` | 2 | [PNG](../public/assets/items-b42/Base.Screwdriver.png) |
| `Base.Shotgun` | `Item_Firearm_PumpShotgun` | 1 | [PNG](../public/assets/items-b42/Base.Shotgun.png) |
| `Base.VarmintRifle` | `Item_RifleHunting` | 1 | [PNG](../public/assets/items-b42/Base.VarmintRifle.png) |
| `Base.WoodAxe` | `Item_WoodAxe` | 2 | [PNG](../public/assets/items-b42/Base.WoodAxe.png) |
| `Base.Wrench` | `Item_Wrench` | 1 | [PNG](../public/assets/items-b42/Base.Wrench.png) |

## Fallback e reprodução

ID não mapeado ou não verificado mantém um símbolo explicitamente identificado. Falha de carregamento de PNG também aciona o fallback; não há busca remota ou substituição por outro item. O teste visual de falha usa somente a fixture isolada `--missing-katana-icon`.

`scripts/extract-roulette-icons.js` usa somente as dependências já instaladas (Sharp e javap), lê scripts/packs/jar e rejeita versão diferente, associação ausente e ambiguidade não revisada. Por padrão apenas audita. `--write` exporta a lista permitida em arquivos novos, sem sobrescrever arquivos existentes e sem modificar a instalação. Não é executado na Vercel.

`node --test tests/roulette-icons.test.js tests/roulette.test.js` valida cobertura, hashes, PNGs, nomes exatos, kits, variantes, ausência de hotlinking, fallback, geometria e isolamento. As evidências de navegador distinguem fixture sintética e produção.
