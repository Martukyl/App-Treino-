// E2E do Cardio (v1.2.0): GPS falso controlado + relógio simulado. Edge real.
import { chromium } from 'playwright-core';
import fs from 'node:fs';

const BASE = 'http://localhost:8080/';
const OUT = process.env.OUT || '.';
const res = [];
const ok = (nome, cond, extra = '') => res.push([cond ? 'OK ' : 'FALHA', nome, extra]);

// GPS falso: guarda os callbacks; window.__gps(...) entrega posição com timestamp = Date.now()
const FAKE = `
  (() => {
    const w = []; let negar = false;
    const geo = {
      watchPosition(ok, err) { const id = w.length + 1; w.push({ id, ok, err }); if (negar) setTimeout(() => err({ code: 1, message: 'negado' }), 10); return id; },
      clearWatch(id) { const i = w.findIndex(x => x.id === id); if (i >= 0) w.splice(i, 1); },
      getCurrentPosition(ok, err) { if (negar) err({ code: 1, message: 'negado' }); }
    };
    Object.defineProperty(navigator, 'geolocation', { get: () => geo, configurable: true });
    window.__gps = (lat, lon, accuracy = 6, altitude = null) => {
      const pos = { timestamp: Date.now(), coords: { latitude: lat, longitude: lon, accuracy, altitude, speed: null, heading: null, altitudeAccuracy: null } };
      for (const x of [...w]) x.ok(pos);
      return w.length;
    };
    window.__negarGps = () => { negar = true; };
    window.__watchers = () => w.length;
  })();`;

const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, acceptDownloads: true, serviceWorkers: 'block' });
await ctx.addInitScript(FAKE);
await ctx.route(/tile\.openstreetmap\.org/, r => r.abort());
const page = await ctx.newPage();
const erros = [];
page.on('console', m => { if (m.type() === 'error' && !/tile\.openstreetmap|ERR_FAILED|net::/.test(m.text())) erros.push(m.text()); });
page.on('pageerror', e => erros.push(String(e)));
await page.clock.install({ time: new Date('2026-10-03T07:00:00-03:00') });

const estado = () => page.evaluate(() => JSON.parse(localStorage.getItem('appTreino.v1')));
const ir = async h => { await page.evaluate(x => { location.hash = x; }, h); await page.clock.runFor(300); };
const sheetOk = async () => { await page.click('#sheet [data-acao="ok"]'); await page.clock.runFor(300); };
const nTrajetos = () => page.evaluate(() => new Promise(r => {
  const q = indexedDB.open('appTreino-fotos');
  q.onsuccess = () => { const t = q.result.transaction('trajetos').objectStore('trajetos').getAllKeys(); t.onsuccess = () => { r(t.result.length); q.result.close(); }; };
  q.onerror = () => r(-1);
}));

// caminhada: passos de 7 m para o norte a cada 5 s (~5 km/h), altitude subindo 0,1 m/passo
const LAT0 = -25.43, LON0 = -49.27, PASSO = 7 / 111195;
let i = 0;
const passo = async (n = 1, opts = {}) => {
  for (let k = 0; k < n; k++) {
    await page.clock.runFor(5000);
    i++;
    await page.evaluate(([la, lo, acc, alt]) => window.__gps(la, lo, acc, alt), [LAT0 + i * PASSO, LON0, opts.acc ?? 6, 900 + i * 0.1]);
  }
};

await page.goto(BASE);
await page.evaluate(() => localStorage.clear());
await page.reload(); await page.clock.runFor(500);
await page.check('input[name="programa"][value="padrao"]'); await page.click('[data-acao="comecar-app"]'); await page.clock.runFor(400); ok('Boas-vindas concluídas', page.url().endsWith('#/hoje'));

// ---------- Hoje: card cardio ----------
await page.waitForSelector('[data-cardio="atalhos"]', { timeout: 5000 }).catch(() => {});
ok('Hoje: atalhos de cardio', await page.locator('[data-cardio="atalhos"] [data-acao="cardio-gps"]').count() === 1);
await page.click('[data-acao="cardio-gps"]'); await page.clock.runFor(300);
await page.waitForSelector('.tela-cardio-gps[data-modo="preparar"]', { timeout: 5000 }).catch(() => {});
ok('Preparar aberto', await page.locator('.tela-cardio-gps[data-modo="preparar"]').count() === 1);
ok('Iniciar desabilitado sem GPS', await page.locator('[data-acao="iniciar"]').isDisabled());
await page.evaluate(([la, lo]) => window.__gps(la, lo, 8, 900), [LAT0, LON0]); await page.clock.runFor(300);
ok('Sinal GPS ok', (await page.locator('[data-sinal]').innerText()).startsWith('GPS ok'));
ok('Pede peso (sem Corpo)', await page.locator('[data-campo="peso"]').count() === 1);
await page.click('[data-acao="iniciar"]'); await page.clock.runFor(300);
ok('Sem peso bloqueia', await page.locator('.tela-cardio-gps[data-modo="preparar"]').count() === 1);
await page.fill('[data-campo="peso"]', '60');
await page.click('[data-acao="iniciar"]'); await page.clock.runFor(500);
ok('Gravando', await page.locator('[data-modo="gravando"]').count() === 1);
ok('Peso foi para o Corpo', (await estado()).medidas.some(m => m.peso === 60));
await page.waitForSelector('.leaflet-container', { timeout: 5000 }).catch(() => {}); ok('Mapa Leaflet montado', await page.locator('.leaflet-container').count() >= 1);

// ---------- andar 60 passos (420 m) com 1 ponto ruim e 1 salto ----------
await passo(30);
await page.clock.runFor(2000); await page.evaluate(([la, lo]) => window.__gps(la, lo, 80, 900), [LAT0 + (i + 1) * PASSO, LON0]); // ruim
await page.clock.runFor(2000); await page.evaluate(([la, lo]) => window.__gps(la + 0.005, lo, 6, 900), [LAT0 + i * PASSO, LON0]); // salto 550 m
await passo(30);
let e = await estado();
ok('Distância ~420 m após 60 passos', Math.abs(e.cardioAtual.distanciaM - 420) < 21, String(Math.round(e.cardioAtual.distanciaM)));
const txtDist = await page.locator('[data-met="distancia"]').innerText();
ok('Tela mostra distância', /0,4\d km/.test(txtDist), txtDist);
const vel = await page.locator('[data-met="velocidade"]').innerText();
ok('Velocidade ~5 km/h', /^(5|5[,.]0|5[,.]1|4[,.]9) km\/h/.test(vel), vel);
const rit = await page.locator('[data-met="ritmo"]').innerText();
ok('Ritmo ~11:54/km', /11:[45]\d/.test(rit), rit);
ok('Altitude exibida', /90\d/.test(await page.locator('[data-met="altitude"]').innerText()));
await page.screenshot({ path: `${OUT}/c1-gravando.png` });

// ---------- pausa 60 s ----------
const tAntes = (await estado()).cardioAtual;
await page.click('[data-acao="pausar"]'); await page.clock.runFor(300);
ok('Botão vira Retomar', (await page.locator('[data-acao="pausar"]').innerText()).includes('Retomar'));
await page.clock.runFor(60000);
await page.evaluate(([la, lo]) => window.__gps(la + 0.001, lo, 6, 900), [LAT0 + i * PASSO, LON0]); // ignorado (pausado)
await page.click('[data-acao="pausar"]'); await page.clock.runFor(300);
e = await estado();
ok('Pausa não soma distância', Math.abs(e.cardioAtual.distanciaM - tAntes.distanciaM) < 0.01);

// ---------- sair para Hoje e voltar ----------
await ir('#/hoje');
ok('Hoje: em andamento', await page.locator('[data-cardio="andamento"]').count() === 1);
await passo(10); // continua gravando fora da tela
ok('GPS segue fora da tela', (await estado()).cardioAtual.distanciaM > tAntes.distanciaM + 60, String(Math.round((await estado()).cardioAtual.distanciaM)));
await page.click('[data-acao="continuar-cardio"]'); await page.clock.runFor(500); console.log('DBG url', page.url(), await page.locator('.tela-cardio-gps').getAttribute('data-modo').catch(()=>'sem tela'));
ok('Voltou para gravação', await page.locator('[data-modo="gravando"]').count() === 1);

// ---------- recarregar no meio ----------
await passo(5);
await page.reload(); await page.clock.runFor(800);
ok('Após recarga: watcher religado', await page.evaluate(() => window.__watchers()) >= 1);
await ir('#/cardio/gps'); await page.clock.runFor(800);
ok('Após recarga: gravando', await page.locator('[data-modo="gravando"]').count() === 1);
await passo(115); // total ~180 passos andando
e = await estado();
const distFinal = e.cardioAtual.distanciaM;
ok('Distância ~1,33 km (±5%)', Math.abs(distFinal - 1330) < 66, String(Math.round(distFinal)));

// ---------- voltar de segundo plano após 2 min sem GPS ----------
await page.evaluate(() => { Object.defineProperty(document, 'hidden', { value: true, configurable: true }); document.dispatchEvent(new Event('visibilitychange')); });
await page.clock.runFor(120000);
await page.evaluate(() => { Object.defineProperty(document, 'hidden', { value: false, configurable: true }); document.dispatchEvent(new Event('visibilitychange')); });
await page.clock.runFor(200);
ok('Toast GPS parado', /GPS ficou parado por 2 min/.test(await page.locator('#toast').innerText().catch(() => '')), await page.locator('#toast').innerText().catch(() => '?'));
await passo(1);

// ---------- finalizar ----------
await page.click('[data-acao="finalizar"]'); await page.clock.runFor(300);
await sheetOk(); await page.clock.runFor(1000);
e = await estado();
const c = e.cardios[0];
ok('Cardio criado e cardioAtual limpo', !!c && e.cardioAtual === null);
ok('Tempo exclui pausa', c && Math.abs(c.duracaoSeg - (191 * 5 + 4 + 120)) < 15, c && String(c.duracaoSeg));
ok('kcal plausível (45–70)', c && c.kcal >= 45 && c.kcal <= 70, c && String(c.kcal));
ok('Subida ~18 m', c && c.subidaM >= 14 && c.subidaM <= 20, c && String(c.subidaM));
ok('Foi para o detalhe', page.url().includes('#/cardio/' + (c && c.id)));
const parc = await page.locator('[data-parciais] li').allInnerTexts();
ok('Parcial km 1 ~12:03 (714 s + 9 s de pontos descartados)', parc.length === 1 && /12:0\d/.test(parc[0]), parc.join('|'));
ok('Detalhe: mapa', await page.locator('.tela-cardio-detalhe .leaflet-container').count() === 1);
await page.screenshot({ path: `${OUT}/c2-detalhe.png`, fullPage: true });
ok('Trajeto no IndexedDB', await nTrajetos() === 1);
const traj = await page.evaluate(id => new Promise(r => { const q = indexedDB.open('appTreino-fotos'); q.onsuccess = () => { const g = q.result.transaction('trajetos').objectStore('trajetos').get(id); g.onsuccess = () => r(g.result); }; }), c.trajetoId);
const nPts = traj.segmentos.reduce((n, s) => n + s.length, 0);
ok('Trajeto completo (≥ 175 pontos, ≥ 2 segmentos)', nPts >= 175 && traj.segmentos.length >= 2, `${nPts} pts, ${traj.segmentos.length} seg`);

// ---------- aparelho ----------
await ir('#/cardio/aparelho/novo');
await page.click('[data-acao="tipo"][data-tipo="esteira"]');
await page.fill('[data-campo="duracao"]', '30');
await page.fill('[data-campo="distancia"]', '3,2');
await page.click('[data-acao="salvar"]'); await page.clock.runFor(400);
e = await estado();
const ap = e.cardios.find(x => x.modo === 'aparelho');
ok('Esteira salva c/ kcal estimada', ap && ap.kcalEstimada && ap.kcal > 0 && ap.distanciaM === 3200, ap && `${ap.kcal} ${ap.distanciaM}`);
await ir('#/historico');
const tipos = await page.locator('.linha-sessao').evaluateAll(a => a.map(x => x.dataset.tipo));
ok('Histórico com 2 cardios', tipos.filter(t => t === 'cardio').length === 2, tipos.join(','));
await page.screenshot({ path: `${OUT}/c3-historico.png`, fullPage: true });
await ir('#/cardio/aparelho/' + ap.id);
await page.fill('[data-campo="duracao"]', '45'); await page.click('[data-acao="salvar"]'); await page.clock.runFor(400);
ok('Editar aparelho', (await estado()).cardios.find(x => x.id === ap.id).duracaoSeg === 2700);

// ---------- backup ----------
await ir('#/ajustes');
const [dl] = await Promise.all([page.waitForEvent('download'), page.click('[data-acao="exportar"]')]);
await dl.saveAs(`${OUT}/bk-cardio.json`);
const bk = JSON.parse(fs.readFileSync(`${OUT}/bk-cardio.json`, 'utf8'));
ok('Backup v3 com trajeto', bk.versao === 3 && Object.keys(bk.trajetos || {}).length === 1);
// excluir GPS
await ir('#/cardio/' + c.id);
await page.click('[data-acao="excluir"]'); await page.clock.runFor(300); await sheetOk(); await page.clock.runFor(500);
ok('Excluir apaga trajeto', (await estado()).cardios.length === 1 && await nTrajetos() === 0);
// importar
await ir('#/ajustes');
await page.setInputFiles('.tela-ajustes [data-campo="arquivo"]', `${OUT}/bk-cardio.json`); await page.clock.runFor(300); await sheetOk(); await page.clock.runFor(1500);
ok('Importar restaura cardio + trajeto', (await estado()).cardios.length === 2 && await nTrajetos() === 1);

// ---------- gravação curta descartada ----------
await ir('#/cardio/gps');
await page.evaluate(([la, lo]) => window.__gps(la, lo, 8, 900), [LAT0, LON0]); await page.clock.runFor(300);
await page.click('[data-acao="iniciar"]'); await page.clock.runFor(500);
await page.click('[data-acao="finalizar"]'); await page.clock.runFor(300);
ok('Curta: pergunta descartar', /Descartar/.test(await page.locator('#sheet').innerText()));
await sheetOk(); await page.clock.runFor(500);
ok('Curta descartada', (await estado()).cardioAtual === null && (await estado()).cardios.length === 2 && await nTrajetos() === 1);

// ---------- larguras ----------
for (const w of [390, 360]) {
  await page.setViewportSize({ width: w, height: 760 });
  for (const h of ['#/hoje', '#/historico', '#/cardio/gps', '#/cardio/aparelho/novo', '#/cardio/' + bk.cardios.find(x => x.modo === 'gps').id]) {
    await ir(h); await page.clock.runFor(300);
    const sobra = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    ok(`Sem rolagem ${w}px ${h.slice(0, 20)}`, sobra <= 0, String(sobra));
  }
}
await ir('#/cardio/aparelho/novo'); await page.screenshot({ path: `${OUT}/c4-aparelho-360.png`, fullPage: true });
await ir('#/hoje'); await page.screenshot({ path: `${OUT}/c5-hoje-360.png`, fullPage: true });

// ---------- permissão negada (contexto novo) ----------
const ctx2 = await browser.newContext({ viewport: { width: 360, height: 760 }, serviceWorkers: 'block' });
await ctx2.addInitScript(FAKE + 'window.__negarGps();');
const p2 = await ctx2.newPage();
p2.on('pageerror', er => erros.push('p2 ' + er));
await p2.goto(BASE); await p2.waitForTimeout(500); await p2.check('input[name="programa"][value="padrao"]'); await p2.click('[data-acao="comecar-app"]'); await p2.waitForTimeout(300); await p2.evaluate(() => { location.hash = '#/cardio/gps'; }); await p2.waitForTimeout(800);
ok('Negado: mensagem + botão aparelho', await p2.locator('[data-negado] [data-acao="ir-aparelho"]').isVisible());

ok('Sem erros de console', erros.length === 0, erros.join(' | '));
for (const r of res) console.log(r.join('  '));
console.log(`\n${res.filter(r => r[0] === 'OK ').length}/${res.length} OK`);
await browser.close();
