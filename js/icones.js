// Ícones de linha (símbolos SVG definidos no index.html).
export const ic = (nome, classe = '') =>
  `<svg class="ic${classe ? ' ' + classe : ''}" aria-hidden="true"><use href="#i-${nome}"/></svg>`;
