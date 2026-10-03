import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ICONE_CARDIO, ROTULO_CARDIO, formatarRitmo, formatarKm, formatarCronometro,
  itensHistorico, metPara, kcalPor, kcalAparelho, pesoAtual
} from '../js/cardio.js';

test('formatarRitmo: min:seg /km e traço para vazio', () => {
  assert.equal(formatarRitmo(702), '11:42 /km');
  assert.equal(formatarRitmo(365), '6:05 /km');
  assert.equal(formatarRitmo(59.6), '1:00 /km');
  assert.equal(formatarRitmo(null), '—');
  assert.equal(formatarRitmo(0), '—');
  assert.equal(formatarRitmo(Infinity), '—');
});

test('formatarKm: duas casas com vírgula', () => {
  assert.equal(formatarKm(3420), '3,42 km');
  assert.equal(formatarKm(0), '0,00 km');
  assert.equal(formatarKm(999), '1,00 km');
  assert.equal(formatarKm(null), '—');
});

test('formatarCronometro: mm:ss e h:mm:ss', () => {
  assert.equal(formatarCronometro(0), '00:00');
  assert.equal(formatarCronometro(425000), '07:05');
  assert.equal(formatarCronometro(59999), '00:59');
  assert.equal(formatarCronometro(3600000), '1:00:00');
  assert.equal(formatarCronometro((3600 + 2 * 60 + 9) * 1000), '1:02:09');
  assert.equal(formatarCronometro(-5), '00:00');
});

test('ícones e rótulos cobrem todos os tipos', () => {
  const tipos = ['caminhada', 'corrida', 'esteira', 'bicicleta', 'eliptico', 'escada', 'outro'];
  for (const t of tipos) {
    assert.ok(ICONE_CARDIO[t], `ícone de ${t}`);
    assert.ok(ROTULO_CARDIO[t], `rótulo de ${t}`);
  }
  assert.equal(ICONE_CARDIO.caminhada, '🚶');
  assert.equal(ICONE_CARDIO.corrida, '🏃');
  assert.equal(ICONE_CARDIO.esteira, '🏃');
  assert.equal(ICONE_CARDIO.bicicleta, '🚴');
  for (const t of ['eliptico', 'escada', 'outro']) assert.equal(ICONE_CARDIO[t], '❤️');
  assert.equal(ROTULO_CARDIO.caminhada, 'Caminhada');
  assert.equal(ROTULO_CARDIO.eliptico, 'Elíptico');
});

test('metPara caminhada: faixas de velocidade', () => {
  const casos = [[2, 2.0], [3.19, 2.0], [3.2, 2.8], [3.9, 2.8], [4.0, 3.0], [4.7, 3.0],
    [4.8, 3.5], [5.5, 3.5], [5.6, 4.3], [6.3, 4.3], [6.4, 5.0], [7.1, 5.0], [7.2, 7.0], [9, 7.0]];
  for (const [v, met] of casos) assert.equal(metPara('caminhada', v), met, `v=${v}`);
});

test('metPara corrida: faixas de velocidade', () => {
  const casos = [[6, 6.0], [7.9, 6.0], [8, 8.3], [9.6, 8.3], [9.7, 9.8], [11.2, 9.8], [11.3, 11.0], [15, 11.0]];
  for (const [v, met] of casos) assert.equal(metPara('corrida', v), met, `v=${v}`);
});

test('metPara aparelhos: valores fixos', () => {
  assert.equal(metPara('bicicleta'), 6.8);
  assert.equal(metPara('eliptico'), 5.0);
  assert.equal(metPara('escada'), 9.0);
  assert.equal(metPara('outro'), 5.0);
  assert.equal(metPara('esteira'), 5.0);
  assert.equal(metPara('esteira', null), 5.0);
});

test('metPara esteira com velocidade: < 7,2 km/h caminhada, ≥ 7,2 corrida', () => {
  assert.equal(metPara('esteira', 5), 3.5);     // caminhada 4,8–5,6
  assert.equal(metPara('esteira', 7.19), 5.0);  // ainda caminhada (6,4–7,2)
  assert.equal(metPara('esteira', 7.2), 6.0);   // corrida < 8
  assert.equal(metPara('esteira', 8.5), 8.3);
  assert.equal(metPara('esteira', 10), 9.8);
});

test('metPara: tipo desconhecido usa 5,0; caminhada/corrida sem velocidade usam valor moderado', () => {
  assert.equal(metPara('xyz', 5), 5.0);
  assert.equal(metPara('caminhada', null), 3.5);
  assert.equal(metPara('corrida', null), 8.3);
});

test('kcalPor: MET × peso × horas, arredondado', () => {
  // caminhada a 5 km/h (MET 3,5), 60 kg, 1 h → 210
  assert.equal(kcalPor('caminhada', 60, 3600, 5), 210);
  assert.equal(kcalPor('corrida', 62, 41 * 60, 9), Math.round(8.3 * 62 * 41 / 60));
  assert.equal(kcalPor('bicicleta', 70, 1800), 238); // 6,8 × 70 × 0,5
  assert.equal(kcalPor('escada', 60, 600), 90);      // 9 × 60 × 1/6
});

test('kcalPor: dados inválidos → null', () => {
  assert.equal(kcalPor('caminhada', null, 3600, 5), null);
  assert.equal(kcalPor('caminhada', 0, 3600, 5), null);
  assert.equal(kcalPor('caminhada', 60, 0, 5), null);
  assert.equal(kcalPor('caminhada', 60, -1, 5), null);
});

test('kcalAparelho: esteira com distância usa a velocidade média; sem distância, MET 5,0', () => {
  // 30 min, 3 km = 6 km/h → caminhada 4,3
  assert.equal(kcalAparelho({ tipo: 'esteira', duracaoSeg: 1800, distanciaM: 3000 }, 60), Math.round(4.3 * 60 * 0.5));
  // 30 min, 5 km = 10 km/h → corrida 9,8
  assert.equal(kcalAparelho({ tipo: 'esteira', duracaoSeg: 1800, distanciaM: 5000 }, 60), Math.round(9.8 * 60 * 0.5));
  // sem distância
  assert.equal(kcalAparelho({ tipo: 'esteira', duracaoSeg: 1800, distanciaM: null }, 60), 150);
  assert.equal(kcalAparelho({ tipo: 'esteira', duracaoSeg: 1800, distanciaM: 0 }, 60), 150);
});

test('kcalAparelho: outros aparelhos ignoram a distância; sem peso → null', () => {
  assert.equal(kcalAparelho({ tipo: 'bicicleta', duracaoSeg: 1800, distanciaM: 20000 }, 70), 238);
  assert.equal(kcalAparelho({ tipo: 'eliptico', duracaoSeg: 3600, distanciaM: null }, 60), 300);
  assert.equal(kcalAparelho({ tipo: 'outro', duracaoSeg: 3600, distanciaM: null }, null), null);
});

test('pesoAtual: último peso do Corpo ou null', () => {
  const medidas = [
    { id: 'a', data: '2026-09-01', peso: 64 },
    { id: 'b', data: '2026-10-01', peso: 62.5 },
    { id: 'c', data: '2026-10-02', cintura: 70 }
  ];
  assert.equal(pesoAtual({ medidas }), 62.5);
  assert.equal(pesoAtual({ medidas: [] }), null);
  assert.equal(pesoAtual({}), null);
});

test('itensHistorico: mistura treinos e cardios por fim desc', () => {
  const sessoes = [
    { id: 's1', fim: '2026-10-01T10:00:00.000Z' },
    { id: 's2', fim: '2026-10-03T10:00:00.000Z' }
  ];
  const cardios = [
    { id: 'c1', fim: '2026-10-02T09:00:00.000Z' },
    { id: 'c2', fim: '2026-10-04T08:00:00.000Z' }
  ];
  const itens = itensHistorico(sessoes, cardios);
  assert.deepEqual(itens.map(i => i.ref.id), ['c2', 's2', 'c1', 's1']);
  assert.deepEqual(itens.map(i => i.tipo), ['cardio', 'treino', 'cardio', 'treino']);
  assert.equal(itens[0].data, '2026-10-04T08:00:00.000Z');
  assert.equal(itens[0].ref, cardios[1]);
});

test('itensHistorico: listas vazias ou ausentes', () => {
  assert.deepEqual(itensHistorico([], []), []);
  assert.deepEqual(itensHistorico(undefined, undefined), []);
  assert.equal(itensHistorico([{ id: 's', fim: '2026-10-01T00:00:00Z' }], undefined).length, 1);
});

test('itensHistorico: não altera as listas de entrada', () => {
  const s = [{ id: 'a', fim: '2026-10-01T00:00:00Z' }, { id: 'b', fim: '2026-10-02T00:00:00Z' }];
  itensHistorico(s, []);
  assert.deepEqual(s.map(x => x.id), ['a', 'b']);
});
