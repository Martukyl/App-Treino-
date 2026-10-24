import { test } from 'node:test';
import assert from 'node:assert/strict';
import { restanteSegundos, fracaoDescanso } from '../js/cronometro.js';

test('restante arredonda para cima e nunca fica negativo', () => {
  assert.equal(restanteSegundos(10_000, 0), 10);
  assert.equal(restanteSegundos(10_000, 9_100), 1);
  assert.equal(restanteSegundos(10_000, 10_000), 0);
  // tela apagada por mais tempo que o descanso: já terminou
  assert.equal(restanteSegundos(10_000, 600_000), 0);
});

test('fracaoDescanso: parte que falta do descanso, limitada a 0..1', () => {
  assert.equal(fracaoDescanso(45, 90), 0.5);
  assert.equal(fracaoDescanso(120, 90), 1);
  assert.equal(fracaoDescanso(-3, 90), 0);
  assert.equal(fracaoDescanso(10, 0), 0);
  assert.equal(fracaoDescanso(10, null), 0);
});
