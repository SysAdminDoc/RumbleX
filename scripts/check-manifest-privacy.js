#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const CONTENT_PATH = path.join(ROOT, 'extension', 'content.js');
const MANIFEST_PATHS = [
    path.join(ROOT, 'extension', 'manifest.json'),
    path.join(ROOT, 'extension', 'manifest-firefox.json'),
];

function readJson(file) {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function normalizeApiPermissions(manifest) {
    return (manifest.permissions || []).filter((permission) => !String(permission).includes('://'));
}

function normalizeHostPermissions(manifest) {
    return manifest.host_permissions
        || (manifest.permissions || []).filter((permission) => String(permission).includes('://'))
        || [];
}

function normalizeWebAccessibleResources(manifest) {
    const resources = manifest.web_accessible_resources || [];
    const out = [];
    for (const entry of resources) {
        if (typeof entry === 'string') {
            out.push(entry);
        } else if (entry && Array.isArray(entry.resources)) {
            out.push(...entry.resources);
        }
    }
    return out;
}

function union(values) {
    return Array.from(new Set(values)).sort();
}

function extractObjectKeys(source, constName) {
    const marker = `const ${constName} = Object.freeze({`;
    const start = source.indexOf(marker);
    if (start < 0) throw new Error(`Missing ${constName}`);
    const bodyStart = source.indexOf('{', start);
    let depth = 0;
    let inString = null;
    let escaped = false;
    for (let i = bodyStart; i < source.length; i++) {
        const ch = source[i];
        if (escaped) {
            escaped = false;
            continue;
        }
        if (ch === '\\') {
            escaped = true;
            continue;
        }
        if (inString) {
            if (ch === inString) inString = null;
            continue;
        }
        if (ch === '\'' || ch === '"' || ch === '`') {
            inString = ch;
            continue;
        }
        if (ch === '{') depth++;
        if (ch === '}') {
            depth--;
            if (depth === 0) {
                const objectText = source.slice(bodyStart, i + 1);
                return Array.from(objectText.matchAll(/^\s*'([^']+)'\s*:/gm), (match) => match[1]).sort();
            }
        }
    }
    throw new Error(`Unterminated ${constName}`);
}

function compareSet(label, expected, actual) {
    const missing = expected.filter((value) => !actual.includes(value));
    const stale = actual.filter((value) => !expected.includes(value));
    if (!missing.length && !stale.length) return [];
    const errors = [];
    if (missing.length) errors.push(`${label} missing disclosures: ${missing.join(', ')}`);
    if (stale.length) errors.push(`${label} stale disclosures: ${stale.join(', ')}`);
    return errors;
}

const manifests = MANIFEST_PATHS.map(readJson);
const expectedPermissions = union(manifests.flatMap(normalizeApiPermissions));
const expectedHosts = union(manifests.flatMap(normalizeHostPermissions));
const expectedResources = union(manifests.flatMap(normalizeWebAccessibleResources));
const content = fs.readFileSync(CONTENT_PATH, 'utf8');

const errors = [
    ...compareSet(
        'permissions',
        expectedPermissions,
        extractObjectKeys(content, 'RX_PRIVACY_PERMISSION_DISCLOSURES'),
    ),
    ...compareSet(
        'host permissions',
        expectedHosts,
        extractObjectKeys(content, 'RX_PRIVACY_HOST_DISCLOSURES'),
    ),
    ...compareSet(
        'web accessible resources',
        expectedResources,
        extractObjectKeys(content, 'RX_PRIVACY_WEB_RESOURCE_DISCLOSURES'),
    ),
];

const requiredReportSnippets = [
    'const permissions = rxManifestApiPermissions(manifest);',
    'const hostPermissions = rxManifestHostPermissions(manifest);',
    'const webAccessibleResources = rxManifestWebAccessibleResources(manifest);',
    'permissionDisclosures,',
    'hostPermissionDisclosures,',
    'webAccessibleResourceDisclosures,',
    'externalNetworkSurfaces: hostPermissionDisclosures.map',
];

for (const snippet of requiredReportSnippets) {
    if (!content.includes(snippet)) {
        errors.push(`privacy report no longer contains required manifest-derived snippet: ${snippet}`);
    }
}

if (errors.length) {
    console.error('Manifest privacy guard failed.');
    for (const error of errors) console.error(`- ${error}`);
    process.exit(1);
}

console.log(
    `Manifest privacy guard OK: ${expectedPermissions.length} permissions, `
    + `${expectedHosts.length} hosts, ${expectedResources.length} web resources disclosed.`,
);
