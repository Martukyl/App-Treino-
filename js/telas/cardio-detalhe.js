// Detalhe de um cardio (#/cardio/<id>), GPS ou aparelho.
import { esc, formatarDataCompleta, formatarNumero } from '../util.js';
import { ICONE_CARDIO, ROTULO_CARDIO, formatarKm, formatarRitmo, formatarCronometro } from '../cardio.js';
import { parciaisKm } from '../geo.js';
import { obterEstado, atualizar } from '../estado.js';
import { confirmar, toast, aoSairDaTela } from '../ui.js';
import { criarMapaEstatico } from '../mapa.js';
import { lerTrajeto, apagarTrajeto } from '../trajetos.js';

const hora = iso => new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

function numero(rotulo, valor, dado) {
  return `<div class="metrica"><span class="metrica-valor"${dado ? ` data-met="${dado}"` : ''}>${esc(valor)}</span><span class="metrica-rotulo">${esc(rotulo)}</span></div>`;
}

export function render(id) {
  const c = obterEstado().cardios.find(x => x.id === id);
  if (!c) {
    return `
      <div class="tela-cardio-detalhe">
        <a class="voltar" href="#/historico">← Histórico</a>
        <h1 class="titulo">Cardio não encontrado</h1>
        <a class="btn btn-principal btn-bloco" href="#/historico">Voltar ao Histórico</a>
      </div>`;
  }
  const gps = c.modo === 'gps';
  const titulo = `${ICONE_CARDIO[c.tipo] || '❤️'} ${ROTULO_CARDIO[c.tipo] || 'Cardio'} · ${formatarDataCompleta(c.inicio)} ${hora(c.inicio)}`;
  const temDist = c.distanciaM != null && c.distanciaM > 0;
  const kmh = temDist && c.duracaoSeg > 0 ? (c.distanciaM / 1000) / (c.duracaoSeg / 3600) : null;
  const ritmo = temDist ? c.duracaoSeg / (c.distanciaM / 1000) : null;
  const kcalTxt = c.kcal == null ? '—' : `${formatarNumero(c.kcal)} kcal`;
  const numeros = [
    numero('Tempo', formatarCronometro(c.duracaoSeg * 1000), 'tempo'),
    numero('Distância', temDist ? formatarKm(c.distanciaM) : '—', 'distancia'),
    numero('Ritmo médio', formatarRitmo(ritmo), 'ritmo'),
    numero('Velocidade média', kmh == null ? '—' : `${formatarNumero(kmh)} km/h`, 'velocidade'),
    numero(c.kcalEstimada ? 'Calorias (estimativa)' : 'Calorias', kcalTxt, 'calorias')
  ];
  if (gps) {
    numeros.push(numero('Subida', c.subidaM == null ? '—' : `${formatarNumero(c.subidaM)} m`, 'subida'));
    numeros.push(numero('Altitude mín.', c.altMin == null ? '—' : `${formatarNumero(Math.round(c.altMin))} m`, 'altmin'));
    numeros.push(numero('Altitude máx.', c.altMax == null ? '—' : `${formatarNumero(Math.round(c.altMax))} m`, 'altmax'));
  } else if (c.fcMedia != null) {
    numeros.push(numero('FC média', `${c.fcMedia} bpm`, 'fc'));
  }
  const mapa = gps ? `
      <section class="card">
        <div class="mapa-caixa"><div class="mapa mapa-detalhe" data-mapa></div></div>
        <p class="muted" data-sem-trajeto hidden>Trajeto indisponível.</p>
      </section>` : '';
  const parciais = gps ? `
      <section class="card" data-parciais-card hidden>
        <h2 class="sec-card">Parciais por km</h2>
        <ul class="lista-sessoes" data-parciais></ul>
      </section>` : '';
  const obs = !gps && c.obs ? `<section class="card"><h2 class="sec-card">Observação</h2><p>${esc(c.obs)}</p></section>` : '';
  const editar = !gps ? `<a class="btn btn-sec btn-bloco" data-acao="editar" href="#/cardio/aparelho/${encodeURIComponent(c.id)}">Editar</a>` : '';
  return `
    <div class="tela-cardio-detalhe" data-id="${esc(c.id)}">
      <a class="voltar" href="#/historico">← Histórico</a>
      <h1 class="titulo">${esc(titulo)}</h1>
      ${mapa}
      <section class="card"><div class="grade-metricas">${numeros.join('')}</div></section>
      ${parciais}
      ${obs}
      ${editar}
      <button type="button" class="btn btn-perigo btn-bloco" data-acao="excluir">Excluir</button>
    </div>`;
}

export function montar(raiz, id) {
  const tela = raiz.querySelector('.tela-cardio-detalhe');
  const c = obterEstado().cardios.find(x => x.id === id);
  if (!tela || !c) return;

  tela.querySelector('[data-acao="excluir"]').onclick = async () => {
    if (!(await confirmar('Excluir este cardio? O trajeto dele também será apagado.', 'Excluir', true))) return;
    atualizar(e => { e.cardios = e.cardios.filter(x => x.id !== c.id); }, { renderizar: false });
    if (c.trajetoId) apagarTrajeto(c.trajetoId).catch(() => {});
    toast('Cardio excluído');
    location.hash = '#/historico';
  };

  if (c.modo !== 'gps') return;
  let ativo = true;
  let mapa = null;
  aoSairDaTela(() => { ativo = false; if (mapa) mapa.destruir(); });

  const semTrajeto = () => {
    tela.querySelector('[data-sem-trajeto]').hidden = false;
    tela.querySelector('[data-mapa]').hidden = true;
  };
  (async () => {
    let t = null;
    try { t = c.trajetoId ? await lerTrajeto(c.trajetoId) : null; } catch { /* sem IndexedDB */ }
    if (!ativo) return;
    const segmentos = t && Array.isArray(t.segmentos) ? t.segmentos.filter(s => s.length) : [];
    if (!segmentos.length) { semTrajeto(); return; }

    const parciais = parciaisKm(segmentos);
    if (parciais.length) {
      tela.querySelector('[data-parciais-card]').hidden = false;
      tela.querySelector('[data-parciais]').innerHTML = parciais.map(p =>
        `<li><span class="muted">Km ${p.km}</span><span>${formatarCronometro(p.seg * 1000)}</span></li>`).join('');
    }
    try {
      const m = await criarMapaEstatico(tela.querySelector('[data-mapa]'), segmentos);
      if (!ativo) { m.destruir(); return; }
      mapa = m;
    } catch (e) {
      console.error(e);
      if (ativo) semTrajeto();
    }
  })();
}
