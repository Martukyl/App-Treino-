import { test } from 'node:test';
import assert from 'node:assert/strict';
import { indiceAtual, ajustarCarga, ajustarReps, copiarCargaSeguintes } from '../js/sessao-ui.js';

const reg = (feita, carga = 20, reps = 10) => ({ carga, reps, feita });
const item = (...feitas) => ({ registros: feitas.map(f => reg(f)) });
// item 0 concluído, item 1 com uma série feita, item 2 sem nada
const sessao = { itens: [item(true, true), item(true, false), item(false, false)] };

test('indiceAtual usa o guardado quando ainda tem série pendente', () => {
  assert.equal(indiceAtual(sessao, 2), 2);
  assert.equal(indiceAtual(sessao, 1), 1);
});

test('indiceAtual pula guardado já concluído e vai ao primeiro pendente', () => {
  assert.equal(indiceAtual(sessao, 0), 1);
});

test('indiceAtual sem guardado (sessão da v1.5) abre o primeiro pendente', () => {
  assert.equal(indiceAtual(sessao, null), 1);
  assert.equal(indiceAtual(sessao, 99), 1); // guardado fora do intervalo
});

test('indiceAtual com tudo feito devolve o último', () => {
  assert.equal(indiceAtual({ itens: [item(true), item(true, true)] }, null), 1);
});

test('ajustarCarga: vazio + passo vira o incremento', () => {
  assert.equal(ajustarCarga(null, 1, 2.5), 2.5);
  assert.equal(ajustarCarga(0, 1, 1), 1);
});

test('ajustarCarga: descer para no zero (peso corporal), nunca negativo', () => {
  assert.equal(ajustarCarga(2.5, -1, 2.5), 0);
  assert.equal(ajustarCarga(1, -1, 2), 0);
  assert.equal(ajustarCarga(null, -1, 2.5), 0);
  assert.equal(ajustarCarga(0, -1, 2.5), 0);
});

test('ajustarCarga soma o incremento sem erro de ponto flutuante', () => {
  assert.equal(ajustarCarga(20, 1, 2.5), 22.5);
  assert.equal(ajustarCarga(0.3, 1, 0.1), 0.4);
  assert.equal(ajustarCarga(22, -1, 2), 20);
});

test('ajustarReps não desce de 1', () => {
  assert.equal(ajustarReps(10, 1), 11);
  assert.equal(ajustarReps(1, -1), 1);
  assert.equal(ajustarReps(null, 1), 1);
});

test('copiarCargaSeguintes não altera séries feitas nem anteriores', () => {
  const regs = [reg(false, 18), reg(true, 18), reg(false, 18), reg(false, 18)];
  copiarCargaSeguintes(regs, 0, 22);
  assert.deepEqual(regs.map(r => r.carga), [18, 18, 22, 22]);
  copiarCargaSeguintes(regs, 2, null);
  assert.deepEqual(regs.map(r => r.carga), [18, 18, 22, null]);
});
