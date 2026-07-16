export function registerPwa() {
  if (!('serviceWorker' in navigator)) return;
  if (!import.meta.env.PROD) return;

  let refreshing = false;

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (refreshing) return;
    refreshing = true;
    window.location.reload();
  });

  window.addEventListener('load', () => {
    const swUrl = new URL('sw.js', window.location.href);
    const scope = new URL('./', window.location.href).pathname;

    navigator.serviceWorker.register(swUrl, { scope }).then((registration) => {
      registration.addEventListener('updatefound', () => {
        const worker = registration.installing;
        if (!worker) return;
        worker.addEventListener('statechange', () => {
          if (worker.state === 'installed' && navigator.serviceWorker.controller) {
            worker.postMessage({ type: 'SKIP_WAITING' });
          }
        });
      });

      window.setInterval(() => {
        registration.update().catch(() => undefined);
      }, 60 * 60 * 1000);
    }).catch(() => undefined);
  });
}
