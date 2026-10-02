import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CHAVE, estadoInicial, migrar, validarBackup, carregar, salvar, restaurarTreinosPadrao
} from '../js/armazenamento.js';
import { exerciciosPadrao } from '../js/dados.js';

// storage falso no formato do localStorage
function storageFalso(inicial = {}) {
  const dados = { ...inicial };
  return {
    dados,
    getItem: k => (k in dados ? dados[k] : null),
    setItem: (k, v) => { dados[k] = String(v); }
  };
}

test('estadoInicial tem catálogo, 5 treinos e nada em andamento', () => {
  const e = estadoInicial();
  assert.equal(e.versao, 1);
  assert.equal(Object.keys(e.exercicios).length, 25);
  assert.equal(e.treinos.length, 5);
  assert.deepEqual(e.sessoes, []);
  assert.equal(e.sessaoAtual, null);
  assert.equal(e.ultimoTreinoId, null);
});

test('estadoInicial não compartilha referência com os dados padrão', () => {
  const e = estadoInicial();
  e.exercicios.stiff.nome = 'mudado';
  assert.notEqual(exerciciosPadrao.stiff.nome, 'mudado');
});

test('migrar adiciona exercício padrão faltante sem sobrescrever editado', () => {
  const e = estadoInicial();
  delete e.exercicios.abducao;
  e.exercicios.stiff.incremento = 5;
  const m = migrar(e);
  assert.ok(m.exercicios.abducao);
  assert.equal(m.exercicios.stiff.incremento, 5);
});

test('migrar preenche campos ausentes', () => {
  const m = migrar({ versao: 1, exercicios: {}, treinos: [] });
  assert.deepEqual(m.sessoes, []);
  assert.equal(m.sessaoAtual, null);
  assert.equal(m.ultimoTreinoId, null);
});

test('validarBackup aceita estado válido e rejeita inválidos', () => {
  assert.deepEqual(validarBackup(estadoInicial()), { ok: true });
  assert.equal(validarBackup(null).ok, false);
  assert.equal(validarBackup({}).ok, false);
  assert.equal(validarBackup({ versao: '1', exercicios: {}, treinos: [], sessoes: [] }).ok, false);
  assert.equal(validarBackup({ versao: 1, exercicios: [], treinos: [], sessoes: [] }).ok, false);
  assert.equal(validarBackup({ versao: 1, exercicios: {}, treinos: {}, sessoes: [] }).ok, false);
  const r = validarBackup({ versao: 1, exercicios: {}, treinos: [] });
  assert.equal(r.ok, false);
  assert.match(r.erro, /sessoes/);
});

test('carregar sem nada salvo → estado inicial sem aviso', () => {
  const { estado, aviso } = carregar(storageFalso());
  assert.equal(aviso, null);
  assert.equal(estado.treinos.length, 5);
});

test('salvar e carregar preservam treino em andamento (ida e volta)', () => {
  const st = storageFalso();
  const e = estadoInicial();
  e.sessaoAtual = { id: 's1', treinoId: 'A', inicio: '2026-10-02T10:00:00Z', fim: null, descansoAte: null,
    itens: [{ exercicioId: 'stiff', trocadoDe: null, series: 3, repMin: 8, repMax: 12, descanso: 120,
      registros: [{ carga: 42.5, reps: 10, feita: true }] }] };
  assert.equal(salvar(e, st), true);
  const { estado } = carregar(st);
  assert.deepEqual(estado.sessaoAtual, e.sessaoAtual);
});

test('JSON corrompido → guarda o bruto, inicia padrão e avisa', () => {
  const st = storageFalso({ [CHAVE]: '{quebrado' });
  const { estado, aviso } = carregar(st);
  assert.equal(aviso, 'corrompido');
  assert.equal(st.dados[CHAVE + '.corrompido'], '{quebrado');
  assert.equal(estado.treinos.length, 5);
});

test('storage indisponível → estado em memória e aviso', () => {
  const quebrado = { getItem() { throw new Error('bloqueado'); }, setItem() { throw new Error('bloqueado'); } };
  const { estado, aviso } = carregar(quebrado);
  assert.equal(aviso, 'indisponivel');
  assert.equal(estado.treinos.length, 5);
  assert.equal(salvar(estado, quebrado), false);
  assert.equal(salvar(estado, null), false);
});

test('restaurarTreinosPadrao mantém histórico e exercícios personalizados', () => {
  const e = estadoInicial();
  e.treinos[0].itens = [];
  e.sessoes = [{ id: 's' }];
  e.exercicios.c_meu = { id: 'c_meu', personalizado: true };
  const r = restaurarTreinosPadrao(e);
  assert.ok(r.treinos[0].itens.length > 0);
  assert.equal(r.sessoes.length, 1);
  assert.ok(r.exercicios.c_meu);
});
