#!/usr/bin/env node
'use strict';

// RumbleX-owned surfaces must follow the active palette.
//
// The failure this prevents: the project ships five palettes, but ~190 lines of
// injected CSS pinned Catppuccin Mocha hexes outright, so the watch-progress
// bar, the resume toast and the toast stack rendered in Catppuccin pink and
// blue no matter which theme the user picked. Nothing failed. The colours were
// simply wrong on four themes out of five, and only a screenshot of the right
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

const ROOT = path.resolve(__dirname, '..');
const CONTENT = path.join(ROOT, 'extension', 'content.js');
const source = fs.readFileSync(CONTENT, 'utf8');
const lines = source.split(/\r?\n/);

// Every colour in the Catppuccin Mocha palette the registry declares, which is
// the set a hardcoded value would be drawn from.
const PALETTE = Object.freeze([
    '1e1e2e', '181825', '11111b',
    '313244', '45475a', '585b70',
    'cdd6f4', 'a6adc8', '6c7086',
    '89b4fa', 'a6e3a1', 'f38ba8',
    'f9e2af', 'fab387',
]);
const HEX = new RegExp(`#(${PALETTE.join('|')})\\b`, 'gi');

const themesStart = lines.findIndex((line) => line.startsWith('const THEMES = {'));
assert.ok(themesStart >= 0, 'THEMES registry not found in extension/content.js');
const themesEnd = lines.findIndex((line, index) => index > themesStart && line.startsWith('};'));
assert.ok(themesEnd > themesStart, 'THEMES registry has no closing brace');

// Registry sanity: every palette colour this guard polices must actually be
// declared there. Otherwise the list rots and the guard quietly polices less.
const registry = lines.slice(themesStart, themesEnd + 1).join('\n');
const missing = PALETTE.filter((hex) => !new RegExp(`#${hex}\\b`, 'i').test(registry));
assert.deepEqual(missing, [],
    `palette colours this guard polices but the THEMES registry no longer declares: ${missing.join(', ')}. `
    + 'Update the PALETTE list to match the registry.');

const offenders = [];
lines.forEach((line, index) => {
    const number = index + 1;
    if (number >= themesStart + 1 && number <= themesEnd + 1) return;
    for (const match of line.matchAll(HEX)) {
        // Allowed only as the fallback of an rx token: var(--rx-token, #hex).
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
