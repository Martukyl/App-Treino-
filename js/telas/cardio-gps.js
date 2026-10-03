// Cardio por GPS (#/cardio/gps): preparar (sem cardioAtual) e gravar (com cardioAtual).
// O GPS e o wake lock ficam no controlador (js/gravacao.js); esta tela só assina para redesenhar
// e, ao sair, desmonta apenas o mapa e o intervalo do cronômetro visual.
import { esc, parseCarga, formatarNumero, hojeISO, gerarId } from '../util.js';
import { CAMPOS_CORPO } from '../corpo.js';
import { ICONE_CARDIO, ROTULO_CARDIO, formatarKm, formatarRitmo, formatarCronometro, pesoAtual } from '../cardio.js';
import { obterEstado, atualizar } from '../estado.js';
import { confirmar, toast, aoSairDaTela } from '../ui.js';
import { observar, suportaGps } from '../gps.js';
import { criarMapaAoVivo } from '../mapa.js';
import { lerTrajeto } from '../trajetos.js';
import {
  assinar, iniciarGravacao, pausarGravacao, retomarGravacao, finalizar, descartar,
  flushar, bufferPendente, instantaneo
} from '../gravacao.js';

const TIPOS = ['caminhada', 'corrida'];
const PRECISAO_OK_M = 30;
const INICIAR_MESMO_ASSIM_MS = 20000;
const PESO_MIN = 20, PESO_MAX = 400;

export function render() {
  return obterEstado().cardioAtual ? renderGravando() : renderPreparar();
}

export function montar(raiz) {
  if (obterEstado().cardioAtual) montarGravando(raiz);
  else montarPreparar(raiz);
}

// ---------- Preparar ----------

// Último tipo de GPS usado; padrão caminhada
function ultimoTipo(est) {
  const gps = est.cardios.filter(c => c.modo === 'gps' && TIPOS.includes(c.tipo))
    .sort((a, b) => new Date(b.fim) - new Date(a.fim));
  return gps.length ? gps[0].tipo : 'caminhada';
}

function renderPreparar() {
  const est = obterEstado();
  const tipo = ultimoTipo(est);
  const chips = TIPOS.map(t => `
    <button type="button" class="chip${t === tipo ? ' chip-ativo' : ''}" data-acao="tipo" data-tipo="${t}" aria-pressed="${t === tipo}">
      ${ICONE_CARDIO[t]} ${ROTULO_CARDIO[t]}</button>`).join('');
  const campoPeso = pesoAtual(est) == null ? `
      <label>Seu peso (kg)<input type="text" inputmode="decimal" data-campo="peso" placeholder="Ex.: 62,5"></label>
      <p class="muted">Usado para estimar as calorias. Fica registrado na aba Corpo.</p>` : '';
  return `
    <div class="tela-cardio-gps" data-modo="preparar">
      <a class="voltar" href="#/hoje">← Hoje</a>
      <h1 class="titulo">Caminhada / Corrida</h1>
      <section class="card">
        <div class="chips">${chips}</div>
        <p class="sinal" data-sinal>Procurando GPS…</p>
        ${campoPeso}
      </section>
      <section class="card" data-negado hidden>
        <h2 class="sec-card">Localização bloqueada</h2>
        <p class="muted" data-negado-msg></p>
        <a class="btn btn-sec btn-bloco" href="#/cardio/aparelho/novo" data-acao="ir-aparelho">Registrar como aparelho / manual</a>
      </section>
      <p class="form-erro" data-erro hidden></p>
      <button type="button" class="btn btn-principal btn-bloco" data-acao="iniciar" disabled>Iniciar</button>
      <button type="button" class="btn btn-sec btn-bloco" data-acao="iniciar-mesmo" hidden>Iniciar mesmo assim</button>
    </div>`;
}

function montarPreparar(raiz) {
  const tela = raiz.querySelector('.tela-cardio-gps');
  if (!tela) return;
  const est = obterEstado();
  const precisaPeso = pesoAtual(est) == null;
  let tipo = ultimoTipo(est);
  let pos = null;
  let negado = false;

  const sinal = tela.querySelector('[data-sinal]');
  const btnIniciar = tela.querySelector('[data-acao="iniciar"]');
  const btnMesmo = tela.querySelector('[data-acao="iniciar-mesmo"]');
  const erro = tela.querySelector('[data-erro]');
  const mostrarErro = txt => { erro.textContent = txt; erro.hidden = !txt; };
  const gpsOk = () => !!pos && pos.accuracy <= PRECISAO_OK_M;

  const desenharSinal = () => {
    if (negado) return;
    if (!pos) sinal.textContent = 'Procurando GPS…';
    else if (gpsOk()) sinal.textContent = `GPS ok (±${Math.round(pos.accuracy)} m)`;
    else sinal.textContent = `Procurando GPS… (±${Math.round(pos.accuracy)} m)`;
    sinal.classList.toggle('sinal-ok', gpsOk());
    btnIniciar.disabled = !gpsOk();
  };

  const mostrarNegado = semSuporte => {
    negado = true;
    sinal.textContent = semSuporte ? 'Este aparelho não tem GPS disponível.' : 'Sem permissão de localização.';
    sinal.classList.remove('sinal-ok');
    btnIniciar.disabled = true;
    btnMesmo.hidden = true;
    tela.querySelector('[data-negado]').hidden = false;
    tela.querySelector('[data-negado-msg]').textContent = semSuporte
      ? 'O navegador não oferece localização. Você ainda pode registrar o cardio manualmente.'
      : 'Para usar o GPS, libere a localização no Chrome: toque no cadeado ao lado do endereço, escolha Permissões e permita Localização; depois recarregue a página. Ou registre o cardio manualmente.';
  };

  if (!suportaGps()) mostrarNegado(true);
  const parar = observar({
    aoPosicao: p => { pos = p; desenharSinal(); },
    aoErro: e => { if (e.negado || e.semSuporte) mostrarNegado(e.semSuporte); }
  });
  const espera = setTimeout(() => { if (!negado && !gpsOk()) btnMesmo.hidden = false; }, INICIAR_MESMO_ASSIM_MS);
  aoSairDaTela(() => { parar(); clearTimeout(espera); });

  tela.querySelectorAll('[data-acao="tipo"]').forEach(b => {
    b.onclick = () => {
      tipo = b.dataset.tipo;
      tela.querySelectorAll('[data-acao="tipo"]').forEach(x => {
        x.classList.toggle('chip-ativo', x === b);
        x.setAttribute('aria-pressed', String(x === b));
      });
    };
  });

  const iniciar = () => {
    if (negado) return;
    let peso = null;
    if (precisaPeso) {
      const inp = tela.querySelector('[data-campo="peso"]');
      peso = parseCarga(inp.value.trim());
      if (peso == null || peso < PESO_MIN || peso > PESO_MAX) {
        inp.classList.add('invalido');
        mostrarErro(`Informe seu peso em kg (entre ${PESO_MIN} e ${PESO_MAX}).`);
        return;
      }
      inp.classList.remove('invalido');
    }
    mostrarErro('');
    if (peso != null) registrarPeso(peso);
    // aproveita o fix atual da tela de preparar se estiver fresco e preciso
    const fresco = pos && gpsOk() && Date.now() - pos.t < 15000 ? pos : null;
    iniciarGravacao({ tipo, posicaoInicial: fresco });
    atualizar(() => {}); // redesenha como tela de gravação
  };
  btnIniciar.onclick = iniciar;
  btnMesmo.onclick = iniciar;
}

// Cria (ou completa) o registro de hoje no Corpo só com o peso
function registrarPeso(peso) {
  atualizar(e => {
    const hoje = hojeISO();
    const existente = e.medidas.find(m => m.data === hoje);
    if (existente) {
      if (existente.peso == null) existente.peso = peso;
      return;
    }
    const registro = { id: gerarId('m_'), data: hoje, fotos: { frente: null, lado: null, costas: null } };
    for (const c of CAMPOS_CORPO) registro[c.campo] = null;
    registro.peso = peso;
    e.medidas.push(registro);
  }, { renderizar: false });
}

// ---------- Gravando ----------

function renderGravando() {
  const a = obterEstado().cardioAtual;
  const metricas = [
    ['distancia', 'Distância'], ['velocidade', 'Velocidade'], ['ritmo', 'Ritmo'],
    ['calorias', 'Calorias'], ['altitude', 'Altitude'], ['subida', 'Subida']
  ].map(([k, r]) => `
      <div class="metrica"><span class="metrica-valor" data-met="${k}">—</span><span class="metrica-rotulo">${r}</span></div>`).join('');
  return `
    <div class="tela-cardio-gps" data-modo="gravando" data-id="${esc(a.id)}">
      <p class="cardio-tipo muted" data-tipo>${ICONE_CARDIO[a.tipo] || ''} ${esc(ROTULO_CARDIO[a.tipo] || '')}</p>
      <div class="cron-grande" data-cron>00:00</div>
      <p class="sinal" data-sinal>Procurando GPS…</p>
      <div class="mapa-caixa">
        <div class="mapa mapa-ao-vivo" data-mapa></div>
        <button type="button" class="btn btn-sec btn-centralizar" data-acao="centralizar" hidden>📍 centralizar</button>
        <p class="mapa-aviso muted" data-mapa-aviso hidden>Mapa indisponível. A gravação continua normalmente.</p>
      </div>
      <div class="grade-metricas">${metricas}</div>
      <p class="muted aviso-tela" data-aviso-tela hidden>Mantenha a tela ligada para o GPS continuar gravando.</p>
      <div class="cardio-botoes">
        <button type="button" class="btn btn-sec" data-acao="pausar">Pausar</button>
        <button type="button" class="btn btn-principal" data-acao="finalizar">Finalizar</button>
      </div>
    </div>`;
}

function montarGravando(raiz) {
  const tela = raiz.querySelector('.tela-cardio-gps');
  if (!tela) return;
  const q = s => tela.querySelector(s);
  const met = k => q(`[data-met="${k}"]`);
  let ativo = true;
  let mapa = null;
  let pronto = false;   // trajeto inicial já desenhado
  let sujo = false;     // chegou ponto enquanto lia o trajeto: ler de novo
  let ocupado = false;

  const numero = n => formatarNumero(Math.round(n));

  const atualizarNumeros = () => {
    const s = instantaneo();
    if (!s) return;
    const a = s.atual;
    q('[data-cron]').textContent = formatarCronometro(s.tempo);
    met('distancia').textContent = formatarKm(a.distanciaM);
    met('velocidade').textContent = s.kmh == null ? '—' : `${formatarNumero(s.kmh)} km/h`;
    met('ritmo').textContent = formatarRitmo(s.ritmoSeg);
    met('calorias').textContent = s.temPeso ? `${s.kcal} kcal` : '—';
    met('altitude').textContent = a.altAtual == null ? '—' : `${numero(a.altAtual)} m`;
    met('subida').textContent = `${numero(a.subidaM)} m`;
    const sinal = q('[data-sinal]');
    if (a.pausado) { sinal.textContent = 'Pausado'; sinal.className = 'sinal'; }
    else if (s.erro === 'negado') { sinal.textContent = 'Sem permissão de localização'; sinal.className = 'sinal sinal-fraco'; }
    else if (s.sinalFraco) { sinal.textContent = 'Sinal de GPS fraco'; sinal.className = 'sinal sinal-fraco'; }
    else if (s.precisao != null) { sinal.textContent = `GPS ok (±${Math.round(s.precisao)} m)`; sinal.className = 'sinal sinal-ok'; }
    else { sinal.textContent = 'Procurando GPS…'; sinal.className = 'sinal'; }
    q('[data-acao="pausar"]').textContent = a.pausado ? 'Retomar' : 'Pausar';
    q('[data-tipo]').textContent = `${ICONE_CARDIO[a.tipo] || ''} ${ROTULO_CARDIO[a.tipo] || ''}${a.pausado ? ' · pausada' : ''}`;
    q('[data-aviso-tela]').hidden = s.telaLigada;
  };

  const cancelar = assinar(ev => {
    if (!ativo) return;
    atualizarNumeros();
    if (ev.item) {
      if (pronto && mapa) { const [lat, lon] = ev.item.p; mapa.adicionarPonto(lat, lon, ev.item.novo); }
      else sujo = true;
    }
  });
  const timer = setInterval(atualizarNumeros, 1000);
  // sai da tela: só o mapa e o cronômetro visual são desmontados; o GPS continua no controlador
  aoSairDaTela(() => {
    ativo = false;
    clearInterval(timer);
    cancelar();
    if (mapa) mapa.destruir();
  });
  atualizarNumeros();

  // mapa: carrega o Leaflet, lê o trajeto do IndexedDB e desenha
  (async () => {
    try {
      const m = await criarMapaAoVivo(q('[data-mapa]'), { aoSoltarSeguir: () => { q('[data-acao="centralizar"]').hidden = false; } });
      if (!ativo) { m.destruir(); return; }
      mapa = m;
      let segmentos = [];
      do {
        sujo = false;
        await flushar();
        let t = null;
        try { t = await lerTrajeto(obterEstado().cardioAtual?.trajetoId); } catch { /* sem IndexedDB */ }
        segmentos = t && Array.isArray(t.segmentos) ? t.segmentos : [];
        // se o banco falhou, o que está no buffer ainda aparece
        for (const { p, novo } of bufferPendente()) {
          if (novo || !segmentos.length) segmentos = [...segmentos, [p]];
          else segmentos = segmentos.map((s, i) => (i === segmentos.length - 1 ? [...s, p] : s));
        }
      } while (sujo && ativo);
      if (!ativo) return;
      mapa.definirTrajeto(segmentos);
      pronto = true;
    } catch (e) {
      console.error(e);
      if (ativo) q('[data-mapa-aviso]').hidden = false;
    }
  })();

  q('[data-acao="centralizar"]').onclick = () => {
    if (mapa) mapa.centralizar();
    q('[data-acao="centralizar"]').hidden = true;
  };

  q('[data-acao="pausar"]').onclick = () => {
    const s = instantaneo();
    if (!s) return;
    if (s.atual.pausado) retomarGravacao(); else pausarGravacao();
    atualizarNumeros();
  };

  q('[data-acao="finalizar"]').onclick = async () => {
    if (ocupado) return;
    const s = instantaneo();
    if (!s) return;
    ocupado = true;
    try {
      const rotulo = (ROTULO_CARDIO[s.atual.tipo] || 'Cardio').toLowerCase();
      if (s.atual.distanciaM < 50 && s.tempo < 60000) {
        if (await confirmar('Esta gravação é muito curta (menos de 50 m e 1 min). Descartar esta gravação?', 'Descartar', true)) {
          await descartar();
          toast('Gravação descartada');
          location.hash = '#/hoje';
        }
        return;
      }
      if (!(await confirmar(`Finalizar ${rotulo}?`, 'Finalizar'))) return;
      const cardio = await finalizar();
      if (!cardio) return;
      toast(`${ROTULO_CARDIO[cardio.tipo]} salva`);
      location.hash = `#/cardio/${encodeURIComponent(cardio.id)}`;
    } finally {
      ocupado = false;
    }
  };
}
