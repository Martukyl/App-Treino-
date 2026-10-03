// Regras puras da gravação ao vivo: aplicar um ponto de GPS ao `cardioAtual`.
// Sem DOM, storage nem relógio (testável no Node). Tempos em epoch ms.
import { aceitarPonto, distanciaM, estadoSubidaInicial, ganhoSubida } from './geo.js';
import { metPara } from './cardio.js';

const DT_MAX_KCAL_S = 30; // lacuna maior que isso não conta calorias além de 30 s

// Gravação nova, rodando desde `agora`.
export function novoCardioAtual({ id, trajetoId, tipo, agora }) {
  return {
    id, tipo, trajetoId,
    inicio: new Date(agora).toISOString(),
    pausado: false,
    acumuladoMs: 0,
    retomadoEm: agora,
    distanciaM: 0,
    subidaM: 0, subidaRef: estadoSubidaInicial().ref,
    altMin: null, altMax: null, altAtual: null,
    kcal: 0, // NÃO arredondado: cada trecho de ~5 s arredondaria para 0
    ultimo: null
  };
}

// Tempo em movimento (ms): relógio de parede, sobrevive a tela apagada e recarga.
export function tempoMs(atual, agora) {
  const rodando = atual.pausado || atual.retomadoEm == null ? 0 : Math.max(0, agora - atual.retomadoEm);
  return (atual.acumuladoMs || 0) + rodando;
}

export function pausar(atual, agora) {
  if (atual.pausado) return atual;
  return { ...atual, pausado: true, acumuladoMs: tempoMs(atual, agora), retomadoEm: null };
}

// Retomar zera `ultimo`: o primeiro ponto depois da pausa abre um segmento novo sem somar distância.
export function retomar(atual, agora) {
  if (!atual.pausado) return atual;
  return { ...atual, pausado: false, retomadoEm: agora, ultimo: null };
}

// ponto: { lat, lon, alt, accuracy, t }. peso: kg ou null (sem peso, kcal não acumula).
// → { atual, aceito, motivo, item } ; item = { p: [lat, lon, alt|null, t], novo } quando aceito.
export function aplicarPonto(atual, ponto, peso) {
  if (atual.pausado) return { atual, aceito: false, motivo: 'pausado', item: null };
  const alt = Number.isFinite(ponto.alt) ? ponto.alt : null;
  const p = { ...ponto, alt };
  const r = aceitarPonto(atual.ultimo, p, atual.tipo);

  if (!r.aceito) {
    // parado: só atualiza a altitude corrente
    if (r.motivo === 'parado' && alt != null && alt !== atual.altAtual) {
      return { atual: { ...atual, altAtual: alt }, aceito: false, motivo: r.motivo, item: null };
    }
    return { atual, aceito: false, motivo: r.motivo, item: null };
  }

  let distancia = atual.distanciaM;
  let kcal = atual.kcal;
  if (r.somarDistancia && atual.ultimo) {
    const d = distanciaM(atual.ultimo, p);
    const dtReal = (p.t - atual.ultimo.t) / 1000;
    distancia += d;
    if (peso > 0 && dtReal > 0) {
      const kmh = (d / dtReal) * 3.6;
      kcal += metPara(atual.tipo, kmh) * peso * (Math.min(dtReal, DT_MAX_KCAL_S) / 3600);
    }
  }

  const sub = ganhoSubida({ ref: atual.subidaRef, subida: atual.subidaM }, alt);
  const novo = {
    ...atual,
    distanciaM: distancia,
    kcal,
    subidaM: sub.subida, subidaRef: sub.ref,
    altAtual: alt ?? atual.altAtual,
    altMin: alt == null ? atual.altMin : (atual.altMin == null ? alt : Math.min(atual.altMin, alt)),
    altMax: alt == null ? atual.altMax : (atual.altMax == null ? alt : Math.max(atual.altMax, alt)),
    ultimo: { lat: p.lat, lon: p.lon, alt, t: p.t }
  };
  return { atual: novo, aceito: true, motivo: r.motivo, item: { p: [p.lat, p.lon, alt, p.t], novo: r.novoSegmento } };
}

// Ritmo (s/km) a partir da velocidade (km/h); null parado/sem velocidade
export function ritmoDeVelocidade(kmh) {
  return Number.isFinite(kmh) && kmh >= 0.5 ? 3600 / kmh : null;
}
