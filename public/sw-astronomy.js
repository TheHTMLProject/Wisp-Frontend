
import { codec } from './astronomy-codec.js';
import { isBlockedUrl } from './astronomy-blocked.js';

self.__scramjet$config = {
  prefix: '/astronomy/',
  codec: codec
};

import { route, shouldRoute } from '/astronomy/controller.sw.js';
import '/baremux/index.js';

let connection;

try {
  connection = new self.BareMux.BareMuxConnection("/baremux/worker.js");
} catch (e) {
}

(async () => {
  if (!connection) return;
  try {
    const wispUrl = (location.protocol === "https:" ? "wss://" : "ws://") + location.host + "/wisp/";
    await connection.setTransport("/epoxy/index.mjs", [{ wisp: wispUrl }]);
  } catch (e) {
  }
})();

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  if (shouldRoute(event)) {
    event.respondWith(
      (async () => {
        try {
          const reqUrl = new URL(event.request.url);
          const pathAfterPrefix = reqUrl.pathname.replace(/^\/astronomy\//, '');
          const stripped = pathAfterPrefix.replace(/^[a-z0-9]{8}\/[a-z0-9]{8}\//, '');
          if (stripped) {
            const decoded = self.__scramjet$config.codec.decode(stripped);
            if (decoded && isBlockedUrl(decoded)) {
              return new Response('', { status: 200, headers: { 'Content-Type': 'text/plain' } });
            }
          }

          const response = await route(event);
          return response;
        } catch (e) {
          return new Response("Proxy Error: " + e.message, { status: 502 });
        }
      })()
    );
  } else {
    event.respondWith(fetch(event.request));
  }
});