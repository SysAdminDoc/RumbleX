#!/usr/bin/env node
'use strict';

const assert = require('assert/strict');
const crypto = require('crypto');

const SIGNATURE_CONTEXT = Buffer.from('CRX3 SignedData\0', 'utf8');

function readVarint(buffer, state, label) {
    let value = 0;
    let factor = 1;
    for (let count = 0; count < 8; count += 1) {
        assert.ok(state.offset < buffer.length, `${label} ends inside a protobuf varint`);
        const byte = buffer[state.offset++];
        value += (byte & 0x7f) * factor;
        assert.ok(Number.isSafeInteger(value), `${label} contains an oversized protobuf varint`);
        if ((byte & 0x80) === 0) return value;
        factor *= 128;
    }
    assert.fail(`${label} contains an invalid protobuf varint`);
}

function readLengthDelimitedFields(buffer, label) {
    const state = { offset: 0 };
    const fields = new Map();
    while (state.offset < buffer.length) {
        const tag = readVarint(buffer, state, label);
        const field = Math.floor(tag / 8);
        const wire = tag & 7;
        assert.ok(field > 0, `${label} contains protobuf field zero`);

        if (wire === 0) {
            readVarint(buffer, state, label);
            continue;
        }
        if (wire === 1 || wire === 5) {
            const width = wire === 1 ? 8 : 4;
            assert.ok(state.offset + width <= buffer.length, `${label} ends inside protobuf field ${field}`);
            state.offset += width;
            continue;
        }
        assert.equal(wire, 2, `${label} uses unsupported protobuf wire type ${wire}`);
        const length = readVarint(buffer, state, label);
        const end = state.offset + length;
        assert.ok(end <= buffer.length, `${label} ends inside protobuf field ${field}`);
        const values = fields.get(field) || [];
        values.push(buffer.subarray(state.offset, end));
        fields.set(field, values);
        state.offset = end;
    }
    return fields;
}

function oneField(fields, number, label) {
    const values = fields.get(number) || [];
    assert.equal(values.length, 1, `${label} must contain protobuf field ${number} exactly once`);
    return values[0];
}

function verifyCrx3(bytes) {
    assert.ok(Buffer.isBuffer(bytes), 'CRX3 input must be a Buffer');
    assert.ok(bytes.length >= 12, 'CRX3 file is truncated');
    assert.equal(bytes.subarray(0, 4).toString('ascii'), 'Cr24', 'Chrome package is not a CRX');
    assert.equal(bytes.readUInt32LE(4), 3, 'Chrome package is not CRX3');

    const headerLength = bytes.readUInt32LE(8);
    const archiveOffset = 12 + headerLength;
    assert.ok(headerLength > 0 && archiveOffset < bytes.length, 'Chrome CRX3 header length is invalid');

    const header = readLengthDelimitedFields(bytes.subarray(12, archiveOffset), 'CRX3 header');
    const signedHeader = oneField(header, 10000, 'CRX3 header');
    const signedData = readLengthDelimitedFields(signedHeader, 'CRX3 signed header');
    const crxId = oneField(signedData, 1, 'CRX3 signed header');
    assert.equal(crxId.length, 16, 'CRX3 id must be exactly 16 bytes');

    const size = Buffer.alloc(4);
    size.writeUInt32LE(signedHeader.length);
    const archive = bytes.subarray(archiveOffset);
    const proofs = header.get(2) || [];
    assert.ok(proofs.length > 0, 'CRX3 has no RSA-SHA256 proof');

    let matchingKey = null;
    for (const [index, proofBytes] of proofs.entries()) {
        const proof = readLengthDelimitedFields(proofBytes, `CRX3 RSA proof ${index + 1}`);
        const publicKey = oneField(proof, 1, `CRX3 RSA proof ${index + 1}`);
        const signature = oneField(proof, 2, `CRX3 RSA proof ${index + 1}`);
        const derivedId = crypto.createHash('sha256').update(publicKey).digest().subarray(0, 16);
        if (!crypto.timingSafeEqual(derivedId, crxId)) continue;

        const verifier = crypto.createVerify('RSA-SHA256');
        verifier.update(SIGNATURE_CONTEXT);
        verifier.update(size);
        verifier.update(signedHeader);
        verifier.update(archive);
        verifier.end();
        if (verifier.verify({ key: publicKey, format: 'der', type: 'spki' }, signature)) {
            matchingKey = publicKey;
            break;
        }
    }

    assert.ok(matchingKey, 'CRX3 developer RSA-SHA256 signature is invalid or does not match crx_id');
    return {
        archive,
        archiveOffset,
        crxId: Buffer.from(crxId),
        publicKey: Buffer.from(matchingKey),
    };
}

module.exports = { readLengthDelimitedFields, verifyCrx3 };
