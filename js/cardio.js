// Regras puras do Cardio: formatações, ícones, itens do histórico e calorias (MET).
// Não acessam DOM nem storage (testáveis no Node).
import { ultimoValor } from './corpo.js';

export const ICONE_CARDIO = {
  caminhada: '🚶', corrida: '🏃', esteira: '🏃', bicicleta: '🚴',
  eliptico: '❤️', escada: '❤️', outro: '❤️'
};

export const ROTULO_CARDIO = {
  caminhada: 'Caminhada', corrida: 'Corrida', esteira: 'Esteira', bicicleta: 'Bicicleta',
  eliptico: 'Elíptico', escada: 'Escada', outro: 'Outro'
};

const dois = n => String(n).padStart(2, '0');
const ehNumero = v => typeof v === 'number' && Number.isFinite(v);

// segundos por km → "11:42 /km"; vazio/zero/infinito → "—"
export function formatarRitmo(segPorKm) {
  if (!ehNumero(segPorKm) || segPorKm <= 0) return '—';
  const total = Math.round(segPorKm);
  return `${Math.floor(total / 60)}:${dois(total % 60)} /km`;
}

// metros → "3,42 km"
export function formatarKm(m) {
  if (!ehNumero(m)) return '—';
  return `${new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(m / 1000)} km`;
}

// ms → "07:05" ou "1:02:09"
export function formatarCronometro(ms) {
  const total = Math.floor(Math.max(0, ms || 0) / 1000);
  const h = Math.floor(total / 3600), min = Math.floor((total % 3600) / 60), s = total % 60;
  return h > 0 ? `${h}:${dois(min)}:${dois(s)}` : `${dois(min)}:${dois(s)}`;
}

// Lista única treino + cardio por data de término desc. → [{ tipo, data, ref }]
export function itensHistorico(sessoes, cardios) {
  const itens = [
    ...(sessoes || []).map(s => ({ tipo: 'treino', data: s.fim, ref: s })),
    ...(cardios || []).map(c => ({ tipo: 'cardio', data: c.fim, ref: c }))
  ];
  return itens.sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime());
}

// ---- Calorias (Compêndio de Atividades Físicas) ----

// [limite superior exclusivo (km/h), MET]; o último degrau vale para o resto
const MET_CAMINHADA = [[3.2, 2.0], [4.0, 2.8], [4.8, 3.0], [5.6, 3.5], [6.4, 4.3], [7.2, 5.0], [Infinity, 7.0]];
const MET_CORRIDA = [[8, 6.0], [9.7, 8.3], [11.3, 9.8], [Infinity, 11.0]];
const MET_FIXO = { bicicleta: 6.8, eliptico: 5.0, escada: 9.0, outro: 5.0, esteira: 5.0 };
const VELOCIDADE_CORRIDA_KMH = 7.2; // na esteira, a partir daqui conta como corrida

const faixa = (tabela, v) => tabela.find(([lim]) => v < lim)[1];

// MET do tipo na velocidade média (km/h). Sem velocidade: caminhada 3,5 e corrida 8,3 (moderados).
export function metPara(tipo, velocidadeKmh = null) {
  const v = ehNumero(velocidadeKmh) && velocidadeKmh >= 0 ? velocidadeKmh : null;
  if (tipo === 'caminhada') return v == null ? 3.5 : faixa(MET_CAMINHADA, v);
  if (tipo === 'corrida') return v == null ? 8.3 : faixa(MET_CORRIDA, v);
  if (tipo === 'esteira' && v != null) {
    return v >= VELOCIDADE_CORRIDA_KMH ? faixa(MET_CORRIDA, v) : faixa(MET_CAMINHADA, v);
  }
  return MET_FIXO[tipo] ?? 5.0;
}

// kcal = MET × peso (kg) × horas, inteiro; null se peso ou duração inválidos
export function kcalPor(tipo, pesoKg, segundos, velocidadeKmh = null) {
  if (!ehNumero(pesoKg) || pesoKg <= 0 || !ehNumero(segundos) || segundos <= 0) return null;
  return Math.round(metPara(tipo, velocidadeKmh) * pesoKg * (segundos / 3600));
}

// Estimativa p/ registro de aparelho; só a esteira usa a distância (velocidade média).
export function kcalAparelho({ tipo, duracaoSeg, distanciaM }, pesoKg) {
  let v = null;
  if (tipo === 'esteira' && ehNumero(distanciaM) && distanciaM > 0 && ehNumero(duracaoSeg) && duracaoSeg > 0) {
    v = (distanciaM / 1000) / (duracaoSeg / 3600);
  }
  return kcalPor(tipo, pesoKg, duracaoSeg, v);
}

// Último peso registrado no Corpo, ou null
export function pesoAtual(estado) {
  return ultimoValor(estado?.medidas || [], 'peso');
}
