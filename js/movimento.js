// Movimento do visual Blocos: entrada escalonada, contagem, traços que se desenham, FLIP e confete.
// Tudo vira nada com "reduzir movimento". O estado final é sempre o visível (fill 'backwards').
import { formatarNumero } from './util.js';

const SUAVE = 'cubic-bezier(.2,.8,.2,1)';
const MOLA = 'cubic-bezier(.3,1.25,.5,1)';

export function reduzido() {
  try { return !!globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches; } catch { return false; }
}

const podeAnimar = el => !reduzido() && typeof el?.animate === 'function';

function formatar(valor, casas) {
  return casas > 0
    ? valor.toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas })
    : formatarNumero(Math.round(valor));
}

// Conta de 0 até data-contar (data-casas = casas decimais).
export function contarAte(el) {
  const alvo = Number(el.dataset.contar);
  const casas = Number(el.dataset.casas || 0);
  if (!Number.isFinite(alvo)) return;
  if (!podeAnimar(el)) { el.textContent = formatar(alvo, casas); return; }
  const t0 = performance.now(), dur = 800;
  const passo = agora => {
    if (!el.isConnected) return;
    const p = Math.min(1, (agora - t0) / dur);
    el.textContent = formatar(alvo * (1 - Math.pow(1 - p, 3)), casas);
    if (p < 1) requestAnimationFrame(passo);
  };
  requestAnimationFrame(passo);
}

// Anéis: <circle data-anel="0.6" r="23"> desenha 60% da volta.
function prepararAnel(c) {
  const C = 2 * Math.PI * Number(c.getAttribute('r'));
  const v = Math.max(0, Math.min(1, Number(c.dataset.anel) || 0));
  c.setAttribute('stroke-dasharray', `${C * v} ${C}`);
  return [C, v];
}

export function entrar(raiz) {
  if (!raiz) return;
  raiz.querySelectorAll('[data-contar]').forEach(contarAte);
  const aneis = [...raiz.querySelectorAll('[data-anel]')].map(c => [c, ...prepararAnel(c)]);
  if (!podeAnimar(raiz)) return;
  raiz.querySelectorAll('.a').forEach((el, i) => el.animate(
    [{ opacity: 0, transform: 'translateY(16px) scale(.98)' }, { opacity: 1, transform: 'none' }],
    { duration: 520, delay: 40 + i * 50, easing: SUAVE, fill: 'backwards' }));
  aneis.forEach(([c, C, v]) => c.animate(
    [{ strokeDasharray: `0 ${C}` }, { strokeDasharray: `${C * v} ${C}` }],
    { duration: 1000, delay: 250, easing: SUAVE, fill: 'backwards' }));
  raiz.querySelectorAll('[data-desenhar]').forEach(p => {
    if (typeof p.getTotalLength !== 'function') return;
    const L = p.getTotalLength();
    p.style.strokeDasharray = L;
    p.animate([{ strokeDashoffset: L }, { strokeDashoffset: 0 }], { duration: 1100, delay: 300, easing: 'cubic-bezier(.4,0,.2,1)', fill: 'backwards' });
  });
  raiz.querySelectorAll('[data-crescer]').forEach((el, i) => {
    const eixo = el.dataset.crescer === 'x' ? 'scaleX' : 'scaleY';
    el.style.transformOrigin = eixo === 'scaleX' ? 'left' : 'bottom';
    el.animate([{ transform: `${eixo}(0)` }, { transform: `${eixo}(1)` }], { duration: 700, delay: 280 + i * 45, easing: MOLA, fill: 'backwards' });
  });
  raiz.querySelectorAll('[data-surgir]').forEach((el, i) => el.animate(
    [{ opacity: 0, transform: 'scale(.4)' }, { opacity: 1, transform: 'none' }],
    { duration: 420, delay: 200 + i * 14, easing: MOLA, fill: 'backwards' }));
  raiz.querySelectorAll('.foto-capa.zoom').forEach(f => f.animate(
    [{ transform: 'scale(1.12)' }, { transform: 'scale(1)' }], { duration: 1400, easing: SUAVE }));
}

export function pop(el) {
  if (!podeAnimar(el)) return;
  el.animate([{ transform: 'scale(.82)' }, { transform: 'scale(1.08)' }, { transform: 'scale(1)' }], { duration: 380, easing: 'ease-out' });
}

// Troca o conteúdo de um número com uma rolagem curta para cima (dir 1) ou para baixo (dir -1).
export function rolarNumero(el, html, dir) {
  el.innerHTML = html;
  if (!podeAnimar(el)) return;
  el.animate([{ transform: `translateY(${dir * 10}px)`, opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 200, easing: 'ease-out' });
}

// FLIP: mede a posição dos filhos, aplica a mudança e anima cada filho do lugar antigo ao novo.
export function flip(container, mudar) {
  const chave = el => el.dataset.chave;
  const antes = new Map();
  [...container.children].forEach(el => { if (chave(el)) antes.set(chave(el), el.getBoundingClientRect().top); });
  mudar();
  if (reduzido()) return;
  [...container.children].forEach(el => {
    const t = antes.get(chave(el));
    if (t === undefined || typeof el.animate !== 'function') return;
    const d = t - el.getBoundingClientRect().top;
    if (d) el.animate([{ transform: `translateY(${d}px)` }, { transform: 'none' }], { duration: 520, easing: MOLA });
  });
}

// Tela nova entra deslizando 34px no sentido de dir (0 = só fade); a antiga sai e é removida.
export function trocarTela(velha, nova, dir) {
  if (!velha) return;
  if (!podeAnimar(nova)) { velha.remove(); return; }
  const dx = dir * 34;
  velha.style.position = 'absolute';
  velha.style.inset = '0 0 auto 0';
  velha.style.pointerEvents = 'none';
  // remove pelo fim da animação ou, se a linha do tempo parar (aba em segundo plano), pelo relógio
  const tirar = () => velha.remove();
  velha.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: `translateX(${-dx}px)` }],
    { duration: 240, easing: 'ease-in', fill: 'forwards' }).onfinish = tirar;
  setTimeout(tirar, 320);
  nova.animate([{ opacity: 0, transform: `translateX(${dx}px)` }, { opacity: 1, transform: 'none' }],
    { duration: 340, easing: SUAVE });
}

export function confete(alvo) {
  if (!podeAnimar(alvo)) return;
  const cores = ['#d9e3cf', '#d3e2ee', '#efe3cc', '#e9d3c6', '#1c1f23'];
  for (let i = 0; i < 34; i++) {
    const c = document.createElement('i');
    c.className = 'confete';
    c.setAttribute('aria-hidden', 'true');
    c.style.left = `${Math.random() * 100}%`;
    c.style.background = cores[i % cores.length];
    alvo.appendChild(c);
    const x = (Math.random() - .5) * 120, rot = (Math.random() - .5) * 720;
    c.animate([{ transform: 'translateY(0) rotate(0)' }, { transform: `translate(${x}px, 110vh) rotate(${rot}deg)` }],
      { duration: 1800 + Math.random() * 1200, delay: Math.random() * 400, easing: 'cubic-bezier(.25,.6,.45,1)' })
      .onfinish = () => c.remove();
  }
}
