// Cardio de aparelho, registro manual: #/cardio/aparelho/novo e #/cardio/aparelho/<id>.
import { esc, parseNumero, formatarCampo, hojeISO, gerarId } from '../util.js';
import { ICONE_CARDIO, ROTULO_CARDIO, kcalAparelho, pesoAtual } from '../cardio.js';
import { obterEstado, atualizar } from '../estado.js';
import { confirmar, toast } from '../ui.js';
import { apagarTrajeto } from '../trajetos.js';
import { sincronizarRanking } from '../ranking.js';

const TIPOS = ['esteira', 'bicicleta', 'eliptico', 'escada', 'outro'];
const OBS_MAX = 200;

// 'AAAA-MM-DD' → Date local às 12:00 (sem new Date('AAAA-MM-DD'), que vira UTC)
function meioDia(dia) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dia || '');
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12, 0, 0, 0);
  // rejeita datas inexistentes (31/02 viraria março)
  return d.getMonth() === Number(m[2]) - 1 && d.getDate() === Number(m[3]) ? d : null;
}

const naoEncontrado = () => `
  <div class="tela-cardio-aparelho">
    <a class="voltar" href="#/historico">← Histórico</a>
    <h1 class="titulo">Registro não encontrado</h1>
    <a class="btn btn-principal btn-bloco" href="#/historico">Voltar ao Histórico</a>
  </div>`;

export function render(param) {
  const est = obterEstado();
  const novo = param === 'novo';
  const c = novo ? null : est.cardios.find(x => x.id === param && x.modo === 'aparelho');
  if (!novo && !c) return naoEncontrado();
  const tipo = c ? c.tipo : 'esteira';
  const chips = TIPOS.map(t => `
    <button type="button" class="chip${t === tipo ? ' chip-ativo' : ''}" data-acao="tipo" data-tipo="${t}" aria-pressed="${t === tipo}">
      ${ICONE_CARDIO[t]} ${ROTULO_CARDIO[t]}</button>`).join('');
  const dia = c ? hojeISO(new Date(c.inicio)) : hojeISO();
  const duracaoMin = c ? c.duracaoSeg / 60 : null;
  const semPeso = pesoAtual(est) == null;
  // kcal estimada pelo app: campo vazio (reestima ao salvar); digitada pela usuária: mantém
  const kcalValor = c && !c.kcalEstimada && c.kcal != null ? c.kcal : '';
  return `
    <div class="tela-cardio-aparelho" data-id="${esc(c ? c.id : '')}">
      <a class="voltar" href="${novo ? '#/hoje' : `#/cardio/${encodeURIComponent(c.id)}`}">← ${novo ? 'Hoje' : 'Detalhe'}</a>
      <h1 class="titulo">${novo ? 'Registrar aparelho' : 'Editar cardio'}</h1>
      <section class="card">
        <div class="chips">${chips}</div>
        <label>Data<input type="date" data-campo="data" max="${hojeISO()}" value="${esc(dia)}"></label>
        <div class="campos-presc">
          <label>Duração (min)<input type="text" inputmode="decimal" data-campo="duracao" value="${duracaoMin != null ? esc(formatarCampo(duracaoMin)) : ''}"></label>
          <label>Distância (km, opcional)<input type="text" inputmode="decimal" data-campo="distancia" value="${c && c.distanciaM != null ? esc(String(c.distanciaM / 1000).replace('.', ',')) : ''}"></label>
          <label>Calorias (opcional)<input type="text" inputmode="numeric" data-campo="kcal" placeholder="estimadas pelo app" value="${esc(kcalValor)}"></label>
          <label>FC média (bpm, opcional)<input type="text" inputmode="numeric" data-campo="fc" value="${c && c.fcMedia != null ? esc(c.fcMedia) : ''}"></label>
        </div>
        ${semPeso ? '<p class="muted">Sem peso registrado no Corpo, não consigo estimar as calorias.</p>' : ''}
        <label>Observação (opcional)<textarea data-campo="obs" maxlength="${OBS_MAX}">${esc(c ? c.obs : '')}</textarea></label>
      </section>
      <p class="form-erro" data-erro hidden></p>
      <button type="button" class="btn btn-principal btn-bloco" data-acao="salvar">Salvar</button>
      ${novo ? '' : '<button type="button" class="btn btn-perigo btn-bloco" data-acao="excluir">Excluir</button>'}
    </div>`;
}

export function montar(raiz, param) {
  const tela = raiz.querySelector('.tela-cardio-aparelho');
  if (!tela || !tela.querySelector('[data-acao="salvar"]')) return;
  const original = param === 'novo' ? null : obterEstado().cardios.find(x => x.id === param);
  let tipo = original ? original.tipo : 'esteira';
  const q = s => tela.querySelector(s);
  const campo = n => q(`[data-campo="${n}"]`);
  const erro = q('[data-erro]');
  const mostrarErro = txt => { erro.textContent = txt; erro.hidden = !txt; };

  tela.querySelectorAll('[data-acao="tipo"]').forEach(b => {
    b.onclick = () => {
      tipo = b.dataset.tipo;
      tela.querySelectorAll('[data-acao="tipo"]').forEach(x => {
        x.classList.toggle('chip-ativo', x === b);
        x.setAttribute('aria-pressed', String(x === b));
      });
    };
  });

  const marcar = (nome, ruim) => { campo(nome).classList.toggle('invalido', ruim); return ruim; };

  q('[data-acao="salvar"]').onclick = () => {
    tela.querySelectorAll('.invalido').forEach(i => i.classList.remove('invalido'));
    const diaTxt = campo('data').value;
    const inicio = meioDia(diaTxt);
    if (marcar('data', !inicio || diaTxt > hojeISO())) { mostrarErro('Escolha uma data válida (hoje ou antes).'); return; }

    const min = parseNumero(campo('duracao').value.trim());
    if (marcar('duracao', min == null || min < 1 || min > 600)) { mostrarErro('A duração precisa estar entre 1 e 600 minutos.'); return; }

    const kmTxt = campo('distancia').value.trim();
    const km = kmTxt === '' ? null : parseNumero(kmTxt);
    if (marcar('distancia', kmTxt !== '' && (km == null || km <= 0 || km > 500))) { mostrarErro('Confira a distância (em km, maior que zero).'); return; }

    const kcalTxt = campo('kcal').value.trim();
    const kcalInformada = kcalTxt === '' ? null : parseNumero(kcalTxt);
    if (marcar('kcal', kcalTxt !== '' && (kcalInformada == null || kcalInformada <= 0 || kcalInformada > 20000))) { mostrarErro('Confira as calorias.'); return; }

    const fcTxt = campo('fc').value.trim();
    const fc = fcTxt === '' ? null : parseNumero(fcTxt);
    if (marcar('fc', fcTxt !== '' && (fc == null || fc < 40 || fc > 220))) { mostrarErro('A frequência cardíaca média deve estar entre 40 e 220 bpm.'); return; }

    mostrarErro('');
    const duracaoSeg = Math.round(min * 60);
    const distanciaM = km == null ? null : Math.round(km * 1000);
    const estimada = kcalInformada == null;
    const kcal = estimada
      ? kcalAparelho({ tipo, duracaoSeg, distanciaM }, pesoAtual(obterEstado()))
      : Math.round(kcalInformada);
    const registro = {
      id: original ? original.id : gerarId('c_'),
      modo: 'aparelho', tipo,
      inicio: inicio.toISOString(),
      fim: new Date(inicio.getTime() + duracaoSeg * 1000).toISOString(),
      duracaoSeg, distanciaM,
      kcal, kcalEstimada: estimada && kcal != null,
      subidaM: null, altMin: null, altMax: null,
      fcMedia: fc == null ? null : Math.round(fc),
      obs: campo('obs').value.trim().slice(0, OBS_MAX),
      trajetoId: null
    };
    atualizar(e => {
      const i = e.cardios.findIndex(x => x.id === registro.id);
      if (i >= 0) e.cardios[i] = registro; else e.cardios.push(registro);
    }, { renderizar: false });
    sincronizarRanking();
    toast('Cardio salvo');
    location.hash = '#/historico';
  };

  const excluir = q('[data-acao="excluir"]');
  if (excluir) {
    excluir.onclick = async () => {
      if (!(await confirmar('Excluir este cardio?', 'Excluir', true))) return;
      atualizar(e => { e.cardios = e.cardios.filter(x => x.id !== original.id); }, { renderizar: false });
      if (original.trajetoId) apagarTrajeto(original.trajetoId).catch(() => {});
      sincronizarRanking();
      toast('Cardio excluído');
      location.hash = '#/historico';
    };
  }
}
