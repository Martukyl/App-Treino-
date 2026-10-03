import { test } from 'node:test';
import assert from 'node:assert/strict';
import { novoCardioAtual, tempoMs, pausar, retomar, aplicarPonto, ritmoDeVelocidade } from '../js/cardio-ao-vivo.js';

const T0 = 1_700_000_000_000;
const base = () => novoCardioAtual({ id: 'c_1', trajetoId: 't_1', tipo: 'caminhada', agora: T0 });
// ~1 m por 0,00001° de latitude (aprox. 1,11 m)
const pt = (n, seg, extra = {}) => ({ lat: -23 + n * 0.00005, lon: -46, alt: 100, accuracy: 8, t: T0 + seg * 1000, ...extra });

test('tempoMs usa relógio de parede e não conta pausa', () => {
  const a = base();
  assert.equal(tempoMs(a, T0 + 5000), 5000);
  const p = pausar(a, T0 + 10000);
  assert.equal(p.pausado, true);
  assert.equal(tempoMs(p, T0 + 99000), 10000);
  const r = retomar(p, T0 + 60000);
  assert.equal(tempoMs(r, T0 + 65000), 15000);
  assert.equal(r.ultimo, null);
});

test('primeiro ponto abre segmento sem distância; o seguinte soma distância e kcal sem arredondar', () => {
  let a = base();
  let r = aplicarPonto(a, pt(0, 0), 60);
  assert.equal(r.aceito, true);
  assert.equal(r.item.novo, true);
  assert.equal(r.atual.distanciaM, 0);
  r = aplicarPonto(r.atual, pt(1, 5), 60); // ~5,6 m em 5 s = ~4 km/h
  assert.equal(r.aceito, true);
  assert.equal(r.item.novo, false);
  assert.ok(r.atual.distanciaM > 5 && r.atual.distanciaM < 6.2);
  assert.ok(r.atual.kcal > 0 && r.atual.kcal < 1, 'kcal do trecho fica fracionária, não 0');
});

test('kcal ao vivo acumulada ≈ kcal do compêndio para a caminhada toda', () => {
  let a = base();
  let r = aplicarPonto(a, pt(0, 0), 60);
  for (let i = 1; i <= 120; i++) r = aplicarPonto(r.atual, pt(i, i * 5), 60); // 120 trechos de 5 s = 10 min a ~4 km/h
  const esperado = 3.0 * 60 * (600 / 3600); // MET 3,0 (4,0–4,8 km/h)
  assert.ok(Math.abs(r.atual.kcal - esperado) < 1.5, `${r.atual.kcal} vs ${esperado}`);
});

test('pausado não aceita pontos', () => {
  const a = pausar(base(), T0 + 1000);
  const r = aplicarPonto(a, pt(0, 2), 60);
  assert.equal(r.aceito, false);
  assert.equal(r.motivo, 'pausado');
  assert.equal(r.atual, a);
});

test('retomar abre segmento novo sem somar o vão', () => {
  let r = aplicarPonto(base(), pt(0, 0), 60);
  r = aplicarPonto(r.atual, pt(1, 5), 60);
  const dist = r.atual.distanciaM;
  const p = pausar(r.atual, T0 + 6000);
  const re = retomar(p, T0 + 600000);
  const r2 = aplicarPonto(re, pt(200, 601), 60); // longe, depois da pausa
  assert.equal(r2.aceito, true);
  assert.equal(r2.item.novo, true);
  assert.equal(r2.atual.distanciaM, dist);
});

test('ponto ruim e salto impossível são ignorados', () => {
  let r = aplicarPonto(base(), pt(0, 0), 60);
  const ruim = aplicarPonto(r.atual, pt(1, 5, { accuracy: 80 }), 60);
  assert.equal(ruim.aceito, false);
  assert.equal(ruim.motivo, 'precisao');
  const salto = aplicarPonto(r.atual, pt(2000, 5), 60);
  assert.equal(salto.aceito, false);
  assert.equal(salto.motivo, 'velocidade');
});

test('parado só atualiza a altitude corrente', () => {
  const r = aplicarPonto(base(), pt(0, 0), 60);
  const parado = aplicarPonto(r.atual, pt(0, 5, { alt: 107 }), 60);
  assert.equal(parado.aceito, false);
  assert.equal(parado.motivo, 'parado');
  assert.equal(parado.atual.altAtual, 107);
  assert.equal(parado.atual.distanciaM, 0);
});

test('altitude: min, max e subida com histerese; sem altitude não quebra', () => {
  let r = aplicarPonto(base(), pt(0, 0, { alt: 100 }), 60);
  r = aplicarPonto(r.atual, pt(1, 5, { alt: 110 }), 60);
  r = aplicarPonto(r.atual, pt(2, 10, { alt: 104 }), 60);
  assert.equal(r.atual.altMin, 100);
  assert.equal(r.atual.altMax, 110);
  assert.equal(r.atual.subidaM, 10);
  const sem = aplicarPonto(r.atual, pt(3, 15, { alt: null }), 60);
  assert.equal(sem.aceito, true);
  assert.equal(sem.atual.altMax, 110);
});

test('sem peso não acumula kcal', () => {
  let r = aplicarPonto(base(), pt(0, 0), null);
  r = aplicarPonto(r.atual, pt(1, 5), null);
  assert.equal(r.atual.kcal, 0);
});

test('lacuna de 60 s limita o tempo das calorias a 30 s', () => {
  let r = aplicarPonto(base(), pt(0, 0), 60);
  r = aplicarPonto(r.atual, pt(8, 60), 60); // ~44 m em 60 s (2,7 km/h): plausível, soma distância
  assert.equal(r.motivo, 'lacuna');
  const esperado = 2.0 * 60 * (30 / 3600); // MET 2,0 (< 3,2 km/h), só 30 s
  assert.ok(Math.abs(r.atual.kcal - esperado) < 0.01, `${r.atual.kcal} vs ${esperado}`);
});

test('ritmoDeVelocidade', () => {
  assert.equal(ritmoDeVelocidade(6), 600);
  assert.equal(ritmoDeVelocidade(0.2), null);
  assert.equal(ritmoDeVelocidade(null), null);
});
