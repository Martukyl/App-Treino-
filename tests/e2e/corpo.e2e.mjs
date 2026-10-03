// E2E da aba Corpo (v1.1.0) + regressão do fluxo de treino. Edge real via playwright-core.
import { chromium } from 'playwright-core';
import fs from 'node:fs';

const BASE = 'http://localhost:8080/';
const IMG = 'C:/Claude/App Treino/img/';
const OUT = process.env.OUT || '.';
const res = [];
const ok = (nome, cond, extra = '') => { res.push([cond ? 'OK ' : 'FALHA', nome, extra]); };

const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, acceptDownloads: true, serviceWorkers: 'block' });
const page = await ctx.newPage();
const erros = [];
page.on('console', m => { if (m.type() === 'error') erros.push(m.text()); });
page.on('pageerror', e => erros.push(String(e)));

const ir = async h => { await page.evaluate(x => { location.hash = x; }, h); await page.waitForTimeout(250); };
const nFotos = () => page.evaluate(() => new Promise(r => {
  const q = indexedDB.open('appTreino-fotos');
  q.onsuccess = () => { const t = q.result.transaction('fotos').objectStore('fotos').getAllKeys(); t.onsuccess = () => { r(t.result.length); q.result.close(); }; };
  q.onerror = () => r(-1);
}));
const estado = () => page.evaluate(() => JSON.parse(localStorage.getItem('appTreino.v1')));
const sheetOk = async () => { await page.click('#sheet [data-acao="ok"]'); await page.waitForTimeout(200); };
const preencher = async (campos) => { for (const [k, v] of Object.entries(campos)) await page.fill(`.tela-registro [data-campo="${k}"]`, v); };
const foto = async (pos, arq) => { await page.setInputFiles(`.foto-slot[data-pos="${pos}"] input[type=file]`, IMG + arq); await page.waitForSelector(`.foto-slot[data-pos="${pos}"] .foto-mini img[src^="blob:"]`, { timeout: 8000 }); };

await page.goto(BASE);
await page.evaluate(() => localStorage.clear());
await page.reload(); await page.waitForTimeout(500);
await page.check('input[name="programa"][value="padrao"]'); await page.click('[data-acao="comecar-app"]'); await page.waitForTimeout(400); ok('Boas-vindas concluídas', page.url().endsWith('#/hoje'));

// ---------- Hoje ----------
ok('Hoje: faixa de foto do treino A', await page.locator('.treino-foto img[src*="treino-a.jpg"]').count() === 1);
const imgOk = await page.locator('.treino-foto img').evaluate(i => i.complete && i.naturalWidth > 0);
ok('Hoje: foto carregou', imgOk);
ok('Hoje: avatar sem nome = 🙂', (await page.locator('.avatar').innerText()).includes('🙂'));
await page.screenshot({ path: `${OUT}/01-hoje.png`, fullPage: true });

// ---------- Perfil ----------
await page.click('.avatar-link'); await page.waitForTimeout(250);
ok('Avatar leva a #/corpo', page.url().endsWith('#/corpo'));
await page.fill('[data-campo="nome"]', 'Maria');
await page.fill('[data-campo="altura"]', '165'); await page.press('[data-campo="altura"]', 'Tab');
await page.fill('[data-campo="metaPeso"]', '62'); await page.press('[data-campo="metaPeso"]', 'Tab');
await page.fill('[data-campo="nascimento"]', '1990-10-04'); await page.dispatchEvent('[data-campo="nascimento"]', 'change');
await page.waitForTimeout(200);
let e = await estado();
ok('Perfil salvo', e.nome === 'Maria' && e.perfil.altura === 165 && e.perfil.metaPeso === 62 && e.perfil.nascimento === '1990-10-04', JSON.stringify(e.perfil));
await page.setInputFiles('[data-campo="arquivo-perfil"]', IMG + 'treino-d.jpg');
await page.waitForTimeout(1500);
e = await estado();
ok('Foto de perfil salva', !!e.perfil.fotoId && await nFotos() === 1);

// ---------- Registro 1 ----------
await ir('#/corpo/registro/novo');
await page.fill('.tela-registro [data-campo="data"]', '2026-09-01');
await preencher({ peso: '58,4', cintura: '70', coxaD: '54', quadril: '96' });
await foto('frente', 'treino-a.jpg'); await foto('lado', 'treino-b.jpg');
await page.click('[data-acao="salvar"]'); await page.waitForTimeout(400);
ok('Registro 1 salvo', (await estado()).medidas.length === 1 && page.url().endsWith('#/corpo'));

// ---------- Registro 2 ----------
await ir('#/corpo/registro/novo');
ok('Placeholder = último valor', await page.getAttribute('[data-campo="peso"]', 'placeholder') === '58,4');
await preencher({ peso: '60,5', cintura: '68,5', coxaD: '55,2', quadril: '95' });
await foto('frente', 'treino-c.jpg');
await page.click('[data-acao="salvar"]'); await page.waitForTimeout(400);
e = await estado();
ok('Registro 2 salvo (hoje)', e.medidas.length === 2 && e.medidas[1].peso === 60.5);
ok('4 fotos no banco (perfil + 3)', await nFotos() === 4, String(await nFotos()));

// ---------- Tela Corpo ----------
const txt = await page.locator('.tela-corpo').innerText();
ok('Idade + IMC', /35 anos · IMC 22,2 \(Normal\)/.test(txt), (txt.match(/\d+ anos.*/) || [''])[0]);
ok('Faltam 1,5 kg', txt.includes('faltam 1,5 kg para a meta'));
ok('Desde o início +2,1', txt.includes('+2,1'));
const cor = async rot => page.locator('.linha-medida', { hasText: rot }).locator('.dif').first().getAttribute('class');
ok('Cintura caiu = boa', (await cor('Cintura')).includes('dif-boa'));
ok('Quadril caiu = ruim', (await cor('Quadril')).includes('dif-ruim'));
ok('Coxa subiu = boa', (await cor('Coxa direita')).includes('dif-boa'));
ok('Gráfico peso com meta', await page.locator('[data-sec="peso"] svg line.meta').count() === 1);
ok('Botão comparar fotos', await page.locator('a[href="#/corpo/fotos"]').count() === 1);
await page.screenshot({ path: `${OUT}/02-corpo.png`, fullPage: true });

// ---------- Medida ----------
await ir('#/corpo/medida/cintura');
const tm = await page.locator('#app').innerText();
ok('Tela medida cintura', tm.includes('Cintura') && await page.locator('#app svg').count() === 1);
await ir('#/corpo/medida/xyz');
ok('Medida inexistente tratada', (await page.locator('#app').innerText()).length > 0 && erros.length === 0);

// ---------- Comparar ----------
await ir('#/corpo/fotos');
ok('Comparar: 2 imagens', await page.locator('.comp-foto img').count() === 2);
await page.waitForTimeout(500);
ok('Comparar: imagens carregadas', await page.locator('.comp-foto img').evaluateAll(a => a.every(i => i.complete && i.naturalWidth > 0)));
const ladoDis = await page.locator('.posicoes [data-pos="lado"]').evaluate(b => b.disabled || b.getAttribute('aria-disabled') === 'true' || b.classList.contains('desativado'));
ok('Comparar: Lado desativado (só no 1º)', ladoDis);
await page.screenshot({ path: `${OUT}/03-comparar.png`, fullPage: true });
await page.locator('.comp-foto img').first().click(); await page.waitForTimeout(250);
ok('Tela cheia abre', await page.locator('#sheet img').count() === 1 && !(await page.locator('#sheet').getAttribute('hidden') !== null));
await page.click('#sheet-fundo', { force: true }).catch(() => {}); await page.keyboard.press('Escape'); await page.waitForTimeout(200);

// ---------- Cancelar registro novo com foto ----------
await ir('#/corpo/registro/novo');
await foto('frente', 'treino-e.jpg');
ok('Foto nova gravada antes de salvar', await nFotos() === 5);
await ir('#/corpo');
await page.waitForTimeout(300);
ok('Cancelar apaga foto nova', await nFotos() === 4, String(await nFotos()));

// ---------- Editar: trocar foto ----------
e = await estado();
const r1 = e.medidas.find(m => m.data === '2026-09-01');
const antigaFrente = r1.fotos.frente;
await ir('#/corpo/registro/' + r1.id);
ok('Editar: valores carregados', await page.inputValue('[data-campo="peso"]') === '58,4');
await foto('frente', 'treino-e.jpg');
await page.click('.foto-slot[data-pos="lado"] [data-acao="remover"]');
await page.click('[data-acao="salvar"]'); await page.waitForTimeout(500);
e = await estado();
const r1b = e.medidas.find(m => m.id === r1.id);
ok('Editar: foto trocada e lado removido', r1b.fotos.frente !== antigaFrente && r1b.fotos.lado === null);
ok('Editar: antigas apagadas do banco', await nFotos() === 3, String(await nFotos()));

// ---------- Duplicado na mesma data ----------
await ir('#/corpo/registro/novo');
await preencher({ peso: '60,6' });
await page.click('[data-acao="salvar"]'); await page.waitForTimeout(300);
ok('Pergunta de data duplicada', (await page.locator('#sheet').innerText()).includes('Já existe um registro'));
await page.click('#sheet [data-acao="cancelar"]'); await page.waitForTimeout(200);
ok('Cancelou duplicado: não salvou', (await estado()).medidas.length === 2);
await ir('#/corpo');

// ---------- Backup ----------
await ir('#/ajustes');
ok('Nome saiu de Ajustes', await page.locator('.tela-ajustes [data-campo="nome"]').count() === 0);
const [dl] = await Promise.all([page.waitForEvent('download'), page.click('[data-acao="exportar"]')]);
const caminho = `${OUT}/backup.json`; await dl.saveAs(caminho);
const bk = JSON.parse(fs.readFileSync(caminho, 'utf8'));
ok('Backup v2 com 3 fotos', bk.versao >= 2 && Object.keys(bk.fotos).length === 3, `${bk.versao} ${Object.keys(bk.fotos || {}).length}`);

// ---------- Excluir registro ----------
await ir('#/corpo/registro/' + r1.id);
await page.click('[data-acao="excluir"]'); await page.waitForTimeout(200); await sheetOk(); await page.waitForTimeout(400);
ok('Excluir: registro e foto somem', (await estado()).medidas.length === 1 && await nFotos() === 2, String(await nFotos()));

// ---------- Importar backup v2 ----------
await ir('#/ajustes');
await page.setInputFiles('.tela-ajustes [data-campo="arquivo"]', caminho); await page.waitForTimeout(300); await sheetOk(); await page.waitForTimeout(800);
e = await estado();
ok('Importar v2: 2 registros + 3 fotos, sem campo fotos no estado', e.medidas.length === 2 && await nFotos() === 3 && !('fotos' in e), `${e.medidas.length} ${await nFotos()}`);

// ---------- Importar backup v1 ----------
const v1 = { ...bk, versao: 1 }; delete v1.fotos; delete v1.medidas; delete v1.perfil;
fs.writeFileSync(`${OUT}/backup-v1.json`, JSON.stringify(v1));
await page.setInputFiles('.tela-ajustes [data-campo="arquivo"]', `${OUT}/backup-v1.json`); await page.waitForTimeout(300); await sheetOk(); await page.waitForTimeout(800);
e = await estado();
ok('Importar v1: migra, sem medidas, órfãs apagadas', e.versao >= 2 && e.medidas.length === 0 && e.perfil && await nFotos() === 0, `${e.versao} ${await nFotos()}`);
// volta o v2 para o resto
await page.setInputFiles('.tela-ajustes [data-campo="arquivo"]', caminho); await page.waitForTimeout(300); await sheetOk(); await page.waitForTimeout(800);

// ---------- Hoje com avatar e nome ----------
await ir('#/hoje'); await page.waitForTimeout(500);
ok('Hoje: avatar com foto', await page.locator('.avatar img[src^="blob:"]').count() === 1);
ok('Hoje: saudação com nome', (await page.locator('.hoje-cab').innerText()).includes('Maria'));

// ---------- Regressão: treino ----------
await page.click('.card-destaque [data-acao="comecar"]'); await page.waitForTimeout(400);
ok('Treino abriu', page.url().endsWith('#/treino'));
await page.fill('.exercicio[data-i="0"] .serie[data-s="0"] .carga', '20'); await page.click('.exercicio[data-i="0"] .serie[data-s="0"] [data-acao="feita"]'); await page.waitForTimeout(200); await page.keyboard.press('Escape');
await ir('#/hoje');
ok('Hoje: card em andamento com faixa', await page.locator('.card-destaque .treino-foto img').count() === 1 && (await page.locator('.card-destaque').innerText()).includes('em andamento'));
await ir('#/treino');
await page.click('[data-acao="finalizar"]'); await page.waitForTimeout(300);
if (await page.locator('#sheet [data-acao="ok"]').count()) await sheetOk();
await page.waitForTimeout(400);
ok('Treino finalizado', (await estado()).sessoes.length === 1 && (await estado()).sessaoAtual === null);

// ---------- Larguras ----------
for (const w of [390, 360]) {
  await page.setViewportSize({ width: w, height: 800 });
  for (const h of ['#/hoje', '#/corpo', '#/corpo/registro/novo', '#/corpo/fotos', '#/ajustes']) {
    await ir(h);
    const sobra = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    ok(`Sem rolagem horizontal ${w}px ${h}`, sobra <= 0, String(sobra));
  }
}
await ir('#/corpo'); await page.screenshot({ path: `${OUT}/04-corpo-360.png`, fullPage: true });
await ir('#/corpo/fotos'); await page.screenshot({ path: `${OUT}/05-comparar-360.png`, fullPage: true });
await ir('#/corpo/registro/novo'); await page.screenshot({ path: `${OUT}/06-registro-360.png`, fullPage: true });
await ir('#/hoje'); await page.screenshot({ path: `${OUT}/07-hoje-360.png` });
await ir('#/corpo');

ok('Sem erros de console', erros.length === 0, erros.join(' | '));
for (const r of res) console.log(r.join('  '));
console.log(`\n${res.filter(r => r[0] === 'OK ').length}/${res.length} OK`);
await browser.close();
