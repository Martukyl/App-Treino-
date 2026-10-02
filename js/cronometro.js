// Cronômetro de descanso baseado em horário de término (sobrevive a tela apagada).
import { obterEstado, atualizar } from './estado.js';

export function restanteSegundos(fimMs, agoraMs) {
  return Math.max(0, Math.ceil((fimMs - agoraMs) / 1000));
}

let intervalo = null;
let audio = null;

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
  definirFim(Date.now() + segundos * 1000);
  ligar();
}

export function ajustarDescanso(deltaSeg) {
  const fim = obterEstado().sessaoAtual?.descansoAte;
  if (!fim) return;
  definirFim(Math.max(Date.now(), fim + deltaSeg * 1000));
  // após o fim o intervalo já foi limpo e a classe 'fim' está ativa: religa tudo
  const el = document.getElementById('cronometro');
  if (intervalo === null || el.classList.contains('fim')) ligar();
  else tique();
}

export function pararDescanso() {
  clearInterval(intervalo); intervalo = null;
  if (obterEstado().sessaoAtual) definirFim(null);
  const el = document.getElementById('cronometro');
  el.hidden = true; el.classList.remove('fim');
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
    <div class="cron-tempo" aria-live="polite"></div>
    <div class="cron-botoes">
      <button class="btn btn-sec" data-cron="-15">−15s</button>
      <button class="btn btn-sec" data-cron="15">+15s</button>
      <button class="btn btn-sec" data-cron="pular">Pular</button>
    </div>`;
  el.onclick = ev => {
    const b = ev.target.closest('[data-cron]');
    if (!b) return;
    if (b.dataset.cron === 'pular') pararDescanso();
    else ajustarDescanso(Number(b.dataset.cron));
  };
  el.hidden = false; el.classList.remove('fim');
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
  el.querySelector('.cron-tempo').textContent = `${min}:${seg}`;
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
