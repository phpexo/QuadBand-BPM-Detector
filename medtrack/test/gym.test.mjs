import test from 'node:test';
import assert from 'node:assert/strict';
import {
  e1rm, effectiveWeight, setVolume, workoutVolume, workoutSetCount, setsPerMuscle,
  personalRecords, detectPr, exerciseHistory, lastPerformance, muscleFrequency,
  platePlan, trendPerWeek,
} from '../js/gym/stats.js';
import { findExercise, EXERCISE_BY_ID, MUSCLES } from '../js/data/exercises.js';

const resolve = (id) => findExercise(id, []);
const NOW = Date.parse('2026-06-01T12:00:00Z');
const daysAgo = (d) => new Date(NOW - d * 86400000).toISOString();

test('e1RM: eine Wiederholung bleibt das Gewicht selbst', () => {
  assert.equal(e1rm(100, 1), 100);
  assert.equal(e1rm(0, 5), 0);
  assert.equal(e1rm(100, 0), 0);
});

test('e1RM-Formeln liegen dicht beieinander und steigen mit den Wiederholungen', () => {
  const epley = e1rm(100, 5, 'epley');
  const brzycki = e1rm(100, 5, 'brzycki');
  assert.ok(Math.abs(epley - 116.7) < 0.1, `${epley}`);
  assert.ok(Math.abs(brzycki - 112.5) < 0.1, `${brzycki}`);
  assert.ok(e1rm(100, 8) > e1rm(100, 5));
});

test('Koerpergewichtsuebungen zaehlen das Koerpergewicht mit', () => {
  const pullup = EXERCISE_BY_ID['pullup'];        // weighted_bodyweight
  const pushup = EXERCISE_BY_ID['pushup'];        // bodyweight_reps
  const bench = EXERCISE_BY_ID['bench-press'];    // weight_reps
  assert.equal(effectiveWeight({ weight: 20 }, pullup, 85), 105);
  assert.equal(effectiveWeight({ weight: 0 }, pushup, 85), 85);
  assert.equal(effectiveWeight({ weight: 100 }, bench, 85), 100);
  assert.equal(setVolume({ weight: 20, reps: 5 }, pullup, 85), 525);
});

test('Aufwaermsaetze zaehlen nicht ins Volumen', () => {
  const w = { at: daysAgo(1), sets: [
    { exerciseId: 'bench-press', weight: 60, reps: 10, warmup: true },
    { exerciseId: 'bench-press', weight: 100, reps: 5 },
  ] };
  assert.equal(workoutVolume(w, resolve, 85), 500);
  assert.equal(workoutSetCount(w), 1);
  assert.equal(workoutSetCount(w, { includeWarmup: true }), 2);
});

test('Saetze je Muskelgruppe: primaer voll, sekundaer zur Haelfte', () => {
  const workouts = [{ at: daysAgo(1), sets: [
    { exerciseId: 'bench-press', weight: 100, reps: 5 },
    { exerciseId: 'bench-press', weight: 100, reps: 5 },
    { exerciseId: 'bench-press', weight: 100, reps: 5 },
  ] }];
  const counts = setsPerMuscle(workouts, resolve);
  assert.equal(counts.chest, 3);
  assert.equal(counts.triceps, 1.5);
  assert.equal(counts.frontdelt, 1.5);
  assert.equal(counts.quads, 0);
});

test('Zeitraumfilter der Muskelauswertung greift', () => {
  const workouts = [
    { at: daysAgo(2), sets: [{ exerciseId: 'squat', weight: 100, reps: 5 }] },
    { at: daysAgo(40), sets: [{ exerciseId: 'squat', weight: 100, reps: 5 }] },
  ];
  const week = setsPerMuscle(workouts, resolve, { from: NOW - 7 * 86400000, to: NOW });
  assert.equal(week.quads, 1);
  assert.equal(setsPerMuscle(workouts, resolve).quads, 2);
});

test('Bestleistungen werden chronologisch aufgebaut', () => {
  const workouts = [
    { at: daysAgo(20), sets: [{ exerciseId: 'bench-press', weight: 100, reps: 5 }] },
    { at: daysAgo(10), sets: [{ exerciseId: 'bench-press', weight: 105, reps: 5 }] },
    { at: daysAgo(3), sets: [{ exerciseId: 'bench-press', weight: 90, reps: 12 }] },
  ];
  const rec = personalRecords(workouts, resolve, 85).get('bench-press');
  assert.equal(rec.bestWeight.value, 105);
  assert.equal(rec.bestReps.value, 12);
  assert.ok(rec.bestE1rm.value > 120, `${rec.bestE1rm.value}`);
  assert.ok(rec.bestVolume.value >= 1080);
});

test('Neue Bestwerte werden erkannt, schwaechere Saetze nicht', () => {
  const workouts = [{ at: daysAgo(10), sets: [{ exerciseId: 'bench-press', weight: 100, reps: 5 }] }];
  const records = personalRecords(workouts, resolve, 85);
  const bench = EXERCISE_BY_ID['bench-press'];
  assert.equal(detectPr({ weight: 100, reps: 5 }, bench, records, 85), null);
  assert.equal(detectPr({ weight: 105, reps: 5 }, bench, records, 85), 'Bestwert e1RM');
  assert.equal(detectPr({ weight: 90, reps: 5 }, bench, records, 85), null);
  assert.equal(detectPr({ weight: 60, reps: 5 }, bench, new Map(), 85), 'erster Eintrag');
});

test('Uebungsverlauf und letzte Leistung', () => {
  const workouts = [
    { id: 'a', at: daysAgo(14), sets: [{ exerciseId: 'squat', weight: 120, reps: 5 }] },
    { id: 'b', at: daysAgo(7), sets: [{ exerciseId: 'squat', weight: 125, reps: 5 }, { exerciseId: 'squat', weight: 125, reps: 4 }] },
    { id: 'c', at: daysAgo(2), sets: [{ exerciseId: 'bench-press', weight: 100, reps: 5 }] },
  ];
  const hist = exerciseHistory(workouts, 'squat', resolve, 85);
  assert.equal(hist.length, 2);
  assert.equal(hist[0].workoutId, 'b', 'neueste Einheit zuerst');
  assert.equal(hist[0].topWeight, 125);
  const last = lastPerformance(workouts, 'squat');
  assert.equal(last.sets.length, 2);
  assert.equal(lastPerformance(workouts, 'deadlift'), null);
});

test('Trainingsfrequenz zaehlt Tage, nicht Saetze', () => {
  const workouts = [
    { at: daysAgo(1), sets: [{ exerciseId: 'bench-press', weight: 100, reps: 5 }, { exerciseId: 'bench-press', weight: 100, reps: 5 }] },
    { at: daysAgo(4), sets: [{ exerciseId: 'bench-press', weight: 100, reps: 5 }] },
  ];
  const freq = muscleFrequency(workouts, resolve, 28, NOW);
  assert.ok(Math.abs(freq.chest - 2 / 4) < 1e-9, `${freq.chest}`);
});

test('Scheibenrechner belegt korrekt und meldet nicht erreichbare Gewichte', () => {
  const a = platePlan(100, 20);
  assert.deepEqual(a.perSide, [25, 15]);
  assert.equal(a.achievable, 100);
  assert.equal(a.rest, 0);

  const b = platePlan(102.5, 20);
  assert.equal(b.achievable, 102.5);

  const c = platePlan(101, 20);
  assert.equal(c.achievable, 100);
  assert.equal(c.rest, 1);

  assert.deepEqual(platePlan(20, 20).perSide, []);
  assert.deepEqual(platePlan(15, 20).perSide, []);
});

test('Trendsteigung in kg pro Woche', () => {
  const points = [
    { at: daysAgo(14), value: 100 },
    { at: daysAgo(7), value: 102 },
    { at: daysAgo(0), value: 104 },
  ];
  assert.ok(Math.abs(trendPerWeek(points) - 2) < 1e-9);
  assert.equal(trendPerWeek([{ at: daysAgo(1), value: 100 }]), null);
});

test('Uebungsdatenbank ist konsistent', () => {
  const ids = new Set();
  for (const [id, ex] of Object.entries(EXERCISE_BY_ID)) {
    assert.ok(!ids.has(id), `doppelte ID: ${id}`);
    ids.add(id);
    assert.ok(ex.name, `${id} ohne Namen`);
    for (const m of [...(ex.primary || []), ...(ex.secondary || [])]) {
      assert.ok(MUSCLES[m], `${id}: unbekannte Muskelgruppe ${m}`);
    }
  }
});
