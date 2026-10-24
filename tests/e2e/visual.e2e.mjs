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

// ---------- correções da revisão final ----------
await ir('#/hoje');
// a tela antiga não pode saltar ao sair (mantém a posição durante o fade)
const antes = await page.evaluate(() => { const r = document.querySelector('#app > .tela').getBoundingClientRect(); return [r.left, r.top, r.width]; });
const saindo = await page.evaluate(() => new Promise(fim => {
  location.hash = '#/corpo';
  setTimeout(() => { const t = document.querySelector('#app > .tela.saindo'); if (!t) return fim(null); const r = t.getBoundingClientRect(); fim([r.left, r.top, r.width]); }, 30);
}));
ok('Tela antiga não salta ao sair', !!saindo && saindo.every((v, i) => Math.abs(v - antes[i]) < 1.5), `${JSON.stringify(antes)} → ${JSON.stringify(saindo)}`);
await espera(700);
await ir('#/hoje');
await page.click('[data-sec="treino-do-dia"] [data-acao="comecar"]'); await espera(900);
// digitar e tocar direto em "Série feita" (sem Enter): a série tem de ser marcada
await page.click('.passo-valor[data-campo="carga"]'); await page.fill('.passo-campo', '30');
await page.click('.exercicio [data-acao="feita"]'); await espera(600);
ok('Digitar e tocar em Série feita (sem Enter) marca a série', await page.locator('.etapa.f').count() === 1 && (await page.locator('.etapa.f').first().innerText()).includes('30'));
ok('… e começa o descanso', await page.locator('#cronometro.on').count() === 1);
// digitar e tocar em + (sem Enter): o + vale sobre o valor digitado
await page.click('.passo-valor[data-campo="reps"]'); await page.fill('.passo-campo', '9');
await page.click('[data-acao="reps"][data-d="1"]'); await espera(300);
ok('Digitar e tocar em + (sem Enter) soma sobre o digitado', (await page.locator('.passo-valor[data-campo="reps"]').innerText()).trim() === '10', await page.locator('.passo-valor[data-campo="reps"]').innerText());
// alvos de toque do cartão do treino ≥ 44 px
const pequenos = await page.evaluate(() => [...document.querySelectorAll('.tela-treino button, .tela-treino a, #cronometro button')]
  .filter(b => b.offsetParent).map(b => { const r = b.getBoundingClientRect(); return [b.dataset.acao || b.dataset.cron || b.className, Math.round(r.width), Math.round(r.height)]; })
  .filter(([, w, h]) => w < 44 || h < 44));
ok('Treino: alvos de toque ≥ 44 px', pequenos.length === 0, JSON.stringify(pequenos));
// com descanso ativo, o menu da Hoje continua tocável
await ir('#/hoje');
const noMenu = await page.evaluate(() => { const r = document.querySelector('.nav').getBoundingClientRect(); const el = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return !!el && !!el.closest('.nav'); });
ok('Descanso ativo não cobre o menu', noMenu);
await capturar('v17-hoje-descanso');
// contraste do texto secundário sobre os blocos coloridos ≥ 4,5:1
const contraste = await page.evaluate(() => {
  const rgb = s => s.match(/[\d.]+/g).slice(0, 4).map(Number);
  const lum = ([r, g, b]) => [r, g, b].map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }).reduce((a, v, i) => a + v * [0.2126, 0.7152, 0.0722][i], 0);
  const fundo = el => { for (let e = el; e; e = e.parentElement) { const c = rgb(getComputedStyle(e).backgroundColor); if (c.length < 4 || c[3] > 0.9) return c; } return [255, 255, 255]; };
  return [...document.querySelectorAll('.bloco-sage .rotulo, .bloco-sky .rotulo, .bloco-sand .rotulo, .bloco-clay .rotulo, .bloco-sage .dif-boa, .bloco-sand .dif-boa')]
    .filter(e => e.offsetParent && e.textContent.trim())
    .map(e => { const a = lum(rgb(getComputedStyle(e).color)), b = lum(fundo(e)); return [e.textContent.trim().slice(0, 20), +((Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)).toFixed(2)]; })
    .filter(([, c]) => c < 4.5);
});
ok('Contraste do texto secundário nos blocos ≥ 4,5', contraste.length === 0, JSON.stringify(contraste));
await page.evaluate(() => { location.hash = '#/treino'; }); await espera(700);
await page.click('[data-acao="menu"]'); await espera(400); await page.click('#sheet [data-acao="descartar"]'); await espera(500);
if (await page.locator('#sheet [data-acao="ok"]').count()) { await page.click('#sheet [data-acao="ok"]'); await espera(600); }

// resumo do perfil no Corpo continua completo depois de editar um campo
await ir('#/corpo');
await page.click('[data-sec="perfil"] summary'); await espera(200);
await page.fill('[data-campo="altura"]', '170'); await page.press('[data-campo="altura"]', 'Tab'); await espera(200);
ok('Perfil: resumo mantém a altura depois de editar', (await page.locator('[data-derivado="perfil"]').innerText()).includes('1,70 m'), await page.locator('[data-derivado="perfil"]').innerText());

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
