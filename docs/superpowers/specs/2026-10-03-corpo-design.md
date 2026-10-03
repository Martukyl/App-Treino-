# Aba "Corpo": perfil, peso, medidas e fotos — especificação

Data: 2026-10-03 · Status: aprovada pelo Tiago em 03/10 · App: v1.0.2 → v1.1.0
Spec base do app: `2026-10-02-app-treino-design.md` (padrões, tokens de cor, restrições valem aqui).

## 1. Objetivo

Acompanhar a evolução corporal da usuária (ganho de massa) além das cargas:
perfil (altura, idade, meta de peso), registros de peso e medidas feitos "tudo junto,
de tempos em tempos", gráficos, comparação com registros anteriores e fotos de
evolução comparadas lado a lado em duas datas escolhidas por ela.

Critérios de sucesso:
- Registrar peso + medidas + até 3 fotos em menos de 2 minutos, preenchendo só o que mediu.
- Ver de relance: peso atual, quanto mudou, quanto falta para a meta, e se cada medida
  evoluiu na direção certa (verde) ou não.
- Fotos nunca saem do aparelho, exceto no arquivo de backup que ela mesma exporta.

Fora do escopo: % de gordura, sincronização, lembretes/notificações, gráficos combinados
de várias medidas.

## 2. Navegação

Barra inferior passa a ter 5 abas, nesta ordem: **Hoje · Corpo · Exercícios · Histórico ·
Ajustes**. Ícone da aba Corpo: 📏. Precisa caber em 360 px sem rolagem horizontal.

Rotas novas:
- `#/corpo` — tela principal
- `#/corpo/registro/novo` — formulário de novo registro
- `#/corpo/registro/<id>` — editar/excluir registro
- `#/corpo/medida/<campo>` — gráfico e histórico de uma medida (inclui `peso`)
- `#/corpo/fotos` — comparar fotos de duas datas

## 3. Modelo de dados

Estado (`localStorage["appTreino.v1"]`) ganha, com `versao: 2`:

```js
perfil: { altura: number|null /* cm */, nascimento: 'AAAA-MM-DD'|null, metaPeso: number|null /* kg */ },
medidas: [RegistroCorpo]   // ordem qualquer; telas ordenam por data
// `nome` continua na raiz do estado (já existe), mas passa a ser editado no perfil

RegistroCorpo = {
  id: 'm_…',
  data: 'AAAA-MM-DD',              // dia local, não ISO com hora
  peso, busto, ombros, bracoD, bracoE, cintura, abdomen, quadril, coxaD, coxaE, panturrilha,
                                   // number|null — kg para peso, cm para o resto, 1 casa decimal
  fotos: { frente: fotoId|null, lado: fotoId|null, costas: fotoId|null }
}
```

`migrar` (armazenamento.js): garante `perfil` com os três campos (null se ausentes) e
`medidas: []`; `VERSAO = 2`. Estados v1 continuam carregando. `validarBackup` aceita
v1 e v2; `medidas`, se presente, tem de ser array.

**Fotos** ficam em IndexedDB (banco `appTreino-fotos`, store `fotos`, chave = `fotoId`
`'f_…'`, valor = Blob JPEG). Não vão para o localStorage (limite ~5 MB).

## 4. Catálogo de campos (`js/corpo.js`, puro)

| campo | rótulo | unidade | grupo | direção boa |
|---|---|---|---|---|
| peso | Peso | kg | — | depende da meta (ver §5) |
| busto | Busto | cm | Superiores | subir |
| ombros | Ombros | cm | Superiores | subir |
| bracoD | Braço direito | cm | Superiores | subir |
| bracoE | Braço esquerdo | cm | Superiores | subir |
| cintura | Cintura | cm | Superiores | descer |
| abdomen | Abdômen | cm | Superiores | descer |
| quadril | Quadril | cm | Inferiores | subir |
| coxaD | Coxa direita | cm | Inferiores | subir |
| coxaE | Coxa esquerda | cm | Inferiores | subir |
| panturrilha | Panturrilha | cm | Inferiores | subir |

Exportar `CAMPOS_CORPO` (array na ordem acima, cada item `{ campo, rotulo, unidade, grupo, direcao }`).

## 5. Regras (`js/corpo.js`, funções puras, testadas)

- `idade(nascimento, hoje = new Date())` → anos completos, ou null.
- `imc(pesoKg, alturaCm)` → número com 1 casa, ou null se faltar dado. `faixaImc(imc)` →
  'Abaixo do peso' (<18,5) · 'Normal' (<25) · 'Sobrepeso' (<30) · 'Obesidade' (≥30).
- `ordenarPorData(medidas)` → cópia, mais antigo primeiro (comparar `data` como texto AAAA-MM-DD).
- `serieCampo(medidas, campo)` → `[{data, valor}]` só com valores não nulos, cronológico.
- `resumoCampo(medidas, campo)` → `{ atual, anterior, primeiro, difAnterior, difPrimeiro }`
  (null onde não houver; `anterior` = penúltimo valor não nulo daquele campo; diferenças
  arredondadas a 1 casa).
- `direcaoDiferenca(campo, dif, { pesoAtual, metaPeso })` → `'boa' | 'ruim' | 'neutra'`:
  dif 0 ou null → neutra; campos "subir": dif>0 boa, <0 ruim; "descer": o inverso;
  peso: se `metaPeso` e `pesoAtual` definidos, boa quando aproxima da meta (meta acima do
  peso atual → subir é bom; abaixo → descer é bom); sem meta → neutra.
- `faltaParaMeta(pesoAtual, metaPeso)` → número com sinal (meta − atual, 1 casa) ou null.

Datas `AAAA-MM-DD` são dias locais: **nunca** `new Date('AAAA-MM-DD')` (vira UTC e volta
um dia no Brasil). Usar `new Date(a, m-1, d)`. Adicionar em util.js
`formatarDia('AAAA-MM-DD')` → "02/10/2026" e `hojeISO()` → data local AAAA-MM-DD.

## 6. Telas

### 6.1 Corpo (`#/corpo`)
1. **Perfil** (card): nome (o campo sai de Ajustes e vem para cá, mesmo comportamento:
   salva a cada tecla sem re-render), altura (cm), data de nascimento (`input type=date`),
   meta de peso (kg). Abaixo, calculados: "34 anos · IMC 22,1 (Normal)" — omitir o que
   não puder ser calculado.
2. Botão principal **+ Registrar medidas** → `#/corpo/registro/novo`.
3. **Peso** (card, se houver ao menos um peso): peso atual grande, "desde o início: +2,3 kg",
   "faltam 1,5 kg para a meta" (ou "meta atingida 🎉" quando |falta| < 0,1), gráfico com a
   linha da meta; tocar no card → `#/corpo/medida/peso`.
4. **Medidas** (card): tabela por grupo (Superiores, Inferiores) só com campos que já têm
   algum valor: rótulo · atual · vs anterior · vs início. Diferenças com sinal ("+1,2"),
   coloridas por `direcaoDiferenca` (boa = `--ok`, ruim = `--warn`, neutra = `--muted`).
   Linha tocável → `#/corpo/medida/<campo>`.
5. **Fotos** (card, se houver ao menos 2 registros com foto): botão **Comparar fotos** →
   `#/corpo/fotos`.
6. **Registros** (card): lista por data desc ("02/10/2026 · 62,4 kg · 8 medidas · 📷 2"),
   tocar → `#/corpo/registro/<id>`.
Vazio (nenhum registro): texto curto explicando + botão de registrar.

### 6.2 Registro (novo / editar)
- Data (`input type=date`, padrão hoje; não permite data futura).
- Peso (kg) e as medidas em cm, agrupadas (Superiores, Inferiores), `inputmode="decimal"`,
  aceitam vírgula (usar `parseCarga` para número ≥0 com 1 casa); vazio = null.
  Placeholder de cada campo = último valor registrado daquele campo (ajuda a lembrar).
- Fotos: três slots (Frente, Lado, Costas). Cada um: `<input type="file" accept="image/*"
  capture="environment">` escondido + botão; mostra miniatura quando preenchido; botão
  remover. Ao escolher: comprimir (§7) e mostrar miniatura.
- Salvar: exige data e ao menos um valor (peso, medida ou foto); senão mensagem no form.
  Já existir registro na mesma data → pergunta "Já existe um registro em dd/mm. Salvar mesmo
  assim?" (permitido ter dois).
- Editar: mesmos campos preenchidos; botão **Excluir registro** (confirmação, `perigo`),
  que apaga também as fotos do IndexedDB.
- Fotos substituídas/removidas na edição são apagadas do IndexedDB ao salvar. Ao cancelar,
  fotos novas já gravadas e não usadas são apagadas.
- Após salvar → `#/corpo` + toast "Medidas salvas".

### 6.3 Medida (`#/corpo/medida/<campo>`)
Título (rótulo + unidade), valor atual, diferenças como no card, gráfico de evolução
(`graficoLinha` com unidade do campo; para peso, com a meta), lista de todos os valores
(data · valor). Campo inexistente → mensagem + voltar.

### 6.4 Comparar fotos (`#/corpo/fotos`)
- Dois seletores de data ("Antes" e "Depois"), só com registros que têm foto; padrão:
  primeiro e último.
- Seletor de posição: Frente · Lado · Costas (só as que existem nas duas datas ficam ativas).
- Duas imagens lado a lado (50% cada, proporção preservada), legenda com data e peso daquele
  registro. Tocar numa imagem abre em tela cheia (sheet) — fechar volta.
- Liberar `URL.revokeObjectURL` ao trocar de imagem/sair.

### 6.5 Tela Hoje: foto de perfil e imagem de academia (pedido de 03/10)
- **Foto de perfil:** campo no card Perfil (§6.1) para escolher/tirar foto (mesma
  compressão do §7, mas recortada em quadrado e ≤ 400 px), guardada no IndexedDB
  (`perfil.fotoId`). Na tela Hoje, avatar circular (56 px) ao lado da saudação; sem foto,
  círculo com a inicial do nome no gradiente do accent. Tocar no avatar → `#/corpo`.
  Entra no backup junto com as demais fotos.
- **Imagem que remeta a academia (decidido em 03/10: foto livre, específica por treino):**
  faixa no topo do card do treino sugerido na tela Hoje, uma foto por dia, combinando com
  o foco: `img/treino-a.jpg` (A, barra no rack), `-b` (B, remada com halter), `-c`
  (C, agachamento), `-d` (D, desenvolvimento com halteres), `-e` (E, levantamento terra).
  800×400 JPEG ~60 KB, Licença Unsplash, créditos em `img/CREDITOS.md`. Mostrar a de
  `treino-<id minúsculo>.jpg` só para ids A–E (treino com outro id = sem faixa). Altura
  ~130 px, `object-fit: cover`, cantos arredondados no topo do card, `alt=""` (decorativa),
  `loading="lazy"` não (está no topo). Também no card "Treino em andamento". Entram no
  `ARQUIVOS` do sw.js (offline). Sem CDN em runtime.

## 7. Fotos (`js/fotos.js`)

- `comprimirImagem(file)` → Blob JPEG: lado maior ≤ 1080 px, qualidade 0,75, orientação
  correta (usar `createImageBitmap(file, { imageOrientation: 'from-image' })` quando
  disponível; senão `<img>`), desenhar em canvas.
- `salvarFoto(blob)` → fotoId · `lerFoto(id)` → Blob|null · `apagarFoto(id)` ·
  `listarIds()` · `exportarFotos(ids)` → `{ id: dataURL }` · `importarFotos(mapa)` (grava,
  substituindo).
- Tudo com Promises sobre IndexedDB; falha de IndexedDB → toast "Não foi possível salvar a
  foto" e o registro continua sem ela.

## 8. Backup

- Exportar: o JSON passa a incluir `fotos: { id: dataURL }` com as fotos referenciadas em
  `medidas`. Texto em Ajustes avisa: "Inclui suas fotos (o arquivo fica maior)."
- Importar: após validar/confirmar, `importarFotos(obj.fotos || {})` e depois
  `substituirEstado(migrar(obj))` (sem o campo `fotos` dentro do estado). Fotos órfãs no
  IndexedDB que não estão no estado importado são apagadas.
- Backups antigos (v1, sem `medidas`/`fotos`) continuam importando.

## 9. Gráfico (`js/grafico.js`)

`graficoLinha(pontos, { unidade = 'kg', meta = null } = {})`:
- Pontos aceitam `{ data, valor }` (novo) ou `{ data, carga }` (atual) — `valor ?? carga`.
- Datas `AAAA-MM-DD` e ISO com hora devem formatar certo (dia local).
- `meta` (número): linha horizontal tracejada (`--ok`) com rótulo "meta"; o eixo Y inclui
  a meta no min/max.
- Título dos pontos com a unidade ("02/10: 62,4 kg" / "02/10: 58 cm").
- Chamadas existentes (exercícios) continuam funcionando sem mudança.

## 10. Testes

- `tests/corpo.test.js`: idade (antes/depois do aniversário, null), imc + faixas, ordenar,
  serieCampo (ignora null), resumoCampo (anterior do campo, não do registro; um só valor),
  direcaoDiferenca (subir, descer, peso com meta acima/abaixo, sem meta, zero),
  faltaParaMeta.
- `tests/armazenamento.test.js`: migrar v1→v2 cria perfil/medidas e mantém nome;
  validarBackup aceita v2 e rejeita `medidas` não-array.
- `tests/util.test.js`: formatarDia sem voltar um dia; hojeISO no formato certo.
- `tests/grafico.test.js`: `{data, valor}`, unidade cm no título, meta gera linha e entra
  no eixo; chamada antiga sem opções inalterada.
- E2E (controlador, Edge 390×844 e 360): perfil + IMC; registrar 2 vezes com fotos
  (arquivos de imagem de teste); tabela com cores; gráfico com meta; comparar fotos entre
  duas datas; editar e excluir (foto some do IndexedDB); backup exporta com fotos e
  reimporta; 5 abas sem rolagem horizontal; sem erros de console; todo o e2e anterior
  continua passando.

## 11. Versão

`VERSAO_APP = '1.1.0'` e `CACHE = 'treino-1.1.0'`; novos arquivos (`js/corpo.js`,
`js/fotos.js`, `js/telas/corpo.js`) entram no `ARQUIVOS` do sw.js.
