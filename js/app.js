// Inicialização, roteador por hash e service worker.
import { definirRenderizador, avisoInicial, mostrarAviso } from './estado.js';
import * as hoje from './telas/hoje.js';
import * as treino from './telas/treino.js';
import * as exercicios from './telas/exercicios.js';
import * as historico from './telas/historico.js';
import * as ajustes from './telas/ajustes.js';
import { retomarDescanso } from './cronometro.js';
import { fecharSheet } from './ui.js';

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
