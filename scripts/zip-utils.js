#!/usr/bin/env node
'use strict';

const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const CRC_TABLE = (() => {
    const table = new Uint32Array(256);
    for (let value = 0; value < 256; value += 1) {
        let crc = value;
        for (let bit = 0; bit < 8; bit += 1) {
            crc = (crc & 1) ? (0xedb88320 ^ (crc >>> 1)) : (crc >>> 1);
        }
        table[value] = crc >>> 0;
    }
    return table;
})();

function crc32(data) {
    let crc = 0xffffffff;
    for (const byte of data) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
    return (crc ^ 0xffffffff) >>> 0;
}

function createDeterministicZip(entries) {
    const normalized = entries
        .map(({ name, data }) => ({
            name: name.replaceAll('\\', '/').replace(/^\.\//, ''),
            data: Buffer.isBuffer(data) ? data : Buffer.from(data),
        }))
        .sort((left, right) => (left.name < right.name ? -1 : left.name > right.name ? 1 : 0));

    assert.ok(normalized.length > 0, 'cannot create an empty ZIP');
    assert.ok(normalized.length <= 0xffff, 'ZIP64 is not supported');
    assert.equal(new Set(normalized.map(({ name }) => name)).size, normalized.length,
        'ZIP entries must have unique names');

    const localParts = [];
    const centralParts = [];
    let localOffset = 0;
    const flags = 0x0800; // UTF-8 names.
    const method = 0; // Stored bytes make output independent of zlib versions.
    const dosTime = 0;
    const dosDate = 0x2821; // 2000-01-01 00:00:00.

    for (const entry of normalized) {
        const name = Buffer.from(entry.name, 'utf8');
        const checksum = crc32(entry.data);
        assert.ok(entry.data.length <= 0xffffffff, `${entry.name} requires ZIP64`);

        const local = Buffer.alloc(30);
        local.writeUInt32LE(0x04034b50, 0);
        local.writeUInt16LE(20, 4);
        local.writeUInt16LE(flags, 6);
        local.writeUInt16LE(method, 8);
        local.writeUInt16LE(dosTime, 10);
        local.writeUInt16LE(dosDate, 12);
        local.writeUInt32LE(checksum, 14);
        local.writeUInt32LE(entry.data.length, 18);
        local.writeUInt32LE(entry.data.length, 22);
        local.writeUInt16LE(name.length, 26);
        local.writeUInt16LE(0, 28);
        localParts.push(local, name, entry.data);

        const central = Buffer.alloc(46);
        central.writeUInt32LE(0x02014b50, 0);
        central.writeUInt16LE(0x0314, 4); // ZIP 2.0, created on Unix.
        central.writeUInt16LE(20, 6);
        central.writeUInt16LE(flags, 8);
        central.writeUInt16LE(method, 10);
        central.writeUInt16LE(dosTime, 12);
        central.writeUInt16LE(dosDate, 14);
        central.writeUInt32LE(checksum, 16);
        central.writeUInt32LE(entry.data.length, 20);
        central.writeUInt32LE(entry.data.length, 24);
        central.writeUInt16LE(name.length, 28);
        central.writeUInt16LE(0, 30);
        central.writeUInt16LE(0, 32);
        central.writeUInt16LE(0, 34);
        central.writeUInt16LE(0, 36);
        central.writeUInt32LE(0x81a40000, 38); // Regular file, mode 0644.
        central.writeUInt32LE(localOffset, 42);
        centralParts.push(central, name);

        localOffset += local.length + name.length + entry.data.length;
    }

    const centralDirectory = Buffer.concat(centralParts);
    const end = Buffer.alloc(22);
    end.writeUInt32LE(0x06054b50, 0);
    end.writeUInt16LE(0, 4);
    end.writeUInt16LE(0, 6);
    end.writeUInt16LE(normalized.length, 8);
    end.writeUInt16LE(normalized.length, 10);
    end.writeUInt32LE(centralDirectory.length, 12);
    end.writeUInt32LE(localOffset, 16);
    end.writeUInt16LE(0, 20);

    return Buffer.concat([...localParts, centralDirectory, end]);
}

function writeFileAtomically(file, data) {
    const temporary = `${file}.tmp-${process.pid}`;
    fs.writeFileSync(temporary, data);
    try {
        fs.rmSync(file, { force: true });
        fs.renameSync(temporary, file);
    } finally {
        fs.rmSync(temporary, { force: true });
    }
}

function readArchive(file) {
    const buf = fs.readFileSync(file);
    const EOCD_SIG = 0x06054b50;
    let eocd = -1;
    for (let index = buf.length - 22; index >= 0 && index >= buf.length - 22 - 0xffff; index -= 1) {
        if (buf.readUInt32LE(index) === EOCD_SIG) {
            eocd = index;
            break;
        }
    }
    assert.ok(eocd >= 0, `${path.basename(file)} is not a valid ZIP (no end-of-central-directory record)`);

    const entryCount = buf.readUInt16LE(eocd + 10);
    let offset = buf.readUInt32LE(eocd + 16);
    const entries = new Map();
    for (let index = 0; index < entryCount; index += 1) {
        assert.equal(buf.readUInt32LE(offset), 0x02014b50,
            `${path.basename(file)} central directory is malformed at entry ${index}`);
        const compression = buf.readUInt16LE(offset + 10);
        const compressedSize = buf.readUInt32LE(offset + 20);
        const uncompressedSize = buf.readUInt32LE(offset + 24);
        const nameLength = buf.readUInt16LE(offset + 28);
        const extraLength = buf.readUInt16LE(offset + 30);
        const commentLength = buf.readUInt16LE(offset + 32);
        const localOffset = buf.readUInt32LE(offset + 42);
        const name = buf.toString('utf8', offset + 46, offset + 46 + nameLength).replace(/^\.\//, '');
        assert.ok(!entries.has(name), `${path.basename(file)} contains duplicate entry ${name}`);
        assert.equal(buf.readUInt32LE(localOffset), 0x04034b50,
            `${path.basename(file)} local header is malformed for ${name}`);

        const localNameLength = buf.readUInt16LE(localOffset + 26);
        const localExtraLength = buf.readUInt16LE(localOffset + 28);
        const dataStart = localOffset + 30 + localNameLength + localExtraLength;
        const compressed = buf.subarray(dataStart, dataStart + compressedSize);
        let data;
        if (compression === 0) data = Buffer.from(compressed);
        else if (compression === 8) data = zlib.inflateRawSync(compressed);
        else assert.fail(`${path.basename(file)} uses unsupported ZIP compression ${compression} for ${name}`);
        assert.equal(data.length, uncompressedSize,
            `${path.basename(file)} has the wrong uncompressed size for ${name}`);
        entries.set(name, data);
        offset += 46 + nameLength + extraLength + commentLength;
    }
    return entries;
}

module.exports = {
    createDeterministicZip,
    readArchive,
    writeFileAtomically,
};
