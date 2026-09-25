#!/usr/bin/env node
'use strict';

const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const background = fs.readFileSync(path.join(ROOT, 'extension', 'background.js'), 'utf8');
const lifecycle = background.match(
    /const OFFSCREEN_URL = chrome\.runtime\.getURL\('offscreen\.html'\);[\s\S]*?(?=\n\/\/ v3\.35\.0)/,
);
assert.ok(lifecycle, 'offscreen lifecycle block is missing');

async function runScenario({ hasDocument, getContexts, clients, expectedCreates, expectedExisting }) {
    let creates = 0;
    const offscreen = {
        async createDocument() { creates++; },
    };
    if (hasDocument) offscreen.hasDocument = hasDocument;

    const runtime = {
        getURL: (relative) => `chrome-extension://fixture/${relative}`,
        sendMessage() {},
        lastError: null,
    };
    if (getContexts) runtime.getContexts = getContexts;

    const context = vm.createContext({
        console,
        chrome: { offscreen, runtime },
        clients,
    });
    vm.runInContext(
        `${lifecycle[0]}\nthis.hasOffscreen = rxHasOffscreenDocument; this.ensureOffscreen = ensureOffscreenDocument;`,
        context,
        { filename: 'background-offscreen-lifecycle.js' },
    );

    assert.equal(await context.hasOffscreen(), expectedExisting);
    assert.equal(await context.ensureOffscreen(), true);
    assert.equal(creates, expectedCreates);
}

async function main() {
    await runScenario({
        hasDocument: async () => true,
        expectedCreates: 0,
        expectedExisting: true,
    });
    await runScenario({
        getContexts: async (filter) => {
            assert.deepEqual(JSON.parse(JSON.stringify(filter)), {
                contextTypes: ['OFFSCREEN_DOCUMENT'],
                documentUrls: ['chrome-extension://fixture/offscreen.html'],
            });
            return [{ contextType: 'OFFSCREEN_DOCUMENT' }];
        },
        expectedCreates: 0,
        expectedExisting: true,
    });
    await runScenario({
        clients: {
            async matchAll() { return [{ url: 'chrome-extension://fixture/offscreen.html' }]; },
        },
        expectedCreates: 0,
        expectedExisting: true,
    });
    await runScenario({
        clients: { async matchAll() { return []; } },
        expectedCreates: 1,
        expectedExisting: false,
    });

    console.log('Offscreen compatibility OK: Chrome 111 clients, Chrome 116 contexts, and Chrome 150 detection paths agree.');
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
