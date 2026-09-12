// sw.js — guarda os arquivos do app em cache para que ele abra mesmo sem internet.
// Só os arquivos do app (HTML/CSS/JS) ficam em cache; os dados em si vivem no IndexedDB.

const CACHE_NOME = 'bram-estoque-v1';
const ARQUIVOS = [
  './',
  './index.html',
  './styles.css',
  './db.js',
  './sync.js',
  './app.js',
  './scanner.js',
  './ui.js',
  './manifest.json',
  './icone-192.png',
  './icone-512.png',
];

self.addEventListener('install', (evt) => {
  evt.waitUntil(
    caches.open(CACHE_NOME).then((cache) => cache.addAll(ARQUIVOS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (evt) => {
  evt.waitUntil(
    caches.keys().then((chaves) =>
      Promise.all(chaves.filter((k) => k !== CACHE_NOME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (evt) => {
  // Só intercepta pedidos dos próprios arquivos do app (GET, mesma origem).
  // Chamadas ao backend do Google Apps Script passam direto (precisam de rede).
  if (evt.request.method !== 'GET' || !evt.request.url.startsWith(self.location.origin)) return;

  evt.respondWith(
    caches.match(evt.request).then((resposta) => resposta || fetch(evt.request))
  );
});
