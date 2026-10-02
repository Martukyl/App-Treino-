import { test } from 'node:test';
import assert from 'node:assert/strict';
import { graficoLinha } from '../js/grafico.js';

test('menos de 2 pontos → mensagem', () => {
  assert.match(graficoLinha([{ data: '2026-10-02T10:00:00Z', carga: 40 }]), /depois de 2 treinos/);
});

test('gera SVG com um ponto por sessão e rótulos pt-BR', () => {
  const svg = graficoLinha([
    { data: '2026-09-28T10:00:00Z', carga: 40 },
    { data: '2026-10-02T10:00:00Z', carga: 42.5 }
  ]);
  assert.match(svg, /^<svg[^>]*viewBox="0 0 320 180"/);
  assert.equal((svg.match(/<circle/g) || []).length, 2);
  assert.match(svg, /42,5/);
  assert.match(svg, /<polyline/);
});

test('cargas iguais não geram NaN', () => {
  const svg = graficoLinha([
    { data: '2026-09-28T10:00:00Z', carga: 40 },
    { data: '2026-10-02T10:00:00Z', carga: 40 }
  ]);
  assert.doesNotMatch(svg, /NaN/);
});
