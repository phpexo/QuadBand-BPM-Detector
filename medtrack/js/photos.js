/**
 * Fortschrittsfotos.
 *
 * Bilder liegen in IndexedDB, nicht im localStorage - dort waere schon nach
 * wenigen Aufnahmen Schluss. Sie verlassen das Geraet nicht und sind auch
 * nicht Teil des JSON-Exports; dafuer gibt es einen eigenen Download.
 */

const DB_NAME = 'medtrack-photos';
const STORE = 'photos';
const MAX_EDGE = 1280;
const QUALITY = 0.82;

function openDb() {
  return new Promise((resolve, reject) => {
    if (!('indexedDB' in globalThis)) { reject(new Error('IndexedDB nicht verfuegbar')); return; }
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'id' }).createIndex('at', 'at');
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function tx(db, mode, fn) {
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const req = fn(t.objectStore(STORE));
    t.oncomplete = () => resolve(req?.result);
    t.onerror = () => reject(t.error);
  });
}

/** Verkleinert das Bild, bevor es gespeichert wird. */
export async function compressImage(file) {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  canvas.getContext('2d').drawImage(bitmap, 0, 0, w, h);
  bitmap.close?.();
  const blob = await new Promise((res) => canvas.toBlob(res, 'image/jpeg', QUALITY));
  return { blob, width: w, height: h };
}

export async function addPhoto(file, { at = new Date().toISOString(), note = '', pose = 'front' } = {}) {
  const { blob, width, height } = await compressImage(file);
  const record = { id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, at, note, pose, blob, width, height, size: blob.size };
  const db = await openDb();
  await tx(db, 'readwrite', (store) => store.put(record));
  db.close();
  return record;
}

export async function listPhotos() {
  const db = await openDb();
  const all = await tx(db, 'readonly', (store) => store.getAll());
  db.close();
  return (all || []).sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
}

export async function deletePhoto(id) {
  const db = await openDb();
  await tx(db, 'readwrite', (store) => store.delete(id));
  db.close();
}

export async function photoStats() {
  const list = await listPhotos();
  return { count: list.length, bytes: list.reduce((s, p) => s + (p.size || 0), 0) };
}

export const objectUrl = (record) => URL.createObjectURL(record.blob);
