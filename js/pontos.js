// Regras da competição (pontos, totais por dia/período, sequência) — funções puras.
// Não acessam DOM nem storage (testáveis no Node). Datas 'AAAA-MM-DD' são dias LOCAIS:
// nunca usar new Date('AAAA-MM-DD') (vira UTC e volta um dia no Brasil).
import { hojeISO } from './util.js';

export const PONTOS_POR_TREINO = 10;
export const MAX_PONTOS_CARDIO = 12; // 60 min de cardio no dia = teto
export const MIN_POR_PONTO_CARDIO = 5;

// Data local (AAAA-MM-DD) de um instante ISO com hora; sem data válida, null
export function diaLocal(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : hojeISO(d);
}

function paraData(dia) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dia || '');
  if (!m) throw new Error(`dia inválido: ${dia}`);
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12); // meio-dia: imune a horário de verão
}

// 'AAAA-MM-DD' + n dias (n pode ser negativo), no calendário local
export function somarDias(dia, n) {
  const d = paraData(dia);
  d.setDate(d.getDate() + n);
  return hojeISO(d);
}

// segunda-feira da semana do dia (domingo pertence à semana que começou na segunda anterior)
export function inicioSemana(dia) {
  const d = paraData(dia);
  const desdeSegunda = (d.getDay() + 6) % 7; // seg=0 … dom=6
  return somarDias(dia, -desdeSegunda);
}

export function inicioMes(dia) {
  paraData(dia);
  return `${dia.slice(0, 7)}-01`;
}

// Acumula por dia local: sessões finalizadas com ≥ 1 série feita e cardios.
// → Map dia → { treinos, seg, distM }
function agruparPorDia(sessoes, cardios) {
  const mapa = new Map();
  const dia = d => {
    if (!mapa.has(d)) mapa.set(d, { treinos: 0, seg: 0, distM: 0 });
    return mapa.get(d);
  };
  for (const s of sessoes || []) {
    if (!s || !s.fim) continue;
    const temSerie = (s.itens || []).some(it => (it.registros || []).some(r => r.feita));
    const d = diaLocal(s.fim);
    if (temSerie && d) dia(d).treinos += 1;
  }
  for (const c of cardios || []) {
    const d = c && diaLocal(c.fim);
    if (!d) continue;
    const acc = dia(d);
    if (Number.isFinite(c.duracaoSeg) && c.duracaoSeg > 0) acc.seg += c.duracaoSeg;
    if (Number.isFinite(c.distanciaM) && c.distanciaM > 0) acc.distM += c.distanciaM;
  }
  return mapa;
}

export function pontosDoDia(treinos, cardioMin) {
  return PONTOS_POR_TREINO * Math.min(treinos, 1)
    + Math.min(Math.floor(cardioMin / MIN_POR_PONTO_CARDIO), MAX_PONTOS_CARDIO);
}

const arred2 = n => Math.round(n * 100) / 100;

function totaisDeAcumulado(acc) {
  const treinos = acc ? acc.treinos : 0;
  const cardioMin = acc ? Math.floor(acc.seg / 60) : 0;
  const km = acc ? arred2(acc.distM / 1000) : 0;
  return { treinos, cardioMin, km, pontos: pontosDoDia(treinos, cardioMin) };
}

export function totaisDia(sessoes, cardios, dia) {
  return totaisDeAcumulado(agruparPorDia(sessoes, cardios).get(dia));
}

// soma dos dias de inicio a fim, inclusive
export function totaisPeriodo(sessoes, cardios, inicio, fim) {
  const mapa = agruparPorDia(sessoes, cardios);
  const soma = { treinos: 0, cardioMin: 0, km: 0, pontos: 0 };
  for (let d = inicio; d <= fim; d = somarDias(d, 1)) {
    const t = totaisDeAcumulado(mapa.get(d));
    soma.treinos += t.treinos;
    soma.cardioMin += t.cardioMin;
    soma.km += t.km;
    soma.pontos += t.pontos;
  }
  soma.km = arred2(soma.km);
  return soma;
}

// Conjunto de dias com atividade (treino ou ao menos 1 min de cardio)
export function diasAtivos(sessoes, cardios) {
  const ativos = new Set();
  for (const [d, acc] of agruparPorDia(sessoes, cardios)) {
    const t = totaisDeAcumulado(acc);
    if (t.treinos > 0 || t.cardioMin > 0) ativos.add(d);
  }
  return ativos;
}

// Dias seguidos com atividade terminando hoje; se hoje ainda não tem, terminando ontem.
// ativos: Set ou array de 'AAAA-MM-DD'.
export function sequencia(ativos, hoje) {
  const conjunto = ativos instanceof Set ? ativos : new Set(ativos);
  let d = conjunto.has(hoje) ? hoje : somarDias(hoje, -1);
  let n = 0;
  while (conjunto.has(d)) { n += 1; d = somarDias(d, -1); }
  return n;
}

// 7 itens seg..dom da semana de `hoje`: { dia, ativo }
export function diasDaSemana(sessoes, cardios, hoje) {
  const ativos = diasAtivos(sessoes, cardios);
  const seg = inicioSemana(hoje);
  return Array.from({ length: 7 }, (_, i) => {
    const dia = somarDias(seg, i);
    return { dia, ativo: ativos.has(dia) };
  });
}
