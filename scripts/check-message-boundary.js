#!/usr/bin/env node
'use strict';

const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const background = fs.readFileSync(path.join(ROOT, 'extension', 'background.js'), 'utf8');
const offscreen = fs.readFileSync(path.join(ROOT, 'extension', 'offscreen.js'), 'utf8');

const registryBlock = background.match(
    /const RX_MESSAGE_ACTIONS = Object\.freeze\(\{([\s\S]*?)\n\}\);/,
);
assert.ok(registryBlock, 'background message action registry is missing');

const registered = new Set(
    [...registryBlock[1].matchAll(/^ {4}([A-Za-z][A-Za-z0-9]*): rxMessageRule\(/gm)]
        .map((match) => match[1]),
);
const handled = new Set(
    [...background.matchAll(/message\.action === '([^']+)'/g)]
        .map((match) => match[1]),
);

assert.deepEqual(
    [...handled].filter((action) => !registered.has(action)),
    [],
    'background actions without a sender/payload rule',
);
assert.deepEqual(
    [...registered].filter((action) => !handled.has(action)),
    [],
    'message registry entries without a background handler',
);
assert.match(
    background,
    /const authorization = rxAuthorizeRuntimeMessage\(message, sender\);/,
    'background listener does not enforce the registry before dispatch',
);
assert.match(
    background,
    /Object\.hasOwn\(RX_MESSAGE_ACTIONS, message\.action\)/,
    'background message lookup does not reject inherited action names',
);
assert.match(
    background,
    /u\.protocol !== 'https:' \|\| u\.username \|\| u\.password/,
    'privileged download URLs do not require credential-free HTTPS',
);
assert.match(
    background,
    /authorization\.senderClass === RX_MESSAGE_SENDER\.CONTENT_SCRIPT[\s\S]*?sanitizeSettingsForTransport\(normalized\)/,
    'content-script settings reads are not stripped of extension-page credentials',
);
assert.match(
    offscreen,
    /sender\?\.id !== chrome\.runtime\.id \|\| senderOrigin !== ownOrigin/,
    'offscreen listener does not require an extension-origin sender',
);

console.log(`Message boundary guard OK: ${registered.size} actions have sender classes and payload schemas; offscreen is extension-origin only.`);
