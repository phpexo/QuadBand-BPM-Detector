/**
 * Lokale Datenhaltung. Alle Daten bleiben im Browser (localStorage) -
 * es gibt keinen Server, keine Cloud, keine Uebertragung nach aussen.
 * Das ist bei Gesundheitsdaten dieser Art eine bewusste Entscheidung.
 */

import { EXERCISES } from './data/exercises.js';

const KEY = 'medtrack.state.v1';
const SCHEMA_VERSION = 2;

export const DEFAULT_STATE = {
  version: SCHEMA_VERSION,
  settings: {
    weightKg: 85,
    heightCm: 180,
    sex: 'm',
    age: 30,
    tUnit: 'ng/dl',
    labIntervalDays: 180,
    bpIntervalDays: 7,
    calibration: 1,
    disclaimerAcceptedAt: null,
    curveWindowPast: 30,
    curveWindowFuture: 30,
    e1rmFormula: 'epley',
    barKg: 20,
    plates: [25, 20, 15, 10, 5, 2.5, 1.25],
    restSeconds: 120,
    reminders: { injection: true, lab: true, doctor: true, bloodpressure: false },
    notified: {},
  },
  protocols: [],
  injections: [],
  panels: [],
  bodyLog: [],
  workouts: [],
  routines: [],
  activeSession: null,
  doctorVisits: [],
  customCompounds: [],
  customExercises: [],
};

const listeners = new Set();
let needsPersistAfterLoad = false;
let state = load();
if (needsPersistAfterLoad) persist();

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
  const from = s.version || 1;
  if (from < 2) migrateWorkoutsToExerciseIds(s);
  s.version = SCHEMA_VERSION;
  // Ergebnis sofort zurueckschreiben, sonst laeuft die Migration bei jedem
  // Start erneut und der Speicher bleibt auf dem alten Stand.
  if (from !== SCHEMA_VERSION) needsPersistAfterLoad = true;
  return s;
}

/**
 * Version 1 speicherte Uebungen als freien Text. Ab Version 2 verweisen Saetze
 * auf eine Uebungs-ID, damit Muskelgruppen, Rekorde und Verlauf zusammenpassen.
 * Unbekannte Namen werden als eigene Uebung uebernommen, damit nichts verloren geht.
 */
function migrateWorkoutsToExerciseIds(s) {
  // Umlaute vereinheitlichen, damit "Bankdruecken" und "Bankdrücken" denselben
  // Schluessel ergeben. Nur exakte Treffer werden zugeordnet - eine Uebung wie
  // "Beinpresse Sondergeraet" soll nicht stillschweigend mit "Beinpresse"
  // verschmelzen, sonst wird der Verlauf verfaelscht.
  const norm = (v) => String(v || '')
    .toLowerCase()
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]/g, '');
  const byName = new Map();
  for (const ex of EXERCISES) byName.set(norm(ex.name), ex.id);
  s.customExercises = s.customExercises || [];

  for (const w of s.workouts || []) {
    for (const set of w.sets || []) {
      if (set.exerciseId || !set.exercise) continue;
      const key = norm(set.exercise);
      let id = byName.get(key);
      if (!id) {
        id = `custom-ex-${key || uid()}`;
        if (!s.customExercises.some((e) => e.id === id)) {
          s.customExercises.push({
            id, name: set.exercise, equipment: 'other',
            primary: [], secondary: [], type: 'weight_reps', custom: true,
          });
        }
        byName.set(key, id);
      }
      set.exerciseId = id;
    }
  }
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

export function uid() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

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
