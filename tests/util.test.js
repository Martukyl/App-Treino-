import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  arredondar, parseNumero, parseCarga, parseReps, formatarNumero, formatarKg,
  formatarData, formatarDataCompleta, formatarDuracao, formatarDescanso, gerarId, esc
} from '../js/util.js';

test('arredondar em passos de 0,5', () => {
  assert.equal(arredondar(42.50000001), 42.5);
  assert.equal(arredondar(42.3), 42.5);
  assert.equal(arredondar(42.2), 42);
  assert.equal(arredondar(7, 1), 7);
});

test('parseNumero aceita vírgula e rejeita lixo', () => {
  assert.equal(parseNumero('42,5'), 42.5);
  assert.equal(parseNumero(' 40 '), 40);
  assert.equal(parseNumero(12), 12);
  assert.equal(parseNumero(''), null);
  assert.equal(parseNumero('4a'), null);
  assert.equal(parseNumero('-3'), null);
  assert.equal(parseNumero(null), null);
});

test('parseCarga arredonda a 1 casa e aceita zero', () => {
  assert.equal(parseCarga('42,55'), 42.6);
  assert.equal(parseCarga('0'), 0);
  assert.equal(parseCarga('abc'), null);
});

test('parseReps só aceita inteiro', () => {
  assert.equal(parseReps('12'), 12);
  assert.equal(parseReps('0'), 0);
  assert.equal(parseReps('10,5'), null);
  assert.equal(parseReps(''), null);
});

test('formatação pt-BR', () => {
  assert.equal(formatarNumero(42.5), '42,5');
  assert.equal(formatarNumero(40), '40');
  assert.equal(formatarKg(42.5), '42,5 kg');
  assert.equal(formatarKg(null), '—');
  assert.equal(formatarData('2026-10-02T12:00:00'), '02/10');
  assert.equal(formatarDataCompleta('2026-10-02T12:00:00'), '02/10/2026');
});

test('formatarDuracao', () => {
  assert.equal(formatarDuracao(52 * 60000), '52 min');
  assert.equal(formatarDuracao(65 * 60000), '1h 05min');
  assert.equal(formatarDuracao(20000), '0 min');
});

test('formatarDescanso', () => {
  assert.equal(formatarDescanso(45), '45 s');
  assert.equal(formatarDescanso(60), '1 min');
  assert.equal(formatarDescanso(90), '1 min 30 s');
  assert.equal(formatarDescanso(120), '2 min');
});

test('gerarId gera ids distintos com prefixo', () => {
  const a = gerarId('c_'), b = gerarId('c_');
  assert.ok(a.startsWith('c_'));
  assert.notEqual(a, b);
});

test('esc escapa HTML', () => {
  assert.equal(esc('<b>"a" & \'b\'</b>'), '&lt;b&gt;&quot;a&quot; &amp; &#39;b&#39;&lt;/b&gt;');
  assert.equal(esc(null), '');
});
