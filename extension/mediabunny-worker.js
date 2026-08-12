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

self.addEventListener('message', async (event) => {
    const { id, action, buffers } = event.data || {};
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
