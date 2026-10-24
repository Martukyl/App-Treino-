// E2E do visual Blocos (v2.0): fontes locais, menu de vidro só nas 5 abas, transições que nunca
// deixam a tela invisível, treino com + e −, descanso em pílula e capturas 390×844 de todas as telas.
import { chromium } from 'playwright-core';

const BASE = process.env.BASE_URL || 'http://localhost:8080/';
const OUT = process.env.OUT || '.';
const res = [];
const ok = (nome, cond, extra = '') => { res.push([cond ? 'OK ' : 'FALHA', nome, extra]); };

// navegador: CDP_URL (Chrome já aberto com --remote-debugging-port) ou BROWSER_PATH (padrão: Edge no Windows)
const browser = process.env.CDP_URL
  ? await chromium.connectOverCDP(process.env.CDP_URL)
  : await chromium.launch({ executablePath: process.env.BROWSER_PATH || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
const page = await ctx.newPage();
const erros = [];
page.on('console', m => { if (m.type() === 'error' && !/tile|openstreetmap/i.test(m.text())) erros.push(m.text()); });
page.on('pageerror', e => erros.push(String(e)));

const espera = ms => page.waitForTimeout(ms);
const ir = async h => { await page.evaluate(x => { location.hash = x; }, h); await espera(700); };
const capturar = async arq => page.screenshot({ path: `${OUT}/${arq}.png` });
// opacidade de cada .tela dentro de #app (todas as que existirem)
const opacidades = () => page.evaluate(() => [...document.querySelectorAll('#app > .tela')].map(t => Number(getComputedStyle(t).opacity)));
const umaTelaVisivel = async nome => {
  const o = await opacidades();
  ok(nome, o.length === 1 && o[0] === 1, JSON.stringify(o));
};
const semMenu = () => page.evaluate(() => document.body.classList.contains('sem-menu') || document.body.classList.contains('boas-vindas'));

// ---------- boas-vindas ----------
await page.goto(BASE);
await page.evaluate(() => localStorage.clear());
await page.reload(); await espera(900);
ok('Boas-vindas: texto neutro', (await page.locator('.tela-boas-vindas').innerText()).includes('Boas-vindas ao Treino'));
ok('Boas-vindas: sem menu', await semMenu());
await capturar('v00-boas-vindas');
await page.fill('.tela-boas-vindas [data-campo="nome"]', 'Alex');
await page.check('input[name="programa"][value="padrao"]');
await page.click('[data-acao="comecar-app"]'); await espera(900);
ok('Boas-vindas concluídas', page.url().endsWith('#/hoje'));

// ---------- fontes ----------
const fontes = await page.evaluate(async () => {
  await document.fonts.ready;
  await Promise.all([document.fonts.load('600 24px Unbounded'), document.fonts.load('400 15px Figtree')]);
  return {
    corpo: getComputedStyle(document.body).fontFamily,
    titulo: getComputedStyle(document.querySelector('.titulo-tela')).fontFamily,
    unbounded: document.fonts.check('600 24px Unbounded'),
    figtree: document.fonts.check('400 15px Figtree')
  };
});
ok('Fonte do texto: Figtree', /^"?Figtree/.test(fontes.corpo), fontes.corpo);
ok('Fonte dos títulos: Unbounded', /^"?Unbounded/.test(fontes.titulo), fontes.titulo);
ok('Unbounded carregada', fontes.unbounded);
ok('Figtree carregada', fontes.figtree);

// ---------- Hoje e menu ----------
await umaTelaVisivel('Hoje: uma tela visível');
ok('Hoje: saudação com nome', (await page.locator('.hoje-cab').innerText()).includes('Alex'));
ok('Hoje: treino do dia com foto', await page.locator('[data-sec="treino-do-dia"] img[src*="treino-a.jpg"]').count() === 1);
ok('Menu de vidro visível na Hoje', !(await semMenu()) && await page.locator('.nav.vidro').count() === 1);
ok('Menu: Hoje ativo', await page.locator('.nav a.ativa[data-aba="hoje"]').count() === 1);
await capturar('v01-hoje');
for (const aba of ['corpo', 'exercicios', 'historico', 'ajustes']) {
  await page.click(`.nav a[data-aba="${aba}"]`); await espera(800);
  ok(`Menu leva a ${aba}`, page.url().endsWith(`#/${aba}`) && await page.locator(`.nav a.ativa[data-aba="${aba}"]`).count() === 1);
  await umaTelaVisivel(`${aba}: uma tela visível depois da transição`);
}
await ir('#/ranking');
ok('Ranking esconde o menu', await semMenu());

// trocas rápidas de rota e re-render no meio da transição (Foco 1)
for (const h of ['#/hoje', '#/corpo', '#/exercicios', '#/historico', '#/ajustes']) await page.evaluate(x => { location.hash = x; }, h);
await espera(150);
await page.evaluate(async () => (await import('./js/estado.js')).atualizar(() => {}));
await espera(1000);
await umaTelaVisivel('Trocas rápidas + re-render: uma tela visível');
ok('Trocas rápidas: terminou em Ajustes', page.url().endsWith('#/ajustes'));

// topo de vidro ao rolar
await ir('#/exercicios');
await page.mouse.wheel(0, 700); await espera(500);
ok('Topo de vidro aparece ao rolar', await page.locator('#topo-vidro.on').count() === 1);

// ---------- treino ----------
await ir('#/hoje');
await page.click('[data-sec="treino-do-dia"] [data-acao="comecar"]'); await espera(900);
ok('Treino abriu sem menu', page.url().endsWith('#/treino') && await semMenu());
const valor = c => page.locator(`.passo-valor[data-campo="${c}"]`).innerText();
for (let k = 0; k < 4; k++) await page.click('[data-acao="carga"][data-d="1"]');
ok('Treino: + soma o incremento (4 × 2,5 = 10 kg)', (await valor('carga')).replace(/\s/g, '').startsWith('10'), await valor('carga'));
await page.click('[data-acao="reps"][data-d="-1"]');
ok('Treino: − nas repetições', (await valor('reps')).trim() === '11');
await page.click('.passo-valor[data-campo="carga"]'); await page.fill('.passo-campo', '40'); await page.press('.passo-campo', 'Enter'); await espera(200);
ok('Treino: digitar a carga', (await valor('carga')).replace(/\s/g, '').startsWith('40'));
await page.click('[data-acao="feita"]'); await espera(700);
ok('Treino: série marcada', (await page.locator('.etapa').first().innerText()).includes('40 × 11'));
ok('Descanso: pílula aparece', await page.locator('#cronometro.on').count() === 1);
await capturar('v02-treino');
const nome1 = await page.locator('.exercicio .ex-nome').innerText();
await page.reload(); await espera(1300);
ok('Treino: recarregar volta ao mesmo exercício', (await page.locator('.exercicio .ex-nome').innerText()) === nome1);
const series = await page.locator('.etapa:not(.f)').count();
for (let k = 0; k < series; k++) { await page.click('[data-acao="feita"]'); await espera(250); }
await espera(1300);
ok('Treino: exercício concluído troca para o próximo', (await page.locator('.cartao-topo').innerText()).includes('Exercício 2 de'));
await page.click('#cronometro [data-cron="pular"]'); await espera(500);
ok('Descanso: pular esconde', await page.locator('#cronometro.on').count() === 0);
await page.click('[data-acao="finalizar"]'); await espera(400);
if (await page.locator('#sheet [data-acao="ok"]').count()) { await page.click('#sheet [data-acao="ok"]'); await espera(1500); }
ok('Resumo do treino', page.url().includes('#/resumo/') && (await page.locator('.tela-resumo').innerText()).includes('Treino concluído'));
await capturar('v03-resumo');

// ---------- abrir direto numa rota interna (Foco 5) ----------
for (const h of ['#/treino', '#/ranking']) {
  await page.goto(BASE + h); await espera(1200);
  await umaTelaVisivel(`Abrir direto ${h}: uma tela visível`);
  ok(`Abrir direto ${h}: sem menu`, await semMenu());
}

// ---------- capturas das demais telas ----------
const telas = [['v04-ranking', '#/ranking'], ['v05-corpo', '#/corpo'], ['v06-registro', '#/corpo/registro/novo'],
  ['v08-exercicios', '#/exercicios'], ['v09-exercicio', '#/exercicio/elevacao_pelvica'], ['v10-aparelho', '#/cardio/aparelho/novo'],
  ['v11-historico', '#/historico'], ['v14-gps', '#/cardio/gps'], ['v15-ajustes', '#/ajustes'], ['v16-editor', '#/ajustes/treino/A']];
for (const [arq, h] of telas) {
  await ir(h);
  const sobra = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  ok(`Sem rolagem horizontal ${h}`, sobra <= 0, String(sobra));
  await capturar(arq);
}

ok('Sem erros de console', erros.length === 0, erros.join(' | '));
for (const r of res) console.log(r.join('  '));
console.log(`\n${res.filter(r => r[0] === 'OK ').length}/${res.length} OK`);
await browser.close();
