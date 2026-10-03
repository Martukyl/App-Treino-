// Registro de medidas (#/corpo/registro/novo e #/corpo/registro/<id>): peso, medidas e até 3 fotos.
//
// Ciclo de vida das fotos (IndexedDB):
//  - foto nova: gravada assim que escolhida; se o registro não for salvo (cancelar/sair), é apagada;
//  - foto substituída/removida de um registro já salvo: só é apagada ao SALVAR;
//  - excluir o registro apaga todas as suas fotos.
import { esc, parseCarga, formatarCampo, formatarDia, gerarId, hojeISO } from '../util.js';
import { CAMPOS_CORPO, ultimoValor } from '../corpo.js';
import { obterEstado, atualizar } from '../estado.js';
import { comprimirImagem, salvarFoto, apagarFoto, urlFoto } from '../fotos.js';
import { confirmar, toast, aoSairDaTela } from '../ui.js';

const POSICOES = [['frente', 'Frente'], ['lado', 'Lado'], ['costas', 'Costas']];

function htmlCampo(c, medida, est) {
  const valor = medida ? medida[c.campo] : null;
  const ultimo = ultimoValor(est.medidas, c.campo);
  return `<label>${esc(c.rotulo)} (${esc(c.unidade)})<input type="text" inputmode="decimal" data-campo="${esc(c.campo)}" placeholder="${ultimo != null ? esc(formatarCampo(ultimo)) : ''}" value="${valor != null ? esc(formatarCampo(valor)) : ''}"></label>`;
}

export function render(param) {
  const est = obterEstado();
  const novo = param === 'novo';
  const medida = novo ? null : est.medidas.find(m => m.id === param);
  if (!novo && !medida) {
    return `
      <div class="tela-registro">
        <a class="voltar" href="#/corpo">← Corpo</a>
        <h1 class="titulo">Registro não encontrado</h1>
        <a class="btn btn-principal btn-bloco" href="#/corpo">Voltar para Corpo</a>
      </div>`;
  }
  const peso = CAMPOS_CORPO.find(c => c.campo === 'peso');
  const grupo = nome => CAMPOS_CORPO.filter(c => c.grupo === nome).map(c => htmlCampo(c, medida, est)).join('');
  const slots = POSICOES.map(([pos, rotulo]) => `
    <div class="foto-slot" data-pos="${pos}">
      <button type="button" class="foto-mini" data-acao="escolher" aria-label="Foto de ${esc(rotulo.toLowerCase())}"></button>
      <span class="foto-rotulo">${rotulo}</span>
      <button type="button" class="btn btn-sec foto-remover" data-acao="remover" hidden>Remover</button>
      <input type="file" accept="image/*" hidden data-campo="arquivo-${pos}">
    </div>`).join('');
  return `
    <div class="tela-registro" data-id="${esc(medida ? medida.id : '')}">
      <a class="voltar" href="#/corpo">← Corpo</a>
      <h1 class="titulo">${novo ? 'Novo registro' : 'Editar registro'}</h1>
      <section class="card">
        <label>Data<input type="date" data-campo="data" max="${hojeISO()}" value="${esc(medida ? medida.data : hojeISO())}"></label>
        <div class="campos-presc">${htmlCampo(peso, medida, est)}</div>
        <h3 class="sec-troca">Superiores</h3>
        <div class="campos-presc">${grupo('Superiores')}</div>
        <h3 class="sec-troca">Inferiores</h3>
        <div class="campos-presc">${grupo('Inferiores')}</div>
      </section>
      <section class="card">
        <h2 class="sec-card">Fotos</h2>
        <p class="muted">Ficam só neste aparelho (e no backup que você exportar).</p>
        <div class="foto-slots">${slots}</div>
      </section>
      <p class="form-erro" data-erro hidden></p>
      <button type="button" class="btn btn-principal btn-bloco" data-acao="salvar">Salvar</button>
      ${novo ? '' : '<button type="button" class="btn btn-perigo btn-bloco" data-acao="excluir">Excluir registro</button>'}
    </div>`;
}

export function montar(raiz, param) {
  const tela = raiz.querySelector('.tela-registro');
  if (!tela || !tela.querySelector('[data-acao="salvar"]')) return;
  const est0 = obterEstado();
  const original = param === 'novo' ? null : est0.medidas.find(m => m.id === param);

  // estado local da tela
  const reg = {
    ativo: true,                       // false depois que a tela é fechada
    fotos: { frente: null, lado: null, costas: null, ...(original ? original.fotos : {}) },
    novas: new Set(),                  // fotos gravadas nesta tela e ainda não salvas no registro
    substituidas: new Set(),           // fotos do registro salvo trocadas/removidas (apagar ao salvar)
    espera: Promise.resolve(),         // fila de compressões em andamento
    salvando: false
  };
  const idsOriginais = original ? Object.values(original.fotos || {}).filter(Boolean) : [];

  // sair sem salvar: apaga as fotos novas que ficaram gravadas
  aoSairDaTela(() => {
    reg.ativo = false;
    for (const id of reg.novas) apagarFoto(id).catch(() => {});
    reg.novas.clear();
  });

  const erro = tela.querySelector('[data-erro]');
  const mostrarErro = txt => { erro.textContent = txt; erro.hidden = !txt; };

  // ----- fotos -----
  const desenharSlot = pos => {
    const slot = tela.querySelector(`.foto-slot[data-pos="${pos}"]`);
    const mini = slot.querySelector('.foto-mini');
    const id = reg.fotos[pos];
    slot.querySelector('[data-acao="remover"]').hidden = !id;
    if (!id) { mini.innerHTML = '<span aria-hidden="true">📷</span>'; return; }
    mini.innerHTML = '<img alt="">';
    urlFoto(id).then(url => {
      if (reg.fotos[pos] !== id) return;
      if (url) mini.firstElementChild.src = url;
      else mini.innerHTML = '<span aria-hidden="true">⚠️</span>';
    });
  };

  // tira a foto do slot: se era nova apaga já; se era do registro salvo, só apaga ao salvar
  const soltarFoto = id => {
    if (!id) return;
    if (reg.novas.has(id)) { reg.novas.delete(id); apagarFoto(id).catch(() => {}); }
    else reg.substituidas.add(id);
  };

  for (const [pos] of POSICOES) {
    const slot = tela.querySelector(`.foto-slot[data-pos="${pos}"]`);
    const arquivo = slot.querySelector('input[type="file"]');
    slot.querySelector('[data-acao="escolher"]').onclick = () => arquivo.click();
    slot.querySelector('[data-acao="remover"]').onclick = () => {
      soltarFoto(reg.fotos[pos]);
      reg.fotos[pos] = null;
      desenharSlot(pos);
    };
    arquivo.onchange = () => {
      const file = arquivo.files && arquivo.files[0];
      arquivo.value = '';
      if (!file) return;
      slot.classList.add('carregando');
      // em fila: o Salvar espera as compressões terminarem
      reg.espera = reg.espera.then(async () => {
        try {
          const id = await salvarFoto(await comprimirImagem(file));
          if (!reg.ativo) { apagarFoto(id).catch(() => {}); return; } // saiu da tela no meio
          soltarFoto(reg.fotos[pos]);
          reg.fotos[pos] = id;
          reg.novas.add(id);
          desenharSlot(pos);
        } catch {
          toast('Não foi possível salvar a foto');
        } finally {
          slot.classList.remove('carregando');
        }
      });
    };
    desenharSlot(pos);
  }

  // ----- leitura e validação do formulário -----
  const ler = () => {
    tela.querySelectorAll('input.invalido').forEach(i => i.classList.remove('invalido'));
    const dataInp = tela.querySelector('[data-campo="data"]');
    const data = dataInp.value;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(data) || data > hojeISO()) {
      dataInp.classList.add('invalido');
      mostrarErro('Escolha uma data válida (hoje ou antes).');
      return null;
    }
    const valores = {};
    let invalido = false;
    for (const c of CAMPOS_CORPO) {
      const inp = tela.querySelector(`[data-campo="${c.campo}"]`);
      const txt = inp.value.trim();
      if (txt === '') { valores[c.campo] = null; continue; }
      const n = parseCarga(txt);
      if (n == null || n <= 0) { inp.classList.add('invalido'); invalido = true; } else valores[c.campo] = n;
    }
    if (invalido) { mostrarErro('Confira os números destacados (use só números, com vírgula se precisar).'); return null; }
    const temAlgo = CAMPOS_CORPO.some(c => valores[c.campo] != null) || Object.values(reg.fotos).some(Boolean);
    if (!temAlgo) { mostrarErro('Preencha ao menos o peso, uma medida ou uma foto.'); return null; }
    mostrarErro('');
    return { data, valores };
  };

  tela.querySelector('[data-acao="salvar"]').onclick = async () => {
    if (reg.salvando) return;
    reg.salvando = true;
    try {
      await reg.espera;
      const lido = ler();
      if (!lido) return;
      const { data, valores } = lido;
      const duplicado = obterEstado().medidas.some(m => m.data === data && m.id !== (original && original.id));
      if (duplicado && !(await confirmar(`Já existe um registro em ${formatarDia(data).slice(0, 5)}. Salvar mesmo assim?`, 'Salvar'))) return;
      const registro = {
        id: original ? original.id : gerarId('m_'),
        data, ...valores, fotos: { ...reg.fotos }
      };
      atualizar(e => {
        const i = e.medidas.findIndex(m => m.id === registro.id);
        if (i >= 0) e.medidas[i] = registro; else e.medidas.push(registro);
      }, { renderizar: false });
      // salvou: as fotos novas agora pertencem ao registro; as trocadas/removidas saem do banco
      for (const id of reg.substituidas) apagarFoto(id).catch(() => {});
      reg.novas.clear();
      reg.substituidas.clear();
      toast('Medidas salvas');
      location.hash = '#/corpo';
    } finally {
      reg.salvando = false;
    }
  };

  const excluir = tela.querySelector('[data-acao="excluir"]');
  if (excluir) {
    excluir.onclick = async () => {
      if (!(await confirmar('Excluir este registro? As fotos dele também serão apagadas.', 'Excluir', true))) return;
      await reg.espera;
      atualizar(e => { e.medidas = e.medidas.filter(m => m.id !== original.id); }, { renderizar: false });
      // fotos do registro + as novas ainda não salvas + as substituídas aguardando
      for (const id of new Set([...idsOriginais, ...reg.novas, ...reg.substituidas])) apagarFoto(id).catch(() => {});
      reg.novas.clear();
      reg.substituidas.clear();
      toast('Registro excluído');
      location.hash = '#/corpo';
    };
  }
}
