// Service worker: cache do app shell para funcionar offline.
// Ao alterar QUALQUER arquivo do app, incremente CACHE.
// Deve ser igual a VERSAO_APP em js/util.js (treino-<VERSAO_APP>).
const CACHE = 'treino-1.4.3';
const ARQUIVOS = [
  './', './index.html', './manifest.webmanifest', './css/app.css',
  './js/app.js', './js/estado.js', './js/ui.js', './js/util.js', './js/dados.js',
  './js/progressao.js', './js/armazenamento.js', './js/cronometro.js', './js/grafico.js',
  './js/telas/hoje.js', './js/telas/treino.js', './js/telas/trocar.js',
  './js/telas/exercicios.js', './js/telas/historico.js', './js/telas/ajustes.js',
  './js/corpo.js', './js/fotos.js', './js/telas/corpo.js', './js/telas/corpo-comum.js',
  './js/telas/corpo-registro.js', './js/telas/corpo-fotos.js',
  './js/geo.js', './js/cardio.js', './js/banco.js', './js/trajetos.js', './js/gps.js', './js/mapa.js',
  './js/cardio-ao-vivo.js', './js/gravacao.js',
  './js/pontos.js', './js/cards.js', './js/cards-canvas.js', './js/compartilhar.js', './js/telas/boas-vindas.js',
  './js/telas/cardio-gps.js', './js/telas/cardio-aparelho.js', './js/telas/cardio-detalhe.js',
  './js/config-ranking.js', './js/supabase.js', './js/ranking-calculo.js', './js/ranking.js', './js/telas/ranking.js', './js/telas/grupo.js',
  './vendor/leaflet/leaflet.js', './vendor/leaflet/leaflet.css',
  './img/treino-a.jpg', './img/treino-b.jpg', './img/treino-c.jpg', './img/treino-d.jpg', './img/treino-e.jpg',
  './icons/icon.svg', './icons/icon-192.png', './icons/icon-512.png', './icons/apple-touch-icon.png'
];

self.addEventListener('install', ev => {
  ev.waitUntil(caches.open(CACHE).then(c => c.addAll(ARQUIVOS.map(u => new Request(u, { cache: 'reload' })))).then(() => self.skipWaiting()));
});

self.addEventListener('activate', ev => {
  ev.waitUntil(
    caches.keys()
      .then(chaves => Promise.all(chaves.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', ev => {
  if (ev.request.method !== 'GET') return;
  // só a própria origem passa pelo cache; outras origens (mapa, futuramente o ranking) vão direto à rede
  if (new URL(ev.request.url).origin !== self.location.origin) return;
  ev.respondWith(caches.match(ev.request, { ignoreSearch: true }).then(r => r || fetch(ev.request)));
});
