/**
 * Auswertung der Trainingsdaten. Reine Funktionen ohne DOM- oder Store-Zugriff,
 * damit sie sich testen lassen.
 */

import { MUSCLE_ORDER } from '../data/exercises.js';

const MS_PER_DAY = 86400000;

/** Geschaetztes Einwiederholungsmaximum. */
export const E1RM_FORMULAS = {
  epley: (w, r) => (r <= 1 ? w : w * (1 + r / 30)),
  brzycki: (w, r) => (r <= 1 ? w : w * (36 / (37 - r))),
  lombardi: (w, r) => (r <= 1 ? w : w * r ** 0.10),
};

export function e1rm(weight, reps, formula = 'epley') {
  const w = Number(weight) || 0;
  const r = Number(reps) || 0;
  if (w <= 0 || r <= 0) return 0;
  if (r > 12) return E1RM_FORMULAS.epley(w, r); // Brzycki wird jenseits davon instabil
  return (E1RM_FORMULAS[formula] || E1RM_FORMULAS.epley)(w, r);
}

/**
 * Effektives Gewicht eines Satzes. Bei Koerpergewichtsuebungen zaehlt das
 * Koerpergewicht mit, sonst waeren Klimmzuege mit 0 kg bewertet.
 */
export function effectiveWeight(set, exercise, bodyweightKg = 0) {
  const added = Number(set.weight) || 0;
  switch (exercise?.type) {
    case 'bodyweight_reps': return bodyweightKg;
    case 'weighted_bodyweight': return bodyweightKg + added;
    default: return added;
  }
}

export function setVolume(set, exercise, bodyweightKg = 0) {
  if (exercise?.type === 'time' || exercise?.type === 'cardio') return 0;
  return effectiveWeight(set, exercise, bodyweightKg) * (Number(set.reps) || 0);
}

export function workoutVolume(workout, resolve, bodyweightKg = 0) {
  return (workout.sets || []).reduce(
    (sum, s) => sum + (s.warmup ? 0 : setVolume(s, resolve(s.exerciseId), bodyweightKg)), 0);
}

export function workoutSetCount(workout, { includeWarmup = false } = {}) {
  return (workout.sets || []).filter((s) => includeWarmup || !s.warmup).length;
}

/**
 * Saetze je Muskelgruppe in einem Zeitraum. Der primaer belastete Muskel
 * zaehlt voll, sekundaer beteiligte zur Haelfte - so wird es in der
 * Trainingsplanung ueblicherweise gerechnet.
 */
export function setsPerMuscle(workouts, resolve, { from = -Infinity, to = Infinity } = {}) {
  const counts = Object.fromEntries(MUSCLE_ORDER.map((m) => [m, 0]));
  for (const w of workouts) {
    const t = Date.parse(w.at);
    if (t < from || t > to) continue;
    for (const s of w.sets || []) {
      if (s.warmup) continue;
      const ex = resolve(s.exerciseId);
      if (!ex) continue;
      for (const m of ex.primary || []) counts[m] = (counts[m] || 0) + 1;
      for (const m of ex.secondary || []) counts[m] = (counts[m] || 0) + 0.5;
    }
  }
  return counts;
}

/** Wochenwerte je Muskelgruppe fuer die letzten n Wochen. */
export function weeklyMuscleHistory(workouts, resolve, weeks = 8, now = Date.now()) {
  const out = [];
  for (let i = weeks - 1; i >= 0; i--) {
    const to = now - i * 7 * MS_PER_DAY;
    const from = to - 7 * MS_PER_DAY;
    out.push({ weeksAgo: i, from, to, counts: setsPerMuscle(workouts, resolve, { from, to }) });
  }
  return out;
}

/** Bestleistungen je Uebung. */
export function personalRecords(workouts, resolve, bodyweightKg = 0) {
  const records = new Map();
  for (const w of [...workouts].sort((a, b) => Date.parse(a.at) - Date.parse(b.at))) {
    const perExercise = new Map();
    for (const s of w.sets || []) {
      if (s.warmup) continue;
      const ex = resolve(s.exerciseId);
      if (!ex || ex.type === 'cardio') continue;
      const weight = effectiveWeight(s, ex, bodyweightKg);
      const reps = Number(s.reps) || 0;
      const est = ex.type === 'time' ? 0 : e1rm(weight, reps);
      const rec = records.get(s.exerciseId) || {
        exerciseId: s.exerciseId, bestE1rm: null, bestWeight: null, bestReps: null, bestVolume: null,
      };
      if (est > 0 && (!rec.bestE1rm || est > rec.bestE1rm.value + 1e-9)) {
        rec.bestE1rm = { value: est, at: w.at, weight, reps };
      }
      if (weight > 0 && (!rec.bestWeight || weight > rec.bestWeight.value + 1e-9)) {
        rec.bestWeight = { value: weight, at: w.at, reps };
      }
      if (reps > 0 && (!rec.bestReps || reps > rec.bestReps.value)) {
        rec.bestReps = { value: reps, at: w.at, weight };
      }
      records.set(s.exerciseId, rec);
      perExercise.set(s.exerciseId, (perExercise.get(s.exerciseId) || 0) + setVolume(s, ex, bodyweightKg));
    }
    for (const [id, vol] of perExercise) {
      const rec = records.get(id);
      if (rec && vol > 0 && (!rec.bestVolume || vol > rec.bestVolume.value + 1e-9)) {
        rec.bestVolume = { value: vol, at: w.at };
      }
    }
  }
  return records;
}

/**
 * Prueft, ob ein Satz einen neuen Bestwert darstellt - gegen die Rekorde,
 * die VOR diesem Satz galten.
 */
export function detectPr(set, exercise, records, bodyweightKg = 0) {
  if (!exercise || exercise.type === 'cardio' || exercise.type === 'time') return null;
  const rec = records.get(exercise.id);
  const weight = effectiveWeight(set, exercise, bodyweightKg);
  const reps = Number(set.reps) || 0;
  const est = e1rm(weight, reps);
  if (!rec) return est > 0 ? 'erster Eintrag' : null;
  if (rec.bestE1rm && est > rec.bestE1rm.value + 1e-9) return 'Bestwert e1RM';
  if (rec.bestWeight && weight > rec.bestWeight.value + 1e-9) return 'hoechstes Gewicht';
  if (rec.bestReps && weight >= (rec.bestWeight?.value ?? 0) && reps > rec.bestReps.value) return 'meiste Wiederholungen';
  return null;
}

/** Alle Trainingseinheiten, in denen eine Uebung vorkam - neueste zuerst. */
export function exerciseHistory(workouts, exerciseId, resolve, bodyweightKg = 0) {
  const out = [];
  for (const w of workouts) {
    const sets = (w.sets || []).filter((s) => s.exerciseId === exerciseId);
    if (!sets.length) continue;
    const ex = resolve(exerciseId);
    const working = sets.filter((s) => !s.warmup);
    out.push({
      at: w.at,
      workoutId: w.id,
      sets,
      volume: working.reduce((sum, s) => sum + setVolume(s, ex, bodyweightKg), 0),
      topE1rm: Math.max(0, ...working.map((s) => e1rm(effectiveWeight(s, ex, bodyweightKg), s.reps))),
      topWeight: Math.max(0, ...working.map((s) => effectiveWeight(s, ex, bodyweightKg))),
    });
  }
  return out.sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
}

/** Die zuletzt absolvierten Saetze einer Uebung - Vorlage fuer den naechsten Satz. */
export function lastPerformance(workouts, exerciseId) {
  const sorted = [...workouts].sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
  for (const w of sorted) {
    const sets = (w.sets || []).filter((s) => s.exerciseId === exerciseId && !s.warmup);
    if (sets.length) return { at: w.at, sets };
  }
  return null;
}

/** Trainingsfrequenz je Muskelgruppe (Einheiten pro Woche im Zeitraum). */
export function muscleFrequency(workouts, resolve, days = 28, now = Date.now()) {
  const from = now - days * MS_PER_DAY;
  const seen = Object.fromEntries(MUSCLE_ORDER.map((m) => [m, new Set()]));
  for (const w of workouts) {
    const t = Date.parse(w.at);
    if (t < from || t > now) continue;
    const day = new Date(t).toISOString().slice(0, 10);
    for (const s of w.sets || []) {
      if (s.warmup) continue;
      const ex = resolve(s.exerciseId);
      for (const m of ex?.primary || []) seen[m]?.add(day);
    }
  }
  const weeks = days / 7;
  return Object.fromEntries(Object.entries(seen).map(([m, set]) => [m, set.size / weeks]));
}

/**
 * Hantelscheiben-Belegung je Seite. Gibt zurueck, was aufgelegt werden muss
 * und welches Gewicht damit exakt erreichbar ist.
 */
export function platePlan(targetKg, barKg = 20, plates = [25, 20, 15, 10, 5, 2.5, 1.25]) {
  const perSide = (Number(targetKg) - Number(barKg)) / 2;
  if (!(perSide > 0)) return { perSide: [], achievable: Number(barKg), rest: Number(targetKg) - Number(barKg) };
  let rest = perSide;
  const used = [];
  for (const p of [...plates].sort((a, b) => b - a)) {
    while (rest >= p - 1e-9) { used.push(p); rest -= p; }
  }
  const achievable = barKg + 2 * used.reduce((a, b) => a + b, 0);
  return { perSide: used, achievable, rest: Number((targetKg - achievable).toFixed(3)) };
}

/** Lineare Trendsteigung (kg pro Woche) ueber eine Punktreihe. */
export function trendPerWeek(points) {
  const valid = points.filter((p) => Number.isFinite(p.value));
  if (valid.length < 2) return null;
  const t0 = Date.parse(valid[0].at);
  const xs = valid.map((p) => (Date.parse(p.at) - t0) / MS_PER_DAY / 7);
  const ys = valid.map((p) => p.value);
  const n = xs.length;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0, den = 0;
  for (let i = 0; i < n; i++) { num += (xs[i] - mx) * (ys[i] - my); den += (xs[i] - mx) ** 2; }
  return den === 0 ? null : num / den;
}

export { MS_PER_DAY };
