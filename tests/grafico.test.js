import { test } from 'node:test';
import assert from 'node:assert/strict';
import { graficoLinha, miniGrafico, graficoColunas } from '../js/grafico.js';

test('menos de 2 pontos → mensagem', () => {
  assert.match(graficoLinha([{ data: '2026-10-02T10:00:00Z', carga: 40 }]), /depois de 2 treinos/);
});

test('gera SVG com um ponto por sessão e rótulos pt-BR', () => {
  const svg = graficoLinha([
    { data: '2026-09-28T10:00:00Z', carga: 40 },
    { data: '2026-10-02T10:00:00Z', carga: 42.5 }
  ]);
  assert.match(svg, /^<svg[^>]*viewBox="0 0 320 180"/);
  // só os círculos visíveis (cada ponto também tem uma área de toque maior)
  assert.equal((svg.match(/<circle class="ponto"/g) || []).length, 2);
  assert.equal((svg.match(/<circle class="toque"/g) || []).length, 2);
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

test('aceita { data, valor } com data AAAA-MM-DD e unidade cm no título', () => {
  const svg = graficoLinha([
    { data: '2026-09-28', valor: 80 },
    { data: '2026-10-02', valor: 78.5 }
  ], { unidade: 'cm' });
  assert.match(svg, /<title>28\/09: 80 cm<\/title>/);
  assert.match(svg, /<title>02\/10: 78,5 cm<\/title>/);
  assert.doesNotMatch(svg, /NaN|undefined/);
});

test('chamada antiga: título em kg e sem linha de meta', () => {
  const svg = graficoLinha([
    { data: '2026-09-28T10:00:00Z', carga: 40 },
    { data: '2026-10-02T10:00:00Z', carga: 42.5 }
  ]);
  assert.match(svg, /: 42,5 kg<\/title>/);
  assert.doesNotMatch(svg, /meta/);
  assert.doesNotMatch(svg, /stroke-dasharray/);
});

test('meta gera linha tracejada com --ok e rótulo, e entra no eixo', () => {
  const pontos = [{ data: '2026-09-28', valor: 60 }, { data: '2026-10-02', valor: 62 }];
  const svg = graficoLinha(pontos, { meta: 70 });
  assert.match(svg, /<line[^>]*stroke="var\(--ok\)"[^>]*stroke-dasharray/);
  assert.match(svg, />meta</);
  // o eixo agora vai até 70 (rótulo do topo)
  assert.match(svg, />70<\/text>/);
  const sem = graficoLinha(pontos);
  assert.doesNotMatch(sem, />70<\/text>/);
});

test('meta abaixo dos valores estende o mínimo do eixo e não gera NaN', () => {
  const svg = graficoLinha([{ data: '2026-09-28', valor: 60 }, { data: '2026-10-02', valor: 62 }], { meta: 55 });
  assert.match(svg, />55<\/text>/);
  assert.doesNotMatch(svg, /NaN/);
});

test('miniGrafico: menos de 2 valores não desenha nada', () => {
  assert.equal(miniGrafico([1]), '');
  assert.equal(miniGrafico([]), '');
});

test('miniGrafico desenha um traço animável no tamanho padrão', () => {
  const svg = miniGrafico([1, 2, 3]);
  assert.match(svg, /viewBox="0 0 46 20"/);
  assert.match(svg, /data-desenhar/);
});

test('miniGrafico com valores iguais não gera NaN', () => {
  assert.doesNotMatch(miniGrafico([5, 5]), /NaN/);
});

test('graficoLinha com desenhar: true marca o traço para animar', () => {
  const pts = [{ data: '2026-10-01', valor: 70 }, { data: '2026-10-08', valor: 69 }];
  assert.match(graficoLinha(pts, { desenhar: true }), /<polyline[^>]*data-desenhar/);
  assert.doesNotMatch(graficoLinha(pts), /data-desenhar/);
});

test('graficoColunas: uma coluna por valor, a última destacada', () => {
  const html = graficoColunas([10, 20], ['a', 'b']);
  assert.equal((html.match(/<i /g) || []).length, 2);
  assert.match(html, /class="coluna atual"[\s\S]*b<\/small>/);
  assert.match(html, /data-crescer/);
});

test('graficoColunas mostra só as 8 últimas', () => {
  const v = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  const html = graficoColunas(v, v.map(String));
  assert.equal((html.match(/<i /g) || []).length, 8);
  assert.doesNotMatch(html, />1<\/small>/);
  assert.equal(graficoColunas([], []), '');
});
