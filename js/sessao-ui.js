// Regras da tela de treino em andamento (visual Blocos): exercício atual e controles + e −.

const pendente = it => (it?.registros || []).some(r => !r.feita);

// Exercício aberto: o guardado (se ainda tem série pendente), senão o primeiro pendente, senão o último.
export function indiceAtual(sessao, guardado) {
  const itens = sessao?.itens || [];
  if (Number.isInteger(guardado) && pendente(itens[guardado])) return guardado;
  const i = itens.findIndex(pendente);
  return i >= 0 ? i : Math.max(0, itens.length - 1);
}

const duasCasas = n => Math.round(n * 100) / 100;

// Carga vazia (null) conta como 0 (peso corporal); o "−" para no 0, nunca fica negativo.
export function ajustarCarga(carga, delta, incremento) {
  return Math.max(0, duasCasas((carga || 0) + delta * incremento));
}

export function ajustarReps(reps, delta) {
  return Math.max(1, (reps || 0) + delta);
}

// A carga da série s vale também para as séries seguintes ainda não feitas.
export function copiarCargaSeguintes(registros, s, carga) {
  registros.forEach((r, k) => { if (k > s && !r.feita) r.carga = carga; });
}

const chave = id => `treino.atual.${id}`;

export function lerIndiceGuardado(sessaoId) {
  try {
    const v = sessionStorage.getItem(chave(sessaoId));
    return v === null ? null : Number(v);
  } catch { return null; }
}

export function guardarIndice(sessaoId, i) {
  try { sessionStorage.setItem(chave(sessaoId), String(i)); } catch { /* sem sessionStorage: abre no primeiro pendente */ }
}
