import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CAMPOS_CORPO, idade, imc, faixaImc, ordenarPorData, serieCampo, resumoCampo,
  direcaoDiferenca, faltaParaMeta, ultimoValor, contarMedidas
} from '../js/corpo.js';

test('CAMPOS_CORPO: 11 campos na ordem da spec, com direção', () => {
  assert.deepEqual(CAMPOS_CORPO.map(c => c.campo), [
    'peso', 'busto', 'ombros', 'bracoD', 'bracoE', 'cintura', 'abdomen', 'quadril', 'coxaD', 'coxaE', 'panturrilha'
  ]);
  const por = Object.fromEntries(CAMPOS_CORPO.map(c => [c.campo, c]));
  assert.equal(por.peso.unidade, 'kg');
  assert.equal(por.cintura.direcao, 'descer');
  assert.equal(por.abdomen.direcao, 'descer');
  assert.equal(por.coxaD.direcao, 'subir');
  assert.equal(por.quadril.grupo, 'Inferiores');
  assert.equal(por.busto.grupo, 'Superiores');
  assert.equal(por.bracoD.rotulo, 'Braço direito');
});

test('idade: antes, no dia e depois do aniversário', () => {
  assert.equal(idade('1990-10-04', new Date(2026, 9, 3)), 35);
  assert.equal(idade('1990-10-03', new Date(2026, 9, 3)), 36);
  assert.equal(idade('1990-10-02', new Date(2026, 9, 3)), 36);
  assert.equal(idade('1990-01-01', new Date(2026, 9, 3)), 36);
});

test('idade: nulo ou inválido → null', () => {
  assert.equal(idade(null), null);
  assert.equal(idade(''), null);
  assert.equal(idade('lixo'), null);
});

test('imc e faixas', () => {
  assert.equal(imc(60, 165), 22);
  assert.equal(imc(62.4, 170), 21.6);
  assert.equal(imc(null, 165), null);
  assert.equal(imc(60, null), null);
  assert.equal(imc(60, 0), null);
  assert.equal(faixaImc(18.4), 'Abaixo do peso');
  assert.equal(faixaImc(18.5), 'Normal');
  assert.equal(faixaImc(24.9), 'Normal');
  assert.equal(faixaImc(25), 'Sobrepeso');
  assert.equal(faixaImc(29.9), 'Sobrepeso');
  assert.equal(faixaImc(30), 'Obesidade');
  assert.equal(faixaImc(null), null);
});

test('ordenarPorData: cópia, mais antigo primeiro', () => {
  const m = [{ id: 'b', data: '2026-10-02' }, { id: 'a', data: '2026-09-01' }, { id: 'c', data: '2026-10-15' }];
  const o = ordenarPorData(m);
  assert.deepEqual(o.map(r => r.id), ['a', 'b', 'c']);
  assert.deepEqual(m.map(r => r.id), ['b', 'a', 'c']); // original intacto
});

test('serieCampo ignora nulos e vem cronológica', () => {
  const m = [
    { data: '2026-10-02', peso: 62.4 },
    { data: '2026-09-01', peso: 60.1 },
    { data: '2026-09-15', peso: null },
    { data: '2026-09-20' }
  ];
  assert.deepEqual(serieCampo(m, 'peso'), [
    { data: '2026-09-01', valor: 60.1 }, { data: '2026-10-02', valor: 62.4 }
  ]);
  assert.deepEqual(serieCampo(m, 'cintura'), []);
});

test('resumoCampo: diferenças com 1 casa sem erro de ponto flutuante', () => {
  const m = [{ data: '2026-09-01', peso: 60.1 }, { data: '2026-10-02', peso: 62.4 }];
  assert.deepEqual(resumoCampo(m, 'peso'), {
    atual: 62.4, anterior: 60.1, primeiro: 60.1, difAnterior: 2.3, difPrimeiro: 2.3
  });
});

test('resumoCampo: registro mais recente sem o campo usa o campo, não o registro', () => {
  const m = [
    { data: '2026-08-01', cintura: 80 },
    { data: '2026-09-01', cintura: 78.5 },
    { data: '2026-10-01', peso: 60 } // sem cintura
  ];
  assert.deepEqual(resumoCampo(m, 'cintura'), {
    atual: 78.5, anterior: 80, primeiro: 80, difAnterior: -1.5, difPrimeiro: -1.5
  });
});

test('resumoCampo: três valores e um só valor / nenhum', () => {
  const m = [
    { data: '2026-08-01', busto: 90 }, { data: '2026-09-01', busto: 91 }, { data: '2026-10-01', busto: 93 }
  ];
  assert.deepEqual(resumoCampo(m, 'busto'), {
    atual: 93, anterior: 91, primeiro: 90, difAnterior: 2, difPrimeiro: 3
  });
  assert.deepEqual(resumoCampo([{ data: '2026-08-01', busto: 90 }], 'busto'), {
    atual: 90, anterior: null, primeiro: 90, difAnterior: null, difPrimeiro: null
  });
  assert.deepEqual(resumoCampo([], 'busto'), {
    atual: null, anterior: null, primeiro: null, difAnterior: null, difPrimeiro: null
  });
});

test('direcaoDiferenca: campos de subir e descer', () => {
  assert.equal(direcaoDiferenca('coxaD', 1.2), 'boa');
  assert.equal(direcaoDiferenca('coxaD', -1.2), 'ruim');
  assert.equal(direcaoDiferenca('cintura', -1), 'boa');
  assert.equal(direcaoDiferenca('cintura', 1), 'ruim');
  assert.equal(direcaoDiferenca('cintura', 0), 'neutra');
  assert.equal(direcaoDiferenca('cintura', null), 'neutra');
  assert.equal(direcaoDiferenca('campoInexistente', 1), 'neutra');
});

test('direcaoDiferenca: peso depende da meta', () => {
  // meta acima do peso atual → subir é bom
  assert.equal(direcaoDiferenca('peso', 1, { pesoAtual: 60, metaPeso: 65 }), 'boa');
  assert.equal(direcaoDiferenca('peso', -1, { pesoAtual: 60, metaPeso: 65 }), 'ruim');
  // meta abaixo → descer é bom
  assert.equal(direcaoDiferenca('peso', -1, { pesoAtual: 70, metaPeso: 65 }), 'boa');
  assert.equal(direcaoDiferenca('peso', 1, { pesoAtual: 70, metaPeso: 65 }), 'ruim');
  // sem meta, sem peso atual, dif zero/nulo → neutra
  assert.equal(direcaoDiferenca('peso', 1, { pesoAtual: 60, metaPeso: null }), 'neutra');
  assert.equal(direcaoDiferenca('peso', 1), 'neutra');
  assert.equal(direcaoDiferenca('peso', 1, { pesoAtual: null, metaPeso: 65 }), 'neutra');
  assert.equal(direcaoDiferenca('peso', 0, { pesoAtual: 60, metaPeso: 65 }), 'neutra');
  assert.equal(direcaoDiferenca('peso', null, { pesoAtual: 60, metaPeso: 65 }), 'neutra');
});

test('faltaParaMeta: com sinal e 1 casa', () => {
  assert.equal(faltaParaMeta(62.4, 65), 2.6);
  assert.equal(faltaParaMeta(66, 65), -1);
  assert.equal(faltaParaMeta(65, 65), 0);
  assert.equal(faltaParaMeta(null, 65), null);
  assert.equal(faltaParaMeta(60, null), null);
});

test('ultimoValor: último não nulo cronológico', () => {
  const m = [
    { data: '2026-10-01', peso: 60 },
    { data: '2026-08-01', cintura: 80 },
    { data: '2026-09-01', cintura: 78.5 },
    { data: '2026-10-05', cintura: null }
  ];
  assert.equal(ultimoValor(m, 'cintura'), 78.5);
  assert.equal(ultimoValor(m, 'peso'), 60);
  assert.equal(ultimoValor(m, 'busto'), null);
  assert.equal(ultimoValor([], 'peso'), null);
});

test('contarMedidas: só os 10 campos em cm, sem peso', () => {
  assert.equal(contarMedidas({ peso: 60, busto: 90, cintura: 70, quadril: null, coxaD: 0 }), 3);
  assert.equal(contarMedidas({ peso: 60 }), 0);
  assert.equal(contarMedidas({}), 0);
});
