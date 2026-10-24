// Biblioteca de exercícios (#/exercicios) e detalhe com gráfico (#/exercicio/<id>).
import { esc, formatarKg, formatarNumero, formatarData } from '../util.js';
import { GRUPOS, EQUIPAMENTOS, gruposComExercicios } from '../dados.js';
import { avaliar, historicoDoExercicio, melhorCargaPorSessao } from '../progressao.js';
import { obterEstado, atualizar } from '../estado.js';
import { confirmar, toast } from '../ui.js';
import { miniGrafico, graficoColunas } from '../grafico.js';
import { entrar } from '../movimento.js';
import { ic } from '../icones.js';
import { abrirFormExercicio } from './trocar.js';

// remove acento e caixa para a busca
function normalizar(s) {
  return String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

const porNome = (a, b) => a.nome.localeCompare(b.nome, 'pt-BR');

// ---------- Lista ----------

// filtro por grupo escolhido (vale enquanto o app estiver aberto)
let grupoFiltro = 'todos';

export function render() {
  const est = obterEstado();
  const todos = Object.values(est.exercicios).sort(porNome);
  const grupos = gruposComExercicios(est.exercicios);
  if (grupoFiltro !== 'todos' && !grupos.includes(grupoFiltro)) grupoFiltro = 'todos';
  const filtros = [['todos', 'Todos'], ...grupos.map(g => [g, GRUPOS[g] ?? g])].map(([g, rotulo]) =>
    `<button type="button" class="seletor-op${g === grupoFiltro ? ' on' : ''}" data-acao="filtro" data-g="${esc(g)}" aria-pressed="${g === grupoFiltro}">${esc(rotulo)}</button>`).join('');
  const linhas = todos.map(x => {
    const hist = historicoDoExercicio(est.sessoes, x.id);
    const aval = avaliar(hist, x);
    const cargas = melhorCargaPorSessao(hist.filter(h => h.registros.some(r => r.carga != null))).slice(-8).map(p => p.carga);
    const subir = aval.status === 'aumentar' ? '<span class="ponto-subir" title="Pode aumentar" aria-label="pode aumentar"></span>' : '';
    return `<a class="linha-lista ex-linha tocavel" href="#/exercicio/${encodeURIComponent(x.id)}" data-nome="${esc(normalizar(x.nome))}" data-g="${esc(x.grupo)}">
        <span class="linha-nome"><b>${esc(x.nome)}${subir}</b><span class="sub">${esc(GRUPOS[x.grupo] ?? x.grupo)} · ${esc(EQUIPAMENTOS[x.equipamento] ?? x.equipamento)}</span></span>
        <span class="ex-direita">${miniGrafico(cargas)}<span class="ex-carga num">${aval.cargaAtual != null ? esc(formatarKg(aval.cargaAtual)) : '—'}</span></span>
      </a>`;
  }).join('');
  return `
    <div class="tela-exercicios">
      <header class="cab-tela a"><h1 class="titulo-tela">Exercícios</h1>
        <button type="button" class="pilula pilula-esc tocavel" data-acao="novo">${ic('mais')}Novo</button></header>
      <label class="busca-bloco a">${ic('lupa')}<input type="search" class="busca" placeholder="Buscar exercício" aria-label="Buscar exercício" autocomplete="off"></label>
      <div class="filtros a" role="group" aria-label="Grupo muscular">${filtros}</div>
      <div class="a lista-exercicios">${linhas}</div>
      <p class="rotulo vazio-troca" hidden>Nenhum exercício encontrado.</p>
    </div>`;
}

export function montar(raiz) {
  const tela = raiz.querySelector('.tela-exercicios');
  if (!tela) return;
  const busca = tela.querySelector('.busca');
  const filtrar = () => {
    const q = normalizar(busca.value.trim());
    let visiveis = 0;
    tela.querySelectorAll('.ex-linha').forEach(a => {
      const mostra = a.dataset.nome.includes(q) && (grupoFiltro === 'todos' || a.dataset.g === grupoFiltro);
      a.hidden = !mostra;
      if (mostra) visiveis++;
    });
    tela.querySelector('.vazio-troca').hidden = visiveis > 0;
  };
  busca.oninput = filtrar;
  tela.querySelectorAll('[data-acao="filtro"]').forEach(b => {
    b.onclick = () => {
      grupoFiltro = b.dataset.g;
      tela.querySelectorAll('[data-acao="filtro"]').forEach(x => {
        x.classList.toggle('on', x === b);
        x.setAttribute('aria-pressed', String(x === b));
      });
      filtrar();
      entrar(tela.querySelector('.lista-exercicios'));
    };
  });
  filtrar();
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
  if (aval.status === 'aumentar') return `<div class="bloco bloco-sage a"><strong>Pode aumentar para ${formatarKg(aval.cargaSugerida)}</strong><div class="rotulo">Você fez o máximo de repetições da última vez</div></div>`;
  if (aval.status === 'reduzir') return `<div class="bloco bloco-sand a"><strong>Sugestão: baixar para ${formatarKg(aval.cargaSugerida)}</strong></div>`;
  if (aval.status === 'manter') return `<div class="bloco bloco-white a">Manter a carga atual: <strong>${formatarKg(aval.cargaAtual)}</strong></div>`;
  return '<div class="bloco bloco-white a">Primeira vez</div>';
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
    `<div><span>${esc(formatarData(h.data))}</span><span class="sub num">${esc(resumirSeries(h.registros))}</span></div>`
  ).join('');
  const podeExc = podeExcluir(est, ex);
  const partes = [GRUPOS[ex.grupo] ?? ex.grupo, EQUIPAMENTOS[ex.equipamento] ?? ex.equipamento];
  if (ex.unilateral) partes.push('cada lado');
  const etiquetas = [...partes, ex.tipo === 'composto' ? 'Composto' : ex.tipo === 'isolado' ? 'Isolado' : null].filter(Boolean)
    .map(p => `<span class="pilula pilula-mini">${esc(p)}</span>`).join('');
  const colunas = graficoColunas(pontos.map(p => p.carga), pontos.map(p => formatarData(p.data).slice(0, 5)));
  return `
    <div class="tela-exercicio">
      <div class="capa capa-exercicio"><img class="foto-capa zoom" src="./img/exercicio.jpg" alt="">
        <a class="redondo vidro tocavel capa-voltar" href="#/exercicios" aria-label="Voltar para Exercícios">${ic('volta')}</a></div>
      <h1 class="titulo-tela ex-titulo a">${esc(ex.nome)}</h1>
      <div class="etiquetas a">${etiquetas}</div>
      <p class="rotulo a">Sobe de ${formatarNumero(ex.incremento)} kg em ${formatarNumero(ex.incremento)} kg</p>
      <div class="pilha">
        ${renderSeloDetalhe(aval)}
        <div class="bloco bloco-white a">
          <div class="bloco-topo"><b>Evolução da carga</b><span class="rotulo">${pontos.length ? `últimas ${Math.min(8, pontos.length)} sessões` : ''}</span></div>
          ${colunas || '<p class="rotulo">O gráfico aparece depois do primeiro treino com carga.</p>'}
        </div>
        <div class="bloco bloco-sky a"><b>Como fazer</b><p class="dica">${ex.dica ? esc(ex.dica) : '<span class="rotulo">Sem dica cadastrada.</span>'}</p></div>
      </div>
      <div class="secao a">Últimas sessões</div>
      ${linhasSessoes ? `<div class="linhas a">${linhasSessoes}</div>` : '<p class="rotulo a">Ainda não há sessões com este exercício.</p>'}
      <div class="grade ex-acoes a">
        <button type="button" class="pilula tocavel" data-acao="editar">${ic('lapis')}Editar</button>
        <button type="button" class="pilula tocavel ex-excluir" data-acao="excluir"${podeExc ? '' : ' disabled'}>${ic('lixo')}Excluir</button>
      </div>
      ${podeExc ? '' : '<p class="rotulo a">Só dá para excluir exercícios criados por você que não estejam em treinos nem no histórico.</p>'}
    </div>`;
}

export function montarDetalhe(raiz, id) {
  const tela = raiz.querySelector('.tela-exercicio');
  if (!tela || !obterEstado().exercicios[id]) return;
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
