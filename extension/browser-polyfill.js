// RumbleX Firefox MV2 compatibility bootstrap.

// Firefox exposes Promise-returning WebExtension APIs on `browser`. The rest
// of the extension historically uses `chrome`, so point that name at the
// Promise API before background/page code runs. Chromium never loads this
// file and keeps its native namespace.
if (globalThis.browser && globalThis.chrome !== globalThis.browser) {
    try {
        Object.defineProperty(globalThis, 'chrome', {
            value: globalThis.browser,
            configurable: true,
            writable: true,
        });
    } catch {
        // Some Firefox globals are non-configurable. Assignment in this
        // intentionally non-strict bootstrap then degrades without taking
        // down the extension; content/platform.js also selects browser first.
        try { globalThis.chrome = globalThis.browser; } catch {}
    }
}
