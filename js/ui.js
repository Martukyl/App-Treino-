// Componentes de interface compartilhados: sheet (painel inferior), confirmação e toast.
import { esc } from './util.js';

let aoFecharSheet = null;
let temporizadorToast = null;

export function abrirSheet(html, aoAbrir) {
  const sheet = document.getElementById('sheet');
  const fundo = document.getElementById('sheet-fundo');
  sheet.innerHTML = html;
  sheet.hidden = false;
  fundo.hidden = false;
  fundo.onclick = () => fecharSheet();
  if (aoAbrir) aoAbrir(sheet);
  return sheet;
}

// Registra um callback para quando o sheet atual for fechado (por qualquer caminho).
export function aoFecharSheetAtual(fn) { aoFecharSheet = fn; }

export function fecharSheet() {
  const sheet = document.getElementById('sheet');
  const fundo = document.getElementById('sheet-fundo');
  sheet.hidden = true;
  fundo.hidden = true;
  sheet.innerHTML = '';
  fundo.onclick = null;
  const cb = aoFecharSheet;
  aoFecharSheet = null;
  if (cb) cb();
}

// Pergunta sim/não; fechar pelo fundo conta como "não".
export function confirmar(mensagem, textoOk = 'Confirmar', perigo = false) {
  return new Promise(resolve => {
    let resolvido = false;
    const concluir = valor => {
      if (resolvido) return;
      resolvido = true;
      resolve(valor);
    };
    abrirSheet(
      `<p class="sheet-msg">${esc(mensagem)}</p>
       <div class="sheet-acoes">
         <button type="button" class="btn btn-sec" data-acao="cancelar">Cancelar</button>
         <button type="button" class="btn ${perigo ? 'btn-perigo' : 'btn-principal'}" data-acao="ok">${esc(textoOk)}</button>
       </div>`,
      el => {
        el.querySelector('[data-acao="cancelar"]').onclick = () => { concluir(false); fecharSheet(); };
        el.querySelector('[data-acao="ok"]').onclick = () => { concluir(true); fecharSheet(); };
      }
    );
    // se o sheet for fechado por outro caminho (fundo), resolve como falso
    aoFecharSheet = () => concluir(false);
  });
}

export function toast(mensagem) {
  const el = document.getElementById('toast');
  el.textContent = mensagem;
  el.hidden = false;
  clearTimeout(temporizadorToast);
  temporizadorToast = setTimeout(() => { el.hidden = true; }, 2500);
}

// Callbacks de "saí da tela": rodam uma vez na próxima troca/redesenho de tela
// (usado pelo registro de medidas para apagar fotos novas não salvas).
let saidas = [];

export function aoSairDaTela(fn) { saidas.push(fn); }

export function executarSaidas() {
  const lista = saidas;
  saidas = [];
  for (const fn of lista) {
    try { fn(); } catch (erro) { console.error(erro); }
  }
}
