// RumbleX Firefox MV2 request-level ad shield.
'use strict';

(() => {
    const RUMBLE_ORIGIN_RE = /^https?:\/\/(?:[^/]+\.)?rumble\.com(?::\d+)?(?:\/|$)/i;
    const AD_URL_PATTERNS = Object.freeze([
        // a-delivery.rmbl.ws is a CNAME alias of a.ads.rmbl.ws (same servers).
        // Request matching is by hostname, not by CNAME target, so the alias
        // needs its own pattern or it sails straight through.
        /^https:\/\/a(?:\.ads|-delivery)\.rmbl\.ws(?:[/:?#]|$)/i,
        /^https:\/\/imasdk\.googleapis\.com(?:[/:?#]|$)/i,
        /^https:\/\/s0\.2mdn\.net\/instream\/video\//i,
        /^https:\/\/pagead2\.googlesyndication\.com\/omsdk\//i,
        /^https:\/\/(?:[^/]+\.)?doubleclick\.net(?:[/:?#]|$)/i,
        /^https:\/\/(?:www\.)?googleadservices\.com\/pagead\//i,
    ]);
    const FIRST_PARTY_AD_PING_RE = /^https:\/\/(?:[^/]+\.)?rumble\.com\/l\/[^?]*\?.*(?:[?&])af=/i;

    function rxShouldBlockAdRequest(details = {}) {
        const initiator = String(details.originUrl || details.documentUrl || details.initiator || '');
        if (!RUMBLE_ORIGIN_RE.test(initiator)) return false;
        const url = String(details.url || '');
        return AD_URL_PATTERNS.some((pattern) => pattern.test(url)) || FIRST_PARTY_AD_PING_RE.test(url);
    }

    globalThis.RumbleXAdBlock = Object.freeze({ rxShouldBlockAdRequest });

    const onBeforeRequest = globalThis.chrome?.webRequest?.onBeforeRequest;
    if (onBeforeRequest?.addListener) {
        onBeforeRequest.addListener(
            (details) => (rxShouldBlockAdRequest(details) ? { cancel: true } : {}),
            {
                urls: [
                    '*://a.ads.rmbl.ws/*',
                    '*://a-delivery.rmbl.ws/*',
                    '*://imasdk.googleapis.com/*',
                    '*://s0.2mdn.net/instream/video/*',
                    '*://pagead2.googlesyndication.com/omsdk/*',
                    '*://*.doubleclick.net/*',
                    '*://*.googleadservices.com/pagead/*',
                    '*://*.rumble.com/l/*',
                ],
                types: ['sub_frame', 'script', 'image', 'xmlhttprequest', 'ping', 'media', 'websocket', 'other'],
            },
            ['blocking'],
        );
    }
})();
