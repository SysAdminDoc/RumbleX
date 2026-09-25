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

    // A URL that is visible in the user's signed-in browser may be private or
    // account-restricted in Playwright's deliberately isolated profile. That
    // page is a valid Rumble shell, but it has no watch/player/title surfaces
    // to audit, so do not misreport access control as selector drift.
    const accessRestricted = await page.evaluate(() => {
        const text = document.body?.textContent?.slice(0, 5000) || '';
        return /this video is (?:restricted|private)|sign in to access it/i.test(text);
    });
    test.skip(accessRestricted, 'The isolated live-smoke profile cannot access this private/restricted video');

    const acceptCookies = page.getByRole('button', { name: /accept(?: all)?/i }).first();
    if (await acceptCookies.isVisible({ timeout: 2_000 }).catch(() => false)) {
        await acceptCookies.click();
        await page.waitForTimeout(300);
    }
}

test.describe('live rumble.com smoke', () => {
    test.skip(!LIVE, 'opt-in: set RUMBLEX_LIVE_SMOKE=1 to run live-site tests');
    // Live network is slow; give each test 90s.
    test.setTimeout(90_000);

    test('content script boots on live rumble.com', async ({ context }) => {
        const page = await context.newPage();
        await openLivePage(page);

        // The content script marks the root and injects rx-* styles at boot.
        const booted = await page.waitForFunction(() => {
            const html = document.documentElement;
            const body = document.body;
            if (!html || !body) return false;
            if (html.classList.contains('rumblex-active') || body.classList.contains('rumblex-active')) return true;
            // Settings panel injects <style id="rx-settings-panel-css">.
            if (document.getElementById('rx-settings-panel-css')) return true;
            if (document.querySelector('style[id^="rx-"], style[data-rx]')) return true;
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

    test('real frame previews capture from the live CDN and stay off after an external disable plus reload', async ({ context, serviceWorker }, testInfo) => {
        test.setTimeout(150_000);
        await serviceWorker.evaluate(async () => {
            const stored = await chrome.storage.local.get('rx_settings');
            await chrome.storage.local.set({
                rx_settings: { ...(stored.rx_settings || {}), realFramePreviews: true, debugErrorLog: true },
            });
        });

        const page = await context.newPage();
        await openLivePage(page);
        const candidatePaths = await page.evaluate(async () => {
            const html = await fetch(location.href, { credentials: 'omit', cache: 'no-store' }).then((response) => response.text());
            const parsed = new DOMParser().parseFromString(html, 'text/html');
            const items = [];
            for (const script of parsed.querySelectorAll('script')) {
                const body = script.textContent || '';
                if (!body.includes('"items"')) continue;
                try {
                    const payload = JSON.parse(body.trim());
                    if (Array.isArray(payload?.items)) items.push(...payload.items);
                } catch {}
            }
            return [...new Set(items.filter((item) => item?.object_type === 'video'
                && item?.relative_url
                && item?.videos?.some((video) => video?.type === 'mp4'))
                .map((item) => item.relative_url))];
        });
        test.skip(candidatePaths.length === 0, 'The live feed did not expose an MP4-backed card');

        const cards = page.locator([
            'rum-video-thumbnail[role="listitem"]',
            '[role="listitem"][data-video-id]',
            '.videostream',
            'article.video-item',
            '.mediaList-item',
            '.thumbnail__grid-item',
        ].join(', '));
        await expect.poll(() => cards.count(), { timeout: 20_000 }).toBeGreaterThan(0);
        const cardIndexes = await cards.evaluateAll((nodes, wantedPaths) => {
            const wanted = new Set(wantedPaths);
            return nodes.map((card, index) => {
                const raw = card.getAttribute('url') || card.querySelector('a[href*="/v"]')?.getAttribute('href') || '';
                try { return wanted.has(new URL(raw, location.origin).pathname) ? index : -1; } catch { return -1; }
            }).filter((index) => index >= 0);
        }, candidatePaths);
        test.skip(cardIndexes.length === 0, 'The MP4-backed listing items were not present in the hydrated card grid');

        let card = null;
        let overlay = null;
        let lastCaptureError = null;
        for (const cardIndex of cardIndexes.slice(0, 3)) {
            card = cards.nth(cardIndex);
            await card.hover();
            overlay = card.locator('.rx-real-frame-overlay');
            try {
                await overlay.waitFor({ state: 'attached', timeout: 20_000 });
                lastCaptureError = null;
                break;
            } catch (error) {
                lastCaptureError = error;
                await page.mouse.move(0, 0);
                await page.waitForTimeout(300);
            }
        }
        if (lastCaptureError || !card || !overlay) {
            const diagnostics = await serviceWorker.evaluate(async (targetUrl) => {
                const tabs = await chrome.tabs.query({ url: '*://*.rumble.com/*' });
                const target = tabs.find((tab) => tab.url === targetUrl) || tabs[0];
                if (!target?.id) return [];
                return await new Promise((resolve) => chrome.tabs.sendMessage(
                    target.id,
                    { action: 'getErrorLog' },
                    (response) => resolve(response?.entries || []),
                ));
            }, page.url());
            throw new Error(`Live frame preview did not mount after ${Math.min(3, cardIndexes.length)} candidates: ${JSON.stringify(diagnostics)}`, { cause: lastCaptureError });
        }
        const originalSrc = await card.locator('img:not(.rx-real-frame-overlay)').first().getAttribute('src');
        await page.mouse.move(0, 0);
        await page.waitForTimeout(200);
        expect(await overlay.evaluate((node) => getComputedStyle(node).opacity)).toBe('1');
        await card.hover();
        await page.waitForTimeout(200);
        expect(await overlay.evaluate((node) => getComputedStyle(node).opacity)).toBe('0');
        expect(await card.locator('img:not(.rx-real-frame-overlay)').first().getAttribute('src')).toBe(originalSrc);

        await page.mouse.move(0, 0);
        await page.waitForTimeout(200);
        const previewCapture = testInfo.outputPath('real-frame-previews.png');
        await card.screenshot({ path: previewCapture });
        await testInfo.attach('real-frame-preview', { path: previewCapture, contentType: 'image/png' });

        await serviceWorker.evaluate(async () => {
            const stored = await chrome.storage.local.get('rx_settings');
            await chrome.storage.local.set({
                rx_settings: { ...(stored.rx_settings || {}), realFramePreviews: false },
            });
        });
        // Options and popup saves deliberately ask open Rumble tabs to reload;
        // only the in-page settings panel hot-swaps feature lifecycles.
        await page.reload({ waitUntil: 'domcontentloaded', timeout: 45_000 });
        await page.waitForLoadState('load', { timeout: 15_000 }).catch(() => {});
        await expect(page.locator('.rx-real-frame-overlay')).toHaveCount(0, { timeout: 10_000 });
    });
});
