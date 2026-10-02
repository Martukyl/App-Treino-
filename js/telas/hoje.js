// Tela Hoje: treino sugerido, treino em andamento e início de sessão.
import { esc, formatarData, gerarId } from '../util.js';
import { proximoTreino, avaliar, historicoDoExercicio } from '../progressao.js';
import { obterEstado, atualizar } from '../estado.js';

function saudacao() {
  const h = new Date().getHours();
  if (h < 12) return 'Bom dia';
  if (h < 18) return 'Boa tarde';
  return 'Boa noite';
}

// Data (dd/mm) do fim da sessão mais recente com aquele treino, ou null.
function ultimaVez(est, treinoId) {
  const fins = est.sessoes
    .filter(s => s.treinoId === treinoId && s.fim)
    .map(s => s.fim)
    .sort();
  return fins.length ? fins[fins.length - 1] : null;
}

function renderEmAndamento(est) {
  const sa = est.sessaoAtual;
  const treino = est.treinos.find(t => t.id === sa.treinoId);
  const nome = treino ? `Treino ${treino.id} — ${treino.nome}` : 'Treino';
  let total = 0;
  let feitas = 0;
  for (const item of sa.itens) {
    total += item.registros.length;
    feitas += item.registros.filter(r => r.feita).length;
  }
  return `
    <h1 class="titulo">${saudacao()}!</h1>
    <section class="card card-destaque">
      <p class="muted">Treino em andamento</p>
      <h2 class="treino-nome">${esc(nome)}</h2>
      <p class="muted">${feitas} de ${total} séries feitas</p>
      <a class="btn btn-principal btn-bloco" href="#/treino">Continuar</a>
    </section>`;
}

function renderSugerido(est) {
  const t = proximoTreino(est.treinos, est.ultimoTreinoId);
  if (!t) return '<p class="muted">Nenhum treino cadastrado. Restaure os treinos padrão em Ajustes.</p>';
  const itens = t.itens.map(it => {
    const ex = est.exercicios[it.exercicioId];
    const nome = ex ? ex.nome : it.exercicioId;
    return `<li><span>${esc(nome)}</span><span class="muted">${it.series} × ${it.repMin}–${it.repMax}</span></li>`;
  }).join('');
  const ultima = ultimaVez(est, t.id);
  const outros = est.treinos.filter(o => o.id !== t.id).map(o =>
    `<button type="button" class="chip" data-acao="comecar" data-treino="${esc(o.id)}"><strong>${esc(o.id)}</strong> ${esc(o.foco)}</button>`
  ).join('');
  return `
    <h1 class="titulo">${saudacao()}!</h1>
    <section class="card card-destaque">
      <div class="treino-topo">
        <span class="treino-letra">${esc(t.id)}</span>
        <div>
          <h2 class="treino-nome">${esc(t.nome)}</h2>
          <p class="muted">${esc(t.foco)}</p>
        </div>
      </div>
      <ul class="lista-ex">${itens}</ul>
      <p class="muted">Último: ${ultima ? formatarData(ultima) : 'Ainda não feito'}</p>
      <button type="button" class="btn btn-principal btn-bloco" data-acao="comecar" data-treino="${esc(t.id)}">Começar</button>
    </section>
    ${outros ? `<section class="card"><p class="muted">Outro treino</p><div class="chips">${outros}</div></section>` : ''}`;
}

export function render() {
  const est = obterEstado();
  return est.sessaoAtual ? renderEmAndamento(est) : renderSugerido(est);
}

export function montar(raiz) {
  raiz.querySelectorAll('[data-acao="comecar"]').forEach(el => {
    el.addEventListener('click', () => iniciarSessao(el.dataset.treino));
  });
}

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
