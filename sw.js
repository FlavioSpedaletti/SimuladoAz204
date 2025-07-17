const CACHE_NAME = 'simulado-az204-v9';
const STATIC_CACHE_NAME = 'simulado-az204-static-v9';
const DATA_CACHE_NAME = 'simulado-az204-data-v9';

const STATIC_FILES = [
  '/',
  '/index.html',
  '/validador.html',
  '/manifest.json',
  '/assets/ico/favicon-16x16.png',
  '/assets/ico/favicon-32x32.png',
  '/assets/ico/favicon-96x96.png',
  '/assets/ico/android-icon-192x192.png',
  '/assets/ico/apple-icon-180x180.png'
];

const DATA_FILES = [
  '/data/data.json'
];

// Função para normalizar URLs removendo query parameters
function normalizeUrl(url) {
  const urlObj = new URL(url, self.location.origin);
  return urlObj.pathname;
}

// Cache individual com debugging
async function cacheFilesIndividually(cache, files, cacheName) {
  console.log(`[SW] Fazendo cache de ${files.length} arquivos para ${cacheName}`);
  
  for (const file of files) {
    try {
      const response = await fetch(file);
      if (response.ok) {
        await cache.put(file, response.clone());
        console.log(`[SW] ✅ Cache: ${file}`);
      }
    } catch (error) {
      console.error(`[SW] ❌ Erro no cache de ${file}:`, error);
    }
  }
}

self.addEventListener('install', event => {
  console.log('[SW] Instalando Service Worker v9...');
  
  event.waitUntil(
    Promise.all([
      caches.open(STATIC_CACHE_NAME).then(cache => 
        cacheFilesIndividually(cache, STATIC_FILES, 'static')
      ),
      caches.open(DATA_CACHE_NAME).then(cache => 
        cacheFilesIndividually(cache, DATA_FILES, 'data')
      )
    ]).then(() => {
      console.log('[SW] ✅ Instalação concluída');
      self.skipWaiting();
    })
  );
});

self.addEventListener('activate', event => {
  console.log('[SW] Ativando Service Worker...');
  
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (!cacheName.includes('v9')) {
            console.log(`[SW] Removendo cache antigo: ${cacheName}`);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      console.log('[SW] ✅ Ativação concluída');
      self.clients.claim();
    })
  );
});

self.addEventListener('fetch', event => {
  const { request } = event;
  const url = request.url;
  
  // Dados JSON - Network First
  if (url.includes('/data/')) {
    event.respondWith(networkFirstForData(request));
  }
  // Arquivos JS/CSS - Network First (garantir atualizações)
  else if (url.includes('.js') || url.includes('.css')) {
    event.respondWith(networkFirstForCode(request));
  }
  // Google Analytics - Graceful degradation
  else if (url.includes('gtag') || url.includes('google')) {
    event.respondWith(
      fetch(request).catch(() => new Response('', { status: 200 }))
    );
  }
  // Outros recursos - Cache First
  else if (url.startsWith(self.location.origin)) {
    event.respondWith(cacheFirstForAssets(request));
  }
});

// Network First para dados JSON
async function networkFirstForData(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(DATA_CACHE_NAME);
      cache.put(request, response.clone());
      console.log(`[SW] 🌐 Dados atualizados: ${request.url}`);
    }
    return response;
  } catch (error) {
    console.log(`[SW] 🔌 Dados offline: ${request.url}`);
    return caches.match(request);
  }
}

// Network First para JS/CSS (garante atualizações quando online)
async function networkFirstForCode(request) {
  try {
    console.log(`[SW] 🌐 Buscando atualização de código: ${request.url}`);
    const response = await fetch(request);
    
    if (response.ok) {
      console.log(`[SW] ✅ Código atualizado da rede: ${request.url}`);
      const cache = await caches.open(STATIC_CACHE_NAME);
      
      // Cache com URL original
      cache.put(request, response.clone());
      
      // Cache também versão normalizada (sem query params)
      const normalizedUrl = normalizeUrl(request.url);
      if (normalizedUrl !== request.url) {
        cache.put(normalizedUrl, response.clone());
      }
      
      return response;
    }
  } catch (error) {
    console.log(`[SW] 🔌 Rede falhou, usando cache: ${request.url}`);
  }
  
  // Fallback para cache
  let cached = await caches.match(request);
  if (!cached) {
    const normalizedUrl = normalizeUrl(request.url);
    cached = await caches.match(normalizedUrl);
  }
  
  return cached || new Response('// Fallback code', { 
    headers: { 'Content-Type': 'application/javascript' }
  });
}

// Cache First para assets (imagens, ícones, etc.)
async function cacheFirstForAssets(request) {
  let cached = await caches.match(request);
  
  if (cached) {
    console.log(`[SW] ✅ Asset do cache: ${request.url}`);
    return cached;
  }
  
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(STATIC_CACHE_NAME);
      cache.put(request, response.clone());
      console.log(`[SW] 💾 Novo asset cacheado: ${request.url}`);
    }
    return response;
  } catch (error) {
    console.log(`[SW] ❌ Asset não encontrado: ${request.url}`);
    return new Response('', { status: 404 });
  }
}

self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
}); 