import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GRUPOS, EQUIPAMENTOS, exerciciosPadrao, treinosPadrao } from '../js/dados.js';

test('cinco treinos A a E na ordem', () => {
  assert.deepEqual(treinosPadrao.map(t => t.id), ['A', 'B', 'C', 'D', 'E']);
});

test('todo item de treino aponta para exercício existente e tem prescrição válida', () => {
  for (const t of treinosPadrao) {
    assert.ok(t.nome && t.foco, `treino ${t.id} sem nome/foco`);
    assert.ok(t.itens.length >= 5, `treino ${t.id} com poucos itens`);
    for (const it of t.itens) {
      assert.ok(exerciciosPadrao[it.exercicioId], `${t.id}: ${it.exercicioId} não existe`);
      assert.ok(it.series > 0 && it.repMin > 0 && it.repMax >= it.repMin && it.descanso > 0);
    }
  }
});

test('exercícios com campos completos', () => {
  const ids = Object.keys(exerciciosPadrao);
  assert.equal(ids.length, 25);
  for (const [id, ex] of Object.entries(exerciciosPadrao)) {
    assert.equal(ex.id, id);
    assert.ok(GRUPOS[ex.grupo], `${id}: grupo inválido`);
    assert.ok(EQUIPAMENTOS[ex.equipamento], `${id}: equipamento inválido`);
    assert.ok(['composto', 'isolado'].includes(ex.tipo));
    assert.equal(typeof ex.unilateral, 'boolean');
    assert.ok(ex.incremento > 0);
    assert.ok(ex.dica.length > 20);
    assert.equal(ex.personalizado, false);
  }
});

test('prescrições conferem com o spec (amostra)', () => {
  const a = treinosPadrao[0].itens[0];
  assert.deepEqual(a, { exercicioId: 'elevacao_pelvica', series: 4, repMin: 8, repMax: 12, descanso: 120 });
  const c = treinosPadrao[2].itens[0];
  assert.deepEqual(c, { exercicioId: 'agachamento', series: 4, repMin: 6, repMax: 10, descanso: 120 });
  assert.equal(exerciciosPadrao.leg_press.incremento, 5);
  assert.equal(exerciciosPadrao.bulgaro.unilateral, true);
});
