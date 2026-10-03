// Abertura compartilhada do IndexedDB do app: banco appTreino-fotos, versão 2,
// stores `fotos` e `trajetos` (cada uma criada só se ainda não existir — preserva as fotos).
// Qualquer falha rejeita a Promise; quem chama decide como avisar.

export const BANCO = 'appTreino-fotos';
export const VERSAO_BANCO = 2;
export const STORES = ['fotos', 'trajetos'];

let abertura = null;

export function abrirBanco() {
  if (abertura) return abertura;
  abertura = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') { reject(new Error('IndexedDB indisponível')); return; }
    let req;
    try { req = indexedDB.open(BANCO, VERSAO_BANCO); } catch (e) { reject(e); return; }
    req.onupgradeneeded = () => {
      const db = req.result;
      for (const nome of STORES) {
        if (!db.objectStoreNames.contains(nome)) db.createObjectStore(nome);
      }
    };
    req.onsuccess = () => {
      const db = req.result;
      db.onversionchange = () => { db.close(); abertura = null; };
      resolve(db);
    };
    req.onerror = () => reject(req.error);
    req.onblocked = () => reject(new Error('banco bloqueado'));
  });
  abertura.catch(() => { abertura = null; }); // permite tentar de novo depois
  return abertura;
}

// Executa fn(store) numa transação da store e resolve com o resultado da requisição devolvida.
export async function transacao(store, modo, fn) {
  const db = await abrirBanco();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, modo);
    let resultado;
    try { resultado = fn(tx.objectStore(store)); } catch (e) { reject(e); return; }
    tx.oncomplete = () => resolve(resultado && 'result' in resultado ? resultado.result : undefined);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error('transação cancelada'));
  });
}
