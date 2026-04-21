const CACHE_NAME = 'imparter-v5';

self.addEventListener('install', (event) => {
  // 새 서비스워커 즉시 활성화
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      // 모든 이전 캐시 삭제
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
      await self.clients.claim();
      // 모든 탭 강제 리로드
      const clients = await self.clients.matchAll({ type: 'window' });
      clients.forEach((client) => client.navigate(client.url));
    })()
  );
});

self.addEventListener('fetch', (event) => {
  // 채팅 관련 + HTML은 항상 네트워크 우선 (캐시 최소화)
  if (
    event.request.url.includes('socket.io') ||
    event.request.url.includes('/api/') ||
    event.request.mode === 'navigate'
  ) {
    return;
  }
  // 에셋은 네트워크 우선, 실패하면 캐시
  event.respondWith(
    fetch(event.request)
      .then((response) => response)
      .catch(() => caches.match(event.request))
  );
});
