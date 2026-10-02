// Service worker: cache do app shell para funcionar offline.
// Ao alterar QUALQUER arquivo do app, incremente CACHE.
const CACHE = 'treino-v6';
const ARQUIVOS = [
  './', './index.html', './manifest.webmanifest', './css/app.css',
  './js/app.js', './js/estado.js', './js/ui.js', './js/util.js', './js/dados.js',
  './js/progressao.js', './js/armazenamento.js', './js/cronometro.js', './js/grafico.js',
  './js/telas/hoje.js', './js/telas/treino.js', './js/telas/trocar.js',
  './js/telas/exercicios.js', './js/telas/historico.js', './js/telas/ajustes.js',
  './icons/icon.svg', './icons/icon-192.png', './icons/icon-512.png', './icons/apple-touch-icon.png'
];

self.addEventListener('install', ev => {
  ev.waitUntil(caches.open(CACHE).then(c => c.addAll(ARQUIVOS)).then(() => self.skipWaiting()));
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
  ev.respondWith(caches.match(ev.request, { ignoreSearch: true }).then(r => r || fetch(ev.request)));
});
