const CACHE_NAME = 'simulado-az204-v3';
const STATIC_CACHE_NAME = 'simulado-az204-static-v3';
const DATA_CACHE_NAME = 'simulado-az204-data-v3';

const STATIC_FILES = [
  '/',
  '/index.html',
  '/validador.html',
  '/assets/style.css',
  '/assets/script.js',
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
  // Remove query parameters mas mantém o pathname
  return urlObj.pathname;
}

// Função para fazer cache individual com debugging
async function cacheFilesIndividually(cache, files, cacheName) {
  console.log(`[SW] Tentando fazer cache de ${files.length} arquivos para ${cacheName}`);
  
  for (const file of files) {
    try {
      console.log(`[SW] Fazendo cache de: ${file}`);
      
      const response = await fetch(file);
      if (!response.ok) {
        console.error(`[SW] Erro ao buscar ${file}: ${response.status} ${response.statusText}`);
        continue; // Pula este arquivo e continua com os outros
      }
      
      // Fazer cache tanto com a URL original quanto com a normalizada
      await cache.put(file, response.clone());
      
      // Se o arquivo tem query parameters, também cache sem eles
      const normalizedUrl = normalizeUrl(file);
      if (normalizedUrl !== file) {
        await cache.put(normalizedUrl, response.clone());
        console.log(`[SW] ✅ Cache feito (normalizado): ${normalizedUrl}`);
      }
      
      console.log(`[SW] ✅ Cache feito com sucesso: ${file}`);
      
    } catch (error) {
      console.error(`[SW] ❌ Erro ao fazer cache de ${file}:`, error);
      // Continue tentando outros arquivos mesmo se um falhar
    }
  }
}

self.addEventListener('install', event => {
  console.log('[SW] Service Worker instalando...');
  
  event.waitUntil(
    Promise.all([
      caches.open(STATIC_CACHE_NAME).then(cache => {
        return cacheFilesIndividually(cache, STATIC_FILES, 'static');
      }),
      caches.open(DATA_CACHE_NAME).then(cache => {
        return cacheFilesIndividually(cache, DATA_FILES, 'data');
      })
    ]).then(() => {
      console.log('[SW] ✅ Instalação concluída com sucesso');
      self.skipWaiting();
    }).catch(error => {
      console.error('[SW] ❌ Erro durante instalação:', error);
      // Mesmo com erro, vamos tentar continuar
      self.skipWaiting();
    })
  );
});

self.addEventListener('activate', event => {
  console.log('[SW] Service Worker ativando...');
  
  event.waitUntil(
    caches.keys().then(cacheNames => {
      console.log('[SW] Caches encontrados:', cacheNames);
      
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== STATIC_CACHE_NAME && 
              cacheName !== DATA_CACHE_NAME &&
              cacheName !== CACHE_NAME) {
            console.log(`[SW] Removendo cache antigo: ${cacheName}`);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      console.log('[SW] ✅ Ativação concluída, assumindo controle das páginas');
      self.clients.claim();
    }).catch(error => {
      console.error('[SW] ❌ Erro durante ativação:', error);
    })
  );
});

self.addEventListener('fetch', event => {
  const { request } = event;
  
  // Dados (data.json) - Network First com fallback para cache
  if (request.url.includes('/data/')) {
    console.log(`[SW] Requisição de dados: ${request.url}`);
    event.respondWith(
      caches.open(DATA_CACHE_NAME).then(cache => {
        return fetch(request).then(response => {
          if (response.status === 200) {
            console.log(`[SW] ✅ Dados carregados da rede: ${request.url}`);
            cache.put(request, response.clone());
          }
          return response;
        }).catch(() => {
          console.log(`[SW] 🔌 Usando dados do cache (offline): ${request.url}`);
          return cache.match(request);
        });
      })
    );
  }
  
  // Google Analytics - Graceful handling
  else if (request.url.includes('gtag') || 
           request.url.includes('googletagmanager') ||
           request.url.includes('google-analytics')) {
    console.log(`[SW] Requisição Analytics: ${request.url}`);
    event.respondWith(
      fetch(request).catch(() => {
        console.log(`[SW] 🔌 Analytics offline - retornando resposta vazia`);
        return new Response('', { status: 200 });
      })
    );
  }
  
  // Recursos estáticos - Cache First com suporte a query parameters
  else {
    event.respondWith(
      caches.match(request).then(response => {
        if (response) {
          console.log(`[SW] ✅ Servindo do cache: ${request.url}`);
          return response;
        }
        
        // Se não encontrou, tenta buscar pela URL normalizada (sem query params)
        const normalizedUrl = normalizeUrl(request.url);
        if (normalizedUrl !== request.url) {
          return caches.match(normalizedUrl).then(normalizedResponse => {
            if (normalizedResponse) {
              console.log(`[SW] ✅ Servindo do cache (normalizado): ${normalizedUrl}`);
              return normalizedResponse;
            }
            
            return fetchAndCache(request);
          });
        }
        
        return fetchAndCache(request);
      })
    );
  }
  
  // Função auxiliar para fetch e cache
  async function fetchAndCache(request) {
    try {
      console.log(`[SW] 🌐 Buscando na rede: ${request.url}`);
      const response = await fetch(request);
      
      if (!response || response.status !== 200) {
        return response;
      }
      
      // Cachear apenas recursos da nossa aplicação
      if (request.url.startsWith(self.location.origin)) {
        const cache = await caches.open(STATIC_CACHE_NAME);
        const responseToCache = response.clone();
        
        // Cache com a URL original
        cache.put(request, responseToCache.clone());
        console.log(`[SW] 💾 Adicionando ao cache: ${request.url}`);
        
        // Se tem query parameters, também cache sem eles
        const normalizedUrl = normalizeUrl(request.url);
        if (normalizedUrl !== request.url) {
          cache.put(normalizedUrl, responseToCache.clone());
          console.log(`[SW] 💾 Adicionando ao cache (normalizado): ${normalizedUrl}`);
        }
      }
      
      return response;
      
    } catch (error) {
      console.log(`[SW] ❌ Falha na rede para: ${request.url}`);
      
      // Tentar fallback para página principal em caso de navegação
      if (request.mode === 'navigate') {
        console.log(`[SW] 🏠 Retornando página principal como fallback`);
        const indexResponse = await caches.match('/index.html');
        if (indexResponse) {
          return indexResponse;
        }
      }
      
      // Para arquivos CSS/JS, tentar versão sem query params
      const normalizedUrl = normalizeUrl(request.url);
      if (normalizedUrl !== request.url && 
          (normalizedUrl.endsWith('.css') || normalizedUrl.endsWith('.js'))) {
        console.log(`[SW] 🔄 Tentando fallback para: ${normalizedUrl}`);
        const fallbackResponse = await caches.match(normalizedUrl);
        if (fallbackResponse) {
          return fallbackResponse;
        }
      }
      
      throw error;
    }
  }
});

self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
}); 