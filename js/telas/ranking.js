// Ranking do grupo: tela #/ranking e o card "Ranking da semana" da tela Hoje.
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
import { avatarMembro, seloZera } from '../ranking-calculo.js';
import { flip } from '../movimento.js';
import { ic } from '../icones.js';

const ABAS = [
  ['pontos', 'Pontos'], ['treinos', 'Treinos'], ['cardioMin', 'Cardio (min)'], ['km', 'Km'], ['sequencia', 'Sequência']
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

// ---------- Bloco de pontos na tela Hoje ----------

// Texto curto da posição no grupo (só o resultado; as mensagens longas ficam na tela #/ranking).
function textoPosicaoHoje(res) {
  if (!res) return 'pontos · carregando…';
  if (!res.ok) {
    if (res.motivo === 'offline') return 'pontos · sem conexão';
    if (res.motivo === 'sessao-expirada') return 'pontos · entre no grupo de novo';
    return 'pontos na semana';
  }
  const eu = obterEstado().ranking?.userId;
  const pos = res.lista.findIndex(x => x.userId === eu);
  return pos >= 0 ? `pontos · ${ordinal(pos + 1)} no grupo` : 'pontos na semana';
}

// pontos: pontos da semana calculados no aparelho; porDia: pontos de seg a dom (barrinhas)
export function renderCardRankingHoje(pontos, porDia) {
  const max = Math.max(1, ...porDia);
  const barras = porDia.map(v =>
    `<i data-crescer class="${v ? 'on' : ''}" style="height:${v ? Math.max(18, Math.round(v / max * 100)) : 12}%"></i>`).join('');
  const comGrupo = rankingConfigurado() && !!grupoAtual();
  const conteudo = `
      <div class="num-grande num" data-contar="${pontos}">${pontos}</div>
      <div class="rotulo" data-campo="ranking-conteudo">${comGrupo ? textoPosicaoHoje(rankingEmCache('semana')) : 'pontos na semana'}</div>
      <div class="barras" aria-hidden="true">${barras}</div>`;
  if (comGrupo) {
    return `<a class="bloco bloco-sand tocavel a" data-sec="ranking-semana" data-acao="ver-ranking" href="#/ranking">${conteudo}</a>`;
  }
  const convite = rankingConfigurado() ? '<a class="link-mini" href="#/ajustes">Criar ou entrar em um grupo</a>' : '';
  return `<div class="bloco bloco-sand a" data-sec="ranking-semana">${conteudo}${convite}</div>`;
}

export async function montarCardRankingHoje(raiz) {
  const alvo = raiz.querySelector('[data-sec="ranking-semana"][href] [data-campo="ranking-conteudo"]');
  if (!alvo) return;
  const res = await carregarRanking('semana');
  if (!alvo.isConnected) return; // a tela mudou enquanto buscava
  if (res.motivo === 'removida') {
    toast('Você não está mais neste grupo');
    atualizar(() => {});
    return;
  }
  alvo.textContent = textoPosicaoHoje(res);
}

// ---------- Tela #/ranking ----------

const CORES_AVATAR = ['var(--clay)', 'var(--sky)', 'var(--sage)', 'var(--sand)'];

export function render() {
  const grupo = grupoAtual();
  const cab = (extra = '') => `
      <header class="cab-tela a"><a class="redondo tocavel" href="#/hoje" aria-label="Voltar para Hoje">${ic('volta')}</a>
        <h1 class="titulo-tela">Ranking</h1>${extra}</header>`;
  if (!rankingConfigurado() || !grupo) {
    return `
      <div class="tela-ranking">
        ${cab()}
        <div class="bloco bloco-white a">${htmlIndisponivel({ motivo: rankingConfigurado() ? 'sem-grupo' : 'nao-configurado' })}</div>
      </div>`;
  }
  const op = (atributo, valor, rotulo, ativo) =>
    `<button type="button" class="seletor-op${ativo ? ' on' : ''}" data-${atributo}="${valor}" aria-pressed="${ativo}">${rotulo}</button>`;
  return `
    <div class="tela-ranking">
      ${cab(`<button type="button" class="redondo tocavel" data-acao="atualizar-ranking" aria-label="Atualizar">${ic('gira', 'ic-gira')}</button>`)}
      <div class="bloco bloco-ink grupo-bloco a">
        <div class="rotulo"><span data-campo="grupo-nome">${esc(grupo.nome)}</span> · <span data-campo="periodo-texto">${periodo === 'mes' ? 'este mês' : 'esta semana'}</span></div>
        <div class="grupo-linha">
          <div><div class="num-grande grupo-pos num" data-campo="minha-posicao">—</div><div class="rotulo" data-campo="distancia">Carregando…</div></div>
          <span class="pilula pilula-mini selo-zera" data-campo="selo">${seloZera(periodo)}</span>
        </div>
      </div>
      <div class="seletor a" data-campo="periodos">
        ${op('periodo', 'semana', 'Semana', periodo === 'semana')}
        ${op('periodo', 'mes', 'Mês', periodo === 'mes')}
      </div>
      <div class="seletor-vidro vidro a" data-campo="metricas" role="group" aria-label="Métrica">
        ${ABAS.map(([m, rotulo]) => op('metrica', m, rotulo, metrica === m)).join('')}
      </div>
      <div class="rank a" data-campo="ranking-lista"><p class="rotulo">Carregando…</p></div>
      <p class="rotulo rank-rodape" data-campo="idade"></p>
      <p class="rotulo rank-rodape">Treino vale 10 pontos por dia. Cardio vale 1 ponto a cada 5 minutos.</p>
      <button type="button" class="btn-grande claro a" data-acao="compartilhar-ranking" disabled>${ic('share')}Compartilhar</button>
    </div>`;
}

function htmlLinha(x, i, eu, max) {
  const av = avatarMembro(x);
  // cor fixa por pessoa (não muda quando a posição muda)
  const cor = CORES_AVATAR[[...String(x.userId)].reduce((s, c) => s + c.charCodeAt(0), 0) % CORES_AVATAR.length];
  return `
    <div class="rank-linha${x.userId === eu ? ' eu' : ''}" data-chave="${esc(x.userId)}" data-user="${esc(x.userId)}">
      <span class="rank-pos num">${i + 1}</span>
      <span class="rank-av${av.tipo === 'emoji' ? ' emoji' : ''}" style="background:${x.userId === eu ? 'var(--ink)' : cor};${x.userId === eu ? 'color:#fff' : ''}">${esc(av.texto)}</span>
      <span class="rank-meio"><span class="rank-nome">${esc(x.apelido)}</span><span class="rank-barra"><b style="width:${max ? Math.round((x[metrica] || 0) / max * 100) : 0}%"></b></span></span>
      <span class="rank-valor num">${esc(formatarValor(metrica, x[metrica]))}</span>
    </div>`;
}

export function montar(raiz) {
  const tela = raiz.querySelector('.tela-ranking');
  const lista = tela && tela.querySelector('[data-campo="ranking-lista"]');
  if (!lista) return;
  const campo = n => tela.querySelector(`[data-campo="${n}"]`);
  const compartilhar = tela.querySelector('[data-acao="compartilhar-ranking"]');
  let geracao = 0;
  let ultimo = null; // último resultado ok (para o card)

  // bloco grafite: posição sempre em pontos (a classificação oficial)
  const mostrarPosicao = res => {
    const eu = obterEstado().ranking?.userId;
    const porPontos = ordenarRanking(res.lista, 'pontos');
    const pos = porPontos.findIndex(x => x.userId === eu);
    const elPos = campo('minha-posicao');
    if (pos < 0) { elPos.textContent = '—'; campo('distancia').textContent = 'Você ainda não pontuou'; return; }
    elPos.innerHTML = `${pos + 1}<small>º lugar</small>`;
    const eu1 = porPontos[pos];
    campo('distancia').textContent = pos === 0
      ? (porPontos.length > 1 ? `${porPontos[0].pontos - porPontos[1].pontos} pontos na frente` : 'Liderando o grupo')
      : `${porPontos[pos - 1].pontos - eu1.pontos} pontos atrás de ${porPontos[pos - 1].apelido}`;
  };

  const mostrar = (res, animar) => {
    if (res.ok) {
      ultimo = res;
      const eu = obterEstado().ranking?.userId;
      const max = Math.max(0, ...res.lista.map(x => x[metrica] || 0));
      const html = res.lista.length ? res.lista.map((x, i) => htmlLinha(x, i, eu, max)).join('') : '<p class="rotulo">Ainda sem dados.</p>';
      if (animar) flip(lista, () => { lista.innerHTML = html; });
      else lista.innerHTML = html;
      mostrarPosicao(res);
      campo('idade').textContent = textoIdade(Date.now() - res.atualizadoEm) + (res.offline ? ' · sem conexão' : '');
      compartilhar.disabled = false;
    } else {
      lista.innerHTML = htmlIndisponivel(res);
      campo('idade').textContent = '';
      campo('distancia').textContent = '';
    }
  };

  const carregar = async (forcar, animar = false) => {
    const minha = ++geracao;
    const res = await carregarRanking(periodo, { metrica, forcar });
    if (minha !== geracao || !tela.isConnected) return;
    if (res.motivo === 'removida') {
      toast('Você não está mais neste grupo');
      atualizar(() => {});
      return;
    }
    mostrar(res, animar);
  };

  const emCache = rankingEmCache(periodo, metrica);
  if (emCache) mostrar(emCache, false);
  carregar(false);

  const marcar = (atributo, valor) => tela.querySelectorAll(`[data-${atributo}]`).forEach(b => {
    const ativo = b.dataset[atributo] === valor;
    b.classList.toggle('on', ativo);
    b.setAttribute('aria-pressed', String(ativo));
  });
  tela.querySelectorAll('[data-periodo]').forEach(b => {
    b.onclick = () => {
      periodo = b.dataset.periodo; marcar('periodo', periodo);
      campo('selo').textContent = seloZera(periodo);
      campo('periodo-texto').textContent = periodo === 'mes' ? 'este mês' : 'esta semana';
      carregar(false, true);
    };
  });
  tela.querySelectorAll('[data-metrica]').forEach(b => {
    b.onclick = () => { metrica = b.dataset.metrica; marcar('metrica', metrica); carregar(false, true); };
  });
  tela.querySelector('[data-acao="atualizar-ranking"]').onclick = ev => {
    const icone = ev.currentTarget.querySelector('svg');
    icone?.animate?.([{ transform: 'rotate(0)' }, { transform: 'rotate(360deg)' }], { duration: 700, easing: 'cubic-bezier(.4,0,.2,1)' });
    carregar(true, true);
  };
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
