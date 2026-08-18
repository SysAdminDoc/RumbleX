#!/usr/bin/env node
/**
 * check-content-literals.js — ratchet on untranslated in-page UI text.
 *
 * `check-i18n.js` verifies that every key the UI *references* exists in all
 * four catalogs. It cannot see the opposite failure: user-facing text that was
 * never given a key at all. That is why four locales x 111 keys localized the
 * extension's own pages while the entire in-page experience stayed English.
 *
 * This guard counts the hardcoded user-facing literals still left in the
 * shared core and fails if the number goes UP. It is a ratchet, not a gate:
 * the remaining strings are localized surface by surface, and the baseline
 * below is lowered each time. Wrapping a string in `rxT()` removes it from the
 * count automatically, because an rxT fallback is not a bare assignment.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const CORE = path.join(ROOT, 'extension', 'content.js');

/**
 * Lower these as surfaces are localized. Never raise them: a new hardcoded
 * string is the thing this guard exists to reject.
 */
const BASELINE = {
    assignments: 71, // .textContent / .placeholder / .title = 'literal'
    ariaLabels: 41,   // setAttribute('aria-label', 'literal')
    // RX_CATEGORIES is no longer counted: the modal renders it through
    // rxFeatLabel/rxFeatDesc/rxCatLabel, and sync-content-locale.js derives the
    // catalog keys straight from the array, so those literals ARE the English
    // source. A new entry gets a key automatically and then fails check-i18n
    // until the three translated catalogs carry it.
};

// Text that is not language: numbers, punctuation, symbols, CSS-ish values,
// and single glyphs like the × used on close buttons.
const NOT_PROSE = /^[\s\d\W_]*$/u;

function assignmentLiterals(source) {
    const found = [];
    const re = /\.(textContent|placeholder|title)\s*=\s*('(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*")\s*;/g;
    for (const match of source.matchAll(re)) {
        const text = match[2].slice(1, -1);
        if (NOT_PROSE.test(text)) continue;
        found.push(text);
    }
    return found;
}

function ariaLiterals(source) {
    const found = [];
    const re = /setAttribute\(\s*'aria-label'\s*,\s*('(?:[^'\\]|\\.)*')\s*\)/g;
    for (const match of source.matchAll(re)) {
        const text = match[1].slice(1, -1);
        if (NOT_PROSE.test(text)) continue;
        found.push(text);
    }
    return found;
}

function main() {
    const source = fs.readFileSync(CORE, 'utf8');
    const counts = {
        assignments: assignmentLiterals(source).length,
        ariaLabels: ariaLiterals(source).length,

    };

    const regressions = [];
    const improvements = [];
    for (const [name, baseline] of Object.entries(BASELINE)) {
        if (counts[name] > baseline) {
            regressions.push(`${name}: ${counts[name]} hardcoded literals, baseline is ${baseline}`);
        } else if (counts[name] < baseline) {
            improvements.push(`${name}: ${counts[name]} (baseline ${baseline})`);
        }
    }

    if (regressions.length) {
        console.error('check-content-literals failed: new untranslated UI text in extension/content.js\n');
        for (const line of regressions) console.error('  ' + line);
        console.error('\nWrap the new string in rxT(\'key\', \'English text\'), then run:');
        console.error('  node scripts/sync-content-locale.js --write');
        console.error('and add the key to de/es/pt_BR before committing.');
        process.exit(1);
    }

    if (improvements.length) {
        console.error('check-content-literals: the count dropped — lower BASELINE in this file.\n');
        for (const line of improvements) console.error('  ' + line);
        process.exit(1);
    }

    const total = Object.values(counts).reduce((a, b) => a + b, 0);
    console.log(`check-content-literals OK: ${total} literals still untranslated, none new.`);
}

main();
