// Persistência do estado em localStorage, migração e backup.
// carregar/salvar recebem o storage por parâmetro para poderem ser testados no Node.
import { exerciciosPadrao, treinosPadrao } from './dados.js';

export const CHAVE = 'appTreino.v1';
export const VERSAO = 3;

const copiar = obj => JSON.parse(JSON.stringify(obj));

export function estadoInicial() {
  return {
    versao: VERSAO,
    exercicios: copiar(exerciciosPadrao),
    treinos: copiar(treinosPadrao),
    sessoes: [],
    sessaoAtual: null,
    ultimoTreinoId: null,
    nome: '',
    perfil: { altura: null, nascimento: null, metaPeso: null, fotoId: null },
    medidas: [],
    cardios: [],
    cardioAtual: null,
    // instalação nova: mostra as boas-vindas antes de tudo (estados antigos migram com false)
    boasVindasPendente: true,
    // ranking entre amigas (Supabase): null = nunca usou; ver normalizarRanking
    ranking: null
  };
}

// Valida/normaliza o bloco `ranking` do estado: { userId, refreshToken, grupo, apelido, emoji, criador } ou null.
export function normalizarRanking(r) {
  if (!r || typeof r !== 'object' || Array.isArray(r)) return null;
  const texto = (v, max) => (typeof v === 'string' ? v.slice(0, max) : '');
  const g = r.grupo;
  const grupo = g && typeof g === 'object' && typeof g.codigo === 'string' && g.codigo
    ? { codigo: g.codigo.slice(0, 12), nome: texto(g.nome, 40) } : null;
  return {
    userId: typeof r.userId === 'string' && r.userId ? r.userId : null,
    refreshToken: typeof r.refreshToken === 'string' && r.refreshToken ? r.refreshToken : null,
    grupo,
    apelido: texto(r.apelido, 20),
    emoji: texto(r.emoji, 8) || '💪',
    criador: r.criador === true && !!grupo
  };
}

// Ponto único de atualização do formato salvo.
export function migrar(estado) {
  const e = { ...estado, exercicios: { ...(estado.exercicios || {}) } };
  for (const [id, ex] of Object.entries(exerciciosPadrao)) {
    if (!e.exercicios[id]) e.exercicios[id] = copiar(ex);
  }
  if (!Array.isArray(e.treinos)) e.treinos = copiar(treinosPadrao);
  if (!Array.isArray(e.sessoes)) e.sessoes = [];
  if (e.sessaoAtual === undefined) e.sessaoAtual = null;
  if (e.ultimoTreinoId === undefined) e.ultimoTreinoId = null;
  if (typeof e.nome !== 'string') e.nome = '';
  const p = e.perfil && typeof e.perfil === 'object' && !Array.isArray(e.perfil) ? e.perfil : {};
  e.perfil = {
    ...p, altura: p.altura ?? null, nascimento: p.nascimento ?? null,
    metaPeso: p.metaPeso ?? null, fotoId: p.fotoId ?? null
  };
  if (!Array.isArray(e.medidas)) e.medidas = [];
  if (!Array.isArray(e.cardios)) e.cardios = [];
  if (e.cardioAtual === undefined) e.cardioAtual = null;
  // quem já usava o app (campo ausente) não vê as boas-vindas
  if (typeof e.boasVindasPendente !== 'boolean') e.boasVindasPendente = false;
  e.ranking = normalizarRanking(e.ranking);
  delete e.trajetos; // os trajetos do backup vão para o IndexedDB, nunca para o estado
  delete e.fotos; // as fotos do backup vão para o IndexedDB, nunca para o estado
  e.versao = VERSAO;
  return e;
}

export function validarBackup(obj) {
  if (!obj || typeof obj !== 'object') return { ok: false, erro: 'Arquivo vazio ou inválido.' };
  if (typeof obj.versao !== 'number') return { ok: false, erro: 'Campo versao ausente ou inválido.' };
  if (!obj.exercicios || typeof obj.exercicios !== 'object' || Array.isArray(obj.exercicios)) {
    return { ok: false, erro: 'Campo exercicios ausente ou inválido.' };
  }
  if (!Array.isArray(obj.treinos)) return { ok: false, erro: 'Campo treinos ausente ou inválido.' };
  if (!Array.isArray(obj.sessoes)) return { ok: false, erro: 'Campo sessoes ausente ou inválido.' };
  if (obj.medidas !== undefined && !Array.isArray(obj.medidas)) {
    return { ok: false, erro: 'Campo medidas ausente ou inválido.' };
  }
  if (obj.cardios !== undefined && !Array.isArray(obj.cardios)) {
    return { ok: false, erro: 'Campo cardios ausente ou inválido.' };
  }
  return { ok: true };
}

export function carregar(storage = globalThis.localStorage) {
  let bruto;
  try {
    if (!storage) throw new Error('sem storage');
    bruto = storage.getItem(CHAVE);
  } catch {
    return { estado: estadoInicial(), aviso: 'indisponivel' };
  }
  if (bruto == null) return { estado: estadoInicial(), aviso: null };
  try {
    const obj = JSON.parse(bruto);
    if (!validarBackup(obj).ok) throw new Error('formato inválido');
    return { estado: migrar(obj), aviso: null };
  } catch {
    try { storage.setItem(CHAVE + '.corrompido', bruto); } catch { /* sem espaço: segue sem guardar */ }
    return { estado: estadoInicial(), aviso: 'corrompido' };
  }
}

export function salvar(estado, storage = globalThis.localStorage) {
  try {
    if (!storage) return false;
    storage.setItem(CHAVE, JSON.stringify(estado));
    return true;
  } catch {
    return false;
  }
}

// Volta os treinos A–E ao padrão, mantendo histórico e exercícios.
export function restaurarTreinosPadrao(estado) {
  return { ...estado, treinos: copiar(treinosPadrao) };
}
