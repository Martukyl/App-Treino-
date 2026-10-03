// Regras de progressão de carga (progressão dupla) — funções puras.
// Ver spec §6.
import { arredondar } from './util.js';

// Histórico de um exercício nas sessões finalizadas, mais recente primeiro.
// Cada entrada guarda a prescrição da época (snapshot) e só as séries feitas.
export function historicoDoExercicio(sessoes, exercicioId) {
  const saida = [];
  for (const s of sessoes) {
    if (!s.fim) continue;
    for (const item of s.itens) {
      if (item.exercicioId !== exercicioId) continue;
      const feitos = item.registros.filter(r => r.feita);
      if (feitos.length === 0) continue;
      saida.push({ data: s.fim, series: item.series, repMin: item.repMin, repMax: item.repMax, registros: feitos });
    }
  }
  saida.sort((a, b) => (a.data < b.data ? 1 : a.data > b.data ? -1 : 0));
  return saida;
}

// Carga mais usada nas séries; em empate, a maior.
export function cargaPredominante(registros) {
  if (!registros.length) return null;
  const contagem = new Map();
  for (const r of registros) contagem.set(r.carga, (contagem.get(r.carga) || 0) + 1);
  let melhor = null, vezes = -1;
  for (const [carga, n] of contagem) {
    if (n > vezes || (n === vezes && carga > melhor)) { melhor = carga; vezes = n; }
  }
  return melhor;
}

function mediaReps(registros) {
  return registros.reduce((s, r) => s + r.reps, 0) / registros.length;
}

export function avaliar(historico, exercicio) {
  if (!historico.length) return { status: 'novo', cargaAtual: null, cargaSugerida: null, ultima: null };

  const [h0, h1] = historico;
  const cargaAtual = cargaPredominante(h0.registros);
  const ultima = { data: h0.data, registros: h0.registros };
  const inc = exercicio.incremento || 0;
  const manter = { status: 'manter', cargaAtual, cargaSugerida: cargaAtual, ultima };

  // aumentar: todas as séries prescritas feitas, mesma carga, todas no topo da faixa
  const mesmaCarga = h0.registros.every(r => r.carga === h0.registros[0].carga);
  const todasNoTopo = h0.registros.every(r => r.reps >= h0.repMax);
  if (inc > 0 && h0.registros.length >= h0.series && mesmaCarga && todasNoTopo) {
    return { status: 'aumentar', cargaAtual, cargaSugerida: arredondar(cargaAtual + inc), ultima };
  }

  // reduzir: duas sessões seguidas, mesma carga, média de reps abaixo do mínimo
  if (inc > 0 && h1 && cargaPredominante(h1.registros) === cargaAtual &&
      mediaReps(h0.registros) < h0.repMin && mediaReps(h1.registros) < h1.repMin) {
    const sugerida = arredondar(Math.floor((cargaAtual * 0.9) / inc + 1e-9) * inc);
    if (sugerida > 0) return { status: 'reduzir', cargaAtual, cargaSugerida: sugerida, ultima };
  }

  return manter;
}

// Próximo treino da sequência; após o último volta ao primeiro.
export function proximoTreino(treinos, ultimoTreinoId) {
  if (!treinos.length) return null;
  const i = treinos.findIndex(t => t.id === ultimoTreinoId);
  return i < 0 ? treinos[0] : treinos[(i + 1) % treinos.length];
}

// Próxima letra livre (A–Z) para um treino novo. Prefere uma letra que nem treino atual nem
// sessão do histórico usam (para não confundir treinos antigos com o novo); sem isso, qualquer
// letra livre entre os treinos. null se as 26 estão em uso.
export function proximaLetraLivre(treinos, sessoes = []) {
  const letras = Array.from({ length: 26 }, (_, i) => String.fromCharCode(65 + i));
  const emTreinos = new Set(treinos.map(t => t.id));
  const noHistorico = new Set(sessoes.map(s => s.treinoId));
  return letras.find(l => !emTreinos.has(l) && !noHistorico.has(l))
    ?? letras.find(l => !emTreinos.has(l))
    ?? null;
}

// Maior carga feita em cada sessão, em ordem cronológica (para o gráfico).
export function melhorCargaPorSessao(historico) {
  return historico
    .map(h => ({ data: h.data, carga: Math.max(...h.registros.map(r => r.carga)) }))
    .reverse();
}
