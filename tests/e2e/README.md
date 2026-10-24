# Testes e2e (navegador real)

Não rodam no `node --test` (ficam fora do padrão `tests/*.test.js`).

## Preparar (uma vez)

Numa pasta fora do repo: `npm i playwright-core`. Os scripts são ES modules e importam
`playwright-core` da pasta onde estão; por isso, copie-os para essa pasta antes de rodar.

## Escolher o navegador

- **Windows (padrão):** sem variáveis, usa o Edge em
  `C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe`.
- **Outro executável:** `BROWSER_PATH=/caminho/do/chrome`.
- **Chrome já aberto (Linux, Chrome do flatpak):** abra um Chrome sem janela com porta de depuração
  e aponte `CDP_URL` para ele. `--filesystem=/tmp` deixa os downloads (backup) visíveis aos scripts:

  ```
  flatpak run --filesystem=/tmp com.google.Chrome --headless=new --disable-gpu \
    --remote-debugging-port=9222 --user-data-dir=/tmp/chrome-e2e-treino about:blank &
  CDP_URL=http://localhost:9222 ...
  ```

Outras variáveis: `BASE_URL` (padrão `http://localhost:8080/`; use o endereço publicado para
conferir depois do push), `OUT` (pasta das capturas) e, no `corpo.e2e.mjs` copiado para fora do
repo, `IMG_DIR` (caminho da pasta `img/` do app).

## Rodar

1. Servir o app: `npx --yes http-server -p 8080 -c-1 .` (na raiz do repo).
2. Rodar cada script com `OUT=<pasta das capturas>`:
   - `visual.e2e.mjs` — visual Blocos (v2.0): fontes Unbounded e Figtree, menu de vidro só nas 5
     abas, transições que nunca deixam a tela invisível (inclusive trocas rápidas e re-render no
     meio), treino com + e −, descanso em pílula, abrir direto `#/treino` e `#/ranking`, e capturas
     390×844 de todas as telas.
   - `corpo.e2e.mjs` — aba Corpo, fotos, backup e regressão do treino.
   - `cardio.e2e.mjs` — caminhada com GPS falso + relógio simulado (roda com movimento reduzido,
     porque o relógio simulado congela as animações), aparelho, backup.
   - `ranking.e2e.mjs` — 2 navegadores contra o Supabase REAL (cria e apaga um grupo de teste;
     deixa 2 usuários anônimos em Authentication → Users, filtro "Anonymous"). Só com ok do dono do projeto.
   - `seguranca-supabase.mjs` — regras do banco com 3 usuários anônimos via REST.
     Uso: `SUPA_URL=... SUPA_KEY=<chave publishable> node seguranca-supabase.mjs`
     (só a chave pública; nunca a secret).

Os scripts limpam o localStorage e passam pela tela de boas-vindas.
