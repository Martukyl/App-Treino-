// Tela de treino em andamento (#/treino) e resumo ao finalizar (#/resumo/<id>).
// Visual Blocos: um exercício por vez (cartão), controles + e − e a lista de exercícios embaixo.
import {
  esc, parseCarga, parseReps, formatarKg, formatarNumero, formatarCampo,
  formatarDescanso, formatarDuracao, formatarData
} from '../util.js';
import { GRUPOS, EQUIPAMENTOS } from '../dados.js';
import { avaliar, historicoDoExercicio } from '../progressao.js';
import { obterEstado, atualizar } from '../estado.js';
import { abrirSheet, fecharSheet, confirmar, toast } from '../ui.js';
import { prepararAudio, iniciarDescanso, pararDescanso } from '../cronometro.js';
import { compartilharCard } from '../compartilhar.js';
import { dadosCardTreino } from '../cards.js';
import { sincronizarRanking } from '../ranking.js';
import { indiceAtual, ajustarCarga, ajustarReps, copiarCargaSeguintes, lerIndiceGuardado, guardarIndice } from '../sessao-ui.js';
import { pop, rolarNumero } from '../movimento.js';
import { ic } from '../icones.js';

let intervaloTempo = null;
// série escolhida na mão dentro do exercício aberto ({ i, s }); some quando ela é feita
let serieEscolhida = null;
// exercício já concluído aberto pela lista (a regra do exercício atual pularia ele): { sessaoId, i }
let itemAberto = null;

const nomeDe = (est, id) => est.exercicios[id]?.nome ?? id;

function contarSeries(sessao) {
  let total = 0, feitas = 0;
  for (const it of sessao.itens) {
    total += it.registros.length;
    feitas += it.registros.filter(r => r.feita).length;
  }
  return { total, feitas };
}

// Resumo "40 kg × 12, 12, 11"; agrupa por carga quando ela muda entre as séries.
function resumirRegistros(registros) {
  const grupos = [];
  for (const r of registros) {
    const ultimo = grupos[grupos.length - 1];
    if (ultimo && ultimo.carga === r.carga) ultimo.reps.push(r.reps);
    else grupos.push({ carga: r.carga, reps: [r.reps] });
  }
  return grupos
    .map(g => `${g.carga == null ? '' : `${formatarKg(g.carga)} × `}${g.reps.join(', ')}`)
    .join(' · ');
}

const tempoTreino = sa => {
  const s = Math.max(0, Math.floor((Date.now() - new Date(sa.inicio).getTime()) / 1000));
  const h = Math.floor(s / 3600), m = Math.floor(s / 60) % 60, seg = String(s % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${seg}` : `${m}:${seg}`;
};

// índice do exercício aberto e da série atual dentro dele
function posicao(sa) {
  const i = itemAberto && itemAberto.sessaoId === sa.id && sa.itens[itemAberto.i]
    ? itemAberto.i : indiceAtual(sa, lerIndiceGuardado(sa.id));
  const regs = sa.itens[i]?.registros || [];
  const escolhida = serieEscolhida && serieEscolhida.i === i && regs[serieEscolhida.s] && !regs[serieEscolhida.s].feita
    ? serieEscolhida.s : null;
  return { i, s: escolhida ?? regs.findIndex(r => !r.feita) };
}

const textoCarga = c => (c == null ? '—' : `${formatarCampo(c)}<small>kg</small>`);

function renderSugestao(aval, i) {
  if (aval.status === 'aumentar') {
    return `<div class="bloco bloco-sage sugestao a" data-sec="sugestao"><div><strong>Pode aumentar para ${formatarKg(aval.cargaSugerida)}</strong><span>Você fez o máximo de repetições da última vez</span></div>
      <button type="button" class="pilula pilula-esc pilula-mini" data-acao="aplicar" data-i="${i}" data-carga="${aval.cargaSugerida}">Aplicar</button></div>`;
  }
  if (aval.status === 'reduzir') {
    return `<div class="bloco bloco-sand sugestao a" data-sec="sugestao"><div><strong>Sugestão: baixar para ${formatarKg(aval.cargaSugerida)}</strong><span>As repetições ficaram abaixo da faixa</span></div>
      <button type="button" class="pilula pilula-esc pilula-mini" data-acao="aplicar" data-i="${i}" data-carga="${aval.cargaSugerida}">Aplicar</button></div>`;
  }
  return '';
}

function renderCartao(est, sa) {
  const { i, s } = posicao(sa);
  const it = sa.itens[i];
  if (!it) return '';
  const ex = est.exercicios[it.exercicioId];
  const aval = ex ? avaliar(historicoDoExercicio(est.sessoes, it.exercicioId), ex) : { status: 'novo', ultima: null };
  const grupo = ex ? GRUPOS[ex.grupo] ?? '' : '';
  const ultima = aval.ultima ? `última vez ${resumirRegistros(aval.ultima.registros)} · ${formatarData(aval.ultima.data)}` : 'primeira vez';
  const etapas = it.registros.map((r, k) => `<button type="button" class="etapa num${r.feita ? ' f' : ''}${k === s ? ' a' : ''}" data-acao="etapa" data-s="${k}" aria-pressed="${r.feita}" aria-label="Série ${k + 1}${r.feita ? ' feita (toque para desfazer)' : ''}">${r.feita ? esc(`${r.carga == null ? '' : formatarCampo(r.carga) + ' × '}${r.reps}`) : `Série ${k + 1}`}</button>`).join('');
  const r = s >= 0 ? it.registros[s] : null;
  const controles = r ? `
      <div class="passos num">
        <div class="passo"><small>CARGA</small><div class="passo-r">
          <button type="button" data-acao="carga" data-d="-1" aria-label="Menos carga">${ic('menos')}</button>
          <button type="button" class="passo-valor" data-acao="digitar" data-campo="carga" aria-label="Digitar carga">${textoCarga(r.carga)}</button>
          <button type="button" data-acao="carga" data-d="1" aria-label="Mais carga">${ic('mais')}</button></div></div>
        <div class="passo"><small>REPETIÇÕES</small><div class="passo-r">
          <button type="button" data-acao="reps" data-d="-1" aria-label="Menos repetições">${ic('menos')}</button>
          <button type="button" class="passo-valor" data-acao="digitar" data-campo="reps" aria-label="Digitar repetições">${r.reps ?? '—'}</button>
          <button type="button" data-acao="reps" data-d="1" aria-label="Mais repetições">${ic('mais')}</button></div></div>
      </div>
      <button type="button" class="btn-grande" data-acao="feita">${ic('ok')}Série ${s + 1} feita</button>`
    : `<button type="button" class="btn-grande" disabled>${ic('ok')}Exercício concluído</button>`;
  return `
    <article class="bloco bloco-sky exercicio" data-i="${i}">
      <div class="cartao-topo rotulo"><span>Exercício ${i + 1} de ${sa.itens.length}</span><span>${esc(grupo)}${ex?.unilateral ? ' · cada lado' : ''}</span></div>
      <h2 class="ex-nome">${esc(nomeDe(est, it.exercicioId))}</h2>
      ${it.trocadoDe ? `<p class="cartao-meta">no lugar de ${esc(nomeDe(est, it.trocadoDe))}</p>` : ''}
      <p class="cartao-meta">${it.registros.length} × ${it.repMin}–${it.repMax} · descanso ${formatarDescanso(it.descanso)} · ${esc(ultima)}</p>
      <div class="etapas">${etapas}</div>
      ${controles}
      <div class="cartao-acoes">
        <button type="button" class="pilula pilula-mini" data-acao="dica">${ic('info')}Como fazer</button>
        <button type="button" class="pilula pilula-mini" data-acao="trocar">${ic('troca')}Trocar</button>
        <button type="button" class="pilula pilula-mini" data-acao="mais" aria-label="Mais uma série">+ série</button>
        <button type="button" class="pilula pilula-mini" data-acao="menos" aria-label="Uma série a menos">− série</button>
      </div>
    </article>
    ${r ? renderSugestao(aval, i) : ''}`;
}

function renderProgresso(sa) {
  const { total, feitas } = contarSeries(sa);
  const segs = sa.itens.map(it => {
    const f = it.registros.filter(r => r.feita).length;
    return `<i><b style="width:${it.registros.length ? Math.round(f / it.registros.length * 100) : 0}%"></b></i>`;
  }).join('');
  return `<div class="prog" role="progressbar" aria-label="Séries feitas" aria-valuemin="0" aria-valuemax="${total}" aria-valuenow="${feitas}" aria-valuetext="${feitas} de ${total} séries">${segs}</div>
    <p class="rotulo prog-texto"><span class="progresso">${feitas}/${total} séries</span></p>`;
}

function renderLista(est, sa) {
  const { i: atual } = posicao(sa);
  return sa.itens.map((it, i) => {
    const f = it.registros.filter(r => r.feita).length, ok = it.registros.length > 0 && f === it.registros.length;
    return `<button type="button" class="item-lista tocavel${i === atual ? ' agora' : ''}${ok ? ' concluido' : ''}" data-acao="ir-item" data-i="${i}">
      <span><span class="item-nome">${esc(nomeDe(est, it.exercicioId))}</span><span class="sub num">${ok ? esc(resumirRegistros(it.registros)) : `${it.registros.length} × ${it.repMin}–${it.repMax}`}</span></span>
      ${ok ? `<span class="ok-ic">${ic('ok')}</span>` : `<span class="sub num">${f}/${it.registros.length}</span>`}</button>`;
  }).join('');
}

export function render() {
  const est = obterEstado();
  const sa = est.sessaoAtual;
  if (!sa) {
    return `
      <div class="tela-treino">
        <div class="cab-tela"><h1 class="titulo-tela">Nenhum treino em andamento</h1></div>
        <a class="btn-grande" href="#/hoje">Ir para Hoje</a>
      </div>`;
  }
  const treino = est.treinos.find(t => t.id === sa.treinoId);
  return `
    <div class="tela-treino">
      <header class="cab-tela treino-cab a">
        <a class="redondo tocavel" href="#/hoje" aria-label="Voltar para Hoje (o treino continua)">${ic('volta')}</a>
        <h1 class="titulo-tela treino-nome">${esc(treino ? `Treino ${treino.id}` : 'Treino')}</h1>
        <span class="pilula num tempo" aria-label="Tempo de treino">${tempoTreino(sa)}</span>
        <button type="button" class="redondo tocavel" data-acao="menu" aria-label="Mais opções">${ic('mais3')}</button>
      </header>
      <div class="a" data-parte="progresso">${renderProgresso(sa)}</div>
      <div class="a" data-parte="cartao">${renderCartao(est, sa)}</div>
      <div class="secao a">Exercícios</div>
      <div class="linhas lista-itens a" data-parte="lista">${renderLista(est, sa)}</div>
      <button type="button" class="btn-grande claro fim-treino a" data-acao="finalizar">Finalizar treino</button>
    </div>`;
}

// Redesenha só as partes que mudam (sem re-render da tela inteira: preserva rolagem e animações).
function redesenhar(raiz, { cartao = true, deslizar = 0 } = {}) {
  const est = obterEstado(), sa = est.sessaoAtual;
  if (!sa) return;
  const tela = raiz.querySelector('.tela-treino');
  if (!tela) return;
  tela.querySelector('[data-parte="progresso"]').innerHTML = renderProgresso(sa);
  tela.querySelector('[data-parte="lista"]').innerHTML = renderLista(est, sa);
  if (!cartao) return;
  const box = tela.querySelector('[data-parte="cartao"]');
  if (!deslizar || typeof box.animate !== 'function' || matchMedia('(prefers-reduced-motion: reduce)').matches) {
    box.innerHTML = renderCartao(est, sa);
    return;
  }
  box.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: `translateX(${-deslizar * 44}px)` }], { duration: 220, easing: 'ease-in' })
    .onfinish = () => {
      box.innerHTML = renderCartao(obterEstado(), obterEstado().sessaoAtual);
      box.animate([{ opacity: 0, transform: `translateX(${deslizar * 44}px)` }, { opacity: 1, transform: 'none' }], { duration: 380, easing: 'cubic-bezier(.3,1.2,.5,1)' });
    };
}

// Aplica uma mudança estrutural (re-render) preservando a rolagem.
function mutar(fn) {
  const y = window.scrollY;
  atualizar(fn);
  window.scrollTo(0, y);
}

function descartar() {
  atualizar(e => { e.sessaoAtual = null; }, { renderizar: false });
  pararDescanso();
  location.hash = '#/hoje';
}

async function finalizar() {
  const sa = obterEstado().sessaoAtual;
  if (!sa) return;
  const { total, feitas } = contarSeries(sa);
  if (feitas === 0) {
    if (await confirmar('Nenhuma série foi marcada. Descartar este treino?', 'Descartar', true)) descartar();
    return;
  }
  if (feitas < total && !(await confirmar('Ainda há séries não marcadas. Finalizar mesmo assim?', 'Finalizar'))) return;
  const idDaSessao = obterEstado().sessaoAtual.id;
  atualizar(e => {
    const s = e.sessaoAtual;
    s.fim = new Date().toISOString();
    delete s.descansoAte;
    s.itens = s.itens
      .map(it => ({ ...it, registros: it.registros.filter(r => r.feita) }))
      .filter(it => it.registros.length > 0);
    e.sessoes.push(s);
    e.ultimoTreinoId = s.treinoId;
    e.sessaoAtual = null;
  }, { renderizar: false });
  pararDescanso();
  sincronizarRanking(); // publica os totais no grupo (silencioso se offline ou sem grupo)
  location.hash = `#/resumo/${idDaSessao}`;
}

// Toque no número: troca o botão por um campo de texto (Enter ou sair do campo confirma).
function abrirDigitacao(raiz, botao) {
  const ehCarga = botao.dataset.campo === 'carga';
  const sa = obterEstado().sessaoAtual;
  const { i, s } = posicao(sa);
  const r = sa.itens[i].registros[s];
  const campo = document.createElement('input');
  campo.className = ehCarga ? 'carga passo-campo' : 'reps passo-campo';
  campo.inputMode = ehCarga ? 'decimal' : 'numeric';
  campo.value = ehCarga ? (r.carga == null ? '' : formatarCampo(r.carga)) : (r.reps ?? '');
  campo.setAttribute('aria-label', ehCarga ? `Carga série ${s + 1}` : `Repetições série ${s + 1}`);
  botao.replaceWith(campo);
  campo.focus();
  campo.select();
  let feito = false;
  const confirmarCampo = () => {
    if (feito) return;
    const texto = campo.value.trim();
    const valor = ehCarga ? parseCarga(texto) : parseReps(texto);
    if (valor === null || (!ehCarga && valor < 1)) { campo.classList.add('invalido'); return; }
    feito = true;
    atualizar(e => {
      const regs = e.sessaoAtual?.itens[i]?.registros;
      if (!regs || regs[s].feita) return;
      if (ehCarga) { regs[s].carga = valor; copiarCargaSeguintes(regs, s, valor); } else regs[s].reps = valor;
    }, { renderizar: false });
    redesenhar(raiz);
  };
  campo.onkeydown = ev => { if (ev.key === 'Enter') { ev.preventDefault(); confirmarCampo(); } };
  campo.onblur = confirmarCampo;
}

function ajustar(raiz, botao) {
  const ehCarga = botao.dataset.acao === 'carga';
  const d = Number(botao.dataset.d);
  const est = obterEstado(), sa = est.sessaoAtual;
  const { i, s } = posicao(sa);
  if (s < 0) return;
  const ex = est.exercicios[sa.itens[i].exercicioId];
  atualizar(e => {
    const regs = e.sessaoAtual.itens[i].registros;
    if (ehCarga) {
      regs[s].carga = ajustarCarga(regs[s].carga, d, ex?.incremento || 1);
      copiarCargaSeguintes(regs, s, regs[s].carga);
    } else regs[s].reps = ajustarReps(regs[s].reps, d);
  }, { renderizar: false });
  const r = obterEstado().sessaoAtual.itens[i].registros[s];
  const alvo = botao.parentElement.querySelector('.passo-valor');
  if (alvo) rolarNumero(alvo, ehCarga ? textoCarga(r.carga) : String(r.reps), d);
}

function aoFeita(raiz) {
  prepararAudio();
  const sa = obterEstado().sessaoAtual;
  const { i, s } = posicao(sa);
  const item = sa.itens[i];
  const r = item?.registros[s];
  if (!r) return;
  if (r.carga == null || parseReps(r.reps) === null) { toast('Preencha carga e repetições'); return; }
  atualizar(e => { e.sessaoAtual.itens[i].registros[s].feita = true; }, { renderizar: false });
  serieEscolhida = null;
  iniciarDescanso(item.descanso);
  const agora = obterEstado().sessaoAtual;
  const concluiu = agora.itens[i].registros.every(x => x.feita);
  redesenhar(raiz);
  const etapa = raiz.querySelectorAll('.etapa')[s];
  if (etapa) pop(etapa);
  if (concluiu) {
    const prox = indiceAtual(agora, null);
    if (prox !== i && agora.itens[prox].registros.some(x => !x.feita)) {
      guardarIndice(agora.id, prox);
      itemAberto = null;
      setTimeout(() => { if (obterEstado().sessaoAtual?.id === agora.id) redesenhar(raiz, { deslizar: 1 }); }, 750);
    } else {
      toast('Tudo feito! Pode finalizar o treino');
    }
  }
}

function tocarEtapa(raiz, k) {
  const sa = obterEstado().sessaoAtual;
  const { i } = posicao(sa);
  const r = sa.itens[i].registros[k];
  if (!r) return;
  if (r.feita) {
    atualizar(e => { e.sessaoAtual.itens[i].registros[k].feita = false; }, { renderizar: false });
    pararDescanso();
    guardarIndice(sa.id, i);
    itemAberto = null;
  }
  serieEscolhida = { i, s: k };
  redesenhar(raiz);
}

function abrirItem(raiz, i) {
  const sa = obterEstado().sessaoAtual;
  const atual = posicao(sa).i;
  if (i === atual) return;
  serieEscolhida = null;
  if (sa.itens[i].registros.some(r => !r.feita)) { guardarIndice(sa.id, i); itemAberto = null; }
  else itemAberto = { sessaoId: sa.id, i }; // concluído: abre só para ver/corrigir
  redesenhar(raiz, { deslizar: i > atual ? 1 : -1 });
}

function abrirDica(i) {
  const est = obterEstado();
  const it = est.sessaoAtual.itens[i];
  const ex = est.exercicios[it.exercicioId];
  abrirSheet(`
    <h2 class="sheet-titulo">${esc(nomeDe(est, it.exercicioId))}</h2>
    <p class="rotulo">${esc(ex ? EQUIPAMENTOS[ex.equipamento] ?? '' : '')}</p>
    <p>${esc(ex?.dica || 'Sem dica cadastrada.')}</p>
    <button type="button" class="btn-grande" data-acao="fechar">Entendi</button>`,
  el => { el.querySelector('[data-acao="fechar"]').onclick = fecharSheet; });
}

function abrirMenu() {
  abrirSheet(`
    <div class="pilha">
      <button type="button" class="btn-grande perigo" data-acao="descartar">Descartar treino</button>
      <button type="button" class="btn-grande claro" data-acao="fechar">Fechar</button>
    </div>`,
  el => {
    el.querySelector('[data-acao="fechar"]').onclick = fecharSheet;
    el.querySelector('[data-acao="descartar"]').onclick = async () => {
      fecharSheet();
      if (await confirmar('Descartar o treino em andamento? As séries marcadas serão perdidas.', 'Descartar', true)) descartar();
    };
  });
}

function aoClicar(ev) {
  const raiz = ev.currentTarget;
  const b = ev.target.closest('[data-acao]');
  if (!b || !b.closest('.tela-treino')) return;
  const sa = obterEstado().sessaoAtual;
  if (!sa) return;
  const i = b.dataset.i !== undefined ? Number(b.dataset.i) : posicao(sa).i;
  const acao = b.dataset.acao;
  if (acao === 'feita') aoFeita(raiz);
  else if (acao === 'carga' || acao === 'reps') ajustar(raiz, b);
  else if (acao === 'digitar') abrirDigitacao(raiz, b);
  else if (acao === 'etapa') tocarEtapa(raiz, Number(b.dataset.s));
  else if (acao === 'ir-item') abrirItem(raiz, i);
  else if (acao === 'aplicar') {
    const carga = Number(b.dataset.carga);
    mutar(e => e.sessaoAtual.itens[i].registros.forEach(r => { if (!r.feita) r.carga = carga; }));
    toast(`Carga ajustada para ${formatarKg(carga)}`);
  } else if (acao === 'mais') {
    mutar(e => {
      const item = e.sessaoAtual.itens[i];
      const ult = item.registros[item.registros.length - 1];
      item.registros.push({ carga: ult ? ult.carga : null, reps: ult ? ult.reps : item.repMax, feita: false });
    });
  } else if (acao === 'menos') {
    const regs = sa.itens[i].registros;
    const k = regs.map(r => r.feita).lastIndexOf(false);
    if (k < 0) toast('Não há série pendente para remover');
    else if (regs.length <= 1) toast('O exercício precisa de ao menos uma série');
    else mutar(e => { e.sessaoAtual.itens[i].registros.splice(k, 1); });
  } else if (acao === 'dica') abrirDica(i);
  else if (acao === 'trocar') import('./trocar.js').then(m => m.abrirTrocar(i));
  else if (acao === 'menu') abrirMenu();
  else if (acao === 'finalizar') finalizar();
}

export function montar(raiz) {
  // atribuição (e não addEventListener) para não empilhar handlers a cada render
  raiz.onclick = aoClicar;
  clearInterval(intervaloTempo);
  intervaloTempo = null;
  if (!raiz.querySelector('.tela-treino .tempo')) return;
  // relógio do treino a cada segundo; para sozinho quando a tela sai do DOM
  intervaloTempo = setInterval(() => {
    const el = document.querySelector('.tela-treino .tempo');
    const sa = obterEstado().sessaoAtual;
    if (!el || !sa) { clearInterval(intervaloTempo); intervaloTempo = null; return; }
    el.textContent = tempoTreino(sa);
  }, 1000);
}

export function renderResumo(sessaoId) {
  const est = obterEstado();
  const s = est.sessoes.find(x => x.id === sessaoId);
  if (!s) {
    return `
      <div class="tela-resumo">
        <h1 class="titulo">Treino não encontrado</h1>
        <a class="btn btn-principal btn-bloco" href="#/hoje">Voltar ao início</a>
      </div>`;
  }
  const treino = est.treinos.find(t => t.id === s.treinoId);
  const nome = treino ? `Treino ${treino.id} — ${treino.nome}` : 'Treino';
  const { total } = contarSeries(s);
  const volume = s.itens.reduce((v, it) => v + it.registros.reduce((a, r) => a + (r.carga || 0) * r.reps, 0), 0);
  const duracao = formatarDuracao(new Date(s.fim).getTime() - new Date(s.inicio).getTime());
  const lista = s.itens.map(it =>
    `<li><span>${esc(nomeDe(est, it.exercicioId))}</span><span class="muted">${esc(resumirRegistros(it.registros))}</span></li>`
  ).join('');
  const subir = s.itens.map(it => {
    const ex = est.exercicios[it.exercicioId];
    if (!ex) return null;
    const a = avaliar(historicoDoExercicio(est.sessoes, it.exercicioId), ex);
    return a.status === 'aumentar' ? `${nomeDe(est, it.exercicioId)}: ${formatarKg(a.cargaAtual)} → ${formatarKg(a.cargaSugerida)}` : null;
  }).filter(Boolean);
  return `
    <div class="tela-resumo">
      <h1 class="titulo">Treino concluído 🎉</h1>
      <section class="card card-destaque">
        <h2 class="treino-nome">${esc(nome)}</h2>
        <p class="muted">${duracao} · ${total} séries · ${formatarNumero(volume)} kg de volume</p>
      </section>
      <section class="card"><ul class="lista-ex">${lista}</ul></section>
      <section class="card">
        ${subir.length
          ? `<h2>Na próxima, pode aumentar:</h2><ul class="lista-ex">${subir.map(t => `<li>${esc(t)}</li>`).join('')}</ul>`
          : '<p>Continue firme — mesma carga na próxima.</p>'}
      </section>
      <button type="button" class="btn btn-sec btn-bloco" data-acao="compartilhar">Compartilhar</button>
      <a class="btn btn-principal btn-bloco" href="#/hoje">Voltar ao início</a>
    </div>`;
}

export function montarResumo(raiz, sessaoId) {
  const botao = raiz.querySelector('.tela-resumo [data-acao="compartilhar"]');
  if (!botao) return;
  botao.onclick = () => {
    const est = obterEstado();
    const s = est.sessoes.find(x => x.id === sessaoId);
    if (s) compartilharCard('Treino concluído', () => dadosCardTreino(obterEstado(), s));
  };
}
