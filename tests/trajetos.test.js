import { test } from 'node:test';
import assert from 'node:assert/strict';
import { anexarAoTrajeto, idsTrajetos, sanitizarTrajeto } from '../js/trajetos.js';

test('anexarAoTrajeto cria, continua e abre segmentos sem alterar o original', () => {
  const t0 = { segmentos: [[[1, 1, null, 1000]]] };
  const t1 = anexarAoTrajeto(t0, [
    { p: [1, 2, 5, 2000], novo: false },
    { p: [3, 3, 6, 3000], novo: true },
    { p: [3, 4, 6, 4000], novo: false }
  ]);
  assert.deepEqual(t1.segmentos, [[[1, 1, null, 1000], [1, 2, 5, 2000]], [[3, 3, 6, 3000], [3, 4, 6, 4000]]]);
  assert.equal(t0.segmentos[0].length, 1);
  assert.deepEqual(anexarAoTrajeto(undefined, [{ p: [0, 0, null, 1], novo: false }]).segmentos, [[[0, 0, null, 1]]]);
});

test('idsTrajetos junta cardios e gravação atual', () => {
  const est = { cardios: [{ trajetoId: 't_a' }, { trajetoId: null }, {}], cardioAtual: { trajetoId: 't_b' } };
  assert.deepEqual([...idsTrajetos(est)].sort(), ['t_a', 't_b']);
  assert.equal(idsTrajetos({}).size, 0);
});

test('sanitizarTrajeto descarta pontos e segmentos malformados', () => {
  assert.equal(sanitizarTrajeto(null), null);
  assert.equal(sanitizarTrajeto({ segmentos: 'x' }), null);
  const t = sanitizarTrajeto({ segmentos: [[[1, 2, null, 3], [1, 'a', 0, 1], 'x'], [], 'y', [[4, 5, 6, 7, 8]]] });
  assert.deepEqual(t.segmentos, [[[1, 2, null, 3]], [[4, 5, 6, 7]]]);
});
