// Aba Corpo: perfil, peso, tabela de medidas e registros (#/corpo) e detalhe de uma medida (#/corpo/medida/<campo>).
import { esc, parseCarga, formatarNumero, formatarCampo, formatarDia, hojeISO } from '../util.js';
import {
  CAMPOS_CORPO, idade, imc, faixaImc, ordenarPorData, serieCampo, resumoCampo, faltaParaMeta, contarMedidas
} from '../corpo.js';
import { graficoLinha } from '../grafico.js';
import { obterEstado, atualizar } from '../estado.js';
import { comprimirImagem, salvarFoto, apagarFoto } from '../fotos.js';
import { confirmar, toast } from '../ui.js';
import { spanDif, ctxPeso, htmlAvatar, ligarAvatares } from './corpo-comum.js';
import { compartilharCard } from '../compartilhar.js';
import { dadosCardCorpo } from '../cards.js';

const MSG_GRAFICO = '<p class="muted">O gráfico aparece a partir do 2º registro.</p>';

// ---------- Perfil ----------

// "34 anos · IMC 22,1 (Normal)" — omite o que não puder ser calculado
function resumoPerfil(est) {
  const partes = [];
  const anos = idade(est.perfil.nascimento);
  if (anos != null && anos >= 0 && anos <= 120) partes.push(`${anos} anos`);
  const valorImc = imc(resumoCampo(est.medidas, 'peso').atual, est.perfil.altura);
  if (valorImc != null) partes.push(`IMC ${formatarNumero(valorImc)} (${faixaImc(valorImc)})`);
  return partes.join(' · ');
}

function htmlPerfil(est) {
  const p = est.perfil;
  const temFoto = !!p.fotoId;
  return `
    <section class="card" data-sec="perfil">
      <h2 class="sec-card">Perfil</h2>
      <div class="perfil-foto">
        ${htmlAvatar(est, 'avatar-grande')}
        <div class="perfil-foto-acoes">
          <button type="button" class="btn btn-sec" data-acao="foto-perfil">${temFoto ? 'Trocar foto' : 'Escolher foto'}</button>
          ${temFoto ? '<button type="button" class="btn btn-sec" data-acao="remover-foto-perfil">Remover</button>' : ''}
        </div>
        <input type="file" accept="image/*" hidden data-campo="arquivo-perfil">
      </div>
      <label>Nome<input type="text" data-campo="nome" maxlength="30" autocomplete="given-name" placeholder="Como quer ser chamada?" value="${esc(est.nome || '')}"></label>
      <div class="campos-presc">
        <label>Altura (cm)<input type="text" inputmode="decimal" data-campo="altura" placeholder="165" value="${p.altura != null ? esc(formatarCampo(p.altura)) : ''}"></label>
        <label>Meta de peso (kg)<input type="text" inputmode="decimal" data-campo="metaPeso" placeholder="60" value="${p.metaPeso != null ? esc(formatarCampo(p.metaPeso)) : ''}"></label>
      </div>
      <label>Data de nascimento<input type="date" data-campo="nascimento" max="${hojeISO()}" value="${esc(p.nascimento || '')}"></label>
      <p class="muted perfil-resumo" data-derivado="perfil">${esc(resumoPerfil(est))}</p>
    </section>`;
}

// ---------- Peso ----------

function htmlPeso(est) {
  const serie = serieCampo(est.medidas, 'peso');
  if (!serie.length) return '';
  const r = resumoCampo(est.medidas, 'peso');
  const ctx = ctxPeso(est);
  const falta = faltaParaMeta(r.atual, est.perfil.metaPeso);
  let linhaMeta = '';
  if (falta != null) {
    linhaMeta = Math.abs(falta) < 0.1
      ? '<p class="ok-texto">meta atingida 🎉</p>'
      : `<p class="muted">faltam ${formatarNumero(Math.abs(falta))} kg para a meta</p>`;
  }
  const desdeInicio = r.difPrimeiro != null
    ? `<p class="muted">desde o início: ${spanDif('peso', r.difPrimeiro, ctx)} kg</p>` : '';
  const grafico = serie.length >= 2 ? graficoLinha(serie, { unidade: 'kg', meta: est.perfil.metaPeso }) : MSG_GRAFICO;
  return `
    <a class="card card-link" data-sec="peso" href="#/corpo/medida/peso">
      <h2 class="sec-card">Peso</h2>
      <p class="peso-grande">${formatarNumero(r.atual)} <small>kg</small></p>
      ${desdeInicio}
      ${linhaMeta}
      <div class="grafico">${grafico}</div>
    </a>`;
}

// ---------- Medidas ----------

function htmlMedidas(est) {
  const ctx = ctxPeso(est);
  const grupos = ['Superiores', 'Inferiores'].map(grupo => {
    const linhas = CAMPOS_CORPO.filter(c => c.grupo === grupo).map(c => {
      const r = resumoCampo(est.medidas, c.campo);
      if (r.atual == null) return '';
      return `
        <a class="linha-medida" href="#/corpo/medida/${encodeURIComponent(c.campo)}">
          <span class="linha-medida-nome">${esc(c.rotulo)}</span>
          <span class="linha-medida-atual">${formatarNumero(r.atual)}</span>
          ${spanDif(c.campo, r.difAnterior, ctx)}
          ${spanDif(c.campo, r.difPrimeiro, ctx)}
        </a>`;
    }).join('');
    return linhas ? `<h3 class="sec-troca">${grupo}</h3>${linhas}` : '';
  }).join('');
  if (!grupos) return '';
  return `
    <section class="card">
      <h2 class="sec-card">Medidas <span class="muted">(cm)</span></h2>
      <div class="linha-medida linha-medida-cab muted" aria-hidden="true">
        <span class="linha-medida-nome"></span><span class="linha-medida-atual">Atual</span><span class="dif">Anterior</span><span class="dif">Início</span>
      </div>
      ${grupos}
    </section>`;
}

// ---------- Registros ----------

function htmlRegistros(est) {
  const lista = ordenarPorData(est.medidas).reverse();
  const linhas = lista.map(m => {
    const partes = [formatarDia(m.data)];
    if (typeof m.peso === 'number') partes.push(`${formatarNumero(m.peso)} kg`);
    const n = contarMedidas(m);
    if (n) partes.push(`${n} ${n === 1 ? 'medida' : 'medidas'}`);
    const fotos = Object.values(m.fotos || {}).filter(Boolean).length;
    if (fotos) partes.push(`📷 ${fotos}`);
    return `<a class="linha-lista" href="#/corpo/registro/${encodeURIComponent(m.id)}"><span class="linha-nome">${esc(partes.join(' · '))}</span><span class="muted" aria-hidden="true">›</span></a>`;
  }).join('');
  return `<section class="card"><h2 class="sec-card">Registros</h2>${linhas}</section>`;
}

// o card da evolução só faz sentido com peso ou alguma medida registrados
function temDadosParaCard(est) {
  const d = dadosCardCorpo(est);
  return !!(d.peso || d.medidas.length);
}

function temFoto(m) { return Object.values(m.fotos || {}).some(Boolean); }

export function render() {
  const est = obterEstado();
  const vazio = est.medidas.length === 0;
  const comFoto = est.medidas.filter(temFoto).length;
  return `
    <div class="tela-corpo">
      <h1 class="titulo">Corpo</h1>
      ${htmlPerfil(est)}
      <a class="btn btn-principal btn-bloco" href="#/corpo/registro/novo">+ Registrar medidas</a>
      ${vazio ? '<section class="card"><p>Registre seu peso e suas medidas de tempos em tempos (e, se quiser, fotos). Aqui você vê a evolução, quanto falta para a meta e compara as fotos antes e depois.</p></section>' : ''}
      ${htmlPeso(est)}
      ${htmlMedidas(est)}
      ${temDadosParaCard(est) ? '<button type="button" class="btn btn-sec btn-bloco" data-acao="compartilhar-corpo">Compartilhar evolução</button>' : ''}
      ${comFoto >= 2 ? '<section class="card"><h2 class="sec-card">Fotos</h2><p class="muted">Compare suas fotos de duas datas.</p><a class="btn btn-sec btn-bloco" href="#/corpo/fotos">Comparar fotos</a></section>' : ''}
      ${vazio ? '' : htmlRegistros(est)}
    </div>`;
}

export function montar(raiz) {
  const tela = raiz.querySelector('.tela-corpo');
  if (!tela) return;
  ligarAvatares(tela, obterEstado());

  // recalcula só o que depende do perfil, sem redesenhar a tela (o foco não se perde)
  const atualizarDerivados = () => {
    const est = obterEstado();
    tela.querySelector('[data-derivado="perfil"]').textContent = resumoPerfil(est);
    const peso = tela.querySelector('[data-sec="peso"]');
    if (peso) peso.outerHTML = htmlPeso(est);
  };

  const botaoCompartilhar = tela.querySelector('[data-acao="compartilhar-corpo"]');
  if (botaoCompartilhar) {
    botaoCompartilhar.onclick = () => compartilharCard(
      'Minha evolução',
      opcoes => dadosCardCorpo(obterEstado(), opcoes),
      { interruptorFotos: !!dadosCardCorpo(obterEstado(), { incluirFotos: true }).fotos }
    );
  }

  // nome salva a cada tecla, sem re-renderizar (o teclado não fecha)
  tela.querySelector('[data-campo="nome"]').oninput = ev => {
    const nome = ev.target.value.trim().slice(0, 30);
    atualizar(e => { e.nome = nome; }, { renderizar: false });
  };

  // número (vírgula aceita), vazio = null; fora da faixa marca o campo e não salva
  const campoNumero = (campo, min, max) => {
    const inp = tela.querySelector(`[data-campo="${campo}"]`);
    inp.onchange = () => {
      const txt = inp.value.trim();
      const n = txt === '' ? null : parseCarga(txt);
      const ok = txt === '' || (n != null && n >= min && n <= max);
      inp.classList.toggle('invalido', !ok);
      if (!ok) return;
      atualizar(e => { e.perfil[campo] = n; }, { renderizar: false });
      atualizarDerivados();
    };
  };
  campoNumero('altura', 50, 250);
  campoNumero('metaPeso', 20, 300);

  const nasc = tela.querySelector('[data-campo="nascimento"]');
  nasc.onchange = () => {
    const v = nasc.value;
    const ok = v === '' || (/^\d{4}-\d{2}-\d{2}$/.test(v) && v <= hojeISO() && v >= '1900-01-01');
    nasc.classList.toggle('invalido', !ok);
    if (!ok) return;
    atualizar(e => { e.perfil.nascimento = v || null; }, { renderizar: false });
    atualizarDerivados();
  };

  // foto de perfil: grava no IndexedDB e só depois troca o id (a antiga é apagada)
  const arquivo = tela.querySelector('[data-campo="arquivo-perfil"]');
  tela.querySelector('[data-acao="foto-perfil"]').onclick = () => arquivo.click();
  arquivo.onchange = async () => {
    const file = arquivo.files && arquivo.files[0];
    arquivo.value = '';
    if (!file) return;
    let novoId;
    try {
      novoId = await salvarFoto(await comprimirImagem(file, { lado: 400, quadrado: true }));
    } catch {
      toast('Não foi possível salvar a foto');
      return;
    }
    const antigo = obterEstado().perfil.fotoId;
    atualizar(e => { e.perfil.fotoId = novoId; });
    if (antigo) apagarFoto(antigo).catch(() => {});
  };
  const remover = tela.querySelector('[data-acao="remover-foto-perfil"]');
  if (remover) {
    remover.onclick = async () => {
      if (!(await confirmar('Remover a foto de perfil?', 'Remover', true))) return;
      const antigo = obterEstado().perfil.fotoId;
      atualizar(e => { e.perfil.fotoId = null; });
      if (antigo) apagarFoto(antigo).catch(() => {});
    };
  }
}

// ---------- Detalhe de uma medida ----------

export function renderMedida(campo) {
  const def = CAMPOS_CORPO.find(c => c.campo === campo);
  if (!def) {
    return `
      <div class="tela-medida">
        <a class="voltar" href="#/corpo">← Corpo</a>
        <h1 class="titulo">Medida não encontrada</h1>
        <a class="btn btn-principal btn-bloco" href="#/corpo">Voltar para Corpo</a>
      </div>`;
  }
  const est = obterEstado();
  const serie = serieCampo(est.medidas, campo);
  const r = resumoCampo(est.medidas, campo);
  const ctx = ctxPeso(est);
  const meta = campo === 'peso' ? est.perfil.metaPeso : null;
  const valores = ordenarPorData(est.medidas).filter(m => typeof m[campo] === 'number').reverse().map(m => `
    <a class="linha-lista" href="#/corpo/registro/${encodeURIComponent(m.id)}">
      <span class="linha-nome">${esc(formatarDia(m.data))}</span>
      <span>${formatarNumero(m[campo])} ${esc(def.unidade)}</span>
    </a>`).join('');
  const conteudo = serie.length ? `
      <section class="card">
        <p class="peso-grande">${formatarNumero(r.atual)} <small>${esc(def.unidade)}</small></p>
        ${r.difAnterior != null ? `<p class="muted">vs anterior: ${spanDif(campo, r.difAnterior, ctx)} ${esc(def.unidade)}</p>` : ''}
        ${r.difPrimeiro != null ? `<p class="muted">desde o início: ${spanDif(campo, r.difPrimeiro, ctx)} ${esc(def.unidade)}</p>` : ''}
      </section>
      <section class="card">
        <h2 class="sec-card">Evolução</h2>
        <div class="grafico">${serie.length >= 2 ? graficoLinha(serie, { unidade: def.unidade, meta }) : MSG_GRAFICO}</div>
        <p class="muted grafico-legenda" aria-live="polite"></p>
      </section>
      <section class="card">
        <h2 class="sec-card">Todos os valores</h2>
        ${valores}
      </section>`
    : '<section class="card"><p class="muted">Ainda não há registros desta medida.</p></section>';
  return `
    <div class="tela-medida">
      <a class="voltar" href="#/corpo">← Corpo</a>
      <h1 class="titulo">${esc(def.rotulo)} <span class="muted">(${esc(def.unidade)})</span></h1>
      ${conteudo}
    </div>`;
}

export function montarMedida(raiz) {
  const tela = raiz.querySelector('.tela-medida');
  const legenda = tela && tela.querySelector('.grafico-legenda');
  if (!legenda) return;
  // tocar (ou focar) num ponto mostra data e valor
  const mostrar = alvo => {
    const t = alvo.querySelector('title');
    if (t) legenda.textContent = t.textContent;
  };
  tela.querySelectorAll('.grafico circle').forEach(c => {
    c.onclick = () => mostrar(c);
    c.onfocus = () => mostrar(c);
  });
}
