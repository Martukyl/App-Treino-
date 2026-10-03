# Testes e2e (navegador real)

Não rodam no `node --test` (ficam fora do padrão `tests/*.test.js`).

Preparar (uma vez, numa pasta fora do repo): `npm i playwright-core`, e rodar os scripts de lá
(copiando-os) ou com `NODE_PATH` apontando para essa pasta. Usam o Edge em
`C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe`.

1. Servir o app: `npx --yes http-server -p 8080 -c-1 .` (na raiz do repo).
2. Rodar, com `OUT=<pasta das capturas>`:
   - `corpo.e2e.mjs` — aba Corpo, fotos, backup e regressão do treino.
   - `cardio.e2e.mjs` — caminhada com GPS falso + relógio simulado, aparelho, backup.
   - `ranking.e2e.mjs` — 2 navegadores contra o Supabase REAL (cria e apaga um grupo de teste;
     deixa 2 usuários anônimos em Authentication → Users, filtro "Anonymous").
   - `seguranca-supabase.mjs` — regras do banco com 3 usuários anônimos via REST.
     Uso: `SUPA_URL=... SUPA_KEY=<chave publishable> node seguranca-supabase.mjs`
     (só a chave pública; nunca a secret).

Os scripts limpam o localStorage e passam pela tela de boas-vindas.
