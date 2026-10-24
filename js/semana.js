// Números da tela Hoje: progresso da semana e duração estimada de um treino.
import { diaLocal, inicioSemana, somarDias } from './pontos.js';

// Dias (seg–dom da semana de hoje) com treino concluído, sobre o número de treinos cadastrados.
export function progressoSemana(est, hojeISO) {
  const seg = inicioSemana(hojeISO), dom = somarDias(seg, 6);
  const dias = new Set();
  for (const s of est.sessoes || []) {
    const d = s.fim ? diaLocal(s.fim) : null;
    if (d && d >= seg && d <= dom) dias.add(d);
  }
  return { feitos: dias.size, total: (est.treinos || []).length };
}

// Média da duração das sessões daquele treino, em múltiplos de 5 min (mínimo 5); sem sessão → null.
export function estimativaMin(est, treinoId) {
  const duracoes = (est.sessoes || [])
    .filter(s => s.treinoId === treinoId && s.fim)
    .map(s => (new Date(s.fim) - new Date(s.inicio)) / 60000)
    .filter(m => Number.isFinite(m) && m > 0);
  if (!duracoes.length) return null;
  const media = duracoes.reduce((a, b) => a + b, 0) / duracoes.length;
  return Math.max(5, Math.round(media / 5) * 5);
}
