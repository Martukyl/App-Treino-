import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  agregarUltimosDias, limitesPeriodo, inicioBusca, ordenarRanking, calcularRanking,
  formatarValor, textoIdade, normalizarCodigo, normalizarApelido, CODIGO_VALIDO
} from '../js/ranking-calculo.js';
import { dadosCardRanking } from '../js/cards.js';

const local = (a, m, d, h = 10) => new Date(a, m - 1, d, h).toISOString();
const sessao = fim => ({ id: 's' + fim, treinoId: 'A', inicio: fim, fim, itens: [{ exercicioId: 'x', registros: [{ carga: 10, reps: 10, feita: true }] }] });
const cardio = (fim, min, km) => ({ id: 'c' + fim, fim, duracaoSeg: min * 60, distanciaM: km * 1000 });
// 2026-10-03 é sábado; a semana começa em 2026-09-28 (segunda)
const HOJE = '2026-10-03';

test('agregarUltimosDias: 35 dias terminando hoje, em ordem, com zeros', () => {
  const linhas = agregarUltimosDias(
    [sessao(local(2026, 10, 3)), sessao(local(2026, 9, 1))],
    [cardio(local(2026, 10, 3, 18), 30, 3.456)],
    HOJE
  );
  assert.equal(linhas.length, 35);
  assert.equal(linhas[0].data, '2026-08-30');
  assert.equal(linhas[34].data, HOJE);
  assert.deepEqual(linhas[34], { data: HOJE, treinos: 1, cardio_min: 30, km: 3.46, pontos: 16 });
  assert.deepEqual(linhas[33], { data: '2026-10-02', treinos: 0, cardio_min: 0, km: 0, pontos: 0 });
  assert.equal(linhas.find(l => l.data === '2026-09-01').pontos, 10);
  // sessão fora da janela de 35 dias não aparece
  const fora = agregarUltimosDias([sessao(local(2026, 8, 1))], [], HOJE);
  assert.ok(fora.every(l => l.pontos === 0));
});

test('agregarUltimosDias respeita os limites do banco (não derruba o lote)', () => {
  const muitos = Array.from({ length: 25 }, (_, i) => sessao(local(2026, 10, 3, 6 + (i % 10))));
  const l = agregarUltimosDias(muitos, [cardio(local(2026, 10, 3), 2000, 500)], HOJE).at(-1);
  assert.equal(l.treinos, 20);
  assert.equal(l.cardio_min, 1440);
  assert.equal(l.km, 300);
  assert.equal(l.pontos, 22);
});

test('limitesPeriodo e inicioBusca', () => {
  assert.deepEqual(limitesPeriodo('semana', HOJE), { inicio: '2026-09-28', fim: HOJE });
  assert.deepEqual(limitesPeriodo('mes', HOJE), { inicio: '2026-10-01', fim: HOJE });
  assert.equal(inicioBusca('2026-10-03'), '2026-08-24'); // hoje − 40 é mais antigo que o dia 1
  assert.equal(inicioBusca('2026-10-31'), '2026-09-21'); // sempre cobre 40 dias (o mês tem no máx. 31)
});

const membros = [
  { user_id: 'a', apelido: 'Ana', emoji: '🔥' },
  { user_id: 'b', apelido: 'Bia', emoji: '💪' },
  { user_id: 'c', apelido: 'Cris', emoji: '🏃' }
];
const dia = (user_id, data, treinos, cardio_min, km, pontos) => ({ user_id, data, treinos, cardio_min, km, pontos });

test('calcularRanking: soma por período (semana x mês) e ignora dias fora', () => {
  const dias = [
    dia('a', '2026-09-27', 1, 0, 0, 10), // domingo anterior: fora da semana e do mês
    dia('a', '2026-09-28', 1, 20, 2.5, 14),
    dia('a', '2026-10-02', 0, 30, 4, 6),
    dia('b', '2026-10-01', 1, 0, 0, 10),
    dia('b', '2026-09-29', 1, 65, 8.25, 22),
    dia('x', '2026-10-01', 1, 0, 0, 10) // não é membro: ignorado
  ];
  const semana = calcularRanking(membros, dias, HOJE, 'semana');
  const ana = semana.find(m => m.userId === 'a');
  assert.deepEqual([ana.pontos, ana.treinos, ana.cardioMin, ana.km], [20, 1, 50, 6.5]);
  const bia = semana.find(m => m.userId === 'b');
  assert.deepEqual([bia.pontos, bia.treinos, bia.cardioMin, bia.km], [32, 2, 65, 8.25]);
  assert.deepEqual(semana.find(m => m.userId === 'c'), {
    userId: 'c', apelido: 'Cris', emoji: '🏃', pontos: 0, treinos: 0, cardioMin: 0, km: 0, sequencia: 0
  });
  assert.equal(semana.length, 3);
  const mes = calcularRanking(membros, dias, HOJE, 'mes');
  assert.equal(mes.find(m => m.userId === 'a').pontos, 6); // só 02/10 em outubro
  assert.equal(mes.find(m => m.userId === 'b').pontos, 10);
});

test('ordenarRanking: valor, depois mais treinos, depois apelido; não altera a entrada', () => {
  const lista = [
    { apelido: 'Zeca', pontos: 20, treinos: 1 },
    { apelido: 'Bia', pontos: 20, treinos: 2 },
    { apelido: 'Ana', pontos: 20, treinos: 2 },
    { apelido: 'Cris', pontos: 30, treinos: 0 },
    { apelido: 'Dani', pontos: 5, treinos: 5 }
  ];
  const copia = JSON.parse(JSON.stringify(lista));
  assert.deepEqual(ordenarRanking(lista, 'pontos').map(x => x.apelido), ['Cris', 'Ana', 'Bia', 'Zeca', 'Dani']);
  assert.deepEqual(lista, copia);
  // por treinos: empate vira apelido (treinos é a própria métrica)
  assert.deepEqual(ordenarRanking(lista, 'treinos').map(x => x.apelido), ['Dani', 'Ana', 'Bia', 'Zeca', 'Cris']);
  // acentos no desempate seguem pt-BR
  const acento = [{ apelido: 'Érica', pontos: 1, treinos: 1 }, { apelido: 'Elis', pontos: 1, treinos: 1 }];
  assert.deepEqual(ordenarRanking(acento, 'pontos').map(x => x.apelido), ['Elis', 'Érica']);
});

test('sequência por membro: hoje ativo, hoje vazio usa ontem, e quebra', () => {
  const dias = [
    // a: 01, 02, 03 (hoje) → 3
    dia('a', '2026-10-01', 1, 0, 0, 10), dia('a', '2026-10-02', 0, 10, 1, 2), dia('a', '2026-10-03', 1, 0, 0, 10),
    // b: 01, 02 (hoje vazio) → 2
    dia('b', '2026-10-01', 1, 0, 0, 10), dia('b', '2026-10-02', 1, 0, 0, 10), dia('b', '2026-10-03', 0, 0, 0, 0),
    // c: 30/09 e 01/10, mas ontem e hoje vazios → 0; dias com zeros não contam
    dia('c', '2026-09-30', 1, 0, 0, 10), dia('c', '2026-10-01', 1, 0, 0, 10), dia('c', '2026-10-02', 0, 0, 0, 0)
  ];
  const r = Object.fromEntries(calcularRanking(membros, dias, HOJE, 'semana').map(m => [m.userId, m.sequencia]));
  assert.deepEqual(r, { a: 3, b: 2, c: 0 });
  // a sequência não depende do período escolhido
  const mes = Object.fromEntries(calcularRanking(membros, dias, HOJE, 'mes').map(m => [m.userId, m.sequencia]));
  assert.deepEqual(mes, r);
  // atravessa a virada de mês
  const virada = [dia('a', '2026-09-30', 1, 0, 0, 10), dia('a', '2026-10-01', 1, 0, 0, 10), dia('a', '2026-10-02', 1, 0, 0, 10)];
  assert.equal(calcularRanking(membros, virada, HOJE, 'mes')[0].sequencia, 3);
});

test('km vindo como texto do servidor (numeric) também soma', () => {
  const r = calcularRanking(membros, [dia('a', '2026-10-02', 0, 10, '2.50', 2), dia('a', '2026-10-03', 0, 10, '1.25', 2)], HOJE, 'semana');
  assert.equal(r[0].km, 3.75);
});

test('formatarValor, textoIdade e normalização de campos', () => {
  assert.equal(formatarValor('pontos', 32), '32 pts');
  assert.equal(formatarValor('cardioMin', 90), '90 min');
  assert.equal(formatarValor('km', 12.5), '12,5 km');
  assert.equal(formatarValor('sequencia', 1), '1 dia');
  assert.equal(formatarValor('sequencia', 4), '4 dias');
  assert.equal(formatarValor('treinos', 3), '3');
  assert.equal(textoIdade(20_000), 'atualizado agora');
  assert.equal(textoIdade(3 * 60_000), 'atualizado há 3 min');
  assert.equal(textoIdade(120 * 60_000), 'atualizado há 2 h');
  assert.equal(normalizarCodigo(' fit 7k2\n'), 'FIT7K2');
  assert.equal(normalizarApelido('  Bia  '), 'Bia');
  assert.ok(CODIGO_VALIDO.test('FJT7K2'));
  assert.ok(!CODIGO_VALIDO.test('FIT0K2')); // sem 0, 1, I, O
  assert.ok(!CODIGO_VALIDO.test('FIT7K'));
});

test('dadosCardRanking: pódio top 3, lista até 10, só apelidos', () => {
  const lista = Array.from({ length: 12 }, (_, i) => ({ apelido: `P${i + 1}`, emoji: '💪', pontos: 100 - i, userId: 'u' + i }));
  const d = dadosCardRanking({ grupo: 'Meninas', periodo: 'semana', lista, hoje: HOJE, inicio: '2026-09-28', fim: HOJE });
  assert.equal(d.tipo, 'ranking');
  assert.equal(d.titulo, 'Ranking da semana');
  assert.equal(d.subtitulo, 'Meninas · 28/09 a 03/10');
  assert.equal(d.podio.length, 3);
  assert.equal(d.linhas.length, 7);
  assert.equal(d.linhas.at(-1).posicao, 10);
  assert.equal(d.podio[0].valor, '100 pts');
  assert.ok(!JSON.stringify(d).includes('userId'));
  assert.equal(dadosCardRanking({ grupo: 'G', periodo: 'mes', lista: [], hoje: HOJE, inicio: '2026-10-01', fim: HOJE }).titulo, 'Ranking do mês');
});
