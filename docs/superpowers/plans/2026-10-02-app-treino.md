# App Treino — Plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** PWA de academia (offline, instalável) que mostra o treino do dia, registra carga/reps, lembra as últimas cargas e avisa quando pode aumentar.

**Architecture:** App estático em HTML/CSS/JS puro (ES modules), sem build e sem dependências em runtime. Estado único em `localStorage` (`appTreino.v1`), lógica de negócio em módulos puros testados com `node --test`, telas renderizadas por template string com delegação de eventos (`data-acao`). Service worker cache-first para funcionar offline no GitHub Pages (subpasta → caminhos relativos).

**Tech Stack:** HTML5, CSS (custom properties), JavaScript ES2022 modules, Node 24 (`node:test`, `node:assert/strict`) só para testes, PowerShell + System.Drawing para gerar ícones PNG.

**Spec:** `docs/superpowers/specs/2026-10-02-app-treino-design.md` — leia antes de cada tarefa; textos de dicas, treinos e cores estão lá.

## Global Constraints

- Idioma: toda a interface, comentários de código e mensagens de commit em **português do Brasil**. Nomes de arquivos/variáveis como definidos neste plano.
- Sem dependências externas em runtime: nada de CDN, fonte web ou biblioteca. `package.json` sem `dependencies`.
- Todos os caminhos relativos (`./css/app.css`, nunca `/css/app.css`) — o app roda em `https://<usuario>.github.io/<repo>/`.
- Módulos puros (`util.js`, `dados.js`, `progressao.js`, funções puras de `armazenamento.js` e `cronometro.js`) não tocam DOM nem `localStorage`.
- Chave de armazenamento: `appTreino.v1`; `versao: 1`.
- Cores (tokens em `:root`): `--bg #0e0e13`, `--surface #18181f`, `--surface-2 #22222b`, `--text #f4f4f6`, `--muted #9a9aa8`, `--accent #ff5c7a`, `--accent-2 #ffb36b`, `--ok #3ddc97`, `--warn #ffb020`, `--danger #ff4d4f`, raio 16px.
- Mobile-first: conteúdo máx. 560px, alvos de toque ≥ 48px, campos de carga/reps com fonte ≥ 20px, sem rolagem horizontal em 360px, respeitar `env(safe-area-inset-*)` e `prefers-reduced-motion`.
- Todo texto vindo do usuário (nomes/dicas de exercícios criados) passa por `esc()` antes de ir para HTML.
- Números exibidos em pt-BR ("42,5 kg"); campos aceitam vírgula.
- Commits ao fim de cada tarefa, mensagem em português terminando com a linha `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Rodar testes: `node --test tests/` na raiz do projeto (`C:\Claude\App Treino`).

## Review Focus

1. **Recarregar/fechar o app no meio do treino** → ao reabrir, a sessão continua com tudo o que foi digitado (salvar a cada alteração; teste de ida e volta da `sessaoAtual` na Task 4).
2. **Carga digitada com vírgula ("42,5"), vazia ou com lixo ("4a")** → vírgula vira 42.5; vazio/lixo não é salvo e o campo fica destacado (testes de `parseCarga`/`parseReps` na Task 1).
3. **Tela apagada ou app em segundo plano durante o descanso** → ao voltar, o cronômetro mostra o tempo restante correto ou já terminou (teste de `restanteSegundos` na Task 6).
4. **Digitar carga/reps não pode perder o foco nem fechar o teclado** → eventos `input` atualizam o estado sem re-renderizar a tela inteira (verificação manual na Task 6).
5. **Exercício trocado "só hoje"** → o histórico e a progressão usam o exercício realmente feito, e o treino original não muda (teste de `historicoDoExercicio` na Task 3 + verificação manual na Task 7).

---

## Mapa de arquivos

| arquivo | responsabilidade |
|---|---|
| `package.json` | `type: module` + script de teste |
| `js/util.js` | formatação pt-BR, parse de números, ids, `esc()` |
| `js/dados.js` | catálogo padrão de exercícios, 5 treinos padrão, rótulos de grupos |
| `js/progressao.js` | histórico por exercício, regra de progressão, próximo treino, série do gráfico |
| `js/armazenamento.js` | estado inicial, migração, validação de backup, carregar/salvar |
| `js/cronometro.js` | cálculo puro do restante + controlador do cronômetro (DOM, vibração, bipe) |
| `js/grafico.js` | gera SVG de linha a partir de `[{data, carga}]` |
| `js/estado.js` | estado em memória do app, `atualizar()`, aviso de falha ao salvar |
| `js/app.js` | inicialização, roteador por hash, nav, registro do SW |
| `js/ui.js` | bottom sheet, confirmação, toast |
| `js/telas/hoje.js` | tela Hoje |
| `js/telas/treino.js` | treino em andamento + resumo |
| `js/telas/trocar.js` | sheet de trocar exercício + formulário de exercício |
| `js/telas/exercicios.js` | lista e detalhe de exercício |
| `js/telas/historico.js` | lista e detalhe de sessões |
| `js/telas/ajustes.js` | editar treinos, backup, restaurar |
| `index.html`, `css/app.css`, `manifest.webmanifest`, `sw.js`, `icons/*`, `tools/gerar-icones.ps1` | casca, estilo, PWA |
| `tests/*.test.js` | testes `node:test` |

---

### Task 1: Base do projeto + `util.js`

**Files:**
- Create: `package.json`, `.gitignore`, `js/util.js`, `tests/util.test.js`

**Interfaces:**
- Produces (`js/util.js`):
  - `arredondar(n: number, passo = 0.5): number`
  - `parseNumero(txt: string|number): number|null` — aceita vírgula; vazio/inválido → `null`
  - `parseCarga(txt): number|null` — ≥ 0, arredondado a 1 casa; inválido → `null`
  - `parseReps(txt): number|null` — inteiro ≥ 0; inválido/decimal → `null`
  - `formatarNumero(n): string` — pt-BR, até 1 casa ("42,5", "40")
  - `formatarKg(n): string` — "42,5 kg"; `null`/`NaN` → "—"
  - `formatarData(iso): string` — "02/10"; `formatarDataCompleta(iso)` — "02/10/2026"
  - `formatarDuracao(ms): string` — "52 min", "1h 05min"
  - `formatarDescanso(s): string` — "45 s", "1 min", "1 min 30 s", "2 min"
  - `gerarId(prefixo = ''): string`
  - `esc(txt): string` — escapa `& < > " '`

- [ ] **Step 1: Criar `package.json` e `.gitignore`**

```json
{
  "name": "app-treino",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "scripts": { "test": "node --test tests/" }
}
```

`.gitignore`:
```
node_modules/
*.log
```

- [ ] **Step 2: Escrever o teste que falha — `tests/util.test.js`**

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  arredondar, parseNumero, parseCarga, parseReps, formatarNumero, formatarKg,
  formatarData, formatarDataCompleta, formatarDuracao, formatarDescanso, gerarId, esc
} from '../js/util.js';

test('arredondar em passos de 0,5', () => {
  assert.equal(arredondar(42.50000001), 42.5);
  assert.equal(arredondar(42.3), 42.5);
  assert.equal(arredondar(42.2), 42);
  assert.equal(arredondar(7, 1), 7);
});

test('parseNumero aceita vírgula e rejeita lixo', () => {
  assert.equal(parseNumero('42,5'), 42.5);
  assert.equal(parseNumero(' 40 '), 40);
  assert.equal(parseNumero(12), 12);
  assert.equal(parseNumero(''), null);
  assert.equal(parseNumero('4a'), null);
  assert.equal(parseNumero('-3'), null);
  assert.equal(parseNumero(null), null);
});

test('parseCarga arredonda a 1 casa e aceita zero', () => {
  assert.equal(parseCarga('42,55'), 42.6);
  assert.equal(parseCarga('0'), 0);
  assert.equal(parseCarga('abc'), null);
});

test('parseReps só aceita inteiro', () => {
  assert.equal(parseReps('12'), 12);
  assert.equal(parseReps('0'), 0);
  assert.equal(parseReps('10,5'), null);
  assert.equal(parseReps(''), null);
});

test('formatação pt-BR', () => {
  assert.equal(formatarNumero(42.5), '42,5');
  assert.equal(formatarNumero(40), '40');
  assert.equal(formatarKg(42.5), '42,5 kg');
  assert.equal(formatarKg(null), '—');
  assert.equal(formatarData('2026-10-02T12:00:00'), '02/10');
  assert.equal(formatarDataCompleta('2026-10-02T12:00:00'), '02/10/2026');
});

test('formatarDuracao', () => {
  assert.equal(formatarDuracao(52 * 60000), '52 min');
  assert.equal(formatarDuracao(65 * 60000), '1h 05min');
  assert.equal(formatarDuracao(20000), '0 min');
});

test('formatarDescanso', () => {
  assert.equal(formatarDescanso(45), '45 s');
  assert.equal(formatarDescanso(60), '1 min');
  assert.equal(formatarDescanso(90), '1 min 30 s');
  assert.equal(formatarDescanso(120), '2 min');
});

test('gerarId gera ids distintos com prefixo', () => {
  const a = gerarId('c_'), b = gerarId('c_');
  assert.ok(a.startsWith('c_'));
  assert.notEqual(a, b);
});

test('esc escapa HTML', () => {
  assert.equal(esc('<b>"a" & \'b\'</b>'), '&lt;b&gt;&quot;a&quot; &amp; &#39;b&#39;&lt;/b&gt;');
  assert.equal(esc(null), '');
});
```

- [ ] **Step 3: Rodar e ver falhar**

Run: `node --test tests/`
Expected: FAIL — `Cannot find module ... js/util.js`

- [ ] **Step 4: Implementar `js/util.js`**

```js
// Utilitários puros: formatação pt-BR, conversão de números e ids.
// Não acessam DOM nem localStorage (testáveis no Node).

export function arredondar(n, passo = 0.5) {
  // o epsilon evita 42.49999 virar 42 por erro de ponto flutuante
  return Math.round(n / passo + 1e-9) * passo;
}

export function parseNumero(txt) {
  if (typeof txt === 'number') return Number.isFinite(txt) && txt >= 0 ? txt : null;
  if (txt == null) return null;
  const s = String(txt).trim().replace(',', '.');
  if (!/^\d+(\.\d+)?$/.test(s)) return null;
  return Number(s);
}

export function parseCarga(txt) {
  const n = parseNumero(txt);
  return n == null ? null : Math.round(n * 10) / 10;
}

export function parseReps(txt) {
  const n = parseNumero(txt);
  return n != null && Number.isInteger(n) ? n : null;
}

const fmtNumero = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 });

export function formatarNumero(n) {
  return fmtNumero.format(n);
}

export function formatarKg(n) {
  if (n == null || Number.isNaN(n)) return '—';
  return `${formatarNumero(n)} kg`;
}

export function formatarData(iso) {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

export function formatarDataCompleta(iso) {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export function formatarDuracao(ms) {
  const min = Math.floor(ms / 60000);
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  return `${h}h ${String(min % 60).padStart(2, '0')}min`;
}

export function formatarDescanso(s) {
  if (s < 60) return `${s} s`;
  const min = Math.floor(s / 60), seg = s % 60;
  return seg ? `${min} min ${seg} s` : `${min} min`;
}

export function gerarId(prefixo = '') {
  return prefixo + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

const MAPA_ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

export function esc(txt) {
  if (txt == null) return '';
  return String(txt).replace(/[&<>"']/g, c => MAPA_ESC[c]);
}
```

- [ ] **Step 5: Rodar e ver passar**

Run: `node --test tests/`
Expected: PASS (todos)

- [ ] **Step 6: Commit**

```bash
git add package.json .gitignore js/util.js tests/util.test.js
git commit -m "feat: base do projeto e utilitários pt-BR"
```

---

### Task 2: Catálogo e treinos padrão — `dados.js`

**Files:**
- Create: `js/dados.js`, `tests/dados.test.js`

**Interfaces:**
- Produces (`js/dados.js`):
  - `GRUPOS: { [valor]: rotulo }` — `gluteo: 'Glúteo'`, `quadriceps: 'Quadríceps'`, `posterior: 'Posterior de coxa'`, `panturrilha: 'Panturrilha'`, `costas: 'Costas'`, `peito: 'Peito'`, `ombro: 'Ombro'`, `biceps: 'Bíceps'`, `triceps: 'Tríceps'`, `abdomen: 'Abdômen'`
  - `EQUIPAMENTOS: { barra: 'Barra', maquina: 'Máquina', halter: 'Halteres', cabo: 'Cabo/polia', peso_corporal: 'Peso corporal' }`
  - `exerciciosPadrao: { [id]: Exercicio }` — formato `Exercicio` do spec §3, `personalizado: false`
  - `treinosPadrao: Treino[]` — ids `'A'..'E'` nessa ordem

- [ ] **Step 1: Teste que falha — `tests/dados.test.js`**

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GRUPOS, EQUIPAMENTOS, exerciciosPadrao, treinosPadrao } from '../js/dados.js';

test('cinco treinos A a E na ordem', () => {
  assert.deepEqual(treinosPadrao.map(t => t.id), ['A', 'B', 'C', 'D', 'E']);
});

test('todo item de treino aponta para exercício existente e tem prescrição válida', () => {
  for (const t of treinosPadrao) {
    assert.ok(t.nome && t.foco, `treino ${t.id} sem nome/foco`);
    assert.ok(t.itens.length >= 5, `treino ${t.id} com poucos itens`);
    for (const it of t.itens) {
      assert.ok(exerciciosPadrao[it.exercicioId], `${t.id}: ${it.exercicioId} não existe`);
      assert.ok(it.series > 0 && it.repMin > 0 && it.repMax >= it.repMin && it.descanso > 0);
    }
  }
});

test('exercícios com campos completos', () => {
  const ids = Object.keys(exerciciosPadrao);
  assert.equal(ids.length, 25);
  for (const [id, ex] of Object.entries(exerciciosPadrao)) {
    assert.equal(ex.id, id);
    assert.ok(GRUPOS[ex.grupo], `${id}: grupo inválido`);
    assert.ok(EQUIPAMENTOS[ex.equipamento], `${id}: equipamento inválido`);
    assert.ok(['composto', 'isolado'].includes(ex.tipo));
    assert.equal(typeof ex.unilateral, 'boolean');
    assert.ok(ex.incremento > 0);
    assert.ok(ex.dica.length > 20);
    assert.equal(ex.personalizado, false);
  }
});

test('prescrições conferem com o spec (amostra)', () => {
  const a = treinosPadrao[0].itens[0];
  assert.deepEqual(a, { exercicioId: 'elevacao_pelvica', series: 4, repMin: 8, repMax: 12, descanso: 120 });
  const c = treinosPadrao[2].itens[0];
  assert.deepEqual(c, { exercicioId: 'agachamento', series: 4, repMin: 6, repMax: 10, descanso: 120 });
  assert.equal(exerciciosPadrao.leg_press.incremento, 5);
  assert.equal(exerciciosPadrao.bulgaro.unilateral, true);
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `node --test tests/`
Expected: FAIL — módulo `js/dados.js` não encontrado

- [ ] **Step 3: Implementar `js/dados.js`**

Transcrever **exatamente** as tabelas do spec §4 (treinos) e §5 (catálogo, 25 exercícios, dicas palavra por palavra). Estrutura (os demais exercícios seguem o mesmo formato com os valores do spec):

```js
// Dados padrão do app: grupos musculares, catálogo de exercícios e a divisão de 5 dias.
// Fonte: spec §4 e §5. Ao mudar algo aqui, a migração adiciona exercícios novos ao catálogo salvo.

export const GRUPOS = {
  gluteo: 'Glúteo', quadriceps: 'Quadríceps', posterior: 'Posterior de coxa',
  panturrilha: 'Panturrilha', costas: 'Costas', peito: 'Peito', ombro: 'Ombro',
  biceps: 'Bíceps', triceps: 'Tríceps', abdomen: 'Abdômen'
};

export const EQUIPAMENTOS = {
  barra: 'Barra', maquina: 'Máquina', halter: 'Halteres',
  cabo: 'Cabo/polia', peso_corporal: 'Peso corporal'
};

// cria o objeto Exercicio com os campos na ordem do spec
function ex(id, nome, grupo, tipo, equipamento, unilateral, incremento, dica) {
  return { id, nome, grupo, tipo, equipamento, unilateral, incremento, dica, personalizado: false };
}

const lista = [
  ex('elevacao_pelvica', 'Elevação pélvica com barra', 'gluteo', 'composto', 'barra', false, 2.5,
    'Costas apoiadas no banco na linha das escápulas, pés na largura do quadril. Suba contraindo o glúteo até alinhar quadril e tronco, queixo levemente recolhido. Segure 1 s no topo.'),
  ex('bulgaro', 'Agachamento búlgaro com halteres', 'gluteo', 'composto', 'halter', true, 1,
    'Pé de trás apoiado no banco, passo largo. Incline levemente o tronco à frente para puxar mais glúteo. Desça até o joelho de trás quase tocar o chão. Termine uma perna e troque.'),
  // ... os outros 23 exercícios do spec §5, na ordem da tabela
];

export const exerciciosPadrao = Object.fromEntries(lista.map(e => [e.id, e]));

// item de treino: exercício, séries, faixa de repetições e descanso em segundos
function it(exercicioId, series, repMin, repMax, descanso) {
  return { exercicioId, series, repMin, repMax, descanso };
}

export const treinosPadrao = [
  { id: 'A', nome: 'Inferiores — Glúteo', foco: 'Glúteo', itens: [
    it('elevacao_pelvica', 4, 8, 12, 120),
    it('bulgaro', 3, 8, 12, 90),
    it('stiff', 3, 8, 12, 120),
    it('abducao', 3, 12, 15, 60),
    it('flexora_sentada', 3, 10, 15, 60)
  ] },
  { id: 'B', nome: 'Superiores — Costas e ombro', foco: 'Costas e ombro', itens: [
    it('puxada_frente', 4, 8, 12, 90),
    it('remada_baixa', 3, 8, 12, 90),
    it('desenvolvimento_halter', 3, 8, 12, 90),
    it('elevacao_lateral', 4, 12, 15, 60),
    it('rosca_direta', 3, 10, 12, 60),
    it('triceps_corda', 3, 10, 15, 60)
  ] },
  { id: 'C', nome: 'Inferiores — Quadríceps', foco: 'Quadríceps', itens: [
    it('agachamento', 4, 6, 10, 120),
    it('leg_press', 4, 8, 12, 120),
    it('extensora', 3, 10, 15, 60),
    it('afundo', 3, 10, 12, 90),
    it('panturrilha', 4, 12, 15, 45)
  ] },
  { id: 'D', nome: 'Superiores — Peito, ombro e braços', foco: 'Peito, ombro e braços', itens: [
    it('supino_inclinado', 3, 8, 12, 90),
    it('remada_unilateral', 3, 8, 12, 90),
    it('elevacao_lateral', 3, 12, 15, 60),
    it('crucifixo_invertido', 3, 12, 15, 60),
    it('rosca_alternada', 3, 10, 12, 60),
    it('triceps_frances', 3, 10, 12, 60)
  ] },
  { id: 'E', nome: 'Inferiores — Glúteo e posterior', foco: 'Glúteo e posterior', itens: [
    it('terra_romeno', 3, 8, 12, 120),
    it('glute_bridge', 3, 10, 15, 90),
    it('mesa_flexora', 3, 10, 12, 60),
    it('coice_cabo', 3, 12, 15, 60),
    it('abducao', 3, 12, 15, 60),
    it('panturrilha', 4, 12, 15, 45)
  ] }
];
```

O comentário `// ... os outros 23` acima é só deste plano: no arquivo final os 25 exercícios estão escritos por extenso, com nome, grupo, tipo, equipamento, unilateral, incremento e dica copiados do spec §5.

- [ ] **Step 4: Rodar e ver passar**

Run: `node --test tests/`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add js/dados.js tests/dados.test.js
git commit -m "feat: catálogo de exercícios e treinos padrão A-E"
```

---

### Task 3: Regras de progressão — `progressao.js`

**Files:**
- Create: `js/progressao.js`, `tests/progressao.test.js`

**Interfaces:**
- Consumes: `arredondar` de `js/util.js`
- Produces (`js/progressao.js`):
  - `historicoDoExercicio(sessoes: Sessao[], exercicioId: string): Entrada[]` — `Entrada = { data: ISO, series, repMin, repMax, registros: Registro[] /* só feitos */ }`, mais recente primeiro; ignora sessões sem `fim` e itens sem série feita.
  - `cargaPredominante(registros): number|null`
  - `avaliar(historico: Entrada[], exercicio: Exercicio): { status: 'novo'|'aumentar'|'manter'|'reduzir', cargaAtual: number|null, cargaSugerida: number|null, ultima: { data, registros }|null }`
  - `proximoTreino(treinos: Treino[], ultimoTreinoId: string|null): Treino|null`
  - `melhorCargaPorSessao(historico: Entrada[]): { data, carga }[]` — ordem cronológica

- [ ] **Step 1: Teste que falha — `tests/progressao.test.js`**

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  historicoDoExercicio, cargaPredominante, avaliar, proximoTreino, melhorCargaPorSessao
} from '../js/progressao.js';

const barra = { id: 'x', incremento: 2.5 };
const halter = { id: 'h', incremento: 1 };

// monta uma Entrada de histórico: cargas e reps por série
function entrada(data, cargas, reps, { series = cargas.length, repMin = 8, repMax = 12 } = {}) {
  return { data, series, repMin, repMax, registros: cargas.map((c, i) => ({ carga: c, reps: reps[i], feita: true })) };
}

test('sem histórico → novo', () => {
  assert.deepEqual(avaliar([], barra), { status: 'novo', cargaAtual: null, cargaSugerida: null, ultima: null });
});

test('todas as séries no topo da faixa → aumentar', () => {
  const h = [entrada('2026-10-02', [40, 40, 40], [12, 12, 13])];
  const r = avaliar(h, barra);
  assert.equal(r.status, 'aumentar');
  assert.equal(r.cargaAtual, 40);
  assert.equal(r.cargaSugerida, 42.5);
  assert.equal(r.ultima.data, '2026-10-02');
});

test('uma série abaixo do topo → manter', () => {
  const r = avaliar([entrada('2026-10-02', [40, 40, 40], [12, 12, 11])], barra);
  assert.equal(r.status, 'manter');
  assert.equal(r.cargaSugerida, 40);
});

test('cargas diferentes entre séries → manter', () => {
  const r = avaliar([entrada('2026-10-02', [40, 40, 42.5], [12, 12, 12])], barra);
  assert.equal(r.status, 'manter');
});

test('menos séries feitas que o prescrito → manter', () => {
  const r = avaliar([entrada('2026-10-02', [40, 40], [12, 12], { series: 3 })], barra);
  assert.equal(r.status, 'manter');
});

test('incremento de halter é 1 kg', () => {
  const r = avaliar([entrada('2026-10-02', [8, 8, 8], [12, 12, 12])], halter);
  assert.equal(r.cargaSugerida, 9);
});

test('duas sessões seguidas abaixo do mínimo com a mesma carga → reduzir 10%', () => {
  const h = [
    entrada('2026-10-02', [40, 40, 40], [7, 6, 6]),
    entrada('2026-09-28', [40, 40, 40], [8, 7, 6])
  ];
  const r = avaliar(h, barra);
  assert.equal(r.status, 'reduzir');
  assert.equal(r.cargaSugerida, 35); // floor(36 / 2,5) * 2,5
});

test('só uma sessão abaixo do mínimo → manter', () => {
  const h = [
    entrada('2026-10-02', [40, 40, 40], [7, 6, 6]),
    entrada('2026-09-28', [40, 40, 40], [10, 9, 9])
  ];
  assert.equal(avaliar(h, barra).status, 'manter');
});

test('abaixo do mínimo mas com cargas diferentes nas duas sessões → manter', () => {
  const h = [
    entrada('2026-10-02', [42.5, 42.5, 42.5], [7, 6, 6]),
    entrada('2026-09-28', [40, 40, 40], [7, 6, 6])
  ];
  assert.equal(avaliar(h, barra).status, 'manter');
});

test('reduzir que daria zero vira manter', () => {
  const h = [entrada('2026-10-02', [2], [3]), entrada('2026-09-28', [2], [3])];
  assert.equal(avaliar(h, barra).status, 'manter');
});

test('cargaPredominante: mais usada; empate → maior', () => {
  assert.equal(cargaPredominante([{ carga: 40 }, { carga: 40 }, { carga: 42.5 }]), 40);
  assert.equal(cargaPredominante([{ carga: 40 }, { carga: 42.5 }]), 42.5);
  assert.equal(cargaPredominante([]), null);
});

test('historicoDoExercicio: só finalizadas, só feitas, mais recente primeiro, usa o exercício feito', () => {
  const sessoes = [
    { id: 's1', treinoId: 'A', inicio: '2026-09-28T10:00:00Z', fim: '2026-09-28T11:00:00Z', itens: [
      { exercicioId: 'x', trocadoDe: null, series: 3, repMin: 8, repMax: 12, descanso: 90,
        registros: [{ carga: 40, reps: 10, feita: true }, { carga: 40, reps: 9, feita: false }] }
    ] },
    { id: 's2', treinoId: 'A', inicio: '2026-10-02T10:00:00Z', fim: '2026-10-02T11:00:00Z', itens: [
      { exercicioId: 'y', trocadoDe: 'x', series: 3, repMin: 8, repMax: 12, descanso: 90,
        registros: [{ carga: 20, reps: 12, feita: true }] },
      { exercicioId: 'x', trocadoDe: null, series: 3, repMin: 8, repMax: 12, descanso: 90,
        registros: [{ carga: 42.5, reps: 8, feita: false }] }
    ] },
    { id: 's3', treinoId: 'A', inicio: '2026-10-03T10:00:00Z', fim: null, itens: [
      { exercicioId: 'x', trocadoDe: null, series: 3, repMin: 8, repMax: 12, descanso: 90,
        registros: [{ carga: 45, reps: 8, feita: true }] }
    ] }
  ];
  const hx = historicoDoExercicio(sessoes, 'x');
  assert.equal(hx.length, 1);
  assert.equal(hx[0].data, '2026-09-28T11:00:00Z');
  assert.deepEqual(hx[0].registros, [{ carga: 40, reps: 10, feita: true }]);
  const hy = historicoDoExercicio(sessoes, 'y');
  assert.equal(hy.length, 1);
  assert.equal(hy[0].registros[0].carga, 20);
});

test('proximoTreino cicla A→E→A e trata null/id inexistente', () => {
  const treinos = ['A', 'B', 'C', 'D', 'E'].map(id => ({ id }));
  assert.equal(proximoTreino(treinos, null).id, 'A');
  assert.equal(proximoTreino(treinos, 'A').id, 'B');
  assert.equal(proximoTreino(treinos, 'E').id, 'A');
  assert.equal(proximoTreino(treinos, 'Z').id, 'A');
  assert.equal(proximoTreino([], 'A'), null);
});

test('melhorCargaPorSessao em ordem cronológica', () => {
  const h = [entrada('2026-10-02', [40, 42.5], [10, 8]), entrada('2026-09-28', [37.5, 40], [12, 10])];
  assert.deepEqual(melhorCargaPorSessao(h), [
    { data: '2026-09-28', carga: 40 },
    { data: '2026-10-02', carga: 42.5 }
  ]);
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `node --test tests/`
Expected: FAIL — módulo `js/progressao.js` não encontrado

- [ ] **Step 3: Implementar `js/progressao.js`**

```js
// Regras de progressão de carga (progressão dupla) — funções puras.
// Ver spec §6.
import { arredondar } from './util.js';

// Histórico de um exercício nas sessões finalizadas, mais recente primeiro.
// Cada entrada guarda a prescrição da época (snapshot) e só as séries feitas.
export function historicoDoExercicio(sessoes, exercicioId) {
  const saida = [];
  for (const s of sessoes) {
    if (!s.fim) continue;
    for (const item of s.itens) {
      if (item.exercicioId !== exercicioId) continue;
      const feitos = item.registros.filter(r => r.feita);
      if (feitos.length === 0) continue;
      saida.push({ data: s.fim, series: item.series, repMin: item.repMin, repMax: item.repMax, registros: feitos });
    }
  }
  saida.sort((a, b) => (a.data < b.data ? 1 : a.data > b.data ? -1 : 0));
  return saida;
}

// Carga mais usada nas séries; em empate, a maior.
export function cargaPredominante(registros) {
  if (!registros.length) return null;
  const contagem = new Map();
  for (const r of registros) contagem.set(r.carga, (contagem.get(r.carga) || 0) + 1);
  let melhor = null, vezes = -1;
  for (const [carga, n] of contagem) {
    if (n > vezes || (n === vezes && carga > melhor)) { melhor = carga; vezes = n; }
  }
  return melhor;
}

function mediaReps(registros) {
  return registros.reduce((s, r) => s + r.reps, 0) / registros.length;
}

export function avaliar(historico, exercicio) {
  if (!historico.length) return { status: 'novo', cargaAtual: null, cargaSugerida: null, ultima: null };

  const [h0, h1] = historico;
  const cargaAtual = cargaPredominante(h0.registros);
  const ultima = { data: h0.data, registros: h0.registros };
  const inc = exercicio.incremento || 0;
  const manter = { status: 'manter', cargaAtual, cargaSugerida: cargaAtual, ultima };

  // aumentar: todas as séries prescritas feitas, mesma carga, todas no topo da faixa
  const mesmaCarga = h0.registros.every(r => r.carga === h0.registros[0].carga);
  const todasNoTopo = h0.registros.every(r => r.reps >= h0.repMax);
  if (inc > 0 && h0.registros.length >= h0.series && mesmaCarga && todasNoTopo) {
    return { status: 'aumentar', cargaAtual, cargaSugerida: arredondar(cargaAtual + inc), ultima };
  }

  // reduzir: duas sessões seguidas, mesma carga, média de reps abaixo do mínimo
  if (inc > 0 && h1 && cargaPredominante(h1.registros) === cargaAtual &&
      mediaReps(h0.registros) < h0.repMin && mediaReps(h1.registros) < h1.repMin) {
    const sugerida = arredondar(Math.floor((cargaAtual * 0.9) / inc + 1e-9) * inc);
    if (sugerida > 0) return { status: 'reduzir', cargaAtual, cargaSugerida: sugerida, ultima };
  }

  return manter;
}

// Próximo treino da sequência; após o último volta ao primeiro.
export function proximoTreino(treinos, ultimoTreinoId) {
  if (!treinos.length) return null;
  const i = treinos.findIndex(t => t.id === ultimoTreinoId);
  return i < 0 ? treinos[0] : treinos[(i + 1) % treinos.length];
}

// Maior carga feita em cada sessão, em ordem cronológica (para o gráfico).
export function melhorCargaPorSessao(historico) {
  return historico
    .map(h => ({ data: h.data, carga: Math.max(...h.registros.map(r => r.carga)) }))
    .reverse();
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `node --test tests/`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add js/progressao.js tests/progressao.test.js
git commit -m "feat: regras de progressão de carga com testes"
```

---

### Task 4: Persistência — `armazenamento.js`

**Files:**
- Create: `js/armazenamento.js`, `tests/armazenamento.test.js`

**Interfaces:**
- Consumes: `exerciciosPadrao`, `treinosPadrao` de `js/dados.js`
- Produces (`js/armazenamento.js`):
  - `CHAVE = 'appTreino.v1'`, `VERSAO = 1`
  - `estadoInicial(): Estado`
  - `migrar(estado): Estado` — retorna novo objeto; adiciona exercícios padrão faltantes sem sobrescrever os existentes; preenche campos ausentes
  - `validarBackup(obj): { ok: true } | { ok: false, erro: string }`
  - `carregar(storage = globalThis.localStorage): { estado: Estado, aviso: null|'corrompido'|'indisponivel' }`
  - `salvar(estado, storage = globalThis.localStorage): boolean`
  - `restaurarTreinosPadrao(estado): Estado`

- [ ] **Step 1: Teste que falha — `tests/armazenamento.test.js`**

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CHAVE, estadoInicial, migrar, validarBackup, carregar, salvar, restaurarTreinosPadrao
} from '../js/armazenamento.js';
import { exerciciosPadrao } from '../js/dados.js';

// storage falso no formato do localStorage
function storageFalso(inicial = {}) {
  const dados = { ...inicial };
  return {
    dados,
    getItem: k => (k in dados ? dados[k] : null),
    setItem: (k, v) => { dados[k] = String(v); }
  };
}

test('estadoInicial tem catálogo, 5 treinos e nada em andamento', () => {
  const e = estadoInicial();
  assert.equal(e.versao, 1);
  assert.equal(Object.keys(e.exercicios).length, 25);
  assert.equal(e.treinos.length, 5);
  assert.deepEqual(e.sessoes, []);
  assert.equal(e.sessaoAtual, null);
  assert.equal(e.ultimoTreinoId, null);
});

test('estadoInicial não compartilha referência com os dados padrão', () => {
  const e = estadoInicial();
  e.exercicios.stiff.nome = 'mudado';
  assert.notEqual(exerciciosPadrao.stiff.nome, 'mudado');
});

test('migrar adiciona exercício padrão faltante sem sobrescrever editado', () => {
  const e = estadoInicial();
  delete e.exercicios.abducao;
  e.exercicios.stiff.incremento = 5;
  const m = migrar(e);
  assert.ok(m.exercicios.abducao);
  assert.equal(m.exercicios.stiff.incremento, 5);
});

test('migrar preenche campos ausentes', () => {
  const m = migrar({ versao: 1, exercicios: {}, treinos: [] });
  assert.deepEqual(m.sessoes, []);
  assert.equal(m.sessaoAtual, null);
  assert.equal(m.ultimoTreinoId, null);
});

test('validarBackup aceita estado válido e rejeita inválidos', () => {
  assert.deepEqual(validarBackup(estadoInicial()), { ok: true });
  assert.equal(validarBackup(null).ok, false);
  assert.equal(validarBackup({}).ok, false);
  assert.equal(validarBackup({ versao: '1', exercicios: {}, treinos: [], sessoes: [] }).ok, false);
  assert.equal(validarBackup({ versao: 1, exercicios: [], treinos: [], sessoes: [] }).ok, false);
  assert.equal(validarBackup({ versao: 1, exercicios: {}, treinos: {}, sessoes: [] }).ok, false);
  const r = validarBackup({ versao: 1, exercicios: {}, treinos: [] });
  assert.equal(r.ok, false);
  assert.match(r.erro, /sessoes/);
});

test('carregar sem nada salvo → estado inicial sem aviso', () => {
  const { estado, aviso } = carregar(storageFalso());
  assert.equal(aviso, null);
  assert.equal(estado.treinos.length, 5);
});

test('salvar e carregar preservam treino em andamento (ida e volta)', () => {
  const st = storageFalso();
  const e = estadoInicial();
  e.sessaoAtual = { id: 's1', treinoId: 'A', inicio: '2026-10-02T10:00:00Z', fim: null, descansoAte: null,
    itens: [{ exercicioId: 'stiff', trocadoDe: null, series: 3, repMin: 8, repMax: 12, descanso: 120,
      registros: [{ carga: 42.5, reps: 10, feita: true }] }] };
  assert.equal(salvar(e, st), true);
  const { estado } = carregar(st);
  assert.deepEqual(estado.sessaoAtual, e.sessaoAtual);
});

test('JSON corrompido → guarda o bruto, inicia padrão e avisa', () => {
  const st = storageFalso({ [CHAVE]: '{quebrado' });
  const { estado, aviso } = carregar(st);
  assert.equal(aviso, 'corrompido');
  assert.equal(st.dados[CHAVE + '.corrompido'], '{quebrado');
  assert.equal(estado.treinos.length, 5);
});

test('storage indisponível → estado em memória e aviso', () => {
  const quebrado = { getItem() { throw new Error('bloqueado'); }, setItem() { throw new Error('bloqueado'); } };
  const { estado, aviso } = carregar(quebrado);
  assert.equal(aviso, 'indisponivel');
  assert.equal(estado.treinos.length, 5);
  assert.equal(salvar(estado, quebrado), false);
  assert.equal(salvar(estado, null), false);
});

test('restaurarTreinosPadrao mantém histórico e exercícios personalizados', () => {
  const e = estadoInicial();
  e.treinos[0].itens = [];
  e.sessoes = [{ id: 's' }];
  e.exercicios.c_meu = { id: 'c_meu', personalizado: true };
  const r = restaurarTreinosPadrao(e);
  assert.ok(r.treinos[0].itens.length > 0);
  assert.equal(r.sessoes.length, 1);
  assert.ok(r.exercicios.c_meu);
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `node --test tests/`
Expected: FAIL — módulo `js/armazenamento.js` não encontrado

- [ ] **Step 3: Implementar `js/armazenamento.js`**

```js
// Persistência do estado em localStorage, migração e backup.
// carregar/salvar recebem o storage por parâmetro para poderem ser testados no Node.
import { exerciciosPadrao, treinosPadrao } from './dados.js';

export const CHAVE = 'appTreino.v1';
export const VERSAO = 1;

const copiar = obj => JSON.parse(JSON.stringify(obj));

export function estadoInicial() {
  return {
    versao: VERSAO,
    exercicios: copiar(exerciciosPadrao),
    treinos: copiar(treinosPadrao),
    sessoes: [],
    sessaoAtual: null,
    ultimoTreinoId: null
  };
}

// Ponto único de atualização do formato salvo.
export function migrar(estado) {
  const e = { ...estado, exercicios: { ...(estado.exercicios || {}) } };
  for (const [id, ex] of Object.entries(exerciciosPadrao)) {
    if (!e.exercicios[id]) e.exercicios[id] = copiar(ex);
  }
  if (!Array.isArray(e.treinos)) e.treinos = copiar(treinosPadrao);
  if (!Array.isArray(e.sessoes)) e.sessoes = [];
  if (e.sessaoAtual === undefined) e.sessaoAtual = null;
  if (e.ultimoTreinoId === undefined) e.ultimoTreinoId = null;
  e.versao = VERSAO;
  return e;
}

export function validarBackup(obj) {
  if (!obj || typeof obj !== 'object') return { ok: false, erro: 'Arquivo vazio ou inválido.' };
  if (typeof obj.versao !== 'number') return { ok: false, erro: 'Campo versao ausente ou inválido.' };
  if (!obj.exercicios || typeof obj.exercicios !== 'object' || Array.isArray(obj.exercicios)) {
    return { ok: false, erro: 'Campo exercicios ausente ou inválido.' };
  }
  if (!Array.isArray(obj.treinos)) return { ok: false, erro: 'Campo treinos ausente ou inválido.' };
  if (!Array.isArray(obj.sessoes)) return { ok: false, erro: 'Campo sessoes ausente ou inválido.' };
  return { ok: true };
}

export function carregar(storage = globalThis.localStorage) {
  let bruto;
  try {
    if (!storage) throw new Error('sem storage');
    bruto = storage.getItem(CHAVE);
  } catch {
    return { estado: estadoInicial(), aviso: 'indisponivel' };
  }
  if (bruto == null) return { estado: estadoInicial(), aviso: null };
  try {
    const obj = JSON.parse(bruto);
    if (!validarBackup(obj).ok) throw new Error('formato inválido');
    return { estado: migrar(obj), aviso: null };
  } catch {
    try { storage.setItem(CHAVE + '.corrompido', bruto); } catch { /* sem espaço: segue sem guardar */ }
    return { estado: estadoInicial(), aviso: 'corrompido' };
  }
}

export function salvar(estado, storage = globalThis.localStorage) {
  try {
    if (!storage) return false;
    storage.setItem(CHAVE, JSON.stringify(estado));
    return true;
  } catch {
    return false;
  }
}

// Volta os treinos A–E ao padrão, mantendo histórico e exercícios.
export function restaurarTreinosPadrao(estado) {
  return { ...estado, treinos: copiar(treinosPadrao) };
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `node --test tests/`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add js/armazenamento.js tests/armazenamento.test.js
git commit -m "feat: persistência, migração e validação de backup"
```

---

### Task 5: Casca do app, PWA, estado e tela Hoje

**Files:**
- Create: `index.html`, `css/app.css`, `manifest.webmanifest`, `sw.js`, `icons/icon.svg`, `tools/gerar-icones.ps1`, `icons/icon-192.png`, `icons/icon-512.png`, `icons/apple-touch-icon.png` (gerados), `js/estado.js`, `js/ui.js`, `js/app.js`, `js/telas/hoje.js`

**Interfaces:**
- Consumes: `carregar`, `salvar` (Task 4); `proximoTreino`, `historicoDoExercicio` (Task 3); `esc`, `formatarData`, `gerarId` (Task 1)
- Produces:
  - `js/estado.js`:
    - `estado` — getter `obterEstado(): Estado`
    - `atualizar(fn: (estado) => void, { renderizar = true } = {}): void` — aplica `fn` (muta o estado), salva; se `salvar` falhar, mostra o aviso "Não estou conseguindo salvar — faça um backup" (uma vez por carregamento); se `renderizar`, chama `renderizarTela()`
    - `substituirEstado(novo: Estado): void` — usado pela importação de backup
    - `definirRenderizador(fn)` — o roteador registra a função de render
  - `js/ui.js`:
    - `abrirSheet(html: string, aoAbrir?: (el) => void): HTMLElement` / `fecharSheet()`
    - `confirmar(mensagem: string, textoOk = 'Confirmar', perigo = false): Promise<boolean>`
    - `toast(mensagem: string)`
  - `js/app.js`: roteador por hash com rotas `#/hoje`, `#/treino`, `#/resumo/<sessaoId>`, `#/exercicios`, `#/exercicio/<id>`, `#/historico`, `#/sessao/<id>`, `#/ajustes`, `#/ajustes/treino/<id>`; padrão `#/hoje`. Cada tela exporta `render(params): string` e opcionalmente `montar(raiz: HTMLElement, params)` para ligar eventos.
  - `js/telas/hoje.js`: `render()`, `montar(raiz)`; e a função **`iniciarSessao(treinoId: string): void`** (exportada; cria `sessaoAtual` e navega para `#/treino`)

- [ ] **Step 1: `index.html`**

```html
<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <meta name="theme-color" content="#0e0e13">
  <meta name="apple-mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
  <title>Treino</title>
  <link rel="manifest" href="./manifest.webmanifest">
  <link rel="icon" href="./icons/icon.svg" type="image/svg+xml">
  <link rel="apple-touch-icon" href="./icons/apple-touch-icon.png">
  <link rel="stylesheet" href="./css/app.css">
</head>
<body>
  <div id="aviso" class="aviso" hidden></div>
  <main id="app"></main>
  <div id="cronometro" class="cronometro" hidden></div>
  <nav class="nav" aria-label="Navegação principal">
    <a href="#/hoje" data-aba="hoje"><span aria-hidden="true">🏋️</span>Hoje</a>
    <a href="#/exercicios" data-aba="exercicios"><span aria-hidden="true">📚</span>Exercícios</a>
    <a href="#/historico" data-aba="historico"><span aria-hidden="true">🗓️</span>Histórico</a>
    <a href="#/ajustes" data-aba="ajustes"><span aria-hidden="true">⚙️</span>Ajustes</a>
  </nav>
  <div id="sheet-fundo" class="sheet-fundo" hidden></div>
  <section id="sheet" class="sheet" hidden role="dialog" aria-modal="true"></section>
  <div id="toast" class="toast" hidden></div>
  <script type="module" src="./js/app.js"></script>
</body>
</html>
```

- [ ] **Step 2: `css/app.css`**

Escrever o CSS completo usando os tokens das Global Constraints. Obrigatório cobrir:
- `:root` com os tokens + `color-scheme: dark`; `body { background: var(--bg); color: var(--text); font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; margin: 0; }`
- `#app { max-width: 560px; margin: 0 auto; padding: 16px 16px calc(96px + env(safe-area-inset-bottom)); padding-top: calc(16px + env(safe-area-inset-top)); }` — o padding inferior aumenta para `calc(170px + …)` quando `body.com-cronometro`.
- `.nav`: fixa embaixo, 4 colunas iguais, altura 64px + safe-area, fundo `--surface` com borda superior sutil; aba ativa (`.ativa`) na cor `--accent`.
- `.card` (fundo `--surface`, raio 16px, padding 16px, margem 12px), `.card-destaque` (borda/gradiente sutil com `--accent`).
- `.btn` (altura ≥ 48px, raio 12px, fonte 16px 600), `.btn-principal` (gradiente `--accent`→`--accent-2`, texto escuro `#1a0a10`), `.btn-sec` (fundo `--surface-2`), `.btn-perigo` (`--danger`), `.btn-icone` (48×48).
- `.chips` / `.chip` (pílulas roláveis horizontalmente dentro do card, sem rolar a página).
- `.selo-ok` (fundo `--ok` 15% + texto `--ok`), `.selo-warn` (mesmo com `--warn`).
- Linha de série `.serie`: grid `32px 1fr 1fr 56px`, inputs `font-size: 20px; height: 52px; text-align: center; font-variant-numeric: tabular-nums`, `.invalido` com borda `--danger`; série feita `.serie.feita` com opacidade e ✓ verde.
- `.cronometro`: fixo acima da nav, card largo com número grande (40px, tabular-nums), botões −15s/+15s/Pular; `.cronometro.fim` com animação de pulso.
- `.sheet` (bottom sheet: fixo embaixo, raio 20px no topo, max-height 85vh, rolagem interna, padding com safe-area) e `.sheet-fundo` (preto 60%).
- `.toast`, `.aviso` (faixa no topo em `--warn`).
- Formulários: `label`, `input`, `select`, `textarea` com fundo `--surface-2`, sem borda clara, foco com contorno `--accent`.
- Gráfico: `.grafico svg { width: 100%; height: auto; }`.
- `@media (prefers-reduced-motion: reduce) { * { animation: none !important; transition: none !important; } }`
- Nenhum elemento mais largo que a viewport em 360px (`img, svg { max-width: 100%; }`, textos longos com `overflow-wrap: anywhere`).

- [ ] **Step 3: Ícones**

`icons/icon.svg`:
```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
  <rect width="20" height="20" rx="4" fill="#0e0e13"/>
  <g fill="#ff5c7a">
    <rect x="6" y="9.25" width="8" height="1.5" rx="0.5"/>
    <rect x="4.5" y="7" width="1.5" height="6" rx="0.5"/>
    <rect x="14" y="7" width="1.5" height="6" rx="0.5"/>
    <rect x="3.5" y="8" width="1" height="4" rx="0.4"/>
    <rect x="15.5" y="8" width="1" height="4" rx="0.4"/>
  </g>
</svg>
```

`tools/gerar-icones.ps1` (desenha as mesmas formas, fundo cheio para servir de maskable):
```powershell
# Gera os ícones PNG do PWA a partir das mesmas formas de icons/icon.svg
Add-Type -AssemblyName System.Drawing
$raiz = Split-Path $PSScriptRoot -Parent

function Gerar([int]$tam, [string]$arquivo) {
  $bmp = New-Object System.Drawing.Bitmap $tam, $tam
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $g.Clear([System.Drawing.Color]::FromArgb(14, 14, 19))
  $coral = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 92, 122))
  $u = $tam / 20.0
  # barra e anilhas na grade 20x20 do SVG
  $g.FillRectangle($coral, [float](6 * $u), [float](9.25 * $u), [float](8 * $u), [float](1.5 * $u))
  $g.FillRectangle($coral, [float](4.5 * $u), [float](7 * $u), [float](1.5 * $u), [float](6 * $u))
  $g.FillRectangle($coral, [float](14 * $u), [float](7 * $u), [float](1.5 * $u), [float](6 * $u))
  $g.FillRectangle($coral, [float](3.5 * $u), [float](8 * $u), [float](1 * $u), [float](4 * $u))
  $g.FillRectangle($coral, [float](15.5 * $u), [float](8 * $u), [float](1 * $u), [float](4 * $u))
  $bmp.Save((Join-Path $raiz "icons\$arquivo"), [System.Drawing.Imaging.ImageFormat]::Png)
  $coral.Dispose(); $g.Dispose(); $bmp.Dispose()
}

Gerar 192 'icon-192.png'
Gerar 512 'icon-512.png'
Gerar 180 'apple-touch-icon.png'
```

Run: `powershell -ExecutionPolicy Bypass -File tools/gerar-icones.ps1`
Expected: três PNGs em `icons/`.

- [ ] **Step 4: `manifest.webmanifest`**

```json
{
  "name": "Treino",
  "short_name": "Treino",
  "start_url": "./",
  "scope": "./",
  "display": "standalone",
  "orientation": "portrait",
  "background_color": "#0e0e13",
  "theme_color": "#0e0e13",
  "lang": "pt-BR",
  "icons": [
    { "src": "./icons/icon-192.png", "sizes": "192x192", "type": "image/png", "purpose": "any maskable" },
    { "src": "./icons/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any maskable" }
  ]
}
```

- [ ] **Step 5: `sw.js`**

```js
// Service worker: cache do app shell para funcionar offline.
// Ao alterar QUALQUER arquivo do app, incremente CACHE.
const CACHE = 'treino-v1';
const ARQUIVOS = [
  './', './index.html', './manifest.webmanifest', './css/app.css',
  './js/app.js', './js/estado.js', './js/ui.js', './js/util.js', './js/dados.js',
  './js/progressao.js', './js/armazenamento.js', './js/cronometro.js', './js/grafico.js',
  './js/telas/hoje.js', './js/telas/treino.js', './js/telas/trocar.js',
  './js/telas/exercicios.js', './js/telas/historico.js', './js/telas/ajustes.js',
  './icons/icon.svg', './icons/icon-192.png', './icons/icon-512.png', './icons/apple-touch-icon.png'
];

self.addEventListener('install', ev => {
  ev.waitUntil(caches.open(CACHE).then(c => c.addAll(ARQUIVOS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', ev => {
  ev.waitUntil(
    caches.keys()
      .then(chaves => Promise.all(chaves.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', ev => {
  if (ev.request.method !== 'GET') return;
  ev.respondWith(caches.match(ev.request, { ignoreSearch: true }).then(r => r || fetch(ev.request)));
});
```

Os arquivos de telas das Tasks 6–9 ainda não existem nesta tarefa: criar cada um como stub mínimo (`export function render() { return '<p class="muted">Em construção</p>'; }`) para o `addAll` não falhar e o roteador funcionar. `js/cronometro.js` e `js/grafico.js` também como stub vazio (`export {};`).

- [ ] **Step 6: `js/estado.js`**

```js
// Estado do app em memória + gravação automática no localStorage.
import { carregar, salvar } from './armazenamento.js';

const inicial = carregar();
let estado = inicial.estado;
let renderizador = () => {};
let avisouFalha = false;

export function obterEstado() { return estado; }

export function definirRenderizador(fn) { renderizador = fn; }

export function avisoInicial() { return inicial.aviso; }

export function mostrarAviso(texto) {
  const el = document.getElementById('aviso');
  el.textContent = texto;
  el.hidden = false;
}

// Aplica uma mudança no estado, salva e (por padrão) redesenha a tela.
export function atualizar(fn, { renderizar = true } = {}) {
  fn(estado);
  if (!salvar(estado) && !avisouFalha) {
    avisouFalha = true;
    mostrarAviso('Não estou conseguindo salvar — faça um backup em Ajustes.');
  }
  if (renderizar) renderizador();
}

export function substituirEstado(novo) {
  estado = novo;
  atualizar(() => {});
}
```

- [ ] **Step 7: `js/ui.js`**

Implementar `abrirSheet`, `fecharSheet`, `confirmar`, `toast` usando os elementos `#sheet`, `#sheet-fundo`, `#toast` do `index.html`:
- `abrirSheet(html, aoAbrir)`: põe o HTML em `#sheet`, mostra sheet e fundo, chama `aoAbrir(sheet)`, retorna o elemento. Tocar no fundo fecha.
- `confirmar(mensagem, textoOk, perigo)`: abre sheet com a mensagem (`esc`), botões "Cancelar" (`.btn-sec`) e `textoOk` (`.btn-perigo` se `perigo`, senão `.btn-principal`); resolve `true`/`false` e fecha. Fechar pelo fundo resolve `false`.
- `toast(mensagem)`: mostra 2,5 s e esconde.

- [ ] **Step 8: `js/app.js` (roteador)**

```js
// Inicialização, roteador por hash e service worker.
import { definirRenderizador, avisoInicial, mostrarAviso } from './estado.js';
import * as hoje from './telas/hoje.js';
import * as treino from './telas/treino.js';
import * as exercicios from './telas/exercicios.js';
import * as historico from './telas/historico.js';
import * as ajustes from './telas/ajustes.js';

// [padrão do hash, módulo da tela, aba ativa na nav]
const ROTAS = [
  [/^#\/hoje$/, hoje, 'hoje'],
  [/^#\/treino$/, treino, 'hoje'],
  [/^#\/resumo\/([^/]+)$/, { render: p => treino.renderResumo(p), montar: (r, p) => treino.montarResumo?.(r, p) }, 'hoje'],
  [/^#\/exercicios$/, exercicios, 'exercicios'],
  [/^#\/exercicio\/([^/]+)$/, { render: p => exercicios.renderDetalhe(p), montar: (r, p) => exercicios.montarDetalhe?.(r, p) }, 'exercicios'],
  [/^#\/historico$/, historico, 'historico'],
  [/^#\/sessao\/([^/]+)$/, { render: p => historico.renderSessao(p), montar: (r, p) => historico.montarSessao?.(r, p) }, 'historico'],
  [/^#\/ajustes$/, ajustes, 'ajustes'],
  [/^#\/ajustes\/treino\/([^/]+)$/, { render: p => ajustes.renderEditarTreino(p), montar: (r, p) => ajustes.montarEditarTreino?.(r, p) }, 'ajustes']
];

function renderizarTela() {
  const hash = location.hash || '#/hoje';
  const raiz = document.getElementById('app');
  for (const [padrao, tela, aba] of ROTAS) {
    const m = hash.match(padrao);
    if (!m) continue;
    const params = m[1] ? decodeURIComponent(m[1]) : undefined;
    raiz.innerHTML = tela.render(params);
    tela.montar?.(raiz, params);
    document.querySelectorAll('.nav a').forEach(a => a.classList.toggle('ativa', a.dataset.aba === aba));
    return;
  }
  location.hash = '#/hoje';
}

definirRenderizador(renderizarTela);
window.addEventListener('hashchange', () => { renderizarTela(); window.scrollTo(0, 0); });
renderizarTela();

if (avisoInicial() === 'corrompido') mostrarAviso('Os dados salvos estavam danificados. Comecei do zero; uma cópia foi guardada.');
if (avisoInicial() === 'indisponivel') mostrarAviso('Não estou conseguindo salvar neste navegador — faça backups.');

try { navigator.storage?.persist?.(); } catch { /* opcional */ }
if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(() => {});
```

Nas Tasks 6, 8 e 9 as telas passam a exportar `renderResumo/montarResumo`, `renderDetalhe/montarDetalhe`, `renderSessao/montarSessao`, `renderEditarTreino/montarEditarTreino`. Nos stubs desta tarefa, exportar essas funções devolvendo o mesmo texto "Em construção".

- [ ] **Step 9: `js/telas/hoje.js`**

Comportamento (spec §7.1):
- Se `estado.sessaoAtual` existe: card destaque "Treino em andamento" com nome do treino, séries feitas/total e botão **Continuar** (`href="#/treino"`), e nada de "Começar".
- Senão: saudação ("Bom dia/Boa tarde/Boa noite" pela hora) + card destaque do `proximoTreino(estado.treinos, estado.ultimoTreinoId)`: letra grande, nome, foco, lista dos nomes dos exercícios com "séries × repMin–repMax", "Último: dd/mm" (fim da sessão mais recente com aquele `treinoId`, ou "Ainda não feito") e botão **Começar** (`data-acao="comecar" data-treino="<id>"`).
- "Outro treino": chips com os outros treinos (letra + foco) — tocar chama `iniciarSessao(id)` após `confirmar` não ser necessário (direto).
- `iniciarSessao(treinoId)` (exportada):

```js
export function iniciarSessao(treinoId) {
  const est = obterEstado();
  const treino = est.treinos.find(t => t.id === treinoId);
  if (!treino) return;
  atualizar(e => {
    e.sessaoAtual = {
      id: gerarId('s_'), treinoId, inicio: new Date().toISOString(), fim: null, descansoAte: null,
      itens: treino.itens.map(it => criarItemSessao(e, it))
    };
  }, { renderizar: false });
  location.hash = '#/treino';
}

// Cria o item da sessão com a prescrição copiada e as séries pré-preenchidas da última vez.
export function criarItemSessao(e, it, trocadoDe = null) {
  const ex = e.exercicios[it.exercicioId];
  const aval = avaliar(historicoDoExercicio(e.sessoes, it.exercicioId), ex);
  const anteriores = aval.ultima ? aval.ultima.registros : [];
  const registros = Array.from({ length: it.series }, (_, i) => ({
    carga: aval.cargaAtual ?? null,
    reps: anteriores[i]?.reps ?? it.repMax,
    feita: false
  }));
  return { exercicioId: it.exercicioId, trocadoDe, series: it.series, repMin: it.repMin, repMax: it.repMax, descanso: it.descanso, registros };
}
```

(`carga: null` significa "ainda não preenchida" — o campo aparece vazio; ao finalizar, séries com carga `null` não podem estar marcadas como feitas, ver Task 6.)

- [ ] **Step 10: Verificação manual**

Run: `npx --yes http-server -p 8080 -c-1 .` (em outro terminal) e abrir `http://localhost:8080/` no Chrome com DevTools em modo celular (390×844).
Expected: tela Hoje mostra "Treino A — Inferiores — Glúteo" com 5 exercícios; nav com 4 abas; outras abas mostram "Em construção"; sem erros no console; Application → Manifest sem erros e SW ativo.
Também: `node --test tests/` continua PASS.

- [ ] **Step 11: Commit**

```bash
git add index.html css manifest.webmanifest sw.js icons tools js
git commit -m "feat: casca do app, PWA, estado e tela Hoje"
```

---

### Task 6: Treino em andamento, cronômetro e resumo

**Files:**
- Modify: `js/cronometro.js` (substitui o stub), `js/telas/treino.js` (substitui o stub)
- Test: `tests/cronometro.test.js`

**Interfaces:**
- Consumes: `obterEstado`, `atualizar` (Task 5); `avaliar`, `historicoDoExercicio` (Task 3); `parseCarga`, `parseReps`, `formatarKg`, `formatarNumero`, `formatarDescanso`, `formatarDuracao`, `formatarData`, `esc` (Task 1); `confirmar`, `abrirSheet`, `toast` (Task 5)
- Produces:
  - `js/cronometro.js`: `restanteSegundos(fimMs: number, agoraMs: number): number` (puro; `Math.max(0, Math.ceil((fimMs - agoraMs) / 1000))`), `iniciarDescanso(segundos: number)`, `ajustarDescanso(deltaSeg: number)`, `pararDescanso()`, `retomarDescanso()` (chamada no carregamento do app se `sessaoAtual.descansoAte` estiver no futuro), `prepararAudio()` (cria/retoma o `AudioContext`; chamar no toque do ✓)
  - `js/telas/treino.js`: `render()`, `montar(raiz)`, `renderResumo(sessaoId)`, `montarResumo(raiz, sessaoId)`; e **`abrirTrocar(indiceItem: number)`** é importada de `./trocar.js` (Task 7) — nesta tarefa o botão Trocar chama `import('./trocar.js').then(m => m.abrirTrocar(i))`, e `trocar.js` continua stub até a Task 7.

- [ ] **Step 1: Teste que falha — `tests/cronometro.test.js`**

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { restanteSegundos } from '../js/cronometro.js';

test('restante arredonda para cima e nunca fica negativo', () => {
  assert.equal(restanteSegundos(10_000, 0), 10);
  assert.equal(restanteSegundos(10_000, 9_100), 1);
  assert.equal(restanteSegundos(10_000, 10_000), 0);
  // tela apagada por mais tempo que o descanso: já terminou
  assert.equal(restanteSegundos(10_000, 600_000), 0);
});
```

`js/cronometro.js` só pode tocar `document`/`navigator`/`AudioContext` dentro das funções (nunca no topo do módulo), para o import funcionar no Node.

- [ ] **Step 2: Rodar e ver falhar**

Run: `node --test tests/`
Expected: FAIL — `restanteSegundos` não exportado

- [ ] **Step 3: Implementar `js/cronometro.js`**

```js
// Cronômetro de descanso baseado em horário de término (sobrevive a tela apagada).
import { obterEstado, atualizar } from './estado.js';
import { formatarDescanso } from './util.js';

export function restanteSegundos(fimMs, agoraMs) {
  return Math.max(0, Math.ceil((fimMs - agoraMs) / 1000));
}

let intervalo = null;
let audio = null;

export function prepararAudio() {
  try {
    audio = audio || new (window.AudioContext || window.webkitAudioContext)();
    if (audio.state === 'suspended') audio.resume();
  } catch { audio = null; }
}

function bipe() {
  if (!audio) return;
  const osc = audio.createOscillator(), ganho = audio.createGain();
  osc.frequency.value = 880;
  ganho.gain.setValueAtTime(0.25, audio.currentTime);
  ganho.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + 0.4);
  osc.connect(ganho).connect(audio.destination);
  osc.start(); osc.stop(audio.currentTime + 0.4);
}

function definirFim(ms) {
  atualizar(e => { if (e.sessaoAtual) e.sessaoAtual.descansoAte = ms; }, { renderizar: false });
}

export function iniciarDescanso(segundos) {
  definirFim(Date.now() + segundos * 1000);
  ligar();
}

export function ajustarDescanso(deltaSeg) {
  const fim = obterEstado().sessaoAtual?.descansoAte;
  if (!fim) return;
  definirFim(Math.max(Date.now(), fim + deltaSeg * 1000));
  tique();
}

export function pararDescanso() {
  clearInterval(intervalo); intervalo = null;
  if (obterEstado().sessaoAtual) definirFim(null);
  const el = document.getElementById('cronometro');
  el.hidden = true; el.classList.remove('fim');
  document.body.classList.remove('com-cronometro');
}

export function retomarDescanso() {
  const fim = obterEstado().sessaoAtual?.descansoAte;
  if (fim && fim > Date.now()) ligar();
  else if (fim) pararDescanso();
}

function ligar() {
  const el = document.getElementById('cronometro');
  el.innerHTML = `
    <div class="cron-tempo" aria-live="polite"></div>
    <div class="cron-botoes">
      <button class="btn btn-sec" data-cron="-15">−15s</button>
      <button class="btn btn-sec" data-cron="15">+15s</button>
      <button class="btn btn-sec" data-cron="pular">Pular</button>
    </div>`;
  el.onclick = ev => {
    const b = ev.target.closest('[data-cron]');
    if (!b) return;
    if (b.dataset.cron === 'pular') pararDescanso();
    else ajustarDescanso(Number(b.dataset.cron));
  };
  el.hidden = false; el.classList.remove('fim');
  document.body.classList.add('com-cronometro');
  clearInterval(intervalo);
  intervalo = setInterval(tique, 250);
  tique();
}

function tique() {
  const fim = obterEstado().sessaoAtual?.descansoAte;
  const el = document.getElementById('cronometro');
  if (!fim) return pararDescanso();
  const rest = restanteSegundos(fim, Date.now());
  const min = Math.floor(rest / 60), seg = String(rest % 60).padStart(2, '0');
  el.querySelector('.cron-tempo').textContent = `${min}:${seg}`;
  if (rest === 0 && !el.classList.contains('fim')) {
    el.classList.add('fim');
    clearInterval(intervalo); intervalo = null;
    try { navigator.vibrate?.([300, 150, 300]); } catch { /* sem vibração */ }
    bipe();
    setTimeout(() => { if (el.classList.contains('fim')) pararDescanso(); }, 5000);
  }
}

// ao voltar do segundo plano, recalcula imediatamente
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => { if (!document.hidden) retomarDescanso(); });
}

export { formatarDescanso };
```

Obs.: `estado.js` chama `carregar()` (que usa `globalThis.localStorage`) ao ser importado; no Node não existe `localStorage`, então `carregar` cai no ramo `indisponivel` sem quebrar — o teste importa `cronometro.js` normalmente. Remover a última linha (`export { formatarDescanso }`) se não for usada.

Em `js/app.js`, após o primeiro `renderizarTela()`, adicionar: `import { retomarDescanso } from './cronometro.js';` (no topo) e `retomarDescanso();`.

- [ ] **Step 4: Rodar e ver passar**

Run: `node --test tests/`
Expected: PASS

- [ ] **Step 5: Implementar `js/telas/treino.js`**

Sem `sessaoAtual` → `render` mostra "Nenhum treino em andamento" + link para Hoje.

Layout (spec §7.2):
- Cabeçalho: nome do treino, tempo decorrido (`formatarDuracao(agora - inicio)`, atualizado a cada 30 s só no elemento `.tempo`, sem re-render), progresso "7/20 séries", botão "⋯" (`data-acao="menu"`) que abre sheet com **Descartar treino** (`confirmar(..., 'Descartar', true)` → `sessaoAtual = null`, `pararDescanso()`, hash `#/hoje`).
- Um `<article class="card exercicio" data-i="<indice>">` por item, com:
  - Nome (`esc`), grupo (`GRUPOS`), " · cada lado" se `unilateral`, prescrição `"${series} × ${repMin}–${repMax} · ${formatarDescanso(descanso)}"`, botões `ⓘ` (`data-acao="dica"`) e `Trocar` (`data-acao="trocar"`). Se `trocadoDe`, mostrar "no lugar de <nome>".
  - "Última vez": `formatarKg(cargaAtual)` + " × " + reps separados por ", " + " · " + `formatarData` — ou "Primeira vez".
  - Selo (de `avaliar(historicoDoExercicio(estado.sessoes, exercicioId), exercicio)`):
    - `aumentar`: `<div class="selo-ok">↑ Pode aumentar → ${formatarKg(sug)} <button data-acao="aplicar" data-carga="${sug}">Aplicar</button></div>`
    - `reduzir`: `<div class="selo-warn">Sugestão: baixar para ${formatarKg(sug)} <button data-acao="aplicar" data-carga="${sug}">Aplicar</button></div>`
  - Linhas `.serie` (`data-s="<indice>"`): número, `<input class="carga" inputmode="decimal" value="${carga == null ? '' : formatarNumero(carga)}" aria-label="Carga série N">`, `<input class="reps" inputmode="numeric" ...>`, botão ✓ (`data-acao="feita"`, `aria-pressed`). Séries feitas com classe `feita`.
  - Botões `+ série` (`data-acao="mais"`) e `− série` (`data-acao="menos"`).
  - Cards com todas as séries feitas ficam recolhidos (mostram só nome + resumo "40 kg × 12, 12, 11 ✓"); tocar no cabeçalho do card alterna expandido. O primeiro card com série pendente fica expandido.
- Rodapé: **Finalizar treino** (`.btn-principal`, `data-acao="finalizar"`).

Eventos (delegação em `raiz`):
- `input` em `.carga` / `.reps`: **não re-renderizar** (Review Focus 4). Fazer `parseCarga`/`parseReps`; se `null` e o texto não for vazio → classe `invalido` e não salva; se válido → remove `invalido` e `atualizar(e => …, { renderizar: false })` gravando o valor. Texto vazio grava `carga = null` (reps vazio: não salva e marca `invalido`). Se o campo é a carga da **série 0** e a série 0 não está feita, copiar o valor para as séries seguintes não feitas **no estado e nos inputs do DOM** (`input.value = texto`).
- `feita`: chama `prepararAudio()`. Se a série não está feita: exige carga e reps válidas (se não, marca os campos `invalido` e `toast('Preencha carga e repetições')`); senão `feita = true`, re-render, e `iniciarDescanso(item.descanso)`. Se já está feita: `feita = false`, `pararDescanso()`, re-render.
- `aplicar`: grava `carga = Number(data-carga)` em todas as séries não feitas do item, re-render.
- `mais`: adiciona série copiando carga/reps da última; `menos`: remove a última série **não feita** (se não houver, `toast('Não há série pendente para remover')`).
- `dica`: `abrirSheet` com nome, equipamento e dica (`esc`).
- `trocar`: `import('./trocar.js').then(m => m.abrirTrocar(i))`.
- `finalizar`: se há séries não feitas → `confirmar('Ainda há séries não marcadas. Finalizar mesmo assim?', 'Finalizar')`. Se nenhuma série foi feita no treino inteiro → `confirmar('Nenhuma série foi marcada. Descartar este treino?', 'Descartar', true)` e descarta. Caso contrário:

```js
atualizar(e => {
  const s = e.sessaoAtual;
  s.fim = new Date().toISOString();
  delete s.descansoAte;
  s.itens = s.itens
    .map(it => ({ ...it, registros: it.registros.filter(r => r.feita) }))
    .filter(it => it.registros.length > 0);
  e.sessoes.push(s);
  e.ultimoTreinoId = s.treinoId;
  e.sessaoAtual = null;
}, { renderizar: false });
pararDescanso();
location.hash = `#/resumo/${idDaSessao}`;
```

(Ao filtrar só as feitas, `pararDescanso` deve rodar depois de `sessaoAtual = null` sem erro — `pararDescanso` já checa `sessaoAtual`.)

`renderResumo(sessaoId)`: busca a sessão em `estado.sessoes`; mostra "Treino concluído 🎉", nome do treino, duração (`fim - inicio`), total de séries, volume `Σ carga × reps` (`formatarNumero` + " kg"), lista por exercício ("Stiff — 40 kg × 12, 12, 11") e o bloco **"Na próxima, pode aumentar:"** com cada exercício da sessão cujo `avaliar(historicoDoExercicio(estado.sessoes, id), ex).status === 'aumentar'` → "Stiff: 40 kg → 42,5 kg". Se nenhum, "Continue firme — mesma carga na próxima." Botão **Voltar ao início** (`#/hoje`).

- [ ] **Step 6: Verificação manual (Chrome, 390×844)**

1. Hoje → Começar treino A. Primeira vez: campos de carga vazios, reps = repMax.
2. Digitar "40" na carga da série 1 de Elevação pélvica → séries 2–4 recebem 40; o teclado não fecha e o foco não sai do campo enquanto digita (Review Focus 4).
3. Digitar "42,5" → aceito; digitar "4a" → borda vermelha.
4. ✓ na série 1 → cronômetro 2:00 aparece; +15s/−15s funcionam; Pular some.
5. Recarregar a página (F5) no meio → mesma tela, valores e séries feitas preservados, cronômetro continua do ponto certo (Review Focus 1 e 3).
6. Marcar todas as séries de um exercício com 12 reps e 40 kg, finalizar → Resumo mostra "Elevação pélvica: 40 kg → 42,5 kg".
7. Começar treino A de novo (chip "Outro treino") → card mostra "↑ Pode aumentar → 42,5 kg"; Aplicar preenche 42,5 nas séries.
8. Sem erros no console.

- [ ] **Step 7: Commit**

```bash
git add js/cronometro.js js/telas/treino.js js/app.js tests/cronometro.test.js
git commit -m "feat: treino em andamento, cronômetro de descanso e resumo"
```

---

### Task 7: Trocar exercício e criar/editar exercício

**Files:**
- Modify: `js/telas/trocar.js` (substitui o stub)

**Interfaces:**
- Consumes: `obterEstado`, `atualizar`; `abrirSheet`, `fecharSheet`, `toast`; `GRUPOS`, `EQUIPAMENTOS`; `criarItemSessao` (de `./hoje.js`, Task 5); `gerarId`, `esc`, `parseNumero`
- Produces (`js/telas/trocar.js`):
  - `abrirTrocar(indiceItem: number): void`
  - `abrirFormExercicio(exercicioId: string|null, aoSalvar?: (id: string) => void): void` — `null` = criar novo; usado também pelas Tasks 8 e 9

- [ ] **Step 1: Implementar `abrirTrocar`**

Sheet com:
- Título "Trocar <nome atual>"; campo de busca (`input type="search"`, filtra por nome sem acento/caixa — normalizar com `s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()`).
- Seção "Mesmo grupo (<rótulo>)" com os exercícios do mesmo `grupo` (exceto o atual), depois "Todos" com o restante, em ordem alfabética (`localeCompare('pt-BR')`). Cada linha é um botão `data-id`.
- Botão "+ Criar exercício" → `abrirFormExercicio(null, id => escolher(id))`.
- Ao escolher um exercício → segunda etapa no mesmo sheet: duas opções grandes **"Só hoje"** e **"Sempre neste treino"**.
  - Só hoje: substitui o item `i` da `sessaoAtual` por `criarItemSessao(e, { exercicioId: novoId, series, repMin, repMax, descanso } /* prescrição do item atual */, trocadoDe)` onde `trocadoDe` = `item.trocadoDe ?? item.exercicioId`. Séries já feitas do item antigo são descartadas — se houver alguma feita, pedir `confirmar('As séries já feitas deste exercício serão descartadas. Trocar?', 'Trocar')` antes.
  - Sempre neste treino: faz o mesmo na sessão com `trocadoDe = null` e também troca `exercicioId` do item correspondente em `e.treinos.find(t => t.id === sessaoAtual.treinoId).itens` (mesmo índice, se o `exercicioId` lá ainda for o antigo; senão o primeiro item com o `exercicioId` antigo).
  - Fecha o sheet, re-render, `toast('Exercício trocado')`.

- [ ] **Step 2: Implementar `abrirFormExercicio`**

Formulário no sheet: nome (obrigatório, máx. 60), grupo (`select` de `GRUPOS`), tipo (composto/isolado), equipamento (`select` de `EQUIPAMENTOS`), unilateral (checkbox), incremento (kg, aceita vírgula, > 0, padrão 2,5; ao escolher equipamento "Halteres" sugerir 1 se o campo não foi editado), dica (`textarea`, opcional, máx. 400).
- Validação: nome vazio ou incremento inválido → mensagem no próprio form, não salva.
- Criar: `id = gerarId('c_')`, `personalizado: true`. Editar: mantém `id` e `personalizado`.
- Salvar com `atualizar`, fechar sheet, chamar `aoSalvar(id)`.

- [ ] **Step 3: Verificação manual (Chrome, 390×844)**

1. Com treino A em andamento, Trocar "Stiff" → lista mostra primeiro "Posterior de coxa" (Cadeira flexora, Mesa flexora, Terra romeno); busca "flex" filtra.
2. Escolher "Mesa flexora" → "Só hoje" → card mostra "Mesa flexora · no lugar de Stiff". Finalizar com uma série feita. Em Ajustes/treino A (ou recomeçando A) o Stiff continua lá (Review Focus 5).
3. Histórico de Mesa flexora tem a série; Stiff não ganhou registro novo.
4. Trocar com "Sempre neste treino" → recomeçar o treino mostra o novo exercício.
5. "+ Criar exercício" com nome `<b>teste</b>` → aparece escrito literalmente, sem negrito (escape).

- [ ] **Step 4: Commit**

```bash
git add js/telas/trocar.js
git commit -m "feat: trocar exercício e criar/editar exercício"
```

---

### Task 8: Exercícios — lista, detalhe e gráfico de evolução

**Files:**
- Modify: `js/grafico.js` (substitui o stub), `js/telas/exercicios.js` (substitui o stub)
- Test: `tests/grafico.test.js`

**Interfaces:**
- Consumes: `historicoDoExercicio`, `avaliar`, `melhorCargaPorSessao` (Task 3); `abrirFormExercicio` (Task 7); `confirmar`, `toast`; utilitários de formatação
- Produces:
  - `js/grafico.js`: `graficoLinha(pontos: {data: string, carga: number}[]): string` — SVG inline; com menos de 2 pontos retorna `<p class="muted">O gráfico aparece depois de 2 treinos com este exercício.</p>`
  - `js/telas/exercicios.js`: `render()`, `montar(raiz)`, `renderDetalhe(id)`, `montarDetalhe(raiz, id)`

- [ ] **Step 1: Teste que falha — `tests/grafico.test.js`**

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { graficoLinha } from '../js/grafico.js';

test('menos de 2 pontos → mensagem', () => {
  assert.match(graficoLinha([{ data: '2026-10-02T10:00:00Z', carga: 40 }]), /depois de 2 treinos/);
});

test('gera SVG com um ponto por sessão e rótulos pt-BR', () => {
  const svg = graficoLinha([
    { data: '2026-09-28T10:00:00Z', carga: 40 },
    { data: '2026-10-02T10:00:00Z', carga: 42.5 }
  ]);
  assert.match(svg, /^<svg[^>]*viewBox="0 0 320 180"/);
  assert.equal((svg.match(/<circle/g) || []).length, 2);
  assert.match(svg, /42,5/);
  assert.match(svg, /<polyline/);
});

test('cargas iguais não geram NaN', () => {
  const svg = graficoLinha([
    { data: '2026-09-28T10:00:00Z', carga: 40 },
    { data: '2026-10-02T10:00:00Z', carga: 40 }
  ]);
  assert.doesNotMatch(svg, /NaN/);
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `node --test tests/`
Expected: FAIL — `graficoLinha` não exportado

- [ ] **Step 3: Implementar `js/grafico.js`**

```js
// Gráfico de linha em SVG inline (sem bibliotecas), para a evolução de carga.
import { formatarNumero, formatarData, esc } from './util.js';

const L = 320, A = 180, M = { esq: 40, dir: 12, topo: 16, base: 28 };

export function graficoLinha(pontos) {
  if (pontos.length < 2) {
    return '<p class="muted">O gráfico aparece depois de 2 treinos com este exercício.</p>';
  }
  const cargas = pontos.map(p => p.carga);
  let min = Math.min(...cargas), max = Math.max(...cargas);
  if (min === max) { min -= 1; max += 1; } // evita divisão por zero
  const x = i => M.esq + (i * (L - M.esq - M.dir)) / (pontos.length - 1);
  const y = c => M.topo + ((max - c) * (A - M.topo - M.base)) / (max - min);
  const coords = pontos.map((p, i) => `${x(i).toFixed(1)},${y(p.carga).toFixed(1)}`).join(' ');
  const circulos = pontos.map((p, i) =>
    `<circle cx="${x(i).toFixed(1)}" cy="${y(p.carga).toFixed(1)}" r="5" fill="var(--accent)" tabindex="0">` +
    `<title>${esc(formatarData(p.data))}: ${formatarNumero(p.carga)} kg</title></circle>`).join('');
  return `<svg viewBox="0 0 ${L} ${A}" role="img" aria-label="Evolução da carga">` +
    `<line x1="${M.esq}" y1="${y(max)}" x2="${L - M.dir}" y2="${y(max)}" stroke="var(--surface-2)"/>` +
    `<line x1="${M.esq}" y1="${y(min)}" x2="${L - M.dir}" y2="${y(min)}" stroke="var(--surface-2)"/>` +
    `<text x="${M.esq - 6}" y="${y(max) + 4}" text-anchor="end" fill="var(--muted)" font-size="11">${formatarNumero(Math.max(...cargas))}</text>` +
    `<text x="${M.esq - 6}" y="${y(min) + 4}" text-anchor="end" fill="var(--muted)" font-size="11">${formatarNumero(Math.min(...cargas))}</text>` +
    `<text x="${M.esq}" y="${A - 8}" fill="var(--muted)" font-size="11">${esc(formatarData(pontos[0].data))}</text>` +
    `<text x="${L - M.dir}" y="${A - 8}" text-anchor="end" fill="var(--muted)" font-size="11">${esc(formatarData(pontos.at(-1).data))}</text>` +
    `<polyline points="${coords}" fill="none" stroke="var(--accent)" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/>` +
    circulos + '</svg>';
}
```

Ao tocar um ponto (no detalhe), mostrar a legenda abaixo do gráfico ("02/10: 42,5 kg") — implementar em `montarDetalhe` lendo o `<title>` do círculo tocado.

- [ ] **Step 4: Rodar e ver passar**

Run: `node --test tests/`
Expected: PASS

- [ ] **Step 5: Implementar `js/telas/exercicios.js`**

Lista (`render`): título "Exercícios", campo de busca (mesma normalização sem acento da Task 7), botão **+ Novo exercício** (`abrirFormExercicio(null, id => location.hash = '#/exercicio/' + id)`), e para cada grupo em ordem de `GRUPOS` que tenha exercícios: subtítulo + linhas `<a href="#/exercicio/<id>">` com nome, última carga (`formatarKg(avaliar(...).cargaAtual)` ou "—") e selo "↑" verde se `aumentar`. A busca filtra no DOM (esconde linhas/grupos), sem re-render.

Detalhe (`renderDetalhe(id)`; id inexistente → "Exercício não encontrado" + voltar):
- Voltar (`#/exercicios`), nome, grupo · equipamento · "cada lado", "Sobe de X kg em X kg".
- Card de status: selo como na tela de treino (sem botão Aplicar) ou "Primeira vez".
- Card "Evolução" com `graficoLinha(melhorCargaPorSessao(historico))` + legenda do ponto tocado.
- Card "Como fazer" com a dica (`esc`; texto com quebras de linha preservadas via CSS `white-space: pre-line`).
- Card "Últimas sessões": até 10 linhas `formatarData(data)` + séries "40×12 · 40×12 · 40×11" (`formatarNumero`).
- Botões **Editar** (`abrirFormExercicio(id, () => renderizar)`) e **Excluir** — habilitado só se `personalizado` **e** não usado em nenhum `treino.itens` **e** sem histórico; senão desabilitado com texto "Só dá para excluir exercícios criados por você que não estejam em treinos nem no histórico." Excluir → `confirmar(..., 'Excluir', true)` → remove de `exercicios` → `#/exercicios`.

- [ ] **Step 6: Verificação manual (Chrome, 390×844)**

1. Aba Exercícios: grupos na ordem Glúteo, Quadríceps, …; busca "rosca" mostra só as roscas.
2. Detalhe de um exercício com 2+ sessões (gerar no fluxo da Task 6) → gráfico com linha e pontos; tocar ponto mostra data/carga; sem rolagem horizontal em 360px.
3. Exercício padrão: botão Excluir desabilitado com explicação. Exercício criado e não usado: exclui.

- [ ] **Step 7: Commit**

```bash
git add js/grafico.js js/telas/exercicios.js tests/grafico.test.js
git commit -m "feat: biblioteca de exercícios e gráfico de evolução"
```

---

### Task 9: Histórico e Ajustes (treinos, backup, restaurar)

**Files:**
- Modify: `js/telas/historico.js`, `js/telas/ajustes.js` (substituem os stubs)

**Interfaces:**
- Consumes: `obterEstado`, `atualizar`, `substituirEstado`; `validarBackup`, `migrar`, `restaurarTreinosPadrao` (Task 4); `abrirFormExercicio` (Task 7); `confirmar`, `abrirSheet`, `toast`; utilitários
- Produces:
  - `js/telas/historico.js`: `render()`, `montar(raiz)`, `renderSessao(id)`, `montarSessao(raiz, id)`
  - `js/telas/ajustes.js`: `render()`, `montar(raiz)`, `renderEditarTreino(id)`, `montarEditarTreino(raiz, id)`

- [ ] **Step 1: Histórico**

Lista: sessões ordenadas por `fim` desc; cada linha `<a href="#/sessao/<id>">` com data (`formatarDataCompleta`), "Treino A — Inferiores — Glúteo" (se o treino não existir mais, só "Treino A"), duração e nº de séries. Vazio → "Nenhum treino registrado ainda."
Detalhe: cabeçalho com data, treino, duração, volume; por exercício: nome (se `trocadoDe`, "no lugar de …"; exercício excluído → "Exercício removido") e séries "40 kg × 12". Botão **Excluir sessão** → `confirmar('Excluir este treino do histórico?', 'Excluir', true)` → remove; se era a sessão mais recente, recalcular `ultimoTreinoId` a partir da nova mais recente (ou `null`) → `#/historico`.

- [ ] **Step 2: Ajustes**

Tela principal:
- **Meus treinos**: uma linha por treino (`#/ajustes/treino/<id>`) com letra, nome e nº de exercícios.
- **Backup**:
  - Exportar: `new Blob([JSON.stringify(estado, null, 2)], { type: 'application/json' })`, link temporário com `download = 'treino-backup-AAAA-MM-DD.json'` (data local), `URL.revokeObjectURL` depois; `toast('Backup salvo')`.
  - Importar: `<input type="file" accept="application/json,.json" hidden>`; ler com `file.text()`, `JSON.parse` em `try/catch` (erro → `toast('Arquivo inválido')`), `validarBackup` (erro → mostrar `erro`), `confirmar('Isso substitui todos os dados atuais pelos do backup. Continuar?', 'Substituir', true)` → `substituirEstado(migrar(obj))` → `toast('Backup restaurado')`.
- **Restaurar treinos padrão**: `confirmar(..., 'Restaurar', true)` → `substituirEstado(restaurarTreinosPadrao(estado))`.
- Rodapé: "Versão 1.0.0".

Editar treino (`renderEditarTreino(id)`; inexistente → mensagem + voltar):
- Campos nome e foco (salvam no `change`).
- Lista de itens: nome do exercício, inputs `séries`, `rep mín`, `rep máx`, `descanso (s)` (`inputmode="numeric"`, salvam no `change`, inválido → `invalido` e não salva; `repMax < repMin` → inválido), botões ↑ ↓ e ✕ (remover com `confirmar`).
- **+ Adicionar exercício**: sheet de escolha (mesma lista com busca da Task 7, pode reaproveitar uma função exportada de `trocar.js` se fizer sentido, ou duplicar a listagem simples) → adiciona item com prescrição padrão: composto `3 × 8–12 / 90`, isolado `3 × 10–15 / 60`.
- Se houver `sessaoAtual` desse treino, mostrar aviso: "Mudanças valem a partir do próximo treino."

- [ ] **Step 3: Verificação manual (Chrome, 390×844)**

1. Histórico lista as sessões feitas nas tarefas anteriores; detalhe abre; excluir funciona.
2. Ajustes → treino B: mudar séries de 3 para 4 na remada baixa, subir a elevação lateral → começar treino B reflete.
3. Exportar backup → arquivo baixado com JSON válido. Ajustes → Restaurar treinos padrão → B volta ao original. Importar o backup → B volta com a mudança.
4. Importar um `.json` qualquer (ex.: `package.json`) → mensagem de erro, dados intactos.

- [ ] **Step 4: Commit**

```bash
git add js/telas/historico.js js/telas/ajustes.js
git commit -m "feat: histórico e ajustes com backup"
```

---

### Task 10: README e revisão final do shell offline

**Files:**
- Create: `README.md`
- Modify: `sw.js` (conferir lista)

- [ ] **Step 1: Conferir `sw.js`**

Garantir que `ARQUIVOS` lista exatamente os arquivos existentes em `js/`, `js/telas/`, `css/`, `icons/` (comparar com `git ls-files`). Nenhum arquivo de `tests/`, `tools/`, `docs/`.

- [ ] **Step 2: `README.md`**

Conteúdo (em português):
- O que é (1 parágrafo).
- Rodar local: `npx --yes http-server -p 8080 -c-1 .` → `http://localhost:8080/`.
- Testes: `node --test tests/`.
- Ícones: `powershell -ExecutionPolicy Bypass -File tools/gerar-icones.ps1`.
- Publicar no GitHub Pages: criar repositório público, `git remote add origin …`, `git push -u origin main`, Settings → Pages → Branch `main` / root. Endereço `https://<usuario>.github.io/<repo>/`.
- Atualizar o app: alterar arquivos, **incrementar `CACHE` em `sw.js`**, commit e push; no celular, fechar e abrir o app duas vezes.
- Instalar no celular: Android/Chrome → menu → "Instalar app"; iPhone/Safari → Compartilhar → "Adicionar à Tela de Início".
- Dados: ficam só no aparelho; fazer backup em Ajustes de vez em quando.

- [ ] **Step 3: Verificação**

Run: `node --test tests/`
Expected: PASS (todos os arquivos de teste)

No Chrome: DevTools → Application → Service Workers → "Offline" marcado → recarregar → app abre e funciona.

- [ ] **Step 4: Commit**

```bash
git add README.md sw.js
git commit -m "docs: README com execução, testes e publicação"
```

---

## Validação final (não é do implementador)

Feita pelo modelo mais capaz após as tarefas: revisão do diff completo + e2e no Chrome real em viewport 390×844 cobrindo o roteiro do spec §11 e os 5 itens do Review Focus.
