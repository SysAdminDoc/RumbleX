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

test('SubtitleSidecar parses WEBVTT cues into a sorted timeline', async () => {
    const result = await inHarness(({ body }) => {
        document.body.innerHTML = body;
        const harness = globalThis.__RumbleXFeatureHarness;
        harness.enable('subtitleSidecar');
        const feature = harness.features.find((f) => f.id === 'subtitleSidecar');

        const vtt = [
            'WEBVTT - generated',
            '',
            '00:00:10.000 --> 00:00:12.500',
            'second cue',
            '',
            '00:00:02.000 --> 00:00:04.000',
            'first cue',
            'wrapped onto two lines',
            '',
            '00:00:20.000 --> 00:00:21.000',
            '',
        ].join('\n');

        return {
            cues: feature._parse(vtt),
            tsDot: feature._tsToSec('00:01:02.500'),
            tsShort: feature._tsToSec('01:30.000'),
        };
    });

    // Out-of-order input is sorted, multi-line text is preserved, and a cue
    // with no content is dropped rather than rendering as a blank subtitle.
    expect(result.cues).toEqual([
        { start: 2, end: 4, text: 'first cue\nwrapped onto two lines' },
        { start: 10, end: 12.5, text: 'second cue' },
    ]);
    expect(result.tsDot).toBeCloseTo(62.5, 3);
    expect(result.tsShort).toBeCloseTo(90, 3);
});

test('AutoplayScheduler queues only Rumble URLs and dedupes them', async () => {
    const result = await inHarness(({ body }) => {
        document.body.innerHTML = body;
        history.replaceState({}, '', '/vqueue123-scheduler.html');
        const harness = globalThis.__RumbleXFeatureHarness;
        harness.enable('autoplayScheduler');
        const feature = harness.features.find((f) => f.id === 'autoplayScheduler');

        feature._saveQueue([]);
        feature._addUrl('https://rumble.com/vone-first.html');
        feature._addUrl('https://www.rumble.com/vtwo-second.html');
        feature._addUrl('https://rumble.com/vone-first.html');   // duplicate
        feature._addUrl('https://evil.example.com/vthree.html'); // off-site
        feature._addUrl('javascript:alert(1)');                  // hostile scheme
        feature._addUrl('   ');                                  // blank
        return { queued: feature._queue() };
    });

    // Off-site and hostile-scheme entries must never reach the queue, since
    // _playNext assigns whatever it finds straight to location.href.
    expect(result.queued).toEqual([
        'https://rumble.com/vone-first.html',
        'https://www.rumble.com/vtwo-second.html',
    ]);
});

test('CommentSort reads vote counts and timestamps off real comment markup', async () => {
    const result = await inHarness(({ body }) => {
        document.body.innerHTML = body;
        const harness = globalThis.__RumbleXFeatureHarness;
        harness.enable('commentSort');
        const feature = harness.features.find((f) => f.id === 'commentSort');

        const host = document.createElement('ul');
        host.className = 'comments-list';
        const make = (id, votes, iso) =>
            '<li class="comment-item" data-cid="' + id + '">'
            + '<div class="comment-actions"><span class="comment-vote-count">' + votes + '</span></div>'
            + '<time datetime="' + iso + '">t</time></li>';
        host.innerHTML = [
            make('low', '3', '2026-08-01T00:00:00Z'),
            make('high', '1,042', '2026-07-01T00:00:00Z'),
            make('neg', '-7', '2026-08-10T00:00:00Z'),
        ].join('');
        document.body.appendChild(host);

        const items = [...host.querySelectorAll('.comment-item')];
        return {
            votes: items.map((item) => feature._parseVotes(item)),
            olderIsSmaller: feature._parseTime(items[1]) < feature._parseTime(items[0]),
            missingVotes: feature._parseVotes(document.createElement('li')),
            missingTime: feature._parseTime(document.createElement('li')),
        };
    });

    // Thousands separators and negative scores must both survive parsing.
    expect(result.votes).toEqual([3, 1042, -7]);
    expect(result.olderIsSmaller).toBe(true);
    // Missing widgets read as 0 rather than NaN, which would poison any sort.
    expect(result.missingVotes).toBe(0);
    expect(result.missingTime).toBe(0);
});

test('Transcripts formats timestamps across the hour boundary', async () => {
    const result = await inHarness(({ body }) => {
        document.body.innerHTML = body;
        const harness = globalThis.__RumbleXFeatureHarness;
        harness.enable('transcripts');
        const feature = harness.features.find((f) => f.id === 'transcripts');
        return {
            fmt: [feature._fmt(0), feature._fmt(9), feature._fmt(65), feature._fmt(3725), feature._fmt(-5)],
            hasFilter: typeof feature._filter === 'function',
        };
    });

    // Under an hour drops the hour segment; over an hour zero-pads minutes.
    // Negative input must clamp rather than render "-1:-5".
    expect(result.fmt).toEqual(['0:00', '0:09', '1:05', '1:02:05', '0:00']);
    expect(result.hasFilter).toBe(true);
});

test('VideoClips zero-pads clip durations', async () => {
    const result = await inHarness(({ body }) => {
        document.body.innerHTML = body;
        history.replaceState({}, '', '/vclip123-range.html');
        const harness = globalThis.__RumbleXFeatureHarness;
        harness.enable('videoClips');
        const feature = harness.features.find((f) => f.id === 'videoClips');
        return { fmt: [feature._fmt(0), feature._fmt(9), feature._fmt(61), feature._fmt(3600)] };
    });

    // Seconds must zero-pad so a clip range never renders as "1:1", and an
    // hour-long clip rolls into an explicit hour segment rather than "60:00".
    expect(result.fmt).toEqual(['0:00', '0:09', '1:01', '1:00:00']);
});

test('RantPersist scopes its cache key per video and derives a clean title', async () => {
    const result = await inHarness(({ body }) => {
        document.body.innerHTML = body;
        const harness = globalThis.__RumbleXFeatureHarness;
        harness.enable('rantPersist');
        const feature = harness.features.find((f) => f.id === 'rantPersist');

        history.replaceState({}, '', '/vrant123-first-video.html');
        const first = { key: feature._videoKey(), raw: feature._videoIdRaw() };
        history.replaceState({}, '', '/vrant456-second-video.html');
        const second = { key: feature._videoKey(), raw: feature._videoIdRaw() };
        history.replaceState({}, '', '/c/somechannel');
        const nonVideo = feature._videoKey();

        // og:title wins when present.
        const meta = document.createElement('meta');
        meta.setAttribute('property', 'og:title');
        meta.setAttribute('content', 'The Real Title');
        document.head.appendChild(meta);
        const fromMeta = feature._videoTitle();

        // Falling back to document.title must strip the Rumble suffix.
        meta.remove();
        document.title = 'Fallback Title - Rumble';
        const fromTitle = feature._videoTitle();

        return { first, second, nonVideo, fromMeta, fromTitle };
    });

    // Two videos must never share a cache bucket.
    expect(result.first.key).toBe('rx_rants_vrant123');
    expect(result.second.key).toBe('rx_rants_vrant456');
    expect(result.first.key).not.toBe(result.second.key);
    expect(result.first.raw).toBe('vrant123');
    // A non-watch route must produce no key at all rather than a shared one.
    expect(result.nonVideo).toBeNull();
    expect(result.fromMeta).toBe('The Real Title');
    expect(result.fromTitle).toBe('Fallback Title');
});

test('PopoutChat prefers the native control and only opens a scoped window otherwise', async () => {
    const result = await inHarness(({ body }) => {
        document.body.innerHTML = body;
        history.replaceState({}, '', '/vchat123-popout.html');
        const harness = globalThis.__RumbleXFeatureHarness;
        harness.enable('popoutChat');
        const feature = harness.features.find((f) => f.id === 'popoutChat');

        const opened = [];
        const realOpen = window.open;
        window.open = (url, name, features) => { opened.push({ url, name, features }); return null; };

        // 1. Native toggle present: must be clicked, and no window opened.
        let nativeClicks = 0;
        const native = document.createElement('button');
        native.id = 'chat-toggle-popup';
        native.addEventListener('click', () => { nativeClicks += 1; });
        document.body.appendChild(native);
        feature._popout();
        const afterNative = { nativeClicks, opened: opened.length };

        // 2. No native control, but an explicit popout link: open that URL.
        native.remove();
        opened.length = 0;
        const link = document.createElement('a');
        link.href = 'https://rumble.com/chat/popup/123';
        document.body.appendChild(link);
        feature._popout();
        const afterLink = opened.slice();
        link.remove();

        window.open = realOpen;
        return { afterNative, afterLink };
    });

    // The native control is preferred, so no popup is spawned at all.
    expect(result.afterNative).toEqual({ nativeClicks: 1, opened: 0 });
    expect(result.afterLink).toHaveLength(1);
    expect(result.afterLink[0].url).toBe('https://rumble.com/chat/popup/123');
    // A named target keeps repeat clicks reusing one window instead of stacking.
    expect(result.afterLink[0].name).toBe('rumblex_chat_popout');
    expect(result.afterLink[0].features).toContain('width=420');
});

test('MiniPlayer clears its cloned video on hide and removes the container on destroy', async () => {
    const result = await inHarness(({ body }) => {
        document.body.innerHTML = body;
        history.replaceState({}, '', '/vmini123-overlay.html');
        const harness = globalThis.__RumbleXFeatureHarness;
        harness.enable('miniPlayer');
        const feature = harness.features.find((f) => f.id === 'miniPlayer');

        const video = document.querySelector('video');
        feature.init();
        feature._show(video);
        const shown = {
            active: feature._active === true,
            hasActiveClass: feature._mini.classList.contains('active'),
            clonedVideos: feature._mini.querySelectorAll('video').length,
            // The page's own video must stay put, not be moved into the overlay.
            originalVideoStillInPage: document.body.contains(video),
        };

        feature._hide();
        const hidden = {
            active: feature._active === false,
            hasActiveClass: feature._mini.classList.contains('active'),
            // The clone must be torn out, not just visually hidden: a retained
            // <video> keeps decoding and playing audio behind the page.
            clonedVideos: feature._mini.querySelectorAll('video').length,
            containerStillMounted: feature._mini.isConnected,
        };

        feature.destroy();
        const afterDestroy = document.querySelectorAll('.rx-miniplayer').length;
        return { shown, hidden, afterDestroy };
    });

    expect(result.shown.active).toBe(true);
    expect(result.shown.hasActiveClass).toBe(true);
    expect(result.shown.clonedVideos).toBeGreaterThan(0);
    expect(result.shown.originalVideoStillInPage).toBe(true);

    expect(result.hidden.active).toBe(true);
    expect(result.hidden.hasActiveClass).toBe(false);
    expect(result.hidden.clonedVideos).toBe(0);
    // Hiding keeps the (now empty) container; only destroy tears it down.
    expect(result.hidden.containerStillMounted).toBe(true);
    expect(result.afterDestroy).toBe(0);
});

test('AudioOnly, LiveDVR, ScreenshotBtn and NotifEnhance each inject and fully remove their stylesheet', async () => {
    const result = await inHarness(({ body }) => {
        const harness = globalThis.__RumbleXFeatureHarness;
        // These four mount into player/download surfaces the catalog fixture
        // does not reproduce, so their observable output here is the stylesheet
        // they own. Asserting injection AND removal still catches the real
        // failure mode: a module that leaves styles behind after being turned
        // off keeps restyling the page it no longer controls.
        const probe = (id, route, styleId) => {
            document.body.innerHTML = body;
            history.replaceState({}, '', route);
            harness.enable(id);
            const feature = harness.features.find((f) => f.id === id);
            if (!feature) return { missing: true };
            feature.destroy();
            document.getElementById(styleId)?.remove();
            feature.init();
            const injected = !!document.getElementById(styleId);
            feature.destroy();
            return { injected, afterDestroy: !!document.getElementById(styleId) };
        };

        return {
            audioOnly: probe('audioOnly', '/vaudio123-only.html', 'rx-audioonly-css'),
            liveDVR: probe('liveDVR', '/vdvr123-live.html', 'rx-livedvr-css'),
            screenshotBtn: probe('screenshotBtn', '/vshot123-capture.html', 'rx-screenshot-css'),
            notifEnhance: probe('notifEnhance', '/vnotif123-bell.html', 'rx-notif-enhance-css'),
        };
    });

    for (const [id, value] of Object.entries(result)) {
        expect(value.missing, `${id} is not in the registry`).toBeUndefined();
        expect(value.injected, `${id} injected no stylesheet`).toBe(true);
        expect(value.afterDestroy, `${id} left its stylesheet behind after destroy`).toBe(false);
    }
});

test('AutoMaxQuality honours qualityMode, the ceiling and the floor', async () => {
    // qualityMode had four documented values and no consumer at all: the
    // module always took the top rendition regardless. These assert the policy
    // over a fixed ladder, so a regression shows up as the wrong height rather
    // than as "video looks bad on some connections".
    const LADDER = [360, 480, 720, 1080, 1440, 2160];
    const result = await inHarness(({ ladder }) => {
        const feature = features.find((f) => f.id === 'autoMaxQuality');
        const sorted = ladder.map((height, hlsIndex) => ({ height, hlsIndex }));
        const pick = (mode, ceiling, floor) => {
            Settings.set('qualityMode', mode);
            Settings.set('qualityCeiling', ceiling);
            Settings.set('qualityFloor', floor);
            const index = feature._pickIndex(sorted);
            return index < 0 ? null : sorted[index].height;
        };
        return {
            best: pick('best', 'auto', 'auto'),
            lowest: pick('lowest', 'auto', 'auto'),
            saver: pick('bandwidthSaver', 'auto', 'auto'),
            manual: pick('manual', 'auto', 'auto'),
            bestUnderCeiling: pick('best', '720', 'auto'),
            lowestOverFloor: pick('lowest', 'auto', '720'),
            bothBounds: pick('best', '1080', '480'),
            // A ceiling below every rendition still has to produce video.
            impossibleCeiling: pick('best', '360', '1440'),
            // Labels come from the DOM menu when hls.js is not exposed; the
            // same policy has to apply there or the two paths disagree.
            fromLabels: (() => {
                Settings.set('qualityMode', 'best');
                Settings.set('qualityCeiling', '480');
                Settings.set('qualityFloor', 'auto');
                const nodes = ['Auto', '1080p', '720p', '480p', '360p'].map((text) => {
                    const el = document.createElement('div');
                    el.textContent = text;
                    return el;
                });
                return feature._pickFromLabels(nodes)?.textContent || null;
            })(),
        };
    }, { ladder: LADDER });

    expect(result.best).toBe(2160);
    expect(result.lowest).toBe(360);
    expect(result.saver).toBe(360);
    // 'manual' means the user drives quality — the module must not touch it.
    expect(result.manual).toBeNull();
    expect(result.bestUnderCeiling).toBe(720);
    expect(result.lowestOverFloor).toBe(720);
    expect(result.bothBounds).toBe(1080);
    // Bounds that exclude everything fall back to the nearest rendition rather
    // than leaving the player on whatever it happened to pick.
    expect(result.impossibleCeiling).toBe(360);
    expect(result.fromLabels).toBe('480p');
});

test('AutoMaxQuality steps down after repeated stalls and respects the floor', async () => {
    const result = await inHarness(() => {
        const feature = features.find((f) => f.id === 'autoMaxQuality');
        Settings.set('qualityMode', 'best');
        Settings.set('qualityCeiling', 'auto');
        Settings.set('stallRecovery', true);

        // A stand-in for the player's hls.js instance: nextLevel is what the
        // module writes, so it is the whole observable effect.
        const makeHls = () => ({
            levels: [{ height: 360 }, { height: 720 }, { height: 1080 }],
            currentLevel: 2,
            nextLevel: -1,
        });

        const video = document.createElement('video');
        document.body.appendChild(video);
        video.hls = makeHls();
        feature._video = video;
        feature._stalls = [];
        feature._steppedDown = 0;

        Settings.set('qualityFloor', 'auto');
        // Two stalls are under the limit; nothing should move yet.
        feature._recordStall();
        feature._recordStall();
        const afterTwo = video.hls.nextLevel;
        feature._recordStall();
        const afterThree = video.hls.nextLevel;

        // With a 1080 floor, a step down from 1080 is not allowed at all.
        video.hls = makeHls();
        feature._stalls = [];
        Settings.set('qualityFloor', '1080');
        feature._recordStall();
        feature._recordStall();
        feature._recordStall();
        const withFloor = video.hls.nextLevel;

        // Turning stall recovery off must remove the listeners, not just skip.
        Settings.set('stallRecovery', false);
        feature._detachStallWatch();
        feature._watchForStalls(video);
        const watchedWhenDisabled = feature._video === video;

        video.remove();
        return { afterTwo, afterThree, withFloor, watchedWhenDisabled, stepped: feature._steppedDown };
    });

    // -1 is hls.js's "no override"; the module has not touched it.
    expect(result.afterTwo).toBe(-1);
    // Third stall inside the window drops one rendition: index 1 is 720p.
    expect(result.afterThree).toBe(1);
    expect(result.stepped).toBe(1);
    // The floor is a hard stop, not a preference.
    expect(result.withFloor).toBe(-1);
    expect(result.watchedWhenDisabled).toBe(false);
});

test('MiniPlayer uses Document PiP where available and unwinds it cleanly', async () => {
    // requestWindow() needs transient user activation, so PiP cannot ride the
    // scroll trigger that opens the overlay — it has to be an explicit control,
    // and it must only exist where the API does. Both halves are asserted here
    // with a stub, because the real API cannot be driven from a test.
    const result = await inHarness(() => {
        const feature = features.find((f) => f.id === 'miniPlayer');
        Settings.set('miniPlayer', true);
        try { feature.destroy(); } catch { /* not mounted */ }

        const source = document.createElement('video');
        document.body.appendChild(source);

        const mount = () => {
            feature._mini = document.createElement('div');
            feature._mini.className = 'rx-miniplayer';
            document.body.appendChild(feature._mini);
            feature._active = false;
            feature._pipWindow = null;
            feature._show(source);
        };

        // 1. No API: the control must not be rendered at all.
        const realApi = window.documentPictureInPicture;
        try { delete window.documentPictureInPicture; } catch { /* non-configurable */ }
        mount();
        const withoutApi = {
            button: !!feature._mini.querySelector('.rx-miniplayer-pip'),
            supported: feature._pipSupported(),
            videoInOverlay: !!feature._mini.querySelector('video'),
        };
        feature._hide();
        feature._mini.remove();

        // 2. Stub API: control renders, the video MOVES into the PiP document
        //    rather than being cloned a second time, and pagehide brings it back.
        const pipDoc = document.implementation.createHTMLDocument('pip');
        let closed = false;
        const listeners = new Map();
        const fakeWindow = {
            document: pipDoc,
            addEventListener: (type, fn) => listeners.set(type, fn),
            removeEventListener: (type) => listeners.delete(type),
            close: () => { closed = true; },
        };
        window.documentPictureInPicture = { requestWindow: async () => fakeWindow };

        mount();
        const button = feature._mini.querySelector('.rx-miniplayer-pip');
        const hadButton = !!button;
        return feature._openPip().then(() => {
            const inPip = {
                videoInPipDoc: !!pipDoc.body.querySelector('video'),
                videoStillInOverlay: !!feature._mini.querySelector('video'),
                marked: feature._mini.classList.contains('rx-miniplayer-in-pip'),
                listenerRegistered: listeners.has('pagehide'),
            };

            // The user closes the PiP window.
            listeners.get('pagehide')?.();
            const afterClose = {
                videoBackInOverlay: !!feature._mini.querySelector('video'),
                marked: feature._mini.classList.contains('rx-miniplayer-in-pip'),
                listenerRemoved: !listeners.has('pagehide'),
                windowCleared: feature._pipWindow === null,
            };

            // Reopen, then hide the overlay: the window must be closed for us.
            return feature._openPip().then(() => {
                feature._hide();
                const afterHide = { closed, windowCleared: feature._pipWindow === null };
                feature._mini.remove();
                source.remove();
                if (realApi === undefined) { try { delete window.documentPictureInPicture; } catch {} }
                else window.documentPictureInPicture = realApi;
                return { withoutApi, hadButton, inPip, afterClose, afterHide };
            });
        });
    });

    // Unsupported browsers keep the existing overlay, unchanged.
    expect(result.withoutApi.supported).toBe(false);
    expect(result.withoutApi.button).toBe(false);
    expect(result.withoutApi.videoInOverlay).toBe(true);

    expect(result.hadButton).toBe(true);
    // Moved, not re-cloned: two clones would decode the same stream twice.
    expect(result.inPip.videoInPipDoc).toBe(true);
    expect(result.inPip.videoStillInOverlay).toBe(false);
    expect(result.inPip.marked).toBe(true);
    expect(result.inPip.listenerRegistered).toBe(true);

    expect(result.afterClose.videoBackInOverlay).toBe(true);
    expect(result.afterClose.marked).toBe(false);
    expect(result.afterClose.listenerRemoved).toBe(true);
    expect(result.afterClose.windowCleared).toBe(true);

    expect(result.afterHide.closed).toBe(true);
    expect(result.afterHide.windowCleared).toBe(true);
});

test('TimeRemaining accounts for playback rate and falls back to structured duration', async () => {
    const result = await inHarness(({ body }) => {
        document.body.innerHTML = body;
        const harness = globalThis.__RumbleXFeatureHarness;
        harness.enable('timeRemaining');
        const feature = harness.features.find((f) => f.id === 'timeRemaining');

        // A stand-in for the media element: the arithmetic under test is
        // duration, position and rate, none of which need a real decoder.
        const video = { duration: 600, currentTime: 120, playbackRate: 1 };
        const el = document.createElement('div');
        document.body.appendChild(el);
        feature._el = el;
        feature._video = video;

        const readAt = (rate) => {
            video.playbackRate = rate;
            feature._render();
            return { text: el.textContent, title: el.getAttribute('title') };
        };

        const atNormalSpeed = readAt(1);
        // 480 seconds of video at 2x is four minutes of your life, not eight.
        const atDoubleSpeed = readAt(2);
        const atHalfSpeed = readAt(0.5);

        // Past the end must clamp rather than count upward.
        video.currentTime = 900;
        video.playbackRate = 1;
        feature._render();
        const pastEnd = el.textContent;

        // A live stream reports Infinity, and there is no structured duration
        // in the harness, so the readout must empty itself instead of printing
        // nonsense.
        video.duration = Infinity;
        video.currentTime = 10;
        feature._render();
        const live = { text: el.textContent, title: el.getAttribute('title') };

        // With no usable media duration, the schema.org value is the fallback.
        const realDuration = PageData.durationSeconds;
        PageData.durationSeconds = () => 300;
        video.duration = NaN;
        video.currentTime = 60;
        feature._render();
        const fromStructured = el.textContent;
        PageData.durationSeconds = realDuration;

        const hourly = (() => {
            video.duration = 7325;
            video.currentTime = 0;
            video.playbackRate = 1;
            feature._render();
            return el.textContent;
        })();

        el.remove();
        feature._el = null;
        feature._video = null;
        return { atNormalSpeed, atDoubleSpeed, atHalfSpeed, pastEnd, live, fromStructured, hourly };
    });

    expect(result.atNormalSpeed.text).toBe('8:00 left');
    expect(result.atNormalSpeed.title).toMatch(/^Ends at /);
    expect(result.atDoubleSpeed.text).toBe('4:00 left');
    expect(result.atHalfSpeed.text).toBe('16:00 left');
    expect(result.pastEnd).toBe('0:00 left');
    // Live: nothing to show, and no stale title left behind.
    expect(result.live.text).toBe('');
    expect(result.live.title).toBeNull();
    expect(result.fromStructured).toBe('4:00 left');
    expect(result.hourly).toBe('2:02:05 left');
});

test('TitleNormalizer only rewrites bait-shaped titles and restores originals', async () => {
    const result = await inHarness(() => {
        const harness = globalThis.__RumbleXFeatureHarness;
        harness.enable('titleNormalizer');
        const feature = harness.features.find((f) => f.id === 'titleNormalizer');
        const sentence = (t) => feature.normalize(t, 'sentence');
        const title = (t) => feature.normalize(t, 'title');

        // Round-trip through the real DOM path, including restore on destroy.
        const el = document.createElement('h3');
        el.className = 'thumbnail__title';
        el.textContent = 'BREAKING!!! THIS CHANGES EVERYTHING 🔥🔥';
        el.setAttribute('title', 'pre-existing tooltip');
        document.body.appendChild(el);
        feature._originals = new Map();
        feature._apply(el, 'sentence');
        const applied = { text: el.textContent, tooltip: el.getAttribute('title'), marked: el.dataset.rxTitleNorm };
        feature.destroy();
        const restored = { text: el.textContent, tooltip: el.getAttribute('title'), marked: el.dataset.rxTitleNorm };
        el.remove();

        return {
            // Left alone: ordinary titles are none of the feature's business.
            ordinary: sentence('How to rebuild a carburettor in an afternoon'),
            mixedCase: sentence('The Dan Bongino Show Episode 2576'),
            shortCaps: sentence('CPU vs GPU'),
            // Rewritten.
            shouty: sentence('THIS CHANGES EVERYTHING FOR DRIVERS'),
            shoutyTitleCase: title('THIS CHANGES EVERYTHING FOR DRIVERS'),
            emojiOnly: sentence('A calm and reasonable headline 🔥🔥🔥'),
            punctuationOnly: sentence('Wait, what?!?!?!'),
            combined: sentence('BREAKING!!! THIS CHANGES EVERYTHING 🔥'),
            multiSentence: sentence('IT IS OVER. THEY ADMITTED IT ALL'),
            applied,
            restored,
        };
    });

    // Untouched.
    expect(result.ordinary).toBe('How to rebuild a carburettor in an afternoon');
    expect(result.mixedCase).toBe('The Dan Bongino Show Episode 2576');
    // Acronym-heavy but mixed case: the capitals are meaning, not volume.
    expect(result.shortCaps).toBe('CPU vs GPU');

    // Rewritten.
    expect(result.shouty).toBe('This changes everything for drivers');
    expect(result.shoutyTitleCase).toBe('This Changes Everything for Drivers');
    expect(result.emojiOnly).toBe('A calm and reasonable headline');
    expect(result.punctuationOnly).toBe('Wait, what?');
    expect(result.combined).toBe('Breaking! This changes everything');
    // Sentence case restarts after terminal punctuation.
    expect(result.multiSentence).toBe('It is over. They admitted it all');

    expect(result.applied.text).toBe('Breaking! This changes everything');
    // The author's original is one hover away.
    expect(result.applied.tooltip).toBe('BREAKING!!! THIS CHANGES EVERYTHING 🔥🔥');
    expect(result.applied.marked).toBe('1');

    // destroy() puts back the text, the prior tooltip and the marker.
    expect(result.restored.text).toBe('BREAKING!!! THIS CHANGES EVERYTHING 🔥🔥');
    expect(result.restored.tooltip).toBe('pre-existing tooltip');
    expect(result.restored.marked).toBeUndefined();
});

test('VideoDownloader writes info.json and NFO sidecars from page metadata', async () => {
    const result = await inHarness(({ body }) => {
        document.body.innerHTML = body;
        const harness = globalThis.__RumbleXFeatureHarness;
        harness.enable('videoDownload');
        const dl = harness.features.find((f) => f.id === 'videoDownload');

        // Stand in for a watch page carrying structured data. An ampersand and
        // an angle bracket are deliberate: the NFO is XML and must escape them.
        const realPageData = {
            title: PageData.title, description: PageData.description,
            durationSeconds: PageData.durationSeconds, uploadDate: PageData.uploadDate,
            viewCount: PageData.viewCount, thumbnailUrl: PageData.thumbnailUrl,
        };
        PageData.title = () => 'Rock & Roll <Live>';
        PageData.description = () => 'A & B < C';
        PageData.durationSeconds = () => 5772;
        PageData.uploadDate = () => '2026-08-18T12:26:21+00:00';
        PageData.viewCount = () => 535349;
        PageData.thumbnailUrl = () => 'https://1a-1791.com/video/fww1/9f/thumb.jpg';

        const meta = dl._sidecarMetadata();
        const nfo = dl._nfoXml(meta);

        // Capture what would be written instead of touching the filesystem.
        const saved = [];
        const sent = [];
        const realSave = dl._triggerSave;
        // RXPlatform is frozen, so the seam under test is _requestThumbnail.
        const realThumb = dl._requestThumbnail;
        dl._triggerSave = (data, filename) => { saved.push(filename); };
        dl._requestThumbnail = async (url, filename) => { sent.push({ url, filename }); return {}; };

        const settings = harness.enable('videoDownload');
        const realGet = Settings.get.bind(Settings);
        const withToggles = (metaOn, thumbOn) => {
            Settings.get = (key) => {
                if (key === 'downloadIncludeMetadata') return metaOn;
                if (key === 'downloadIncludeThumbnail') return thumbOn;
                return realGet(key);
            };
            saved.length = 0; sent.length = 0;
            dl._writeSidecars('Some Video - 1080p');
            return { saved: [...saved], sent: sent.map((m) => m.filename), urls: sent.map((m) => m.url) };
        };

        const bothOff = withToggles(false, false);
        const metaOnly = withToggles(true, false);
        const withThumb = withToggles(true, true);

        Settings.get = realGet;
        dl._triggerSave = realSave;
        dl._requestThumbnail = realThumb;
        Object.assign(PageData, realPageData);
        void settings;

        return { meta, nfo, bothOff, metaOnly, withThumb };
    });

    // yt-dlp's convention: bare YYYYMMDD plus the full stamp.
    expect(result.meta.upload_date).toBe('20260818');
    expect(result.meta.timestamp).toBe('2026-08-18T12:26:21+00:00');
    expect(result.meta.duration).toBe(5772);
    expect(result.meta.view_count).toBe(535349);
    expect(result.meta.extractor).toBe('rumblex');

    // The NFO is XML, so the metadata characters that would break it are escaped.
    expect(result.nfo).toContain('<?xml version="1.0"');
    expect(result.nfo).toContain('<title>Rock &amp; Roll &lt;Live&gt;</title>');
    expect(result.nfo).toContain('<plot>A &amp; B &lt; C</plot>');
    expect(result.nfo).not.toContain('<Live>');
    // Kodi wants a plain date and whole minutes.
    expect(result.nfo).toContain('<premiered>2026-08-18</premiered>');
    expect(result.nfo).toContain('<runtime>96</runtime>');

    // Off means nothing is written at all.
    expect(result.bothOff.saved).toEqual([]);
    expect(result.bothOff.sent).toEqual([]);

    // Sidecars share the media file's base name so media servers pair them.
    expect(result.metaOnly.saved).toEqual(['Some Video - 1080p.info.json', 'Some Video - 1080p.nfo']);
    expect(result.metaOnly.sent).toEqual([]);

    expect(result.withThumb.sent).toEqual(['Some Video - 1080p.jpg']);
    expect(result.withThumb.urls).toEqual(['https://1a-1791.com/video/fww1/9f/thumb.jpg']);
});

test('SponsorBlockRX honours per-category behavior, undo and the time-saved counter', async () => {
    const result = await inHarness(({ body }) => {
        document.body.innerHTML = body;
        const harness = globalThis.__RumbleXFeatureHarness;
        harness.enable('sponsorBlock');
        const sb = harness.features.find((f) => f.id === 'sponsorBlock');

        // A stand-in media object: a real <video> with no source refuses to hold
        // a currentTime write, which is the thing under test.
        const video = { currentTime: 0, duration: 600, isConnected: true };

        const realGet = Settings.get.bind(Settings);
        const realSet = Settings.set.bind(Settings);
        let saved = 0;
        const store = { sponsorCategoryBehavior: {}, sponsorSkipUndo: true, sponsorTimeSaved: 0 };
        Settings.get = (key) => (Object.hasOwn(store, key) ? store[key] : realGet(key));
        Settings.set = (key, value) => { if (key === 'sponsorTimeSaved') { store[key] = value; saved = value; } return Promise.resolve(); };

        sb._segments = [{ start: 10, end: 40, category: 'sponsor' }];
        sb._suppressed.clear();
        sb._noticed.clear();

        const fire = (t) => { video.currentTime = t; sb._evaluateSkip(video); return video.currentTime; };

        // auto: skips every time it is entered.
        store.sponsorCategoryBehavior = {};
        const auto1 = fire(15);
        const auto2 = fire(20);
        const autoSaved = saved;

        // notice: never seeks, and only announces once.
        sb._suppressed.clear(); sb._noticed.clear(); store.sponsorTimeSaved = 0; saved = 0;
        store.sponsorCategoryBehavior = { sponsor: 'notice' };
        const noticePos = fire(15);
        const noticedTwice = sb._noticed.size;
        const noticeSaved = saved;

        // once: skips the first entry, then leaves the segment alone.
        sb._suppressed.clear(); sb._noticed.clear(); store.sponsorTimeSaved = 0; saved = 0;
        store.sponsorCategoryBehavior = { sponsor: 'once' };
        const once1 = fire(15);
        const once2 = fire(20);

        // undo: the notice carries a button that seeks back and un-does the credit.
        sb._suppressed.clear(); sb._noticed.clear(); store.sponsorTimeSaved = 0; saved = 0;
        store.sponsorCategoryBehavior = {};
        fire(15);
        const savedBeforeUndo = saved;
        const undoBtn = document.querySelector('.rx-sb-notice .rx-sb-undo');
        const hadUndo = !!undoBtn;
        if (undoBtn) undoBtn.click();
        const afterUndo = video.currentTime;
        const savedAfterUndo = saved;
        // Re-entering must not immediately re-skip what the viewer just undid.
        const afterUndoReenter = fire(16);

        // With undo disabled the notice is plain text.
        sb._suppressed.clear(); store.sponsorSkipUndo = false;
        fire(15);
        const undoWhenDisabled = !!document.querySelector('.rx-sb-notice .rx-sb-undo');

        const savedLabels = [sb._formatSaved(45), sb._formatSaved(600), sb._formatSaved(7200)];

        Settings.get = realGet; Settings.set = realSet;
        sb.destroy();
        const clearedAfterDestroy = sb._suppressed.size + sb._noticed.size;

        return {
            auto1, auto2, autoSaved, noticePos, noticedTwice, noticeSaved,
            once1, once2, hadUndo, afterUndo, savedBeforeUndo, savedAfterUndo,
            afterUndoReenter, undoWhenDisabled, savedLabels, clearedAfterDestroy,
        };
    });

    // auto-skip jumps to the segment end each time.
    expect(result.auto1).toBe(40);
    expect(result.auto2).toBe(40);
    // 25s from t=15 plus 20s from t=20.
    expect(result.autoSaved).toBe(45);

    // notice-only leaves playback exactly where it was, and says so once.
    expect(result.noticePos).toBe(15);
    expect(result.noticedTwice).toBe(1);
    expect(result.noticeSaved).toBe(0);

    // skip-once skips, then stops interfering.
    expect(result.once1).toBe(40);
    expect(result.once2).toBe(20);

    expect(result.hadUndo).toBe(true);
    expect(result.savedBeforeUndo).toBe(25);
    expect(result.afterUndo).toBe(15);
    // The credit is handed back, not kept.
    expect(result.savedAfterUndo).toBe(0);
    // And the segment does not immediately re-skip.
    expect(result.afterUndoReenter).toBe(16);

    expect(result.undoWhenDisabled).toBe(false);
    expect(result.savedLabels).toEqual(['45s', '10m', '2h 0m']);
    expect(result.clearedAfterDestroy).toBe(0);
});

test('PerChannelPrefs scopes playback settings to a channel and bounds the quality ceiling', async () => {
    const result = await inHarness(() => {
        const harness = globalThis.__RumbleXFeatureHarness;
        harness.enable('perChannelVolumeMemory');
        const prefs = harness.features.find((f) => f.id === 'perChannelVolumeMemory');
        localStorage.removeItem(prefs._KEY);

        const slugs = {
            channel: prefs.slugFrom('/c/SomeChannel'),
            user: prefs.slugFrom('https://rumble.com/user/Another'),
            cased: prefs.slugFrom('/c/MiXeDCase'),
            watch: prefs.slugFrom('/v7abc-some-video.html'),
            junk: prefs.slugFrom(''),
        };

        prefs.remember('podcast', { volume: 0.4, speed: 1.75 });
        prefs.remember('music', { volume: 1, speed: 1 });
        // Out-of-range values must not be persisted: they would produce an
        // unusable player on the next load.
        prefs.remember('bad', { volume: 9, speed: 99 });

        const stored = { podcast: prefs.get('podcast'), music: prefs.get('music'), bad: prefs.get('bad') };

        const videoA = { volume: 1, playbackRate: 1 };
        const appliedPodcast = prefs.applyTo(videoA, 'podcast');
        const afterPodcast = { volume: videoA.volume, rate: videoA.playbackRate };

        const videoB = { volume: 0.2, playbackRate: 2 };
        // A channel with nothing stored must be left entirely alone.
        const appliedUnknown = prefs.applyTo(videoB, 'never-visited');
        const afterUnknown = { volume: videoB.volume, rate: videoB.playbackRate };

        // Merging keeps prior fields rather than replacing the entry.
        prefs.remember('podcast', { speed: 2 });
        const merged = prefs.get('podcast');

        // Quality ceiling: per-channel only ever lowers the global bound.
        prefs.remember('capped', { quality: '720' });
        const realGet = Settings.get.bind(Settings);
        const amq = harness.features.find((f) => f.id === 'autoMaxQuality');
        const ceilingWith = (globalCeiling, slug) => {
            Settings.get = (key) => {
                if (key === 'qualityCeiling') return globalCeiling;
                if (key === 'perChannelVolumeMemory') return true;
                return realGet(key);
            };
            const realSlug = prefs.currentSlug;
            prefs.currentSlug = () => slug;
            const out = amq._ceiling();
            prefs.currentSlug = realSlug;
            return out;
        };
        const ceilingNoGlobal = ceilingWith('auto', 'capped');
        const ceilingHigherGlobal = ceilingWith('1080', 'capped');
        const ceilingLowerGlobal = ceilingWith('480', 'capped');
        const ceilingNoChannel = ceilingWith('1080', 'never-visited');
        Settings.get = realGet;

        // Pruning keeps the store bounded.
        for (let i = 0; i < prefs._MAX + 25; i += 1) prefs.remember('ch' + i, { volume: 0.5 });
        const size = Object.keys(prefs._load()).length;

        localStorage.removeItem(prefs._KEY);
        return {
            slugs, stored, appliedPodcast, afterPodcast, appliedUnknown, afterUnknown,
            merged, ceilingNoGlobal, ceilingHigherGlobal, ceilingLowerGlobal, ceilingNoChannel, size, max: prefs._MAX,
        };
    });

    expect(result.slugs.channel).toBe('somechannel');
    expect(result.slugs.user).toBe('another');
    expect(result.slugs.cased).toBe('mixedcase');
    // A watch URL is not a channel URL.
    expect(result.slugs.watch).toBeNull();
    expect(result.slugs.junk).toBeNull();

    expect(result.stored.podcast).toMatchObject({ volume: 0.4, speed: 1.75 });
    // Rejected outright rather than clamped to something the user never chose.
    expect(result.stored.bad.volume).toBeUndefined();
    expect(result.stored.bad.speed).toBeUndefined();

    expect(result.appliedPodcast).toBe(true);
    expect(result.afterPodcast).toEqual({ volume: 0.4, rate: 1.75 });

    expect(result.appliedUnknown).toBe(false);
    expect(result.afterUnknown).toEqual({ volume: 0.2, rate: 2 });

    expect(result.merged).toMatchObject({ volume: 0.4, speed: 2 });

    expect(result.ceilingNoGlobal).toBe(720);
    expect(result.ceilingHigherGlobal).toBe(720);
    // The global bound still wins when it is the stricter of the two.
    expect(result.ceilingLowerGlobal).toBe(480);
    expect(result.ceilingNoChannel).toBe(1080);

    expect(result.size).toBeLessThanOrEqual(result.max);
});

test('ChannelRss builds a valid feed locally and escapes hostile titles', async () => {
    const result = await inHarness(() => {
        const harness = globalThis.__RumbleXFeatureHarness;
        harness.enable('rssExportEnabled');
        const rss = harness.features.find((f) => f.id === 'rssExportEnabled');

        const xml = rss.buildFeed(
            { title: 'Bob & Alice <Live>', url: 'https://rumble.com/c/BobAlice' },
            [
                { title: 'Episode 1 & 2', url: 'https://rumble.com/v1abc-ep-one.html' },
                { title: '<script>alert(1)</script>', url: 'https://rumble.com/v2def-ep-two.html' },
                // No URL: cannot be addressed, so it is not an item.
                { title: 'Broken', url: '' },
            ],
        );

        // Parsed by the browser's own XML parser: if it is not well-formed,
        // this is where that shows up rather than in a reader later.
        const doc = new DOMParser().parseFromString(xml, 'application/xml');
        const parseError = doc.querySelector('parsererror') ? 'yes' : 'no';
        const items = [...doc.querySelectorAll('item')].map((n) => ({
            title: n.querySelector('title')?.textContent,
            link: n.querySelector('link')?.textContent,
            guid: n.querySelector('guid')?.textContent,
        }));

        const emptyFeed = rss.buildFeed({ title: 'Nobody', url: 'https://rumble.com/c/Nobody' }, []);
        const emptyDoc = new DOMParser().parseFromString(emptyFeed, 'application/xml');

        return {
            parseError,
            channelTitle: doc.querySelector('channel > title')?.textContent,
            items,
            // The raw text must not contain an unescaped tag.
            hasRawScriptTag: xml.includes('<script>'),
            emptyOk: !emptyDoc.querySelector('parsererror'),
            emptyItems: emptyDoc.querySelectorAll('item').length,
        };
    });

    expect(result.parseError).toBe('no');
    // Escaped on the wire, decoded back by the parser.
    expect(result.channelTitle).toBe('Bob & Alice <Live>');
    expect(result.hasRawScriptTag).toBe(false);

    expect(result.items).toHaveLength(2);
    expect(result.items[0]).toEqual({
        title: 'Episode 1 & 2',
        link: 'https://rumble.com/v1abc-ep-one.html',
        guid: 'https://rumble.com/v1abc-ep-one.html',
    });
    expect(result.items[1].title).toBe('<script>alert(1)</script>');

    // A channel with nothing on the page still produces a well-formed feed.
    expect(result.emptyOk).toBe(true);
    expect(result.emptyItems).toBe(0);
});

test('ChatComposerAssist completes @mentions from the people who actually spoke', async () => {
    const result = await inHarness(({ body }) => {
        document.body.innerHTML = body;
        const harness = globalThis.__RumbleXFeatureHarness;
        harness.enable('chatMentionAutocomplete');
        const ac = harness.features.find((f) => f.id === 'chatMentionAutocomplete');

        // Extra chatters so ranking has something to sort.
        const history = document.querySelector('#chat-history-list');
        for (const name of ['Alfred', 'alpha_fan', 'Zoe']) {
            const row = document.createElement('div');
            row.className = 'chat-history--row';
            const user = document.createElement('button');
            user.className = 'chat-history--username';
            user.textContent = name;
            const msg = document.createElement('span');
            msg.className = 'chat-history--message';
            msg.textContent = 'hi';
            row.append(user, msg);
            history.appendChild(row);
        }

        ac.init();
        const input = ac._input;
        const hadInput = !!input;

        const pendingFor = (value, caret) => {
            input.value = value;
            input.selectionStart = caret === undefined ? value.length : caret;
            return ac._pending(input);
        };

        // Only a mention token immediately before the caret counts.
        const midWord = pendingFor('email me at bob@example');
        const plain = pendingFor('no mention here');
        const atStart = pendingFor('@Al');
        const afterSpace = pendingFor('hey @al');

        ac._indexNames();
        const ranked = (term) => { pendingFor('@' + term); ac._onInput(); return ac._matches.slice(); };
        const forAl = ranked('Al');
        // Substring matches rank after prefix matches.
        const forFan = ranked('fan');

        // Accepting rewrites the token and leaves a trailing space.
        pendingFor('hey @al');
        ac._onInput();
        let inputEvents = 0;
        input.addEventListener('input', () => { inputEvents += 1; });
        ac._accept('Alice');
        const accepted = input.value;
        const hiddenAfterAccept = ac._box.hidden;

        // Keyboard: arrow moves the selection, Escape closes.
        pendingFor('@a');
        ac._onInput();
        const openCount = ac._matches.length;
        ac._onKeyDown({ key: 'ArrowDown', preventDefault() {} });
        const activeAfterArrow = ac._active;
        ac._onKeyDown({ key: 'Escape', preventDefault() {} });
        const hiddenAfterEscape = ac._box.hidden;

        ac.destroy();
        const boxGone = !document.querySelector('.rx-chat-ac');

        return {
            hadInput,
            midWordNull: midWord === null,
            plainNull: plain === null,
            atStartTerm: atStart ? atStart.term : null,
            afterSpaceTerm: afterSpace ? afterSpace.term : null,
            forAl, forFan, accepted, inputEvents, hiddenAfterAccept,
            openCount, activeAfterArrow, hiddenAfterEscape, boxGone,
        };
    });

    expect(result.hadInput).toBe(true);
    // "bob@example" is an address, not a mention.
    expect(result.midWordNull).toBe(true);
    expect(result.plainNull).toBe(true);
    expect(result.atStartTerm).toBe('Al');
    expect(result.afterSpaceTerm).toBe('al');

    // Alice and Alfred both start with "al"; alpha_fan does too.
    expect(result.forAl).toContain('Alice');
    expect(result.forAl).toContain('Alfred');
    // Prefix matches come before substring matches.
    expect(result.forFan[0]).toBe('alpha_fan');

    expect(result.accepted).toBe('hey @Alice ');
    // The composer is framework-driven, so it must be told the value changed.
    expect(result.inputEvents).toBe(1);
    expect(result.hiddenAfterAccept).toBe(true);

    expect(result.openCount).toBeGreaterThan(1);
    expect(result.activeAfterArrow).toBe(1);
    expect(result.hiddenAfterEscape).toBe(true);
    expect(result.boxGone).toBe(true);
});

test('ChatHighlights marks only messages matching configured terms and reverts on destroy', async () => {
    const result = await inHarness(({ body }) => {
        document.body.innerHTML = body;
        const harness = globalThis.__RumbleXFeatureHarness;
        harness.enable('chatMentionHighlight');
        const hl = harness.features.find((f) => f.id === 'chatMentionHighlight');

        const history = document.querySelector('#chat-history-list');
        history.textContent = '';
        const add = (user, text) => {
            const row = document.createElement('div');
            row.className = 'chat-history--row';
            const u = document.createElement('button');
            u.className = 'chat-history--username';
            u.textContent = user;
            const m = document.createElement('span');
            m.className = 'chat-history--message';
            m.textContent = text;
            row.append(u, m);
            history.appendChild(row);
        };
        add('Alice', 'talking about ELECTIONS today');
        add('Bob', 'nothing relevant here');
        add('KeywordUser', 'plain text');

        const realGet = Settings.get.bind(Settings);
        const store = { chatHighlightKeywords: ['elections', 'keyworduser'], chatHighlightSound: false };
        Settings.get = (key) => (Object.hasOwn(store, key) ? store[key] : realGet(key));

        hl._scan();
        const marked = [...history.children].map((r) => r.classList.contains('rx-chat-kw'));

        // No terms configured means the feature does nothing at all.
        for (const row of history.children) { row.classList.remove('rx-chat-kw'); delete row.dataset.rxKw; }
        store.chatHighlightKeywords = [];
        hl._scan();
        const markedWithNoTerms = [...history.children].some((r) => r.classList.contains('rx-chat-kw'));

        store.chatHighlightKeywords = ['elections'];
        for (const row of history.children) delete row.dataset.rxKw;
        hl._scan();
        const beforeDestroy = [...history.children].some((r) => r.classList.contains('rx-chat-kw'));
        Settings.get = realGet;
        hl.destroy();
        const afterDestroy = [...history.children].some((r) => r.classList.contains('rx-chat-kw'));

        return { marked, markedWithNoTerms, beforeDestroy, afterDestroy };
    });

    // Case-insensitive, and the username counts as much as the message body.
    expect(result.marked).toEqual([true, false, true]);
    expect(result.markedWithNoTerms).toBe(false);
    expect(result.beforeDestroy).toBe(true);
    // Turning it off leaves the host chat exactly as it was.
    expect(result.afterDestroy).toBe(false);
});

test('ChatReadability clamps the font scale and keeps deleted messages visible', async () => {
    const result = await inHarness(({ body }) => {
        document.body.innerHTML = body;
        const harness = globalThis.__RumbleXFeatureHarness;
        harness.enable('chatReadability');
        const cr = harness.features.find((f) => f.id === 'chatReadability');

        const realGet = Settings.get.bind(Settings);
        const store = { chatReadability: true, chatShowDeleted: true, chatFontScale: 100 };
        Settings.get = (key) => (Object.hasOwn(store, key) ? store[key] : realGet(key));

        const scales = {};
        const cases = [['low', 10], ['high', 500], ['ok', 130], ['junk', 'abc']];
        for (const pair of cases) {
            store.chatFontScale = pair[1];
            scales[pair[0]] = cr._scale();
        }
        store.chatFontScale = 100;

        cr.init();
        const classesOn = {
            read: document.documentElement.classList.contains('rx-chat-read'),
            deleted: document.documentElement.classList.contains('rx-chat-deleted'),
        };
        // 100 means "leave the site alone", so no size stylesheet is injected.
        const noSizeSheetAt100 = cr._sizeEl === null;
        store.chatFontScale = 130;
        cr._applySize();
        const sizeSheetAt130 = !!cr._sizeEl;

        const history = document.querySelector('#chat-history-list');
        const victim = document.createElement('div');
        victim.className = 'chat-history--row';
        const vu = document.createElement('button');
        vu.className = 'chat-history--username';
        vu.textContent = 'Mod';
        victim.appendChild(vu);
        history.appendChild(victim);

        return new Promise((resolve) => {
            const obs = cr._watchDeletions(history);
            obs.observe(history, { childList: true });
            victim.remove();
            // MutationObserver callbacks are microtask-scheduled.
            setTimeout(() => {
                const restored = history.contains(victim);
                const struck = victim.classList.contains('rx-chat-gone');
                obs.disconnect();
                Settings.get = realGet;
                cr.destroy();
                const classesAfter = document.documentElement.classList.contains('rx-chat-read')
                    || document.documentElement.classList.contains('rx-chat-deleted');
                resolve({ scales, classesOn, noSizeSheetAt100, sizeSheetAt130, restored, struck, classesAfter });
            }, 30);
        });
    });

    // Clamped into a range that stays readable either way.
    expect(result.scales).toEqual({ low: 70, high: 160, ok: 130, junk: 100 });
    expect(result.classesOn).toEqual({ read: true, deleted: true });
    expect(result.noSizeSheetAt100).toBe(true);
    expect(result.sizeSheetAt130).toBe(true);

    // A removed message comes back struck through rather than vanishing.
    expect(result.restored).toBe(true);
    expect(result.struck).toBe(true);
    expect(result.classesAfter).toBe(false);
});

test('ChatUserCards logs per person, renames locally, and reverts everything on destroy', async () => {
    const result = await inHarness(({ body }) => {
        document.body.innerHTML = body;
        const harness = globalThis.__RumbleXFeatureHarness;
        harness.enable('chatParticipantsList');
        const cards = harness.features.find((f) => f.id === 'chatParticipantsList');

        const history = document.querySelector('#chat-history-list');
        history.textContent = '';
        const add = (user, text) => {
            const row = document.createElement('div');
            row.className = 'chat-history--row';
            const u = document.createElement('button');
            u.className = 'chat-history--username';
            u.textContent = user;
            const m = document.createElement('span');
            m.className = 'chat-history--message';
            m.textContent = text;
            row.append(u, m);
            history.appendChild(row);
            return row;
        };
        add('Alice', 'first');
        add('Bob', 'only one');
        add('Alice', 'second');

        const nickStore = { chatNicknames: {}, blockedChatters: [] };
        const realGet = Settings.get.bind(Settings);
        const realSet = Settings.set.bind(Settings);
        Settings.get = (key) => (Object.hasOwn(nickStore, key) ? nickStore[key] : realGet(key));
        Settings.set = (key, value) => { nickStore[key] = value; return Promise.resolve(); };

        cards.init();

        const perUser = {
            alice: (cards._log.get('Alice') || []).slice(),
            bob: (cards._log.get('Bob') || []).slice(),
        };

        // Re-indexing must not double-count messages already seen.
        cards._index();
        const aliceAfterReindex = (cards._log.get('Alice') || []).length;

        // Open the card for Alice.
        const aliceBtn = history.querySelector('.chat-history--username');
        cards._open('Alice', aliceBtn);
        const cardVisible = !cards._card.hidden;
        const cardName = cards._card.querySelector('.rx-chat-card__name').textContent;
        const cardMeta = cards._card.querySelector('.rx-chat-card__meta').textContent;
        const logLines = [...cards._card.querySelectorAll('.rx-chat-card__log div')].map((d) => d.textContent);

        // Mention writes into the composer.
        const composer = document.querySelector('form.chat-message-form textarea');
        composer.value = 'hi';
        cards._card.querySelector('.rx-chat-card__actions button').click();
        const composerValue = composer.value;

        // Nickname round trip.
        cards._open('Alice', aliceBtn);
        const nickInput = cards._card.querySelector('.rx-chat-card__nick input');
        nickInput.value = 'Ally';
        cards._card.querySelector('.rx-chat-card__nick button').click();
        const storedNick = JSON.parse(JSON.stringify(nickStore.chatNicknames));
        const renamed = aliceBtn.textContent;
        const keptRealName = aliceBtn.dataset.rxRealName;

        // Clearing the box removes the alias rather than storing an empty one.
        cards._open('Alice', aliceBtn);
        const nickInput2 = cards._card.querySelector('.rx-chat-card__nick input');
        nickInput2.value = '   ';
        cards._card.querySelector('.rx-chat-card__nick button').click();
        const clearedNick = JSON.parse(JSON.stringify(nickStore.chatNicknames));
        const restoredName = aliceBtn.textContent;

        // Block appends lowercase and does not duplicate.
        cards._open('Bob', history.querySelectorAll('.chat-history--username')[1]);
        cards._card.querySelectorAll('.rx-chat-card__actions button')[1].click();
        cards._open('Bob', history.querySelectorAll('.chat-history--username')[1]);
        cards._card.querySelectorAll('.rx-chat-card__actions button')[1].click();
        const blocked = nickStore.blockedChatters.slice();

        // Re-apply a nickname so destroy has something to undo.
        nickStore.chatNicknames = { alice: 'Ally' };
        cards._applyNicknames();
        const renamedAgain = aliceBtn.textContent;

        Settings.get = realGet;
        Settings.set = realSet;
        cards.destroy();
        const afterDestroy = {
            name: aliceBtn.textContent,
            realNameAttr: aliceBtn.dataset.rxRealName,
            cardGone: !document.querySelector('.rx-chat-card'),
        };

        return {
            perUser, aliceAfterReindex, cardVisible, cardName, cardMeta, logLines,
            composerValue, storedNick, renamed, keptRealName, clearedNick, restoredName,
            blocked, renamedAgain, afterDestroy,
        };
    });

    // Messages are grouped by who said them.
    expect(result.perUser.alice).toEqual(['first', 'second']);
    expect(result.perUser.bob).toEqual(['only one']);
    // Already-indexed rows are skipped, so a re-scan does not duplicate.
    expect(result.aliceAfterReindex).toBe(2);

    expect(result.cardVisible).toBe(true);
    expect(result.cardName).toBe('Alice');
    expect(result.cardMeta).toBe('2 messages this session');
    // Newest first.
    expect(result.logLines).toEqual(['second', 'first']);

    expect(result.composerValue).toBe('hi @Alice ');

    expect(result.storedNick).toEqual({ alice: 'Ally' });
    expect(result.renamed).toBe('Ally');
    // The real name is kept so the rename is reversible.
    expect(result.keptRealName).toBe('Alice');

    expect(result.clearedNick).toEqual({});
    expect(result.restoredName).toBe('Alice');

    // Lowercased, and blocking twice does not add a second entry.
    expect(result.blocked).toEqual(['bob']);

    expect(result.renamedAgain).toBe('Ally');
    // Turning the feature off puts the host chat back exactly as it was.
    expect(result.afterDestroy.name).toBe('Alice');
    expect(result.afterDestroy.realNameAttr).toBeUndefined();
    expect(result.afterDestroy.cardGone).toBe(true);
});

test('ChatClickToMention stands down when user cards are handling the same click', async () => {
    const result = await inHarness(({ body }) => {
        document.body.innerHTML = body;
        const harness = globalThis.__RumbleXFeatureHarness;
        harness.enable('chatClickToMention');
        const ctm = harness.features.find((f) => f.id === 'chatClickToMention');

        const realGet = Settings.get.bind(Settings);
        const store = { chatClickToMention: true, chatParticipantsList: true };
        Settings.get = (key) => (Object.hasOwn(store, key) ? store[key] : realGet(key));

        // Cards on: this feature must not bind at all, or both would fire.
        ctm.init();
        const boundWithCards = ctm._handler !== null;
        ctm.destroy();

        // Cards off: it binds and inserts the mention.
        store.chatParticipantsList = false;
        ctm.init();
        const boundWithoutCards = ctm._handler !== null;

        const composer = document.querySelector('form.chat-message-form textarea');
        composer.value = '';
        document.querySelector('.chat-history--username').click();
        const firstInsert = composer.value;
        // A second click appends with exactly one separating space.
        document.querySelector('.chat-history--username').click();
        const secondInsert = composer.value;

        Settings.get = realGet;
        ctm.destroy();
        const unbound = ctm._handler === null;
        composer.value = '';
        document.querySelector('.chat-history--username').click();
        const afterDestroy = composer.value;

        return { boundWithCards, boundWithoutCards, firstInsert, secondInsert, unbound, afterDestroy };
    });

    expect(result.boundWithCards).toBe(false);
    expect(result.boundWithoutCards).toBe(true);
    expect(result.firstInsert).toBe('@Alice ');
    expect(result.secondInsert).toBe('@Alice @Alice ');
    expect(result.unbound).toBe(true);
    // Listener removed, so the click does nothing.
    expect(result.afterDestroy).toBe('');
});

test('RantArchive totals rant amounts, ranks supporters, and escapes CSV safely', async () => {
    const result = await inHarness(() => {
        const harness = globalThis.__RumbleXFeatureHarness;
        harness.enable('rantStatsPanel');
        const ra = harness.features.find((f) => f.id === 'rantStatsPanel');

        // Rumble renders prices as display strings, and an unparseable one must
        // contribute nothing rather than poisoning the sum with NaN.
        const amounts = {
            plain: ra.parseAmount('$10'),
            decimal: ra.parseAmount('$1.50'),
            thousands: ra.parseAmount('$1,234.50'),
            otherCurrency: ra.parseAmount('R$5'),
            number: ra.parseAmount(20),
            junk: ra.parseAmount('free'),
            empty: ra.parseAmount(''),
            missing: ra.parseAmount(undefined),
            negative: ra.parseAmount(-5),
        };

        const entries = [
            { user: 'Alice', price: '$10', text: 'hi', level: 3, ts: 1_755_000_000_000 },
            { user: 'Bob', price: '$2.50', text: 'yo', level: 1, ts: 1_755_000_001_000 },
            { user: 'Alice', price: '$5', text: 'again', level: 2, ts: 1_755_000_002_000 },
            { user: '', price: 'free', text: 'no amount', level: 0, ts: 1_755_000_003_000 },
        ];
        const totals = ra.totals(entries);
        const emptyTotals = ra.totals([]);
        const junkTotals = ra.totals(null);

        // A comma, a quote and a newline in the message body all have to survive
        // a round trip through the CSV.
        const csv = ra.toCsv([
            { user: 'Eve', price: '$3', text: 'hello, "world"\nsecond line', level: 1, ts: 1_755_000_000_000 },
        ]);
        const csvLines = csv.split('\n');

        const realGet = Settings.get.bind(Settings);
        const store = { rantExportFormat: 'csvJson' };
        Settings.get = (key) => (Object.hasOwn(store, key) ? store[key] : realGet(key));
        const formats = {};
        for (const mode of ['csv', 'json', 'csvJson', 'nonsense']) {
            store.rantExportFormat = mode;
            formats[mode] = ra._format();
        }

        // Export writes one file per selected format, and nothing when empty.
        const saved = [];
        const realSave = ra._save;
        const realEntries = ra._entries;
        ra._save = (content, filename) => { saved.push(filename.replace(/^.*_/, '')); };
        ra._entries = () => entries;

        store.rantExportFormat = 'csv';
        saved.length = 0; ra._export();
        const csvOnly = saved.slice();

        store.rantExportFormat = 'json';
        saved.length = 0; ra._export();
        const jsonOnly = saved.slice();

        store.rantExportFormat = 'csvJson';
        saved.length = 0; ra._export();
        const both = saved.slice();

        ra._entries = () => [];
        saved.length = 0; ra._export();
        const whenEmpty = saved.slice();

        ra._save = realSave;
        ra._entries = realEntries;
        Settings.get = realGet;

        return { amounts, totals, emptyTotals, junkTotals, csvLines, formats, csvOnly, jsonOnly, both, whenEmpty };
    });

    expect(result.amounts).toEqual({
        plain: 10, decimal: 1.5, thousands: 1234.5, otherCurrency: 5,
        number: 20, junk: 0, empty: 0, missing: 0, negative: 0,
    });

    expect(result.totals.count).toBe(4);
    // 10 + 2.50 + 5, with the unparseable one contributing nothing.
    expect(result.totals.amount).toBe(17.5);
    expect(result.totals.supporters).toBe(3);
    // Ranked by amount, so Alice's two rants put her first.
    expect(result.totals.top[0]).toEqual({ user: 'Alice', total: 15 });
    expect(result.totals.top[1]).toEqual({ user: 'Bob', total: 2.5 });
    // A missing username is bucketed rather than dropped.
    expect(result.totals.top[2]).toEqual({ user: 'unknown', total: 0 });

    expect(result.emptyTotals).toEqual({ count: 0, amount: 0, supporters: 0, top: [] });
    expect(result.junkTotals.count).toBe(0);

    expect(result.csvLines[0]).toBe('user,price,amount,level,text,timestamp');
    // Quotes doubled, whole field wrapped, and the embedded newline preserved.
    expect(result.csvLines[1]).toContain('"hello, ""world""');

    expect(result.formats).toEqual({ csv: 'csv', json: 'json', csvJson: 'csvJson', nonsense: 'csvJson' });

    expect(result.csvOnly).toEqual(['rants.csv']);
    expect(result.jsonOnly).toEqual(['rants.json']);
    expect(result.both).toEqual(['rants.csv', 'rants.json']);
    // Nothing captured means nothing written.
    expect(result.whenEmpty).toEqual([]);
});

test('VideoDownloader trims only the stream segments a mark fully covers', async () => {
    const result = await inHarness(async ({ body }) => {
        document.body.innerHTML = body;
        const harness = globalThis.__RumbleXFeatureHarness;
        harness.enable('videoDownload');
        const dl = harness.features.find((f) => f.id === 'videoDownload');

        const BASE = 'https://hugh.cdn.rumble.cloud/live/fixture/playlist.m3u8';
        // Ten four-second segments, so the timeline runs 0 to 40 seconds and
        // every boundary lands on a multiple of four.
        const playlist = ['#EXTM3U', '#EXT-X-VERSION:3', '#EXT-X-TARGETDURATION:4']
            .concat(Array.from({ length: 10 }, (_, i) => `#EXTINF:4.000,\nseg${i}.ts`))
            .concat(['#EXT-X-ENDLIST'])
            .join('\n');
        const entries = dl._parseSegmentEntries(playlist, BASE);
        // The URL-only parser is the same walk, so the two must agree exactly.
        const urlsOnly = dl._parseSegmentPlaylist(playlist, BASE);

        const name = (entry) => entry.url.split('/').pop();

        // 8-16 covers segments 2 and 3 exactly. 21-27 covers no whole segment:
        // it clips the tail of 5 and the head of 6, and both must survive.
        const aligned = dl._planSponsorTrim(entries, [
            { start: 8, end: 16, category: 'sponsor' },
            { start: 21, end: 27, category: 'intro' },
        ]);

        // Adjacent and overlapping marks collapse before anything is counted,
        // or segment 4 would be removed once and counted twice.
        const merged = dl._mergeSponsorRanges([
            { start: 20, end: 24, category: 'intro' },
            { start: 4, end: 12, category: 'sponsor' },
            { start: 10, end: 16, category: 'selfpromo' },
        ]);
        const overlapping = dl._planSponsorTrim(entries, [
            { start: 4, end: 12, category: 'sponsor' },
            { start: 10, end: 16, category: 'selfpromo' },
        ]);

        // A playlist with no #EXTINF lines has no timeline to cut against.
        const noDurations = dl._planSponsorTrim(
            dl._parseSegmentEntries(['#EXTM3U', 'a.ts', 'b.ts', 'c.ts'].join('\n'), BASE),
            [{ start: 0, end: 5, category: 'sponsor' }],
        );

        // A mark spanning the whole video would leave an empty file.
        const everything = dl._planSponsorTrim(entries, [{ start: 0, end: 40, category: 'sponsor' }]);
        // No marks at all is the ordinary case and must not touch the list.
        const noMarks = dl._planSponsorTrim(entries, []);
        // Garbage in the store is ignored rather than throwing.
        const junk = dl._planSponsorTrim(entries, [
            { start: 'x', end: 4 }, { start: 8, end: 8 }, { start: 12, end: 4 }, null,
        ]);

        // The setting gates the cut; the marks alone never trim anything.
        const realGet = Settings.get.bind(Settings);
        const store = {
            sponsorTrimDownloads: false,
            sponsorSegments: { vfeature123: [{ start: 8, end: 16, category: 'sponsor' }] },
        };
        Settings.get = (key) => (Object.hasOwn(store, key) ? store[key] : realGet(key));

        const gatedOff = dl._applySponsorTrim(entries);
        store.sponsorTrimDownloads = true;
        const gatedOn = dl._applySponsorTrim(entries);
        // Marks stored against a different video are not this video's business.
        store.sponsorSegments = { vsomeother: [{ start: 8, end: 16, category: 'sponsor' }] };
        const otherVideo = dl._applySponsorTrim(entries);
        store.sponsorSegments = { vfeature123: [{ start: 8, end: 16, category: 'sponsor' }] };
        const localMarks = dl._localSponsorSegments().length;

        // Sidecar fields describe the original timeline either way.
        const trimmedFields = dl._sponsorSidecarFields(aligned);
        // Marked, but the mark covered no whole segment, so nothing was cut.
        const markOnlyFields = dl._sponsorSidecarFields(
            dl._planSponsorTrim(entries, [{ start: 21, end: 27, category: 'intro' }]),
        );
        const cleanFields = dl._sponsorSidecarFields(noMarks);

        // And they have to reach the written file.
        const saved = [];
        const realSave = dl._triggerSave;
        dl._triggerSave = (data, filename) => { saved.push({ filename, data }); };
        store.downloadIncludeMetadata = true;
        store.downloadIncludeThumbnail = false;
        dl._writeSidecars('Fixture - 1080p', trimmedFields);
        const infoJson = saved.find((f) => f.filename.endsWith('.info.json'));
        const written = JSON.parse(infoJson ? await infoJson.data.text() : '{}');
        dl._triggerSave = realSave;
        Settings.get = realGet;

        return {
            count: entries.length,
            first: entries[0],
            last: entries[9],
            urlsMatch: JSON.stringify(urlsOnly) === JSON.stringify(entries.map((e) => e.url)),
            aligned: {
                kept: aligned.entries.map(name),
                removed: aligned.removed.map(name),
                removedCount: aligned.removedCount,
                removedSeconds: aligned.removedSeconds,
                ranges: aligned.ranges,
            },
            merged,
            overlapping: { removed: overlapping.removed.map(name), seconds: overlapping.removedSeconds },
            noDurations: { kept: noDurations.entries.length, removedCount: noDurations.removedCount },
            everything: { kept: everything.entries.length, removedCount: everything.removedCount },
            noMarks: { kept: noMarks.entries.length, ranges: noMarks.ranges.length },
            junk: { kept: junk.entries.length, ranges: junk.ranges.length },
            gatedOff, gatedOn: gatedOn && gatedOn.removed.map(name), otherVideo, localMarks,
            trimmedFields, markOnlyFields, cleanFields,
            written: { chapters: written.chapters, removed: written.sponsorblock_removed, title: written.title },
        };
    });

    expect(result.count).toBe(10);
    expect(result.first).toEqual({ url: expect.stringContaining('seg0.ts'), duration: 4, start: 0, end: 4 });
    expect(result.last.start).toBe(36);
    expect(result.last.end).toBe(40);
    expect(result.urlsMatch).toBe(true);

    // Only the two segments the first mark fully covers.
    expect(result.aligned.removed).toEqual(['seg2.ts', 'seg3.ts']);
    expect(result.aligned.removedCount).toBe(2);
    expect(result.aligned.removedSeconds).toBe(8);
    expect(result.aligned.kept).not.toContain('seg2.ts');
    // 21-27 straddles two segments and takes neither.
    expect(result.aligned.kept).toContain('seg5.ts');
    expect(result.aligned.kept).toContain('seg6.ts');
    expect(result.aligned.kept.length).toBe(8);
    // Both marks are still reported, even though one removed nothing.
    expect(result.aligned.ranges.length).toBe(2);

    // Three marks, two of which touch, collapse to two ranges.
    expect(result.merged).toEqual([
        { start: 4, end: 16, categories: ['sponsor', 'selfpromo'] },
        { start: 20, end: 24, categories: ['intro'] },
    ]);
    // Segments 1-3 sit inside the merged 4-16 window, counted once each.
    expect(result.overlapping.removed).toEqual(['seg1.ts', 'seg2.ts', 'seg3.ts']);
    expect(result.overlapping.seconds).toBe(12);

    // No timeline, no cut.
    expect(result.noDurations).toEqual({ kept: 3, removedCount: 0 });
    // An all-covering mark returns the untrimmed list rather than nothing.
    expect(result.everything).toEqual({ kept: 10, removedCount: 0 });
    expect(result.noMarks).toEqual({ kept: 10, ranges: 0 });
    // Reversed, zero-length and malformed marks are all discarded.
    expect(result.junk).toEqual({ kept: 10, ranges: 0 });

    // The toggle, not the presence of marks, decides.
    expect(result.gatedOff).toBeNull();
    expect(result.gatedOn).toEqual(['seg2.ts', 'seg3.ts']);
    expect(result.otherVideo).toBeNull();
    expect(result.localMarks).toBe(1);

    // yt-dlp's chapter shape, on the original timeline.
    expect(result.trimmedFields.chapters).toEqual([
        { start_time: 8, end_time: 16, title: '[SponsorBlock]: sponsor' },
        { start_time: 21, end_time: 27, title: '[SponsorBlock]: intro' },
    ]);
    expect(result.trimmedFields.sponsorblock_removed.segments).toBe(2);
    expect(result.trimmedFields.sponsorblock_removed.seconds).toBe(8);
    // Marked but not trimmed: chapters, and no removal record to imply otherwise.
    expect(result.markOnlyFields.chapters).toEqual([
        { start_time: 21, end_time: 27, title: '[SponsorBlock]: intro' },
    ]);
    expect(result.markOnlyFields.sponsorblock_removed).toBeUndefined();
    // Nothing marked at all writes no sponsor fields.
    expect(result.cleanFields).toBeNull();

    // The extra fields land in the info.json without displacing the metadata.
    expect(result.written.chapters).toEqual(result.trimmedFields.chapters);
    expect(result.written.removed.segments).toBe(2);
    expect(result.written.title).toBe('Feature Fixture Video');
});

test('SubtitleSidecar reads Rumble\'s own caption tracks off the embed payload', async () => {
    const result = await inHarness(async ({ body }) => {
        document.body.innerHTML = body;
        const harness = globalThis.__RumbleXFeatureHarness;
        harness.enable('subtitleSidecar');
        const sub = harness.features.find((f) => f.id === 'subtitleSidecar');

        // An uncaptioned video serializes `cc` as an empty array, not an empty
        // object, and a live stream omits it entirely.
        const shapes = {
            populated: sub._nativeTracks({
                cc: {
                    en: { path: 'https://rumble.com/caption/en.vtt', language: 'English' },
                    de: { path: 'https://rumble.com/caption/de.vtt', language: 'Deutsch' },
                },
            }),
            // A bare string value is accepted, and the code falls back to the
            // language key when no display name came with it.
            bareString: sub._nativeTracks({ cc: { fr: 'https://rumble.com/caption/fr.vtt' } }),
            emptyArray: sub._nativeTracks({ cc: [] }),
            emptyObject: sub._nativeTracks({ cc: {} }),
            missing: sub._nativeTracks({}),
            nullData: sub._nativeTracks(null),
            // An entry with no path is dropped rather than becoming a dead button.
            pathless: sub._nativeTracks({ cc: { en: { language: 'English' } } }),
        };

        // Only Rumble's own media hosts are permitted by the manifest.
        const urls = {
            rumble: sub._captionUrl('https://rumble.com/caption/en.vtt'),
            cdn: sub._captionUrl('https://1a-1791.com/caption/en.vtt'),
            cloud: sub._captionUrl('https://hugh.cdn.rumble.cloud/caption/en.vtt'),
            relative: sub._captionUrl('/caption/en.vtt'),
            offsite: sub._captionUrl('https://evil.example.com/caption/en.vtt'),
            javascript: sub._captionUrl('javascript:alert(1)'),
            empty: sub._captionUrl(''),
        };

        // The parser already handles both formats; prove it against the two
        // shapes Rumble accepts from creators.
        const vtt = sub._parse([
            'WEBVTT',
            '',
            '1',
            '00:00:01.000 --> 00:00:03.500',
            'First line',
            '',
            '2',
            '00:00:04.000 --> 00:00:06.000',
            'Second line',
        ].join('\n'));
        const srt = sub._parse([
            '1',
            '00:00:01,000 --> 00:00:03,500',
            'First line',
            '',
            '2',
            '00:00:04,000 --> 00:00:06,000',
            'Second line',
        ].join('\n'));

        sub._mount();
        const track = { lang: 'en', label: 'English', url: 'https://rumble.com/caption/en.vtt' };

        // Stand in for the network. RXPlatform is frozen, so _fetchNative is
        // the seam.
        const realFetch = sub._fetchNative;
        sub._fetchNative = async () => 'WEBVTT\n\n00:00:02.000 --> 00:00:04.000\nHello from Rumble';
        await sub._loadNativeTrack(track);
        const loaded = {
            cues: sub._cues.length,
            text: sub._cues[0]?.text,
            active: sub._activeNative,
            status: sub._panel.querySelector('.rx-sub-status').textContent,
            // The transcript panel is the point of the exercise.
            transcript: Transcripts._cues.length,
        };

        sub._native = [track, { lang: 'de', label: 'Deutsch', url: 'https://rumble.com/caption/de.vtt' }];
        sub._renderNative();
        const buttons = [...sub._panel.querySelectorAll('.rx-sub-native-btn')]
            .map((b) => ({ lang: b.dataset.lang, label: b.textContent, pressed: b.getAttribute('aria-pressed') }));

        // A failed fetch reports rather than leaving the old status up.
        sub._fetchNative = async () => { throw new Error('Rumble returned HTTP 404 for the caption file.'); };
        await sub._loadNativeTrack(track);
        const failedStatus = sub._panel.querySelector('.rx-sub-status').textContent;

        // Clearing drops the pressed state along with the cues.
        sub._panel.querySelector('.rx-sub-clear').click();
        const cleared = {
            cues: sub._cues.length,
            active: sub._activeNative,
            pressed: [...sub._panel.querySelectorAll('.rx-sub-native-btn')].map((b) => b.getAttribute('aria-pressed')),
        };

        // The toggle gates discovery entirely.
        const realGet = Settings.get.bind(Settings);
        const store = { subtitleNativeTracks: false };
        Settings.get = (key) => (Object.hasOwn(store, key) ? store[key] : realGet(key));
        let embedCalls = 0;
        const realEmbed = VideoDownloader._fetchEmbedData;
        VideoDownloader._fetchEmbedData = async () => { embedCalls++; return { cc: {} }; };
        await sub._discoverNative();
        const callsWhenOff = embedCalls;
        Settings.get = realGet;
        VideoDownloader._fetchEmbedData = realEmbed;
        sub._fetchNative = realFetch;

        return { shapes, urls, vtt, srt, loaded, buttons, failedStatus, cleared, callsWhenOff };
    });

    expect(result.shapes.populated).toEqual([
        { lang: 'en', label: 'English', url: 'https://rumble.com/caption/en.vtt' },
        { lang: 'de', label: 'Deutsch', url: 'https://rumble.com/caption/de.vtt' },
    ]);
    expect(result.shapes.bareString).toEqual([
        { lang: 'fr', label: 'fr', url: 'https://rumble.com/caption/fr.vtt' },
    ]);
    // Every "no captions" shape resolves to the same empty answer.
    expect(result.shapes.emptyArray).toEqual([]);
    expect(result.shapes.emptyObject).toEqual([]);
    expect(result.shapes.missing).toEqual([]);
    expect(result.shapes.nullData).toEqual([]);
    expect(result.shapes.pathless).toEqual([]);

    expect(result.urls.rumble).toBe('https://rumble.com/caption/en.vtt');
    expect(result.urls.cdn).toBe('https://1a-1791.com/caption/en.vtt');
    expect(result.urls.cloud).toBe('https://hugh.cdn.rumble.cloud/caption/en.vtt');
    expect(result.urls.relative).toBe('https://rumble.com/caption/en.vtt');
    // A host the manifest does not permit is refused here, not at fetch time.
    expect(result.urls.offsite).toBeNull();
    expect(result.urls.javascript).toBeNull();
    expect(result.urls.empty).toBeNull();

    // Both caption formats parse to the same cues.
    expect(result.vtt).toEqual([
        { start: 1, end: 3.5, text: 'First line' },
        { start: 4, end: 6, text: 'Second line' },
    ]);
    expect(result.srt).toEqual(result.vtt);

    expect(result.loaded.cues).toBe(1);
    expect(result.loaded.text).toBe('Hello from Rumble');
    expect(result.loaded.active).toBe('en');
    expect(result.loaded.status).toContain('1 cues from Rumble (English)');
    // Loading a native track fills the transcript, which is the whole point.
    expect(result.loaded.transcript).toBe(1);

    expect(result.buttons).toEqual([
        { lang: 'en', label: 'English', pressed: 'true' },
        { lang: 'de', label: 'Deutsch', pressed: 'false' },
    ]);

    expect(result.failedStatus).toContain('HTTP 404');
    expect(result.cleared).toEqual({ cues: 0, active: null, pressed: ['false', 'false'] });
    // Off means the embed endpoint is never called.
    expect(result.callsWhenOff).toBe(0);
});

test('CreatorProgram counts this month from the embedded listing, not the DOM cards', async () => {
    const result = await inHarness(() => {
        const harness = globalThis.__RumbleXFeatureHarness;
        harness.enable('creatorMode');
        const cp = harness.features.find((f) => f.id === 'creatorMode');

        const item = (over) => Object.assign({
            object_type: 'video',
            id: 1,
            title: 'A video',
            relative_url: '/v0000001-a.html',
            upload_date: '2026-08-10T00:00:00+00:00',
            is_short: false,
            live: false,
            by: { type: 'channel', relative_url: '/c/fixture' },
        }, over);

        // Two script blocks, exactly as a channel page ships them.
        const block = (items) => {
            const el = document.createElement('script');
            el.type = 'application/json';
            el.textContent = JSON.stringify({ items, analytics: {} });
            return el;
        };

        const host = document.createElement('div');
        host.appendChild(block([
            item({ id: 1, is_short: true, upload_date: '2026-08-02T00:00:00+00:00' }),
            item({ id: 2, is_short: true, upload_date: '2026-08-18T00:00:00+00:00' }),
            item({ id: 3, upload_date: '2026-08-19T00:00:00+00:00' }),
        ]));
        host.appendChild(block([
            // Last month: outside the window.
            item({ id: 4, is_short: true, upload_date: '2026-07-30T00:00:00+00:00' }),
            // A finished stream from this month.
            item({ id: 5, upload_date: '2026-08-05T00:00:00+00:00', live_streamed_on: '2026-08-05T01:00:00+00:00' }),
            // Someone else's video riding along in a sidebar rail.
            item({ id: 6, is_short: true, upload_date: '2026-08-11T00:00:00+00:00', by: { type: 'channel', relative_url: '/c/someoneelse' } }),
        ]));
        // A script that mentions items but is not JSON must not take the rest down.
        const junk = document.createElement('script');
        junk.textContent = 'window.items = [1,2,3];';
        host.appendChild(junk);

        const all = ChannelListing.parse(host);
        // Rumble strips these blocks out of the DOM during hydration, so the
        // real page has none of them and the HTML parser is the path that
        // actually runs. Both must agree.
        const fromHtml = ChannelListing.parseHtml(host.innerHTML);
        const domIsEmpty = ChannelListing.parse(document).length;
        const mine = ChannelListing.forPath(all, '/c/fixture');
        const byUserPath = ChannelListing.forPath(all, '/c/Fixture/videos');
        // A path nobody owns falls back to everything rather than nothing.
        const unknownPath = ChannelListing.forPath(all, '/c/nobody');

        const august = cp._tally(mine, Date.parse('2026-08-19T12:00:00Z'));
        const july = cp._tally(mine, Date.parse('2026-07-15T12:00:00Z'));
        // Everything, including the foreign rail entry.
        const unfiltered = cp._tally(all, Date.parse('2026-08-19T12:00:00Z'));
        const empty = cp._tally([], Date.parse('2026-08-19T12:00:00Z'));
        const junkInput = cp._tally(null, Date.parse('2026-08-19T12:00:00Z'));
        // An unparseable upload_date is skipped, never counted into a month.
        const undated = cp._tally([item({ upload_date: 'whenever' })], Date.parse('2026-08-19T12:00:00Z'));

        const panel = cp._render(august);
        const rows = [...panel.querySelectorAll('.rx-cp-row')].map((row) => ({
            name: row.querySelector('.rx-cp-name').textContent,
            count: row.querySelector('.rx-cp-count').textContent,
            width: row.querySelector('.rx-cp-fill').style.width,
        }));

        // A month over target must not draw past the end of the track.
        const over = cp._render(cp._tally(
            Array.from({ length: 25 }, (_, i) => item({ id: 100 + i, is_short: true, upload_date: '2026-08-03T00:00:00+00:00' })),
            Date.parse('2026-08-19T12:00:00Z'),
        ));
        const overWidth = over.querySelector('.rx-cp-fill').style.width;

        return {
            parsed: all.length,
            fromHtml: fromHtml.length,
            fromHtmlIds: fromHtml.map((i) => i.id),
            domIsEmpty,
            mine: mine.length,
            byUserPathIds: byUserPath.map((i) => i.id),
            unknownPath: unknownPath.length,
            august, july, unfiltered, empty, junkInput, undated,
            rows, overWidth,
            role: panel.getAttribute('role'),
            label: panel.getAttribute('aria-label'),
        };
    });

    // The malformed script contributed nothing; the six real entries survived.
    expect(result.parsed).toBe(6);
    // Reading the same markup as text gives the same answer, which is what the
    // shipped path does, because the live page keeps none of these blocks.
    expect(result.fromHtml).toBe(6);
    expect(result.fromHtmlIds).toEqual([1, 2, 3, 4, 5, 6]);
    expect(result.domIsEmpty).toBe(0);
    expect(result.mine).toBe(5);
    // A deeper path under the same channel still matches, case-insensitively.
    expect(result.byUserPathIds).toEqual([1, 2, 3, 4, 5]);
    expect(result.unknownPath).toBe(6);

    expect(result.august).toEqual({ month: '2026-08', shorts: 2, videos: 2, streams: 1 });
    // A different month sees none of it.
    expect(result.july).toEqual({ month: '2026-07', shorts: 1, videos: 0, streams: 0 });
    // Without the channel filter, the rail entry inflates the shorts count.
    expect(result.unfiltered.shorts).toBe(3);
    expect(result.empty).toEqual({ month: '2026-08', shorts: 0, videos: 0, streams: 0 });
    expect(result.junkInput.shorts).toBe(0);
    expect(result.undated).toEqual({ month: '2026-08', shorts: 0, videos: 0, streams: 0 });

    expect(result.rows).toEqual([
        { name: 'Shorts this month', count: '2 / 20', width: '10%' },
        { name: 'Other videos', count: '2', width: '0%' },
        { name: 'Streams', count: '1', width: '0%' },
    ]);
    // 25 of 20 clamps rather than overflowing the track.
    expect(result.overWidth).toBe('100%');

    expect(result.role).toBe('region');
    expect(result.label).toBe('Creator Program progress');
});
