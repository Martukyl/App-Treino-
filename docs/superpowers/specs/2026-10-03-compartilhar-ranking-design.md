# Compartilhar (2A) e Ranking entre amigas (2B) — especificação

Data: 2026-10-03 · Status: aguardando revisão · App: v1.2.0 → v1.3.0 (2A) → v1.4.0 (2B)
Specs base: `2026-10-02-app-treino-design.md`, `2026-10-03-corpo-design.md`,
`2026-10-03-cardio-design.md` (padrões, tokens, IndexedDB, datas locais).

## 1. Objetivo

A usuária e um grupo de amigas fazem uma **competição saudável**. As amigas vão instalar
o mesmo app. Precisamos de:
- **2A (sem servidor):** cards em imagem para compartilhar no WhatsApp; tela de
  boas-vindas para quem instala pela primeira vez; criar treino novo do zero.
- **2B (Supabase):** grupo com código de convite e ranking compartilhado (semana/mês)
  calculado a partir de totais diários que cada app publica.

Privacidade (vale para tudo): **só totais diários** (treinos, minutos de cardio, km,
pontos) saem do aparelho, e só na 2B. Fotos, medidas, peso, trajetos GPS, nomes de
exercícios e cargas **nunca** são enviados. Cards são gerados no aparelho e só saem se
ela compartilhar.

## 2. Regras da competição (`js/pontos.js`, puro, testado — usado na 2A e na 2B)

- Dia = dia local `AAAA-MM-DD` do `fim` da sessão/cardio.
- `totaisDia(sessoes, cardios, dia)` → `{ treinos, cardioMin, km, pontos }`:
  - `treinos` = sessões de musculação finalizadas no dia (com ≥ 1 série feita).
  - `cardioMin` = soma de `duracaoSeg` dos cardios do dia ÷ 60, arredondado para baixo.
  - `km` = soma de `distanciaM` dos cardios do dia ÷ 1000, 2 casas.
  - `pontos` = `10 × min(treinos, 1)` + `min(floor(cardioMin / 5), 12)`.
- `totaisPeriodo(sessoes, cardios, inicio, fim)` → soma dos dias (inclusive).
- `inicioSemana(dia)` = segunda-feira daquela semana; `inicioMes(dia)` = dia 1.
- `sequencia(diasAtivos, hoje)` → dias seguidos com atividade (treinos > 0 ou
  cardioMin > 0) terminando hoje; se hoje ainda não tem atividade, terminando ontem.
- `diasDaSemana(sessoes, cardios, hoje)` → 7 itens seg..dom `{ dia, ativo }`.

## 3. Parte 2A — Compartilhar, boas-vindas, novo treino (v1.3.0)

### 3.1 Cards (`js/cards.js` — desenho em canvas; `js/compartilhar.js` — envio)

- Canvas **1080 × 1350**, fundo no gradiente/escuro do app (tokens do CSS lidos via
  `getComputedStyle` ou constantes equivalentes), cantos/caixas translúcidos, fonte do
  sistema (mesma pilha do CSS), textos grandes e legíveis numa miniatura de WhatsApp.
  Rodapé discreto: "Treino 💪" (sem nome real, sem URL).
- Tipos:
  1. **Treino concluído** — saudação com o nome (se houver), "Treino B — Costas e
     ombro", data, duração, séries feitas, volume (kg), nº de exercícios; faixa com a
     foto do treino (`img/treino-<id>.jpg`) se for A–E.
  2. **Caminhada/corrida** — trajeto desenhado como linha grossa no accent sobre o
     gradiente (projeção equiretangular com `cos(lat)`, ajustada à caixa com margem;
     início verde, fim vermelho; **sem tiles**), km, tempo, ritmo, kcal, subida.
     Aparelho: ícone grande do tipo + tempo, distância, kcal.
  3. **Semana** — "Minha semana", 7 bolinhas seg–dom (ativo = preenchida), treinos,
     minutos de cardio, km, pontos da semana, 🔥 sequência.
  4. **Evolução do Corpo** — peso atual e variação desde o início, até 6 medidas com
     variação (cores boa/ruim do Corpo). Opção **"Incluir fotos (antes × depois)"**
     desligada por padrão; ligada usa as fotos de frente do primeiro e do último registro
     com foto (recorte central). Aviso ao ligar: "As fotos vão aparecer na imagem."
- Pré-visualização em sheet (`<img>` do PNG gerado) com botões **Compartilhar** e
  **Fechar** (e o interruptor de fotos no card do Corpo).
- `compartilharImagem(blob, nomeArquivo, texto)`: se `navigator.canShare?.({ files })`,
  `navigator.share({ files: [File PNG], text })`; senão baixa o PNG
  (`treino-<tipo>-<AAAA-MM-DD>.png`) e toast "Imagem salva". `AbortError` (ela fechou o
  menu) não é erro.
- Onde aparecem os botões **Compartilhar**: resumo ao finalizar treino e detalhe de
  sessão no Histórico (card 1); detalhe do cardio (card 2); tela Hoje, card novo
  "Minha semana" com as bolinhas e o botão (card 3); tela Corpo, card Peso/Medidas
  (card 4).
- Imagens: carregar `img/treino-*.jpg` e fotos do IndexedDB antes de desenhar
  (aguardar `decode()`); falha de imagem → desenha sem ela.

### 3.2 Boas-vindas (primeira abertura)

- Estado ganha `boasVindasPendente: boolean`. `estadoInicial()` → `true`. `migrar` de um
  estado existente sem o campo → `false` (quem já usa não vê). Backup importado → `false`.
- Com `boasVindasPendente`, qualquer rota mostra a tela `#/boas-vindas` (sem barra de
  abas): título "Bem-vinda ao Treino 💪", campo nome, escolha **"Usar o programa padrão
  (5 treinos A–E, foco em glúteo)"** ou **"Começar sem treinos e montar os meus"**,
  texto curto sobre backup ("seus dados ficam só neste celular; exporte um backup em
  Ajustes"), botão **Começar**. Programa vazio → `treinos: []`. Ao concluir:
  `boasVindasPendente = false` → `#/hoje`.
- Hoje sem treinos: card com "Você ainda não tem treinos" + botão **Criar treino** →
  `#/ajustes/treino/novo`.

### 3.3 Novo treino (Ajustes)

- Botão **+ Novo treino** em "Meus treinos" e rota `#/ajustes/treino/novo`: cria treino
  com a próxima letra livre (A…Z), `nome: 'Novo treino'`, `foco: ''`, `itens: []` e
  abre o editor existente nele. Botão **Excluir treino** no editor (confirmação; sessões
  antigas continuam no histórico — já tratam treino removido).
- Verificar no editor existente que adicionar exercícios a um treino vazio funciona.

### 3.4 Testes 2A
- `tests/pontos.test.js`: totaisDia (treino sem série feita não conta; 2 treinos = 10
  pts; cardio 63 min = 12 pts; 4 min = 0), totaisPeriodo, inicioSemana (domingo →
  segunda anterior), sequencia (hoje sem atividade usa ontem; quebra), diasDaSemana.
- `tests/cards.test.js` (puro): projeção do trajeto cabe na caixa e preserva proporção;
  formatações dos textos dos cards (função que monta os textos separada do canvas).
- `tests/armazenamento.test.js`: boasVindasPendente (novo = true, migrado = false).
- E2E: cada card gera PNG 1080×1350 sem erro (checar `naturalWidth`), compartilhar cai
  no download no Edge desktop; boas-vindas com programa vazio → criar treino → adicionar
  exercício → começar; quem já tem dados não vê boas-vindas; e2e anteriores passam.

## 4. Parte 2B — Ranking (Supabase) (v1.4.0)

### 4.1 Supabase (feito pelo Tiago, guiado)
Conta gratuita → projeto (região São Paulo) → Authentication → Sign In / Providers →
**Allow anonymous sign-ins** ligado → SQL Editor → colar `supabase/schema.sql` → Run.
Copiar **Project URL** e **anon public key** para `js/config-ranking.js`
(`export const SUPABASE_URL = '…'; export const SUPABASE_ANON_KEY = '…';`). A chave
anon é pública por desenho (segurança vem do RLS); pode ir para o repo público.
Sem config preenchida → ranking mostra "Ranking ainda não configurado".

### 4.2 Banco (`supabase/schema.sql`, idempotente o quanto possível)

```sql
-- Tabelas
create table if not exists public.grupos (
  codigo text primary key check (codigo ~ '^[A-HJ-NP-Z2-9]{6}$'),
  nome text not null check (char_length(nome) between 1 and 40),
  criado_por uuid not null references auth.users on delete cascade,
  criado_em timestamptz not null default now()
);
create table if not exists public.membros (
  user_id uuid primary key references auth.users on delete cascade, -- 1 grupo por pessoa
  grupo text not null references public.grupos on delete cascade,
  apelido text not null check (char_length(apelido) between 1 and 20),
  emoji text not null default '💪' check (char_length(emoji) between 1 and 8),
  entrou_em timestamptz not null default now()
);
create table if not exists public.dias (
  user_id uuid not null references auth.users on delete cascade,
  data date not null,
  treinos smallint not null check (treinos between 0 and 20),
  cardio_min integer not null check (cardio_min between 0 and 1440),
  km numeric(6,2) not null check (km between 0 and 300),
  pontos integer not null check (pontos between 0 and 22),
  atualizado_em timestamptz not null default now(),
  primary key (user_id, data)
);
create index if not exists dias_data on public.dias (data);

-- Grupo de quem chama (security definer evita recursão de RLS)
create or replace function public.meu_grupo() returns text
language sql stable security definer set search_path = public as $$
  select grupo from public.membros where user_id = auth.uid()
$$;

alter table public.grupos enable row level security;
alter table public.membros enable row level security;
alter table public.dias enable row level security;

-- Sem acesso para quem não está logado
revoke all on public.grupos, public.membros, public.dias from anon;
revoke insert, update, delete on public.grupos from authenticated;
revoke insert, delete on public.membros from authenticated; -- entrar/sair só por RPC
revoke update on public.membros from authenticated;
grant update (apelido, emoji) on public.membros to authenticated;

create policy grupos_ver on public.grupos for select to authenticated
  using (codigo = public.meu_grupo());
create policy membros_ver on public.membros for select to authenticated
  using (grupo = public.meu_grupo());
create policy membros_editar on public.membros for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy dias_ver on public.dias for select to authenticated
  using (user_id = auth.uid() or user_id in
         (select user_id from public.membros where grupo = public.meu_grupo()));
create policy dias_inserir on public.dias for insert to authenticated
  with check (user_id = auth.uid() and data between current_date - 60 and current_date + 1);
create policy dias_atualizar on public.dias for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and data between current_date - 60 and current_date + 1);
```

RPCs (`security definer`, `set search_path = public`, `revoke execute … from anon,
public; grant execute … to authenticated`), cada uma validando entrada:
- `criar_grupo(p_nome text, p_apelido text, p_emoji text) returns text` — falha se quem
  chama já está em grupo; gera código de 6 chars do alfabeto sem ambíguos
  (`ABCDEFGHJKLMNPQRSTUVWXYZ23456789`) em loop até ser único; insere grupo e membro.
- `entrar_grupo(p_codigo text, p_apelido text, p_emoji text) returns text` (nome do
  grupo) — normaliza código (maiúsculas, sem espaços); falha "Código não encontrado";
  falha se já está em grupo; falha se o grupo tem ≥ 30 membros; insere membro.
- `sair_grupo() returns void` — apaga o próprio membro (os `dias` ficam, mas somem do
  ranking porque não há membro).
- `remover_membro(p_user uuid) returns void` — só o `criado_por` do grupo, só membros
  do mesmo grupo, não a si mesmo (limpar "fantasmas", §4.4).
Mensagens de erro em português via `raise exception '…'` (o app mostra o texto).

### 4.3 Cliente (`js/supabase.js`, REST puro com `fetch`, sem SDK)
- `entrarAnonimo()` → `POST {URL}/auth/v1/signup` com `{}` (headers `apikey`,
  `Content-Type`) → guarda `user.id` e `refresh_token`; access token só em memória.
- `token()` → access token válido; renova com
  `POST /auth/v1/token?grant_type=refresh_token` quando ausente/expirando (`expires_at`
  com 60 s de folga); guarda o refresh token novo (rotação). Uma renovação por vez
  (promessa compartilhada).
- `rpc(nome, args)`, `selecionar(tabela, query)`, `upsertDias(linhas)` (`POST
  /rest/v1/dias` com `Prefer: resolution=merge-duplicates`), todos com
  `Authorization: Bearer <token>` e `apikey`. Timeout 10 s (`AbortController`).
- Erros: rede → `{ offline: true }`; 401 após renovar → sessão inválida (§4.4).
- Estado ganha `ranking: { userId, refreshToken, grupo: {codigo, nome} | null, apelido,
  emoji, criador: boolean } | null`. Entra no backup (é dela).

### 4.4 Sessão perdida (limitação conhecida)
O Supabase gira o refresh token a cada renovação; um backup antigo pode ter um token já
inválido. Se a renovação falhar com token inválido: avisar "Sua sessão do ranking
expirou. Entre no grupo de novo com o código." e limpar `ranking.userId/refreshToken`
(mantém apelido/emoji e o código do grupo para pré-preencher). A conta antiga vira
"fantasma" no grupo; a criadora pode removê-la (§4.2 `remover_membro`) na tela do grupo.

### 4.5 Sincronização (`js/ranking.js`)
- `sincronizarRanking()`: se há grupo e sessão, calcula `totaisDia` dos **últimos 35
  dias** (inclui zeros — corrige exclusões) e faz um `upsert` único. Chamar: na abertura
  do app (após 2 s), depois de finalizar treino/cardio, salvar/excluir cardio ou sessão,
  importar backup, entrar no grupo. Debounce de 3 s; sem rede → silencioso (tenta na
  próxima chamada). Nunca bloqueia a interface.
- `carregarRanking(periodo)`: busca `membros` (do grupo) e `dias` de
  `min(inicioMes, hoje - 40)` até hoje; calcula no cliente pontos/treinos/cardio/km por
  membro no período e a 🔥 sequência; ordena; empate → mais treinos, depois apelido.
  Cache em memória por 60 s.

### 4.6 Telas
- **Ajustes → card "Grupo"**: sem grupo → **Criar grupo** (nome do grupo, apelido,
  emoji em grade de ~16 opções) e **Entrar com código** (código, apelido, emoji). Com
  grupo → nome e código grandes, **Convidar** (compartilha texto: "Entra no nosso grupo
  do Treino 💪: abra <URL do app> e use o código FJT7K2" — URL vem de `location.origin +
  location.pathname`), editar apelido/emoji, **Sair do grupo** (confirmação), lista de
  membros com **Remover** só para a criadora.
- **Hoje → card "Ranking da semana"** (só com grupo): pódio top 3 (emoji, apelido,
  pontos) + "sua posição: 4º · 32 pts" + link **Ver ranking** → `#/ranking`.
  Sem rede: últimos dados do cache da sessão ou "Sem conexão".
- **`#/ranking`** (aba ativa `hoje`): alternância **Semana · Mês**; abas **Pontos ·
  Treinos · Cardio (min) · Km · 🔥**; lista com posição, emoji, apelido, valor; a
  própria linha destacada; "atualizado há X min"; botão **Compartilhar** (card 5).
- **Card 5 (Ranking)**: "Ranking da semana — <grupo>", pódio grande + lista até 10
  (apelido/emoji/pontos). Só apelidos (nunca nomes reais do perfil).

### 4.7 Segurança — revisão obrigatória (Opus) antes do ar
Checar: nenhuma tabela legível/gravável sem login; quem não é do grupo não lê `dias`
nem `membros` de outros; ninguém grava `dias` de outro `user_id`; `membros` só altera
apelido/emoji próprios; RPCs não permitem entrar em 2 grupos, remover alguém de outro
grupo, nem burlar o limite de 30; códigos não enumeráveis (sem select amplo em
`grupos`); entradas validadas (tamanho, formato); `search_path` fixo nas funções.
Teste com 3 usuários anônimos via REST (script): A cria grupo, B entra, C fora — C não
vê nada; B não escreve dia de A; A remove B; etc.

### 4.8 Testes 2B
- Unit: `ranking.test.js` (agregação por período, ordenação/empate, sequência por
  membro a partir das linhas `dias`), `supabase.test.js` com `fetch` simulado (renovação
  de token única e concorrente, timeout → offline, 401 → sessão inválida).
- Integração real (após o projeto existir): script de segurança §4.7.
- E2E com Supabase real (2 contextos de navegador = 2 amigas): criar grupo, entrar com
  código, treinar/registrar cardio em uma, ver o ranking atualizar na outra; sair do
  grupo; remover fantasma.

## 5. Versões
2A: `VERSAO_APP = '1.3.0'` / `CACHE = 'treino-1.3.0'`. 2B: `1.4.0`. Arquivos novos no
`ARQUIVOS` do sw.js. **Chamadas ao Supabase nunca passam pelo cache do SW** (o fetch
handler deve ignorar outras origens — conferir o sw.js atual).
