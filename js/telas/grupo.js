// Card "Grupo" em Ajustes: criar/entrar com código, convidar, editar apelido/emoji, sair e remover membro.
// Apelidos e nomes de grupo vêm de outras pessoas: SEMPRE passam por esc() antes de virar HTML.
import { esc } from '../util.js';
import { obterEstado, atualizar } from '../estado.js';
import { abrirSheet, fecharSheet, confirmar, toast } from '../ui.js';
import {
  rankingConfigurado, sessaoExpirada, criarGrupo, entrarGrupo, sairGrupo, esquecerGrupo,
  removerMembro, editarPerfil, listarMembros, normalizarApelido, normalizarCodigo, CODIGO_VALIDO
} from '../ranking.js';
import { compartilharTexto } from '../compartilhar.js';

export const EMOJIS = ['💪', '🔥', '🏋️', '🏃', '🚴', '🧘', '⚡', '🌟', '🦁', '🐯', '🦊', '🐼', '🍑', '🏆', '🚀', '🌈'];

const mensagemDe = erro => (erro && erro.message) || 'Algo deu errado. Tente de novo.';

// ---------- Card em Ajustes ----------

export function renderGrupo() {
  if (!rankingConfigurado()) {
    return `
      <section class="card" data-sec="grupo">
        <h2 class="sec-card">Grupo</h2>
        <p class="muted" data-msg="nao-configurado">Ranking ainda não configurado.</p>
      </section>`;
  }
  const r = obterEstado().ranking;
  const grupo = r && r.grupo;
  if (!grupo) {
    return `
      <section class="card" data-sec="grupo">
        <h2 class="sec-card">Grupo</h2>
        <p class="muted">Compare seus pontos com os das amigas. Só totais por dia saem do aparelho (nada de fotos, medidas ou exercícios).</p>
        <button type="button" class="btn btn-principal btn-bloco" data-acao="criar-grupo">Criar grupo</button>
        <button type="button" class="btn btn-sec btn-bloco" data-acao="entrar-grupo">Entrar com código</button>
      </section>`;
  }
  if (sessaoExpirada()) {
    return `
      <section class="card" data-sec="grupo">
        <h2 class="sec-card">Grupo · ${esc(grupo.nome)}</h2>
        <p class="selo-warn" data-msg="sessao-expirada">Sua sessão do ranking expirou. Entre no grupo de novo com o código.</p>
        <p class="grupo-codigo" data-campo="codigo-grupo">${esc(grupo.codigo)}</p>
        <button type="button" class="btn btn-principal btn-bloco" data-acao="entrar-grupo">Entrar de novo</button>
        <button type="button" class="btn btn-sec btn-bloco" data-acao="esquecer-grupo">Esquecer este grupo</button>
      </section>`;
  }
  return `
    <section class="card" data-sec="grupo">
      <h2 class="sec-card">Grupo</h2>
      <p class="grupo-nome" data-campo="nome-grupo">${esc(grupo.nome)}</p>
      <p class="muted">Código de convite</p>
      <p class="grupo-codigo" data-campo="codigo-grupo">${esc(grupo.codigo)}</p>
      <button type="button" class="btn btn-principal btn-bloco" data-acao="convidar">Convidar</button>
      <p class="muted grupo-eu">Você aparece como ${esc(r.emoji)} <strong>${esc(r.apelido)}</strong></p>
      <button type="button" class="btn btn-sec btn-bloco" data-acao="editar-perfil">Editar apelido e emoji</button>
      <h3 class="sec-card sec-exercicios">Membros</h3>
      <ul class="lista-membros" data-campo="lista-membros"><li class="muted">Carregando…</li></ul>
      <button type="button" class="btn btn-perigo btn-bloco" data-acao="sair-grupo">Sair do grupo</button>
    </section>`;
}

function htmlMembros(res) {
  if (!res.ok) {
    return `<li class="muted">${res.motivo === 'offline' ? 'Sem conexão.' : esc(res.mensagem || 'Não consegui carregar os membros.')}</li>`;
  }
  const souCriadora = res.criadoPor && res.membros.some(m => m.eu && m.userId === res.criadoPor);
  return res.membros.map(m => `
    <li class="membro-linha" data-user="${esc(m.userId)}">
      <span class="membro-emoji">${esc(m.emoji)}</span>
      <span class="membro-nome">${esc(m.apelido)}${m.eu ? ' <span class="muted">(você)</span>' : ''}${m.userId === res.criadoPor ? ' <span title="Criou o grupo">👑</span>' : ''}</span>
      ${souCriadora && !m.eu ? `<button type="button" class="btn btn-sec btn-mini" data-acao="remover-membro" data-user="${esc(m.userId)}" data-apelido="${esc(m.apelido)}">Remover</button>` : ''}
    </li>`).join('');
}

// ---------- Formulário em sheet ----------

function htmlEmojis(selecionado) {
  return `<div class="emoji-grade" data-campo="emojis" role="group" aria-label="Emoji">${EMOJIS.map(e =>
    `<button type="button" class="emoji-op${e === selecionado ? ' sel' : ''}" data-emoji="${e}" aria-pressed="${e === selecionado}">${e}</button>`
  ).join('')}</div>`;
}

// Abre um formulário em sheet. aoEnviar(valores) pode lançar: a mensagem aparece no próprio formulário.
function abrirFormulario({ titulo, campos, emojiInicial, textoOk, aoEnviar }) {
  abrirSheet(`
    <h2 class="sheet-titulo">${esc(titulo)}</h2>
    ${campos}
    <label>Emoji</label>
    ${htmlEmojis(emojiInicial)}
    <p class="form-erro" data-campo="erro" hidden></p>
    <div class="sheet-acoes">
      <button type="button" class="btn btn-sec" data-acao="cancelar">Cancelar</button>
      <button type="button" class="btn btn-principal" data-acao="enviar">${esc(textoOk)}</button>
    </div>`, el => {
    let emoji = emojiInicial;
    const erro = el.querySelector('[data-campo="erro"]');
    const enviar = el.querySelector('[data-acao="enviar"]');
    el.querySelectorAll('[data-emoji]').forEach(b => {
      b.onclick = () => {
        emoji = b.dataset.emoji;
        el.querySelectorAll('[data-emoji]').forEach(o => {
          o.classList.toggle('sel', o === b);
          o.setAttribute('aria-pressed', String(o === b));
        });
      };
    });
    el.querySelector('[data-acao="cancelar"]').onclick = fecharSheet;
    enviar.onclick = async () => {
      const valor = campo => (el.querySelector(`[data-campo="${campo}"]`) || {}).value || '';
      erro.hidden = true;
      enviar.disabled = true;
      try {
        await aoEnviar({ valor, emoji });
      } catch (e) {
        erro.textContent = mensagemDe(e);
        erro.hidden = false;
        enviar.disabled = false;
      }
    };
  });
}

const apelidoInicial = () => obterEstado().ranking?.apelido || '';
const emojiInicial = () => obterEstado().ranking?.emoji || '💪';

function validarApelido(txt) {
  const a = normalizarApelido(txt);
  if (a.length < 1 || a.length > 20) throw new Error('Escolha um apelido de 1 a 20 caracteres.');
  return a;
}

const camposApelido = () => `
  <label>Apelido (aparece no ranking)
    <input type="text" data-campo="apelido" maxlength="20" autocomplete="off" value="${esc(apelidoInicial())}">
  </label>`;

function abrirCriar() {
  abrirFormulario({
    titulo: 'Criar grupo',
    campos: `
      <label>Nome do grupo
        <input type="text" data-campo="nome" maxlength="40" autocomplete="off">
      </label>${camposApelido()}`,
    emojiInicial: emojiInicial(),
    textoOk: 'Criar',
    aoEnviar: async ({ valor, emoji }) => {
      const nome = valor('nome').trim();
      if (nome.length < 1 || nome.length > 40) throw new Error('Dê um nome ao grupo (até 40 caracteres).');
      const apelido = validarApelido(valor('apelido'));
      await criarGrupo({ nome, apelido, emoji });
      fecharSheet();
      toast('Grupo criado');
      atualizar(() => {});
    }
  });
}

function abrirEntrar() {
  const guardado = obterEstado().ranking?.grupo?.codigo || ''; // sessão perdida: pré-preenche o código
  abrirFormulario({
    titulo: 'Entrar com código',
    campos: `
      <label>Código do grupo
        <input type="text" data-campo="codigo" maxlength="12" autocomplete="off" autocapitalize="characters" value="${esc(guardado)}">
      </label>${camposApelido()}`,
    emojiInicial: emojiInicial(),
    textoOk: 'Entrar',
    aoEnviar: async ({ valor, emoji }) => {
      const codigo = normalizarCodigo(valor('codigo'));
      if (!CODIGO_VALIDO.test(codigo)) throw new Error('Código inválido. Ele tem 6 letras ou números.');
      const apelido = validarApelido(valor('apelido'));
      await entrarGrupo({ codigo, apelido, emoji });
      fecharSheet();
      toast('Você entrou no grupo');
      atualizar(() => {});
    }
  });
}

function abrirEditar() {
  abrirFormulario({
    titulo: 'Editar apelido e emoji',
    campos: camposApelido,
    emojiInicial: emojiInicial(),
    textoOk: 'Salvar',
    aoEnviar: async ({ valor, emoji }) => {
      const apelido = validarApelido(valor('apelido'));
      await editarPerfil({ apelido, emoji });
      fecharSheet();
      toast('Perfil atualizado');
      atualizar(() => {});
    }
  });
}

// ---------- Ligações ----------

export function montarGrupo(tela) {
  const q = seletor => tela.querySelector(seletor);
  const aoClicar = (acao, fn) => { const el = q(`[data-acao="${acao}"]`); if (el) el.onclick = fn; };

  aoClicar('criar-grupo', abrirCriar);
  aoClicar('entrar-grupo', abrirEntrar);
  aoClicar('editar-perfil', abrirEditar);
  aoClicar('esquecer-grupo', async () => {
    if (!(await confirmar('Esquecer este grupo neste aparelho? Depois você pode entrar de novo com o código.', 'Esquecer', true))) return;
    esquecerGrupo();
    atualizar(() => {});
  });
  aoClicar('convidar', () => {
    const grupo = obterEstado().ranking?.grupo;
    if (!grupo) return;
    const url = location.origin + location.pathname;
    compartilharTexto(`Entra no nosso grupo do Treino 💪: abra ${url} e use o código ${grupo.codigo}`);
  });
  aoClicar('sair-grupo', async () => {
    const criador = !!obterEstado().ranking?.criador;
    const aviso = criador ? ' A criação do grupo passa para quem entrou primeiro.' : '';
    if (!(await confirmar(`Sair do grupo? Seus pontos deixam de aparecer no ranking.${aviso}`, 'Sair', true))) return;
    try {
      await sairGrupo();
      toast('Você saiu do grupo');
      atualizar(() => {});
    } catch (erro) {
      toast(mensagemDe(erro));
    }
  });

  // lista de membros (vem do servidor; offline mostra "Sem conexão.")
  const lista = q('[data-campo="lista-membros"]');
  if (!lista) return;
  const carregarLista = async () => {
    const res = await listarMembros();
    if (!lista.isConnected) return;
    if (res.motivo === 'removida') {
      toast('Você não está mais neste grupo');
      atualizar(() => {});
      return;
    }
    lista.innerHTML = htmlMembros(res);
    lista.querySelectorAll('[data-acao="remover-membro"]').forEach(b => {
      b.onclick = async () => {
        if (!(await confirmar(`Remover ${b.dataset.apelido} do grupo?`, 'Remover', true))) return;
        try {
          await removerMembro(b.dataset.user);
          toast('Pessoa removida');
          carregarLista();
        } catch (erro) {
          toast(mensagemDe(erro));
        }
      };
    });
  };
  carregarLista();
}
