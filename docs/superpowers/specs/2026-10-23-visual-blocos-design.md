# Visual "Blocos" + app unissex (v2.0.0)

Data: 23/10/2026. Aprovado pelo Tiago a partir de um protótipo clicável.

## Por que

O Tiago achou o app "muito genérico" e quer um visual **bem mais moderno**. Além disso, o app
nasceu para a esposa dele e hoje fala só no feminino; ele quer que sirva **para qualquer pessoa**
(o grupo do ranking pode ter homens e mulheres).

## Referência visual (fonte da verdade)

O protótipo aprovado é a referência de cores, tamanhos, espaçamentos, movimentos e textos:

- arquivo local (fora do git): `.superpowers/provas/blocos/treino-blocos.html` + `fotos/`
  (abrir servindo a pasta, por exemplo `npx --yes http-server .superpowers/provas/blocos`,
  e acessar `treino-blocos.html#treino`, `#ranking` etc.);
- publicado: https://claude.ai/artifact/XhKLuCzQgWDiZDNmTngroa (versão 3).

Quando esta spec e o protótipo divergirem, vale a spec. Onde a spec não diz nada, copiar o
protótipo. O protótipo usa dados de exemplo; o app usa os dados reais do estado.

## Objetivos

1. **Visual Blocos em todas as telas** (inclusive sub-telas: registro de medidas, detalhe de
   medida, fotos do Corpo, detalhe de sessão, detalhe de cardio, editor de treino, aparelho,
   grupo, folhas/sheets e confirmações).
2. **Movimento** com a linguagem do protótipo (lista abaixo), sem atrapalhar o uso no treino.
3. **Vidro fosco** nos lugares definidos abaixo.
4. **Fotos reais de academia sem pessoas** no lugar das fotos atuais.
5. **Textos neutros**: nenhum texto visível no feminino (ou no masculino) quando se refere a quem usa.

## Não-objetivos

- Nada muda no formato dos dados salvos (localStorage/IndexedDB): **sem migração**, exceto a
  correção restrita das dicas (ver "Decidido pelo Tiago"). Backups antigos continuam importando.
- Nada muda no Supabase/ranking (schema, RPCs, regras de pontos).
- Sem tema escuro (o app continua só claro).
- Sem foto por exercício (o detalhe usa uma foto genérica).
- Segundo programa padrão: ver "Em aberto".

## Anti-objetivos (seria fracasso mesmo funcionando)

- Texto ilegível por causa de vidro ou foto (contraste abaixo de 4,5:1 em texto normal).
- Animação que atrase um toque, trave a rolagem ou deixe o treino mais lento de registrar.
- App deixar de funcionar offline (fontes e fotos fora do cache).
- Qualquer dado da pessoa se perder ou mudar de lugar.
- Visual com cara de "app feminino" (rosa, termos no feminino, fotos só de mulheres) ou de "app
  masculino": a meta é neutro.

## Restrições

- HTML, CSS e JavaScript puros, sem dependências novas e sem build (como hoje).
- PWA offline: tudo que a tela usa entra em `ARQUIVOS` do `sw.js`.
- Versão **2.0.0**: `VERSAO_APP` (js/util.js) e `CACHE` (sw.js, `treino-2.0.0`) juntos.
- Repo público: nenhum nome real no código, comentários ou testes.
- Os 190 testes de unidade continuam passando (`node --test "tests/*.test.js"`).
- Acessibilidade: alvo de toque ≥ 44px, foco visível, `aria-*` que já existem continuam,
  `prefers-reduced-motion` desliga os movimentos (o app fica completo, só sem animação).
- Desempenho: o app roda em Android intermediário. Usar só `transform` e `opacity` nas animações;
  `backdrop-filter` com `@supports` e fundo sólido de reserva (sem `@supports`, o "vidro" vira um
  fundo quase opaco da mesma cor).
- Publicar (push na `main`) só com ok do Tiago: o push atualiza o celular de todo o grupo.

## Identidade

- **Cores** (tokens do protótipo): fundo `#f3f2ee`; tinta `#1c1f23`; texto secundário `#646a71`;
  branco `#fff`; blocos `--sage #d9e3cf`, `--sky #d3e2ee`, `--sand #efe3cc`, `--clay #e9d3c6`;
  verde de "feito/ok" `#3f7a4a`; texto sobre sálvia `#4a5a40`. Cor de erro e de aviso: escolher
  dentro da paleta (vermelho tijolo e âmbar dessaturados), com contraste ≥ 4,5:1.
- **Fontes**: Unbounded (títulos e números grandes, 400–700) e Figtree (texto, 400–700).
  **Arquivos locais** em `vendor/fonts/` (woff2, subconjunto latin, com `OFL.txt`), no cache do SW.
  A Outfit sai.
- **Forma**: blocos com raio 24px sem sombra (a cor separa um do outro); botões em pílula; listas
  em linhas brancas de raio 18px; botões redondos de 42px para voltar/ações no cabeçalho.
- **Ícones**: os de linha do protótipo (SVG inline, traço 1,8). Emojis saem da interface
  (histórico, cardio, títulos), exceto dentro de texto livre que a pessoa digitou.
- **Ícone do app, `theme-color` e manifest**: refazer em grafite + blocos (por exemplo o "logo de
  4 quadradinhos" do protótipo). `theme-color` = `#f3f2ee`.
- **Cards de compartilhar** (`js/cards-canvas.js`, 1080×1350): trocar a paleta cinza/cobre pela
  Blocos, mesma fonte Unbounded/Figtree (carregadas antes de desenhar no canvas).

## Estrutura comum

- O cabeçalho em faixa (`marcarTopo()` em js/app.js, div `.topo` com degradê) **sai**.
  (Decisão de quem escreveu a spec: o menu inferior aparece **só nas 5 telas-raiz das abas**;
  todas as outras escondem o menu e têm botão voltar — ver "Menu inferior" abaixo.) Cada tela
  tem o cabeçalho do protótipo: título em Unbounded à esquerda e ações à direita, ou botão
  redondo de voltar + título nas sub-telas.
- **Menu inferior flutuante em vidro**, com os mesmos 5 itens e rotas de hoje (Hoje, Corpo,
  Exercícios, Histórico, Ajustes). O item ativo é uma pílula grafite que estica e mostra o nome;
  os outros mostram só o ícone (com `aria-label`). O menu aparece **só** em `#/hoje`, `#/corpo`,
  `#/exercicios`, `#/historico` e `#/ajustes`; em todas as outras rotas (boas-vindas, treino,
  resumo, ranking, cardio GPS/aparelho/detalhe, detalhes de sessão/exercício/medida, registro e
  fotos do Corpo, editor de treino) ele desliza para baixo e a tela tem botão voltar. Botões de
  salvar dessas telas ficam no fim do conteúdo (não fixos), como hoje.
- **Faixa de vidro no topo**: aparece quando a tela rola (atrás do relógio/bateria do celular,
  respeitando `env(safe-area-inset-top)`). Em telas com foto no topo, só depois que a foto sai de
  vista.
- **Transição entre telas**: a tela nova entra deslizando 34px (da direita ao avançar, da esquerda
  ao voltar) com fade; a antiga sai no sentido oposto. Troca entre abas do menu usa o sentido da
  posição no menu. O roteador por hash continua; a direção pode ser inferida (voltar = rota "pai"
  ou `history.back`). Escolha do construtor como implementar sem quebrar o `hashchange` atual.

## Movimento

Durações curtas (200–550ms), curva suave `cubic-bezier(.2,.8,.2,1)` e "mola"
`cubic-bezier(.3,1.35,.5,1)` para entradas de elementos flutuantes.

1. Ao abrir uma tela, os blocos entram de baixo (16px) com fade, um atrás do outro (50ms entre eles).
2. Números de destaque contam até o valor (800ms).
3. Anéis de progresso e gráficos se desenham; barras crescem a partir da base.
4. Toque em bloco/botão: leve encolhida (escala .97).
5. Menu: a pílula ativa estica para o novo item.
6. Série marcada: a etapa da série vira "carga × reps" com um "pop"; a próxima fica destacada;
   a barra de progresso do exercício avança; a pílula de descanso sobe com mola.
7. Exercício concluído: o cartão desliza para o lado e o próximo entra.
8. Ranking: ao trocar a métrica, as linhas trocam de posição deslizando (técnica FLIP) e as barras
   mudam de largura.
9. Resumo: check desenhado, números contando e confete curto nas cores dos blocos.
10. Fotos de destaque fazem um zoom lento ao entrar (1,12 → 1).

Regra: nenhuma animação bloqueia toque; um re-render no meio de uma animação não pode deixar
elemento invisível (o estado final é sempre o visível). Com `prefers-reduced-motion`, nada anima.

## Vidro fosco

Claro (branco ~52%, desfoque 22px, saturação 180%, borda branca fina, brilho interno no topo):
menu inferior, faixa do topo ao rolar, seletor de métricas do ranking (que gruda no topo),
botões redondos sobre foto, selo de GPS sobre o mapa.

Escuro (grafite ~70%, desfoque 20px): pílula de descanso, aviso (toast).

Folha que sobe de baixo (sheet/confirmação): bege claro ~74% com desfoque 28px; fundo atrás
escurece pouco (22%).

Treino do dia na Hoje: foto inteira, e nome/detalhes/botão dentro de um painel de vidro escuro
(~40%) por cima da foto.

## Fotos

Unsplash (licença livre), sem pessoas. Baixar em boa resolução, redimensionar para ~900px de
largura, JPEG progressivo ~70%, e listar autor + link em `img/CREDITOS.md` (o autor está na
página de cada foto).

| uso | id Unsplash |
|---|---|
| treino A (`img/treino-a.jpg`) | j4T5z94b8ns |
| treino B | gzeTjGu3b_k |
| treino C | 2e4lbLTqPIo |
| treino D | VJ2s0c20qCo |
| treino E | fqMu99l8sqo |
| boas-vindas (`img/boas-vindas.jpg`) | R_cN3dJLcK8 |
| resumo do treino (`img/resumo.jpg`) | 1RNQ11ZODJM |
| detalhe de exercício (`img/exercicio.jpg`) | m56-PAdMhM0 |

Treinos criados pela pessoa (letras F em diante) não têm foto: usam bloco de cor (rodízio entre
sálvia, céu, areia e argila) com a letra grande.

## Textos neutros

Trocar (e varrer todo texto visível atrás de outros casos):

- boas-vindas: "Bem-vinda ao Treino 💪" → "Boas-vindas ao Treino"; "Como quer ser chamada?" → "Seu
  nome (opcional)"; opção "Usar o programa padrão (5 treinos A–E, foco em glúteo)" → "Programa
  pronto · 5 treinos (A a E), um por dia" (o foco por treino aparece na lista de treinos).
- Corpo/perfil: placeholder "Como quer ser chamada?" → "Seu nome (opcional)".
- Grupo: "Compare seus pontos com os das amigas" → "Compare seus pontos com o pessoal do grupo".
- Medida "Busto" → "Peitoral" (só o rótulo; o campo salvo continua `busto`).
- Dicas do catálogo em `js/dados.js` no feminino ("Deitada no chão…", "Deitada, quadril colado…",
  "Sentada, segure um halter…", e conferir as demais) → neutras ("Deite no chão…", "Sente e
  segure…"). Atenção: o catálogo é copiado para o aparelho na primeira abertura; ver "Em aberto"
  sobre corrigir quem já usa.
- Comentários e nomes internos (`usuária`, `criadora`, `souCriadora`, `amigas`) → neutros
  (`quem usa`, `quem criou`, `souCriador`→`criouOGrupo` etc.). Não muda nenhum dado salvo.

## Telas

Seguem o protótipo; aqui só o que não é óbvio olhando para ele.

### Hoje
Decisões de quem escreveu a spec para esta tela:
- "~50 min" no treino do dia = média da duração das sessões anteriores daquele treino,
  arredondada a 5 min; sem sessão anterior, não mostra.
- Anel "treinos na semana": numerador = dias com treino na semana (seg–dom, como a semana de
  hoje); denominador = número de treinos cadastrados (o ciclo). Passou do denominador: anel cheio
  e mostra "6/5". Sem treinos cadastrados: o anel não aparece.

Blocos: treino do dia (foto + vidro, "Começar/Continuar treino"), anel "treinos na semana",
bloco de pontos (valor + posição no grupo + barrinhas por dia; toque abre o Ranking), "Minha
semana" (7 dias seg–dom, sequência de dias), bloco Cardio (Caminhar → GPS, Aparelho → registro
manual; com gravação em andamento vira "Caminhada em andamento · tempo · Continuar"), e o
carrossel "Outro treino" com as fotos dos demais treinos (toque inicia aquele treino, como os
chips de hoje).
- Sem grupo: o bloco de pontos mostra os pontos da semana e "Criar ou entrar em um grupo".
- O botão de compartilhar a semana continua (ícone no bloco "Minha semana").
- Sem treinos cadastrados: o bloco grande vira "Você ainda não tem treinos · Criar treino".
- O avatar do perfil (com foto, se houver) fica no canto do cabeçalho e leva ao Corpo.

### Treino em andamento (maior mudança de uso)
- Cabeçalho: voltar (vai para Hoje, o treino continua), "Treino X", cronômetro em pílula e menu ⋯
  (as opções que existem hoje, como descartar).
- Barra de progresso com **um segmento por exercício**, cada um preenchendo conforme as séries.
- **Cartão do exercício atual** (bloco céu): "Exercício N de M", grupo (+ "cada lado"),
  nome, prescrição, descanso e "última vez"; **etapas das séries** (feita = "carga × reps"
  em grafite; atual = contorno; próximas = apagadas); **controles + e −** de carga e repetições.
  Tocar no número abre o teclado para digitar (mesma validação de hoje: `parseCarga`,
  `parseReps`, campo inválido sinalizado em vermelho). O passo do + e − de carga é o
  `incremento` do exercício. Mudar a carga da série atual copia para as séries seguintes não
  feitas (regra de hoje para a série 1, agora valendo para a série atual).
- Botão grande "Série N feita" (marca e inicia o descanso). Tocar numa etapa já feita desfaz a
  marcação daquela série e a torna a atual (hoje se desmarca pelo ✓).
- Linha de ações pequenas: "Como fazer" (folha com a dica), "Trocar" (fluxo de troca de hoje),
  "+ série" e "− série".
- Bloco sálvia "Pode aumentar para X kg · Aplicar" (e o de "baixar") quando a progressão sugerir.
- Ao concluir todas as séries, o cartão desliza para o próximo exercício com série pendente.
  Abaixo, a **lista de todos os exercícios** (feito = resumo + ✓; atual = contorno; toque
  abre aquele exercício). No fim, "Finalizar treino" (mesmas confirmações de hoje).
- "Qual exercício está aberto" e o tempo total do descanso em curso (para o anel) ficam em
  `sessionStorage` (não no estado salvo), de modo que um re-render ou recarga volte ao mesmo
  exercício. Sem valor guardado, abre o primeiro com série pendente; o anel usa o descanso do
  exercício como total.
- **Descanso**: pílula flutuante de vidro escuro na base, com anel que esvazia, tempo, e botões
  −15s, +15s e Pular. Toda a lógica de `cronometro.js` continua (bipe, retomar após recarga,
  `visibilitychange`, fim). No fim mostra "Bora!" com um pulso e some.

### Resumo do treino
Foto no topo com check desenhado, "Treino concluído", nome do treino; blocos de minutos, séries e
volume (kg) contando; lista do que foi feito; bloco "Na próxima, pode aumentar" (já existe a
lógica); botões Compartilhar e Voltar ao início; confete.

### Cardio
- GPS: o mapa Leaflet continua (dentro de um bloco de raio 24px), selo de GPS em vidro, tempo
  grande, blocos de distância, ritmo e calorias, botões grandes Pausar/Retomar e Finalizar.
  Comportamento e textos de permissão/erro iguais aos de hoje. Trajeto em grafite com borda areia.
- Aparelho e detalhe de cardio: mesmos campos, no visual Blocos.

### Ranking
Bloco grafite com nome do grupo, período, posição grande ("2º lugar") e quanto falta para o
anterior. Seletor de métricas em vidro que gruda no topo, com as métricas que existem hoje
(Pontos, Treinos, Cardio, Km, Sequência) — se não couberem, rolam na horizontal; período
(semana etc.) como hoje. Linhas com posição, iniciais em círculo colorido, nome, barra
proporcional e valor; a sua linha com contorno. Estados de hoje (sem grupo, carregando, sem
conexão, sessão expirada) com o visual novo. Compartilhar continua.

Decisões de quem escreveu a spec:
- O bloco grafite mostra sempre a posição **em pontos** (a classificação oficial), qualquer que
  seja a métrica escolhida no seletor. O selo do canto diz quando zera: "zera na segunda" no
  período semana, "zera no dia 1º" no período mês.
- "Semanas anteriores" do protótipo **não** entra (era só enchimento do protótipo).
- O emoji que cada pessoa escolheu no grupo **continua**: aparece dentro do círculo colorido no
  lugar das iniciais (iniciais só se não houver emoji), e continua no seletor de Ajustes → Grupo,
  no "Você aparece como…" e no card de compartilhar. A regra "emojis saem da interface" não vale
  para o emoji escolhido pela pessoa.

### Corpo
Cabeçalho com "Registrar". Blocos: perfil (avatar, altura, idade, IMC), peso (valor, variação
em 30 dias, gráfico de linha com a meta tracejada), meta (quanto falta e barra), medidas mais
recentes em blocos pequenos (valor, mini-gráfico, variação; toque abre o detalhe da medida) e
"Comparar fotos". Mantém tudo que a aba faz hoje (inclusive "Compartilhar evolução").

### Exercícios
Busca (já existe) + **filtro por grupo muscular em pílulas** (novo; "Todos" + os grupos que
têm exercícios). Linhas com nome, grupo · equipamento, mini-gráfico da carga, carga atual e
um ponto verde quando "pode aumentar". "+ Novo" no cabeçalho.
- Detalhe: foto genérica no topo com voltar em vidro, nome, etiquetas (grupo, equipamento,
  composto/isolado, cada lado), bloco de sugestão, **evolução da carga em colunas** (melhor carga
  das últimas 8 sessões; a mais recente em grafite), "Como fazer", últimas sessões, Editar/Excluir.

### Histórico
- **Calendário do mês** (novo): grade seg–dom, dia com treino = círculo grafite, dia com cardio =
  ponto verde, hoje = contorno; setas para mês anterior/seguinte. Tocar num dia rola a lista até
  aquele dia (se tiver registro).
- Blocos de resumo do mês: treinos, cardios, horas.
- Lista do mês por data, com miniatura (foto do treino com a letra, ou ícone de cardio em bloco
  sálvia). Toque abre o detalhe, como hoje.

### Ajustes
Blocos: nome, "Meus treinos" (miniatura com a letra, nome, grupo · nº de exercícios, editor
como hoje), "+ Novo treino", Grupo (nome, código, copiar, sair), Backup (exportar/importar,
restaurar treinos padrão), versão do app e crédito das fotos.

### Boas-vindas
Foto no topo, logo de 4 quadradinhos + "Treino", texto de boas-vindas, campo de nome (opcional),
escolha do programa em dois blocos selecionáveis (radio acessível por baixo), "Começar".

## Testes

- Unidade: os 190 continuam; criar testes para a lógica nova que não é visual (dias do
  calendário do mês, filtro por grupo, cópia de carga para as séries seguintes, escolha do
  exercício atual).
- E2E (navegador real, ver tests/e2e/README.md): reescrever `visual.e2e.mjs` para o visual Blocos
  (fontes carregadas, menu em vidro, transições não deixam tela invisível, treino com + e −,
  série feita, descanso, troca de exercício, capturas 390×844 de todas as telas) e ajustar os
  seletores de `corpo.e2e.mjs`, `cardio.e2e.mjs` e `ranking.e2e.mjs`. O README e2e hoje aponta
  para o Edge no Windows; deixar o caminho do navegador configurável por variável de ambiente
  (`BROWSER_PATH`) para rodar também no Linux.
- Antes de dizer que está pronto: e2e completo no navegador real e conferência visual das capturas
  contra o protótipo; depois do push (com ok), rodar o e2e visual no endereço publicado.

## Deixado para quem implementar

- Como organizar o CSS (reescrever `css/app.css` do zero é aceitável) e os utilitários de
  animação (ex.: um `js/movimento.js` com entrada escalonada, contagem, desenho de traço, FLIP).
- Como inferir a direção da transição no roteador.
- Detalhes de layout das sub-telas não mostradas no protótipo, seguindo os mesmos blocos.
- Tons exatos de erro/aviso dentro da paleta.

## Decidido pelo Tiago (23/10)

- **Programa padrão**: fica só o A–E, com textos neutros (segundo programa, se vier, é outra versão).
- **Dicas no feminino já salvas**: corrigir também para quem já usa, com uma migração restrita
  em `js/armazenamento.js`: troca a `dica` só de exercícios do catálogo (`personalizado: false`)
  cujo texto seja **idêntico** ao antigo; dica editada pela pessoa não muda. Vale ao abrir o app
  e ao importar backup. Com testes de unidade (texto antigo troca, texto editado fica,
  exercício personalizado fica, backup antigo importado sai corrigido). É a única exceção ao
  "sem migração" dos não-objetivos.
- **Onde**: implementação e commits no PC de casa (Arch), num branch próprio
  (`feat/visual-blocos`). Antes do primeiro commit, acertar os fins de linha (o repo veio do
  Windows com CRLF) para o diff mostrar só mudanças reais.
