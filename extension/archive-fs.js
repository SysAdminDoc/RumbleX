// RumbleX archive destination helper.
// Shared by the options page, MV3 service worker, and offscreen document. The
// persisted FileSystemDirectoryHandle lives in extension-origin IndexedDB; no
// path or handle is sent to a remote service.
(function (root) {
    'use strict';

    const DB_NAME = 'rx-fs-access';
    const DB_VERSION = 1;
    const STORE_NAME = 'handles';
    const ARCHIVE_FOLDER_KEY = 'archiveFolder';

    function openDb() {
        if (typeof indexedDB === 'undefined') return Promise.reject(new Error('indexeddb-unavailable'));
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);
            request.onupgradeneeded = () => {
                const db = request.result;
                if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME);
            };
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error || new Error('idb-open-failed'));
        });
    }

    async function getHandle(key = ARCHIVE_FOLDER_KEY) {
        const db = await openDb();
        try {
            return await new Promise((resolve, reject) => {
                const tx = db.transaction(STORE_NAME, 'readonly');
                const request = tx.objectStore(STORE_NAME).get(key);
                request.onsuccess = () => resolve(request.result || null);
                request.onerror = () => reject(request.error || new Error('idb-get-failed'));
            });
        } finally {
            db.close();
        }
    }

    async function putHandle(key = ARCHIVE_FOLDER_KEY, handle) {
        const db = await openDb();
        try {
            await new Promise((resolve, reject) => {
                const tx = db.transaction(STORE_NAME, 'readwrite');
                tx.objectStore(STORE_NAME).put(handle, key);
                tx.oncomplete = () => resolve();
                tx.onerror = () => reject(tx.error || new Error('idb-put-failed'));
                tx.onabort = () => reject(tx.error || new Error('idb-put-aborted'));
            });
            return true;
        } finally {
            db.close();
        }
    }

    async function deleteHandle(key = ARCHIVE_FOLDER_KEY) {
        const db = await openDb();
        try {
            await new Promise((resolve, reject) => {
                const tx = db.transaction(STORE_NAME, 'readwrite');
                tx.objectStore(STORE_NAME).delete(key);
                tx.oncomplete = () => resolve();
                tx.onerror = () => reject(tx.error || new Error('idb-delete-failed'));
                tx.onabort = () => reject(tx.error || new Error('idb-delete-aborted'));
            });
            return true;
        } finally {
            db.close();
        }
    }

    async function queryPermission(handle) {
        if (!handle) return 'missing';
        if (typeof handle.queryPermission !== 'function') {
            return typeof handle.getFileHandle === 'function' ? 'granted' : 'unknown';
        }
        try {
            return await handle.queryPermission({ mode: 'readwrite' });
        } catch {
            return 'denied';
        }
    }

    async function requestPermission(handle) {
        if (!handle) return 'missing';
        const current = await queryPermission(handle);
        if (current === 'granted') return current;
        if (typeof handle.requestPermission !== 'function') return current;
        try {
            return await handle.requestPermission({ mode: 'readwrite' });
        } catch {
            return 'denied';
        }
    }

    async function getState(key = ARCHIVE_FOLDER_KEY) {
        const pickerSupported = typeof root.showDirectoryPicker === 'function';
        let handle = null;
        try { handle = await getHandle(key); } catch {}
        if (!handle) {
            return { pickerSupported, selected: false, name: null, permission: 'missing' };
        }
        return {
            pickerSupported,
            selected: true,
            name: String(handle.name || 'Selected folder').slice(0, 120),
            permission: await queryPermission(handle),
        };
    }

    async function pickFolder(key = ARCHIVE_FOLDER_KEY) {
        if (typeof root.showDirectoryPicker !== 'function') throw new Error('folder-picker-unsupported');
        const handle = await root.showDirectoryPicker({
            id: 'rx-channel-archive',
            startIn: 'downloads',
            mode: 'readwrite',
        });
        await putHandle(key, handle);
        return handle;
    }

    function sanitizeSegment(value, fallback) {
        const safe = String(value || '')
            .replace(/[<>:"/\\|?*\u0000-\u001f]+/g, ' ')
            .replace(/\s+/g, ' ')
            .trim()
            .slice(0, 120);
        return safe && safe !== '.' && safe !== '..' ? safe : fallback;
    }

    async function uniqueFileHandle(directory, filename) {
        const dot = filename.lastIndexOf('.');
        const stem = dot > 0 ? filename.slice(0, dot) : filename;
        const ext = dot > 0 ? filename.slice(dot) : '';
        for (let index = 0; index < 1000; index++) {
            const candidate = index === 0 ? filename : `${stem} (${index + 1})${ext}`;
            try {
                await directory.getFileHandle(candidate);
            } catch (error) {
                if (error?.name === 'NotFoundError') {
                    return { handle: await directory.getFileHandle(candidate, { create: true }), name: candidate };
                }
                throw error;
            }
        }
        throw new Error('filename-collision-limit');
    }

    async function writeSource(handle, relativePath, source) {
        if (!handle) return { ok: false, reason: 'folder-missing' };
        const permission = await queryPermission(handle);
        if (permission !== 'granted') return { ok: false, reason: 'folder-permission-' + permission };

        const rawParts = String(relativePath || '').replace(/\\+/g, '/').split('/').filter(Boolean).slice(0, 5);
        if (!rawParts.length) return { ok: false, reason: 'filename-missing' };
        const filename = sanitizeSegment(rawParts.pop(), 'rumble-video.mp4');
        const directories = rawParts.map((part) => sanitizeSegment(part, '')).filter(Boolean);

        let directory = handle;
        let writable = null;
        try {
            for (const part of directories) directory = await directory.getDirectoryHandle(part, { create: true });
            const target = await uniqueFileHandle(directory, filename);
            writable = await target.handle.createWritable();

            let bytesWritten = 0;
            if (source instanceof ArrayBuffer || ArrayBuffer.isView(source)) {
                await writable.write(source);
                bytesWritten = source.byteLength || 0;
            } else {
                const stream = source instanceof Blob ? source.stream() : source;
                if (!stream || typeof stream.getReader !== 'function') throw new Error('unsupported-write-source');
                const reader = stream.getReader();
                while (true) {
                    const { value, done } = await reader.read();
                    if (done) break;
                    await writable.write(value);
                    bytesWritten += value?.byteLength || 0;
                }
            }
            await writable.close();
            writable = null;
            return { ok: true, filename: [...directories, target.name].join('/'), bytesWritten };
        } catch (error) {
            if (writable) {
                try { await writable.abort('archive-write-failed'); } catch {}
            }
            return { ok: false, reason: 'folder-write-failed', error: String(error?.message || error).slice(0, 240) };
        }
    }

    async function writeUrl(url, relativePath, options = {}) {
        const handle = await getHandle(ARCHIVE_FOLDER_KEY);
        if (!handle) return { ok: false, reason: 'folder-missing' };
        try {
            const response = await fetch(url, { credentials: 'omit', signal: options.signal });
            if (!response.ok) return { ok: false, reason: 'http-' + response.status };
            if (!response.body) return { ok: false, reason: 'response-body-missing' };
            const expectedBytes = Number(response.headers.get('content-length')) || null;
            const result = await writeSource(handle, relativePath, response.body);
            if (options.signal?.aborted) return { ok: false, reason: 'offline-paused' };
            return { ...result, expectedBytes };
        } catch (error) {
            if (options.signal?.aborted || error?.name === 'AbortError') {
                return { ok: false, reason: 'offline-paused' };
            }
            return { ok: false, reason: 'folder-fetch-failed', error: String(error?.message || error).slice(0, 240) };
        }
    }

    root.RxArchiveFsAccess = Object.freeze({
        ARCHIVE_FOLDER_KEY,
        getHandle,
        putHandle,
        deleteHandle,
        getState,
        pickFolder,
        queryPermission,
        requestPermission,
        writeSource,
        writeUrl,
    });
})(globalThis);
