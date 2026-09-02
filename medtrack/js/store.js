/**
 * Lokale Datenhaltung. Alle Daten bleiben im Browser (localStorage) -
 * es gibt keinen Server, keine Cloud, keine Uebertragung nach aussen.
 * Das ist bei Gesundheitsdaten dieser Art eine bewusste Entscheidung.
 */

const KEY = 'medtrack.state.v1';
const SCHEMA_VERSION = 1;

export const DEFAULT_STATE = {
  version: SCHEMA_VERSION,
  settings: {
    weightKg: 85,
    heightCm: 180,
    tUnit: 'ng/dl',
    labIntervalDays: 180,
    calibration: 1,
    disclaimerAcceptedAt: null,
    curveWindowPast: 30,
    curveWindowFuture: 30,
  },
  protocols: [],
  injections: [],
  panels: [],
  bodyLog: [],
  workouts: [],
  doctorVisits: [],
  customCompounds: [],
};

const listeners = new Set();
let state = load();

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return structuredClone(DEFAULT_STATE);
    const parsed = JSON.parse(raw);
    return migrate({ ...structuredClone(DEFAULT_STATE), ...parsed,
      settings: { ...DEFAULT_STATE.settings, ...(parsed.settings || {}) } });
  } catch (err) {
    console.warn('Gespeicherte Daten konnten nicht gelesen werden:', err);
    return structuredClone(DEFAULT_STATE);
  }
}

function migrate(s) {
  s.version = SCHEMA_VERSION;
  return s;
}

function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch (err) {
    console.error('Speichern fehlgeschlagen:', err);
    alert('Die Daten konnten nicht gespeichert werden. Ist der private Modus aktiv oder der Speicher voll?');
  }
}

export const getState = () => state;
export const getSettings = () => state.settings;

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function notify() {
  for (const fn of listeners) fn(state);
}

export function update(mutator) {
  mutator(state);
  persist();
  notify();
  return state;
}

export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

export function addItem(collection, item) {
  return update((s) => {
    s[collection].unshift({ id: uid(), ...item });
    s[collection].sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
  });
}

export function updateItem(collection, id, patch) {
  return update((s) => {
    const i = s[collection].findIndex((x) => x.id === id);
    if (i >= 0) s[collection][i] = { ...s[collection][i], ...patch };
  });
}

export function removeItem(collection, id) {
  return update((s) => { s[collection] = s[collection].filter((x) => x.id !== id); });
}

export function setSetting(key, value) {
  return update((s) => { s.settings[key] = value; });
}

export function exportJson() {
  return JSON.stringify({ ...state, exportedAt: new Date().toISOString() }, null, 2);
}

export function importJson(text) {
  const parsed = JSON.parse(text);
  if (typeof parsed !== 'object' || parsed === null) throw new Error('Ungueltige Datei');
  update((s) => {
    for (const key of Object.keys(DEFAULT_STATE)) {
      if (key === 'settings') s.settings = { ...DEFAULT_STATE.settings, ...(parsed.settings || {}) };
      else if (Array.isArray(parsed[key])) s[key] = parsed[key];
    }
  });
}

export function resetAll() {
  state = structuredClone(DEFAULT_STATE);
  persist();
  notify();
}

/** CSV-Export einer Sammlung - fuer Arztgespraeche oder eigene Auswertungen. */
export function toCsv(rows, columns) {
  const esc = (v) => {
    const s = v == null ? '' : String(v);
    return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [columns.map((c) => esc(c.label)).join(';'),
    ...rows.map((r) => columns.map((c) => esc(c.get(r))).join(';'))].join('\n');
}

export function downloadFile(name, content, type = 'application/json') {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
