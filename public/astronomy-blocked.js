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

export function isBlockedUrl(url) {
  try {
    const hostname = new URL(url).hostname;
    return BLOCKED_DOMAINS.some(d => hostname === d || hostname.endsWith('.' + d));
  } catch { return false; }
}
