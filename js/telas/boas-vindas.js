// Boas-vindas (#/boas-vindas): primeira abertura. Nome e escolha do programa; sem barra de abas.
import { esc } from '../util.js';
import { obterEstado, atualizar } from '../estado.js';

export function render() {
  const est = obterEstado();
  return `
    <div class="tela-boas-vindas">
      <h1 class="titulo">Boas-vindas ao Treino</h1>
      <section class="card">
        <label>Seu nome (opcional)
          <input type="text" data-campo="nome" maxlength="30" autocomplete="given-name" placeholder="Seu nome" value="${esc(est.nome || '')}">
        </label>
        <div class="escolha-programa" role="radiogroup" aria-label="Programa de treino">
          <label class="opcao-programa">
            <input type="radio" name="programa" value="padrao" checked>
            <span>Programa pronto · 5 treinos (A a E), um por dia</span>
          </label>
          <label class="opcao-programa">
            <input type="radio" name="programa" value="vazio">
            <span>Começar do zero · você monta os seus treinos</span>
          </label>
        </div>
        <p class="muted">Seus dados ficam só neste celular. Exporte um backup em Ajustes de vez em quando.</p>
      </section>
      <button type="button" class="btn btn-principal btn-bloco" data-acao="comecar-app">Começar</button>
    </div>`;
}

export function montar(raiz) {
  const tela = raiz.querySelector('.tela-boas-vindas');
  if (!tela) return;
  tela.querySelector('[data-acao="comecar-app"]').onclick = () => {
    const nome = tela.querySelector('[data-campo="nome"]').value.trim().slice(0, 30);
    const vazio = tela.querySelector('input[name="programa"]:checked')?.value === 'vazio';
    atualizar(e => {
      e.nome = nome;
      if (vazio) { e.treinos = []; e.ultimoTreinoId = null; }
      e.boasVindasPendente = false;
    }, { renderizar: false });
    location.hash = '#/hoje';
  };
}
