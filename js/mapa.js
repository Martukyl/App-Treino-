// Mapa (Leaflet 1.9.4, carregado sob demanda) para a gravação ao vivo e o detalhe do cardio.
// Só L.map, L.tileLayer, L.polyline e L.circleMarker (as imagens de marcador não existem no app).

const COR_TRAJETO = '#d54b32'; // accent do tema claro
const URL_TILES = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';

let carregando = null;

// Injeta CSS e JS do Leaflet uma única vez. Rejeita se o script não carregar.
export function carregarLeaflet() {
  if (window.L && window.L.map) return Promise.resolve(window.L);
  if (carregando) return carregando;
  carregando = new Promise((resolve, reject) => {
    if (!document.querySelector('link[data-leaflet]')) {
      const css = document.createElement('link');
      css.rel = 'stylesheet';
      css.href = './vendor/leaflet/leaflet.css';
      css.dataset.leaflet = '1';
      document.head.appendChild(css);
    }
    const js = document.createElement('script');
    js.src = './vendor/leaflet/leaflet.js';
    js.onload = () => (window.L ? resolve(window.L) : reject(new Error('Leaflet ausente')));
    js.onerror = () => reject(new Error('Não foi possível carregar o mapa'));
    document.head.appendChild(js);
  });
  carregando.catch(() => { carregando = null; });
  return carregando;
}

function criarBase(L, el, opcoes = {}) {
  const mapa = L.map(el, { zoomControl: false, attributionControl: true, zoomSnap: 0.5, ...opcoes });
  mapa.attributionControl.setPrefix(false);
  L.tileLayer(URL_TILES, { maxZoom: 19, attribution: '© OpenStreetMap' })
    .on('tileerror', () => {}) // sem internet: fica o fundo liso
    .addTo(mapa);
  return mapa;
}

const linha = L => ([lat, lon]) => L.latLng(lat, lon);

// Mapa ao vivo: segue a posição até o usuário arrastar; centralizar() volta a seguir.
export async function criarMapaAoVivo(el, { aoSoltarSeguir } = {}) {
  const L = await carregarLeaflet();
  const mapa = criarBase(L, el);
  mapa.setView([-14.2, -51.9], 4); // Brasil, até chegar o primeiro ponto
  let seguindo = true;
  let linhas = [];
  let marcador = null;
  let tevePosicao = false;

  // arrastar com o dedo = parar de seguir (dragstart só dispara por gesto do usuário)
  mapa.on('dragstart', () => { seguindo = false; aoSoltarSeguir?.(); });

  const mover = (latlng) => {
    if (!tevePosicao) { mapa.setView(latlng, 17, { animate: false }); tevePosicao = true; }
    else mapa.panTo(latlng, { animate: false });
  };

  return {
    get seguindo() { return seguindo; },
    // redesenha tudo: segmentos = [[ [lat, lon, alt, t], … ], …]
    definirTrajeto(segmentos) {
      linhas.forEach(l => l.remove());
      linhas = segmentos.filter(s => s.length).map(s =>
        L.polyline(s.map(linha(L)), { color: COR_TRAJETO, weight: 5, opacity: 0.95 }).addTo(mapa));
      const ultimoSeg = segmentos.filter(s => s.length).at(-1);
      if (ultimoSeg) this.posicao(ultimoSeg.at(-1)[0], ultimoSeg.at(-1)[1]);
    },
    // acrescenta um ponto aceito (novo = abre segmento)
    adicionarPonto(lat, lon, novo) {
      const ll = L.latLng(lat, lon);
      if (novo || !linhas.length) {
        linhas.push(L.polyline([ll], { color: COR_TRAJETO, weight: 5, opacity: 0.95 }).addTo(mapa));
      } else {
        linhas.at(-1).addLatLng(ll);
      }
      this.posicao(lat, lon);
    },
    posicao(lat, lon) {
      const ll = L.latLng(lat, lon);
      if (!marcador) {
        marcador = L.circleMarker(ll, { radius: 8, color: '#fff', weight: 3, fillColor: COR_TRAJETO, fillOpacity: 1 }).addTo(mapa);
      } else {
        marcador.setLatLng(ll);
      }
      if (seguindo || !tevePosicao) mover(ll);
    },
    centralizar() {
      seguindo = true;
      if (marcador) mover(marcador.getLatLng());
    },
    destruir() {
      try { mapa.remove(); } catch { /* já removido */ }
      linhas = []; marcador = null;
    }
  };
}

// Mapa estático do trajeto inteiro: fitBounds, início verde e fim vermelho.
export async function criarMapaEstatico(el, segmentos) {
  const L = await carregarLeaflet();
  const mapa = criarBase(L, el);
  const validos = segmentos.filter(s => s.length);
  const todos = [];
  for (const s of validos) {
    const pts = s.map(linha(L));
    todos.push(...pts);
    L.polyline(pts, { color: COR_TRAJETO, weight: 5, opacity: 0.95 }).addTo(mapa);
  }
  if (todos.length) {
    L.circleMarker(todos[0], { radius: 8, color: '#fff', weight: 3, fillColor: '#3ddc97', fillOpacity: 1 }).addTo(mapa);
    L.circleMarker(todos.at(-1), { radius: 8, color: '#fff', weight: 3, fillColor: '#ff4d4f', fillOpacity: 1 }).addTo(mapa);
    if (todos.length === 1) mapa.setView(todos[0], 16);
    else mapa.fitBounds(L.latLngBounds(todos), { padding: [28, 28], maxZoom: 18 });
  } else {
    mapa.setView([-14.2, -51.9], 4);
  }
  return { destruir() { try { mapa.remove(); } catch { /* já removido */ } } };
}
