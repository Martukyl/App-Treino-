// Histórico de treinos (#/historico) e detalhe de uma sessão (#/sessao/<id>).
import { esc, formatarDataCompleta, formatarDuracao, formatarKg, formatarNumero } from '../util.js';
import { obterEstado, atualizar } from '../estado.js';
import { confirmar, toast } from '../ui.js';

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

export function render() {
  const est = obterEstado();
  const ordenadas = [...est.sessoes].sort((a, b) => new Date(b.fim) - new Date(a.fim));
  const linhas = ordenadas.map(s => `
    <a class="linha-lista linha-sessao" href="#/sessao/${encodeURIComponent(s.id)}">
      <span class="linha-nome"><strong>${esc(formatarDataCompleta(s.fim))}</strong><br><span class="muted">${esc(tituloTreino(est, s))}</span></span>
      <span class="linha-info muted">${esc(formatarDuracao(duracaoMs(s)))} · ${totalSeries(s)} séries</span>
    </a>`).join('');
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
      <button type="button" class="btn btn-perigo btn-bloco" data-acao="excluir">Excluir sessão</button>
    </div>`;
}

export function montarSessao(raiz, id) {
  const tela = raiz.querySelector('.tela-sessao');
  const botao = tela && tela.querySelector('[data-acao="excluir"]');
  if (!botao) return;
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
