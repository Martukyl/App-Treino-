// Regras puras da aba Corpo: catálogo de campos, idade, IMC, séries e diferenças.
// Não acessam DOM nem storage (testáveis no Node). Datas AAAA-MM-DD são dias locais:
// nunca usar new Date('AAAA-MM-DD') (vira UTC e volta um dia no Brasil).

export const CAMPOS_CORPO = [
  { campo: 'peso', rotulo: 'Peso', unidade: 'kg', grupo: null, direcao: 'meta' },
  { campo: 'busto', rotulo: 'Busto', unidade: 'cm', grupo: 'Superiores', direcao: 'subir' },
  { campo: 'ombros', rotulo: 'Ombros', unidade: 'cm', grupo: 'Superiores', direcao: 'subir' },
  { campo: 'bracoD', rotulo: 'Braço direito', unidade: 'cm', grupo: 'Superiores', direcao: 'subir' },
  { campo: 'bracoE', rotulo: 'Braço esquerdo', unidade: 'cm', grupo: 'Superiores', direcao: 'subir' },
  { campo: 'cintura', rotulo: 'Cintura', unidade: 'cm', grupo: 'Superiores', direcao: 'descer' },
  { campo: 'abdomen', rotulo: 'Abdômen', unidade: 'cm', grupo: 'Superiores', direcao: 'descer' },
  { campo: 'quadril', rotulo: 'Quadril', unidade: 'cm', grupo: 'Inferiores', direcao: 'subir' },
  { campo: 'coxaD', rotulo: 'Coxa direita', unidade: 'cm', grupo: 'Inferiores', direcao: 'subir' },
  { campo: 'coxaE', rotulo: 'Coxa esquerda', unidade: 'cm', grupo: 'Inferiores', direcao: 'subir' },
  { campo: 'panturrilha', rotulo: 'Panturrilha', unidade: 'cm', grupo: 'Inferiores', direcao: 'subir' }
];

const temValor = v => typeof v === 'number' && Number.isFinite(v);

// 1 casa decimal sem erro de ponto flutuante (62.4 - 60.1 → 2.3); "+ 0" evita -0
function arred1(n) {
  return Math.round((n + (n >= 0 ? 1e-9 : -1e-9)) * 10) / 10 + 0;
}

export function idade(nascimento, hoje = new Date()) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(nascimento || '');
  if (!m) return null;
  const [a, mes, dia] = [Number(m[1]), Number(m[2]), Number(m[3])];
  let anos = hoje.getFullYear() - a;
  const antes = hoje.getMonth() + 1 < mes || (hoje.getMonth() + 1 === mes && hoje.getDate() < dia);
  if (antes) anos -= 1;
  return anos;
}

export function imc(pesoKg, alturaCm) {
  if (!temValor(pesoKg) || !temValor(alturaCm) || pesoKg <= 0 || alturaCm <= 0) return null;
  const m = alturaCm / 100;
  return arred1(pesoKg / (m * m));
}

export function faixaImc(valor) {
  if (!temValor(valor)) return null;
  if (valor < 18.5) return 'Abaixo do peso';
  if (valor < 25) return 'Normal';
  if (valor < 30) return 'Sobrepeso';
  return 'Obesidade';
}

export function ordenarPorData(medidas) {
  return [...medidas].sort((a, b) => (a.data < b.data ? -1 : a.data > b.data ? 1 : 0));
}

export function serieCampo(medidas, campo) {
  return ordenarPorData(medidas)
    .filter(r => temValor(r[campo]))
    .map(r => ({ data: r.data, valor: r[campo] }));
}

export function resumoCampo(medidas, campo) {
  const serie = serieCampo(medidas, campo);
  const atual = serie.at(-1)?.valor ?? null;
  const anterior = serie.length >= 2 ? serie.at(-2).valor : null;
  const primeiro = serie.length ? serie[0].valor : null;
  return {
    atual,
    anterior,
    primeiro,
    difAnterior: anterior == null ? null : arred1(atual - anterior),
    // com um só valor, atual e primeiro são o mesmo registro: não há diferença
    difPrimeiro: serie.length >= 2 ? arred1(atual - primeiro) : null
  };
}

export function direcaoDiferenca(campo, dif, { pesoAtual = null, metaPeso = null } = {}) {
  if (!temValor(dif) || dif === 0) return 'neutra';
  const def = CAMPOS_CORPO.find(c => c.campo === campo);
  if (!def) return 'neutra';
  let sobe;
  if (def.direcao === 'subir') sobe = true;
  else if (def.direcao === 'descer') sobe = false;
  else {
    if (!temValor(metaPeso) || !temValor(pesoAtual) || metaPeso === pesoAtual) return 'neutra';
    sobe = metaPeso > pesoAtual;
  }
  return (dif > 0) === sobe ? 'boa' : 'ruim';
}

export function faltaParaMeta(pesoAtual, metaPeso) {
  if (!temValor(pesoAtual) || !temValor(metaPeso)) return null;
  return arred1(metaPeso - pesoAtual);
}

// Último valor não nulo (cronológico) do campo — usado como placeholder no formulário.
export function ultimoValor(medidas, campo) {
  return serieCampo(medidas, campo).at(-1)?.valor ?? null;
}

// Quantos dos 10 campos em cm estão preenchidos (peso não conta).
export function contarMedidas(registro) {
  return CAMPOS_CORPO.filter(c => c.campo !== 'peso' && temValor(registro?.[c.campo])).length;
}
