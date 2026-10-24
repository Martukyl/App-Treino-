// Boas-vindas (#/boas-vindas): primeira abertura. Nome e escolha do programa; sem barra de abas.
import { esc } from '../util.js';
import { obterEstado, atualizar } from '../estado.js';
import { ic } from '../icones.js';

export function render() {
  const est = obterEstado();
  return `
    <div class="tela-boas-vindas">
      <div class="capa capa-boas"><img class="foto-capa zoom" src="./img/boas-vindas.jpg" alt=""></div>
      <div class="marca a"><span class="logo" aria-hidden="true"><i data-surgir style="background:var(--ink)"></i><i data-surgir style="background:var(--sage)"></i><i data-surgir style="background:var(--sand)"></i><i data-surgir style="background:var(--sky)"></i></span><h1 class="titulo-tela">Boas-vindas ao Treino</h1></div>
      <p class="bv-texto a">Monte sua rotina, registre carga e repetições e acompanhe sua evolução semana a semana.</p>
      <label class="campo-bloco bloco bloco-white a">Seu nome (opcional)
        <input type="text" data-campo="nome" maxlength="30" autocomplete="given-name" placeholder="Seu nome" value="${esc(est.nome || '')}"></label>
      <div class="escolha a" role="radiogroup" aria-label="Programa de treino">
        <label class="opcao-programa tocavel">
          <input type="radio" name="programa" value="padrao" checked>
          <span class="op-ic fundo-sky">${ic('lista')}</span>
          <span class="op-txt"><b>Programa pronto</b><small>5 treinos (A a E), um por dia</small></span>
          <span class="op-marca">${ic('ok')}</span>
        </label>
        <label class="opcao-programa tocavel">
          <input type="radio" name="programa" value="vazio">
          <span class="op-ic fundo-sand">${ic('mais')}</span>
          <span class="op-txt"><b>Começar do zero</b><small>Você monta os seus treinos</small></span>
          <span class="op-marca">${ic('ok')}</span>
        </label>
      </div>
      <button type="button" class="btn-grande a" data-acao="comecar-app">Começar ${ic('seta')}</button>
      <p class="rotulo bv-rodape a">Seus dados ficam só neste celular. Exporte um backup em Ajustes de vez em quando.</p>
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
