import { test } from 'node:test';
import assert from 'node:assert/strict';
import { diasDoMes, resumoDoMes, mesVizinho } from '../js/calendario.js';

// registro concluído num dia local (mês 1–12), com duração em minutos
function sessao(ano, mes, dia, min = 50) {
  const inicio = new Date(ano, mes - 1, dia, 10, 0);
  return { inicio: inicio.toISOString(), fim: new Date(inicio.getTime() + min * 60000).toISOString(), itens: [] };
}
const cardio = (ano, mes, dia, min = 30) => ({ ...sessao(ano, mes, dia, min), duracaoSeg: min * 60 });

test('outubro/2026 começa numa quinta: 3 células vazias antes do dia 1', () => {
  const dias = diasDoMes(2026, 10, [], [], '2026-10-23');
  assert.equal(dias.length, 34);
  assert.deepEqual(dias.slice(0, 3).map(d => d.dia), [null, null, null]);
  assert.equal(dias[3].dia, 1);
  assert.equal(dias[3].iso, '2026-10-01');
  assert.equal(dias.at(-1).dia, 31);
});

test('marca treino, cardio e hoje', () => {
  const dias = diasDoMes(2026, 10, [sessao(2026, 10, 5)], [cardio(2026, 10, 5), cardio(2026, 10, 7)], '2026-10-23');
  const d = n => dias.find(x => x.dia === n);
  assert.equal(d(5).treino, true);
  assert.equal(d(5).cardio, true);
  assert.equal(d(7).treino, false);
  assert.equal(d(7).cardio, true);
  assert.equal(d(23).hoje, true);
  assert.equal(d(22).hoje, false);
});

test('sessão sem fim (em andamento) não marca o dia', () => {
  const aberta = { ...sessao(2026, 10, 9), fim: null };
  assert.equal(diasDoMes(2026, 10, [aberta], [], '2026-10-23').find(x => x.dia === 9).treino, false);
});

test('mesVizinho vira o ano nos dois sentidos', () => {
  assert.deepEqual(mesVizinho(2026, 12, 1), { ano: 2027, mes: 1 });
  assert.deepEqual(mesVizinho(2026, 1, -1), { ano: 2025, mes: 12 });
  assert.deepEqual(mesVizinho(2026, 10, 1), { ano: 2026, mes: 11 });
});

test('resumoDoMes conta treinos, cardios e horas só do mês', () => {
  const sessoes = [sessao(2026, 10, 1, 60), sessao(2026, 10, 2, 60), sessao(2026, 9, 30, 60)];
  const cardios = [cardio(2026, 10, 3, 90)];
  assert.deepEqual(resumoDoMes(2026, 10, sessoes, cardios), { treinos: 2, cardios: 1, horas: 4 });
});
