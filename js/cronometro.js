// Cronômetro de descanso baseado em horário de término (sobrevive a tela apagada).
import { obterEstado, atualizar } from './estado.js';
import { indiceAtual, lerIndiceGuardado } from './sessao-ui.js';

export function restanteSegundos(fimMs, agoraMs) {
  return Math.max(0, Math.ceil((fimMs - agoraMs) / 1000));
}

// Parte do descanso que ainda falta (0..1), para o anel da pílula.
export function fracaoDescanso(restanteSeg, totalSeg) {
  if (!(totalSeg > 0)) return 0;
  return Math.max(0, Math.min(1, restanteSeg / totalSeg));
}

let intervalo = null;
let audio = null;
let saida = null;
const CHAVE_TOTAL = 'treino.descansoTotal';
const CIRC = 2 * Math.PI * 19; // anel de raio 19

// Tempo total do descanso em curso: o guardado ao iniciar (+ ajustes); sem ele (recarga da v1.5),
// o descanso do exercício aberto; por fim 90 s.
function totalDescanso() {
  try {
    const v = Number(sessionStorage.getItem(CHAVE_TOTAL));
    if (v > 0) return v;
  } catch { /* sem sessionStorage */ }
  const sa = obterEstado().sessaoAtual;
  const it = sa?.itens?.[indiceAtual(sa, lerIndiceGuardado(sa.id))];
  return it?.descanso || 90;
}
function guardarTotal(seg) {
  try { sessionStorage.setItem(CHAVE_TOTAL, String(seg)); } catch { /* sem sessionStorage */ }
}

// Cria/retoma o AudioContext; chamar no toque do ✓ (política de autoplay).
export function prepararAudio() {
  try {
    audio = audio || new (window.AudioContext || window.webkitAudioContext)();
    if (audio.state === 'suspended') audio.resume();
  } catch { audio = null; }
}

function bipe() {
  if (!audio) return;
  try {
    const osc = audio.createOscillator(), ganho = audio.createGain();
    osc.frequency.value = 880;
    ganho.gain.setValueAtTime(0.25, audio.currentTime);
    ganho.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + 0.4);
    osc.connect(ganho).connect(audio.destination);
    osc.start(); osc.stop(audio.currentTime + 0.4);
  } catch { /* sem áudio */ }
}

function definirFim(ms) {
  atualizar(e => { if (e.sessaoAtual) e.sessaoAtual.descansoAte = ms; }, { renderizar: false });
}

export function iniciarDescanso(segundos) {
  guardarTotal(segundos);
  definirFim(Date.now() + segundos * 1000);
  ligar();
}

export function ajustarDescanso(deltaSeg) {
  const fim = obterEstado().sessaoAtual?.descansoAte;
  if (!fim) return;
  definirFim(Math.max(Date.now(), fim + deltaSeg * 1000));
  guardarTotal(Math.max(1, totalDescanso() + deltaSeg));
  // após o fim o intervalo já foi limpo e a classe 'fim' está ativa: religa tudo
  const el = document.getElementById('cronometro');
  if (intervalo === null || el.classList.contains('fim')) ligar();
  else tique();
}

export function pararDescanso() {
  clearInterval(intervalo); intervalo = null;
  if (obterEstado().sessaoAtual) definirFim(null);
  const el = document.getElementById('cronometro');
  el.classList.remove('on', 'fim');
  clearTimeout(saida);
  saida = setTimeout(() => { if (!el.classList.contains('on')) el.hidden = true; }, 450);
  document.body.classList.remove('com-cronometro');
}

export function retomarDescanso() {
  const fim = obterEstado().sessaoAtual?.descansoAte;
  if (fim && fim > Date.now()) ligar();
  else if (fim) pararDescanso();
}

function ligar() {
  const el = document.getElementById('cronometro');
  el.innerHTML = `
    <svg class="descanso-anel" viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="24" r="19" class="descanso-trilho"/><circle cx="24" cy="24" r="19" class="descanso-valor" transform="rotate(-90 24 24)" stroke-dasharray="${CIRC} ${CIRC}"/></svg>
    <div class="descanso-txt"><small>Descanso</small><b class="cron-tempo num" aria-live="polite"></b></div>
    <button type="button" data-cron="-15" aria-label="Menos 15 segundos">−15</button>
    <button type="button" data-cron="15" aria-label="Mais 15 segundos">+15</button>
    <button type="button" data-cron="pular">Pular</button>`;
  el.onclick = ev => {
    const b = ev.target.closest('[data-cron]');
    if (!b) return;
    if (b.dataset.cron === 'pular') pararDescanso();
    else ajustarDescanso(Number(b.dataset.cron));
  };
  clearTimeout(saida);
  el.classList.remove('fim');
  if (el.hidden || !el.classList.contains('on')) {
    el.hidden = false;
    void el.offsetWidth; // estilo inicial antes da transição de entrada
    el.classList.add('on');
  }
  document.body.classList.add('com-cronometro');
  clearInterval(intervalo);
  intervalo = setInterval(tique, 250);
  tique();
}

function tique() {
  const fim = obterEstado().sessaoAtual?.descansoAte;
  const el = document.getElementById('cronometro');
  if (!fim) return pararDescanso();
  const rest = restanteSegundos(fim, Date.now());
  const min = Math.floor(rest / 60), seg = String(rest % 60).padStart(2, '0');
  el.querySelector('.cron-tempo').textContent = rest === 0 ? 'Bora!' : `${min}:${seg}`;
  const exato = Math.max(0, (fim - Date.now()) / 1000);
  el.querySelector('.descanso-valor')?.setAttribute('stroke-dasharray', `${CIRC * fracaoDescanso(exato, totalDescanso())} ${CIRC}`);
  if (rest === 0 && !el.classList.contains('fim')) {
    el.classList.add('fim');
    clearInterval(intervalo); intervalo = null;
    try { navigator.vibrate?.([300, 150, 300]); } catch { /* sem vibração */ }
    bipe();
    setTimeout(() => { if (el.classList.contains('fim')) pararDescanso(); }, 5000);
  }
}

// ao voltar do segundo plano, recalcula imediatamente
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => { if (!document.hidden) retomarDescanso(); });
}
