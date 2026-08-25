const { test, expect, chromium } = require('@playwright/test');
const { createHarnessPage } = require('./_harness');

async function mountLiveTheater(page, { width = 1440, height = 900 } = {}) {
    await page.setViewportSize({ width, height });
    await page.evaluate(() => {
        const chat = document.querySelector('.media-page-chat-aside-chat');
        chat.innerHTML = `
            <div class="media-page-chat-aside-chat-wrapper-fixed">
                <div class="chat relative">
                    <div class="h-full w-full relative z-20">
                        <div class="js-htmx-listener--chat chat--container container">
                            <header class="chat--header">
                                <h2 class="chat--header-title">Live Chat</h2>
                                <button id="chat-toggle-popup" type="button" aria-label="Pop out chat">Pop out</button>
                                <button type="button" aria-label="Chat settings">Settings</button>
                            </header>
                            <div id="js-chat--height" class="chat--height">
                                <div class="chat-history" style="display:flex;flex:1 1 0%">
                                    <ul id="chat-history-list">
                                        ${Array.from({ length: 36 }, (_, index) => `
                                            <li class="chat--message-container">
                                                <button class="chat-history--username" data-username="viewer-${index % 8}">Viewer ${index % 8}</button>
                                                <span class="chat-history--message">Fixture live chat message ${index + 1}</span>
                                            </li>`).join('')}
                                        <li class="chat-history--rant" data-level="5">
                                            <button class="chat-history--rant-username">Supporter</button>
                                            <span class="chat-history--rant-price">$10</span>
                                        </li>
                                    </ul>
                                </div>
                                <form class="chat-form-overflow-wrapper"><textarea aria-label="Chat message"></textarea></form>
                            </div>
                        </div>
                    </div>
                </div>
            </div>`;

        localStorage.setItem('rx_rants_vfeature123', JSON.stringify([
            { user: 'Supporter', price: '$10', level: 5, text: 'Keep going', ts: Date.now() },
        ]));

        const harness = globalThis.__RumbleXFeatureHarness;
        const settings = harness.resetSettings();
        Object.assign(settings, {
            theaterSplit: true,
            videoDownload: true,
            liveChatEnhance: true,
            rantStatsPanel: true,
            rantHighlight: true,
            uniqueChatters: true,
            chatExport: true,
            rantPersist: true,
            popoutChat: true,
        });
        const ids = [
            'theaterSplit', 'liveChatEnhance', 'rantStatsPanel', 'rantHighlight',
            'uniqueChatters', 'chatExport', 'rantPersist', 'popoutChat',
        ];
        for (const id of ids) harness.features.find((feature) => feature.id === id)?.init();
    });

    await expect(page.locator('#rx-split-wrapper')).toBeVisible();
    await page.locator('#rx-split-reveal').click();
    await expect(page.locator('#rx-split-right')).toHaveClass(/rx-expanded/);
    await expect(page.locator('#rx-tab-chat')).toBeVisible();
    await expect(page.locator('.rx-rant-archive')).toBeVisible();
    await page.waitForTimeout(350);
}

test('live Theater Split keeps chat primary and makes its utilities compact', async () => {
    const browser = await chromium.launch({ headless: true });
    try {
        const { context, page } = await createHarnessPage(browser);
        await mountLiveTheater(page);

        const layout = await page.evaluate(() => {
            const right = document.querySelector('#rx-split-right').getBoundingClientRect();
            const panel = document.querySelector('#rx-tab-chat').getBoundingClientRect();
            const history = document.querySelector('#chat-history-list').getBoundingClientRect();
            const archive = document.querySelector('.rx-rant-archive').getBoundingClientRect();
            const nativeTitle = document.querySelector('.chat--header-title');
            const nativeTitleStyle = getComputedStyle(nativeTitle);
            return {
                panelBottomGap: Math.abs(right.bottom - panel.bottom),
                historyShare: history.height / panel.height,
                historyWidthShare: history.width / panel.width,
                archiveHeight: archive.height,
                archiveExpanded: document.querySelector('.rx-rant-archive__summary')?.getAttribute('aria-expanded'),
                nativeTitleHidden: nativeTitleStyle.display === 'none' || nativeTitleStyle.visibility === 'hidden',
                horizontalOverflow: document.querySelector('#rx-tab-chat').scrollWidth > document.querySelector('#rx-tab-chat').clientWidth,
            };
        });

        expect(layout.panelBottomGap).toBeLessThanOrEqual(1);
        expect(layout.historyShare).toBeGreaterThan(0.5);
        expect(layout.historyWidthShare).toBeGreaterThan(0.9);
        expect(layout.archiveHeight).toBeLessThanOrEqual(48);
        expect(layout.archiveExpanded).toBe('false');
        expect(layout.nativeTitleHidden).toBe(true);
        expect(layout.horizontalOverflow).toBe(false);

        const chatTab = page.locator('#rx-tab-button-chat');
        await chatTab.focus();
        await chatTab.press('ArrowRight');
        await expect(page.locator('#rx-tab-button-comments')).toHaveAttribute('aria-selected', 'true');
        await expect(page.locator('#rx-tab-comments')).toBeVisible();
        await expect(page.locator('#rx-tab-chat')).toBeHidden();
        await expect(page.locator('#rx-tab-comments')).toHaveJSProperty('hidden', false);
        await expect(page.locator('#video-comments')).toBeVisible();

        const commentsFill = await page.evaluate(() => {
            const right = document.querySelector('#rx-split-right').getBoundingClientRect();
            const panel = document.querySelector('#rx-tab-comments').getBoundingClientRect();
            return Math.abs(right.bottom - panel.bottom);
        });
        expect(commentsFill).toBeLessThanOrEqual(1);

        await page.locator('#rx-tab-button-comments').press('ArrowLeft');
        await expect(chatTab).toHaveAttribute('aria-selected', 'true');
        await context.close();
    } finally {
        await browser.close();
    }
});

test('recorded Theater Split opens directly to a full-height Comments tab', async () => {
    const browser = await chromium.launch({ headless: true });
    try {
        const { context, page } = await createHarnessPage(browser);
        await page.setViewportSize({ width: 1440, height: 900 });
        await page.evaluate(() => {
            document.querySelector('.media-page-chat-aside-chat')?.remove();
            document.querySelector('.video-header-live-info')?.remove();
            document.querySelector('.media-description-info-stream-time')?.remove();
            const harness = globalThis.__RumbleXFeatureHarness;
            const settings = harness.resetSettings();
            Object.assign(settings, { theaterSplit: true, videoDownload: true });
            harness.features.find((feature) => feature.id === 'theaterSplit')?.init();
        });

        await expect(page.locator('#rx-split-wrapper')).toBeVisible();
        await page.locator('#rx-split-reveal').click();
        await expect(page.locator('#rx-tab-button-comments')).toHaveAttribute('aria-selected', 'true');
        await expect(page.locator('#rx-tab-button-chat')).toHaveCount(0);
        await expect(page.locator('#video-comments')).toBeVisible();

        const layout = await page.evaluate(() => {
            const right = document.querySelector('#rx-split-right').getBoundingClientRect();
            const comments = document.querySelector('#rx-tab-comments').getBoundingClientRect();
            return {
                bottomGap: Math.abs(right.bottom - comments.bottom),
                horizontalOverflow: document.querySelector('#rx-tab-comments').scrollWidth > document.querySelector('#rx-tab-comments').clientWidth,
            };
        });
        expect(layout.bottomGap).toBeLessThanOrEqual(1);
        expect(layout.horizontalOverflow).toBe(false);
        await context.close();
    } finally {
        await browser.close();
    }
});

test('narrow Theater Split keeps tabs reachable and chat attached to the panel edge', async () => {
    const browser = await chromium.launch({ headless: true });
    try {
        const { context, page } = await createHarnessPage(browser);
        await mountLiveTheater(page);
        await page.evaluate(() => {
            const overlay = document.createElement('div');
            overlay.id = 'fixture-player-overlay';
            overlay.style.cssText = 'position:fixed;inset:0;z-index:99999;background:#000;';
            document.querySelector('#videoPlayer').appendChild(overlay);
        });
        await page.setViewportSize({ width: 820, height: 900 });
        await page.waitForTimeout(350);

        const layout = await page.evaluate(() => {
            const right = document.querySelector('#rx-split-right').getBoundingClientRect();
            const panel = document.querySelector('#rx-tab-chat').getBoundingClientRect();
            const tabs = document.querySelector('#rx-tab-bar');
            return {
                rightWidth: right.width,
                rightHeightShare: right.height / innerHeight,
                viewportWidth: innerWidth,
                viewportBottomGap: Math.abs(innerHeight - right.bottom),
                panelBottomGap: Math.abs(right.bottom - panel.bottom),
                tabsOverflow: tabs.scrollWidth > tabs.clientWidth,
                panelOwnsTopPoint: !!document.elementFromPoint(right.left + 20, right.top + 20)?.closest('#rx-split-right'),
                historyHeight: document.querySelector('#chat-history-list').getBoundingClientRect().height,
            };
        });
        expect(Math.abs(layout.viewportWidth - layout.rightWidth)).toBeLessThanOrEqual(1);
        expect(layout.rightHeightShare).toBeGreaterThan(0.55);
        expect(layout.viewportBottomGap).toBeLessThanOrEqual(1);
        expect(layout.panelBottomGap).toBeLessThanOrEqual(1);
        expect(layout.tabsOverflow).toBe(false);
        expect(layout.panelOwnsTopPoint).toBe(true);
        expect(layout.historyHeight).toBeGreaterThan(40);

        await page.evaluate(() => {
            const drawer = document.createElement('div');
            drawer.className = 'media-page-mobile-drawer-content';
            const shell = document.querySelector('#rx-tab-chat .chat.relative');
            drawer.appendChild(shell);
            document.querySelector('.main-and-sidebar').appendChild(drawer);
        });
        await expect(page.locator('#rx-tab-chat #chat-history-list')).toBeVisible();

        await page.evaluate(() => {
            document.querySelector('#rx-tab-chat #chat-history-list')?.remove();
            const replacement = document.createElement('aside');
            replacement.className = 'media-page-chat-aside-chat';
            replacement.innerHTML = `
                <div class="media-page-chat-aside-chat-wrapper-fixed">
                    <div class="chat relative">
                        <div class="h-full w-full relative z-20">
                            <div class="js-htmx-listener--chat chat--container container">
                                <header class="chat--header"><h2 class="chat--header-title">Live Chat</h2></header>
                                <div id="js-chat--height" class="chat--height">
                                    <div class="chat-history" style="display:flex">
                                        <ul id="chat-history-list">
                                            <li class="chat--message-container"><button class="chat-history--username" data-username="replacement">Replacement</button><span class="chat-history--message">Responsive chat root</span></li>
                                        </ul>
                                    </div>
                                    <form class="chat-form-overflow-wrapper"><textarea aria-label="Chat message"></textarea></form>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>`;
            document.querySelector('.main-and-sidebar').appendChild(replacement);
        });

        await expect(page.locator('#rx-tab-chat #chat-history-list')).toBeVisible();
        await expect(page.locator('#rx-tab-chat #rx-chat-filter')).toBeVisible();
        await expect(page.locator('#rx-tab-chat .rx-chat-export-btn')).toBeVisible();
        await expect(page.locator('#rx-tab-chat .rx-popout-chat-btn')).toBeVisible();
        await expect(page.locator('#rx-tab-chat .rx-rant-archive')).toHaveCount(1);
        await expect(page.locator('#rx-tab-chat .rx-chatter-bar')).toHaveCount(1);
        await context.close();
    } finally {
        await browser.close();
    }
});
