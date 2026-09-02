/** Verbindet gespeicherte Daten mit der PK-Engine. */

import { COMPOUNDS, COMPOUND_BY_ID, baseAmount } from './pk/compounds.js';
import { buildDoseEvents, ratesFor, MS_PER_DAY } from './pk/engine.js';
import { getState } from './store.js';

export function allCompounds(state = getState()) {
  return [...COMPOUNDS, ...(state.customCompounds || [])];
}

export function resolver(state = getState()) {
  const custom = Object.fromEntries((state.customCompounds || []).map((c) => [c.id, c]));
  return (id) => COMPOUND_BY_ID[id] || custom[id] || null;
}

export function compoundOptions(state = getState()) {
  const groups = new Map();
  for (const c of allCompounds(state)) {
    if (!groups.has(c.cls)) groups.set(c.cls, []);
    groups.get(c.cls).push(c);
  }
  return groups;
}

/**
 * Geplante zukuenftige Dosen aus den aktiven Protokollen. Diese werden als
 * gestrichelte Kurve dargestellt - es ist eine Projektion, keine Empfehlung.
 */
export function projectedDoses(state, horizonDays = 60, now = Date.now()) {
  const out = [];
  for (const p of state.protocols || []) {
    if (!p.active) continue;
    const interval = Number(p.intervalDays);
    if (!(interval > 0)) continue;
    const lastReal = (state.injections || [])
      .filter((i) => i.compoundId === p.compoundId)
      .map((i) => Date.parse(i.at))
      .sort((a, b) => b - a)[0];
    let next = lastReal ? lastReal + interval * MS_PER_DAY : Math.max(Date.parse(p.startAt || now), now);
    while (next < now) next += interval * MS_PER_DAY;
    for (let t = next; t <= now + horizonDays * MS_PER_DAY; t += interval * MS_PER_DAY) {
      out.push({ at: new Date(t).toISOString(), compoundId: p.compoundId, doseMg: Number(p.doseMg), projected: true, protocolId: p.id });
    }
  }
  return out.sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
}

export function nextScheduled(state, now = Date.now()) {
  const next = projectedDoses(state, 400, now)[0];
  if (!next) return null;
  const c = resolver(state)(next.compoundId);
  return { ...next, compound: c, inDays: (Date.parse(next.at) - now) / MS_PER_DAY };
}

/** Dosis-Ereignisse: erfolgte Injektionen und optional die Projektion. */
export function doseEvents(state, { includeProjected = true, horizonDays = 60, now = Date.now() } = {}) {
  const entries = [...(state.injections || [])];
  if (includeProjected) entries.push(...projectedDoses(state, horizonDays, now));
  return buildDoseEvents(entries, resolver(state), now);
}

export function pastEvents(state, now = Date.now()) {
  return buildDoseEvents(state.injections || [], resolver(state), now);
}

/** Fettfreie Masse und FFMI aus dem letzten Koerpereintrag. */
export function bodyMetrics(entry, heightCm) {
  if (!entry?.weightKg) return null;
  const w = Number(entry.weightKg);
  const bf = entry.bodyFat != null && entry.bodyFat !== '' ? Number(entry.bodyFat) : null;
  const h = (Number(heightCm) || 180) / 100;
  const lean = bf != null ? w * (1 - bf / 100) : null;
  return {
    weight: w, bodyFat: bf, lean,
    ffmi: lean ? lean / (h * h) : null,
    normFfmi: lean ? lean / (h * h) + 6.1 * (1.8 - h) : null,
    bmi: w / (h * h),
  };
}

/** Koerperfett-Schaetzung nach der US-Navy-Formel (Maenner). */
export function navyBodyFat({ waistCm, neckCm, heightCm }) {
  if (!waistCm || !neckCm || !heightCm) return null;
  const v = 495 / (1.0324 - 0.19077 * Math.log10(waistCm - neckCm) + 0.15456 * Math.log10(heightCm)) - 450;
  return Number.isFinite(v) ? Math.max(2, Math.min(60, v)) : null;
}

/** Geschaetztes 1RM nach Epley. */
export const e1rm = (weight, reps) => (reps > 0 ? weight * (1 + reps / 30) : 0);

export const totalVolume = (sets = []) =>
  sets.reduce((sum, s) => sum + (Number(s.weight) || 0) * (Number(s.reps) || 0), 0);

export { baseAmount, ratesFor };
