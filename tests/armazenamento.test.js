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
  assert.equal(e.versao, 3);
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

test('nome da usuária: vazio no início e preenchido pela migração em estados antigos', () => {
  assert.equal(estadoInicial().nome, '');
  assert.equal(migrar({ versao: 1, exercicios: {}, treinos: [], sessoes: [] }).nome, '');
  assert.equal(migrar({ ...estadoInicial(), nome: 'Ana' }).nome, 'Ana');
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

test('estadoInicial v2 tem perfil vazio e medidas []', () => {
  const e = estadoInicial();
  assert.deepEqual(e.perfil, { altura: null, nascimento: null, metaPeso: null, fotoId: null });
  assert.deepEqual(e.medidas, []);
});

test('migrar v1→v3 cria perfil/medidas e mantém nome na raiz', () => {
  const m = migrar({ versao: 1, exercicios: {}, treinos: [], sessoes: [], nome: 'Ana' });
  assert.equal(m.versao, 3);
  assert.equal(m.nome, 'Ana');
  assert.deepEqual(m.perfil, { altura: null, nascimento: null, metaPeso: null, fotoId: null });
  assert.deepEqual(m.medidas, []);
});

test('migrar preserva perfil existente e completa campos ausentes', () => {
  const m = migrar({ ...estadoInicial(), perfil: { altura: 165, metaPeso: 60 }, medidas: [{ id: 'm_1', data: '2026-10-02' }] });
  assert.deepEqual(m.perfil, { altura: 165, nascimento: null, metaPeso: 60, fotoId: null });
  assert.equal(m.medidas.length, 1);
});

test('migrar troca perfil/medidas inválidos e não deixa o campo fotos do backup', () => {
  const m = migrar({ ...estadoInicial(), perfil: 'x', medidas: 'y', fotos: { f_1: 'data:image/jpeg;base64,AA' } });
  assert.deepEqual(m.perfil, { altura: null, nascimento: null, metaPeso: null, fotoId: null });
  assert.deepEqual(m.medidas, []);
  assert.equal('fotos' in m, false);
});

test('validarBackup aceita v1 e v2 e rejeita medidas que não seja array', () => {
  assert.equal(validarBackup({ versao: 1, exercicios: {}, treinos: [], sessoes: [] }).ok, true);
  assert.equal(validarBackup({ versao: 2, exercicios: {}, treinos: [], sessoes: [], medidas: [] }).ok, true);
  const r = validarBackup({ versao: 2, exercicios: {}, treinos: [], sessoes: [], medidas: {} });
  assert.equal(r.ok, false);
  assert.match(r.erro, /medidas/);
});

test('carregar estado v1 salvo → migrado para v3', () => {
  const v1 = { versao: 1, exercicios: {}, treinos: [], sessoes: [], nome: 'Bia' };
  const { estado, aviso } = carregar(storageFalso({ [CHAVE]: JSON.stringify(v1) }));
  assert.equal(aviso, null);
  assert.equal(estado.versao, 3);
  assert.equal(estado.nome, 'Bia');
  assert.deepEqual(estado.medidas, []);
});

test('estadoInicial tem cardios vazio e nenhuma gravação em andamento', () => {
  const e = estadoInicial();
  assert.deepEqual(e.cardios, []);
  assert.equal(e.cardioAtual, null);
});

test('migrar v2→v3 cria cardios/cardioAtual e preserva o resto', () => {
  const v2 = { ...estadoInicial(), versao: 2, nome: 'Ana', medidas: [{ id: 'm_1', data: '2026-10-02', peso: 60 }] };
  delete v2.cardios; delete v2.cardioAtual;
  const m = migrar(v2);
  assert.equal(m.versao, 3);
  assert.deepEqual(m.cardios, []);
  assert.equal(m.cardioAtual, null);
  assert.equal(m.nome, 'Ana');
  assert.equal(m.medidas.length, 1);
});

test('migrar preserva cardios e cardioAtual existentes', () => {
  const atual = { id: 'c_2', tipo: 'caminhada', pausado: false };
  const m = migrar({ ...estadoInicial(), cardios: [{ id: 'c_1' }], cardioAtual: atual });
  assert.deepEqual(m.cardios, [{ id: 'c_1' }]);
  assert.deepEqual(m.cardioAtual, atual);
});

test('migrar troca cardios inválido e remove o campo trajetos do backup', () => {
  const m = migrar({ ...estadoInicial(), cardios: 'x', trajetos: { t_1: { segmentos: [] } } });
  assert.deepEqual(m.cardios, []);
  assert.equal('trajetos' in m, false);
});

test('validarBackup aceita v3 e rejeita cardios que não seja array', () => {
  assert.equal(validarBackup({ versao: 3, exercicios: {}, treinos: [], sessoes: [], cardios: [] }).ok, true);
  assert.equal(validarBackup({ versao: 2, exercicios: {}, treinos: [], sessoes: [] }).ok, true);
  const r = validarBackup({ versao: 3, exercicios: {}, treinos: [], sessoes: [], cardios: {} });
  assert.equal(r.ok, false);
  assert.match(r.erro, /cardios/);
});

test('carregar estado v2 salvo → migrado para v3', () => {
  const v2 = { versao: 2, exercicios: {}, treinos: [], sessoes: [], medidas: [] };
  const { estado, aviso } = carregar(storageFalso({ [CHAVE]: JSON.stringify(v2) }));
  assert.equal(aviso, null);
  assert.equal(estado.versao, 3);
  assert.deepEqual(estado.cardios, []);
  assert.equal(estado.cardioAtual, null);
});

test('boasVindasPendente: estado novo = true; estado existente sem o campo = false', () => {
  assert.equal(estadoInicial().boasVindasPendente, true);
  // quem já usava o app (salvo antes da v1.3, sem o campo) não vê as boas-vindas
  const antigo = estadoInicial();
  delete antigo.boasVindasPendente;
  assert.equal(migrar(antigo).boasVindasPendente, false);
  assert.equal(migrar({ versao: 1, exercicios: {}, treinos: [], sessoes: [] }).boasVindasPendente, false);
  // um estado novo ainda não concluído continua pendente após migrar
  assert.equal(migrar(estadoInicial()).boasVindasPendente, true);
  const st = storageFalso({ [CHAVE]: JSON.stringify(antigo) });
  assert.equal(carregar(st).estado.boasVindasPendente, false);
  assert.equal(carregar(storageFalso()).estado.boasVindasPendente, true);
});

test('ranking: estado novo = null; migrar preserva o válido e normaliza o inválido', () => {
  assert.equal(estadoInicial().ranking, null);
  const antigo = estadoInicial();
  delete antigo.ranking;
  assert.equal(migrar(antigo).ranking, null);
  const valido = { userId: 'u1', refreshToken: 'rt', grupo: { codigo: 'ABC234', nome: 'Meninas' }, apelido: 'Bia', emoji: '🔥', criador: true };
  assert.deepEqual(migrar({ ...estadoInicial(), ranking: valido }).ranking, valido);
  for (const ruim of ['x', 5, [], { grupo: 'abc' }]) {
    const r = migrar({ ...estadoInicial(), ranking: ruim }).ranking;
    assert.ok(r === null || (r.grupo === null && r.userId === null && r.criador === false));
  }
  // criador sem grupo não existe; emoji vazio volta ao padrão
  const sem = migrar({ ...estadoInicial(), ranking: { userId: 'u', criador: true, emoji: '' } }).ranking;
  assert.equal(sem.criador, false);
  assert.equal(sem.emoji, '💪');
  // faz parte do backup (viaja no estado)
  const st = storageFalso({ [CHAVE]: JSON.stringify({ ...estadoInicial(), ranking: valido }) });
  assert.deepEqual(carregar(st).estado.ranking, valido);
});
