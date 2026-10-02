// Utilitários puros: formatação pt-BR, conversão de números e ids.
// Não acessam DOM nem localStorage (testáveis no Node).

// Versão do app: deve ser igual ao número de CACHE em sw.js (treino-<VERSAO_APP>).
export const VERSAO_APP = '1.0.0';

export function arredondar(n, passo = 0.5) {
  // o epsilon evita 42.49999 virar 42 por erro de ponto flutuante
  return Math.round(n / passo + 1e-9) * passo;
}

export function parseNumero(txt) {
  if (typeof txt === 'number') return Number.isFinite(txt) && txt >= 0 ? txt : null;
  if (txt == null) return null;
  const s = String(txt).trim().replace(',', '.');
  // aceita estados intermediários da digitação: "42," e "42." → 42; ",5" e ".5" → 0.5
  if (!/^(\d+\.?\d*|\.\d+)$/.test(s)) return null;
  return Number(s);
}

export function parseCarga(txt) {
  const n = parseNumero(txt);
  return n == null ? null : Math.round(n * 10) / 10;
}

export function parseReps(txt) {
  const n = parseNumero(txt);
  return n != null && Number.isInteger(n) ? n : null;
}

const fmtNumero = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 });

export function formatarNumero(n) {
  return fmtNumero.format(n);
}

// Para o value= de inputs: sem separador de milhar (parseCarga leria "1.000" como 1)
const fmtCampo = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1, useGrouping: false });

export function formatarCampo(n) {
  return fmtCampo.format(n);
}

export function formatarKg(n) {
  if (n == null || Number.isNaN(n)) return '—';
  return `${formatarNumero(n)} kg`;
}

export function formatarData(iso) {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

export function formatarDataCompleta(iso) {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export function formatarDuracao(ms) {
  const min = Math.floor(ms / 60000);
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  return `${h}h ${String(min % 60).padStart(2, '0')}min`;
}

export function formatarDescanso(s) {
  if (s < 60) return `${s} s`;
  const min = Math.floor(s / 60), seg = s % 60;
  return seg ? `${min} min ${seg} s` : `${min} min`;
}

export function gerarId(prefixo = '') {
  return prefixo + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

const MAPA_ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

export function esc(txt) {
  if (txt == null) return '';
  return String(txt).replace(/[&<>"']/g, c => MAPA_ESC[c]);
}
