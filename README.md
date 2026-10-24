# Treino

App de treino de academia para o celular (PWA). Mostra o treino do dia numa divisão de 5 dias (A–E), registra carga e repetições de cada série, controla o descanso, sugere quando aumentar a carga e guarda o histórico e a evolução de cada exercício. Funciona offline, sem conta e sem servidor: é HTML, CSS e JavaScript puro, sem dependências.

## Rodar local

```
npx --yes http-server -p 8080 -c-1 .
```

Abra `http://localhost:8080/`.

## Testes

```
node --test "tests/*.test.js"
```

Testes no navegador real (Edge no Windows ou Chrome no Linux): ver `tests/e2e/README.md`.

## Visual

Visual "Blocos" (v2.0): blocos coloridos, fontes Unbounded e Figtree (locais, em `vendor/fonts/`),
vidro fosco no menu, no topo ao rolar, no descanso e nas folhas. Estilos em `css/base.css`
(tokens e componentes) e `css/telas.css` (cada tela); animações em `js/movimento.js`. Só tema claro.
Fotos de academia sem pessoas (créditos em `img/CREDITOS.md`).

## Ícones

O desenho está em `icons/icon.svg`. Para gerar os PNGs:

```
powershell -ExecutionPolicy Bypass -File tools/gerar-icones.ps1
```

ou, com o ImageMagick (Linux), a partir do SVG sem os cantos arredondados do fundo
(`magick -background none -density 1200 icone.svg -resize 512x512 icons/icon-512.png`, idem 192 e 180).

## Publicar no GitHub Pages

1. No site do GitHub, crie um repositório **público** (por exemplo `treino`), sem README nem outros arquivos iniciais.
2. Nesta pasta, mescle a branch de trabalho na `main`, ligue o repositório e envie o código (troque `<usuario>` e `<repo>`):

   ```
   git checkout main && git merge feat/app-treino
   git remote add origin https://github.com/<usuario>/<repo>.git
   git push -u origin main
   ```

3. No repositório, vá em **Settings → Pages**, escolha **Branch `main`** e a pasta **/ (root)** e salve.
4. Depois de alguns minutos o app fica em `https://<usuario>.github.io/<repo>/`.

## Atualizar o app

Altere os arquivos, **aumente `VERSAO_APP` (em `js/util.js`) e `CACHE` (em `sw.js`) juntos, com o mesmo número** (por exemplo `1.0.1` e `treino-1.0.1`), faça commit e push. No celular, feche e abra o app duas vezes para carregar a versão nova.

## Instalar no celular

- **Android (Chrome):** menu ⋮ → "Instalar app".
- **iPhone (Safari):** Compartilhar → "Adicionar à Tela de Início".

> **Aviso para iPhone:** instale na tela de início ANTES do primeiro treino e use sempre pelo ícone: no iPhone, o app instalado guarda os dados separado do Safari, e o Safari apaga dados de sites não instalados após uns 7 dias sem uso. Se já usou pelo Safari, faça Exportar backup lá e Importar no app instalado.

## Dados

Os dados ficam só no aparelho (localStorage). Faça um backup em **Ajustes → Exportar backup** de vez em quando; ele pode ser restaurado em **Importar backup**.
