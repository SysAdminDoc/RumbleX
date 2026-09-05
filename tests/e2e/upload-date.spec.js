// @ts-check
// Rumble shows "3 days ago" on a watch page and nothing else, so the only
// record of when a video was actually published is the schema.org VideoObject
// the page already carries. Exact Counts reads it.
const { test, expect, chromium } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const { createHarnessPage } = require('./_harness');

test.setTimeout(120_000);

const FIXTURE = fs.readFileSync(
    path.join(__dirname, '..', 'fixtures', 'platform', 'structured-watch.html'),
    'utf8',
);
const FIXTURE_BODY = FIXTURE.match(/<body[^>]*>([\s\S]*?)<\/body>/i)[1];
const FIXTURE_HEAD = [...FIXTURE.matchAll(/<script type="application\/ld\+json">[\s\S]*?<\/script>/gi)].join('\n');

// The class Rumble puts the publish/stream time in, taken from a live capture.
const LABEL_CLASS = 'media-description-info-stream-time';
const UPLOADED_ISO = '2026-08-18T12:26:21+00:00';

// Locale and timezone are pinned, or the expected string depends on whoever
// runs the suite. 12:26 UTC is 08:26 in New York, which also proves the
// formatter is using the viewer's zone rather than printing the raw stamp.
const CONTEXT = { locale: 'en-US', timezoneId: 'America/New_York' };

async function mount(page, { labelText = '3 days ago', jsonLd = FIXTURE_HEAD } = {}) {
    return page.evaluate(({ body, head, label, labelClass }) => {
        for (const stale of document.querySelectorAll('script[type="application/ld+json"]')) stale.remove();
        document.head.insertAdjacentHTML('beforeend', head);
        document.body.innerHTML = body;
        if (label !== null) {
            const node = document.createElement('div');
            node.className = labelClass;
            node.textContent = label;
            document.querySelector('main').appendChild(node);
        }
        const harness = globalThis.__RumbleXFeatureHarness;
        harness.enable('exactCounts');
        const feature = harness.features.find((candidate) => candidate.id === 'exactCounts');
        feature.destroy();
        feature.init();
        feature._processCards();
        const node = document.querySelector('.' + labelClass);
        return node ? { text: node.textContent, aria: node.getAttribute('aria-label') } : null;
    }, { body: FIXTURE_BODY, head: jsonLd, label: labelText, labelClass: LABEL_CLASS });
}

async function withHarness(run) {
    const browser = await chromium.launch({ headless: true });
    try {
        const { context, page } = await createHarnessPage(browser, CONTEXT);
        await run(page);
        await context.close();
    } finally {
        await browser.close();
    }
}

test('the relative label becomes an absolute date and keeps the phrase as its accessible name', async () => {
    await withHarness(async (page) => {
        const label = await mount(page);
        // Positive control: the label exists and was rewritten.
        expect(label).not.toBeNull();
        expect(label.text).not.toBe('3 days ago');
        // 2026-08-18T12:26:21Z rendered in America/New_York, en-US.
        expect(label.text).toBe('Aug 18, 2026, 8:26 AM');
        expect(label.aria).toBe('Aug 18, 2026, 8:26 AM (3 days ago)');
    });
});

test('a missing or unparseable upload date leaves the host text alone', async () => {
    await withHarness(async (page) => {
        const noVideoObject = await mount(page, {
            jsonLd: '<script type="application/ld+json">{"@context":"https://schema.org","@type":"WebSite","url":"https://rumble.com/"}</script>',
        });
        expect(noVideoObject.text).toBe('3 days ago');
        expect(noVideoObject.aria).toBeNull();

        const badStamp = await mount(page, {
            jsonLd: '<script type="application/ld+json">{"@context":"https://schema.org","@type":"VideoObject","name":"x","uploadDate":"not a date"}</script>',
        });
        expect(badStamp.text).toBe('3 days ago');
        expect(badStamp.aria).toBeNull();
    });
});

test('the timezone is the viewer\'s, not the stamp\'s', async () => {
    const browser = await chromium.launch({ headless: true });
    try {
        const { context, page } = await createHarnessPage(browser, { locale: 'en-US', timezoneId: 'Asia/Tokyo' });
        const label = await mount(page);
        // The same instant, nine hours later and on the following day.
        expect(label.text).toBe('Aug 18, 2026, 9:26 PM');
        await context.close();
    } finally {
        await browser.close();
    }
});

test('disabling the feature puts the original label and accessible name back', async () => {
    await withHarness(async (page) => {
        await mount(page);
        const restored = await page.evaluate((labelClass) => {
            globalThis.__RumbleXFeatureHarness.features
                .find((candidate) => candidate.id === 'exactCounts').destroy();
            const node = document.querySelector('.' + labelClass);
            return { text: node.textContent, aria: node.getAttribute('aria-label'), marked: node.dataset.rxExact };
        }, LABEL_CLASS);
        expect(restored.text).toBe('3 days ago');
        expect(restored.aria).toBeNull();
        expect(restored.marked).toBeUndefined();
    });
});

test('download metadata carries the upload date as ISO 8601', async () => {
    await withHarness(async (page) => {
        await mount(page);
        const meta = await page.evaluate(() => ({ uploadDate: PageData.uploadDate() }));
        // The structured-data reader hands back the stamp untouched, which is
        // what the .info.json sidecar writes as `timestamp`.
        expect(meta.uploadDate).toBe(UPLOADED_ISO);
        expect(new Date(meta.uploadDate).toISOString()).toBe('2026-08-18T12:26:21.000Z');
    });
});
