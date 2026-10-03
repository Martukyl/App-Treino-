// Peças compartilhadas das telas do Corpo e da tela Hoje: diferenças coloridas e avatar.
import { esc, formatarNumero } from '../util.js';
import { direcaoDiferenca, resumoCampo } from '../corpo.js';
import { carregarImagens } from '../fotos.js';

// "+1,2" / "−0,5" / "0"; sem valor, traço
export function fmtDif(d) {
  if (d == null) return '—';
  if (d === 0) return '0';
  return `${d > 0 ? '+' : '−'}${formatarNumero(Math.abs(d))}`;
}

// contexto que a regra de direção do peso precisa (peso atual e meta)
export function ctxPeso(est) {
  return { pesoAtual: resumoCampo(est.medidas, 'peso').atual, metaPeso: est.perfil.metaPeso };
}

// diferença colorida: boa = verde, ruim = âmbar, neutra = cinza
export function spanDif(campo, dif, ctx) {
  return `<span class="dif dif-${direcaoDiferenca(campo, dif, ctx)}">${fmtDif(dif)}</span>`;
}

// letra inicial do nome; sem nome, um rostinho
export function inicialAvatar(nome) {
  const n = (nome || '').trim();
  return n ? [...n][0].toUpperCase() : '🙂';
}

// Círculo de avatar: foto do perfil (carregada depois, via ligarAvatares) ou a inicial.
export function htmlAvatar(est, classe = '') {
  const fotoId = est.perfil && est.perfil.fotoId;
  if (fotoId) {
    return `<span class="avatar ${classe}"><img data-foto="${esc(fotoId)}" alt=""></span>`;
  }
  return `<span class="avatar avatar-letra ${classe}">${esc(inicialAvatar(est.nome))}</span>`;
}

// Carrega as fotos dos avatares; se a foto sumiu do banco, cai na inicial.
export function ligarAvatares(raiz, est) {
  carregarImagens(raiz, img => {
    const av = img.closest('.avatar');
    if (!av) return;
    av.classList.add('avatar-letra');
    av.textContent = inicialAvatar(est.nome);
  });
}
