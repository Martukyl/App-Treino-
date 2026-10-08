# Plano: visual cinza aço + cobre (v1.5.0)

Spec: `docs/superpowers/specs/2026-10-07-visual-cinza-cobre-design.md`. Branch `feat/visual-cobre`.
Commit ao fim de cada tarefa. Executor: sessão principal (Opus); revisão final por subagente Opus.

## Tarefa 1 — Teste visual primeiro (vermelho)

- Criar `tests/e2e/visual.e2e.mjs` (Edge + playwright-core, mesmo padrão dos outros):
  passa pelas boas-vindas (programa padrão), visita `#/hoje`, `#/treino` (após "Começar"),
  `#/corpo`, `#/exercicios`, `#/historico`, `#/ajustes`, `#/ranking`, `#/cardio/gps`,
  `#/corpo/registro/novo` e checa:
  - `#app .topo` existe, é o primeiro elemento visível da tela e contém `.titulo`/`.treino-nome`;
  - `getComputedStyle(body).fontFamily` começa com Outfit e `document.fonts.check('16px Outfit')`;
  - Hoje: `.topo [data-sec="semana"]` e `.topo [data-acao="compartilhar-semana"]` existem;
  - Treino: `.topo .barra-progresso` existe; `input.carga` tem `background-image` com gradiente;
    `.btn-principal` tem raio ≥ 999px;
  - captura 390×844 de cada tela em `OUT`.
- Rodar: deve falhar (não há `.topo`). Commit.

## Tarefa 2 — Fonte + envoltório topo/folha

- Baixar Outfit variável (latin, woff2) para `vendor/fonts/outfit-latin-wght.woff2` + licença OFL.
- `js/app.js`: função `marcarTopo(raiz)` (regras da spec) chamada logo após `raiz.innerHTML = …`
  e antes de `tela.montar`; também no HTML de erro.
- `sw.js`: incluir a fonte no `ARQUIVOS`.

## Tarefa 3 — CSS do tema

- Substituir a seção "Direcao visual: editorial quente" do `css/app.css` pela seção
  "Visual cinza aço + cobre (v1.5)" com os tokens e componentes da spec (`@font-face`,
  `.topo`, folha, botões, caixas, cards, menu, chips, selos, ranking, sheet, toast,
  cronômetro, avatar, letra do treino, mapa). Manter as máscaras dos ícones do menu.

## Tarefa 4 — Markup da Hoje e do treino

- `hoje.js`: cabeçalho com data, saudação, resumo, dias e sequência + "Compartilhar";
  remover o card "Minha semana" da folha (mesmos dados, mesmos `data-*`).
- `treino.js`: barra de progresso dentro do `.treino-cab`.
- Rodar `visual.e2e.mjs`: verde. Conferir as capturas. Commit.

## Tarefa 5 — Cores fora do CSS

- `cards-canvas.js` (paleta + Outfit), `mapa.js` (trajeto), `index.html` e `manifest.webmanifest`
  (theme/background), `icons/icon.svg` + PNGs 192/512/apple-touch regerados no Edge headless.

## Tarefa 6 — Versão e testes

- `VERSAO_APP` e `CACHE` = 1.5.0. Rodar unit (189), `corpo.e2e.mjs`, `cardio.e2e.mjs`,
  `visual.e2e.mjs`. Conferir capturas (inclusive cards de compartilhar). Commit.

## Tarefa 7 — Revisão e entrega

- Revisão do branch inteiro por subagente Opus (diff real). Corrigir o que for confirmado.
- Atualizar `CLAUDE.local.md`. Mostrar as capturas; push na main só com ok do dono do app.
