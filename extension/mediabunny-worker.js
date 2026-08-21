// RumbleX Mediabunny conversion worker.
// Kept as an extension-owned module so production and golden-sample tests run
// the same MPEG-TS -> MP4 implementation.

const mediabunnyUrl = typeof RUMBLEX_MEDIABUNNY_URL === 'string'
    ? RUMBLEX_MEDIABUNNY_URL
    : new URL('lib/mediabunny.min.mjs', self.location.href).href;

const mediabunnyModulePromise = import(mediabunnyUrl);

function normalizeBuffer(value) {
    if (value instanceof Uint8Array) return value;
    if (value instanceof ArrayBuffer) return new Uint8Array(value);
    if (ArrayBuffer.isView(value)) {
        return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
    }
    return new Uint8Array(value?.buffer || value || []);
}

const streamSessions = new Map();

function streamAbortError(message = 'The download was cancelled.') {
    return new DOMException(message, 'AbortError');
}

function rejectStreamWaiters(session, error) {
    if (session.inputRequest) {
        try { session.inputRequest.controller.error(error); } catch {}
        session.inputRequest.reject(error);
        session.inputRequest = null;
    }
    for (const pending of session.outputAcks.values()) pending.reject(error);
    session.outputAcks.clear();
}

function acceptStreamInput(session, value, done = false) {
    const pending = session.inputRequest;
    if (!pending) throw new Error('Mediabunny requested no input chunk');
    session.inputRequest = null;
    if (done) {
        pending.controller.close();
    } else {
        const bytes = normalizeBuffer(value);
        session.inputBytes += bytes.byteLength;
        session.inputChunks++;
        pending.controller.enqueue(bytes);
    }
    pending.resolve();
}

async function startStreamSession(id, options = {}) {
    if (streamSessions.has(id)) throw new Error('Duplicate Mediabunny stream session');
    const session = {
        id,
        stage: 'mediabunny-stream-module-import',
        inputRequest: null,
        inputBytes: 0,
        inputChunks: 0,
        outputBytes: 0,
        outputChunks: 0,
        outputAcks: new Map(),
        outputSequence: 0,
        conversion: null,
        cancelled: false,
    };
    streamSessions.set(id, session);
    const reportStage = () => self.postMessage({
        id,
        debug: { engine: 'mediabunnyWebCodecs', stage: session.stage },
    });
    reportStage();

    try {
        const {
            Input,
            Output,
            Conversion,
            ALL_FORMATS,
            ReadableStreamSource,
            Mp4OutputFormat,
            StreamTarget,
        } = await mediabunnyModulePromise;
        if (session.cancelled) throw streamAbortError();

        const inputStream = new ReadableStream({
            pull(controller) {
                if (session.cancelled) throw streamAbortError();
                if (session.inputRequest) throw new Error('Concurrent Mediabunny input request');
                return new Promise((resolve, reject) => {
                    session.inputRequest = { controller, resolve, reject };
                    self.postMessage({ id, stream: { type: 'input-request' } });
                });
            },
            cancel(reason) {
                session.cancelled = true;
                rejectStreamWaiters(session, reason || streamAbortError());
            },
        }, { highWaterMark: 0 });

        const outputStream = new WritableStream({
            write(chunk) {
                if (session.cancelled) throw streamAbortError();
                const data = normalizeBuffer(chunk?.data).slice();
                const sequence = ++session.outputSequence;
                session.outputBytes = Math.max(
                    session.outputBytes,
                    Number(chunk?.position || 0) + data.byteLength,
                );
                session.outputChunks++;
                return new Promise((resolve, reject) => {
                    session.outputAcks.set(sequence, { resolve, reject });
                    self.postMessage({
                        id,
                        stream: {
                            type: 'output-chunk',
                            sequence,
                            position: Number(chunk?.position || 0),
                            data: data.buffer,
                        },
                    }, [data.buffer]);
                });
            },
        }, { highWaterMark: 1 });

        const input = new Input({
            source: new ReadableStreamSource(inputStream, {
                maxCacheSize: Math.max(0, Math.min(
                    128 * 1024 * 1024,
                    Number(options.inputCacheBytes) || 32 * 1024 * 1024,
                )),
            }),
            formats: ALL_FORMATS,
        });
        const target = new StreamTarget(outputStream, {
            chunked: true,
            chunkSize: Math.max(1024, Math.min(
                64 * 1024 * 1024,
                Number(options.chunkSize) || 8 * 1024 * 1024,
            )),
        });
        const output = new Output({
            format: new Mp4OutputFormat(),
            target,
        });

        session.stage = 'mediabunny-stream-conversion-init';
        reportStage();
        session.conversion = await Conversion.init({
            input,
            output,
            tracks: 'primary',
            showWarnings: false,
        });
        if (!session.conversion.isValid) {
            const reasons = (session.conversion.discardedTracks || [])
                .map((entry) => entry?.reason || 'discarded-track')
                .join(', ');
            throw new Error('Mediabunny conversion rejected tracks' + (reasons ? ': ' + reasons : ''));
        }

        session.stage = 'mediabunny-stream-conversion';
        reportStage();
        await session.conversion.execute();
        if (session.cancelled) throw streamAbortError();
        session.stage = 'complete';
        self.postMessage({
            id,
            stream: {
                type: 'complete',
                diagnostic: {
                    engine: 'mediabunnyWebCodecs',
                    stage: session.stage,
                    inputBytes: session.inputBytes,
                    inputChunks: session.inputChunks,
                    outputBytes: session.outputBytes,
                    outputChunks: session.outputChunks,
                    webCodecs: typeof VideoDecoder === 'function',
                },
            },
        });
    } catch (error) {
        rejectStreamWaiters(session, error);
        self.postMessage({
            id,
            stream: {
                type: 'error',
                error: error?.message || 'Mediabunny streaming conversion failed',
                errorName: error?.name || 'Error',
                diagnostic: {
                    engine: 'mediabunnyWebCodecs',
                    stage: session.stage,
                    inputBytes: session.inputBytes,
                    inputChunks: session.inputChunks,
                    outputBytes: session.outputBytes,
                    outputChunks: session.outputChunks,
                    webCodecs: typeof VideoDecoder === 'function',
                },
            },
        });
    } finally {
        streamSessions.delete(id);
    }
}

self.addEventListener('message', async (event) => {
    const { id, action, buffers } = event.data || {};
    if (action === 'transmux-mediabunny-stream-start') {
        void startStreamSession(id, event.data?.options).catch((error) => {
            self.postMessage({
                id,
                stream: {
                    type: 'error',
                    error: error?.message || 'Mediabunny stream setup failed',
                    errorName: error?.name || 'Error',
                },
            });
        });
        return;
    }
    const streamSession = streamSessions.get(id);
    if (action === 'transmux-mediabunny-stream-input') {
        if (streamSession) acceptStreamInput(streamSession, event.data?.data, false);
        return;
    }
    if (action === 'transmux-mediabunny-stream-end') {
        if (streamSession) acceptStreamInput(streamSession, null, true);
        return;
    }
    if (action === 'transmux-mediabunny-stream-output-ack') {
        const pending = streamSession?.outputAcks.get(event.data?.sequence);
        if (pending) {
            streamSession.outputAcks.delete(event.data.sequence);
            pending.resolve();
        }
        return;
    }
    if (action === 'transmux-mediabunny-stream-output-error') {
        const pending = streamSession?.outputAcks.get(event.data?.sequence);
        if (pending) {
            streamSession.outputAcks.delete(event.data.sequence);
            pending.reject(new Error(event.data?.error || 'Selected-file write failed'));
        }
        return;
    }
    if (action === 'transmux-mediabunny-stream-abort') {
        if (streamSession) {
            streamSession.cancelled = true;
            const error = streamAbortError();
            rejectStreamWaiters(streamSession, error);
            try { await streamSession.conversion?.cancel(); } catch {}
        }
        return;
    }
    if (action !== 'transmux-mediabunny') return;
    let stage = 'mediabunny-input';
    const reportStage = () => self.postMessage({
        id,
        debug: { engine: 'mediabunnyWebCodecs', stage },
    });
    try {
        stage = 'mediabunny-module-import';
        reportStage();
        const {
            Input,
            Output,
            Conversion,
            ALL_FORMATS,
            BlobSource,
            Mp4OutputFormat,
            BufferTarget,
        } = await mediabunnyModulePromise;
        stage = 'mediabunny-input';
        reportStage();
        const sourceBlob = new Blob((buffers || []).map(normalizeBuffer), { type: 'video/mp2t' });
        const input = new Input({
            source: new BlobSource(sourceBlob),
            formats: ALL_FORMATS,
        });
        const target = new BufferTarget();
        stage = 'mediabunny-output';
        reportStage();
        const output = new Output({
            format: new Mp4OutputFormat(),
            target,
        });
        stage = 'mediabunny-conversion-init';
        reportStage();
        const conversion = await Conversion.init({
            input,
            output,
            tracks: 'primary',
            showWarnings: false,
        });
        if (!conversion.isValid) {
            const reasons = (conversion.discardedTracks || [])
                .map((entry) => entry?.reason || 'discarded-track')
                .join(', ');
            throw new Error('Mediabunny conversion rejected tracks' + (reasons ? ': ' + reasons : ''));
        }
        stage = 'mediabunny-conversion';
        reportStage();
        await conversion.execute();
        stage = 'mediabunny-output-validate';
        reportStage();
        if (!target.buffer || !target.buffer.byteLength) {
            throw new Error('Mediabunny produced an empty MP4 buffer');
        }
        const blob = new Blob([target.buffer], { type: 'video/mp4' });
        self.postMessage({
            id,
            blob,
            diagnostic: {
                engine: 'mediabunnyWebCodecs',
                stage: 'complete',
                inputBuffers: Array.isArray(buffers) ? buffers.length : 0,
                webCodecs: typeof VideoDecoder === 'function',
            },
        });
    } catch (error) {
        self.postMessage({
            id,
            error: error?.message || 'Mediabunny conversion failed',
            diagnostic: {
                engine: 'mediabunnyWebCodecs',
                stage,
                inputBuffers: Array.isArray(buffers) ? buffers.length : 0,
                webCodecs: typeof VideoDecoder === 'function',
            },
        });
    }
});
