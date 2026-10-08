# Visual novo: cinza aço + cobre (v1.5.0)

Data: 2026-10-07 · Status: aprovado (opção 1 das 3 provas) · Versão alvo: 1.5.0

## Objetivo

Trocar o visual do app (hoje: tema claro "editorial quente", bege + coral) por um visual
**cinza aço com laranja metálico (cobre)**, com a mesma estrutura dos apps aprovados:
faixa em degradê no topo, folha clara arredondada por cima, cards brancos arredondados,
botões em pílula e menu flutuante em vidro. **Só visual**: nenhuma regra, dado, rota ou
texto de negócio muda.

## Decisões

- Escolhida a **opção 1 · Aço escovado + cobre** (prova em `.superpowers/provas/visual-metalico.html`,
  fora do Git).
- O **menu de baixo continua o atual**: Hoje · Corpo · Exercícios · Histórico · Ajustes
  (a prova mostrava outro menu; descartado para não mudar onde as coisas ficam).
- Só tema claro. Nenhum elemento de identidade de empresa (fonte, logo ou cor).
- Fonte **Outfit** (300–600), servida localmente (o app funciona offline).
- O cobre metálico aparece em: caixas de digitar, botão principal, dias treinados, check
  de série feita, item ativo do menu, avatar sem foto, letra do treino e barra de progresso.
  Os cards continuam brancos.

## Tokens

| Token | Valor | Uso |
|---|---|---|
| `--faixa` | `radial-gradient(220px 170px at 94% 6%, rgba(214,128,78,.32), transparent 70%)`, `radial-gradient(300px 260px at 0% 100%, rgba(0,0,0,.45), transparent 70%)`, `linear-gradient(165deg, #8d939b 0%, #5d636b 42%, #2d3136 100%)` + textura escovada (`repeating-linear-gradient(90deg, …)`) | topo de toda tela |
| `--bg` (folha) | `#efeff0` | fundo abaixo da faixa |
| `--surface` | `#ffffff` | cards, sheet, toast |
| `--surface-2` | `#e7e8ea` | botão secundário, fundos neutros |
| `--text` | `#1f2023` | texto |
| `--muted` | `#6b6d72` | texto secundário |
| `--accent` | `#a6542a` | texto/ícone em cobre (contraste ≥ 4,5 no branco) |
| `--cobre` | `#bf6a37` | preenchimentos sólidos |
| `--metal` | `linear-gradient(180deg, rgba(255,255,255,.28), transparent 48%, rgba(0,0,0,.07) 52%, transparent), linear-gradient(100deg, #93491f, #bf6a37 24%, #eaa274 50%, #bf6a37 76%, #93491f)` | preenchimento metálico (dias, check, avatar, barra) |
| `--metal-botao` | igual a `--metal`, porém com centro mais escuro (`#c27141`) | botão principal (texto branco legível) |
| `--caixa` | `linear-gradient(180deg, #f8e1cf 0%, #efc3a2 47%, #e2a77f 53%, #f3cfb2 100%)` | caixas de digitar (cobre acetinado) |
| `--caixa-texto` | `#3d1d0a` | texto dentro das caixas |
| `--suave` | `#f6e6db` | destaque claro (selo, item "eu", menu ativo) |
| `--ok` / `--warn` / `--danger` | `#31765a` / `#a96313` / `#bd352d` | iguais aos de hoje |

Raios: cards 22px, folha 28px no topo, botões e chips em pílula (999px), caixas de digitar 14px.

## Estrutura: topo + folha (todas as telas)

Toda tela já começa com os mesmos elementos de cabeçalho: `.voltar`, `.titulo`,
`.hoje-cab` ou `.treino-cab`. O roteador (`js/app.js`), logo depois de desenhar a tela,
**envolve esses elementos iniciais num `<div class="topo">` no mesmo lugar** (dentro do
`div.tela-*` da tela, se houver). Nada mais muda de lugar, então:

- delegação de eventos que usa `closest('.tela-treino')` etc. continua funcionando;
- seletores existentes (`.tela-x .titulo`, `.hoje-cab`) continuam valendo.

Regras do envoltório:

- percorre os primeiros nós do `#app`; se o primeiro elemento for um `div` cuja classe
  começa com `tela-`, percorre os filhos dele;
- junta os elementos seguidos que casam com `.voltar, .titulo, .hoje-cab, .treino-cab`
  (ignorando texto em branco) e os coloca num `div.topo` na posição do primeiro;
- se não achar nenhum, marca o `#app` com a classe `sem-topo` (recebe o espaço da barra de status).

Visual:

- `.topo`: faixa `--faixa` de ponta a ponta (sangra a margem lateral do `#app`), texto
  branco, padding superior com `env(safe-area-inset-top)`, e na base uma "borda" da folha:
  pseudo-elemento de 28px na cor `--bg` com cantos superiores arredondados e o puxador
  (38×4px) no meio. A partir dali o fundo é a folha (`--bg`).
- `.titulo` no topo: Outfit 400, 28–30px, branco. `.voltar` branco 85%. `.muted` dentro
  do topo: branco 78%.

## Por tela

**Hoje** (`js/telas/hoje.js`): o card "Minha semana" sai da folha e o conteúdo dele sobe
para o topo, como na prova:

```
[Quarta, 7 de outubro]                    (avatar)
Bom dia, Nome!
2 treinos · 32 min de cardio · 42 pts
[seg][ter][qua][qui][sex][sáb][dom]   ← cheio = treinou (cobre), tracejado = hoje
🔥 3 dias seguidos                      (Compartilhar)
```

- tudo dentro do `header.hoje-cab` (que vira o topo); mantém `data-sec="semana"`,
  `data-dia`, `data-acao="compartilhar-semana"` e os rótulos acessíveis das bolinhas;
- os dias viram retângulos arredondados (30px de altura) com a letra embaixo;
- "Compartilhar" vira pílula de vidro pequena (branca translúcida) no topo;
- na folha ficam: card do treino (foto em cima, como hoje), "Outro treino", ranking e cardio.

**Treino em andamento** (`js/telas/treino.js`): o `header.treino-cab` vira o topo, com
o botão "⋯" em vidro e **uma barra de progresso** (séries feitas / total) em cobre metálico
abaixo da linha de tempo. A linha de série usa as caixas de cobre acetinado e o check
em cobre metálico quando marcado.

**Demais telas**: só o envoltório automático + CSS. Nenhuma mudança de markup.

## Componentes

- **Botões**: pílula. `btn-principal` = `--metal-botao` com texto branco (sombra de texto
  leve) e brilho interno; `btn-sec` = branco translúcido com borda cinza; `btn-perigo` igual
  ao de hoje (vermelho). `btn-icone` vira círculo.
- **Caixas de digitar** (`input` de texto/número/data/busca, `select`, `textarea`):
  `--caixa` com texto `--caixa-texto`, borda `rgba(140,70,30,.28)`, brilho interno; foco
  com anel cobre. Checkbox/rádio: `accent-color: var(--cobre)`. Desabilitada (série feita):
  opacidade da linha, como hoje.
- **Cards**: branco 92%, borda branca, raio 22px, sombra leve. `card-destaque` igual,
  com a foto do treino em cima (comportamento atual).
- **Menu**: vidro claro flutuante (já é); item ativo em `--accent` com fundo `--suave`;
  ícones atuais mantidos (só cor).
- **Chips**: pílula branca com borda; ativo com fundo `--suave` e contorno cobre.
- **Selo "pode aumentar"**: faixa `--suave` com texto cobre escuro; "reduzir" continua âmbar.
- **Check de série feita**: `--metal`, ícone branco.
- **Ranking/grupo**: linhas em cinza claro; "eu" com `--suave` e contorno cobre; valores em `--accent`.
- **Sheet (painel de baixo), toast e cronômetro de descanso**: brancos, raio 26px; o pulso
  do cronômetro no fim usa cobre.
- **Avatar sem foto e letra do treino**: `--metal` com letra branca.
- **Mapa**: trajeto em `#bf6a37`; fundo do mapa cinza claro.
- **Cards de compartilhar (canvas)**: mesma paleta (fundo `#efeff0`, cobre no lugar do coral,
  Outfit se carregada).
- **Barra de status / manifest**: `theme-color` e `background_color` = `#80868e` / `#efeff0`.
- **Ícone do app**: fundo cinza aço com o haltere em cobre (SVG + PNGs regerados).

## Fora do escopo

Menu e rotas novas, modo escuro, qualquer mudança de lógica, textos de tela (exceto o card
"Minha semana", que sobe para o topo sem mudar os textos).

## Testes e aceite

- `node --test "tests/*.test.js"`: os 189 continuam passando.
- E2E existentes `corpo.e2e.mjs` e `cardio.e2e.mjs` passam (Edge real).
- Novo `tests/e2e/visual.e2e.mjs` (escrito antes do CSS): em cada rota principal, o primeiro
  elemento visível é `.topo` com o título dentro; a fonte calculada é Outfit; as caixas de
  digitar têm fundo em degradê; o botão principal tem raio de pílula; na Hoje, a semana está
  dentro do `.topo`; no treino, existe a barra de progresso; e há capturas a 390×844 de todas as
  telas para conferência visual.
- Foco visível no teclado; `prefers-reduced-motion` respeitado (regra atual mantida).
- `VERSAO_APP` (js/util.js) e `CACHE` (sw.js) = `1.5.0`; fonte nova incluída no cache do SW.
- Publicação (push na main) só com ok do Tiago.
