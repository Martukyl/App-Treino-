// Fotos do Corpo: compressão e armazenamento em IndexedDB (banco appTreino-fotos, store fotos).
// As funções puras (calcularDimensoes, idsReferenciados) rodam no Node; o resto precisa do navegador.
// Qualquer falha de IndexedDB/canvas rejeita a Promise: quem chama avisa com toast e segue sem a foto.
import { gerarId } from './util.js';

const BANCO = 'appTreino-fotos';
const STORE = 'fotos';
const QUALIDADE = 0.75;
const LADO_MAX_PERFIL = 400;

// ---------- Puro ----------

// Recorte de origem (sx, sy, sw, sh) e tamanho de destino (dw, dh). Nunca amplia a imagem.
export function calcularDimensoes(largura, altura, { lado = 1080, quadrado = false } = {}) {
  if (quadrado) {
    const s = Math.min(largura, altura);
    const d = Math.max(1, Math.round(Math.min(lado, LADO_MAX_PERFIL, s)));
    return { sx: (largura - s) / 2, sy: (altura - s) / 2, sw: s, sh: s, dw: d, dh: d };
  }
  const escala = Math.min(1, lado / Math.max(largura, altura));
  return {
    sx: 0, sy: 0, sw: largura, sh: altura,
    dw: Math.max(1, Math.round(largura * escala)),
    dh: Math.max(1, Math.round(altura * escala))
  };
}

// Ids de foto usados pelo estado: fotos dos registros de medidas + foto de perfil.
export function idsReferenciados(estado) {
  const ids = new Set();
  const perfil = estado && estado.perfil;
  if (perfil && typeof perfil.fotoId === 'string' && perfil.fotoId) ids.add(perfil.fotoId);
  for (const m of (estado && Array.isArray(estado.medidas) ? estado.medidas : [])) {
    for (const id of Object.values((m && m.fotos) || {})) {
      if (typeof id === 'string' && id) ids.add(id);
    }
  }
  return ids;
}

// ---------- Compressão ----------

async function decodificar(file) {
  if (typeof createImageBitmap === 'function') {
    try { return await createImageBitmap(file, { imageOrientation: 'from-image' }); } catch { /* cai no <img> */ }
  }
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('imagem inválida')); };
    img.src = url;
  });
}

// File/Blob de imagem → Blob JPEG (lado maior ≤ lado; quadrado = recorte central, ≤ 400 px).
export async function comprimirImagem(file, { lado = 1080, quadrado = false } = {}) {
  const origem = await decodificar(file);
  try {
    const w = origem.naturalWidth || origem.width;
    const h = origem.naturalHeight || origem.height;
    if (!w || !h) throw new Error('imagem sem tamanho');
    const { sx, sy, sw, sh, dw, dh } = calcularDimensoes(w, h, { lado, quadrado });
    const canvas = document.createElement('canvas');
    canvas.width = dw;
    canvas.height = dh;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff'; // PNG com transparência não vira preto no JPEG
    ctx.fillRect(0, 0, dw, dh);
    ctx.drawImage(origem, sx, sy, sw, sh, 0, 0, dw, dh);
    return await new Promise((resolve, reject) => {
      canvas.toBlob(b => (b ? resolve(b) : reject(new Error('falha ao gerar JPEG'))), 'image/jpeg', QUALIDADE);
    });
  } finally {
    origem.close?.();
  }
}

// ---------- IndexedDB ----------

let abertura = null;

function abrirBanco() {
  if (abertura) return abertura;
  abertura = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') { reject(new Error('IndexedDB indisponível')); return; }
    let req;
    try { req = indexedDB.open(BANCO, 1); } catch (e) { reject(e); return; }
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => {
      const db = req.result;
      db.onversionchange = () => { db.close(); abertura = null; };
      resolve(db);
    };
    req.onerror = () => reject(req.error);
    req.onblocked = () => reject(new Error('banco de fotos bloqueado'));
  });
  abertura.catch(() => { abertura = null; }); // permite tentar de novo depois
  return abertura;
}

// Executa fn(store) numa transação e resolve com o resultado da requisição devolvida.
async function transacao(modo, fn) {
  const db = await abrirBanco();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, modo);
    let resultado;
    try { resultado = fn(tx.objectStore(STORE)); } catch (e) { reject(e); return; }
    tx.oncomplete = () => resolve(resultado && 'result' in resultado ? resultado.result : undefined);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error('transação cancelada'));
  });
}

export async function salvarFoto(blob) {
  const id = gerarId('f_');
  await transacao('readwrite', s => s.put(blob, id));
  return id;
}

export async function lerFoto(id) {
  if (!id) return null;
  return (await transacao('readonly', s => s.get(id))) ?? null;
}

export async function apagarFoto(id) {
  if (!id) return;
  await transacao('readwrite', s => s.delete(id));
}

export async function listarIds() {
  const chaves = await transacao('readonly', s => s.getAllKeys());
  return (chaves || []).filter(k => typeof k === 'string');
}

function blobParaDataURL(blob) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

function dataURLParaBlob(url) {
  const m = /^data:(image\/[a-z0-9.+-]+);base64,([A-Za-z0-9+/=]+)$/i.exec(url);
  if (!m) return null;
  const bin = atob(m[2]);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: m[1] });
}

// ids → { id: dataURL }; ids sem foto no banco são ignorados.
export async function exportarFotos(ids) {
  const mapa = {};
  for (const id of ids) {
    const blob = await lerFoto(id);
    if (blob) mapa[id] = await blobParaDataURL(blob);
  }
  return mapa;
}

// { id: dataURL } → grava (substituindo). Entradas inválidas são ignoradas.
export async function importarFotos(mapa) {
  const itens = [];
  for (const [id, url] of Object.entries(mapa || {})) {
    if (typeof url !== 'string') continue;
    let blob = null;
    try { blob = dataURLParaBlob(url); } catch { /* base64 inválido */ }
    if (blob) itens.push([id, blob]);
  }
  if (!itens.length) return;
  await transacao('readwrite', s => { for (const [id, blob] of itens) s.put(blob, id); });
}

// ---------- Object URLs (cache; revogados ao sair da tela) ----------

const urls = new Map(); // id → Promise<string|null>

export function urlFoto(id) {
  if (!id) return Promise.resolve(null);
  if (!urls.has(id)) {
    urls.set(id, lerFoto(id).then(b => (b ? URL.createObjectURL(b) : null)).catch(() => null));
  }
  return urls.get(id);
}

export function liberarUrl(id) {
  const p = urls.get(id);
  if (!p) return;
  urls.delete(id);
  p.then(u => { if (u) URL.revokeObjectURL(u); });
}

export function liberarUrls() {
  for (const id of [...urls.keys()]) liberarUrl(id);
}

// Preenche os <img data-foto="id"> da tela. aoFalhar(img) roda quando a foto não existe/não abre.
export function carregarImagens(raiz, aoFalhar) {
  raiz.querySelectorAll('img[data-foto]').forEach(async img => {
    const url = await urlFoto(img.dataset.foto);
    if (url && img.isConnected) img.src = url;
    else if (!url) aoFalhar?.(img);
  });
}
