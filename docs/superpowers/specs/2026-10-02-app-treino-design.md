# App Treino — especificação (design)

Data: 2026-10-02 · Autor: Tiago (com Claude) · Status: aguardando revisão

## 1. Objetivo

App pessoal de academia para a esposa do Tiago: mostrar o treino do dia, registrar
carga e repetições de cada série, lembrar as últimas cargas usadas e avisar quando
pode aumentar a carga. Foco em hipertrofia (ganho de massa).

Perfil da usuária: intermediária, 5 treinos/semana, ênfase em glúteos e pernas,
depois costas e ombros, sem abandonar o restante.

Critérios de sucesso:
- Na academia, pelo celular, ela abre o app, toca em "Começar" e registra o treino
  inteiro sem digitar quase nada (valores já vêm preenchidos da última vez).
- Ao terminar uma série, o cronômetro de descanso começa sozinho.
- O app diz claramente "Pode aumentar → 42,5 kg" quando a regra de progressão permite.
- Funciona offline (internet ruim na academia) e é instalável na tela inicial.

Fora do escopo: login, sincronização entre aparelhos, servidor, padrão visual Brutal,
dieta, medidas corporais.

## 2. Arquitetura

- PWA estática: HTML + CSS + JavaScript puro (ES modules), **sem build e sem
  dependências externas em runtime** (nada de CDN — tudo precisa funcionar offline).
- Persistência: `localStorage`, uma única chave `appTreino.v1` com um documento JSON
  (volume pequeno: poucos KB por mês). Toda leitura/escrita em `try/catch`; chamar
  `navigator.storage.persist()` na primeira abertura (se existir).
- Backup: exportar/importar JSON pela tela Ajustes.
- Service worker com cache do app shell (cache-first, nome de cache versionado).
- Roteamento por hash (`#/hoje`, etc.). **Todos os caminhos relativos** (o app roda
  em subpasta no GitHub Pages: `https://<usuario>.github.io/<repo>/`).
- Hospedagem: GitHub Pages (repositório público — o código fica público, os dados
  dela não: ficam só no celular).

### Estrutura de arquivos

```
App Treino/
  index.html               casca do app, <nav> inferior, <main id="app">
  manifest.webmanifest     nome "Treino", display standalone, cores, ícones
  sw.js                    service worker (cache do shell)
  icons/icon.svg           ícone fonte
  icons/icon-192.png       gerados a partir do SVG (ver §9)
  icons/icon-512.png
  icons/apple-touch-icon.png (180x180)
  css/app.css              estilos (tokens em :root)
  js/app.js                inicialização, roteador, render das telas
  js/dados.js              catálogo padrão de exercícios + 5 treinos padrão
  js/armazenamento.js      carregar/salvar estado, migração, backup (validação)
  js/progressao.js         regras de progressão (funções puras)
  js/cronometro.js         cronômetro de descanso
  js/grafico.js            gráfico de evolução em SVG inline
  js/util.js               formatação pt-BR (kg, datas), ids, parse de número com vírgula
  tests/progressao.test.js node:test
  tests/armazenamento.test.js node:test
  package.json             {"type":"module","scripts":{"test":"node --test tests/"}}
  README.md                como rodar local, testar e publicar
```

`js/app.js` pode ser dividido em `js/telas/*.js` (uma tela por arquivo) se passar de
~400 linhas — preferível.

Módulos puros (`progressao.js`, `util.js`, partes de `armazenamento.js`) **não podem
tocar em DOM nem em `localStorage` diretamente**, para serem testáveis em Node.
`armazenamento.js` separa funções puras (`validarBackup`, `migrar`, `estadoInicial`)
das que acessam `localStorage` (`carregar`, `salvar`).

## 3. Modelo de dados

```js
// Estado salvo em localStorage["appTreino.v1"]
{
  versao: 1,
  exercicios: { [id]: Exercicio },   // catálogo (padrão + criados por ela)
  treinos: [Treino],                 // ordem A..E define a sequência
  sessoes: [Sessao],                 // finalizadas, mais recente por último
  sessaoAtual: Sessao | null,        // treino em andamento (retomável)
  ultimoTreinoId: "A" | ... | null
}

Exercicio = {
  id: "elevacao_pelvica",            // padrão: slug; criados: "c_" + id aleatório
  nome: "Elevação pélvica com barra",
  grupo: "gluteo",                   // ver lista de grupos abaixo
  tipo: "composto" | "isolado",
  equipamento: "barra" | "maquina" | "halter" | "cabo" | "peso_corporal",
  unilateral: false,                 // true → mostrar "cada lado"
  incremento: 2.5,                   // kg a somar quando "pode aumentar"
  dica: "texto curto de execução",
  personalizado: false               // true se criado por ela
}

Treino = {
  id: "A", nome: "Inferiores — Glúteo", foco: "Glúteo",
  itens: [ItemTreino]
}

ItemTreino = { exercicioId, series: 4, repMin: 8, repMax: 12, descanso: 120 }  // descanso em s

Sessao = {
  id, treinoId, inicio: ISO, fim: ISO | null,
  itens: [{
    exercicioId,
    trocadoDe: exercicioId | null,   // se foi substituído só nesta sessão
    series, repMin, repMax, descanso,  // cópia da prescrição no momento (snapshot)
    registros: [{ carga: number, reps: number, feita: boolean }]
  }]
}
```

Grupos (valor → rótulo): `gluteo` Glúteo, `quadriceps` Quadríceps, `posterior`
Posterior de coxa, `panturrilha` Panturrilha, `costas` Costas, `peito` Peito,
`ombro` Ombro, `biceps` Bíceps, `triceps` Tríceps, `abdomen` Abdômen.

## 4. Treinos padrão (divisão de 5 dias)

Compostos: 90–120 s de descanso; isolados: 45–60 s. Unilaterais: reps por lado.

**A — Inferiores · Glúteo**
| exercício | séries | reps | desc. |
|---|---|---|---|
| elevacao_pelvica | 4 | 8–12 | 120 |
| bulgaro | 3 | 8–12 | 90 |
| stiff | 3 | 8–12 | 120 |
| abducao | 3 | 12–15 | 60 |
| flexora_sentada | 3 | 10–15 | 60 |

Formato abaixo: `exercicio séries×repMin–repMax / descanso(s)`.

**B — Superiores · Costas e ombro**
- puxada_frente 4×8–12 / 90
- remada_baixa 3×8–12 / 90
- desenvolvimento_halter 3×8–12 / 90
- elevacao_lateral 4×12–15 / 60
- rosca_direta 3×10–12 / 60
- triceps_corda 3×10–15 / 60

**C — Inferiores · Quadríceps**
- agachamento 4×6–10 / 120
- leg_press 4×8–12 / 120
- extensora 3×10–15 / 60
- afundo 3×10–12 / 90
- panturrilha 4×12–15 / 45

**D — Superiores · Peito, ombro e braços**
- supino_inclinado 3×8–12 / 90
- remada_unilateral 3×8–12 / 90
- elevacao_lateral 3×12–15 / 60
- crucifixo_invertido 3×12–15 / 60
- rosca_alternada 3×10–12 / 60
- triceps_frances 3×10–12 / 60

**E — Inferiores · Glúteo e posterior**
- terra_romeno 3×8–12 / 120
- glute_bridge 3×10–15 / 90
- mesa_flexora 3×10–12 / 60
- coice_cabo 3×12–15 / 60
- abducao 3×12–15 / 60
- panturrilha 4×12–15 / 45

## 5. Catálogo padrão de exercícios

| id | nome | grupo | tipo | equip. | unil. | incr. | dica |
|---|---|---|---|---|---|---|---|
| elevacao_pelvica | Elevação pélvica com barra | gluteo | composto | barra | não | 2.5 | Costas apoiadas no banco na linha das escápulas, pés na largura do quadril. Suba contraindo o glúteo até alinhar quadril e tronco, queixo levemente recolhido. Segure 1 s no topo. |
| bulgaro | Agachamento búlgaro com halteres | gluteo | composto | halter | sim | 1 | Pé de trás apoiado no banco, passo largo. Incline levemente o tronco à frente para puxar mais glúteo. Desça até o joelho de trás quase tocar o chão. Termine uma perna e troque. |
| stiff | Stiff com barra | posterior | composto | barra | não | 2.5 | Joelhos levemente flexionados e fixos. Leve o quadril para trás com a barra rente às pernas e a coluna neutra. Desça até alongar o posterior e volte contraindo o glúteo. |
| abducao | Cadeira abdutora | gluteo | isolado | maquina | não | 2.5 | Tronco levemente inclinado à frente aumenta o trabalho do glúteo. Abra com controle, segure 1 s aberta e volte devagar. |
| flexora_sentada | Cadeira flexora | posterior | isolado | maquina | não | 2.5 | Ajuste o encosto para o joelho ficar alinhado ao eixo da máquina. Flexione até o fim e volte em 2–3 s sem deixar o peso bater. |
| agachamento | Agachamento livre (ou no smith) | quadriceps | composto | barra | não | 2.5 | Pés na largura dos ombros, pontas levemente para fora. Desça com os joelhos na direção dos pés até pelo menos a coxa paralela, peito aberto e calcanhar no chão. |
| leg_press | Leg press 45° | quadriceps | composto | maquina | não | 5 | Pés no meio da plataforma, largura do quadril. Desça até uns 90° de joelho sem tirar o quadril do banco. Não trave os joelhos ao subir. |
| extensora | Cadeira extensora | quadriceps | isolado | maquina | não | 2.5 | Joelho alinhado ao eixo da máquina. Estenda até o fim, segure 1 s e desça controlando. |
| afundo | Afundo com halteres | quadriceps | composto | halter | sim | 1 | Passo longo o bastante para os dois joelhos formarem uns 90°. Empurre com o calcanhar da frente para voltar, tronco firme. |
| panturrilha | Panturrilha em pé | panturrilha | isolado | maquina | não | 2.5 | Desça até alongar bem o calcanhar e suba ao máximo na ponta dos pés, com pausa de 1 s em cima e embaixo. |
| terra_romeno | Terra romeno com halteres | posterior | composto | halter | não | 2 | Halteres à frente das coxas, joelhos levemente flexionados. Leve o quadril para trás deslizando os halteres pelas pernas, coluna neutra, e suba contraindo o glúteo. |
| glute_bridge | Ponte de glúteo com barra | gluteo | composto | barra | não | 2.5 | Deitada no chão com a barra no quadril (use protetor). Pés próximos ao glúteo; suba contraindo e segure 1–2 s no topo. |
| mesa_flexora | Mesa flexora | posterior | isolado | maquina | não | 2.5 | Deitada, quadril colado no banco. Flexione até o fim sem levantar o quadril e desça em 2–3 s. |
| coice_cabo | Coice de glúteo no cabo | gluteo | isolado | cabo | sim | 2.5 | Tornozeleira no cabo, tronco levemente inclinado e abdômen firme. Leve a perna para trás e para cima sem arquear a lombar; contraia o glúteo no fim. |
| puxada_frente | Puxada frontal aberta | costas | composto | cabo | não | 2.5 | Pegada um pouco mais aberta que os ombros. Puxe a barra até o alto do peito levando os cotovelos para baixo e para trás, peito alto, sem balançar o tronco. |
| remada_baixa | Remada baixa com triângulo | costas | composto | cabo | não | 2.5 | Coluna neutra. Puxe o triângulo até o umbigo apertando as escápulas e volte alongando as costas sem curvar a lombar. |
| desenvolvimento_halter | Desenvolvimento com halteres | ombro | composto | halter | não | 1 | Banco a ~80°, halteres na altura das orelhas. Empurre para cima sem bater um no outro e desça até os cotovelos ficarem um pouco abaixo dos ombros. |
| elevacao_lateral | Elevação lateral | ombro | isolado | halter | não | 1 | Cotovelos levemente flexionados. Suba até a altura dos ombros conduzindo pelos cotovelos, sem impulso, e desça devagar. |
| rosca_direta | Rosca direta com barra W | biceps | isolado | barra | não | 2 | Cotovelos colados ao corpo. Suba sem balançar o tronco e desça controlando até quase estender. |
| triceps_corda | Tríceps na polia com corda | triceps | isolado | cabo | não | 2.5 | Cotovelos fixos ao lado do corpo. Estenda e abra a corda no final; volte até uns 90° sem subir os cotovelos. |
| supino_inclinado | Supino inclinado com halteres | peito | composto | halter | não | 1 | Banco a 30°, escápulas encaixadas. Desça os halteres ao lado do peito com cotovelos a ~45° do corpo e empurre para cima. |
| remada_unilateral | Remada unilateral com halter | costas | composto | halter | sim | 2 | Mão e joelho apoiados no banco, coluna reta. Puxe o halter em direção ao quadril com o cotovelo rente ao corpo. |
| crucifixo_invertido | Crucifixo invertido na máquina | ombro | isolado | maquina | não | 2.5 | Peito apoiado, braços quase estendidos. Abra os braços para trás até a linha dos ombros, sem encolher o pescoço. |
| rosca_alternada | Rosca alternada com halteres | biceps | isolado | halter | não | 1 | Gire a palma para cima durante a subida. Cotovelo parado, um braço de cada vez. |
| triceps_frances | Tríceps francês com halter | triceps | isolado | halter | não | 1 | Sentada, segure um halter com as duas mãos atrás da cabeça. Estenda os braços sem abrir os cotovelos. |

## 6. Regras de progressão (`js/progressao.js`)

Funções puras. "Histórico do exercício" = registros **feitos** (`feita: true`) desse
`exercicioId` nas sessões **finalizadas**, da mais recente para a mais antiga
(sessões em que o exercício não teve nenhuma série feita são ignoradas).

```js
avaliar(historico, exercicio) -> {
  status: "novo" | "aumentar" | "manter" | "reduzir",
  cargaAtual: number | null,      // carga da sessão mais recente
  cargaSugerida: number | null,
  ultima: { data, registros } | null
}
```

1. **novo** — sem histórico. `cargaSugerida = null`.
2. **aumentar** — na sessão mais recente: número de séries feitas ≥ `series`
   prescritas (snapshot da sessão), todas com a **mesma carga**, e **todas** com
   `reps ≥ repMax`. `cargaSugerida = cargaAtual + exercicio.incremento`.
3. **reduzir** — nas **duas** sessões mais recentes, com a mesma carga (= cargaAtual),
   a **média** de reps das séries feitas ficou `< repMin`.
   `cargaSugerida = floor(cargaAtual * 0.9 / incremento) * incremento`;
   se der ≤ 0, `status = "manter"`.
4. **manter** — qualquer outro caso. `cargaSugerida = cargaAtual`.

"Carga atual" com cargas diferentes entre séries = a carga mais usada na sessão; em
empate, a maior. Peso corporal: carga 0 é válida; com incremento > 0 a regra é a mesma.
Arredondar sugestões a 0,5 kg para evitar 42.50000001.

Também em `progressao.js`:
- `proximoTreino(treinos, ultimoTreinoId)` → o treino seguinte na ordem (após E volta
  ao A; se `null` ou id inexistente → primeiro).
- `melhorCargaPorSessao(historico)` → `[{data, carga}]` (maior carga feita em cada
  sessão), em ordem cronológica, para o gráfico.

## 7. Telas

Navegação inferior fixa com 4 abas: **Hoje**, **Exercícios**, **Histórico**, **Ajustes**.
Se houver `sessaoAtual`, a aba Hoje mostra o treino em andamento.

### 7.1 Hoje (`#/hoje`)
- Saudação + card grande do treino sugerido (`proximoTreino`): letra, nome, foco,
  lista resumida dos exercícios, data do último treino desse dia, botão **Começar**.
- Abaixo, "Outro treino" com chips A–E para escolher outro.
- Com sessão em andamento: card "Treino em andamento" → **Continuar**.
- Começar cria `sessaoAtual` copiando os itens do treino (snapshot da prescrição) e
  pré-preenchendo `registros` (ver 7.2).

### 7.2 Treino em andamento (`#/treino`)
- Cabeçalho: nome do treino, tempo decorrido, progresso (séries feitas / total).
- Um card por exercício (lista rolável, o exercício atual expandido, os concluídos
  recolhidos com ✓):
  - Nome, grupo, "cada lado" se unilateral, prescrição ("4 × 8–12 · 2 min").
  - **Última vez**: "40 kg × 12, 12, 11" e data — ou "Primeira vez".
  - **Selo de progressão**: `aumentar` → "Pode aumentar → 42,5 kg" (botão
    **Aplicar** preenche a carga em todas as séries não feitas); `reduzir` → "Sugestão:
    baixar para 36 kg" (botão Aplicar); `manter`/`novo` sem selo.
  - Linhas de série: nº, campo carga (kg), campo reps, botão ✓ grande.
    Pré-preenchimento: carga = cargaAtual (ou vazio se novo); reps = reps da mesma
    série na última sessão (ou repMax se não houver).
    Ao editar a carga da série 1 antes de marcá-la, as séries seguintes não feitas
    copiam o valor.
  - Botões "+ série" e "− série" (remove a última não feita).
  - Ícone **ⓘ dica** abre a dica do exercício (bottom sheet).
  - Botão **Trocar**: bottom sheet com exercícios do mesmo grupo (primeiro) e depois
    todos, busca por nome, e "Criar exercício". Opções: "Só hoje" (registra
    `trocadoDe`) ou "Sempre neste treino" (altera também o `Treino`).
- Marcar ✓ numa série: grava, `feita = true`, inicia o cronômetro com o `descanso`
  do item. Tocar no ✓ de novo desmarca.
- Campos numéricos: `inputmode="decimal"`, aceitam vírgula; salvar a cada alteração.
- Rodapé: **Finalizar treino** (confirma se houver séries não feitas). Finalizar →
  `fim = agora`, move para `sessoes`, `ultimoTreinoId = treinoId`, limpa
  `sessaoAtual`, abre o **Resumo**: duração, total de séries, volume (Σ carga×reps)
  e lista "Na próxima, pode aumentar:" com os exercícios cujo `avaliar` agora dá
  `aumentar`. Itens sem nenhuma série feita não entram na sessão salva.
- Menu "⋯" no cabeçalho: **Descartar treino** (com confirmação).

### 7.3 Cronômetro de descanso (`js/cronometro.js`)
- Barra flutuante acima da nav: contagem regressiva grande, botões **−15s**, **+15s**,
  **Pular**.
- Baseado em timestamp de término (`Date.now()`), não em contagem de ticks — continua
  certo se a tela apagar ou o app for para segundo plano; ao voltar, recalcula.
- No fim: `navigator.vibrate([300,150,300])` (se existir) + bipe curto via Web Audio
  (o `AudioContext` é criado/retomado no toque do ✓ para respeitar a política de
  autoplay) + a barra pisca e some após 5 s.
- Persistir o término em `sessaoAtual` para sobreviver a recarregar a página.

### 7.4 Exercícios (`#/exercicios`) e detalhe (`#/exercicio/<id>`)
- Lista agrupada por grupo muscular, busca por nome, botão **+ Novo exercício**.
- Cada linha: nome, última carga, selo se "pode aumentar".
- Detalhe: dica, equipamento, incremento; **gráfico de evolução** (`grafico.js`:
  SVG inline responsivo, linha da melhor carga por sessão, pontos tocáveis com
  data/carga, eixo Y com min/max, mensagem se < 2 sessões); tabela das últimas 10
  sessões (data, séries "40×12 · 40×12 · 40×11").
- Editar (todos): nome, grupo, tipo, equipamento, unilateral, incremento, dica.
  Excluir só exercícios `personalizado` que não estejam em nenhum treino nem
  histórico (senão, botão desabilitado com explicação).

### 7.5 Histórico (`#/historico`)
- Lista de sessões (mais recente primeiro): data, treino, duração, nº de séries.
- Tocar abre o detalhe da sessão (exercícios e séries). Permite excluir a sessão
  (com confirmação).

### 7.6 Ajustes (`#/ajustes`)
- **Meus treinos**: editar cada treino A–E (nome, foco, exercícios: adicionar,
  remover, subir/descer, séries, repMin, repMax, descanso).
- **Backup**: "Exportar" baixa `treino-backup-AAAA-MM-DD.json`; "Importar" lê um
  arquivo, valida (`validarBackup`) e substitui tudo após confirmação.
- **Restaurar treinos padrão** (só os treinos; mantém histórico e exercícios
  personalizados), com confirmação.
- Versão do app.

## 8. Visual

- Moderno, **tema escuro**, destaque **coral/rosa**. Tokens em `:root`:
  `--bg #0e0e13`, `--surface #18181f`, `--surface-2 #22222b`, `--text #f4f4f6`,
  `--muted #9a9aa8`, `--accent #ff5c7a`, `--accent-2 #ffb36b` (gradiente do botão
  principal), `--ok #3ddc97`, `--warn #ffb020`, `--danger #ff4d4f`, raio 16px.
- Fonte do sistema (`system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`),
  números com `font-variant-numeric: tabular-nums`.
- Mobile-first: largura máx. do conteúdo 560px centralizada; alvos de toque ≥ 48px;
  campos de carga/reps grandes (fonte ≥ 20px); respeitar `env(safe-area-inset-*)`.
- Selo "Pode aumentar" verde (`--ok`) com seta ↑; "baixar" em `--warn`.
- Transições curtas (150–200 ms); respeitar `prefers-reduced-motion`.
- Sem rolagem horizontal em 360px de largura.
- `<meta name="theme-color" content="#0e0e13">`, `apple-mobile-web-app-capable`.

## 9. PWA e ícones

- `manifest.webmanifest`: `name "Treino"`, `short_name "Treino"`, `start_url "./"`,
  `scope "./"`, `display "standalone"`, `background_color`/`theme_color #0e0e13`,
  ícones 192 e 512 (`purpose "any maskable"`).
- Ícone: SVG simples (halter estilizado em coral sobre fundo escuro arredondado).
  PNGs gerados a partir do desenho com um script PowerShell usando
  `System.Drawing` (desenhar as mesmas formas) — script salvo em
  `tools/gerar-icones.ps1`.
- `sw.js`: lista explícita dos arquivos do shell, `CACHE = "treino-v1"`; ao mudar
  qualquer arquivo, incrementar a versão. `install` → cache; `activate` → apagar
  caches antigos; `fetch` → cache-first, cai para rede.
- Registrar o SW em `app.js` só se `'serviceWorker' in navigator`.

## 10. Erros e robustez

- `localStorage` indisponível/cheio: o app funciona em memória e mostra um aviso
  discreto "Não estou conseguindo salvar — faça um backup".
- Estado corrompido (JSON inválido): guardar o texto bruto em
  `appTreino.v1.corrompido`, iniciar estado padrão e avisar.
- `migrar(estado)`: ponto único para futuras versões; garante que exercícios
  padrão novos sejam adicionados ao catálogo sem sobrescrever edições.
- `validarBackup(obj)`: exige `versao` numérica, `exercicios` objeto, `treinos` e
  `sessoes` arrays; rejeita com mensagem clara.
- Entradas numéricas: carga ≥ 0 (até 1 casa decimal), reps inteiro ≥ 0; inválido
  não é salvo e o campo fica destacado.

## 11. Testes

- `node --test tests/` (Node 24, sem dependências):
  - `progressao`: novo; aumentar (todas no topo); não aumenta se uma série abaixo do
    topo; não aumenta se cargas diferentes; não aumenta com menos séries que o
    prescrito; reduzir após 2 sessões abaixo do mínimo; não reduz com só 1;
    arredondamento do reduzir; incremento 1 kg em halter; `proximoTreino` (ciclo,
    null, id inexistente); `melhorCargaPorSessao`.
  - `armazenamento`: `validarBackup` aceita válido e rejeita inválidos; `migrar`
    adiciona exercício padrão faltante sem sobrescrever editado.
- Validação final (feita pelo Claude, não pelo implementador): Chrome real em
  viewport de celular (390×844) — fluxo completo: começar treino A, preencher,
  marcar séries, cronômetro, trocar exercício, finalizar, ver resumo; repetir
  sessão com tudo no topo e conferir "Pode aumentar"; gráfico; backup
  exportar/importar; recarregar no meio do treino e retomar; modo offline.

## 12. Publicação (GitHub Pages)

- `gh` não está instalado nesta máquina; o repositório será criado pelo Tiago (ou
  instalamos o `gh`). Repo público, Pages servindo a branch `main` na raiz.
- Depois de publicado: abrir no celular dela → "Adicionar à tela inicial".
- Atualizações: subir arquivos + incrementar `CACHE` no `sw.js`.

## 13. Execução

Seguindo o padrão do Tiago: este spec → plano de implementação → subagente Sonnet
implementa → revisão do diff + testes + e2e no Chrome pelo modelo mais capaz.
