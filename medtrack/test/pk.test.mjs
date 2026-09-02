import test from 'node:test';
import assert from 'node:assert/strict';
import {
  bateman, depotRemaining, ratesFor, rate, tMax, terminalHalfLife,
  steadyState, simulate, buildDoseEvents, amountAt, concentration, releasedPercent, LN2,
} from '../js/pk/engine.js';
import { COMPOUND_BY_ID, baseAmount } from '../js/pk/compounds.js';

const TE = COMPOUND_BY_ID['test-enanthate'];
const TP = COMPOUND_BY_ID['test-propionate'];
const TU = COMPOUND_BY_ID['test-undecanoate-im'];
const TREN_A = COMPOUND_BY_ID['tren-acetate'];

test('Esterfaktoren entsprechen den Molmassenverhaeltnissen', () => {
  assert.equal(baseAmount(TE, 250), 180);                       // 250 mg Test E = 180 mg Testosteron
  assert.ok(Math.abs(baseAmount(TP, 100) - 83.7) < 0.1);
  assert.ok(Math.abs(baseAmount(COMPOUND_BY_ID['tren-acetate'], 100) - 86.5) < 0.1);
  assert.ok(Math.abs(baseAmount(COMPOUND_BY_ID['nandrolone-decanoate'], 200) - 128) < 0.5);
});

test('Depot zerfaellt exponentiell mit der Ester-Halbwertszeit', () => {
  const { ka } = ratesFor(TE);
  const d = baseAmount(TE, 250);
  assert.ok(Math.abs(depotRemaining(d, ka, TE.tHalfAbs) - d / 2) < 1e-9);
  assert.ok(Math.abs(depotRemaining(d, ka, 2 * TE.tHalfAbs) - d / 4) < 1e-9);
  assert.ok(Math.abs(releasedPercent(TE, TE.tHalfAbs) - 50) < 1e-6);
});

test('Bateman: Massenbilanz - alles Freigesetzte wird auch eliminiert', () => {
  const { ka, ke } = ratesFor(TE);
  const dose = 180;
  // Integral von ke*A(t) dt ueber die gesamte Zeit muss der Dosis entsprechen
  const dt = 0.002, horizon = 200;
  let eliminated = 0;
  for (let t = dt / 2; t < horizon; t += dt) eliminated += ke * bateman(dose, ka, ke, t) * dt;
  assert.ok(Math.abs(eliminated - dose) / dose < 0.005, `Bilanz ${eliminated} vs ${dose}`);
});

test('Flip-Flop-Kinetik: terminale HWZ folgt dem Ester, nicht dem Hormon', () => {
  // Testosteron selbst hat ~1 h HWZ; unter Enantat zerfaellt der Spiegel mit ~4.5 d
  assert.ok(Math.abs(terminalHalfLife(TE) - 4.5) < 1e-9);
  const { ka, ke } = ratesFor(TE);
  const a1 = bateman(180, ka, ke, 30);
  const a2 = bateman(180, ka, ke, 30 + 4.5);
  assert.ok(Math.abs(a2 / a1 - 0.5) < 0.01, `Verhaeltnis ${a2 / a1}`);
});

test('tMax liegt bei kurzen Estern frueher als bei langen', () => {
  const p = tMax(...Object.values(ratesFor(TP)));
  const e = tMax(...Object.values(ratesFor(TE)));
  const u = tMax(...Object.values(ratesFor(TU)));
  assert.ok(p < e && e < u, `${p} < ${e} < ${u}`);
  assert.ok(e > 0.2 && e < 2, `tMax Test E unplausibel: ${e} d`);
});

test('Steady State 100 mg Test E/Woche liegt im real beobachteten Bereich', () => {
  const ss = steadyState(TE, 100, 7, { weightKg: 80 });
  // Literatur/Praxis: ca. 600-900 ng/dl Mittelwert bei 100 mg/Woche
  assert.ok(ss.serum.avg > 600 && ss.serum.avg < 950, `avg ${ss.serum.avg.toFixed(0)} ng/dl`);
  assert.ok(ss.serum.max > ss.serum.avg && ss.serum.min < ss.serum.avg);
  assert.ok(Math.abs(ss.timeTo90Percent - 3.32 * 4.5) < 1e-6);
  assert.ok(ss.weeklyBaseMg === 72);
});

test('Aufteilung derselben Wochendosis senkt die Schwankungsbreite', () => {
  const weekly = steadyState(TE, 100, 7, { weightKg: 80 });
  const eod = steadyState(TE, 50, 3.5, { weightKg: 80 });
  assert.ok(eod.fluctuationPercent < weekly.fluctuationPercent);
  // Mittelwert bleibt praktisch gleich, nur die Amplitude sinkt
  assert.ok(Math.abs(eod.serum.avg - weekly.serum.avg) / weekly.serum.avg < 0.02);
});

test('Nebido: sehr traege Kinetik, langer Weg bis zum Fliessgleichgewicht', () => {
  const ss = steadyState(TU, 1000, 84, { weightKg: 80 });
  assert.ok(ss.timeTo90Percent > 100, `${ss.timeTo90Percent} d`);
  assert.ok(ss.serum.avg > 300 && ss.serum.avg < 900, `avg ${ss.serum.avg.toFixed(0)}`);
});

test('Superposition: zwei Dosen ergeben die Summe der Einzelkurven', () => {
  const { ka, ke } = ratesFor(TE);
  const events = [
    { t: -7, baseMg: 72, ka, ke },
    { t: 0, baseMg: 72, ka, ke },
  ];
  const expected = bateman(72, ka, ke, 3 + 7) + bateman(72, ka, ke, 3);
  assert.ok(Math.abs(amountAt(events, 3) - expected) < 1e-12);
});

test('simulate liefert getrennte Reihen pro Basis-Hormon', () => {
  const now = Date.parse('2026-01-15T08:00:00Z');
  const entries = [
    { at: '2026-01-01T08:00:00Z', compoundId: 'test-enanthate', doseMg: 125 },
    { at: '2026-01-08T08:00:00Z', compoundId: 'test-enanthate', doseMg: 125 },
    { at: '2026-01-08T08:00:00Z', compoundId: 'tren-acetate', doseMg: 50 },
  ];
  const events = buildDoseEvents(entries, (id) => COMPOUND_BY_ID[id], now);
  const sim = simulate(events, { fromDays: -14, toDays: 14, points: 100, weightKg: 85 });
  const names = sim.series.map((s) => s.base).sort();
  assert.deepEqual(names, ['Testosteron', 'Trenbolon']);
  const t = sim.series.find((s) => s.base === 'Testosteron');
  const tren = sim.series.find((s) => s.base === 'Trenbolon');
  assert.ok(t.serum !== null, 'Testosteron hat ein hinterlegtes Vd');
  assert.equal(tren.serum, null, 'Trenbolon: keine Humandaten -> kein ng/dl-Wert');
  assert.ok(tren.relative.some((v) => v > 90), 'relative Kurve wird auf 100 % normiert');
});

test('Vergangenheit vor der ersten Injektion ist null', () => {
  const now = Date.now();
  const events = buildDoseEvents(
    [{ at: new Date(now).toISOString(), compoundId: 'test-enanthate', doseMg: 100 }],
    (id) => COMPOUND_BY_ID[id], now);
  assert.equal(amountAt(events, -1), 0);
  assert.ok(amountAt(events, 1) > 0);
});

test('Orale Substanz: schnelle Resorption, Elimination bestimmt die Kurve', () => {
  const anavar = COMPOUND_BY_ID['oxandrolone'];
  assert.ok(Math.abs(terminalHalfLife(anavar) - 9 / 24) < 1e-9);
  const { ka, ke } = ratesFor(anavar);
  assert.ok(ka > ke, 'orale Resorption ist schneller als die Elimination');
  assert.ok(tMax(ka, ke) < 0.2, 'Peak innerhalb weniger Stunden');
});

test('concentration ohne Verteilungsvolumen liefert null statt Fantasiewerten', () => {
  assert.equal(concentration(50, TREN_A, 80), null);
  assert.ok(concentration(50, TE, 80) > 0);
});

test('rate/HWZ-Umrechnung ist konsistent', () => {
  assert.ok(Math.abs(rate(4.5) - LN2 / 4.5) < 1e-15);
});
