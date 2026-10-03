// Trajetos GPS no IndexedDB (banco appTreino-fotos, store trajetos).
// Valor: { segmentos: [[ [lat, lon, alt|null, tMs], … ], …] }, chave = trajetoId.
// As funções puras (anexarAoTrajeto, idsTrajetos, sanitizarTrajeto) rodam no Node.
import { abrirBanco, transacao } from './banco.js';

const STORE = 'trajetos';

// ---------- Puro ----------

// Anexa pontos ao trajeto. itens: [{ p: [lat, lon, alt|null, t], novo: boolean }].
// `novo` abre um segmento novo (primeiro ponto, retomada de pausa, lacuna). Devolve um trajeto novo.
export function anexarAoTrajeto(trajeto, itens) {
  const segmentos = (trajeto && Array.isArray(trajeto.segmentos) ? trajeto.segmentos : []).map(s => [...s]);
  for (const { p, novo } of itens || []) {
    if (novo || !segmentos.length) segmentos.push([p]);
    else segmentos[segmentos.length - 1].push(p);
  }
  return { segmentos };
}

// Ids de trajeto usados pelo estado: cardios concluídos (modo gps) + gravação em andamento.
export function idsTrajetos(estado) {
  const ids = new Set();
  for (const c of (estado && Array.isArray(estado.cardios) ? estado.cardios : [])) {
    if (c && typeof c.trajetoId === 'string' && c.trajetoId) ids.add(c.trajetoId);
  }
  const atual = estado && estado.cardioAtual;
  if (atual && typeof atual.trajetoId === 'string' && atual.trajetoId) ids.add(atual.trajetoId);
  return ids;
}

const ehPonto = p => Array.isArray(p) && p.length >= 4 &&
  Number.isFinite(p[0]) && Number.isFinite(p[1]) && Number.isFinite(p[3]) &&
  (p[2] === null || Number.isFinite(p[2]));

// Valida um trajeto vindo de backup: mantém só pontos bem formados; null se não sobrar estrutura.
export function sanitizarTrajeto(t) {
  if (!t || typeof t !== 'object' || !Array.isArray(t.segmentos)) return null;
  const segmentos = t.segmentos
    .filter(Array.isArray)
    .map(s => s.filter(ehPonto).map(p => [p[0], p[1], p[2], p[3]]))
    .filter(s => s.length);
  return { segmentos };
}

// ---------- IndexedDB ----------

// Fila: gravações do mesmo trajeto acontecem uma de cada vez (ler-modificar-gravar sem corrida).
let fila = Promise.resolve();

export function anexarPontos(id, itens) {
  if (!id || !itens || !itens.length) return Promise.resolve();
  const tarefa = fila.then(async () => {
    const db = await abrirBanco();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      const store = tx.objectStore(STORE);
      const leitura = store.get(id);
      leitura.onsuccess = () => store.put(anexarAoTrajeto(leitura.result, itens), id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error || new Error('transação cancelada'));
    });
  });
  fila = tarefa.catch(() => {}); // uma falha não trava as próximas
  return tarefa;
}

export async function lerTrajeto(id) {
  if (!id) return null;
  await fila; // espera gravações pendentes
  return (await transacao(STORE, 'readonly', s => s.get(id))) ?? null;
}

export async function apagarTrajeto(id) {
  if (!id) return;
  const tarefa = fila.then(() => transacao(STORE, 'readwrite', s => s.delete(id)));
  fila = tarefa.catch(() => {});
  return tarefa;
}

export async function listarTrajetoIds() {
  const chaves = await transacao(STORE, 'readonly', s => s.getAllKeys());
  return (chaves || []).filter(k => typeof k === 'string');
}

// ids → { id: trajeto }; ids sem trajeto no banco são ignorados.
export async function exportarTrajetos(ids) {
  const mapa = {};
  for (const id of ids) {
    const t = await lerTrajeto(id);
    if (t) mapa[id] = t;
  }
  return mapa;
}

// { id: trajeto } → grava (substituindo). Entradas inválidas são ignoradas.
export async function importarTrajetos(mapa) {
  const itens = [];
  for (const [id, t] of Object.entries(mapa || {})) {
    const limpo = sanitizarTrajeto(t);
    if (limpo) itens.push([id, limpo]);
  }
  if (!itens.length) return;
  await fila;
  await transacao(STORE, 'readwrite', s => { for (const [id, t] of itens) s.put(t, id); });
}
