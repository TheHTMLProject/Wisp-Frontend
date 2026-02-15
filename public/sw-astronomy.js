
import { codec } from './astronomy-codec.js';

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

const BLOCKED_DOMAINS = [
  'anyclip.com', 'googlesyndication.com', 'googleadservices.com',
  'doubleclick.net', 'adservice.google.com',
  'amazon-adsystem.com', 'rubiconproject.com', 'pubmatic.com',
  'openx.net', 'casalemedia.com', 'indexexchange.com',
  'criteo.com', 'taboola.com', 'outbrain.com', 'adnxs.com',
  'id5-sync.com', 'idsync.com', 'prebid.media.net',
  'connatix.com', 'sharethrough.com', 'triplelift.com',
  'gumgum.com', '33across.com', 'moatads.com', 'doubleverify.com',
  'quantserve.com', 'scorecardresearch.com', 'demdex.net',
  'bidswitch.net', 'smartadserver.com', 'adsrvr.org',
];

function isBlockedUrl(url) {
  try {
    const hostname = new URL(url).hostname;
    return BLOCKED_DOMAINS.some(d => hostname === d || hostname.endsWith('.' + d));
  } catch { return false; }
}

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