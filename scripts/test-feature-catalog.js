#!/usr/bin/env node
'use strict';

const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const core = fs.readFileSync(path.join(ROOT, 'extension', 'content.js'), 'utf8');
const schemaSource = fs.readFileSync(path.join(ROOT, 'extension', 'settings-schema.js'), 'utf8');

const schemaContext = vm.createContext({ URL });
vm.runInContext(schemaSource, schemaContext, { filename: 'settings-schema.js' });
const defaults = schemaContext.RumbleXSettingsSchema.DEFAULTS;

function objectBlock(symbol) {
    const match = core.match(new RegExp(`^const ${symbol} = \\{([\\s\\S]*?)^\\};`, 'm'));
    assert.ok(match, `feature object is missing: ${symbol}`);
    return match[0];
}

function property(block, key) {
    return block.match(new RegExp(`^\\s*${key}:\\s*'([^']+)'`, 'm'))?.[1] || '';
}

const registryBody = core.match(/const features = \[([\s\S]*?)\n\];/)?.[1] || '';
assert.ok(registryBody, 'feature registry is missing');
const registryWithoutComments = registryBody.replace(/\/\/.*$/gm, '');
const symbols = [...registryWithoutComments.matchAll(/\b[A-Z][A-Za-z0-9]+\b/g)]
    .map((match) => match[0])
    .filter((symbol) => symbol !== 'RX_CSS_FEATURES');
const uniqueSymbols = [...new Set(symbols)];
assert.deepEqual(symbols, uniqueSymbols, 'handwritten registry contains duplicate symbols');

const handwritten = uniqueSymbols.map((symbol) => {
    const block = objectBlock(symbol);
    const id = property(block, 'id');
    assert.ok(id, `${symbol} has no stable feature id`);
    assert.match(block, /^\s*init\s*\(/m, `${symbol} has no init lifecycle`);
    assert.match(block, /^\s*destroy\s*\(/m, `${symbol} has no destroy lifecycle`);
    return { symbol, id };
});

const cssBody = core.match(/const RX_CSS_TOGGLES = \[([\s\S]*?)\n\];/)?.[1] || '';
assert.ok(cssBody, 'CSS feature registry is missing');
const cssIds = [...cssBody.matchAll(/\bid:\s*'([^']+)'/g)].map((match) => match[1]);

assert.equal(handwritten.length, 75, 'handwritten feature count changed; update behavior coverage intentionally');
assert.equal(cssIds.length, 51, 'CSS feature count changed; update behavior coverage intentionally');
assert.equal(handwritten.length + cssIds.length, 126, 'total feature catalog changed unexpectedly');

const allIds = [...handwritten.map(({ id }) => id), ...cssIds];
assert.equal(new Set(allIds).size, allIds.length, 'feature ids must be unique across both registries');

for (const id of cssIds) {
    assert.ok(Object.hasOwn(defaults, id), `CSS feature has no canonical setting: ${id}`);
    assert.equal(typeof defaults[id], 'boolean', `CSS feature setting is not boolean: ${id}`);
}

// CategoryFilter is driven by the hiddenCategories array rather than its own
// switch. Every other handwritten module must have a canonical setting key.
for (const { symbol, id } of handwritten) {
    if (symbol === 'CategoryFilter') {
        assert.equal(id, 'categoryFilter');
        assert.ok(Object.hasOwn(defaults, 'hiddenCategories'));
        continue;
    }
    assert.ok(Object.hasOwn(defaults, id), `${symbol} has no canonical setting: ${id}`);
}

const cssFactory = core.match(/function makeCssToggleFeature\(entry\) \{([\s\S]*?)\n\}/)?.[0] || '';
assert.match(cssFactory, /id:\s*entry\.id/);
assert.match(cssFactory, /injectStyle\(entry\.css, 'rx-css-' \+ entry\.id\)/);
assert.match(cssFactory, /this\._styleEl\?\.remove\(\)/);

console.log(`Feature catalog OK: ${handwritten.length} handwritten + ${cssIds.length} CSS modules = ${allIds.length} unique lifecycle contracts.`);
