#!/usr/bin/env node
/**
 * check-a11y-controls.js — static keyboard-operability guard for the injected UI.
 *
 * axe-core can prove that a rendered control has an accessible name, but it
 * cannot see a `<div>` that only responds to `click`: with no role and no
 * tabindex, axe reads it as inert text and passes it. That is precisely the
 * defect class this project shipped for 20+ releases — chapter rows, transcript
 * cues, description timestamps, batch-download checkboxes and the settings
 * chips were all click-only `<div>`/`<span>` elements, unreachable without a
 * mouse.
 *
 * So this guard works from the source instead: any element created as a
 * non-interactive tag that later receives a `click`/`mousedown` handler is a
 * failure unless it is explicitly allowlisted below.
 *
 * Companion to the runtime scans in tests/e2e/a11y.spec.js — neither one
 * subsumes the other.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const EXTENSION = path.join(__dirname, '..', 'extension');
const CORE_FILES = [
    'core-routing.js',
    'core-selectors.js',
    'core-video-cards.js',
    'core-media.js',
    'content.js',
].map((file) => path.join(EXTENSION, file));

// Tags with no native activation behaviour and no implicit role that would
// make them keyboard-operable.
const NON_INTERACTIVE = new Set(['span', 'div', 'li', 'td', 'p', 'img', 'section', 'header', 'footer']);

/**
 * Dialog backdrops: the click handler implements click-outside-to-dismiss,
 * which is a redundant pointer convenience. Each of these dialogs also ships a
 * real <button> close control, and Escape closes them, so the backdrop itself
 * is not the only route out. Keyed by the variable's declaring line content so
 * an unrelated new `<div>` cannot inherit the exemption.
 */
const ALLOWED_BACKDROPS = [
    "overlay.id = 'rx-download-overlay';",
    "overlay.className = 'rx-history-overlay';",
    "overlay.className = 'rx-bookmarks-overlay';",
    "overlay.id = 'rx-overlay';",
];

function main() {
    const lines = CORE_FILES.map((file) => fs.readFileSync(file, 'utf8')).join('\n\n').split(/\r?\n/);

    // Every `x = document.createElement('tag')`, in source order.
    const decls = [];
    lines.forEach((line, i) => {
        const m = line.match(/(?:const|let|var\s+)?\s*([A-Za-z_$][\w$.]*)\s*=\s*document\.createElement\('([a-z]+)'\)/);
        if (m) decls.push({ name: m[1], tag: m[2], line: i });
    });

    const resolve = (name, atLine) => {
        let best = null;
        for (const d of decls) {
            if (d.name === name && d.line <= atLine) best = d;
        }
        return best;
    };

    const failures = [];
    lines.forEach((line, i) => {
        const m = line.match(/([A-Za-z_$][\w$.]*)\.addEventListener\('(?:click|mousedown)'/);
        if (!m) return;
        const decl = resolve(m[1], i);
        if (!decl) return;
        // A declaration far above the handler is almost certainly a different
        // scope that happens to reuse the variable name.
        if (i - decl.line > 120) return;
        if (!NON_INTERACTIVE.has(decl.tag)) return;

        // The lines right after the declaration configure the element; that is
        // where the allowlist key lives.
        const configured = lines.slice(decl.line, decl.line + 6).map((l) => l.trim());
        if (ALLOWED_BACKDROPS.some((key) => configured.includes(key))) return;

        failures.push(
            `  shared-core:${i + 1} — <${decl.tag}> "${m[1]}" (created at line ${decl.line + 1}) takes a click `
            + 'handler but is not a button/link and carries no role+tabindex.',
        );
    });

    if (failures.length) {
        console.error('FAIL check-a11y-controls: click-only non-interactive elements found\n');
        console.error(failures.join('\n'));
        console.error(
            '\nMake the element a <button type="button"> (reset its CSS with '
            + 'appearance:none/background:none/border:0 and add a :focus-visible outline), '
            + 'give it an aria-label, or add it to ALLOWED_BACKDROPS with a justification.',
        );
        process.exit(1);
    }

    console.log(
        `PASS check-a11y-controls: no click-only non-interactive elements `
        + `(${decls.length} createElement sites scanned, ${ALLOWED_BACKDROPS.length} backdrops allowlisted).`,
    );
}

main();
