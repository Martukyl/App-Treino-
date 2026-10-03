// Cliente mínimo do Supabase por REST (fetch), sem SDK. Fábrica injetável para testar no Node:
// recebe fetch, relógio e acesso ao estado `ranking` (ler/gravar), então não toca DOM nem localStorage.
// Erros viram ErroRanking: { offline } (rede, timeout, servidor fora), { sessaoInvalida } (§4.4)
// ou erro comum com a mensagem do servidor (ex.: o texto do `raise exception` de uma RPC).

export const MSG_SESSAO_EXPIRADA = 'Sua sessão do ranking expirou. Entre no grupo de novo com o código.';
export const MSG_OFFLINE = 'Sem conexão. Tente de novo.';

export class ErroRanking extends Error {
  constructor(mensagem, { offline = false, sessaoInvalida = false, status = 0 } = {}) {
    super(mensagem);
    this.name = 'ErroRanking';
    this.offline = offline;
    this.sessaoInvalida = sessaoInvalida;
    this.status = status;
  }
}

const FOLGA_MS = 60 * 1000; // renova o access token 60 s antes de expirar
const TAMANHO_PAGINA = 500; // abaixo do limite padrão de linhas do PostgREST (1000)
const MAX_PAGINAS = 20;

// extrai a mensagem de erro de respostas do PostgREST (message) e do GoTrue (msg / error_description)
function mensagemDe(dados, status) {
  if (dados && typeof dados === 'object') {
    const m = dados.message || dados.msg || dados.error_description || dados.error;
    if (typeof m === 'string' && m) return m;
  }
  return `Erro ${status} no servidor do ranking.`;
}

// ler(): estado `ranking` atual (ou null). gravar(fn): estado.ranking = fn(estado.ranking), com salvamento.
export function criarCliente({ url, chave, fetch: fetchFn, agora = Date.now, ler, gravar, timeoutMs = 10000 }) {
  const base = String(url || '').replace(/\/+$/, '');
  let acesso = null; // access token só em memória
  let expiraEm = 0;
  let renovando = null; // promessa compartilhada: uma renovação por vez

  const configurado = () => !!(base && chave);

  // uma chamada HTTP com timeout; qualquer falha de rede/timeout vira { offline: true }
  async function bruto(caminho, { metodo = 'GET', corpo, headers = {} } = {}) {
    const controle = new AbortController();
    const timer = setTimeout(() => controle.abort(), timeoutMs);
    try {
      const res = await fetchFn(`${base}${caminho}`, {
        method: metodo,
        headers: { apikey: chave, 'Content-Type': 'application/json', ...headers },
        body: corpo === undefined ? undefined : JSON.stringify(corpo),
        signal: controle.signal
      });
      const texto = await res.text();
      let dados = null;
      if (texto) { try { dados = JSON.parse(texto); } catch { dados = null; } }
      return { status: res.status, ok: res.ok, dados };
    } catch {
      throw new ErroRanking(MSG_OFFLINE, { offline: true });
    } finally {
      clearTimeout(timer);
    }
  }

  function guardarSessao(dados) {
    acesso = dados.access_token;
    expiraEm = dados.expires_at
      ? dados.expires_at * 1000
      : agora() + (Number(dados.expires_in) || 3600) * 1000;
    gravar(r => ({
      grupo: null, apelido: '', emoji: '💪', criador: false,
      ...(r || {}),
      userId: dados.user?.id ?? r?.userId ?? null,
      refreshToken: dados.refresh_token ?? r?.refreshToken ?? null
    }));
  }

  // §4.4: refresh rejeitado — limpa a sessão (mantém apelido/emoji/grupo para pré-preencher)
  function invalidarSessao() {
    acesso = null;
    expiraEm = 0;
    gravar(r => (r ? { ...r, userId: null, refreshToken: null } : r));
    return new ErroRanking(MSG_SESSAO_EXPIRADA, { sessaoInvalida: true });
  }

  async function entrarAnonimo() {
    const r = await bruto('/auth/v1/signup', { metodo: 'POST', corpo: {} });
    if (!r.ok || !r.dados || !r.dados.access_token || !r.dados.refresh_token) {
      if (r.status >= 500 || r.status === 429) throw new ErroRanking(MSG_OFFLINE, { offline: true, status: r.status });
      throw new ErroRanking(mensagemDe(r.dados, r.status), { status: r.status });
    }
    guardarSessao(r.dados);
    return r.dados.user?.id ?? null;
  }

  function renovar() {
    if (!renovando) {
      renovando = (async () => {
        const rt = ler()?.refreshToken;
        if (!rt) throw invalidarSessao();
        const r = await bruto('/auth/v1/token?grant_type=refresh_token', { metodo: 'POST', corpo: { refresh_token: rt } });
        if (r.ok && r.dados && r.dados.access_token) {
          guardarSessao(r.dados); // guarda o refresh token rotacionado
          return acesso;
        }
        if ([400, 401, 403].includes(r.status)) throw invalidarSessao();
        if (r.status >= 500 || r.status === 429) throw new ErroRanking(MSG_OFFLINE, { offline: true, status: r.status });
        throw new ErroRanking(mensagemDe(r.dados, r.status), { status: r.status });
      })().finally(() => { renovando = null; });
    }
    return renovando;
  }

  // access token válido (renova quando ausente ou a menos de 60 s de expirar)
  async function token() {
    if (acesso && expiraEm - FOLGA_MS > agora()) return acesso;
    return renovar();
  }

  // requisição autenticada; um 401 força uma renovação e uma nova tentativa
  async function autenticada(caminho, opcoes = {}, tentativa = 0) {
    const tk = await token();
    const r = await bruto(caminho, { ...opcoes, headers: { ...(opcoes.headers || {}), Authorization: `Bearer ${tk}` } });
    if (r.status === 401) {
      if (tentativa >= 1) throw invalidarSessao();
      acesso = null;
      expiraEm = 0;
      return autenticada(caminho, opcoes, tentativa + 1);
    }
    if (!r.ok) {
      const offline = r.status >= 500 || r.status === 429;
      throw new ErroRanking(offline ? MSG_OFFLINE : mensagemDe(r.dados, r.status), { offline, status: r.status });
    }
    return r;
  }

  // chama uma função do banco (argumentos nomeados: p_nome, p_apelido, ...)
  async function rpc(nome, args = {}) {
    const r = await autenticada(`/rest/v1/rpc/${encodeURIComponent(nome)}`, { metodo: 'POST', corpo: args });
    return r.dados;
  }

  async function selecionar(tabela, query = '') {
    const r = await autenticada(`/rest/v1/${encodeURIComponent(tabela)}${query ? `?${query}` : ''}`);
    return Array.isArray(r.dados) ? r.dados : [];
  }

  // select paginado (limit/offset) para passar de 1000 linhas; `query` deve ter order estável
  async function selecionarTudo(tabela, query = '') {
    const todas = [];
    for (let p = 0; p < MAX_PAGINAS; p++) {
      const lote = await selecionar(tabela, `${query}${query ? '&' : ''}limit=${TAMANHO_PAGINA}&offset=${p * TAMANHO_PAGINA}`);
      todas.push(...lote);
      if (lote.length < TAMANHO_PAGINA) break;
    }
    return todas;
  }

  // upsert dos totais diários (linhas já com user_id)
  async function upsertDias(linhas) {
    await autenticada('/rest/v1/dias?on_conflict=user_id,data', {
      metodo: 'POST',
      corpo: linhas,
      headers: { Prefer: 'resolution=merge-duplicates,return=minimal' }
    });
  }

  // PATCH numa tabela (ex.: apelido/emoji do próprio membro)
  async function alterar(tabela, query, corpo) {
    await autenticada(`/rest/v1/${encodeURIComponent(tabela)}?${query}`, {
      metodo: 'PATCH', corpo, headers: { Prefer: 'return=minimal' }
    });
  }

  return { configurado, entrarAnonimo, token, rpc, selecionar, selecionarTudo, upsertDias, alterar };
}
