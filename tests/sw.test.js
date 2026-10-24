import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { VERSAO_APP } from '../js/util.js';

// O app precisa funcionar offline: tudo que a página carrega tem de estar no cache do service worker.
const raiz = new URL('../', import.meta.url);
const textoSw = readFileSync(new URL('sw.js', raiz), 'utf8');

function arquivosDoCache() {
  const m = textoSw.match(/const ARQUIVOS = \[([\s\S]*?)\];/);
  assert.ok(m, 'ARQUIVOS não encontrado no sw.js');
  return [...m[1].matchAll(/'([^']+)'/g)].map(x => x[1]);
}

function listar(pasta, extensao) {
  const dir = new URL(pasta + '/', raiz);
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter(n => n.endsWith(extensao)).map(n => `./${pasta}/${n}`);
}

test('CACHE do sw.js é treino-<VERSAO_APP>', () => {
  const m = textoSw.match(/const CACHE = '([^']+)'/);
  assert.equal(m?.[1], `treino-${VERSAO_APP}`);
});

test('ARQUIVOS cobre todo js, css, fonte e imagem do app', () => {
  const cache = new Set(arquivosDoCache());
  const esperados = [
    ...listar('js', '.js'), ...listar('js/telas', '.js'), ...listar('css', '.css'),
    ...listar('vendor/fonts', '.woff2'), ...listar('img', '.jpg')
  ];
  const faltando = esperados.filter(a => !cache.has(a));
  assert.deepEqual(faltando, []);
});

test('ARQUIVOS não aponta para arquivo inexistente', () => {
  const inexistentes = arquivosDoCache()
    .filter(a => a !== './')
    .filter(a => !existsSync(new URL(a.replace(/^\.\//, ''), raiz)));
  assert.deepEqual(inexistentes, []);
});
