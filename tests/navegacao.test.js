import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ABAS, abaDaRota, mostraMenu, direcaoTransicao } from '../js/navegacao.js';

test('ABAS são as 5 telas-raiz do menu, na ordem', () => {
  assert.deepEqual(ABAS, ['hoje', 'corpo', 'exercicios', 'historico', 'ajustes']);
});

test('abaDaRota só reconhece as rotas-raiz', () => {
  assert.equal(abaDaRota('#/corpo'), 'corpo');
  assert.equal(abaDaRota('#/hoje'), 'hoje');
  assert.equal(abaDaRota('#/corpo/fotos'), null);
  assert.equal(abaDaRota('#/exercicio/x'), null);
  assert.equal(abaDaRota(''), null);
});

test('mostraMenu só nas rotas-raiz', () => {
  assert.equal(mostraMenu('#/ranking'), false);
  assert.equal(mostraMenu('#/treino'), false);
  assert.equal(mostraMenu('#/boas-vindas'), false);
  assert.equal(mostraMenu('#/hoje'), true);
  assert.equal(mostraMenu('#/ajustes'), true);
});

test('direcaoTransicao: abertura direta não desliza', () => {
  assert.equal(direcaoTransicao(null, '#/treino'), 0);
  assert.equal(direcaoTransicao(null, '#/hoje'), 0);
});

test('direcaoTransicao entre abas segue a posição no menu', () => {
  assert.equal(direcaoTransicao('#/hoje', '#/historico'), 1);
  assert.equal(direcaoTransicao('#/ajustes', '#/corpo'), -1);
});

test('direcaoTransicao: entrar numa sub-tela avança, sair volta', () => {
  assert.equal(direcaoTransicao('#/exercicios', '#/exercicio/x'), 1);
  assert.equal(direcaoTransicao('#/exercicio/x', '#/exercicios'), -1);
  assert.equal(direcaoTransicao('#/corpo/medida/peso', '#/corpo'), -1);
  assert.equal(direcaoTransicao('#/corpo', '#/corpo/medida/peso'), 1);
  assert.equal(direcaoTransicao('#/treino', '#/hoje'), -1);
  assert.equal(direcaoTransicao('#/sessao/abc', '#/historico'), -1);
  assert.equal(direcaoTransicao('#/hoje', '#/treino'), 1);
});

test('direcaoTransicao: mesma rota não desliza', () => {
  assert.equal(direcaoTransicao('#/hoje', '#/hoje'), 0);
});
