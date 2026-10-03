import { test } from 'node:test';
import assert from 'node:assert/strict';
import { criarCliente, ErroRanking, MSG_SESSAO_EXPIRADA } from '../js/supabase.js';

const URL_BASE = 'https://exemplo.supabase.co';
const resposta = (status, corpo) => ({
  ok: status >= 200 && status < 300, status,
  text: async () => (corpo === undefined ? '' : JSON.stringify(corpo))
});
const sessao = (n, extra = {}) => ({
  access_token: `acesso${n}`, refresh_token: `refresh${n}`, expires_at: 1000 + 3600, expires_in: 3600,
  user: { id: 'user-1' }, ...extra
});
const RANKING = { userId: 'u', refreshToken: 'rt', grupo: null, apelido: '', emoji: '💪', criador: false };

// cliente com fetch simulado: roteiro(url, init) → resposta; guarda as chamadas
function montar({ roteiro, ranking = null, agora = () => 1000 * 1000, timeoutMs = 10000 } = {}) {
  const estado = { ranking };
  const chamadas = [];
  const fetch = async (url, init) => {
    chamadas.push({ url, init, corpo: init.body ? JSON.parse(init.body) : undefined });
    return roteiro(url, init, chamadas.length);
  };
  const cliente = criarCliente({
    url: URL_BASE + '/', chave: 'CHAVE', fetch, agora, timeoutMs,
    ler: () => estado.ranking, gravar: fn => { estado.ranking = fn(estado.ranking); }
  });
  return { cliente, estado, chamadas };
}

test('configurado só com URL e chave', () => {
  const vazio = criarCliente({ url: '', chave: '', fetch: async () => {}, ler: () => null, gravar() {} });
  assert.equal(vazio.configurado(), false);
  assert.equal(montar({ roteiro: () => resposta(200, {}) }).cliente.configurado(), true);
});

test('entrarAnonimo: POST /auth/v1/signup com {} e guarda userId e refresh token', async () => {
  const { cliente, estado, chamadas } = montar({ roteiro: () => resposta(200, sessao(1)) });
  const id = await cliente.entrarAnonimo();
  assert.equal(id, 'user-1');
  assert.equal(chamadas[0].url, `${URL_BASE}/auth/v1/signup`);
  assert.equal(chamadas[0].init.method, 'POST');
  assert.deepEqual(chamadas[0].corpo, {});
  assert.equal(chamadas[0].init.headers.apikey, 'CHAVE');
  assert.equal(chamadas[0].init.headers['Content-Type'], 'application/json');
  assert.equal(estado.ranking.userId, 'user-1');
  assert.equal(estado.ranking.refreshToken, 'refresh1');
  // o access token já serve (válido por mais de 60 s): token() não chama a rede de novo
  assert.equal(await cliente.token(), 'acesso1');
  assert.equal(chamadas.length, 1);
});

test('signup recusado: mensagem do servidor (login anônimo desligado)', async () => {
  const { cliente } = montar({ roteiro: () => resposta(422, { msg: 'Anonymous sign-ins are disabled' }) });
  await assert.rejects(cliente.entrarAnonimo(), e => e instanceof ErroRanking && /Anonymous/.test(e.message) && !e.offline);
});

test('renovação única: 2 token() concorrentes fazem uma só chamada e guardam o refresh rotacionado', async () => {
  let agora = 1000 * 1000;
  const { cliente, estado, chamadas } = montar({
    ranking: { ...RANKING, refreshToken: 'antigo' },
    agora: () => agora,
    roteiro: async url => {
      assert.match(url, /\/auth\/v1\/token\?grant_type=refresh_token$/);
      await new Promise(r => setTimeout(r, 15));
      return resposta(200, sessao(2));
    }
  });
  const [a, b] = await Promise.all([cliente.token(), cliente.token()]);
  assert.equal(a, 'acesso2');
  assert.equal(b, 'acesso2');
  assert.equal(chamadas.length, 1);
  assert.deepEqual(chamadas[0].corpo, { refresh_token: 'antigo' });
  assert.equal(estado.ranking.refreshToken, 'refresh2'); // rotacionado e salvo no estado
  // 60 s de folga: faltando menos de 60 s para expirar, renova de novo (com o token rotacionado)
  agora = (1000 + 3600 - 30) * 1000;
  await cliente.token();
  assert.equal(chamadas.length, 2);
  assert.deepEqual(chamadas[1].corpo, { refresh_token: 'refresh2' });
});

test('refresh rejeitado (400/401) = sessão inválida: limpa userId/refreshToken e mantém o resto', async () => {
  for (const status of [400, 401]) {
    const { cliente, estado } = montar({
      ranking: { userId: 'u', refreshToken: 'velho', grupo: { codigo: 'ABC234', nome: 'G' }, apelido: 'Bia', emoji: '🔥', criador: true },
      roteiro: () => resposta(status, { error: 'invalid_grant', error_description: 'Invalid Refresh Token' })
    });
    await assert.rejects(cliente.token(), e => e.sessaoInvalida === true && e.message === MSG_SESSAO_EXPIRADA && !e.offline);
    assert.equal(estado.ranking.userId, null);
    assert.equal(estado.ranking.refreshToken, null);
    assert.equal(estado.ranking.apelido, 'Bia');
    assert.deepEqual(estado.ranking.grupo, { codigo: 'ABC234', nome: 'G' });
  }
});

test('sem refresh token guardado = sessão inválida, sem chamar a rede', async () => {
  const { cliente, chamadas } = montar({ roteiro: () => resposta(200, {}) });
  await assert.rejects(cliente.token(), e => e.sessaoInvalida === true);
  assert.equal(chamadas.length, 0);
});

test('falha de rede e timeout viram { offline: true }; refresh offline NÃO limpa a sessão', async () => {
  const rede = montar({ ranking: { ...RANKING }, roteiro: () => { throw new TypeError('Failed to fetch'); } });
  await assert.rejects(rede.cliente.token(), e => e.offline === true && !e.sessaoInvalida);
  assert.equal(rede.estado.ranking.refreshToken, 'rt');

  // timeout: o fetch nunca responde, mas respeita o AbortController
  const lento = montar({
    ranking: { ...RANKING }, timeoutMs: 20,
    roteiro: (url, init) => new Promise((_, rej) => init.signal.addEventListener('abort', () => rej(new DOMException('abortado', 'AbortError'))))
  });
  const t0 = Date.now();
  await assert.rejects(lento.cliente.token(), e => e.offline === true);
  assert.ok(Date.now() - t0 < 1000);
  assert.equal(lento.estado.ranking.refreshToken, 'rt');
});

test('rpc: POST com argumentos nomeados, Bearer e apikey; devolve o retorno', async () => {
  const { cliente, chamadas } = montar({
    ranking: { ...RANKING },
    roteiro: url => (url.includes('/auth/') ? resposta(200, sessao(1)) : resposta(200, 'FIT7K2'))
  });
  const codigo = await cliente.rpc('criar_grupo', { p_nome: 'Meninas', p_apelido: 'Bia', p_emoji: '🔥' });
  assert.equal(codigo, 'FIT7K2');
  const c = chamadas[1];
  assert.equal(c.url, `${URL_BASE}/rest/v1/rpc/criar_grupo`);
  assert.equal(c.init.method, 'POST');
  assert.deepEqual(c.corpo, { p_nome: 'Meninas', p_apelido: 'Bia', p_emoji: '🔥' });
  assert.equal(c.init.headers.Authorization, 'Bearer acesso1');
  assert.equal(c.init.headers.apikey, 'CHAVE');
});

test('erro de RPC: a mensagem do raise exception vira a mensagem do erro', async () => {
  const { cliente } = montar({
    ranking: { ...RANKING },
    roteiro: url => (url.includes('/auth/') ? resposta(200, sessao(1))
      : resposta(400, { code: 'P0001', message: 'Código não encontrado. Confira as letras.', details: null, hint: null }))
  });
  await assert.rejects(
    cliente.rpc('entrar_grupo', { p_codigo: 'ZZZZZZ', p_apelido: 'Bia', p_emoji: '💪' }),
    e => e instanceof ErroRanking && e.message === 'Código não encontrado. Confira as letras.' && !e.offline && !e.sessaoInvalida
  );
});

test('upsertDias: on_conflict e Prefer merge-duplicates; selecionar monta a query', async () => {
  const { cliente, chamadas } = montar({
    ranking: { ...RANKING },
    roteiro: (url, init) => {
      if (url.includes('/auth/')) return resposta(200, sessao(1));
      return init.method === 'POST' ? resposta(201) : resposta(200, [{ a: 1 }]);
    }
  });
  await cliente.upsertDias([{ user_id: 'u', data: '2026-10-03', treinos: 1, cardio_min: 0, km: 0, pontos: 10 }]);
  const up = chamadas[1];
  assert.equal(up.url, `${URL_BASE}/rest/v1/dias?on_conflict=user_id,data`);
  assert.equal(up.init.method, 'POST');
  assert.equal(up.init.headers.Prefer, 'resolution=merge-duplicates,return=minimal');
  assert.equal(up.corpo.length, 1);
  const linhas = await cliente.selecionar('membros', 'select=user_id,apelido');
  assert.deepEqual(linhas, [{ a: 1 }]);
  assert.equal(chamadas[2].url, `${URL_BASE}/rest/v1/membros?select=user_id,apelido`);
  assert.equal(chamadas[2].init.method, 'GET');
});

test('401 numa requisição: renova uma vez e repete; 401 de novo = sessão inválida', async () => {
  let rest = 0;
  const { cliente } = montar({
    ranking: { ...RANKING },
    roteiro: url => {
      if (url.includes('/auth/')) return resposta(200, sessao(1));
      rest++;
      return rest === 1 ? resposta(401, { message: 'JWT expired' }) : resposta(200, []);
    }
  });
  assert.deepEqual(await cliente.selecionar('dias'), []);
  assert.equal(rest, 2);

  const sempre = montar({
    ranking: { ...RANKING },
    roteiro: url => (url.includes('/auth/') ? resposta(200, sessao(1)) : resposta(401, { message: 'JWT expired' }))
  });
  await assert.rejects(sempre.cliente.selecionar('dias'), e => e.sessaoInvalida === true);
  assert.equal(sempre.estado.ranking.refreshToken, null);
});

test('selecionarTudo pagina até vir uma página incompleta', async () => {
  const paginas = [Array(500).fill({ x: 1 }), Array(500).fill({ x: 2 }), Array(7).fill({ x: 3 })];
  let i = 0;
  const { cliente, chamadas } = montar({
    ranking: { ...RANKING },
    roteiro: url => (url.includes('/auth/') ? resposta(200, sessao(1)) : resposta(200, paginas[i++]))
  });
  const todas = await cliente.selecionarTudo('dias', 'select=*&order=user_id');
  assert.equal(todas.length, 1007);
  assert.match(chamadas[1].url, /order=user_id&limit=500&offset=0$/);
  assert.match(chamadas[3].url, /offset=1000$/);
});

test('5xx do servidor é tratado como offline (silencioso)', async () => {
  const { cliente } = montar({
    ranking: { ...RANKING },
    roteiro: url => (url.includes('/auth/') ? resposta(200, sessao(1)) : resposta(503, { message: 'indisponível' }))
  });
  await assert.rejects(cliente.selecionar('dias'), e => e.offline === true);
});
