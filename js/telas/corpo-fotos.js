// Comparar fotos (#/corpo/fotos): duas datas lado a lado, na mesma posição.
import { esc, formatarDia, formatarNumero } from '../util.js';
import { ordenarPorData } from '../corpo.js';
import { obterEstado } from '../estado.js';
import { urlFoto, liberarUrl, carregarImagens } from '../fotos.js';
import { abrirSheet, fecharSheet } from '../ui.js';

const POSICOES = [['frente', 'Frente'], ['lado', 'Lado'], ['costas', 'Costas']];

// registros que têm ao menos uma foto, do mais antigo ao mais novo
const comFoto = est => ordenarPorData(est.medidas).filter(m => Object.values(m.fotos || {}).some(Boolean));

function rotuloRegistro(m) {
  return typeof m.peso === 'number' ? `${formatarDia(m.data)} · ${formatarNumero(m.peso)} kg` : formatarDia(m.data);
}

export function render() {
  const registros = comFoto(obterEstado());
  if (registros.length < 2) {
    return `
      <div class="tela-fotos">
        <a class="voltar" href="#/corpo">← Corpo</a>
        <h1 class="titulo">Comparar fotos</h1>
        <section class="card"><p class="muted">Você precisa de pelo menos 2 registros com foto para comparar.</p></section>
      </div>`;
  }
  const opcoes = sel => registros.map(m =>
    `<option value="${esc(m.id)}"${m.id === sel ? ' selected' : ''}>${esc(rotuloRegistro(m))}</option>`).join('');
  return `
    <div class="tela-fotos">
      <a class="voltar" href="#/corpo">← Corpo</a>
      <h1 class="titulo">Comparar fotos</h1>
      <section class="card">
        <div class="campos-presc">
          <label>Antes<select data-campo="antes">${opcoes(registros[0].id)}</select></label>
          <label>Depois<select data-campo="depois">${opcoes(registros.at(-1).id)}</select></label>
        </div>
        <div class="chips posicoes" role="group" aria-label="Posição da foto">
          ${POSICOES.map(([pos, rotulo]) => `<button type="button" class="chip" data-pos="${pos}">${rotulo}</button>`).join('')}
        </div>
        <div class="comparacao" data-area></div>
      </section>
    </div>`;
}

export function montar(raiz) {
  const tela = raiz.querySelector('.tela-fotos');
  if (!tela || !tela.querySelector('[data-area]')) return;
  const registros = comFoto(obterEstado());
  const porId = id => registros.find(m => m.id === id);
  const selAntes = tela.querySelector('[data-campo="antes"]');
  const selDepois = tela.querySelector('[data-campo="depois"]');
  const area = tela.querySelector('[data-area]');
  let posicao = 'frente';
  let mostrados = []; // ids de foto com URL em uso, para revogar ao trocar

  const desenhar = () => {
    const a = porId(selAntes.value), d = porId(selDepois.value);
    const disponivel = pos => !!(a.fotos && a.fotos[pos] && d.fotos && d.fotos[pos]);
    if (!disponivel(posicao)) posicao = POSICOES.map(p => p[0]).find(disponivel) || posicao;
    tela.querySelectorAll('.posicoes .chip').forEach(b => {
      b.disabled = !disponivel(b.dataset.pos);
      b.classList.toggle('chip-ativo', b.dataset.pos === posicao && !b.disabled);
    });
    // libera as fotos que deixaram de ser exibidas
    const novos = disponivel(posicao) ? [a.fotos[posicao], d.fotos[posicao]] : [];
    mostrados.filter(id => !novos.includes(id)).forEach(liberarUrl);
    mostrados = novos;
    if (!novos.length) {
      area.innerHTML = '<p class="muted">Esses dois registros não têm foto na mesma posição.</p>';
      return;
    }
    const lado = (titulo, m, id) => `
      <figure class="comp-foto">
        <button type="button" class="comp-img" data-abrir="${esc(id)}" aria-label="Abrir foto ${esc(titulo.toLowerCase())} em tela cheia"><img data-foto="${esc(id)}" alt=""></button>
        <figcaption><strong>${titulo}</strong><br>${esc(rotuloRegistro(m))}</figcaption>
      </figure>`;
    area.innerHTML = lado('Antes', a, novos[0]) + lado('Depois', d, novos[1]);
    carregarImagens(area, img => { img.replaceWith(Object.assign(document.createElement('span'), { textContent: 'Foto indisponível', className: 'muted' })); });
    area.querySelectorAll('[data-abrir]').forEach(b => {
      b.onclick = async () => {
        const url = await urlFoto(b.dataset.abrir);
        if (!url) return;
        abrirSheet(`
          <button type="button" class="foto-cheia-fundo" data-acao="fechar" aria-label="Fechar"><img class="foto-cheia" src="${esc(url)}" alt=""></button>
          <button type="button" class="btn btn-sec btn-bloco" data-acao="fechar">Fechar</button>`, el => {
          el.querySelectorAll('[data-acao="fechar"]').forEach(f => { f.onclick = () => fecharSheet(); });
        });
      };
    });
  };

  selAntes.onchange = desenhar;
  selDepois.onchange = desenhar;
  tela.querySelectorAll('.posicoes .chip').forEach(b => {
    b.onclick = () => { posicao = b.dataset.pos; desenhar(); };
  });
  desenhar();
}
