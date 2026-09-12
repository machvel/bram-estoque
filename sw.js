// sw.js — guarda os arquivos do app em cache para que ele abra mesmo sem internet.
// Só os arquivos do app (HTML/CSS/JS) ficam em cache; os dados em si vivem no IndexedDB.
//
// IMPORTANTE: toda vez que atualizar qualquer arquivo do app (styles.css,
// ui.js, etc), troque o número aqui embaixo (v2 -> v3 -> v4...). Sem isso,
// quem já usa o app fica preso na versão antiga guardada em cache, mesmo
// depois de você subir os arquivos novos no GitHub.
const CACHE_NOME = 'bram-estoque-v3';
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

// Cache separado pra biblioteca externa do leitor de código de barras
// (usada só em navegadores sem leitura nativa, tipo Safari/iPhone).
// Guardamos ela aqui pra, depois do primeiro uso, funcionar offline também.
const CACHE_SCANNER = 'bram-scanner-lib-v1';
const HOST_SCANNER_EXTERNO = 'unpkg.com';

self.addEventListener('install', (evt) => {
  evt.waitUntil(
    caches.open(CACHE_NOME).then((cache) => cache.addAll(ARQUIVOS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (evt) => {
  evt.waitUntil(
    caches.keys().then((chaves) =>
      Promise.all(chaves.filter((k) => k !== CACHE_NOME && k !== CACHE_SCANNER).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (evt) => {
  if (evt.request.method !== 'GET') return;

  const url = new URL(evt.request.url);

  // Biblioteca externa do leitor de código de barras: guarda em cache
  // assim que baixar, e reusa depois — mesmo offline.
  if (url.hostname === HOST_SCANNER_EXTERNO) {
    evt.respondWith(
      caches.open(CACHE_SCANNER).then((cache) =>
        cache.match(evt.request).then((resposta) => {
          if (resposta) return resposta;
          return fetch(evt.request).then((resposta_rede) => {
            cache.put(evt.request, resposta_rede.clone());
            return resposta_rede;
          });
        })
      )
    );
    return;
  }

  // Só intercepta pedidos dos próprios arquivos do app (GET, mesma origem).
  // Chamadas ao backend do Google Apps Script passam direto (precisam de rede).
  if (!evt.request.url.startsWith(self.location.origin)) return;

  evt.respondWith(
    caches.match(evt.request).then((resposta) => resposta || fetch(evt.request))
  );
});
