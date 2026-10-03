// Envio dos cards: Web Share com arquivo (celular) ou download do PNG (desktop/sem suporte),
// e a pré-visualização em sheet usada pelos 4 botões "Compartilhar".
import { esc } from './util.js';
import { abrirSheet, fecharSheet, toast, aoFecharSheetAtual } from './ui.js';
import { gerarCard } from './cards-canvas.js';
import { nomeArquivoCard } from './cards.js';

function baixar(blob, nomeArquivo) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nomeArquivo;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// Compartilha o PNG pelo menu do sistema; sem suporte a arquivos, baixa a imagem.
// Devolve 'compartilhado' | 'cancelado' | 'baixado'. AbortError (ela fechou o menu) não é erro.
export async function compartilharImagem(blob, nomeArquivo, texto) {
  try {
    const arquivo = new File([blob], nomeArquivo, { type: 'image/png' });
    if (navigator.canShare?.({ files: [arquivo] })) {
      await navigator.share({ files: [arquivo], text: texto });
      return 'compartilhado';
    }
  } catch (erro) {
    if (erro && erro.name === 'AbortError') return 'cancelado';
    // qualquer outra falha do menu de compartilhar: cai no download
  }
  baixar(blob, nomeArquivo);
  toast('Imagem salva');
  return 'baixado';
}

// Abre o sheet com a prévia do card.
// gerar(opcoes) → Promise<Blob PNG>; nomeArquivo e texto vão para compartilharImagem.
// opcoes.interruptorFotos: mostra "Incluir fotos (antes × depois)" (desligado por padrão).
export function abrirPrevia({ titulo, gerar, nomeArquivo, texto, interruptorFotos = false }) {
  let urlAtual = null;
  let geracao = 0; // descarta resultados de gerações antigas (troca rápida do interruptor)
  let blobAtual = null;
  let aberto = true;
  const soltarUrl = () => { if (urlAtual) { URL.revokeObjectURL(urlAtual); urlAtual = null; } };

  abrirSheet(`
    <h2 class="sheet-titulo">${esc(titulo)}</h2>
    <div class="previa"><p class="muted" data-previa-msg>Gerando imagem…</p><img data-campo="previa" alt="Pré-visualização do card" hidden></div>
    ${interruptorFotos ? `
      <label class="check-linha"><input type="checkbox" data-campo="incluir-fotos"> Incluir fotos (antes × depois)</label>
      <p class="selo-warn" data-aviso-fotos hidden>As fotos vão aparecer na imagem.</p>` : ''}
    <div class="sheet-acoes">
      <button type="button" class="btn btn-sec" data-acao="fechar">Fechar</button>
      <button type="button" class="btn btn-principal" data-acao="enviar" disabled>Compartilhar</button>
    </div>`, el => {
    const img = el.querySelector('[data-campo="previa"]');
    const msg = el.querySelector('[data-previa-msg]');
    const enviar = el.querySelector('[data-acao="enviar"]');
    const caixaFotos = el.querySelector('[data-campo="incluir-fotos"]');
    const avisoFotos = el.querySelector('[data-aviso-fotos]');

    const atualizar = async () => {
      const minha = ++geracao;
      enviar.disabled = true;
      let blob;
      try {
        blob = await gerar({ incluirFotos: !!(caixaFotos && caixaFotos.checked) });
      } catch (erro) {
        console.error(erro);
        if (aberto && minha === geracao) { toast('Não consegui gerar a imagem'); fecharSheet(); }
        return;
      }
      if (!aberto || minha !== geracao) return;
      soltarUrl();
      blobAtual = blob;
      urlAtual = URL.createObjectURL(blob);
      img.src = urlAtual;
      img.hidden = false;
      msg.hidden = true;
      enviar.disabled = false;
    };

    if (caixaFotos) {
      caixaFotos.onchange = () => {
        avisoFotos.hidden = !caixaFotos.checked;
        atualizar();
      };
    }
    el.querySelector('[data-acao="fechar"]').onclick = fecharSheet;
    enviar.onclick = async () => {
      if (!blobAtual) return;
      enviar.disabled = true;
      try {
        const r = await compartilharImagem(blobAtual, nomeArquivo, texto);
        if (r !== 'cancelado') fecharSheet();
      } finally {
        enviar.disabled = false;
      }
    };
    atualizar();
  });
  aoFecharSheetAtual(() => { aberto = false; soltarUrl(); });
}

// Atalho das telas: fazerDados({ incluirFotos }) devolve os dados do card (cards.js);
// gera o PNG, mostra a prévia e compartilha.
export function compartilharCard(titulo, fazerDados, { interruptorFotos = false } = {}) {
  const base = fazerDados({ incluirFotos: false });
  abrirPrevia({
    titulo,
    gerar: opcoes => gerarCard(fazerDados(opcoes)),
    nomeArquivo: nomeArquivoCard(base.tipo, base.dia || ''),
    texto: base.texto,
    interruptorFotos
  });
}
