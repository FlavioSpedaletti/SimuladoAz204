const CACHE_NAME = 'simulado-az204-v1';
const STATIC_CACHE_NAME = 'simulado-az204-static-v1';
const DATA_CACHE_NAME = 'simulado-az204-data-v1';

const STATIC_FILES = [
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
  console.log('[SW] Instalando Service Worker...');
  
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
      return self.skipWaiting();
    })
  );
});

self.addEventListener('activate', event => {
  console.log('[SW] Ativando Service Worker...');
  
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (!cacheName.includes('v1')) {
            console.log(`[SW] Removendo cache antigo: ${cacheName}`);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      console.log('[SW] ✅ Ativação concluída');
      return self.clients.claim();
    })
  );
});

self.addEventListener('fetch', event => {
  const { request } = event;
  const url = request.url;
  const normalizedPath = normalizeUrl(url);
  
  // Rotas Flask - Network First para garantir HTML sempre atualizado
  if (normalizedPath === '/' || normalizedPath === '/validador') {
    event.respondWith(networkFirstForHTML(request));
  }
  // Dados JSON - Network First
  else if (url.includes('/data/')) {
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

// Network First para HTML (rotas Flask)
async function networkFirstForHTML(request) {
  try {
    const response = await fetch(request, {
      headers: {
        'Cache-Control': 'no-cache'
      }
    });
    
    if (response.ok) {
      return response;
    }
  } catch (error) {
    console.log(`[SW] Erro na rede para HTML: ${request.url}`);
  }
  
  // Fallback offline
  return new Response(`
    <!DOCTYPE html>
    <html>
      <head><title>Aplicação Offline</title></head>
      <body>
        <h1>🔌 Aplicação Offline</h1>
        <p>Não foi possível conectar ao servidor.</p>
        <button onclick="location.reload()">🔄 Tentar Novamente</button>
      </body>
    </html>
  `, {
    headers: { 'Content-Type': 'text/html' }
  });
}

// Network First para dados JSON
async function networkFirstForData(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(DATA_CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    console.log(`[SW] Rede falhou, usando cache: ${request.url}`);
  }
  
  const cached = await caches.match(request);
  return cached || new Response('{}', { 
    headers: { 'Content-Type': 'application/json' }
  });
}

// Network First para código (JS/CSS)
async function networkFirstForCode(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      return response;
    }
  } catch (error) {
    console.log(`[SW] Rede falhou, usando cache: ${request.url}`);
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
    return cached;
  }
  
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(STATIC_CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    return new Response('', { status: 404 });
  }
} 