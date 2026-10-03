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
  [/^#\/ajustes$/, ajustes, 'ajustes'],
  [/^#\/boas-vindas$/, boasVindas, 'hoje'],
  // "novo" vem antes da rota genérica: cria o treino e troca a rota pelo editor dele
  [/^#\/ajustes\/treino\/novo$/, { render: () => '', montar: () => ajustes.criarTreinoNovo() }, 'ajustes'],
  [/^#\/ajustes\/treino\/([^/]+)$/, { render: p => ajustes.renderEditarTreino(p), montar: (r, p) => ajustes.montarEditarTreino?.(r, p) }, 'ajustes']
];

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
      tela.montar?.(raiz, params);
    } catch (erro) {
      console.error(erro);
      raiz.innerHTML = `<div class="card"><p>Algo deu errado nesta tela.</p>
        <p><a href="#/hoje">Voltar ao início</a></p>
        <p><a href="#/ajustes">Ajustes (backup)</a></p></div>`;
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
