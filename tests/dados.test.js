import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GRUPOS, EQUIPAMENTOS, exerciciosPadrao, treinosPadrao, DICAS_ANTIGAS, fotoDoTreino, corDoTreino, gruposComExercicios } from '../js/dados.js';

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

test('nenhuma dica do catálogo no feminino', () => {
  const feminino = /\b(Deitada|Sentada|Apoiada|deitada|sentada|apoiada)\b|segure 1 s aberta/;
  for (const [id, ex] of Object.entries(exerciciosPadrao)) assert.doesNotMatch(ex.dica, feminino, id);
});

test('DICAS_ANTIGAS só tem ids do catálogo e textos diferentes dos atuais', () => {
  assert.ok(Object.keys(DICAS_ANTIGAS).length >= 4);
  for (const [id, antiga] of Object.entries(DICAS_ANTIGAS)) {
    assert.ok(exerciciosPadrao[id], id);
    assert.notEqual(exerciciosPadrao[id].dica, antiga, id);
  }
});

test('fotoDoTreino: só A a E têm foto', () => {
  assert.equal(fotoDoTreino('C'), './img/treino-c.jpg');
  assert.equal(fotoDoTreino('A'), './img/treino-a.jpg');
  assert.equal(fotoDoTreino('F'), null);
  assert.equal(fotoDoTreino(''), null);
});

test('corDoTreino faz rodízio de 4 cores pela letra', () => {
  assert.equal(corDoTreino('A'), 'sage');
  assert.equal(corDoTreino('B'), 'sky');
  assert.equal(corDoTreino('E'), 'sage');
  assert.equal(corDoTreino('F'), 'sky');
  assert.equal(corDoTreino('Z'), 'sky');
});

test('gruposComExercicios: só grupos com exercício, na ordem de GRUPOS', () => {
  const exs = { a: { grupo: 'costas' }, b: { grupo: 'gluteo' }, c: { grupo: 'gluteo' } };
  assert.deepEqual(gruposComExercicios(exs), ['gluteo', 'costas']);
});

test('gruposComExercicios: grupo personalizado vem por último', () => {
  const exs = { a: { grupo: 'mobilidade' }, b: { grupo: 'ombro' } };
  assert.deepEqual(gruposComExercicios(exs), ['ombro', 'mobilidade']);
  assert.deepEqual(gruposComExercicios({}), []);
});
