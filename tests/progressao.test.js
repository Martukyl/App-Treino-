import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  historicoDoExercicio, cargaPredominante, avaliar, proximoTreino, melhorCargaPorSessao
} from '../js/progressao.js';

const barra = { id: 'x', incremento: 2.5 };
const halter = { id: 'h', incremento: 1 };

// monta uma Entrada de histórico: cargas e reps por série
function entrada(data, cargas, reps, { series = cargas.length, repMin = 8, repMax = 12 } = {}) {
  return { data, series, repMin, repMax, registros: cargas.map((c, i) => ({ carga: c, reps: reps[i], feita: true })) };
}

test('sem histórico → novo', () => {
  assert.deepEqual(avaliar([], barra), { status: 'novo', cargaAtual: null, cargaSugerida: null, ultima: null });
});

test('todas as séries no topo da faixa → aumentar', () => {
  const h = [entrada('2026-10-02', [40, 40, 40], [12, 12, 13])];
  const r = avaliar(h, barra);
  assert.equal(r.status, 'aumentar');
  assert.equal(r.cargaAtual, 40);
  assert.equal(r.cargaSugerida, 42.5);
  assert.equal(r.ultima.data, '2026-10-02');
});

test('uma série abaixo do topo → manter', () => {
  const r = avaliar([entrada('2026-10-02', [40, 40, 40], [12, 12, 11])], barra);
  assert.equal(r.status, 'manter');
  assert.equal(r.cargaSugerida, 40);
});

test('cargas diferentes entre séries → manter', () => {
  const r = avaliar([entrada('2026-10-02', [40, 40, 42.5], [12, 12, 12])], barra);
  assert.equal(r.status, 'manter');
});

test('menos séries feitas que o prescrito → manter', () => {
  const r = avaliar([entrada('2026-10-02', [40, 40], [12, 12], { series: 3 })], barra);
  assert.equal(r.status, 'manter');
});

test('incremento de halter é 1 kg', () => {
  const r = avaliar([entrada('2026-10-02', [8, 8, 8], [12, 12, 12])], halter);
  assert.equal(r.cargaSugerida, 9);
});

test('duas sessões seguidas abaixo do mínimo com a mesma carga → reduzir 10%', () => {
  const h = [
    entrada('2026-10-02', [40, 40, 40], [7, 6, 6]),
    entrada('2026-09-28', [40, 40, 40], [8, 7, 6])
  ];
  const r = avaliar(h, barra);
  assert.equal(r.status, 'reduzir');
  assert.equal(r.cargaSugerida, 35); // floor(36 / 2,5) * 2,5
});

test('só uma sessão abaixo do mínimo → manter', () => {
  const h = [
    entrada('2026-10-02', [40, 40, 40], [7, 6, 6]),
    entrada('2026-09-28', [40, 40, 40], [10, 9, 9])
  ];
  assert.equal(avaliar(h, barra).status, 'manter');
});

test('abaixo do mínimo mas com cargas diferentes nas duas sessões → manter', () => {
  const h = [
    entrada('2026-10-02', [42.5, 42.5, 42.5], [7, 6, 6]),
    entrada('2026-09-28', [40, 40, 40], [7, 6, 6])
  ];
  assert.equal(avaliar(h, barra).status, 'manter');
});

test('reduzir que daria zero vira manter', () => {
  const h = [entrada('2026-10-02', [2], [3]), entrada('2026-09-28', [2], [3])];
  assert.equal(avaliar(h, barra).status, 'manter');
});

test('cargaPredominante: mais usada; empate → maior', () => {
  assert.equal(cargaPredominante([{ carga: 40 }, { carga: 40 }, { carga: 42.5 }]), 40);
  assert.equal(cargaPredominante([{ carga: 40 }, { carga: 42.5 }]), 42.5);
  assert.equal(cargaPredominante([]), null);
});

test('historicoDoExercicio: só finalizadas, só feitas, mais recente primeiro, usa o exercício feito', () => {
  const sessoes = [
    { id: 's1', treinoId: 'A', inicio: '2026-09-28T10:00:00Z', fim: '2026-09-28T11:00:00Z', itens: [
      { exercicioId: 'x', trocadoDe: null, series: 3, repMin: 8, repMax: 12, descanso: 90,
        registros: [{ carga: 40, reps: 10, feita: true }, { carga: 40, reps: 9, feita: false }] }
    ] },
    { id: 's2', treinoId: 'A', inicio: '2026-10-02T10:00:00Z', fim: '2026-10-02T11:00:00Z', itens: [
      { exercicioId: 'y', trocadoDe: 'x', series: 3, repMin: 8, repMax: 12, descanso: 90,
        registros: [{ carga: 20, reps: 12, feita: true }] },
      { exercicioId: 'x', trocadoDe: null, series: 3, repMin: 8, repMax: 12, descanso: 90,
        registros: [{ carga: 42.5, reps: 8, feita: false }] }
    ] },
    { id: 's3', treinoId: 'A', inicio: '2026-10-03T10:00:00Z', fim: null, itens: [
      { exercicioId: 'x', trocadoDe: null, series: 3, repMin: 8, repMax: 12, descanso: 90,
        registros: [{ carga: 45, reps: 8, feita: true }] }
    ] }
  ];
  const hx = historicoDoExercicio(sessoes, 'x');
  assert.equal(hx.length, 1);
  assert.equal(hx[0].data, '2026-09-28T11:00:00Z');
  assert.deepEqual(hx[0].registros, [{ carga: 40, reps: 10, feita: true }]);
  const hy = historicoDoExercicio(sessoes, 'y');
  assert.equal(hy.length, 1);
  assert.equal(hy[0].registros[0].carga, 20);
});

test('proximoTreino cicla A→E→A e trata null/id inexistente', () => {
  const treinos = ['A', 'B', 'C', 'D', 'E'].map(id => ({ id }));
  assert.equal(proximoTreino(treinos, null).id, 'A');
  assert.equal(proximoTreino(treinos, 'A').id, 'B');
  assert.equal(proximoTreino(treinos, 'E').id, 'A');
  assert.equal(proximoTreino(treinos, 'Z').id, 'A');
  assert.equal(proximoTreino([], 'A'), null);
});

test('melhorCargaPorSessao em ordem cronológica', () => {
  const h = [entrada('2026-10-02', [40, 42.5], [10, 8]), entrada('2026-09-28', [37.5, 40], [12, 10])];
  assert.deepEqual(melhorCargaPorSessao(h), [
    { data: '2026-09-28', carga: 40 },
    { data: '2026-10-02', carga: 42.5 }
  ]);
});
