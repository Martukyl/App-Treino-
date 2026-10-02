// Gráfico de linha em SVG inline (sem bibliotecas), para a evolução de carga.
import { formatarNumero, formatarData, esc } from './util.js';

const L = 320, A = 180, M = { esq: 40, dir: 12, topo: 16, base: 28 };

export function graficoLinha(pontos) {
  if (pontos.length < 2) {
    return '<p class="muted">O gráfico aparece depois de 2 treinos com este exercício.</p>';
  }
  const cargas = pontos.map(p => p.carga);
  let min = Math.min(...cargas), max = Math.max(...cargas);
  if (min === max) { min -= 1; max += 1; } // evita divisão por zero
  const x = i => M.esq + (i * (L - M.esq - M.dir)) / (pontos.length - 1);
  const y = c => M.topo + ((max - c) * (A - M.topo - M.base)) / (max - min);
  const coords = pontos.map((p, i) => `${x(i).toFixed(1)},${y(p.carga).toFixed(1)}`).join(' ');
  const circulos = pontos.map((p, i) =>
    `<circle cx="${x(i).toFixed(1)}" cy="${y(p.carga).toFixed(1)}" r="5" fill="var(--accent)" tabindex="0">` +
    `<title>${esc(formatarData(p.data))}: ${formatarNumero(p.carga)} kg</title></circle>`).join('');
  return `<svg viewBox="0 0 ${L} ${A}" role="img" aria-label="Evolução da carga">` +
    `<line x1="${M.esq}" y1="${y(max)}" x2="${L - M.dir}" y2="${y(max)}" stroke="var(--surface-2)"/>` +
    `<line x1="${M.esq}" y1="${y(min)}" x2="${L - M.dir}" y2="${y(min)}" stroke="var(--surface-2)"/>` +
    `<text x="${M.esq - 6}" y="${y(max) + 4}" text-anchor="end" fill="var(--muted)" font-size="11">${formatarNumero(Math.max(...cargas))}</text>` +
    `<text x="${M.esq - 6}" y="${y(min) + 4}" text-anchor="end" fill="var(--muted)" font-size="11">${formatarNumero(Math.min(...cargas))}</text>` +
    `<text x="${M.esq}" y="${A - 8}" fill="var(--muted)" font-size="11">${esc(formatarData(pontos[0].data))}</text>` +
    `<text x="${L - M.dir}" y="${A - 8}" text-anchor="end" fill="var(--muted)" font-size="11">${esc(formatarData(pontos.at(-1).data))}</text>` +
    `<polyline points="${coords}" fill="none" stroke="var(--accent)" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/>` +
    circulos + '</svg>';
}
