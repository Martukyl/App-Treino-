// Histórico de treinos (#/historico) e detalhe de uma sessão (#/sessao/<id>).
import { esc, formatarDataCompleta, formatarDuracao, formatarKg, formatarNumero, hojeISO } from '../util.js';
import { obterEstado, atualizar } from '../estado.js';
import { confirmar, toast } from '../ui.js';
import { compartilharCard } from '../compartilhar.js';
import { dadosCardTreino } from '../cards.js';
import { sincronizarRanking } from '../ranking.js';
import { ROTULO_CARDIO, formatarKm, formatarCronometro, itensHistorico } from '../cardio.js';
import { diasDoMes, resumoDoMes, mesVizinho } from '../calendario.js';
import { fotoDoTreino, corDoTreino } from '../dados.js';
import { diaLocal } from '../pontos.js';
import { ic } from '../icones.js';

const duracaoMs = s => new Date(s.fim).getTime() - new Date(s.inicio).getTime();
const totalSeries = s => s.itens.reduce((n, it) => n + it.registros.length, 0);

function tituloTreino(est, s) {
  const t = est.treinos.find(x => x.id === s.treinoId);
  return t ? `Treino ${t.id} — ${t.nome}` : (s.treinoId ? `Treino ${s.treinoId}` : 'Treino');
}

// "40 kg × 12" ou, sem carga (peso corporal), "12 reps"
function textoSerie(r) {
  return r.carga == null ? `${formatarNumero(r.reps)} reps` : `${formatarKg(r.carga)} × ${formatarNumero(r.reps)}`;
}

// ---------- Lista ----------

// mês mostrado no calendário (vale enquanto o app estiver aberto); null = mês atual
let mesVisto = null;

const NOMES_MES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

function miniatura(treinoId) {
  const foto = fotoDoTreino(treinoId);
  return `<span class="mini-treino ${foto ? '' : 'fundo-' + corDoTreino(treinoId)}">${foto ? `<img src="${foto}" alt="">` : ''}<span>${esc(treinoId || '')}</span></span>`;
}

function linhaTreino(est, s) {
  return `
    <a class="linha-lista linha-sessao tocavel" data-tipo="treino" data-dia="${esc(diaLocal(s.fim) || '')}" href="#/sessao/${encodeURIComponent(s.id)}">
      ${miniatura(s.treinoId)}
      <span class="linha-nome"><b>${esc(tituloTreino(est, s))}</b><span class="sub">${esc(formatarDataCompleta(s.fim))} · ${esc(formatarDuracao(duracaoMs(s)))} · ${totalSeries(s)} séries</span></span>
      ${ic('dir')}
    </a>`;
}

// "Caminhada · 3,42 km · 41:20" (GPS) ou "Bicicleta · 30 min" (aparelho)
function linhaCardio(c) {
  const nome = ROTULO_CARDIO[c.tipo] || 'Cardio';
  const dist = c.distanciaM > 0 ? formatarKm(c.distanciaM) : null;
  const info = c.modo === 'gps'
    ? [dist, formatarCronometro(c.duracaoSeg * 1000)]
    : [`${formatarNumero(Math.round(c.duracaoSeg / 60))} min`, dist];
  return `
    <a class="linha-lista linha-sessao tocavel" data-tipo="cardio" data-dia="${esc(diaLocal(c.fim) || '')}" href="#/cardio/${encodeURIComponent(c.id)}">
      <span class="mini-treino fundo-sage">${ic(c.modo === 'gps' ? 'anda' : 'aparelho')}</span>
      <span class="linha-nome"><b>${esc(nome)}</b><span class="sub">${esc([formatarDataCompleta(c.fim), ...info.filter(Boolean)].join(' · '))}</span></span>
      ${ic('dir')}
    </a>`;
}

export function render() {
  const est = obterEstado();
  const hoje = hojeISO();
  const { ano, mes } = mesVisto || { ano: Number(hoje.slice(0, 4)), mes: Number(hoje.slice(5, 7)) };
  const prefixo = `${ano}-${String(mes).padStart(2, '0')}-`;
  const celulas = diasDoMes(ano, mes, est.sessoes, est.cardios, hoje).map(d => d.dia == null ? '<b class="vazio"></b>'
    : `<button type="button" class="dia${d.treino ? ' tr' : ''}${d.cardio ? ' cd' : ''}${d.hoje ? ' hj' : ''}" data-surgir data-acao="dia" data-iso="${d.iso}" aria-label="${d.dia}${d.treino ? ', treino' : ''}${d.cardio ? ', cardio' : ''}">${d.dia}</button>`).join('');
  const r = resumoDoMes(ano, mes, est.sessoes, est.cardios);
  // musculação e cardio juntos, por data (mais recente primeiro), só do mês mostrado
  const linhas = itensHistorico(est.sessoes, est.cardios)
    .filter(item => (diaLocal(item.ref.fim) || '').startsWith(prefixo))
    .map(item => (item.tipo === 'cardio' ? linhaCardio(item.ref) : linhaTreino(est, item.ref))).join('');
  return `
    <div class="tela-historico">
      <header class="cab-tela a"><h1 class="titulo-tela">Histórico</h1></header>
      <div class="bloco bloco-white calendario a">
        <div class="cal-topo"><b>${NOMES_MES[mes - 1]} ${ano}</b>
          <span class="cal-setas"><button type="button" class="redondo redondo-mini" data-acao="mes" data-d="-1" aria-label="Mês anterior">${ic('volta')}</button>
          <button type="button" class="redondo redondo-mini" data-acao="mes" data-d="1" aria-label="Próximo mês">${ic('dir')}</button></span></div>
        <div class="cal-grade num">${['S', 'T', 'Q', 'Q', 'S', 'S', 'D'].map(l => `<span>${l}</span>`).join('')}${celulas}</div>
        <div class="cal-legenda"><span><i></i>Treino</span><span><i class="v"></i>Cardio</span></div>
      </div>
      <div class="grade resumo-mes">
        <div class="bloco bloco-sky a"><div class="num-grande num" data-contar="${r.treinos}">${r.treinos}</div><div class="rotulo">treinos</div></div>
        <div class="bloco bloco-sage a"><div class="num-grande num" data-contar="${r.cardios}">${r.cardios}</div><div class="rotulo">cardios</div></div>
        <div class="bloco bloco-sand a"><div class="num-grande num"><span data-contar="${r.horas}">${r.horas}</span><small>h</small></div><div class="rotulo">no mês</div></div>
      </div>
      <div class="secao a">${linhas ? 'Neste mês' : ''}</div>
      <div class="a">${linhas || '<p class="rotulo">Nenhum treino registrado neste mês.</p>'}</div>
    </div>`;
}

export function montar(raiz) {
  const tela = raiz.querySelector('.tela-historico');
  if (!tela) return;
  tela.onclick = ev => {
    const b = ev.target.closest('[data-acao]');
    if (!b) return;
    if (b.dataset.acao === 'mes') {
      const hoje = hojeISO();
      const atual = mesVisto || { ano: Number(hoje.slice(0, 4)), mes: Number(hoje.slice(5, 7)) };
      mesVisto = mesVizinho(atual.ano, atual.mes, Number(b.dataset.d));
      atualizar(() => {});
    } else if (b.dataset.acao === 'dia') {
      const alvo = tela.querySelector(`.linha-sessao[data-dia="${b.dataset.iso}"]`);
      if (alvo) alvo.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };
}

// ---------- Detalhe ----------

export function renderSessao(id) {
  const est = obterEstado();
  const s = est.sessoes.find(x => x.id === id);
  if (!s) {
    return `
      <div class="tela-sessao">
        <a class="voltar" href="#/historico">← Histórico</a>
        <h1 class="titulo">Treino não encontrado</h1>
        <a class="btn btn-principal btn-bloco" href="#/historico">Voltar ao Histórico</a>
      </div>`;
  }
  const volume = s.itens.reduce((v, it) => v + it.registros.reduce((a, r) => a + (r.carga || 0) * r.reps, 0), 0);
  const nomeEx = exId => est.exercicios[exId] ? esc(est.exercicios[exId].nome) : 'Exercício removido';
  const blocos = s.itens.map(it => {
    const trocado = it.trocadoDe ? `<p class="muted">no lugar de ${nomeEx(it.trocadoDe)}</p>` : '';
    const series = it.registros.map(r => `<li><span class="muted">${esc(textoSerie(r))}</span></li>`).join('');
    return `
      <section class="card">
        <h2 class="sec-card">${nomeEx(it.exercicioId)}</h2>
        ${trocado}
        <ul class="lista-sessoes">${series}</ul>
      </section>`;
  }).join('');
  return `
    <div class="tela-sessao" data-id="${esc(s.id)}">
      <a class="voltar" href="#/historico">← Histórico</a>
      <h1 class="titulo">${esc(formatarDataCompleta(s.fim))}</h1>
      <section class="card card-destaque">
        <h2 class="treino-nome">${esc(tituloTreino(est, s))}</h2>
        <p class="muted">${esc(formatarDuracao(duracaoMs(s)))} · ${totalSeries(s)} séries · ${formatarNumero(volume)} kg de volume</p>
      </section>
      ${blocos}
      <button type="button" class="btn btn-sec btn-bloco" data-acao="compartilhar">Compartilhar</button>
      <button type="button" class="btn btn-perigo btn-bloco" data-acao="excluir">Excluir sessão</button>
    </div>`;
}

export function montarSessao(raiz, id) {
  const tela = raiz.querySelector('.tela-sessao');
  const botao = tela && tela.querySelector('[data-acao="excluir"]');
  if (!botao) return;
  tela.querySelector('[data-acao="compartilhar"]').onclick = () => {
    const s = obterEstado().sessoes.find(x => x.id === id);
    if (s) compartilharCard('Treino concluído', () => dadosCardTreino(obterEstado(), s));
  };
  botao.onclick = async () => {
    if (!(await confirmar('Excluir este treino do histórico?', 'Excluir', true))) return;
    atualizar(e => {
      e.sessoes = e.sessoes.filter(x => x.id !== id);
      // recalcula o último treino pela sessão restante mais recente (ou nenhum)
      let ultima = null;
      for (const x of e.sessoes) {
        if (!ultima || new Date(x.fim) > new Date(ultima.fim)) ultima = x;
      }
      e.ultimoTreinoId = ultima ? ultima.treinoId : null;
    }, { renderizar: false });
    sincronizarRanking();
    toast('Treino excluído');
    location.hash = '#/historico';
  };
}
