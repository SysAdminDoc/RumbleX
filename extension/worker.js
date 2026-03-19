// RumbleX v1.0.0 - Transmux Worker
// Runs mux.js in a Web Worker: TS -> fMP4 (mux.js) -> regular MP4 (defragmenter)
'use strict';

importScripts('lib/mux.min.js');

// ── MP4 box helpers ──────────────────────────────────────────────────
const r32 = (d, o) => ((d[o] << 24) | (d[o+1] << 16) | (d[o+2] << 8) | d[o+3]) >>> 0;
const s4  = (d, o) => String.fromCharCode(d[o], d[o+1], d[o+2], d[o+3]);

function findBox(d, s, e, type) {
    let o = s;
    while (o + 8 <= e) {
        const sz = r32(d, o);
        if (sz < 8) return null;
        if (s4(d, o + 4) === type) return { o, sz, d: o + 8 };
        o += sz;
    }
    return null;
}

function findBoxes(d, s, e, type) {
    const res = [];
    let o = s;
    while (o + 8 <= e) {
        const sz = r32(d, o);
        if (sz < 8) break;
        if (s4(d, o + 4) === type) res.push({ o, sz, d: o + 8 });
        o += sz;
    }
    return res;
}

// Build a container box (no version/flags)
function box(type, ...children) {
    let total = 8;
    for (const c of children) total += c.byteLength;
    const b = new Uint8Array(total);
    const v = new DataView(b.buffer);
    v.setUint32(0, total);
    b[4] = type.charCodeAt(0); b[5] = type.charCodeAt(1);
    b[6] = type.charCodeAt(2); b[7] = type.charCodeAt(3);
    let off = 8;
    for (const c of children) { b.set(c, off); off += c.byteLength; }
    return b;
}

// Build a full box (with version + flags)
function fbox(type, ver, flags, payload) {
    const total = 12 + payload.byteLength;
    const b = new Uint8Array(total);
    const v = new DataView(b.buffer);
    v.setUint32(0, total);
    b[4] = type.charCodeAt(0); b[5] = type.charCodeAt(1);
    b[6] = type.charCodeAt(2); b[7] = type.charCodeAt(3);
    b[8] = ver;
    b[9] = (flags >>> 16) & 0xff; b[10] = (flags >>> 8) & 0xff; b[11] = flags & 0xff;
    b.set(payload, 12);
    return b;
}

// ── Parse fMP4 init segment ─────────────────────────────────────────
function parseInit(init) {
    const ftypBox = findBox(init, 0, init.length, 'ftyp');
    const moovBox = findBox(init, 0, init.length, 'moov');
    if (!ftypBox || !moovBox) throw new Error('Invalid init segment');

    const ftyp = init.slice(ftypBox.o, ftypBox.o + ftypBox.sz);
    const tracks = [];

    for (const trak of findBoxes(init, moovBox.d, moovBox.o + moovBox.sz, 'trak')) {
        const tkhd = findBox(init, trak.d, trak.o + trak.sz, 'tkhd');
        const mdia = findBox(init, trak.d, trak.o + trak.sz, 'mdia');
        if (!tkhd || !mdia) continue;

        const mdhd = findBox(init, mdia.d, mdia.o + mdia.sz, 'mdhd');
        const hdlr = findBox(init, mdia.d, mdia.o + mdia.sz, 'hdlr');
        const minf = findBox(init, mdia.d, mdia.o + mdia.sz, 'minf');
        if (!mdhd || !hdlr || !minf) continue;

        const stbl = findBox(init, minf.d, minf.o + minf.sz, 'stbl');
        if (!stbl) continue;
        const stsd = findBox(init, stbl.d, stbl.o + stbl.sz, 'stsd');
        if (!stsd) continue;

        const tkVer = init[tkhd.d];
        const trackId   = tkVer === 1 ? r32(init, tkhd.d + 20) : r32(init, tkhd.d + 12);
        const mdVer = init[mdhd.d];
        const timescale = mdVer === 1 ? r32(init, mdhd.d + 20) : r32(init, mdhd.d + 12);
        const handler   = s4(init, hdlr.d + 8);

        // Width/height from tkhd (fixed-point 16.16)
        const whOff = tkVer === 1 ? tkhd.d + 84 : tkhd.d + 76;
        const width  = r32(init, whOff) >>> 16;
        const height = r32(init, whOff + 4) >>> 16;

        tracks.push({
            id: trackId, timescale, handler,
            width, height,
            stsdBox: init.slice(stsd.o, stsd.o + stsd.sz),
            hdlrBox: init.slice(hdlr.o, hdlr.o + hdlr.sz),
            samples: [],        // { duration, size, isSync, cto }
            chunkOffsets: [],    // byte offset within concatenated mdat payload
            chunkSampleCounts: [],
            totalDuration: 0,
        });
    }

    return { ftyp, tracks };
}

// ── Parse fMP4 fragments → sample tables + mdat slices ──────────────
function parseFragments(fragments, tracks) {
    const mdatSlices = [];
    let mdatCursor = 0;

    for (const frag of fragments) {
        // Find ALL moof+mdat pairs in each fragment (combined mode has 2 pairs)
        const moofs = findBoxes(frag, 0, frag.length, 'moof');
        const mdats = findBoxes(frag, 0, frag.length, 'mdat');
        if (!moofs.length || !mdats.length) continue;

        // Slice out ALL mdat payloads
        for (const mdat of mdats) {
            mdatSlices.push(frag.subarray(mdat.d, mdat.o + mdat.sz));
        }

        // Process each moof+mdat pair
        for (let mi = 0; mi < moofs.length; mi++) {
            const moof = moofs[mi];
            const mdat = mdats[mi] || mdats[mdats.length - 1]; // fallback to last mdat

            for (const traf of findBoxes(frag, moof.d, moof.o + moof.sz, 'traf')) {
                const tfhd = findBox(frag, traf.d, traf.o + traf.sz, 'tfhd');
                const trun = findBox(frag, traf.d, traf.o + traf.sz, 'trun');
                if (!tfhd || !trun) continue;

                // ── tfhd ──
                const tfFlags = (frag[tfhd.d + 1] << 16) | (frag[tfhd.d + 2] << 8) | frag[tfhd.d + 3];
                const tId = r32(frag, tfhd.d + 4);
                let p = tfhd.d + 8;
                if (tfFlags & 0x01) p += 8;  // base-data-offset
                if (tfFlags & 0x02) p += 4;  // sample-description-index
                let defDur = 0, defSize = 0, defFlags = 0;
                if (tfFlags & 0x08) { defDur   = r32(frag, p); p += 4; }
                if (tfFlags & 0x10) { defSize  = r32(frag, p); p += 4; }
                if (tfFlags & 0x20) { defFlags = r32(frag, p); p += 4; }

                // ── trun ──
                const trFlags = (frag[trun.d + 1] << 16) | (frag[trun.d + 2] << 8) | frag[trun.d + 3];
                const sampleCount = r32(frag, trun.d + 4);
                let tp = trun.d + 8;
                let dataOffset = 0;
                if (trFlags & 0x001) {
                    dataOffset = r32(frag, tp);
                    if (dataOffset > 0x7FFFFFFF) dataOffset -= 0x100000000; // signed
                    tp += 4;
                }
                let firstSampleFlags = defFlags;
                if (trFlags & 0x004) { firstSampleFlags = r32(frag, tp); tp += 4; }

                const track = tracks.find(t => t.id === tId);
                if (!track) continue;

                // Chunk data position: moofStart + dataOffset → relative to mdat payload
                const chunkRelOffset = mdatCursor + (moof.o + dataOffset) - mdat.d;
                track.chunkOffsets.push(chunkRelOffset);
                track.chunkSampleCounts.push(sampleCount);

                for (let i = 0; i < sampleCount; i++) {
                    let dur = defDur, sz = defSize;
                    let fl = (i === 0) ? firstSampleFlags : defFlags;
                    let cto = 0;
                    if (trFlags & 0x100) { dur = r32(frag, tp); tp += 4; }
                    if (trFlags & 0x200) { sz  = r32(frag, tp); tp += 4; }
                    if (trFlags & 0x400) { fl  = r32(frag, tp); tp += 4; }
                    if (trFlags & 0x800) {
                        cto = r32(frag, tp);
                        if (cto > 0x7FFFFFFF) cto -= 0x100000000;
                        tp += 4;
                    }
                    const isSync = !(fl & 0x10000);
                    track.samples.push({ duration: dur, size: sz, isSync, cto });
                    track.totalDuration += dur;
                }
            }
        }

        // Advance mdat cursor by total mdat payload in this fragment
        for (const mdat of mdats) {
            mdatCursor += (mdat.o + mdat.sz) - mdat.d;
        }
    }

    return mdatSlices;
}

// ── Build non-fragmented MP4 ────────────────────────────────────────
function buildRegularMP4(ftyp, tracks, mdatSlices) {
    const totalMdatPayload = mdatSlices.reduce((s, c) => s + c.byteLength, 0);

    // ── mvhd (version 0, timescale=1000) ──
    const mvhdP = new Uint8Array(96);
    const mvhdV = new DataView(mvhdP.buffer);
    mvhdV.setUint32(8, 1000);  // timescale
    const maxDurMs = Math.max(...tracks.map(t =>
        Math.round(t.totalDuration / t.timescale * 1000)));
    mvhdV.setUint32(12, maxDurMs); // duration
    mvhdV.setUint32(16, 0x00010000); // rate = 1.0
    mvhdV.setUint16(20, 0x0100);     // volume = 1.0
    // Identity matrix (starts at offset 32 in mvhd payload: 4+4+4+4+4+2+10reserved=32)
    mvhdV.setUint32(32, 0x00010000);
    mvhdV.setUint32(48, 0x00010000);
    mvhdV.setUint32(64, 0x40000000);
    mvhdV.setUint32(92, tracks.length + 1); // next_track_id
    const mvhd = fbox('mvhd', 0, 0, mvhdP);

    // ── Build each trak ──
    const trakBoxes = tracks.map(track => {
        const isVideo = track.handler === 'vide';
        const durMs = Math.round(track.totalDuration / track.timescale * 1000);

        // tkhd (v0)
        const tkhdP = new Uint8Array(80);
        const tkhdV = new DataView(tkhdP.buffer);
        tkhdV.setUint32(8, track.id);   // track_id
        tkhdV.setUint32(16, durMs);      // duration (mvhd timescale=1000)
        if (!isVideo) tkhdV.setUint16(32, 0x0100); // volume
        tkhdV.setUint32(36, 0x00010000); // matrix
        tkhdV.setUint32(52, 0x00010000);
        tkhdV.setUint32(68, 0x40000000);
        if (isVideo) {
            tkhdV.setUint32(72, track.width << 16);
            tkhdV.setUint32(76, track.height << 16);
        }
        const tkhd = fbox('tkhd', 0, 3, tkhdP); // flags=3: enabled + in_movie

        // mdhd (v0)
        const mdhdP = new Uint8Array(20);
        const mdhdV = new DataView(mdhdP.buffer);
        mdhdV.setUint32(8, track.timescale);
        mdhdV.setUint32(12, track.totalDuration);
        mdhdV.setUint16(16, 0x55C4); // language = 'und'
        const mdhdBox = fbox('mdhd', 0, 0, mdhdP);

        // vmhd / smhd
        const mediaHdr = isVideo
            ? fbox('vmhd', 0, 1, new Uint8Array(8))
            : fbox('smhd', 0, 0, new Uint8Array(4));

        // dinf > dref
        const urlBox = fbox('url ', 0, 1, new Uint8Array(0));
        const drefP = new Uint8Array(4 + urlBox.byteLength);
        new DataView(drefP.buffer).setUint32(0, 1);
        drefP.set(urlBox, 4);
        const dinf = box('dinf', fbox('dref', 0, 0, drefP));

        // ── stbl tables ──

        // stts (time-to-sample: run-length encoded durations)
        const runs = [];
        for (const s of track.samples) {
            if (runs.length && runs[runs.length - 1][1] === s.duration) {
                runs[runs.length - 1][0]++;
            } else {
                runs.push([1, s.duration]);
            }
        }
        const sttsP = new Uint8Array(4 + runs.length * 8);
        const sttsV = new DataView(sttsP.buffer);
        sttsV.setUint32(0, runs.length);
        for (let i = 0; i < runs.length; i++) {
            sttsV.setUint32(4 + i * 8, runs[i][0]);
            sttsV.setUint32(8 + i * 8, runs[i][1]);
        }
        const stts = fbox('stts', 0, 0, sttsP);

        // ctts (composition time offsets) - only if any non-zero cto exists
        let ctts = null;
        if (track.samples.some(s => s.cto !== 0)) {
            const ctoRuns = [];
            for (const s of track.samples) {
                if (ctoRuns.length && ctoRuns[ctoRuns.length - 1][1] === s.cto) {
                    ctoRuns[ctoRuns.length - 1][0]++;
                } else {
                    ctoRuns.push([1, s.cto]);
                }
            }
            const cttsP = new Uint8Array(4 + ctoRuns.length * 8);
            const cttsV = new DataView(cttsP.buffer);
            cttsV.setUint32(0, ctoRuns.length);
            for (let i = 0; i < ctoRuns.length; i++) {
                cttsV.setUint32(4 + i * 8, ctoRuns[i][0]);
                cttsV.setInt32(8 + i * 8, ctoRuns[i][1]); // signed for v1
            }
            ctts = fbox('ctts', 1, 0, cttsP); // version 1 for signed offsets
        }

        // stsz (sample sizes)
        const stszP = new Uint8Array(8 + track.samples.length * 4);
        const stszV = new DataView(stszP.buffer);
        stszV.setUint32(0, 0); // sample_size=0 (variable)
        stszV.setUint32(4, track.samples.length);
        for (let i = 0; i < track.samples.length; i++) {
            stszV.setUint32(8 + i * 4, track.samples[i].size);
        }
        const stszBox = fbox('stsz', 0, 0, stszP);

        // stsc (sample-to-chunk)
        const stscEntries = [];
        for (let i = 0; i < track.chunkSampleCounts.length; i++) {
            const cnt = track.chunkSampleCounts[i];
            if (!stscEntries.length || stscEntries[stscEntries.length - 1][1] !== cnt) {
                stscEntries.push([i + 1, cnt, 1]); // 1-based chunk index
            }
        }
        const stscP = new Uint8Array(4 + stscEntries.length * 12);
        const stscV = new DataView(stscP.buffer);
        stscV.setUint32(0, stscEntries.length);
        for (let i = 0; i < stscEntries.length; i++) {
            stscV.setUint32(4 + i * 12, stscEntries[i][0]);
            stscV.setUint32(8 + i * 12, stscEntries[i][1]);
            stscV.setUint32(12 + i * 12, stscEntries[i][2]);
        }
        const stsc = fbox('stsc', 0, 0, stscP);

        // co64 (chunk offsets - 64-bit for large files)
        // Store relative-to-mdat-payload offsets; adjusted after moov size is known
        const co64P = new Uint8Array(4 + track.chunkOffsets.length * 8);
        const co64V = new DataView(co64P.buffer);
        co64V.setUint32(0, track.chunkOffsets.length);
        for (let i = 0; i < track.chunkOffsets.length; i++) {
            const off = track.chunkOffsets[i];
            co64V.setUint32(4 + i * 8, Math.floor(off / 0x100000000));
            co64V.setUint32(8 + i * 8, off >>> 0);
        }
        const co64 = fbox('co64', 0, 0, co64P);

        // stss (sync samples) - video only
        let stss = null;
        if (isVideo) {
            const syncs = [];
            for (let i = 0; i < track.samples.length; i++) {
                if (track.samples[i].isSync) syncs.push(i + 1); // 1-based
            }
            const stssP = new Uint8Array(4 + syncs.length * 4);
            const stssV = new DataView(stssP.buffer);
            stssV.setUint32(0, syncs.length);
            for (let i = 0; i < syncs.length; i++) {
                stssV.setUint32(4 + i * 4, syncs[i]);
            }
            stss = fbox('stss', 0, 0, stssP);
        }

        const stblChildren = [track.stsdBox, stts];
        if (ctts) stblChildren.push(ctts);
        stblChildren.push(stszBox, stsc, co64);
        if (stss) stblChildren.push(stss);
        const stbl = box('stbl', ...stblChildren);

        const minfBox = box('minf', mediaHdr, dinf, stbl);
        const mdiaBox = box('mdia', mdhdBox, track.hdlrBox, minfBox);
        return box('trak', tkhd, mdiaBox);
    });

    const moov = box('moov', mvhd, ...trakBoxes);

    // ── Adjust co64 offsets ──
    // mdat header is 8 bytes (or 16 for >4GB files)
    const useLargeMdat = (totalMdatPayload + 8) > 0xFFFFFFFF;
    const mdatHdrSize = useLargeMdat ? 16 : 8;
    const mdatPayloadFileOffset = ftyp.byteLength + moov.byteLength + mdatHdrSize;

    // Scan moov for co64 boxes and add the file offset delta
    for (let i = 0; i < moov.byteLength - 8; i++) {
        if (moov[i+4] === 0x63 && moov[i+5] === 0x6F &&
            moov[i+6] === 0x36 && moov[i+7] === 0x34) { // 'co64'
            const bxSz = r32(moov, i);
            if (bxSz < 20 || i + bxSz > moov.byteLength) continue;
            const cnt = r32(moov, i + 16);
            if (bxSz !== 16 + cnt * 8) continue; // sanity check
            for (let j = 0; j < cnt; j++) {
                const eo = i + 20 + j * 8;
                const dv = new DataView(moov.buffer, moov.byteOffset + eo, 8);
                const hi = dv.getUint32(0);
                const lo = dv.getUint32(4);
                const orig = hi * 0x100000000 + lo;
                const adj = orig + mdatPayloadFileOffset;
                dv.setUint32(0, Math.floor(adj / 0x100000000));
                dv.setUint32(4, adj >>> 0);
            }
            i += bxSz - 1; // skip past box
        }
    }

    // ── mdat header ──
    let mdatHdr;
    if (useLargeMdat) {
        mdatHdr = new Uint8Array(16);
        const dv = new DataView(mdatHdr.buffer);
        dv.setUint32(0, 1); // size=1 → use largesize
        mdatHdr[4] = 0x6D; mdatHdr[5] = 0x64; mdatHdr[6] = 0x61; mdatHdr[7] = 0x74;
        const largeSz = 16 + totalMdatPayload;
        dv.setUint32(8, Math.floor(largeSz / 0x100000000));
        dv.setUint32(12, largeSz >>> 0);
    } else {
        mdatHdr = new Uint8Array(8);
        const dv = new DataView(mdatHdr.buffer);
        dv.setUint32(0, 8 + totalMdatPayload);
        mdatHdr[4] = 0x6D; mdatHdr[5] = 0x64; mdatHdr[6] = 0x61; mdatHdr[7] = 0x74;
    }

    // ── Assemble final MP4: ftyp + moov + mdat(header + payloads) ──
    return new Blob([ftyp, moov, mdatHdr, ...mdatSlices], { type: 'video/mp4' });
}

// ── Main message handler ────────────────────────────────────────────
self.addEventListener('message', (e) => {
    const { id, action, buffers } = e.data;
    if (action !== 'transmux') return;

    try {
        // Step 1: Transmux TS → fMP4 using mux.js
        const transmuxer = new muxjs.mp4.Transmuxer({
            keepOriginalTimestamps: false
        });
        transmuxer.setBaseMediaDecodeTime(0);

        let initSegment = null;
        const fmp4Fragments = [];

        transmuxer.on('data', (segment) => {
            if (!initSegment && segment.initSegment && segment.initSegment.byteLength > 0) {
                initSegment = new Uint8Array(segment.initSegment);
            }
            if (segment.data && segment.data.byteLength > 0) {
                fmp4Fragments.push(new Uint8Array(segment.data));
            }
        });

        for (let i = 0; i < buffers.length; i++) {
            const buf = buffers[i];
            transmuxer.push(new Uint8Array(buf instanceof ArrayBuffer ? buf : buf.buffer || buf));
            buffers[i] = null;
            transmuxer.flush();
        }
        transmuxer.dispose();

        if (!initSegment) {
            self.postMessage({ id, error: 'Transmux produced no init segment' });
            return;
        }

        // Step 2: Defragment fMP4 → regular MP4 (VLC-compatible)
        const { ftyp, tracks } = parseInit(initSegment);
        const mdatSlices = parseFragments(fmp4Fragments, tracks);
        fmp4Fragments.length = 0; // free memory

        const trackInfo = tracks.map(t =>
            `${t.handler}(id=${t.id}, ts=${t.timescale}, samples=${t.samples.length}, dur=${t.totalDuration})`
        ).join(', ');
        self.postMessage({ id, debug: `Defragmented: ${trackInfo}` });

        const blob = buildRegularMP4(ftyp, tracks, mdatSlices);
        mdatSlices.length = 0;

        self.postMessage({ id, blob });
    } catch (err) {
        self.postMessage({ id, error: err.message || 'Transmux failed' });
    }
});
