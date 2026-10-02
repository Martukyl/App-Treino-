// Biblioteca de exercícios (#/exercicios) e detalhe com gráfico (#/exercicio/<id>).
import { esc, formatarKg, formatarNumero, formatarData } from '../util.js';
import { GRUPOS, EQUIPAMENTOS } from '../dados.js';
import { avaliar, historicoDoExercicio, melhorCargaPorSessao } from '../progressao.js';
import { obterEstado, atualizar } from '../estado.js';
import { confirmar, toast } from '../ui.js';
import { graficoLinha } from '../grafico.js';
import { abrirFormExercicio } from './trocar.js';

// remove acento e caixa para a busca
function normalizar(s) {
  return String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

const porNome = (a, b) => a.nome.localeCompare(b.nome, 'pt-BR');

// ---------- Lista ----------

export function render() {
  const est = obterEstado();
  const todos = Object.values(est.exercicios);
  const ordemGrupos = [...Object.keys(GRUPOS), ...new Set(todos.map(x => x.grupo).filter(g => !(g in GRUPOS)))];
  const secoes = ordemGrupos.map(g => {
    const itens = todos.filter(x => x.grupo === g).sort(porNome);
    if (!itens.length) return '';
    const linhas = itens.map(x => {
      const aval = avaliar(historicoDoExercicio(est.sessoes, x.id), x);
      const selo = aval.status === 'aumentar' ? '<span class="selo-ok" title="Pode aumentar">↑</span>' : '';
      return `<a class="linha-lista" href="#/exercicio/${encodeURIComponent(x.id)}" data-nome="${esc(normalizar(x.nome))}">
        <span class="linha-nome">${esc(x.nome)}</span>
        <span class="linha-info">${selo}<span class="muted">${formatarKg(aval.cargaAtual)}</span></span>
      </a>`;
    }).join('');
    return `<section class="grupo-ex"><h2 class="sec-troca">${esc(GRUPOS[g] ?? g)}</h2>${linhas}</section>`;
  }).join('');
  return `
    <div class="tela-exercicios">
      <h1 class="titulo">Exercícios</h1>
      <input type="search" class="busca" placeholder="Buscar exercício" aria-label="Buscar exercício">
      <button type="button" class="btn btn-principal btn-bloco" data-acao="novo">+ Novo exercício</button>
      ${secoes}
      <p class="vazio-troca" hidden>Nenhum exercício encontrado.</p>
    </div>`;
}

export function montar(raiz) {
  const tela = raiz.querySelector('.tela-exercicios');
  if (!tela) return;
  tela.querySelector('.busca').oninput = ev => {
    const q = normalizar(ev.target.value.trim());
    let visiveis = 0;
    tela.querySelectorAll('.linha-lista').forEach(a => {
      const mostra = a.dataset.nome.includes(q);
      a.hidden = !mostra;
      if (mostra) visiveis++;
    });
    tela.querySelectorAll('.grupo-ex').forEach(s => {
      s.hidden = !s.querySelector('.linha-lista:not([hidden])');
    });
    tela.querySelector('.vazio-troca').hidden = visiveis > 0;
  };
  tela.querySelector('[data-acao="novo"]').onclick = () => {
    abrirFormExercicio(null, id => { location.hash = '#/exercicio/' + encodeURIComponent(id); });
  };
}

// ---------- Detalhe ----------

function resumirSeries(registros) {
  return registros
    .map(r => r.carga == null ? `${r.reps}` : `${formatarNumero(r.carga)}×${r.reps}`)
    .join(' · ');
}

// Só exercício personalizado, fora de treinos, do histórico e da sessão em andamento.
function podeExcluir(est, ex) {
  if (!ex.personalizado) return false;
  if (est.treinos.some(t => t.itens.some(it => it.exercicioId === ex.id))) return false;
  const usa = s => s.itens.some(it => it.exercicioId === ex.id || it.trocadoDe === ex.id);
  if (est.sessoes.some(usa)) return false;
  if (est.sessaoAtual && usa(est.sessaoAtual)) return false;
  return true;
}

function renderSeloDetalhe(aval) {
  if (aval.status === 'aumentar') return `<div class="selo-ok">↑ Pode aumentar → ${formatarKg(aval.cargaSugerida)}</div>`;
  if (aval.status === 'reduzir') return `<div class="selo-warn">Sugestão: baixar para ${formatarKg(aval.cargaSugerida)}</div>`;
  if (aval.status === 'manter') return `<p>Manter a carga atual: <strong>${formatarKg(aval.cargaAtual)}</strong></p>`;
  return '<p>Primeira vez</p>';
}

export function renderDetalhe(id) {
  const est = obterEstado();
  const ex = est.exercicios[id];
  if (!ex) {
    return `
      <div class="tela-exercicio">
        <a class="voltar" href="#/exercicios">← Exercícios</a>
        <h1 class="titulo">Exercício não encontrado</h1>
        <a class="btn btn-principal btn-bloco" href="#/exercicios">Voltar para Exercícios</a>
      </div>`;
  }
  const historico = historicoDoExercicio(est.sessoes, id);
  const aval = avaliar(historico, ex);
  const pontos = melhorCargaPorSessao(historico.filter(h => h.registros.some(r => r.carga != null)));
  const linhasSessoes = historico.slice(0, 10).map(h =>
    `<li><span class="muted">${esc(formatarData(h.data))}</span><span>${esc(resumirSeries(h.registros))}</span></li>`
  ).join('');
  const podeExc = podeExcluir(est, ex);
  const partes = [GRUPOS[ex.grupo] ?? ex.grupo, EQUIPAMENTOS[ex.equipamento] ?? ex.equipamento];
  if (ex.unilateral) partes.push('cada lado');
  return `
    <div class="tela-exercicio">
      <a class="voltar" href="#/exercicios">← Exercícios</a>
      <h1 class="titulo">${esc(ex.nome)}</h1>
      <p class="muted">${esc(partes.join(' · '))}</p>
      <p class="muted">Sobe de ${formatarNumero(ex.incremento)} kg em ${formatarNumero(ex.incremento)} kg</p>
      <section class="card">${renderSeloDetalhe(aval)}</section>
      <section class="card">
        <h2 class="sec-card">Evolução</h2>
        <div class="grafico">${graficoLinha(pontos)}</div>
        <p class="muted grafico-legenda" aria-live="polite"></p>
      </section>
      <section class="card">
        <h2 class="sec-card">Como fazer</h2>
        <p class="dica">${ex.dica ? esc(ex.dica) : '<span class="muted">Sem dica cadastrada.</span>'}</p>
      </section>
      <section class="card">
        <h2 class="sec-card">Últimas sessões</h2>
        ${linhasSessoes ? `<ul class="lista-sessoes">${linhasSessoes}</ul>` : '<p class="muted">Ainda não há sessões com este exercício.</p>'}
      </section>
      <div class="card-botoes">
        <button type="button" class="btn btn-sec" data-acao="editar">Editar</button>
        <button type="button" class="btn btn-perigo" data-acao="excluir"${podeExc ? '' : ' disabled'}>Excluir</button>
      </div>
      ${podeExc ? '' : '<p class="muted">Só dá para excluir exercícios criados por você que não estejam em treinos nem no histórico.</p>'}
    </div>`;
}

export function montarDetalhe(raiz, id) {
  const tela = raiz.querySelector('.tela-exercicio');
  if (!tela || !obterEstado().exercicios[id]) return;
  const legenda = tela.querySelector('.grafico-legenda');
  // tocar (ou focar) num ponto mostra data e carga
  const mostrar = alvo => {
    const t = alvo.querySelector('title');
    if (t) legenda.textContent = t.textContent;
  };
  tela.querySelectorAll('.grafico circle').forEach(c => {
    c.onclick = () => mostrar(c);
    c.onfocus = () => mostrar(c);
  });
  tela.querySelector('[data-acao="editar"]').onclick = () => {
    abrirFormExercicio(id, () => {}); // o salvar já redesenha a tela
  };
  tela.querySelector('[data-acao="excluir"]').onclick = async () => {
    const est = obterEstado();
    const ex = est.exercicios[id];
    if (!ex || !podeExcluir(est, ex)) return;
    if (!(await confirmar(`Excluir "${ex.nome}"?`, 'Excluir', true))) return;
    atualizar(e => { delete e.exercicios[id]; }, { renderizar: false });
    toast('Exercício excluído');
    location.hash = '#/exercicios';
  };
}
