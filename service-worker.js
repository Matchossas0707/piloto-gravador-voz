'use strict';

const CACHE_ATUAL = 'piloto-voz-r7.0.0';
const PAGINA_APP =
  new URL('./realtime-microfone-teste.html', self.location.href).href;

const ARQUIVOS_APP = [
  PAGINA_APP,
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png'
].map(function (arquivo) {
  return new URL(arquivo, self.location.href).href;
});

const CAMINHOS_APP = new Set(
  ARQUIVOS_APP.map(function (arquivo) {
    return new URL(arquivo).pathname;
  })
);

self.addEventListener('install', function (evento) {
  evento.waitUntil(
    caches.open(CACHE_ATUAL)
      .then(function (cache) {
        return cache.addAll(ARQUIVOS_APP);
      })
      .then(function () {
        return self.skipWaiting();
      })
  );
});

self.addEventListener('activate', function (evento) {
  evento.waitUntil(
    caches.keys()
      .then(function (chaves) {
        return Promise.all(
          chaves.filter(function (chave) {
            return chave !== CACHE_ATUAL &&
              chave.startsWith('piloto-voz-');
          }).map(function (chave) {
            return caches.delete(chave);
          })
        );
      })
      .then(function () {
        return self.clients.claim();
      })
  );
});

self.addEventListener('fetch', function (evento) {
  const requisicao = evento.request;
  const url = new URL(requisicao.url);

  /*
   * Nunca interceptamos API, Apps Script, POST, credenciais ou outras
   * páginas do repositório. Só os quatro arquivos estáticos deste app.
   */
  if (
    requisicao.method !== 'GET' ||
    url.origin !== self.location.origin ||
    !CAMINHOS_APP.has(url.pathname)
  ) {
    return;
  }

  if (url.pathname === new URL(PAGINA_APP).pathname) {
    evento.respondWith((async function () {
      const cache = await caches.open(CACHE_ATUAL);

      try {
        const resposta = await fetch(requisicao);

        if (resposta.ok) {
          try {
            await cache.put(PAGINA_APP, resposta.clone());
          } catch (erroCache) {
            // A falta de espaço não impede o uso online da plataforma.
          }
        }

        return resposta;

      } catch (erroRede) {
        const armazenada = await cache.match(PAGINA_APP);

        return armazenada || Response.error();
      }
    })());

    return;
  }

  const atualizar =
    fetch(requisicao).then(async function (resposta) {
      if (resposta.ok) {
        try {
          const cache = await caches.open(CACHE_ATUAL);
          const endereco =
            new URL(url.pathname, self.location.origin).href;

          await cache.put(endereco, resposta.clone());
        } catch (erroCache) {
          // O recurso online continua disponível sem armazenamento.
        }
      }

      return resposta;
    }).catch(function () {
      return null;
    });

  evento.waitUntil(atualizar.then(function () {}));

  evento.respondWith((async function () {
    const cache = await caches.open(CACHE_ATUAL);
    const endereco =
      new URL(url.pathname, self.location.origin).href;
    const armazenada = await cache.match(endereco);

    return armazenada || await atualizar || Response.error();
  })());
});
