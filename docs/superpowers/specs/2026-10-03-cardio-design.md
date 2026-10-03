# Cardio: caminhada/corrida com GPS e registro de aparelho — especificação

Data: 2026-10-03 · Status: aguardando revisão · App: v1.1.0 → v1.2.0
Specs base: `2026-10-02-app-treino-design.md` (padrões, tokens, restrições) e
`2026-10-03-corpo-design.md` (IndexedDB, backup com fotos, datas locais).

## 1. Objetivo

Registrar o cardio da usuária junto com a musculação:
- **Ao ar livre (GPS do celular, ao vivo):** caminhada ou corrida com tela de gravação
  mostrando cronômetro, mapa ao vivo, distância, velocidade, ritmo, calorias, altitude
  e subida acumulada.
- **Aparelho da academia (manual):** esteira, bicicleta, elíptico, escada, outro.

Contexto de uso: ela caminha com o celular **na mão** (tela ligada é aceitável).
Ela tem um Amazfit GTS 4 mini, mas integração com relógio está **fora** desta etapa.

Critérios de sucesso:
- Iniciar uma caminhada em ≤ 2 toques a partir da tela Hoje.
- Uma caminhada de 1 h não perde dados se o app fechar/recarregar no meio.
- Distância com erro aceitável para uso pessoal (filtros do §5), sem "saltos" de GPS.
- Musculação e cardio aparecem juntos no Histórico.

Fora do escopo: relógio/arquivos GPX, frequência cardíaca ao vivo, pausa automática,
metas de cardio, compartilhamento (etapa 2), mapas offline, gravação com a tela apagada
(limitação de PWA: o navegador suspende o GPS em segundo plano).

## 2. Navegação e rotas

Barra inferior inalterada (5 abas). Na tela **Hoje**, abaixo do card do treino
sugerido (e do "Outro treino"), um card **Cardio** com dois botões:
**🚶 Caminhada / Corrida** → `#/cardio/gps` e **Registrar aparelho** → `#/cardio/aparelho/novo`.
Se houver gravação em andamento, o card mostra "Caminhada em andamento · 23:41"
e um botão **Continuar** → `#/cardio/gps`.

Rotas novas (aba ativa: `hoje` nas de gravação/registro, `historico` no detalhe):
- `#/cardio/gps` — preparar / gravar / (ao finalizar redireciona ao detalhe)
- `#/cardio/aparelho/novo` e `#/cardio/aparelho/<id>` — formulário manual (novo/editar)
- `#/cardio/<id>` — detalhe de um cardio (GPS ou aparelho)

## 3. Modelo de dados

Estado (`localStorage["appTreino.v1"]`) ganha, com `versao: 3`:

```js
cardios: [Cardio],        // concluídos; ordem qualquer
cardioAtual: CardioAtual | null,  // gravação GPS em andamento
// perfil.peso NÃO é criado: peso vem do Corpo (§5.4)

Cardio = {
  id: 'c_…',
  modo: 'gps' | 'aparelho',
  tipo: 'caminhada' | 'corrida'                       // modo gps
      | 'esteira' | 'bicicleta' | 'eliptico' | 'escada' | 'outro',  // modo aparelho
  inicio: ISO, fim: ISO,          // aparelho: inicio = data escolhida 12:00 local; fim = inicio + duração
  duracaoSeg: number,             // tempo em movimento (exclui pausas)
  distanciaM: number|null,
  kcal: number|null,              // inteiro
  kcalEstimada: boolean,          // true quando calculada pelo app
  subidaM: number|null,           // gps
  altMin: number|null, altMax: number|null,   // gps
  fcMedia: number|null,           // aparelho (opcional)
  obs: string,                    // aparelho (opcional, ≤ 200)
  trajetoId: 't_…' | null         // gps: chave no IndexedDB
}

CardioAtual = {
  id: 'c_…', tipo: 'caminhada'|'corrida', trajetoId: 't_…',
  inicio: ISO,
  pausado: boolean,
  acumuladoMs: number,            // tempo em movimento já contabilizado
  retomadoEm: number|null,        // epoch ms do último "rodando desde"
  distanciaM, subidaM, altMin, altMax,   // totais correntes
  ultimo: { lat, lon, alt, t } | null    // último ponto aceito (para continuar)
}
```

Tempo em movimento = `acumuladoMs + (pausado ? 0 : Date.now() - retomadoEm)` — baseado
em relógio de parede (sobrevive a tela apagada/recarga, como o descanso).

`migrar`: garante `cardios: []` e `cardioAtual: null`; `VERSAO = 3`; v1/v2 carregam.
`validarBackup` aceita v1–v3; `cardios`, se presente, tem de ser array.

**Trajetos** no IndexedDB: mesmo banco `appTreino-fotos`, versão **2**, nova store
`trajetos` (chave `trajetoId`, valor `{ segmentos: [[ [lat, lon, alt|null, tMs], … ], …] }`).
`onupgradeneeded` cria cada store só se não existir (preserva `fotos`). Novo segmento
começa ao retomar de pausa e após lacuna > 30 s.
Durante a gravação, pontos aceitos vão para um buffer e são gravados no IndexedDB a
cada 5 pontos, ao pausar, ao `visibilitychange` oculto e ao finalizar — no máximo ~5
pontos se perdem num fechamento abrupto. Os totais correntes vão para `cardioAtual`
(localStorage) a cada ponto aceito.

## 4. Telas

### 4.1 Preparar (`#/cardio/gps`, sem `cardioAtual`)
- Escolha Caminhada · Corrida (chips; padrão: última usada, senão Caminhada).
- Ao abrir: pede permissão (`watchPosition` com `enableHighAccuracy: true`) e mostra
  estado do sinal: "Procurando GPS…" → "GPS ok (±8 m)" quando `accuracy ≤ 30`.
- **Iniciar** habilitado só com GPS ok; botão secundário "Iniciar mesmo assim" após 20 s.
- Permissão negada / sem suporte → mensagem explicando como liberar a localização no
  Chrome + botão para registrar como aparelho/manual.
- Sem peso no Corpo: campo "Seu peso (kg)" nesta tela, obrigatório para iniciar; ao
  iniciar cria um registro no Corpo (`medidas`) só com o peso e a data de hoje.

### 4.2 Gravando (`#/cardio/gps`, com `cardioAtual`)
Layout de cima para baixo (celular na mão, leitura rápida):
1. **Cronômetro** grande `mm:ss` (ou `h:mm:ss`), atualiza 1×/s.
2. **Mapa** (~45% da altura): trajeto (linha `--accent`), ponto atual, segue a posição;
   se ela arrastar o mapa, para de seguir e aparece botão "📍 centralizar".
3. Grade 2×3: **Distância** (km, 2 casas) · **Velocidade** (km/h, média móvel dos
   últimos ~30 s) · **Ritmo** (min/km, mesmo intervalo; "—" parado) · **Calorias**
   (kcal) · **Altitude** (m; "—" se o aparelho não informa) · **Subida** (m).
4. **Pausar/Retomar** e **Finalizar** (confirmação "Finalizar caminhada?").
- Wake Lock (`navigator.wakeLock.request('screen')`), re-solicitado ao voltar à tela;
  se não suportado, aviso discreto "mantenha a tela ligada".
- Ao voltar de segundo plano após > 30 s sem ponto: toast "O GPS ficou parado por X min".
- Indicador de sinal fraco quando o último ponto tem `accuracy > 30` ou > 15 s sem ponto.
- Sair da tela (outra aba) NÃO para a gravação; o card da Hoje mostra "em andamento".
- Abrir o app com `cardioAtual` (após recarga): a rota `#/cardio/gps` retoma
  (re-liga o GPS, redesenha o trajeto lido do IndexedDB).
- Finalizar com < 50 m e < 1 min → pergunta "Descartar esta gravação?" (descarta e apaga o trajeto).
- Finalizar: grava o buffer, cria o `Cardio` em `cardios`, limpa `cardioAtual`,
  vai para `#/cardio/<id>` com toast "Caminhada salva".

### 4.3 Aparelho (`#/cardio/aparelho/novo` | `/<id>`)
Campos: tipo (chips Esteira · Bicicleta · Elíptico · Escada · Outro), data (padrão hoje,
sem futuro), duração (min, obrigatório, 1–600), distância (km, opcional), calorias
(opcional; vazio → estimada §5.4 e `kcalEstimada: true`), FC média (bpm, opcional,
40–220), observação. Números com vírgula (`parseCarga`). Editar: mesmos campos +
**Excluir** (confirmação). Salvar → `#/historico` + toast.

### 4.4 Detalhe (`#/cardio/<id>`)
Título "Caminhada · 03/10/2026 07:12" (ou tipo do aparelho). GPS: mapa estático do
trajeto (Leaflet, `fitBounds`, início verde e fim vermelho), números (tempo, distância,
ritmo médio, velocidade média, kcal, subida, alt. mín/máx) e **parciais por km**
(km 1: 11:42, km 2: 11:05…). Aparelho: números e observação, botão Editar.
**Excluir** (confirmação; apaga o trajeto do IndexedDB). Trajeto ausente → "Trajeto
indisponível" sem quebrar a tela.

### 4.5 Histórico
Lista única por data desc, misturando `sessoes` e `cardios`: musculação "🏋️ Treino B —
…" (como hoje) e cardio "🚶 Caminhada · 3,42 km · 41:20" / "🚴 Bicicleta · 30 min".
Ícones: caminhada 🚶, corrida 🏃, esteira 🏃, bicicleta 🚴, elíptico/escada/outro ❤️.

## 5. Regras (`js/geo.js` e `js/cardio.js`, funções puras, testadas)

### 5.1 Geo (`js/geo.js`)
- `distanciaM(a, b)` — haversine, raio 6 371 000 m.
- `aceitarPonto(ultimo, novo, tipo)` → `{ aceito, motivo }`: rejeita `accuracy > 30`;
  rejeita se velocidade implícita > limite (caminhada 12 km/h, corrida 25 km/h);
  ignora (não aceita) deslocamento < 3 m desde o último aceito (parado/ruído), mas
  atualiza altitude corrente. Primeiro ponto com accuracy ok é sempre aceito.
- Lacuna > 30 s: o salto entra na distância só se a velocidade implícita estiver dentro
  do limite; senão inicia segmento novo sem somar distância.
- `ganhoSubida(altAnterior, altNova, acumulado)` com histerese de 3 m (só conta
  subidas confirmadas acima de 3 m em relação ao último ponto de referência).
- `velocidadeRecente(pontos, agoraMs, janelaS = 30)` → km/h ou null.
- `parciaisKm(segmentos)` → `[{ km: 1, seg: 702 }, …]` (km completos; tempo em movimento).

### 5.2 Formatação (`js/cardio.js`)
`formatarRitmo(segPorKm)` → "11:42 /km" (null → "—"); `formatarKm(m)` → "3,42 km";
`formatarCronometro(ms)` → "07:05" / "1:02:09"; `ICONE_CARDIO`, `ROTULO_CARDIO`.

### 5.3 Itens do histórico
`itensHistorico(sessoes, cardios)` → lista única `{ tipo: 'treino'|'cardio', data, ref }`
ordenada por data desc (treino usa `fim`, cardio usa `fim`).

### 5.4 Calorias
`kcal = MET × pesoKg × horas` (arredondado), com MET do Compêndio de Atividades Físicas:
- Caminhada por velocidade média (km/h): < 3,2 → 2,0 · < 4,0 → 2,8 · < 4,8 → 3,0 ·
  < 5,6 → 3,5 · < 6,4 → 4,3 · < 7,2 → 5,0 · ≥ 7,2 → 7,0.
- Corrida: < 8 → 6,0 · < 9,7 → 8,3 · < 11,3 → 9,8 · ≥ 11,3 → 11,0.
- Aparelho (moderado): esteira 5,0 (se tiver distância, usar a tabela de caminhada/
  corrida pela velocidade média: ≥ 7,2 km/h = corrida) · bicicleta 6,8 · elíptico 5,0 ·
  escada 9,0 · outro 5,0.
- Ao vivo: soma incremental por intervalo entre pontos (MET pela velocidade daquele
  trecho); parado (pausado) não soma.
- `pesoAtual(estado)` = último peso do Corpo (`ultimoValor(medidas, 'peso')`) ou null.
Exibir sempre "kcal (estimativa)" quando `kcalEstimada`.

## 6. Mapa (Leaflet)

- Leaflet **1.9.4** copiado para `vendor/leaflet/` (`leaflet.js`, `leaflet.css`; sem
  imagens de marcador — usar `L.circleMarker`). Licença BSD-2 (manter o cabeçalho).
- Carregar **sob demanda** (só nas telas de cardio GPS/detalhe), via `<script>` injetado
  uma vez — não pesa a abertura do app. Ambos no `ARQUIVOS` do sw.js (offline).
- Tiles: `https://tile.openstreetmap.org/{z}/{x}/{y}.png`, `maxZoom 19`, atribuição
  "© OpenStreetMap" visível (exigência da licença). Tiles NÃO entram no cache do SW.
  Sem internet: fundo `--surface` liso e o trajeto continua desenhado.
- Mapa ao vivo: zoom 17 inicial; detalhe: `fitBounds` com padding.
- Destruir o mapa (`map.remove()`) ao sair da tela (usar `aoSairDaTela` do ui.js).

## 7. Backup

- Exportar inclui `trajetos: { trajetoId: {segmentos} }` dos cardios concluídos e do
  `cardioAtual` (se houver), além das fotos (§8 da spec Corpo).
- Importar: grava `trajetos` (substituindo), depois o estado; apaga trajetos órfãs.
- Backups v1/v2 continuam importando.

## 8. Arquivos

Novos: `js/geo.js`, `js/cardio.js`, `js/trajetos.js` (IndexedDB da store `trajetos`;
pode compartilhar a abertura do banco com `fotos.js` extraindo `js/banco.js`),
`js/mapa.js` (carregar Leaflet, criar mapa ao vivo/estático), `js/gps.js` (wrapper de
`watchPosition` + wake lock + visibilidade, sem regras), `js/telas/cardio-gps.js`,
`js/telas/cardio-aparelho.js`, `js/telas/cardio-detalhe.js`, `vendor/leaflet/*`.
Alterados: `armazenamento.js` (v3), `app.js` (rotas), `telas/hoje.js` (card Cardio),
`telas/historico.js` (lista mista), `telas/ajustes.js` (backup), `css/app.css`, `sw.js`.

## 9. Testes

- `tests/geo.test.js`: distância conhecida (ex.: 1 grau de latitude ≈ 111,2 km; 2 pontos
  a ~100 m), aceitarPonto (accuracy ruim, salto impossível, parado < 3 m, primeiro ponto,
  limites caminhada × corrida), lacuna > 30 s, ganhoSubida (ruído ±2 m não soma, subida
  de 10 m soma ~10), velocidadeRecente, parciaisKm.
- `tests/cardio.test.js`: MET/kcal por faixa (caminhada, corrida, aparelhos, esteira com
  distância), formatações, itensHistorico (ordem mista).
- `tests/armazenamento.test.js`: migrar v2→v3, validarBackup com `cardios` inválido.
- E2E (controlador; Edge 390×844 e 360; geolocalização emulada via
  `context.setGeolocation` + permissão concedida; tiles podem falhar offline sem erro de
  console relevante — bloquear `tile.openstreetmap.org` no teste):
  iniciar caminhada, simular ~600 m em pontos a cada 5 s (com 1 ponto ruim e 1 salto que
  devem ser ignorados), pausar/retomar, recarregar a página no meio e continuar,
  finalizar → detalhe com distância esperada (±5%) e parciais; Histórico misto; registro
  de aparelho com kcal estimada e editar/excluir; backup exporta/importa com trajeto;
  card da Hoje "em andamento"; sem rolagem horizontal; sem erros de console; e2e anterior
  (Corpo + treino) continua passando.

## 10. Versão

`VERSAO_APP = '1.2.0'` e `CACHE = 'treino-1.2.0'`; todos os arquivos novos no `ARQUIVOS`.
