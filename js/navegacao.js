// Regras de navegação do visual Blocos: quais rotas mostram o menu e para que lado a tela desliza.

// telas-raiz do menu inferior, na ordem dos botões
export const ABAS = ['hoje', 'corpo', 'exercicios', 'historico', 'ajustes'];

// rota "pai" de sub-telas cujo primeiro segmento não é uma aba
const PAI = {
  '#/treino': '#/hoje', '#/resumo': '#/hoje', '#/ranking': '#/hoje', '#/cardio': '#/hoje',
  '#/sessao': '#/historico', '#/exercicio': '#/exercicios', '#/boas-vindas': '#/hoje'
};

// '#/corpo' → 'corpo'; sub-rotas ('#/corpo/fotos') e rotas fora do menu → null
export function abaDaRota(hash) {
  const m = /^#\/([^/]+)$/.exec(hash || '');
  return m && ABAS.includes(m[1]) ? m[1] : null;
}

export const mostraMenu = hash => abaDaRota(hash) !== null;

const primeiroSegmento = hash => (/^#\/[^/]+/.exec(hash || '') || [''])[0];

function paiDe(hash) {
  const seg = primeiroSegmento(hash);
  if (PAI[seg]) return PAI[seg];
  return seg !== hash ? seg : null; // '#/corpo/medida/peso' → '#/corpo'
}

// -1 = volta (desliza da esquerda), 1 = avança (da direita), 0 = sem deslizar
export function direcaoTransicao(de, para) {
  if (!de || de === para) return 0;
  const a = abaDaRota(de), b = abaDaRota(para);
  if (a && b) return Math.sign(ABAS.indexOf(b) - ABAS.indexOf(a));
  if (paiDe(de) === para) return -1;
  return 1;
}
