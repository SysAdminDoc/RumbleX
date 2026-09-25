// @ts-check
// Opt-in live visual capture for the Rumble surfaces changed by RumbleX.
const { test, expect } = require('./_fixtures');
const fs = require('node:fs');
const path = require('node:path');

const ENABLED = process.env.RUMBLEX_SITE_VISUAL_CAPTURE === '1';
const VIEWPORT = { width: 1440, height: 900 };
const DEFAULT_WATCH_URL = 'https://rumble.com/v7dtm3y-live-president-trump-participates-in-an-american-mining-roundtable-080726.html';

async function openLivePage(page, url) {
    await page.route(/(googletagmanager|google-analytics|doubleclick|facebook\.net)/, (route) => route.abort());
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await page.waitForLoadState('load', { timeout: 15_000 }).catch(() => {});
    await page.locator('body').waitFor({ state: 'visible' });

    await page.waitForFunction(() => {
        const text = document.body?.textContent?.slice(0, 2500) || '';
        return !!document.querySelector('header[data-js="app_header"], .header')
            || !!document.querySelector('iframe[src*="challenges.cloudflare.com"], input[name="cf-turnstile-response"], #challenge-running, #challenge-stage')
            || /performing security verification|verify you are human/i.test(text);
    }, null, { timeout: 15_000 }).catch(() => {});

    const state = await page.evaluate(() => {
        const text = document.body?.textContent?.slice(0, 5000) || '';
        return {
            securityVerification: !!document.querySelector([
                'iframe[src*="challenges.cloudflare.com"]',
                'input[name="cf-turnstile-response"]',
                '#challenge-running',
                '#challenge-stage',
            ].join(',')) || /performing security verification|verify you are human/i.test(text),
            accessRestricted: /this video is (?:restricted|private)|sign in to access it|premium only content|rumble premium subscribers/i.test(text),
        };
    });
    test.skip(state.securityVerification, 'Rumble served an interactive Cloudflare verification page; automation must not bypass it');
    return state;
}

async function captureViewport(page, filePath) {
    let lastError;
    for (let attempt = 1; attempt <= 3; attempt += 1) {
        try {
            await page.screenshot({ path: filePath, fullPage: false });
            return;
        } catch (error) {
            lastError = error;
            if (!/Unable to capture screenshot/i.test(String(error)) || attempt === 3) throw error;
            await page.waitForTimeout(attempt * 300);
        }
    }
    throw lastError;
}

async function setSettings(context, extensionId, patch) {
    const settingsPage = await context.newPage();
    await settingsPage.goto(`chrome-extension://${extensionId}/pages/options.html`);
    await settingsPage.evaluate(async (next) => {
        const response = await chrome.runtime.sendMessage({ action: 'patchSettings', data: next });
        if (!response?.success) throw new Error(response?.error || 'Settings update failed');
    }, patch);
    await settingsPage.close();
}

async function sanitizeDynamicCaptureText(page) {
    return page.evaluate(() => {
        const setAll = (selectors, values) => {
            const nodes = [...document.querySelectorAll(selectors)];
            nodes.forEach((node, index) => {
                node.textContent = values[index % values.length];
            });
            return nodes.length;
        };
        const titleCount = setAll(
            '.video-header-container__title, .rx-panel-header h3',
            ['Live interface review'],
        );
        setAll('.media-heading-name, .rx-panel-header .rx-channel', ['Fixture Channel']);
        const userCount = setAll([
            '#chat-history-list .chat-history--username',
            '#chat-history-list .chat-history--rant-username',
            '#chat-history-list [data-username]',
        ].join(','), ['Viewer One', 'Viewer Two', 'Viewer Three', 'Viewer Four']);
        const messageCount = setAll([
            '#chat-history-list .chat-history--message',
            '#chat-history-list .chat-history--rant-message',
            '#chat-history-list [data-js="chat-message"]',
        ].join(','), [
            'The stream looks clear on my screen.',
            'Thanks for the context.',
            'The side panel is easy to follow.',
            'Checking the narrow layout now.',
        ]);
        const chatRoot = document.querySelector('#chat-history-list');
        const chatTextNodes = [];
        if (chatRoot) {
            const walker = document.createTreeWalker(chatRoot, NodeFilter.SHOW_TEXT);
            let node;
            while ((node = walker.nextNode())) {
                if (node.nodeValue?.trim()) chatTextNodes.push(node);
            }
            const neutralChatText = [
                'Viewer One',
                'The stream looks clear on my screen.',
                'Viewer Two',
                'Thanks for the context.',
                'Viewer Three',
                'The side panel is easy to follow.',
                'Viewer Four',
                'Checking the narrow layout now.',
            ];
            chatTextNodes.forEach((node, index) => {
                node.nodeValue = neutralChatText[index % neutralChatText.length];
            });
        }
        const commentsLoading = document.querySelector('#video-comments-loading');
        const loadingText = commentsLoading
            ? [...commentsLoading.childNodes].find((node) => node.nodeType === Node.TEXT_NODE)
            : null;
        if (loadingText) loadingText.nodeValue = 'Loading comments... ';
        return { titleCount, userCount, messageCount, chatTextCount: chatTextNodes.length };
    });
}

test.describe('live site visual capture', () => {
    test.skip(!ENABLED, 'opt-in: set RUMBLEX_SITE_VISUAL_CAPTURE=1');

    test('capture themed site and the unobstructed Theater Split layouts', async ({ context, extensionId }) => {
        test.setTimeout(180_000);
        const outputDir = path.join(__dirname, '..', '..', 'design', 'mockups', 'site-implementation');
        fs.mkdirSync(outputDir, { recursive: true });

        await setSettings(context, extensionId, {
            darkEnhance: true,
            theme: 'catppuccin',
            theaterSplit: false,
            screenshotBtn: true,
            videoStats: true,
            loopControl: true,
            shareTimestamp: true,
        });

        const page = await context.newPage();
        await page.setViewportSize(VIEWPORT);
        await openLivePage(page, 'https://rumble.com/');
        await page.waitForTimeout(3_000);
        const acceptCookies = page.getByRole('button', { name: /accept(?: all)?/i }).first();
        if (await acceptCookies.isVisible({ timeout: 2_000 }).catch(() => false)) {
            await acceptCookies.click();
            await page.waitForTimeout(500);
        }
        await captureViewport(page, path.join(outputDir, 'site-home-1440x900.png'));

        const discoveredWatchUrls = await page.evaluate(() => {
            const candidates = [
                ...document.querySelectorAll('rum-video-thumbnail[url], a[href]'),
            ].map((node) => node.getAttribute('url') || node.getAttribute('href') || '');
            return [...new Set(candidates
                .filter((value) => /^\/v[a-z0-9]+-[^/]+\.html(?:[?#].*)?$/i.test(value))
                .map((value) => {
                    try { return new URL(value, location.origin).href; } catch { return null; }
                })
                .filter(Boolean))].slice(0, 12);
        });
        const candidates = [
            process.env.RUMBLEX_SITE_VISUAL_URL,
            ...discoveredWatchUrls,
            DEFAULT_WATCH_URL,
        ].filter(Boolean);
        let watchUrl = null;
        for (const candidate of [...new Set(candidates)]) {
            expect(candidate).toMatch(/^https:\/\/rumble\.com\/v[a-z0-9]+-[^/]+\.html/i);
            const state = await openLivePage(page, candidate);
            if (state.accessRestricted) continue;
            const player = page.locator('#videoPlayer, .videoPlayer-Rumble-cls').first();
            if (await player.isVisible({ timeout: 8_000 }).catch(() => false)) {
                watchUrl = candidate;
                break;
            }
        }
        test.skip(!watchUrl, 'The isolated profile found no public watch page suitable for visual capture');
        await page.waitForTimeout(2_000);
        const chatSurface = page.locator('.media-page-chat-aside-chat-wrapper-fixed > .chat:visible').first();
        if (await chatSurface.count()) {
            const chatColors = await chatSurface.evaluate((node) => ({
                background: getComputedStyle(node).backgroundColor,
                panelToken: (() => {
                    const probe = document.createElement('span');
                    probe.style.backgroundColor = 'var(--rx-site-panel)';
                    document.body.appendChild(probe);
                    const value = getComputedStyle(probe).backgroundColor;
                    probe.remove();
                    return value;
                })(),
            }));
            expect(chatColors.background).toBe(chatColors.panelToken);
        }
        const relatedSurface = page.locator('.media-page-related-media-desktop-floating:visible').first();
        if (await relatedSurface.count()) {
            // Rumble's floating grid is the list itself, so the filter is its
            // adjacent sibling rather than a child of this surface.
            await expect(page.locator('.rx-related-filter:visible').first()).toBeAttached({ timeout: 10_000 });
            const relatedColors = await relatedSurface.evaluate((node) => {
                const probe = document.createElement('span');
                probe.style.backgroundColor = 'var(--rx-site-panel)';
                document.body.appendChild(probe);
                const panelToken = getComputedStyle(probe).backgroundColor;
                probe.remove();
                return { background: getComputedStyle(node).backgroundColor, panelToken };
            });
            expect(relatedColors.background).toBe(relatedColors.panelToken);
        }
        const watchSanitized = await sanitizeDynamicCaptureText(page);
        expect(watchSanitized.titleCount).toBeGreaterThan(0);
        await captureViewport(page, path.join(outputDir, 'site-watch-1440x900.png'));

        await setSettings(context, extensionId, {
            ambientPlayer: true,
            darkEnhance: true,
            theme: 'aurora',
            denseMode: true,
            pageDensity: 'showcase',
        });
        await page.reload({ waitUntil: 'domcontentloaded', timeout: 60_000 });
        await page.locator('#videoPlayer, .videoPlayer-Rumble-cls').first().waitFor({ state: 'visible', timeout: 30_000 });
        await page.waitForTimeout(1_000);
        await sanitizeDynamicCaptureText(page);
        await expect(page.locator('body')).toHaveClass(/rx-ambient-player/);
        await expect(page.locator('body')).toHaveAttribute('data-rx-density', 'showcase');
        await captureViewport(page, path.join(outputDir, 'site-watch-ambient-aurora-1440x900.png'));

        await setSettings(context, extensionId, {
            ambientPlayer: false,
            theme: 'catppuccin',
            pageDensity: 'dense',
            theaterSplit: true,
        });
        await page.reload({ waitUntil: 'domcontentloaded', timeout: 60_000 });
        await expect(page.locator('#rx-split-wrapper')).toBeVisible({ timeout: 30_000 });
        await expect(page.locator('#rx-split-right')).toHaveClass(/rx-expanded/);
        await page.waitForTimeout(1_000);
        const theaterSanitized = await sanitizeDynamicCaptureText(page);
        if (await page.locator('#rx-tab-chat #chat-history-list').count()) {
            expect(theaterSanitized.chatTextCount).toBeGreaterThan(0);
        }
        await captureViewport(page, path.join(outputDir, 'theater-split-1440x900.png'));

        const commentsTab = page.locator('#rx-tab-button-comments');
        await commentsTab.click();
        await expect(page.locator('#rx-tab-comments')).toBeVisible();
        await page.waitForTimeout(250);
        await captureViewport(page, path.join(outputDir, 'theater-comments-1440x900.png'));

        const chatTab = page.locator('#rx-tab-button-chat');
        if (await chatTab.isVisible().catch(() => false)) await chatTab.click();
        await page.setViewportSize({ width: 820, height: 900 });
        await page.waitForTimeout(300);
        await sanitizeDynamicCaptureText(page);
        const narrowLayout = await page.evaluate(() => {
            const left = document.querySelector('#rx-split-left').getBoundingClientRect();
            const right = document.querySelector('#rx-split-right').getBoundingClientRect();
            const header = document.querySelector('.rx-panel-header').getBoundingClientRect();
            const history = document.querySelector('#rx-tab-chat #chat-history-list')?.getBoundingClientRect();
            return {
                leftBottom: left.bottom,
                rightBottom: right.bottom,
                rightHeight: right.height,
                headerTop: header.top,
                historyHeight: history?.height || 0,
            };
        });
        expect(narrowLayout.rightHeight).toBeGreaterThan(400);
        expect(Math.abs(narrowLayout.rightBottom - 900)).toBeLessThanOrEqual(1);
        expect(narrowLayout.headerTop).toBeGreaterThanOrEqual(narrowLayout.leftBottom);
        expect(narrowLayout.historyHeight, JSON.stringify(narrowLayout)).toBeGreaterThan(40);
        await captureViewport(page, path.join(outputDir, 'theater-split-820x900.png'));
        await page.setViewportSize(VIEWPORT);
        await page.waitForTimeout(300);

        await expect(page.locator('.rx-rant-archive, .rx-rant-tracker, #rx-chat-filter, .rx-chatter-bar, .rx-player-tools-trigger, #rx-split-reveal, #rx-theater-close')).toHaveCount(0);
        await expect(page.locator('.chat--header')).toBeHidden();
        await expect(page.locator('#rx-toolbar')).toBeHidden();
        await captureViewport(page, path.join(outputDir, 'theater-clean-player-1440x900.png'));

        await page.close();
    });
});
