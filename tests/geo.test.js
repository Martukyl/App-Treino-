import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  distanciaM, aceitarPonto, estadoSubidaInicial, ganhoSubida, velocidadeRecente, parciaisKm
} from '../js/geo.js';

const M_POR_GRAU = 111195; // 1 grau de latitude (raio 6 371 km)
// ponto deslocado `m` metros para o norte de (lat0, 0)
const ao_norte = (m, lat0 = -23) => ({ lat: lat0 + m / M_POR_GRAU, lon: 0 });
const pt = (m, tS, extra = {}) => ({ ...ao_norte(m), alt: 100, accuracy: 8, t: tS * 1000, ...extra });

test('distanciaM: 1 grau de latitude ≈ 111,2 km', () => {
  const d = distanciaM({ lat: 0, lon: 0 }, { lat: 1, lon: 0 });
  assert.ok(Math.abs(d - 111195) < 50, `d=${d}`);
});

test('distanciaM: ~100 m, simétrica e zero para o mesmo ponto', () => {
  const a = ao_norte(0), b = ao_norte(100);
  assert.ok(Math.abs(distanciaM(a, b) - 100) < 0.5);
  assert.equal(distanciaM(a, b), distanciaM(b, a));
  assert.equal(distanciaM(a, a), 0);
});

test('distanciaM: longitude encolhe com a latitude', () => {
  const eq = distanciaM({ lat: 0, lon: 0 }, { lat: 0, lon: 1 });
  const alto = distanciaM({ lat: 60, lon: 0 }, { lat: 60, lon: 1 });
  assert.ok(Math.abs(alto / eq - 0.5) < 0.01);
});

test('aceitarPonto: primeiro ponto com precisão ok é aceito e abre segmento', () => {
  const r = aceitarPonto(null, pt(0, 0), 'caminhada');
  assert.deepEqual(r, { aceito: true, motivo: 'primeiro', somarDistancia: false, novoSegmento: true });
});

test('aceitarPonto: precisão ruim (> 30) é rejeitada, inclusive o primeiro ponto', () => {
  const r1 = aceitarPonto(null, pt(0, 0, { accuracy: 31 }), 'caminhada');
  assert.equal(r1.aceito, false);
  assert.equal(r1.motivo, 'precisao');
  const r2 = aceitarPonto(pt(0, 0), pt(10, 5, { accuracy: 80 }), 'caminhada');
  assert.equal(r2.aceito, false);
  assert.equal(r2.motivo, 'precisao');
  // exatamente 30 ainda vale
  assert.equal(aceitarPonto(pt(0, 0), pt(10, 8, { accuracy: 30 }), 'caminhada').aceito, true);
});

test('aceitarPonto: deslocamento normal soma distância no mesmo segmento', () => {
  const r = aceitarPonto(pt(0, 0), pt(7, 5), 'caminhada');
  assert.deepEqual(r, { aceito: true, motivo: 'ok', somarDistancia: true, novoSegmento: false });
});

test('aceitarPonto: salto impossível (500 m em 5 s) é rejeitado', () => {
  const r = aceitarPonto(pt(0, 0), pt(500, 5), 'caminhada');
  assert.equal(r.aceito, false);
  assert.equal(r.motivo, 'velocidade');
  assert.equal(r.somarDistancia, false);
});

test('aceitarPonto: parado (< 3 m) é ignorado', () => {
  const r = aceitarPonto(pt(0, 0), pt(2, 5), 'caminhada');
  assert.equal(r.aceito, false);
  assert.equal(r.motivo, 'parado');
  assert.equal(aceitarPonto(pt(0, 0), pt(3.5, 5), 'caminhada').aceito, true);
});

test('aceitarPonto: limite de velocidade caminhada 12 km/h × corrida 25 km/h', () => {
  // 20 m em 5 s = 14,4 km/h: rápido demais p/ caminhada, ok p/ corrida
  assert.equal(aceitarPonto(pt(0, 0), pt(20, 5), 'caminhada').aceito, false);
  assert.equal(aceitarPonto(pt(0, 0), pt(20, 5), 'corrida').aceito, true);
  // 40 m em 5 s = 28,8 km/h: rejeitado até na corrida
  assert.equal(aceitarPonto(pt(0, 0), pt(40, 5), 'corrida').aceito, false);
  // 16 m em 5 s = 11,5 km/h: ok na caminhada
  assert.equal(aceitarPonto(pt(0, 0), pt(16, 5), 'caminhada').aceito, true);
});

test('aceitarPonto: ponto com tempo não crescente é rejeitado', () => {
  const r = aceitarPonto(pt(0, 10), pt(10, 10), 'caminhada');
  assert.equal(r.aceito, false);
  assert.equal(r.motivo, 'tempo');
});

test('aceitarPonto: lacuna > 30 s plausível soma a distância', () => {
  // 100 m em 60 s = 6 km/h
  const r = aceitarPonto(pt(0, 0), pt(100, 60), 'caminhada');
  assert.deepEqual(r, { aceito: true, motivo: 'lacuna', somarDistancia: true, novoSegmento: false });
});

test('aceitarPonto: lacuna > 30 s implausível abre novo segmento sem somar', () => {
  // 1000 m em 60 s = 60 km/h
  const r = aceitarPonto(pt(0, 0), pt(1000, 60), 'caminhada');
  assert.deepEqual(r, { aceito: true, motivo: 'lacuna', somarDistancia: false, novoSegmento: true });
});

test('aceitarPonto: lacuna parado (< 3 m) continua sendo ignorada', () => {
  const r = aceitarPonto(pt(0, 0), pt(1, 90), 'caminhada');
  assert.equal(r.aceito, false);
  assert.equal(r.motivo, 'parado');
});

// roda a sequência pelo filtro como o app fará; devolve distância somada e nº de segmentos
function simular(pontos, tipo) {
  let ultimo = null, dist = 0, segmentos = 0;
  for (const p of pontos) {
    const r = aceitarPonto(ultimo, p, tipo);
    if (!r.aceito) continue;
    if (r.novoSegmento) segmentos += 1;
    if (r.somarDistancia) dist += distanciaM(ultimo, p);
    ultimo = p;
  }
  return { dist, segmentos };
}

test('simulação: ~20 pontos, ~600 m a cada 5 s, com 1 ponto ruim e 1 salto → ±5% de 600 m', () => {
  // 20 pontos reais, 31,58 m por passo (≈ 22,7 km/h: corrida rápida), total 600 m
  const passo = 600 / 19;
  const pontos = [];
  for (let i = 0; i < 20; i++) pontos.push(pt(i * passo, i * 5));
  pontos.splice(6, 0, pt(6 * passo + 2.5, 29, { accuracy: 80 }));   // ponto ruim
  pontos.splice(13, 0, pt(11 * passo + 500, 57));                   // salto de 500 m em 5 s
  const { dist, segmentos } = simular(pontos, 'corrida');
  assert.ok(Math.abs(dist - 600) <= 30, `dist=${dist}`);
  assert.equal(segmentos, 1);
});

test('simulação: caminhada realista (~86 pontos de 7 m, 5 s) com ponto ruim e salto', () => {
  const pontos = [];
  for (let i = 0; i <= 86; i++) pontos.push(pt(i * 7, i * 5));
  pontos.splice(30, 0, pt(29 * 7 + 3, 147, { accuracy: 80 }));
  pontos.splice(50, 0, pt(48 * 7 + 500, 242));
  const { dist, segmentos } = simular(pontos, 'caminhada');
  assert.ok(Math.abs(dist - 602) <= 30, `dist=${dist}`);
  assert.equal(segmentos, 1);
});

test('ganhoSubida: estado inicial vazio', () => {
  assert.deepEqual(estadoSubidaInicial(), { ref: null, subida: 0 });
});

test('ganhoSubida: ruído de ±2 m não soma', () => {
  let s = estadoSubidaInicial();
  for (const alt of [100, 102, 100, 98, 100, 101.5, 99, 100.5, 98.5, 100]) s = ganhoSubida(s, alt);
  assert.equal(s.subida, 0);
});

test('ganhoSubida: subida de 10 m soma ~10 e é pura (não altera o estado de entrada)', () => {
  const ini = estadoSubidaInicial();
  let s = ini;
  for (let alt = 100; alt <= 110; alt += 1) s = ganhoSubida(s, alt);
  assert.deepEqual(ini, { ref: null, subida: 0 });
  assert.ok(s.subida >= 9 && s.subida <= 10, `subida=${s.subida}`);
  // um degrau único de 10 m soma exatamente 10
  assert.equal(ganhoSubida(ganhoSubida(estadoSubidaInicial(), 100), 110).subida, 10);
});

test('ganhoSubida: descida não soma e rebaixa a referência (sobe de novo conta)', () => {
  let s = estadoSubidaInicial();
  for (const alt of [100, 90, 80]) s = ganhoSubida(s, alt);
  assert.equal(s.subida, 0);
  assert.equal(s.ref, 80);
  s = ganhoSubida(s, 85);
  assert.equal(s.subida, 5);
});

test('ganhoSubida: altitude ausente mantém o estado', () => {
  const s = { ref: 100, subida: 4 };
  assert.deepEqual(ganhoSubida(s, null), s);
  assert.deepEqual(ganhoSubida(s, undefined), s);
  assert.deepEqual(ganhoSubida(s, NaN), s);
});

test('velocidadeRecente: média na janela de 30 s', () => {
  // 7 m a cada 5 s = 5,04 km/h
  const pontos = [];
  for (let i = 0; i <= 12; i++) pontos.push(pt(i * 7, i * 5));
  const v = velocidadeRecente(pontos, 60 * 1000);
  assert.ok(Math.abs(v - 5.04) < 0.05, `v=${v}`);
});

test('velocidadeRecente: só usa pontos dentro da janela (acelerou há pouco)', () => {
  const pontos = [pt(0, 0), pt(7, 5), pt(14, 10), pt(14 + 14, 40), pt(14 + 28, 45)];
  // janela 30 s até t=45 s → pontos de 15 s em diante: (28 m em t=40) e (42 m em t=45)
  const v = velocidadeRecente(pontos, 45 * 1000, 30);
  assert.ok(Math.abs(v - (14 / 5) * 3.6) < 0.1, `v=${v}`);
});

test('velocidadeRecente: null sem pontos suficientes ou com GPS parado há tempo', () => {
  assert.equal(velocidadeRecente([], 1000), null);
  assert.equal(velocidadeRecente([pt(0, 0)], 1000), null);
  assert.equal(velocidadeRecente([pt(0, 0), pt(7, 5)], 120 * 1000), null);
});

// segmento a 5 m/s em linha reta: pontos a cada 5 s, 25 m por passo
const segReto = (m0, t0S, nPassos, passoM = 25, passoS = 5) => {
  const out = [];
  for (let i = 0; i <= nPassos; i++) {
    const p = ao_norte(m0 + i * passoM);
    out.push([p.lat, p.lon, null, (t0S + i * passoS) * 1000]);
  }
  return out;
};

test('parciaisKm: km fecha por interpolação (5 m/s → 200 s por km)', () => {
  // 2,5 km a 5 m/s → 2 km completos de 200 s cada
  const r = parciaisKm([segReto(0, 0, 100)]);
  assert.equal(r.length, 2);
  assert.deepEqual(r.map(x => x.km), [1, 2]);
  assert.ok(Math.abs(r[0].seg - 200) <= 1);
  assert.ok(Math.abs(r[1].seg - 200) <= 1);
});

test('parciaisKm: km fechando no meio de um passo é interpolado', () => {
  // passos de 400 m em 100 s: km 1 fecha em t=250 s
  const r = parciaisKm([segReto(0, 0, 3, 400, 100)]);
  assert.equal(r.length, 1);
  assert.equal(r[0].seg, 250);
});

test('parciaisKm: pausa entre segmentos não conta no tempo (nem a distância do vão)', () => {
  // 500 m, pausa de 1 h, depois mais 700 m (ponto inicial 5 km adiante, vão não soma)
  const a = segReto(0, 0, 20);                       // 500 m em 100 s
  const b = segReto(5000, 3700, 28);                 // 700 m em 140 s
  const r = parciaisKm([a, b]);
  assert.equal(r.length, 1);
  // 1000 m = 500 (a) + 500 (b): 100 s + 100 s = 200 s, sem a hora de pausa
  assert.ok(Math.abs(r[0].seg - 200) <= 1, `seg=${r[0].seg}`);
});

test('parciaisKm: sem km completo ou sem segmentos → lista vazia', () => {
  assert.deepEqual(parciaisKm([]), []);
  assert.deepEqual(parciaisKm([segReto(0, 0, 10)]), []);
  assert.deepEqual(parciaisKm([[]]), []);
});

test('parciaisKm: tempos de cada km são individuais (acelerando)', () => {
  // 1º km a 2,5 m/s (400 s), 2º km a 5 m/s (200 s)
  const lento = segReto(0, 0, 40, 25, 10);           // 1000 m em 400 s
  const rapido = segReto(1000, 400, 40, 25, 5);      // 1000 m em 200 s (contínuo, mesmo segmento)
  const r = parciaisKm([[...lento, ...rapido.slice(1)]]);
  assert.equal(r.length, 2);
  assert.ok(Math.abs(r[0].seg - 400) <= 1);
  assert.ok(Math.abs(r[1].seg - 200) <= 1);
});
