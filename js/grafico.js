// Gráfico de linha em SVG inline (sem bibliotecas), para a evolução de carga, peso e medidas.
import { formatarNumero, formatarData, esc } from './util.js';

const L = 320, A = 180, M = { esq: 40, dir: 12, topo: 16, base: 28 };

// 'AAAA-MM-DD' é dia local (texto puro); ISO com hora passa por Date (dia local do aparelho)
function rotuloDia(data) {
  const m = /^\d{4}-(\d{2})-(\d{2})$/.exec(data);
  return m ? `${m[2]}/${m[1]}` : formatarData(data);
}

export function graficoLinha(pontos, { unidade = 'kg', meta = null } = {}) {
  if (pontos.length < 2) {
    return '<p class="muted">O gráfico aparece depois de 2 treinos com este exercício.</p>';
  }
  const temMeta = typeof meta === 'number' && Number.isFinite(meta);
  const valor = p => p.valor ?? p.carga;
  const valores = pontos.map(valor);
  // a meta entra no eixo; os rótulos mostram os extremos reais do eixo
  const todos = temMeta ? [...valores, meta] : valores;
  const rotMin = Math.min(...todos), rotMax = Math.max(...todos);
  let min = rotMin, max = rotMax;
  if (min === max) { min -= 1; max += 1; } // evita divisão por zero
  const x = i => M.esq + (i * (L - M.esq - M.dir)) / (pontos.length - 1);
  const y = c => M.topo + ((max - c) * (A - M.topo - M.base)) / (max - min);
  const coords = pontos.map((p, i) => `${x(i).toFixed(1)},${y(valor(p)).toFixed(1)}`).join(' ');
  // círculo visível (r=5, sem foco) + área de toque transparente maior (r=14, focável)
  const circulos = pontos.map((p, i) => {
    const cx = x(i).toFixed(1), cy = y(valor(p)).toFixed(1);
    const titulo = `<title>${esc(rotuloDia(p.data))}: ${formatarNumero(valor(p))} ${esc(unidade)}</title>`;
    return `<circle class="ponto" cx="${cx}" cy="${cy}" r="5" fill="var(--accent)">${titulo}</circle>` +
      `<circle class="toque" cx="${cx}" cy="${cy}" r="14" fill="transparent" tabindex="0">${titulo}</circle>`;
  }).join('');
  const linhaMeta = temMeta
    ? `<line class="meta" x1="${M.esq}" y1="${y(meta).toFixed(1)}" x2="${L - M.dir}" y2="${y(meta).toFixed(1)}" stroke="var(--ok)" stroke-width="2" stroke-dasharray="6 4"/>` +
      `<text x="${L - M.dir}" y="${(y(meta) - 4).toFixed(1)}" text-anchor="end" fill="var(--ok)" font-size="11">meta</text>`
    : '';
  return `<svg viewBox="0 0 ${L} ${A}" role="img" aria-label="${pontos[0].carga != null ? 'Evolução da carga' : `Evolução em ${esc(unidade)}`}">` +
    `<line x1="${M.esq}" y1="${y(max)}" x2="${L - M.dir}" y2="${y(max)}" stroke="var(--surface-2)"/>` +
    `<line x1="${M.esq}" y1="${y(min)}" x2="${L - M.dir}" y2="${y(min)}" stroke="var(--surface-2)"/>` +
    `<text x="${M.esq - 6}" y="${y(max) + 4}" text-anchor="end" fill="var(--muted)" font-size="11">${formatarNumero(rotMax)}</text>` +
    `<text x="${M.esq - 6}" y="${y(min) + 4}" text-anchor="end" fill="var(--muted)" font-size="11">${formatarNumero(rotMin)}</text>` +
    `<text x="${M.esq}" y="${A - 8}" fill="var(--muted)" font-size="11">${esc(rotuloDia(pontos[0].data))}</text>` +
    `<text x="${L - M.dir}" y="${A - 8}" text-anchor="end" fill="var(--muted)" font-size="11">${esc(rotuloDia(pontos.at(-1).data))}</text>` +
    linhaMeta +
    `<polyline points="${coords}" fill="none" stroke="var(--accent)" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/>` +
    circulos + '</svg>';
}
