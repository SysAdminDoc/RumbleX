#!/usr/bin/env python3
import email
import re

def extract_html(path):
    with open(path, 'rb') as f:
        msg = email.message_from_binary_file(f)
    best = ''
    for part in msg.walk():
        if part.get_content_type() != 'text/html':
            continue
        payload = part.get_payload(decode=True)
        if not payload:
            continue
        charset = part.get_content_charset() or 'utf-8'
        try:
            text = payload.decode(charset, errors='replace')
        except LookupError:
            text = payload.decode('utf-8', errors='replace')
        if len(text) > len(best):
            best = text
    return best

def show(label, html, term, n=3, pre=80, post=350):
    print(f'\n=== {label}: [{term}] ===')
    idx = 0
    count = 0
    while count < n:
        pos = html.lower().find(term.lower(), idx)
        if pos == -1:
            break
        snippet = re.sub(r'\s+', ' ', html[max(0, pos - pre):pos + post])
        print(' ', snippet)
        idx = pos + len(term)
        count += 1

pages = {
    'VOD':  r'C:\Users\--\repos\RumbleX\Sample Pages\VOD-Watch Page.mhtml',
    'Live': r'C:\Users\--\repos\RumbleX\Sample Pages\Live.mhtml',
    'Feed': r'C:\Users\--\repos\RumbleX\Sample Pages\My Feed.mhtml',
    'ForYou': r'C:\Users\--\repos\RumbleX\Sample Pages\For You.mhtml',
}

feed_html  = extract_html(pages['Feed'])
foryou_html= extract_html(pages['ForYou'])
vod_html   = extract_html(pages['VOD'])
live_html  = extract_html(pages['Live'])

# ─── FEED: find channel/author link ─────────────────────────────────
print('\n=== FEED: all hrefs inside videostream__footer ===')
for m in list(re.finditer(r'videostream__footer', feed_html))[:3]:
    chunk = feed_html[m.start():m.start()+600]
    print(' ', re.sub(r'\s+',' ',chunk))

print('\n=== FEED: href="/c/ links (channel links) ===')
for m in list(re.finditer(r'href="https://rumble\.com/c/', feed_html))[:5]:
    print(' ', re.sub(r'\s+', ' ', feed_html[max(0,m.start()-80):m.start()+200]))

print('\n=== FEED: href="/user/ links (user links) ===')
for m in list(re.finditer(r'href="https://rumble\.com/user/', feed_html))[:3]:
    print(' ', re.sub(r'\s+', ' ', feed_html[max(0,m.start()-80):m.start()+200]))

# look for author class name in feed
print('\n=== FEED: *author* class occurrences ===')
found = set()
for m in re.finditer(r'class="([^"]*author[^"]*)"', feed_html, re.I):
    found.add(m.group(0))
for f in sorted(found):
    print(' ', f)

# ─── LIVE: rant data-level ─────────────────────────────────────────
print('\n=== LIVE: data-level in rant elements ===')
show('LIVE', live_html, 'data-level', n=5, pre=80, post=200)

# ─── LIVE: chat scroll container id ────────────────────────────────
print('\n=== LIVE: chat-history id/class ===')
for m in list(re.finditer(r'id="js-chat|class="chat-history[^"]*"', live_html))[:6]:
    print(' ', re.sub(r'\s+',' ',live_html[max(0,m.start()-20):m.start()+200]))

# ─── VOD: description + timestamps ─────────────────────────────────
show('VOD', vod_html, 'media-description-section', n=2, pre=40, post=400)
show('VOD', vod_html, 'comment-text',               n=3, pre=40, post=300)

# ─── VOD: share modal / copy link ──────────────────────────────────
show('VOD', vod_html, 'share', n=6, pre=60, post=300)

# ─── VOD: video-id on watch page ───────────────────────────────────
print('\n=== VOD: data-video-id ===')
for m in list(re.finditer(r'data-video-id="[^"]+"', vod_html))[:4]:
    print(' ', re.sub(r'\s+',' ',vod_html[max(0,m.start()-40):m.start()+150]))

# ─── FEED: videostream data-video-id ───────────────────────────────
print('\n=== FEED: data-video-id on feed items ===')
for m in list(re.finditer(r'data-video-id="[^"]+"', feed_html))[:4]:
    print(' ', re.sub(r'\s+',' ',feed_html[max(0,m.start()-80):m.start()+250]))
