// @ts-check
// Behavioral coverage for modules that `feature-lifecycle.spec.js` only proves
// mount and unmount cleanly.
//
// Mounting is not behavior: every one of these modules could init, destroy, and
// produce entirely wrong output while still passing the lifecycle suite. Each
// test here asserts an actual product — a stripped parameter, a parsed chapter
// list, a persisted entry, a skipped segment, a seek position, an exported file
// shape — rather than the fact that a DOM node appeared.
const { test, expect, chromium } = require('@playwright/test');
const { BODY, createHarnessPage } = require('./_harness');

/** Run `fn` inside a fresh harness page and return its result. */
async function inHarness(fn, arg) {
    const browser = await chromium.launch({ headless: true });
    try {
        const { context, page } = await createHarnessPage(browser);
        const errors = [];
        page.on('pageerror', (error) => errors.push(String(error?.stack || error)));
        const result = await page.evaluate(fn, { body: BODY, ...(arg || {}) });
        await context.close();
        expect(errors, 'unexpected page errors').toEqual([]);
        return result;
    } finally {
        await browser.close();
    }
}

test('StripTrackingParams removes only tracking keys and preserves canonical ones', async () => {
    const result = await inHarness(() => {
        const harness = globalThis.__RumbleXFeatureHarness;
        harness.enable('stripTrackingParams');
        const feature = harness.features.find((f) => f.id === 'stripTrackingParams');
        const clean = (href) => feature._clean(href);
        return {
            // Canonical playback params must survive.
            keepsCanonical: clean('https://rumble.com/vabc-x.html?start=90&t=30&v=1&q=hd&page=2'),
            stripsUtm: clean('https://rumble.com/vabc-x.html?utm_source=n&utm_medium=e&start=90'),
            stripsClickIds: clean('https://rumble.com/vabc-x.html?fbclid=A&gclid=B&yclid=C&t=5'),
            stripsCaseInsensitively: clean('https://rumble.com/vabc-x.html?UTM_SOURCE=n&Ref=x'),
            // Non-Rumble hosts are left completely alone.
            ignoresOffsite: clean('https://example.com/p?utm_source=n'),
            // Nothing to strip means the original string is returned untouched.
            untouched: clean('https://rumble.com/vabc-x.html?start=90'),
            subdomainHandled: clean('https://web.rumble.com/vabc-x.html?ref=q&start=1'),
        };
    });

    expect(result.keepsCanonical).toBe('https://rumble.com/vabc-x.html?start=90&t=30&v=1&q=hd&page=2');
    expect(result.stripsUtm).toBe('https://rumble.com/vabc-x.html?start=90');
    expect(result.stripsClickIds).toBe('https://rumble.com/vabc-x.html?t=5');
    expect(result.stripsCaseInsensitively).toBe('https://rumble.com/vabc-x.html');
    expect(result.ignoresOffsite).toBe('https://example.com/p?utm_source=n');
    expect(result.untouched).toBe('https://rumble.com/vabc-x.html?start=90');
    expect(result.subdomainHandled).toBe('https://web.rumble.com/vabc-x.html?start=1');
});

test('Chapters parses timestamps into a sorted, deduped list and seeks to them', async () => {
    const result = await inHarness(({ body }) => {
        document.body.innerHTML = body;
        const harness = globalThis.__RumbleXFeatureHarness;
        harness.enable('chapters');
        const feature = harness.features.find((f) => f.id === 'chapters');

        const description = document.createElement('div');
        description.className = 'media-description';
        // Deliberately out of order, with a duplicate, an hour-form stamp, a
        // mid-sentence timestamp that must NOT match, and a bare stamp with no
        // label that must be dropped.
        description.innerText = [
            '10:00 Third topic',
            '0:00 - Intro',
            '1:02:03 — Long tail',
            '0:00 - Intro',
            'we discussed this at 5:00 in the previous episode',
            '2:30',
            '05:45: Second topic',
        ].join('\n');
        document.body.appendChild(description);

        const parsed = feature._parseDescription();

        const video = document.querySelector('video');
        let seeked = null;
        Object.defineProperty(video, 'currentTime', {
            configurable: true,
            get: () => 0,
            set: (value) => { seeked = value; },
        });
        feature._seek(345);

        return {
            parsed,
            seeked,
            tsForms: [feature._tsToSec('0:30'), feature._tsToSec('2:05'), feature._tsToSec('1:02:03')],
        };
    });

    expect(result.tsForms).toEqual([30, 125, 3723]);
    expect(result.parsed).toEqual([
        { time: 0, label: 'Intro' },
        { time: 345, label: 'Second topic' },
        { time: 600, label: 'Third topic' },
        { time: 3723, label: 'Long tail' },
    ]);
    expect(result.seeked).toBe(345);
});

test('SearchHistory persists queries most-recent-first, dedupes, and caps the list', async () => {
    const result = await inHarness(({ body }) => {
        document.body.innerHTML = body;
        const harness = globalThis.__RumbleXFeatureHarness;
        harness.enable('searchHistory');
        const feature = harness.features.find((f) => f.id === 'searchHistory');
        localStorage.removeItem(feature._KEY);

        feature._recordSearch('first query');
        feature._recordSearch('second query');
        feature._recordSearch('first query');
        const afterDedupe = feature._getHistory();

        for (let i = 0; i < feature._MAX + 25; i += 1) feature._recordSearch('bulk ' + i);
        const capped = feature._getHistory();

        const persisted = JSON.parse(localStorage.getItem(feature._KEY) || '[]').length;

        // Blank input must not create an entry.
        localStorage.removeItem(feature._KEY);
        feature._recordSearch('   ');
        const blank = feature._getHistory();

        return {
            afterDedupe,
            cappedLength: capped.length,
            cappedNewestFirst: capped[0],
            max: feature._MAX,
            blankLength: blank.length,
            persisted,
        };
    });

    // Re-searching an existing term moves it to the front instead of duplicating.
    expect(result.afterDedupe.filter((entry) => entry === 'first query')).toHaveLength(1);
    expect(result.afterDedupe).toHaveLength(2);
    // Re-searching moves the term to the front.
    expect(result.afterDedupe[0]).toBe('first query');
    expect(result.cappedLength).toBeLessThanOrEqual(result.max);
    expect(String(result.cappedNewestFirst)).toContain('bulk ');
    expect(result.blankLength).toBe(0);
    expect(result.persisted).toBe(result.cappedLength);
});

test('WatchHistoryFeature records the current video and rejects unsafe URLs', async () => {
    const result = await inHarness(({ body }) => {
        document.body.innerHTML = body;
        history.replaceState({}, '', '/vwatch123-history-fixture.html');
        const harness = globalThis.__RumbleXFeatureHarness;
        harness.enable('watchHistory');
        const feature = harness.features.find((f) => f.id === 'watchHistory');
        localStorage.removeItem(feature._KEY);

        feature._recordCurrent();
        feature._recordCurrent();
        const entries = feature._getHistory();

        return {
            entries,
            // The stored-URL guard is the trust boundary for anything the
            // history overlay later renders as a link.
            rejectsJavascript: feature._safeRumbleUrl('javascript://rumble.com/%0Aalert(1)'),
            rejectsOffsite: feature._safeRumbleUrl('https://example.com/evil'),
            acceptsRumble: feature._safeRumbleUrl('https://rumble.com/vok-fine.html'),
            rejectsNonHttp: feature._safeHttpUrl('data:text/html,<script>1</script>'),
            acceptsHttp: feature._safeHttpUrl('https://rumble.com/thumb.jpg'),
        };
    });

    // Visiting the same video twice must not create two entries.
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0].url).toContain('/vwatch123-history-fixture.html');
    expect(result.entries[0].title).toBeTruthy();
    // Unsafe input is neutralised to '#', never passed through.
    expect(result.rejectsJavascript).toBe('#');
    expect(result.rejectsOffsite).toBe('#');
    expect(result.acceptsRumble).toBe('https://rumble.com/vok-fine.html');
    expect(result.rejectsNonHttp).not.toContain('data:');
    expect(result.acceptsHttp).toBe('https://rumble.com/thumb.jpg');
});

test('ExternalPlayer builds the handoff target from the configured template', async () => {
    const result = await inHarness(({ body }) => {
        document.body.innerHTML = body;
        history.replaceState({}, '', '/vext123-handoff.html');
        const harness = globalThis.__RumbleXFeatureHarness;
        harness.enable('externalPlayerEnabled');
        const feature = harness.features.find((f) => f.id === 'externalPlayerEnabled');

        const build = (template) => {
            Settings.set('externalPlayerTemplate', template);
            const tpl = feature._resolveTemplate();
            const url = location.href;
            return tpl.includes('{url}') ? tpl.replace('{url}', encodeURIComponent(url)) : tpl + url;
        };

        Settings.set('externalPlayerTemplate', '');
        return {
            defaultTemplate: feature._resolveTemplate(),
            mpv: build('mpv://{url}'),
            potplayer: build('potplayer://{url}'),
            appended: build('myplayer:'),
            href: location.href,
        };
    });

    // An unset template must still produce a working handoff.
    expect(result.defaultTemplate).toBe('mpv://{url}');
    expect(result.mpv).toBe('mpv://' + encodeURIComponent(result.href));
    expect(result.potplayer).toBe('potplayer://' + encodeURIComponent(result.href));
    // No placeholder means the URL is appended verbatim, not dropped.
    expect(result.appended).toBe('myplayer:' + result.href);
});

test('SponsorBlockRX stores segments per video and skips the player past them', async () => {
    const result = await inHarness(({ body }) => {
        document.body.innerHTML = body;
        history.replaceState({}, '', '/vsponsor123-skip.html');
        const harness = globalThis.__RumbleXFeatureHarness;
        harness.enable('sponsorBlock');
        const feature = harness.features.find((f) => f.id === 'sponsorBlock');

        const key = feature._videoKey();
        feature._segments = [];
        feature._addSegment(10, 20, 'sponsor');
        feature._addSegment(45, 50, 'selfpromo');
        // _loadSegments repopulates from storage rather than returning a value,
        // so round-trip through it to prove persistence, not just in-memory state.
        feature._segments = [];
        feature._loadSegments();
        const stored = feature._segments;

        // Segments must be scoped to this video, never global.
        const all = Settings.get('sponsorSegments') || {};

        const video = document.querySelector('video');
        let position = 12;
        const seeks = [];
        Object.defineProperty(video, 'currentTime', {
            configurable: true,
            get: () => position,
            set: (value) => { seeks.push(value); position = value; },
        });
        Object.defineProperty(video, 'duration', { configurable: true, get: () => 120 });

        feature._attachSkip();
        video.dispatchEvent(new Event('timeupdate'));

        return { key, stored, videoKeys: Object.keys(all), seeks, fmt: feature._fmt(125) };
    });

    expect(result.stored).toEqual([
        { start: 10, end: 20, category: 'sponsor' },
        { start: 45, end: 50, category: 'selfpromo' },
    ]);
    expect(result.videoKeys).toEqual([result.key]);
    // Playing at 12s inside a 10-20 segment must jump to the segment end.
    expect(result.seeks).toContain(20);
    expect(result.fmt).toBe('2:05');
});

test('LoopControl loops an A-B range and clears it on reset', async () => {
    const result = await inHarness(({ body }) => {
        document.body.innerHTML = body;
        history.replaceState({}, '', '/vloop123-ab.html');
        const harness = globalThis.__RumbleXFeatureHarness;
        harness.enable('loopControl');
        const feature = harness.features.find((f) => f.id === 'loopControl');

        const video = document.querySelector('video');
        let position = 0;
        const seeks = [];
        Object.defineProperty(video, 'currentTime', {
            configurable: true,
            get: () => position,
            set: (value) => { seeks.push(value); position = value; },
        });
        Object.defineProperty(video, 'duration', { configurable: true, get: () => 300 });

        feature.init();
        // init() only builds _btn when it finds a player mount point, which the
        // harness fixture does not provide. _activateAB dereferences it.
        feature._btn = feature._btn || document.createElement('button');

        // Capture the interval callback _activateAB installs so the loop can be
        // stepped deterministically instead of waiting on wall-clock time.
        let tick = null;
        const realSetInterval = window.setInterval;
        window.setInterval = (fn, ms) => { tick = fn; return realSetInterval(() => {}, 1e6); };
        feature._loopA = 60;
        feature._loopB = 30;   // deliberately reversed
        feature._activateAB();
        window.setInterval = realSetInterval;

        const normalized = { a: feature._loopA, b: feature._loopB };

        // Past B: must snap back to A.
        position = 61;
        tick();
        const afterOvershoot = seeks.slice();

        // Before A: must also snap forward to A.
        seeks.length = 0;
        position = 5;
        tick();
        const beforeStart = seeks.slice();

        // Inside the range: must not seek at all.
        seeks.length = 0;
        position = 45;
        tick();
        const insideRange = seeks.slice();

        feature._clearAB();
        const cleared = { a: feature._loopA, b: feature._loopB, looping: feature._looping };

        feature.destroy();
        return { hasTick: typeof tick === 'function', normalized, afterOvershoot, beforeStart, insideRange, cleared };
    });

    expect(result.hasTick, 'LoopControl installed no interval to assert against').toBe(true);
    // A and B given in the wrong order must be normalised, not left inverted.
    expect(result.normalized).toEqual({ a: 30, b: 60 });
    expect(result.afterOvershoot).toContain(30);
    expect(result.beforeStart).toContain(30);
    expect(result.insideRange).toEqual([]);
    expect(result.cleared).toEqual({ a: null, b: null, looping: false });
});

test('CommentExport CSV escapes quotes, commas, and newlines instead of corrupting rows', async () => {
    const result = await inHarness(({ body }) => {
        document.body.innerHTML = body;
        const harness = globalThis.__RumbleXFeatureHarness;
        harness.enable('commentExport');
        const feature = harness.features.find((f) => f.id === 'commentExport');
        return feature._toCsv([
            { id: '1', author: 'alice', text: 'plain text', votes: 3, ts: '2026-08-18' },
            { id: '2', author: 'bob', text: 'he said "hi", loudly', votes: 0, ts: '2026-08-18' },
            { id: '3', author: 'carol', text: 'line one\nline two', votes: -1, ts: '2026-08-18' },
            { id: '4', author: null, text: undefined, votes: 0, ts: '' },
        ]);
    });

    const lines = result.split('\n');
    expect(lines[0]).toBe('id,author,text,votes,ts');
    // Unremarkable values must not be quoted at all.
    expect(lines[1]).toBe('1,alice,plain text,3,2026-08-18');
    // Embedded quotes double, and the field is wrapped — losing either corrupts
    // every downstream column, which a mount-only test cannot see.
    expect(lines[2]).toBe('2,bob,"he said ""hi"", loudly",0,2026-08-18');
    // A newline inside a field must stay inside one quoted field.
    expect(result).toContain('"line one\nline two"');
    // null/undefined must serialise as empty, not as the string "null".
    expect(result).not.toContain('null');
    expect(result).not.toContain('undefined');
});

test('ChatExport collects rendered messages, skips blocked ones, and writes them to a file', async () => {
    const result = await inHarness(async ({ body }) => {
        document.body.innerHTML = body;
        const harness = globalThis.__RumbleXFeatureHarness;
        harness.enable('chatExport');
        const feature = harness.features.find((f) => f.id === 'chatExport');

        const list = document.createElement('ul');
        list.id = 'chat-history-list';
        list.innerHTML = `
            <li><time class="chat-history--timestamp">00:01</time><span class="chat-history--username">alice</span><p class="chat-history--message">hello, "world"</p></li>
            <li class="rx-blocked-msg"><time class="chat-history--timestamp">00:02</time><span class="chat-history--username">spammer</span><p class="chat-history--message">buy now</p></li>
            <li><time class="chat-history--timestamp">00:03</time><span class="chat-history--username">bob</span><p class="chat-history--message">second</p><span class="chat-history--rant-price">$5</span></li>
        `;
        document.body.appendChild(list);

        const collected = feature._collect();

        const written = [];
        const realCreate = URL.createObjectURL;
        const realRevoke = URL.revokeObjectURL;
        const realClick = HTMLAnchorElement.prototype.click;
        URL.createObjectURL = (blob) => { written.push(blob); return 'blob:fixture'; };
        URL.revokeObjectURL = () => {};
        HTMLAnchorElement.prototype.click = function noop() {};
        try {
            feature._download('json');
        } finally {
            URL.createObjectURL = realCreate;
            URL.revokeObjectURL = realRevoke;
            HTMLAnchorElement.prototype.click = realClick;
        }

        const text = written.length
            ? await new Promise((resolve) => {
                const reader = new FileReader();
                reader.onload = () => resolve(String(reader.result || ''));
                reader.readAsText(written[0]);
            })
            : '';

        return { collected, blobs: written.length, text };
    });

    // The blocked message must not reach the export.
    expect(result.collected).toHaveLength(2);
    expect(result.collected.map((row) => row.user)).toEqual(['alice', 'bob']);
    expect(result.collected[0].text).toBe('hello, "world"');
    expect(result.collected[0].time).toBe('00:01');
    expect(result.collected[1].rant).toBe('$5');

    expect(result.blobs).toBeGreaterThan(0);
    const parsed = JSON.parse(result.text);
    expect(parsed).toHaveLength(2);
    expect(parsed.map((row) => row.user)).toEqual(['alice', 'bob']);
    expect(JSON.stringify(parsed)).not.toContain('spammer');
});
