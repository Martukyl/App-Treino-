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

## Ícones

```
powershell -ExecutionPolicy Bypass -File tools/gerar-icones.ps1
```

## Publicar no GitHub Pages

1. No site do GitHub, crie um repositório **público** (por exemplo `treino`), sem README nem outros arquivos iniciais.
2. Nesta pasta, ligue o repositório e envie o código (troque `<usuario>` e `<repo>`):

   ```
   git remote add origin https://github.com/<usuario>/<repo>.git
   git push -u origin main
   ```

3. No repositório, vá em **Settings → Pages**, escolha **Branch `main`** e a pasta **/ (root)** e salve.
4. Depois de alguns minutos o app fica em `https://<usuario>.github.io/<repo>/`.

## Atualizar o app

Altere os arquivos, **incremente `CACHE` em `sw.js`** (por exemplo `treino-v8`), faça commit e push. No celular, feche e abra o app duas vezes para carregar a versão nova.

## Instalar no celular

- **Android (Chrome):** menu ⋮ → "Instalar app".
- **iPhone (Safari):** Compartilhar → "Adicionar à Tela de Início".

## Dados

Os dados ficam só no aparelho (localStorage). Faça um backup em **Ajustes → Exportar backup** de vez em quando; ele pode ser restaurado em **Importar backup**.
