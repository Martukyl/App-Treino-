// Trocar exercício durante o treino e criar/editar exercício (sheets).
import { obterEstado, atualizar } from '../estado.js';
import { abrirSheet, fecharSheet, confirmar, toast } from '../ui.js';
import { GRUPOS, EQUIPAMENTOS } from '../dados.js';
import { gerarId, esc, parseNumero, formatarNumero } from '../util.js';
import { criarItemSessao } from './hoje.js';

// remove acento e caixa para a busca
function normalizar(s) {
  return String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

const porNome = (a, b) => a.nome.localeCompare(b.nome, 'pt-BR');

export function abrirTrocar(indiceItem) {
  const e0 = obterEstado();
  const item0 = e0.sessaoAtual && e0.sessaoAtual.itens[indiceItem];
  if (!item0) return;
  const idAtual = item0.exercicioId;
  const atual = e0.exercicios[idAtual];

  const linhas = lista => lista.map(x =>
    `<li><button type="button" class="linha-ex" data-id="${esc(x.id)}"><span>${esc(x.nome)}</span><small>${esc(GRUPOS[x.grupo] || '')}</small></button></li>`
  ).join('');

  function etapaLista() {
    const todos = Object.values(obterEstado().exercicios).filter(x => x.id !== idAtual);
    const mesmo = todos.filter(x => x.grupo === atual.grupo).sort(porNome);
    const resto = todos.filter(x => x.grupo !== atual.grupo).sort(porNome);
    abrirSheet(`
      <h2 class="sheet-titulo">Trocar ${esc(atual.nome)}</h2>
      <input type="search" class="busca" placeholder="Buscar exercício" aria-label="Buscar exercício">
      <button type="button" class="btn btn-sec btn-bloco" data-acao="criar">+ Criar exercício</button>
      <div class="lista-troca">
        <h3 class="sec-troca" data-sec="mesmo">Mesmo grupo (${esc(GRUPOS[atual.grupo] || '')})</h3>
        <ul class="lista-ex-troca" data-lista="mesmo">${linhas(mesmo)}</ul>
        <h3 class="sec-troca" data-sec="todos">Todos</h3>
        <ul class="lista-ex-troca" data-lista="todos">${linhas(resto)}</ul>
        <p class="vazio-troca" hidden>Nenhum exercício encontrado.</p>
      </div>`, el => {
      const busca = el.querySelector('.busca');
      busca.oninput = () => {
        const q = normalizar(busca.value.trim());
        let visiveis = 0;
        el.querySelectorAll('.linha-ex').forEach(b => {
          const mostra = normalizar(b.querySelector('span').textContent).includes(q);
          b.parentElement.hidden = !mostra;
          if (mostra) visiveis++;
        });
        // esconde o título da seção sem resultados
        ['mesmo', 'todos'].forEach(s => {
          const ul = el.querySelector(`[data-lista="${s}"]`);
          el.querySelector(`[data-sec="${s}"]`).hidden = !ul.querySelector('li:not([hidden])');
        });
        el.querySelector('.vazio-troca').hidden = visiveis > 0;
      };
      el.querySelectorAll('.linha-ex').forEach(b => { b.onclick = () => etapaModo(b.dataset.id); });
      el.querySelector('[data-acao="criar"]').onclick = () => abrirFormExercicio(null, id => etapaModo(id));
    });
  }

  function etapaModo(novoId) {
    const novo = obterEstado().exercicios[novoId];
    if (!novo) return;
    abrirSheet(`
      <h2 class="sheet-titulo">${esc(novo.nome)}</h2>
      <p class="sheet-msg">Trocar ${esc(atual.nome)} por este exercício:</p>
      <button type="button" class="btn btn-principal btn-bloco opcao-troca" data-modo="hoje">Só hoje<small>O treino salvo continua com o exercício original</small></button>
      <button type="button" class="btn btn-sec btn-bloco opcao-troca" data-modo="sempre">Sempre neste treino<small>Troca também no treino salvo</small></button>
      <button type="button" class="btn btn-sec btn-bloco" data-modo="voltar">Voltar</button>`, el => {
      el.querySelectorAll('[data-modo]').forEach(b => {
        b.onclick = () => {
          if (b.dataset.modo === 'voltar') etapaLista();
          else aplicar(novoId, b.dataset.modo === 'sempre');
        };
      });
    });
  }

  async function aplicar(novoId, sempre) {
    const item = obterEstado().sessaoAtual?.itens[indiceItem];
    if (!item || item.exercicioId !== idAtual) { fecharSheet(); return; }
    if (item.registros.some(r => r.feita)) {
      const ok = await confirmar('As séries já feitas deste exercício serão descartadas. Trocar?', 'Trocar');
      if (!ok) { etapaModo(novoId); return; }
    }
    fecharSheet();
    atualizar(est => {
      const sess = est.sessaoAtual;
      const it = sess && sess.itens[indiceItem];
      if (!it || it.exercicioId !== idAtual) return;
      const original = it.trocadoDe ?? it.exercicioId;
      // trocar de volta para o original não deixa "no lugar de" ele mesmo
      const trocadoDe = (sempre || novoId === original) ? null : original;
      sess.itens[indiceItem] = criarItemSessao(est, {
        exercicioId: novoId, series: it.series, repMin: it.repMin, repMax: it.repMax, descanso: it.descanso
      }, trocadoDe);
      if (sempre) {
        const treino = est.treinos.find(t => t.id === sess.treinoId);
        if (treino) {
          // o exercício a substituir no Treino é o original (se já havia uma troca "só hoje", é o trocadoDe)
          const origem = it.trocadoDe ?? idAtual;
          const alvo = treino.itens[indiceItem]?.exercicioId === origem
            ? treino.itens[indiceItem]
            : treino.itens.find(t => t.exercicioId === origem);
          if (alvo) alvo.exercicioId = novoId;
        }
      }
    });
    toast('Exercício trocado');
  }

  etapaLista();
}

// Formulário de criar (exercicioId = null) ou editar exercício. Independe da sessão.
export function abrirFormExercicio(exercicioId, aoSalvar) {
  const existente = exercicioId ? obterEstado().exercicios[exercicioId] : null;
  if (exercicioId && !existente) return;
  const v = existente || { nome: '', grupo: 'gluteo', tipo: 'composto', equipamento: 'maquina', unilateral: false, incremento: 2.5, dica: '' };
  const opcoes = (obj, sel) => Object.entries(obj).map(([k, r]) =>
    `<option value="${esc(k)}"${k === sel ? ' selected' : ''}>${esc(r)}</option>`).join('');

  abrirSheet(`
    <h2 class="sheet-titulo">${existente ? 'Editar exercício' : 'Novo exercício'}</h2>
    <form novalidate>
      <label for="fx-nome">Nome</label>
      <input id="fx-nome" name="nome" type="text" maxlength="60" value="${esc(v.nome)}" autocomplete="off">
      <label for="fx-grupo">Grupo muscular</label>
      <select id="fx-grupo" name="grupo">${opcoes(GRUPOS, v.grupo)}</select>
      <label for="fx-tipo">Tipo</label>
      <select id="fx-tipo" name="tipo">${opcoes({ composto: 'Composto', isolado: 'Isolado' }, v.tipo)}</select>
      <label for="fx-equip">Equipamento</label>
      <select id="fx-equip" name="equipamento">${opcoes(EQUIPAMENTOS, v.equipamento)}</select>
      <label class="check-linha"><input id="fx-uni" name="unilateral" type="checkbox"${v.unilateral ? ' checked' : ''}> Unilateral (cada lado)</label>
      <label for="fx-inc">Incremento de carga (kg)</label>
      <input id="fx-inc" name="incremento" type="text" inputmode="decimal" value="${esc(formatarNumero(v.incremento))}">
      <label for="fx-dica">Dica (opcional)</label>
      <textarea id="fx-dica" name="dica" maxlength="400">${esc(v.dica || '')}</textarea>
      <p class="form-erro" role="alert" hidden></p>
      <div class="sheet-acoes">
        <button type="button" class="btn btn-sec" data-acao="cancelar">Cancelar</button>
        <button type="submit" class="btn btn-principal">Salvar</button>
      </div>
    </form>`, el => {
    const form = el.querySelector('form');
    const campo = n => form.elements[n];
    const erro = el.querySelector('.form-erro');
    let incEditado = !!existente;
    campo('incremento').addEventListener('input', () => { incEditado = true; });
    // sugere incremento conforme o equipamento enquanto o campo não foi editado
    campo('equipamento').addEventListener('change', () => {
      if (!incEditado) campo('incremento').value = campo('equipamento').value === 'halter' ? '1' : '2,5';
    });
    el.querySelector('[data-acao="cancelar"]').onclick = () => fecharSheet();
    form.addEventListener('submit', ev => {
      ev.preventDefault();
      const nome = campo('nome').value.trim();
      const inc = parseNumero(campo('incremento').value);
      const dica = campo('dica').value.trim();
      const msgs = [];
      campo('nome').classList.toggle('invalido', !nome || nome.length > 60);
      campo('incremento').classList.toggle('invalido', !(inc > 0) || (campo('incremento').value.trim().split(/[.,]/)[1] || '').length > 1);
      campo('dica').classList.toggle('invalido', dica.length > 400);
      if (!nome) msgs.push('Informe o nome.');
      else if (nome.length > 60) msgs.push('Nome com no máximo 60 caracteres.');
      const casas = (campo('incremento').value.trim().split(/[.,]/)[1] || '').length;
      if (!(inc > 0)) msgs.push('Incremento deve ser maior que zero.');
      else if (casas > 1) msgs.push('Use no máximo 1 casa decimal (ex.: 2,5).');
      if (dica.length > 400) msgs.push('Dica com no máximo 400 caracteres.');
      if (msgs.length) { erro.textContent = msgs.join(' '); erro.hidden = false; return; }
      const id = existente ? existente.id : gerarId('c_');
      atualizar(e => {
        e.exercicios[id] = {
          ...(e.exercicios[id] || {}),
          id, nome, grupo: campo('grupo').value, tipo: campo('tipo').value,
          equipamento: campo('equipamento').value, unilateral: campo('unilateral').checked,
          incremento: inc, dica,
          personalizado: existente ? existente.personalizado : true
        };
      });
      fecharSheet();
      if (aoSalvar) aoSalvar(id);
    });
  });
}
