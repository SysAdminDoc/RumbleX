---
name: Selector regression
about: A RumbleX feature stopped working because Rumble changed its DOM
title: '[selector] '
labels: bug, selector
---

## Which feature broke

Name from the in-page settings modal or options page (e.g. AdNuker, ThemeSplit, ChatUserBlock, ExternalPlayer).

## Which Rumble surface

(Home / For You / Subscriptions / VOD watch / Live watch / Search / Channel / Account / Shorts / Studio)

URL where you saw the breakage:

## What you observed

What stopped showing, or what shows now that shouldn't.

## Selector telemetry (very helpful)

1. Open the options page → **Advanced** group → enable **Debug Selector Telemetry**.
2. Reload the affected Rumble page and reproduce the bug.
3. Open the options page → **Privacy report** section → click **Export selector telemetry**.
4. Paste the JSON here (or attach the file).

## Suggested selector update (optional)

If you've inspected the DOM and have a working selector, share it. Stable selectors prefer `data-js`, `data-*`, `aria-*`, IDs, or structure over hashed class names.
