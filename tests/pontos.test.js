import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  totaisDia, totaisPeriodo, inicioSemana, inicioMes, sequencia, diasDaSemana, diaLocal, somarDias, diasAtivos
} from '../js/pontos.js';

// ISO com hora a partir de uma data/hora LOCAL (o teste vale em qualquer fuso)
const local = (a, m, d, h = 10, min = 0) => new Date(a, m - 1, d, h, min).toISOString();
const sessao = (fim, feita = true) => ({
  id: 's' + fim, treinoId: 'A', inicio: fim, fim,
  itens: [{ exercicioId: 'x', registros: [{ carga: 10, reps: 10, feita }] }]
});
const cardio = (fim, min, km) => ({ id: 'c' + fim, fim, duracaoSeg: min * 60, distanciaM: km * 1000 });

test('diaLocal usa o dia local do fim, não o do ISO em UTC', () => {
  assert.equal(diaLocal(local(2026, 10, 3, 23, 30)), '2026-10-03');
  assert.equal(diaLocal(local(2026, 10, 3, 0, 10)), '2026-10-03');
  assert.equal(diaLocal(null), null);
});

test('totaisDia: treino sem série feita não conta', () => {
  const t = totaisDia([sessao(local(2026, 10, 3), false)], [], '2026-10-03');
  assert.deepEqual(t, { treinos: 0, cardioMin: 0, km: 0, pontos: 0 });
});

test('totaisDia: sessão em andamento (sem fim) não conta', () => {
  const s = { ...sessao(local(2026, 10, 3)), fim: null };
  assert.equal(totaisDia([s], [], '2026-10-03').treinos, 0);
});

test('totaisDia: 2 treinos no dia = 10 pontos (limite de 1 treino)', () => {
  const t = totaisDia([sessao(local(2026, 10, 3, 8)), sessao(local(2026, 10, 3, 18))], [], '2026-10-03');
  assert.equal(t.treinos, 2);
  assert.equal(t.pontos, 10);
});

test('totaisDia: cardio 63 min = 12 pontos (teto); 4 min = 0; 5 min = 1', () => {
  const dia = '2026-10-03';
  assert.equal(totaisDia([], [cardio(local(2026, 10, 3), 63, 5)], dia).pontos, 12);
  assert.equal(totaisDia([], [cardio(local(2026, 10, 3), 4, 0.3)], dia).pontos, 0);
  assert.equal(totaisDia([], [cardio(local(2026, 10, 3), 5, 0.4)], dia).pontos, 1);
  assert.equal(totaisDia([], [cardio(local(2026, 10, 3), 200, 5)], dia).pontos, 12);
});

test('totaisDia: soma cardios do dia, min para baixo e km com 2 casas', () => {
  const cs = [cardio(local(2026, 10, 3, 7), 20.5, 1.234), cardio(local(2026, 10, 3, 19), 10.4, 2.0049)];
  const t = totaisDia([], cs, '2026-10-03');
  assert.equal(t.cardioMin, 30); // 1230 + 624 s = 1854 s → 30 min
  assert.equal(t.km, 3.24);
  assert.equal(t.pontos, 6);
});

test('totaisDia: treino + cardio somam pontos e ignoram outros dias', () => {
  const ss = [sessao(local(2026, 10, 3)), sessao(local(2026, 10, 2))];
  const cs = [cardio(local(2026, 10, 3), 30, 3), cardio(local(2026, 10, 4), 30, 3)];
  const t = totaisDia(ss, cs, '2026-10-03');
  assert.deepEqual(t, { treinos: 1, cardioMin: 30, km: 3, pontos: 16 });
});

test('totaisPeriodo soma os dias, inclusive as pontas', () => {
  const ss = [sessao(local(2026, 9, 28)), sessao(local(2026, 9, 29)), sessao(local(2026, 10, 3)), sessao(local(2026, 10, 4))];
  const cs = [cardio(local(2026, 9, 29), 25, 2.5), cardio(local(2026, 10, 3), 25, 2.5)];
  const t = totaisPeriodo(ss, cs, '2026-09-29', '2026-10-03');
  assert.deepEqual(t, { treinos: 2, cardioMin: 50, km: 5, pontos: 30 });
});

test('inicioSemana: segunda; domingo volta à segunda anterior; vira o mês', () => {
  assert.equal(inicioSemana('2026-10-03'), '2026-09-28'); // sábado
  assert.equal(inicioSemana('2026-09-28'), '2026-09-28'); // segunda
  assert.equal(inicioSemana('2026-10-04'), '2026-09-28'); // domingo
  assert.equal(inicioSemana('2026-10-05'), '2026-10-05');
});

test('inicioMes e somarDias', () => {
  assert.equal(inicioMes('2026-10-17'), '2026-10-01');
  assert.equal(somarDias('2026-03-01', -1), '2026-02-28');
  assert.equal(somarDias('2026-12-31', 1), '2027-01-01');
});

test('sequencia: termina hoje; sem atividade hoje usa ontem; quebra zera', () => {
  const ativos = ['2026-10-01', '2026-10-02', '2026-10-03'];
  assert.equal(sequencia(ativos, '2026-10-03'), 3);
  assert.equal(sequencia(ativos, '2026-10-04'), 3); // hoje ainda sem atividade
  assert.equal(sequencia(ativos, '2026-10-05'), 0); // ontem também sem: quebrou
  assert.equal(sequencia(['2026-10-01', '2026-10-03'], '2026-10-03'), 1);
  assert.equal(sequencia([], '2026-10-03'), 0);
});

test('diasAtivos: cardio de menos de 1 min não ativa o dia', () => {
  const a = diasAtivos([sessao(local(2026, 10, 1))], [cardio(local(2026, 10, 2), 0.5, 0.1), cardio(local(2026, 10, 3), 1, 0.1)]);
  assert.deepEqual([...a].sort(), ['2026-10-01', '2026-10-03']);
});

test('diasDaSemana: 7 itens seg..dom com os ativos marcados', () => {
  const ss = [sessao(local(2026, 9, 28)), sessao(local(2026, 10, 1))];
  const cs = [cardio(local(2026, 10, 3), 20, 2)];
  const d = diasDaSemana(ss, cs, '2026-10-02');
  assert.equal(d.length, 7);
  assert.equal(d[0].dia, '2026-09-28');
  assert.equal(d[6].dia, '2026-10-04');
  assert.deepEqual(d.map(x => x.ativo), [true, false, false, true, false, true, false]);
});
