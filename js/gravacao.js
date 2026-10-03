// Controlador da gravação de cardio por GPS. Vive no módulo (não na tela): o watchPosition e o
// wake lock continuam ativos quando ela troca de aba. A tela só "assina" para redesenhar.
//
// Quem liga o GPS: iniciarGravacao() e sincronizar() (chamado na abertura do app e após importar
// backup, se houver cardioAtual). Quem desliga: finalizar(), descartar() e sincronizar() sem cardioAtual.
// Persistência: cardioAtual no localStorage a cada ponto aceito; pontos em buffer vão ao IndexedDB
// a cada 5 pontos, ao pausar, ao ficar oculto e ao finalizar.
import { obterEstado, atualizar } from './estado.js';
import { gerarId } from './util.js';
import { pesoAtual } from './cardio.js';
import { velocidadeRecente } from './geo.js';
import { observar, manterTelaLigada } from './gps.js';
import { anexarPontos, apagarTrajeto } from './trajetos.js';
import { novoCardioAtual, aplicarPonto, tempoMs, pausar as pausarAtual, retomar as retomarAtual, ritmoDeVelocidade } from './cardio-ao-vivo.js';
import { toast } from './ui.js';

const BUFFER_MAX = 5;
const PRECISAO_FRACA_M = 30;
const SEM_PONTO_FRACO_S = 15;
const GPS_PARADO_S = 30;
const JANELA_RECENTES_MS = 90000;

let desligarGps = null;
let tela = null;           // { suportado, liberar }
let buffer = [];           // itens ainda não gravados no IndexedDB
let recentes = [];         // pontos aceitos recentes (velocidade ao vivo), só em memória
let ultimoRecebido = 0;    // epoch ms da última posição recebida (aceita ou não)
let ultimaPrecisao = null;
let erroGps = null;        // null | 'negado' | 'indisponivel'
const assinantes = new Set();

// fn({ item }) roda a cada posição processada/mudança de estado; devolve a função de cancelar.
export function assinar(fn) {
  assinantes.add(fn);
  return () => assinantes.delete(fn);
}

function notificar(item = null) {
  for (const fn of [...assinantes]) {
    try { fn({ item }); } catch (erro) { console.error(erro); }
  }
}

export const emGravacao = () => !!obterEstado().cardioAtual;

function aoPosicao(ponto) {
  ultimoRecebido = Date.now();
  ultimaPrecisao = ponto.accuracy;
  erroGps = null;
  const est = obterEstado();
  if (!est.cardioAtual) return;
  const r = aplicarPonto(est.cardioAtual, ponto, pesoAtual(est));
  if (r.atual !== est.cardioAtual) {
    atualizar(e => { e.cardioAtual = r.atual; }, { renderizar: false });
  }
  if (r.item) {
    buffer.push(r.item);
    recentes.push({ lat: ponto.lat, lon: ponto.lon, t: ponto.t });
    const corte = ponto.t - JANELA_RECENTES_MS;
    recentes = recentes.filter(p => p.t >= corte);
    if (buffer.length >= BUFFER_MAX) flushar();
  }
  notificar(r.item);
}

function aoErro(erro) {
  erroGps = erro.negado ? 'negado' : 'indisponivel';
  notificar();
}

// Grava o buffer no IndexedDB. Em falha devolve os itens ao buffer (tenta de novo no próximo flush).
export async function flushar() {
  const atual = obterEstado().cardioAtual;
  if (!atual || !buffer.length) return;
  const itens = buffer;
  buffer = [];
  try {
    await anexarPontos(atual.trajetoId, itens);
  } catch (erro) {
    console.error(erro);
    buffer = [...itens, ...buffer];
  }
}

// Itens ainda não gravados (a tela os junta ao trajeto lido do banco)
export const bufferPendente = () => [...buffer];

export function ligar() {
  if (desligarGps || !emGravacao()) return;
  ultimoRecebido = Date.now();
  erroGps = null;
  desligarGps = observar({ aoPosicao, aoErro });
  tela = manterTelaLigada();
}

export function desligar() {
  if (desligarGps) desligarGps();
  desligarGps = null;
  if (tela) tela.liberar();
  tela = null;
  buffer = [];
  recentes = [];
}

// Liga ou desliga o GPS conforme exista cardioAtual (abertura do app, importação de backup).
export function sincronizar() {
  if (emGravacao()) { ligar(); notificar(); }
  else if (desligarGps) { desligar(); notificar(); }
}

export function iniciarGravacao({ tipo, posicaoInicial = null }) {
  buffer = [];
  recentes = [];
  const agora = Date.now();
  atualizar(e => {
    e.cardioAtual = novoCardioAtual({ id: gerarId('c_'), trajetoId: gerarId('t_'), tipo, agora });
  }, { renderizar: false });
  ligar();
  if (posicaoInicial) aoPosicao(posicaoInicial); // aproveita o fix que a tela de preparar já tinha
}

export function pausarGravacao() {
  const atual = obterEstado().cardioAtual;
  if (!atual || atual.pausado) return;
  atualizar(e => { e.cardioAtual = pausarAtual(e.cardioAtual, Date.now()); }, { renderizar: false });
  flushar();
  notificar();
}

export function retomarGravacao() {
  const atual = obterEstado().cardioAtual;
  if (!atual || !atual.pausado) return;
  recentes = [];
  atualizar(e => { e.cardioAtual = retomarAtual(e.cardioAtual, Date.now()); }, { renderizar: false });
  notificar();
}

// Números ao vivo para a tela (leitura, sem efeito colateral).
export function instantaneo(agora = Date.now()) {
  const est = obterEstado();
  const atual = est.cardioAtual;
  if (!atual) return null;
  const kmh = atual.pausado ? null : velocidadeRecente(recentes, agora, 30);
  const semPontoS = Math.max(0, (agora - ultimoRecebido) / 1000);
  return {
    atual,
    tempo: tempoMs(atual, agora),
    kmh,
    ritmoSeg: ritmoDeVelocidade(kmh),
    kcal: atual.kcal > 0 ? Math.round(atual.kcal) : 0,
    temPeso: pesoAtual(est) != null,
    precisao: ultimaPrecisao,
    semPontoS,
    sinalFraco: !atual.pausado && (erroGps != null || (ultimaPrecisao != null && ultimaPrecisao > PRECISAO_FRACA_M) || semPontoS > SEM_PONTO_FRACO_S),
    erro: erroGps,
    telaLigada: tela ? tela.suportado : true
  };
}

// Finaliza: grava o buffer, cria o Cardio, limpa cardioAtual e desliga o GPS. Devolve o Cardio.
export async function finalizar() {
  const est = obterEstado();
  const a0 = est.cardioAtual;
  if (!a0) return null;
  const agora = Date.now();
  const atual = a0.pausado ? a0 : pausarAtual(a0, agora); // fecha o tempo em movimento
  atualizar(e => { e.cardioAtual = atual; }, { renderizar: false });
  await flushar();
  if (buffer.length) toast('Parte do trajeto não pôde ser gravada');
  const peso = pesoAtual(est);
  const cardio = {
    id: atual.id, modo: 'gps', tipo: atual.tipo,
    inicio: atual.inicio, fim: new Date(agora).toISOString(),
    duracaoSeg: Math.round(atual.acumuladoMs / 1000),
    distanciaM: Math.round(atual.distanciaM),
    kcal: peso ? Math.round(atual.kcal) : null, // arredonda só aqui
    kcalEstimada: true,
    subidaM: Math.round(atual.subidaM),
    altMin: atual.altMin, altMax: atual.altMax,
    fcMedia: null, obs: '',
    trajetoId: atual.trajetoId
  };
  atualizar(e => { e.cardios.push(cardio); e.cardioAtual = null; }, { renderizar: false });
  desligar();
  notificar();
  return cardio;
}

// Descarta a gravação e apaga o trajeto.
export async function descartar() {
  const atual = obterEstado().cardioAtual;
  if (!atual) return;
  atualizar(e => { e.cardioAtual = null; }, { renderizar: false });
  desligar();
  notificar();
  try { await apagarTrajeto(atual.trajetoId); } catch { /* o backup limpa órfãos */ }
}

// Segundo plano: grava o buffer ao ocultar; ao voltar, avisa se o GPS ficou parado.
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { flushar(); return; }
    const atual = obterEstado().cardioAtual;
    if (!desligarGps || !atual || atual.pausado) return;
    const parado = (Date.now() - ultimoRecebido) / 1000;
    if (parado > GPS_PARADO_S) toast(`O GPS ficou parado por ${Math.max(1, Math.round(parado / 60))} min`);
  });
}
