// Ranking entre amigas — cola do app: sincroniza os totais diários, carrega o ranking do grupo
// e executa as ações do grupo (criar, entrar, sair, remover, editar perfil).
// Tudo é assíncrono e silencioso quando offline ou não configurado: nunca bloqueia a interface.
import { obterEstado, atualizar } from './estado.js';
import { hojeISO } from './util.js';
import { toast } from './ui.js';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config-ranking.js';
import { criarCliente } from './supabase.js';
import {
  agregarUltimosDias, calcularRanking, inicioBusca, ordenarRanking, DIAS_SINCRONIZADOS
} from './ranking-calculo.js';

export * from './ranking-calculo.js';

const ESPERA_SYNC_MS = 3000;
const VALIDADE_CACHE_MS = 60 * 1000;

const mudarRanking = fn => atualizar(e => { e.ranking = fn(e.ranking); }, { renderizar: false });

const cliente = criarCliente({
  url: SUPABASE_URL,
  chave: SUPABASE_ANON_KEY,
  fetch: (...args) => globalThis.fetch(...args),
  agora: () => Date.now(),
  ler: () => obterEstado().ranking,
  gravar: mudarRanking
});

export const rankingConfigurado = () => cliente.configurado();
export const grupoAtual = () => obterEstado().ranking?.grupo || null;
export const temSessao = () => !!(obterEstado().ranking?.userId && obterEstado().ranking?.refreshToken);
// grupo guardado, mas a sessão se perdeu (§4.4): precisa entrar de novo com o código
export const sessaoExpirada = () => !!grupoAtual() && !temSessao();

const online = () => globalThis.navigator?.onLine !== false;

// ---------- Sincronização (publicar os totais dos últimos 35 dias) ----------

let temporizador = null;
let sincronizando = false;
let repetir = false;

async function executarSincronizacao() {
  temporizador = null;
  if (sincronizando) { repetir = true; return; }
  if (!rankingConfigurado() || !grupoAtual() || !temSessao() || !online()) return;
  sincronizando = true;
  try {
    const est = obterEstado();
    const userId = est.ranking.userId;
    const linhas = agregarUltimosDias(est.sessoes, est.cardios, hojeISO(), DIAS_SINCRONIZADOS)
      .map(l => ({ user_id: userId, ...l }));
    await cliente.upsertDias(linhas);
    cache = null; // os totais mudaram: a próxima leitura busca de novo
  } catch (erro) {
    // offline: silencioso (tenta na próxima chamada); sessão perdida: avisa uma vez
    if (erro && erro.sessaoInvalida) toast(erro.mensagem);
  } finally {
    sincronizando = false;
    if (repetir) { repetir = false; sincronizarRanking(); }
  }
}

// Agenda a publicação (debounce de 3 s). `imediato`: sem espera (ao entrar/criar grupo).
export function sincronizarRanking({ imediato = false } = {}) {
  if (!rankingConfigurado() || !grupoAtual() || !temSessao()) return;
  clearTimeout(temporizador);
  temporizador = setTimeout(executarSincronizacao, imediato ? 0 : ESPERA_SYNC_MS);
}

// ---------- Leitura do ranking ----------

// cache bruto em memória (60 s): { chave, em, hoje, membros, dias, criadoPor }
let cache = null;
let emVoo = null; // { chave, promessa }

const chaveCache = () => {
  const r = obterEstado().ranking;
  return r?.grupo ? `${r.userId}|${r.grupo.codigo}` : null;
};

async function buscarDados(forcar) {
  const chave = chaveCache();
  if (!forcar && cache && cache.chave === chave && Date.now() - cache.em < VALIDADE_CACHE_MS) return cache;
  if (emVoo && emVoo.chave === chave) return emVoo.promessa;
  const promessa = (async () => {
    const hoje = hojeISO();
    const inicio = inicioBusca(hoje);
    const [membros, grupos, dias] = await Promise.all([
      cliente.selecionar('membros', 'select=user_id,apelido,emoji&order=entrou_em.asc,user_id.asc'),
      cliente.selecionar('grupos', 'select=codigo,nome,criado_por'),
      cliente.selecionarTudo('dias', `select=user_id,data,treinos,cardio_min,km,pontos&data=gte.${inicio}&order=user_id.asc,data.asc`)
    ]);
    const r = obterEstado().ranking;
    const dados = { chave, em: Date.now(), hoje, inicio, membros, dias, criadoPor: null, removida: false };
    if (!membros.some(m => m.user_id === r.userId)) {
      // a criadora me removeu (ou o grupo acabou): volta ao estado "sem grupo"
      dados.removida = true;
      cache = null;
      mudarRanking(x => (x ? { ...x, grupo: null, criador: false } : x));
      return dados;
    }
    const g = grupos.find(x => x.codigo === r.grupo.codigo);
    if (g) {
      dados.criadoPor = g.criado_por;
      const criador = g.criado_por === r.userId;
      if (criador !== r.criador || g.nome !== r.grupo.nome) {
        mudarRanking(x => (x ? { ...x, criador, grupo: { ...x.grupo, nome: g.nome } } : x));
      }
    }
    cache = dados;
    return dados;
  })().finally(() => { emVoo = null; });
  emVoo = { chave, promessa };
  return promessa;
}

// Dias do servidor com as linhas do próprio aparelho por cima (os meus totais são sempre os locais,
// assim o ranking não espera a sincronização para mostrar o que acabei de fazer).
function diasComLocais(dados) {
  const est = obterEstado();
  const meu = est.ranking?.userId;
  const locais = agregarUltimosDias(est.sessoes, est.cardios, dados.hoje, DIAS_SINCRONIZADOS)
    .map(l => ({ user_id: meu, ...l }));
  const primeiro = locais[0].data;
  return dados.dias.filter(d => d.user_id !== meu || d.data < primeiro).concat(locais);
}

// Ranking do período ('semana' | 'mes'), ordenado por `metrica`.
// → { ok: true, lista, atualizadoEm, offline, hoje } | { ok: false, motivo, mensagem? }
// motivos: 'nao-configurado' | 'sem-grupo' | 'sessao-expirada' | 'offline' | 'removida' | 'erro'
export async function carregarRanking(periodo, { metrica = 'pontos', forcar = false } = {}) {
  if (!rankingConfigurado()) return { ok: false, motivo: 'nao-configurado' };
  if (!grupoAtual()) return { ok: false, motivo: 'sem-grupo' };
  if (!temSessao()) return { ok: false, motivo: 'sessao-expirada' };
  let dados;
  let offline = false;
  try {
    dados = await buscarDados(forcar);
  } catch (erro) {
    if (erro && erro.sessaoInvalida) return { ok: false, motivo: 'sessao-expirada', mensagem: erro.mensagem };
    if (cache && cache.chave === chaveCache()) { dados = cache; offline = !!(erro && erro.offline); }
    else if (erro && erro.offline) return { ok: false, motivo: 'offline' };
    else return { ok: false, motivo: 'erro', mensagem: erro && erro.message };
  }
  if (dados.removida) return { ok: false, motivo: 'removida' };
  const lista = ordenarRanking(calcularRanking(dados.membros, diasComLocais(dados), dados.hoje, periodo), metrica);
  return { ok: true, lista, atualizadoEm: dados.em, offline, hoje: dados.hoje };
}

// Último ranking em memória, sem rede (a tela Hoje desenha isso antes da busca terminar)
export function rankingEmCache(periodo, metrica = 'pontos') {
  if (!cache || cache.chave !== chaveCache() || cache.removida) return null;
  const lista = ordenarRanking(calcularRanking(cache.membros, diasComLocais(cache), cache.hoje, periodo), metrica);
  return { ok: true, lista, atualizadoEm: cache.em, offline: false, hoje: cache.hoje };
}

// Membros do grupo para a tela Ajustes → { ok, membros: [{ userId, apelido, emoji, eu }], criadoPor }
export async function listarMembros() {
  try {
    const dados = await buscarDados(false);
    if (dados.removida) return { ok: false, motivo: 'removida' };
    const eu = obterEstado().ranking.userId;
    return {
      ok: true, criadoPor: dados.criadoPor,
      membros: dados.membros.map(m => ({ userId: m.user_id, apelido: m.apelido, emoji: m.emoji, eu: m.user_id === eu }))
    };
  } catch (erro) {
    return { ok: false, motivo: erro && erro.offline ? 'offline' : 'erro', mensagem: erro && erro.message };
  }
}

// ---------- Ações do grupo (lançam ErroRanking: mostrar erro.message no toast) ----------

async function garantirSessao() {
  if (!temSessao()) await cliente.entrarAnonimo();
}

function aoEntrar(grupo, apelido, emoji, criador) {
  cache = null;
  mudarRanking(r => ({
    ...(r || {}), userId: r?.userId ?? null, refreshToken: r?.refreshToken ?? null,
    grupo, apelido, emoji, criador
  }));
  sincronizarRanking({ imediato: true });
}

export async function criarGrupo({ nome, apelido, emoji }) {
  await garantirSessao();
  const codigo = await cliente.rpc('criar_grupo', { p_nome: nome, p_apelido: apelido, p_emoji: emoji });
  aoEntrar({ codigo, nome }, apelido, emoji, true);
  return codigo;
}

export async function entrarGrupo({ codigo, apelido, emoji }) {
  await garantirSessao();
  const nome = await cliente.rpc('entrar_grupo', { p_codigo: codigo, p_apelido: apelido, p_emoji: emoji });
  aoEntrar({ codigo, nome: typeof nome === 'string' ? nome : '' }, apelido, emoji, false);
}

export async function sairGrupo() {
  await cliente.rpc('sair_grupo');
  cache = null;
  mudarRanking(r => (r ? { ...r, grupo: null, criador: false } : r));
}

// sessão perdida: só esquece o grupo neste aparelho (a conta antiga vira "fantasma" no grupo)
export function esquecerGrupo() {
  cache = null;
  mudarRanking(r => (r ? { ...r, grupo: null, criador: false } : r));
}

export async function removerMembro(userId) {
  await cliente.rpc('remover_membro', { p_user: userId });
  cache = null;
}

export async function editarPerfil({ apelido, emoji }) {
  const r = obterEstado().ranking;
  if (r?.userId) {
    await cliente.alterar('membros', `user_id=eq.${encodeURIComponent(r.userId)}`, { apelido, emoji });
  }
  cache = null;
  mudarRanking(x => (x ? { ...x, apelido, emoji } : x));
}
