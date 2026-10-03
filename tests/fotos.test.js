import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calcularDimensoes, idsReferenciados } from '../js/fotos.js';

test('calcularDimensoes reduz mantendo a proporção e nunca amplia', () => {
  assert.deepEqual(calcularDimensoes(4000, 3000), { sx: 0, sy: 0, sw: 4000, sh: 3000, dw: 1080, dh: 810 });
  assert.deepEqual(calcularDimensoes(3000, 4000), { sx: 0, sy: 0, sw: 3000, sh: 4000, dw: 810, dh: 1080 });
  const pequena = calcularDimensoes(500, 300);
  assert.equal(pequena.dw, 500);
  assert.equal(pequena.dh, 300);
});

test('calcularDimensoes quadrado recorta o centro e limita a 400 px', () => {
  assert.deepEqual(calcularDimensoes(4000, 3000, { lado: 1080, quadrado: true }),
    { sx: 500, sy: 0, sw: 3000, sh: 3000, dw: 400, dh: 400 });
  const retrato = calcularDimensoes(300, 500, { quadrado: true });
  assert.deepEqual(retrato, { sx: 0, sy: 100, sw: 300, sh: 300, dw: 300, dh: 300 });
});

test('idsReferenciados junta fotos dos registros e do perfil, ignorando nulos', () => {
  const est = {
    perfil: { fotoId: 'f_perfil' },
    medidas: [
      { fotos: { frente: 'f_a', lado: null, costas: 'f_b' } },
      { fotos: { frente: 'f_a' } },
      { fotos: null },
      {}
    ]
  };
  assert.deepEqual([...idsReferenciados(est)].sort(), ['f_a', 'f_b', 'f_perfil']);
  assert.equal(idsReferenciados({}).size, 0);
});
