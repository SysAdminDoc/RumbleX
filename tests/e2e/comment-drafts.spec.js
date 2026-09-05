// @ts-check
// Comment drafts. A long comment is the most expensive thing a viewer types on
// this site, and the two ways it disappears are both ordinary: the player
// reaches the end and autoplay swaps the page out, or an SPA navigation
// replaces the comment section.
const { test, expect, chromium } = require('@playwright/test');
const { createHarnessPage } = require('./_harness');

// Each case launches its own browser, which on a loaded machine can exceed the
// 30s default before a single assertion runs.
test.setTimeout(120_000);

const DRAFT_KEY = 'rx_comment_drafts';
// The harness fixture URL is /vfeature123-catalog-fixture.html, so every draft
// key on it starts with this video id.
const VIDEO = 'vfeature123';

// A top-level composer plus one existing comment carrying its own reply box, so
// the two draft identities can be told apart.
const COMMENTS_HTML = `
<div data-js="media_page_comments_container" id="video-comments">
  <div data-js="comment_form"><textarea class="comments-create-textarea" id="top-composer"></textarea></div>
  <ul id="comment-list">
    <li class="comment-item" data-comment-id="c-1001">
      <div class="comment-text">An existing comment</div>
      <div data-js="comment_reply_form"><textarea id="reply-composer"></textarea></div>
    </li>
  </ul>
</div>`;

async function mountDrafts(page) {
    await page.evaluate((html) => {
        localStorage.clear();
        document.querySelector('#video-comments')?.remove();
        document.body.insertAdjacentHTML('beforeend', html);
        const harness = globalThis.__RumbleXFeatureHarness;
        harness.enable('commentDrafts');
        const feature = harness.features.find((candidate) => candidate.id === 'commentDrafts');
        feature.destroy();
        feature.init();
    }, COMMENTS_HTML);
}

async function withHarness(run) {
    const browser = await chromium.launch({ headless: true });
    try {
        const { context, page } = await createHarnessPage(browser);
        await mountDrafts(page);
        await run(page);
        await context.close();
    } finally {
        await browser.close();
    }
}

// Typing through the real input path, so the debounced save runs the way it
// does for a person.
async function type(page, selector, text) {
    await page.evaluate(({ selector, text }) => {
        const field = document.querySelector(selector);
        field.value = text;
        field.dispatchEvent(new Event('input', { bubbles: true }));
    }, { selector, text });
}

const readStore = (page) => page.evaluate((key) => {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
}, DRAFT_KEY);

test('a top-level draft and a reply draft are stored under different keys', async () => {
    await withHarness(async (page) => {
        await type(page, '#top-composer', 'A top level thought');
        await type(page, '#reply-composer', 'A reply to comment one');
        await expect.poll(async () => Object.keys((await readStore(page)) || {}).length).toBe(2);

        const store = await readStore(page);
        // Same video, different parents, different records. A reply box lives
        // inside the comment it answers; a top-level box does not.
        expect(Object.keys(store).sort()).toEqual([`${VIDEO}|`, `${VIDEO}|c-1001`]);
        expect(store[`${VIDEO}|`].text).toBe('A top level thought');
        expect(store[`${VIDEO}|c-1001`].text).toBe('A reply to comment one');
        for (const entry of Object.values(store)) expect(Number.isFinite(entry.at)).toBe(true);
    });
});

test('a draft comes back after the comment section is replaced', async () => {
    await withHarness(async (page) => {
        await type(page, '#top-composer', 'Survives a navigation');
        await expect.poll(async () => Object.keys((await readStore(page)) || {}).length).toBe(1);

        // An SPA navigation swaps the comment section without a document load,
        // which is how the text disappeared in the first place.
        const restored = await page.evaluate((html) => {
            document.querySelector('#video-comments').remove();
            document.body.insertAdjacentHTML('beforeend', html);
            const feature = globalThis.__RumbleXFeatureHarness.features
                .find((candidate) => candidate.id === 'commentDrafts');
            feature._restore();
            return document.querySelector('#top-composer').value;
        }, COMMENTS_HTML);
        expect(restored).toBe('Survives a navigation');

        // Rumble drives its own submit button off input events, so a silent
        // value assignment would leave it disabled.
        const notified = await page.evaluate((html) => {
            document.querySelector('#video-comments').remove();
            document.body.insertAdjacentHTML('beforeend', html);
            let saw = false;
            document.querySelector('#top-composer').addEventListener('input', () => { saw = true; });
            globalThis.__RumbleXFeatureHarness.features
                .find((candidate) => candidate.id === 'commentDrafts')._restore();
            return saw;
        }, COMMENTS_HTML);
        expect(notified).toBe(true);
    });
});

test('a dirty draft stops the player advancing to the next video', async () => {
    await withHarness(async (page) => {
        const clean = await page.evaluate(() => {
            const video = document.createElement('video');
            video.id = 'draft-probe-video';
            document.body.appendChild(video);
            let reached = false;
            const listener = () => { reached = true; };
            document.addEventListener('ended', listener);
            video.dispatchEvent(new Event('ended', { bubbles: true }));
            document.removeEventListener('ended', listener);
            return reached;
        });
        // Positive control: with no draft the event reaches the page's own
        // handlers, so the assertion below is measuring the guard.
        expect(clean).toBe(true);

        await type(page, '#top-composer', 'Do not navigate away from this');
        await expect.poll(async () => Object.keys((await readStore(page)) || {}).length).toBe(1);

        const dirty = await page.evaluate(() => {
            let reached = false;
            const listener = () => { reached = true; };
            document.addEventListener('ended', listener);
            document.querySelector('#draft-probe-video').dispatchEvent(new Event('ended', { bubbles: true }));
            document.removeEventListener('ended', listener);
            return reached;
        });
        expect(dirty).toBe(false);
    });
});

test('a draft survives submission and clears only once the comment appears', async () => {
    await withHarness(async (page) => {
        await type(page, '#top-composer', 'Posted at last');
        await expect.poll(async () => Object.keys((await readStore(page)) || {}).length).toBe(1);

        // Submitted, but the comment never lands. A failed post is exactly when
        // the text is worth keeping.
        await page.evaluate(() => {
            const field = document.querySelector('#top-composer');
            const form = document.createElement('form');
            field.parentElement.appendChild(form);
            form.appendChild(field);
            form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
        });
        await page.waitForTimeout(400);
        expect(Object.keys((await readStore(page)) || {})).toHaveLength(1);

        // Now it shows up in the list.
        await page.evaluate(() => {
            const item = document.createElement('li');
            item.className = 'comment-item';
            item.setAttribute('data-comment-id', 'c-1002');
            item.innerHTML = '<div class="comment-text">Posted at last</div>';
            document.querySelector('#comment-list').appendChild(item);
        });
        await expect.poll(async () => Object.keys((await readStore(page)) || {}).length).toBe(0);
    });
});

test('drafts expire after thirty days and a malformed record is dropped', async () => {
    await withHarness(async (page) => {
        const kept = await page.evaluate((key) => {
            const day = 24 * 60 * 60 * 1000;
            localStorage.setItem(key, JSON.stringify({
                'v1|fresh': { text: 'recent', at: Date.now() - day },
                'v1|stale': { text: 'ancient', at: Date.now() - (31 * day) },
                'v1|empty': { text: '', at: Date.now() },
                'v1|undated': { text: 'no stamp' },
            }));
            const feature = globalThis.__RumbleXFeatureHarness.features
                .find((candidate) => candidate.id === 'commentDrafts');
            return Object.keys(feature._load()).sort();
        }, DRAFT_KEY);
        expect(kept).toEqual(['v1|fresh']);
    });
});

test('drafts obey Reset All Data and stay out of backups', async () => {
    await withHarness(async (page) => {
        // An unsent draft is private text the user has not chosen to publish,
        // so a backup must not carry it and an imported file must not restore
        // it. The reset is the opposite: it does clear them.
        const backup = await page.evaluate((key) => {
            localStorage.setItem('rx_bookmarks', '[{"id":"v1"}]');
            localStorage.setItem(key, JSON.stringify({ 'v1|x': { text: 'private', at: Date.now() } }));
            const exported = rxReadLocalStorage();
            localStorage.removeItem(key);
            const written = rxWriteLocalStorage({
                [key]: JSON.stringify({ 'v1|y': { text: 'smuggled', at: Date.now() } }),
                rx_bookmarks: '[{"id":"v2"}]',
            });
            return {
                exportedKeys: Object.keys(exported).sort(),
                written,
                afterImport: localStorage.getItem(key),
            };
        }, DRAFT_KEY);
        // Positive control: the exporter did run and did carry something.
        expect(backup.exportedKeys).toContain('rx_bookmarks');
        expect(backup.exportedKeys).not.toContain(DRAFT_KEY);
        expect(backup.written).toBe(1);
        expect(backup.afterImport).toBeNull();

        const afterReset = await page.evaluate((key) => {
            localStorage.setItem(key, JSON.stringify({ 'v1|z': { text: 'gone soon', at: Date.now() } }));
            const cleared = rxClearLocalStorage();
            return { value: localStorage.getItem(key), cleared };
        }, DRAFT_KEY);
        expect(afterReset.cleared).toBeGreaterThan(0);
        expect(afterReset.value).toBeNull();
    });
});

test('destroy leaves no listener, timer or injected node behind', async () => {
    await withHarness(async (page) => {
        await type(page, '#top-composer', 'Something to tear down');
        await expect.poll(async () => Object.keys((await readStore(page)) || {}).length).toBe(1);

        const after = await page.evaluate(() => {
            const feature = globalThis.__RumbleXFeatureHarness.features
                .find((candidate) => candidate.id === 'commentDrafts');
            feature.destroy();
            const video = document.createElement('video');
            document.body.appendChild(video);
            let reached = false;
            const listener = () => { reached = true; };
            document.addEventListener('ended', listener);
            video.dispatchEvent(new Event('ended', { bubbles: true }));
            document.removeEventListener('ended', listener);
            return {
                endedStillBlocked: !reached,
                notes: document.querySelectorAll('.rx-draft-note').length,
                style: !!document.getElementById('rx-comment-drafts'),
                pendingTimers: feature._rxPendingTimeouts ? feature._rxPendingTimeouts.size : 0,
                handlers: feature._handlers,
            };
        });
        expect(after.endedStillBlocked).toBe(false);
        expect(after.notes).toBe(0);
        expect(after.style).toBe(false);
        expect(after.pendingTimers).toBe(0);
        expect(after.handlers).toBeNull();
    });
});
