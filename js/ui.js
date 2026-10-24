// Componentes de interface compartilhados: sheet (painel inferior), confirmação e toast.
import { esc } from './util.js';

let aoFecharSheet = null;
let temporizadorToast = null;

// Mostra/esconde com transição: tira o hidden, liga a classe 'on' no quadro seguinte;
// ao esconder, desliga 'on' e só põe hidden depois da transição (a menos que reabra antes).
const saidasPendentes = new WeakMap();
function mostrar(el) {
  clearTimeout(saidasPendentes.get(el));
  el.hidden = false;
  void el.offsetWidth; // força o estilo inicial antes de ligar a transição
  el.classList.add('on');
}
function esconder(el, depois) {
  el.classList.remove('on');
  clearTimeout(saidasPendentes.get(el));
  saidasPendentes.set(el, setTimeout(() => { el.hidden = true; depois?.(); }, 320));
}

export function abrirSheet(html, aoAbrir) {
  const sheet = document.getElementById('sheet');
  const fundo = document.getElementById('sheet-fundo');
  sheet.innerHTML = `<div class="puxador" aria-hidden="true"></div>${html}`;
  mostrar(sheet);
  mostrar(fundo);
  fundo.onclick = () => fecharSheet();
  if (aoAbrir) aoAbrir(sheet);
  return sheet;
}

// Registra um callback para quando o sheet atual for fechado (por qualquer caminho).
export function aoFecharSheetAtual(fn) { aoFecharSheet = fn; }

export function fecharSheet() {
  const sheet = document.getElementById('sheet');
  const fundo = document.getElementById('sheet-fundo');
  if (!sheet.hidden) esconder(sheet, () => { if (!sheet.classList.contains('on')) sheet.innerHTML = ''; });
  if (!fundo.hidden) esconder(fundo);
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
  mostrar(el);
  clearTimeout(temporizadorToast);
  temporizadorToast = setTimeout(() => esconder(el), 2500);
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
