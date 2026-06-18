#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const LOCALES_DIR = path.join(ROOT, 'extension', '_locales');
const SCAN_FILES = [
    path.join(ROOT, 'extension', 'manifest.json'),
    path.join(ROOT, 'extension', 'manifest-firefox.json'),
    path.join(ROOT, 'extension', 'pages', 'options.html'),
    path.join(ROOT, 'extension', 'pages', 'options.js'),
    path.join(ROOT, 'extension', 'pages', 'popup.html'),
    path.join(ROOT, 'extension', 'pages', 'popup.js'),
];

function localeNames() {
    return fs.readdirSync(LOCALES_DIR, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name)
        .sort();
}

function readMessages(locale) {
    const file = path.join(LOCALES_DIR, locale, 'messages.json');
    return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function sortedKeys(obj) {
    return Object.keys(obj).sort();
}

function extractUsedKeys() {
    const keys = new Set();
    for (const file of SCAN_FILES) {
        const source = fs.readFileSync(file, 'utf8');
        for (const match of source.matchAll(/data-i18n(?:-[a-z-]+)?=\"([A-Za-z0-9_]+)\"/g)) {
            keys.add(match[1]);
        }
        for (const match of source.matchAll(/\bi18n\(\s*['"]([A-Za-z0-9_]+)['"]/g)) {
            keys.add(match[1]);
        }
        for (const match of source.matchAll(/:\s*['"](group[A-Za-z0-9_]+|tip[A-Za-z0-9_]+)['"]/g)) {
            keys.add(match[1]);
        }
        for (const match of source.matchAll(/__MSG_([A-Za-z0-9_]+)__/g)) {
            keys.add(match[1]);
        }
    }
    return Array.from(keys).sort();
}

const LOCALES = localeNames();
if (!LOCALES.includes('en')) {
    console.error('i18n guard failed.');
    console.error('- missing required English locale folder: extension/_locales/en');
    process.exit(1);
}

const catalogs = Object.fromEntries(LOCALES.map((locale) => [locale, readMessages(locale)]));
const englishKeys = sortedKeys(catalogs.en);
const errors = [];

for (const locale of LOCALES) {
    const keys = sortedKeys(catalogs[locale]);
    const missing = englishKeys.filter((key) => !keys.includes(key));
    const extra = keys.filter((key) => !englishKeys.includes(key));
    if (missing.length) errors.push(`${locale} missing keys: ${missing.join(', ')}`);
    if (extra.length) errors.push(`${locale} has extra keys: ${extra.join(', ')}`);
}

const usedKeys = extractUsedKeys();
const missingFromEnglish = usedKeys.filter((key) => !catalogs.en[key]);
if (missingFromEnglish.length) {
    errors.push(`UI references missing English locale keys: ${missingFromEnglish.join(', ')}`);
}

for (const [locale, messages] of Object.entries(catalogs)) {
    for (const key of usedKeys) {
        const value = messages[key]?.message;
        if (typeof value !== 'string' || value.trim() === '') {
            errors.push(`${locale}.${key} has an empty message`);
        }
    }
}

if (errors.length) {
    console.error('i18n guard failed.');
    for (const error of errors) console.error(`- ${error}`);
    process.exit(1);
}

console.log(`i18n guard OK: ${englishKeys.length} locale keys, ${usedKeys.length} UI keys referenced.`);
