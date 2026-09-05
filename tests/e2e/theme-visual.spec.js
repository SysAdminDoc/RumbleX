// Deterministic visual contracts for the main Rumble surfaces and Theater.
// Live captures remain useful evidence, but this matrix protects every palette
// and the responsive split without depending on network content or timing.
const { test, expect, chromium } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const { createHarnessPage } = require('./_harness');

const FIXTURE_DIR = path.join(__dirname, '..', 'fixtures', 'platform');
const THEMES = Object.freeze({
    catppuccin: { base: '#1e1e2e', mantle: '#181825', crust: '#11111b', text: '#cdd6f4', accent: '#89b4fa' },
    youtube: { base: '#0f0f0f', mantle: '#0f0f0f', crust: '#0f0f0f', text: '#f1f1f1', accent: '#3ea6ff' },
    midnight: { base: '#000000', mantle: '#000000', crust: '#000000', text: '#e4e4e7', accent: '#818cf8' },
    rumbleGreen: { base: '#141c0f', mantle: '#0f1509', crust: '#0a0f06', text: '#d6e8c4', accent: '#85c742' },
    oledGreen: { base: '#000000', mantle: '#000000', crust: '#000000', text: '#e7f1dc', accent: '#85c742' },
});
const VIEWPORTS = Object.freeze([
    { name: 'desktop', width: 1440, height: 900 },
    { name: '860px', width: 860, height: 900 },
]);
const SURFACES = Object.freeze([
    { name: 'home', file: 'desktop-home.html', route: '/', target: 'rum-video-thumbnail[role="listitem"]', text: 'rum-text[role="heading"]' },
    { name: 'watch', file: 'desktop-watch.html', route: '/vfixture-watch.html', target: '.media-description-section', text: '.video-header-container__title' },
    { name: 'search', file: 'desktop-search.html', route: '/search/video?q=fixture', target: '.video-listing-entry .video-item', text: '.video-item--title' },
    { name: 'channel', file: 'desktop-channel.html', route: '/c/fixture-channel', target: 'rum-video-thumbnail[role="listitem"]', text: '.channel-header--title' },
]);

const HOST_LAYOUT = `
    *, *::before, *::after { box-sizing: border-box; }
    html, body { margin: 0; min-height: 100%; }
    body { overflow-x: hidden; }
    .header { min-height: 64px; padding: 10px 24px; display: flex; align-items: center; gap: 18px; }
    .header-search { width: min(560px, calc(100vw - 80px)); margin: 0 auto; }
    .header-search-field { width: 100%; padding: 0 14px; }
    main { width: min(1200px, calc(100% - 32px)); margin: 24px auto; }
    rum-video-thumbnail { display: block; width: min(320px, 100%); }
    rum-video-thumbnail > a, rum-video-thumbnail > section, rum-video-thumbnail-footer, rum-text { display: block; }
    rum-video-thumbnail img { display: block; width: 100%; aspect-ratio: 16 / 9; background: #090909; object-fit: cover; }
    .media-container { display: grid; grid-template-columns: minmax(0, 1fr) 320px; gap: 18px; }
    .media-container > section, .media-page-related-media-desktop-sidebar { min-width: 0; }
    #videoPlayer { width: 100%; aspect-ratio: 16 / 9; background: #000; }
    .media-description-section { min-height: 84px; }
    .video-listing-entry { margin: 0 0 16px; padding: 0; }
    .video-item { display: grid; grid-template-columns: minmax(180px, 260px) minmax(0, 1fr); gap: 14px; align-items: center; }
    .video-item > a { grid-row: 1 / span 2; }
    .video-item--img { display: block; width: 100%; aspect-ratio: 16 / 9; background: #090909; object-fit: cover; }
    .video-item--title { margin: 0; }
    .channel-header--title { margin: 0 0 20px; }
    @media (max-width: 900px) {
        .media-container { grid-template-columns: minmax(0, 1fr); }
        .media-page-related-media-desktop-sidebar { width: 100%; }
        .video-item { grid-template-columns: 180px minmax(0, 1fr); }
    }
`;

function fixtureBody(file) {
    const html = fs.readFileSync(path.join(FIXTURE_DIR, file), 'utf8');
    const match = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
    if (!match) throw new Error(`Fixture ${file} has no body`);
    return match[1];
}

function rgb(hex) {
    const value = Number.parseInt(hex.slice(1), 16);
    return `rgb(${(value >> 16) & 255}, ${(value >> 8) & 255}, ${value & 255})`;
}

function maxColorChannel(value) {
    const channels = (String(value).match(/\d*\.?\d+/g) || []).slice(0, 3).map(Number);
    if (!channels.length) return Number.POSITIVE_INFINITY;
    const scale = String(value).startsWith('color(srgb') ? 255 : 1;
    return Math.max(...channels) * scale;
}

function boxesOverlap(a, b) {
    if (!a || !b) return false;
    return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
}

// The THEMES constant above is a five-key summary used for the token
// assertions. Uniqueness has to be computed against the complete palettes or a
// colour that two themes genuinely share looks exclusive to whichever one the
// summary happens to list it under: rumbleGreen.crust and oledGreen.surface0
// are both #0a0f06, and only the full registry says so.
const FULL_PALETTES = (() => {
    const source = fs.readFileSync(path.join(__dirname, '..', '..', 'extension', 'content.js'), 'utf8');
    const registry = source.match(/const THEMES = \{([\s\S]*?)\n\};/);
    if (!registry) throw new Error('THEMES registry not found in extension/content.js');
    const palettes = {};
    for (const block of registry[1].split(/\n {4}(?=[a-zA-Z]+: \{)/)) {
        const id = block.match(/^\s*([a-zA-Z]+): \{/)?.[1];
        if (!id) continue;
        palettes[id] = [...block.matchAll(/#([0-9a-f]{6})\b/gi)].map((match) => `#${match[1]}`);
    }
    if (Object.keys(palettes).length !== Object.keys(THEMES).length) {
        throw new Error(`parsed ${Object.keys(palettes).length} palettes, expected ${Object.keys(THEMES).length}`);
    }
    return palettes;
})();

// Every distinctive colour in each palette, as the rgb() string a computed
// style reports. Only colours unique to one palette count: the greens share an
// accent and every dark theme shares pure black, so a shared value proves
// nothing about which palette painted it.
const PALETTE_COLORS = Object.fromEntries(
    Object.entries(FULL_PALETTES).map(([id, colors]) => [id, new Set(colors.map(rgb))]),
);
const UNIQUE_PALETTE_COLORS = Object.fromEntries(
    Object.entries(PALETTE_COLORS).map(([id, colors]) => [id, new Set([...colors].filter((color) => (
        Object.entries(PALETTE_COLORS).every(([other, otherColors]) => other === id || !otherColors.has(color))
    )))]),
);

function foreignPalette(value, activeTheme) {
    if (!value || value === 'rgba(0, 0, 0, 0)' || value === 'transparent') return false;
    return Object.entries(UNIQUE_PALETTE_COLORS)
        .some(([id, colors]) => id !== activeTheme && colors.has(value));
}

for (const [themeId, palette] of Object.entries(THEMES)) {
    for (const viewport of VIEWPORTS) {
        test(`main-site ${themeId} theme stays coherent at ${viewport.name}`, async () => {
            const browser = await chromium.launch({ headless: true });
            try {
                const { context, page } = await createHarnessPage(browser);
                await page.setViewportSize({ width: viewport.width, height: viewport.height });

                for (const surface of SURFACES) {
                    await page.evaluate(({ body, route, theme, hostLayout }) => {
                        const harness = globalThis.__RumbleXFeatureHarness;
                        const feature = harness.features.find((candidate) => candidate.id === 'darkEnhance');
                        feature.destroy();
                        document.body.innerHTML = body;
                        history.replaceState({}, '', route);
                        document.documentElement.className = 'rumblex-active';
                        document.querySelector('#rx-theme-fixture-host')?.remove();
                        const hostStyle = document.createElement('style');
                        hostStyle.id = 'rx-theme-fixture-host';
                        hostStyle.textContent = hostLayout;
                        document.head.appendChild(hostStyle);
                        const settings = harness.resetSettings();
                        Object.assign(settings, { darkEnhance: true, theme });
                        feature.init();
                    }, {
                        body: fixtureBody(surface.file),
                        route: surface.route,
                        theme: themeId,
                        hostLayout: HOST_LAYOUT,
                    });
                    await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(resolve)));

                    const state = await page.evaluate(({ targetSelector, textSelector }) => {
                        const target = document.querySelector(targetSelector);
                        const text = document.querySelector(textSelector);
                        const root = getComputedStyle(document.documentElement);
                        const targetStyle = getComputedStyle(target);
                        const targetRect = target.getBoundingClientRect();
                        return {
                            tokens: {
                                panel: root.getPropertyValue('--rx-site-panel').trim(),
                                canvas: root.getPropertyValue('--rx-site-canvas').trim(),
                                accent: root.getPropertyValue('--rx-accent').trim(),
                            },
                            bodyBackground: getComputedStyle(document.body).backgroundColor,
                            targetBackground: targetStyle.backgroundColor,
                            targetBorder: targetStyle.borderTopStyle,
                            targetRadius: targetStyle.borderTopLeftRadius,
                            textColor: getComputedStyle(text).color,
                            targetRect: {
                                left: targetRect.left,
                                right: targetRect.right,
                                width: targetRect.width,
                                height: targetRect.height,
                            },
                            targetClipped: target.scrollWidth > target.clientWidth + 1,
                            horizontalScroll: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
                        };
                    }, { targetSelector: surface.target, textSelector: surface.text });

                    expect(state.tokens, `${surface.name} tokens`).toEqual({
                        panel: palette.base,
                        canvas: palette.crust,
                        accent: palette.accent,
                    });
                    expect(state.bodyBackground, `${surface.name} canvas`).toBe(rgb(palette.crust));
                    expect(state.targetBackground, `${surface.name} panel`).toBe(rgb(palette.base));
                    expect(state.targetBorder, `${surface.name} border`).toBe('solid');
                    expect(Number.parseFloat(state.targetRadius), `${surface.name} radius`).toBeGreaterThanOrEqual(8);
                    expect(state.textColor, `${surface.name} text`).toBe(rgb(palette.text));
                    expect(state.targetRect.width, `${surface.name} width`).toBeGreaterThan(0);
                    expect(state.targetRect.height, `${surface.name} height`).toBeGreaterThan(0);
                    expect(state.targetRect.left, `${surface.name} left edge`).toBeGreaterThanOrEqual(0);
                    expect(state.targetRect.right, `${surface.name} right edge`).toBeLessThanOrEqual(viewport.width + 1);
                    expect(state.targetClipped, `${surface.name} clipping`).toBe(false);
                    expect(state.horizontalScroll, `${surface.name} horizontal scroll`).toBe(false);


                    if (surface.name === 'watch' && viewport.width === 860) {
                        const related = await page.locator('.media-page-related-media-desktop-sidebar').evaluate((node) => {
                            const style = getComputedStyle(node);
                            return { borderLeft: style.borderLeftStyle, borderTop: style.borderTopStyle, paddingLeft: style.paddingLeft };
                        });
                        expect(related).toEqual({ borderLeft: 'none', borderTop: 'solid', paddingLeft: '0px' });
                    }
                }

                await context.close();
            } finally {
                await browser.close();
            }
        });

        test(`Theater ${themeId} covers full split, resize, and a clean player at ${viewport.name}`, async () => {
            const browser = await chromium.launch({ headless: true });
            try {
                const { context, page } = await createHarnessPage(browser);
                await page.setViewportSize({ width: viewport.width, height: viewport.height });
                await page.evaluate(({ theme }) => {
                    document.documentElement.classList.add('rumblex-active');
                    const subscribed = document.querySelector('.chat-history--row');
                    subscribed.classList.add('chat-history--subscribed');
                    subscribed.style.backgroundColor = 'rgb(255, 241, 243)';
                    const signIn = document.createElement('div');
                    signIn.className = 'chat--signin-container';
                    signIn.style.backgroundColor = 'rgb(255, 255, 255)';
                    signIn.textContent = 'Sign in fixture';
                    document.querySelector('.media-page-chat-aside-chat').appendChild(signIn);
                    const harness = globalThis.__RumbleXFeatureHarness;
                    const settings = harness.resetSettings();
                    Object.assign(settings, {
                        theme,
                        darkEnhance: true,
                        theaterSplit: true,
                        screenshotBtn: true,
                        videoStats: true,
                        loopControl: true,
                        quickBookmark: true,
                        shareTimestamp: true,
                        videoDownload: true,
                    });
                    for (const id of ['darkEnhance', 'screenshotBtn', 'videoStats', 'loopControl', 'quickBookmark', 'shareTimestamp', 'theaterSplit']) {
                        const feature = harness.features.find((candidate) => candidate.id === id);
                        feature.destroy();
                        feature.init();
                    }
                }, { theme: themeId });

                await expect(page.locator('#rx-split-wrapper')).toBeVisible();
                await expect(page.locator('#rx-split-right')).toHaveClass(/rx-expanded/);
                await expect(page.locator('.rx-player-tools, .rx-player-tools-trigger, .rx-player-tools-menu')).toHaveCount(0);

                const expanded = await page.evaluate(() => {
                    const left = document.querySelector('#rx-split-left').getBoundingClientRect();
                    const right = document.querySelector('#rx-split-right').getBoundingClientRect();
                    const info = document.querySelector('.rx-header-info').getBoundingClientRect();
                    const actions = document.querySelector('.rx-header-actions').getBoundingClientRect();
                    const wrapperStyle = getComputedStyle(document.querySelector('#rx-split-wrapper'));
                    const rightStyle = getComputedStyle(document.querySelector('#rx-split-right'));
                    const subscribed = document.querySelector('.chat-history--subscribed');
                    const subscribedMessage = subscribed.querySelector('.chat-history--message');
                    const signIn = document.querySelector('.chat--signin-container');
                    return {
                        left: left.toJSON(),
                        right: right.toJSON(),
                        info: info.toJSON(),
                        actions: actions.toJSON(),
                        actionCount: document.querySelectorAll('.rx-header-actions .rx-hdr-btn').length,
                        duplicateDownload: !!document.querySelector('#rx-hdr-download'),
                        theme: document.querySelector('#rx-split-wrapper').dataset.theme,
                        canvas: wrapperStyle.backgroundColor,
                        panel: rightStyle.backgroundColor,
                        subscribedBackground: getComputedStyle(subscribed).backgroundColor,
                        subscribedText: getComputedStyle(subscribedMessage).color,
                        signInBackground: getComputedStyle(signIn).backgroundColor,
                        chatHeaderHidden: getComputedStyle(document.querySelector('.chat--header')).display === 'none',
                        removedSurfaceCount: document.querySelectorAll([
                            '.rx-rant-archive', '.rx-rant-tracker', '#rx-chat-filter',
                            '.rx-chatter-bar', '.rx-player-tools-trigger',
                            '#rx-split-reveal', '#rx-theater-close',
                        ].join(',')).length,
                        exitInsidePanel: !!document.querySelector('#rx-split-right .rx-panel-exit'),
                        // Spot-checking five elements says nothing about the
                        // rest of the panel. Collect every RumbleX-owned node
                        // that actually renders, so an unthemed one can be
                        // named rather than guessed at.
                        painted: [...document.querySelectorAll('[class^="rx-"], [class*=" rx-"], [id^="rx-"]')]
                            .filter((node) => node.getClientRects().length)
                            .map((node) => {
                                const style = getComputedStyle(node);
                                return {
                                    id: node.id || String(node.className).slice(0, 48),
                                    background: style.backgroundColor,
                                    color: style.color,
                                    borderColor: style.borderTopColor,
                                };
                            }),
                        clipped: document.querySelector('#rx-split-right').scrollWidth > document.querySelector('#rx-split-right').clientWidth + 1,
                        horizontalOverflow: document.querySelector('#rx-split-wrapper').scrollWidth
                            - document.querySelector('#rx-split-wrapper').clientWidth,
                    };
                });
                expect(expanded.theme).toBe(themeId);
                expect(expanded.canvas).toBe(rgb(palette.crust));
                expect(expanded.panel).toBe(rgb(palette.base));
                expect(expanded.subscribedText).toBe(rgb(palette.text));
                expect(maxColorChannel(expanded.subscribedBackground)).toBeLessThan(96);
                expect(expanded.signInBackground).toBe(rgb(palette.mantle));
                expect(expanded.chatHeaderHidden).toBe(true);
                expect(expanded.removedSurfaceCount).toBe(0);
                expect(expanded.exitInsidePanel).toBe(true);
                expect(expanded.right.width).toBeGreaterThan(viewport.width === 860 ? 800 : 280);
                expect(viewport.width === 860 ? expanded.left.height : expanded.left.width).toBeGreaterThan(300);
                expect(boxesOverlap(expanded.left, expanded.right)).toBe(false);
                expect(boxesOverlap(expanded.info, expanded.actions)).toBe(false);
                expect(expanded.actionCount).toBe(3);
                expect(expanded.duplicateDownload).toBe(false);
                expect(expanded.clipped).toBe(false);
                expect(expanded.horizontalOverflow).toBeLessThanOrEqual(2);

                // No RumbleX surface may paint a colour that belongs to a
                // palette other than the active one. This is the runtime half
                // of scripts/check-theme-tokens.js: the guard proves the source
                // carries no hardcoded palette hex, this proves nothing
                // resolves to one anyway through a stale token or an inherited
                // rule. Positive control first, or an empty panel would pass.
                expect(expanded.painted.length, `${themeId} rendered no RumbleX surfaces`)
                    .toBeGreaterThan(5);
                const foreignPaint = expanded.painted.filter((node) => (
                    [node.background, node.color, node.borderColor]
                        .some((value) => foreignPalette(value, themeId))
                ));
                expect(foreignPaint, `${themeId} surfaces painted from another palette`).toEqual([]);

                const panelSizeBefore = viewport.width === 860 ? expanded.right.height : expanded.right.width;
                const divider = page.locator('#rx-split-divider');
                await divider.focus();
                const dividerValueBefore = await divider.evaluate((node) => ({
                    current: Number(node.getAttribute('aria-valuenow')),
                    min: Number(node.getAttribute('aria-valuemin')),
                }));
                const resizeKey = viewport.width === 860 ? 'ArrowUp' : 'ArrowLeft';
                for (let index = 0; index < 4; index += 1) await divider.press(resizeKey);
                await expect(divider).toHaveAttribute(
                    'aria-valuenow',
                    String(Math.max(dividerValueBefore.min, dividerValueBefore.current - 8)),
                );
                const panelSizeAfter = await page.locator('#rx-split-right').evaluate((node, narrow) => {
                    const rect = node.getBoundingClientRect();
                    return narrow ? rect.height : rect.width;
                }, viewport.width === 860);
                expect(panelSizeAfter).toBeGreaterThan(panelSizeBefore + 10);

                await page.locator('.rx-panel-exit').click();
                await expect(page.locator('#rx-split-wrapper')).toHaveCount(0);

                await context.close();
            } finally {
                await browser.close();
            }
        });
    }
}

// RumbleX-owned surfaces used to pin Catppuccin hexes, so the watch-progress
// bar, the resume toast and the toast stack rendered in Catppuccin pink and
// blue on all five themes. They read var(--rx-token, #hex) now, which follows
// the palette when the theme engine is on and keeps the readable Catppuccin
// value when it is off.
test('RumbleX-owned surfaces repaint when the palette changes, with no reload', async () => {
    const browser = await chromium.launch({ headless: true });
    try {
        const { context, page } = await createHarnessPage(browser);

        const paint = async (theme) => page.evaluate((themeId) => {
            const harness = globalThis.__RumbleXFeatureHarness;
            const feature = harness.features.find((candidate) => candidate.id === 'darkEnhance');
            feature.destroy();
            const settings = harness.resetSettings();
            Object.assign(settings, { darkEnhance: true, theme: themeId, watchProgress: true });
            feature.init();
            // WatchProgress owns the progress-bar and resume-toast rules, so it
            // has to be mounted for the probe to be styled at all.
            const progress = harness.features.find((candidate) => candidate.id === 'watchProgress');
            progress.destroy();
            progress.init();

            // One node per surface the item names, styled by the same injected
            // rules the real features use.
            document.querySelector('#rx-token-probe')?.remove();
            const probe = document.createElement('div');
            probe.id = 'rx-token-probe';
            probe.innerHTML = '<div class="rx-progress-bar"><div class="rx-progress-fill"></div></div>'
                + '<div class="rx-resume-toast"><button type="button">Resume</button></div>'
                ;
            document.body.appendChild(probe);

            const read = (selector, property) => {
                const node = document.querySelector(selector);
                return node ? getComputedStyle(node).getPropertyValue(property).trim() : null;
            };
            return {
                token: getComputedStyle(document.documentElement).getPropertyValue('--rx-red').trim(),
                progressFill: read('.rx-progress-fill', 'background-color'),
                resumeText: read('.rx-resume-toast', 'color'),
                resumeOutline: read('.rx-resume-toast button', 'outline-color'),
            };
        }, theme);

        // Settle in real time: a computed colour read mid-transition is the
        // old value, not the new one.
        const settle = () => page.waitForTimeout(400);

        const catppuccin = await paint('catppuccin');
        await settle();
        const after = await paint('rumbleGreen');
        await settle();
        const green = await paint('rumbleGreen');

        // Positive control: the probe must actually be styled by our rules, or
        // every comparison below is between two empty strings.
        expect(catppuccin.progressFill).toBeTruthy();
        expect(catppuccin.resumeText).toBeTruthy();
        expect(catppuccin.token).toBe('#f38ba8');
        expect(green.token).toBe('#e55c5c');

        // Catppuccin red vs Rumble Green red, and Catppuccin text vs its text.
        expect(catppuccin.progressFill).toBe('rgb(243, 139, 168)');
        expect(green.progressFill).toBe('rgb(229, 92, 92)');
        expect(catppuccin.resumeText).toBe('rgb(205, 214, 244)');
        expect(green.resumeText).toBe('rgb(214, 232, 196)');
        expect(catppuccin.resumeOutline).not.toBe(green.resumeOutline);
        expect(after.token).toBe(green.token);

        // With the theme engine off, no tokens exist and the fallbacks keep the
        // surfaces readable rather than transparent.
        const unthemed = await page.evaluate(() => {
            const harness = globalThis.__RumbleXFeatureHarness;
            harness.features.find((candidate) => candidate.id === 'darkEnhance').destroy();
            const node = document.querySelector('.rx-progress-fill');
            return {
                token: getComputedStyle(document.documentElement).getPropertyValue('--rx-red').trim(),
                progressFill: node ? getComputedStyle(node).backgroundColor : null,
            };
        });
        expect(unthemed.token).toBe('');
        expect(unthemed.progressFill).toBe('rgb(243, 139, 168)');

        await context.close();
    } finally {
        await browser.close();
    }
});
