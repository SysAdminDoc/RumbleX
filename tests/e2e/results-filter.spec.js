// @ts-check
// Filtering and sorting the results already loaded on a search or channel
// page, and saying plainly that this is all it does.
const { test, expect, chromium } = require('@playwright/test');
const { createHarnessPage } = require('./_harness');

// Cards in the shape Rumble's custom element uses today: the sortable facts
// are attributes (`time` ISO, `duration` seconds, `views`). One card carries
// none, which is what an older layout or a live listing looks like.
const CARDS = [
    { id: 'a', title: 'Alpha Report', channel: 'Creator Alpha', time: '2026-01-10T00:00:00Z', duration: 600, views: 10 },
    { id: 'b', title: 'Beta Briefing', channel: 'Creator Beta', time: '2026-03-01T00:00:00Z', duration: 3600, views: 5 },
    { id: 'c', title: 'Gamma Notes', channel: 'Creator Alpha', time: '2025-12-24T00:00:00Z', duration: 120, views: 100 },
    { id: 'd', title: 'Delta Special', channel: 'Creator Delta' },
];

const card = ({ id, title, channel, time, duration, views }) => {
    const attributes = [
        'role="listitem"',
        `url="/v${id}00-${id}.html"`,
        `name="${channel}"`,
        time ? `time="${time}"` : '',
        duration !== undefined ? `duration="${duration}"` : '',
        views !== undefined ? `views="${views}"` : '',
    ].filter(Boolean).join(' ');
    return `<rum-video-thumbnail ${attributes}><a href="/v${id}00-${id}.html">${title}</a>`
        + `<a rel="author" href="/c/${channel.toLowerCase().replace(/ /g, '-')}">${channel}</a>`
        + `<rum-text role="heading">${title}</rum-text></rum-video-thumbnail>`;
};

const searchPage = (cards) => `<header data-js="app_header"></header><main><ol id="search-results">${
    cards.map((entry) => `<li class="video-listing-entry">${card(entry)}</li>`).join('')
}<li class="rx-test-sentinel">load more</li></ol></main>`;
const channelPage = (cards) => `<header data-js="app_header"></header><main><h1>Fixture Channel</h1><div class="grid">${
    cards.map(card).join('')
}</div></main>`;

async function withResults(fn) {
    const browser = await chromium.launch({ headless: true });
    try {
        const { context, page } = await createHarnessPage(browser);
        const errors = [];
        page.on('pageerror', (error) => errors.push(String(error?.stack || error)));
        const api = {
            page,
            open: (html, path) => page.evaluate(async ({ markup, route }) => {
                const harness = globalThis.__RumbleXFeatureHarness;
                harness.enable('resultsFilter');
                document.body.innerHTML = markup;
                history.replaceState({}, '', route);
                const feature = harness.features.find((entry) => entry.id === 'resultsFilter');
                feature.destroy();
                feature.init();
                await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
            }, { markup: html, route: path }),
            // Titles in document order, with a mark on the ones hidden.
            state: () => page.evaluate(() => ({
                order: [...document.querySelectorAll('rum-video-thumbnail')].map((node) => {
                    const item = node.closest('li') || node;
                    const title = node.querySelector('rum-text').textContent;
                    return item.classList.contains('rx-rf-hidden') ? `(${title})` : title;
                }),
                status: document.querySelector('.rx-results-filter-status')?.textContent || null,
                state: document.querySelector('.rx-results-filter')?.dataset.state || null,
                sentinelLast: document.querySelector('#search-results')?.lastElementChild?.classList.contains('rx-test-sentinel') ?? null,
            })),
            type: (text) => page.locator('.rx-results-filter input').fill(text),
            sort: (value) => page.locator('.rx-results-filter select').selectOption(value),
        };
        await fn(api);
        expect(errors).toEqual([]);
        await context.close();
    } finally {
        await browser.close();
    }
}

test('search results filter by title or channel and say they only cover what is loaded', async () => {
    await withResults(async (t) => {
        await t.open(searchPage(CARDS), '/search/video?q=report');
        const bar = t.page.locator('.rx-results-filter');
        await expect(bar).toHaveAttribute('role', 'search');
        await expect(bar.locator('input')).toHaveAttribute('aria-label', 'Filter loaded results by title or channel');
        let state = await t.state();
        expect(state.status).toBe('Showing all 4 loaded results. This filters and sorts what is on the page, not Rumble\'s search.');

        await t.type('creator alpha'); // matches the channel, not the title
        state = await t.state();
        expect(state.order).toEqual(['Alpha Report', '(Beta Briefing)', 'Gamma Notes', '(Delta Special)']);
        expect(state.status).toBe('Showing 2 of 4 loaded results. More load as you scroll, and they join the filter as they arrive.');

        await t.type('briefing'); // matches the title
        expect((await t.state()).order).toEqual(['(Alpha Report)', 'Beta Briefing', '(Gamma Notes)', '(Delta Special)']);
    });
});

test('sorting uses the date, length and views the cards carry, keeps unknowns last and restores Rumble\'s order', async () => {
    await withResults(async (t) => {
        await t.open(searchPage(CARDS), '/search/video?q=report');
        await t.sort('newest');
        let state = await t.state();
        expect(state.order).toEqual(['Beta Briefing', 'Alpha Report', 'Gamma Notes', 'Delta Special']);
        // Rumble's load-more sentinel stays after the results.
        expect(state.sentinelLast).toBe(true);
        await t.sort('oldest');
        expect((await t.state()).order).toEqual(['Gamma Notes', 'Alpha Report', 'Beta Briefing', 'Delta Special']);
        await t.sort('longest');
        expect((await t.state()).order).toEqual(['Beta Briefing', 'Alpha Report', 'Gamma Notes', 'Delta Special']);
        await t.sort('shortest');
        expect((await t.state()).order).toEqual(['Gamma Notes', 'Alpha Report', 'Beta Briefing', 'Delta Special']);
        await t.sort('views');
        expect((await t.state()).order).toEqual(['Gamma Notes', 'Alpha Report', 'Beta Briefing', 'Delta Special']);
        await t.sort('rumble');
        expect((await t.state()).order).toEqual(['Alpha Report', 'Beta Briefing', 'Gamma Notes', 'Delta Special']);
    });
});

test('results that arrive by infinite scroll join the current filter and sort', async () => {
    await withResults(async (t) => {
        await t.open(searchPage(CARDS), '/search/video?q=report');
        await t.type('alpha');
        await t.sort('newest');
        await t.page.evaluate((markup) => {
            const list = document.querySelector('#search-results');
            list.querySelector('.rx-test-sentinel').insertAdjacentHTML('beforebegin', markup);
        }, [
            `<li class="video-listing-entry">${card({ id: 'e', title: 'Alpha Five', channel: 'Creator Echo', time: '2026-06-01T00:00:00Z', duration: 90, views: 1 })}</li>`,
            `<li class="video-listing-entry">${card({ id: 'f', title: 'Foxtrot', channel: 'Creator Echo', time: '2026-07-01T00:00:00Z', duration: 90, views: 1 })}</li>`,
        ].join(''));
        await expect.poll(async () => (await t.state()).order).toEqual([
            // Hidden results are sorted too, so clearing the filter shows a
            // list that is already in order.
            '(Foxtrot)', 'Alpha Five', '(Beta Briefing)', 'Alpha Report', 'Gamma Notes', '(Delta Special)',
        ]);
        const state = await t.state();
        expect(state.status).toBe('Showing 3 of 6 loaded results. More load as you scroll, and they join the filter as they arrive.');
        expect(state.sentinelLast).toBe(true);
    });
});

test('an empty list says whether Rumble or the filter emptied it', async () => {
    await withResults(async (t) => {
        await t.open(searchPage(CARDS), '/search/video?q=report');
        await t.type('no such video');
        let state = await t.state();
        expect(state.state).toBe('filter-empty');
        expect(state.status).toBe('None of the 4 loaded results match. Rumble may have more further down, or clear the filter.');

        await t.open(searchPage([]), '/search/video?q=nothing');
        state = await t.state();
        expect(state.state).toBe('backend-empty');
        expect(state.status).toBe('Rumble returned no results here, so the filter has nothing to work with.');
    });
});

test('channel pages get a loaded-video search, and sorts the cards cannot answer are not offered', async () => {
    await withResults(async (t) => {
        const noViews = CARDS.map(({ views, ...rest }) => rest);
        await t.open(channelPage(noViews), '/c/fixture-channel');
        await expect(t.page.locator('.rx-results-filter input')).toHaveAttribute('placeholder', 'Search loaded videos by title');
        const disabled = await t.page.evaluate(() => [...document.querySelectorAll('.rx-results-filter option')]
            .filter((option) => option.disabled).map((option) => option.value));
        expect(disabled).toEqual(['views']);
        await t.type('gamma');
        expect((await t.state()).order).toEqual(['(Alpha Report)', '(Beta Briefing)', 'Gamma Notes', '(Delta Special)']);
    });
});

test('disabling or leaving the page puts every result back, visible and in Rumble\'s order', async () => {
    await withResults(async (t) => {
        await t.open(searchPage(CARDS), '/search/video?q=report');
        await t.type('alpha');
        await t.sort('views');
        const afterDestroy = await t.page.evaluate(() => {
            globalThis.__RumbleXFeatureHarness.features.find((entry) => entry.id === 'resultsFilter').destroy();
            return {
                bar: !!document.querySelector('.rx-results-filter'),
                hidden: document.querySelectorAll('.rx-rf-hidden').length,
                marked: document.querySelectorAll('[data-rx-rf-order]').length,
                order: [...document.querySelectorAll('rum-video-thumbnail rum-text')].map((node) => node.textContent),
                style: !!document.getElementById('rx-results-filter-css'),
            };
        });
        expect(afterDestroy).toEqual({
            bar: false,
            hidden: 0,
            marked: 0,
            order: ['Alpha Report', 'Beta Briefing', 'Gamma Notes', 'Delta Special'],
            style: false,
        });

        // A route change away from search takes the bar with it; coming back
        // mounts a fresh one.
        await t.open(searchPage(CARDS), '/search/video?q=report');
        await t.page.evaluate(() => Router.init());
        await t.page.evaluate(() => history.pushState({}, '', '/vwatch001-away.html'));
        await expect(t.page.locator('.rx-results-filter')).toHaveCount(0);
        await t.page.evaluate(() => history.pushState({}, '', '/search/video?q=again'));
        await expect(t.page.locator('.rx-results-filter')).toHaveCount(1);
    });
});

test('the older search markup answers the same questions, and an abbreviated count is unknown, not a number', async () => {
    await withResults(async (t) => {
        const facts = await t.page.evaluate(() => {
            document.body.innerHTML = `<main><ol>
                <li class="video-listing-entry"><article class="video-item">
                    <a href="/vold001-one.html"><div class="video-item--img-wrapper"><span class="video-item--duration" data-value="1:02:03"></span></div></a>
                    <time class="video-item--meta video-item--time" datetime="2026-02-03T04:05:06+00:00">Feb 3</time>
                    <h3 class="video-item--title">Old Markup One</h3>
                    <span class="video-item--meta video-item--views" data-value="12,345">12.3K</span>
                </article></li>
                <li class="video-listing-entry"><article class="video-item">
                    <a href="/vold002-two.html"><div class="video-item--img-wrapper"><span class="video-item--duration" data-value="LIVE"></span></div></a>
                    <h3 class="video-item--title">Old Markup Two</h3>
                    <span class="video-item--meta video-item--views" data-value="1.2K">1.2K</span>
                </article></li>
            </ol></main>`;
            return VideoCards.all(document.querySelector('main')).map((node) => ({
                published: VideoCards.published(node),
                duration: VideoCards.duration(node),
                views: VideoCards.views(node),
            }));
        });
        expect(facts).toEqual([
            { published: Date.parse('2026-02-03T04:05:06+00:00'), duration: 3723, views: 12345 },
            // A live badge and a rounded count say nothing sortable.
            { published: null, duration: null, views: null },
        ]);
    });
});

test('the filter bar passes axe', async () => {
    const AxeBuilder = require('@axe-core/playwright').default;
    await withResults(async (t) => {
        await t.open(searchPage(CARDS), '/search/video?q=report');
        await t.type('alpha');
        const accessibility = await new AxeBuilder({ page: t.page })
            .include('.rx-results-filter')
            .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
            .analyze();
        expect(accessibility.violations).toEqual([]);
    });
});
