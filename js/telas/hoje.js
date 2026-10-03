// Tela Hoje: treino sugerido, treino em andamento e início de sessão.
import { esc, formatarData, gerarId } from '../util.js';
import { proximoTreino, avaliar, historicoDoExercicio } from '../progressao.js';
import { obterEstado, atualizar } from '../estado.js';
import { htmlAvatar, ligarAvatares } from './corpo-comum.js';
import { ICONE_CARDIO, ROTULO_CARDIO, formatarCronometro } from '../cardio.js';
import { tempoMs } from '../cardio-ao-vivo.js';
import { aoSairDaTela } from '../ui.js';

// "Boa noite, Roberta!" — o nome vem de Ajustes e fica só no aparelho
function saudacao() {
  const h = new Date().getHours();
  const parte = h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite';
  const nome = (obterEstado().nome || '').trim();
  return nome ? `${parte}, ${esc(nome)}` : parte;
}

// avatar (foto de perfil ou inicial) ao lado da saudação; toque leva ao perfil na aba Corpo
function cabecalho(est) {
  return `
    <header class="hoje-cab">
      <a class="avatar-link" href="#/corpo" aria-label="Meu perfil">${htmlAvatar(est)}</a>
      <h1 class="titulo">${saudacao()}!</h1>
    </header>`;
}

// faixa com a foto do treino (só treinos A–E); decorativa
function faixaFoto(id) {
  return /^[A-E]$/.test(id)
    ? `<div class="treino-foto"><img src="./img/treino-${id.toLowerCase()}.jpg" alt=""></div>` : '';
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
    ${cabecalho(est)}
    <section class="card card-destaque">
      ${faixaFoto(sa.treinoId)}
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
    ${cabecalho(est)}
    <section class="card card-destaque">
      ${faixaFoto(t.id)}
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

// Card Cardio: atalhos para gravar com GPS ou registrar aparelho; "em andamento" se há gravação.
function renderCardio(est) {
  const a = est.cardioAtual;
  if (a) {
    const rotulo = ROTULO_CARDIO[a.tipo] || 'Cardio';
    return `
    <section class="card card-cardio" data-cardio="andamento">
      <p class="muted">${ICONE_CARDIO[a.tipo] || ''} ${esc(rotulo)} ${a.pausado ? 'pausada' : 'em andamento'} · <span data-cardio-tempo>${formatarCronometro(tempoMs(a, Date.now()))}</span></p>
      <a class="btn btn-principal btn-bloco" data-acao="continuar-cardio" href="#/cardio/gps">Continuar</a>
    </section>`;
  }
  return `
    <section class="card card-cardio" data-cardio="atalhos">
      <h2 class="sec-card">Cardio</h2>
      <a class="btn btn-principal btn-bloco" data-acao="cardio-gps" href="#/cardio/gps">🚶 Caminhada / Corrida</a>
      <a class="btn btn-sec btn-bloco" data-acao="cardio-aparelho" href="#/cardio/aparelho/novo">Registrar aparelho</a>
    </section>`;
}

export function render() {
  const est = obterEstado();
  return (est.sessaoAtual ? renderEmAndamento(est) : renderSugerido(est)) + renderCardio(est);
}

export function montar(raiz) {
  ligarAvatares(raiz, obterEstado());
  // tempo da gravação em andamento atualiza a cada segundo (relógio de parede)
  const tempo = raiz.querySelector('[data-cardio-tempo]');
  if (tempo) {
    const tique = () => {
      const a = obterEstado().cardioAtual;
      if (a) tempo.textContent = formatarCronometro(tempoMs(a, Date.now()));
    };
    const timer = setInterval(tique, 1000);
    aoSairDaTela(() => clearInterval(timer));
  }
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
