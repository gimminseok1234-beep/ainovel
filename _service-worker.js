
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // 1. Bypass AI APIs (OpenRouter, Gemini, xAI)
  if (url.hostname === 'openrouter.ai' || 
      url.hostname === 'generativelanguage.googleapis.com' || 
      url.hostname === 'api.x.ai') {
    return; // Let the browser handle it
  }

  // 2. Bypass internal API requests
  if (url.pathname.startsWith('/api/')) {
    return; // Let the browser handle it
  }

  // 3. Bypass requests to the app's own domain if they are not static assets
  // This is a simple heuristic. You might want to refine it.
  if (url.origin === self.location.origin) {
    // If it's a POST request or has /api/ in it, bypass
    if (event.request.method !== 'GET' || url.pathname.includes('/api/')) {
      return;
    }
  }

  // Default behavior: fetch from network
  // (You could add caching logic here if needed, but for now we just bypass the problematic ones)
  event.respondWith(fetch(event.request));
});
