// Tela de treino em andamento (#/treino) e resumo ao finalizar (#/resumo/<id>).
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

// Cards que a usuária expandiu/recolheu na mão (índice → true = aberto), por sessão.
let aberturaManual = new Map();
let sessaoDaAbertura = null;
let intervaloTempo = null;

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

function renderSerie(r, s) {
  const n = s + 1;
  return `
    <div class="serie${r.feita ? ' feita' : ''}" data-s="${s}">
      <span class="serie-n">${n}</span>
      <input class="carga" inputmode="decimal" placeholder="kg" value="${r.carga == null ? '' : formatarCampo(r.carga)}" aria-label="Carga série ${n}"${r.feita ? ' disabled' : ''}>
      <input class="reps" inputmode="numeric" placeholder="reps" value="${r.reps == null ? '' : r.reps}" aria-label="Repetições série ${n}"${r.feita ? ' disabled' : ''}>
      <button type="button" class="btn btn-icone serie-ok" data-acao="feita" aria-pressed="${r.feita}" aria-label="Série ${n} feita">✓</button>
    </div>`;
}

function renderSelo(aval) {
  if (aval.status === 'aumentar') {
    return `<div class="selo-ok">↑ Pode aumentar → ${formatarKg(aval.cargaSugerida)} <button type="button" class="btn-selo" data-acao="aplicar" data-carga="${aval.cargaSugerida}">Aplicar</button></div>`;
  }
  if (aval.status === 'reduzir') {
    return `<div class="selo-warn">Sugestão: baixar para ${formatarKg(aval.cargaSugerida)} <button type="button" class="btn-selo" data-acao="aplicar" data-carga="${aval.cargaSugerida}">Aplicar</button></div>`;
  }
  return '';
}

function renderCard(est, it, i, aberto) {
  const ex = est.exercicios[it.exercicioId];
  const aval = ex ? avaliar(historicoDoExercicio(est.sessoes, it.exercicioId), ex) : { status: 'novo', ultima: null };
  const feitas = it.registros.filter(r => r.feita);
  const concluido = it.registros.length > 0 && feitas.length === it.registros.length;
  const grupo = ex ? GRUPOS[ex.grupo] ?? '' : '';
  const unilateral = ex?.unilateral ? ' · cada lado' : '';
  const ultima = aval.ultima
    ? `Última vez: ${resumirRegistros(aval.ultima.registros)} · ${formatarData(aval.ultima.data)}`
    : 'Primeira vez';
  const resumo = concluido ? `${resumirRegistros(it.registros)} ✓` : `${feitas.length}/${it.registros.length} séries`;
  return `
    <article class="card exercicio${aberto ? '' : ' recolhido'}${concluido ? ' concluido' : ''}" data-i="${i}">
      <div class="card-cab" data-acao="alternar" role="button" tabindex="0" aria-expanded="${aberto}">
        <h2 class="ex-nome">${esc(nomeDe(est, it.exercicioId))}</h2>
        <p class="muted">${esc(grupo)}${unilateral} · ${it.series} × ${it.repMin}–${it.repMax} · ${formatarDescanso(it.descanso)}</p>
        ${it.trocadoDe ? `<p class="muted">no lugar de ${esc(nomeDe(est, it.trocadoDe))}</p>` : ''}
        <p class="card-resumo">${esc(resumo)}</p>
      </div>
      <div class="corpo">
        <div class="card-botoes">
          <button type="button" class="btn btn-sec" data-acao="dica" aria-label="Dica do exercício">ⓘ</button>
          <button type="button" class="btn btn-sec" data-acao="trocar">Trocar</button>
        </div>
        <p class="muted">${esc(ultima)}</p>
        ${renderSelo(aval)}
        ${it.registros.map((r, s) => renderSerie(r, s)).join('')}
        <div class="card-botoes">
          <button type="button" class="btn btn-sec" data-acao="mais">+ série</button>
          <button type="button" class="btn btn-sec" data-acao="menos">− série</button>
        </div>
      </div>
    </article>`;
}

export function render() {
  const est = obterEstado();
  const sa = est.sessaoAtual;
  if (!sa) {
    return `
      <div class="tela-treino">
        <h1 class="titulo">Nenhum treino em andamento</h1>
        <a class="btn btn-principal btn-bloco" href="#/hoje">Ir para Hoje</a>
      </div>`;
  }
  if (sessaoDaAbertura !== sa.id) { aberturaManual = new Map(); sessaoDaAbertura = sa.id; }
  const treino = est.treinos.find(t => t.id === sa.treinoId);
  const nome = treino ? `Treino ${treino.id} — ${treino.nome}` : 'Treino';
  const { total, feitas } = contarSeries(sa);
  const primeiroPendente = sa.itens.findIndex(it => it.registros.some(r => !r.feita));
  const cards = sa.itens.map((it, i) => {
    const concluido = it.registros.length > 0 && it.registros.every(r => r.feita);
    const aberto = aberturaManual.has(i) ? aberturaManual.get(i) : (!concluido || i === primeiroPendente);
    return renderCard(est, it, i, aberto);
  }).join('');
  return `
    <div class="tela-treino">
      <header class="treino-cab">
        <div>
          <h1 class="treino-nome">${esc(nome)}</h1>
          <p class="muted"><span class="tempo">${formatarDuracao(Date.now() - new Date(sa.inicio).getTime())}</span> · <span class="progresso">${feitas}/${total} séries</span></p>
        </div>
        <button type="button" class="btn btn-sec btn-icone" data-acao="menu" aria-label="Mais opções">⋯</button>
        <div class="barra-progresso" role="progressbar" aria-label="Séries feitas" aria-valuemin="0" aria-valuemax="${total}" aria-valuenow="${feitas}"><b style="width:${total ? Math.round(feitas / total * 100) : 0}%"></b></div>
      </header>
      ${cards}
      <button type="button" class="btn btn-principal btn-bloco" data-acao="finalizar">Finalizar treino</button>
    </div>`;
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

// Edição de um campo: grava sem re-renderizar (o teclado do celular não pode fechar).
function aoDigitar(campo) {
  const linha = campo.closest('.serie');
  // série feita é travada (desmarque o ✓ para editar); defesa extra além do disabled
  if (linha.classList.contains('feita')) return;
  const i = Number(campo.closest('.exercicio').dataset.i);
  const s = Number(linha.dataset.s);
  const ehCarga = campo.classList.contains('carga');
  const texto = campo.value.trim();
  const valor = ehCarga ? (texto === '' ? null : parseCarga(texto)) : parseReps(texto);
  // carga vazia é válida (grava null); qualquer outro null é entrada inválida
  if (valor === null && !(ehCarga && texto === '')) {
    campo.classList.add('invalido');
    return;
  }
  campo.classList.remove('invalido');
  atualizar(e => {
    const regs = e.sessaoAtual?.itens[i]?.registros;
    if (!regs) return;
    regs[s][ehCarga ? 'carga' : 'reps'] = valor;
    // carga da série 1 (ainda não feita) é copiada para as seguintes não feitas
    if (ehCarga && s === 0 && !regs[0].feita) {
      regs.forEach((r, k) => { if (k > 0 && !r.feita) r.carga = valor; });
    }
  }, { renderizar: false });
  if (ehCarga && s === 0) {
    const regs = obterEstado().sessaoAtual?.itens[i]?.registros ?? [];
    campo.closest('.exercicio').querySelectorAll('.serie').forEach(l => {
      const k = Number(l.dataset.s);
      if (k > 0 && regs[k] && !regs[k].feita) {
        const c = l.querySelector('.carga');
        c.value = texto;
        c.classList.remove('invalido');
      }
    });
  }
}

function aoFeita(botao) {
  prepararAudio();
  const linha = botao.closest('.serie');
  const i = Number(botao.closest('.exercicio').dataset.i);
  const s = Number(linha.dataset.s);
  const item = obterEstado().sessaoAtual.itens[i];
  if (item.registros[s].feita) {
    mutar(e => { e.sessaoAtual.itens[i].registros[s].feita = false; });
    pararDescanso();
    return;
  }
  const campoCarga = linha.querySelector('.carga'), campoReps = linha.querySelector('.reps');
  const carga = parseCarga(campoCarga.value), reps = parseReps(campoReps.value);
  campoCarga.classList.toggle('invalido', carga === null);
  campoReps.classList.toggle('invalido', reps === null);
  if (carga === null || reps === null) { toast('Preencha carga e repetições'); return; }
  mutar(e => {
    const r = e.sessaoAtual.itens[i].registros[s];
    r.carga = carga; r.reps = reps; r.feita = true;
  });
  iniciarDescanso(item.descanso);
}

function abrirDica(i) {
  const est = obterEstado();
  const it = est.sessaoAtual.itens[i];
  const ex = est.exercicios[it.exercicioId];
  abrirSheet(`
    <h2>${esc(nomeDe(est, it.exercicioId))}</h2>
    <p class="muted">${esc(ex ? EQUIPAMENTOS[ex.equipamento] ?? '' : '')}</p>
    <p>${esc(ex?.dica || 'Sem dica cadastrada.')}</p>
    <button type="button" class="btn btn-sec btn-bloco" data-acao="fechar">Fechar</button>`,
  el => { el.querySelector('[data-acao="fechar"]').onclick = fecharSheet; });
}

function abrirMenu() {
  abrirSheet(`
    <button type="button" class="btn btn-perigo btn-bloco" data-acao="descartar">Descartar treino</button>
    <button type="button" class="btn btn-sec btn-bloco" data-acao="fechar">Fechar</button>`,
  el => {
    el.querySelector('[data-acao="fechar"]').onclick = fecharSheet;
    el.querySelector('[data-acao="descartar"]').onclick = async () => {
      fecharSheet();
      if (await confirmar('Descartar o treino em andamento? As séries marcadas serão perdidas.', 'Descartar', true)) descartar();
    };
  });
}

function aoClicar(ev) {
  const b = ev.target.closest('[data-acao]');
  if (!b || !b.closest('.tela-treino')) return;
  const card = b.closest('.exercicio');
  const i = card ? Number(card.dataset.i) : null;
  const acao = b.dataset.acao;
  if (acao === 'alternar') {
    const recolhido = card.classList.toggle('recolhido');
    b.setAttribute('aria-expanded', String(!recolhido));
    aberturaManual.set(i, !recolhido);
  } else if (acao === 'feita') {
    aoFeita(b);
  } else if (acao === 'aplicar') {
    const carga = Number(b.dataset.carga);
    mutar(e => e.sessaoAtual.itens[i].registros.forEach(r => { if (!r.feita) r.carga = carga; }));
  } else if (acao === 'mais') {
    mutar(e => {
      const item = e.sessaoAtual.itens[i];
      const ult = item.registros[item.registros.length - 1];
      item.registros.push({ carga: ult ? ult.carga : null, reps: ult ? ult.reps : item.repMax, feita: false });
    });
  } else if (acao === 'menos') {
    const regs = obterEstado().sessaoAtual.itens[i].registros;
    const k = regs.map(r => r.feita).lastIndexOf(false);
    if (k < 0) toast('Não há série pendente para remover');
    else if (regs.length <= 1) toast('O exercício precisa de ao menos uma série');
    else mutar(e => { e.sessaoAtual.itens[i].registros.splice(k, 1); });
  } else if (acao === 'dica') {
    abrirDica(i);
  } else if (acao === 'trocar') {
    import('./trocar.js').then(m => m.abrirTrocar(i));
  } else if (acao === 'menu') {
    abrirMenu();
  } else if (acao === 'finalizar') {
    finalizar();
  }
}

export function montar(raiz) {
  // atribuição (e não addEventListener) para não empilhar handlers a cada render
  raiz.onclick = aoClicar;
  raiz.oninput = ev => {
    const c = ev.target;
    if (c.matches?.('.tela-treino input.carga, .tela-treino input.reps')) aoDigitar(c);
  };
  raiz.onkeydown = ev => {
    if ((ev.key === 'Enter' || ev.key === ' ') && ev.target.matches?.('.tela-treino .card-cab')) {
      ev.preventDefault();
      ev.target.click();
    }
  };
  clearInterval(intervaloTempo);
  intervaloTempo = null;
  if (!raiz.querySelector('.tela-treino .tempo')) return;
  // atualiza só o texto do tempo; para sozinho quando a tela sai do DOM
  intervaloTempo = setInterval(() => {
    const el = document.querySelector('.tela-treino .tempo');
    const sa = obterEstado().sessaoAtual;
    if (!el || !sa) { clearInterval(intervaloTempo); intervaloTempo = null; return; }
    el.textContent = formatarDuracao(Date.now() - new Date(sa.inicio).getTime());
  }, 30000);
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
