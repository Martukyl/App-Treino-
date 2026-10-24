// Calendário do mês no Histórico: células (segunda primeiro), resumo do mês e navegação entre meses.
import { diaLocal } from './pontos.js';

const doisDig = n => String(n).padStart(2, '0');
const isoDia = (ano, mes, dia) => `${ano}-${doisDig(mes)}-${doisDig(dia)}`;

// dias locais (AAAA-MM-DD) em que houve registro concluído
const diasComFim = lista => new Set((lista || []).filter(x => x.fim).map(x => diaLocal(x.fim)).filter(Boolean));

export function diasDoMes(ano, mes, sessoes, cardios, hojeISO) {
  const treinos = diasComFim(sessoes), comCardio = diasComFim(cardios);
  const vazias = (new Date(ano, mes - 1, 1).getDay() + 6) % 7; // 0 = segunda
  const total = new Date(ano, mes, 0).getDate();
  const celulas = Array.from({ length: vazias }, () => ({ dia: null, iso: null, treino: false, cardio: false, hoje: false }));
  for (let d = 1; d <= total; d++) {
    const iso = isoDia(ano, mes, d);
    celulas.push({ dia: d, iso, treino: treinos.has(iso), cardio: comCardio.has(iso), hoje: iso === hojeISO });
  }
  return celulas;
}

const doMes = (ano, mes) => x => x.fim && (diaLocal(x.fim) || '').startsWith(`${ano}-${doisDig(mes)}-`);
const minutos = x => (x.duracaoSeg != null ? x.duracaoSeg / 60 : (new Date(x.fim) - new Date(x.inicio)) / 60000) || 0;

export function resumoDoMes(ano, mes, sessoes, cardios) {
  const s = (sessoes || []).filter(doMes(ano, mes)), c = (cardios || []).filter(doMes(ano, mes));
  const min = [...s, ...c].reduce((soma, x) => soma + Math.max(0, minutos(x)), 0);
  return { treinos: s.length, cardios: c.length, horas: Math.round(min / 60) };
}

export function mesVizinho(ano, mes, delta) {
  const d = new Date(ano, mes - 1 + delta, 1);
  return { ano: d.getFullYear(), mes: d.getMonth() + 1 };
}
