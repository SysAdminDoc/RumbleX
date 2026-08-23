#!/usr/bin/env node
'use strict';

const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');
const {
    createDeterministicZip,
    writeFileAtomically,
} = require('./zip-utils');

const ROOT = path.resolve(__dirname, '..');
const EXT = path.join(ROOT, 'extension');
const OUTPUT = path.join(ROOT, 'RumbleX-firefox-amo-unsigned.zip');

function readPackageDeclarations() {
    const buildScript = fs.readFileSync(path.join(EXT, 'build.sh'), 'utf8');
    const files = (buildScript.match(/^PACK_FILES="([^"]+)"/m) || [])[1];
    const directories = (buildScript.match(/^PACK_DIRS="([^"]+)"/m) || [])[1];
    assert.ok(files, 'extension/build.sh does not declare PACK_FILES');
    assert.ok(directories, 'extension/build.sh does not declare PACK_DIRS');
    return {
        files: files.trim().split(/\s+/),
        directories: directories.trim().split(/\s+/),
    };
}

function collectDirectory(directory, entries) {
    const root = path.join(EXT, directory);
    const visit = (current) => {
        for (const item of fs.readdirSync(current, { withFileTypes: true })) {
            if (item.name === '.DS_Store') continue;
            const absolute = path.join(current, item.name);
            if (item.isDirectory()) visit(absolute);
            else if (item.isFile()) {
                entries.push({
                    name: path.relative(EXT, absolute).split(path.sep).join('/'),
                    data: fs.readFileSync(absolute),
                });
            }
        }
    };
    visit(root);
}

function createFirefoxArchive() {
    const declarations = readPackageDeclarations();
    const entries = [{
        name: 'manifest.json',
        data: fs.readFileSync(path.join(EXT, 'manifest-firefox.json')),
    }];
    for (const file of declarations.files) {
        entries.push({ name: file, data: fs.readFileSync(path.join(EXT, file)) });
    }
    for (const directory of declarations.directories) collectDirectory(directory, entries);
    return createDeterministicZip(entries);
}

function buildFirefoxArchive() {
    const archive = createFirefoxArchive();
    writeFileAtomically(OUTPUT, archive);
    return archive;
}

if (require.main === module) {
    const archive = buildFirefoxArchive();
    console.log(`Wrote ${path.basename(OUTPUT)} (${archive.length} bytes, deterministic AMO submission)`);
}

module.exports = {
    OUTPUT,
    buildFirefoxArchive,
    createFirefoxArchive,
};
