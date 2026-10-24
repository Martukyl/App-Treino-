import { test } from 'node:test';
import assert from 'node:assert/strict';
import { progressoSemana, estimativaMin } from '../js/semana.js';

// sessão concluída num dia local (mês 1–12), com duração em minutos
function sessao(treinoId, ano, mes, dia, min = 50, hora = 10) {
  const inicio = new Date(ano, mes - 1, dia, hora, 0);
  return { id: `s${dia}${hora}`, treinoId, inicio: inicio.toISOString(), fim: new Date(inicio.getTime() + min * 60000).toISOString(), itens: [] };
}
const cincoTreinos = ['A', 'B', 'C', 'D', 'E'].map(id => ({ id, nome: id, itens: [] }));

// semana de 19 (seg) a 25/10/2026; hoje = sexta 23
test('progressoSemana conta dias distintos com treino na semana', () => {
  const est = { treinos: cincoTreinos, sessoes: [
    sessao('A', 2026, 10, 19), sessao('B', 2026, 10, 20), sessao('C', 2026, 10, 20, 30, 18), sessao('D', 2026, 10, 22)
  ] };
  assert.deepEqual(progressoSemana(est, '2026-10-23'), { feitos: 3, total: 5 });
});

test('progressoSemana ignora sessão sem fim e da semana anterior', () => {
  const aberta = { ...sessao('A', 2026, 10, 21), fim: null };
  const est = { treinos: cincoTreinos, sessoes: [aberta, sessao('E', 2026, 10, 18), sessao('B', 2026, 10, 23)] };
  assert.deepEqual(progressoSemana(est, '2026-10-23'), { feitos: 1, total: 5 });
});

test('progressoSemana sem treinos cadastrados tem total 0', () => {
  assert.deepEqual(progressoSemana({ treinos: [], sessoes: [] }, '2026-10-23'), { feitos: 0, total: 0 });
});

test('estimativaMin arredonda a média a 5 min', () => {
  const est = { sessoes: [sessao('D', 2026, 10, 9, 47), sessao('D', 2026, 10, 16, 52), sessao('A', 2026, 10, 19, 90)] };
  assert.equal(estimativaMin(est, 'D'), 50);
});

test('estimativaMin nunca fica abaixo de 5', () => {
  assert.equal(estimativaMin({ sessoes: [sessao('D', 2026, 10, 9, 1)] }, 'D'), 5);
});

test('estimativaMin sem sessão daquele treino é null', () => {
  assert.equal(estimativaMin({ sessoes: [sessao('A', 2026, 10, 19)] }, 'D'), null);
  assert.equal(estimativaMin({ sessoes: [] }, 'D'), null);
});
