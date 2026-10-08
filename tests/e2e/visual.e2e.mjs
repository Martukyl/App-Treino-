// E2E do visual cinza aço + cobre (v1.5.0): topo em degradê + folha em todas as telas,
// fonte Outfit, caixas de digitar em cobre e capturas 390×844 para conferência. Edge real.
import { chromium } from 'playwright-core';

const BASE = 'http://localhost:8080/';
const OUT = process.env.OUT || '.';
const res = [];
const ok = (nome, cond, extra = '') => { res.push([cond ? 'OK ' : 'FALHA', nome, extra]); };

const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
const page = await ctx.newPage();
const erros = [];
page.on('console', m => { if (m.type() === 'error') erros.push(m.text()); });
page.on('pageerror', e => erros.push(String(e)));

const ir = async h => { await page.evaluate(x => { location.hash = x; }, h); await page.waitForTimeout(300); };

// topo: existe, encosta no alto da página e contém o título da tela
async function conferirTopo(nome) {
  const info = await page.evaluate(() => {
    const t = document.querySelector('#app .topo');
    if (!t) return null;
    return {
      topo: Math.round(t.getBoundingClientRect().top + window.scrollY),
      titulo: !!t.querySelector('.titulo, .treino-nome'),
      fundo: getComputedStyle(t).backgroundImage
    };
  });
  ok(`${nome}: tem .topo`, !!info);
  if (!info) return;
  ok(`${nome}: topo no alto da página`, info.topo <= 1, `top=${info.topo}`);
  ok(`${nome}: título dentro do topo`, info.titulo);
  ok(`${nome}: topo em degradê`, info.fundo.includes('gradient'));
}
async function capturar(arq) { await page.screenshot({ path: `${OUT}/${arq}.png` }); }

await page.goto(BASE);
await page.evaluate(() => localStorage.clear());
await page.reload(); await page.waitForTimeout(600);
await conferirTopo('Boas-vindas');
await capturar('v00-boas-vindas');
await page.fill('[data-campo="nome"]', 'Maria');
await page.check('input[name="programa"][value="padrao"]'); await page.click('[data-acao="comecar-app"]'); await page.waitForTimeout(500);
ok('Boas-vindas concluídas', page.url().endsWith('#/hoje'));

// ---------- fonte ----------
const fonte = await page.evaluate(async () => {
  await document.fonts.ready;
  return { familia: getComputedStyle(document.body).fontFamily, carregada: document.fonts.check('16px Outfit') };
});
ok('Fonte Outfit no body', /^"?Outfit/.test(fonte.familia), fonte.familia);
ok('Fonte Outfit carregada', fonte.carregada);

// ---------- Hoje ----------
await conferirTopo('Hoje');
ok('Hoje: semana dentro do topo', await page.locator('.topo [data-sec="semana"]').count() === 1);
ok('Hoje: 7 dias no topo', await page.locator('.topo .semana-dia').count() === 7);
ok('Hoje: compartilhar semana no topo', await page.locator('.topo [data-acao="compartilhar-semana"]').count() === 1);
ok('Hoje: saudação com nome', (await page.locator('.hoje-cab').innerText()).includes('Maria'));
ok('Hoje: avatar leva ao perfil', await page.locator('.topo .avatar-link[href="#/corpo"]').count() === 1);
const raioBtn = await page.locator('.card-destaque .btn-principal').evaluate(b => parseFloat(getComputedStyle(b).borderTopLeftRadius));
ok('Botão principal em pílula', raioBtn >= 24, `raio=${raioBtn}`);
await capturar('v01-hoje');
await page.screenshot({ path: `${OUT}/v01b-hoje-inteira.png`, fullPage: true });

// compartilhar semana: prévia do card (canvas) no sheet
await page.click('.topo [data-acao="compartilhar-semana"]'); await page.waitForTimeout(1200);
ok('Compartilhar: prévia aberta', await page.locator('#sheet .previa img').count() === 1);
await capturar('v02-card-semana');
await page.keyboard.press('Escape'); await page.evaluate(() => document.getElementById('sheet-fundo')?.click()); await page.waitForTimeout(300);

// ---------- Treino ----------
await page.click('.card-destaque [data-acao="comecar"]'); await page.waitForTimeout(500);
await conferirTopo('Treino');
ok('Treino: barra de progresso no topo', await page.locator('.topo .barra-progresso').count() === 1);
const caixa = await page.locator('.tela-treino input.carga').first().evaluate(i => getComputedStyle(i).backgroundImage);
ok('Treino: caixa de kg em degradê (cobre)', caixa.includes('gradient'), caixa.slice(0, 60));
await page.fill('.tela-treino input.carga >> nth=0', '20');
await page.click('.tela-treino [data-acao="feita"] >> nth=0'); await page.waitForTimeout(400);
const largura = await page.locator('.topo .barra-progresso b').evaluate(b => b.getBoundingClientRect().width);
ok('Treino: barra avança após série feita', largura > 0, `largura=${largura}`);
await capturar('v03-treino');
await page.click('.topo [data-acao="menu"]'); await page.waitForTimeout(300);
ok('Treino: menu ⋯ abre o sheet', await page.locator('#sheet:not([hidden])').count() === 1);
await capturar('v04-treino-menu');
await page.evaluate(() => document.getElementById('sheet-fundo')?.click()); await page.waitForTimeout(300);

// ---------- demais telas ----------
const telas = [
  ['#/corpo', 'Corpo', 'v05-corpo'],
  ['#/corpo/registro/novo', 'Registro', 'v06-registro'],
  ['#/exercicios', 'Exercícios', 'v07-exercicios'],
  ['#/historico', 'Histórico', 'v08-historico'],
  ['#/ajustes', 'Ajustes', 'v09-ajustes'],
  ['#/ranking', 'Ranking', 'v10-ranking'],
  ['#/cardio/gps', 'Cardio GPS', 'v11-cardio-gps'],
  ['#/cardio/aparelho/novo', 'Cardio aparelho', 'v12-cardio-aparelho'],
  ['#/ajustes/treino/A', 'Editar treino', 'v13-editar-treino']
];
for (const [hash, nome, arq] of telas) {
  await ir(hash);
  await conferirTopo(nome);
  await capturar(arq);
}
const campoCorpo = await page.evaluate(() => {
  location.hash = '#/corpo/registro/novo';
  return new Promise(r => setTimeout(() => {
    const i = document.querySelector('.tela-registro input[data-campo="peso"]');
    r(i ? getComputedStyle(i).backgroundImage : '');
  }, 300));
});
ok('Corpo: caixa de digitar em degradê (cobre)', campoCorpo.includes('gradient'));

ok('Sem erros no console', erros.length === 0, erros.join(' | ').slice(0, 300));
await browser.close();

for (const [s, n, x] of res) console.log(s, n, x);
const falhas = res.filter(r => r[0] === 'FALHA').length;
console.log(`\n${res.length - falhas}/${res.length} OK`);
process.exit(falhas ? 1 : 0);
