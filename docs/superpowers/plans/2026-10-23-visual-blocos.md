# Visual Blocos + app unissex (v2.0.0) — plano de implementação

> **Para quem executa:** sub-skill obrigatória: superpowers:executing-plans (execução pela sessão
> principal, regra do Tiago; subagente Sonnet só para tarefa grande e mecânica). Passos com
> caixas (`- [ ]`) para acompanhar. **Commit ao fim de cada tarefa.**

**Objetivo:** aplicar o visual "Blocos" aprovado (blocos coloridos, Unbounded/Figtree, vidro
fosco, movimento) em todas as telas, com fotos de academia sem pessoas e textos neutros.

**Arquitetura:** o app continua um PWA de HTML/CSS/JS puros com roteador por hash e telas que
devolvem HTML (`render`) e ligam eventos (`montar`). O CSS novo vem em dois arquivos (`base.css`
com tokens e componentes, `telas.css` com o específico de cada tela) e o `app.css` antigo sai no
fim. Animações num módulo único (`js/movimento.js`). Lógica nova que não é visual vai para funções
puras com teste de unidade; o resto é conferido no e2e com navegador real.

**Tecnologia:** JavaScript ES modules, `node --test`, playwright-core (só e2e, fora do repo).

**Spec:** `docs/superpowers/specs/2026-10-23-visual-blocos-design.md`. Referência visual: o
protótipo `.superpowers/provas/blocos/treino-blocos.html` (fora do git) — copiar dele cores,
medidas, textos e curvas de animação.

## Restrições globais

- Sem dependência nova e sem build. Arquivos com fim de linha CRLF no disco (o repo tem
  `core.autocrlf=true`); escrever normalmente, o git converte.
- `VERSAO_APP = '2.0.0'` (js/util.js) e `CACHE = 'treino-2.0.0'` (sw.js), sempre iguais.
- Todo arquivo que a página usa entra em `ARQUIVOS` do `sw.js` (o teste `tests/sw.test.js` cobra).
- Só tema claro. Tokens: `--bg #f3f2ee`, `--ink #1c1f23`, `--mut #646a71`, `--white #fff`,
  `--sage #d9e3cf`, `--sky #d3e2ee`, `--sand #efe3cc`, `--clay #e9d3c6`, `--ok #3f7a4a`,
  `--sage-ink #4a5a40`; vidro claro `rgba(255,255,255,.52)` + `blur(22px) saturate(180%)`;
  vidro escuro `rgba(28,31,35,.7)` + `blur(20px) saturate(160%)`; folha `rgba(243,242,238,.74)`
  + `blur(28px)`. `backdrop-filter` sempre dentro de `@supports`, com fundo quase opaco fora dele.
- Fontes: Unbounded (títulos/números) e Figtree (texto), woff2 locais em `vendor/fonts/`.
- Curvas: suave `cubic-bezier(.2,.8,.2,1)`, mola `cubic-bezier(.3,1.35,.5,1)`; durações 200–550ms.
  Animar só `transform`/`opacity` (e `stroke-dash*` em SVG). `prefers-reduced-motion` desliga tudo.
- Alvos de toque ≥ 44px; contraste de texto ≥ 4,5:1.
- Nenhum nome real no código, testes ou comentários (repo público).
- Nenhum formato de dado salvo muda, exceto a correção de dicas da Tarefa 3.
- Emoji só onde a pessoa escolheu (emoji do grupo) ou digitou; nenhum emoji decorativo.
- Manter os atributos `data-acao`, `data-campo`, `data-sec` existentes sempre que a função
  continuar existindo (a lógica e os e2e dependem deles).
- Unidade: `node --test "tests/*.test.js"` (hoje 190, todos passando ao fim de cada tarefa).

## Foco da revisão

1. Re-render no meio de uma animação (`atualizar()` redesenha `#app` a qualquer momento): a tela
   nunca pode ficar invisível ou com blocos em opacidade 0 — e2e na Tarefa 15.
2. Carga vazia (peso corporal, `carga: null`) nos controles + e −: "−" em 0 vira vazio ("—"), "+"
   a partir de vazio vai para o incremento — teste de unidade na Tarefa 6.
3. Treino em andamento vindo da v1.5 (sem nada no `sessionStorage`, com `descansoAte` no futuro):
   abre o primeiro exercício pendente e a pílula usa o descanso do exercício como total, com o anel
   limitado a 100% — testes de unidade nas Tarefas 6 e 7.
4. Membro do grupo sem emoji, ou com apelido de uma letra: o círculo mostra as iniciais — teste de
   unidade na Tarefa 10.
5. Abrir o app direto numa rota interna (`#/treino`, `#/ranking`) ou usar o voltar do Android: a
   tela aparece sem transição quebrada e o menu certo — teste de unidade da direção/menu na Tarefa 2
   e e2e na Tarefa 15.

---

### Tarefa 1: Fundação (fontes, tokens, componentes, cache offline)

**Arquivos:**
- Criar: `css/base.css`, `vendor/fonts/unbounded-latin-wght.woff2`, `vendor/fonts/figtree-latin-wght.woff2`, `tests/sw.test.js`
- Modificar: `index.html`, `sw.js`, `js/util.js:5`, `vendor/fonts/OFL.txt`

**Interfaces:**
- Produz (CSS, usado por todas as telas): `.bloco` (raio 24, padding 14) + variantes de cor
  `.bloco-sage|sky|sand|clay|white|ink`; `.grade` (2 colunas, gap 8) e `.s2` (ocupa 2); `.pilula`
  (+ `.pilula-esc`, `.pilula-mini`); `.btn-grande` (pílula grafite largura total); `.redondo`
  (42px); `.linhas` (lista de linhas brancas raio 18); `.rotulo` (12,5px secundário);
  `.num-grande` (Unbounded 30px); `.titulo-tela` (Unbounded 24px); `.cab-tela` (cabeçalho:
  título + ações); `.secao` (rótulo de seção); `.vidro`, `.vidro-escuro` (com `@supports`);
  `.tocavel` (escala .97 no `:active`); `.capa` (topo com foto, sangrando até as bordas, degradê
  para o fundo) e `.foto-capa` (img absoluta cobrindo o pai).
- Fontes: `font-family: 'Unbounded'` e `'Figtree'` via `@font-face` em `base.css`.

- [ ] **Passo 1: Teste que falha** — `tests/sw.test.js`:

```js
test('CACHE do sw.js é treino-<VERSAO_APP>', ...)          // lê sw.js como texto, regex do CACHE
test('ARQUIVOS cobre todo js, css, fonte e imagem do app', ...)
// lista js/*.js, js/telas/*.js, css/*.css, vendor/fonts/*.woff2, img/*.jpg (fs.readdirSync)
// e exige './<caminho>' dentro do array ARQUIVOS extraído do texto do sw.js
test('ARQUIVOS não aponta para arquivo inexistente', ...)
```

- [ ] **Passo 2:** `node --test tests/sw.test.js` → PASSA no estado atual (é uma trava). Conferir
  que ela morde: criar `css/base.css` vazio e rodar de novo → FALHA ("./css/base.css" fora de
  ARQUIVOS). Daqui em diante, **todo arquivo novo entra em `ARQUIVOS` na mesma tarefa**.
- [ ] **Passo 3: Baixar as fontes.** `curl -A "Mozilla/5.0 (X11; Linux x86_64) Chrome/130" "https://fonts.googleapis.com/css2?family=Unbounded:wght@400..700&family=Figtree:wght@400..700&display=swap"` e baixar o woff2 do bloco `/* latin */` de cada família para os nomes acima. Acrescentar ao `OFL.txt` as linhas de copyright de Unbounded e Figtree.
- [ ] **Passo 4: `css/base.css`** com tokens (`:root`), `@font-face`, reset, tipografia e os componentes listados. Valores copiados do protótipo. `index.html` passa a carregar `base.css` **antes** de `app.css` (o antigo continua até a Tarefa 15), `theme-color` = `#f3f2ee`.
- [ ] **Passo 5:** `sw.js`: `CACHE = 'treino-2.0.0'`, acrescentar `./css/base.css`, as duas fontes; `js/util.js`: `VERSAO_APP = '2.0.0'`.
- [ ] **Passo 6:** `node --test "tests/*.test.js"` → todos passam (190 + 3).
- [ ] **Passo 7: Commit** `feat: fundação do visual Blocos (tokens, fontes, componentes) e teste do cache`.

### Tarefa 2: Casca (menu de vidro, topo de vidro, transições, folha e aviso)

**Arquivos:**
- Criar: `js/movimento.js`, `js/navegacao.js`, `tests/navegacao.test.js`
- Modificar: `index.html` (nav), `js/app.js` (sai `marcarTopo`, entra transição/menu), `js/ui.js` (folha e aviso com classe `on` animada), `css/base.css`

**Interfaces:**
- Produz em `js/navegacao.js` (puro):
  - `ABAS = ['hoje','corpo','exercicios','historico','ajustes']`
  - `abaDaRota(hash: string): string|null` — `'#/hoje'`→`'hoje'`… só as 5 rotas-raiz; qualquer outra → `null`.
  - `mostraMenu(hash: string): boolean` — `abaDaRota(hash) !== null`.
  - `direcaoTransicao(de: string|null, para: string): -1|0|1` — `de` nulo → 0 (sem animação de
    entrada lateral); entre duas abas → sinal da diferença de posição em `ABAS`; de rota-raiz para
    sub-rota → 1; de sub-rota para rota-raiz ou "pai" (prefixo de hash) → −1; demais → 1.
- Produz em `js/movimento.js` (DOM; todas viram no-op com movimento reduzido):
  - `reduzido(): boolean`
  - `entrar(raiz: Element): void` — escalona `.a` (16px + fade, 50ms entre elementos), roda
    `[data-contar]`, `[data-anel]`, `[data-desenhar]`, `[data-crescer]` (`y` padrão, `x`),
    `[data-surgir]` e `.foto-capa.zoom` (1,12→1). Estado final sempre visível (`fill: 'backwards'`).
  - `contarAte(el: Element): void` (usa `data-contar` = número, `data-casas` = decimais, formata pt-BR)
  - `pop(el: Element): void`, `rolarNumero(el: Element, html: string, dir: 1|-1): void`
  - `flip(container: Element, mudar: () => void): void` — mede, chama `mudar`, anima o deslocamento.
  - `trocarTela(velha: Element|null, nova: Element, dir: -1|0|1): void` — 34px + fade; `dir 0` só fade.
  - `confete(alvo: Element): void`
- `index.html`: `<nav class="nav vidro">` com 5 `<a href="#/…" data-aba="…">` contendo ícone SVG
  inline (os do protótipo) + `<span>` com o nome; `aria-label` em cada link. Novo
  `<div id="topo-vidro" class="topo-vidro vidro"></div>`.

- [ ] **Passo 1: Testes que falham** — `tests/navegacao.test.js`:

```js
assert.equal(abaDaRota('#/corpo'), 'corpo'); assert.equal(abaDaRota('#/corpo/fotos'), null);
assert.equal(mostraMenu('#/ranking'), false); assert.equal(mostraMenu('#/hoje'), true);
assert.equal(direcaoTransicao(null, '#/treino'), 0);
assert.equal(direcaoTransicao('#/hoje', '#/historico'), 1);
assert.equal(direcaoTransicao('#/ajustes', '#/corpo'), -1);
assert.equal(direcaoTransicao('#/exercicios', '#/exercicio/x'), 1);
assert.equal(direcaoTransicao('#/exercicio/x', '#/exercicios'), -1);
assert.equal(direcaoTransicao('#/corpo/medida/peso', '#/corpo'), -1);
assert.equal(direcaoTransicao('#/treino', '#/hoje'), -1);   // hoje é a raiz do treino
```

- [ ] **Passo 2:** `node --test tests/navegacao.test.js` → FALHA (módulo não existe).
- [ ] **Passo 3:** Implementar `js/navegacao.js`. Para "pai" além do prefixo, usar o mapa
  `PAI = { '#/treino': '#/hoje', '#/resumo': '#/hoje', '#/ranking': '#/hoje', '#/cardio': '#/hoje', '#/sessao': '#/historico', '#/exercicio': '#/exercicios' }` (casando pelo primeiro segmento).
- [ ] **Passo 4:** `node --test tests/navegacao.test.js` → PASSA.
- [ ] **Passo 5:** `js/movimento.js` e casca em `js/app.js`: guardar o hash anterior; em
  `renderizarTela` criar um novo contêiner `.tela` dentro de `#app` com o HTML da rota, chamar
  `trocarTela(velha, nova, direcaoTransicao(anterior, hash))` só quando o **hash mudou** (re-render
  da mesma rota troca o conteúdo sem animação de entrada e sem `entrar`), depois `tela.montar` e
  `entrar(nova)`. `body.classList.toggle('sem-menu', !mostraMenu(hash))` esconde o menu deslizando.
  Topo de vidro: listener de `scroll` da janela liga `#topo-vidro.on` quando `scrollY > 8` (ou
  `> 170` se a tela começar com um bloco `.capa`, a capa com foto usada no resumo, no detalhe de
  exercício e nas boas-vindas). Remover `marcarTopo`/`CABECALHO`.
  `ui.js`: `abrirSheet`/`fecharSheet` usam classe `on` (transição de mola) mantendo `hidden` após
  a saída; `toast` idem. CSS do menu: item ativo `.ativa` = pílula grafite que mostra o `<span>`
  (transição de `max-width`), `bottom: calc(16px + env(safe-area-inset-bottom))`.
- [ ] **Passo 6:** Servir (`npx --yes http-server -p 8080 -c-1 .`), abrir no navegador, trocar de
  aba e entrar/sair do treino: menu estica, some fora das abas, telas deslizam, nenhuma fica em branco.
- [ ] **Passo 7:** `node --test "tests/*.test.js"` → passa.
- [ ] **Passo 8: Commit** `feat: casca Blocos (menu e topo de vidro, transições, folha e aviso)`.

### Tarefa 3: Textos neutros e correção das dicas salvas

**Arquivos:**
- Modificar: `js/dados.js`, `js/armazenamento.js` (`migrar`), `js/telas/boas-vindas.js`, `js/telas/corpo.js`, `js/telas/grupo.js`, `js/corpo.js` (rótulo `busto`), comentários em `js/ranking.js`, `js/armazenamento.js`, `js/telas/ranking.js`, `js/telas/treino.js`, `js/telas/cardio-aparelho.js`, `js/supabase.js`
- Teste: `tests/armazenamento.test.js`, `tests/dados.test.js`, `tests/corpo.test.js`

**Interfaces:**
- Produz em `js/dados.js`: `DICAS_ANTIGAS: Record<string,string>` — id → texto antigo exato.
- `migrar(estado)` passa a trocar `dica` quando `ex.personalizado === false` e `ex.dica === DICAS_ANTIGAS[id]`.

Textos novos (exatos):

| id | antigo (exato, como está hoje em dados.js) | novo |
|---|---|---|
| `glute_bridge` | `Deitada no chão com a barra no quadril (use protetor). Pés próximos ao glúteo; suba contraindo e segure 1–2 s no topo.` | `Deite no chão com a barra no quadril (use protetor). Pés próximos ao glúteo; suba contraindo e segure 1–2 s no topo.` |
| `mesa_flexora` | `Deitada, quadril colado no banco. Flexione até o fim sem levantar o quadril e desça em 2–3 s.` | `Deite com o quadril colado no banco. Flexione até o fim sem levantar o quadril e desça em 2–3 s.` |
| `triceps_frances` | `Sentada, segure um halter com as duas mãos atrás da cabeça. Estenda os braços sem abrir os cotovelos.` | `Sente e segure um halter com as duas mãos atrás da cabeça. Estenda os braços sem abrir os cotovelos.` |
| `abducao` | `Tronco levemente inclinado à frente aumenta o trabalho do glúteo. Abra com controle, segure 1 s aberta e volte devagar.` | `Tronco levemente inclinado à frente aumenta o trabalho do glúteo. Abra com controle, segure 1 s com as pernas abertas e volte devagar.` |

(Conferir com `grep -nE "ada[ ,.]|ida[ ,.]|sentada|deitada|apoiada"` se há outras; se houver,
entram na mesma tabela.) Outros textos: "Bem-vinda ao Treino 💪" → "Boas-vindas ao Treino";
placeholder "Como quer ser chamada?" → "Seu nome (opcional)" (boas-vindas e Corpo); "Usar o
programa padrão (5 treinos A–E, foco em glúteo)" → "Programa pronto · 5 treinos (A a E), um por
dia"; "Começar sem treinos e montar os meus" → "Começar do zero · você monta os seus treinos";
grupo "com os das amigas" → "com o pessoal do grupo"; rótulo `busto` → "Peitoral"; aba do ranking
`'🔥'` → `'Sequência'`. Identificadores: `souCriadora` → `criouOGrupo`; comentários "amigas",
"usuária", "criadora", "ela" → neutros.

- [ ] **Passo 1: Testes que falham** — em `tests/armazenamento.test.js`:

```js
test('migrar troca dica antiga do catálogo pela neutra', ...)        // dica === DICAS_ANTIGAS.glute_bridge → exerciciosPadrao.glute_bridge.dica
test('migrar mantém dica editada pela pessoa', ...)                  // dica diferente do antigo → igual
test('migrar não mexe em exercício personalizado', ...)              // personalizado: true com o texto antigo → igual
test('backup antigo passa por migrar e sai corrigido', ...)          // validarBackup ok + migrar
```
e em `tests/dados.test.js`: `test('nenhuma dica do catálogo no feminino', ...)` — nenhuma dica casa
`/\b(Deitada|Sentada|Apoiada|deitada|sentada|apoiada)\b|segure 1 s aberta/`; e
`test('DICAS_ANTIGAS só tem ids do catálogo', ...)`. Em `tests/corpo.test.js`: rótulo de `busto` é `'Peitoral'`.
- [ ] **Passo 2:** `node --test tests/armazenamento.test.js tests/dados.test.js tests/corpo.test.js` → FALHA.
- [ ] **Passo 3:** Implementar (tabela acima; troca de textos e identificadores).
- [ ] **Passo 4:** Mesmos testes → PASSA; `node --test "tests/*.test.js"` → passa.
- [ ] **Passo 5:** `grep -rniE "bem-vinda|chamada\?|amigas|criadora|usuária" js index.html` → vazio.
- [ ] **Passo 6: Commit** `feat: textos neutros e correção das dicas do catálogo já salvas`.

### Tarefa 4: Fotos de academia

**Arquivos:**
- Substituir: `img/treino-a.jpg` … `img/treino-e.jpg`; criar `img/boas-vindas.jpg`, `img/resumo.jpg`, `img/exercicio.jpg`
- Modificar: `img/CREDITOS.md`, `sw.js`, `js/dados.js`
- Teste: `tests/dados.test.js`

**Interfaces:**
- Produz: `fotoDoTreino(id: string): string|null` — `'A'..'E'` → `'./img/treino-<letra minúscula>.jpg'`, outro → `null`.
- Produz: `corDoTreino(id: string): 'sage'|'sky'|'sand'|'clay'` — rodízio pela posição da letra
  (`(código da letra − 65) % 4` sobre `['sage','sky','sand','clay']`).

- [ ] **Passo 1: Teste que falha** — `fotoDoTreino('C') === './img/treino-c.jpg'`, `fotoDoTreino('F') === null`, `corDoTreino('A') === 'sage'`, `corDoTreino('E') === 'sage'`, `corDoTreino('F') === 'sky'`.
- [ ] **Passo 2:** `node --test tests/dados.test.js` → FALHA.
- [ ] **Passo 3:** Implementar as duas funções.
- [ ] **Passo 4: Baixar as fotos** (`curl -sL "https://unsplash.com/photos/<id>/download?force=true&w=1200"`, ids da spec), `magick <in> -resize 900x -strip -interlace Plane -quality 70 <out>`; cada uma ≤ 120 KB. Autor de cada uma: abrir `https://unsplash.com/photos/<id>` (WebFetch) e registrar em `img/CREDITOS.md` (tabela arquivo | uso | autor | link). Acrescentar as 3 novas em `ARQUIVOS`.
- [ ] **Passo 5:** `node --test "tests/*.test.js"` → passa (inclui `sw.test.js`).
- [ ] **Passo 6: Commit** `feat: fotos de academia sem pessoas (Unsplash)`.

### Tarefa 5: Tela Hoje

**Arquivos:**
- Modificar: `js/telas/hoje.js`, `js/telas/ranking.js` (`renderCardRankingHoje`/`montarCardRankingHoje` viram o bloco de pontos), `css/telas.css` (criar), `index.html` (link `telas.css`), `sw.js`
- Criar: `js/semana.js`, `tests/semana.test.js`

**Interfaces:**
- Produz em `js/semana.js`:
  - `progressoSemana(est, hojeISO: string): { feitos: number, total: number }` — `feitos` = dias
    distintos seg–dom da semana de `hojeISO` com sessão concluída; `total` = `est.treinos.length`.
  - `estimativaMin(est, treinoId: string): number|null` — média das durações (`fim − inicio`) das
    sessões daquele treino, arredondada a múltiplo de 5 min (mín. 5); sem sessão → `null`.
- Consome: `dadosCardSemana` (cards.js), `carregarRanking`, `rankingEmCache`, `grupoAtual`,
  `ordenarRanking`, `ordinal` (ranking.js), `fotoDoTreino`, `entrar` (movimento.js).
- Bloco de pontos (`data-sec="ranking-semana"`, link `#/ranking`): `[data-contar]` com os pontos
  da semana, rótulo "pontos · Nº no grupo"; sem grupo → "pontos na semana" + link "Criar ou entrar
  em um grupo" (`#/ajustes`); sem ranking configurado → só pontos locais (de `dadosCardSemana`).

- [ ] **Passo 1: Testes que falham** — `tests/semana.test.js`:

```js
// semana de 19 a 25/10/2026, hoje = '2026-10-23'
test('progressoSemana conta dias distintos com treino na semana', ...)   // 2 sessões no mesmo dia contam 1 → { feitos: 3, total: 5 }
test('progressoSemana ignora sessão sem fim e da semana anterior', ...)
test('estimativaMin arredonda a média a 5 min', ...)                     // 47 e 52 min → 50
test('estimativaMin sem sessão é null', ...)
```

- [ ] **Passo 2:** `node --test tests/semana.test.js` → FALHA.
- [ ] **Passo 3:** Implementar `js/semana.js`.
- [ ] **Passo 4:** `node --test tests/semana.test.js` → PASSA.
- [ ] **Passo 5:** Reescrever `render()` da Hoje como o protótipo: `.cab-tela` (data + saudação +
  avatar `htmlAvatar` em `.redondo`), `.grade` com treino do dia (foto `fotoDoTreino` ou bloco de
  `corDoTreino` + letra; painel `.info-vidro`; "Começar/Continuar treino"; "~N min" só se
  `estimativaMin` não for nulo), anel (`data-anel` = `min(1, feitos/total)`, texto `feitos/total`,
  some se `total === 0`), bloco de pontos, "Minha semana" (7 dias de `dadosCardSemana`, sequência,
  botão compartilhar `data-acao="compartilhar-semana"`), bloco Cardio (atalhos ou "em andamento"
  com `data-cardio-tempo`) e carrossel "Outro treino" (`data-acao="comecar" data-treino`). Mantém
  `data-sec="sem-treinos"` e `iniciarSessao`/`criarItemSessao` como estão.
- [ ] **Passo 6:** Navegador: Hoje com e sem sessão em andamento, sem treinos, com cardio em andamento.
- [ ] **Passo 7:** `node --test "tests/*.test.js"` → passa.
- [ ] **Passo 8: Commit** `feat: tela Hoje em blocos`.

### Tarefa 6: Treino em andamento (cartão do exercício atual)

**Arquivos:**
- Criar: `js/sessao-ui.js`, `tests/sessao-ui.test.js`
- Modificar: `js/telas/treino.js` (render, aoClicar, aoDigitar, aoFeita), `css/telas.css`

**Interfaces:**
- Produz em `js/sessao-ui.js` (puro, exceto as duas de `sessionStorage`):
  - `indiceAtual(sessao, guardado: number|null): number` — `guardado` válido e com série pendente
    → ele; senão o primeiro item com série pendente; senão o último item.
  - `ajustarCarga(carga: number|null, delta: 1|-1, incremento: number): number|null` — `null`+1 →
    `incremento`; `x−incremento ≤ 0` → `null` (peso corporal); arredonda com `arredondar` (util.js).
  - `ajustarReps(reps: number, delta: 1|-1): number` — mínimo 1.
  - `copiarCargaSeguintes(registros, s: number, carga: number|null): void` — copia para `k > s` não feitas.
  - `lerIndiceGuardado(sessaoId: string): number|null`, `guardarIndice(sessaoId: string, i: number): void` — chave `treino.atual.<sessaoId>` no `sessionStorage`, com try/catch.
- Consome: `parseCarga`, `parseReps`, `formatarKg`, `formatarCampo` (util.js); `avaliar`,
  `historicoDoExercicio` (progressao.js); `iniciarDescanso`, `pararDescanso`, `prepararAudio`
  (cronometro.js); `flip`, `pop`, `rolarNumero`, `trocarTela` (movimento.js).

- [ ] **Passo 1: Testes que falham** — `tests/sessao-ui.test.js`:

```js
test('indiceAtual usa o guardado quando ainda tem série pendente', ...)
test('indiceAtual pula guardado já concluído e vai ao primeiro pendente', ...)
test('indiceAtual sem guardado (sessão da v1.5) abre o primeiro pendente', ...)
test('indiceAtual com tudo feito devolve o último', ...)
test('ajustarCarga: null+1 = incremento; incremento−1 = null; 20+1 com passo 2,5 = 22,5', ...)
test('ajustarReps não desce de 1', ...)
test('copiarCargaSeguintes não altera séries feitas nem anteriores', ...)
```

- [ ] **Passo 2:** `node --test tests/sessao-ui.test.js` → FALHA.
- [ ] **Passo 3:** Implementar `js/sessao-ui.js`.
- [ ] **Passo 4:** `node --test tests/sessao-ui.test.js` → PASSA.
- [ ] **Passo 5:** Reescrever a tela `#/treino` como o protótipo, sem mudar o formato de
  `sessaoAtual`:
  - cabeçalho (voltar `#/hoje`, "Treino X", pílula `.tempo` atualizada a cada 1s, menu ⋯
    `data-acao="menu"`); `.prog` com um segmento por item (largura = feitas/total);
  - cartão do item `indiceAtual(...)` com etapas (`data-acao="etapa" data-s`; tocar numa feita
    desmarca e vira a atual; tocar numa pendente a torna atual), controles
    `data-acao="carga|reps" data-d="1|-1"`, números `<button data-acao="digitar-carga|digitar-reps">`
    que trocam por `<input class="carga|reps">` (validação `parseCarga`/`parseReps`, classe
    `invalido`, Enter/blur confirma), botão `data-acao="feita"` "Série N feita", linha
    `dica | trocar | mais | menos`, bloco de sugestão `data-acao="aplicar" data-carga`;
  - lista de itens (`data-acao="ir-item" data-i`), "Finalizar treino" `data-acao="finalizar"`;
  - série marcada atualiza etapas/barra/lista **sem re-render do cartão** (usa `atualizar(fn, { renderizar: false })` + DOM pontual + `pop`); ao concluir o item, após 750ms `trocarTela` do cartão para `indiceAtual` e `guardarIndice`;
  - mudanças estruturais (+/− série, trocar exercício, aplicar) continuam com `mutar`.
- [ ] **Passo 6:** Navegador: fazer um treino inteiro (+/−, digitar, desmarcar, aplicar sugestão,
  trocar, +série/−série, recarregar no meio e voltar ao mesmo exercício, finalizar).
- [ ] **Passo 7:** `node --test "tests/*.test.js"` → passa.
- [ ] **Passo 8: Commit** `feat: treino com um exercício por vez e controles + e −`.

### Tarefa 7: Pílula de descanso

**Arquivos:**
- Modificar: `js/cronometro.js` (só `ligar`/`tique`/`pararDescanso` e o HTML), `index.html` (`#cronometro` vira `.descanso vidro-escuro`), `css/base.css`
- Teste: `tests/cronometro.test.js`

**Interfaces:**
- Produz: `fracaoDescanso(restanteSeg: number, totalSeg: number): number` — `restante/total`
  limitado a [0, 1]; `total ≤ 0` → 0.
- `iniciarDescanso(segundos)` passa a guardar `segundos` em `sessionStorage['treino.descansoTotal']`;
  `ajustarDescanso(delta)` soma ao total; leitura com fallback para o `descanso` do item atual da
  sessão (ou 90). O resto (bipe, vibração, `retomarDescanso`, `visibilitychange`, `descansoAte`) fica igual.

- [ ] **Passo 1: Teste que falha** — `fracaoDescanso(45, 90) === 0.5`, `fracaoDescanso(120, 90) === 1`, `fracaoDescanso(-3, 90) === 0`, `fracaoDescanso(10, 0) === 0`.
- [ ] **Passo 2:** `node --test tests/cronometro.test.js` → FALHA.
- [ ] **Passo 3:** Implementar; HTML da pílula: anel SVG (r 19), tempo, botões `data-cron="-15"`,
  `"15"`, `"pular"`; entra com classe `on` (mola), no fim mostra "Bora!" com pulso e sai.
- [ ] **Passo 4:** `node --test "tests/*.test.js"` → passa.
- [ ] **Passo 5:** Navegador: marcar série, ver a pílula, −15/+15/Pular, recarregar durante o descanso.
- [ ] **Passo 6: Commit** `feat: descanso em pílula de vidro com anel`.

### Tarefa 8: Resumo do treino

**Arquivos:** Modificar `js/telas/treino.js` (`renderResumo`, `montarResumo`), `css/telas.css`.

**Interfaces:** Consome `confete`, `entrar` (movimento.js), `img/resumo.jpg`.

- [ ] **Passo 1:** Reescrever como o protótipo: capa com foto e check (`data-desenhar`), "Treino
  concluído" (sem emoji), nome do treino; blocos minutos/séries/volume com `data-contar`; lista;
  "Na próxima, pode aumentar" (lógica atual) ou "Mesma carga na próxima."; Compartilhar
  (`data-acao="compartilhar"`) e Voltar ao início. `montarResumo` chama `confete` uma vez.
- [ ] **Passo 2:** Navegador: finalizar um treino e conferir números e o compartilhar.
- [ ] **Passo 3:** `node --test "tests/*.test.js"` → passa. **Commit** `feat: resumo do treino em blocos`.

### Tarefa 9: Cardio (GPS, aparelho, detalhe)

**Arquivos:** Modificar `js/telas/cardio-gps.js`, `js/telas/cardio-aparelho.js`, `js/telas/cardio-detalhe.js`, `js/mapa.js` (cor do trajeto), `css/telas.css`.

- [ ] **Passo 1:** GPS como o protótipo: voltar, título, mapa Leaflet dentro de `.bloco` (raio 24,
  altura 240), selo de GPS `.vidro` sobre o mapa (texto de estado atual), tempo grande, blocos
  distância/ritmo/calorias, botões grandes Pausar/Retomar e Finalizar (mesmos `data-acao`).
  Trajeto: traço `#1c1f23` 5px sobre borda `#efe3cc` 11px. Sem emojis (📍 vira ícone).
- [ ] **Passo 2:** Aparelho e detalhe: mesmos campos em blocos; parciais por km em `.linhas`.
- [ ] **Passo 3:** e2e `cardio.e2e.mjs` (já usa GPS falso) passa após ajustar seletores visuais.
- [ ] **Passo 4:** `node --test "tests/*.test.js"` → passa. **Commit** `feat: cardio em blocos`.

### Tarefa 10: Ranking e grupo

**Arquivos:**
- Modificar: `js/telas/ranking.js`, `js/telas/grupo.js`, `css/telas.css`
- Teste: `tests/ranking.test.js`

**Interfaces:**
- Produz em `js/ranking.js`: `avatarMembro({ apelido, emoji }): { tipo: 'emoji'|'iniciais', texto: string }`
  — emoji não vazio → emoji; senão as 2 primeiras letras do apelido em maiúsculas (1 letra se o
  apelido tiver 1; `'?'` se vazio).
- Produz: `seloZera(periodo: 'semana'|'mes'): string` — `'zera na segunda'` | `'zera no dia 1º'`.

- [ ] **Passo 1: Testes que falham** — `avatarMembro({apelido:'Rafa', emoji:'💪'})` → emoji;
  `({apelido:'Rafa', emoji:''})` → `{ tipo:'iniciais', texto:'RA' }`; `({apelido:'L', emoji:null})`
  → `'L'`; `({apelido:'', emoji:''})` → `'?'`; `seloZera('mes') === 'zera no dia 1º'`.
- [ ] **Passo 2:** `node --test tests/ranking.test.js` → FALHA. **Passo 3:** implementar. **Passo 4:** PASSA.
- [ ] **Passo 5:** Tela como o protótipo: voltar, título, atualizar (ícone gira); bloco grafite
  com grupo, período, posição **em pontos** (`data-contar`), diferença para o anterior e
  `seloZera(periodo)`; seletor de métricas `.vidro` grudado (`position: sticky; top: 52px`) com
  as 5 métricas de `ABAS` (rolagem horizontal se não couberem) e indicador deslizante; período como
  hoje; linhas com posição, círculo (`avatarMembro`, cor por rodízio), nome (`esc`), barra e valor;
  troca de métrica usa `flip`. Estados (`data-msg`) e compartilhar mantidos. Medalhas saem.
  `grupo.js`: visual em blocos, emoji continua no seletor e no "Você aparece como…".
- [ ] **Passo 6:** Navegador com grupo real (ou e2e `ranking.e2e.mjs`): trocar métrica e período.
- [ ] **Passo 7:** `node --test "tests/*.test.js"` → passa. **Commit** `feat: ranking em blocos com seletor de vidro`.

### Tarefa 11: Corpo e sub-telas

**Arquivos:** Modificar `js/telas/corpo.js`, `js/telas/corpo-registro.js`, `js/telas/corpo-fotos.js`, `js/telas/corpo-comum.js`, `js/grafico.js`, `css/telas.css`; Teste `tests/grafico.test.js`.

**Interfaces:**
- Produz em `js/grafico.js`: `miniGrafico(valores: number[], { largura = 46, altura = 20 } = {}): string`
  — SVG com um `<path data-desenhar>`; menos de 2 valores → `''`; valores iguais → linha no meio.
- `graficoLinha` ganha a opção `{ desenhar: true }` que põe `data-desenhar` no traço (padrão `false`).

- [ ] **Passo 1: Testes que falham** — `miniGrafico([1])` é `''`; `miniGrafico([1,2,3])` contém
  `data-desenhar` e `viewBox="0 0 46 20"`; `miniGrafico([5,5])` não gera `NaN`.
- [ ] **Passo 2:** FALHA → **Passo 3:** implementar → **Passo 4:** PASSA.
- [ ] **Passo 5:** Corpo como o protótipo: cabeçalho com "Registrar" (`#/corpo/registro/novo`);
  bloco perfil (avatar, resumo `resumoPerfil`; toque abre folha com os campos de hoje —
  `data-campo` nome/altura/metaPeso/nascimento, foto de perfil); peso (`data-contar`, variação,
  `graficoLinha(..., { desenhar: true })`); meta (falta e barra `data-crescer="x"`); medidas em
  blocos pequenos com `miniGrafico` e link para `#/corpo/medida/<campo>`; "Comparar fotos";
  "Compartilhar evolução". Registro, detalhe de medida e fotos no mesmo visual.
- [ ] **Passo 6:** e2e `corpo.e2e.mjs` com seletores ajustados (perfil agora numa folha) → passa.
- [ ] **Passo 7:** `node --test "tests/*.test.js"` → passa. **Commit** `feat: Corpo em blocos`.

### Tarefa 12: Exercícios (filtro por grupo e detalhe)

**Arquivos:** Modificar `js/telas/exercicios.js`, `js/telas/trocar.js` (visual do formulário), `js/grafico.js`, `css/telas.css`; Teste `tests/grafico.test.js`, `tests/dados.test.js`.

**Interfaces:**
- Produz em `js/dados.js`: `gruposComExercicios(exercicios: Record<string,Exercicio>): string[]`
  — ids de grupo que têm ao menos um exercício, na ordem de `GRUPOS`, grupos desconhecidos no fim.
- Produz em `js/grafico.js`: `graficoColunas(valores: number[], rotulos: string[]): string` —
  até 8 colunas, altura proporcional ao maior, última com classe `atual`, cada `<i data-crescer>`.

- [ ] **Passo 1: Testes que falham** — `gruposComExercicios` com glúteo e costas → `['gluteo','costas']`;
  grupo `'mobilidade'` (personalizado) vem por último; `graficoColunas([10,20],['a','b'])` tem 2
  colunas e a segunda com `atual`; mais de 8 valores → só os 8 últimos.
- [ ] **Passo 2:** FALHA → **Passo 3:** implementar → **Passo 4:** PASSA.
- [ ] **Passo 5:** Lista: cabeçalho com "+ Novo" (`data-acao="novo"`), busca (atual), pílulas de
  filtro (`data-acao="filtro" data-g`, "Todos" + `gruposComExercicios`) combinadas com a busca,
  linhas com nome + ponto verde se "aumentar", grupo · equipamento, `miniGrafico` das melhores
  cargas (`melhorCargaPorSessao`) e carga atual. Detalhe: capa `img/exercicio.jpg` com voltar
  `.vidro`, etiquetas, sugestão, `graficoColunas` (8 últimas sessões), "Como fazer", últimas
  sessões, Editar/Excluir (lógica atual).
- [ ] **Passo 6:** `node --test "tests/*.test.js"` → passa. **Commit** `feat: Exercícios com filtro por grupo e detalhe em blocos`.

### Tarefa 13: Histórico com calendário

**Arquivos:** Criar `js/calendario.js`, `tests/calendario.test.js`; Modificar `js/telas/historico.js`, `css/telas.css`.

**Interfaces:**
- Produz em `js/calendario.js`:
  - `diasDoMes(ano: number, mes: number /*1–12*/, sessoes, cardios, hojeISO: string): Array<{ dia: number|null, iso: string|null, treino: boolean, cardio: boolean, hoje: boolean }>`
    — começa na segunda; células vazias (`dia: null`) antes do dia 1; usa a data local de `fim`.
  - `resumoDoMes(ano, mes, sessoes, cardios): { treinos: number, cardios: number, horas: number }` — horas arredondadas para inteiro.
  - `mesVizinho(ano, mes, delta: 1|-1): { ano, mes }`.

- [ ] **Passo 1: Testes que falham** — outubro/2026 começa numa quinta → 3 células vazias e 34 no
  total; dia com sessão vira `treino: true`; dia com cardio `cardio: true`; `hoje` marcado;
  sessão sem `fim` ignorada; `mesVizinho(2026,12,1)` → `{2027,1}`; `resumoDoMes` soma horas de
  treino + cardio.
- [ ] **Passo 2:** FALHA → **Passo 3:** implementar → **Passo 4:** PASSA.
- [ ] **Passo 5:** Tela: calendário do mês (setas `data-acao="mes" data-d`, mês guardado em
  variável do módulo; toque num dia com registro rola até `[data-dia="<iso>"]` da lista), três
  blocos de `resumoDoMes`, lista do mês com miniatura (`fotoDoTreino` + letra, ou bloco sálvia com
  ícone de cardio), links atuais (`#/sessao/…`, `#/cardio/…`). Detalhe de sessão em blocos (excluir,
  compartilhar mantidos).
- [ ] **Passo 6:** `node --test "tests/*.test.js"` → passa. **Commit** `feat: Histórico com calendário do mês`.

### Tarefa 14: Ajustes, editor de treino e boas-vindas

**Arquivos:** Modificar `js/telas/ajustes.js`, `js/telas/boas-vindas.js`, `css/telas.css`.

- [ ] **Passo 1:** Ajustes como o protótipo: nome (`data-campo="nome"`), "Meus treinos" com
  miniatura (`fotoDoTreino`/`corDoTreino` + letra), "+ Novo treino", Grupo (entra `grupo.js` como
  hoje), Backup (exportar/importar/restaurar, mesmos `data-acao`), rodapé "Treino 2.0.0 · fotos:
  Unsplash" (versão de `VERSAO_APP`). Editor de treino em blocos (campos e validações atuais).
- [ ] **Passo 2:** Boas-vindas: capa `img/boas-vindas.jpg`, logo de 4 quadradinhos + "Treino",
  texto, nome opcional, dois blocos selecionáveis com `input[name="programa"]` (valores `padrao`/`vazio`,
  visualmente escondidos e acessíveis), `data-acao="comecar-app"`.
- [ ] **Passo 3:** `node --test "tests/*.test.js"` → passa. **Commit** `feat: Ajustes e boas-vindas em blocos`.

### Tarefa 15: Ícone, cards de compartilhar, limpeza e e2e

**Arquivos:**
- Modificar: `icons/icon.svg` (+ PNGs via `tools/gerar-icones.ps1` ou `magick`), `manifest.webmanifest`, `js/cards-canvas.js`, `index.html`, `sw.js`, `tests/e2e/*.mjs`, `tests/e2e/README.md`
- Remover: `css/app.css`, `vendor/fonts/outfit-latin-wght.woff2`

- [ ] **Passo 1:** Ícone: 4 quadradinhos (grafite, sálvia, areia, céu) sobre `#f3f2ee`; PNGs 192,
  512 e apple-touch 180 com `magick`. Manifest: `background_color`/`theme_color` `#f3f2ee`.
- [ ] **Passo 2:** `cards-canvas.js`: paleta Blocos (fundo `#f3f2ee`, tinta, blocos) e fontes
  Unbounded/Figtree (`await document.fonts.load('600 64px Unbounded')` antes de desenhar);
  `tests/cards.test.js` continua passando.
- [ ] **Passo 3:** Remover `app.css` e a Outfit (index.html, sw.js); varrer `grep -rn "class=\"card\|btn-principal\|muted" js` e trocar o que sobrou pelas classes de `base.css`; nenhum emoji decorativo (`grep -rnP "[\x{1F300}-\x{1FAFF}]" js` só pode achar o emoji do grupo e textos de exemplo).
- [ ] **Passo 4: e2e.** Todos os scripts leem `process.env.BROWSER_PATH` (padrão: o Edge atual).
  Preparar fora do repo: `mkdir -p ~/e2e-treino && cd ~/e2e-treino && npm i playwright-core && npx playwright install chromium`;
  `BROWSER_PATH` = caminho do chromium baixado. Reescrever `visual.e2e.mjs` para Blocos: fontes
  Unbounded e Figtree carregadas; menu `.vidro` só nas 5 abas; nenhum `.tela` com opacidade < 1
  depois de 1s, inclusive após trocar de hash 5 vezes em 200ms e após `atualizar()` no meio da
  transição (Foco 1); abrir direto `#/treino` e `#/ranking` (Foco 5); treino: +/−, digitar, série
  feita, pílula aparece, troca de exercício, recarregar volta ao mesmo exercício; capturas 390×844
  de todas as telas em `OUT`. Ajustar seletores de `corpo`, `cardio` e `ranking`. Atualizar o README.
- [ ] **Passo 5:** Rodar: unidade (todos), `visual`, `corpo`, `cardio` (e `ranking` com o Tiago,
  usa o Supabase real) → todos OK. Conferir as capturas contra o protótipo.
- [ ] **Passo 6: Commit** `feat: ícone, cards e limpeza do visual antigo; e2e do visual Blocos`.

### Tarefa 16: Revisão final e publicação

- [ ] **Passo 1:** Revisão do branch inteiro por um revisor novo (subagente `model: "opus"`) com o
  diff real (`git diff main...feat/visual-blocos`), incluindo a migração de dicas (integridade de
  dado) e o `esc()` em tudo que vem do grupo (segurança: apelidos e nomes de grupo são de terceiros).
- [ ] **Passo 2:** Corrigir os achados, rodar unidade + e2e de novo.
- [ ] **Passo 3:** Teste no navegador real (Chrome) clicando o fluxo completo; atualizar
  `CLAUDE.local.md` e `README.md` (seção de visual, fotos, e2e no Linux).
- [ ] **Passo 4:** Perguntar ao Tiago antes de `git checkout main && git merge feat/visual-blocos && git push`.
  Depois do push, rodar `visual.e2e.mjs` contra `https://martukyl.github.io/App-Treino-/`.
