---
name: Bug report
about: Something doesn't work as expected
title: '[bug] '
labels: bug
---

## What broke

Short description of the symptom.

## Steps to reproduce

1.
2.
3.

## Expected

What you thought would happen.

## Actual

What actually happened. Include console errors if any (`F12` → Console).

## Environment

- RumbleX version: (check `chrome://extensions` or the popup footer)
- Browser + version: (e.g. Chrome 140 / Firefox 127 / Brave 1.66 / Edge 140)
- OS: (Windows 11 / macOS 14 / Linux distro / Android)
- Page where it broke: (URL is fine, redact account-specific paths)

## Settings state (if relevant)

Open the options page → Privacy report panel → click **Export JSON**. Paste the
`enabledFeatures`, `featureCount`, `schemaVersion`, and `notes` fields here.
Don't paste the full localStorage byte counts unless asked.

## Screenshots / video

Optional but very helpful for visual bugs.
