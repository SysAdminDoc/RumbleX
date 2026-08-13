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

async function openLivePage(page) {
    // Block third-party trackers we do not need; this keeps the smoke focused
    // on Rumble and avoids unrelated load events extending the test.
    await page.route(/(googletagmanager|google-analytics|doubleclick|facebook\.net)/, (route) => route.abort());
    await page.goto(LIVE_URL, { waitUntil: 'domcontentloaded', timeout: 45_000 });
    await page.waitForLoadState('load', { timeout: 15_000 }).catch(() => {});

    // Cloudflare's interactive widget is inserted after DOMContentLoaded, so
    // wait for either the real Rumble header or a verification marker before
    // classifying the page.
    await page.waitForFunction(() => {
        const challengeText = document.body?.textContent?.slice(0, 2500) || '';
        return !!document.querySelector('header[data-js="app_header"], .header')
            || !!document.querySelector('iframe[src*="challenges.cloudflare.com"], input[name="cf-turnstile-response"], #challenge-running, #challenge-stage')
            || /performing security verification|verify you are human/i.test(challengeText);
    }, null, { timeout: 15_000 }).catch(() => {});

    const securityVerification = await page.evaluate(() => {
        const challengeText = document.body?.textContent?.slice(0, 2500) || '';
        return !!document.querySelector([
            'iframe[src*="challenges.cloudflare.com"]',
            'input[name="cf-turnstile-response"]',
            '#challenge-running',
            '#challenge-stage',
        ].join(',')) || /performing security verification|verify you are human/i.test(challengeText);
    });
    test.skip(securityVerification, 'Rumble served an interactive Cloudflare verification page; automation must not bypass it');
}

test.describe('live rumble.com smoke', () => {
    test.skip(!LIVE, 'opt-in: set RUMBLEX_LIVE_SMOKE=1 to run live-site tests');
    // Live network is slow; give each test 90s.
    test.setTimeout(90_000);

    test('content script boots on live rumble.com', async ({ context }) => {
        const page = await context.newPage();
        await openLivePage(page);

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
        await openLivePage(page);

        // Wait for the header selector to be present (stable OR fallback).
        // Mirrors the offline harness FIXTURE_EXPECTATIONS for `header.root`.
        const headerResolved = await page.waitForFunction(() => {
            return !!document.querySelector('header[data-js="app_header"], .header');
        }, null, { timeout: 20_000 });
        expect(headerResolved).toBeTruthy();
    });

    test('service worker reports healthy critical selectors on live Rumble', async ({ context, serviceWorker, extensionId }) => {
        expect(extensionId).toBeTruthy();
        const page = await context.newPage();
        await openLivePage(page);
        await page.waitForFunction(() => !!document.querySelector('header[data-js="app_header"], .header'), null, { timeout: 20_000 });
        // Execute a runtime sendMessage from the SW scope itself. Privacy
        // report is a no-side-effect read and carries the sanitized selector
        // health summary from the current live DOM.
        const readReport = () => serviceWorker.evaluate(async (targetUrl) => {
            // The SW message handler lives in the content script, not the SW
            // itself — so this round-trips through the extension messaging.
            // Resolve the exact page under test rather than relying on tab
            // ordering when Chromium has another Rumble tab open.
            try {
                const tabs = await chrome.tabs.query({ url: '*://*.rumble.com/*' });
                if (tabs.length === 0) return { ok: true, mode: 'no-tab', alive: typeof chrome.runtime?.id === 'string' };
                const target = tabs.find((tab) => tab.url === targetUrl) || tabs[0];
                const resp = await new Promise((resolve) => {
                    chrome.tabs.sendMessage(target.id, { action: 'getPrivacyReport' }, (r) => {
                        resolve(r);
                    });
                });
                return {
                    ok: !!resp?.ok,
                    mode: 'tab',
                    schemaVersion: resp?.report?.schemaVersion,
                    selectorHealth: resp?.report?.selectorHealth,
                    requestShield: resp?.report?.requestShield,
                };
            } catch (e) {
                return { ok: false, error: String(e?.message || e) };
            }
        }, page.url());

        // A document can contain video links before Rumble hydrates the
        // matching custom cards. Poll the read-only report long enough to
        // distinguish that skeleton phase from persistent selector drift.
        let result;
        const deadline = Date.now() + 30_000;
        do {
            result = await readReport();
            if (result.selectorHealth?.status !== 'broken') break;
            await page.waitForTimeout(1000);
        } while (Date.now() < deadline);

        expect(result.ok).toBeTruthy();
        expect(result.mode).toBe('tab');
        expect(
            result.selectorHealth?.status,
            `persistent live selector failure: ${JSON.stringify(result.selectorHealth)}`,
        ).not.toBe('broken');
        expect(result.requestShield?.enforcement).toBe('chromium-dnr');
    });
});
