// Cards de compartilhamento — desenho em canvas (1080 × 1350) e geração do PNG.
// Os textos vêm de cards.js (puro); aqui só se desenha. Imagens são carregadas antes (decode);
// se uma imagem falhar, o card sai sem ela.
import { LARGURA, ALTURA, RODAPE, projetarTrajeto } from './cards.js';
import { lerFoto } from './fotos.js';
import { lerTrajeto } from './trajetos.js';

const FONTE = 'system-ui, -apple-system, "Segoe UI", Roboto, "Noto Color Emoji", "Segoe UI Emoji", sans-serif';
// tokens do css/app.css (constantes equivalentes: o canvas não lê var() direto)
const COR = {
  bg: '#f2f0e9', texto: '#20241f', muted: '#71766e', accent: '#d54b32', accent2: '#eea34a',
  ok: '#31765a', warn: '#a96313', danger: '#bd352d',
  caixa: '#fffefa', borda: '#e4e0d6',
  suave: '#f8e8e2', apagado: '#e9e6dd' // destaque claro (item ativo) e fundo neutro (mapa)
};
const PAD = 72;
const LARGURA_UTIL = LARGURA - 2 * PAD;

// ---------- Primitivas ----------

function caminhoArredondado(ctx, x, y, w, h, r) {
  ctx.beginPath();
  if (typeof ctx.roundRect === 'function') { ctx.roundRect(x, y, w, h, r); return; }
  // fallback para navegadores sem roundRect
  const rr = Math.min(r, w / 2, h / 2);
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

function caixa(ctx, x, y, w, h, r = 36, preenchimento = COR.caixa) {
  caminhoArredondado(ctx, x, y, w, h, r);
  ctx.fillStyle = preenchimento;
  // sombra leve, como os cards do tema claro
  ctx.save();
  ctx.shadowColor = 'rgba(43, 38, 27, 0.07)';
  ctx.shadowBlur = 40;
  ctx.shadowOffsetY = 14;
  ctx.fill();
  ctx.restore();
  ctx.lineWidth = 2;
  ctx.strokeStyle = COR.borda;
  ctx.stroke();
}

function fundo(ctx) {
  ctx.fillStyle = COR.bg;
  ctx.fillRect(0, 0, LARGURA, ALTURA);
  const brilho = (cx, cy, raio, cor) => {
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, raio);
    g.addColorStop(0, cor);
    g.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, LARGURA, ALTURA);
  };
  brilho(1000, 0, 900, 'rgba(213, 75, 50, 0.10)');
  brilho(0, 800, 860, 'rgba(238, 163, 74, 0.10)');
}

function rodape(ctx) {
  ctx.fillStyle = COR.muted;
  ctx.font = `600 34px ${FONTE}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(RODAPE, LARGURA / 2, ALTURA - 52);
}

// escreve texto reduzindo a fonte até caber em larguraMax; devolve o tamanho usado
function texto(ctx, str, x, y, { tamanho = 40, peso = 700, cor = COR.texto, alinhar = 'left', larguraMax = LARGURA_UTIL, minimo = 22 } = {}) {
  let t = tamanho;
  ctx.font = `${peso} ${t}px ${FONTE}`;
  while (t > minimo && ctx.measureText(str).width > larguraMax) {
    t -= 2;
    ctx.font = `${peso} ${t}px ${FONTE}`;
  }
  ctx.fillStyle = cor;
  ctx.textAlign = alinhar;
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(str, x, y, larguraMax);
  return t;
}

// quebra em até `linhas` linhas (por palavras) que cabem em larguraMax; a última recebe reticências
function quebrar(ctx, str, larguraMax, linhas) {
  const palavras = String(str).split(/\s+/);
  const saida = [];
  let atual = '';
  for (const p of palavras) {
    const tentativa = atual ? `${atual} ${p}` : p;
    if (ctx.measureText(tentativa).width <= larguraMax || !atual) atual = tentativa;
    else { saida.push(atual); atual = p; }
  }
  if (atual) saida.push(atual);
  if (saida.length > linhas) {
    saida.length = linhas;
    let ult = saida[linhas - 1];
    while (ult.length > 1 && ctx.measureText(`${ult}…`).width > larguraMax) ult = ult.slice(0, -1);
    saida[linhas - 1] = `${ult}…`;
  }
  return saida;
}

function metrica(ctx, m, x, y, w, h, tamanhoValor = 64) {
  caixa(ctx, x, y, w, h, 32);
  texto(ctx, m.valor, x + w / 2, y + h * 0.56, { tamanho: tamanhoValor, peso: 800, alinhar: 'center', larguraMax: w - 40, minimo: 30 });
  texto(ctx, m.rotulo, x + w / 2, y + h * 0.56 + 44, { tamanho: 30, peso: 600, cor: COR.muted, alinhar: 'center', larguraMax: w - 40 });
}

// grade de métricas em `colunas` colunas
function grade(ctx, lista, x, y, w, h, colunas, folga = 24, tamanhoValor = 64) {
  const largCel = (w - folga * (colunas - 1)) / colunas;
  lista.forEach((m, i) => {
    const col = i % colunas, lin = Math.floor(i / colunas);
    metrica(ctx, m, x + col * (largCel + folga), y + lin * (h + folga), largCel, h, tamanhoValor);
  });
  return y + Math.ceil(lista.length / colunas) * (h + folga) - folga;
}

// desenha a imagem preenchendo a caixa (recorte central), com cantos arredondados
function imagemCover(ctx, img, x, y, w, h, r = 36) {
  const iw = img.naturalWidth || img.width, ih = img.naturalHeight || img.height;
  const esc = Math.max(w / iw, h / ih);
  const sw = w / esc, sh = h / esc;
  ctx.save();
  caminhoArredondado(ctx, x, y, w, h, r);
  ctx.clip();
  ctx.drawImage(img, (iw - sw) / 2, (ih - sh) / 2, sw, sh, x, y, w, h);
  ctx.restore();
}

// ---------- Carregamento de imagens ----------

// URL → HTMLImageElement decodificado, ou null se falhar
async function carregarImagem(src) {
  try {
    const img = new Image();
    img.src = src;
    await img.decode();
    return img;
  } catch {
    return null;
  }
}

// blob do IndexedDB → imagem decodificada, ou null
async function imagemDoBlob(blob) {
  if (!blob) return null;
  const url = URL.createObjectURL(blob);
  try {
    return await carregarImagem(url);
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function imagemDaFoto(id) {
  try { return await imagemDoBlob(await lerFoto(id)); } catch { return null; }
}

// ---------- Desenho de cada card ----------

function desenharTreino(ctx, d, foto) {
  texto(ctx, d.saudacao, PAD, 150, { tamanho: 64, peso: 800 });
  ctx.font = `800 58px ${FONTE}`;
  const linhas = quebrar(ctx, d.titulo, LARGURA_UTIL, 2);
  linhas.forEach((l, i) => texto(ctx, l, PAD, 244 + i * 70, { tamanho: 58, peso: 800, cor: COR.accent }));
  let y = 244 + linhas.length * 70 - 8;
  texto(ctx, d.data, PAD, y + 36, { tamanho: 38, peso: 600, cor: COR.muted });
  y += 90;
  if (foto) {
    imagemCover(ctx, foto, PAD, y, LARGURA_UTIL, 360, 40);
    y += 360 + 36;
  } else {
    texto(ctx, '🏋️', LARGURA / 2, y + 170, { tamanho: 190, alinhar: 'center' });
    y += 250;
  }
  const altura = Math.min(220, (ALTURA - 120 - y - 24) / 2);
  grade(ctx, d.metricas, PAD, y, LARGURA_UTIL, altura, 2, 24, 76);
}

function desenharCardio(ctx, d, rota) {
  texto(ctx, d.titulo, PAD, 160, { tamanho: 80, peso: 800 });
  texto(ctx, d.data, PAD, 220, { tamanho: 38, peso: 600, cor: COR.muted });
  let y = 270;
  if (d.modo === 'gps') {
    const alturaMapa = 560;
    caixa(ctx, PAD, y, LARGURA_UTIL, alturaMapa, 40, COR.apagado);
    const proj = rota && projetarTrajeto(rota, { largura: LARGURA_UTIL, altura: alturaMapa, margem: 70 });
    if (proj) {
      ctx.save();
      ctx.translate(PAD, y);
      ctx.lineWidth = 16;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = COR.accent;
      ctx.shadowColor = 'rgba(213, 75, 50, 0.30)';
      ctx.shadowBlur = 24;
      for (const seg of proj.segmentos) {
        ctx.beginPath();
        seg.forEach(([px, py], i) => (i ? ctx.lineTo(px, py) : ctx.moveTo(px, py)));
        if (seg.length === 1) ctx.lineTo(seg[0][0] + 0.1, seg[0][1]);
        ctx.stroke();
      }
      ctx.shadowBlur = 0;
      const ponto = ([px, py], cor) => {
        ctx.beginPath();
        ctx.arc(px, py, 22, 0, Math.PI * 2);
        ctx.fillStyle = cor;
        ctx.fill();
        ctx.lineWidth = 6;
        ctx.strokeStyle = '#fff';
        ctx.stroke();
      };
      ponto(proj.inicio, COR.ok);
      ponto(proj.fim, COR.danger);
      ctx.restore();
    } else {
      texto(ctx, d.titulo.split(' ')[0], PAD + LARGURA_UTIL / 2, y + alturaMapa / 2 + 70, { tamanho: 200, alinhar: 'center' });
    }
    y += alturaMapa + 40;
    texto(ctx, d.destaque.valor, LARGURA / 2, y + 100, { tamanho: 124, peso: 800, alinhar: 'center' });
    texto(ctx, d.destaque.rotulo, LARGURA / 2, y + 152, { tamanho: 34, peso: 600, cor: COR.muted, alinhar: 'center' });
    y += 190;
    const colunas = Math.min(d.metricas.length, 4) || 1;
    grade(ctx, d.metricas, PAD, y, LARGURA_UTIL, 170, colunas, 16, colunas > 3 ? 44 : 54);
  } else {
    caixa(ctx, PAD, y, LARGURA_UTIL, 560, 40);
    texto(ctx, d.icone, LARGURA / 2, y + 370, { tamanho: 300, alinhar: 'center' });
    y += 560 + 40;
    const colunas = Math.min(d.metricas.length, 3) || 1;
    grade(ctx, d.metricas, PAD, y, LARGURA_UTIL, 220, colunas, 20, colunas > 2 ? 52 : 70);
  }
}

function desenharSemana(ctx, d) {
  texto(ctx, d.titulo, PAD, 170, { tamanho: 92, peso: 800 });
  texto(ctx, d.periodo, PAD, 232, { tamanho: 40, peso: 600, cor: COR.muted });
  // 7 bolinhas seg–dom
  const passo = LARGURA_UTIL / 7, raio = 40, cy = 380;
  d.dias.forEach((dia, i) => {
    const cx = PAD + passo * (i + 0.5);
    ctx.beginPath();
    ctx.arc(cx, cy, raio, 0, Math.PI * 2);
    if (dia.ativo) {
      ctx.fillStyle = COR.accent; // como as bolinhas da tela Hoje
      ctx.fill();
      texto(ctx, '✓', cx, cy + 18, { tamanho: 50, peso: 800, cor: '#fff', alinhar: 'center' });
    } else {
      ctx.lineWidth = 5;
      ctx.strokeStyle = '#d8d4ca';
      ctx.stroke();
    }
    texto(ctx, dia.letra, cx, cy + raio + 52, { tamanho: 36, peso: dia.hoje ? 700 : 600, cor: dia.hoje ? COR.texto : COR.muted, alinhar: 'center' });
  });
  grade(ctx, d.metricas, PAD, 560, LARGURA_UTIL, 230, 2, 24, 80);
  // faixa da sequência
  const y = 560 + 230 * 2 + 24 + 50;
  caixa(ctx, PAD, y, LARGURA_UTIL, 150, 40, COR.suave);
  texto(ctx, d.textoSequencia, LARGURA / 2, y + 96, { tamanho: 56, peso: 800, alinhar: 'center', larguraMax: LARGURA_UTIL - 60 });
}

function corDirecao(direcao) {
  return direcao === 'boa' ? COR.ok : direcao === 'ruim' ? COR.warn : COR.muted;
}

function desenharCorpo(ctx, d, fotos) {
  texto(ctx, d.titulo, PAD, 160, { tamanho: 84, peso: 800 });
  if (d.desde) texto(ctx, d.desde, PAD, 220, { tamanho: 38, peso: 600, cor: COR.muted });
  let y = 262;
  const comFotos = !!(fotos && (fotos.antes || fotos.depois));
  if (comFotos) {
    // antes × depois, lado a lado (recorte central, proporção 3:4)
    const largFoto = (LARGURA_UTIL - 24) / 2, altFoto = 440;
    [['antes', 0], ['depois', 1]].forEach(([chave, col]) => {
      const x = PAD + col * (largFoto + 24);
      if (fotos[chave]) imagemCover(ctx, fotos[chave], x, y, largFoto, altFoto, 32);
      else caixa(ctx, x, y, largFoto, altFoto, 32);
      const rotulo = `${chave === 'antes' ? 'Antes' : 'Depois'} · ${d.fotos[chave].data}`;
      caixa(ctx, x + 16, y + altFoto - 76, largFoto - 32, 60, 30, 'rgba(9, 11, 18, 0.72)');
      texto(ctx, rotulo, x + largFoto / 2, y + altFoto - 34, { tamanho: 32, peso: 700, cor: '#fff', alinhar: 'center', larguraMax: largFoto - 60 });
    });
    y += altFoto + 30;
  }
  if (d.peso) {
    const alturaPeso = comFotos ? 150 : 270;
    caixa(ctx, PAD, y, LARGURA_UTIL, alturaPeso, 40);
    if (comFotos) {
      texto(ctx, d.peso.valor, PAD + 40, y + 98, { tamanho: 84, peso: 800, larguraMax: 440 });
      if (d.peso.dif) texto(ctx, d.peso.dif, PAD + LARGURA_UTIL - 40, y + 90, { tamanho: 34, peso: 700, cor: corDirecao(d.peso.direcao), alinhar: 'right', larguraMax: 440 });
    } else {
      texto(ctx, 'Peso', PAD + 40, y + 56, { tamanho: 34, peso: 600, cor: COR.muted });
      texto(ctx, d.peso.valor, PAD + 40, y + 172, { tamanho: 120, peso: 800, larguraMax: LARGURA_UTIL - 80 });
      if (d.peso.dif) texto(ctx, d.peso.dif, PAD + 40, y + 242, { tamanho: 40, peso: 700, cor: corDirecao(d.peso.direcao), larguraMax: LARGURA_UTIL - 80 });
    }
    y += alturaPeso + 24;
  }
  // medidas: com fotos cabem menos linhas
  const maximo = comFotos ? 3 : 6;
  const linhas = d.medidas.slice(0, maximo);
  if (linhas.length) {
    const alturaLinha = comFotos ? 74 : 92;
    const alturaBloco = linhas.length * alturaLinha + 30;
    caixa(ctx, PAD, y, LARGURA_UTIL, alturaBloco, 40);
    linhas.forEach((l, i) => {
      const base = y + 15 + i * alturaLinha + alturaLinha * 0.64;
      texto(ctx, l.rotulo, PAD + 40, base, { tamanho: 38, peso: 600, cor: COR.muted, larguraMax: 380 });
      texto(ctx, l.valor, PAD + 540, base, { tamanho: 42, peso: 800, alinhar: 'right', larguraMax: 220 });
      if (l.dif) texto(ctx, l.dif, PAD + LARGURA_UTIL - 40, base, { tamanho: 38, peso: 700, cor: corDirecao(l.direcao), alinhar: 'right', larguraMax: 250 });
    });
  }
  if (!d.peso && !linhas.length) {
    texto(ctx, 'Registre suas medidas para ver a evolução', LARGURA / 2, 700, { tamanho: 44, cor: COR.muted, alinhar: 'center' });
  }
}

const MEDALHAS = ['🥇', '🥈', '🥉'];

function desenharRanking(ctx, d) {
  texto(ctx, d.titulo, PAD, 150, { tamanho: 84, peso: 800 });
  texto(ctx, d.subtitulo, PAD, 214, { tamanho: 40, peso: 600, cor: COR.muted });
  if (!d.podio.length) {
    texto(ctx, 'Ainda sem pontos por aqui', LARGURA / 2, 640, { tamanho: 48, cor: COR.muted, alinhar: 'center' });
    return;
  }
  // pódio: 2º, 1º, 3º (com menos de 3 pessoas, na ordem natural), alinhado pela base
  const ordem = d.podio.length >= 3 ? [d.podio[1], d.podio[0], d.podio[2]] : d.podio;
  const folga = 20, n = ordem.length;
  const larg = Math.min(300, (LARGURA_UTIL - folga * (n - 1)) / n);
  const total = larg * n + folga * (n - 1);
  const x0 = PAD + (LARGURA_UTIL - total) / 2;
  const base = 720, alturas = { 1: 360, 2: 330, 3: 310 };
  ordem.forEach((p, i) => {
    const h = alturas[p.posicao], x = x0 + i * (larg + folga), y = base - h;
    caixa(ctx, x, y, larg, h, 36, p.posicao === 1 ? COR.suave : COR.caixa);
    const cx = x + larg / 2;
    texto(ctx, MEDALHAS[p.posicao - 1], cx, y + 78, { tamanho: 64, alinhar: 'center' });
    texto(ctx, p.emoji, cx, y + 190, { tamanho: 96, alinhar: 'center' });
    texto(ctx, p.apelido, cx, y + h - 82, { tamanho: 38, peso: 700, alinhar: 'center', larguraMax: larg - 30 });
    texto(ctx, p.valor, cx, y + h - 28, { tamanho: 44, peso: 800, cor: COR.accent, alinhar: 'center', larguraMax: larg - 30 });
  });
  if (d.linhas.length) {
    const alturaLinha = 68, y = base + 40;
    caixa(ctx, PAD, y, LARGURA_UTIL, d.linhas.length * alturaLinha + 24, 36);
    d.linhas.forEach((l, i) => {
      const b = y + 12 + i * alturaLinha + 46;
      texto(ctx, `${l.posicao}º`, PAD + 36, b, { tamanho: 38, peso: 700, cor: COR.muted, larguraMax: 80 });
      texto(ctx, l.emoji, PAD + 150, b, { tamanho: 40, alinhar: 'center' });
      texto(ctx, l.apelido, PAD + 200, b, { tamanho: 40, peso: 600, larguraMax: 460 });
      texto(ctx, l.valor, PAD + LARGURA_UTIL - 36, b, { tamanho: 40, peso: 800, alinhar: 'right', larguraMax: 220 });
    });
  }
}

// ---------- Geração ----------

function novoCanvas() {
  const canvas = document.createElement('canvas');
  canvas.width = LARGURA;
  canvas.height = ALTURA;
  return canvas;
}

function paraPng(canvas) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(b => (b ? resolve(b) : reject(new Error('falha ao gerar PNG'))), 'image/png');
  });
}

// dados (de cards.js) → Blob PNG 1080 × 1350. Carrega as imagens necessárias antes de desenhar.
export async function gerarCard(dados) {
  let foto = null, rota = null, fotos = null;
  if (dados.tipo === 'treino' && dados.foto) foto = await carregarImagem(dados.foto);
  if (dados.tipo === 'cardio' && dados.trajetoId) {
    try {
      const t = await lerTrajeto(dados.trajetoId);
      rota = t && Array.isArray(t.segmentos) ? t.segmentos.filter(s => s.length) : null;
    } catch { rota = null; }
  }
  if (dados.tipo === 'corpo' && dados.fotos) {
    fotos = {
      antes: await imagemDaFoto(dados.fotos.antes.id),
      depois: await imagemDaFoto(dados.fotos.depois.id)
    };
  }
  const canvas = novoCanvas();
  const ctx = canvas.getContext('2d');
  fundo(ctx);
  if (dados.tipo === 'treino') desenharTreino(ctx, dados, foto);
  else if (dados.tipo === 'cardio') desenharCardio(ctx, dados, rota);
  else if (dados.tipo === 'semana') desenharSemana(ctx, dados);
  else if (dados.tipo === 'ranking') desenharRanking(ctx, dados);
  else desenharCorpo(ctx, dados, fotos);
  rodape(ctx);
  return paraPng(canvas);
}
