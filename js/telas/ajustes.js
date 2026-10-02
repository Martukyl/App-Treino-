// Ajustes (#/ajustes): meus treinos, backup, restaurar padrão; e editor de treino (#/ajustes/treino/<id>).
import { esc, parseReps } from '../util.js';
import { GRUPOS } from '../dados.js';
import { obterEstado, atualizar, substituirEstado } from '../estado.js';
import { validarBackup, migrar, restaurarTreinosPadrao } from '../armazenamento.js';
import { abrirSheet, fecharSheet, confirmar, toast } from '../ui.js';

const VERSAO_APP = '1.0.0';

// remove acento e caixa para a busca
function normalizar(s) {
  return String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

const porNome = (a, b) => a.nome.localeCompare(b.nome, 'pt-BR');

// data local AAAA-MM-DD (não UTC)
function dataLocal() {
  const d = new Date();
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

// ---------- Tela principal ----------

export function render() {
  const est = obterEstado();
  const linhas = est.treinos.map(t => `
    <a class="linha-lista" href="#/ajustes/treino/${encodeURIComponent(t.id)}">
      <span class="linha-nome"><strong>${esc(t.id)}</strong> · ${esc(t.nome)}</span>
      <span class="linha-info muted">${t.itens.length} exercícios</span>
    </a>`).join('');
  return `
    <div class="tela-ajustes">
      <h1 class="titulo">Ajustes</h1>
      <section class="card">
        <h2 class="sec-card">Meus treinos</h2>
        ${linhas || '<p class="muted">Nenhum treino.</p>'}
      </section>
      <section class="card">
        <h2 class="sec-card">Backup</h2>
        <p class="muted">Os dados ficam só neste aparelho. Exporte um backup de vez em quando.</p>
        <button type="button" class="btn btn-sec btn-bloco" data-acao="exportar">Exportar backup</button>
        <button type="button" class="btn btn-sec btn-bloco" data-acao="importar">Importar backup</button>
        <input type="file" accept="application/json,.json" hidden data-campo="arquivo">
      </section>
      <section class="card">
        <h2 class="sec-card">Treinos padrão</h2>
        <p class="muted">Volta os treinos A–E ao original. Mantém histórico e exercícios criados.</p>
        <button type="button" class="btn btn-sec btn-bloco" data-acao="restaurar">Restaurar treinos padrão</button>
      </section>
      <p class="muted">Versão ${VERSAO_APP}</p>
    </div>`;
}

function exportar() {
  const blob = new Blob([JSON.stringify(obterEstado(), null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `treino-backup-${dataLocal()}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  toast('Backup salvo');
}

async function importar(arquivo) {
  let obj;
  try {
    obj = JSON.parse(await arquivo.text());
  } catch {
    toast('Arquivo inválido');
    return;
  }
  const v = validarBackup(obj);
  if (!v.ok) { toast(v.erro); return; }
  if (!(await confirmar('Isso substitui todos os dados atuais pelos do backup. Continuar?', 'Substituir', true))) return;
  substituirEstado(migrar(obj));
  toast('Backup restaurado');
}

export function montar(raiz) {
  const tela = raiz.querySelector('.tela-ajustes');
  if (!tela) return;
  const campo = tela.querySelector('[data-campo="arquivo"]');
  tela.querySelector('[data-acao="exportar"]').onclick = exportar;
  tela.querySelector('[data-acao="importar"]').onclick = () => campo.click();
  campo.onchange = async () => {
    const arquivo = campo.files && campo.files[0];
    if (!arquivo) return;
    try {
      await importar(arquivo);
    } finally {
      campo.value = ''; // permite escolher o mesmo arquivo de novo
    }
  };
  tela.querySelector('[data-acao="restaurar"]').onclick = async () => {
    if (!(await confirmar('Os treinos A–E voltam ao padrão (suas edições nos treinos serão perdidas). Histórico e exercícios criados continuam. Continuar?', 'Restaurar', true))) return;
    substituirEstado(restaurarTreinosPadrao(obterEstado()));
    toast('Treinos restaurados');
  };
}

// ---------- Editor de treino ----------

export function renderEditarTreino(id) {
  const est = obterEstado();
  const t = est.treinos.find(x => x.id === id);
  if (!t) {
    return `
      <div class="tela-editar-treino">
        <a class="voltar" href="#/ajustes">← Ajustes</a>
        <h1 class="titulo">Treino não encontrado</h1>
        <a class="btn btn-principal btn-bloco" href="#/ajustes">Voltar para Ajustes</a>
      </div>`;
  }
  const aviso = est.sessaoAtual && est.sessaoAtual.treinoId === id
    ? '<p class="selo-warn">Mudanças valem a partir do próximo treino.</p>' : '';
  const ultimo = t.itens.length - 1;
  const itens = t.itens.map((it, i) => {
    const ex = est.exercicios[it.exercicioId];
    const nome = ex ? esc(ex.nome) : 'Exercício removido';
    return `
      <section class="card item-treino" data-i="${i}">
        <h3 class="sec-card">${nome}</h3>
        <div class="campos-presc">
          <label>Séries<input type="text" inputmode="numeric" data-campo="series" value="${esc(it.series)}"></label>
          <label>Rep mín<input type="text" inputmode="numeric" data-campo="repMin" value="${esc(it.repMin)}"></label>
          <label>Rep máx<input type="text" inputmode="numeric" data-campo="repMax" value="${esc(it.repMax)}"></label>
          <label>Descanso (s)<input type="text" inputmode="numeric" data-campo="descanso" value="${esc(it.descanso)}"></label>
        </div>
        <div class="card-botoes">
          <button type="button" class="btn btn-sec" data-acao="subir" aria-label="Subir"${i === 0 ? ' disabled' : ''}>↑</button>
          <button type="button" class="btn btn-sec" data-acao="descer" aria-label="Descer"${i === ultimo ? ' disabled' : ''}>↓</button>
          <button type="button" class="btn btn-perigo" data-acao="remover" aria-label="Remover">✕</button>
        </div>
      </section>`;
  }).join('');
  return `
    <div class="tela-editar-treino" data-id="${esc(t.id)}">
      <a class="voltar" href="#/ajustes">← Ajustes</a>
      <h1 class="titulo">Treino ${esc(t.id)}</h1>
      ${aviso}
      <label>Nome<input type="text" data-campo="nome" value="${esc(t.nome)}"></label>
      <label>Foco<input type="text" data-campo="foco" value="${esc(t.foco)}"></label>
      <h2 class="sec-card sec-exercicios">Exercícios</h2>
      ${itens || '<p class="muted">Nenhum exercício neste treino.</p>'}
      <button type="button" class="btn btn-principal btn-bloco" data-acao="adicionar">+ Adicionar exercício</button>
      <p class="muted">Rep máx precisa ser maior ou igual a rep mín.</p>
    </div>`;
}

// re-renderiza (ação estrutural) mantendo a rolagem
function aplicarEstrutural(fn) {
  const y = window.scrollY;
  atualizar(fn);
  window.scrollTo(0, y);
}

function abrirAdicionar(treinoId) {
  const est = obterEstado();
  const todos = Object.values(est.exercicios).sort(porNome);
  const linhas = todos.map(x =>
    `<li><button type="button" class="linha-ex" data-id="${esc(x.id)}"><span>${esc(x.nome)}</span><small>${esc(GRUPOS[x.grupo] || '')}</small></button></li>`
  ).join('');
  abrirSheet(`
    <h2 class="sheet-titulo">Adicionar exercício</h2>
    <input type="search" class="busca" placeholder="Buscar exercício" aria-label="Buscar exercício">
    <div class="lista-troca">
      <ul class="lista-ex-troca">${linhas}</ul>
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
      el.querySelector('.vazio-troca').hidden = visiveis > 0;
    };
    el.querySelectorAll('.linha-ex').forEach(b => {
      b.onclick = () => {
        const exId = b.dataset.id;
        fecharSheet();
        aplicarEstrutural(e => {
          const t = e.treinos.find(x => x.id === treinoId);
          const ex = e.exercicios[exId];
          if (!t || !ex) return;
          // prescrição padrão: composto 3×8–12/90, isolado 3×10–15/60
          const composto = ex.tipo === 'composto';
          t.itens.push({ exercicioId: exId, series: 3, repMin: composto ? 8 : 10, repMax: composto ? 12 : 15, descanso: composto ? 90 : 60 });
        });
      };
    });
  });
}

export function montarEditarTreino(raiz, id) {
  const tela = raiz.querySelector('.tela-editar-treino');
  if (!tela || !obterEstado().treinos.some(t => t.id === id)) return;
  const achar = e => e.treinos.find(t => t.id === id);

  // nome e foco: salvam no change sem re-renderizar
  const nome = tela.querySelector('[data-campo="nome"]');
  nome.onchange = () => {
    const v = nome.value.trim();
    if (!v) { nome.classList.add('invalido'); return; }
    nome.classList.remove('invalido');
    atualizar(e => { achar(e).nome = v; }, { renderizar: false });
  };
  const foco = tela.querySelector('[data-campo="foco"]');
  foco.onchange = () => {
    atualizar(e => { achar(e).foco = foco.value.trim(); }, { renderizar: false });
  };

  tela.querySelectorAll('.item-treino').forEach(card => {
    const i = Number(card.dataset.i);
    card.querySelectorAll('input[data-campo]').forEach(inp => {
      inp.onchange = () => {
        const campo = inp.dataset.campo;
        const n = parseReps(inp.value);
        const it = achar(obterEstado()).itens[i];
        let ok = n != null && (campo === 'descanso' ? n >= 0 : n >= 1);
        if (ok && campo === 'repMin' && n > it.repMax) ok = false;
        if (ok && campo === 'repMax' && n < it.repMin) ok = false;
        inp.classList.toggle('invalido', !ok);
        if (!ok) return;
        atualizar(e => { achar(e).itens[i][campo] = n; }, { renderizar: false });
      };
    });
    const mover = delta => aplicarEstrutural(e => {
      const itens = achar(e).itens;
      const j = i + delta;
      if (j < 0 || j >= itens.length) return;
      [itens[i], itens[j]] = [itens[j], itens[i]];
    });
    card.querySelector('[data-acao="subir"]').onclick = () => mover(-1);
    card.querySelector('[data-acao="descer"]').onclick = () => mover(1);
    card.querySelector('[data-acao="remover"]').onclick = async () => {
      const est = obterEstado();
      const it = achar(est).itens[i];
      const ex = it && est.exercicios[it.exercicioId];
      if (!(await confirmar(`Remover "${ex ? ex.nome : 'este exercício'}" do treino?`, 'Remover', true))) return;
      aplicarEstrutural(e => { achar(e).itens.splice(i, 1); });
    };
  });

  tela.querySelector('[data-acao="adicionar"]').onclick = () => abrirAdicionar(id);
}
