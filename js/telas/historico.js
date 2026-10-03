// Histórico de treinos (#/historico) e detalhe de uma sessão (#/sessao/<id>).
import { esc, formatarDataCompleta, formatarDuracao, formatarKg, formatarNumero } from '../util.js';
import { obterEstado, atualizar } from '../estado.js';
import { confirmar, toast } from '../ui.js';
import { compartilharCard } from '../compartilhar.js';
import { dadosCardTreino } from '../cards.js';
import { ICONE_CARDIO, ROTULO_CARDIO, formatarKm, formatarCronometro, itensHistorico } from '../cardio.js';

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

function linhaTreino(est, s) {
  return `
    <a class="linha-lista linha-sessao" data-tipo="treino" href="#/sessao/${encodeURIComponent(s.id)}">
      <span class="linha-nome"><strong>${esc(formatarDataCompleta(s.fim))}</strong><br><span class="muted">🏋️ ${esc(tituloTreino(est, s))}</span></span>
      <span class="linha-info muted">${esc(formatarDuracao(duracaoMs(s)))} · ${totalSeries(s)} séries</span>
    </a>`;
}

// "🚶 Caminhada · 3,42 km · 41:20" (GPS) ou "🚴 Bicicleta · 30 min" (aparelho)
function linhaCardio(c) {
  const nome = `${ICONE_CARDIO[c.tipo] || '❤️'} ${ROTULO_CARDIO[c.tipo] || 'Cardio'}`;
  const dist = c.distanciaM > 0 ? formatarKm(c.distanciaM) : null;
  const info = c.modo === 'gps'
    ? [dist, formatarCronometro(c.duracaoSeg * 1000)]
    : [`${formatarNumero(Math.round(c.duracaoSeg / 60))} min`, dist];
  return `
    <a class="linha-lista linha-sessao" data-tipo="cardio" href="#/cardio/${encodeURIComponent(c.id)}">
      <span class="linha-nome"><strong>${esc(formatarDataCompleta(c.fim))}</strong><br><span class="muted">${esc(nome)}</span></span>
      <span class="linha-info muted">${esc(info.filter(Boolean).join(' · '))}</span>
    </a>`;
}

export function render() {
  const est = obterEstado();
  // musculação e cardio juntos, por data (mais recente primeiro)
  const linhas = itensHistorico(est.sessoes, est.cardios).map(item => (item.tipo === 'cardio'
    ? linhaCardio(item.ref)
    : linhaTreino(est, item.ref))).join('');
  return `
    <div class="tela-historico">
      <h1 class="titulo">Histórico</h1>
      ${linhas || '<p class="muted">Nenhum treino registrado ainda.</p>'}
    </div>`;
}

export function montar() {}

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
    toast('Treino excluído');
    location.hash = '#/historico';
  };
}
