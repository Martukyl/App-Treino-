// Estado do app em memória + gravação automática no localStorage.
import { carregar, salvar } from './armazenamento.js';

const inicial = carregar();
let estado = inicial.estado;
let renderizador = () => {};
let avisouFalha = false;

export function obterEstado() { return estado; }

export function definirRenderizador(fn) { renderizador = fn; }

export function avisoInicial() { return inicial.aviso; }

export function mostrarAviso(texto) {
  const el = document.getElementById('aviso');
  el.textContent = texto;
  el.hidden = false;
}

// Aplica uma mudança no estado, salva e (por padrão) redesenha a tela.
export function atualizar(fn, { renderizar = true } = {}) {
  fn(estado);
  if (!salvar(estado) && !avisouFalha) {
    avisouFalha = true;
    mostrarAviso('Não estou conseguindo salvar — faça um backup em Ajustes.');
  }
  if (renderizar) renderizador();
}

export function substituirEstado(novo) {
  estado = novo;
  atualizar(() => {});
}
