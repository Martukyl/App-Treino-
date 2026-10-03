// E2E do ranking com Supabase REAL: 2 navegadores (Ana e Bia).
import { chromium } from 'playwright-core';

const BASE = 'http://localhost:8080/';
const OUT = process.env.OUT || '.';
const res = [];
const ok = (n, c, x = '') => res.push([c ? 'OK ' : 'FALHA', n, x]);
const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
const erros = [];

async function nova(nome) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
  await ctx.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: BASE });
  const p = await ctx.newPage();
  p.on('console', m => { if (m.type() === 'error') erros.push(`${nome}: ${m.text()}`); });
  p.on('pageerror', e => erros.push(`${nome}: ${e}`));
  await p.goto(BASE);
  await p.check('input[name="programa"][value="padrao"]');
  await p.fill('.tela-boas-vindas [data-campo="nome"]', nome);
  await p.click('[data-acao="comecar-app"]');
  await p.waitForTimeout(400);
  return p;
}
const ir = async (p, h) => { await p.evaluate(x => { location.hash = x; }, h); await p.waitForTimeout(400); };
const estado = p => p.evaluate(() => JSON.parse(localStorage.getItem('appTreino.v1')));

const ana = await nova('Ana'), bia = await nova('Bia');

// ---------- Ana cria grupo ----------
await ir(ana, '#/ajustes');
await ana.click('[data-sec="grupo"] [data-acao="criar-grupo"]');
await ana.fill('#sheet [data-campo="nome"]', 'Amigas Fit');
await ana.fill('#sheet [data-campo="apelido"]', 'Ana');
await ana.click('#sheet [data-emoji="🔥"]');
await ana.click('#sheet [data-acao="enviar"]');
await ana.waitForSelector('[data-campo="codigo-grupo"]', { timeout: 15000 }).catch(() => {});
const codigo = (await ana.locator('[data-campo="codigo-grupo"]').innerText().catch(() => '')).trim();
ok('Ana criou grupo (código real)', /^[A-HJ-NP-Z2-9]{6}$/.test(codigo), codigo);
const eA = await estado(ana);
ok('Estado da Ana com sessão e criadora', !!eA.ranking?.userId && !!eA.ranking?.refreshToken && eA.ranking.criador === true);
await ana.screenshot({ path: `${OUT}/r1-grupo-ana.png`, fullPage: true });

// ---------- Bia entra ----------
await ir(bia, '#/ajustes');
await bia.click('[data-sec="grupo"] [data-acao="entrar-grupo"]');
await bia.fill('#sheet [data-campo="codigo"]', codigo.toLowerCase());
await bia.fill('#sheet [data-campo="apelido"]', 'Bia');
await bia.click('#sheet [data-acao="enviar"]');
await bia.waitForSelector('[data-campo="nome-grupo"]', { timeout: 15000 }).catch(() => {});
ok('Bia entrou no grupo', (await bia.locator('[data-campo="nome-grupo"]').innerText().catch(() => '')).includes('Amigas Fit'));

// ---------- Ana registra cardio (bicicleta 30 min = 6 pts) ----------
await ir(ana, '#/cardio/aparelho/novo');
await ana.click('[data-acao="tipo"][data-tipo="bicicleta"]');
await ana.fill('[data-campo="duracao"]', '30');
await ana.click('[data-acao="salvar"]');
await ana.waitForTimeout(5000); // debounce 3 s + envio

// ---------- Bia faz um treino (10 pts) ----------
await ir(bia, '#/hoje');
await bia.click('.card-destaque [data-acao="comecar"]'); await bia.waitForTimeout(400);
await bia.fill('.exercicio[data-i="0"] .serie[data-s="0"] .carga', '20');
await bia.click('.exercicio[data-i="0"] .serie[data-s="0"] [data-acao="feita"]'); await bia.waitForTimeout(200);
await bia.keyboard.press('Escape');
await bia.click('[data-acao="finalizar"]'); await bia.waitForTimeout(300);
if (await bia.locator('#sheet [data-acao="ok"]').count()) await bia.click('#sheet [data-acao="ok"]');
await bia.waitForTimeout(5000);

// ---------- Bia vê o ranking com a Ana ----------
await ir(bia, '#/ranking');
await bia.click('[data-acao="atualizar-ranking"]').catch(() => {});
await bia.waitForTimeout(3000);
const lista = await bia.locator('[data-campo="ranking-lista"]').innerText().catch(() => '');
ok('Ranking da Bia: Bia 10 em 1º, Ana 6', /Bia[\s\S]*10[\s\S]*Ana[\s\S]*6/.test(lista), lista.replace(/\n/g, ' | '));
await bia.screenshot({ path: `${OUT}/r2-ranking-bia.png`, fullPage: true });

// ---------- Ana vê na Hoje ----------
await ir(ana, '#/hoje');
await ana.waitForTimeout(3500);
const cardHoje = await ana.locator('[data-sec="ranking-semana"]').innerText().catch(() => '');
ok('Hoje da Ana: card ranking com Bia e posição', /Bia/.test(cardHoje) && /2º/.test(cardHoje), cardHoje.replace(/\n/g, ' | '));
await ana.locator('[data-sec="ranking-semana"]').screenshot({ path: `${OUT}/r3-hoje-ana.png` }).catch(() => {});

// ---------- card 5 ----------
await ir(bia, '#/ranking');
await bia.waitForTimeout(1500);
const [dl] = await Promise.all([bia.waitForEvent('download', { timeout: 15000 }).catch(() => null), (async () => {
  await bia.evaluate(() => { try { Object.defineProperty(navigator, 'canShare', { value: undefined, configurable: true }); } catch {} });
  await bia.click('[data-acao="compartilhar-ranking"]');
  await bia.waitForSelector('#sheet [data-acao="enviar"]:not([disabled])', { timeout: 15000 });
  await bia.click('#sheet [data-acao="enviar"]');
})()]);
if (dl) await dl.saveAs(`${OUT}/r4-card-ranking.png`);
ok('Card do ranking gerado', !!dl);

// ---------- Bia sai; Ana sai (limpa o grupo de teste) ----------
for (const [p, n] of [[bia, 'Bia'], [ana, 'Ana']]) {
  await ir(p, '#/ajustes');
  await p.click('[data-sec="grupo"] [data-acao="sair-grupo"]');
  await p.click('#sheet [data-acao="ok"]');
  await p.waitForTimeout(2500);
  ok(`${n} saiu do grupo`, !(await estado(p)).ranking?.grupo);
}
ok('Sem erros de console', erros.length === 0, erros.join(' | '));
for (const r of res) console.log(r.join('  '));
console.log(`\n${res.filter(r => r[0] === 'OK ').length}/${res.length} OK`);
await browser.close();
