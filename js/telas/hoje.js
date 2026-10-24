// Tela Hoje (visual Blocos): treino do dia, semana, pontos do grupo, cardio e outros treinos.
import { esc, formatarData, gerarId, hojeISO } from '../util.js';
import { proximoTreino, avaliar, historicoDoExercicio } from '../progressao.js';
import { obterEstado, atualizar } from '../estado.js';
import { htmlAvatar, ligarAvatares } from './corpo-comum.js';
import { ROTULO_CARDIO, formatarCronometro } from '../cardio.js';
import { tempoMs } from '../cardio-ao-vivo.js';
import { aoSairDaTela, toast } from '../ui.js';
import { compartilharCard } from '../compartilhar.js';
import { dadosCardSemana } from '../cards.js';
import { renderCardRankingHoje, montarCardRankingHoje } from './ranking.js';
import { fotoDoTreino, corDoTreino } from '../dados.js';
import { progressoSemana, estimativaMin } from '../semana.js';
import { totaisDia } from '../pontos.js';
import { ic } from '../icones.js';

// "Boa noite, <nome>" — o nome vem de Ajustes e fica só no aparelho
function saudacao() {
  const h = new Date().getHours();
  const parte = h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite';
  const nome = (obterEstado().nome || '').trim();
  return nome ? `${parte}, ${esc(nome)}` : parte;
}

// "Quarta, 7 de outubro"
function dataDeHoje() {
  const txt = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' }).replace('-feira', '');
  return txt.charAt(0).toUpperCase() + txt.slice(1);
}

function cabecalho(est) {
  return `
    <header class="cab-tela hoje-cab a">
      <div><small>${esc(dataDeHoje())}</small><h1 class="titulo-tela">${saudacao()}</h1></div>
      <a class="avatar-link" href="#/corpo" aria-label="Meu perfil">${htmlAvatar(est)}</a>
    </header>`;
}

// Fundo do bloco do treino: foto (A–E) ou bloco colorido com a letra grande.
function fundoTreino(id) {
  const foto = fotoDoTreino(id);
  return foto
    ? `<img class="foto-capa zoom" src="${foto}" alt="">`
    : `<span class="letra-fundo fundo-${corDoTreino(id)}" aria-hidden="true">${esc(id)}</span>`;
}

// Data (dd/mm) do fim da sessão mais recente com aquele treino, ou null.
function ultimaVez(est, treinoId) {
  const fins = est.sessoes.filter(s => s.treinoId === treinoId && s.fim).map(s => s.fim).sort();
  return fins.length ? fins[fins.length - 1] : null;
}

function blocoEmAndamento(est) {
  const sa = est.sessaoAtual;
  const treino = est.treinos.find(t => t.id === sa.treinoId);
  let total = 0, feitas = 0;
  for (const item of sa.itens) {
    total += item.registros.length;
    feitas += item.registros.filter(r => r.feita).length;
  }
  return `
    <a class="bloco s2 principal tocavel a" href="#/treino" data-sec="em-andamento">
      ${fundoTreino(sa.treinoId)}
      <span class="chip-vidro">Em andamento · Treino ${esc(sa.treinoId)}</span>
      <span class="info-vidro">
        <span class="principal-nome">${esc(treino ? treino.nome : 'Treino')}</span>
        <span class="principal-meta">${feitas} de ${total} séries feitas</span>
        <span class="principal-vai"><i>${ic('seta')}</i>Continuar treino</span>
      </span>
    </a>`;
}

function blocoSugerido(est, t) {
  const ultima = ultimaVez(est, t.id);
  const min = estimativaMin(est, t.id);
  const meta = [`${t.itens.length} ${t.itens.length === 1 ? 'exercício' : 'exercícios'}`, min ? `~${min} min` : null,
    ultima ? `último em ${formatarData(ultima)}` : 'ainda não feito'].filter(Boolean).join(' · ');
  const acao = t.itens.length
    ? `<button type="button" class="principal-vai" data-acao="comecar" data-treino="${esc(t.id)}"><i>${ic('seta')}</i>Começar treino</button>`
    : `<a class="principal-vai" data-acao="adicionar-exercicios" href="#/ajustes/treino/${encodeURIComponent(t.id)}"><i>${ic('mais')}</i>Adicionar exercícios</a>`;
  return `
    <section class="bloco s2 principal a" data-sec="treino-do-dia">
      ${fundoTreino(t.id)}
      <span class="chip-vidro">Hoje · Treino ${esc(t.id)}</span>
      <span class="info-vidro">
        <span class="principal-nome">${esc(t.nome)}</span>
        <span class="principal-meta">${esc(meta)}</span>
        ${acao}
      </span>
    </section>`;
}

function blocoSemTreinos() {
  return `
    <section class="bloco s2 bloco-ink a" data-sec="sem-treinos">
      <h2 class="principal-nome">Você ainda não tem treinos</h2>
      <p class="principal-meta">Crie o seu primeiro treino e escolha os exercícios.</p>
      <a class="principal-vai" data-acao="criar-treino" href="#/ajustes/treino/novo"><i>${ic('mais')}</i>Criar treino</a>
    </section>`;
}

function blocoAnel(est) {
  const { feitos, total } = progressoSemana(est, hojeISO());
  if (!total) return '';
  return `
    <div class="bloco bloco-sage a" data-sec="anel-semana">
      <div class="anel">
        <svg viewBox="0 0 58 58" aria-hidden="true"><circle cx="29" cy="29" r="23" class="anel-trilho"/><circle cx="29" cy="29" r="23" class="anel-valor" data-anel="${Math.min(1, feitos / total)}" transform="rotate(-90 29 29)"/></svg>
        <div class="num-grande num"><span data-contar="${feitos}">${feitos}</span><small>/${total}</small></div>
      </div>
      <div class="rotulo">treinos na semana</div>
    </div>`;
}

// Pontos de cada dia da semana (seg–dom), para as barrinhas do bloco de pontos.
function pontosPorDia(est, dias) {
  return dias.map(d => totaisDia(est.sessoes, est.cardios, d.dia).pontos);
}

function blocoSemana(d) {
  const dias = d.dias.map(x =>
    `<span class="semana-dia${x.ativo ? ' ativo' : ''}${x.hoje ? ' hoje' : ''}" data-dia="${x.dia}"><b class="semana-bolinha" data-surgir aria-label="${x.ativo ? 'treinou' : 'sem atividade'}">${x.ativo ? ic('ok') : ''}</b>${x.letra}</span>`
  ).join('');
  const seq = d.sequencia > 0 ? `${d.sequencia} ${d.sequencia === 1 ? 'dia seguido' : 'dias seguidos'}` : 'Comece hoje a sua sequência';
  return `
    <div class="bloco s2 bloco-sky a" data-sec="semana" role="group" aria-label="Minha semana">
      <div class="semana-topo"><span class="rotulo">Minha semana · ${esc(seq)}</span>
        <button type="button" class="redondo redondo-mini" data-acao="compartilhar-semana" aria-label="Compartilhar a semana">${ic('share')}</button></div>
      <div class="semana-dias">${dias}</div>
    </div>`;
}

function blocoCardio(est) {
  const a = est.cardioAtual;
  if (a) {
    const rotulo = ROTULO_CARDIO[a.tipo] || 'Cardio';
    return `
      <a class="bloco s2 bloco-white cardio-bloco tocavel a" data-cardio="andamento" data-acao="continuar-cardio" href="#/cardio/gps">
        <span><b>${esc(rotulo)} ${a.pausado ? 'pausada' : 'em andamento'}</b><span class="rotulo num" data-cardio-tempo>${formatarCronometro(tempoMs(a, Date.now()))}</span></span>
        <span class="pilula pilula-esc">Continuar</span>
      </a>`;
  }
  return `
    <div class="bloco s2 bloco-white cardio-bloco a" data-cardio="atalhos">
      <span><b>Cardio</b><span class="rotulo">Caminhada, corrida ou aparelho</span></span>
      <span class="cardio-bts">
        <a class="pilula tocavel" data-acao="cardio-gps" href="#/cardio/gps">${ic('anda')}Caminhar</a>
        <a class="pilula tocavel" data-acao="cardio-aparelho" href="#/cardio/aparelho/novo">${ic('aparelho')}Aparelho</a>
      </span>
    </div>`;
}

function carrosselOutros(est, atualId) {
  const outros = est.treinos.filter(o => o.id !== atualId);
  if (!outros.length) return '';
  const itens = outros.map(o => {
    const foto = fotoDoTreino(o.id);
    return `<button type="button" class="outro-treino tocavel ${foto ? '' : 'fundo-' + corDoTreino(o.id)}" data-acao="comecar" data-treino="${esc(o.id)}">
      ${foto ? `<img class="foto-capa" src="${foto}" alt="">` : ''}<b>${esc(o.id)}</b><small>${esc(o.foco || o.nome)}</small></button>`;
  }).join('');
  return `<div class="secao a">Outro treino</div><div class="outros a" data-sec="outros">${itens}</div>`;
}

export function render() {
  const est = obterEstado();
  const d = dadosCardSemana(est, hojeISO());
  const sugerido = est.sessaoAtual ? null : proximoTreino(est.treinos, est.ultimoTreinoId);
  const principal = est.sessaoAtual ? blocoEmAndamento(est) : sugerido ? blocoSugerido(est, sugerido) : blocoSemTreinos();
  const pontosSemana = Number(d.metricas[3].valor) || 0;
  return `
    ${cabecalho(est)}
    <div class="grade hoje-grade">
      ${principal}
      ${blocoAnel(est)}
      ${renderCardRankingHoje(pontosSemana, pontosPorDia(est, d.dias))}
      ${blocoSemana(d)}
      ${blocoCardio(est)}
    </div>
    ${est.sessaoAtual ? '' : carrosselOutros(est, sugerido?.id)}`;
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
  montarCardRankingHoje(raiz);
  const semana = raiz.querySelector('[data-acao="compartilhar-semana"]');
  if (semana) semana.onclick = () => compartilharCard('Minha semana', () => dadosCardSemana(obterEstado(), hojeISO()));
  raiz.querySelectorAll('[data-acao="comecar"]').forEach(el => {
    el.addEventListener('click', () => iniciarSessao(el.dataset.treino));
  });
}

export function iniciarSessao(treinoId) {
  const est = obterEstado();
  const treino = est.treinos.find(t => t.id === treinoId);
  if (!treino) return;
  if (!treino.itens.length) { // treino sem exercícios: manda para o editor em vez de abrir uma sessão vazia
    toast('Este treino ainda não tem exercícios');
    location.hash = `#/ajustes/treino/${encodeURIComponent(treino.id)}`;
    return;
  }
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
