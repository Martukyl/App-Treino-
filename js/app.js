// Inicialização, roteador por hash e service worker.
import { definirRenderizador, avisoInicial, mostrarAviso, obterEstado } from './estado.js';
import * as hoje from './telas/hoje.js';
import * as treino from './telas/treino.js';
import * as exercicios from './telas/exercicios.js';
import * as historico from './telas/historico.js';
import * as ajustes from './telas/ajustes.js';
import * as corpo from './telas/corpo.js';
import * as corpoRegistro from './telas/corpo-registro.js';
import * as corpoFotos from './telas/corpo-fotos.js';
import * as cardioGps from './telas/cardio-gps.js';
import * as cardioAparelho from './telas/cardio-aparelho.js';
import * as cardioDetalhe from './telas/cardio-detalhe.js';
import * as boasVindas from './telas/boas-vindas.js';
import * as ranking from './telas/ranking.js';
import { sincronizarRanking } from './ranking.js';
import { liberarUrls } from './fotos.js';
import { sincronizar as sincronizarGravacao } from './gravacao.js';
import { retomarDescanso } from './cronometro.js';
import { fecharSheet, executarSaidas } from './ui.js';

// [padrão do hash, módulo da tela, aba ativa na nav]
const ROTAS = [
  [/^#\/hoje$/, hoje, 'hoje'],
  [/^#\/treino$/, treino, 'hoje'],
  [/^#\/resumo\/([^/]+)$/, { render: p => treino.renderResumo(p), montar: (r, p) => treino.montarResumo?.(r, p) }, 'hoje'],
  [/^#\/corpo$/, corpo, 'corpo'],
  [/^#\/corpo\/registro\/([^/]+)$/, corpoRegistro, 'corpo'],
  [/^#\/corpo\/medida\/([^/]+)$/, { render: p => corpo.renderMedida(p), montar: (r, p) => corpo.montarMedida?.(r, p) }, 'corpo'],
  [/^#\/corpo\/fotos$/, corpoFotos, 'corpo'],
  [/^#\/exercicios$/, exercicios, 'exercicios'],
  [/^#\/exercicio\/([^/]+)$/, { render: p => exercicios.renderDetalhe(p), montar: (r, p) => exercicios.montarDetalhe?.(r, p) }, 'exercicios'],
  [/^#\/historico$/, historico, 'historico'],
  [/^#\/sessao\/([^/]+)$/, { render: p => historico.renderSessao(p), montar: (r, p) => historico.montarSessao?.(r, p) }, 'historico'],
  [/^#\/cardio\/gps$/, cardioGps, 'hoje'],
  [/^#\/cardio\/aparelho\/([^/]+)$/, cardioAparelho, 'hoje'],
  [/^#\/cardio\/([^/]+)$/, cardioDetalhe, 'historico'],
  [/^#\/ranking$/, ranking, 'hoje'],
  [/^#\/ajustes$/, ajustes, 'ajustes'],
  [/^#\/boas-vindas$/, boasVindas, 'hoje'],
  // "novo" vem antes da rota genérica: cria o treino e troca a rota pelo editor dele
  [/^#\/ajustes\/treino\/novo$/, { render: () => '', montar: () => ajustes.criarTreinoNovo() }, 'ajustes'],
  [/^#\/ajustes\/treino\/([^/]+)$/, { render: p => ajustes.renderEditarTreino(p), montar: (r, p) => ajustes.montarEditarTreino?.(r, p) }, 'ajustes']
];

// Visual: os elementos de cabeçalho do começo da tela (voltar, título, cabeçalhos da Hoje e do
// treino) vão para um div.topo, no mesmo lugar (dentro do div.tela-* se houver), para ficarem
// sobre a faixa em degradê. Nada sai do pai: delegação de eventos e seletores continuam valendo.
const CABECALHO = '.voltar, .titulo, .hoje-cab, .treino-cab';
function marcarTopo(raiz) {
  const primeiro = raiz.firstElementChild;
  const pai = primeiro && primeiro.tagName === 'DIV' && [...primeiro.classList].some(c => c.startsWith('tela-'))
    ? primeiro : raiz;
  const itens = [];
  for (let n = pai.firstChild; n; n = n.nextSibling) {
    if (n.nodeType === Node.TEXT_NODE && !n.textContent.trim()) continue;
    if (n.nodeType === Node.ELEMENT_NODE && n.matches(CABECALHO)) { itens.push(n); continue; }
    break;
  }
  raiz.classList.toggle('sem-topo', itens.length === 0);
  if (!itens.length) return;
  const topo = document.createElement('div');
  topo.className = 'topo';
  pai.insertBefore(topo, itens[0]);
  topo.append(...itens);
}

function renderizarTela() {
  const hash = location.hash || '#/hoje';
  // primeira abertura: qualquer rota vira as boas-vindas (sem barra de abas); depois, ela não volta
  const pendente = !!obterEstado().boasVindasPendente;
  document.body.classList.toggle('boas-vindas', pendente);
  if (pendente !== (hash === '#/boas-vindas')) {
    location.replace(pendente ? '#/boas-vindas' : '#/hoje'); // dispara hashchange e redesenha
    return;
  }
  const raiz = document.getElementById('app');
  // a tela anterior sai: limpa fotos não salvas e revoga object URLs
  executarSaidas();
  liberarUrls();
  for (const [padrao, tela, aba] of ROTAS) {
    const m = hash.match(padrao);
    if (!m) continue;
    try {
      const params = m[1] ? decodeURIComponent(m[1]) : undefined;
      raiz.innerHTML = tela.render(params);
      marcarTopo(raiz);
      tela.montar?.(raiz, params);
    } catch (erro) {
      console.error(erro);
      raiz.innerHTML = `<h1 class="titulo">Algo deu errado nesta tela</h1><div class="card">
        <p><a href="#/hoje">Voltar ao início</a></p>
        <p><a href="#/ajustes">Ajustes (backup)</a></p></div>`;
      marcarTopo(raiz);
    }
    document.querySelectorAll('.nav a').forEach(a => a.classList.toggle('ativa', a.dataset.aba === aba));
    return;
  }
  location.hash = '#/hoje';
}

definirRenderizador(renderizarTela);
window.addEventListener('hashchange', () => { fecharSheet(); renderizarTela(); window.scrollTo(0, 0); });
renderizarTela();
retomarDescanso();
// gravação de cardio em andamento (recarga/reabertura): religa o GPS em qualquer rota
sincronizarGravacao();

if (avisoInicial() === 'corrompido') mostrarAviso('Os dados salvos estavam danificados. Comecei do zero; uma cópia foi guardada.');
if (avisoInicial() === 'indisponivel') mostrarAviso('Não estou conseguindo salvar neste navegador — faça backups.');

// ranking: publica os totais pouco depois de abrir (sem grupo/sem rede não faz nada)
setTimeout(() => sincronizarRanking({ imediato: true }), 2000);

try { navigator.storage?.persist?.(); } catch { /* opcional */ }
if ('serviceWorker' in navigator) {
  // Versão nova publicada: o SW novo assume o controle já na primeira abertura.
  // Fora do treino recarrega sozinho; durante o treino só avisa, para não atrapalhar.
  const jaTinhaVersao = !!navigator.serviceWorker.controller;
  let recarregando = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!jaTinhaVersao || recarregando) return; // primeira instalação: nada a atualizar
    const recarregar = () => { recarregando = true; location.reload(); };
    if ((location.hash || '').startsWith('#/treino')) {
      mostrarAviso('Nova versão disponível — toque aqui para atualizar.');
      document.getElementById('aviso').onclick = recarregar;
    } else {
      recarregar();
    }
  });
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}
