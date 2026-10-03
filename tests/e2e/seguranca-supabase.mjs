// Teste de segurança do ranking contra o Supabase REAL, com 3 usuários anônimos (A, B, C)
// e um cliente sem login. Uso: SUPA_URL=... SUPA_KEY=... node seguranca.mjs
const URL_ = process.env.SUPA_URL, KEY = process.env.SUPA_KEY;
if (!URL_ || !KEY) { console.log('defina SUPA_URL e SUPA_KEY'); process.exit(1); }
const res = [];
const ok = (n, c, x = '') => res.push([c ? 'OK ' : 'FALHA', n, x]);

async function req(metodo, caminho, { token, body, prefer } = {}) {
  const h = { apikey: KEY, 'Content-Type': 'application/json' };
  if (token) h.Authorization = `Bearer ${token}`;
  if (prefer) h.Prefer = prefer;
  const r = await fetch(URL_ + caminho, { method: metodo, headers: h, body: body === undefined ? undefined : JSON.stringify(body) });
  let dados = null; try { dados = await r.json(); } catch {}
  return { status: r.status, dados };
}
async function anonimo() {
  const r = await req('POST', '/auth/v1/signup', { body: {} });
  if (!r.dados?.access_token) throw new Error('signup anônimo falhou: ' + JSON.stringify(r));
  return { token: r.dados.access_token, id: r.dados.user.id };
}
const rpc = (u, nome, args) => req('POST', `/rest/v1/rpc/${nome}`, { token: u?.token, body: args });
const hoje = new Date().toISOString().slice(0, 10);
const dia = (d) => new Date(Date.now() + d * 864e5).toISOString().slice(0, 10);
const linha = (uid, data, pontos = 10) => ({ user_id: uid, data, treinos: 1, cardio_min: 30, km: 2.5, pontos });

const A = await anonimo(), B = await anonimo(), C = await anonimo();

// --- sem login ---
for (const t of ['grupos', 'membros', 'dias']) {
  const r = await req('GET', `/rest/v1/${t}?select=*`);
  ok(`Sem login: não lê ${t}`, r.status >= 400 || (Array.isArray(r.dados) && r.dados.length === 0), `${r.status}`);
}
const rSemLogin = await rpc(null, 'criar_grupo', { p_nome: 'x', p_apelido: 'x', p_emoji: '💪' });
ok('Sem login: não cria grupo', rSemLogin.status >= 400, String(rSemLogin.status));

// --- A cria grupo ---
const rc = await rpc(A, 'criar_grupo', { p_nome: 'Teste <b>seg</b>', p_apelido: 'Ana', p_emoji: '🔥' });
const codigo = rc.dados;
ok('A cria grupo (código válido)', rc.status === 200 && /^[A-HJ-NP-Z2-9]{6}$/.test(codigo), JSON.stringify(rc.dados));
const rc2 = await rpc(A, 'criar_grupo', { p_nome: 'Outro', p_apelido: 'Ana', p_emoji: '🔥' });
ok('A não cria 2º grupo', rc2.status >= 400, rc2.dados?.message);
ok('Escrita direta em grupos bloqueada', (await req('POST', '/rest/v1/grupos', { token: C.token, body: { codigo: 'ABCDEF', nome: 'x', criado_por: C.id } })).status >= 400);
ok('Inserir membro direto bloqueado', (await req('POST', '/rest/v1/membros', { token: C.token, body: { user_id: C.id, grupo: codigo, apelido: 'intrusa' } })).status >= 400);

// --- B entra ---
const re = await rpc(B, 'entrar_grupo', { p_codigo: ` ${codigo.toLowerCase()} `, p_apelido: 'Bia', p_emoji: '🌸' });
ok('B entra com código (normaliza espaços/minúsculas)', re.status === 200, JSON.stringify(re.dados));
const reX = await rpc(C, 'entrar_grupo', { p_codigo: 'ZZZZZZ', p_apelido: 'Cris', p_emoji: '💪' });
ok('Código inexistente: erro em português', reX.status >= 400 && /não encontrado/i.test(reX.dados?.message || ''), reX.dados?.message);
const reL = await rpc(C, 'entrar_grupo', { p_codigo: codigo, p_apelido: 'x'.repeat(21), p_emoji: '💪' });
ok('Apelido longo recusado', reL.status >= 400, reL.dados?.message);

// --- dias ---
ok('A grava o próprio dia', (await req('POST', '/rest/v1/dias?on_conflict=user_id,data', { token: A.token, body: [linha(A.id, hoje)], prefer: 'resolution=merge-duplicates,return=minimal' })).status < 300);
ok('B grava o próprio dia', (await req('POST', '/rest/v1/dias?on_conflict=user_id,data', { token: B.token, body: [linha(B.id, hoje, 5)], prefer: 'resolution=merge-duplicates,return=minimal' })).status < 300);
ok('Upsert (atualizar) do próprio dia', (await req('POST', '/rest/v1/dias?on_conflict=user_id,data', { token: A.token, body: [linha(A.id, hoje, 12)], prefer: 'resolution=merge-duplicates,return=minimal' })).status < 300);
ok('C NÃO grava dia da A', (await req('POST', '/rest/v1/dias?on_conflict=user_id,data', { token: C.token, body: [linha(A.id, hoje, 22)], prefer: 'resolution=merge-duplicates,return=minimal' })).status >= 400);
const rpat = await req('PATCH', `/rest/v1/dias?user_id=eq.${A.id}`, { token: B.token, body: { pontos: 22 }, prefer: 'return=representation' });
ok('B NÃO altera dia da A (PATCH)', rpat.status >= 400 || (Array.isArray(rpat.dados) && rpat.dados.length === 0), `${rpat.status}`);
ok('Dia fora da janela (−90) recusado', (await req('POST', '/rest/v1/dias', { token: A.token, body: [linha(A.id, dia(-90))] })).status >= 400);
ok('Dia no futuro (+5) recusado', (await req('POST', '/rest/v1/dias', { token: A.token, body: [linha(A.id, dia(5))] })).status >= 400);
ok('Pontos acima de 22 recusados', (await req('POST', '/rest/v1/dias?on_conflict=user_id,data', { token: A.token, body: [{ ...linha(A.id, hoje), pontos: 999 }], prefer: 'resolution=merge-duplicates' })).status >= 400);
ok('DELETE em dias bloqueado', (await req('DELETE', `/rest/v1/dias?user_id=eq.${A.id}`, { token: A.token })).status >= 400);

// --- leitura ---
const lA = await req('GET', '/rest/v1/dias?select=user_id,pontos', { token: A.token });
ok('A vê dias da A e da B', Array.isArray(lA.dados) && new Set(lA.dados.map(x => x.user_id)).size === 2 && lA.dados.find(x => x.user_id === A.id)?.pontos === 12, JSON.stringify(lA.dados));
const lC = await req('GET', '/rest/v1/dias?select=*', { token: C.token });
ok('C (fora) não vê dias de ninguém', Array.isArray(lC.dados) && lC.dados.length === 0, JSON.stringify(lC.dados));
const mC = await req('GET', '/rest/v1/membros?select=*', { token: C.token });
ok('C não vê membros', Array.isArray(mC.dados) && mC.dados.length === 0);
const gC = await req('GET', '/rest/v1/grupos?select=*', { token: C.token });
ok('C não lista grupos (sem enumerar códigos)', Array.isArray(gC.dados) && gC.dados.length === 0);
const mB = await req('GET', '/rest/v1/membros?select=apelido', { token: B.token });
ok('B vê os 2 membros', Array.isArray(mB.dados) && mB.dados.length === 2);

// --- membros: só apelido/emoji próprios ---
const pB = await req('PATCH', `/rest/v1/membros?user_id=eq.${A.id}`, { token: B.token, body: { apelido: 'hackeada' }, prefer: 'return=representation' });
ok('B NÃO muda apelido da A', pB.status >= 400 || (Array.isArray(pB.dados) && pB.dados.length === 0), `${pB.status}`);
ok('B NÃO troca a própria coluna grupo', (await req('PATCH', `/rest/v1/membros?user_id=eq.${B.id}`, { token: B.token, body: { grupo: 'ABCDEF' } })).status >= 400);
const pB2 = await req('PATCH', `/rest/v1/membros?user_id=eq.${B.id}`, { token: B.token, body: { apelido: 'Bia 2', emoji: '⭐' }, prefer: 'return=representation' });
ok('B muda o próprio apelido/emoji', pB2.status < 300 && pB2.dados?.[0]?.apelido === 'Bia 2', `${pB2.status}`);

// --- remover membro ---
const rmB = await rpc(B, 'remover_membro', { p_user: A.id });
ok('B (não criadora) NÃO remove A', rmB.status >= 400, rmB.dados?.message);
const rmC = await rpc(A, 'remover_membro', { p_user: C.id });
ok('A não remove quem não é do grupo', rmC.status >= 400, rmC.dados?.message);
const rmA = await rpc(A, 'remover_membro', { p_user: B.id });
ok('A (criadora) remove B', rmA.status < 300, JSON.stringify(rmA.dados));
const lB = await req('GET', '/rest/v1/dias?select=*', { token: B.token });
ok('B removida só vê os próprios dias', Array.isArray(lB.dados) && lB.dados.every(x => x.user_id === B.id));

// --- sair: coroa passa ---
await rpc(B, 'entrar_grupo', { p_codigo: codigo, p_apelido: 'Bia', p_emoji: '🌸' });
await rpc(C, 'entrar_grupo', { p_codigo: codigo, p_apelido: 'Cris', p_emoji: '💪' });
ok('A sai do grupo', (await rpc(A, 'sair_grupo', {})).status < 300);
const gB = await req('GET', '/rest/v1/grupos?select=criado_por', { token: B.token });
ok('Coroa passou para B (entrou antes de C)', gB.dados?.[0]?.criado_por === B.id, JSON.stringify(gB.dados));
await rpc(B, 'sair_grupo', {}); await rpc(C, 'sair_grupo', {});
const gA = await rpc(A, 'entrar_grupo', { p_codigo: codigo, p_apelido: 'Ana', p_emoji: '🔥' });
ok('Grupo vazio foi apagado', gA.status >= 400 && /não encontrado/i.test(gA.dados?.message || ''), gA.dados?.message);

for (const r of res) console.log(r.join('  '));
console.log(`\n${res.filter(r => r[0] === 'OK ').length}/${res.length} OK`);
