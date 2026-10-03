// Ranking entre amigas: tela #/ranking e o card "Ranking da semana" da tela Hoje.
// Apelidos e nomes de grupo vêm de outras pessoas: SEMPRE passam por esc() antes de virar HTML.
import { esc } from '../util.js';
import { obterEstado, atualizar } from '../estado.js';
import { toast } from '../ui.js';
import {
  carregarRanking, rankingEmCache, rankingConfigurado, grupoAtual,
  ordenarRanking, formatarValor, textoIdade, ordinal, limitesPeriodo
} from '../ranking.js';
import { compartilharCard } from '../compartilhar.js';
import { dadosCardRanking } from '../cards.js';

const MEDALHAS = ['🥇', '🥈', '🥉'];
const ABAS = [
  ['pontos', 'Pontos'], ['treinos', 'Treinos'], ['cardioMin', 'Cardio (min)'], ['km', 'Km'], ['sequencia', '🔥']
];

// escolhas da tela (valem enquanto o app estiver aberto)
let periodo = 'semana';
let metrica = 'pontos';

// Mensagem quando o ranking não pode ser mostrado (motivo vem de carregarRanking)
function htmlIndisponivel(res) {
  switch (res.motivo) {
    case 'nao-configurado': return '<p class="muted" data-msg="nao-configurado">Ranking ainda não configurado.</p>';
    case 'sem-grupo': return '<p class="muted" data-msg="sem-grupo">Você ainda não está em um grupo. <a href="#/ajustes">Criar ou entrar em um grupo</a></p>';
    case 'sessao-expirada': return '<p class="muted" data-msg="sessao-expirada">Sua sessão do ranking expirou. <a href="#/ajustes">Entre no grupo de novo com o código</a></p>';
    case 'offline': return '<p class="muted" data-msg="offline">Sem conexão.</p>';
    case 'removida': return '<p class="muted" data-msg="removida">Você não está mais neste grupo.</p>';
    default: return `<p class="muted" data-msg="erro">${esc(res.mensagem || 'Não consegui carregar o ranking.')}</p>`;
  }
}

// ---------- Card "Ranking da semana" na tela Hoje ----------

function htmlPodio(res) {
  if (!res.lista.length) return '<p class="muted">Ainda sem dados.</p>';
  const eu = obterEstado().ranking?.userId;
  const top = res.lista.slice(0, 3).map((x, i) => `
    <li class="podio-item${x.userId === eu ? ' eu' : ''}" data-user="${esc(x.userId)}">
      <span class="podio-medalha" aria-hidden="true">${MEDALHAS[i]}</span>
      <span class="podio-emoji">${esc(x.emoji)}</span>
      <span class="podio-nome">${esc(x.apelido)}</span>
      <span class="podio-valor">${esc(formatarValor('pontos', x.pontos))}</span>
    </li>`).join('');
  const pos = res.lista.findIndex(x => x.userId === eu);
  const minha = pos >= 0
    ? `<p data-campo="minha-posicao">Sua posição: <strong>${ordinal(pos + 1)}</strong> · ${esc(formatarValor('pontos', res.lista[pos].pontos))}</p>` : '';
  const aviso = res.offline ? '<p class="muted" data-msg="offline">Sem conexão — últimos dados.</p>' : '';
  return `<ol class="podio">${top}</ol>${minha}${aviso}`;
}

const htmlConteudoHoje = res => (res.ok ? htmlPodio(res) : htmlIndisponivel(res));

// Só aparece com grupo (e ranking configurado). O conteúdo é preenchido em montarCardRankingHoje.
export function renderCardRankingHoje() {
  const grupo = grupoAtual();
  if (!rankingConfigurado() || !grupo) return '';
  const emCache = rankingEmCache('semana');
  return `
    <section class="card card-ranking" data-sec="ranking-semana">
      <h2 class="sec-card">Ranking da semana · ${esc(grupo.nome)}</h2>
      <div data-campo="ranking-conteudo">${emCache ? htmlConteudoHoje(emCache) : '<p class="muted">Carregando…</p>'}</div>
      <a class="btn btn-sec btn-bloco" data-acao="ver-ranking" href="#/ranking">Ver ranking</a>
    </section>`;
}

export async function montarCardRankingHoje(raiz) {
  const alvo = raiz.querySelector('[data-campo="ranking-conteudo"]');
  if (!alvo) return;
  const res = await carregarRanking('semana');
  if (!alvo.isConnected) return; // a tela mudou enquanto buscava
  if (res.motivo === 'removida') {
    toast('Você não está mais neste grupo');
    atualizar(() => {});
    return;
  }
  alvo.innerHTML = htmlConteudoHoje(res);
}

// ---------- Tela #/ranking ----------

export function render() {
  const grupo = grupoAtual();
  if (!rankingConfigurado() || !grupo) {
    return `
      <div class="tela-ranking">
        <a class="voltar" href="#/hoje">← Hoje</a>
        <h1 class="titulo">Ranking</h1>
        <section class="card">${htmlIndisponivel({ motivo: rankingConfigurado() ? 'sem-grupo' : 'nao-configurado' })}</section>
      </div>`;
  }
  const chip = (atributo, valor, rotulo, ativo) =>
    `<button type="button" class="chip${ativo ? ' chip-ativo' : ''}" data-${atributo}="${valor}" aria-pressed="${ativo}">${rotulo}</button>`;
  return `
    <div class="tela-ranking">
      <a class="voltar" href="#/hoje">← Hoje</a>
      <h1 class="titulo">Ranking</h1>
      <p class="muted">${esc(grupo.nome)}</p>
      <div class="chips" data-campo="periodos">
        ${chip('periodo', 'semana', 'Semana', periodo === 'semana')}
        ${chip('periodo', 'mes', 'Mês', periodo === 'mes')}
      </div>
      <div class="chips" data-campo="metricas">
        ${ABAS.map(([m, rotulo]) => chip('metrica', m, rotulo, metrica === m)).join('')}
      </div>
      <section class="card">
        <div data-campo="ranking-lista"><p class="muted">Carregando…</p></div>
        <p class="muted" data-campo="idade"></p>
      </section>
      <button type="button" class="btn btn-sec btn-bloco" data-acao="atualizar-ranking">Atualizar</button>
      <button type="button" class="btn btn-principal btn-bloco" data-acao="compartilhar-ranking" disabled>Compartilhar</button>
    </div>`;
}

function htmlLista(res) {
  if (!res.lista.length) return '<p class="muted">Ainda sem dados.</p>';
  const eu = obterEstado().ranking?.userId;
  return `<ol class="lista-ranking">${res.lista.map((x, i) => `
    <li class="rank-linha${x.userId === eu ? ' eu' : ''}" data-user="${esc(x.userId)}">
      <span class="rank-pos">${i < 3 ? MEDALHAS[i] : ordinal(i + 1)}</span>
      <span class="rank-emoji">${esc(x.emoji)}</span>
      <span class="rank-nome">${esc(x.apelido)}</span>
      <span class="rank-valor">${esc(formatarValor(metrica, x[metrica]))}</span>
    </li>`).join('')}</ol>`;
}

export function montar(raiz) {
  const tela = raiz.querySelector('.tela-ranking');
  const lista = tela && tela.querySelector('[data-campo="ranking-lista"]');
  if (!lista) return;
  const idade = tela.querySelector('[data-campo="idade"]');
  const compartilhar = tela.querySelector('[data-acao="compartilhar-ranking"]');
  let geracao = 0;
  let ultimo = null; // último resultado ok (para o card)

  const mostrar = res => {
    if (res.ok) {
      ultimo = res;
      lista.innerHTML = htmlLista(res);
      idade.textContent = textoIdade(Date.now() - res.atualizadoEm) + (res.offline ? ' · sem conexão' : '');
      compartilhar.disabled = false;
    } else {
      lista.innerHTML = htmlIndisponivel(res);
      idade.textContent = '';
    }
  };

  const carregar = async forcar => {
    const minha = ++geracao;
    const res = await carregarRanking(periodo, { metrica, forcar });
    if (minha !== geracao || !tela.isConnected) return;
    if (res.motivo === 'removida') {
      toast('Você não está mais neste grupo');
      atualizar(() => {});
      return;
    }
    mostrar(res);
  };

  const emCache = rankingEmCache(periodo, metrica);
  if (emCache) mostrar(emCache);
  carregar(false);

  const marcar = (atributo, valor) => tela.querySelectorAll(`[data-${atributo}]`).forEach(b => {
    const ativo = b.dataset[atributo] === valor;
    b.classList.toggle('chip-ativo', ativo);
    b.setAttribute('aria-pressed', String(ativo));
  });
  tela.querySelectorAll('[data-periodo]').forEach(b => {
    b.onclick = () => { periodo = b.dataset.periodo; marcar('periodo', periodo); carregar(false); };
  });
  tela.querySelectorAll('[data-metrica]').forEach(b => {
    b.onclick = () => { metrica = b.dataset.metrica; marcar('metrica', metrica); carregar(false); };
  });
  tela.querySelector('[data-acao="atualizar-ranking"]').onclick = () => carregar(true);
  compartilhar.onclick = () => {
    if (!ultimo) return;
    const grupo = grupoAtual();
    const { inicio, fim } = limitesPeriodo(periodo, ultimo.hoje);
    // o card é sempre por pontos, no período escolhido na tela
    const porPontos = ordenarRanking(ultimo.lista, 'pontos');
    const dados = () => dadosCardRanking({ grupo: grupo ? grupo.nome : '', periodo, lista: porPontos, hoje: ultimo.hoje, inicio, fim });
    compartilharCard(dados().titulo, dados);
  };
}
