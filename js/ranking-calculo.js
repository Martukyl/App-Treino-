// Ranking — parte PURA: agregação dos últimos dias para publicar, totais por período,
// ordenação com desempate e sequência por membro. Sem DOM, sem rede, sem storage (testável no Node).
import { totaisDia, inicioSemana, inicioMes, somarDias, sequencia } from './pontos.js';

export const DIAS_SINCRONIZADOS = 35;
export const METRICAS = ['pontos', 'treinos', 'cardioMin', 'km', 'sequencia'];

const limitar = (n, max) => Math.max(0, Math.min(n, max));

// Totais diários dos últimos `n` dias (hoje inclusive), zeros inclusos (corrige exclusões).
// Linhas no formato da tabela `dias` (sem user_id); os valores respeitam os limites do banco.
export function agregarUltimosDias(sessoes, cardios, hoje, n = DIAS_SINCRONIZADOS) {
  const linhas = [];
  for (let i = n - 1; i >= 0; i--) {
    const data = somarDias(hoje, -i);
    const t = totaisDia(sessoes, cardios, data);
    linhas.push({
      data,
      treinos: limitar(t.treinos, 20),
      cardio_min: limitar(t.cardioMin, 1440),
      km: limitar(t.km, 300),
      pontos: limitar(t.pontos, 22)
    });
  }
  return linhas;
}

// { inicio, fim } do período: 'semana' (segunda → hoje) ou 'mes' (dia 1 → hoje)
export function limitesPeriodo(periodo, hoje) {
  return { inicio: periodo === 'mes' ? inicioMes(hoje) : inicioSemana(hoje), fim: hoje };
}

// Primeiro dia a buscar no servidor: o que for mais antigo entre início do mês e hoje − 40
export function inicioBusca(hoje) {
  const mes = inicioMes(hoje);
  const quarenta = somarDias(hoje, -40);
  return mes < quarenta ? mes : quarenta;
}

// Ordena por métrica (maior primeiro); empate → mais treinos, depois apelido. Não altera a entrada.
export function ordenarRanking(lista, metrica = 'pontos') {
  return [...lista].sort((a, b) =>
    (b[metrica] - a[metrica])
    || (b.treinos - a.treinos)
    || String(a.apelido).localeCompare(String(b.apelido), 'pt-BR'));
}

const arred2 = n => Math.round(n * 100) / 100;

// Linhas de `dias` do servidor + membros → um item por membro com os totais do período e a sequência.
// membros: [{ user_id, apelido, emoji }]; dias: [{ user_id, data, treinos, cardio_min, km, pontos }]
export function calcularRanking(membros, dias, hoje, periodo) {
  const { inicio, fim } = limitesPeriodo(periodo, hoje);
  const porUsuario = new Map();
  for (const d of dias) {
    if (!porUsuario.has(d.user_id)) porUsuario.set(d.user_id, []);
    porUsuario.get(d.user_id).push(d);
  }
  return membros.map(m => {
    const linhas = porUsuario.get(m.user_id) || [];
    const t = { treinos: 0, cardioMin: 0, km: 0, pontos: 0 };
    const ativos = new Set();
    for (const d of linhas) {
      const treinos = Number(d.treinos) || 0, cardioMin = Number(d.cardio_min) || 0;
      if (treinos > 0 || cardioMin > 0) ativos.add(d.data);
      if (d.data >= inicio && d.data <= fim) {
        t.treinos += treinos;
        t.cardioMin += cardioMin;
        t.km += Number(d.km) || 0;
        t.pontos += Number(d.pontos) || 0;
      }
    }
    return {
      userId: m.user_id, apelido: m.apelido, emoji: m.emoji,
      pontos: t.pontos, treinos: t.treinos, cardioMin: t.cardioMin, km: arred2(t.km),
      sequencia: sequencia(ativos, hoje)
    };
  });
}

// Texto do valor na lista, por métrica
export function formatarValor(metrica, valor) {
  const n = (v, max) => v.toLocaleString('pt-BR', { maximumFractionDigits: max });
  if (metrica === 'pontos') return `${n(valor, 0)} pts`;
  if (metrica === 'cardioMin') return `${n(valor, 0)} min`;
  if (metrica === 'km') return `${n(valor, 2)} km`;
  if (metrica === 'sequencia') return `${n(valor, 0)} ${valor === 1 ? 'dia' : 'dias'}`;
  return n(valor, 0); // treinos
}

// "atualizado há 3 min" a partir de milissegundos decorridos
export function textoIdade(ms) {
  const min = Math.floor(ms / 60000);
  if (min < 1) return 'atualizado agora';
  if (min < 60) return `atualizado há ${min} min`;
  return `atualizado há ${Math.floor(min / 60)} h`;
}

// "1º", "2º"…
export const ordinal = pos => `${pos}º`;

// Normaliza os campos digitados: apelido sem espaços nas pontas; código em maiúsculas e sem espaços
export const normalizarApelido = txt => String(txt ?? '').trim();
export const normalizarCodigo = txt => String(txt ?? '').replace(/\s+/g, '').toUpperCase();
export const CODIGO_VALIDO = /^[A-HJ-NP-Z2-9]{6}$/;
