import { test } from 'node:test';
import assert from 'node:assert/strict';
import { restanteSegundos } from '../js/cronometro.js';

test('restante arredonda para cima e nunca fica negativo', () => {
  assert.equal(restanteSegundos(10_000, 0), 10);
  assert.equal(restanteSegundos(10_000, 9_100), 1);
  assert.equal(restanteSegundos(10_000, 10_000), 0);
  // tela apagada por mais tempo que o descanso: já terminou
  assert.equal(restanteSegundos(10_000, 600_000), 0);
});
