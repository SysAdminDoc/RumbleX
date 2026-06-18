#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const EXTENSION_ROOT = path.join(ROOT, 'extension');

const DIRECT_SINKS = [
    { kind: 'innerHTML assignment', re: /\.innerHTML\s*(?:\+=|=)/ },
    { kind: 'outerHTML assignment', re: /\.outerHTML\s*(?:\+=|=)/ },
    { kind: 'insertAdjacentHTML call', re: /\.insertAdjacentHTML\s*\(/ },
    { kind: 'createContextualFragment call', re: /\.createContextualFragment\s*\(/ },
    { kind: 'DOMParser text/html parse', re: /\.parseFromString\s*\(/ },
];

const HELPER_SINKS = [
    { kind: 'download-panel HTML helper', re: /\._setBody\s*\(/ },
];

const APPROVED_DYNAMIC_SINKS = [
    {
        file: 'extension/offscreen.js',
        contains: 'new DOMParser().parseFromString(String(msg.html || \'\'), \'text/html\')',
        reason: 'inert offscreen parse; callers receive structured probe data only',
    },
    {
        file: 'extension/content.js',
        contains: 'if (body) body.innerHTML = html;',
        context: '_setBody(html)',
        reason: 'central download-panel helper; all helper call sites are separately checked',
    },
    {
        file: 'extension/content.js',
        contains: '<span class="rx-m-badge">v${VERSION}</span>',
        reason: 'settings header template interpolates extension-owned VERSION only',
    },
    {
        file: 'extension/content.js',
        contains: '<svg viewBox="0 0 24 24" fill="currentColor">${cat.icon}</svg>',
        reason: 'settings category icons come from the extension-owned RX_CATEGORIES registry',
    },
    {
        file: 'extension/content.js',
        contains: '<span class="rx-m-version">v${VERSION}</span>',
        reason: 'settings footer template interpolates extension-owned VERSION only',
    },
    {
        file: 'extension/content.js',
        contains: '<span class="val" style="font-size:9px">${this._esc(srcShort)}</span>',
        reason: 'stats overlay uses bounded media API values and escapes the only URL-derived value',
    },
    {
        file: 'extension/content.js',
        contains: '<div class="rx-chapters-title">Chapters (${this._chapters.length})</div>',
        reason: 'chapters panel interpolates an in-memory numeric count only',
    },
];

function walk(dir) {
    const out = [];
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            if (entry.name === 'lib') continue;
            out.push(...walk(full));
        } else if (entry.isFile() && entry.name.endsWith('.js')) {
            out.push(full);
        }
    }
    return out;
}

function rel(file) {
    return path.relative(ROOT, file).replace(/\\/g, '/');
}

function lineIsComment(line) {
    const trimmed = line.trim();
    return !trimmed || trimmed.startsWith('//') || trimmed.startsWith('*');
}

function countChar(text, ch) {
    let count = 0;
    let escaped = false;
    for (const c of text) {
        if (escaped) {
            escaped = false;
            continue;
        }
        if (c === '\\') {
            escaped = true;
            continue;
        }
        if (c === ch) count++;
    }
    return count;
}

function collectStatement(lines, start) {
    const parts = [];
    let paren = 0;
    let brace = 0;
    let bracket = 0;
    let templateTicks = 0;

    for (let i = start; i < Math.min(lines.length, start + 80); i++) {
        const line = lines[i];
        parts.push(line);
        templateTicks += countChar(line, '`');
        for (const c of line) {
            if (c === '(') paren++;
            else if (c === ')') paren = Math.max(0, paren - 1);
            else if (c === '{') brace++;
            else if (c === '}') brace = Math.max(0, brace - 1);
            else if (c === '[') bracket++;
            else if (c === ']') bracket = Math.max(0, bracket - 1);
        }
        if (/[;}]$/.test(line.trim()) && templateTicks % 2 === 0 && paren === 0 && bracket === 0) {
            break;
        }
        if (i > start && /;$/.test(line.trim()) && templateTicks % 2 === 0 && bracket === 0) {
            break;
        }
    }

    return parts.join('\n');
}

function normalize(text) {
    return text.replace(/\s+/g, ' ').trim();
}

function rhsFromAssignment(statement) {
    const match = statement.match(/\.(?:innerHTML|outerHTML)\s*(?:\+=|=)\s*([\s\S]*)$/);
    return match ? match[1].trim().replace(/;$/, '').trim() : '';
}

function isEmptyClear(rhs) {
    return /^(['"`])\s*\1$/.test(rhs);
}

function isStaticString(rhs) {
    if (rhs.includes('${')) return false;
    return /^(['"`])[\s\S]*\1$/.test(rhs);
}

function isStaticSvgConstant(rhs) {
    return /^(?:this\.|VideoDownloader\.)?_[A-Za-z0-9]*SVG$/.test(rhs)
        || /^(?:this\.|VideoDownloader\.)?_[A-Za-z0-9]*SVG\s*\+\s*(['"`])[\s\S]*\1$/.test(rhs);
}

function helperArgument(statement) {
    const match = statement.match(/\._setBody\(([\s\S]*?)\)/);
    return match ? match[1].trim() : '';
}

function approvedDynamic(file, statement, context) {
    const compact = normalize(statement);
    const nearby = normalize(context + '\n' + statement);
    return APPROVED_DYNAMIC_SINKS.find((entry) => {
        if (entry.file !== file) return false;
        if (!compact.includes(entry.contains) && !nearby.includes(entry.contains)) return false;
        return !entry.context || nearby.includes(entry.context);
    });
}

function classify(file, sink, statement, context) {
    const compact = normalize(statement);
    const approved = approvedDynamic(file, statement, context);
    if (approved) return approved.reason;

    if (sink.kind === 'DOMParser text/html parse') {
        if (!compact.includes('text/html')) return 'non-html parser use';
        return null;
    }

    if (sink.kind === 'download-panel HTML helper') {
        const arg = helperArgument(statement);
        if (isEmptyClear(arg)) return 'empty download panel clear';
        if (isStaticString(arg)) return 'static download panel template';
        return null;
    }

    if (sink.kind === 'insertAdjacentHTML call' || sink.kind === 'createContextualFragment call') {
        return null;
    }

    const rhs = rhsFromAssignment(statement);
    if (isEmptyClear(rhs)) return 'empty HTML clear';
    if (isStaticString(rhs)) return 'static extension-authored markup';
    if (isStaticSvgConstant(rhs)) return 'static extension-owned SVG constant';

    return null;
}

function findSinksInFile(file) {
    const text = fs.readFileSync(file, 'utf8');
    const lines = text.split(/\r?\n/);
    const out = [];

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (lineIsComment(line)) continue;
        const relFile = rel(file);
        const context = lines.slice(Math.max(0, i - 8), i).join('\n');

        for (const sink of DIRECT_SINKS) {
            if (!sink.re.test(line)) continue;
            const statement = collectStatement(lines, i);
            if (sink.kind === 'DOMParser text/html parse' && !statement.includes('text/html')) continue;
            out.push({ file: relFile, line: i + 1, sink, statement, context });
        }

        for (const sink of HELPER_SINKS) {
            if (!sink.re.test(line)) continue;
            const statement = collectStatement(lines, i);
            out.push({ file: relFile, line: i + 1, sink, statement, context });
        }
    }

    return out;
}

const findings = [];
const approvals = [];

for (const file of walk(EXTENSION_ROOT)) {
    for (const item of findSinksInFile(file)) {
        const reason = classify(item.file, item.sink, item.statement, item.context);
        if (reason) {
            approvals.push({ ...item, reason });
        } else {
            findings.push(item);
        }
    }
}

if (findings.length) {
    console.error('DOM sink guard failed. Use DOM builders/textContent, or add a narrow approved path in scripts/check-dom-sinks.js.');
    for (const item of findings) {
        console.error(`\n${item.file}:${item.line} ${item.sink.kind}`);
        console.error(item.statement.split(/\r?\n/).slice(0, 8).join('\n'));
    }
    process.exit(1);
}

console.log(`DOM sink guard OK: ${approvals.length} approved sink path${approvals.length === 1 ? '' : 's'}.`);
