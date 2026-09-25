#!/usr/bin/env node
'use strict';

// RumbleX-owned surfaces must follow the active palette.
//
// The failure this prevents: the project ships multiple palettes, but ~190 lines of
// injected CSS pinned Catppuccin Mocha hexes outright, so the watch-progress
// bar, the resume toast and the toast stack rendered in Catppuccin pink and
// blue no matter which theme the user picked. Nothing failed. The colours were
// simply wrong on nearly every alternative theme, and only a screenshot of the right
// surface in the right theme would ever have shown it.
//
// The rule: a palette hex may appear in the THEMES registry, which is where the
// palettes are defined, or as the fallback inside var(--rx-token, #hex), which
// is what keeps RumbleX UI readable when the site-theme feature is off and no
// tokens are emitted. Anywhere else it is a hardcoded colour.
//
// Inline style.cssText counts. It is CSS in a string and the same rule applies.

const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const CONTENT = path.join(ROOT, 'extension', 'content.js');
const source = fs.readFileSync(CONTENT, 'utf8');
const lines = source.split(/\r?\n/);
const schemaSource = fs.readFileSync(path.join(ROOT, 'extension', 'settings-schema.js'), 'utf8');
const schemaContext = vm.createContext({ URL });
vm.runInContext(schemaSource, schemaContext, { filename: 'settings-schema.js' });
const themes = schemaContext.RumbleXSettingsSchema.THEMES;
assert.ok(themes && Object.keys(themes).length >= 7, 'canonical theme registry is missing palettes');

// Derive every six-digit palette colour from the canonical schema. A newly
// added theme is protected automatically instead of requiring a second list.
const PALETTE = Object.freeze([...new Set(
    Object.values(themes)
        .flatMap((theme) => Object.values(theme))
        .flatMap((value) => [...String(value).matchAll(/#([0-9a-f]{6})\b/gi)].map((match) => match[1].toLowerCase())),
)]);
assert.ok(PALETTE.length > 20, 'canonical theme registry exposes too few palette colours');
const HEX = new RegExp(`#(${PALETTE.join('|')})\\b`, 'gi');
const PALETTE_RGB = new Set(PALETTE.map((hex) => [
    Number.parseInt(hex.slice(0, 2), 16),
    Number.parseInt(hex.slice(2, 4), 16),
    Number.parseInt(hex.slice(4, 6), 16),
]).filter(([red, green, blue]) => red !== green || green !== blue).map((rgb) => rgb.join(',')));
const RGB = /rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})(?:\s*,\s*(?:0|1|0?\.\d+))?\s*\)/gi;
assert.match(source, /const THEMES = RXSettingsSchema\.THEMES;/,
    'content runtime no longer reads the canonical schema palette registry');

const offenders = [];
lines.forEach((line, index) => {
    const number = index + 1;
    for (const match of line.matchAll(HEX)) {
        // Allowed only as the fallback of an rx token: var(--rx-token, #hex).
        const before = line.slice(0, match.index);
        if (/var\(\s*--rx-[a-z0-9-]+\s*,\s*$/i.test(before)) continue;
        offenders.push(`${number}: ${line.trim().slice(0, 120)}`);
        break;
    }
    for (const match of line.matchAll(RGB)) {
        if (!PALETTE_RGB.has([match[1], match[2], match[3]].join(','))) continue;
        const before = line.slice(0, match.index);
        if (/var\(\s*--rx-[a-z0-9-]+\s*,\s*$/i.test(before)) continue;
        offenders.push(`${number}: ${line.trim().slice(0, 120)}`);
        break;
    }
});

assert.deepEqual(offenders, [],
    `hardcoded palette colours outside the THEMES registry (${offenders.length} line(s)). `
    + 'RumbleX-owned surfaces must read var(--rx-token, #hex) so they follow the active palette:\n  '
    + offenders.slice(0, 20).join('\n  ')
    + (offenders.length > 20 ? `\n  ...and ${offenders.length - 20} more` : ''));

// Prove the tokens exist to be read. A guard that enforces var(--rx-text)
// while nothing ever declares --rx-text would push every surface onto its
// fallback and call that a pass.
// Tokens arrive two ways: written into a CSS template as `--rx-x: value`, and
// set on an element at runtime with setProperty or through a key in a
// theme-variable object. All three count as declared.
const declared = new Set([
    // Written into a CSS template, or as a quoted key in a theme-variable map.
    ...[...source.matchAll(/(--rx-[a-z0-9-]+)['"`]?\s*:/g)].map((match) => match[1]),
    // Applied to an element at runtime.
    ...[...source.matchAll(/setProperty\(\s*['"`](--rx-[a-z0-9-]+)/g)].map((match) => match[1]),
]);
// A token read with no fallback and no declaration renders nothing at all.
// One that always carries a fallback is merely an unused hook, which is not a
// visual defect and not this guard's business.
const readWithoutFallback = new Set(
    [...source.matchAll(/var\(\s*(--rx-[a-z0-9-]+)\s*\)/g)].map((match) => match[1]),
);
const undeclared = [...readWithoutFallback].filter((token) => !declared.has(token)).sort();
assert.deepEqual(undeclared, [],
    `injected CSS reads rx tokens that nothing declares and that carry no fallback, so they resolve to nothing: ${undeclared.join(', ')}`);

const tokenised = [...source.matchAll(/var\(\s*--rx-[a-z0-9-]+\s*,\s*#[0-9a-f]{6}\s*\)/gi)].length;
console.log(
    `Theme token guard OK: no hardcoded palette colours outside the THEMES registry, `
    + `${tokenised} tokenised fallbacks, ${declared.size} declared rx tokens.`,
);
