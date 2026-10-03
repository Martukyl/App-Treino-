// Wrapper fino do navegador: watchPosition + wake lock. Sem regras de negócio.

export function suportaGps() {
  return typeof navigator !== 'undefined' && 'geolocation' in navigator;
}

// Converte GeolocationPosition em { lat, lon, alt, accuracy, t } (t = epoch ms).
export function normalizarPosicao(pos) {
  const c = pos.coords;
  return {
    lat: c.latitude, lon: c.longitude,
    alt: Number.isFinite(c.altitude) ? c.altitude : null,
    accuracy: c.accuracy,
    t: pos.timestamp || Date.now()
  };
}

// Liga o watchPosition (alta precisão). aoErro recebe { codigo, negado, mensagem }.
// Devolve uma função que desliga. Sem suporte, chama aoErro e devolve função vazia.
export function observar({ aoPosicao, aoErro }) {
  if (!suportaGps()) {
    setTimeout(() => aoErro?.({ codigo: 0, negado: false, semSuporte: true, mensagem: 'Sem suporte a GPS' }), 0);
    return () => {};
  }
  const id = navigator.geolocation.watchPosition(
    pos => aoPosicao(normalizarPosicao(pos)),
    err => aoErro?.({ codigo: err.code, negado: err.code === 1, semSuporte: false, mensagem: err.message }),
    { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 }
  );
  return () => navigator.geolocation.clearWatch(id);
}

// Mantém a tela ligada (Wake Lock). Re-solicita ao voltar à tela, pois o navegador solta o bloqueio
// quando a página fica oculta. → { suportado, liberar() }
export function manterTelaLigada() {
  const suportado = typeof navigator !== 'undefined' && !!navigator.wakeLock?.request;
  let trava = null;
  let ativo = true;
  const pedir = async () => {
    if (!suportado || !ativo || trava) return;
    try {
      trava = await navigator.wakeLock.request('screen');
      trava.addEventListener('release', () => { trava = null; });
      if (!ativo) { trava.release().catch(() => {}); trava = null; }
    } catch { trava = null; /* sem bateria/permissão: segue sem */ }
  };
  const aoVisivel = () => { if (!document.hidden) pedir(); };
  document.addEventListener('visibilitychange', aoVisivel);
  pedir();
  return {
    suportado,
    liberar() {
      ativo = false;
      document.removeEventListener('visibilitychange', aoVisivel);
      if (trava) { trava.release().catch(() => {}); trava = null; }
    }
  };
}
