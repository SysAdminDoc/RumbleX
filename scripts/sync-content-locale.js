#!/usr/bin/env node
/**
 * sync-content-locale.js — keep the English catalog in step with `rxT()`.
 *
 * Every `rxT(key, 'English text')` call in the shared core carries its own
 * English fallback, which makes the source readable and means a missing key
 * degrades to correct English rather than to a blank control. That fallback is
 * also the single source of truth for the catalog, so there is no second place
 * to keep in sync by hand.
 *
 *   node scripts/sync-content-locale.js          # report drift, exit 1 if any
 *   node scripts/sync-content-locale.js --write  # write en/messages.json
 *
 * Translated locales are never touched: this only ever writes English. The
 * i18n guard is what fails when a translation is missing.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const CORE = path.join(ROOT, 'extension', 'content.js');
const EN = path.join(ROOT, 'extension', '_locales', 'en', 'messages.json');

// rxT('key', 'text')  /  rxT('key', "text")  — the fallback must be a plain
// string literal, not a template, so the catalog value is extractable.
const CALL = /\brxT\(\s*'([A-Za-z0-9_]+)'\s*,\s*('(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*")/g;

function unquote(literal) {
    return literal
        .slice(1, -1)
        .replace(/\\'/g, "'")
        .replace(/\\"/g, '"')
        .replace(/\\\\/g, '\\');
}

/**
 * RX_CATEGORIES is the settings-modal data table: 137 feature labels and 124
 * descriptions that the modal renders through rxFeatLabel/rxFeatDesc/rxCatLabel.
 * The keys are derived from the entry ids, so the array itself stays the single
 * English source and there is no parallel list to keep in step by hand.
 */
function extractCategories(source) {
    const block = source.match(/const RX_CATEGORIES = \[([\s\S]*?)\n\];/);
    if (!block) return new Map();
    const out = new Map();
    // Category headers: `{ id: 'ad-blocking', label: 'Ad Blocking', color: ... }`
    const CATEGORY = /\{\s*id:\s*'([\w-]+)',\s*label:\s*'((?:[^'\\]|\\.)*)',\s*color:/g;
    for (const m of block[1].matchAll(CATEGORY)) {
        // chrome.i18n keys accept only [A-Za-z0-9_@]; category ids are kebab-case.
        out.set('cat_' + m[1].replace(/-/g, '_') + '_label', unquote("'" + m[2] + "'"));
    }
    // Feature rows: `{ id: 'adNuker', label: '...', desc: '...' }`
    const FEATURE = /\{\s*id:\s*'([\w-]+)',\s*label:\s*'((?:[^'\\]|\\.)*)',\s*desc:\s*'((?:[^'\\]|\\.)*)'/g;
    for (const m of block[1].matchAll(FEATURE)) {
        out.set('feat_' + m[1] + '_label', unquote("'" + m[2] + "'"));
        out.set('feat_' + m[1] + '_desc', unquote("'" + m[3] + "'"));
    }
    return out;
}

function extract() {
    const source = fs.readFileSync(CORE, 'utf8');
    const found = extractCategories(source);
    const conflicts = [];
    for (const match of source.matchAll(CALL)) {
        const [, key, literal] = match;
        const text = unquote(literal);
        if (found.has(key) && found.get(key) !== text) {
            conflicts.push(`${key}: "${found.get(key)}" vs "${text}"`);
        }
        found.set(key, text);
    }
    // A template-literal fallback cannot be extracted, so reject it loudly
    // rather than silently leaving the key out of the catalog.
    const templates = [...source.matchAll(/\brxT\(\s*'([A-Za-z0-9_]+)'\s*,\s*`/g)].map((m) => m[1]);
    return { found, conflicts, templates };
}

function main() {
    const write = process.argv.includes('--write');
    const { found, conflicts, templates } = extract();
    const errors = [];

    if (conflicts.length) {
        errors.push('the same key is used with two different English texts:');
        for (const line of conflicts) errors.push('  ' + line);
    }
    if (templates.length) {
        errors.push(`rxT() fallback must be a plain string, not a template literal: ${templates.join(', ')}`);
    }

    const catalog = JSON.parse(fs.readFileSync(EN, 'utf8'));
    const drift = [];
    for (const [key, text] of found) {
        if (!catalog[key]) drift.push(`+ ${key}`);
        else if (catalog[key].message !== text) drift.push(`~ ${key}`);
    }

    if (errors.length) {
        console.error('sync-content-locale failed.');
        for (const error of errors) console.error('- ' + error);
        process.exit(1);
    }

    if (!drift.length) {
        console.log(`sync-content-locale OK: ${found.size} rxT keys match the English catalog.`);
        return;
    }

    if (!write) {
        console.error(`sync-content-locale: ${drift.length} rxT key(s) drifted from en/messages.json`);
        for (const line of drift) console.error('  ' + line);
        console.error('Run: node scripts/sync-content-locale.js --write');
        process.exit(1);
    }

    for (const [key, text] of found) {
        catalog[key] = { message: text, description: catalog[key]?.description || 'In-page UI string (shared core).' };
    }
    fs.writeFileSync(EN, JSON.stringify(catalog, null, 2) + '\n');
    console.log(`sync-content-locale: wrote ${drift.length} key(s) to en/messages.json.`);
}

main();
