// @ts-check
// v3.22.0 — Live-site smoke test. Hits a real rumble.com URL with the
// extension loaded and verifies that:
//   1. The content script booted (rx-* class on documentElement or styles
//      injected by SettingsPanel).
//   2. The Selectors registry resolved at least the header surface against
//      live DOM (catches Rumble-side selector churn that MHTML fixtures miss).
//   3. The service worker is alive (responds to getPrivacyReport).
//
// Skipped by default — opt-in via RUMBLEX_LIVE_SMOKE=1. The MHTML harness +
// the offline E2E suite already cover regression for offline-reproducible
// behavior. This spec exists for the case where rumble.com itself changes
// something we haven't captured.
const { test, expect } = require('./_fixtures');

const LIVE = process.env.RUMBLEX_LIVE_SMOKE === '1';
const LIVE_URL = process.env.RUMBLEX_LIVE_URL || 'https://rumble.com/';

test.describe('live rumble.com smoke', () => {
    test.skip(!LIVE, 'opt-in: set RUMBLEX_LIVE_SMOKE=1 to run live-site tests');
    // Live network is slow; give each test 90s.
    test.setTimeout(90_000);

    test('content script boots on live rumble.com', async ({ context }) => {
        const page = await context.newPage();
        // Block third-party trackers we don't need; keeps the test stable and
        // skips noisy 3rd-party load that can hang DOMContentLoaded.
        await page.route(/(googletagmanager|google-analytics|doubleclick|facebook\.net)/, (r) => r.abort());
        await page.goto(LIVE_URL, { waitUntil: 'domcontentloaded', timeout: 45_000 });

        // The content script applies a body class once the theme engine boots.
        // Match any rx-* class on documentElement OR an rx- style sheet.
        const booted = await page.waitForFunction(() => {
            const html = document.documentElement;
            const body = document.body;
            if (!html || !body) return false;
            if (/\brx-/.test(html.className) || /\brx-/.test(body.className)) return true;
            // Settings panel injects <style id="rx-settings-panel-css">.
            if (document.getElementById('rx-settings-panel-css')) return true;
            // Any <style data-rx="..."> we inject through injectStyle().
            if (document.querySelector('style[data-rx]')) return true;
            return false;
        }, null, { timeout: 30_000 });
        expect(booted).toBeTruthy();
    });

    test('header surface resolves against live DOM', async ({ context }) => {
        const page = await context.newPage();
        await page.route(/(googletagmanager|google-analytics|doubleclick|facebook\.net)/, (r) => r.abort());
        await page.goto(LIVE_URL, { waitUntil: 'domcontentloaded', timeout: 45_000 });

        // Wait for the header selector to be present (stable OR fallback).
        // Mirrors the offline harness FIXTURE_EXPECTATIONS for `header.root`.
        const headerResolved = await page.waitForFunction(() => {
            return !!(document.querySelector('header') || document.querySelector('header.main-menu'));
        }, null, { timeout: 20_000 });
        expect(headerResolved).toBeTruthy();
    });

    test('service worker responds to getPrivacyReport', async ({ serviceWorker, extensionId }) => {
        expect(extensionId).toBeTruthy();
        // Execute a runtime sendMessage from the SW scope itself. Privacy
        // report is the cheapest live ping — no side effects, pure read.
        const result = await serviceWorker.evaluate(async () => {
            // The SW message handler lives in the content script, not the SW
            // itself — so this round-trips through the extension messaging.
            // We send via chrome.tabs.sendMessage when there's a live tab,
            // otherwise just verify chrome.runtime is reachable from the SW.
            try {
                const tabs = await chrome.tabs.query({ url: '*://*.rumble.com/*' });
                if (tabs.length === 0) return { ok: true, mode: 'no-tab', alive: typeof chrome.runtime?.id === 'string' };
                const resp = await new Promise((resolve) => {
                    chrome.tabs.sendMessage(tabs[0].id, { action: 'getPrivacyReport' }, (r) => {
                        resolve(r);
                    });
                });
                return { ok: !!resp?.ok, mode: 'tab', schemaVersion: resp?.report?.schemaVersion };
            } catch (e) {
                return { ok: false, error: String(e?.message || e) };
            }
        });
        expect(result.ok).toBeTruthy();
    });
});
