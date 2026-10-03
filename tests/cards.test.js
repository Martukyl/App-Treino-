import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  projetarTrajeto, dadosCardTreino, dadosCardCardio, dadosCardSemana, dadosCardCorpo,
  fotosAntesDepois, nomeArquivoCard, formatarDif, MAX_MEDIDAS_CARD
} from '../js/cards.js';

const local = (a, m, d, h = 10, min = 0) => new Date(a, m - 1, d, h, min).toISOString();

// ---- projeção ----

const dentro = (proj, l, a, m) => proj.segmentos.flat().every(([x, y]) =>
  x >= m - 1e-6 && x <= l - m + 1e-6 && y >= m - 1e-6 && y <= a - m + 1e-6);

test('projetarTrajeto cabe na caixa com margem e preserva a proporção (cos da latitude)', () => {
  // ~0,02° de latitude × ~0,04° de longitude em lat -23: largura do mundo = 0,04·cos(23°)
  const seg = [[[-23.00, -46.00, null, 0], [-23.02, -46.04, null, 1], [-23.01, -46.02, null, 2]]];
  const p = projetarTrajeto(seg, { largura: 800, altura: 600, margem: 40 });
  assert.ok(dentro(p, 800, 600, 40));
  const xs = p.segmentos[0].map(q => q[0]), ys = p.segmentos[0].map(q => q[1]);
  const w = Math.max(...xs) - Math.min(...xs), h = Math.max(...ys) - Math.min(...ys);
  const esperado = (0.04 * Math.cos(23.01 * Math.PI / 180)) / 0.02;
  assert.ok(Math.abs(w / h - esperado) < 1e-6, `${w / h} vs ${esperado}`);
  // encosta numa das dimensões da caixa
  assert.ok(Math.abs(w - 720) < 1e-6 || Math.abs(h - 520) < 1e-6);
});

test('projetarTrajeto: norte para cima, início e fim corretos', () => {
  const seg = [[[0, 0, null, 0], [1, 0, null, 1]]]; // vai para o norte
  const p = projetarTrajeto(seg, { largura: 400, altura: 400, margem: 20 });
  assert.ok(p.inicio[1] > p.fim[1]); // y menor = mais acima
  assert.deepEqual(p.fim, p.segmentos[0][1]);
});

test('projetarTrajeto: ponto único e trajeto em linha reta não quebram (sem NaN)', () => {
  const um = projetarTrajeto([[[-23, -46, null, 0]]], { largura: 400, altura: 300, margem: 20 });
  assert.deepEqual(um.inicio, [200, 150]);
  const reta = projetarTrajeto([[[-23, -46, null, 0], [-23, -45.9, null, 1]]], { largura: 400, altura: 300, margem: 20 });
  assert.ok(reta.segmentos.flat().flat().every(Number.isFinite));
  assert.ok(dentro(reta, 400, 300, 20));
});

test('projetarTrajeto: vários segmentos e sem pontos', () => {
  const p = projetarTrajeto([[[0, 0, 0, 0], [0, 1, 0, 1]], [[1, 1, 0, 2], [1, 2, 0, 3]]], { largura: 500, altura: 500, margem: 10 });
  assert.equal(p.segmentos.length, 2);
  assert.ok(dentro(p, 500, 500, 10));
  assert.equal(projetarTrajeto([], { largura: 100, altura: 100 }), null);
  assert.equal(projetarTrajeto([[]], { largura: 100, altura: 100 }), null);
});

// ---- textos ----

const estBase = () => ({
  nome: 'Ana',
  treinos: [{ id: 'B', nome: 'Superiores — Costas e ombro', foco: 'Costas e ombro', itens: [] }, { id: 'F', nome: 'Meu treino', foco: '', itens: [] }],
  sessoes: [], cardios: [], medidas: [], perfil: { metaPeso: 60 }
});
const sessaoB = () => ({
  id: 's1', treinoId: 'B', inicio: local(2026, 10, 3, 9, 0), fim: local(2026, 10, 3, 10, 5),
  itens: [
    { exercicioId: 'a', registros: [{ carga: 40, reps: 10, feita: true }, { carga: 40, reps: 10, feita: true }] },
    { exercicioId: 'b', registros: [{ carga: null, reps: 12, feita: true }] }
  ]
});

test('dadosCardTreino: título, data, duração, séries, volume, exercícios e foto A–E', () => {
  const d = dadosCardTreino(estBase(), sessaoB());
  assert.equal(d.titulo, 'Treino B · Costas e ombro');
  assert.equal(d.saudacao, 'Mandou bem, Ana! 💪');
  assert.equal(d.data, '03/10/2026');
  assert.deepEqual(d.metricas.map(m => m.valor), ['1h 05min', '3', '800 kg', '2']);
  assert.equal(d.foto, './img/treino-b.jpg');
});

test('dadosCardTreino: sem nome, treino criado (sem foto) e treino removido', () => {
  const est = { ...estBase(), nome: '  ' };
  const s = { ...sessaoB(), treinoId: 'F' };
  const d = dadosCardTreino(est, s);
  assert.equal(d.saudacao, 'Treino concluído! 💪');
  assert.equal(d.foto, null);
  assert.equal(dadosCardTreino(est, { ...s, treinoId: 'Z' }).titulo, 'Treino');
  assert.equal(dadosCardTreino(est, { ...s, treinoId: 'F' }).titulo, 'Treino F · Meu treino');
});

test('dadosCardCardio GPS: distância em destaque, tempo, ritmo, kcal e subida', () => {
  const c = { modo: 'gps', tipo: 'caminhada', fim: local(2026, 10, 3, 8), duracaoSeg: 2480, distanciaM: 3420, kcal: 180, subidaM: 25, trajetoId: 't_1' };
  const d = dadosCardCardio(c);
  assert.equal(d.titulo, '🚶 Caminhada');
  assert.equal(d.destaque.valor, '3,42 km');
  assert.deepEqual(d.metricas.map(m => m.valor), ['41:20', '12:05 /km', '180 kcal', '25 m']);
  assert.equal(d.trajetoId, 't_1');
});

test('dadosCardCardio aparelho: tempo, distância opcional e kcal opcional', () => {
  const c = { modo: 'aparelho', tipo: 'bicicleta', fim: local(2026, 10, 3, 8), duracaoSeg: 1800, distanciaM: null, kcal: null, trajetoId: null };
  const d = dadosCardCardio(c);
  assert.equal(d.modo, 'aparelho');
  assert.equal(d.destaque, null);
  assert.deepEqual(d.metricas, [{ rotulo: 'Tempo', valor: '30 min' }]);
  const e = dadosCardCardio({ ...c, distanciaM: 10000, kcal: 250 });
  assert.deepEqual(e.metricas.map(m => m.rotulo), ['Tempo', 'Distância', 'Calorias']);
});

test('dadosCardSemana: 7 dias, totais da semana e sequência', () => {
  const est = estBase();
  est.sessoes = [sessaoB()]; // sábado 03/10
  est.cardios = [{ id: 'c', fim: local(2026, 10, 2, 7), duracaoSeg: 1800, distanciaM: 3000 }]; // sexta
  const d = dadosCardSemana(est, '2026-10-03');
  assert.equal(d.periodo, '28/09 a 04/10');
  assert.equal(d.dias.length, 7);
  assert.deepEqual(d.dias.map(x => x.letra).join(''), 'STQQSSD');
  assert.deepEqual(d.dias.map(x => x.ativo), [false, false, false, false, true, true, false]);
  assert.equal(d.dias[5].hoje, true);
  assert.deepEqual(d.metricas.map(m => m.valor), ['1', '30 min', '3 km', '16']);
  assert.equal(d.sequencia, 2);
  assert.equal(d.textoSequencia, '🔥 2 dias seguidos');
  assert.match(dadosCardSemana(estBase(), '2026-10-03').textoSequencia, /Comece/);
});

const registro = (id, data, extra = {}) => ({ id, data, fotos: { frente: null, lado: null, costas: null }, ...extra });

test('dadosCardCorpo: peso, variação com cor, até 6 medidas (com variação primeiro)', () => {
  const est = estBase();
  est.medidas = [
    registro('m1', '2026-09-01', { peso: 64, cintura: 80, quadril: 100, busto: 90, ombros: 100, coxaD: 55, coxaE: 55, abdomen: 85 }),
    registro('m2', '2026-10-01', { peso: 62.5, cintura: 78, quadril: 102, abdomen: 84, panturrilha: 35 })
  ];
  const d = dadosCardCorpo(est);
  assert.equal(d.peso.valor, '62,5 kg');
  assert.equal(d.peso.dif, '−1,5 kg desde o início');
  assert.equal(d.peso.direcao, 'boa'); // meta 60 < peso atual: perder é bom
  assert.equal(d.desde, 'desde 01/09/2026');
  assert.equal(d.medidas.length, MAX_MEDIDAS_CARD);
  const cintura = d.medidas.find(m => m.rotulo === 'Cintura');
  assert.deepEqual([cintura.valor, cintura.dif, cintura.direcao], ['78 cm', '−2 cm', 'boa']);
  // só 6 cabem: panturrilha (1 valor, sem variação) fica de fora
  assert.ok(d.medidas.findIndex(m => m.rotulo === 'Panturrilha') === -1);
  assert.equal(d.fotos, null);
});

test('dadosCardCorpo: sem registros e com um registro só', () => {
  const vazio = dadosCardCorpo(estBase());
  assert.equal(vazio.peso, null);
  assert.deepEqual(vazio.medidas, []);
  const est = estBase();
  est.medidas = [registro('m1', '2026-09-01', { peso: 64 })];
  const d = dadosCardCorpo(est);
  assert.equal(d.peso.dif, null);
  assert.equal(d.desde, '');
});

test('fotosAntesDepois: primeiro e último registro com foto de frente', () => {
  const m = [
    registro('a', '2026-09-01', { fotos: { frente: 'f1', lado: null, costas: null } }),
    registro('b', '2026-09-15'),
    registro('c', '2026-10-01', { fotos: { frente: 'f3', lado: 'x', costas: null } }),
    registro('d', '2026-09-20', { fotos: { frente: null, lado: 'y', costas: null } })
  ];
  assert.deepEqual(fotosAntesDepois(m), { antes: { id: 'f1', data: '01/09/2026' }, depois: { id: 'f3', data: '01/10/2026' } });
  assert.equal(fotosAntesDepois(m.slice(0, 2)), null);
  const est = estBase();
  est.medidas = m;
  assert.equal(dadosCardCorpo(est, { incluirFotos: true }).fotos.depois.id, 'f3');
  assert.equal(dadosCardCorpo(est, { incluirFotos: false }).fotos, null);
});

test('nomeArquivoCard e formatarDif', () => {
  assert.equal(nomeArquivoCard('semana', '2026-10-03'), 'treino-semana-2026-10-03.png');
  assert.equal(formatarDif(-0.5), '−0,5');
  assert.equal(formatarDif(1.2), '+1,2');
  assert.equal(formatarDif(0), '0');
  assert.equal(formatarDif(null), '—');
});
