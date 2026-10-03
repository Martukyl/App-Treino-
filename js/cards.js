// Cards de compartilhamento — parte PURA: monta os textos/dados de cada card e projeta o trajeto.
// O desenho em canvas fica em cards-canvas.js. Nada aqui acessa DOM nem storage (testável no Node).
// Privacidade: o card só leva o que está nestes dados (nada de nome de exercício nem carga por série).
import { formatarNumero, formatarDuracao, formatarDia } from './util.js';
import {
  ICONE_CARDIO, ROTULO_CARDIO, formatarKm, formatarRitmo, formatarCronometro
} from './cardio.js';
import { CAMPOS_CORPO, resumoCampo, direcaoDiferenca, ordenarPorData } from './corpo.js';
import { diaLocal, inicioSemana, somarDias, totaisPeriodo, diasDaSemana, diasAtivos, sequencia } from './pontos.js';

export const LARGURA = 1080;
export const ALTURA = 1350;
export const RODAPE = 'Treino 💪';
export const MAX_MEDIDAS_CARD = 6;

const LETRAS_SEMANA = ['S', 'T', 'Q', 'Q', 'S', 'S', 'D'];

// nome do arquivo baixado quando não há compartilhamento nativo: treino-<tipo>-<AAAA-MM-DD>.png
export function nomeArquivoCard(tipo, dia) {
  return `treino-${tipo}-${dia}.png`;
}

// "−0,5" / "+1,2" / "0"; sem valor, traço (mesma regra visual da aba Corpo)
export function formatarDif(d) {
  if (d == null) return '—';
  if (d === 0) return '0';
  return `${d > 0 ? '+' : '−'}${formatarNumero(Math.abs(d))}`;
}

// ---------- 1. Treino concluído ----------

export function dadosCardTreino(est, sessao) {
  const treino = est.treinos.find(t => t.id === sessao.treinoId);
  // "Treino B · Costas e ombro" (foco); sem foco, usa o nome do treino
  const titulo = treino ? `Treino ${treino.id} · ${treino.foco || treino.nome}` : 'Treino';
  const nome = (est.nome || '').trim();
  const series = sessao.itens.reduce((n, it) => n + it.registros.length, 0);
  const volume = sessao.itens.reduce((v, it) => v + it.registros.reduce((a, r) => a + (r.carga || 0) * r.reps, 0), 0);
  const duracaoMs = new Date(sessao.fim).getTime() - new Date(sessao.inicio).getTime();
  const dia = diaLocal(sessao.fim);
  return {
    tipo: 'treino',
    dia,
    saudacao: nome ? `Mandou bem, ${nome}! 💪` : 'Treino concluído! 💪',
    titulo,
    data: formatarDia(dia),
    metricas: [
      { rotulo: 'Duração', valor: Number.isFinite(duracaoMs) && duracaoMs >= 0 ? formatarDuracao(duracaoMs) : '—' },
      { rotulo: 'Séries', valor: String(series) },
      { rotulo: 'Volume', valor: `${formatarNumero(volume)} kg` },
      { rotulo: 'Exercícios', valor: String(sessao.itens.length) }
    ],
    // faixa decorativa só dos treinos A–E
    foto: /^[A-E]$/.test(sessao.treinoId) ? `./img/treino-${sessao.treinoId.toLowerCase()}.jpg` : null,
    texto: 'Treino concluído 💪'
  };
}

// ---------- 2. Caminhada / corrida / aparelho ----------

export function dadosCardCardio(c) {
  const gps = c.modo === 'gps';
  const icone = ICONE_CARDIO[c.tipo] || '❤️';
  const rotulo = ROTULO_CARDIO[c.tipo] || 'Cardio';
  const dia = diaLocal(c.fim);
  const temDist = Number.isFinite(c.distanciaM) && c.distanciaM > 0;
  const tempo = formatarCronometro((c.duracaoSeg || 0) * 1000);
  const kcal = c.kcal == null ? null : `${formatarNumero(c.kcal)} kcal`;
  const ritmo = temDist && c.duracaoSeg > 0 ? c.duracaoSeg / (c.distanciaM / 1000) : null;
  let destaque = null; // número grande (km no GPS)
  let metricas;
  if (gps) {
    destaque = { rotulo: 'Distância', valor: temDist ? formatarKm(c.distanciaM) : '—' };
    metricas = [
      { rotulo: 'Tempo', valor: tempo },
      { rotulo: 'Ritmo', valor: formatarRitmo(ritmo) },
      ...(kcal ? [{ rotulo: 'Calorias', valor: kcal }] : []),
      ...(c.subidaM != null ? [{ rotulo: 'Subida', valor: `${formatarNumero(c.subidaM)} m` }] : [])
    ];
  } else {
    metricas = [
      { rotulo: 'Tempo', valor: `${formatarNumero(Math.round((c.duracaoSeg || 0) / 60))} min` },
      ...(temDist ? [{ rotulo: 'Distância', valor: formatarKm(c.distanciaM) }] : []),
      ...(kcal ? [{ rotulo: 'Calorias', valor: kcal }] : [])
    ];
  }
  return {
    tipo: 'cardio',
    modo: gps ? 'gps' : 'aparelho',
    dia,
    icone,
    titulo: `${icone} ${rotulo}`,
    data: formatarDia(dia),
    destaque,
    metricas,
    trajetoId: gps ? c.trajetoId || null : null,
    texto: `${rotulo} concluída ${icone}`
  };
}

// ---------- 3. Minha semana ----------

export function dadosCardSemana(est, hoje) {
  const seg = inicioSemana(hoje);
  const dom = somarDias(seg, 6);
  const t = totaisPeriodo(est.sessoes, est.cardios, seg, dom);
  const dias = diasDaSemana(est.sessoes, est.cardios, hoje).map((d, i) => ({
    dia: d.dia, letra: LETRAS_SEMANA[i], ativo: d.ativo, hoje: d.dia === hoje
  }));
  const seq = sequencia(diasAtivos(est.sessoes, est.cardios), hoje);
  const curto = d => formatarDia(d).slice(0, 5);
  return {
    tipo: 'semana',
    dia: hoje,
    titulo: 'Minha semana',
    periodo: `${curto(seg)} a ${curto(dom)}`,
    dias,
    metricas: [
      { rotulo: 'Treinos', valor: String(t.treinos) },
      { rotulo: 'Cardio', valor: `${formatarNumero(t.cardioMin)} min` },
      { rotulo: 'Distância', valor: `${formatarNumero(t.km)} km` },
      { rotulo: 'Pontos', valor: String(t.pontos) }
    ],
    sequencia: seq,
    textoSequencia: seq > 0 ? `🔥 ${seq} ${seq === 1 ? 'dia seguido' : 'dias seguidos'}` : '🔥 Comece hoje a sua sequência',
    texto: 'Minha semana 💪'
  };
}

// ---------- 4. Evolução do Corpo ----------

// Primeiro e último registro com foto de frente (precisa de 2 registros diferentes); senão null.
export function fotosAntesDepois(medidas) {
  const com = ordenarPorData(medidas || []).filter(m => m.fotos && m.fotos.frente);
  if (com.length < 2) return null;
  const a = com[0], d = com[com.length - 1];
  return { antes: { id: a.fotos.frente, data: formatarDia(a.data) }, depois: { id: d.fotos.frente, data: formatarDia(d.data) } };
}

// Medidas do card: até MAX_MEDIDAS_CARD campos em cm; as que têm variação desde o início vêm primeiro.
export function dadosCardCorpo(est, { incluirFotos = false } = {}) {
  const ctx = { pesoAtual: resumoCampo(est.medidas, 'peso').atual, metaPeso: est.perfil.metaPeso };
  const defPeso = CAMPOS_CORPO[0];
  const rp = resumoCampo(est.medidas, 'peso');
  const peso = rp.atual == null ? null : {
    valor: `${formatarNumero(rp.atual)} ${defPeso.unidade}`,
    dif: rp.difPrimeiro == null ? null : `${formatarDif(rp.difPrimeiro)} kg desde o início`,
    direcao: direcaoDiferenca('peso', rp.difPrimeiro, ctx)
  };
  const medidas = CAMPOS_CORPO.filter(c => c.campo !== 'peso').map(c => {
    const r = resumoCampo(est.medidas, c.campo);
    return { c, r };
  }).filter(x => x.r.atual != null);
  const ordenadas = [...medidas.filter(x => x.r.difPrimeiro != null), ...medidas.filter(x => x.r.difPrimeiro == null)];
  const linhas = ordenadas.slice(0, MAX_MEDIDAS_CARD).map(({ c, r }) => ({
    rotulo: c.rotulo,
    valor: `${formatarNumero(r.atual)} ${c.unidade}`,
    dif: r.difPrimeiro == null ? '' : `${formatarDif(r.difPrimeiro)} ${c.unidade}`,
    direcao: direcaoDiferenca(c.campo, r.difPrimeiro, ctx)
  }));
  const datas = ordenarPorData(est.medidas);
  const fotos = incluirFotos ? fotosAntesDepois(est.medidas) : null;
  return {
    tipo: 'corpo',
    dia: datas.length ? datas[datas.length - 1].data : null,
    titulo: 'Minha evolução',
    desde: datas.length >= 2 ? `desde ${formatarDia(datas[0].data)}` : '',
    peso,
    medidas: linhas,
    fotos,
    texto: 'Minha evolução 💪'
  };
}

// ---------- Projeção do trajeto (sem tiles) ----------

// Projeção equiretangular com cos(lat) da latitude média, ajustada à caixa preservando a proporção.
// segmentos: [[ [lat, lon, ...], … ], …]. Devolve { segmentos: [[[x, y], …], …], inicio, fim, escala }
// com todos os pontos dentro de [margem, largura - margem] × [margem, altura - margem]; null sem pontos.
export function projetarTrajeto(segmentos, { largura, altura, margem = 0 } = {}) {
  const pontos = (segmentos || []).flat().filter(p => Array.isArray(p) && Number.isFinite(p[0]) && Number.isFinite(p[1]));
  if (!pontos.length) return null;
  const lats = pontos.map(p => p[0]), lons = pontos.map(p => p[1]);
  const latMin = Math.min(...lats), latMax = Math.max(...lats);
  const lonMin = Math.min(...lons), lonMax = Math.max(...lons);
  const cos = Math.cos(((latMin + latMax) / 2) * Math.PI / 180);
  const larguraMundo = (lonMax - lonMin) * cos; // x cresce para o leste
  const alturaMundo = latMax - latMin; // y cresce para o norte (invertido ao desenhar)
  const caixaL = Math.max(0, largura - 2 * margem), caixaA = Math.max(0, altura - 2 * margem);
  // ponto único ou linha degenerada: escala 1, sem divisão por zero
  const escalaX = larguraMundo > 0 ? caixaL / larguraMundo : Infinity;
  const escalaY = alturaMundo > 0 ? caixaA / alturaMundo : Infinity;
  let escala = Math.min(escalaX, escalaY);
  if (!Number.isFinite(escala)) escala = 1;
  const usadoL = larguraMundo * escala, usadoA = alturaMundo * escala;
  const x0 = margem + (caixaL - usadoL) / 2, y0 = margem + (caixaA - usadoA) / 2;
  const projetar = p => [
    x0 + (p[1] - lonMin) * cos * escala,
    y0 + (latMax - p[0]) * escala
  ];
  const proj = (segmentos || []).map(s => s.filter(p => Number.isFinite(p[0]) && Number.isFinite(p[1])).map(projetar)).filter(s => s.length);
  const ultimo = proj[proj.length - 1];
  return { segmentos: proj, inicio: proj[0][0], fim: ultimo[ultimo.length - 1], escala };
}

// ---------- 5. Ranking do grupo ----------

export const MAX_LISTA_RANKING = 10;

// Só apelidos e emojis (nunca o nome real do perfil). `lista` já ordenada por pontos:
// [{ apelido, emoji, pontos }]; podio = top 3, linhas = posições 4 a 10.
export function dadosCardRanking({ grupo, periodo, lista, hoje, inicio, fim }) {
  const curto = d => formatarDia(d).slice(0, 5);
  const itens = lista.slice(0, MAX_LISTA_RANKING).map((x, i) => ({
    posicao: i + 1, apelido: x.apelido, emoji: x.emoji, valor: `${formatarNumero(x.pontos)} pts`
  }));
  const titulo = periodo === 'mes' ? 'Ranking do mês' : 'Ranking da semana';
  return {
    tipo: 'ranking',
    dia: hoje,
    titulo,
    subtitulo: `${grupo} · ${curto(inicio)} a ${curto(fim)}`,
    podio: itens.slice(0, 3),
    linhas: itens.slice(3),
    texto: `${titulo} — ${grupo} 💪`
  };
}
